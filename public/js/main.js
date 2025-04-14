// Connect to socket.io server
// Ensure the Socket.IO client library is included in your HTML:
// <script src="/socket.io/socket.io.js"></script>
const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a.active');
const faqLink = document.getElementById('faq-link');
const fairLink = document.getElementById('fair-link');
const homePage = document.getElementById('home-page');
const faqPage = document.getElementById('faq-page');
const fairPage = document.getElementById('fair-page');

// DOM Elements - User
const loginButton = document.getElementById('loginButton');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

// DOM Elements - Jackpot
const potValue = document.getElementById('potValue');
const timerValue = document.getElementById('timerValue');
const timerForeground = document.querySelector('.timer-foreground');
const participantCount = document.getElementById('participantCount');
const participantsContainer = document.getElementById('participantsContainer');
const emptyPotMessage = document.getElementById('emptyPotMessage'); // Ensure this exists in HTML or handle null

// DOM Elements - Deposit
const showDepositModal = document.getElementById('showDepositModal');
const depositModal = document.getElementById('depositModal');
const closeDepositModal = document.getElementById('closeDepositModal');
const depositButton = document.getElementById('depositButton');
const inventoryItems = document.getElementById('inventory-items');
const selectedItems = document.getElementById('selectedItems');
const totalValue = document.getElementById('totalValue');
const inventoryLoading = document.getElementById('inventory-loading');

// DOM Elements - Trade URL
const tradeUrlModal = document.getElementById('tradeUrlModal');
const closeTradeUrlModal = document.getElementById('closeTradeUrlModal');
const tradeUrlInput = document.getElementById('tradeUrlInput');
const saveTradeUrl = document.getElementById('saveTradeUrl');

// DOM Elements - Roulette
const jackpotHeader = document.getElementById('jackpotHeader');
const inlineRoulette = document.getElementById('inlineRoulette');
const rouletteTrack = document.getElementById('rouletteTrack');
const winnerInfo = document.getElementById('winnerInfo');
const winnerAvatar = document.getElementById('winnerAvatar');
const winnerName = document.getElementById('winnerName');
const winnerDeposit = document.getElementById('winnerDeposit');
const winnerChance = document.getElementById('winnerChance');
const returnToJackpot = document.getElementById('returnToJackpot');
const confettiContainer = document.getElementById('confettiContainer'); // Ensure this exists
const spinSound = document.getElementById('spinSound'); // Ensure this <audio> element exists

// DOM Elements - Provably Fair
const verifyBtn = document.getElementById('verify-btn');
const roundsTableBody = document.getElementById('rounds-table-body');
const roundsPagination = document.getElementById('rounds-pagination'); // Ensure this exists

// Age Verification
const ageVerificationModal = document.getElementById('ageVerificationModal');
const agreeCheckbox = document.getElementById('agreeCheckbox');
const agreeButton = document.getElementById('agreeButton');

// Constants
const ROULETTE_REPETITIONS = 20; // How many times to repeat participant list
const SPIN_DURATION_SECONDS = 10; // How long the spin animation lasts
const SPIN_ACCELERATION = 0.3; // Initial acceleration factor for cubic-bezier
const SPIN_DECELERATION = 0.6; // Final deceleration factor for cubic-bezier
const WINNER_DISPLAY_DURATION = 5000; // How long to show winner info (in ms)
const CONFETTI_COUNT = 100; // Number of confetti particles

// App State
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false;
let timerActive = false;
let roundTimer = null;

// --- Placeholder Helper Functions (Implement these based on your UI library/framework) ---
function showModal(modalElement) {
    if (modalElement) modalElement.style.display = 'block'; // Example basic implementation
    console.log('Showing modal:', modalElement?.id);
}

function hideModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none'; // Example basic implementation
    console.log('Hiding modal:', modalElement?.id);
}

function showPage(pageElement) {
    // Hide all pages first
    [homePage, faqPage, fairPage].forEach(page => {
        if (page) page.style.display = 'none';
    });
    // Show the target page
    if (pageElement) pageElement.style.display = 'block';
    console.log('Showing page:', pageElement?.id);
    // Handle active link styling if needed
    document.querySelectorAll('.main-nav a').forEach(link => link.classList.remove('active'));
    if (pageElement === homePage && homeLink) homeLink.classList.add('active');
    if (pageElement === faqPage && faqLink) faqLink.parentElement.querySelector('a').classList.add('active'); // Adjust selector if needed
    if (pageElement === fairPage && fairLink) fairLink.parentElement.querySelector('a').classList.add('active'); // Adjust selector if needed

    // Load data for specific pages when shown
    if (pageElement === fairPage) {
        loadPastRounds(); // Load rounds when fair page is shown
    }
}

function showNotification(title, message) {
    // Implement your notification system (e.g., using a library like Toastify)
    console.log(`Notification: ${title} - ${message}`);
    alert(`Notification: ${title}\n${message}`); // Basic alert fallback
}

// Fisher-Yates (aka Knuth) Shuffle Algorithm
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

async function showRoundDetails(roundId) {
    console.log(`Showing details for round ${roundId}`);
    // Implement logic to fetch and display detailed round information
    // Potentially show a modal with the details
    try {
        const response = await fetch(`/api/rounds/${roundId}`); // Assuming an endpoint like this exists
        if (!response.ok) throw new Error(`Failed to fetch round details (${response.status})`);
        const roundData = await response.json();
        // Display roundData in a modal or dedicated section
        alert(`Round Details (ID: ${roundId}):\nWinner: ${roundData.winner?.username || 'N/A'}\nValue: ${roundData.totalValue?.toFixed(2)}\nServer Seed: ${roundData.serverSeed || 'N/A'}\nClient Seed: ${roundData.clientSeed || 'N/A'}\nWinning Ticket: ${roundData.winningTicket}`);
    } catch (error) {
        showNotification('Error', `Could not load details for round ${roundId}: ${error.message}`);
        console.error('Error fetching round details:', error);
    }
}
// --- End Placeholder Helper Functions ---


// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check for age verification in local storage
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }

    // Check if user is logged in
    checkLoginStatus();

    // Setup event listeners
    setupEventListeners();

    // Connect to socket for real-time updates
    setupSocketConnection();

    // Set initial page (e.g., home)
    showPage(homePage); // Ensure home page is shown by default

    // For testing purposes, create example data if no round data is received
    // setTimeout(() => {
    //     if (!currentRound) {
    //         console.log("No round data from server, creating example data for testing");
    //         currentRound = {
    //             roundId: 1,
    //             status: 'active',
    //             timeLeft: 120,
    //             totalValue: 0,
    //             serverSeedHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    //             participants: [],
    //             items: []
    //         };
    //         updateRoundUI();
    //     }
    // }, 2000);
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(homePage);
        });
    }
    if (faqLink) {
        faqLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(faqPage);
        });
    }
    if (fairLink) {
        fairLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(fairPage);
        });
    }

    // Login
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            window.location.href = '/auth/steam'; // Ensure this route exists on your server
        });
    }

    // Deposit Modal Trigger
    if (showDepositModal) {
        showDepositModal.addEventListener('click', () => {
            if (!currentUser) {
                showNotification('Login Required', 'Please log in first to deposit items.');
                return;
            }
            if (!currentUser.tradeUrl) {
                if (tradeUrlModal) showModal(tradeUrlModal);
                else showNotification('Trade URL Missing', 'Please set your Steam Trade URL in your profile first.');
                return;
            }
            if (depositModal) {
                showModal(depositModal);
                loadUserInventory();
            }
        });
    }

    // Deposit Modal Close
    if (closeDepositModal) {
        closeDepositModal.addEventListener('click', () => {
            if (depositModal) hideModal(depositModal);
        });
    }

    // Deposit Button Action
    if (depositButton) {
        depositButton.addEventListener('click', submitDeposit);
    }

    // Trade URL Modal Close
    if (closeTradeUrlModal) {
        closeTradeUrlModal.addEventListener('click', () => {
            if (tradeUrlModal) hideModal(tradeUrlModal);
        });
    }

    // Save Trade URL Button
    if (saveTradeUrl) {
        saveTradeUrl.addEventListener('click', saveUserTradeUrl);
    }

    // Age Verification
    if (agreeCheckbox && agreeButton && ageVerificationModal) {
        agreeCheckbox.addEventListener('change', () => {
            agreeButton.disabled = !agreeCheckbox.checked;
        });
        agreeButton.addEventListener('click', () => {
            if (agreeCheckbox.checked) {
                localStorage.setItem('ageVerified', 'true');
                hideModal(ageVerificationModal);
            }
        });
        // Initialize button state
        agreeButton.disabled = !agreeCheckbox.checked;
    }

    // Roulette Reset Button
    if (returnToJackpot) {
        returnToJackpot.addEventListener('click', resetToJackpotView);
    }

    // Test Spin Button (Optional - for development/testing)
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) {
        testSpinButton.addEventListener('click', testRouletteAnimation);
    }

    // Provably Fair Verify Button
    if (verifyBtn) {
        verifyBtn.addEventListener('click', verifyRound);
    }

    // Handle clicks outside modals to close them
    window.addEventListener('click', (e) => {
        if (depositModal && e.target === depositModal) {
            hideModal(depositModal);
        }
        if (tradeUrlModal && e.target === tradeUrlModal) {
            hideModal(tradeUrlModal);
        }
        if (ageVerificationModal && e.target === ageVerificationModal) {
            // Optional: Close age modal on outside click? Maybe not desirable.
            // hideModal(ageVerificationModal);
        }
    });
}

