// --- Assume necessary imports here ---
const express = require('express');
const http = require('http'); // Needed for creating server for Socket.IO
const mongoose = require('mongoose'); // Assuming Mongoose for models
const crypto = require('crypto'); // Used in verification
const TradeOfferManager = require('steam-tradeoffer-manager'); // For trade events
const { Server } = require("socket.io"); // For Socket.IO
require('dotenv').config(); // Load environment variables from .env file

// --- Assume Mongoose Models are required here ---
// const User = require('./models/User');
// const Round = require('./models/Round');
// const Item = require('./models/Item');

// --- Assume Helper Functions/Middleware are required here ---
// const { ensureAuthenticated } = require('./middleware/auth'); // Example path
// const { getItemPrice, getFallbackPrice } = require('./utils/pricing'); // Example path
// const { generateDepositToken, verifyDepositToken } = require('./utils/tokens'); // Example path
// const { createNewRound } = require('./utils/roundLogic'); // Example path

// --- Assume Constants are defined here ---
// const RUST_APP_ID = 730; // Example: CSGO App ID (replace with Rust's if different)
// const RUST_CONTEXT_ID = 2; // Standard context ID
// const TICKET_VALUE_RATIO = 0.01; // Example: $0.01 per ticket

// --- Database Connection (Example) ---
// mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//     .then(() => console.log('MongoDB Connected'))
//     .catch(err => console.error('MongoDB Connection Error:', err));

// --- Global State (Needs proper initialization logic, maybe on startup) ---
let currentRound = null;
let isRolling = false;

// Create an Express application instance
const app = express();

// --- Create HTTP Server and integrate Socket.IO ---
const server = http.createServer(app);
const io = new Server(server, {
    // Socket.IO options if needed (e.g., CORS)
    // cors: { origin: "YOUR_FRONTEND_URL", methods: ["GET", "POST"] }
});

// --- Trade Offer Manager Setup (Example - needs full configuration) ---
// const manager = new TradeOfferManager({
//     steam: client, // Assumes a logged-in steam-user client instance
//     domain: process.env.DOMAIN_NAME || "example.com", // Your domain name
//     language: "en",
//     pollInterval: 10000 // Poll every 10 seconds
//     // Add other necessary options like cancelTime, pendingCancelTime, etc.
// });
// --- Make sure 'manager' is properly initialized before its event listeners below ---
let manager; // Placeholder: Replace with your actual manager initialization

// --- Express Middleware ---
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Middleware for URL-encoded bodies (optional)
// --- Assume Session/Passport middleware is set up here if using ensureAuthenticated ---
// app.use(session({...}));
// app.use(passport.initialize());
// app.use(passport.session());
// --- Assume CORS middleware if frontend is on a different origin ---
// const cors = require('cors');
// app.use(cors({ origin: 'YOUR_FRONTEND_URL', credentials: true }));


// --- API Routes ---

// Update user's Trade URL
// Note: ensureAuthenticated needs to be defined/required correctly
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
        // Assume User model is defined and req.user is populated by ensureAuthenticated
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.tradeUrl = tradeUrl;
        await user.save();
        console.log(`Updated trade URL for ${user.username}`);
        res.json({ success: true, tradeUrl: user.tradeUrl });
    } catch (err) {
        console.error(`Error updating trade URL for user ${req.user?._id}:`, err); // Added safe navigation
        res.status(500).json({ error: 'Server error updating trade URL' });
    }
});

// Get user's Steam inventory (for depositing)
// Note: manager needs to be initialized, RUST_APP_ID/CONTEXT_ID defined
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
    if (!manager) return res.status(503).json({ error: "Trade service unavailable." }); // Check if manager is ready

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
                    return reject(new Error('Could not fetch Steam inventory. Steam might be down or your profile is private.')); // More informative error
                }
                // Ensure inv is an array even if empty
                resolve(inv || []);
            });
        });

        if (!inventory || inventory.length === 0) { // Check if inventory is null or empty
            return res.json([]); // Return empty array if inventory is empty or inaccessible
        }

        // Transform inventory data, fetching prices (using real-time pricing API)
        // Note: getItemPrice needs to be defined/required
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

        const minItemValue = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10;
        const validItems = itemsWithPrices.filter(item =>
            item.tradable &&
            item.price >= minItemValue
        );

        res.json(validItems);

    } catch (err) {
        console.error(`Error in /api/inventory for ${req.user?.username}:`, err.message); // Added safe navigation
        // Send back the specific error message from the promise rejection if available
        res.status(500).json({ error: err.message || 'Server error fetching inventory' });
    }
});

