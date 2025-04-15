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
// IMPORTANT: You need to install steam-totp: npm install steam-totp
const SteamTotp = require('steam-totp'); // Required for 2FA login
// Added for real-time pricing API
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

// --- Configuration Constants ---
const RUST_APP_ID = 252490;
const RUST_CONTEXT_ID = 2;
const ROUND_DURATION = 120; // 2 minutes
const TICKET_VALUE_RATIO = 0.01; // e.g., 1 ticket per $0.01 value
const DEPOSIT_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for deposit token validity

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
app.use(express.static('public'));
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
// Corrected SteamStrategy implementation
passport.use(new SteamStrategy({
    returnURL: `${process.env.SITE_URL}/auth/steam/return`,
    realm: process.env.SITE_URL,
    apiKey: process.env.STEAM_API_KEY,
    providerURL: 'https://steamcommunity.com/openid'
}, async (identifier, profile, done) => { // Correct position for the callback
    try {
        let user = await User.findOne({ steamId: profile.id });

        if (!user) {
            // Create new user
            console.log(`Creating new user: ${profile.displayName} (${profile.id})`);
            const newUser = new User({
                steamId: profile.id,
                username: profile.displayName,
                avatar: profile._json.avatarfull,
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
            if (user.avatar !== profile._json.avatarfull) {
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
        done(err);
    }
});

// --- MongoDB Connection ---
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
    tradeUrl: { type: String, default: '' }, // User needs to set this
    balance: { type: Number, default: 0 }, // Example field, not used in core pot logic
    createdAt: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false }
});

const itemSchema = new mongoose.Schema({
    assetId: { type: String, required: true, index: true },
    name: { type: String, required: true },
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
    domain: process.env.SITE_URL.replace(/^https?:\/\//, ''), // Domain name from your site URL
    language: 'en',
    pollInterval: 15000, // Poll for new offers every 15 seconds
    cancelTime: 10 * 60 * 1000, // Cancel outgoing offers after 10 mins
});

// --- Function to generate Steam Guard code ---
// !!! IMPORTANT: Replace this with actual steam-totp implementation !!!
function generateAuthCode() {
    const sharedSecret = process.env.STEAM_SHARED_SECRET;
    if (!sharedSecret) {
        console.error("STEAM_SHARED_SECRET not found in .env! Bot cannot log in.");
        return null; // Indicate failure
    }
    try {
        // Calculate the code using steam-totp
        const code = SteamTotp.generateAuthCode(sharedSecret);
        console.log("Generated Steam Guard Code."); // Don't log the code itself!
        return code;
    } catch (err) {
        console.error("Error generating Steam Guard code:", err);
        return null;
    }
}

// --- Steam Bot Login ---
// Uncommented and using generateAuthCode
const steamLoginCredentials = {
    accountName: process.env.STEAM_USERNAME,
    password: process.env.STEAM_PASSWORD,
    twoFactorCode: generateAuthCode() // Use the function to get the code
};

if (steamLoginCredentials.twoFactorCode) { // Only attempt login if code generation didn't fail
    community.login(steamLoginCredentials, (err, sessionID, cookies, steamguard) => {
        if (err) {
            console.error('Steam login error:', err);
            // Consider if the app should exit or continue without trade functionality
            // process.exit(1); // Or handle gracefully
        } else {
            console.log('Steam bot logged in successfully.');
            manager.setCookies(cookies, err => {
                if (err) {
                    console.error('Error setting Trade Offer Manager cookies:', err);
                    return;
                }
                console.log('Trade Offer Manager cookies set.');
                community.setCookies(cookies); // Also set cookies for community instance if needed elsewhere

                // Example: Accept friend requests automatically
                community.on('friendRelationship', (steamID, relationship) => {
                    if (relationship === SteamCommunity.EFriendRelationship.RequestRecipient) {
                        console.log(`Accepting friend request from ${steamID}`);
                        community.addFriend(steamID, (err) => {
                            if(err) console.error(`Error accepting friend ${steamID}:`, err);
                        });
                    }
                });

                 // Example: Set profile status
                community.gamesPlayed(process.env.SITE_URL || 'RustPot'); // Set status to website name
                community.chatLogon(); // Make sure the bot appears online

            });
        }
    });
} else {
    console.warn("Could not generate Steam Guard code. Bot login skipped. Trade functionality disabled.");
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

    // Cleanup expired tokens periodically (simple example)
    setTimeout(() => {
        if (depositTokens[token] && depositTokens[token].expiry <= Date.now()) {
            delete depositTokens[token];
            console.log(`Expired deposit token ${token}`);
        }
    }, DEPOSIT_TOKEN_EXPIRY_MS + 1000); // Check slightly after expiry

    return token;
}

function verifyDepositToken(token, partnerSteamId) {
    const stored = depositTokens[token];
    if (!stored) {
        console.log(`Deposit token ${token} not found.`);
        return null;
    }
    if (stored.expiry <= Date.now()) {
        console.log(`Deposit token ${token} expired.`);
        delete depositTokens[token]; // Clean up expired token
        return null;
    }

    // Find user by partnerSteamId to compare MongoDB _id
    return User.findOne({ steamId: partnerSteamId }).then(user => {
        if (!user) {
            console.log(`User with SteamID ${partnerSteamId} not found for token ${token}.`);
            return null;
        }
        if (user._id.toString() !== stored.userId) {
            console.log(`Token ${token} user ID mismatch. Expected ${stored.userId}, got ${user._id} (SteamID: ${partnerSteamId})`);
            return null;
        }
        // Valid token
        delete depositTokens[token]; // Use token only once
        console.log(`Verified deposit token ${token} for user ${user.username} (${user.steamId})`);
        return user; // Return the user object
    }).catch(err => {
        console.error(`Error finding user for token ${token} verification:`, err);
        return null;
    });
}


// --- Core Game Logic ---

async function createNewRound() {
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
            roundId: newRoundId,
            status: 'active', // Start as active
            startTime: new Date(),
            serverSeed: serverSeed,
            serverSeedHash: serverSeedHash,
            items: [],
            participants: [],
            totalValue: 0
        });

        await round.save();
        currentRound = round; // Set the global current round

        startRoundTimer(); // Start the timer for this new round

        io.emit('roundCreated', {
            roundId: round.roundId,
            serverSeedHash: round.serverSeedHash,
            timeLeft: ROUND_DURATION,
            totalValue: 0,
            participants: [],
            items: [] // Start with empty items/participants
        });

        console.log(`Round #${round.roundId} created. Server Seed Hash: ${round.serverSeedHash}`);
        return round;

    } catch (err) {
        console.error('Error creating new round:', err);
        // Consider a retry mechanism or logging for monitoring
        // Maybe schedule another attempt after a delay
        setTimeout(createNewRound, 10000); // Try again in 10 seconds
    }
}