// Socket connection and events
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        // Request initial round data upon connection
        socket.emit('requestRoundData');
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showNotification('Connection Lost', 'Disconnected from server. Attempting to reconnect...');
        // Optionally implement reconnection logic or UI indicators
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showNotification('Connection Error', 'Could not connect to the server.');
    });

    // Round created event
    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        updateRoundUI();
        resetToJackpotView(); // Ensure UI is reset for the new round visually
        // Timer logic moved to handleNewDeposit to start only after participants join
    });

    // Time update event - Use this ONLY if server explicitly sends time updates
    // socket.on('timeUpdate', (data) => {
    //     if (timerActive && currentRound && currentRound.roundId === data.roundId) {
    //         updateTimerUI(data.timeLeft);
    //     }
    // });

    // Participant updated event (covers new deposits)
    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            handleNewDeposit(data);
        } else if (!currentRound && data.roundId) {
            // If client somehow missed round creation, try to sync
            console.warn("Received participant update for an unknown round. Requesting sync.");
            socket.emit('requestRoundData');
        }
    });

    // Item deposited event (Less critical if participantUpdated covers value changes)
    // socket.on('itemDeposited', (data) => {
    //     console.log('Item deposited:', data);
    //     // Update items display for the specific participant if needed
    // });

    // Round winner event (Triggers the animation)
    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            handleWinnerAnnouncement(data);
        } else {
            console.warn("Received winner for a mismatched round:", data.roundId, "Current:", currentRound?.roundId);
        }
    });

    // Round rolling event (Server indicates spinning has started)
    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            // Stop the client-side timer if it's still running
            timerActive = false;
            if (roundTimer) {
                clearInterval(roundTimer);
                roundTimer = null;
            }
            // Update UI to show "Rolling..." state if desired
             if(timerValue) timerValue.textContent = "Rolling";
             if(timerForeground) timerForeground.style.strokeDashoffset = 0; // Visually fill the circle
        }
    });

    // Round completed event (Server confirms round end, might be redundant if winner event handles it)
    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        // If the round ended without participants, reset the view sooner.
        if (data.message === "No participants." || currentRound?.participants?.length === 0) {
            console.log("Round completed with no participants. Resetting view.");
             // Short delay before resetting UI to allow users to read any messages
            setTimeout(resetToJackpotView, 1500);
        }
        // Note: Winner display and reset are primarily handled by handleWinnerAnnouncement -> handleSpinEnd -> resetToJackpotView timeout
    });

    // Initial round data received from server
    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data);
        if (!data) {
            console.error("Received invalid initial round data.");
            // Perhaps request again or show an error
            return;
        }
        currentRound = data;
        updateRoundUI();

        // If the round is already rolling when the client connects
        if (currentRound.status === 'rolling' && currentRound.winner) {
             console.log("Connected during rolling phase. Waiting for winner data.");
             // Server should send 'roundWinner' shortly if winner is determined
        }
        // Check if we should start the timer (active round, 2+ participants)
        else if (currentRound.status === 'active' &&
            currentRound.participants &&
            currentRound.participants.length >= 2 &&
            !timerActive) { // Ensure timer isn't already running
            timerActive = true;
            startClientTimer(currentRound.timeLeft || 120); // Use server time if available
        } else if (currentRound.status === 'ended' || currentRound.status === 'completed') {
            console.log("Connected after round ended. Waiting for new round.");
            resetToJackpotView(); // Ensure clean state
        }
    });

    // Trade offer sent event (For winner payout)
    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        if (currentUser && data.userId === currentUser._id) {
            showNotification('Trade Offer Sent', 'Check your Steam trade offers to receive your winnings!');
        }
    });
}

// Check if user is logged in (e.g., via session/token)
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user'); // Ensure this API endpoint exists
        if (!response.ok) {
            // User is likely not logged in, or server error
            if (response.status === 401 || response.status === 403) {
                console.log('User not logged in.');
                currentUser = null;
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } else {
            currentUser = await response.json();
            console.log('User logged in:', currentUser?.username);
        }
        updateUserUI();
    } catch (error) {
        console.error('Error checking login status:', error);
        currentUser = null;
        updateUserUI(); // Ensure UI reflects logged-out state on error
    }
}

// Update user-specific UI elements
function updateUserUI() {
    if (currentUser && userProfile && loginButton && userAvatar && userName) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png'; // Provide a default avatar
        userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none';
        userProfile.style.display = 'flex'; // Or 'block', depending on CSS
    } else if (userProfile && loginButton) {
        loginButton.style.display = 'flex'; // Or 'block'
        userProfile.style.display = 'none';
    }
}

// Load user's inventory from the backend
async function loadUserInventory() {
    if (!inventoryItems || !selectedItems || !inventoryLoading || !totalValue) {
        console.error("Inventory DOM elements not found.");
        return;
    }

    selectedItemsList = [];
    selectedItems.innerHTML = '';
    updateTotalValue(); // Resets total value and button state

    inventoryLoading.style.display = 'flex';
    inventoryItems.innerHTML = ''; // Clear previous items

    try {
        const response = await fetch('/api/inventory'); // Ensure this API endpoint exists
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                 throw new Error('Please log in to view your inventory.');
            } else {
                const errorData = await response.text(); // Try to get more error info
                throw new Error(`Failed to load inventory (${response.status}): ${errorData}`);
            }
        }

        userInventory = await response.json();
        inventoryLoading.style.display = 'none';

        if (!Array.isArray(userInventory)) {
             throw new Error('Invalid inventory data received.');
        }

        if (userInventory.length === 0) {
            inventoryItems.innerHTML = '<p class="empty-inventory-message">Your inventory appears to be empty or could not be loaded.</p>';
            return;
        }

        displayInventoryItems();
    } catch (error) {
        inventoryLoading.style.display = 'none';
        inventoryItems.innerHTML = `<p class="error-message">Error loading inventory: ${error.message}</p>`;
        console.error('Error loading inventory:', error);
        showNotification('Inventory Error', error.message);
    }
}

