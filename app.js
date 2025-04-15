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
            console.log('Continuing server startup despite Steam login failure...');
            // Start the server anyway
            console.log("Server started, but with limited functionality due to login failure");
            // Allow the app to continue without trade functionality
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

        // Transform inventory data, fetching prices (using placeholder)
        const itemsWithPrices = inventory.map(item => {
            const price = getItemPrice(item.market_hash_name); // Use placeholder
            return {
                assetId: item.assetid,
                name: item.market_hash_name, // Use market_hash_name for pricing lookup
                displayName: item.name, // Display name might be different
                image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                price: parseFloat(price) || 0, // Ensure price is a number
                tradable: item.tradable,
                marketable: item.marketable,
                // Add other relevant details if needed
            };
        }).filter(item => item.tradable && item.price > 0); // Filter for tradable items with some value

        res.json(itemsWithPrices);

    } catch (err) {
        console.error(`Error in /api/inventory for ${req.user.username}:`, err.message);
        // Send back the specific error message from the promise rejection if available
        res.status(500).json({ error: err.message || 'Server error fetching inventory' });
    }
});

// Initiate Deposit (generates token)
app.post('/api/deposit/initiate', ensureAuthenticated, (req, res) => {
    if (!process.env.BOT_TRADE_URL) {
         console.error("BOT_TRADE_URL is not set in .env");
         return res.status(500).json({ error: "Deposit service is currently unavailable." });
    }
    if (!currentRound || currentRound.status !== 'active') {
        return res.status(400).json({ error: 'Deposits are closed. No active round.' });
    }
     if (isRolling) {
        return res.status(400).json({ error: 'Deposits are closed. Round is currently rolling.' });
    }

    const token = generateDepositToken(req.user._id);

    res.json({
        success: true,
        depositToken: token,
        botTradeUrl: process.env.BOT_TRADE_URL // Send bot's trade URL to frontend
    });
});


// --- Trade Offer Manager Event Handling ---

