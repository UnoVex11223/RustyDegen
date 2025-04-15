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
const SteamTotp = require('steam-totp'); // Required for 2FA login
// Added for real-time pricing API
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config(); // Loads .env file variables

// --- Configuration Constants ---
const RUST_APP_ID = 252490;
const RUST_CONTEXT_ID = 2;
const ROUND_DURATION = parseInt(process.env.ROUND_DURATION_SECONDS) || 120; // In seconds
const TICKET_VALUE_RATIO = parseFloat(process.env.TICKET_VALUE) || 0.01; // Value per ticket
const DEPOSIT_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for deposit token validity
const PRICE_CACHE_TTL_SECONDS = parseInt(process.env.PRICE_CACHE_TTL_SECONDS) || 10 * 60; // Cache prices for 10 minutes default
const MIN_ITEM_VALUE = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10; // Minimum item value for deposit

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.SITE_URL || "*", // Configure appropriately for production
        methods: ["GET", "POST"]
    }
});

// Configure middleware
app.use(cors({
    origin: process.env.SITE_URL || "*", // Configure appropriately for production
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files (like CSS, frontend JS) from 'public' directory
app.use(session({
    secret: process.env.SESSION_SECRET, // Ensure this is strong and secure in .env
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000 // 1 hour
        // secure: process.env.NODE_ENV === 'production', // Enable in production with HTTPS
        // httpOnly: true // Good practice
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// --- Steam Strategy ---
// Ensure required env vars for Steam Auth are present
if (!process.env.SITE_URL || !process.env.STEAM_API_KEY || !process.env.SESSION_SECRET) {
   console.error("FATAL ERROR: Missing required environment variables for Steam Authentication (SITE_URL, STEAM_API_KEY, SESSION_SECRET).");
   process.exit(1);
}

passport.use(new SteamStrategy({
    returnURL: `${process.env.SITE_URL}/auth/steam/return`,
    realm: process.env.SITE_URL,
    apiKey: process.env.STEAM_API_KEY,
    providerURL: 'https://steamcommunity.com/openid'
}, async (identifier, profile, done) => {
    try {
        let user = await User.findOne({ steamId: profile.id });

        if (!user) {
            // Create new user
            console.log(`Creating new user: ${profile.displayName} (${profile.id})`);
            const newUser = new User({
                steamId: profile.id,
                username: profile.displayName,
                avatar: profile._json.avatarfull || '', // Use default if missing
                tradeUrl: '' // Initialize tradeUrl
            });
            await newUser.save();
            return done(null, newUser);
        } else {
            // Update existing user info if changed
            let updated = false;
            if (user.username !== profile.displayName) {
                user.username = profile.displayName;
                updated = true;
            }
            if (profile._json.avatarfull && user.avatar !== profile._json.avatarfull) { // Check avatar exists
                user.avatar = profile._json.avatarfull;
                updated = true;
            }
            if (updated) {
                await user.save();
                console.log(`Updated user info for: ${user.username}`);
            }
            return done(null, user);
        }
    } catch (err) {
        console.error('Error during SteamStrategy user lookup/creation:', err);
        return done(err);
    }
}));

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user.id); // Use MongoDB _id for session persistence
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user); // Pass the full user object
    } catch (err) {
        console.error("Deserialize user error:", err); // Log error
        done(err);
    }
});

// --- MongoDB Connection ---
if (!process.env.MONGODB_URI) {
   console.error("FATAL ERROR: MONGODB_URI not set in environment variables.");
   process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if DB connection fails
});

// --- MongoDB Schemas ---
const userSchema = new mongoose.Schema({
    steamId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    avatar: { type: String },
    tradeUrl: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false }
});

const itemSchema = new mongoose.Schema({
    assetId: { type: String, required: true, index: true },
    name: { type: String, required: true }, // Stores market_hash_name
    image: { type: String, required: true },
    price: { type: Number, required: true }, // Price at the time of deposit
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true, index: true },
    depositedAt: { type: Date, default: Date.now }
});

const roundSchema = new mongoose.Schema({
    roundId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'rolling', 'completed', 'error'], default: 'pending', index: true },
    startTime: { type: Date },
    endTime: { type: Date }, // When rolling starts
    completedTime: { type: Date }, // When winner trade is sent/finalized
    totalValue: { type: Number, default: 0 },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }], // References to Item documents
    participants: [{ // Keep track of each user's total contribution in the round
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        itemsValue: { type: Number, required: true },
        tickets: { type: Number, required: true } // Calculated based on TICKET_VALUE_RATIO
    }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    winningTicket: { type: Number },
    serverSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    clientSeed: { type: String }, // Revealed/generated at the end
    provableHash: { type: String } // Hash(serverSeed + clientSeed)
});