// Display inventory items in the modal
function displayInventoryItems() {
    if (!inventoryItems) return;
    inventoryItems.innerHTML = ''; // Clear just in case

    userInventory.forEach(item => {
        // Basic validation of item structure
        if (!item || typeof item.price !== 'number' || !item.assetId || !item.name || !item.image) {
            console.warn("Skipping invalid item data:", item);
            return;
        }

        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId;
        // Store all data needed for selection/deselection
        itemElement.dataset.name = item.name;
        itemElement.dataset.image = item.image;
        itemElement.dataset.price = item.price.toFixed(2); // Store formatted price

        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
            <div class="item-details">
                <div class="item-name" title="${item.name}">${item.name}</div>
                <div class="item-value">$${item.price.toFixed(2)}</div>
            </div>
        `;

        // Re-check if item is already selected (e.g., if inventory is reloaded)
        if (selectedItemsList.some(selected => selected.assetId === item.assetId)) {
            itemElement.classList.add('selected');
        }

        itemElement.addEventListener('click', () => toggleItemSelection(itemElement, item));
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle selection state of an inventory item
function toggleItemSelection(element, item) {
    const assetId = item.assetId;
    const index = selectedItemsList.findIndex(i => i.assetId === assetId);

    if (index === -1) {
        // Add item
        selectedItemsList.push(item);
        element.classList.add('selected');
        addSelectedItemElement(item);
    } else {
        // Remove item
        selectedItemsList.splice(index, 1);
        element.classList.remove('selected');
        removeSelectedItemElement(assetId);
    }

    updateTotalValue();
}

// Add item to the visual selected items area
function addSelectedItemElement(item) {
     if (!selectedItems) return;

    const selectedElement = document.createElement('div');
    selectedElement.className = 'selected-item';
    selectedElement.dataset.assetId = item.assetId;

    selectedElement.innerHTML = `
        <button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button>
        <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
        <div class="selected-item-details">
            <div class="selected-item-value">$${item.price.toFixed(2)}</div>
        </div>
    `;

    // Find the corresponding inventory item element to re-attach the click listener
    const inventoryItemElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);

    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering other clicks
        // Use the original item object and element if available for removal
        if (inventoryItemElement && item) {
            toggleItemSelection(inventoryItemElement, item);
        } else {
            // Fallback if element not found (shouldn't happen often)
            removeSelectedItem(item.assetId);
             updateTotalValue();
        }
    });

    selectedItems.appendChild(selectedElement);
}

// Remove item from the visual selected items area
function removeSelectedItemElement(assetId) {
    const selectedElement = selectedItems.querySelector(`.selected-item[data-asset-id="${assetId}"]`);
    if (selectedElement) {
        selectedElement.remove();
    }
}

// Remove item from the selection list and update UI (called from toggle or directly)
function removeSelectedItem(assetId) {
    // Update selection list
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);

    // Update inventory item UI (remove 'selected' class)
    const inventoryElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${assetId}"]`);
    if (inventoryElement) {
        inventoryElement.classList.remove('selected');
    }

    // Update selected item UI (remove the element)
    removeSelectedItemElement(assetId);

    // Recalculate total value
    // Note: updateTotalValue() is usually called by the function that calls removeSelectedItem
}


// Update total value display and deposit button state
function updateTotalValue() {
    if (!totalValue || !depositButton) return;
    const total = selectedItemsList.reduce((sum, item) => sum + (item.price || 0), 0);
    totalValue.textContent = `$${total.toFixed(2)}`;
    depositButton.disabled = selectedItemsList.length === 0;
}

// Submit selected items for deposit
async function submitDeposit() {
    if (selectedItemsList.length === 0) {
        showNotification('No Items Selected', 'Please select at least one item to deposit.');
        return;
    }
    if (!currentRound || currentRound.status !== 'active') {
         showNotification('Deposit Error', 'Cannot deposit items now. Please wait for the next round.');
         return;
    }

    depositButton.disabled = true; // Prevent double clicks
    depositButton.textContent = 'Depositing...'; // Indicate loading

    try {
        const response = await fetch('/api/deposit/initiate', { // Ensure this API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: selectedItemsList.map(item => item.assetId) // Send only asset IDs
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to initiate deposit. Please try again.' }));
            throw new Error(error.error || `Deposit failed with status ${response.status}`);
        }

        // const result = await response.json(); // Contains trade offer details if needed

        // Hide modal
        if (depositModal) hideModal(depositModal);

        // Show success notification
        showNotification('Deposit Initiated', 'Please check your Steam trade offers to complete the deposit.');

        // Clear selection AFTER successful initiation
        selectedItemsList = [];
        if(selectedItems) selectedItems.innerHTML = '';
         // Deselect items in inventory view
         if (inventoryItems) {
             inventoryItems.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
         }
        updateTotalValue(); // Reset total and button state

    } catch (error) {
        showNotification('Deposit Error', error.message);
        console.error('Error depositing items:', error);
        // Re-enable button on error
        depositButton.disabled = false;
         depositButton.textContent = 'Deposit Items';
    } finally {
        // Ensure button text/state is reset if it wasn't reset by success/error logic
        if(depositButton && depositButton.textContent === 'Depositing...') {
            depositButton.disabled = selectedItemsList.length === 0;
             depositButton.textContent = 'Deposit Items';
        }
    }
}

// Save user's Steam Trade URL
async function saveUserTradeUrl() {
    if (!tradeUrlInput || !saveTradeUrl || !tradeUrlModal || !depositModal) {
         console.error("Trade URL modal elements not found.");
         return;
    }
    const tradeUrl = tradeUrlInput.value.trim();

    // Basic validation
    if (!tradeUrl) {
        showNotification('Input Required', 'Please enter your Steam Trade URL.');
        return;
    }
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
        // More specific regex could be used for better validation
        showNotification('Invalid Format', 'Please enter a valid Steam Trade URL.');
        return;
    }
     // Example: https://steamcommunity.com/tradeoffer/new/?partner=12345678&token=ABCDEFGHI
     if (!tradeUrl.includes('partner=') || !tradeUrl.includes('token=')) {
         showNotification('Invalid URL', 'The Trade URL must include partner and token parameters.');
         return;
     }

    saveTradeUrl.disabled = true;
    saveTradeUrl.textContent = 'Saving...';

    try {
        const response = await fetch('/api/user/tradeurl', { // Ensure this API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeUrl })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update Trade URL. Please try again.' }));
            throw new Error(error.error || `Failed to save URL (${response.status})`);
        }

        const result = await response.json();

        // Update current user object locally
        if (currentUser) {
            currentUser.tradeUrl = result.tradeUrl; // Assuming the response includes the saved URL
        }

        hideModal(tradeUrlModal);

        // Automatically show deposit modal after saving URL
        showModal(depositModal);
        loadUserInventory();

        showNotification('Success', 'Trade URL saved successfully.');

    } catch (error) {
        showNotification('Error Saving URL', error.message);
        console.error('Error updating trade URL:', error);
    } finally {
        saveTradeUrl.disabled = false;
        saveTradeUrl.textContent = 'Save Trade URL';
    }
}

// Update main round UI elements (Pot, Timer, Participants)
function updateRoundUI() {
    if (!currentRound || !potValue) {
        // console.warn("Cannot update round UI: Missing data or DOM elements.");
        return;
    }

    // Update pot value
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;

    // Update timer (use client timer value if active, otherwise use server value)
    if (!timerActive) {
        updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : 120);
    }
    // Note: Client timer updates the UI itself when active

    // Update participants display
    updateParticipantsUI();
}

// Update timer display (text and circle)
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;

    const timeToShow = Math.max(0, Math.round(timeLeft)); // Ensure non-negative integer

    // Update timer text
    if (timerActive || timeToShow > 0) {
         timerValue.textContent = timeToShow;
    } else if (isSpinning) {
         timerValue.textContent = "Rolling";
    } else {
         timerValue.textContent = "Ended"; // Or "Waiting..."
    }


    // Update timer circle
    const totalTime = 120; // Base the visual percentage on the standard 2-minute round
    const circumference = 2 * Math.PI * 45; // Assuming radius is 45
    const progress = Math.min(1, Math.max(0, timeToShow / totalTime)); // Clamp progress between 0 and 1
    const offset = circumference * (1 - progress);
    timerForeground.style.strokeDasharray = `${circumference}`;
    timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`; // Ensure offset isn't negative


    // Add pulse effect when time is low (only if timer is active)
    if (timerActive && timeToShow <= 10 && timeToShow > 0) {
        timerValue.classList.add('urgent-pulse');
        timerValue.classList.remove('timer-pulse');
    } else {
        timerValue.classList.remove('urgent-pulse');
        if (timerActive && timeToShow > 10) {
             timerValue.classList.add('timer-pulse');
        } else {
            timerValue.classList.remove('timer-pulse');
        }
    }
}

// Handle new deposit data received from server
function handleNewDeposit(data) {
    // Basic validation
    if (!data || !data.roundId || !data.userId || data.itemsValue === undefined || data.totalValue === undefined) {
        console.error("Received invalid participant update data:", data);
        return;
    }

    // Initialize round if it doesn't exist locally (should be rare)
    if (!currentRound) {
        console.warn("Received deposit for non-existent round, initializing locally.");
        currentRound = {
            roundId: data.roundId,
            status: 'active', // Assume active if getting deposits
            timeLeft: 120,
            totalValue: 0,
            participants: [],
            items: [] // Items might need separate handling or updates
        };
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Received deposit for wrong round (${data.roundId}), expected ${currentRound.roundId}. Ignoring.`);
        return;
    }

    if (!currentRound.participants) {
        currentRound.participants = [];
    }

    // Update or add participant
    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user.id === data.userId) {
            participantFound = true;
            // Update existing participant's value and tickets
            return {
                ...p,
                itemsValue: data.itemsValue, // Use the latest value from the server
                tickets: data.tickets // Use the latest tickets from the server
            };
        }
        return p;
    });

    if (!participantFound) {
        currentRound.participants.push({
            user: {
                id: data.userId,
                username: data.username || 'Unknown User', // Add defaults
                avatar: data.avatar || '/img/default-avatar.png'
            },
            itemsValue: data.itemsValue,
            tickets: data.tickets
        });
    }

    // Update total value from server data
    currentRound.totalValue = data.totalValue;

    // Add deposited items to the round's item list (if provided and needed)
    if (data.depositedItems && Array.isArray(data.depositedItems)) {
         if (!currentRound.items) currentRound.items = [];
         // Add items, ensuring they have owner info
         data.depositedItems.forEach(item => {
             currentRound.items.push({ ...item, owner: data.userId });
         });
         // Consider removing duplicates if necessary, though unlikely for deposits
    }

    // Update the entire UI based on new data
    updateRoundUI();

    // Start timer if we now have >= 2 participants and timer isn't already active
    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached (>= 2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120); // Use remaining time from server if available
    }
}