function startRoundTimer() {
    if (roundTimer) {
        clearInterval(roundTimer); // Clear previous timer if any
    }
    if (!currentRound) {
        console.error("Attempted to start timer with no current round.");
        return;
    }

    // Calculate end time based on ROUND_DURATION from the *actual* start time
    currentRound.endTime = new Date(currentRound.startTime.getTime() + ROUND_DURATION * 1000);
    currentRound.save().catch(err => console.error("Error saving round end time:", err)); // Save end time

    let timeLeft = ROUND_DURATION;

    io.emit('timeUpdate', { timeLeft }); // Emit initial time

    roundTimer = setInterval(async () => {
        // Recalculate time left based on system time and endTime for accuracy
        const now = Date.now();
        timeLeft = Math.max(0, Math.floor((currentRound.endTime.getTime() - now) / 1000));

        io.emit('timeUpdate', { timeLeft });

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            await endRound(); // End the round
        }
    }, 1000);
    console.log(`Round #${currentRound.roundId} timer started (${ROUND_DURATION}s).`);
}

async function endRound() {
    if (!currentRound || isRolling) {
        console.log(`endRound called skipped: No current round or already rolling.`);
        return;
    }
    if (currentRound.status !== 'active') {
         console.log(`endRound called skipped: Round ${currentRound.roundId} status is ${currentRound.status}.`);
        return;
    }

    isRolling = true; // Prevent further deposits
    console.log(`Ending round #${currentRound.roundId}...`);
    currentRound.status = 'rolling';
    currentRound.endTime = new Date(); // Mark exact end time
    await currentRound.save();
    io.emit('roundRolling', { roundId: currentRound.roundId }); // Notify clients

    try {
        // Refresh round data from DB, populating necessary fields
        const round = await Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId tradeUrl') // Populate user details for winner selection
            .populate('items'); // Populate items for the winner trade offer

        if (!round) {
            throw new Error(`Round ${currentRound._id} not found in DB during endRound.`);
        }
        currentRound = round; // Update global reference with populated data

        // If no participants, just complete the round and start a new one
        if (round.participants.length === 0 || round.totalValue <= 0) {
            console.log(`Round #${round.roundId} ended with no participants.`);
            round.status = 'completed';
            round.completedTime = new Date();
            await round.save();
            isRolling = false;
            setTimeout(createNewRound, 5000); // Start new round after 5s
            io.emit('roundCompleted', { roundId: round.roundId, message: "No participants." });
            return;
        }

        // Provably Fair Calculation
        round.clientSeed = round.roundId.toString() + Date.now().toString() + crypto.randomBytes(8).toString('hex'); // More randomness
        const combinedSeed = round.serverSeed + round.clientSeed;
        round.provableHash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
        const decimal = parseInt(round.provableHash.substring(0, 8), 16); // Use first 8 hex chars (32 bits)

        // Calculate total tickets based on stored participant data
        const totalTickets = round.participants.reduce((sum, p) => sum + p.tickets, 0);
        if (totalTickets <= 0) {
             throw new Error(`Round #${round.roundId} has participants but zero total tickets.`);
        }

        round.winningTicket = decimal % totalTickets;

        // Find the winner
        let ticketCounter = 0;
        let winner = null;
        for (const participant of round.participants) {
            ticketCounter += participant.tickets;
            if (round.winningTicket < ticketCounter) {
                winner = participant.user; // This is the populated User object
                break;
            }
        }

        if (!winner) {
            // Should be mathematically impossible if totalTickets > 0
            throw new Error(`Could not determine winner for round #${round.roundId}. Winning Ticket: ${round.winningTicket}, Total Tickets: ${totalTickets}`);
        }

        round.winner = winner._id;
        round.status = 'completed'; // Mark as completed *before* sending trade
        await round.save();

        console.log(`Round #${round.roundId} completed. Winner: ${winner.username} (Ticket: ${round.winningTicket})`);

        // Emit winner information BEFORE sending the trade (allows frontend animation)
         io.emit('roundWinner', {
            roundId: round.roundId,
            winner: {
                id: winner._id,
                steamId: winner.steamId,
                username: winner.username,
                avatar: winner.avatar
            },
            winningTicket: round.winningTicket,
            totalValue: round.totalValue,
            totalTickets: totalTickets,
            serverSeed: round.serverSeed, // Reveal server seed now
            clientSeed: round.clientSeed,
            provableHash: round.provableHash,
            serverSeedHash: round.serverSeedHash // Include original hash for verification
        });

        // Send items to the winner
        await sendWinningTradeOffer(round, winner); // Make this async

        round.completedTime = new Date(); // Mark final completion time
        await round.save();


    } catch (err) {
        console.error(`Error ending round #${currentRound ? currentRound.roundId : 'UNKNOWN'}:`, err);
        if (currentRound) {
            currentRound.status = 'error';
            await currentRound.save().catch(saveErr => console.error("Failed to save error status:", saveErr));
             io.emit('roundError', { roundId: currentRound.roundId, error: 'An internal error occurred while ending the round.' });
        }
        // Consider alerting/logging mechanism here
    } finally {
        isRolling = false; // Ensure rolling flag is reset even on error
        // Schedule the next round regardless of success/failure of the current one
        console.log("Scheduling next round creation...");
        setTimeout(createNewRound, 10000); // Start new round after 10s delay
    }
}

