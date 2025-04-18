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
require('dotenv').config();

// --- Configuration Constants ---
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
const TAX_MIN_PERCENT = 5;
const TAX_MAX_PERCENT = 10;
const MIN_POT_FOR_TAX = 100; // Pot must be at least $100 for tax

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: process.env.SITE_URL || "*", methods: ["GET", "POST"] } });

// Configure middleware
app.use(cors({ origin: process.env.SITE_URL || "*", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files like main.js, CSS
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // 1 hour session cookie
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Steam Strategy ---
if (!process.env.SITE_URL || !process.env.STEAM_API_KEY || !process.env.SESSION_SECRET) {
    console.error("FATAL: Missing required Steam Authentication environment variables (SITE_URL, STEAM_API_KEY, SESSION_SECRET).");
    process.exit(1);
}
passport.use(new SteamStrategy({
    returnURL: `${process.env.SITE_URL}/auth/steam/return`,
    realm: process.env.SITE_URL,
    apiKey: process.env.STEAM_API_KEY,
    providerURL: 'https://steamcommunity.com/openid' // Correct OpenID endpoint
},
    async (identifier, profile, done) => {
        try {
            let user = await User.findOne({ steamId: profile.id });
            if (!user) {
                console.log(`Creating new user: ${profile.displayName} (ID: ${profile.id})`);
                user = await new User({
                    steamId: profile.id,
                    username: profile.displayName,
                    avatar: profile._json.avatarfull || '', // Use full avatar URL
                    tradeUrl: ''
                }).save();
            } else {
                // Update username/avatar if changed
                let needsUpdate = false;
                if (user.username !== profile.displayName) {
                    user.username = profile.displayName;
                    needsUpdate = true;
                }
                if (profile._json.avatarfull && user.avatar !== profile._json.avatarfull) {
                    user.avatar = profile._json.avatarfull;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    await user.save();
                    console.log(`Updated user info for: ${user.username}`);
                }
            }
            return done(null, user); // Pass user object to serializeUser
        } catch (err) {
            console.error('Steam Strategy Error:', err);
            return done(err);
        }
    }
));
passport.serializeUser((user, done) => done(null, user.id)); // Use internal MongoDB ID
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
if (!process.env.MONGODB_URI) {
    console.error("FATAL: MONGODB_URI environment variable is not set.");
    process.exit(1);
}
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
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
        tickets: { type: Number, required: true, default: 0 }      // Tickets based on value
    }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    cancelTime: 10 * 60 * 1000 // Cancel outgoing offers after 10 minutes
});
let isBotReady = false; // Track bot readiness

// --- 2FA Code Generation ---
function generateAuthCode() {
    const secret = process.env.STEAM_SHARED_SECRET;
    if (!secret) { console.error("STEAM_SHARED_SECRET missing. Cannot generate 2FA code."); return null; }
    try { return SteamTotp.generateAuthCode(secret); }
    catch (e) { console.error("Error generating 2FA code:", e); return null; }
}
const isBotConfigured = process.env.STEAM_USERNAME && process.env.STEAM_PASSWORD && process.env.STEAM_SHARED_SECRET;

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
                // Optionally, you might want to prevent the server from starting fully or retry later
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
                    community.gamesPlayed(process.env.SITE_NAME || 'RustyDegen'); // Set game played status
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
} else {
    console.warn("Steam Bot credentials incomplete in .env file. Trading features will be disabled.");
    isBotReady = false;
}

// --- Active Round Data ---
let currentRound = null;
let roundTimer = null; // Interval ID for the countdown
let isRolling = false; // Flag to prevent actions during winner selection/payout

