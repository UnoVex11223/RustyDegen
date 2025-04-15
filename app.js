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
require('dotenv').config();

// --- Configuration Constants ---
const RUST_APP_ID = 252490;
const RUST_CONTEXT_ID = 2;
const ROUND_DURATION = 120; // 2 minutes
const TICKET_VALUE_RATIO = 0.01; // e.g., 1 ticket per $0.01 value
const DEPOSIT_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for deposit token validity
const PRICE_CACHE_TTL_SECONDS = 10 * 60; // Cache prices for 10 minutes (600 seconds)

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
     domain: process.env.SITE_URL.replace(/^https?:\/\//, ''), // Domain name from your site URL
     language: 'en',
     pollInterval: 15000, // Poll for new offers every 15 seconds
     cancelTime: 10 * 60 * 1000, // Cancel outgoing offers after 10 mins
});

// --- Function to generate Steam Guard code ---
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
         } else {
             console.log('Steam bot logged in successfully.');
             manager.setCookies(cookies, err => {
                 if (err) {
                     console.error('Error setting Trade Offer Manager cookies:', err);
                     return;
                 }
                 console.log('Trade Offer Manager cookies set.');
                 community.setCookies(cookies); // Also set cookies for community instance

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
                 community.gamesPlayed(process.env.SITE_NAME || 'RustyDegen'); // Use SITE_NAME from .env or default
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

// Made async to handle await User.findOne
async function verifyDepositToken(token, partnerSteamId) {
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

     try {
         // Find user by partnerSteamId to compare MongoDB _id
         const user = await User.findOne({ steamId: partnerSteamId });
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
     } catch (err) {
         console.error(`Error finding user for token ${token} verification:`, err);
         return null;
     }
}

// --- Pricing Cache and Functions ---
// Initialize cache with specified TTL
const priceCache = new NodeCache({ stdTTL: PRICE_CACHE_TTL_SECONDS });

/**
 * Fallback pricing function for when API calls fail or item not found.
 * Maintains a small list of common items.
 */
function getFallbackPrice(marketHashName) {
    // Basic fallback prices for common Rust items - expand this list as needed
    const commonItems = {
        'Metal Chest Plate': 5.20,
        'Semi-Automatic Rifle': 10.00,
        'Garage Door': 3.50,
        'Assault Rifle': 8.50,
        'Metal Facemask': 6.00,
        'Road Sign Kilt': 1.50,
        'Coffee Can Helmet': 1.20,
        'Double Barrel Shotgun': 0.80,
        'Revolver': 0.50,
        'Sheet Metal Door': 0.75,
        'Medical Syringe': 0.15,
        'MP5A4': 2.50,
        'Python Revolver': 1.80,
        'Satchel Charge': 0.60
    };
    const fallback = commonItems[marketHashName];
    const minItemValue = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10; // Use min value from env

    if (fallback !== undefined) {
        console.warn(`Using fallback price $${fallback.toFixed(2)} for: ${marketHashName}`);
        // Ensure fallback isn't below absolute minimum unless it's intentionally 0
        return Math.max(fallback, minItemValue > 0 ? minItemValue : 0);
    } else {
        console.warn(`No fallback price found for: ${marketHashName}, returning site minimum value $${minItemValue.toFixed(2)}.`);
        return minItemValue > 0 ? minItemValue : 0; // Return minimum, or 0 if min value is 0 or less
    }
}

/**
 * Get real-time price for a Rust skin using Pricempire API.
 * Uses caching and fallback pricing.
 * @param {string} marketHashName - The market hash name of the item
 * @returns {Promise<number>} - The item price in USD
 */
async function getItemPrice(marketHashName) {
    const apiKey = process.env.PRICEMPIRE_API_KEY;
    if (!apiKey) {
        console.error("PRICEMPIRE_API_KEY not set in .env. Using fallback pricing.");
        return getFallbackPrice(marketHashName); // Return fallback immediately
    }

    try {
        // Check cache first
        const cachedPrice = priceCache.get(marketHashName);
        if (cachedPrice !== undefined) {
            return cachedPrice; // Return cached value if found
        }

        // Fetch from API if not in cache
        console.log(`Workspaceing price via Pricempire for: ${marketHashName}`);
        const response = await axios.get('https://api.pricempire.com/v2/items/rust_item', {
            params: {
                name: marketHashName,
                currency: 'USD'
            },
            headers: {
                'X-API-Key': apiKey,
                'Accept': 'application/json'
            },
            timeout: 5000 // 5 second timeout for the API call
        });

        // Process the response
        if (response.data && response.data.price) {
            const priceData = response.data.price;
            // Prioritize Steam price, then average, then suggested
            let price = priceData.steam || priceData.avg || priceData.suggested || 0;

            // Validate and parse the price
            price = parseFloat(price);
            if (isNaN(price) || price < 0) {
                price = 0; // Treat invalid numbers as 0 before fallback
            }

            if (price > 0) {
                console.log(`API price for ${marketHashName}: $${price.toFixed(2)}`);
                priceCache.set(marketHashName, price); // Cache the valid price
                return price;
            } else {
                console.warn(`API returned zero or invalid price for: ${marketHashName}. Using fallback.`);
                return getFallbackPrice(marketHashName);
            }
        }

        // Fallback if item not found in API response or structure is unexpected
        console.warn(`No valid price data found in API response for: ${marketHashName}. Using fallback.`);
        return getFallbackPrice(marketHashName);

    } catch (error) {
        // Handle various API call errors
        if (error.response) {
            console.error(`Error fetching price for ${marketHashName} - Status: ${error.response.status}, Data:`, error.response.data);
        } else if (error.request) {
            console.error(`Error fetching price for ${marketHashName}: No response received.`, error.message);
        } else {
            console.error(`Error setting up request for ${marketHashName}:`, error.message);
        }
        return getFallbackPrice(marketHashName); // Use fallback on any error
    }
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
        setTimeout(createNewRound, 10000); // Try again in 10 seconds
    }
}

function startRoundTimer() {
    if (roundTimer) {
        clearInterval(roundTimer); // Clear previous timer if any
    }
    if (!currentRound || !currentRound.startTime) { // Ensure currentRound and startTime exist
        console.error("Attempted to start timer with no current round or no start time.");
        // Attempt to fix or return
        if(currentRound && !currentRound.startTime) {
            currentRound.startTime = new Date();
        } else {
           return;
        }
    }

    // Calculate end time based on ROUND_DURATION from the start time
    currentRound.endTime = new Date(currentRound.startTime.getTime() + ROUND_DURATION * 1000);
    currentRound.save().catch(err => console.error("Error saving round end time:", err)); // Save end time

    let timeLeft = ROUND_DURATION;

    io.emit('timeUpdate', { timeLeft }); // Emit initial time

    roundTimer = setInterval(async () => {
        if (!currentRound || !currentRound.endTime) { // Check again inside interval
             clearInterval(roundTimer);
             roundTimer = null;
             console.error("Round timer interval running without valid currentRound or endTime.");
             return;
         }
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
        const totalTickets = round.participants.reduce((sum, p) => sum + (p?.tickets || 0), 0); // Safe sum
        if (totalTickets <= 0) {
            throw new Error(`Round #${round.roundId} has participants but zero total tickets.`);
        }

        round.winningTicket = decimal % totalTickets;

        // Find the winner
        let ticketCounter = 0;
        let winner = null;
        for (const participant of round.participants) {
            if (!participant || typeof participant.tickets !== 'number') continue; // Skip invalid entries
            ticketCounter += participant.tickets;
            if (round.winningTicket < ticketCounter) {
                winner = participant.user; // This is the populated User object
                break;
            }
        }

        if (!winner) {
            // Should be mathematically impossible if totalTickets > 0 and participants are valid
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
         // Consider emitting to a specific user socket if you map sockets to users
         // io.to(winner.steamId).emit('notification', { type: 'error', message: 'Please set your Trade URL in settings to receive winnings.' });
        return;
    }

    if (!round.items || round.items.length === 0) {
        console.warn(`Round #${round.roundId} has no items to send to winner ${winner.username}.`);
        return; // Nothing to send
    }
    // Ensure manager is initialized before attempting to use it
    if (!manager || !community.steamID) {
         console.error(`Cannot send trade offer for round #${round.roundId}: Bot is not logged in or Trade Offer Manager not ready.`);
         return;
    }

    try {
        const offer = manager.createOffer(winner.tradeUrl);

        const itemsToAdd = round.items.map(item => ({
            assetid: item.assetId, // Use assetId from the Item document
            appid: RUST_APP_ID,
            contextid: RUST_CONTEXT_ID
        }));

        // You might want to load the bot's inventory here and verify item ownership
        // before adding to the offer to prevent errors, but it adds complexity.

        offer.addMyItems(itemsToAdd); // Use addMyItems for array

        offer.setMessage(`Congratulations on winning Round #${round.roundId} on ${process.env.SITE_NAME || 'RustyDegen'}!`); // Use SITE_NAME

        // Promisify offer sending for async/await
        const offerStatus = await new Promise((resolve, reject) => {
            offer.send((err, status) => {
                if (err) {
                    // Handle specific trade offer errors
                    if (err.message.includes("Trade URL is invalid")) {
                        console.error(`Trade URL for ${winner.username} is invalid.`);
                        // io.to(winner.steamId).emit('notification', { type: 'error', message: 'Your Trade URL is invalid. Please update it.' });
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
             res.clearCookie('connect.sid'); // Clear the session cookie (default name)
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
      // Check if manager is ready
      if (!manager || !community.steamID) {
        console.error("Inventory API called but Trade Offer Manager is not initialized or bot not logged in.");
        return res.status(503).json({ error: "Trade service temporarily unavailable." });
      }
     try {
         // Promisify the callback function
         const inventory = await new Promise((resolve, reject) => {
             manager.getUserInventoryContents(req.user.steamId, RUST_APP_ID, RUST_CONTEXT_ID, true, (err, inv) => {
                 if (err) {
                     // Handle specific errors like profile private
                     if (err.message && err.message.includes('profile is private')) { // Check if err.message exists
                         console.log(`Inventory fetch failed for ${req.user.username}: Profile private`);
                         return reject(new Error('Your Steam inventory is private. Please set it to public.'));
                     }
                     console.error(`Error fetching inventory for ${req.user.steamId}:`, err);
                     return reject(new Error('Could not fetch Steam inventory. Steam might be down or your profile is private.'));
                 }
                 resolve(inv || []); // Ensure resolution with an array
             });
         });

         if (!inventory || inventory.length === 0) {
             return res.json([]); // Return empty array if inventory is empty or inaccessible
         }

         // Transform inventory data, fetching prices using the real API function
         const itemsWithPrices = await Promise.all(inventory.map(async (item) => {
             const price = await getItemPrice(item.market_hash_name); // Use REAL pricing function
             return {
                 assetId: item.assetid,
                 name: item.market_hash_name, // Use market_hash_name for pricing lookup
                 displayName: item.name, // Display name might be different
                 image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                 price: price || 0, // Ensure price is a number (getItemPrice should handle fallback)
                 tradable: item.tradable,
                 marketable: item.marketable,
             };
         }));

         // Filter for tradable items above the minimum value AFTER prices are fetched
         const minItemValue = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10;
         const validItems = itemsWithPrices.filter(item =>
             item.tradable &&
             item.price >= minItemValue
         );

         res.json(validItems);

     } catch (err) {
         console.error(`Error in /api/inventory for ${req.user?.username}:`, err.message); // Safe navigation
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

// Only attach listeners if manager seems ready (logged in)
if (manager && community.steamID) {
    manager.on('newOffer', async (offer) => { // Added async
        console.log(`Received new trade offer #${offer.id} from ${offer.partner.getSteamID64()}`);

        // Basic validation
        if (offer.isOurOffer || offer.itemsToReceive.length === 0 || !offer.message) {
            console.log(`Offer #${offer.id} is not a valid potential deposit. Declining/Ignoring.`);
            if (!offer.isOurOffer) {
                return offer.decline(err => {
                    if (err) console.error(`Error declining invalid potential deposit offer #${offer.id}:`, err);
                });
            }
            return; // Ignore our own offers here
        }

        // Round status check
        if (!currentRound || currentRound.status !== 'active' || isRolling) {
            console.log(`Offer #${offer.id} received while deposits are closed. Declining.`);
            return offer.decline(err => {
                if (err) console.error(`Error declining offer #${offer.id} during closed deposits:`, err);
            });
        }

        // Verify Token
        const token = offer.message.trim();
        let user;
        try {
            user = await verifyDepositToken(token, offer.partner.getSteamID64()); // Use await
            if (!user) {
                console.log(`Offer #${offer.id} has invalid or expired token. Declining.`);
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

        console.log(`Offer #${offer.id} is a valid deposit from ${user.username}. Processing item prices...`);

        try {
            // --- Process Items and Get Prices Concurrently ---
            const itemPricePromises = offer.itemsToReceive.map(async (item) => {
                if (!item.market_hash_name) {
                    console.warn(`Item asset ${item.assetid} in offer ${offer.id} is missing market_hash_name. Skipping.`);
                    return null;
                }
                const price = await getItemPrice(item.market_hash_name); // Use REAL pricing function with await
                const itemValue = parseFloat(price) || 0;
                const minItemValue = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10;

                if (itemValue < minItemValue) {
                    console.log(`Item ${item.market_hash_name} value $${itemValue.toFixed(2)} is below minimum $${minItemValue.toFixed(2)}. Skipping.`);
                    return null;
                }
                return { // Return data needed for DB insert
                    assetId: item.assetid,
                    name: item.market_hash_name,
                    image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                    price: itemValue,
                    owner: user._id,
                    roundId: currentRound._id // Link to current round at time of validation
                };
            });

            const itemsToProcess = (await Promise.all(itemPricePromises)).filter(item => item !== null);
            const depositTotalValue = itemsToProcess.reduce((sum, item) => sum + item.price, 0);

            if (itemsToProcess.length === 0) {
                console.log(`Offer #${offer.id} from ${user.username} contained no valid items above minimum value after pricing. Declining.`);
                return offer.decline(err => {
                    if (err) console.error(`Error declining offer #${offer.id} with no valid items:`, err);
                });
            }

            console.log(`Offer #${offer.id} total value $${depositTotalValue.toFixed(2)}. Attempting acceptance...`);

            // --- Accept the Offer ---
            offer.accept(async (err, status) => { // Added async
                if (err) {
                    console.error(`Error accepting trade offer #${offer.id} from ${user.username}:`, err);
                     if (err.message && err.message.includes('escrow')) { // Check message exists
                         console.warn(`Offer #${offer.id} resulted in escrow. Deposit not completed.`);
                     }
                    return; // Don't proceed if acceptance failed
                }
                console.log(`Trade offer #${offer.id} accepted. Status: ${status}. Processing database updates...`);

                // --- Process Items Post-Acceptance ---
                 // Re-fetch round to prevent race conditions with round ending
                 const latestRound = await Round.findById(currentRound._id);
                 if (!latestRound || latestRound.status !== 'active' || isRolling) {
                     console.error(`CRITICAL: Round changed/ended after accepting offer #${offer.id} but before DB update! Items received for potentially wrong round.`);
                     // !! Manual intervention needed: Return items or credit manually !!
                     // Log extensive details: offer.id, user.steamId, itemsToProcess, depositTotalValue, latestRound?.status, latestRound?.roundId
                     return;
                 }

                try {
                    // 1. Create Item documents in DB
                    const createdItems = await Item.insertMany(itemsToProcess);
                    const createdItemIds = createdItems.map(item => item._id);

                    // 2. Update the Round document (use latestRound fetched)
                    latestRound.items.push(...createdItemIds);
                    latestRound.totalValue += depositTotalValue;

                    // 3. Update Participant Data
                    const ticketsEarned = Math.max(0, Math.floor(depositTotalValue / TICKET_VALUE_RATIO)); // Ensure non-negative
                    const participantIndex = latestRound.participants.findIndex(p => p.user && p.user.equals(user._id)); // Add check for p.user

                    if (participantIndex > -1) {
                        // User already participated, update their entry
                        latestRound.participants[participantIndex].itemsValue += depositTotalValue;
                        latestRound.participants[participantIndex].tickets += ticketsEarned;
                    } else {
                        // New participant
                        latestRound.participants.push({
                            user: user._id,
                            itemsValue: depositTotalValue,
                            tickets: ticketsEarned
                        });
                    }

                    await latestRound.save();
                    currentRound = latestRound; // Update global reference ONLY after successful save

                    // 4. Emit Socket Events
                    const participantData = latestRound.participants.find(p => p.user && p.user.equals(user._id)); // Add check for p.user
                    io.emit('participantUpdated', {
                        roundId: latestRound.roundId,
                        userId: user._id,
                        username: user.username,
                        avatar: user.avatar,
                        itemsValue: participantData?.itemsValue || 0, // Safe navigation
                        tickets: participantData?.tickets || 0, // Safe navigation
                        totalValue: latestRound.totalValue // Send updated total value
                    });
                    // Emit individual item deposits if needed for frontend animation
                     createdItems.forEach(item => {
                         io.emit('itemDeposited', {
                             roundId: latestRound.roundId,
                             item: { id: item._id, name: item.name, image: item.image, price: item.price },
                             user: { id: user._id, username: user.username, avatar: user.avatar }
                         });
                     });

                    console.log(`Successfully processed deposit for offer #${offer.id}. User: ${user.username}, Value: ${depositTotalValue.toFixed(2)}, Items: ${createdItems.length}`);

                } catch (dbError) {
                    console.error(`CRITICAL: Database error after accepting offer #${offer.id}. Items received but DB update failed!`, dbError);
                    // !! Requires manual intervention !!
                     // Log details: offer.id, user.steamId, itemsToProcess, depositTotalValue
                    if (currentRound) { // Attempt to mark the potentially stale round as error
                        await Round.updateOne({ _id: currentRound._id }, { $set: { status: 'error' } }).catch(err => console.error("Failed to save error status to round:", err));
                        io.emit('roundError', { roundId: currentRound.roundId, error: 'Deposit processing error. Please contact support.' });
                    }
                }
            }); // End offer.accept callback

        } catch (processingError) {
            console.error(`Error processing item prices for offer #${offer.id} before acceptance:`, processingError);
             return offer.decline(err => { // Decline if pre-acceptance processing fails
                 if (err) console.error(`Error declining offer #${offer.id} after processing error:`, err);
             });
        }
    }); // End manager.on('newOffer')

    manager.on('sentOfferChanged', (offer, oldState) => {
        console.log(`Offer #${offer.id} state changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);
        // Handle winner payout confirmation/failure (e.g., update round status if Accepted)
    });
} else {
    console.warn("Trade Offer Manager (manager) not initialized or bot not logged in. Trade event listeners are inactive.");
}


// --- Round Info API Routes --- (Keep as they were)
app.get('/api/round/current', async (req, res) => {
    if (!currentRound || !currentRound._id) {
        return res.status(404).json({ error: 'No active round currently.' });
    }
    try {
        const round = await Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId')
            .populate('items', 'name image price owner')
            .lean();
        if (!round) {
            currentRound = null;
            console.warn("Current round ID existed but document not found in DB for API.");
            return res.status(404).json({ error: 'Current round data inconsistency found. Please refresh.' });
        }
        const now = Date.now();
        const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - now) / 1000)) : 0;
        res.json({
            roundId: round.roundId, status: round.status, startTime: round.startTime,
            endTime: round.endTime, timeLeft: timeLeft, totalValue: round.totalValue,
            serverSeedHash: round.serverSeedHash,
            participants: round.participants.map(p => ({
                user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null,
                itemsValue: p.itemsValue, tickets: p.tickets
            })).filter(p => p.user),
            items: round.items.map(item => ({
                id: item._id, name: item.name, image: item.image, price: item.price, owner: item.owner
            })),
            winner: round.winner, winningTicket: round.status === 'completed' ? round.winningTicket : null,
            serverSeed: round.status === 'completed' ? round.serverSeed : null,
            clientSeed: round.status === 'completed' ? round.clientSeed : null,
            provableHash: round.status === 'completed' ? round.provableHash : null,
        });
    } catch (err) {
        console.error('Error fetching current round data:', err);
        res.status(500).json({ error: 'Server error fetching round data' });
    }
});

app.get('/api/rounds', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const roundsQuery = Round.find({ status: { $in: ['completed', 'error'] } })
            .sort('-roundId').skip(skip).limit(limit)
            .populate('winner', 'username avatar steamId')
            .select('roundId startTime endTime completedTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket provableHash status participants items')
            .lean();
        const countQuery = Round.countDocuments({ status: { $in: ['completed', 'error'] } });
        const [rounds, count] = await Promise.all([roundsQuery, countQuery]);
        rounds.forEach(round => {
            round.totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0;
            round.itemCount = round.items?.length ?? 0;
            delete round.participants; delete round.items;
        });
        res.json({ rounds, totalPages: Math.ceil(count / limit), currentPage: page, totalRounds: count });
    } catch (err) {
        console.error('Error fetching round history:', err);
        res.status(500).json({ error: 'Server error fetching round history' });
    }
});

app.post('/api/verify', async (req, res) => {
    const { roundId, serverSeed, clientSeed } = req.body;
    if (!roundId || !serverSeed || !clientSeed) {
        return res.status(400).json({ error: 'Missing roundId, serverSeed, or clientSeed' });
    }
    try {
        const round = await Round.findOne({ roundId: roundId, status: 'completed' })
            .populate('participants.user', 'username').populate('winner', 'username');
        if (!round) {
            return res.status(404).json({ error: 'Completed round not found or required data missing.' });
        }
        const calculatedServerHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        if (calculatedServerHash !== round.serverSeedHash) {
            return res.json({ verified: false, reason: 'Server seed hash mismatch.' /* ... other fields */ });
        }
        if (serverSeed !== round.serverSeed || clientSeed !== round.clientSeed) {
            return res.json({ verified: false, reason: 'Provided seeds do not match stored seeds.' });
        }
        const combinedSeed = serverSeed + clientSeed;
        const calculatedProvableHash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
        const decimal = parseInt(calculatedProvableHash.substring(0, 8), 16);
        const totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0;
        if (totalTickets <= 0) {
            return res.json({ verified: false, reason: 'Round had zero total tickets.' });
        }
        const calculatedWinningTicket = decimal % totalTickets;
        if (calculatedWinningTicket !== round.winningTicket) {
            return res.json({ verified: false, reason: 'Calculated winning ticket does not match stored ticket.' /* ... other fields */ });
        }
        res.json({
            verified: true, roundId: round.roundId, serverSeed: serverSeed,
            serverSeedHash: round.serverSeedHash, clientSeed: clientSeed,
            combinedHash: calculatedProvableHash, winningTicket: calculatedWinningTicket,
            totalTickets: totalTickets, totalValue: round.totalValue,
            winnerUsername: round.winner?.username || 'N/A'
        });
    } catch (err) {
        console.error(`Error verifying round ${roundId}:`, err);
        res.status(500).json({ error: 'Server error during verification' });
    }
});


// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    if (currentRound && currentRound._id) {
        Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId')
            .populate('items', 'name image price owner')
            .lean()
            .then(round => {
                if (round) {
                    const now = Date.now();
                    const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - now) / 1000)) : 0;
                    socket.emit('roundData', {
                        roundId: round.roundId, status: round.status, timeLeft: timeLeft,
                        totalValue: round.totalValue, serverSeedHash: round.serverSeedHash,
                        participants: round.participants.map(p => ({
                            user: p.user ? { id: p.user._id, steamId: p.user.steamId, username: p.user.username, avatar: p.user.avatar } : null,
                            itemsValue: p.itemsValue, tickets: p.tickets
                        })).filter(p => p.user),
                        items: round.items.map(item => ({
                            id: item._id, name: item.name, image: item.image, price: item.price, owner: item.owner
                        }))
                    });
                } else {
                    console.warn(`Current round ref exists but doc not found for socket ${socket.id}.`);
                    socket.emit('noActiveRound');
                }
            })
            .catch(err => {
               console.error(`Error fetching current round for socket connect ${socket.id}:`, err);
               socket.emit('noActiveRound');
            });
    } else {
        socket.emit('noActiveRound');
    }

    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
    });
});

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Start first round after a small delay to allow bot login attempt
    setTimeout(() => {
       if (community.steamID) { // Check if bot login likely succeeded
           console.log("Server started, creating initial round...");
           createNewRound();
       } else {
           console.warn("Server started, but initial round creation skipped (bot not logged in).");
           // Maybe try again later or provide admin command?
       }
    }, 5000); // Wait 5 seconds for login attempt

    // Test Pricing API on startup
    setTimeout(async () => {
       console.log("Testing Pricing API on startup...");
       const testItem = "Metal Chest Plate"; // Example item
       try {
           const price = await getItemPrice(testItem);
           console.log(`TEST: Price for ${testItem}: ${price !== undefined ? `$${price.toFixed(2)}` : 'Error/Not Found'}`);
       } catch(e){ console.error("Error testing price API:", e);}
    }, 7000); // Test after 7 seconds
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false).then(() => { // Use promise version
            console.log('MongoDB connection closed');
            process.exit(0);
        }).catch(err => {
            console.error("Failed to close MongoDB connection:", err);
            process.exit(1);
        });
    });
     // Force exit after timeout
     setTimeout(() => {
        console.error('Graceful shutdown timed out, forcing exit.');
        process.exit(1);
     }, 10000); // 10 seconds timeout
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
   process.emit('SIGTERM'); // Trigger graceful shutdown
});

// Basic Error Handling Middleware (Add LAST)
app.use((err, req, res, next) => {
   console.error("Unhandled Error:", err.stack || err);
   // Avoid sending stack trace in production
   res.status(500).json({ error: 'Something went wrong on the server.' });
});
