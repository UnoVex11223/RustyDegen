// Required dependencies
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const cors = require('cors');
const bodyParser = require('body-parser');
const SteamTotp = require('steam-totp');
const axios = require('axios'); // Still needed
const NodeCache = require('node-cache');
require('dotenv').config();

// --- Configuration Constants ---
const RUST_APP_ID = 252490;
const RUST_CONTEXT_ID = 2;
const ROUND_DURATION = parseInt(process.env.ROUND_DURATION_SECONDS) || 99;
const TICKET_VALUE_RATIO = parseFloat(process.env.TICKET_VALUE) || 0.01;
const DEPOSIT_TOKEN_EXPIRY_MS = 5 * 60 * 1000;
const PRICE_CACHE_TTL_SECONDS = parseInt(process.env.PRICE_CACHE_TTL_SECONDS) || 15 * 60; // 15 minutes default cache validity
const PRICE_REFRESH_INTERVAL_MS = (parseInt(process.env.PRICE_REFRESH_MINUTES) || 10) * 60 * 1000; // Default 10 mins refresh interval
const MIN_ITEM_VALUE = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10;
const PRICE_FETCH_TIMEOUT_MS = 30000; // 30 seconds timeout for SCMM API

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: process.env.SITE_URL || "*", methods: ["GET", "POST"] } });

// Configure middleware
app.use(cors({ origin: process.env.SITE_URL || "*", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 3600000 } }));
app.use(passport.initialize());
app.use(passport.session());

// --- Steam Strategy ---
if (!process.env.SITE_URL || !process.env.STEAM_API_KEY || !process.env.SESSION_SECRET) { console.error("FATAL: Missing Steam Auth env vars."); process.exit(1); }
passport.use(new SteamStrategy({ returnURL: `${process.env.SITE_URL}/auth/steam/return`, realm: process.env.SITE_URL, apiKey: process.env.STEAM_API_KEY, providerURL: 'https://steamcommunity.com/openid' },
    async (identifier, profile, done) => { try { let u = await User.findOne({ steamId: profile.id }); if (!u) { console.log(`Creating user: ${profile.displayName}`); u = await new User({ steamId: profile.id, username: profile.displayName, avatar: profile._json.avatarfull || '', tradeUrl: '' }).save(); } else { let upd = false; if (u.username !== profile.displayName) { u.username = profile.displayName; upd = true; } if (profile._json.avatarfull && u.avatar !== profile._json.avatarfull) { u.avatar = profile._json.avatarfull; upd = true; } if (upd) await u.save(); } return done(null, u); } catch (err) { console.error('SteamStrategy Error:', err); return done(err); } }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { try { const u = await User.findById(id); done(null, u); } catch (err) { console.error("DeserializeUser Err:", err); done(err); } });

// --- MongoDB Connection ---
if (!process.env.MONGODB_URI) { console.error("FATAL: MONGODB_URI missing."); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected to MongoDB')).catch(err => { console.error('MongoDB Connect Err:', err); process.exit(1); });

// --- MongoDB Schemas ---
const userSchema = new mongoose.Schema({ steamId: { type: String, required: true, unique: true, index: true }, username: { type: String, required: true }, avatar: { type: String }, tradeUrl: { type: String, default: '' }, balance: { type: Number, default: 0 }, createdAt: { type: Date, default: Date.now }, banned: { type: Boolean, default: false } });
const itemSchema = new mongoose.Schema({ assetId: { type: String, required: true, index: true }, name: { type: String, required: true }, image: { type: String, required: true }, price: { type: Number, required: true }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true, index: true }, depositedAt: { type: Date, default: Date.now } });
const roundSchema = new mongoose.Schema({ roundId: { type: Number, required: true, unique: true, index: true }, status: { type: String, enum: ['pending', 'active', 'rolling', 'completed', 'error'], default: 'pending', index: true }, startTime: { type: Date }, endTime: { type: Date }, completedTime: { type: Date }, totalValue: { type: Number, default: 0 }, items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }], participants: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, itemsValue: { type: Number, required: true }, tickets: { type: Number, required: true } }], winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, winningTicket: { type: Number }, serverSeed: { type: String, required: true }, serverSeedHash: { type: String, required: true }, clientSeed: { type: String }, provableHash: { type: String } });
const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Round = mongoose.model('Round', roundSchema);