// Create models
const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Round = mongoose.model('Round', roundSchema);

// --- Steam Bot Setup ---
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: community, // Use the community instance
    domain: process.env.SITE_URL ? process.env.SITE_URL.replace(/^https?:\/\//, '') : 'localhost', // Domain name from your site URL or fallback
    language: 'en',
    pollInterval: 15000, // Poll for new offers every 15 seconds
    cancelTime: 10 * 60 * 1000, // Cancel outgoing offers after 10 mins
});

// Flag to track bot readiness
let isBotReady = false; // Default to false until successful login and cookie set

// --- Function to generate Steam Guard code ---
function generateAuthCode() {
    const sharedSecret = process.env.STEAM_SHARED_SECRET;
    if (!sharedSecret) {
        console.error("STEAM_SHARED_SECRET not found in .env! Bot cannot log in.");
        return null; // Indicate failure
    }
    try {
        const code = SteamTotp.generateAuthCode(sharedSecret);
        // console.log("Generated Steam Guard Code."); // Keep this commented unless debugging
        return code;
    } catch (err) {
        console.error("Error generating Steam Guard code:", err);
        return null;
    }
}

// Check if bot credentials are configured in .env
const isBotConfigured = process.env.STEAM_USERNAME && process.env.STEAM_PASSWORD && process.env.STEAM_SHARED_SECRET;

// --- Steam Bot Login ---
if (isBotConfigured) {
   // Define credentials within this scope only if configured
   const steamLoginCredentials = {
       accountName: process.env.STEAM_USERNAME,
       password: process.env.STEAM_PASSWORD,
       twoFactorCode: generateAuthCode()
   };

   if (steamLoginCredentials.twoFactorCode) { // Check if 2FA code was generated
       console.log(`Attempting Steam login for bot: ${steamLoginCredentials.accountName}...`);
       community.login(steamLoginCredentials, (err, sessionID, cookies, steamguard) => {
           if (err) {
               console.error('FATAL STEAM LOGIN ERROR:', err);
               console.error("Bot login failed. Trade features will be unavailable. Check credentials, 2FA secret, server time, and Steam Guard.");
               isBotReady = false;
           } else {
               console.log(`Steam bot ${steamLoginCredentials.accountName} logged in successfully (SteamID: ${community.steamID}).`);
               manager.setCookies(cookies, err => {
                   if (err) {
                       console.error('Error setting Trade Offer Manager cookies:', err);
                       isBotReady = false;
                       return;
                   }
                   console.log('Trade Offer Manager cookies set.');
                   community.setCookies(cookies);

                   community.gamesPlayed(process.env.SITE_NAME || 'RustyDegen');
                   community.setPersona(SteamCommunity.EPersonaState.Online);
                   isBotReady = true; // Mark bot as ready

                   console.log("Bot is ready, creating initial round...");
                   createNewRound(); // Create first round now
               });

               community.on('friendRelationship', (steamID, relationship) => {
                   if (relationship === SteamCommunity.EFriendRelationship.RequestRecipient) {
                       console.log(`Accepting friend request from ${steamID}`);
                       community.addFriend(steamID, (err) => {
                           if(err) console.error(`Error accepting friend ${steamID}:`, err);
                       });
                   }
               });
           }
       });
   } else {
       console.warn("Could not generate Steam Guard code. Bot login skipped. Trade features will be unavailable.");
       isBotReady = false;
   }
} else {
    console.warn("Bot credentials not fully configured. Trade features will be unavailable.");
    isBotReady = false;
}

// --- Active Round Data ---
let currentRound = null;
let roundTimer = null;
let isRolling = false;

// --- Deposit Security Token Store ---
const depositTokens = {};

function generateDepositToken(userId) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiry = Date.now() + DEPOSIT_TOKEN_EXPIRY_MS;
    depositTokens[token] = { userId: userId.toString(), expiry };
    console.log(`Generated deposit token ${token} for user ${userId}`);
    setTimeout(() => { if (depositTokens[token] && depositTokens[token].expiry <= Date.now()) { delete depositTokens[token]; console.log(`Expired token ${token}`); } }, DEPOSIT_TOKEN_EXPIRY_MS + 1000);
    return token;
}

