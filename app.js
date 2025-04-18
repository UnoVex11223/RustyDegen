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
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config(); // Make sure to have a .env file

// --- Configuration Constants ---
// Ensure critical environment variables are present
const requiredEnvVars = [
    'MONGODB_URI', 'SESSION_SECRET', 'STEAM_API_KEY', 'SITE_URL',
    // Conditionally required if bot is intended to function
    'STEAM_USERNAME', 'STEAM_PASSWORD', 'STEAM_SHARED_SECRET', 'BOT_TRADE_URL', 'SITE_NAME'
];
const isBotConfigured = process.env.STEAM_USERNAME && process.env.STEAM_PASSWORD && process.env.STEAM_SHARED_SECRET && process.env.BOT_TRADE_URL;
let missingVars = requiredEnvVars.filter(v => !process.env[v] && !(v.startsWith('STEAM_') || v === 'BOT_TRADE_URL' || v === 'SITE_NAME') && isBotConfigured); // Check core vars always, bot vars only if configured
if (!isBotConfigured) {
    console.warn("WARN: Steam Bot credentials/config incomplete in .env file. Trading features will be disabled.");
} else {
    // If bot is configured, check for bot-specific vars
    missingVars = missingVars.concat(requiredEnvVars.filter(v => (v.startsWith('STEAM_') || v === 'BOT_TRADE_URL' || v === 'SITE_NAME') && !process.env[v]));
}

if (missingVars.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}


const RUST_APP_ID = 252490;
const RUST_CONTEXT_ID = 2;
const ROUND_DURATION = parseInt(process.env.ROUND_DURATION_SECONDS) || 99; // Matches client
const TICKET_VALUE_RATIO = parseFloat(process.env.TICKET_VALUE) || 0.01; // $1 = 100 tickets
const DEPOSIT_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const PRICE_CACHE_TTL_SECONDS = parseInt(process.env.PRICE_CACHE_TTL_SECONDS) || 15 * 60; // 15 minutes default cache validity
const PRICE_REFRESH_INTERVAL_MS = (parseInt(process.env.PRICE_REFRESH_MINUTES) || 10) * 60 * 1000; // Default 10 mins refresh interval
const MIN_ITEM_VALUE = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10; // Minimum value for an item to be depositable
const PRICE_FETCH_TIMEOUT_MS = 30000; // 30 seconds timeout for SCMM API

// Game Rules Constants (Matching Client)
const MAX_PARTICIPANTS = 20;
const MAX_ITEMS_PER_POT = 200;
const TAX_MIN_PERCENT = parseInt(process.env.TAX_MIN_PERCENT) || 5; // Use parseInt for percentages
const TAX_MAX_PERCENT = parseInt(process.env.TAX_MAX_PERCENT) || 10;
const MIN_POT_FOR_TAX = parseFloat(process.env.MIN_POT_FOR_TAX) || 100; // Pot must be at least $100 for tax (Ensure it's a number)


// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: process.env.SITE_URL || "*", methods: ["GET", "POST"] } });

// Configure middleware
app.use(cors({ origin: process.env.SITE_URL || "*", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Serve static files from 'public' directory (where index.html, css, js folders should reside)
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Consider using a persistent session store (like connect-mongo) for production
    // const MongoStore = require('connect-mongo');
    // store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
        maxAge: 3600000 * 24, // Example: 24 hour session cookie
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true, // Helps prevent XSS
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax' // Adjust SameSite as needed ('none' requires secure=true)
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Steam Strategy ---
passport.use(new SteamStrategy({
    returnURL: `${process.env.SITE_URL}/auth/steam/return`,
    realm: process.env.SITE_URL,
    apiKey: process.env.STEAM_API_KEY,
    providerURL: 'https://steamcommunity.com/openid' // Correct OpenID endpoint
},
    async (identifier, profile, done) => {
        try {
            // Use findOneAndUpdate with upsert for cleaner create/update logic
            const userData = {
                username: profile.displayName,
                avatar: profile._json.avatarfull || '',
                // Don't overwrite tradeUrl on login
            };
            const user = await User.findOneAndUpdate(
                { steamId: profile.id },
                { $set: userData, $setOnInsert: { steamId: profile.id, tradeUrl: '', createdAt: new Date() } },
                { new: true, upsert: true, runValidators: true } // upsert=true creates if not found
            );
            // console.log(`User login/update successful: ${user.username} (ID: ${user.steamId})`); // Less verbose logging
            return done(null, user); // Pass user object to serializeUser
        } catch (err) {
            console.error('Steam Strategy Error:', err);
            return done(err);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id); // Use internal MongoDB ID (_id) for session storage
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user); // Attach user object to req.user
    } catch (err) {
        console.error("DeserializeUser Error:", err);
        done(err);
    }
});

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        process.exit(1); // Exit if cannot connect to DB
    });

// --- MongoDB Schemas ---
const userSchema = new mongoose.Schema({
    steamId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    avatar: { type: String },
    tradeUrl: { type: String, default: '' },
    balance: { type: Number, default: 0 }, // Example field, might not be used in jackpot
    createdAt: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false }
});
const itemSchema = new mongoose.Schema({
    assetId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Added index
    roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true, index: true },
    depositedAt: { type: Date, default: Date.now }
});
const roundSchema = new mongoose.Schema({
    roundId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'rolling', 'completed', 'error'], default: 'pending', index: true },
    startTime: { type: Date },
    endTime: { type: Date },
    completedTime: { type: Date },
    totalValue: { type: Number, default: 0 },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    participants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        itemsValue: { type: Number, required: true, default: 0 }, // Total value deposited by user in this round
        tickets: { type: Number, required: true, default: 0 }    // Tickets based on value
    }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Added index
    winningTicket: { type: Number },
    serverSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    clientSeed: { type: String },
    provableHash: { type: String },
    taxAmount: { type: Number, default: 0 }, // Store the calculated tax value
    taxedItems: [{ // Store basic info of items taken as tax
        assetId: String,
        name: String,
        price: Number
    }]
});
// Add index to participants.user for faster lookups
roundSchema.index({ 'participants.user': 1 });

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Round = mongoose.model('Round', roundSchema);

// --- Steam Bot Setup ---
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: community,
    domain: process.env.SITE_URL ? process.env.SITE_URL.replace(/^https?:\/\//, '') : 'localhost', // Domain for trade link validation
    language: 'en', // Language for trade offers
    pollInterval: 15000, // Check for new offers every 15 seconds
    cancelTime: 10 * 60 * 1000, // Cancel outgoing offers after 10 minutes
    // Consider adding cancelOfferCount for automatic cancellation of old offers
});
let isBotReady = false; // Track bot readiness

// --- 2FA Code Generation ---
function generateAuthCode() {
    const secret = process.env.STEAM_SHARED_SECRET;
    if (!secret) { console.error("STEAM_SHARED_SECRET missing. Cannot generate 2FA code."); return null; }
    try { return SteamTotp.generateAuthCode(secret); }
    catch (e) { console.error("Error generating 2FA code:", e); return null; }
}

// --- Steam Bot Login ---
if (isBotConfigured) {
    const loginCredentials = {
        accountName: process.env.STEAM_USERNAME,
        password: process.env.STEAM_PASSWORD,
        twoFactorCode: generateAuthCode()
    };
    if (loginCredentials.twoFactorCode) {
        console.log(`Attempting Steam login for bot: ${loginCredentials.accountName}...`);
        community.login(loginCredentials, (err, sessionID, cookies) => {
            if (err) {
                console.error('FATAL STEAM LOGIN ERROR:', err);
                isBotReady = false;
                // Optionally, implement retry logic or alert admin
            } else {
                console.log(`Steam bot ${loginCredentials.accountName} logged in successfully (SteamID: ${community.steamID}).`);
                manager.setCookies(cookies, (err) => {
                    if (err) {
                        console.error('TradeOfferManager Error setting cookies:', err);
                        isBotReady = false;
                        return;
                    }
                    console.log('TradeOfferManager cookies set.');
                    community.setCookies(cookies); // Also set cookies for general community actions
                    // community.gamesPlayed(process.env.SITE_NAME || 'RustyDegen'); // Commented out: Often cosmetic
                    community.setPersona(SteamCommunity.EPersonaState.Online); // Set online status
                    isBotReady = true;
                    console.log("Steam Bot is ready.");
                    // Now that the bot is ready, attempt to create the first round if none exists
                    ensureInitialRound();
                });

                // Auto-accept friend requests
                community.on('friendRelationship', (steamID, relationship) => {
                    if (relationship === SteamCommunity.EFriendRelationship.RequestRecipient) {
                        console.log(`Received friend request from ${steamID}. Accepting...`);
                        community.addFriend(steamID, (err) => {
                            if (err) console.error(`Error accepting friend request from ${steamID}:`, err);
                            else console.log(`Accepted friend request from ${steamID}.`);
                        });
                    }
                });
            }
        });
    } else {
        console.warn("Could not generate 2FA code. Steam Bot login skipped.");
        isBotReady = false;
    }
} // No else needed, warning logged at start if not configured