// Initiate Deposit (generates token)
// Note: generateDepositToken needs to be defined/required
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

    const token = generateDepositToken(req.user._id); // Assumes function exists

    res.json({
        success: true,
        depositToken: token,
        botTradeUrl: process.env.BOT_TRADE_URL // Send bot's trade URL to frontend
    });
});

// Get current round state
app.get('/api/round/current', async (req, res) => {
    if (!currentRound || !currentRound._id) { // Check if currentRound and its ID exist
        // Maybe fetch the latest non-completed round from DB?
        return res.status(404).json({ error: 'No active round currently.' });
    }

    try {
        // Fetch fresh data, populate necessary fields
        // Assume Round model is defined
        const round = await Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId') // Select fields needed by frontend
            .populate('items', 'name image price owner') // Populate basic item info
            .lean(); // Use lean for potentially better performance on reads

        if (!round) {
            // This case might mean currentRound holds an invalid ID
            currentRound = null; // Reset currentRound state
            console.warn("Current round ID existed but document not found in DB.");
            return res.status(404).json({ error: 'Current round data inconsistency found. Please refresh.' });
        }

        const now = Date.now();
        const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - now) / 1000)) : 0; // Ensure endTime is Date object

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

        const roundsQuery = Round.find({ status: { $in: ['completed', 'error'] } }) // Find completed or error rounds
            .sort('-roundId') // Sort by latest round first
            .skip(skip)
            .limit(limit)
            .populate('winner', 'username avatar steamId') // Populate winner info
            .select('roundId startTime endTime completedTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket provableHash status participants items') // Select needed fields
            .lean(); // Use lean for faster read-only queries

        const countQuery = Round.countDocuments({ status: { $in: ['completed', 'error'] } });

        const [rounds, count] = await Promise.all([roundsQuery, countQuery]);


        // Optionally calculate total tickets per round here if needed for display
        // Be careful with performance on large rounds if calculating tickets requires extra lookups
        rounds.forEach(round => {
            round.totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0; // Safe calculation
            round.itemCount = round.items?.length ?? 0; // Safe calculation
            // Avoid sending full participant/item arrays if large and not needed for list view
             delete round.participants; // Example: Remove potentially large arrays
             delete round.items;       // Example: Remove potentially large arrays
        });


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
            .populate('participants.user', 'username') // Need username for display
            .populate('winner', 'username'); // Need winner username too

        if (!round) {
            return res.status(404).json({ error: 'Completed round not found or required data missing.' }); // Modified error
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
        const totalTickets = round.participants?.reduce((sum, p) => sum + (p?.tickets || 0), 0) ?? 0; // Safe calculation

        if (totalTickets <= 0) {
            return res.json({ verified: false, reason: 'Round had zero total tickets according to stored data.' }); // Clarified error
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
            combinedHash: calculatedProvableHash, // Added combined hash
            winningTicket: calculatedWinningTicket,
            totalTickets: totalTickets,
            totalValue: round.totalValue,
            winnerUsername: round.winner?.username || 'N/A' // Include winner username
        });

    } catch (err) {
        console.error(`Error verifying round ${roundId}:`, err);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

// --- Trade Offer Manager Event Handling ---
// Ensure 'manager' is initialized before these handlers are attached

if (manager) { // Only attach listeners if manager is initialized
    // Handle incoming trade offers (DEPOSITS)
    manager.on('newOffer', async (offer) => {
        console.log(`Received new trade offer #${offer.id} from ${offer.partner.getSteamID64()}`);

        // Basic validation: Must be incoming, have items to receive, and have a message (token)
        if (offer.isOurOffer || offer.itemsToReceive.length === 0 || !offer.message) {
            console.log(`Offer #${offer.id} is not a valid potential deposit (Not incoming, no items to receive, or no message). Declining.`);
            // Only decline if it's not our offer already being tracked
            if (!offer.isOurOffer) {
                 return offer.decline(err => {
                    if (err) console.error(`Error declining invalid potential deposit offer #${offer.id}:`, err);
                 });
            } else {
                return; // Don't decline our own offers here
            }
        }

        // Check if a round is active and accepting deposits
        if (!currentRound || currentRound.status !== 'active' || isRolling) {
            console.log(`Offer #${offer.id} received while deposits are closed (Round status: ${currentRound?.status}, Rolling: ${isRolling}). Declining.`);
            return offer.decline(err => {
                if (err) console.error(`Error declining offer #${offer.id} during closed deposits:`, err);
            });
        }

        // --- Verify Security Token ---
        // Note: verifyDepositToken needs to be defined/required
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

            // It's generally better to get item details from the offer object itself if possible,
            // rather than making another inventory call. steam-tradeoffer-manager usually includes details.
            for (const item of offer.itemsToReceive) {
                 // Use market_hash_name directly if available, otherwise log warning
                if (!item.market_hash_name) {
                     console.warn(`Item asset ${item.assetid} in offer ${offer.id} is missing market_hash_name. Attempting lookup might be needed, or skip.`);
                     // Optionally, try a lookup here if critical, but it adds complexity/delay
                     continue; // Skipping for now if name is missing
                }

                const price = await getItemPrice(item.market_hash_name); // Use real-time pricing
                const itemValue = parseFloat(price) || 0;

                // Check against minimum item value AFTER getting price
                const minItemValue = parseFloat(process.env.MIN_ITEM_VALUE) || 0.10;
                 if (itemValue < minItemValue) {
                     console.log(`Item ${item.market_hash_name} (${item.assetid}) value $${itemValue.toFixed(2)} is below minimum $${minItemValue.toFixed(2)}. Skipping.`);
                     continue;
                 }

                itemsToProcess.push({
                    assetId: item.assetid,
                    name: item.market_hash_name, // Use market name for consistency
                    image: `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`,
                    price: itemValue,
                    owner: user._id, // Link to the depositing user
                    roundId: currentRound._id // Link to the current round
                });
                depositTotalValue += itemValue;
            }

            if (itemsToProcess.length === 0) {
                console.log(`Offer #${offer.id} from ${user.username} contained no valid items above minimum value. Declining.`);
                return offer.decline(err => {
                    if (err) console.error(`Error declining offer #${offer.id} with no valid items:`, err);
                });
            }

            // --- Accept the Offer ---
            offer.accept(async (err, status) => {
                if (err) {
                    console.error(`Error accepting trade offer #${offer.id} from ${user.username}:`, err);
                    // Handle escrow, trade bans, etc.
                    if (err.message.includes('escrow')) {
                         console.warn(`Offer #${offer.id} resulted in escrow. Deposit not completed.`);
                         // Maybe notify user?
                    }
                     // Don't proceed with DB updates if acceptance failed
                    return;
                }
                console.log(`Trade offer #${offer.id} accepted. Status: ${status}`);

                // --- Process Items Post-Acceptance ---
                // Ensure we have the latest round data, especially if rounds change quickly
                const latestRound = await Round.findById(currentRound._id);
                if (!latestRound || latestRound.status !== 'active' || isRolling) {
                    console.error(`CRITICAL: Round changed/ended after accepting offer #${offer.id} but before DB update. Items received for wrong round or closed round!`);
                    // !! Requires manual intervention !! Return items to user or credit manually.
                    // Log everything: offer ID, user, items, values, intended round, actual round state.
                    return; // Stop processing for this offer
                }


                try {
                    // 1. Create Item documents in DB
                    // Assume Item model is defined
                    const createdItems = await Item.insertMany(itemsToProcess);
                    const createdItemIds = createdItems.map(item => item._id);

                    // 2. Update the Round document (use latestRound)
                    latestRound.items.push(...createdItemIds); // Add new item references
                    latestRound.totalValue += depositTotalValue; // Add value to round total

                    // 3. Update Participant Data
                    // Note: TICKET_VALUE_RATIO needs to be defined
                    const ticketsEarned = Math.max(0, Math.floor(depositTotalValue / TICKET_VALUE_RATIO)); // Ensure non-negative tickets
                    const participantIndex = latestRound.participants.findIndex(p => p.user && p.user.equals(user._id)); // Check p.user exists

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
                    currentRound = latestRound; // Update global reference

                    // 4. Emit Socket Events
                    const participantData = latestRound.participants.find(p => p.user && p.user.equals(user._id)); // Get updated data, check p.user
                    io.emit('participantUpdated', {
                        roundId: latestRound.roundId,
                        userId: user._id,
                        username: user.username,
                        avatar: user.avatar,
                        itemsValue: participantData?.itemsValue || 0, // Use safe navigation
                        tickets: participantData?.tickets || 0,       // Use safe navigation
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
                    // !! Requires manual intervention !! Log details extensively.
                    // Manually add items/value to the round or return items to the user.
                    // Consider changing round status to 'error'
                    if (currentRound) {
                        currentRound.status = 'error';
                        await currentRound.save().catch(err => console.error("Failed to save error status to round:", err));
                        io.emit('roundError', { roundId: currentRound.roundId, error: 'Deposit processing error. Please contact support.' });
                    }
                }
            }); // End offer.accept callback

        } catch (processingError) {
            console.error(`Error processing items for offer #${offer.id} before acceptance:`, processingError);
            return offer.decline(err => { // Decline if pre-acceptance processing fails
                if (err) console.error(`Error declining offer #${offer.id} after processing error:`, err);
            });
        }
    }); // End manager.on('newOffer')

    manager.on('sentOfferChanged', (offer, oldState) => {
        console.log(`Offer #${offer.id} state changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);
        // Handle winner payouts confirmation/failure
        // Example: Find associated round based on offer details (e.g., stored offer ID on round)
        // If state is Accepted, mark round payout complete.
        // If state is Declined/Expired/Canceled, log and potentially retry or flag for support.
    });

} else {
    console.warn("Trade Offer Manager (manager) is not initialized. Trade event listeners are inactive.");
}


// --- Socket.io Connection Handling ---
// Ensure 'io' is initialized before this handler
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Send current round data immediately if available
    if (currentRound && currentRound._id) { // Check if currentRound and ID exist
        // Use the API logic structure to send consistent data
        Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar steamId')
            .populate('items', 'name image price owner')
            .lean() // Use lean for read-only data
            .then(round => {
                if (round) {
                    const now = Date.now();
                    const timeLeft = round.status === 'active' && round.endTime ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - now) / 1000)) : 0;
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
                    console.warn(`Current round reference (${currentRound._id}) exists but document not found in DB for socket connect ${socket.id}.`);
                     socket.emit('noActiveRound'); // Inform client
                }
            })
            .catch(err => {
                 console.error(`Error fetching current round for socket connect ${socket.id}:`, err);
                 socket.emit('noActiveRound'); // Inform client on error
            });
    } else {
        // Inform client that no round is active
        socket.emit('noActiveRound');
    }

    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
    });

    // Handle user joining rooms based on SteamID if needed for direct notifications
    // socket.on('joinUserRoom', (steamId) => {
    //      if (steamId) {
    //          console.log(`Socket ${socket.id} joining room for SteamID ${steamId}`);
    //          socket.join(steamId); // Use SteamID as room name
    //      }
    // });

});

// Function to start the server
// Note: createNewRound needs to be defined/required
function startServer() {
    // Create initial round or load existing active round
    // This logic might need refinement (e.g., check DB first)
    createNewRound().catch(err => {
        console.error('Failed to create initial round:', err);
        // Consider alternative startup if initial round fails (e.g., wait or exit)
    });

    // Start HTTP server
    const PORT = process.env.PORT || 3000;
    // Use 'server' (the http server instance) to listen, not 'app'
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);

        // Test the pricing API after a short delay
        setTimeout(async () => {
            try {
                console.log("Testing price API...");
                const testItem = "Metal Chest Plate"; // Example item
                const price = await getItemPrice(testItem);
                console.log(`TEST: Price for ${testItem}: ${price ?? 'Not Found'}`); // Use nullish coalescing
                // Check if fallback was used (requires getItemPrice to indicate this)
                // console.log(`TEST: Using fallback? ${price === getFallbackPrice(testItem)}`);
            } catch (error) {
                console.error("Error testing price API:", error.message);
            }
        }, 2000);
    });
}

// --- Call Start Server ---
// Ensure DB connection, manager login etc. are ready before starting
// This might involve async setup or event listeners
// For simplicity, calling directly here, but real apps need better sequencing.
startServer();


// --- Server Graceful Shutdown ---
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        // Close database connection
        mongoose.connection.close(false).then(() => { // Use promise version if available
            console.log('MongoDB connection closed');
            // Add cleanup for Trade Offer Manager / Steam client if needed
            process.exit(0);
        }).catch(err => {
            console.error("Error closing MongoDB connection:", err);
            process.exit(1); // Exit with error if DB close fails
        });
    });

    // Force close after timeout if graceful shutdown fails
    setTimeout(() => {
        console.error('Graceful shutdown timed out, forcing exit.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
});

// Optional: Handle other signals like SIGINT (Ctrl+C) similarly
process.on('SIGINT', () => {
    console.log('SIGINT signal received: initiating graceful shutdown.');
    process.emit('SIGTERM'); // Trigger the SIGTERM handler
});

// Basic Error Handling Middleware (Add AFTER all routes)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
});
