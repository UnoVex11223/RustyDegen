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
   const steamLoginCredentials = {
       accountName: process.env.STEAM_USERNAME,
       password: process.env.STEAM_PASSWORD,
       twoFactorCode: generateAuthCode() // Use the function to get the code
   };

   if (steamLoginCredentials.twoFactorCode) { // Only attempt login if code generation didn't fail
       console.log(`Attempting Steam login for bot: ${steamLoginCredentials.accountName}...`);
       community.login(steamLoginCredentials, (err, sessionID, cookies, steamguard) => {
           if (err) {
               console.error('FATAL STEAM LOGIN ERROR:', err);
               console.error("Bot login failed. Trade features will be unavailable. Check credentials, 2FA secret, server time, and Steam Guard.");
               // App continues, but bot features won't work
               isBotReady = false;
           } else {
               console.log(`Steam bot ${steamLoginCredentials.accountName} logged in successfully (SteamID: ${community.steamID}).`);
               manager.setCookies(cookies, err => {
                   if (err) {
                       console.error('Error setting Trade Offer Manager cookies:', err);
                       isBotReady = false; // Mark as not ready if cookies fail
                       return;
                   }
                   console.log('Trade Offer Manager cookies set.');
                   community.setCookies(cookies); // Also set cookies for community instance

                   // Set bot status after successful cookie setting
                   community.gamesPlayed(process.env.SITE_NAME || 'RustyDegen');
                   community.setPersona(SteamCommunity.EPersonaState.Online); // Set state to Online
                   isBotReady = true; // Mark bot as ready ONLY after successful login and cookie setting

                   // Start first round ONLY after bot is confirmed ready
                   console.log("Bot is ready, creating initial round...");
                   createNewRound(); // Create the first round now
               });

               // Optional: Accept friend requests automatically
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
    console.warn("Bot credentials (STEAM_USERNAME, STEAM_PASSWORD, STEAM_SHARED_SECRET) not fully configured in .env. Trade features will be unavailable.");
    isBotReady = false;
}

// --- Active Round Data ---
let currentRound = null;
let roundTimer = null;
let isRolling = false; // Flag to prevent deposits during rolling

// --- Deposit Security Token Store (In-Memory - Replace for Production) ---
const depositTokens = {}; // { token: { userId: string, expiry: number } }

function generateDepositToken(userId) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiry = Date.now() + DEPOSIT_TOKEN_EXPIRY_MS;
    depositTokens[token] = { userId: userId.toString(), expiry };
    console.log(`Generated deposit token ${token} for user ${userId}`);

    // Cleanup expired tokens periodically
    setTimeout(() => {
        if (depositTokens[token] && depositTokens[token].expiry <= Date.now()) {
            delete depositTokens[token];
            console.log(`Expired deposit token ${token}`);
        }
    }, DEPOSIT_TOKEN_EXPIRY_MS + 1000);

    return token;
}

// Made async to handle User.findOne
async function verifyDepositToken(token, partnerSteamId) {
    const stored = depositTokens[token];
    if (!stored) {
        console.log(`Deposit token ${token} not found.`);
        return null;
    }
    if (stored.expiry <= Date.now()) {
        console.log(`Deposit token ${token} expired.`);
        delete depositTokens[token];
        return null;
    }

    try {
        const user = await User.findOne({ steamId: partnerSteamId }).lean(); // Use lean if not modifying user here
        if (!user) {
            console.log(`User with SteamID ${partnerSteamId} not found for token ${token}.`);
            return null;
        }
        if (user._id.toString() !== stored.userId) {
            console.log(`Token ${token} user ID mismatch. Expected ${stored.userId}, got ${user._id} (SteamID: ${partnerSteamId})`);
            return null;
        }
        delete depositTokens[token]; // Consume token
        console.log(`Verified deposit token ${token} for user ${user.username} (${user.steamId})`);
        return user; // Return the user object (plain object if using lean)
    } catch (err) {
        console.error(`Error finding user for token ${token} verification:`, err);
        return null;
    }
}


// --- Pricing Cache and Functions ---
const priceCache = new NodeCache({ stdTTL: PRICE_CACHE_TTL_SECONDS, checkperiod: PRICE_CACHE_TTL_SECONDS * 0.2 });

/**
* Fallback pricing function.
*/
function getFallbackPrice(marketHashName) {
   const commonItems = { // Expand this list
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
       console.warn(`No fallback price found for: ${marketHashName}, returning site minimum value $${MIN_ITEM_VALUE.toFixed(2)}.`);
       return MIN_ITEM_VALUE > 0 ? MIN_ITEM_VALUE : 0;
   }
}

/**
* Get real-time price using Pricempire API.
* @param {string} marketHashName
* @returns {Promise<number>} Price in USD
*/
async function getItemPrice(marketHashName) {
   const apiKey = process.env.PRICEMPIRE_API_KEY;
   // Check if API key is configured
   if (!apiKey) {
       console.error("PRICEMPIRE_API_KEY not set. Using fallback pricing.");
       return getFallbackPrice(marketHashName);
   }

   try {
       // Check cache
       const cachedPrice = priceCache.get(marketHashName);
       if (cachedPrice !== undefined) {
           return cachedPrice;
       }

       // Fetch from API
       // console.log(`Workspaceing price via Pricempire for: ${marketHashName}`); // Optional: Reduce logging
       const response = await axios.get('https://api.pricempire.com/v2/items/rust_item', {
           params: { name: marketHashName, currency: 'USD' },
           headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
           timeout: 5000 // 5 second timeout
       });

       // Process response
       if (response.data && response.data.price) {
           const priceData = response.data.price;
           let price = priceData.steam || priceData.avg || priceData.suggested || 0;
           price = parseFloat(price);

           if (!isNaN(price) && price > 0) {
               // console.log(`API price for ${marketHashName}: $${price.toFixed(2)}`); // Optional: Reduce logging
               priceCache.set(marketHashName, price);
               return price;
           } else {
               console.warn(`API returned zero or invalid price for: ${marketHashName}. Using fallback.`);
               return getFallbackPrice(marketHashName);
           }
       }
       console.warn(`No valid price data in API response for: ${marketHashName}. Using fallback.`);
       return getFallbackPrice(marketHashName);

   } catch (error) {
       if (error.response) {
           console.error(`Error fetching price for ${marketHashName} - Status: ${error.response.status}, Data:`, error.response.data || error.message);
       } else if (error.request) {
           console.error(`Error fetching price for ${marketHashName}: No response received (Timeout?).`, error.message);
       } else {
           console.error(`Error setting up request for ${marketHashName}:`, error.message);
       }
       return getFallbackPrice(marketHashName); // Fallback on error
   }
}


// --- Core Game Logic --- (Functions: createNewRound, startRoundTimer, endRound, sendWinningTradeOffer)

async function createNewRound() {
    // (Keep existing createNewRound logic - it doesn't depend on bot being logged in initially)
    if (isRolling) {
        console.log("Cannot create new round while rolling is in progress.");
        return;
    }
    try {
        isRolling = false; // Ensure rolling flag is reset
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

        const latestRound = await Round.findOne().sort('-roundId');
        const newRoundId = latestRound ? latestRound.roundId + 1 : 1;

        const round = new Round({
            roundId: newRoundId, status: 'active', startTime: new Date(),
            serverSeed: serverSeed, serverSeedHash: serverSeedHash,
            items: [], participants: [], totalValue: 0
        });

        await round.save();
        currentRound = round; // Set the global current round

        startRoundTimer(); // Start the timer for this new round

        io.emit('roundCreated', {
            roundId: round.roundId, serverSeedHash: round.serverSeedHash,
            timeLeft: ROUND_DURATION, totalValue: 0,
            participants: [], items: [] // Start with empty items/participants
        });

        console.log(`Round #${round.roundId} created. Hash: ${round.serverSeedHash}`);
        return round;

    } catch (err) {
        console.error('Error creating new round:', err);
        setTimeout(createNewRound, 10000); // Retry after delay
    }
}

function startRoundTimer() {
    // (Keep existing startRoundTimer logic)
    if (roundTimer) clearInterval(roundTimer);
    if (!currentRound || !currentRound.startTime) {
        console.error("Attempted to start timer with invalid current round state.");
        return;
    }
    currentRound.endTime = new Date(currentRound.startTime.getTime() + ROUND_DURATION * 1000);
    currentRound.save().catch(err => console.error("Error saving round end time:", err));
    let timeLeft = ROUND_DURATION;
    io.emit('timeUpdate', { timeLeft });
    roundTimer = setInterval(async () => {
        if (!currentRound || !currentRound.endTime) {
            clearInterval(roundTimer); roundTimer = null;
            console.error("Timer interval missing valid currentRound or endTime.");
            return;
        }
        const now = Date.now();
        timeLeft = Math.max(0, Math.floor((currentRound.endTime.getTime() - now) / 1000));
        io.emit('timeUpdate', { timeLeft });
        if (timeLeft <= 0) {
            clearInterval(roundTimer); roundTimer = null;
            await endRound();
        }
    }, 1000);
    console.log(`Round #${currentRound.roundId} timer started (${ROUND_DURATION}s).`);
}

async function endRound() {
    // (Keep existing endRound logic, including winner payout call)
    if (!currentRound || isRolling || currentRound.status !== 'active') {
        console.log(`endRound skipped: Round status: ${currentRound?.status}, Rolling: ${isRolling}`);
        return;
    }
    isRolling = true;
    console.log(`Ending round #${currentRound.roundId}...`);
    currentRound.status = 'rolling';
    currentRound.endTime = new Date();
    await currentRound.save();
    io.emit('roundRolling', { roundId: currentRound.roundId });

    try {
        const round = await Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId tradeUrl')
            .populate('items');
        if (!round) throw new Error(`Round ${currentRound._id} vanished during endRound.`);
        currentRound = round;

        if (round.participants.length === 0 || round.totalValue <= 0) {
            console.log(`Round #${round.roundId} ended with no participants.`);
            round.status = 'completed'; round.completedTime = new Date();
            await round.save();
            io.emit('roundCompleted', { roundId: round.roundId, message: "No participants." });
            // No payout needed
        } else {
            // Determine Winner
            round.clientSeed = crypto.randomBytes(16).toString('hex');
            const combinedSeed = round.serverSeed + round.clientSeed;
            round.provableHash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
            const decimal = parseInt(round.provableHash.substring(0, 8), 16);
            const totalTickets = round.participants.reduce((sum, p) => sum + (p?.tickets || 0), 0);
            if (totalTickets <= 0) throw new Error(`Round #${round.roundId} has zero total tickets.`);
            round.winningTicket = decimal % totalTickets;
            let ticketCounter = 0;
            let winner = null;
            for (const participant of round.participants) {
                 if (!participant || typeof participant.tickets !== 'number') continue;
                ticketCounter += participant.tickets;
                if (round.winningTicket < ticketCounter) {
                    winner = participant.user; break;
                }
            }
            if (!winner) throw new Error(`Winner determination failed for round #${round.roundId}.`);
            round.winner = winner._id;
            round.status = 'completed';
            await round.save();
            console.log(`Round #${round.roundId} completed. Winner: ${winner.username} (Ticket: ${round.winningTicket})`);

            io.emit('roundWinner', { /* ... winner data ... */
                roundId: round.roundId, winner: { id: winner._id, steamId: winner.steamId, username: winner.username, avatar: winner.avatar },
                winningTicket: round.winningTicket, totalValue: round.totalValue, totalTickets: totalTickets,
                serverSeed: round.serverSeed, clientSeed: round.clientSeed, provableHash: round.provableHash,
                serverSeedHash: round.serverSeedHash
            });

            // Send winnings (function now includes bot readiness check)
            await sendWinningTradeOffer(round, winner);

            round.completedTime = new Date();
            await round.save();
        }
    } catch (err) {
        console.error(`Error ending round #${currentRound ? currentRound.roundId : 'UNKNOWN'}:`, err);
        if (currentRound) {
            currentRound.status = 'error';
            await currentRound.save().catch(saveErr => console.error("Failed to save error status:", saveErr));
            io.emit('roundError', { roundId: currentRound.roundId, error: 'An internal error occurred.' });
        }
    } finally {
        isRolling = false;
        console.log("Scheduling next round creation...");
        setTimeout(createNewRound, 10000);
    }
}

async function sendWinningTradeOffer(round, winner) {
    // Guard Clause: Check bot readiness FIRST
    if (!isBotReady || !manager || !community.steamID) {
        console.error(`Cannot send trade offer for round #${round.roundId}: Bot is not ready or not logged in.`);
        io.emit('notification', { type: 'warning', userId: winner._id.toString(), message: `Payout for round ${round.roundId} requires manual processing due to bot issues. Please contact support.` });
        return; // Stop execution if bot isn't ready
    }

    console.log(`Attempting to send winning items for round #${round.roundId} to ${winner.username}...`);

    if (!winner.tradeUrl) {
        console.error(`Cannot send trade offer to winner ${winner.username}: Trade URL not set.`);
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Please set your Trade URL in settings to receive winnings.' });
        return;
    }
    if (!round.items || round.items.length === 0) {
        console.warn(`Round #${round.roundId} has no items to send.`);
        return;
    }

    try {
        const offer = manager.createOffer(winner.tradeUrl);
        const itemsToAdd = round.items.map(item => ({
            assetid: item.assetId, appid: RUST_APP_ID, contextid: RUST_CONTEXT_ID
        }));
        offer.addMyItems(itemsToAdd);
        offer.setMessage(`Congratulations on winning Round #${round.roundId} on ${process.env.SITE_NAME || 'RustyDegen'}!`);

        const offerStatus = await new Promise((resolve, reject) => {
            offer.send((err, status) => {
                if (err) {
                    console.error(`Error sending trade offer ${offer.id} to ${winner.username}:`, err.message || err);
                    return reject(err);
                }
                resolve(status);
            });
        });

        console.log(`Trade offer ${offer.id} sent to ${winner.username}. Status: ${offerStatus}`);
        io.emit('tradeOfferSent', {
            roundId: round.roundId, userId: winner._id, username: winner.username,
            offerId: offer.id, status: offerStatus
        });

    } catch (err) {
        console.error(`Failed to send winning trade offer for round #${round.roundId}:`, err);
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: `Failed to send winnings for round ${round.roundId}. Please contact support.` });
    }
}