async function sendWinningTradeOffer(round, winner) {
    console.log(`Attempting to send winning items for round #${round.roundId} to ${winner.username}...`);

    if (!winner.tradeUrl) {
        console.error(`Cannot send trade offer to winner ${winner.username} (ID: ${winner._id}): Trade URL not set.`);
        // Maybe notify the user or require manual claim?
        io.to(winner.steamId).emit('notification', { type: 'error', message: 'Please set your Trade URL in settings to receive winnings.' }); // Example socket notification
        return;
    }

    if (!round.items || round.items.length === 0) {
        console.warn(`Round #${round.roundId} has no items to send to winner ${winner.username}.`);
        return; // Nothing to send
    }

    try {
        const offer = manager.createOffer(winner.tradeUrl);

        const itemsToAdd = round.items.map(item => ({
            assetid: item.assetId, // Use assetId from the Item document
            appid: RUST_APP_ID,
            contextid: RUST_CONTEXT_ID
        }));

        offer.addMyItems(itemsToAdd); // Use addMyItems for array

        offer.setMessage(`Congratulations on winning Round #${round.roundId} on ${process.env.SITE_URL}!`);

        // Promisify offer sending for async/await
        const offerStatus = await new Promise((resolve, reject) => {
            offer.send((err, status) => {
                if (err) {
                    // Handle specific trade offer errors
                    if (err.message.includes("Trade URL is invalid")) {
                         console.error(`Trade URL for ${winner.username} is invalid.`);
                         io.to(winner.steamId).emit('notification', { type: 'error', message: 'Your Trade URL is invalid. Please update it.' });
                    } else if (err.eresult) {
                         console.error(`Error sending trade offer to ${winner.username}: EResult ${err.eresult}`);
                         // Refer to Steam EResult codes for specific issues (inventory private, trade ban etc.)
                    } else {
                         console.error(`Error sending trade offer to ${winner.username}:`, err);
                    }
                    return reject(err);
                }
                resolve(status);
            });
        });

        console.log(`Trade offer ${offer.id} sent to ${winner.username}. Status: ${offerStatus}`);

        // Consider tracking the offer state (accepted, declined, expired) using manager events ('sentOfferChanged')
         io.emit('tradeOfferSent', {
            roundId: round.roundId,
            userId: winner._id,
            username: winner.username,
            offerId: offer.id,
            status: offerStatus // e.g., "pending", "sent"
        });

    } catch (err) {
        console.error(`Failed to send winning trade offer for round #${round.roundId}:`, err);
        // Implement retry logic or manual intervention steps
        // Notify admin/support
    }
}