// --- Steam Bot Setup ---
const community = new SteamCommunity();
const manager = new TradeOfferManager({ steam: community, domain: process.env.SITE_URL ? process.env.SITE_URL.replace(/^https?:\/\//, '') : 'localhost', language: 'en', pollInterval: 15000, cancelTime: 10 * 60 * 1000 });
let isBotReady = false; // Track bot readiness

// --- 2FA Code Generation ---
function generateAuthCode() { const s=process.env.STEAM_SHARED_SECRET; if(!s){console.error("STEAM_SHARED_SECRET missing.");return null;} try{return SteamTotp.generateAuthCode(s);} catch(e){console.error("2FA gen err:",e);return null;} }
const isBotConfigured = process.env.STEAM_USERNAME && process.env.STEAM_PASSWORD && process.env.STEAM_SHARED_SECRET;

// --- Steam Bot Login ---
if (isBotConfigured) {
   const creds = { accountName: process.env.STEAM_USERNAME, password: process.env.STEAM_PASSWORD, twoFactorCode: generateAuthCode() };
   if (creds.twoFactorCode) {
       console.log(`Attempting Steam login: ${creds.accountName}...`);
       community.login(creds, (err, sessionID, cookies) => {
           if (err) { console.error('FATAL STEAM LOGIN ERROR:', err); isBotReady = false; }
           else {
               console.log(`Steam bot ${creds.accountName} logged in (ID: ${community.steamID}).`);
               manager.setCookies(cookies, e => { if (e) { console.error('TOM cookie err:', e); isBotReady = false; return; } console.log('TOM cookies set.'); community.setCookies(cookies); community.gamesPlayed(process.env.SITE_NAME||'RustyDegen'); community.setPersona(SteamCommunity.EPersonaState.Online); isBotReady=true; console.log("Bot is ready, creating initial round..."); createNewRound(); });
               community.on('friendRelationship',(id,rel)=>{if(rel===SteamCommunity.EFriendRelationship.RequestRecipient){console.log(`Accept friend: ${id}`); community.addFriend(id, e=>{if(e)console.error(`Friend add err ${id}:`,e);});}});
           }
       });
   } else { console.warn("No 2FA code. Bot login skipped."); isBotReady = false; }
} else { console.warn("Bot creds incomplete. Trade features disabled."); isBotReady = false; }

// --- Active Round Data ---
let currentRound = null;
let roundTimer = null;
let isRolling = false;

// --- Deposit Security Token Store ---
const depositTokens = {};
function generateDepositToken(userId){const t=crypto.randomBytes(16).toString('hex'); const exp=Date.now()+DEPOSIT_TOKEN_EXPIRY_MS; depositTokens[t]={userId:userId.toString(),expiry:exp}; console.log(`Gen token ${t} for ${userId}`); setTimeout(()=>{if(depositTokens[t]?.expiry<=Date.now()){delete depositTokens[t];console.log(`Expired token ${t}`);}},DEPOSIT_TOKEN_EXPIRY_MS+1000); return t;}
async function verifyDepositToken(token, partnerSteamId){const s=depositTokens[token]; if(!s||s.expiry<=Date.now()){if(s)delete depositTokens[token];console.log(`Token ${token} invalid/expired.`);return null;} try{const u=await User.findOne({steamId:partnerSteamId}).lean(); if(!u||u._id.toString()!==s.userId){console.log(`Token ${token} verify fail.`);return null;} delete depositTokens[token]; console.log(`Verified token ${token} for ${u.username}`); return u;} catch(err){console.error(`Token verify err ${token}:`,err);return null;}}

// --- Pricing Cache and Functions --- NEW APPROACH ---
const priceCache = new NodeCache({ stdTTL: PRICE_CACHE_TTL_SECONDS, checkperiod: PRICE_CACHE_TTL_SECONDS * 0.2 });

// Fallback function remains the same
function getFallbackPrice(marketHashName) { const ci={'AK-47 | Alien Red': 45.00, 'Metal Chest Plate':5.20,'Semi-Automatic Rifle':10.00,'Garage Door':3.50,'Assault Rifle':8.50,'Metal Facemask':6.00,'Road Sign Kilt':1.50,'Coffee Can Helmet':1.20,'Double Barrel Shotgun':0.80,'Revolver':0.50,'Sheet Metal Door':0.75,'Medical Syringe':0.15,'MP5A4':2.50,'Python Revolver':1.80,'Satchel Charge':0.60,'Rocket Launcher':12.00,'Explosive 5.56 Rifle Ammo':0.20,'Timed Explosive Charge':4.50, 'Pump Shotgun': 1.00, 'Waterpipe Shotgun': 0.60, 'Thompson': 2.00,'Custom SMG': 1.50, 'Bolt Action Rifle': 9.00, 'L96 Rifle': 15.00,'M249': 18.00, 'Large Wood Box': 0.30, 'Small Oil Refinery': 1.00,'Furnace': 0.25, 'Blue Beenie Hat': 0.15, 'Blue Hoodie': 0.40, 'Wooden Door': 0.15 }; const fb=ci[marketHashName]; const minV=MIN_ITEM_VALUE>0?MIN_ITEM_VALUE:0; if(fb!==undefined){console.warn(`PRICE_INFO: Using fallback $${fb.toFixed(2)} for: ${marketHashName}`); return Math.max(fb,minV);}else{console.warn(`PRICE_INFO: No specific fallback for ${marketHashName}, using min $${minV.toFixed(2)}.`); return minV;}}

/**
 * Fetches ALL item prices from rust.scmm.app and updates the local cache.
 */
async function refreshPriceCache() {
    console.log("PRICE_INFO: Attempting to refresh price cache from rust.scmm.app...");
    const apiUrl = `https://rust.scmm.app/api/item/prices?currency=USD`;

    try {
        const response = await axios.get(apiUrl, { timeout: PRICE_FETCH_TIMEOUT_MS }); // Use configured timeout

        if (response.data && Array.isArray(response.data)) {
            const items = response.data;
            let updatedCount = 0;
            let newItems = [];

            items.forEach(item => {
                // ** Correction for Price Magnitude **
                // Assuming SCMM API returns price in the smallest currency unit (e.g., cents for USD)
                if (item?.name && typeof item.price === 'number' && item.price >= 0) { // Check if price is a non-negative number
                    const key = item.name;
                    // Divide by 100 to convert from cents (or smallest unit) to dollars/main unit
                    const priceInDollars = item.price / 100.0;

                    // Add to cache list (even if $0, as API provided it)
                    newItems.push({ key: key, val: priceInDollars, ttl: PRICE_CACHE_TTL_SECONDS });
                    updatedCount++;

                    // Optional: Log if price was exactly 0 from API
                    // if (item.price === 0) {
                    //     console.log(`PRICE_DEBUG: Storing $0.00 from API for ${key}`);
                    // }
                } else if (item?.name) { // Log items with invalid price fields
                     console.warn(`PRICE_WARN: Invalid or missing price field for item ${item.name} in SCMM response. Raw price: ${item.price}`);
                }
            });

            if (newItems.length > 0) {
                const success = priceCache.mset(newItems);
                if (success) { console.log(`PRICE_SUCCESS: Refreshed price cache with ${updatedCount} items from rust.scmm.app.`); }
                else { console.error("PRICE_ERROR: Failed to bulk set price cache."); }
            } else { console.warn("PRICE_WARN: No valid items found in the response from rust.scmm.app price refresh."); }
        } else {
            console.error("PRICE_ERROR: Invalid or empty array response received from rust.scmm.app price refresh. Response:", response.data);
        }
    } catch (error) {
        console.error(`PRICE_ERROR: Failed to fetch prices from ${apiUrl}.`);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
             console.error(` -> Error: Request timed out after ${PRICE_FETCH_TIMEOUT_MS}ms. SCMM API might be slow/unreachable.`);
        } else if (error.response) { console.error(` -> Status: ${error.response.status}, Response:`, error.response.data || error.message); }
        else if (error.request) { console.error(` -> Error: No response received (Network issue?).`, error.message); }
        else { console.error(' -> Error setting up request:', error.message); }
    }
}

/**
 * Gets item price from local cache, falling back if not found.
 * @param {string} marketHashName
 * @returns {number} Price in USD
 */
function getItemPrice(marketHashName) {
    const cachedPrice = priceCache.get(marketHashName);
    // Check if the value exists in cache (it might be 0, which is valid now)
    if (cachedPrice !== undefined) {
        // console.log(`PRICE_INFO: Cache hit for ${marketHashName}: $${cachedPrice.toFixed(2)}`); // Optional
        return cachedPrice;
    } else {
        // console.warn(`PRICE_WARN: Cache miss for ${marketHashName}. Using fallback.`); // Optional
        return getFallbackPrice(marketHashName); // Use fallback if not in cache
    }
}


// --- Core Game Logic --- (No changes needed here)
async function createNewRound() { if (isRolling) return; try { isRolling=false; const sS=crypto.randomBytes(32).toString('hex'); const sSH=crypto.createHash('sha256').update(sS).digest('hex'); const lR=await Round.findOne().sort('-rId'); const nId=lR?lR.rId+1:1; const r=new Round({rId:nId,s:'a',st:new Date(),sS,sSH,i:[],p:[],tV:0}); await r.save(); currentRound=r; startRoundTimer(); io.emit('rC',{rId:r.rId,sSH:r.sSH,tL:ROUND_DURATION,tV:0,p:[],i:[]}); console.log(`Round ${r.rId} created.`); return r; } catch (err) { console.error('Create round err:', err); setTimeout(createNewRound, 10000); } }
function startRoundTimer() { if (roundTimer) clearInterval(roundTimer); if (!currentRound?.startTime) { console.error("Start timer invalid state."); return; } currentRound.endTime=new Date(currentRound.startTime.getTime()+ROUND_DURATION*1000); currentRound.save().catch(e=>console.error("Save end time err:",e)); let tL=ROUND_DURATION; io.emit('tU',{tL}); roundTimer=setInterval(async()=>{ if(!currentRound?.endTime){clearInterval(roundTimer);roundTimer=null;console.error("Timer invalid state.");return;} const n=Date.now(); tL=Math.max(0,Math.floor((currentRound.endTime.getTime()-n)/1000)); io.emit('tU',{tL}); if(tL<=0){clearInterval(roundTimer);roundTimer=null;await endRound();} },1000); console.log(`Round ${currentRound.rId} timer start (${ROUND_DURATION}s).`); }
async function endRound() { if (!currentRound || isRolling || currentRound.status !== 'active') return; isRolling = true; console.log(`Ending round ${currentRound.roundId}...`); currentRound.status = 'rolling'; currentRound.endTime = new Date(); await currentRound.save(); io.emit('rRoll',{rId:currentRound.rId}); try { const round = await Round.findById(currentRound._id).populate('participants.user','u a s tU').populate('items'); if (!round) throw new Error(`Round ${currentRound._id} missing.`); currentRound=round; if (round.participants.length === 0 || round.totalValue <= 0) { console.log(`Round ${round.rId} empty.`); round.status='completed'; round.completedTime=new Date(); await round.save(); io.emit('rComp',{rId:round.rId, m:"Empty."}); } else { round.clientSeed=crypto.randomBytes(16).toString('hex'); const cbS=round.serverSeed+round.clientSeed; round.provableHash=crypto.createHash('sha256').update(cbS).digest('hex'); const dec=parseInt(round.provableHash.substring(0,8),16); const tT=round.participants.reduce((s,p)=>s+(p?.t||0),0); if(tT<=0) throw new Error(`Zero tickets round ${round.rId}.`); round.winningTicket=dec%tT; let tC=0, winner=null; for(const p of round.participants){if(!p?.t)continue; tC+=p.tickets; if(round.winningTicket<tC){winner=p.user;break;}} if(!winner) throw new Error(`Winner fail ${round.rId}.`); round.winner=winner._id; round.status='completed'; await round.save(); console.log(`Round ${round.rId} end. W: ${winner.username} (${round.winningTicket})`); io.emit('rWin',{rId:round.rId, w:{id:winner._id,sId:winner.sId,u:winner.u,a:winner.a}, wT:round.wT, tV:round.tV, tT:tT, sS:round.sS, cS:round.cS, pH:round.pH, sSH:round.sSH}); await sendWinningTradeOffer(round, winner); round.completedTime=new Date(); await round.save(); } } catch(err) { console.error(`End round err ${currentRound?.rId}:`, err); if(currentRound){currentRound.status='error';await currentRound.save().catch(e=>console.error("Save err status:",e)); io.emit('rErr',{rId:currentRound.rId, e:'Internal error.'});}} finally { isRolling=false; console.log("Scheduling next round..."); setTimeout(createNewRound, 10000); } }
async function sendWinningTradeOffer(round, winner) { if (!isBotReady) { console.error(`Cannot send winnings ${round.rId}: Bot not ready.`); io.emit('notif',{t:'warn', uId:winner._id.toString(), m:`Payout round ${round.rId} manual.`}); return; } console.log(`Sending winnings ${round.rId} to ${winner.username}...`); if (!winner.tradeUrl) { console.error(`Winner ${winner.u} no TU.`); io.emit('notif',{t:'err',uId:winner._id.toString(), m:'Set TU for winnings.'}); return; } if (!round.items?.length) { console.warn(`Round ${round.rId} no items.`); return; } try { const offer=manager.createOffer(winner.tradeUrl); offer.addMyItems(round.items.map(i=>({assetid:i.assetId,appid:RUST_APP_ID,contextid:RUST_CONTEXT_ID}))); offer.setMessage(`Win Round ${round.rId} on ${process.env.SITE_NAME||'RustyDegen'}!`); const st=await new Promise((res,rej)=>{offer.send((e,s)=>e?rej(e):res(s));}); console.log(`Offer ${offer.id} sent ${winner.u}. Status: ${st}`); io.emit('tOS',{rId:round.rId,uId:winner._id,u:winner.u,oId:offer.id, s:st}); } catch(err){ console.error(`Fail send offer ${round.rId}:`, err); io.emit('notif',{t:'err', uId:winner._id.toString(), m:`Fail send win ${round.rId}. Contact support.`}); } }

// --- Authentication Routes ---
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));
app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => { res.redirect('/'); });
app.post('/logout', (req, res, next) => { req.logout(e => { if(e) return next(e); req.session.destroy(e => { if(e) return res.status(500).json({e:'Logout failed'}); res.clearCookie('connect.sid'); res.json({success:true}); }); }); });

