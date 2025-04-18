// app.js - Updated with timer, participant limit, and tax calculation

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const winston = require('winston');
const SteamAPI = require('steamapi');
const SteamCommunity = require('steamcommunity');
const SteamTradeOfferManager = require('steam-tradeoffer-manager');
const SteamTotp = require('steam-totp');
const SteamUser = require('steam-user');
const TradeOfferManager = require('steam-tradeoffer-manager');
const fs = require('fs');
const axios = require('axios');
const schedule = require('node-schedule');

// Load environment variables
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rustjackpot', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => logger.info('MongoDB connected'))
.catch(err => logger.error('MongoDB connection error:', err));

// Define schemas
const UserSchema = new mongoose.Schema({
    steamId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    avatar: { type: String },
    tradeUrl: { type: String },
    balance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    bets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bet' }],
    wins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Round' }],
    inventory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }]
});

const ItemSchema = new mongoose.Schema({
    assetId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['available', 'in_round', 'withdrawn', 'pending'], default: 'available' },
    createdAt: { type: Date, default: Date.now }
});

const RoundSchema = new mongoose.Schema({
    roundId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'active', 'rolling', 'completed'], default: 'pending' },
    startTime: { type: Date },
    endTime: { type: Date },
    completedTime: { type: Date },
    totalValue: { type: Number, default: 0 },
    participants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        itemsValue: { type: Number, required: true },
        tickets: { type: Number, required: true }
    }],
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    winningTicket: { type: Number },
    secret: { type: String },
    secretHash: { type: String },
    taxItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    taxValue: { type: Number, default: 0 }
});

const BetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    round: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    value: { type: Number, required: true },
    tickets: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

const TradeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    tradeOfferId: { type: String },
    type: { type: String, enum: ['deposit', 'withdraw'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'canceled', 'error'], default: 'pending' },
    round: { type: mongoose.Schema.Types.ObjectId, ref: 'Round' },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
});

// Create models
const User = mongoose.model('User', UserSchema);
const Item = mongoose.model('Item', ItemSchema);
const Round = mongoose.model('Round', RoundSchema);
const Bet = mongoose.model('Bet', BetSchema);
const Trade = mongoose.model('Trade', TradeSchema);

// Configure session
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/rustjackpot' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

