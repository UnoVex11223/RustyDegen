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

             const price = await getItemPrice(itemInfo.market_hash_name); // Use real-time pricing
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

// Function to start the server
function startServer() {
    // Create initial round
    createNewRound().catch(err => {
        console.error('Failed to create initial round:', err);
    });
    
    // Start HTTP server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        
        // Test the pricing API
        setTimeout(async () => {
            try {
                console.log("Testing price API...");
                const testItem = "Metal Chest Plate";
                const price = await getItemPrice(testItem);
                console.log(`TEST: Price for ${testItem}: ${price}`);
                console.log(`TEST: Using fallback? ${price === getFallbackPrice(testItem)}`);
            } catch (error) {
                console.error("Error testing price API:", error);
            }
        }, 2000);
    });
}

// --- Server Graceful Shutdown ---
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