// --- Real-time Item Pricing Function ---
// Cache price data with a 10-minute TTL
const priceCache = new NodeCache({ stdTTL: 600 });

/**
 * Get real-time price for a Rust skin using Pricempire API
 * @param {string} marketHashName - The market hash name of the item
 * @returns {Promise<number>} - The item price in USD
 */
async function getItemPrice(marketHashName) {
    try {
        // Check cache first to avoid unnecessary API calls
        const cachedPrice = priceCache.get(marketHashName);
        if (cachedPrice !== undefined) {
            return cachedPrice;
        }

        // No cached price, fetch from API
        console.log(`Fetching price for: ${marketHashName}`);
        
        const response = await axios.get('https://api.pricempire.com/v2/items/rust_item', {
            params: {
                name: marketHashName,
                currency: 'USD'
            },
            headers: {
                'X-API-Key': process.env.PRICEMPIRE_API_KEY
            }
        });

        if (response.data && response.data.price) {
            const price = response.data.price.steam || 
                          response.data.price.avg || 
                          response.data.price.suggested || 
                          0;
            
            // Cache the result
            priceCache.set(marketHashName, price);
            
            return price;
        }
        
        // Fallback to minimum price if item not found
        console.warn(`No price data found for: ${marketHashName}, using fallback price`);
        return getFallbackPrice(marketHashName);
        
    } catch (error) {
        console.error(`Error fetching price for ${marketHashName}:`, error.message);
        return getFallbackPrice(marketHashName);
    }
}

/**
 * Fallback pricing function for when API calls fail
 */