// Configure passport
passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new SteamStrategy({
    returnURL: process.env.STEAM_RETURN_URL || 'http://localhost:3000/auth/steam/return',
    realm: process.env.STEAM_REALM || 'http://localhost:3000/',
    apiKey: process.env.STEAM_API_KEY
}, async (identifier, profile, done) => {
    try {
        const steamId = profile.id;
        let user = await User.findOne({ steamId });
        
        if (!user) {
            user = new User({
                steamId,
                username: profile.displayName,
                avatar: profile.photos[2].value
            });
            await user.save();
            logger.info(`New user registered: ${steamId}`);
        } else {
            user.username = profile.displayName;
            user.avatar = profile.photos[2].value;
            user.lastLogin = Date.now();
            await user.save();
            logger.info(`User logged in: ${steamId}`);
        }
        
        return done(null, user);
    } catch (err) {
        logger.error('Authentication error:', err);
        return done(err, null);
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Constants
const ROUND_DURATION = 99; // Changed from 120 to 99 seconds
const MAX_PARTICIPANTS = 20; // Maximum number of participants per round
const MAX_ITEMS_PER_DEPOSIT = 200; // Maximum number of items per deposit
const TAX_MIN_PERCENT = 5; // Target 5% tax
const TAX_MAX_PERCENT = 10; // Maximum 10% tax if needed
const MIN_POT_FOR_TAX = 10; // Minimum pot value to apply tax

// Steam API setup
const steamApi = new SteamAPI(process.env.STEAM_API_KEY);
const community = new SteamCommunity();
const steamUser = new SteamUser();
const manager = new TradeOfferManager({
    steam: steamUser,
    domain: process.env.DOMAIN || 'localhost',
    language: 'en',
    pollInterval: 10000
});

// Global variables
let currentRound = null;
let roundTimer = null;
let isRolling = false;
let queuedDeposits = [];

// Initialize Steam bot
function initializeSteamBot() {
    steamUser.logOn({
        accountName: process.env.STEAM_USERNAME,
        password: process.env.STEAM_PASSWORD,
        twoFactorCode: SteamTotp.generateAuthCode(process.env.STEAM_SHARED_SECRET)
    });
    
    steamUser.on('loggedOn', () => {
        logger.info('Steam bot logged on');
        steamUser.setPersona(SteamUser.EPersonaState.Online);
        steamUser.gamesPlayed(252490); // Rust App ID
    });
    
    steamUser.on('error', (err) => {
        logger.error('Steam bot error:', err);
        setTimeout(initializeSteamBot, 60000); // Retry after 1 minute
    });
    
    manager.on('newOffer', (offer) => {
        handleTradeOffer(offer);
    });
}

// Handle trade offers
async function handleTradeOffer(offer) {
    try {
        // Only accept offers from our users and for deposits
        const trade = await Trade.findOne({ tradeOfferId: offer.id }).populate('user items');
        
        if (!trade || trade.type !== 'deposit') {
            logger.info(`Declining offer ${offer.id}: Not a valid deposit`);
            offer.decline();
            return;
        }
        
        logger.info(`Accepting offer ${offer.id} from user ${trade.user.steamId}`);
        
        offer.accept((err, status) => {
            if (err) {
                logger.error(`Error accepting offer ${offer.id}:`, err);
                trade.status = 'error';
                trade.save();
                return;
            }
            
            logger.info(`Offer ${offer.id} accepted, status: ${status}`);
            trade.status = 'accepted';
            trade.completedAt = Date.now();
            trade.save();
            
            // Update items status
            trade.items.forEach(async (itemId) => {
                await Item.findByIdAndUpdate(itemId, { status: 'in_round' });
            });
            
            // Add items to round
            addDepositToRound(trade);
        });
    } catch (err) {
        logger.error('Error handling trade offer:', err);
    }
}

// Create a new round
async function createNewRound() {
    try {
        // Generate a random secret for provably fair
        const secret = crypto.randomBytes(32).toString('hex');
        const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
        
        const roundId = uuidv4();
        
        const round = new Round({
            roundId,
            status: 'active',
            startTime: Date.now(),
            secret,
            secretHash
        });
        
        await round.save();
        currentRound = round;
        
        logger.info(`New round created: ${roundId}`);
        
        // Broadcast to all clients
        io.emit('roundCreated', {
            roundId: round.roundId,
            status: round.status,
            startTime: round.startTime,
            secretHash: round.secretHash,
            totalValue: 0,
            participants: [],
            timeLeft: ROUND_DURATION
        });
        
        // Process any queued deposits
        processQueuedDeposits();
        
        return round;
    } catch (err) {
        logger.error('Error creating new round:', err);
        return null;
    }
}

// Process queued deposits
async function processQueuedDeposits() {
    if (queuedDeposits.length === 0) return;
    
    logger.info(`Processing ${queuedDeposits.length} queued deposits`);
    
    const deposits = [...queuedDeposits];
    queuedDeposits = [];
    
    for (const trade of deposits) {
        await addDepositToRound(trade);
    }
}

// Add deposit to round
async function addDepositToRound(trade) {
    try {
        if (!currentRound || currentRound.status !== 'active') {
            logger.info(`Queueing deposit for next round: ${trade._id}`);
            queuedDeposits.push(trade);
            return;
        }
        
        // Check if round is full
        const round = await Round.findById(currentRound._id).populate('participants.user');
        if (round.participants.length >= MAX_PARTICIPANTS) {
            logger.info(`Round ${round.roundId} is full, queueing deposit for next round`);
            queuedDeposits.push(trade);
            return;
        }
        
        const user = await User.findById(trade.user);
        const items = await Item.find({ _id: { $in: trade.items } });
        
        if (!user || items.length === 0) {
            logger.error(`Invalid deposit: user=${user?._id}, items=${items.length}`);
            return;
        }
        
        // Calculate total value
        const itemsValue = items.reduce((sum, item) => sum + item.price, 0);
        
        // Calculate tickets (1 ticket per $0.01)
        const tickets = Math.floor(itemsValue * 100);
        
        // Update round
        const totalValue = round.totalValue + itemsValue;
        
        // Check if user already has a bet in this round
        const existingParticipantIndex = round.participants.findIndex(
            p => p.user.toString() === user._id.toString()
        );
        
        if (existingParticipantIndex !== -1) {
            // Update existing participant
            round.participants[existingParticipantIndex].itemsValue += itemsValue;
            round.participants[existingParticipantIndex].tickets += tickets;
        } else {
            // Add new participant
            round.participants.push({
                user: user._id,
                itemsValue,
                tickets
            });
        }
        
        round.totalValue = totalValue;
        round.items.push(...trade.items);
        
        await round.save();
        
        // Create bet record
        const bet = new Bet({
            user: user._id,
            round: round._id,
            items: trade.items,
            value: itemsValue,
            tickets
        });
        
        await bet.save();
        
        // Update trade with round
        trade.round = round._id;
        await trade.save();
        
        // Update user bets
        user.bets.push(bet._id);
        await user.save();
        
        logger.info(`Deposit added to round ${round.roundId}: user=${user.username}, value=${itemsValue}`);
        
        // Broadcast to all clients
        const populatedRound = await Round.findById(round._id)
            .populate('participants.user', 'username avatar steamId')
            .populate('items');
            
        const depositedItems = items.map(item => ({
            assetId: item.assetId,
            name: item.name,
            image: item.image,
            price: item.price
        }));
        
        io.emit('participantUpdated', {
            roundId: round.roundId,
            userId: user._id,
            username: user.username,
            avatar: user.avatar,
            itemsValue,
            tickets,
            totalValue,
            depositedItems
        });
        
        // Start timer if this is the first participant
        if (round.participants.length === 1 && !roundTimer) {
            startRoundTimer(round._id);
        }
        
        return true;
    } catch (err) {
        logger.error('Error adding deposit to round:', err);
        return false;
    }
}

// Start round timer
function startRoundTimer(roundId) {
    if (roundTimer) {
        clearTimeout(roundTimer);
    }
    
    logger.info(`Starting timer for round ${roundId}: ${ROUND_DURATION} seconds`);
    
    let timeLeft = ROUND_DURATION;
    
    const timerInterval = setInterval(async () => {
        timeLeft--;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            await endRound(roundId);
        }
    }, 1000);
    
    roundTimer = timerInterval;
}

// End round
async function endRound(roundId) {
    try {
        const round = await Round.findOne({ roundId }).populate('participants.user items');
        
        if (!round || round.status !== 'active') {
            logger.warn(`Cannot end round ${roundId}: Invalid status ${round?.status}`);
            return;
        }
        
        if (round.participants.length === 0) {
            logger.info(`Round ${roundId} ended with no participants`);
            round.status = 'completed';
            round.endTime = Date.now();
            round.completedTime = Date.now();
            await round.save();
            
            io.emit('roundCompleted', { roundId, message: 'No participants.' });
            
            // Create a new round
            await createNewRound();
            return;
        }
        
        // Set status to rolling
        round.status = 'rolling';
        round.endTime = Date.now();
        await round.save();
        
        io.emit('roundRolling', { roundId });
        
        // Simulate rolling delay
        setTimeout(() => determineWinner(roundId), 3000);
    } catch (err) {
        logger.error(`Error ending round ${roundId}:`, err);
    }
}

// Determine winner
async function determineWinner(roundId) {
    try {
        const round = await Round.findOne({ roundId })
            .populate('participants.user items');
            
        if (!round || round.status !== 'rolling') {
            logger.warn(`Cannot determine winner for round ${roundId}: Invalid status ${round?.status}`);
            return;
        }
        
        if (round.participants.length === 0) {
            logger.warn(`Round ${roundId} has no participants`);
            round.status = 'completed';
            round.completedTime = Date.now();
            await round.save();
            
            io.emit('roundCompleted', { roundId, message: 'No participants.' });
            
            // Create a new round
            await createNewRound();
            return;
        }
        
        // Calculate total tickets
        const totalTickets = round.participants.reduce((sum, p) => sum + p.tickets, 0);
        
        if (totalTickets === 0) {
            logger.error(`Round ${roundId} has no tickets`);
            round.status = 'completed';
            round.completedTime = Date.now();
            await round.save();
            
            io.emit('roundCompleted', { roundId, message: 'No tickets.' });
            
            // Create a new round
            await createNewRound();
            return;
        }
        
        // Generate winning ticket using the round secret for provably fair
        const hmac = crypto.createHmac('sha256', round.secret);
        hmac.update(round.roundId);
        const hash = hmac.digest('hex');
        
        // Convert first 8 characters of hash to number and get modulo of total tickets
        const winningTicket = parseInt(hash.substring(0, 8), 16) % totalTickets;
        
        // Find winner
        let ticketCounter = 0;
        let winner = null;
        
        for (const participant of round.participants) {
            ticketCounter += participant.tickets;
            if (ticketCounter > winningTicket) {
                winner = participant.user;
                break;
            }
        }
        
        if (!winner) {
            logger.error(`Could not determine winner for round ${roundId}`);
            round.status = 'completed';
            round.completedTime = Date.now();
            await round.save();
            
            io.emit('roundCompleted', { roundId, message: 'Error determining winner.' });
            
            // Create a new round
            await createNewRound();
            return;
        }
        
        // Calculate tax
        const { taxItems, taxValue } = calculateTax(round.items, round.totalValue);
        
        // Update round with winner
        round.winner = winner._id;
        round.winningTicket = winningTicket;
        round.status = 'completed';
        round.completedTime = Date.now();
        round.taxItems = taxItems.map(item => item._id);
        round.taxValue = taxValue;
        
        await round.save();
        
        // Update user wins
        await User.findByIdAndUpdate(winner._id, { $push: { wins: round._id } });
        
        logger.info(`Round ${roundId} completed: winner=${winner.username}, ticket=${winningTicket}, total=${totalTickets}`);
        
        // Send items to winner
        const winningItems = round.items.filter(item => 
            !taxItems.some(taxItem => taxItem._id.toString() === item._id.toString())
        );
        
        sendItemsToWinner(winner, winningItems, round._id);
        
        // Broadcast winner to all clients
        io.emit('roundWinner', {
            roundId,
            winner: {
                id: winner._id,
                username: winner.username,
                avatar: winner.avatar
            },
            winningTicket,
            totalTickets,
            secret: round.secret,
            secretHash: round.secretHash,
            taxValue
        });
        
        // Create a new round after a delay
        setTimeout(createNewRound, 10000);
    } catch (err) {
        logger.error(`Error determining winner for round ${roundId}:`, err);
    }
}

// Calculate tax for winner payout
function calculateTax(items, totalValue) {
    // Skip tax if pot is less than minimum required
    if (totalValue < MIN_POT_FOR_TAX) {
        logger.info(`Pot value ($${totalValue.toFixed(2)}) below minimum for tax ($${MIN_POT_FOR_TAX}). Skipping tax.`);
        return { taxItems: [], taxValue: 0 };
    }
    
    // Sort items by value (lowest to highest)
    const sortedItems = [...items].sort((a, b) => a.price - b.price);
    
    // Target tax amount (5-10% of total value)
    const minTaxAmount = totalValue * (TAX_MIN_PERCENT / 100);
    const maxTaxAmount = totalValue * (TAX_MAX_PERCENT / 100);
    
    let taxItems = [];
    let taxValue = 0;
    
    // Try to get as close to minTaxAmount as possible without exceeding maxTaxAmount
    for (const item of sortedItems) {
        const newTaxValue = taxValue + item.price;
        
        // If adding this item exceeds maxTaxAmount and we already have some tax items, stop
        if (newTaxValue > maxTaxAmount && taxItems.length > 0) {
            break;
        }
        
        // Add item to tax
        taxItems.push(item);
        taxValue = newTaxValue;
        
        // If we've reached or exceeded minTaxAmount, stop
        if (taxValue >= minTaxAmount) {
            break;
        }
    }
    
    // Special case: If we couldn't get close to minTaxAmount (e.g., only two $50 items in $100 pot)
    // and taking one item would exceed maxTaxAmount, skip tax
    if (taxItems.length === 1 && taxValue > maxTaxAmount) {
        logger.info(`Single tax item value ($${taxValue.toFixed(2)}) exceeds max tax ($${maxTaxAmount.toFixed(2)}). Skipping tax.`);
        return { taxItems: [], taxValue: 0 };
    }
    
    logger.info(`Tax calculated: $${taxValue.toFixed(2)} (${(taxValue / totalValue * 100).toFixed(2)}% of pot)`);
    return { taxItems, taxValue };
}

// Send items to winner
async function sendItemsToWinner(user, items, roundId) {
    try {
        if (!user.tradeUrl) {
            logger.error(`Cannot send items to winner ${user.username}: No trade URL`);
            return;
        }
        
        // Create trade record
        const trade = new Trade({
            user: user._id,
            items: items.map(item => item._id),
            type: 'withdraw',
            status: 'pending',
            round: roundId
        });
        
        await trade.save();
        
        // Update items status
        for (const item of items) {
            await Item.findByIdAndUpdate(item._id, { status: 'pending', owner: user._id });
        }
        
        // Send trade offer
        const offer = manager.createOffer(user.tradeUrl);
        
        // Add items to offer
        for (const item of items) {
            offer.addMyItem({
                assetid: item.assetId,
                appid: 252490,
                contextid: 2,
                amount: 1
            });
        }
        
        offer.send((err, status) => {
            if (err) {
                logger.error(`Error sending offer to winner ${user.username}:`, err);
                trade.status = 'error';
                trade.save();
                return;
            }
            
            logger.info(`Offer sent to winner ${user.username}, status: ${status}`);
            trade.tradeOfferId = offer.id;
            trade.save();
            
            // Notify client
            io.emit('tradeOfferSent', {
                userId: user._id,
                tradeOfferId: offer.id,
                itemCount: items.length,
                totalValue: items.reduce((sum, item) => sum + item.price, 0)
            });
        });
    } catch (err) {
        logger.error(`Error sending items to winner ${user.username}:`, err);
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication routes
app.get('/auth/steam', passport.authenticate('steam'));

app.get('/auth/steam/return', passport.authenticate('steam', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/');
});

app.get('/auth/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

// API routes
app.get('/api/user', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({
        _id: req.user._id,
        username: req.user.username,
        avatar: req.user.avatar,
        tradeUrl: req.user.tradeUrl
    });
});

app.post('/api/user/tradeurl', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { tradeUrl } = req.body;
    
    if (!tradeUrl) {
        return res.status(400).json({ error: 'Trade URL is required' });
    }
    
    try {
        req.user.tradeUrl = tradeUrl;
        await req.user.save();
        
        res.json({ tradeUrl });
    } catch (err) {
        logger.error('Error updating trade URL:', err);
        res.status(500).json({ error: 'Failed to update trade URL' });
    }
});

app.get('/api/inventory', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // In a real implementation, this would fetch the user's Steam inventory
        // For demo purposes, we'll return mock data
        const mockInventory = generateMockInventory();
        res.json(mockInventory);
    } catch (err) {
        logger.error('Error fetching inventory:', err);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

app.post('/api/deposit/initiate', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items are required' });
    }
    
    if (items.length > MAX_ITEMS_PER_DEPOSIT) {
        return res.status(400).json({ error: `Maximum ${MAX_ITEMS_PER_DEPOSIT} items allowed per deposit` });
    }
    
    try {
        // In a real implementation, this would create a trade offer
        // For demo purposes, we'll create mock items and a trade
        const mockItems = [];
        
        for (const assetId of items) {
            const mockItem = {
                assetId,
                name: `Item ${assetId.substring(0, 6)}`,
                image: '/img/default-item.png',
                price: parseFloat((Math.random() * 10 + 1).toFixed(2)),
                owner: req.user._id,
                status: 'pending'
            };
            
            const item = new Item(mockItem);
            await item.save();
            mockItems.push(item);
        }
        
        const trade = new Trade({
            user: req.user._id,
            items: mockItems.map(item => item._id),
            type: 'deposit',
            status: 'pending'
        });
        
        await trade.save();
        
        // In a real implementation, this would wait for the trade to be accepted
        // For demo purposes, we'll simulate acceptance after a delay
        setTimeout(async () => {
            trade.status = 'accepted';
            trade.completedAt = Date.now();
            await trade.save();
            
            // Update items status
            for (const item of mockItems) {
                item.status = 'in_round';
                await item.save();
            }
            
            // Add to round
            addDepositToRound(trade);
        }, 2000);
        
        res.json({ success: true, tradeId: trade._id });
    } catch (err) {
        logger.error('Error initiating deposit:', err);
        res.status(500).json({ error: 'Failed to initiate deposit' });
    }
});

app.get('/api/rounds', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    try {
        const rounds = await Round.find({ status: 'completed' })
            .sort({ completedTime: -1 })
            .skip(skip)
            .limit(limit)
            .populate('winner', 'username avatar')
            .lean();
            
        const totalRounds = await Round.countDocuments({ status: 'completed' });
        const totalPages = Math.ceil(totalRounds / limit);
        
        res.json({
            rounds,
            currentPage: page,
            totalPages,
            totalRounds
        });
    } catch (err) {
        logger.error('Error fetching rounds:', err);
        res.status(500).json({ error: 'Failed to fetch rounds' });
    }
});

app.get('/api/rounds/:roundId', async (req, res) => {
    const { roundId } = req.params;
    
    try {
        const round = await Round.findOne({ roundId })
            .populate('participants.user', 'username avatar steamId')
            .populate('winner', 'username avatar steamId')
            .populate('items')
            .lean();
            
        if (!round) {
            return res.status(404).json({ error: 'Round not found' });
        }
        
        res.json(round);
    } catch (err) {
        logger.error(`Error fetching round ${roundId}:`, err);
        res.status(500).json({ error: 'Failed to fetch round' });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    
    socket.on('requestRoundData', async () => {
        try {
            if (currentRound) {
                const round = await Round.findById(currentRound._id)
                    .populate('participants.user', 'username avatar steamId')
                    .populate('winner', 'username avatar steamId')
                    .populate('items');
                    
                if (round) {
                    const timeLeft = round.status === 'active' ? 
                        Math.max(0, ROUND_DURATION - Math.floor((Date.now() - round.startTime) / 1000)) : 0;
                        
                    socket.emit('roundData', {
                        roundId: round.roundId,
                        status: round.status,
                        startTime: round.startTime,
                        endTime: round.endTime,
                        completedTime: round.completedTime,
                        secretHash: round.secretHash,
                        totalValue: round.totalValue,
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
                            assetId: item.assetId,
                            name: item.name,
                            image: item.image,
                            price: item.price,
                            owner: item.owner
                        })),
                        winner: round.winner ? {
                            id: round.winner._id,
                            username: round.winner.username,
                            avatar: round.winner.avatar
                        } : null,
                        winningTicket: round.winningTicket,
                        timeLeft
                    });
                } else {
                    createNewRound();
                }
            } else {
                createNewRound();
            }
        } catch (err) {
            logger.error('Error sending round data:', err);
        }
    });
    
    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
    });
});