async function verifyDepositToken(token, partnerSteamId) { // Made async
    const stored = depositTokens[token];
    if (!stored || stored.expiry <= Date.now()) {
        if (stored) delete depositTokens[token];
        console.log(`Deposit token ${token} not found or expired.`);
        return null;
    }
    try {
        const user = await User.findOne({ steamId: partnerSteamId }).lean();
        if (!user || user._id.toString() !== stored.userId) {
            console.log(`Token ${token} verification failed: User mismatch or not found (SteamID: ${partnerSteamId})`);
            return null;
        }
        delete depositTokens[token]; // Consume token
        console.log(`Verified deposit token ${token} for user ${user.username}`);
        return user;
    } catch (err) {
        console.error(`Error verifying deposit token ${token}:`, err);
        return null;
    }
}

// --- Pricing Cache and Functions ---
const priceCache = new NodeCache({ stdTTL: PRICE_CACHE_TTL_SECONDS, checkperiod: PRICE_CACHE_TTL_SECONDS * 0.2 });

function getFallbackPrice(marketHashName) {
   const commonItems = {
       'Metal Chest Plate': 5.20, 'Semi-Automatic Rifle': 10.00, 'Garage Door': 3.50,
       'Assault Rifle': 8.50, 'Metal Facemask': 6.00, 'Road Sign Kilt': 1.50,
       'Coffee Can Helmet': 1.20, 'Double Barrel Shotgun': 0.80, 'Revolver': 0.50,
       'Sheet Metal Door': 0.75, 'Medical Syringe': 0.15, 'MP5A4': 2.50,
       'Python Revolver': 1.80, 'Satchel Charge': 0.60, 'Rocket Launcher': 12.00,
       'Explosive 5.56 Rifle Ammo': 0.20, 'Timed Explosive Charge': 4.50
   };
   const fallback = commonItems[marketHashName];
   if (fallback !== undefined) {
       console.warn(`Using fallback price $${fallback.toFixed(2)} for: ${marketHashName}`);
       return Math.max(fallback, MIN_ITEM_VALUE > 0 ? MIN_ITEM_VALUE : 0);
   } else {
       console.warn(`No fallback price for: ${marketHashName}, using site minimum $${MIN_ITEM_VALUE.toFixed(2)}.`);
       return MIN_ITEM_VALUE > 0 ? MIN_ITEM_VALUE : 0;
   }
}

async function getItemPrice(marketHashName) {
   const apiKey = process.env.PRICEMPIRE_API_KEY;
   if (!apiKey) { console.error("PRICEMPIRE_API_KEY missing. Using fallback."); return getFallbackPrice(marketHashName); }
   try {
       const cachedPrice = priceCache.get(marketHashName);
       if (cachedPrice !== undefined) return cachedPrice;
       // console.log(`Workspaceing price via Pricempire for: ${marketHashName}`); // Optional log
       const response = await axios.get('https://api.pricempire.com/v2/items/rust_item', {
           params: { name: marketHashName, currency: 'USD' },
           headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
           timeout: 5000
       });
       if (response.data?.price) {
           const priceData = response.data.price;
           let price = parseFloat(priceData.steam || priceData.avg || priceData.suggested || 0);
           if (!isNaN(price) && price > 0) {
               // console.log(`API price for ${marketHashName}: $${price.toFixed(2)}`); // Optional log
               priceCache.set(marketHashName, price); return price;
           } else { console.warn(`API returned invalid price for ${marketHashName}. Using fallback.`); return getFallbackPrice(marketHashName); }
       }
       console.warn(`No valid price data in API response for ${marketHashName}. Using fallback.`); return getFallbackPrice(marketHashName);
   } catch (error) {
       if (error.response) { console.error(`Pricempire API Error (${marketHashName}) - Status: ${error.response.status}`); }
       else if (error.request) { console.error(`Pricempire API Error (${marketHashName}): No response (Timeout?).`); }
       else { console.error(`Pricempire API Error (${marketHashName}):`, error.message); }
       return getFallbackPrice(marketHashName);
   }
}