// Start the client-side countdown timer
function startClientTimer(initialTime = 120) {
    if (!timerValue) return;
    if (roundTimer) { // Clear any existing timer interval
        clearInterval(roundTimer);
    }

    let timeLeft = Math.max(0, initialTime); // Ensure non-negative start time
    console.log(`Starting client timer from ${timeLeft}s`);

    // Initial UI update
    updateTimerUI(timeLeft);

    roundTimer = setInterval(() => {
        if (!timerActive) { // Stop interval if timerActive becomes false externally
            clearInterval(roundTimer);
            roundTimer = null;
            console.log("Client timer stopped because timerActive is false.");
            return;
        }

        timeLeft--;
        updateTimerUI(timeLeft); // Update text and circle

        // When timer reaches zero on the client
        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            timerActive = false;
            console.log("Client timer hit zero. Waiting for server winner selection.");
            timerValue.textContent = "Ending"; // Indicate round is ending

            // IMPORTANT: The server should be the source of truth for ending the round
            // and selecting the winner. Do NOT trigger winner selection from client timer.
            // The server will send 'roundRolling' and then 'roundWinner'.

            // Optional: Client-side simulation ONLY for testing if a test button exists
            // const testSpinButton = document.getElementById('testSpinButton');
            // if (testSpinButton) {
            //     console.log("TESTING: Simulating winner selection after client timer ends.");
            //     setTimeout(() => {
            //         if (!isSpinning) { // Only if server hasn't started spin
            //             testRouletteAnimation();
            //         }
            //     }, 1000); // Delay simulation slightly
            // }
        }
    }, 1000);
}

// Update the visual timer circle progress
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return;
    const circumference = 2 * Math.PI * 45; // Assuming radius is 45
    const progress = Math.min(1, Math.max(0, timeLeft / totalTime)); // Clamp progress
    const offset = circumference * (1 - progress);
    timerForeground.style.strokeDasharray = `${circumference}`;
    timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`;
}

// Update the list of participants displayed in the jackpot
function updateParticipantsUI() {
    if (!participantsContainer || !participantCount) {
         console.error("Participants container or count element not found.");
         return;
    }

    // Handle null/undefined round or participants
    const participants = currentRound?.participants || [];
    const totalPotValue = currentRound?.totalValue || 0;

    // Update participant count display
    participantCount.textContent = `${participants.length}/200`; // Assuming max 200

    // Clear previous participant elements
    participantsContainer.innerHTML = '';

    // Show empty message if no participants
    if (participants.length === 0) {
        if (emptyPotMessage) {
            // If the message element exists in HTML, ensure it's visible
            emptyPotMessage.style.display = 'block'; // Or 'flex', 'grid' etc.
            participantsContainer.appendChild(emptyPotMessage); // Append if not already inside
        } else {
            // Fallback if the element doesn't exist - create dynamically
            const tempEmptyMsg = document.createElement('div');
            tempEmptyMsg.className = 'empty-pot-message'; // Add class for styling
            tempEmptyMsg.innerHTML = '<p>No items deposited yet. Be the first!</p>';
            participantsContainer.appendChild(tempEmptyMsg);
        }
        return; // Stop here if no participants
    } else {
        // Hide the dedicated empty message element if it exists and participants are present
        if (emptyPotMessage) {
            emptyPotMessage.style.display = 'none';
        }
    }

    // Create and add elements for each participant
    participants.forEach(participant => {
        // Find items belonging to this participant within the current round's items list
        const userItems = currentRound?.items?.filter(item =>
            item.owner && participant.user && item.owner.toString() === participant.user.id.toString()
        ) || [];

        const participantElement = createParticipantElement(participant, userItems, totalPotValue);
        participantsContainer.appendChild(participantElement);
    });
}

// Create the HTML element for a single participant
function createParticipantElement(participant, items, totalPotValue) {
     // Basic validation
     if (!participant || !participant.user || typeof participant.itemsValue !== 'number') {
         console.error("Invalid participant data for element creation:", participant);
         const errorElement = document.createElement('div');
         errorElement.textContent = "Error loading participant.";
         errorElement.style.color = "red";
         return errorElement;
     }

    const participantElement = document.createElement('div');
    participantElement.className = 'participant';
    participantElement.dataset.userId = participant.user.id;

    // Calculate percentage chance
    const percentage = totalPotValue > 0 ?
        ((participant.itemsValue / totalPotValue) * 100) :
        0; // Avoid division by zero

    // Ensure user details have defaults
    const username = participant.user.username || 'Unknown';
    const avatar = participant.user.avatar || '/img/default-avatar.png';

    // Create header with user info, value, and percentage
    const headerElement = document.createElement('div');
    headerElement.className = 'participant-header';
    headerElement.innerHTML = `
        <div class="participant-info">
            <img src="${avatar}" alt="${username}" class="participant-avatar" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';">
            <div class="participant-details">
                <span class="participant-name" title="${username}">${username}</span>
                <div class="participant-stats">
                    <span class="participant-value" title="Deposited Value">$${participant.itemsValue.toFixed(2)}</span>
                    <span class="participant-percentage" title="Win Chance">${percentage.toFixed(2)}%</span>
                </div>
            </div>
        </div>
    `;

    // Create container for the participant's deposited items
    const itemsElement = document.createElement('div');
    itemsElement.className = 'participant-items';

    // Add item elements
    if (items && items.length > 0) {
        // Sort items by value (descending) for display, perhaps? Optional.
        items.sort((a, b) => (b.price || 0) - (a.price || 0));

        items.forEach(item => {
             // Basic item validation
             if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;

            const itemElement = document.createElement('div');
            itemElement.className = 'item'; // Add class for styling individual items
             itemElement.title = `${item.name} ($${item.price.toFixed(2)})`; // Tooltip

            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
                <span class="item-value">$${item.price.toFixed(2)}</span>
            `;
            itemsElement.appendChild(itemElement);
        });
    } else {
        // Optionally show a message if item details aren't available
        // itemsElement.innerHTML = '<p class="no-items-display">Items not shown.</p>';
    }

    // Append header and items to the main participant element
    participantElement.appendChild(headerElement);
    participantElement.appendChild(itemsElement);

    return participantElement;
}