// Helper functions
function generateMockInventory() {
    const inventory = [];
    const count = Math.floor(Math.random() * 20) + 10;
    
    const itemNames = [
        'AK-47 | Redline', 'AWP | Asiimov', 'M4A4 | Howl', 'Desert Eagle | Blaze',
        'Karambit | Fade', 'Butterfly Knife | Doppler', 'Glock-18 | Fade', 'USP-S | Kill Confirmed',
        'M4A1-S | Hyper Beast', 'P250 | Mehndi', 'Five-SeveN | Case Hardened', 'Tec-9 | Nuclear Threat',
        'MP7 | Whiteout', 'P90 | Death by Kitty', 'Nova | Hyper Beast', 'XM1014 | Seasons',
        'Sawed-Off | The Kraken', 'MAG-7 | Bulldozer', 'Negev | Anodized Navy', 'M249 | System Lock'
    ];
    
    for (let i = 0; i < count; i++) {
        const assetId = `asset_${Math.floor(Math.random() * 1000000)}`;
        const nameIndex = Math.floor(Math.random() * itemNames.length);
        
        inventory.push({
            assetId,
            name: itemNames[nameIndex],
            image: '/img/default-item.png',
            price: parseFloat((Math.random() * 100 + 1).toFixed(2))
        });
    }
    
    return inventory;
}