// --- Core Game Logic --- (Functions: createNewRound, startRoundTimer, endRound, sendWinningTradeOffer)
async function createNewRound() {
   if (isRolling) { console.log("Cannot create new round while rolling."); return; }
   try {
       isRolling = false;
       const serverSeed = crypto.randomBytes(32).toString('hex');
       const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
       const latestRound = await Round.findOne().sort('-roundId');
       const newRoundId = latestRound ? latestRound.roundId + 1 : 1;
       const round = new Round({ roundId: newRoundId, status: 'active', startTime: new Date(), serverSeed, serverSeedHash, items: [], participants: [], totalValue: 0 });
       await round.save();
       currentRound = round;
       startRoundTimer();
       io.emit('roundCreated', { roundId: round.roundId, serverSeedHash: round.serverSeedHash, timeLeft: ROUND_DURATION, totalValue: 0, participants: [], items: [] });
       console.log(`Round #${round.roundId} created. Hash: ${round.serverSeedHash}`);
       return round;
   } catch (err) { console.error('Error creating new round:', err); setTimeout(createNewRound, 10000); }
}

function startRoundTimer() {
   if (roundTimer) clearInterval(roundTimer);
   if (!currentRound || !currentRound.startTime) { console.error("Cannot start timer: invalid round state."); return; }
   currentRound.endTime = new Date(currentRound.startTime.getTime() + ROUND_DURATION * 1000);
   currentRound.save().catch(err => console.error("Error saving round end time:", err));
   let timeLeft = ROUND_DURATION;
   io.emit('timeUpdate', { timeLeft });
   roundTimer = setInterval(async () => {
       if (!currentRound || !currentRound.endTime) { clearInterval(roundTimer); roundTimer = null; console.error("Timer interval invalid state."); return; }
       const now = Date.now();
       timeLeft = Math.max(0, Math.floor((currentRound.endTime.getTime() - now) / 1000));
       io.emit('timeUpdate', { timeLeft });
       if (timeLeft <= 0) { clearInterval(roundTimer); roundTimer = null; await endRound(); }
   }, 1000);
   console.log(`Round #${currentRound.roundId} timer started (${ROUND_DURATION}s).`);
}

async function endRound() {
   if (!currentRound || isRolling || currentRound.status !== 'active') { console.log(`endRound skipped: Status ${currentRound?.status}, Rolling ${isRolling}`); return; }
   isRolling = true;
   console.log(`Ending round #${currentRound.roundId}...`);
   currentRound.status = 'rolling';
   currentRound.endTime = new Date();
   await currentRound.save();
   io.emit('roundRolling', { roundId: currentRound.roundId });
   try {
       const round = await Round.findById(currentRound._id).populate('participants.user', 'username avatar steamId tradeUrl').populate('items');
       if (!round) throw new Error(`Round ${currentRound._id} vanished.`);
       currentRound = round;
       if (round.participants.length === 0 || round.totalValue <= 0) {
           console.log(`Round #${round.roundId} ended empty.`);
           round.status = 'completed'; round.completedTime = new Date();
           await round.save();
           io.emit('roundCompleted', { roundId: round.roundId, message: "No participants." });
       } else {
           round.clientSeed = crypto.randomBytes(16).toString('hex');
           const combinedSeed = round.serverSeed + round.clientSeed;
           round.provableHash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
           const decimal = parseInt(round.provableHash.substring(0, 8), 16);
           const totalTickets = round.participants.reduce((sum, p) => sum + (p?.tickets || 0), 0);
           if (totalTickets <= 0) throw new Error(`Zero total tickets in round ${round.roundId}.`);
           round.winningTicket = decimal % totalTickets;
           let ticketCounter = 0, winner = null;
           for (const p of round.participants) { if (!p?.tickets) continue; ticketCounter += p.tickets; if (round.winningTicket < ticketCounter) { winner = p.user; break; } }
           if (!winner) throw new Error(`Winner determination failed for round ${round.roundId}.`);
           round.winner = winner._id;
           round.status = 'completed';
           await round.save();
           console.log(`Round #${round.roundId} completed. Winner: ${winner.username} (Ticket: ${round.winningTicket})`);
           io.emit('roundWinner', { roundId: round.roundId, winner: { id: winner._id, steamId: winner.steamId, username: winner.username, avatar: winner.avatar }, winningTicket: round.winningTicket, totalValue: round.totalValue, totalTickets: totalTickets, serverSeed: round.serverSeed, clientSeed: round.clientSeed, provableHash: round.provableHash, serverSeedHash: round.serverSeedHash });
           await sendWinningTradeOffer(round, winner); // Includes isBotReady check
           round.completedTime = new Date();
           await round.save();
       }
   } catch (err) {
       console.error(`Error ending round #${currentRound?.roundId}:`, err);
       if (currentRound) { currentRound.status = 'error'; await currentRound.save().catch(e => console.error("Failed save error status:", e)); io.emit('roundError', { roundId: currentRound.roundId, error: 'Internal error.' }); }
   } finally {
       isRolling = false;
       console.log("Scheduling next round...");
       setTimeout(createNewRound, 10000);
   }
}