// --- Active Round Data ---
let currentRound = null;
let roundTimer = null; // Interval ID for the countdown
let isRolling = false; // Flag to prevent actions during winner selection/payout

// --- Deposit Security Token Store ---
// TODO: For production robustness, replace this in-memory store with a persistent one
//       like Redis or a MongoDB collection with a TTL index.
const depositTokens = {}; // Simple in-memory store { token: { userId, expiry } }

function generateDepositToken(userId) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiry = Date.now() + DEPOSIT_TOKEN_EXPIRY_MS;
    depositTokens[token] = { userId: userId.toString(), expiry: expiry };
    // console.log(`Generated deposit token ${token} for user ${userId}`); // Less verbose log
    // Clean up expired token after expiry + buffer
    setTimeout(() => {
        if (depositTokens[token] && depositTokens[token].expiry <= Date.now()) {
            delete depositTokens[token];
            // console.log(`Expired and deleted deposit token ${token}`); // Less verbose log
        }
    }, DEPOSIT_TOKEN_EXPIRY_MS + 5000);
    return token;
}
async function verifyDepositToken(token, partnerSteamId) {
    const tokenData = depositTokens[token];
    if (!tokenData || tokenData.expiry <= Date.now()) {
        if (tokenData) delete depositTokens[token]; // Clean up if expired
        // console.log(`Deposit token ${token} is invalid or expired.`); // Less verbose log
        return null;
    }
    try {
        // Find user by partner's SteamID and check if it matches the token owner
        const user = await User.findOne({ steamId: partnerSteamId }).lean(); // Use lean for performance
        if (!user || user._id.toString() !== tokenData.userId) {
            console.warn(`Token ${token} verification failed: User mismatch (Offer from ${partnerSteamId}, Token for ${tokenData.userId})`);
            return null;
        }
        // Important: Invalidate token immediately after successful verification
        delete depositTokens[token];
        console.log(`Verified deposit token ${token} for user ${user.username}`);
        return user; // Return the full user object (lean)
    } catch (err) {
        console.error(`Error during token verification for token ${token}:`, err);
        return null;
    }
}


// --- Pricing Cache and Functions ---
const priceCache = new NodeCache({ stdTTL: PRICE_CACHE_TTL_SECONDS, checkperiod: PRICE_CACHE_TTL_SECONDS * 0.2, useClones: false }); // useClones: false for performance

// Fallback function
function getFallbackPrice(marketHashName) {
    // console.warn(`PRICE_INFO: Using fallback (min value $${MIN_ITEM_VALUE.toFixed(2)}) for: ${marketHashName}`); // Less verbose
    return MIN_ITEM_VALUE > 0 ? MIN_ITEM_VALUE : 0;
}

/**
 * Fetches ALL item prices from rust.scmm.app and updates the local cache.
 */
async function refreshPriceCache() {
    console.log("PRICE_INFO: Attempting to refresh price cache from rust.scmm.app...");
    const apiUrl = `https://rust.scmm.app/api/item/prices?currency=USD`;

    try {
        const response = await axios.get(apiUrl, { timeout: PRICE_FETCH_TIMEOUT_MS });

        if (response.data && Array.isArray(response.data)) {
            const items = response.data;
            let updatedCount = 0;
            let newItems = []; // Array for bulk cache update

            items.forEach(item => {
                // Check for valid name and non-negative number price
                if (item?.name && typeof item.price === 'number' && item.price >= 0) {
                    const key = item.name;
                    // Assuming SCMM API returns price in the smallest currency unit (e.g., cents)
                    const priceInDollars = item.price / 100.0;

                    newItems.push({ key: key, val: priceInDollars }); // TTL is managed by NodeCache default
                    updatedCount++;
                } else if (item?.name) {
                    // console.warn(`PRICE_WARN: Invalid or missing price field for item '${item.name}' in SCMM response. Raw price: ${item.price}`); // Less verbose
                }
            });

            if (newItems.length > 0) {
                const success = priceCache.mset(newItems); // Bulk set items in cache
                if (success) { console.log(`PRICE_SUCCESS: Refreshed price cache with ${updatedCount} items from rust.scmm.app.`); }
                else { console.error("PRICE_ERROR: Failed to bulk set price cache (node-cache mset returned false)."); }
            } else {
                console.warn("PRICE_WARN: No valid items found in the response from rust.scmm.app price refresh.");
            }
        } else {
            console.error("PRICE_ERROR: Invalid or empty array response received from rust.scmm.app price refresh. Response Status:", response.status);
        }
    } catch (error) {
        console.error(`PRICE_ERROR: Failed to fetch prices from ${apiUrl}.`);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
             console.error(` -> Error: Request timed out after ${PRICE_FETCH_TIMEOUT_MS}ms. SCMM API might be slow/unreachable.`);
        } else if (error.response) {
            console.error(` -> Status: ${error.response.status}, Response:`, error.response.data || error.message);
        } else if (error.request) {
            console.error(` -> Error: No response received (Network issue?).`, error.message);
        } else {
            console.error(' -> Error setting up request:', error.message);
        }
        // Do not crash the server, continue using potentially stale cache or fallbacks
    }
}

/**
 * Gets item price from local cache, falling back if not found.
 * @param {string} marketHashName
 * @returns {number} Price in USD
 */
function getItemPrice(marketHashName) {
    const cachedPrice = priceCache.get(marketHashName);
    if (cachedPrice !== undefined) { // Check cache first (0 is a valid cached price)
        return cachedPrice;
    } else {
        return getFallbackPrice(marketHashName); // Use fallback if not in cache
    }
}

// --- Core Game Logic ---

/**
 * Creates a new round if one isn't already active or rolling.
 */
async function createNewRound() {
    if (isRolling) {
        console.log("Cannot create new round: Current round is rolling.");
        return null;
    }
    // Check if there's already an active round in memory
    if (currentRound && currentRound.status === 'active') {
        console.log(`Cannot create new round: Round ${currentRound.roundId} is already active.`);
        return currentRound;
    }

    try {
        isRolling = false; // Ensure rolling flag is reset

        const serverSeed = crypto.randomBytes(32).toString('hex');
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

        // Get the last round ID to increment
        const lastRound = await Round.findOne().sort('-roundId');
        const nextRoundId = lastRound ? lastRound.roundId + 1 : 1;

        const newRound = new Round({
            roundId: nextRoundId,
            status: 'active', // Start as active immediately
            startTime: new Date(),
            serverSeed: serverSeed,
            serverSeedHash: serverSeedHash,
            items: [],
            participants: [],
            totalValue: 0
        });

        await newRound.save();
        currentRound = newRound.toObject(); // Convert to plain object for consistency

        // Timer starts when the first participant joins (handled in handleNewDeposit)
        // We just emit the creation event here. Client handles timer display.
        io.emit('roundCreated', formatRoundForClient(currentRound)); // Use formatter

        console.log(`--- Round ${newRound.roundId} created and active ---`);
        return currentRound;

    } catch (err) {
        console.error('FATAL: Error creating new round:', err);
        // Retry after a delay if round creation fails
        setTimeout(createNewRound, 10000); // Retry after 10 seconds
        return null;
    }
}