// =================== ROULETTE ANIMATION ===================

// Handle winner announcement received from server
function handleWinnerAnnouncement(data) {
    if (isSpinning) {
         console.warn("Received winner announcement while already spinning. Ignoring.");
         return;
    }

    // Ensure we have participant data locally before starting animation
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error("Cannot announce winner: Local participant data is missing.");
        // Maybe request round data again? Or just wait for reset.
        resetToJackpotView();
        return;
    }
    // Validate winner data structure
    if (!data || !data.winner || !data.winner.id) {
         console.error("Received invalid winner data:", data);
         resetToJackpotView();
         return;
    }

    console.log(`Winner announced by server: ${data.winner.username} (ID: ${data.winner.id})`);

    // Stop client timer if it's somehow still running
    if (timerActive) {
        timerActive = false;
        clearInterval(roundTimer);
        roundTimer = null;
        console.log("Stopped client timer on winner announcement.");
    }

    // Switch UI to roulette view
    switchToRouletteView();

    // Start the animation, passing the server's winner data
    startRouletteAnimation(data);
}

// Switch UI layout to show the roulette spinner
function switchToRouletteView() {
     if (!jackpotHeader || !inlineRoulette) {
         console.error("Cannot switch to roulette view: Missing header or roulette elements.");
         return;
     }
    // Hide jackpot-specific elements within the header
    const jackpotValueDisplay = jackpotHeader.querySelector('.jackpot-value');
    const jackpotTimerDisplay = jackpotHeader.querySelector('.jackpot-timer');
    const jackpotStatsDisplay = jackpotHeader.querySelector('.jackpot-stats'); // e.g., participant count

    if (jackpotValueDisplay) jackpotValueDisplay.style.display = 'none';
    if (jackpotTimerDisplay) jackpotTimerDisplay.style.display = 'none';
    if (jackpotStatsDisplay) jackpotStatsDisplay.style.display = 'none';

    // Add a class to the header for potential style changes in roulette mode
    jackpotHeader.classList.add('roulette-mode');

    // Show the inline roulette container
    inlineRoulette.style.display = 'block'; // Or 'flex' depending on layout
}

// Start the roulette spinning animation
function startRouletteAnimation(winnerData) {
     if (!rouletteTrack || !winnerInfo || !returnToJackpot) {
         console.error("Cannot start roulette animation: Missing essential DOM elements.");
         isSpinning = false;
         resetToJackpotView();
         return;
     }
    isSpinning = true;
    winnerInfo.style.display = 'none'; // Hide previous winner info
    returnToJackpot.style.display = 'none'; // Hide reset button during spin
    clearConfetti(); // Clear previous confetti

    // Create the visual items for the roulette track based on current participants
    createRouletteItems();

    // Find the detailed winner object using server data and local participant list
    const winner = findWinnerFromData(winnerData);
    if (!winner) {
        console.error('Could not determine winner details for animation. Aborting spin.');
        isSpinning = false;
        resetToJackpotView(); // Reset view if winner can't be found locally
        return;
    }
    console.log('Starting animation targeting Winner:', winner.user.username);

    // Play spin sound
    if (spinSound) {
        spinSound.currentTime = 0; // Rewind sound
        spinSound.play().catch(e => console.error('Error playing spin sound:', e));
    }

    // Delay slightly before starting the actual spin calculation and animation
    // This allows the browser to render the newly created roulette items
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) {
            console.error('Cannot spin, no items were rendered in the roulette track.');
            isSpinning = false;
            resetToJackpotView();
            return;
        }

        // Find a target winning item on the track
        const targetIndex = findTargetItemIndex(items, winner.user.id);
        if (targetIndex === -1 || !items[targetIndex]) {
             console.error('Could not find a valid winning element on the track for ID:', winner.user.id);
             isSpinning = false;
             resetToJackpotView();
             return;
        }
        const winningElement = items[targetIndex];
        console.log(`Targeting item at index ${targetIndex} for winner ${winner.user.username}`);


        // Calculate the final scroll position to center the winning element
        const container = inlineRoulette.querySelector('.roulette-container'); // Need the container with the marker/pointer
        if (!container) {
             console.error("Roulette container element not found for centering calculation.");
             isSpinning = false;
             resetToJackpotView();
             return;
        }
        const containerWidth = container.offsetWidth;
        const itemWidth = winningElement.offsetWidth;
        const itemOffsetLeft = winningElement.offsetLeft; // Position relative to the track

         // Calculate the position needed to center the middle of the item under the marker
         // Marker is assumed to be at containerWidth / 2
        const targetScrollPosition = -(itemOffsetLeft + (itemWidth / 2) - (containerWidth / 2));

        // Add some random offset variation (+/- half item width) for visual variety
        const randomOffset = (Math.random() - 0.5) * itemWidth * 0.8;
        const finalTargetPosition = targetScrollPosition + randomOffset;


        // Apply the CSS transition for the spin animation
        rouletteTrack.style.transition = `transform ${SPIN_DURATION_SECONDS}s cubic-bezier(${SPIN_ACCELERATION}, 0, ${SPIN_DECELERATION}, 1)`;
        rouletteTrack.style.transform = `translateX(${finalTargetPosition}px)`;

        // Use a flag to ensure handleSpinEnd runs only once
        let spinEndHandled = false;

        // Event listener for when the transition finishes
        const transitionEndHandler = () => {
             if (!spinEndHandled) {
                spinEndHandled = true;
                console.log("TransitionEnd event fired.");
                handleSpinEnd(winningElement, winner);
             }
        };
        rouletteTrack.addEventListener('transitionend', transitionEndHandler, { once: true });

        // Fallback timer: Trigger end handler slightly after duration,
        // in case 'transitionend' event doesn't fire reliably (e.g., tabbed away)
        setTimeout(() => {
            if (!spinEndHandled) {
                 spinEndHandled = true;
                 console.warn("Fallback timer triggered for spin end.");
                 // Manually remove the event listener if the fallback triggers
                 rouletteTrack.removeEventListener('transitionend', transitionEndHandler);
                 handleSpinEnd(winningElement, winner);
            }
        }, (SPIN_DURATION_SECONDS * 1000) + 500); // Wait 500ms extra

    }, 100); // Short delay (100ms) to allow rendering before animation starts
}


// Create the visual items (participant avatars) for the roulette track
function createRouletteItems() {
    if (!rouletteTrack) {
        console.error("Cannot create roulette items: Track element not found.");
        return;
    }
    rouletteTrack.innerHTML = ''; // Clear previous items
    rouletteTrack.style.transition = 'none'; // Disable transitions during setup
    rouletteTrack.style.transform = 'translateX(0)'; // Reset scroll position

    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('Cannot create roulette items: No participants data available.');
        return;
    }

    // Create a weighted pool based on tickets (1 ticket per $0.01 value, min 1 ticket)
    let ticketPool = [];
    currentRound.participants.forEach(participant => {
        // Use server-provided tickets if available, otherwise calculate
        const tickets = participant.tickets !== undefined ? participant.tickets : Math.max(1, Math.floor((participant.itemsValue || 0) * 100));

        // Add the participant object to the pool 'tickets' times
        for (let i = 0; i < tickets; i++) {
            ticketPool.push(participant);
        }
    });

    if (ticketPool.length === 0) {
        console.error("Ticket pool is empty after processing participants. Cannot create roulette items.");
        return;
    }

    // Shuffle the pool thoroughly for visual randomness
    ticketPool = shuffleArray([...ticketPool]); // Use spread to shuffle a copy

    // Determine how many items to render
    // Need enough items to fill the visual area multiple times for a good spin effect
    const container = inlineRoulette?.querySelector('.roulette-container');
    const containerWidth = container?.offsetWidth || 1000; // Default width if not found
    const estimatedItemWidth = 100; // Estimate average item width in pixels
    const itemsNeededForView = Math.ceil(containerWidth / estimatedItemWidth);
    // Render at least ~3 viewports worth, plus repetitions, but cap for performance
    const minItemsToCreate = itemsNeededForView * 3;
    const maxItemsToCreate = 500; // Performance cap

    const totalItemsToCreate = Math.max(
        minItemsToCreate,
        Math.min(ticketPool.length * ROULETTE_REPETITIONS, maxItemsToCreate)
    );


    // Use a DocumentFragment for performance when adding many items
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < totalItemsToCreate; i++) {
        // Get participant from the shuffled pool, cycling through if needed
        const participant = ticketPool[i % ticketPool.length];
        if (!participant || !participant.user) continue; // Skip if data is malformed

        // Add color cycling for visual distinction (e.g., 5 repeating colors)
        const colorClass = `item-color-${(i % 5) + 1}`;

        const item = document.createElement('div');
        item.className = `roulette-item ${colorClass}`;
        item.dataset.userId = participant.user.id; // Store user ID for finding the winner

        // Calculate percentage for display on the item (optional)
        const percentage = currentRound.totalValue > 0 ?
            ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(1) : // 1 decimal place is enough here
            '0.0';

        const avatar = participant.user.avatar || '/img/default-avatar.png';
        const username = participant.user.username || 'Unknown';

        item.innerHTML = `
            <div class="profile-pic-container">
                <img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';">
            </div>
            <div class="roulette-info">
                <span class="roulette-name" title="${username}">${username}</span>
                <span class="roulette-percentage">${percentage}%</span>
            </div>
        `;
        fragment.appendChild(item);
    }

    rouletteTrack.appendChild(fragment);
    console.log(`Created ${totalItemsToCreate} items for the roulette track.`);
}