async function sendWinningTradeOffer(round, winner) {
    if (!isBotReady || !manager || !community.steamID) { console.error(`Cannot send winnings for round ${round.roundId}: Bot not ready.`); io.emit('notification', { type: 'warning', userId: winner._id.toString(), message: `Payout for round ${round.roundId} requires manual processing.` }); return; }
    console.log(`Sending winnings for round ${round.roundId} to ${winner.username}...`);
    if (!winner.tradeUrl) { console.error(`Winner ${winner.username} trade URL not set.`); io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Please set Trade URL for winnings.' }); return; }
    if (!round.items?.length) { console.warn(`Round ${round.roundId} has no items to send.`); return; }
    try {
        const offer = manager.createOffer(winner.tradeUrl);
        offer.addMyItems(round.items.map(i => ({ assetid: i.assetId, appid: RUST_APP_ID, contextid: RUST_CONTEXT_ID })));
        offer.setMessage(`Congrats on winning Round #${round.roundId} on ${process.env.SITE_NAME || 'RustyDegen'}!`);
        const status = await new Promise((resolve, reject) => { offer.send((err, status) => err ? reject(err) : resolve(status)); });
        console.log(`Trade offer ${offer.id} sent to ${winner.username}. Status: ${status}`);
        io.emit('tradeOfferSent', { roundId: round.roundId, userId: winner._id, username: winner.username, offerId: offer.id, status });
    } catch (err) { console.error(`Failed send winning offer for round ${round.roundId}:`, err); io.emit('notification', { type: 'error', userId: winner._id.toString(), message: `Failed send winnings for round ${round.roundId}. Contact support.` }); }
}

// --- Authentication Routes ---
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));
app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => { res.redirect('/'); });
app.post('/logout', (req, res, next) => { req.logout(e => { if(e) return next(e); req.session.destroy(e => { if(e) return res.status(500).json({e:'Logout failed'}); res.clearCookie('connect.sid'); res.json({success:true}); }); }); });

// --- Middleware & API Routes ---
function ensureAuthenticated(req, res, next) { if (req.isAuthenticated()) return next(); res.status(401).json({ error: 'Not authenticated' }); }
app.get('/api/user', ensureAuthenticated, (req, res) => { const { _id, steamId, username, avatar, tradeUrl, balance, createdAt } = req.user; res.json({ _id, steamId, username, avatar, tradeUrl, balance, createdAt }); });
app.post('/api/user/tradeurl', ensureAuthenticated, async (req, res) => {
    const { tradeUrl } = req.body;
    if (!tradeUrl?.includes('steamcommunity.com/tradeoffer/new/')) return res.status(400).json({e:'Invalid format'});
    try { const url = new URL(tradeUrl); if (!url.searchParams.get('partner') || !url.searchParams.get('token')) return res.status(400).json({ e:'Invalid params'}); } catch (e) { return res.status(400).json({ e:'Invalid URL'}); }
    try { const u = await User.findByIdAndUpdate(req.user._id, {tradeUrl},{new:true}); if(!u) return res.status(404).json({e:'User missing'}); console.log(`TU Upd: ${u.username}`); res.json({success:true, tradeUrl:u.tradeUrl}); }
    catch(err) { console.error(`TU Upd Err ${req.user._id}:`, err); res.status(500).json({e:'Server error'}); }
});

// GET USER INVENTORY - REVERTED: No bot check here, relies on manager call potentially failing
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
    try {
       // Removed: if (!isBotReady || !manager) { ... return 503 ... }
       if (!manager) { // Check if manager object exists at least
             console.error("Inventory API cannot proceed: Trade Offer Manager is not initialized.");
             // Send a more specific error if manager doesn't exist
             return res.status(503).json({ error: "Trade service initialization failed. Cannot fetch inventory." });
       }

        const inventory = await new Promise((resolve, reject) => {
            // This call will likely fail if bot isn't logged in, triggering the catch block below
            manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                if (err) {
                    if (err.message?.includes('profile is private')) return reject(new Error('Your Steam inventory is private. Please set it to public.'));
                    console.error(`Error fetching inventory via manager for ${req.user.steamId}:`, err);
                    return reject(new Error(`Could not fetch inventory: ${err.message || 'Steam error'}. Bot might be offline or inventory private.`));
                }
                resolve(inv || []);
            });
        });

        if (!inventory?.length) return res.json([]);

        const itemsWithPrices = await Promise.all(inventory.map(async (item) => {
            const price = await getItemPrice(item.market_hash_name); // Uses REAL function
            return {
                assetId: item.assetid, name: item.market_hash_name, displayName: item.name,
                image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                price: price || 0, tradable: item.tradable, marketable: item.marketable,
            };
        }));

        const validItems = itemsWithPrices.filter(item => item.tradable && item.price >= MIN_ITEM_VALUE );
        res.json(validItems);

    } catch (err) { // This will now catch errors from manager.getUserInventoryContents if bot isn't ready
        console.error(`Error in /api/inventory for ${req.user?.username}:`, err.message);
        // Return the specific error message caught
        res.status(500).json({ error: err.message || 'Server error fetching inventory. Bot might be offline.' });
    }
});