// Ensure an initial round exists on startup *after* bot is ready
async function ensureInitialRound() {
    // Only run if bot is configured OR if no bot is needed (allow site to run without bot)
    if (!isBotConfigured || isBotReady) {
        if (!currentRound) {
            try {
                const existingActive = await Round.findOne({ status: 'active' })
                    .populate('participants.user', 'steamId username avatar')
                    .populate('items')
                    .lean(); // Use lean for efficiency

                if (existingActive) {
                    console.log(`Found existing active round ${existingActive.roundId} on startup.`);
                    currentRound = existingActive; // Already a plain object due to lean()

                    // Decide if timer needs starting (e.g., based on participants and endTime)
                    if (currentRound.participants.length > 0 && currentRound.endTime && new Date(currentRound.endTime) > Date.now()) {
                        startRoundTimer(true); // Start timer based on remaining time
                    } else if (currentRound.participants.length > 0 && !currentRound.endTime) {
                         // If round was active but timer somehow wasn't set, start it now
                         console.warn(`Active round ${currentRound.roundId} found without endTime. Starting timer now.`);
                         startRoundTimer(false);
                    }
                } else {
                    console.log("No active round found, creating initial round...");
                    await createNewRound();
                }
            } catch (dbErr) {
                console.error("Error ensuring initial round:", dbErr);
                // Consider retrying or exiting if initial round setup fails critically
            }
        }
    } else {
        console.log("Skipping initial round check as bot is not ready/configured.");
        // Optionally schedule a check for later if bot becomes ready
    }
}


/**
 * Starts or restarts the countdown timer for the current round.
 * @param {boolean} useRemainingTime - If true, calculate based on endTime, else use ROUND_DURATION.
 */
function startRoundTimer(useRemainingTime = false) {
    if (roundTimer) clearInterval(roundTimer); // Clear existing timer
    if (!currentRound || currentRound.status !== 'active') {
        console.warn("Cannot start timer: No active round or round status invalid.");
        return;
    }

    let timeLeft;
    let calculatedEndTime;

    if (useRemainingTime && currentRound.endTime) {
        calculatedEndTime = new Date(currentRound.endTime); // Use existing end time
        timeLeft = Math.max(0, Math.floor((calculatedEndTime.getTime() - Date.now()) / 1000));
        console.log(`Resuming timer for round ${currentRound.roundId} with ${timeLeft}s remaining.`);
    } else {
        timeLeft = ROUND_DURATION;
        calculatedEndTime = new Date(Date.now() + ROUND_DURATION * 1000);
        currentRound.endTime = calculatedEndTime; // Set end time on the object
        // Save end time asynchronously
        Round.updateOne({ _id: currentRound._id }, { $set: { endTime: calculatedEndTime } })
            .catch(e => console.error(`Error saving round end time for round ${currentRound?.roundId}:`, e));
        console.log(`Starting timer for round ${currentRound.roundId} (${ROUND_DURATION}s). End time: ${calculatedEndTime.toISOString()}`);
    }

    // Update local round state immediately
    currentRound.timeLeft = timeLeft;
    io.emit('timerUpdate', { timeLeft }); // Initial emit

    roundTimer = setInterval(async () => {
        // Check validity on each tick
        if (!currentRound || currentRound.status !== 'active' || !currentRound.endTime) {
            clearInterval(roundTimer);
            roundTimer = null;
            console.warn("Timer stopped: Round state became invalid during countdown.");
            return;
        }

        const now = Date.now();
        let currenttimeLeft = Math.max(0, Math.floor((new Date(currentRound.endTime).getTime() - now) / 1000));

        // Update local state
        currentRound.timeLeft = currenttimeLeft;
        io.emit('timerUpdate', { timeLeft: currenttimeLeft });

        if (currenttimeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            console.log(`Round ${currentRound.roundId} timer reached zero.`);
            await endRound(); // Trigger round ending process
        }
    }, 1000); // Update every second
}


/**
 * Handles the process of ending the current round, calculating the winner, applying tax, and initiating payout.
 */
async function endRound() {
    if (!currentRound || isRolling || currentRound.status !== 'active') {
        console.warn(`Attempted to end round ${currentRound?.roundId}, but state is invalid (Status: ${currentRound?.status}, Rolling: ${isRolling})`);
        return; // Prevent ending if not active or already rolling
    }

    isRolling = true; // Set flag to prevent concurrent actions
    const roundIdToEnd = currentRound.roundId; // Store ID in case currentRound changes unexpectedly
    const roundMongoId = currentRound._id; // Store Mongo ID for reliable fetching
    console.log(`--- Ending round ${roundIdToEnd}... ---`);

    try {
        // Update round status immediately in DB
        await Round.updateOne({ _id: roundMongoId }, { $set: { status: 'rolling', endTime: new Date() } });
        io.emit('roundRolling', { roundId: roundIdToEnd }); // Notify clients

        // Fetch the full round data for processing, ensuring it's the one we intended to end
        // Use .lean() here for efficiency, as we won't be saving this fetched instance directly.
        const roundData = await Round.findById(roundMongoId)
            .populate('participants.user') // Populate user data
            .populate('items')             // Populate item data
            .lean();

        if (!roundData) throw new Error(`Round ${roundIdToEnd} data missing after status update.`);
        if (roundData.status !== 'rolling') { // Double check status after fetch
             console.warn(`Round ${roundIdToEnd} status changed unexpectedly after marking as rolling. Aborting endRound.`);
             isRolling = false;
             return;
        }

        // Update in-memory currentRound (plain object) to match fetched lean data
        currentRound = roundData;

        // --- Handle Empty Round ---
        if (roundData.participants.length === 0 || roundData.items.length === 0 || roundData.totalValue <= 0) {
            console.log(`Round ${roundData.roundId} ended with no valid participants or value.`);
            await Round.updateOne({ _id: roundMongoId }, { $set: { status: 'completed', completedTime: new Date() } });
            io.emit('roundCompleted', { roundId: roundData.roundId, message: "No participants." });
            isRolling = false; // Reset flag
            setTimeout(createNewRound, 5000); // Start next round sooner
            return; // Exit early
        }

        // --- Tax Calculation ---
        let finalItems = [...roundData.items]; // Copy items to modify (these are lean objects)
        let finalTotalValue = roundData.totalValue;
        let taxAmount = 0;
        let taxedItemsInfo = [];
        let taxedItemIds = new Set(); // Keep track of IDs taken as tax

        if (finalTotalValue >= MIN_POT_FOR_TAX) {
            // console.log(`Round ${roundData.roundId} eligible for tax (Value: $${finalTotalValue.toFixed(2)} >= $${MIN_POT_FOR_TAX})`); // Less verbose
            const targetTaxValue = finalTotalValue * (TAX_MIN_PERCENT / 100);
            const maxTaxValue = finalTotalValue * (TAX_MAX_PERCENT / 100);
            // console.log(`Tax Target: $${targetTaxValue.toFixed(2)} (Min ${TAX_MIN_PERCENT}%), Max: $${maxTaxValue.toFixed(2)} (Max ${TAX_MAX_PERCENT}%)`); // Less verbose

            const sortedItems = [...finalItems].sort((a, b) => a.price - b.price);
            let currentTaxValue = 0;
            const itemsToTakeForTax = [];

            for (const item of sortedItems) {
                if (currentTaxValue + item.price <= maxTaxValue) {
                    itemsToTakeForTax.push(item);
                    currentTaxValue += item.price;
                    if (currentTaxValue >= targetTaxValue) {
                        break;
                    }
                } else {
                    // console.log(`Tax: Adding item ${item.name} ($${item.price.toFixed(2)}) would exceed max ($${maxTaxValue.toFixed(2)}). Stopping tax selection.`); // Less verbose
                    break;
                }
            }

            if (itemsToTakeForTax.length > 0) {
                taxedItemIds = new Set(itemsToTakeForTax.map(item => item._id.toString())); // Use _id for filtering
                finalItems = finalItems.filter(item => !taxedItemIds.has(item._id.toString())); // Filter out taxed items
                taxAmount = currentTaxValue;
                finalTotalValue -= taxAmount; // Reduce pot value
                taxedItemsInfo = itemsToTakeForTax.map(i => ({ assetId: i.assetId, name: i.name, price: i.price })); // Store basic info

                console.log(`Tax Applied for Round ${roundData.roundId}: $${taxAmount.toFixed(2)} (${itemsToTakeForTax.length} items). New Pot Value: $${finalTotalValue.toFixed(2)}`);
            } else {
                // console.log(`Tax Skipped for Round ${roundData.roundId}: Could not select items within ${TAX_MIN_PERCENT}-${TAX_MAX_PERCENT}% range.`); // Less verbose
            }
        } else {
            // console.log(`Tax Skipped for Round ${roundData.roundId}: Pot value $${finalTotalValue.toFixed(2)} is below minimum $${MIN_POT_FOR_TAX}`); // Less verbose
        }

        // --- Winner Calculation (Provably Fair) ---
        const clientSeed = crypto.randomBytes(16).toString('hex'); // Generate client seed now
        const combinedString = roundData.serverSeed + clientSeed;
        const provableHash = crypto.createHash('sha256').update(combinedString).digest('hex');

        const decimalFromHash = parseInt(provableHash.substring(0, 8), 16);
        const totalTickets = roundData.participants.reduce((sum, p) => sum + (p?.tickets || 0), 0);

        if (totalTickets <= 0) throw new Error(`Cannot determine winner: Total tickets is zero or invalid for round ${roundData.roundId}.`);

        const winningTicket = decimalFromHash % totalTickets;

        let cumulativeTickets = 0;
        let winner = null;
        for (const participant of roundData.participants) {
            if (!participant?.tickets || !participant.user) continue; // Skip invalid participants
            cumulativeTickets += participant.tickets;
            if (winningTicket < cumulativeTickets) {
                winner = participant.user; // The user object is populated (from lean)
                break;
            }
        }

        if (!winner) throw new Error(`Winner selection failed for round ${roundData.roundId}. Winning Ticket: ${winningTicket}, Total Tickets: ${totalTickets}`);

        // --- Prepare Final Update Data ---
        const finalUpdateData = {
            status: 'completed',
            completedTime: new Date(),
            clientSeed: clientSeed,
            provableHash: provableHash,
            winningTicket: winningTicket,
            winner: winner._id, // Store winner's ID
            taxAmount: taxAmount,
            taxedItems: taxedItemsInfo,
            items: finalItems.map(i => i._id), // Save only IDs of remaining items
            totalValue: finalTotalValue // Save the final post-tax value
        };

        // Atomically update the round in the database
        await Round.updateOne({ _id: roundMongoId }, { $set: finalUpdateData });

        // Update in-memory currentRound with final data
        currentRound = { ...roundData, ...finalUpdateData }; // Merge update data into the lean object

        console.log(`Round ${roundData.roundId} completed. Winner: ${winner.username} (Ticket: ${winningTicket}/${totalTickets}, Value: $${finalTotalValue.toFixed(2)})`);

        // Emit winner information (including post-tax value)
        io.emit('roundWinner', {
            roundId: roundData.roundId,
            winner: { // Send relevant winner details
                id: winner._id,
                steamId: winner.steamId,
                username: winner.username,
                avatar: winner.avatar
            },
            winningTicket: winningTicket,
            totalValue: finalTotalValue, // Send post-tax value
            totalTickets: totalTickets,
            serverSeed: roundData.serverSeed, // Reveal server seed
            clientSeed: clientSeed,
            provableHash: provableHash,
            serverSeedHash: roundData.serverSeedHash // Keep sending hash too
        });

        // --- Initiate Payout ---
        // Pass the winner user object (lean) and the filtered finalItems array (lean)
        await sendWinningTradeOffer(roundData, winner, finalItems);

    } catch (err) {
        console.error(`CRITICAL ERROR during endRound for round ${roundIdToEnd}:`, err);
        try {
             // Attempt to mark the round as 'error' in DB
            await Round.updateOne({ _id: roundMongoId }, { $set: { status: 'error' } });
            io.emit('roundError', { roundId: roundIdToEnd, error: 'Internal server error during round finalization.' });
        } catch (saveErr) {
             console.error(`Failed to mark round ${roundIdToEnd} as error after initial error:`, saveErr);
        }
    } finally {
        isRolling = false; // Reset rolling flag
        console.log(`Scheduling next round creation after round ${roundIdToEnd} finalization.`);
        setTimeout(createNewRound, 10000); // Schedule next round (e.g., 10s after completion/error)
    }
}