// --- Middleware & API Routes ---
function ensureAuthenticated(req, res, next) { if (req.isAuthenticated()) return next(); res.status(401).json({ error: 'Not authenticated' }); }
app.get('/api/user', ensureAuthenticated, (req, res) => { const { _id, steamId, username, avatar, tradeUrl, balance, createdAt } = req.user; res.json({ _id, steamId, username, avatar, tradeUrl, balance, createdAt }); });
app.post('/api/user/tradeurl', ensureAuthenticated, async (req, res) => { const { tradeUrl } = req.body; if (!tradeUrl?.includes('steamcommunity.com/tradeoffer/new/')) return res.status(400).json({e:'Invalid format'}); try { const url = new URL(tradeUrl); if (!url.searchParams.get('partner') || !url.searchParams.get('token')) return res.status(400).json({ e:'Invalid params'}); } catch (e) { return res.status(400).json({ e:'Invalid URL'}); } try { const u = await User.findByIdAndUpdate(req.user._id, {tradeUrl},{new:true}); if(!u) return res.status(404).json({e:'User missing'}); console.log(`TU Upd: ${u.username}`); res.json({success:true, tradeUrl:u.tradeUrl}); } catch(err) { console.error(`TU Upd Err ${req.user._id}:`, err); res.status(500).json({e:'Server error'}); } });