// Handle incoming trade offers (DEPOSITS)
manager.on('newOffer', async (offer) => {
    console.log(`Received new trade offer #${offer.id} from ${offer.partner.getSteamID64()}`);

    // Process only incoming offers with items to receive and a message (potential token)
    if (offer.itemsToGive.length > 0 || offer.itemsToReceive.length === 0 || !offer.message) {
        console.log(`Offer #${offer.id} is not a valid deposit offer (itemsToGive > 0 or itemsToReceive = 0 or no message). Declining.`);
        return offer.decline(err => {
            if (err) console.error(`Error declining invalid offer #${offer.id}:`, err);
        });
    }

    // Check if a round is active and accepting deposits
     if (!currentRound || currentRound.status !== 'active' || isRolling) {
        console.log(`Offer #${offer.id} received while deposits are closed (Round status: ${currentRound?.status}, Rolling: ${isRolling}). Declining.`);
        return offer.decline(err => {
            if (err) console.error(`Error declining offer #${offer.id} during closed deposits:`, err);
        });
    }

    // --- Verify Security Token ---
    const token = offer.message.trim();
    let user;
    try {
        user = await verifyDepositToken(token, offer.partner.getSteamID64());
        if (!user) {
            console.log(`Offer #${offer.id} has invalid or expired token '${token}'. Declining.`);
             return offer.decline(err => {
                if (err) console.error(`Error declining offer #${offer.id} with invalid token:`, err);
            });
        }
    } catch (verificationError) {
         console.error(`Error verifying token for offer #${offer.id}:`, verificationError);
          return offer.decline(err => {
                if (err) console.error(`Error declining offer #${offer.id} due to verification error:`, err);
            });
    }

    // --- User and Round Validated - Process Items ---
    console.log(`Offer #${offer.id} is a valid deposit from ${user.username}. Processing...`);

    try {
        // Calculate total value and prepare item data before accepting
        let itemsToProcess = [];
        let depositTotalValue = 0;

        for (const item of offer.itemsToReceive) {
             // Important: Get the market_hash_name for pricing
             const itemInfo = await new Promise((resolve, reject) => {
                 manager.getInventoryContents(RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                      if (err) return reject(err);
                      const found = inv.find(invItem => invItem.assetid === item.assetid);
                      resolve(found);
                 });
             });

             if (!itemInfo || !itemInfo.market_hash_name) {
                 console.warn(`Could not get market_hash_name for asset ${item.assetid} in offer ${offer.id}. Skipping item.`);
                 continue; // Skip this item if essential info is missing
             }

             const price = getItemPrice(itemInfo.market_hash_name); // Use placeholder pricing
             const itemValue = parseFloat(price) || 0;

             if (itemValue <= 0) {
                  console.log(`Item ${itemInfo.market_hash_name} (${item.assetid}) has zero or invalid value. Skipping.`);
                  continue;
             }

             itemsToProcess.push({
                assetId: item.assetid,
                name: itemInfo.market_hash_name, // Use market name for consistency
                image: `https://community.akamai.steamstatic.com/economy/image/${itemInfo.icon_url}`,
                price: itemValue,
                owner: user._id, // Link to the depositing user
                roundId: currentRound._id // Link to the current round
            });
            depositTotalValue += itemValue;
        }

        if (itemsToProcess.length === 0) {
            console.log(`Offer #${offer.id} from ${user.username} contained no valid/valuable items. Declining.`);
            return offer.decline(err => {
                if (err) console.error(`Error declining offer #${offer.id} with no valid items:`, err);
            });
        }

        // --- Accept the Offer ---
        offer.accept(async (err, status) => {
            if (err) {
                console.error(`Error accepting trade offer #${offer.id} from ${user.username}:`, err);
                // TODO: Maybe re-validate token or handle specific errors?
                return;
            }
            console.log(`Trade offer #${offer.id} accepted. Status: ${status}`);

            // --- Process Items Post-Acceptance ---
            try {
                // 1. Create Item documents in DB
                const createdItems = await Item.insertMany(itemsToProcess);
                const createdItemIds = createdItems.map(item => item._id);

                // 2. Update the Round document
                const round = await Round.findById(currentRound._id);
                if (!round) throw new Error(`Current round ${currentRound._id} not found after accepting offer!`);

                round.items.push(...createdItemIds); // Add new item references
                round.totalValue += depositTotalValue; // Add value to round total

                // 3. Update Participant Data
                const ticketsEarned = Math.floor(depositTotalValue / TICKET_VALUE_RATIO);
                const participantIndex = round.participants.findIndex(p => p.user.equals(user._id));

                if (participantIndex > -1) {
                    // User already participated, update their entry
                    round.participants[participantIndex].itemsValue += depositTotalValue;
                    round.participants[participantIndex].tickets += ticketsEarned;
                } else {
                    // New participant
                    round.participants.push({
                        user: user._id,
                        itemsValue: depositTotalValue,
                        tickets: ticketsEarned
                    });
                }

                await round.save();
                currentRound = round; // Update global reference

                // 4. Emit Socket Events
                const participantData = round.participants.find(p => p.user.equals(user._id)); // Get updated data
                io.emit('participantUpdated', {
                    roundId: round.roundId,
                    userId: user._id,
                    username: user.username,
                    avatar: user.avatar,
                    itemsValue: participantData.itemsValue,
                    tickets: participantData.tickets,
                    totalValue: round.totalValue // Send updated total value
                });
                // Emit individual item deposits if needed for frontend animation
                 createdItems.forEach(item => {
                    io.emit('itemDeposited', {
                         roundId: round.roundId,
                         item: { id: item._id, name: item.name, image: item.image, price: item.price },
                         user: { id: user._id, username: user.username, avatar: user.avatar }
                    });
                 });


                console.log(`Successfully processed deposit for offer #${offer.id}. User: ${user.username}, Value: ${depositTotalValue.toFixed(2)}, Items: ${createdItems.length}`);

            } catch (dbError) {
                console.error(`CRITICAL: Database error after accepting offer #${offer.id}. Items received but not recorded!`, dbError);
                // !! Requires manual intervention !! Log details extensively.
                // You might need to manually add items/value to the round or return items to the user.
                // Consider changing round status to 'error'
                if (currentRound) {
                    currentRound.status = 'error';
                    await currentRound.save().catch(()=>{}); // Attempt to save error status
                    io.emit('roundError', { roundId: currentRound.roundId, error: 'Deposit processing error. Please contact support.' });
                }
            }
        });

    } catch (processingError) {
        console.error(`Error processing items for offer #${offer.id} before acceptance:`, processingError);
         return offer.decline(err => { // Decline if pre-acceptance processing fails
            if (err) console.error(`Error declining offer #${offer.id} after processing error:`, err);
        });
    }
});

