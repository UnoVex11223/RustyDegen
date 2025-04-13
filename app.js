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
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000 // 1 hour
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Steam strategy
passport.use(new SteamStrategy({
    returnURL: `${process.env.SITE_URL}/auth/steam/return`,
    realm: process.env.SITE_URL,
    apiKey: process.env.STEAM_API_KEY
}, function(identifier, profile, done) {
    process.nextTick(function() {
        // Find or create user in database
        User.findOne({ steamId: profile.id }, function(err, user) {
            if (err) return done(err);
            
            if (!user) {
                user = new User({
                    steamId: profile.id,
                    username: profile.displayName,
                    avatar: profile._json.avatarfull,
                    tradeUrl: ''
                });
                user.save(function(err) {
                    if (err) console.log(err);
                    return done(err, user);
                });
            } else {
                // Update user info if it changed
                user.username = profile.displayName;
                user.avatar = profile._json.avatarfull;
                user.save(function(err) {
                    if (err) console.log(err);
                    return done(err, user);
                });
            }
        });
    });
}));

// Serialize user
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

// Deserialize user
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define MongoDB schemas
const userSchema = new mongoose.Schema({
    steamId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    avatar: { type: String },
    tradeUrl: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false }
});

const itemSchema = new mongoose.Schema({
    assetId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inPot: { type: Boolean, default: false },
    roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round' }
});

const roundSchema = new mongoose.Schema({
    roundId: { type: Number, required: true, unique: true },
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    totalValue: { type: Number, default: 0 },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    participants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        itemsValue: { type: Number, required: true },
        tickets: { type: Number, required: true }
    }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    winningTicket: { type: Number },
    serverSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    clientSeed: { type: String }
});

// Create models
const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Round = mongoose.model('Round', roundSchema);

// Initialize Steam Community and Trade Offer Manager
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: community,
    domain: process.env.SITE_URL,
    language: 'en',
    pollInterval: 10000
});

// Load Steam API credentials
/* 
community.login({
    accountName: process.env.STEAM_USERNAME,
    password: process.env.STEAM_PASSWORD,
    twoFactorCode: generateAuthCode()
}, function(err, sessionID, cookies, steamguard) {
    if (err) {
        console.log('Steam login error:', err);
        // Comment out or remove this line to continue even if Steam login fails
        // process.exit(1);
    }
    
    console.log('Steam bot logged in successfully');
    
    // Set cookies for manager
    manager.setCookies(cookies);
});
*/

// Function to generate Steam auth code (you'll need to implement this with your 2FA shared secret)
function generateAuthCode() {
    // In a real environment, you would use your shared secret to generate a TOTP code
    // This is just a placeholder
    if (process.env.STEAM_SHARED_SECRET) {
        // Use the shared secret to generate a real TOTP code
        // This requires steam-totp or similar package
        // return SteamTotp.generateAuthCode(process.env.STEAM_SHARED_SECRET);
    }
    return '';
}

// Active round data
let currentRound = null;
let roundTimer = null;
const ROUND_DURATION = 120; // 2 minutes

// Create a new round
async function createNewRound() {
    try {
        // Generate server seed and hash
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        
        // Get the latest round to increment ID
        const latestRound = await Round.findOne().sort('-roundId');
        const newRoundId = latestRound ? latestRound.roundId + 1 : 1;
        
        // Create new round
        const round = new Round({
            roundId: newRoundId,
            status: 'active',
            startTime: new Date(),
            endTime: new Date(Date.now() + ROUND_DURATION * 1000),
            serverSeed: serverSeed,
            serverSeedHash: serverSeedHash
        });
        
        await round.save();
        currentRound = round;
        
        // Start the timer
        startRoundTimer();
        
        // Emit round created event
        io.emit('roundCreated', {
            roundId: round.roundId,
            serverSeedHash: round.serverSeedHash,
            timeLeft: ROUND_DURATION,
            totalValue: 0
        });
        
        console.log(`Round #${round.roundId} created`);
        return round;
    } catch (err) {
        console.error('Error creating new round:', err);
        throw err;
    }
}