// GET USER INVENTORY - Uses getItemPrice (which reads cache)
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
    try {
       if (!manager) { console.error("Inv API fail: TOM not init."); return res.status(503).json({ error: "Trade service initialization failed." }); }
        const inventory = await new Promise((resolve, reject) => {
            manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                if (err) { if (err.message?.includes('profile is private')) return reject(new Error('Inv private.')); console.error(`Inv Fetch Err (Mgr): User ${req.user.steamId}:`, err.message||err); return reject(new Error(`Could not fetch inventory: ${err.message||'Steam err'}. Bot offline/Inv private?`)); }
                resolve(inv || []);
            });
        });
        if (!inventory?.length) return res.json([]);
        // Get prices from cache (or fallback) - This is now synchronous
        const itemsWithPrices = inventory.map(item => {
             const itemName = item.market_hash_name;
             let price = 0;
             if(itemName) { price = getItemPrice(itemName); } // Reads cache/fallback
             else { console.warn(`Inv item missing name: assetId ${item.assetid}`); }
             return { assetId: item.assetid, name: itemName || 'Unknown Item', displayName: item.name, image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`, price: price || 0, tradable: item.tradable, marketable: item.marketable };
        });
        const validItems = itemsWithPrices.filter(item => item.tradable && item.price >= MIN_ITEM_VALUE );
        res.json(validItems);
    } catch (err) { console.error(`Error in /api/inventory for ${req.user?.username}:`, err.message); res.status(500).json({ error: err.message || 'Server error fetching inventory.' }); }
});

// Initiate Deposit - REQUIRES BOT READY
app.post('/api/deposit/initiate', ensureAuthenticated, (req, res) => { if (!isBotReady || !process.env.BOT_TRADE_URL) { console.warn(`Deposit init fail ${req.user.username}: Bot unavailable.`); return res.status(503).json({ error: "Deposit service unavailable." }); } if (!currentRound || currentRound.status !== 'active' || isRolling) { return res.status(400).json({ error: 'Deposits closed.' }); } const token = generateDepositToken(req.user._id); res.json({ success: true, depositToken: token, botTradeUrl: process.env.BOT_TRADE_URL }); });

// --- Trade Offer Manager Event Handling --- Uses getItemPrice (cache)
if (isBotConfigured) {
   manager.on('newOffer', async (offer) => {
       if (!isBotReady) return;
       if(offer.isOurOffer||offer.itemsToReceive.length===0||!offer.message)return; if(!currentRound||currentRound.status!=='active'||isRolling){console.log(`Offer ${offer.id} dep closed.`);return offer.decline().catch(e=>console.error(`Decline err ${offer.id}:`,e));} const token=offer.message.trim(); let user; try{user=await verifyDepositToken(token,offer.partner.getSteamID64()); if(!user){console.log(`Offer ${offer.id} invalid token.`);return offer.decline().catch(e=>console.error(`Decline err ${offer.id}:`,e));}}catch(vErr){console.error(`Token verify err ${offer.id}:`,vErr);return offer.decline().catch(e=>console.error(`Decline err ${offer.id}:`,e));}
       try{
            const itemsToProcess = offer.itemsToReceive.map(item => { if (!item.market_hash_name) { console.warn(`Asset ${item.assetid} missing name. Skip.`); return null; } const price = getItemPrice(item.market_hash_name); const itemValue = parseFloat(price)||0; if (itemValue < MIN_ITEM_VALUE) return null; return { assetId: item.assetid, name: item.market_hash_name, image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`, price: itemValue, owner: user._id, roundId: currentRound._id }; }).filter(i => i !== null);
            const depositTotalValue=itemsToProcess.reduce((s,i)=>s+i.price,0);
            if(itemsToProcess.length===0){console.log(`Offer ${offer.id} no valid items.`);return offer.decline().catch(e=>console.error(`Decline err ${offer.id}:`,e));}
            offer.accept(async(err,st)=>{ if(err){console.error(`Accept err ${offer.id}:`,err.message||err);if(err.message?.includes('escrow'))console.warn(`Offer ${offer.id} escrow.`);return;} console.log(`Offer ${offer.id} accepted: ${st}. DB Update...`); const latestR=await Round.findById(currentRound._id); if(!latestR||latestR.status!=='active'||isRolling){console.error(`CRITICAL: Round changed after accept ${offer.id}!`);return;} try{const cItems=await Item.insertMany(itemsToProcess); const cIds=cItems.map(i=>i._id); latestR.items.push(...cIds); latestR.totalValue+=depositTotalValue; const tks=Math.max(0,Math.floor(depositTotalValue/TICKET_VALUE_RATIO)); const pIdx=latestR.participants.findIndex(p=>p.user?.equals(user._id)); if(pIdx>-1){latestR.participants[pIdx].itemsValue+=depositTotalValue;latestR.participants[pIdx].tickets+=tks;}else{latestR.participants.push({user:user._id,itemsValue:depositTotalValue,tickets:tks});} await latestR.save(); currentRound=latestR; const pData=latestR.participants.find(p=>p.user?.equals(user._id)); io.emit('participantUpdated',{roundId:latestR.roundId,userId:user._id,username:user.username,avatar:user.avatar,itemsValue:pData?.itemsValue||0,tickets:pData?.tickets||0,totalValue:latestR.totalValue}); cItems.forEach(item=>{io.emit('itemDeposited',{roundId:latestR.roundId,item:{id:item._id,name:item.name,image:item.image,price:item.price},user:{id:user._id,username:user.username,avatar:user.avatar}});}); console.log(`Deposit success ${offer.id}. User: ${user.username}, Val: ${depositTotalValue.toFixed(2)}`);}catch(dbErr){console.error(`CRITICAL DB error after accept ${offer.id}:`,dbErr);if(currentRound){await Round.updateOne({_id:currentRound._id},{$set:{status:'error'}}).catch(e=>console.error("Save err status:",e));io.emit('roundError',{roundId:currentRound.roundId, error:'Deposit error.'});}}});
        }catch(procErr){console.error(`Price processing err ${offer.id}:`,procErr);return offer.decline().catch(e=>{if(e)console.error(`Decline err ${offer.id}:`,e);});}
   });
   manager.on('sentOfferChanged', (offer, oldState) => { console.log(`Offer #${offer.id} state change: ${TradeOfferManager.ETradeOfferState[oldState]}->${TradeOfferManager.ETradeOfferState[offer.state]}`); /* Handle winner payouts */ });
} else { console.warn("Bot not configured. Trade listeners inactive."); }