// Startup
async function startup() {
    try {
        // Check if there's an active round
        const activeRound = await Round.findOne({ status: { $in: ['active', 'rolling'] } });
        
        if (activeRound) {
            currentRound = activeRound;
            
            if (activeRound.status === 'active') {
                const elapsedSeconds = Math.floor((Date.now() - activeRound.startTime) / 1000);
                const timeLeft = Math.max(0, ROUND_DURATION - elapsedSeconds);
                
                if (timeLeft > 0 && activeRound.participants.length > 0) {
                    logger.info(`Resuming timer for round ${activeRound.roundId}: ${timeLeft} seconds left`);
                    startRoundTimer(activeRound.roundId);
                } else {
                    logger.info(`Round ${activeRound.roundId} timer expired, ending round`);
                    endRound(activeRound.roundId);
                }
            } else if (activeRound.status === 'rolling') {
                logger.info(`Round ${activeRound.roundId} is rolling, determining winner`);
                determineWinner(activeRound.roundId);
            }
        } else {
            // Create a new round
            createNewRound();
        }
        
        // Initialize Steam bot
        if (process.env.NODE_ENV === 'production') {
            initializeSteamBot();
        } else {
            logger.info('Steam bot not initialized in development mode');
        }
    } catch (err) {
        logger.error('Error during startup:', err);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    startup();
});

module.exports = app;