// Handle the end of the spin animation
function handleSpinEnd(winningElement, winner) {
    if (!isSpinning) return; // Prevent multiple calls if fallback and event fire
    isSpinning = false;
    console.log("Spin animation finished. Handling end state.");

    // Stop spin sound if playing
    if (spinSound && !spinSound.paused) {
        spinSound.pause();
        spinSound.currentTime = 0;
    }

    // Highlight the actual winning element on the track
    if (winningElement) {
        winningElement.classList.add('winner-highlight'); // Use a distinct class
    }

    // Delay showing winner info for dramatic effect
    setTimeout(() => {
        if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
            // Populate winner details section
            winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
            winnerAvatar.alt = winner.user.username || 'Winner';
            winnerName.textContent = winner.user.username || 'Winner';
             // Ensure 'value' and 'percentage' are part of the 'winner' object from findWinnerFromData
            winnerDeposit.textContent = `$${(winner.value || 0).toFixed(2)}`;
            winnerChance.textContent = `${(winner.percentage || 0).toFixed(2)}%`;

            // Show winner info section
            winnerInfo.style.display = 'block'; // Or 'flex'

            // Launch confetti animation
            launchConfetti();

            // Set timeout to automatically reset the view back to the jackpot state
            // Ensure returnToJackpot button is hidden until reset
            if(returnToJackpot) returnToJackpot.style.display = 'none';
            setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);

        } else {
            console.error("Winner data is incomplete or DOM elements missing, cannot display winner info.");
            resetToJackpotView(); // Reset immediately if info can't be shown
        }
    }, 500); // Delay after spin stops (adjust as needed)
}

// Reset UI from roulette/winner view back to the standard jackpot view
function resetToJackpotView() {
    console.log("Resetting to jackpot view.");
    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) {
         console.error("Cannot reset view: Missing essential DOM elements.");
         return;
    }
    // Reset header state
    jackpotHeader.classList.remove('roulette-mode');

    // Show standard jackpot header elements
    const jackpotValueDisplay = jackpotHeader.querySelector('.jackpot-value');
    const jackpotTimerDisplay = jackpotHeader.querySelector('.jackpot-timer');
    const jackpotStatsDisplay = jackpotHeader.querySelector('.jackpot-stats');
    if (jackpotValueDisplay) jackpotValueDisplay.style.display = 'block'; // Or 'flex'
    if (jackpotTimerDisplay) jackpotTimerDisplay.style.display = 'block'; // Or 'flex'
    if (jackpotStatsDisplay) jackpotStatsDisplay.style.display = 'block'; // Or 'flex'

    // Hide roulette/winner elements
    inlineRoulette.style.display = 'none';
    winnerInfo.style.display = 'none';
    if (returnToJackpot) returnToJackpot.style.display = 'none'; // Keep reset button hidden

    // Clear confetti
    clearConfetti();

    // Reset roulette track (clear items, remove highlight, reset position/transition)
    const winnerElement = rouletteTrack.querySelector('.roulette-item.winner-highlight');
    if (winnerElement) {
        winnerElement.classList.remove('winner-highlight');
    }
    rouletteTrack.style.transition = 'none'; // Remove transition before resetting position
    rouletteTrack.style.transform = 'translateX(0)';
    // Defer clearing innerHTML slightly to avoid potential visual glitches during transition removal
    setTimeout(() => {
        rouletteTrack.innerHTML = '';
    }, 50);


    // Reset state variables
    isSpinning = false;
    // timerActive should already be false, but ensure it is
    timerActive = false;
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }

    // --- Initiate the next round ---
    // This should ideally be driven by the server sending 'roundCreated'
    // However, if the client needs to visually reset *before* the server sends the new round:
    initiateNewRoundVisualReset();

    // Optionally, explicitly request new round data if needed
    // socket.emit('requestRoundData');
}

// Visually reset UI elements for a new round (Pot, Participants, Timer display)
// Called by resetToJackpotView, anticipates the new round data from the server.
function initiateNewRoundVisualReset() {
    console.log("Visually resetting UI for the next round.");

    // Reset timer display to default (e.g., 120) but don't start the countdown
    updateTimerUI(120); // Show 120 visually
     if(timerValue) timerValue.classList.remove('urgent-pulse', 'timer-pulse'); // Remove pulse effects


    // Clear participants container and show empty message
    if (participantsContainer) {
        participantsContainer.innerHTML = '';
        if (emptyPotMessage) {
            emptyPotMessage.style.display = 'block'; // Or 'flex'
             participantsContainer.appendChild(emptyPotMessage);
        } else {
            const tempEmptyMsg = document.createElement('div');
            tempEmptyMsg.className = 'empty-pot-message';
            tempEmptyMsg.innerHTML = '<p>Waiting for next round...</p>';
            participantsContainer.appendChild(tempEmptyMsg);
        }
    }

    // Reset pot value display
    if (potValue) potValue.textContent = "$0.00";

    // Reset participant count display
    if (participantCount) participantCount.textContent = "0/200";

    // Note: currentRound object itself will be updated by the 'roundCreated' or 'roundData' socket event.
    // Avoid creating a new client-side round object here to prevent sync issues.
}


// Generate a random hash (Placeholder - server should handle actual seed generation)
function generateRandomHash() {
    return Array.from(Array(64))
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');
}

// Find winner details from local participant data based on server winner ID
function findWinnerFromData(winnerData) {
    if (!currentRound || !currentRound.participants || !winnerData || !winnerData.winner || !winnerData.winner.id) {
        console.error("Missing data to find winner details:", { winnerData, currentRound });
        return null;
    }

    const winnerId = winnerData.winner.id;
    const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winnerId);

    if (!winnerParticipant) {
        // This might happen if the client's participant list is out of sync
        console.warn(`Winner with ID ${winnerId} not found in local participant list. Using data from server directly.`);
        // Fallback to using the potentially incomplete data from winnerData if participant not found locally
        return {
            user: {
                id: winnerData.winner.id,
                username: winnerData.winner.username || 'Unknown Winner',
                avatar: winnerData.winner.avatar || '/img/default-avatar.png'
            },
            percentage: winnerData.winner.percentage || 0, // Use percentage if provided by server
            value: winnerData.winner.value || 0 // Use value if provided by server
        };
    }

    // Calculate percentage based on local data for consistency
    const totalValue = currentRound.totalValue || 1; // Avoid division by zero
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;

    return {
        user: { // Return the full user object from the local participant data
            id: winnerParticipant.user.id,
            username: winnerParticipant.user.username,
            avatar: winnerParticipant.user.avatar
        },
        percentage: percentage || 0,
        value: winnerParticipant.itemsValue || 0
    };
}