// --- Round Info API Routes --- (Unchanged)
app.get('/api/round/current', async (req, res) => { /* ... */ if (!currentRound?._id) return res.status(404).json({e:'No active round.'}); try { const r = await Round.findById(currentRound._id).populate('participants.user', 'username avatar steamId').populate('items', 'name image price owner').lean(); if (!r){currentRound=null;return res.status(404).json({e:'Round data invalid.'});} const t = r.status==='active'&&r.endTime?Math.max(0,Math.floor((new Date(r.endTime).getTime()-Date.now())/1000)):0; res.json({roundId:r.roundId, status:r.status, startTime:r.startTime, endTime:r.endTime, timeLeft:t, totalValue:r.totalValue, serverSeedHash:r.serverSeedHash, participants:r.participants.map(p=>({user:p.user?{id:p.user._id,steamId:p.user.steamId,username:p.user.username,avatar:p.user.avatar}:null, itemsValue:p.itemsValue, tickets:p.tickets})).filter(p=>p.user), items:r.items.map(i=>({id:i._id, name:i.name, image:i.image, price:i.price, owner:i.owner})), winner:r.winner, winningTicket:r.status==='completed'?r.winningTicket:null, serverSeed:r.status==='completed'?r.serverSeed:null, clientSeed:r.status==='completed'?r.clientSeed:null, provableHash:r.status==='completed'?r.provableHash:null }); } catch(err){ console.error('Err fetch current round:', err); res.status(500).json({e:'Server error'}); } });
app.get('/api/rounds', async (req, res) => { /* ... */ try { const p=parseInt(req.query.page)||1; const l=parseInt(req.query.limit)||10; const s=(p-1)*l; const qR=Round.find({status:{$in:['completed','error']}}).sort('-roundId').skip(s).limit(l).populate('winner','username avatar steamId').select('roundId startTime endTime completedTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket provableHash status participants items').lean(); const qC=Round.countDocuments({status:{$in:['completed','error']}}); const [rs,c]=await Promise.all([qR,qC]); rs.forEach(r=>{r.totalTickets=r.participants?.reduce((sm,p)=>sm+(p?.t||0),0)??0; r.itemCount=r.items?.length??0; delete r.participants; delete r.items;}); res.json({rounds:rs, totalPages:Math.ceil(c/l), currentPage:p, totalRounds:c}); } catch(err){ console.error('Err fetch rounds:', err); res.status(500).json({e:'Server error'}); } });
app.post('/api/verify', async (req, res) => { /* ... */ const { roundId, serverSeed, clientSeed }=req.body; if(!roundId||!serverSeed||!clientSeed) return res.status(400).json({e:'Missing fields'}); try { const r=await Round.findOne({roundId:roundId, status:'completed'}).populate('participants.user','username').populate('winner','username').lean(); if(!r) return res.status(404).json({e:'Round not found.'}); const csH=crypto.createHash('sha256').update(serverSeed).digest('hex'); if(csH!==r.serverSeedHash) return res.json({verified:false, reason:'Hash mismatch.'}); if(serverSeed!==r.serverSeed||clientSeed!==r.clientSeed) return res.json({verified:false, reason:'Seeds mismatch.'}); const cbS=serverSeed+clientSeed; const cpHS=crypto.createHash('sha256').update(cbS).digest('hex'); const dec=parseInt(cpHS.substring(0,8),16); const tT=r.participants?.reduce((sm,p)=>sm+(p?.t||0),0)??0; if(tT<=0) return res.json({verified:false, reason:'Zero tickets.'}); const cwT=dec%tT; if(cwT!==r.winningTicket) return res.json({verified:false, reason:'Ticket mismatch.'}); res.json({verified:true, roundId:r.rId, serverSeed:sS, serverSeedHash:r.sSH, clientSeed:cS, combinedHash:cpHS, winningTicket:cwT, totalTickets:tT, totalValue:r.tV, winnerUsername:r.winner?.u||'N/A'}); } catch(err){ console.error(`Verify err ${roundId}:`,err); res.status(500).json({e:'Server error'}); } });