/**
 * Sends the winning trade offer to the winner.
 * @param {object} round - The completed Round object (lean).
 * @param {object} winner - The User object for the winner (lean).
 * @param {Array} itemsToSend - Array of Item objects (lean) to send (after tax).
 */
async function sendWinningTradeOffer(round, winner, itemsToSend) {
    // Critical Check: Ensure bot is ready before attempting to send
    if (!isBotReady) {
        console.error(`PAYOUT_ERROR: Cannot send winnings for round ${round.roundId}: Steam Bot is not ready.`);
        // Notify admin/support system here
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: `Bot Error: Payout for round ${round.roundId} requires manual processing. Please contact support.` });
        return;
    }
    if (!winner.tradeUrl) {
        console.error(`PAYOUT_ERROR: Cannot send winnings for round ${round.roundId}: Winner ${winner.username} has no Trade URL set.`);
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Please set your Trade URL in your profile to receive winnings.' });
        return;
    }
    if (!itemsToSend || itemsToSend.length === 0) {
        console.log(`PAYOUT_INFO: No items to send for round ${round.roundId} (possibly all taxed or error).`);
        if (round.taxAmount > 0 && round.totalValue <= 0) { // If tax took everything
             io.emit('notification', { type: 'info', userId: winner._id.toString(), message: `Round ${round.roundId} winnings ($${round.taxAmount.toFixed(2)}) were processed as site tax.` });
        }
        return;
    }

    console.log(`Attempting to send ${itemsToSend.length} winning items for round ${round.roundId} to ${winner.username}...`);

    try {
        const offer = manager.createOffer(winner.tradeUrl);
        offer.addMyItems(itemsToSend.map(item => ({
            assetid: item.assetId,
            appid: RUST_APP_ID,
            contextid: RUST_CONTEXT_ID
        })));
        offer.setMessage(`Congratulations! Your winnings from Round #${round.roundId} on ${process.env.SITE_NAME || 'RustyDegen'}. Pot Value (after tax): $${round.totalValue.toFixed(2)}`);

        const status = await new Promise((resolve, reject) => {
            offer.send((err, status) => {
                if (err) {
                    // Handle specific errors like invalid trade URL token
                    if (err.message?.includes('revoked') || err.message?.includes('invalid') || err.eresult === 26) { // EResult 26 is often invalid token
                        console.error(`PAYOUT_ERROR: Trade offer failed for round ${round.roundId}: Invalid Trade URL/Token for ${winner.username}. Offer ID: ${offer.id}`);
                        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Your Trade URL is invalid or expired. Please update it to receive winnings.' });
                    } else if (err.eresult === 15 || err.eresult === 16) { // EResult 15/16 often inventory full/private
                         console.error(`PAYOUT_ERROR: Trade offer failed for round ${round.roundId}: Winner's inventory might be full or private. Offer ID: ${offer.id}`);
                         io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Could not send winnings. Ensure your Steam inventory is public and not full.' });
                    } else {
                        console.error(`PAYOUT_ERROR: Error sending trade offer ${offer.id} for round ${round.roundId}: EResult ${err.eresult} - ${err.message}`);
                    }
                    // TODO: Implement retry logic or manual intervention queue for failed payouts
                    return reject(err); // Reject the promise on error
                }
                resolve(status); // Resolve with the status on success
            });
        });

        console.log(`PAYOUT_SUCCESS: Trade offer ${offer.id} sent to ${winner.username} for round ${round.roundId}. Status: ${status}`);
        // Notify client about the sent offer
        io.emit('tradeOfferSent', {
            roundId: round.roundId,
            userId: winner._id.toString(),
            username: winner.username,
            offerId: offer.id,
            status: status // Include status if available/useful
        });

    } catch (err) {
        // Error already logged in the offer.send callback for specific cases
        // General catch for other potential errors during offer creation/sending
        console.error(`PAYOUT_ERROR: Unexpected error creating/sending trade offer for round ${round.roundId}:`, err);
        // TODO: Notify admin/support
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: `Error sending winnings for round ${round.roundId}. Please contact support.` });
    }
}


// --- Authentication Routes ---
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));
app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect home.
        res.redirect('/');
    });