manager.on('sentOfferChanged', (offer, oldState) => {
    console.log(`Offer #${offer.id} state changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);
    // You can use this to track if the winner accepted the items, or if the offer expired/was declined.
    // Useful for statistics or handling cases where the winner doesn't accept.
    // Example: If state becomes Accepted, maybe update winner status. If Declined/Expired, handle item return/support case.
});

// --- Round Info API Routes ---

// Get current round state
app.get('/api/round/current', async (req, res) => {
    if (!currentRound) {
        // Maybe fetch the latest non-completed round?
        return res.status(404).json({ error: 'No active round currently.' });
    }

    try {
         // Fetch fresh data, populate necessary fields
         const round = await Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId') // Select fields needed by frontend
            .populate('items', 'name image price owner'); // Populate basic item info

         if (!round) {
             return res.status(404).json({ error: 'Current round data not found.' });
         }

         const now = Date.now();
         const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((round.endTime.getTime() - now) / 1000)) : 0;

        res.json({
            roundId: round.roundId,
            status: round.status,
            startTime: round.startTime,
            endTime: round.endTime,
            timeLeft: timeLeft,
            totalValue: round.totalValue,
            serverSeedHash: round.serverSeedHash, // Hash shown before round ends
            participants: round.participants.map(p => ({
                user: p.user ? { // Check if user population worked
                    id: p.user._id,
                    steamId: p.user.steamId,
                    username: p.user.username,
                    avatar: p.user.avatar
                } : null, // Handle potential population errors
                itemsValue: p.itemsValue,
                tickets: p.tickets
            })).filter(p => p.user), // Filter out entries where user couldn't be populated
            items: round.items.map(item => ({
                id: item._id,
                name: item.name,
                image: item.image,
                price: item.price,
                owner: item.owner // Could populate owner username too if needed
            })),
             // Include revealed data if round is completed
            winner: round.winner, // Send winner ID if completed
            winningTicket: round.status === 'completed' ? round.winningTicket : null,
            serverSeed: round.status === 'completed' ? round.serverSeed : null,
            clientSeed: round.status === 'completed' ? round.clientSeed : null,
            provableHash: round.status === 'completed' ? round.provableHash : null,
        });
    } catch (err) {
        console.error('Error fetching current round data:', err);
        res.status(500).json({ error: 'Server error fetching round data' });
    }
});

// Get round history (paginated)
app.get('/api/rounds', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const rounds = await Round.find({ status: { $in: ['completed', 'error'] } }) // Find completed or error rounds
            .sort('-roundId') // Sort by latest round first
            .skip(skip)
            .limit(limit)
            .populate('winner', 'username avatar steamId') // Populate winner info
            .select('roundId startTime endTime completedTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket provableHash status participants items') // Select needed fields
            .lean(); // Use lean for faster read-only queries

         // Optionally calculate total tickets per round here if needed for display
         rounds.forEach(round => {
            round.totalTickets = round.participants.reduce((sum, p) => sum + p.tickets, 0);
            round.itemCount = round.items.length; // Add item count
            // Avoid sending full participant/item arrays if large
            // delete round.participants;
            // delete round.items;
         });


        const count = await Round.countDocuments({ status: { $in: ['completed', 'error'] } });

        res.json({
            rounds,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRounds: count
        });
    } catch (err) {
        console.error('Error fetching round history:', err);
        res.status(500).json({ error: 'Server error fetching round history' });
    }
});

// Verify round fairness (using data revealed after completion)
app.post('/api/verify', async (req, res) => {
    const { roundId, serverSeed, clientSeed } = req.body;

    if (!roundId || !serverSeed || !clientSeed) {
        return res.status(400).json({ error: 'Missing roundId, serverSeed, or clientSeed' });
    }

    try {
        const round = await Round.findOne({ roundId: roundId, status: 'completed' })
                                .populate('participants.user'); // Need participants for ticket total

        if (!round) {
            return res.status(404).json({ error: 'Completed round not found or data mismatch.' });
        }

        // 1. Verify Server Seed Hash
        const calculatedServerHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        if (calculatedServerHash !== round.serverSeedHash) {
            return res.json({
                verified: false,
                reason: 'Server seed hash mismatch.',
                providedSeed: serverSeed,
                expectedHash: round.serverSeedHash,
                calculatedHash: calculatedServerHash
            });
        }
         // Compare provided seeds with stored seeds
         if (serverSeed !== round.serverSeed || clientSeed !== round.clientSeed) {
              return res.json({
                 verified: false,
                 reason: 'Provided seeds do not match stored seeds for the completed round.'
             });
         }


        // 2. Recalculate Winning Ticket
        const combinedSeed = serverSeed + clientSeed; // Use provided (and now verified) seeds
        const calculatedProvableHash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
        const decimal = parseInt(calculatedProvableHash.substring(0, 8), 16);
        const totalTickets = round.participants.reduce((sum, p) => sum + p.tickets, 0);

        if (totalTickets <= 0) {
             return res.json({ verified: false, reason: 'Round had zero total tickets.'});
        }

        const calculatedWinningTicket = decimal % totalTickets;

        // 3. Compare with stored winning ticket
        if (calculatedWinningTicket !== round.winningTicket) {
            return res.json({
                verified: false,
                reason: 'Calculated winning ticket does not match stored ticket.',
                calculatedTicket: calculatedWinningTicket,
                expectedTicket: round.winningTicket,
                totalTickets: totalTickets,
                provableHash: calculatedProvableHash
            });
        }

        // If all checks pass
        res.json({
            verified: true,
            roundId: round.roundId,
            serverSeed: serverSeed,
            serverSeedHash: round.serverSeedHash,
            clientSeed: clientSeed,
            provableHash: calculatedProvableHash,
            winningTicket: calculatedWinningTicket,
            totalTickets: totalTickets,
            totalValue: round.totalValue
        });

    } catch (err) {
        console.error(`Error verifying round ${roundId}:`, err);
        res.status(500).json({ error: 'Server error during verification' });
    }
});


// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Send current round data immediately if available
    if (currentRound) {
         // Use the API logic structure to send consistent data
         Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId')
            .populate('items', 'name image price owner')
            .then(round => {
                if (round) {
                     const now = Date.now();
                     const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((round.endTime.getTime() - now) / 1000)) : 0;
                     socket.emit('roundData', { // Send initial state
                          roundId: round.roundId,
                          status: round.status,
                          timeLeft: timeLeft,
                          totalValue: round.totalValue,
                          serverSeedHash: round.serverSeedHash,
                          participants: round.participants.map(p => ({
                               user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null,
                               itemsValue: p.itemsValue,
                               tickets: p.tickets
                          })).filter(p => p.user),
                          items: round.items.map(item => ({
                               id: item._id, name: item.name, image: item.image, price: item.price, owner: item.owner
                          }))
                          // Don't send sensitive completed data on initial connect
                     });
                } else {
                     console.warn("Current round reference exists but document not found in DB for socket connect.");
                }
            })
            .catch(err => console.error('Error fetching current round for socket connect:', err));
    } else {
        // Maybe send an indication that no round is active or server is starting
        socket.emit('noActiveRound');
    }


    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
    });

     // Handle user joining rooms based on SteamID if needed for direct notifications
    // socket.on('joinUserRoom', (steamId) => {
    //     if (steamId) {
    //         console.log(`Socket ${socket.id} joining room for SteamID ${steamId}`);
    //         socket.join(steamId);
    //     }
    // });

});

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Start the first round only after ensuring bot login process has at least attempted
    if (steamLoginCredentials.twoFactorCode) { // Or maybe wait for successful login?
        console.log("Server started, creating initial round...");
        createNewRound();
    } else {
        console.warn("Server started, but initial round creation skipped due to bot login issues.");
    }
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