// --- Authentication Routes ---
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));

app.get('/auth/steam/return',
     passport.authenticate('steam', { failureRedirect: '/' }),
     (req, res) => {
         res.redirect('/'); // Redirect to frontend root
     }
);

app.post('/logout', (req, res, next) => {
     req.logout(err => {
         if (err) { return next(err); }
         req.session.destroy(err => {
             if (err) {
                 console.error("Session destruction error during logout:", err);
                 return res.status(500).json({ success: false, error: 'Logout failed' });
             }
             res.clearCookie('connect.sid'); // Default name
             res.json({ success: true, message: 'Logged out successfully' });
         });
     });
});

// --- Middleware & API Routes ---

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
     if (req.isAuthenticated()) {
         return next();
     }
     res.status(401).json({ error: 'Not authenticated' });
}

// Get current user info
app.get('/api/user', ensureAuthenticated, (req, res) => {
     const { _id, steamId, username, avatar, tradeUrl, balance, createdAt } = req.user;
     res.json({ _id, steamId, username, avatar, tradeUrl, balance, createdAt });
});

// Update user's Trade URL
app.post('/api/user/tradeurl', ensureAuthenticated, async (req, res) => {
     const { tradeUrl } = req.body;
     if (!tradeUrl || typeof tradeUrl !== 'string' || !tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
         return res.status(400).json({ error: 'Invalid Trade URL format' });
     }
      try { const url = new URL(tradeUrl); if (!url.searchParams.get('partner') || !url.searchParams.get('token')) return res.status(400).json({ error: 'Invalid Trade URL format (missing parameters)' }); }
      catch (e) { return res.status(400).json({ error: 'Invalid Trade URL format' }); }

     try {
         const updatedUser = await User.findByIdAndUpdate(req.user._id, { tradeUrl: tradeUrl }, { new: true });
         if (!updatedUser) return res.status(404).json({ error: 'User not found' });
         console.log(`Updated trade URL for ${updatedUser.username}`);
         res.json({ success: true, tradeUrl: updatedUser.tradeUrl });
     } catch (err) {
         console.error(`Error updating trade URL for user ${req.user._id}:`, err);
         res.status(500).json({ error: 'Server error updating trade URL' });
     }
});