// Logout Route
app.post('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        req.session.destroy(err => {
            if (err) {
                console.error("Error destroying session during logout:", err);
                return res.status(500).json({ error: 'Logout failed.' });
            }
            res.clearCookie('connect.sid'); // Use the default session cookie name
            res.json({ success: true });
        });
    });
});


// --- Middleware & API Routes ---
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.status(401).json({ error: 'Not authenticated' });
}

// GET User Profile
app.get('/api/user', ensureAuthenticated, (req, res) => {
    // Return only necessary, non-sensitive user data from the request object (populated by deserializeUser)
    const { _id, steamId, username, avatar, tradeUrl, balance, createdAt } = req.user;
    res.json({ _id, steamId, username, avatar, tradeUrl, balance, createdAt });
});


// POST Update Trade URL
app.post('/api/user/tradeurl', ensureAuthenticated, async (req, res) => {
    const { tradeUrl } = req.body;

    // Basic validation
    if (!tradeUrl || typeof tradeUrl !== 'string') {
        return res.status(400).json({ error: 'Invalid Trade URL provided.' });
    }
    // Improved validation
    try {
        const url = new URL(tradeUrl);
        if (!url.protocol.startsWith('https') || url.hostname !== 'steamcommunity.com' || !url.pathname.includes('/tradeoffer/new/')) {
             throw new Error('Invalid URL structure.');
        }
        if (!url.searchParams.get('partner') || !url.searchParams.get('token')) {
            throw new Error('Trade URL must include partner and token parameters.');
        }
    } catch (e) {
        return res.status(400).json({ error: e.message || 'Invalid Trade URL format.' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id, // Use user ID from authenticated request
            { tradeUrl: tradeUrl },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(`Trade URL updated for user: ${updatedUser.username}`);
        res.json({ success: true, tradeUrl: updatedUser.tradeUrl });
    } catch (err) {
        console.error(`Error updating trade URL for user ${req.user._id}:`, err);
        res.status(500).json({ error: 'Server error saving Trade URL.' });
    }
});

// GET User Inventory
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
    // Check bot readiness before attempting inventory fetch
    if (!isBotReady) {
        console.warn(`Inventory fetch failed for ${req.user.username}: Bot service is unavailable.`);
        return res.status(503).json({ error: "Steam service temporarily unavailable. Please try again later." });
    }

    try {
        // Use manager.getUserInventoryContents for potentially better reliability
        const inventory = await new Promise((resolve, reject) => {
            manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                if (err) {
                    // Handle common errors more gracefully
                    if (err.message?.includes('profile is private') || err.eresult === 15) {
                         return reject(new Error('Your Steam inventory is private. Please set it to public.'));
                    }
                    console.error(`Inventory Fetch Error (Manager): User ${req.user.steamId}: EResult ${err.eresult} - ${err.message || err}`);
                    return reject(new Error(`Could not fetch inventory. Steam might be busy or inventory private.`));
                }
                resolve(inv || []); // Resolve with empty array if null/undefined
            });
        });

        if (!inventory?.length) return res.json([]); // Return empty array if inventory is empty

        // Process items: get prices (sync using cache), format data
        const validItems = inventory // Renamed for clarity
            .map(item => {
                const itemName = item.market_hash_name;
                let price = 0;
                if (itemName) {
                    price = getItemPrice(itemName); // Reads cache/fallback synchronously
                } else {
                    // console.warn(`Inventory item missing market_hash_name: assetId ${item.assetid}`); // Less verbose
                }
                // Ensure price is a number, default to 0 if not
                const finalPrice = (typeof price === 'number' && !isNaN(price)) ? price : 0;

                return {
                    assetId: item.assetid, // Ensure assetId is included
                    name: itemName || 'Unknown Item', // Use market_hash_name preferentially
                    displayName: item.name, // Original name from Steam
                    image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`, // Use Steam CDN URL
                    price: finalPrice,
                    tradable: item.tradable, // Include tradable status
                    marketable: item.marketable // Include marketable status
                };
            })
            // Filter AFTER mapping prices
            .filter(item => item.tradable && item.price >= MIN_ITEM_VALUE);

        res.json(validItems);

    } catch (err) {
        console.error(`Error in /api/inventory for ${req.user?.username || req.user?.steamId}:`, err.message);
        // Send back the specific error message if available and reasonable
        res.status(500).json({ error: err.message || 'Server error fetching inventory.' });
    }
});


// POST Initiate Deposit Request (Client gets token and bot URL)
app.post('/api/deposit/initiate', ensureAuthenticated, async (req, res) => { // Added async
    if (!isBotReady || !process.env.BOT_TRADE_URL) {
        console.warn(`Deposit initiation failed for ${req.user.username}: Bot service is unavailable.`);
        return res.status(503).json({ error: "Deposit service is temporarily unavailable. Please try again later." });
    }

    // Fetch latest round data directly for checks
    const latestRoundDataForCheck = currentRound?._id ? await Round.findById(currentRound._id).select('status participants items').lean() : null;

    if (!latestRoundDataForCheck || latestRoundDataForCheck.status !== 'active' || isRolling) {
        // console.warn(`Deposit initiation rejected for ${req.user.username}: Round not active (Status: ${latestRoundDataForCheck?.status}, Rolling: ${isRolling})`); // Less verbose
        return res.status(400).json({ error: 'Deposits are currently closed for this round.' });
    }
    // Double check limits server-side before issuing token
    if (latestRoundDataForCheck.participants?.length >= MAX_PARTICIPANTS) {
        return res.status(400).json({ error: `Participant limit (${MAX_PARTICIPANTS}) reached.` });
    }
    if (latestRoundDataForCheck.items?.length >= MAX_ITEMS_PER_POT) {
        return res.status(400).json({ error: `Pot item limit (${MAX_ITEMS_PER_POT}) reached.` });
    }

    // Generate a unique, short-lived token for the trade offer message
    const token = generateDepositToken(req.user._id);
    res.json({
        success: true,
        depositToken: token,
        botTradeUrl: process.env.BOT_TRADE_URL // Send the bot's trade URL to the client
    });
});


// --- Trade Offer Manager Event Handling ---
if (isBotConfigured && manager) { // Ensure manager is initialized
    manager.on('newOffer', async (offer) => {
        if (!isBotReady) return; // Ignore offers if bot isn't fully ready

        // Ignore offers sent *by* the bot, or empty offers, or offers without a message (token)
        if (offer.isOurOffer || offer.itemsToReceive.length === 0 || !offer.message) {
            return;
        }

        console.log(`Received new trade offer #${offer.id} from ${offer.partner.getSteamID64()}. Message: "${offer.message}"`);

        // 1. Check Round Status & Limits *before* verifying token
        // Fetch latest participant count directly from DB for better accuracy in checks
        const latestRoundDataForCheck = currentRound?._id ? await Round.findById(currentRound._id).select('status participants items').lean() : null;

        if (!latestRoundDataForCheck || latestRoundDataForCheck.status !== 'active' || isRolling) {
            // console.log(`Offer #${offer.id}: Declining - Deposits closed (Status: ${latestRoundDataForCheck?.status}, Rolling: ${isRolling})`); // Less verbose
            return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (round closed):`, e));
        }

        if (latestRoundDataForCheck.participants?.length >= MAX_PARTICIPANTS) {
             console.log(`Offer #${offer.id}: Declining - Participant limit reached (${latestRoundDataForCheck.participants.length}/${MAX_PARTICIPANTS}).`);
             return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (participants full):`, e));
        }
        if (latestRoundDataForCheck.items?.length >= MAX_ITEMS_PER_POT) {
             console.log(`Offer #${offer.id}: Declining - Pot item limit reached (${latestRoundDataForCheck.items.length}/${MAX_ITEMS_PER_POT}).`);
             return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (items full):`, e));
        }


        // 2. Verify Deposit Token
        const token = offer.message.trim();
        let user; // Will store the user object if token is valid
        try {
            user = await verifyDepositToken(token, offer.partner.getSteamID64());
            if (!user) {
                // console.log(`Offer #${offer.id}: Declining - Invalid or expired deposit token.`); // Less verbose
                return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (invalid token):`, e));
            }
        } catch (vErr) { // Catch errors during DB lookup in verifyDepositToken
            console.error(`Offer #${offer.id}: Error verifying deposit token:`, vErr);
            return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (token verify error):`, e));
        }

        // Re-check participant limit specifically for NEW participants joining (using latest fetched data)
        const isNewParticipant = !latestRoundDataForCheck.participants?.some(p => p.user?.toString() === user._id.toString());
        if (isNewParticipant && latestRoundDataForCheck.participants?.length >= MAX_PARTICIPANTS) {
             console.log(`Offer #${offer.id}: Declining - Participant limit reached just before processing new participant ${user.username}.`);
             return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (participants full - race condition):`, e));
        }


        // 3. Process Items and Calculate Value
        try {
            const itemsToProcess = offer.itemsToReceive
                .map(item => {
                    // Basic check for necessary properties
                    if (!item.market_hash_name || !item.assetid || !item.icon_url) {
                        console.warn(`Offer #${offer.id}: Item asset ${item.assetid} missing required properties (name/icon). Skipping.`);
                        return null;
                    }
                    const price = getItemPrice(item.market_hash_name); // Get price from cache/fallback
                    // Check if item meets minimum value threshold
                    if (price < MIN_ITEM_VALUE) {
                        // console.log(`Offer #${offer.id}: Item '${item.market_hash_name}' ($${price.toFixed(2)}) value below minimum ($${MIN_ITEM_VALUE}). Skipping.`); // Less verbose
                        return null;
                    }
                    return {
                        assetId: item.assetid,
                        name: item.market_hash_name,
                        image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                        price: price,
                        owner: user._id, // Store user's MongoDB ID
                        roundId: currentRound._id // Link item to the current round
                    };
                })
                .filter(i => i !== null); // Remove skipped items

            const depositTotalValue = itemsToProcess.reduce((sum, item) => sum + item.price, 0);

            if (itemsToProcess.length === 0) {
                // console.log(`Offer #${offer.id}: Declining - No items met the minimum value requirement.`); // Less verbose
                return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (no valid items):`, e));
            }

            // Final check: Ensure adding these items doesn't exceed pot limit (using latest fetched data)
            if (latestRoundDataForCheck.items?.length + itemsToProcess.length > MAX_ITEMS_PER_POT) {
                console.log(`Offer #${offer.id}: Declining - Deposit would exceed pot item limit (${latestRoundDataForCheck.items.length} + ${itemsToProcess.length} > ${MAX_ITEMS_PER_POT}).`);
                return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (items full - race condition):`, e));
            }

            // 4. Accept the Offer
            offer.accept(async (err, status) => {
                if (err) {
                    console.error(`Offer #${offer.id}: Error accepting trade: EResult ${err.eresult} - ${err.message || err}`);
                    // Handle specific errors like escrow
                    if (err.message?.includes('escrow') || err.eresult === 11) { // EResult 11 is often escrow
                        console.warn(`Offer #${offer.id} may be held in escrow. Deposit likely failed.`);
                        // Notify user about escrow issue
                         io.emit('notification', { type: 'warning', userId: user._id.toString(), message: `Your deposit (Offer #${offer.id}) might be held in escrow by Steam. Please ensure Steam Guard Mobile Authenticator has been active for 7 days.` });
                    }
                    return; // Stop processing if accept fails
                }

                console.log(`Offer #${offer.id} accepted successfully. Status: ${status}. Updating database...`);

                // --- 5. Update Database (CRITICAL SECTION) ---
                // Use findOneAndUpdate for atomic update to mitigate race conditions
                try {
                    // Prepare update operations
                    const itemDocuments = itemsToProcess.map(item => new Item(item)); // Create Item documents in memory
                    await Item.insertMany(itemDocuments); // Save items first
                    const createdItemIds = itemDocuments.map(doc => doc._id);
                    const depositTickets = Math.max(1, Math.floor(depositTotalValue / TICKET_VALUE_RATIO));

                    // Find the participant index or prepare new participant data
                    const participantUpdate = {
                        $inc: { // Use $inc for atomic increments
                            totalValue: depositTotalValue,
                            'participants.$.itemsValue': depositTotalValue,
                            'participants.$.tickets': depositTickets
                        },
                        $push: { items: { $each: createdItemIds } } // Push new item IDs
                    };
                    const participantFilter = { _id: currentRound._id, status: 'active', 'participants.user': user._id }; // Match round, status, and existing participant

                    // Attempt to update existing participant
                    const updateResult = await Round.updateOne(participantFilter, participantUpdate);

                    let latestRoundData; // Use a different var name
                    if (updateResult.matchedCount === 0) { // Check matchedCount, modifiedCount might be 0 if values didn't change
                        // Participant not found or round status changed, try adding as new participant
                         const newParticipantData = {
                             user: user._id,
                             itemsValue: depositTotalValue,
                             tickets: depositTickets
                         };
                         const addParticipantUpdate = {
                             $inc: { totalValue: depositTotalValue },
                             $push: {
                                 items: { $each: createdItemIds },
                                 participants: newParticipantData
                             }
                         };
                         // Add condition to ensure round is still active and participant doesn't exist
                         const addResult = await Round.updateOne(
                             { _id: currentRound._id, status: 'active', 'participants.user': { $ne: user._id } },
                             addParticipantUpdate
                         );

                         if (addResult.modifiedCount === 0) {
                             // CRITICAL: Round status changed *during* DB update attempts or participant was added concurrently.
                             // Check if the participant *now* exists, maybe the update failed but add worked in another process?
                             const checkAgain = await Round.findOne({_id: currentRound._id, 'participants.user': user._id});
                             if(!checkAgain) {
                                throw new Error(`DB update failed after accepting offer ${offer.id}. Participant could not be updated or added.`);
                             }
                             console.warn(`Offer ${offer.id}: Update failed, but participant was likely added concurrently.`);
                         }
                         // Fetch the round again after adding participant
                         latestRoundData = await Round.findById(currentRound._id).populate('participants.user', 'steamId username avatar').lean();

                    } else {
                         // Fetch the round again after updating existing participant
                         latestRoundData = await Round.findById(currentRound._id).populate('participants.user', 'steamId username avatar').lean();
                    }


                    if (!latestRoundData) {
                        // Should not happen if update succeeded, but handle defensively
                        throw new Error(`Failed to fetch updated round data after deposit for offer ${offer.id}.`);
                    }
                    currentRound = latestRoundData; // Update the global state (plain object)


                    // 6. Emit update to clients
                    const updatedParticipantData = latestRoundData.participants.find(p => p.user?._id.toString() === user._id.toString());
                    io.emit('participantUpdated', {
                        roundId: latestRoundData.roundId,
                        userId: user._id.toString(), // Send MongoDB ID
                        username: user.username,
                        avatar: user.avatar,
                        itemsValue: depositTotalValue, // Send value of *this* deposit
                        tickets: updatedParticipantData?.tickets || 0,     // Send CUMULATIVE tickets
                        totalValue: latestRoundData.totalValue,            // Send new round total value
                        depositedItems: itemsToProcess.map(i => ({ // Send details of *this* deposit
                            assetId: i.assetId, name: i.name, image: i.image, price: i.price
                        }))
                    });


                    // Start timer if this was the first participant (check latestRound)
                    if (latestRoundData.participants.length === 1 && !roundTimer) { // Check roundTimer flag too
                        console.log(`First participant (${user.username}) joined round ${latestRoundData.roundId}. Starting timer.`);
                        // timerActive flag is not reliable server-side, rely on roundTimer interval ID
                        startRoundTimer();
                    }

                    console.log(`Deposit success for offer #${offer.id}. User: ${user.username}, Value: $${depositTotalValue.toFixed(2)}, Items: ${itemsToProcess.length}`);

                } catch (dbErr) {
                    // CRITICAL: Error saving to DB after accepting trade. Items are in bot inventory.
                    console.error(`CRITICAL DATABASE ERROR after accepting offer ${offer.id}:`, dbErr);
                    // Attempt to mark round as error? Or just log for manual fix.
                    if (currentRound) { // Try to mark round as errored
                        await Round.updateOne({ _id: currentRound._id }, { $set: { status: 'error' } })
                            .catch(e => console.error("Failed to set round status to error:", e));
                        io.emit('roundError', { roundId: currentRound.roundId, error: 'Critical deposit database error.' });
                    }
                    // TODO: System to handle items stuck in bot inventory (e.g., flag for admin).
                    io.emit('notification', { type: 'error', userId: user._id.toString(), message: `Deposit Error: Database issue after accepting offer #${offer.id}. Please contact support.` });
                }
            }); // End offer.accept callback

        } catch (procErr) {
            console.error(`Offer #${offer.id}: Error processing items/value:`, procErr);
            offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (item processing error):`, e));
        }
    }); // End manager.on('newOffer')

    manager.on('sentOfferChanged', (offer, oldState) => {
        // Only log significant changes
        if (offer.state !== oldState) {
             console.log(`Payout Offer #${offer.id} state changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);
        }
        // TODO: Add logic here if needed (e.g., logging successful payouts, handling declines/failures)
        if (offer.state === TradeOfferManager.ETradeOfferState.Accepted) {
             console.log(`Payout offer #${offer.id} accepted by recipient.`);
             // Optional: Mark round payout as fully complete if needed
        } else if (
             offer.state === TradeOfferManager.ETradeOfferState.Declined ||
             offer.state === TradeOfferManager.ETradeOfferState.Canceled ||
             offer.state === TradeOfferManager.ETradeOfferState.Expired ||
             offer.state === TradeOfferManager.ETradeOfferState.InvalidItems ||
             offer.state === TradeOfferManager.ETradeOfferState.Countered // Added Countered
             ) {
             console.warn(`Payout offer #${offer.id} failed or was not accepted. State: ${TradeOfferManager.ETradeOfferState[offer.state]}. Items likely returned to bot inventory.`);
             // TODO: Notify user/admin, potentially retry or credit balance. Flag for manual intervention.
             // Find the winner associated with this offer if possible (might need to store offer details with round)
             // Example: Find round by searching offer message, then emit notification
             // const roundIdMatch = offer.message?.match(/Round #(\d+)/);
             // if(roundIdMatch && roundIdMatch[1]) {
             //    const round = await Round.findOne({ roundId: parseInt(roundIdMatch[1]) }).populate('winner').lean();
             //    if(round?.winner?._id) {
             //       io.emit('notification', { type: 'error', userId: round.winner._id.toString(), message: `Payout Error: Failed to deliver winnings for round ${round.roundId} (Offer #${offer.id}). State: ${TradeOfferManager.ETradeOfferState[offer.state]}. Please contact support.` });
             //    }
             // }
        }
    });

} // End if (isBotConfigured && manager)