// --- Deposit Security Token Store ---
const depositTokens = {}; // Simple in-memory store { token: { userId, expiry } }
function generateDepositToken(userId) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiry = Date.now() + DEPOSIT_TOKEN_EXPIRY_MS;
    depositTokens[token] = { userId: userId.toString(), expiry: expiry };
    console.log(`Generated deposit token ${token} for user ${userId}`);
    // Clean up expired token after expiry + buffer
    setTimeout(() => {
        if (depositTokens[token] && depositTokens[token].expiry <= Date.now()) {
            delete depositTokens[token];
            console.log(`Expired and deleted deposit token ${token}`);
        }
    }, DEPOSIT_TOKEN_EXPIRY_MS + 5000);
    return token;
}
async function verifyDepositToken(token, partnerSteamId) {
    const tokenData = depositTokens[token];
    if (!tokenData || tokenData.expiry <= Date.now()) {
        if (tokenData) delete depositTokens[token]; // Clean up if expired
        console.log(`Deposit token ${token} is invalid or expired.`);
        return null;
    }
    try {
        // Find user by partner's SteamID and check if it matches the token owner
        const user = await User.findOne({ steamId: partnerSteamId }).lean(); // Use lean for performance
        if (!user || user._id.toString() !== tokenData.userId) {
            console.log(`Token ${token} verification failed: User mismatch (Offer from ${partnerSteamId}, Token for ${tokenData.userId})`);
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
const priceCache = new NodeCache({ stdTTL: PRICE_CACHE_TTL_SECONDS, checkperiod: PRICE_CACHE_TTL_SECONDS * 0.2 });

// Fallback function (consider keeping this minimal or removing if API is reliable)
function getFallbackPrice(marketHashName) {
    // You might want a more robust fallback, maybe querying another API or using historical data.
    // For now, just return the minimum value or 0.
    console.warn(`PRICE_INFO: Using fallback (min value $${MIN_ITEM_VALUE.toFixed(2)}) for: ${marketHashName}`);
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

                    newItems.push({ key: key, val: priceInDollars, ttl: PRICE_CACHE_TTL_SECONDS });
                    updatedCount++;
                } else if (item?.name) {
                    console.warn(`PRICE_WARN: Invalid or missing price field for item '${item.name}' in SCMM response. Raw price: ${item.price}`);
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
            console.error("PRICE_ERROR: Invalid or empty array response received from rust.scmm.app price refresh. Response:", response.data);
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
        // console.warn(`PRICE_WARN: Cache miss for ${marketHashName}. Using fallback.`); // Less verbose fallback logging
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
    // Check if there's already an active round
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
        currentRound = newRound; // Update global current round state

        // Timer starts when the first participant joins (handled in handleNewDeposit)
        // We just emit the creation event here. Client handles timer display.
        io.emit('roundCreated', {
            roundId: newRound.roundId,
            serverSeedHash: newRound.serverSeedHash,
            timeLeft: ROUND_DURATION, // Initial time
            totalValue: 0,
            participants: [],
            items: []
        });

        console.log(`--- Round ${newRound.roundId} created and active ---`);
        return newRound;

    } catch (err) {
        console.error('FATAL: Error creating new round:', err);
        // Retry after a delay if round creation fails
        setTimeout(createNewRound, 10000); // Retry after 10 seconds
        return null;
    }
}

// Ensure an initial round exists on startup *after* bot is ready
async function ensureInitialRound() {
     if (!currentRound) {
         const existingActive = await Round.findOne({ status: 'active' });
         if (existingActive) {
             console.log(`Found existing active round ${existingActive.roundId} on startup.`);
             currentRound = existingActive;
             // Decide if timer needs starting (e.g., based on participants)
             if (currentRound.participants.length > 0) {
                  startRoundTimer(true); // Start timer based on remaining time
             }
         } else {
             console.log("No active round found, creating initial round...");
             await createNewRound();
         }
     }
 }


/**
 * Starts or restarts the countdown timer for the current round.
 * @param {boolean} useRemainingTime - If true, calculate based on endTime, else use ROUND_DURATION.
 */
function startRoundTimer(useRemainingTime = false) {
    if (roundTimer) clearInterval(roundTimer); // Clear existing timer
    if (!currentRound || currentRound.status !== 'active') {
        console.error("Cannot start timer: No active round.");
        return;
    }

    let timeLeft;
    if (useRemainingTime && currentRound.endTime) {
        timeLeft = Math.max(0, Math.floor((new Date(currentRound.endTime).getTime() - Date.now()) / 1000));
        console.log(`Resuming timer for round ${currentRound.roundId} with ${timeLeft}s remaining.`);
    } else {
        timeLeft = ROUND_DURATION;
        currentRound.endTime = new Date(Date.now() + ROUND_DURATION * 1000);
        // Don't await save here, let it happen in background
        currentRound.save().catch(e => console.error(`Error saving round end time for round ${currentRound?.roundId}:`, e));
        console.log(`Starting timer for round ${currentRound.roundId} (${ROUND_DURATION}s).`);
    }

    io.emit('timerUpdate', { timeLeft }); // Initial emit

    roundTimer = setInterval(async () => {
        if (!currentRound || currentRound.status !== 'active' || !currentRound.endTime) {
            clearInterval(roundTimer);
            roundTimer = null;
            console.error("Timer stopped: Round state invalid.");
            return;
        }

        const now = Date.now();
        let currenttimeLeft = Math.max(0, Math.floor((currentRound.endTime.getTime() - now) / 1000));

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
    console.log(`--- Ending round ${roundIdToEnd}... ---`);

    try {
        // Update round status immediately
        currentRound.status = 'rolling';
        currentRound.endTime = new Date(); // Mark actual end time
        await currentRound.save();
        io.emit('roundRolling', { roundId: roundIdToEnd }); // Notify clients

        // Fetch the full round data for processing
        // Important: Populate participants and items for winner/tax calculation
        const round = await Round.findById(currentRound._id)
                                 .populate('participants.user') // Populate user data
                                 .populate('items');             // Populate item data

        if (!round) throw new Error(`Round ${roundIdToEnd} data missing after status update.`);

        // --- Handle Empty Round ---
        if (round.participants.length === 0 || round.items.length === 0 || round.totalValue <= 0) {
            console.log(`Round ${round.roundId} ended with no valid participants or value.`);
            round.status = 'completed';
            round.completedTime = new Date();
            await round.save();
            io.emit('roundCompleted', { roundId: round.roundId, message: "No participants." });
            isRolling = false; // Reset flag
            setTimeout(createNewRound, 5000); // Start next round sooner
            return; // Exit early
        }

        // --- Tax Calculation ---
        let finalItems = [...round.items]; // Copy items to modify
        let finalTotalValue = round.totalValue;
        let taxAmount = 0;
        let taxedItemsInfo = [];

        if (finalTotalValue >= MIN_POT_FOR_TAX) {
            console.log(`Round ${round.roundId} eligible for tax (Value: $${finalTotalValue.toFixed(2)} >= $${MIN_POT_FOR_TAX})`);
            const targetTaxValue = finalTotalValue * (TAX_MIN_PERCENT / 100);
            const maxTaxValue = finalTotalValue * (TAX_MAX_PERCENT / 100);
            console.log(`Tax Target: $${targetTaxValue.toFixed(2)} (Min ${TAX_MIN_PERCENT}%), Max: $${maxTaxValue.toFixed(2)} (Max ${TAX_MAX_PERCENT}%)`);

            // Sort items by price ascending to take cheapest first
            const sortedItems = [...finalItems].sort((a, b) => a.price - b.price);
            let currentTaxValue = 0;
            const itemsToTakeForTax = [];

            for (const item of sortedItems) {
                 // Check if adding this item *would* exceed the MAX tax limit
                if (currentTaxValue + item.price <= maxTaxValue) {
                    itemsToTakeForTax.push(item);
                    currentTaxValue += item.price;
                     // If we've met or exceeded the MIN target, we can stop
                     if (currentTaxValue >= targetTaxValue) {
                         break;
                     }
                } else {
                     // Adding this item would exceed max tax. Stop adding.
                     console.log(`Tax: Adding item ${item.name} ($${item.price.toFixed(2)}) would exceed max ($${maxTaxValue.toFixed(2)}). Stopping tax selection.`);
                     break;
                }
            }

            if (itemsToTakeForTax.length > 0) {
                 // Remove taxed items from the list to be sent to the winner
                 const taxedAssetIds = new Set(itemsToTakeForTax.map(item => item.assetId));
                 finalItems = finalItems.filter(item => !taxedAssetIds.has(item.assetId));

                 taxAmount = currentTaxValue;
                 finalTotalValue -= taxAmount; // Reduce pot value
                 taxedItemsInfo = itemsToTakeForTax.map(i => ({ assetId: i.assetId, name: i.name, price: i.price })); // Store basic info

                 console.log(`Tax Applied: $${taxAmount.toFixed(2)} (${itemsToTakeForTax.length} items). New Pot Value: $${finalTotalValue.toFixed(2)}`);

                 // Update the round document with tax info
                 round.taxAmount = taxAmount;
                 round.taxedItems = taxedItemsInfo;
                 round.items = finalItems.map(i => i._id); // Save only IDs of remaining items
                 round.totalValue = finalTotalValue;
            } else {
                console.log(`Tax Skipped: Could not select items within ${TAX_MIN_PERCENT}-${TAX_MAX_PERCENT}% range.`);
            }
        } else {
             console.log(`Tax Skipped: Pot value $${finalTotalValue.toFixed(2)} is below minimum $${MIN_POT_FOR_TAX}`);
        }


        // --- Winner Calculation (Provably Fair) ---
        round.clientSeed = crypto.randomBytes(16).toString('hex'); // Generate client seed now
        const combinedString = round.serverSeed + round.clientSeed;
        round.provableHash = crypto.createHash('sha256').update(combinedString).digest('hex');

        const decimalFromHash = parseInt(round.provableHash.substring(0, 8), 16);
        const totalTickets = round.participants.reduce((sum, p) => sum + (p?.tickets || 0), 0);

        if (totalTickets <= 0) throw new Error(`Cannot determine winner: Total tickets is zero or invalid for round ${round.roundId}.`);

        round.winningTicket = decimalFromHash % totalTickets;

        let cumulativeTickets = 0;
        let winner = null;
        for (const participant of round.participants) {
            if (!participant?.tickets || !participant.user) continue; // Skip invalid participants
            cumulativeTickets += participant.tickets;
            if (round.winningTicket < cumulativeTickets) {
                winner = participant.user; // The user object is populated
                break;
            }
        }

        if (!winner) throw new Error(`Winner selection failed for round ${round.roundId}. Winning Ticket: ${round.winningTicket}, Total Tickets: ${totalTickets}`);

        round.winner = winner._id; // Store winner's ID
        round.status = 'completed'; // Mark as completed

        // Save all changes (status, seeds, winner, tax info, final items/value)
        await round.save();

        console.log(`Round ${round.roundId} completed. Winner: ${winner.username} (Ticket: ${round.winningTicket}/${totalTickets}, Value: $${finalTotalValue.toFixed(2)})`);

        // Emit winner information (including post-tax value)
        io.emit('roundWinner', {
            roundId: round.roundId,
            winner: { // Send relevant winner details
                id: winner._id,
                steamId: winner.steamId,
                username: winner.username,
                avatar: winner.avatar
            },
            winningTicket: round.winningTicket,
            totalValue: finalTotalValue, // Send post-tax value
            totalTickets: totalTickets,
            serverSeed: round.serverSeed, // Reveal server seed
            clientSeed: round.clientSeed,
            provableHash: round.provableHash,
            serverSeedHash: round.serverSeedHash // Keep sending hash too
        });

        // --- Initiate Payout ---
        await sendWinningTradeOffer(round, winner, finalItems); // Send remaining items

        round.completedTime = new Date(); // Mark completion time after payout attempt
        await round.save();

    } catch (err) {
        console.error(`CRITICAL ERROR during endRound for round ${roundIdToEnd}:`, err);
        if (currentRound && currentRound.roundId === roundIdToEnd) { // Check if currentRound wasn't overwritten
            currentRound.status = 'error';
            await currentRound.save().catch(e => console.error("Error saving error status:", e));
            io.emit('roundError', { roundId: roundIdToEnd, error: 'Internal server error during round finalization.' });
        }
    } finally {
        isRolling = false; // Reset rolling flag
        console.log("Scheduling next round creation...");
        setTimeout(createNewRound, 10000); // Schedule next round (e.g., 10s after completion/error)
    }
}

/**
 * Sends the winning trade offer to the winner.
 * @param {object} round - The completed Round mongoose document.
 * @param {object} winner - The populated User mongoose document for the winner.
 * @param {Array} itemsToSend - Array of populated Item objects to send (after tax).
 */
async function sendWinningTradeOffer(round, winner, itemsToSend) {
    if (!isBotReady) {
        console.error(`Cannot send winnings for round ${round.roundId}: Steam Bot is not ready.`);
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: `Bot Error: Payout for round ${round.roundId} requires manual processing.` });
        return;
    }
    if (!winner.tradeUrl) {
        console.error(`Cannot send winnings for round ${round.roundId}: Winner ${winner.username} has no Trade URL set.`);
        io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Please set your Trade URL in your profile to receive winnings.' });
        return;
    }
    if (!itemsToSend || itemsToSend.length === 0) {
        console.warn(`No items to send for round ${round.roundId} (possibly all taxed or error).`);
        // You might still want to notify the user if the value was non-zero before tax.
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
                    if (err.message.includes('revoked') || err.message.includes('invalid')) {
                         console.error(`Trade offer failed for round ${round.roundId}: Invalid Trade URL/Token for ${winner.username}.`);
                         io.emit('notification', { type: 'error', userId: winner._id.toString(), message: 'Your Trade URL is invalid or expired. Please update it to receive winnings.' });
                    } else {
                         console.error(`Error sending trade offer ${offer.id} for round ${round.roundId}:`, err);
                    }
                    return reject(err); // Reject the promise on error
                }
                resolve(status); // Resolve with the status on success
            });
        });

        console.log(`Trade offer ${offer.id} sent to ${winner.username} for round ${round.roundId}. Status: ${status}`);
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
        console.error(`Unexpected error creating/sending trade offer for round ${round.roundId}:`, err);
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
    // Return only necessary, non-sensitive user data
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
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
        return res.status(400).json({ error: 'Invalid Trade URL format.' });
    }
    try { // More robust URL parsing and param check
        const url = new URL(tradeUrl);
        if (!url.searchParams.get('partner') || !url.searchParams.get('token')) {
            return res.status(400).json({ error: 'Trade URL must include partner and token parameters.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { tradeUrl: tradeUrl },
            { new: true } // Return the updated document
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
    try {
        // Use manager.getUserInventoryContents for potentially better reliability
        const inventory = await new Promise((resolve, reject) => {
            if (!manager || !isBotReady) { // Check if manager/bot is ready
                 return reject(new Error("Steam service temporarily unavailable."));
            }
            manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                if (err) {
                    // Handle common errors more gracefully
                    if (err.message?.includes('profile is private') || err.eresult === 15) {
                         return reject(new Error('Your Steam inventory is private. Please set it to public.'));
                    }
                     console.error(`Inventory Fetch Error (Manager): User ${req.user.steamId}:`, err.message || err);
                     return reject(new Error(`Could not fetch inventory. Steam might be busy or inventory private.`));
                }
                resolve(inv || []); // Resolve with empty array if null/undefined
            });
        });

        if (!inventory?.length) return res.json([]); // Return empty array if inventory is empty

        // Process items: get prices (sync using cache), format data
        const itemsWithPrices = inventory
            .map(item => {
                const itemName = item.market_hash_name;
                let price = 0;
                if (itemName) {
                    price = getItemPrice(itemName); // Reads cache/fallback synchronously
                } else {
                    console.warn(`Inventory item missing market_hash_name: assetId ${item.assetid}`);
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
app.post('/api/deposit/initiate', ensureAuthenticated, (req, res) => {
    if (!isBotReady || !process.env.BOT_TRADE_URL) {
        console.warn(`Deposit initiation failed for ${req.user.username}: Bot service is unavailable.`);
        return res.status(503).json({ error: "Deposit service is temporarily unavailable. Please try again later." });
    }
    if (!currentRound || currentRound.status !== 'active' || isRolling) {
        console.warn(`Deposit initiation rejected for ${req.user.username}: Round not active (Status: ${currentRound?.status}, Rolling: ${isRolling})`);
        return res.status(400).json({ error: 'Deposits are currently closed for this round.' });
    }
     // Double check limits server-side before issuing token
     if (currentRound.participants.length >= MAX_PARTICIPANTS) {
          return res.status(400).json({ error: `Participant limit (${MAX_PARTICIPANTS}) reached.` });
     }
     if (currentRound.items.length >= MAX_ITEMS_PER_POT) {
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
        if (!currentRound || currentRound.status !== 'active' || isRolling) {
            console.log(`Offer #${offer.id}: Declining - Deposits closed (Status: ${currentRound?.status}, Rolling: ${isRolling})`);
            return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (round closed):`, e));
        }
        if (currentRound.participants.length >= MAX_PARTICIPANTS) {
             console.log(`Offer #${offer.id}: Declining - Participant limit reached (${currentRound.participants.length}/${MAX_PARTICIPANTS}).`);
             return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (participants full):`, e));
        }
        if (currentRound.items.length >= MAX_ITEMS_PER_POT) {
             console.log(`Offer #${offer.id}: Declining - Pot item limit reached (${currentRound.items.length}/${MAX_ITEMS_PER_POT}).`);
             return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (items full):`, e));
        }


        // 2. Verify Deposit Token
        const token = offer.message.trim();
        let user; // Will store the user object if token is valid
        try {
            user = await verifyDepositToken(token, offer.partner.getSteamID64());
            if (!user) {
                console.log(`Offer #${offer.id}: Declining - Invalid or expired deposit token.`);
                return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (invalid token):`, e));
            }
        } catch (vErr) { // Catch errors during DB lookup in verifyDepositToken
            console.error(`Offer #${offer.id}: Error verifying deposit token:`, vErr);
            return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (token verify error):`, e));
        }

         // Re-check participant limit specifically for NEW participants joining
         const isNewParticipant = !currentRound.participants.some(p => p.user?.equals(user._id));
         if (isNewParticipant && currentRound.participants.length >= MAX_PARTICIPANTS) {
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
                         console.log(`Offer #${offer.id}: Item '${item.market_hash_name}' ($${price.toFixed(2)}) value below minimum ($${MIN_ITEM_VALUE}). Skipping.`);
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
                console.log(`Offer #${offer.id}: Declining - No items met the minimum value requirement.`);
                return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (no valid items):`, e));
            }

             // Final check: Ensure adding these items doesn't exceed pot limit
            if (currentRound.items.length + itemsToProcess.length > MAX_ITEMS_PER_POT) {
                console.log(`Offer #${offer.id}: Declining - Deposit would exceed pot item limit (${currentRound.items.length} + ${itemsToProcess.length} > ${MAX_ITEMS_PER_POT}).`);
                return offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (items full - race condition):`, e));
            }

            // 4. Accept the Offer
            offer.accept(async (err, status) => {
                if (err) {
                    console.error(`Offer #${offer.id}: Error accepting trade:`, err.message || err);
                    // Handle specific errors like escrow
                    if (err.message?.includes('escrow')) {
                        console.warn(`Offer #${offer.id} may be held in escrow.`);
                        // Decide how to handle escrow - potentially decline or notify user.
                        // For simplicity here, we just log it. Acceptance likely failed anyway.
                    }
                    return; // Stop processing if accept fails
                }

                console.log(`Offer #${offer.id} accepted successfully. Status: ${status}. Updating database...`);

                // 5. Update Database (CRITICAL SECTION)
                // Fetch the very latest round data again to prevent race conditions
                const latestRound = await Round.findById(currentRound._id);
                if (!latestRound || latestRound.status !== 'active' || isRolling) {
                    // This is bad - the round changed *after* we accepted the trade.
                    // Items are in bot inventory but not in the pot. Requires manual intervention.
                    console.error(`CRITICAL! Round ${currentRound?.roundId} status changed/ended AFTER accepting offer ${offer.id}. Items NOT added to pot. User: ${user.username}, Value: ${depositTotalValue.toFixed(2)}`);
                    // TODO: Implement a system to handle these "lost" items (e.g., add to user balance, notify admin)
                    io.emit('notification', { type: 'error', userId: user._id.toString(), message: `Deposit Error: Round ended unexpectedly. Please contact support regarding offer #${offer.id}.` });
                    return;
                }

                try {
                    // Save the deposited items to the database
                    const createdItems = await Item.insertMany(itemsToProcess);
                    const createdItemIds = createdItems.map(item => item._id);

                    // Update the round document
                    latestRound.items.push(...createdItemIds); // Add new item IDs
                    latestRound.totalValue += depositTotalValue; // Add value to round total

                    // Update or add participant data
                    const ticketsEarned = Math.max(1, Math.floor(depositTotalValue / TICKET_VALUE_RATIO)); // Ensure at least 1 ticket
                    const participantIndex = latestRound.participants.findIndex(p => p.user?.equals(user._id));

                    if (participantIndex > -1) { // Existing participant
                        latestRound.participants[participantIndex].itemsValue += depositTotalValue;
                        latestRound.participants[participantIndex].tickets += ticketsEarned;
                    } else { // New participant
                        latestRound.participants.push({
                            user: user._id,
                            itemsValue: depositTotalValue,
                            tickets: ticketsEarned
                        });
                    }

                    // Save the updated round
                    await latestRound.save();
                    currentRound = latestRound; // Update the global state

                    // 6. Emit update to clients
                    const updatedParticipantData = latestRound.participants.find(p => p.user?.equals(user._id));
                    io.emit('participantUpdated', {
                        roundId: latestRound.roundId,
                        userId: user._id.toString(), // Send MongoDB ID
                        username: user.username,
                        avatar: user.avatar,
                        itemsValue: updatedParticipantData?.itemsValue || 0, // Send cumulative value
                        tickets: updatedParticipantData?.tickets || 0,     // Send cumulative tickets
                        totalValue: latestRound.totalValue,                // Send new round total value
                        depositedItems: createdItems.map(i => ({ // Send details of *this* deposit
                            assetId: i.assetId, name: i.name, image: i.image, price: i.price
                         }))
                     });


                     // Start timer if this was the first participant
                     if (latestRound.participants.length === 1 && !timerActive) {
                          console.log(`First participant (${user.username}) joined round ${latestRound.roundId}. Starting timer.`);
                          timerActive = true; // Set flag before starting interval
                          startRoundTimer();
                     }


                    console.log(`Deposit success for offer #${offer.id}. User: ${user.username}, Value: $${depositTotalValue.toFixed(2)}, Items: ${createdItems.length}`);

                } catch (dbErr) {
                    // CRITICAL: Error saving to DB after accepting trade. Items are in bot inventory.
                    console.error(`CRITICAL DATABASE ERROR after accepting offer ${offer.id}:`, dbErr);
                    // Attempt to mark round as error? Or just log for manual fix.
                    if (currentRound) { // Try to mark round as errored
                        await Round.updateOne({ _id: currentRound._id }, { $set: { status: 'error' } })
                                  .catch(e => console.error("Failed to set round status to error:", e));
                        io.emit('roundError', { roundId: currentRound.roundId, error: 'Critical deposit database error.' });
                    }
                     io.emit('notification', { type: 'error', userId: user._id.toString(), message: `Deposit Error: Database issue after accepting offer #${offer.id}. Please contact support.` });
                    // TODO: System to handle items stuck in bot inventory.
                }
            }); // End offer.accept callback

        } catch (procErr) {
            console.error(`Offer #${offer.id}: Error processing items/value:`, procErr);
            offer.decline().catch(e => console.error(`Error declining offer ${offer.id} (item processing error):`, e));
        }
    }); // End manager.on('newOffer')

    manager.on('sentOfferChanged', (offer, oldState) => {
        console.log(`Payout Offer #${offer.id} state changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);
        // TODO: Add logic here if needed (e.g., logging successful payouts, handling declines/failures)
         if (offer.state === TradeOfferManager.ETradeOfferState.Accepted) {
              console.log(`Payout offer #${offer.id} accepted by recipient.`);
              // Optional: Mark round payout as fully complete if needed
         } else if (offer.state === TradeOfferManager.ETradeOfferState.Declined ||
                    offer.state === TradeOfferManager.ETradeOfferState.Canceled ||
                    offer.state === TradeOfferManager.ETradeOfferState.Expired ||
                    offer.state === TradeOfferManager.ETradeOfferState.InvalidItems) {
              console.warn(`Payout offer #${offer.id} failed. State: ${TradeOfferManager.ETradeOfferState[offer.state]}. Items likely returned to bot inventory.`);
              // TODO: Notify user/admin, potentially retry or credit balance
         }
    });

} else {
    console.warn("Steam Bot not configured. Trade offer listeners are inactive.");
}


// --- Round Info API Routes ---
app.get('/api/round/current', async (req, res) => {
    if (!currentRound?._id) {
        // If no round in memory, check DB for an active one (e.g., after restart)
        try {
             const activeRound = await Round.findOne({status: 'active'})
                                          .populate('participants.user', 'steamId username avatar')
                                          .populate('items', 'name image price owner') // Populate items
                                          .lean();
             if (activeRound) {
                  currentRound = activeRound; // Restore active round to memory
                  console.log(`Restored active round ${currentRound.roundId} from DB.`);
                  // Start timer if needed based on endTime
                  if(currentRound.endTime && new Date(currentRound.endTime).getTime() > Date.now()){
                       startRoundTimer(true);
                  }
             } else {
                  return res.status(404).json({ error: 'No active round found.' });
             }
        } catch (dbErr) {
             console.error("Error fetching active round from DB:", dbErr);
             return res.status(500).json({ error: 'Error retrieving round data.' });
        }
    }
    // Proceed with currentRound data (either initially present or restored)
    try {
        // Recalculate timeLeft based on potentially restored round
        const timeLeft = (currentRound.status === 'active' && currentRound.endTime)
            ? Math.max(0, Math.floor((new Date(currentRound.endTime).getTime() - Date.now()) / 1000))
            : 0;

        res.json({
            roundId: currentRound.roundId,
            status: currentRound.status,
            startTime: currentRound.startTime,
            endTime: currentRound.endTime,
            timeLeft: timeLeft,
            totalValue: currentRound.totalValue || 0,
            serverSeedHash: currentRound.serverSeedHash,
            // Ensure participants and items are populated/formatted correctly
            participants: (currentRound.participants || []).map(p => ({
                user: p.user ? { // Check if user is populated
                    id: p.user._id,
                    steamId: p.user.steamId,
                    username: p.user.username,
                    avatar: p.user.avatar
                } : null, // Handle potential null user ref if something went wrong
                itemsValue: p.itemsValue || 0,
                tickets: p.tickets || 0
            })).filter(p => p.user), // Filter out any entries with null users
            items: (currentRound.items || []).map(i => ({ // Check if items is populated
                id: i._id,
                name: i.name,
                image: i.image,
                price: i.price || 0,
                owner: i.owner // Keep owner ID if needed client-side
            })),
            // Conditionally include completed round data
            winner: currentRound.winner, // Send winner ID if completed
            winningTicket: currentRound.status === 'completed' ? currentRound.winningTicket : null,
            serverSeed: currentRound.status === 'completed' ? currentRound.serverSeed : null,
            clientSeed: currentRound.status === 'completed' ? currentRound.clientSeed : null,
            provableHash: currentRound.status === 'completed' ? currentRound.provableHash : null,
            taxAmount: currentRound.taxAmount // Include tax info
        });
    } catch (err) {
        console.error('Error formatting current round data:', err);
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

        // Add itemCount (might require another query or adjust selection if needed)
        // For simplicity, we won't add itemCount here to avoid N+1 queries without populate count
        // Client can infer from items if round details are fetched

        res.json({
            rounds: rounds,
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

    try {
        const round = await Round.findOne({ roundId: roundId, status: 'completed' })
                                  // Populate necessary fields for verification display if needed
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
    console.log(`Client connected: ${socket.id}`);

    // Send current round data on connection
    socket.on('requestRoundData', async () => { // Listen for explicit request
        try {
            let roundToSend = null;
            if (currentRound?._id) {
                 // Fetch fresh data for the current round ID in memory
                 roundToSend = await Round.findById(currentRound._id)
                                      .populate('participants.user', 'steamId username avatar')
                                      .populate('items', 'name image price owner')
                                      .lean();
             }
             // Fallback: If no round in memory, check DB for any active round
            if (!roundToSend) {
                roundToSend = await Round.findOne({ status: 'active' })
                                      .populate('participants.user', 'steamId username avatar')
                                      .populate('items', 'name image price owner')
                                      .lean();
                 if (roundToSend && !currentRound) { // Restore to memory if found and memory is empty
                      currentRound = roundToSend;
                      console.log(`Restored active round ${currentRound.roundId} from DB on client request.`);
                      if (currentRound.participants?.length > 0) startRoundTimer(true); // Resume timer if needed
                 }
             }


             if (roundToSend) {
                 const timeLeft = (roundToSend.status === 'active' && roundToSend.endTime)
                     ? Math.max(0, Math.floor((new Date(roundToSend.endTime).getTime() - Date.now()) / 1000))
                     : 0;

                  // Format data consistently
                 const participantsFormatted = (roundToSend.participants || []).map(p => ({
                      user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null,
                      itemsValue: p.itemsValue || 0,
                      tickets: p.tickets || 0
                  })).filter(p => p.user);

                  const itemsFormatted = (roundToSend.items || []).map(i => ({
                      id: i._id, name: i.name, image: i.image, price: i.price || 0, owner: i.owner
                  }));


                 socket.emit('roundData', {
                     roundId: roundToSend.roundId,
                     status: roundToSend.status,
                     timeLeft: timeLeft,
                     totalValue: roundToSend.totalValue || 0,
                     serverSeedHash: roundToSend.serverSeedHash,
                     participants: participantsFormatted,
                     items: itemsFormatted, // Send formatted items
                     // Include completed data only if applicable
                     winner: roundToSend.status === 'completed' ? roundToSend.winner : null,
                     winningTicket: roundToSend.status === 'completed' ? roundToSend.winningTicket : null,
                     serverSeed: roundToSend.status === 'completed' ? roundToSend.serverSeed : null,
                     clientSeed: roundToSend.status === 'completed' ? roundToSend.clientSeed : null,
                     provableHash: roundToSend.status === 'completed' ? roundToSend.provableHash : null,
                     taxAmount: roundToSend.taxAmount
                 });
             } else {
                 socket.emit('noActiveRound'); // Tell client no round is active
             }
         } catch(err) {
              console.error(`Error fetching round data for socket ${socket.id}:`, err);
              socket.emit('roundError', { error: 'Failed to load round data.' });
         }
     }); // End 'requestRoundData' listener


    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
    });
});

// --- Server Startup ---
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
        console.log(`Site URL configured as: ${process.env.SITE_URL}`);

        // Bot status check (Initial round creation moved to login callback/ensureInitialRound)
        if (!isBotConfigured) { console.log("WARNING: Steam Bot not configured. Trade features disabled."); }
        else if (!isBotReady) { console.log("INFO: Waiting for Steam Bot login attempt..."); }
        else { console.log("INFO: Steam Bot is ready."); } // If already ready at listen time

        // Test Pricing API on startup
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
    });
}

startApp(); // Call the async startup function

// --- Graceful Shutdown ---
function gracefulShutdown() {
    console.log('Received shutdown signal. Closing server...');
    io.close(); // Close socket connections
    server.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false).then(() => { // Use newer syntax if available, force=false
            console.log('MongoDB connection closed.');
            process.exit(0); // Exit cleanly
        }).catch(e => {
            console.error("Error closing MongoDB connection:", e);
            process.exit(1); // Exit with error on DB close failure
        });
    });

    // Force shutdown after a timeout
    setTimeout(() => {
        console.error('Could not close connections gracefully, forcing shutdown.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown); // Handle Ctrl+C

// Basic Error Handling Middleware (Place LAST)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : (err.message || 'Unknown server error.');
    res.status(status).json({ error: message });
});