// Get user's Steam inventory (for depositing)
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
      // REVERTED: Removed the isBotReady check here to allow attempts even if bot isn't fully ready.
      // The manager.getUserInventoryContents call will likely fail if bot isn't ready,
      // and the error will be caught below. This matches the user's request to "see" it try.
     try {
        if (!manager) { // Still need to check if manager itself exists to avoid crash
            throw new Error("Trade Offer Manager not initialized.");
        }

         const inventory = await new Promise((resolve, reject) => {
             // This call might fail if manager/community isn't fully logged in/ready
             manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                 if (err) {
                     if (err.message?.includes('profile is private')) {
                         return reject(new Error('Your Steam inventory is private. Please set it to public.'));
                     }
                     // Log the actual error from the manager
                     console.error(`Error fetching inventory via manager for ${req.user.steamId}:`, err);
                     // Provide a slightly more specific error if possible
                     return reject(new Error(`Could not fetch inventory: ${err.message || 'Steam error'}. Bot might be offline or inventory private.`));
                 }
                 resolve(inv || []);
             });
         });

         if (!inventory || inventory.length === 0) return res.json([]);

         // Get prices concurrently
         const itemsWithPrices = await Promise.all(inventory.map(async (item) => {
             const price = await getItemPrice(item.market_hash_name); // Uses REAL function
             return {
                 assetId: item.assetid, name: item.market_hash_name, displayName: item.name,
                 image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                 price: price || 0, tradable: item.tradable, marketable: item.marketable,
             };
         }));

         // Filter AFTER getting prices
         const validItems = itemsWithPrices.filter(item =>
             item.tradable && item.price >= MIN_ITEM_VALUE
         );
         res.json(validItems);

     } catch (err) {
         // This catch block will now handle errors if manager.getUserInventoryContents fails
         console.error(`Error in /api/inventory for ${req.user?.username}:`, err.message);
         // Return the error message from the catch
         res.status(500).json({ error: err.message || 'Server error fetching inventory. Bot might be offline.' });
     }
});