// --- Socket.io Connection Handling ---
io.on('connection', (socket) => { /* ... unchanged ... */ console.log(`Client connected: ${socket.id}`); if(currentRound?._id){ Round.findById(currentRound._id).populate('participants.user','username avatar steamId').populate('items','name image price owner').lean().then(r=>{ if(r){ const t=r.status==='active'&&r.endTime?Math.max(0,Math.floor((new Date(r.endTime).getTime()-Date.now())/1000)):0; socket.emit('roundData',{roundId:r.roundId, status:r.status, timeLeft:t, totalValue:r.totalValue, serverSeedHash:r.serverSeedHash, participants:r.participants.map(p=>({user:p.user?{id:p.user._id,steamId:p.user.steamId,username:p.user.username,avatar:p.user.avatar}:null, itemsValue:p.itemsValue, tickets:p.tickets})).filter(p=>p.user), items:r.items.map(i=>({id:i._id, name:i.name, image:i.image, price:i.price, owner:i.owner}))}); } else { socket.emit('noActiveRound'); } }).catch(e=>{console.error(`Sock fetch err ${socket.id}:`,e); socket.emit('noActiveRound');}); } else { socket.emit('noActiveRound'); } socket.on('disconnect',(rsn)=>{console.log(`Client disconnected: ${socket.id}. R: ${rsn}`);}); });