// Start the round timer
function startRoundTimer() {
    let timeLeft = ROUND_DURATION;
    
    // Clear any existing timer
    if (roundTimer) {
        clearInterval(roundTimer);
    }
    
    // Start a new timer
    roundTimer = setInterval(async () => {
        timeLeft--;
        
        // Emit time update
        io.emit('timeUpdate', { timeLeft });
        
        // End the round when timer reaches 0
        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            await endRound();
        }
    }, 1000);
}

// End the current round and select a winner
async function endRound() {
    try {
        if (!currentRound) return;
        
        // Update round status
        const round = await Round.findById(currentRound._id)
            .populate('participants.user')
            .populate('items');
        
        // If no participants, create a new round
        if (round.participants.length === 0) {
            round.status = 'completed';
            await round.save();
            await createNewRound();
            return;
        }
        
        // Generate client seed (round ID + timestamp)
        const clientSeed = round.roundId.toString() + Date.now().toString();
        round.clientSeed = clientSeed;
        
        // Calculate winning ticket
        const combinedSeed = round.serverSeed + round.clientSeed;
        const hash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
        const decimal = parseInt(hash.substring(0, 8), 16);
        const totalTickets = round.participants.reduce((sum, p) => sum + p.tickets, 0);
        const winningTicket = decimal % totalTickets;
        
        round.winningTicket = winningTicket;
        
        // Find winner
        let ticketCounter = 0;
        let winner = null;
        
        for (const participant of round.participants) {
            ticketCounter += participant.tickets;
            if (winningTicket < ticketCounter) {
                winner = participant.user;
                break;
            }
        }
        
        round.winner = winner._id;
        round.status = 'completed';
        round.endTime = new Date();
        await round.save();
        
        // Emit winner event
        io.emit('roundWinner', {
            roundId: round.roundId,
            winner: {
                id: winner._id,
                username: winner.username,
                avatar: winner.avatar
            },
            winningTicket: winningTicket,
            serverSeed: round.serverSeed,
            serverSeedHash: round.serverSeedHash,
            clientSeed: round.clientSeed
        });
        
        console.log(`Round #${round.roundId} completed. Winner: ${winner.username}`);
        
        // Send trade offer to winner
        sendWinningTradeOffer(round, winner);
        
        // Create a new round after a delay
        setTimeout(async () => {
            await createNewRound();
        }, 5000);
    } catch (err) {
        console.error('Error ending round:', err);
        // Create a new round anyway if there was an error
        setTimeout(async () => {
            await createNewRound();
        }, 5000);
    }
}

// Send trade offer to the winner
async function sendWinningTradeOffer(round, winner) {
    try {
        // Check if user has a trade URL
        if (!winner.tradeUrl) {
            console.log(`Cannot send trade offer to ${winner.username}: No trade URL`);
            return;
        }
        
        // Create a new trade offer
        const offer = manager.createOffer(winner.tradeUrl);
        
        // Add all items in the round to the trade offer
        for (const item of round.items) {
            offer.addMyItem({
                assetid: item.assetId,
                appid: 252490, // Rust app ID
                contextid: 2   // Inventory context ID
            });
        }
        
        // Send the offer
        offer.send(function(err, status) {
            if (err) {
                console.log(`Error sending trade offer to ${winner.username}:`, err);
                return;
            }
            
            console.log(`Trade offer sent to ${winner.username}. Status: ${status}`);
            
            // Emit trade offer sent event
            io.emit('tradeOfferSent', {
                roundId: round.roundId,
                userId: winner._id,
                username: winner.username,
                offerId: offer.id
            });
        });
    } catch (err) {
        console.error('Error sending trade offer:', err);
    }
}

// Auth routes
app.get('/auth/steam', passport.authenticate('steam'));

app.get('/auth/steam/return', 
    passport.authenticate('steam', { failureRedirect: '/' }),
    function(req, res) {
        res.redirect('/');
    }
);

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

// API Routes
// Get current user
app.get('/api/user', function(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json(req.user);
});