// Initiate Deposit (generates token)
app.post('/api/deposit/initiate', ensureAuthenticated, (req, res) => {
     // Keep the Guard Clause: Deposit initiation *requires* a working bot and URL
     if (!isBotReady || !process.env.BOT_TRADE_URL) {
        console.warn(`Deposit initiation failed for ${req.user.username}: Bot not ready or BOT_TRADE_URL missing.`);
        return res.status(503).json({ error: "Deposit service is currently unavailable." });
     }
     if (!currentRound || currentRound.status !== 'active' || isRolling) {
         return res.status(400).json({ error: 'Deposits are closed for the current round.' });
     }

     const token = generateDepositToken(req.user._id);
     res.json({ success: true, depositToken: token, botTradeUrl: process.env.BOT_TRADE_URL });
});

// --- Trade Offer Manager Event Handling ---
// Attach listeners only if bot is configured
if (isBotConfigured) {
   manager.on('newOffer', async (offer) => { // Added async
       // Guard Clause: Check bot readiness inside handler too
        if (!isBotReady || !manager || !community.steamID) {
           console.warn(`Ignoring incoming offer #${offer.id} because bot is not ready.`);
           return;
        }

       console.log(`Received new trade offer #${offer.id} from ${offer.partner.getSteamID64()}`);

       // Basic validation
       if (offer.isOurOffer || offer.itemsToReceive.length === 0 || !offer.message) {
           console.log(`Offer #${offer.id} is not a valid potential deposit. Declining/Ignoring.`);
           if (!offer.isOurOffer) {
               return offer.decline(err => { if (err) console.error(`Error declining invalid potential deposit offer #${offer.id}:`, err); });
           } return;
       }

       // Round status check
       if (!currentRound || currentRound.status !== 'active' || isRolling) {
           console.log(`Offer #${offer.id} received while deposits are closed. Declining.`);
           return offer.decline(err => { if (err) console.error(`Error declining offer #${offer.id} during closed deposits:`, err); });
       }

       // Verify Token
       const token = offer.message.trim();
       let user;
       try {
           user = await verifyDepositToken(token, offer.partner.getSteamID64()); // Use await
           if (!user) {
               console.log(`Offer #${offer.id} has invalid or expired token. Declining.`);
               return offer.decline(err => { if (err) console.error(`Error declining offer #${offer.id} with invalid token:`, err); });
           }
       } catch (verificationError) {
           console.error(`Error verifying token for offer #${offer.id}:`, verificationError);
           return offer.decline(err => { if (err) console.error(`Error declining offer #${offer.id} due to verification error:`, err); });
       }

       console.log(`Offer #${offer.id} is a valid deposit from ${user.username}. Processing item prices...`);

       try {
           // --- Process Items and Get Prices Concurrently ---
           const itemPricePromises = offer.itemsToReceive.map(async (item) => {
               if (!item.market_hash_name) { console.warn(`Item asset ${item.assetid} missing name. Skipping.`); return null; }
               const price = await getItemPrice(item.market_hash_name); // Uses REAL function
               const itemValue = parseFloat(price) || 0;
               if (itemValue < MIN_ITEM_VALUE) { console.log(`Item ${item.market_hash_name} below min value. Skipping.`); return null; }
               return { assetId: item.assetid, name: item.market_hash_name, image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`, price: itemValue, owner: user._id, roundId: currentRound._id };
           });

           const itemsToProcess = (await Promise.all(itemPricePromises)).filter(item => item !== null);
           const depositTotalValue = itemsToProcess.reduce((sum, item) => sum + item.price, 0);

           if (itemsToProcess.length === 0) {
               console.log(`Offer #${offer.id} from ${user.username} contained no valid items > $${MIN_ITEM_VALUE.toFixed(2)}. Declining.`);
               return offer.decline(err => { if (err) console.error(`Error declining offer #${offer.id}:`, err); });
           }

           console.log(`Offer #${offer.id} total value $${depositTotalValue.toFixed(2)}. Attempting acceptance...`);

           // --- Accept the Offer ---
           offer.accept(async (err, status) => { // Added async
               if (err) { console.error(`Error accepting trade offer #${offer.id}:`, err.message || err); if (err.message?.includes('escrow')) console.warn(`Offer #${offer.id} resulted in escrow.`); return; }
               console.log(`Trade offer #${offer.id} accepted. Status: ${status}. Processing database updates...`);

               // --- Process Items Post-Acceptance ---
                const latestRound = await Round.findById(currentRound._id); // Re-fetch round
                if (!latestRound || latestRound.status !== 'active' || isRolling) { console.error(`CRITICAL: Round changed/ended after accepting offer #${offer.id}!`); return; }

               try {
                   const createdItems = await Item.insertMany(itemsToProcess);
                   const createdItemIds = createdItems.map(item => item._id);
                   latestRound.items.push(...createdItemIds);
                   latestRound.totalValue += depositTotalValue;
                   const ticketsEarned = Math.max(0, Math.floor(depositTotalValue / TICKET_VALUE_RATIO));
                   const participantIndex = latestRound.participants.findIndex(p => p.user?.equals(user._id));
                   if (participantIndex > -1) {
                       latestRound.participants[participantIndex].itemsValue += depositTotalValue;
                       latestRound.participants[participantIndex].tickets += ticketsEarned;
                   } else {
                       latestRound.participants.push({ user: user._id, itemsValue: depositTotalValue, tickets: ticketsEarned });
                   }
                   await latestRound.save();
                   currentRound = latestRound; // Update global ref

                   const participantData = latestRound.participants.find(p => p.user?.equals(user._id));
                   io.emit('participantUpdated', { /* ... data ... */
                        roundId: latestRound.roundId, userId: user._id, username: user.username, avatar: user.avatar,
                        itemsValue: participantData?.itemsValue || 0, tickets: participantData?.tickets || 0,
                        totalValue: latestRound.totalValue
                   });
                    createdItems.forEach(item => { io.emit('itemDeposited', { /* ... data ... */
                        roundId: latestRound.roundId, item: { id: item._id, name: item.name, image: item.image, price: item.price },
                        user: { id: user._id, username: user.username, avatar: user.avatar }
                    }); });
                   console.log(`Deposit success for offer #${offer.id}. User: ${user.username}, Value: ${depositTotalValue.toFixed(2)}`);
               } catch (dbError) {
                   console.error(`CRITICAL DB error after accepting offer #${offer.id}:`, dbError);
                   if (currentRound) { await Round.updateOne({ _id: currentRound._id }, { $set: { status: 'error' } }).catch(err => console.error("Failed to save error status:", err)); io.emit('roundError', { roundId: currentRound.roundId, error: 'Deposit processing error.' }); }
               }
           });
       } catch (processingError) {
           console.error(`Error processing item prices for offer #${offer.id}:`, processingError);
            return offer.decline(err => { if (err) console.error(`Error declining offer #${offer.id}:`, err); });
       }
   });

   manager.on('sentOfferChanged', (offer, oldState) => {
       console.log(`Offer #${offer.id} state changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);
       // Handle winner payout updates
   });
} else {
   console.warn("Bot not configured. Trade Offer Manager event listeners are not attached.");
}

// --- Round Info API Routes --- (Keep as they were)
app.get('/api/round/current', async (req, res) => {
    if (!currentRound || !currentRound._id) { return res.status(404).json({ error: 'No active round currently.' }); }
    try {
        const round = await Round.findById(currentRound._id).populate('participants.user', 'username avatar steamId').populate('items', 'name image price owner').lean();
        if (!round) { currentRound = null; console.warn("Current round ID invalid for API."); return res.status(404).json({ error: 'Current round data inconsistency.' }); }
        const now = Date.now();
        const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - now) / 1000)) : 0;
        res.json({
            roundId: round.roundId, status: round.status, startTime: round.startTime, endTime: round.endTime, timeLeft: timeLeft, totalValue: round.totalValue, serverSeedHash: round.serverSeedHash,
            participants: round.participants.map(p => ({ user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null, itemsValue: p.itemsValue, tickets: p.tickets })).filter(p => p.user),
            items: round.items.map(item => ({ id: item._id, name: item.name, image: item.image, price: item.price, owner: item.owner })),
            winner: round.winner, winningTicket: round.status === 'completed' ? round.winningTicket : null, serverSeed: round.status === 'completed' ? round.serverSeed : null, clientSeed: round.status === 'completed' ? round.clientSeed : null, provableHash: round.status === 'completed' ? round.provableHash : null,
        });
    } catch (err) { console.error('Error fetching current round:', err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/rounds', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; const limit = parseInt(req.query.limit) || 10; const skip = (page - 1) * limit;
        const roundsQuery = Round.find({ status: { $in: ['completed', 'error'] } }).sort('-roundId').skip(skip).limit(limit).populate('winner', 'username avatar steamId').select('roundId startTime endTime completedTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket provableHash status participants items').lean(); // Select fewer fields if needed
        const countQuery = Round.countDocuments({ status: { $in: ['completed', 'error'] } });
        const [rounds, count] = await Promise.all([roundsQuery, countQuery]);
        rounds.forEach(round => { round.totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0; round.itemCount = round.items?.length ?? 0; delete round.participants; delete round.items; });
        res.json({ rounds, totalPages: Math.ceil(count / limit), currentPage: page, totalRounds: count });
    } catch (err) { console.error('Error fetching round history:', err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/verify', async (req, res) => {
    // (Keep existing /api/verify logic)
    const { roundId, serverSeed, clientSeed } = req.body;
    if (!roundId || !serverSeed || !clientSeed) return res.status(400).json({ error: 'Missing fields' });
    try {
        const round = await Round.findOne({ roundId: roundId, status: 'completed' }).populate('participants.user', 'username').populate('winner', 'username').lean();
        if (!round) return res.status(404).json({ error: 'Completed round not found.' });
        const calculatedServerHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        if (calculatedServerHash !== round.serverSeedHash) return res.json({ verified: false, reason: 'Server seed hash mismatch.'});
        if (serverSeed !== round.serverSeed || clientSeed !== round.clientSeed) return res.json({ verified: false, reason: 'Provided seeds do not match stored seeds.' });
        const combinedSeed = serverSeed + clientSeed;
        const calculatedProvableHash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
        const decimal = parseInt(calculatedProvableHash.substring(0, 8), 16);
        const totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0;
        if (totalTickets <= 0) return res.json({ verified: false, reason: 'Round had zero tickets.' });
        const calculatedWinningTicket = decimal % totalTickets;
        if (calculatedWinningTicket !== round.winningTicket) return res.json({ verified: false, reason: 'Calculated winning ticket mismatch.'});
        res.json({
            verified: true, roundId: round.roundId, serverSeed: serverSeed, serverSeedHash: round.serverSeedHash, clientSeed: clientSeed,
            combinedHash: calculatedProvableHash, winningTicket: calculatedWinningTicket, totalTickets: totalTickets, totalValue: round.totalValue,
            winnerUsername: round.winner?.username || 'N/A'
        });
    } catch (err) { console.error(`Error verifying round ${roundId}:`, err); res.status(500).json({ error: 'Server error' }); }
});

// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
    // (Keep existing io.on('connection') logic)
    console.log(`New client connected: ${socket.id}`);
    if (currentRound && currentRound._id) {
        Round.findById(currentRound._id).populate('participants.user', 'username avatar steamId').populate('items', 'name image price owner').lean()
        .then(round => {
            if (round) {
                const now = Date.now();
                const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - now) / 1000)) : 0;
                socket.emit('roundData', {
                    roundId: round.roundId, status: round.status, timeLeft: timeLeft, totalValue: round.totalValue, serverSeedHash: round.serverSeedHash,
                    participants: round.participants.map(p => ({ user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null, itemsValue: p.itemsValue, tickets: p.tickets })).filter(p => p.user),
                    items: round.items.map(item => ({ id: item._id, name: item.name, image: item.image, price: item.price, owner: item.owner }))
                });
            } else { console.warn(`Round doc not found for socket ${socket.id}.`); socket.emit('noActiveRound'); }
        }).catch(err => { console.error(`Error fetching round for socket ${socket.id}:`, err); socket.emit('noActiveRound'); });
    } else { socket.emit('noActiveRound'); }
    socket.on('disconnect', (reason) => { console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`); });
});

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Initial round creation is handled within the bot login callback if successful
    if (!isBotConfigured) {
       console.log("Bot not configured. Server running without trade features. Initial round not created.");
    } else if (!isBotReady && steamLoginCredentials.twoFactorCode) { // If configured but login hasn't finished/failed
       console.log("Waiting for bot login attempt... Initial round will be created if successful.");
    }
    // Pricing API Test (optional)
    setTimeout(async () => {
       console.log("Testing Pricing API on startup...");
       const testItem = "Metal Chest Plate";
       try { const price = await getItemPrice(testItem); console.log(`TEST: Price for ${testItem}: ${price !== undefined ? `$${price.toFixed(2)}` : 'Error/Not Found'}`); }
       catch(e){ console.error("Error testing price API:", e);}
    }, 7000);
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    io.close(); // Close socket connections
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false).then(() => { console.log('MongoDB connection closed'); process.exit(0); })
        .catch(err => { console.error("Failed to close MongoDB connection:", err); process.exit(1); });
    });
     setTimeout(() => { console.error('Graceful shutdown timed out, forcing exit.'); process.exit(1); }, 10000);
});

// Handle SIGINT (Ctrl+C) for local development
process.on('SIGINT', () => { process.emit('SIGTERM'); });

// Basic Unhandled Error Handling Middleware (Add LAST)
app.use((err, req, res, next) => {
   console.error("Unhandled Error Caught:", err.stack || err);
   const status = err.status || 500;
   const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : (err.message || 'Internal Server Error');
   res.status(status).json({ error: message });
});