// --- Server Startup ---
// Moved initial cache refresh to happen *before* starting the interval/listening
async function startApp() {
    console.log("Performing initial price cache refresh from rust.scmm.app...");
    await refreshPriceCache(); // Wait for the first refresh attempt

    // Schedule periodic cache refresh AFTER the first one is done
    setInterval(refreshPriceCache, PRICE_REFRESH_INTERVAL_MS);
    console.log(`Scheduled price cache refresh every ${PRICE_REFRESH_INTERVAL_MS / 60000} minutes.`);

    // Start HTTP server AFTER initial cache attempt
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);

        // Bot status check (initial round creation moved to login callback)
        if (!isBotConfigured) { console.log("Bot not configured. Trade features disabled."); }
        else if (!isBotReady) { console.log("Waiting for bot login attempt..."); }

        // Pricing API Test (will now use cache from initial refresh or fallback)
        setTimeout(async () => {
           console.log("Testing Pricing API on startup (uses cache/fallback)...");
           const testItem1 = "Assault Rifle"; // Common item
           const testItem2 = "Blue Beenie Hat"; // Low value item
           try {
               const price1 = getItemPrice(testItem1); // Reads cache/fallback
               console.log(`TEST: Price for ${testItem1}: ${price1 !== undefined ? `$${price1.toFixed(2)}` : 'Error/Not Found'}`);
               const price2 = getItemPrice(testItem2); // Reads cache/fallback
               console.log(`TEST: Price for ${testItem2}: ${price2 !== undefined ? `$${price2.toFixed(2)}` : 'Error/Not Found'}`);
            }
           catch(e){ console.error("Error testing price API:", e);}
        }, 2000); // Run test slightly sooner after listen starts
    });
}

startApp(); // Call the async startup function

// Graceful shutdown handler
process.on('SIGTERM', () => { console.log('SIGTERM: closing server...'); io.close(); server.close(() => { console.log('HTTP closed.'); mongoose.connection.close(false).then(() => { console.log('Mongo closed.'); process.exit(0); }).catch(e => { console.error("Mongo close err:", e); process.exit(1); }); }); setTimeout(() => { console.error('Timeout force exit.'); process.exit(1); }, 10000); });
process.on('SIGINT', () => { console.log('SIGINT: shutting down...'); process.emit('SIGTERM'); });

// Basic Error Handling Middleware (LAST)
app.use((err, req, res, next) => { console.error("Unhandled Error:", err.stack || err); const status = err.status || 500; const message = process.env.NODE_ENV === 'production' ? 'Server error.' : (err.message || 'Error'); res.status(status).json({ error: message }); });