// Find a suitable index on the roulette track for the winning user ID
function findTargetItemIndex(items, winnerId) {
    if (!items || items.length === 0) return -1; // Return -1 if no items

    // Try to find a winning item within a visually appealing range (e.g., 60-80% of the track)
    // This avoids always landing near the very beginning or end of the generated items.
    const preferredMinIndex = Math.floor(items.length * 0.60);
    const preferredMaxIndex = Math.floor(items.length * 0.85);

    const potentialIndices = [];
    for (let i = preferredMinIndex; i <= preferredMaxIndex; i++) {
        // Check if item exists and belongs to the winner
        if (items[i] && items[i].dataset.userId === winnerId.toString()) {
            potentialIndices.push(i);
        }
    }

    if (potentialIndices.length > 0) {
        // Pick a random index from the suitable ones found
        const randomIndex = Math.floor(Math.random() * potentialIndices.length);
        console.log(`Found ${potentialIndices.length} winner items in preferred range. Choosing index: ${potentialIndices[randomIndex]}`);
        return potentialIndices[randomIndex];
    }

    // Fallback: If no winner item found in the preferred range, search the entire track
    console.warn(`No winner item found in preferred range (${preferredMinIndex}-${preferredMaxIndex}). Searching full track.`);
    const fallbackIndices = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].dataset.userId === winnerId.toString()) {
            fallbackIndices.push(i);
        }
    }

    if (fallbackIndices.length > 0) {
         // Pick a random index from all occurrences
         const fallbackRandomIndex = Math.floor(Math.random() * fallbackIndices.length);
         console.log(`Found ${fallbackIndices.length} winner items in full track. Choosing index: ${fallbackIndices[fallbackRandomIndex]}`);
         return fallbackIndices[fallbackRandomIndex];
    }

    // VERY unlikely fallback: Winner announced but no item found on track (sync issue?)
    console.error(`FATAL: No roulette item found anywhere on the track for winner ID ${winnerId}!`);
    // Return a default index (e.g., middle) to prevent complete failure, although animation will be wrong.
    return Math.floor(items.length / 2);
}


// Launch confetti animation
function launchConfetti() {
    if (!confettiContainer) return;
    clearConfetti(); // Clear any existing confetti first

    const colors = ['#00ffaa', '#33ccff', '#9933ff', '#ffcc00', '#ff3366', '#ffffff'];

    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        // Random horizontal start position
        confetti.style.left = `${Math.random() * 100}%`;
        // Random color
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        // Random size (e.g., 5px to 13px)
        const size = Math.random() * 8 + 5;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;

        // Random shape (mostly square, sometimes circle)
        if (Math.random() > 0.7) {
            confetti.style.borderRadius = '50%';
        }

        // Random animation duration and delay for variation
        confetti.style.animationDuration = `${Math.random() * 3 + 2}s`; // 2-5 seconds
        confetti.style.animationDelay = `${Math.random() * 0.5}s`; // 0-0.5 seconds delay

        confettiContainer.appendChild(confetti);
    }
}

// Clear confetti particles from the container
function clearConfetti() {
    if (confettiContainer) {
        confettiContainer.innerHTML = '';
    }
}