// Update trade URL
app.post('/api/user/tradeurl', async function(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    try {
        const { tradeUrl } = req.body;
        
        // Validate trade URL format
        if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
            return res.status(400).json({ error: 'Invalid trade URL format' });
        }
        
        // Update user
        const user = await User.findById(req.user._id);
        user.tradeUrl = tradeUrl;
        await user.save();
        
        res.json({ success: true, tradeUrl });
    } catch (err) {
        console.error('Error updating trade URL:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user inventory
app.get('/api/inventory', async function(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    try {
        community.getUserInventoryContents(req.user.steamId, 252490, 2, true, function(err, inventory) {
            if (err) {
                console.error('Error fetching inventory:', err);
                return res.status(500).json({ error: 'Could not fetch inventory' });
            }
            
            // Transform inventory data to include prices
            // In a real implementation, you would fetch prices from a pricing API
            const items = inventory.map(item => {
                return {
                    assetId: item.assetid,
                    name: item.market_hash_name,
                    image: `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`,
                    price: getItemPrice(item.market_hash_name) // You need to implement this function
                };
            });
            
            res.json(items);
        });
    } catch (err) {
        console.error('Error fetching inventory:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Placeholder function for item pricing
// In a real implementation, you would use a pricing API
function getItemPrice(marketHashName) {
    // This is just a placeholder
    // You should use a proper pricing API or database
    const priceMap = {
        'AK47 | Bloodsport (Factory New)': 120.50,
        'M4A4 | Howl (Minimal Wear)': 1200.75,
        'AWP | Dragon Lore (Field-Tested)': 1800.25,
        'Karambit | Fade (Factory New)': 950.00
    };
    
    return priceMap[marketHashName] || Math.random() * 100 + 5; // Random price between 5 and 105
}

// Deposit items
app.post('/api/deposit', async function(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    try {
        const { items } = req.body;
        
        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid items' });
        }
        
        // Check if round is active
        if (!currentRound || currentRound.status !== 'active') {
            return res.status(400).json({ error: 'No active round' });
        }
        
        // Create trade offer to receive items
        const user = await User.findById(req.user._id);
        
        if (!user.tradeUrl) {
            return res.status(400).json({ error: 'Trade URL not set' });
        }
        
        // Create trade offer
        const offer = manager.createOffer(user.tradeUrl);
        
        // Add items to trade offer
        let totalValue = 0;
        for (const item of items) {
            offer.addTheirItem({
                assetid: item.assetId,
                appid: 252490, // Rust app ID
                contextid: 2    // Inventory context ID
            });
            
            totalValue += item.price;
        }
        
        // Set an empty message
        offer.setMessage('Deposit to RustPot');
        
        // Send trade offer
        offer.send(async function(err, status) {
            if (err) {
                console.error('Error sending trade offer:', err);
                return res.status(500).json({ error: 'Could not send trade offer' });
            }
            
            // Save trade offer ID for later processing
            const round = await Round.findById(currentRound._id);
            
            // Calculate tickets (1 ticket per $0.10)
            const tickets = Math.floor(totalValue * 10);
            
            // Check if user already has tickets in this round
            const existingParticipant = round.participants.find(p => p.user.toString() === req.user._id.toString());
            
            if (existingParticipant) {
                // Update existing participant
                existingParticipant.itemsValue += totalValue;
                existingParticipant.tickets += tickets;
            } else {
                // Add new participant
                round.participants.push({
                    user: req.user._id,
                    itemsValue: totalValue,
                    tickets: tickets
                });
            }
            
            // Update round value
            round.totalValue += totalValue;
            
            // Save round
            await round.save();
            
            // Emit participant added event
            io.emit('participantUpdated', {
                roundId: round.roundId,
                userId: req.user._id,
                username: req.user.username,
                avatar: req.user.avatar,
                itemsValue: existingParticipant ? existingParticipant.itemsValue : totalValue,
                tickets: existingParticipant ? existingParticipant.tickets : tickets,
                totalValue: round.totalValue
            });
            
            res.json({
                success: true,
                offerId: offer.id,
                message: 'Trade offer sent'
            });
        });
    } catch (err) {
        console.error('Error processing deposit:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current round
app.get('/api/round/current', async function(req, res) {
    try {
        if (!currentRound) {
            return res.status(404).json({ error: 'No active round' });
        }
        
        const round = await Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar')
            .populate('items');
        
        res.json({
            roundId: round.roundId,
            status: round.status,
            startTime: round.startTime,
            endTime: round.endTime,
            totalValue: round.totalValue,
            serverSeedHash: round.serverSeedHash,
            participants: round.participants.map(p => ({
                user: {
                    id: p.user._id,
                    username: p.user.username,
                    avatar: p.user.avatar
                },
                itemsValue: p.itemsValue,
                tickets: p.tickets
            })),
            items: round.items.map(item => ({
                id: item._id,
                name: item.name,
                image: item.image,
                price: item.price,
                owner: item.owner
            }))
        });
    } catch (err) {
        console.error('Error fetching current round:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get round history
app.get('/api/rounds', async function(req, res) {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const rounds = await Round.find({ status: 'completed' })
            .sort('-roundId')
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('winner', 'username avatar')
            .select('roundId startTime endTime totalValue winner serverSeed serverSeedHash clientSeed winningTicket');
        
        const count = await Round.countDocuments({ status: 'completed' });
        
        res.json({
            rounds,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page)
        });
    } catch (err) {
        console.error('Error fetching round history:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify round fairness
app.post('/api/verify', async function(req, res) {
    try {
        const { roundId, serverSeed, clientSeed } = req.body;
        
        // Find the round
        const round = await Round.findOne({ roundId: roundId });
        
        if (!round) {
            return res.status(404).json({ error: 'Round not found' });
        }
        
        // Verify server seed
        const calculatedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        
        if (calculatedHash !== round.serverSeedHash) {
            return res.json({
                verified: false,
                reason: 'Server seed hash does not match'
            });
        }
        
        // Calculate winning ticket
        const combinedSeed = serverSeed + clientSeed;
        const hash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
        const decimal = parseInt(hash.substring(0, 8), 16);
        const totalTickets = round.participants.reduce((sum, p) => sum + p.tickets, 0);
        const calculatedWinningTicket = decimal % totalTickets;
        
        // Verify winning ticket
        if (calculatedWinningTicket !== round.winningTicket) {
            return res.json({
                verified: false,
                reason: 'Winning ticket does not match'
            });
        }
        
        res.json({
            verified: true,
            roundId: round.roundId,
            serverSeed: serverSeed,
            serverSeedHash: round.serverSeedHash,
            clientSeed: clientSeed,
            winningTicket: calculatedWinningTicket
        });
    } catch (err) {
        console.error('Error verifying round:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Send current round data if available
    if (currentRound) {
        Round.findById(currentRound._id)
            .populate('participants.user', 'username avatar')
            .populate('items')
            .then(round => {
                if (round) {
                    socket.emit('roundData', {
                        roundId: round.roundId,
                        status: round.status,
                        timeLeft: round.endTime ? Math.max(0, Math.floor((round.endTime - new Date()) / 1000)) : 0,
                        totalValue: round.totalValue,
                        serverSeedHash: round.serverSeedHash,
                        participants: round.participants.map(p => ({
                            user: {
                                id: p.user._id,
                                username: p.user.username,
                                avatar: p.user.avatar
                            },
                            itemsValue: p.itemsValue,
                            tickets: p.tickets
                        })),
                        items: round.items.map(item => ({
                            id: item._id,
                            name: item.name,
                            image: item.image,
                            price: item.price,
                            owner: item.owner
                        }))
                    });
                }
            })
            .catch(err => console.error('Error fetching current round for socket:', err));
    }
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Handle incoming trade offers
manager.on('newOffer', function(offer) {
    console.log(`New trade offer #${offer.id} from ${offer.partner.getSteamID64()}`);
    
    // Process only incoming offers
    if (offer.itemsToGive.length === 0 && offer.itemsToReceive.length > 0) {
        // This is a deposit offer
        // You would process it here
        console.log('Processing deposit offer...');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Start first round when server starts
createNewRound().catch(err => console.error('Error creating initial round:', err));