// Initiate Deposit
app.post('/api/deposit/initiate', ensureAuthenticated, (req, res) => {
    // KEEP CHECK: Deposit requires ready bot
    if (!isBotReady || !process.env.BOT_TRADE_URL) { console.warn(`Deposit initiation failed for ${req.user.username}: Bot unavailable.`); return res.status(503).json({ error: "Deposit service unavailable." }); }
    if (!currentRound || currentRound.status !== 'active' || isRolling) { return res.status(400).json({ error: 'Deposits closed.' }); }
    const token = generateDepositToken(req.user._id);
    res.json({ success: true, depositToken: token, botTradeUrl: process.env.BOT_TRADE_URL });
});

// --- Trade Offer Manager Event Handling --- (Keep bot check inside)
if (isBotConfigured) {
   manager.on('newOffer', async (offer) => {
       if (!isBotReady || !manager || !community.steamID) { console.warn(`Ignoring offer ${offer.id}: Bot not ready.`); return; }
       // ... rest of newOffer handler ...
        console.log(`Received new trade offer #${offer.id} from ${offer.partner.getSteamID64()}`);
        if (offer.isOurOffer || offer.itemsToReceive.length === 0 || !offer.message) { console.log(`Offer #${offer.id} invalid deposit. Declining/Ignoring.`); if (!offer.isOurOffer) return offer.decline(e => { if(e) console.error(`Decline err ${offer.id}:`,e);}); return; }
        if (!currentRound || currentRound.status !== 'active' || isRolling) { console.log(`Offer #${offer.id} deposits closed. Declining.`); return offer.decline(e => { if(e) console.error(`Decline err ${offer.id}:`,e);}); }
        const token = offer.message.trim(); let user;
        try { user = await verifyDepositToken(token, offer.partner.getSteamID64()); if (!user) { console.log(`Offer #${offer.id} invalid token. Declining.`); return offer.decline(e => { if(e) console.error(`Decline err ${offer.id}:`,e);}); } }
        catch (vErr) { console.error(`Token verify err ${offer.id}:`, vErr); return offer.decline(e => { if(e) console.error(`Decline err ${offer.id}:`,e);}); }
        console.log(`Offer #${offer.id} valid deposit from ${user.username}. Pricing...`);
        try {
            const itemPricePromises = offer.itemsToReceive.map(async (item) => { if (!item.market_hash_name) { console.warn(`Asset ${item.assetid} missing name. Skip.`); return null; } const price = await getItemPrice(item.market_hash_name); const itemValue = parseFloat(price)||0; if (itemValue < MIN_ITEM_VALUE) { console.log(`Item ${item.market_hash_name} below min. Skip.`); return null; } return { assetId: item.assetid, name: item.market_hash_name, image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`, price: itemValue, owner: user._id, roundId: currentRound._id }; });
            const itemsToProcess = (await Promise.all(itemPricePromises)).filter(i => i !== null);
            const depositTotalValue = itemsToProcess.reduce((sum, i) => sum + i.price, 0);
            if (itemsToProcess.length === 0) { console.log(`Offer #${offer.id} no valid items > $${MIN_ITEM_VALUE}. Declining.`); return offer.decline(e => { if(e) console.error(`Decline err ${offer.id}:`,e);}); }
            console.log(`Offer #${offer.id} value $${depositTotalValue.toFixed(2)}. Accepting...`);
            offer.accept(async (err, status) => {
                if (err) { console.error(`Accept err ${offer.id}:`, err.message||err); if (err.message?.includes('escrow')) console.warn(`Offer ${offer.id} escrow.`); return; }
                console.log(`Offer ${offer.id} accepted: ${status}. DB Update...`);
                const latestRound = await Round.findById(currentRound._id); if (!latestRound || latestRound.status !== 'active' || isRolling) { console.error(`CRITICAL: Round changed after accept ${offer.id}!`); return; }
                try {
                    const createdItems = await Item.insertMany(itemsToProcess); const createdItemIds = createdItems.map(i => i._id);
                    latestRound.items.push(...createdItemIds); latestRound.totalValue += depositTotalValue;
                    const tickets = Math.max(0, Math.floor(depositTotalValue / TICKET_VALUE_RATIO));
                    const pIndex = latestRound.participants.findIndex(p => p.user?.equals(user._id));
                    if (pIndex > -1) { latestRound.participants[pIndex].itemsValue += depositTotalValue; latestRound.participants[pIndex].tickets += tickets; }
                    else { latestRound.participants.push({ user: user._id, itemsValue: depositTotalValue, tickets: tickets }); }
                    await latestRound.save(); currentRound = latestRound;
                    const pData = latestRound.participants.find(p => p.user?.equals(user._id));
                    io.emit('participantUpdated', { roundId: latestRound.roundId, userId: user._id, username: user.username, avatar: user.avatar, itemsValue: pData?.itemsValue||0, tickets: pData?.tickets||0, totalValue: latestRound.totalValue });
                    createdItems.forEach(item => { io.emit('itemDeposited', { roundId: latestRound.roundId, item: { id: item._id, name: item.name, image: item.image, price: item.price }, user: { id: user._id, username: user.username, avatar: user.avatar } }); });
                    console.log(`Deposit success ${offer.id}. User: ${user.username}, Val: ${depositTotalValue.toFixed(2)}`);
                } catch (dbErr) { console.error(`CRITICAL DB error after accept ${offer.id}:`, dbErr); if(currentRound) { await Round.updateOne({_id:currentRound._id},{$set:{status:'error'}}).catch(e=>console.error("Failed save error status:",e)); io.emit('roundError',{roundId:currentRound.roundId, error:'Deposit error.'});}}
            });
        } catch (procErr) { console.error(`Price processing err ${offer.id}:`, procErr); return offer.decline(e => { if(e) console.error(`Decline err ${offer.id}:`,e);}); }
   });
   manager.on('sentOfferChanged', (offer, oldState) => { console.log(`Offer #${offer.id} state change: ${TradeOfferManager.ETradeOfferState[oldState]}->${TradeOfferManager.ETradeOfferState[offer.state]}`); /* Handle winner payouts */ });
} else { console.warn("Bot not configured. Trade listeners inactive."); }

// --- Round Info API Routes --- (Keep as they were)
app.get('/api/round/current', async (req, res) => { if (!currentRound?._id) return res.status(404).json({e:'No active round.'}); try { const r = await Round.findById(currentRound._id).populate('p.user', 'u a s').populate('i','n i p o').lean(); if (!r){currentRound=null;return res.status(404).json({e:'Round data invalid.'});} const t = r.status==='a'&&r.e?Math.max(0,Math.floor((new Date(r.e).getTime()-Date.now())/1000)):0; res.json({rId:r.rId, s:r.s, st:r.st, e:r.e, tL:t, tV:r.tV, sSH:r.sSH, p:r.p.map(p=>({u:p.u?{id:p.u._id,sId:p.u.sId,u:p.u.u,a:p.u.a}:null, iV:p.iV, t:p.t})).filter(p=>p.u), i:r.i.map(i=>({id:i._id, n:i.n, i:i.i, p:i.p, o:i.o})), w:r.w, wT:r.s==='c'?r.wT:null, sS:r.s==='c'?r.sS:null, cS:r.s==='c'?r.cS:null, pH:r.s==='c'?r.pH:null }); } catch(err){ console.error('Err fetch current round:', err); res.status(500).json({e:'Server error'}); } });
app.get('/api/rounds', async (req, res) => { try { const p=parseInt(req.query.p)||1; const l=parseInt(req.query.l)||10; const s=(p-1)*l; const qR=Round.find({s:{$in:['c','e']}}).sort('-rId').skip(s).limit(l).populate('w','u a s').select('rId st e ct tV w sS sSH cS wT pH s p i').lean(); const qC=Round.countDocuments({s:{$in:['c','e']}}); const [rs,c]=await Promise.all([qR,qC]); rs.forEach(r=>{r.tT=r.p?.reduce((sm,p)=>sm+(p?.t||0),0)??0; r.iC=r.i?.length??0; delete r.p; delete r.i;}); res.json({rs, tP:Math.ceil(c/l), cP:p, tR:c}); } catch(err){ console.error('Err fetch rounds:', err); res.status(500).json({e:'Server error'}); } });
app.post('/api/verify', async (req, res) => { /* Keep verify logic */ const { rId,sS,cS }=req.body; if(!rId||!sS||!cS) return res.status(400).json({e:'Missing fields'}); try { const r=await Round.findOne({rId:rId, s:'c'}).populate('p.u','u').populate('w','u').lean(); if(!r) return res.status(404).json({e:'Round not found.'}); const csH=crypto.createHash('sha256').update(sS).digest('hex'); if(csH!==r.sSH) return res.json({v:false, re:'Hash mismatch.'}); if(sS!==r.sS||cS!==r.cS) return res.json({v:false, re:'Seeds mismatch.'}); const cbS=sS+cS; const cpHS=crypto.createHash('sha256').update(cbS).digest('hex'); const dec=parseInt(cpHS.substring(0,8),16); const tT=r.p?.reduce((sm,p)=>sm+(p?.t||0),0)??0; if(tT<=0) return res.json({v:false, re:'Zero tickets.'}); const cwT=dec%tT; if(cwT!==r.wT) return res.json({v:false, re:'Ticket mismatch.'}); res.json({v:true, rId:r.rId, sS:sS, sSH:r.sSH, cS:cS, cbH:cpHS, wT:cwT, tT:tT, tV:r.tV, wU:r.w?.u||'N/A'}); } catch(err){ console.error(`Verify err ${rId}:`,err); res.status(500).json({e:'Server error'}); } });

// --- Socket.io Connection Handling ---
io.on('connection', (socket) => { /* Keep connection logic */ console.log(`Client connected: ${socket.id}`); if(currentRound?._id){ Round.findById(currentRound._id).populate('p.user','u a s').populate('i','n i p o').lean().then(r=>{ if(r){ const t=r.s==='a'&&r.e?Math.max(0,Math.floor((new Date(r.e).getTime()-Date.now())/1000)):0; socket.emit('rD',{rId:r.rId, s:r.s, tL:t, tV:r.tV, sSH:r.sSH, p:r.p.map(p=>({u:p.u?{id:p.u._id,sId:p.u.sId,u:p.u.u,a:p.u.a}:null,iV:p.iV,t:p.t})).filter(p=>p.u), i:r.i.map(i=>({id:i._id,n:i.n,i:i.i,p:i.p,o:i.o}))}); } else { socket.emit('noActRnd'); } }).catch(e=>{console.error(`Sock fetch err ${socket.id}:`,e); socket.emit('noActRnd');}); } else { socket.emit('noActRnd'); } socket.on('disconnect',(rsn)=>{console.log(`Client disconnected: ${socket.id}. R: ${rsn}`);}); });

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    if (!isBotConfigured) {
       console.log("Bot not configured. Server running without trade features. Initial round not created.");
    } else if (!isBotReady) { // Simplified check: If configured but not ready yet (pending/failed login)
       console.log("Waiting for bot login attempt... Initial round will be created if successful.");
    }
    // Pricing API Test
    setTimeout(async () => {
       console.log("Testing Pricing API on startup...");
       const testItem = "Metal Chest Plate";
       try { const price = await getItemPrice(testItem); console.log(`TEST: Price for ${testItem}: ${price !== undefined ? `$${price.toFixed(2)}` : 'Error/Not Found'}`); }
       catch(e){ console.error("Error testing price API:", e);}
    }, 7000);
});

// Graceful shutdown handler
process.on('SIGTERM', () => { console.log('SIGTERM: closing server...'); io.close(); server.close(() => { console.log('HTTP closed.'); mongoose.connection.close(false).then(() => { console.log('Mongo closed.'); process.exit(0); }).catch(e => { console.error("Mongo close err:", e); process.exit(1); }); }); setTimeout(() => { console.error('Timeout force exit.'); process.exit(1); }, 10000); });
process.on('SIGINT', () => { process.emit('SIGTERM'); });

// Basic Error Handling Middleware (LAST)
app.use((err, req, res, next) => { console.error("Unhandled Error:", err.stack || err); const status = err.status || 500; const message = process.env.NODE_ENV === 'production' ? 'Server error.' : (err.message || 'Error'); res.status(status).json({ error: message }); });