// Test function to trigger roulette animation with sample data (for development)
function testRouletteAnimation() {
    console.log("--- RUNNING TEST ROULETTE ANIMATION ---");
    if (isSpinning) {
        console.log("Already spinning, test ignored.");
        return;
    }

    // Use current round data if available, otherwise create sample data
    let testRoundData = currentRound;

    if (!testRoundData || !testRoundData.participants || testRoundData.participants.length === 0) {
        console.log('No current round data, creating sample test data...');
        testRoundData = {
            roundId: Date.now(), // Unique ID for test
            status: 'active',
            totalValue: 194.66,
            participants: [
                { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
                { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
                { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
                 { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 },
            ],
            items: [] // Test doesn't need detailed items
        };
         // Temporarily set currentRound for the animation functions to use
         currentRound = testRoundData;
    }

     if (!testRoundData.participants || testRoundData.participants.length === 0) {
         showNotification('Test Error', 'Cannot run test spin, no participants in data.');
         return;
     }

    // Choose a random winner from the participants for the test
    const winnerIndex = Math.floor(Math.random() * testRoundData.participants.length);
    const winnerParticipant = testRoundData.participants[winnerIndex];

    // Create mock winner data similar to what the server might send
    const mockWinnerData = {
        roundId: testRoundData.roundId,
        winner: winnerParticipant.user, // Just need the user object
        winningTicket: Math.floor(Math.random() * (winnerParticipant.tickets || 1)) // Mock ticket
    };

    console.log('Test Winner Selected:', mockWinnerData.winner.username);

    // Manually trigger the winner announcement flow
    handleWinnerAnnouncement(mockWinnerData);

     // IMPORTANT: Reset currentRound if it was temporarily set for the test,
     // to avoid interfering with real data later. Best practice is to not modify
     // global state in tests, but this function structure relies on it.
     // Consider passing testRoundData explicitly if refactoring.
     // setTimeout(() => {
     //      if(currentRound === testRoundData) {
     //         // currentRound = null; // Or fetch real data again
     //         console.log("Test data cleared (if it was set).");
     //      }
     // }, WINNER_DISPLAY_DURATION + 1000); // Reset after animation finishes
}


// =================== PROVABLY FAIR ===================

// Verify round fairness using user input and backend API
async function verifyRound() {
    const roundIdInput = document.getElementById('round-id');
    const serverSeedInput = document.getElementById('server-seed');
    const clientSeedInput = document.getElementById('client-seed');
    const verificationResult = document.getElementById('verification-result');

    if (!roundIdInput || !serverSeedInput || !clientSeedInput || !verificationResult) {
        console.error("Missing elements for verification form.");
        showNotification('Error', 'Verification form elements are missing.');
        return;
    }

    const roundId = roundIdInput.value.trim();
    const serverSeed = serverSeedInput.value.trim();
    const clientSeed = clientSeedInput.value.trim(); // Usually provided by the user or generated locally

    if (!roundId || !serverSeed || !clientSeed) {
        verificationResult.style.display = 'block';
        verificationResult.className = 'verification-result error'; // Add classes for styling
        verificationResult.innerHTML = '<p>Please fill in Round ID, Server Seed, and Client Seed.</p>';
        return;
    }

    // Basic seed format checks (e.g., length for hash)
    if (serverSeed.length !== 64) { // Assuming SHA256 hash length for server seed
         verificationResult.style.display = 'block';
         verificationResult.className = 'verification-result error';
         verificationResult.innerHTML = '<p>Invalid Server Seed format (expected 64 hex characters).</p>';
         return;
    }
    // Add client seed format checks if applicable

    try {
        verificationResult.style.display = 'block';
        verificationResult.className = 'verification-result loading'; // Style for loading state
        verificationResult.innerHTML = '<p>Verifying...</p>';

        const response = await fetch('/api/verify', { // Ensure this API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId, serverSeed, clientSeed })
        });

        const result = await response.json(); // Always try to parse JSON

        if (!response.ok) {
            // Use error message from backend if available, otherwise use status
            throw new Error(result.error || `Verification failed (${response.status})`);
        }

        // --- Display Verification Result ---
        verificationResult.className = `verification-result ${result.verified ? 'success' : 'error'}`;

        let resultHTML = `<h4>Verification Result (Round #${result.roundId || roundId})</h4>`;
        if (result.verified) {
            resultHTML += `
                <p style="color: green; font-weight: bold;">✅ Verification Successful! The round was fair.</p>
                <p><strong>Server Seed Hash (used during round):</strong> ${result.serverSeedHash || 'N/A'}</p>
                <p><strong>Server Seed (revealed after round):</strong> ${result.serverSeed}</p>
                <p><strong>Client Seed:</strong> ${result.clientSeed}</p>
                <p><strong>Combined String (for hashing):</strong> ${result.combinedString || 'N/A'}</p>
                <p><strong>Resulting Hash:</strong> ${result.finalHash || 'N/A'}</p>
                <p><strong>Calculated Winning Ticket Number:</strong> ${result.winningTicket ?? 'N/A'}</p>
                 <p><strong>Actual Winner:</strong> ${result.winnerUsername || 'N/A'} (determined by server using this ticket number)</p>
            `;
        } else {
            resultHTML += `
                <p style="color: red; font-weight: bold;">❌ Verification Failed!</p>
                <p><strong>Reason:</strong> ${result.reason || 'Mismatch found or error during verification.'}</p>
                 ${result.serverSeedHash ? `<p><strong>Server Seed Hash (used during round):</strong> ${result.serverSeedHash}</p>` : ''}
                 ${result.serverSeed ? `<p><strong>Provided Server Seed:</strong> ${result.serverSeed}</p>` : ''}
                 ${result.clientSeed ? `<p><strong>Provided Client Seed:</strong> ${result.clientSeed}</p>` : ''}
                 ${result.winningTicket !== undefined ? `<p><strong>Calculated Winning Ticket (based on provided seeds):</strong> ${result.winningTicket}</p>` : ''}
                 ${result.actualWinningTicket !== undefined ? `<p><strong>Actual Winning Ticket (from round data):</strong> ${result.actualWinningTicket}</p>` : ''}
                 ${result.winnerUsername ? `<p><strong>Actual Winner:</strong> ${result.winnerUsername}</p>` : ''}

            `;
        }
        verificationResult.innerHTML = resultHTML;

    } catch (error) {
        verificationResult.style.display = 'block';
        verificationResult.className = 'verification-result error';
        verificationResult.innerHTML = `<p>Error during verification: ${error.message}</p>`;
        console.error('Error verifying round:', error);
    }
}

// Load past rounds history for the provably fair page
async function loadPastRounds(page = 1) {
    if (!roundsTableBody || !roundsPagination) {
        console.warn("Rounds table body or pagination element not found. Cannot load history.");
        return;
    }

    try {
        roundsTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading past rounds...</td></tr>'; // Show loading state
        roundsPagination.innerHTML = ''; // Clear old pagination

        const response = await fetch(`/api/rounds?page=${page}&limit=10`); // Ensure this API endpoint exists

        if (!response.ok) {
            throw new Error(`Failed to load past rounds (${response.status})`);
        }

        const data = await response.json();

        // Basic validation of response structure
        if (!data || !Array.isArray(data.rounds) || typeof data.currentPage !== 'number' || typeof data.totalPages !== 'number') {
             throw new Error('Invalid data format received for past rounds.');
        }

        // Clear loading message
        roundsTableBody.innerHTML = '';

        if (data.rounds.length === 0 && data.currentPage === 1) {
            // Show message only if it's the first page and it's empty
            roundsTableBody.innerHTML = '<tr><td colspan="5" class="no-rounds-message">No past rounds found.</td></tr>';
        } else if (data.rounds.length === 0 && data.currentPage > 1) {
             // If a later page is empty (shouldn't happen with proper pagination)
             roundsTableBody.innerHTML = '<tr><td colspan="5" class="no-rounds-message">No rounds found on this page.</td></tr>';
        } else {
            // Add rounds to the table
            data.rounds.forEach(round => {
                const row = document.createElement('tr');

                // Format date safely
                let formattedDate = 'N/A';
                if (round.endTime) {
                    try {
                        const date = new Date(round.endTime);
                         // Check if date is valid before formatting
                        if (!isNaN(date.getTime())) {
                             formattedDate = date.toLocaleString(undefined, { // Use locale default format
                                 year: 'numeric', month: 'short', day: 'numeric',
                                 hour: 'numeric', minute: '2-digit', hour12: true
                             });
                        }
                    } catch (e) { console.error("Error formatting date:", round.endTime, e); }
                }

                row.innerHTML = `
                    <td>#${round.roundId || 'N/A'}</td>
                    <td>${formattedDate}</td>
                    <td>$${round.totalValue ? round.totalValue.toFixed(2) : '0.00'}</td>
                    <td>${round.winner ? (round.winner.username || 'N/A') : 'N/A'}</td>
                    <td>
                        <button class="btn btn-details" onclick="showRoundDetails(${round.roundId})">Details</button>
                        <button class="btn btn-verify" onclick="populateVerificationFields(${round.roundId}, '${round.serverSeed || ''}', '${round.clientSeed || ''}')">Verify</button>
                    </td>
                `;
                // Add data attributes for easier access if needed later
                row.dataset.roundId = round.roundId;
                roundsTableBody.appendChild(row);
            });
        }

        // Create pagination controls
        createPagination(data.currentPage, data.totalPages);

    } catch (error) {
        roundsTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading rounds: ${error.message}</td></tr>`;
        console.error('Error loading past rounds:', error);
    }
}

// Helper function to populate verification inputs from round history
function populateVerificationFields(roundId, serverSeed, clientSeed) {
     const roundIdInput = document.getElementById('round-id');
     const serverSeedInput = document.getElementById('server-seed');
     const clientSeedInput = document.getElementById('client-seed'); // Client seed might not be available in history, user might need to provide it

     if (roundIdInput) roundIdInput.value = roundId || '';
     if (serverSeedInput) serverSeedInput.value = serverSeed || ''; // Server seed only available after round ends
     if (clientSeedInput) {
          // Don't auto-fill client seed unless it's known/stored publicly (less common)
          // clientSeedInput.value = clientSeed || '';
          if (!serverSeed) {
              showNotification('Info', 'Server Seed is revealed after the round ends. You might need to provide your Client Seed.');
          } else {
              showNotification('Info', 'Server Seed populated. Please provide the Client Seed used for this round.');
          }
          clientSeedInput.focus(); // Focus client seed input
     }

     // Scroll to verification section smoothly
     document.getElementById('provably-fair-verification')?.scrollIntoView({ behavior: 'smooth' });
}

// Create pagination controls for the rounds history table
function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return;
    roundsPagination.innerHTML = ''; // Clear existing controls

    if (totalPages <= 1) return; // No pagination needed

    const maxPagesToShow = 5; // Max number of page buttons (e.g., 1 ... 4 5 6 ... 10)

    const createButton = (text, pageNum, isActive = false, isDisabled = false, isEllipsis = false) => {
        if (isEllipsis) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'page-ellipsis';
            return ellipsis;
        }

        const button = document.createElement('button');
        button.className = `page-button ${isActive ? 'active' : ''}`;
        button.textContent = text;
        button.disabled = isDisabled;
        if (!isDisabled && typeof pageNum === 'number') {
            button.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent potential form submission if inside a form
                loadPastRounds(pageNum);
            });
        }
        return button;
    };

    // --- Previous Button ---
    roundsPagination.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));

    // --- Page Number Buttons ---
    if (totalPages <= maxPagesToShow) {
        // Show all pages if total is small enough
        for (let i = 1; i <= totalPages; i++) {
            roundsPagination.appendChild(createButton(i, i, i === currentPage));
        }
    } else {
        // Show ellipsis logic
        let startPage, endPage;
        const pagesEitherSide = Math.floor((maxPagesToShow - 3) / 2); // -3 for first, last, and current page (or ellipsis)

        if (currentPage <= pagesEitherSide + 2) { // Near the beginning
            startPage = 1;
            endPage = maxPagesToShow - 1;
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            for (let i = 2; i <= endPage; i++) {
                roundsPagination.appendChild(createButton(i, i, i === currentPage));
            }
            roundsPagination.appendChild(createButton('...', null, false, true, true)); // Ellipsis
            roundsPagination.appendChild(createButton(totalPages, totalPages, totalPages === currentPage));
        } else if (currentPage >= totalPages - pagesEitherSide - 1) { // Near the end
            startPage = totalPages - maxPagesToShow + 2;
            endPage = totalPages;
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true)); // Ellipsis
            for (let i = startPage; i <= endPage; i++) {
                 roundsPagination.appendChild(createButton(i, i, i === currentPage));
            }
        } else { // In the middle
            startPage = currentPage - pagesEitherSide;
            endPage = currentPage + pagesEitherSide;
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true)); // Ellipsis start
            for (let i = startPage; i <= endPage; i++) {
                roundsPagination.appendChild(createButton(i, i, i === currentPage));
            }
            roundsPagination.appendChild(createButton('...', null, false, true, true)); // Ellipsis end
            roundsPagination.appendChild(createButton(totalPages, totalPages, totalPages === currentPage));
        }
    }


    // --- Next Button ---
    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