// --- Round Info API Routes ---
// Helper function to format round data for client
function formatRoundForClient(round) {
    if (!round) return null;

    // If it's a Mongoose document, convert to plain object first
    const roundObj = typeof round.toObject === 'function' ? round.toObject() : round;

    const timeLeft = (roundObj.status === 'active' && roundObj.endTime)
        ? Math.max(0, Math.floor((new Date(roundObj.endTime).getTime() - Date.now()) / 1000))
        : (roundObj.timeLeft !== undefined ? roundObj.timeLeft : 0); // Use local timeLeft if available

    const participantsFormatted = (roundObj.participants || []).map(p => ({
        user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null,
        itemsValue: p.itemsValue || 0,
        tickets: p.tickets || 0
    })).filter(p => p.user);

    const itemsFormatted = (roundObj.items || []).map(i => ({
        // Use _id if it's populated, otherwise just the ID if it's only an ObjectId
        id: i._id || i,
        name: i.name || 'Unknown Item',
        image: i.image || '/img/default-item.png',
        price: i.price || 0,
        owner: i.owner?._id || i.owner // Send owner ID
    }));

    // Populate winner details if available and populated
    let winnerDetails = null;
    if (roundObj.status === 'completed' && roundObj.winner) {
        // Check if winner is populated (has username property) or just an ID
        if (typeof roundObj.winner === 'object' && roundObj.winner.username) {
             winnerDetails = {
                 id: roundObj.winner._id,
                 steamId: roundObj.winner.steamId,
                 username: roundObj.winner.username,
                 avatar: roundObj.winner.avatar
             };
        } else if (roundObj.winner) { // If winner is just an ID
             winnerDetails = { id: roundObj.winner };
        }
    }


    return {
        roundId: roundObj.roundId,
        _id: roundObj._id, // Send mongo ID too
        status: roundObj.status,
        startTime: roundObj.startTime,
        endTime: roundObj.endTime,
        timeLeft: timeLeft,
        totalValue: roundObj.totalValue || 0,
        serverSeedHash: roundObj.serverSeedHash,
        participants: participantsFormatted,
        items: itemsFormatted,
        // Conditionally include completed round data
        winner: winnerDetails, // Send populated winner details or ID
        winningTicket: roundObj.status === 'completed' ? roundObj.winningTicket : undefined, // Use undefined for cleaner JSON
        serverSeed: roundObj.status === 'completed' ? roundObj.serverSeed : undefined,
        clientSeed: roundObj.status === 'completed' ? roundObj.clientSeed : undefined,
        provableHash: roundObj.status === 'completed' ? roundObj.provableHash : undefined,
        taxAmount: roundObj.taxAmount
    };
}