function getFallbackPrice(marketHashName) {
    // Database of common items with baseline prices
    const commonItems = {
        'Metal Chest Plate': 5.20,
        'Semi-Automatic Rifle': 10.00,
        'Garage Door': 3.50,
        // Add more common items
    };
    
    return commonItems[marketHashName] || 0.50; // Default minimum value
}

// --- Authentication Routes ---
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));

app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect home or to a specific page.
        res.redirect('/'); // Redirect to frontend root
    }
);

app.post('/logout', (req, res, next) => { // Changed to POST for better practice
    req.logout(err => {
        if (err) { return next(err); }
        req.session.destroy(err => { // Also destroy session data
             if (err) {
                  console.error("Session destruction error during logout:", err);
                  return res.status(500).json({ success: false, error: 'Logout failed' });
             }
             res.clearCookie('connect.sid'); // Clear the session cookie
             res.json({ success: true, message: 'Logged out successfully' });
        });
    });
});

// Middleware to ensure user is authenticated for protected routes
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
}

// --- API Routes ---

// Get current user info
app.get('/api/user', ensureAuthenticated, (req, res) => {
    // Return relevant user data (avoid sending sensitive info if any)
    const { _id, steamId, username, avatar, tradeUrl, balance, createdAt } = req.user;
    res.json({ _id, steamId, username, avatar, tradeUrl, balance, createdAt });
});

// Update user's Trade URL
app.post('/api/user/tradeurl', ensureAuthenticated, async (req, res) => {
    const { tradeUrl } = req.body;

    // Basic validation (can be improved with regex)
    if (!tradeUrl || typeof tradeUrl !== 'string' || !tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
        return res.status(400).json({ error: 'Invalid Trade URL format' });
    }
    // Further validation: Check partner and token parameters exist
     try {
        const url = new URL(tradeUrl);
        if (!url.searchParams.get('partner') || !url.searchParams.get('token')) {
            return res.status(400).json({ error: 'Invalid Trade URL format (missing parameters)' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid Trade URL format' });
    }


    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.tradeUrl = tradeUrl;
        await user.save();
        console.log(`Updated trade URL for ${user.username}`);
        res.json({ success: true, tradeUrl: user.tradeUrl });
    } catch (err) {
        console.error(`Error updating trade URL for user ${req.user._id}:`, err);
        res.status(500).json({ error: 'Server error updating trade URL' });
    }
});

// Get user's Steam inventory (for depositing)
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
    try {
        // Promisify the callback function
        const inventory = await new Promise((resolve, reject) => {
            manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                 if (err) {
                      // Handle specific errors like profile private
                      if (err.message.includes('profile is private')) {
                           console.log(`Inventory fetch failed for ${req.user.username}: Profile private`);
                           return reject(new Error('Your Steam inventory is private. Please set it to public.'));
                      }
                      console.error(`Error fetching inventory for ${req.user.steamId}:`, err);
                      return reject(new Error('Could not fetch Steam inventory.'));
                 }
                 resolve(inv);
            });
        });

        if (!inventory) {
             return res.json([]); // Return empty array if inventory is empty or inaccessible
        }

        // Transform inventory data, fetching prices (using real-time pricing API)
        const itemsWithPrices = await Promise.all(inventory.map(async (item) => {
            const price = await getItemPrice(item.market_hash_name);
            return {
                assetId: item.assetid,
                name: item.market_hash_name, // Use market_hash_name for pricing lookup
                displayName: item.name, // Display name might be different
                image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                price: price || 0, // Ensure price is a number
                tradable: item.tradable,
                marketable: item.marketable,
                // Add other relevant details if needed
            };
        }));

        const validItems = itemsWithPrices.filter(item => 
            item.tradable && 
            item.price >= (parseFloat(process.env.MIN_ITEM_VALUE) || 0.10)
        );

        res.json(validItems);

    } catch (err) {
        console.error(`Error in /api/inventory for ${req.user.username}:`, err.message);
        // Send back the specific error message from the promise rejection if available
        res.status(500).json({ error: err.message || 'Server error fetching inventory' });
    }
});