app.get('/api/round/current', async (req, res) => {
    let roundToFormat = null;
    try {
        if (currentRound?._id) {
            // Fetch fresh data for the current round ID in memory
             roundToFormat = await Round.findById(currentRound._id)
                .populate('participants.user', 'steamId username avatar')
                .populate('items') // Populate full item details
                .populate('winner', 'steamId username avatar') // Populate winner details
                .lean(); // Use lean()
            if (roundToFormat) {
                 currentRound = roundToFormat; // Update in-memory version (now a plain object)
            }
        }
        // Fallback: If no round in memory or fetch failed, check DB for any active round
        if (!roundToFormat) {
            roundToFormat = await Round.findOne({ status: 'active' })
                .populate('participants.user', 'steamId username avatar')
                .populate('items')
                .populate('winner', 'steamId username avatar')
                .lean(); // Use lean()
            if (roundToFormat && !currentRound) { // Restore to memory if found and memory is empty
                currentRound = roundToFormat; // Assign the plain object
                console.log(`Restored active round ${currentRound.roundId} from DB via API.`);
                if (currentRound.participants?.length > 0 && currentRound.endTime && new Date(currentRound.endTime) > Date.now()) {
                    startRoundTimer(true); // Resume timer if needed
                }
            }
        }

        const formattedData = formatRoundForClient(roundToFormat); // Format the plain object

        if (formattedData) {
            res.json(formattedData);
        } else {
            res.status(404).json({ error: 'No active round found.' });
        }
    } catch (err) {
        console.error('Error fetching/formatting current round data:', err);
        res.status(500).json({ error: 'Server error retrieving round details.' });
    }
});

app.get('/api/rounds', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default 10 per page
        const skip = (page - 1) * limit;

        const query = { status: { $in: ['completed', 'error'] } }; // Find completed or errored rounds

        // Execute queries in parallel
        const [rounds, totalCount] = await Promise.all([
            Round.find(query)
                .sort('-roundId') // Sort by roundId descending (newest first)
                .skip(skip)
                .limit(limit)
                .populate('winner', 'username avatar steamId') // Populate winner info
                // Select only necessary fields for the history view
                .select('roundId startTime endTime completedTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket provableHash status taxAmount')
                .lean(), // Use lean for performance
            Round.countDocuments(query)
        ]);

        res.json({
            rounds: rounds, // Already plain objects
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            totalRounds: totalCount
        });
    } catch (err) {
        console.error('Error fetching past rounds:', err);
        res.status(500).json({ error: 'Server error fetching round history.' });
    }
});

app.post('/api/verify', async (req, res) => {
    const { roundId, serverSeed, clientSeed } = req.body;
    if (!roundId || !serverSeed || !clientSeed) {
        return res.status(400).json({ error: 'Missing required fields (roundId, serverSeed, clientSeed).' });
    }
    // Add basic format validation
    if (typeof serverSeed !== 'string' || serverSeed.length !== 64 || !/^[a-f0-9]{64}$/i.test(serverSeed)) {
         return res.status(400).json({ error: 'Invalid Server Seed format.' });
    }
     if (typeof clientSeed !== 'string' || clientSeed.length === 0) {
         return res.status(400).json({ error: 'Invalid Client Seed format.' });
     }


    try {
        const round = await Round.findOne({ roundId: roundId, status: 'completed' })
            .populate('participants.user', 'username') // Need participants for ticket calculation
            .populate('winner', 'username')
            .lean(); // Use lean

        if (!round) {
            return res.status(404).json({ error: `Completed round #${roundId} not found.` });
        }

        // 1. Verify Server Seed Hash
        const providedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        if (providedHash !== round.serverSeedHash) {
            return res.json({
                verified: false,
                reason: 'Server Seed Hash mismatch.',
                serverSeedHash: round.serverSeedHash // Show expected hash
            });
        }

        // 2. Verify Seeds Match Record
        if (serverSeed !== round.serverSeed || clientSeed !== round.clientSeed) {
            return res.json({
                verified: false,
                reason: 'Provided seeds do not match the official round seeds.',
                serverSeed: round.serverSeed, // Show expected seeds
                clientSeed: round.clientSeed
            });
        }


        // 3. Recalculate Winning Ticket
        const combinedString = serverSeed + clientSeed;
        const calculatedProvableHash = crypto.createHash('sha256').update(combinedString).digest('hex');
        const decimalFromHash = parseInt(calculatedProvableHash.substring(0, 8), 16);
        const totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0;

        if (totalTickets <= 0) {
            return res.json({ verified: false, reason: 'Round had zero total tickets.' });
        }

        const calculatedWinningTicket = decimalFromHash % totalTickets;

        // 4. Compare Calculated vs Actual Ticket
        if (calculatedWinningTicket !== round.winningTicket) {
            return res.json({
                verified: false,
                reason: 'Calculated winning ticket does not match the recorded winning ticket.',
                calculatedTicket: calculatedWinningTicket,
                actualWinningTicket: round.winningTicket,
                provableHash: calculatedProvableHash, // Show hash used for calculation
                totalTickets: totalTickets
            });
        }

        // If all checks pass
        res.json({
            verified: true,
            roundId: round.roundId,
            serverSeed: serverSeed,
            serverSeedHash: round.serverSeedHash,
            clientSeed: clientSeed,
            combinedString: combinedString, // Show combined string
            finalHash: calculatedProvableHash, // Show calculated hash
            winningTicket: calculatedWinningTicket,
            totalTickets: totalTickets,
            totalValue: round.totalValue, // Post-tax value
            winnerUsername: round.winner?.username || 'N/A'
        });

    } catch (err) {
        console.error(`Error verifying round ${roundId}:`, err);
        res.status(500).json({ error: 'Server error during verification.' });
    }
});


// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
    // console.log(`Client connected: ${socket.id}`); // Less verbose

    // Send current round data on connection request
    socket.on('requestRoundData', async () => { // Listen for explicit request
        try {
            let roundToSend = null;
            if (currentRound?._id) {
                // Fetch fresh data for the current round ID in memory using lean()
                 roundToSend = await Round.findById(currentRound._id)
                    .populate('participants.user', 'steamId username avatar')
                    .populate('items') // Populate full item details
                    .populate('winner', 'steamId username avatar') // Populate winner details
                    .lean();
                if (roundToSend) {
                    currentRound = roundToSend; // Update in-memory version (plain object)
                }
            }
            // Fallback: If no round in memory or fetch failed, check DB for any active round
            if (!roundToSend) {
                roundToSend = await Round.findOne({ status: 'active' })
                    .populate('participants.user', 'steamId username avatar')
                    .populate('items')
                    .populate('winner', 'steamId username avatar')
                    .lean();
                if (roundToSend && !currentRound) { // Restore to memory if found and memory is empty
                    currentRound = roundToSend; // Assign plain object
                    console.log(`Restored active round ${currentRound.roundId} from DB on client request.`);
                    if (currentRound.participants?.length > 0 && currentRound.endTime && new Date(currentRound.endTime) > Date.now()) {
                         startRoundTimer(true); // Resume timer if needed
                    }
                }
            }

            const formattedData = formatRoundForClient(roundToSend); // Format the plain object

            if (formattedData) {
                socket.emit('roundData', formattedData);
            } else {
                socket.emit('noActiveRound'); // Tell client no round is active
            }
        } catch (err) {
            console.error(`Error fetching round data for socket ${socket.id}:`, err);
            socket.emit('roundError', { error: 'Failed to load round data.' });
        }
    }); // End 'requestRoundData' listener


    socket.on('disconnect', (reason) => {
        // console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`); // Less verbose
    });
});

// Add a catch-all route for SPA (Single Page Application) support
// This ensures that refreshing the page on client-side routes (/about, /faq)
// still serves the index.html file, letting the frontend router handle it.
// Place this AFTER all API routes but BEFORE the error handler.
app.get('*', (req, res) => {
    // Check if the request looks like an API call or a static file request
    if (req.originalUrl.startsWith('/api/') || req.originalUrl.includes('.')) {
        // If it looks like an API call not handled above, or a file request,
        // let the 404 handler (or existing static file handler) take care of it.
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html')); // Optional: send a 404 page
        // Or just call next() to let Express handle the 404
        // next();
    }
    // Otherwise, serve the main index.html file for SPA routing
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Server Startup ---
async function startApp() {
    console.log("Performing initial price cache refresh from rust.scmm.app...");
    await refreshPriceCache(); // Wait for the first refresh attempt

    // Schedule periodic cache refresh AFTER the first one is done
    // Wrap in try...catch to prevent interval crashing the app
    setInterval(async () => {
         try {
              await refreshPriceCache();
         } catch (refreshErr) {
               console.error("Error during scheduled price cache refresh:", refreshErr);
               // Continue running, rely on existing cache/fallbacks
         }
    }, PRICE_REFRESH_INTERVAL_MS);
    console.log(`Scheduled price cache refresh every ${PRICE_REFRESH_INTERVAL_MS / 60000} minutes.`);

    // Start HTTP server AFTER initial cache attempt
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Site URL configured as: ${process.env.SITE_URL}`);

        // Bot status check (Initial round creation moved to login callback/ensureInitialRound)
        if (!isBotConfigured) { console.log("INFO: Steam Bot not configured. Trade features disabled."); }
        else if (!isBotReady) { console.log("INFO: Waiting for Steam Bot login attempt..."); }
        else { console.log("INFO: Steam Bot is ready."); } // If already ready at listen time

        // Test Pricing API on startup (optional, can be removed)
        /*
        setTimeout(async () => {
           console.log("Testing Pricing API on startup (uses cache/fallback)...");
           const testItem1 = "Assault Rifle";
           const testItem2 = "NonExistentItem123";
           try {
                 const price1 = getItemPrice(testItem1);
                 console.log(`TEST: Price for '${testItem1}': ${price1 !== undefined ? `$${price1.toFixed(2)}` : 'Error/Not Found'}`);
                 const price2 = getItemPrice(testItem2); // Should trigger fallback
                 console.log(`TEST: Price for '${testItem2}': ${price2 !== undefined ? `$${price2.toFixed(2)}` : 'Error/Not Found'}`);
           } catch(e) { console.error("Error testing price API:", e); }
        }, 2000);
        */
    });
}

startApp(); // Call the async startup function

// --- Graceful Shutdown ---
function gracefulShutdown() {
    console.log('Received shutdown signal. Closing server...');
    io.close(); // Close socket connections
    server.close(async () => { // Make callback async
        console.log('HTTP server closed.');
        try {
            await mongoose.connection.close(); // Use await for cleaner closing
            console.log('MongoDB connection closed.');
            process.exit(0); // Exit cleanly
        } catch (e) {
            console.error("Error closing MongoDB connection:", e);
            process.exit(1); // Exit with error on DB close failure
        }
    });

    // Force shutdown after a timeout
    setTimeout(() => {
        console.error('Could not close connections gracefully, forcing shutdown.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown); // Handle Ctrl+C

// Basic Error Handling Middleware (Place LAST, after SPA catch-all)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : (err.message || 'Unknown server error.');
    // Avoid sending sensitive error details in production
    res.status(status).json({ error: message });
});

console.log("app.js loaded.");
