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
const SPIN_DURATION_SECONDS = 7;  // <<< Keeping duration at 8 seconds
const SPIN_ACCELERATION = 0.01; // For cubic-bezier(0.65, 0, 0.25, 1) - Slower start/end emphasis
const SPIN_DECELERATION = 0.65; // For cubic-bezier(0.65, 0, 0.25, 1) - Slower start/end emphasis
const WINNER_DISPLAY_DURATION = 7000; // How long to show winner info (in ms)
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
    if (modalElement) modalElement.style.display = 'flex'; // Changed to flex for centering
    console.log('Showing modal:', modalElement?.id);
}

function hideModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none';
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
    if (pageElement === faqPage && faqLink) faqLink.classList.add('active'); // Simpler selector
    if (pageElement === fairPage && fairLink) fairLink.classList.add('active'); // Simpler selector

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

    // Example data timeout (can be removed for production)
    // setTimeout(() => {
    //     if (!currentRound) {
    //         console.log("No round data from server, creating example data for testing");
    //         currentRound = {
    //             roundId: 1, status: 'active', timeLeft: 120, totalValue: 0,
    //             serverSeedHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    //             participants: [], items: []
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
        // Age verification modal usually shouldn't close on outside click
    });
}

// Socket connection and events
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('requestRoundData');
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showNotification('Connection Lost', 'Disconnected from server. Attempting to reconnect...');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showNotification('Connection Error', 'Could not connect to the server.');
    });

    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        updateRoundUI();
        resetToJackpotView();
    });

    // socket.on('timeUpdate', ...) // Only use if server sends incremental time updates

    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            handleNewDeposit(data);
        } else if (!currentRound && data.roundId) {
            console.warn("Received participant update for an unknown round. Requesting sync.");
            socket.emit('requestRoundData');
        }
    });

    // socket.on('itemDeposited', ...) // Less critical if participantUpdated includes value

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            handleWinnerAnnouncement(data);
        } else {
            console.warn("Received winner for a mismatched round:", data.roundId, "Current:", currentRound?.roundId);
        }
    });

    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false;
            if (roundTimer) {
                clearInterval(roundTimer);
                roundTimer = null;
            }
             if(timerValue) timerValue.textContent = "Rolling";
             if(timerForeground) updateTimerCircle(0, 120); // Visually fill circle instantly
        }
    });

    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (data.message === "No participants." || currentRound?.participants?.length === 0) {
            console.log("Round completed with no participants. Resetting view.");
            setTimeout(resetToJackpotView, 1500);
        }
        // Winner display/reset handled by winner announcement flow
    });

    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data);
        if (!data) {
            console.error("Received invalid initial round data.");
            return;
        }
        currentRound = data;
        updateRoundUI();

        if (currentRound.status === 'rolling' && currentRound.winner) {
             console.log("Connected during rolling phase. Waiting for winner data.");
        }
        else if (currentRound.status === 'active' &&
            currentRound.participants &&
            currentRound.participants.length >= 2 &&
            !timerActive) {
            timerActive = true;
            startClientTimer(currentRound.timeLeft || 120);
        } else if (currentRound.status === 'ended' || currentRound.status === 'completed') {
            console.log("Connected after round ended. Waiting for new round.");
            resetToJackpotView();
        }
    });

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
        updateUserUI();
    }
}

// Update user-specific UI elements
function updateUserUI() {
    if (currentUser && userProfile && loginButton && userAvatar && userName) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
        userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none';
        userProfile.style.display = 'flex';
    } else if (userProfile && loginButton) {
        loginButton.style.display = 'flex';
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
    updateTotalValue();

    inventoryLoading.style.display = 'flex';
    inventoryItems.innerHTML = '';

    try {
        const response = await fetch('/api/inventory'); // Ensure this API endpoint exists
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                 throw new Error('Please log in to view your inventory.');
            } else {
                const errorData = await response.text();
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
    inventoryItems.innerHTML = '';

    userInventory.forEach(item => {
        if (!item || typeof item.price !== 'number' || !item.assetId || !item.name || !item.image) {
            console.warn("Skipping invalid item data:", item);
            return;
        }

        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId;
        itemElement.dataset.name = item.name;
        itemElement.dataset.image = item.image;
        itemElement.dataset.price = item.price.toFixed(2);

        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
            <div class="item-details">
                <div class="item-name" title="${item.name}">${item.name}</div>
                <div class="item-value">$${item.price.toFixed(2)}</div>
            </div>
        `;

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
        selectedItemsList.push(item);
        element.classList.add('selected');
        addSelectedItemElement(item);
    } else {
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

    const inventoryItemElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);

    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        if (inventoryItemElement && item) {
            toggleItemSelection(inventoryItemElement, item);
        } else {
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
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);
    const inventoryElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${assetId}"]`);
    if (inventoryElement) {
        inventoryElement.classList.remove('selected');
    }
    removeSelectedItemElement(assetId);
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

    depositButton.disabled = true;
    depositButton.textContent = 'Depositing...';

    try {
        const response = await fetch('/api/deposit/initiate', { // Ensure this API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: selectedItemsList.map(item => item.assetId)
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to initiate deposit. Please try again.' }));
            throw new Error(error.error || `Deposit failed with status ${response.status}`);
        }

        if (depositModal) hideModal(depositModal);
        showNotification('Deposit Initiated', 'Please check your Steam trade offers to complete the deposit.');

        selectedItemsList = [];
        if(selectedItems) selectedItems.innerHTML = '';
         if (inventoryItems) {
             inventoryItems.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
         }
        updateTotalValue();

    } catch (error) {
        showNotification('Deposit Error', error.message);
        console.error('Error depositing items:', error);
    } finally {
        // Always reset button state
        if(depositButton) {
            depositButton.disabled = selectedItemsList.length === 0; // Re-check based on list
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

    if (!tradeUrl) {
        showNotification('Input Required', 'Please enter your Steam Trade URL.');
        return;
    }
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
        showNotification('Invalid Format', 'Please enter a valid Steam Trade URL.');
        return;
    }
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

        if (currentUser) {
            currentUser.tradeUrl = result.tradeUrl;
        }

        hideModal(tradeUrlModal);
        showModal(depositModal); // Re-open deposit modal
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
        return;
    }
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;
    if (!timerActive) {
        updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : 120);
    }
    updateParticipantsUI();
}

// Update timer display (text and circle)
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;

    const timeToShow = Math.max(0, Math.round(timeLeft));

    if (timerActive || timeToShow > 0) {
         timerValue.textContent = timeToShow;
    } else if (isSpinning) {
         timerValue.textContent = "Rolling";
    } else {
         timerValue.textContent = "Ended";
    }

    updateTimerCircle(timeToShow, 120); // Base visual on 120s

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
    if (!data || !data.roundId || !data.userId || data.itemsValue === undefined || data.totalValue === undefined) {
        console.error("Received invalid participant update data:", data);
        return;
    }

    if (!currentRound) {
        console.warn("Received deposit for non-existent round, initializing locally.");
        currentRound = {
            roundId: data.roundId, status: 'active', timeLeft: 120, totalValue: 0,
            participants: [], items: []
        };
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Received deposit for wrong round (${data.roundId}), expected ${currentRound.roundId}. Ignoring.`);
        return;
    }

    if (!currentRound.participants) currentRound.participants = [];

    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user.id === data.userId) {
            participantFound = true;
            return { ...p, itemsValue: data.itemsValue, tickets: data.tickets };
        }
        return p;
    });

    if (!participantFound) {
        currentRound.participants.push({
            user: { id: data.userId, username: data.username || 'Unknown', avatar: data.avatar || '/img/default-avatar.png' },
            itemsValue: data.itemsValue, tickets: data.tickets
        });
    }

    currentRound.totalValue = data.totalValue;

    if (data.depositedItems && Array.isArray(data.depositedItems)) {
         if (!currentRound.items) currentRound.items = [];
         data.depositedItems.forEach(item => currentRound.items.push({ ...item, owner: data.userId }));
    }

    updateRoundUI();

    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached (>= 2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120);
    }
}

// Start the client-side countdown timer
function startClientTimer(initialTime = 120) {
    if (!timerValue) return;
    if (roundTimer) clearInterval(roundTimer);

    let timeLeft = Math.max(0, initialTime);
    console.log(`Starting client timer from ${timeLeft}s`);
    updateTimerUI(timeLeft);

    roundTimer = setInterval(() => {
        if (!timerActive) {
            clearInterval(roundTimer);
            roundTimer = null;
            console.log("Client timer stopped because timerActive is false.");
            return;
        }

        timeLeft--;
        updateTimerUI(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            timerActive = false;
            console.log("Client timer hit zero. Waiting for server winner selection.");
            if(timerValue) timerValue.textContent = "Ending";
        }
    }, 1000);
}

// Update the visual timer circle progress
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return;
    // Assuming radius is 42 for stroke-dasharray 264 (2 * PI * 42 ~= 263.89)
    const circumference = 264;
    const progress = Math.min(1, Math.max(0, timeLeft / totalTime));
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

    const participants = currentRound?.participants || [];
    const totalPotValue = currentRound?.totalValue || 0;

    participantCount.textContent = `${participants.length}/200`;
    participantsContainer.innerHTML = '';

    if (participants.length === 0) {
        if (emptyPotMessage) {
            emptyPotMessage.style.display = 'block';
             if (!participantsContainer.contains(emptyPotMessage)) { // Ensure it's added if needed
                 participantsContainer.appendChild(emptyPotMessage);
             }
        } else {
            const tempEmptyMsg = document.createElement('div');
            tempEmptyMsg.className = 'empty-pot-message';
            tempEmptyMsg.innerHTML = '<p>No items deposited yet. Be the first!</p>';
            participantsContainer.appendChild(tempEmptyMsg);
        }
        return;
    } else {
        if (emptyPotMessage) emptyPotMessage.style.display = 'none';
    }

    participants.forEach(participant => {
        const userItems = currentRound?.items?.filter(item =>
            item.owner && participant.user && item.owner.toString() === participant.user.id.toString()
        ) || [];
        const participantElement = createParticipantElement(participant, userItems, totalPotValue);
        participantsContainer.appendChild(participantElement);
    });
}

// Create the HTML element for a single participant
function createParticipantElement(participant, items, totalPotValue) {
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

    const percentage = totalPotValue > 0 ? ((participant.itemsValue / totalPotValue) * 100) : 0;
    const username = participant.user.username || 'Unknown';
    const avatar = participant.user.avatar || '/img/default-avatar.png';

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

    const itemsElement = document.createElement('div');
    itemsElement.className = 'participant-items';

    if (items && items.length > 0) {
        items.sort((a, b) => (b.price || 0) - (a.price || 0));
        items.forEach(item => {
             if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;
            const itemElement = document.createElement('div');
            itemElement.className = 'item';
             itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
                <span class="item-value">$${item.price.toFixed(2)}</span>
            `;
            itemsElement.appendChild(itemElement);
        });
    }

    participantElement.appendChild(headerElement);
    participantElement.appendChild(itemsElement);
    return participantElement;
}


// =================== ROULETTE ANIMATION ===================

function handleWinnerAnnouncement(data) {
    if (isSpinning) {
         console.warn("Received winner announcement while already spinning. Ignoring.");
         return;
    }
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error("Cannot announce winner: Local participant data is missing.");
        resetToJackpotView();
        return;
    }
    if (!data || !data.winner || !data.winner.id) {
         console.error("Received invalid winner data:", data);
         resetToJackpotView();
         return;
    }

    console.log(`Winner announced by server: ${data.winner.username} (ID: ${data.winner.id})`);

    if (timerActive) {
        timerActive = false;
        clearInterval(roundTimer);
        roundTimer = null;
        console.log("Stopped client timer on winner announcement.");
    }

    switchToRouletteView();
    startRouletteAnimation(data);
}

function switchToRouletteView() {
     if (!jackpotHeader || !inlineRoulette) {
         console.error("Cannot switch to roulette view: Missing header or roulette elements.");
         return;
     }
    const jackpotValueDisplay = jackpotHeader.querySelector('.jackpot-value');
    const jackpotTimerDisplay = jackpotHeader.querySelector('.jackpot-timer');
    const jackpotStatsDisplay = jackpotHeader.querySelector('.jackpot-stats');

    // Check if elements exist before trying to hide
    if (jackpotValueDisplay) jackpotValueDisplay.style.display = 'none';
    if (jackpotTimerDisplay) jackpotTimerDisplay.style.display = 'none';
    if (jackpotStatsDisplay) jackpotStatsDisplay.style.display = 'none';

    jackpotHeader.classList.add('roulette-mode');
    inlineRoulette.style.display = 'block';
}

function startRouletteAnimation(winnerData) {
     if (!rouletteTrack || !winnerInfo || !returnToJackpot) {
         console.error("Cannot start roulette animation: Missing essential DOM elements.");
         isSpinning = false;
         resetToJackpotView();
         return;
     }
    isSpinning = true;
    winnerInfo.style.display = 'none';
    returnToJackpot.style.display = 'none';
    clearConfetti();
    createRouletteItems();

    const winner = findWinnerFromData(winnerData);
    if (!winner) {
        console.error('Could not determine winner details for animation. Aborting spin.');
        isSpinning = false;
        resetToJackpotView();
        return;
    }
    console.log('Starting animation targeting Winner:', winner.user.username);

    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.error('Error playing spin sound:', e));
    }

    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) {
            console.error('Cannot spin, no items were rendered in the roulette track.');
            isSpinning = false;
            resetToJackpotView();
            return;
        }

        const targetIndex = findTargetItemIndex(items, winner.user.id);
        if (targetIndex === -1 || !items[targetIndex]) {
             console.error('Could not find a valid winning element on the track for ID:', winner.user.id);
             isSpinning = false;
             resetToJackpotView();
             return;
        }
        const winningElement = items[targetIndex];
        console.log(`Targeting item at index ${targetIndex} for winner ${winner.user.username}`);

        const container = inlineRoulette.querySelector('.roulette-container');
        if (!container) {
             console.error("Roulette container element not found for centering calculation.");
             isSpinning = false;
             resetToJackpotView();
             return;
        }
        const containerWidth = container.offsetWidth;
        // Ensure offsetWidth is read *after* items are rendered and visible
        const itemWidth = winningElement.offsetWidth || 90; // Fallback width
        const itemOffsetLeft = winningElement.offsetLeft;

        const targetScrollPosition = -(itemOffsetLeft + (itemWidth / 2) - (containerWidth / 2));
        // Add random offset variation (+/- ~40% item width) for visual variety
        const randomOffset = (Math.random() - 0.5) * itemWidth * 0.8;
        const finalTargetPosition = targetScrollPosition + randomOffset;

        // Apply the CSS transition for the spin animation
        // Using 8s duration and the new slower-start cubic-bezier curve
        // cubic-bezier(0.65, 0, 0.35, 1)
        rouletteTrack.style.transition = `transform ${SPIN_DURATION_SECONDS}s cubic-bezier(${SPIN_ACCELERATION}, 0, ${SPIN_DECELERATION}, 1)`;
        rouletteTrack.style.transform = `translateX(${finalTargetPosition}px)`;

        let spinEndHandled = false;
        const transitionEndHandler = () => {
             if (!spinEndHandled) {
                spinEndHandled = true;
                console.log("TransitionEnd event fired.");
                handleSpinEnd(winningElement, winner);
             }
        };
        rouletteTrack.addEventListener('transitionend', transitionEndHandler, { once: true });

        // Fallback timer: Trigger end handler slightly after duration
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

function createRouletteItems() {
    if (!rouletteTrack) {
        console.error("Cannot create roulette items: Track element not found.");
        return;
    }
    rouletteTrack.innerHTML = '';
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';

    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('Cannot create roulette items: No participants data available.');
        return;
    }

    let ticketPool = [];
    currentRound.participants.forEach(participant => {
        const tickets = participant.tickets !== undefined ? participant.tickets : Math.max(1, Math.floor((participant.itemsValue || 0) * 100));
        for (let i = 0; i < tickets; i++) {
            ticketPool.push(participant);
        }
    });

    if (ticketPool.length === 0) {
        console.error("Ticket pool is empty after processing participants. Cannot create roulette items.");
        return;
    }

    ticketPool = shuffleArray([...ticketPool]);

    const container = inlineRoulette?.querySelector('.roulette-container');
    const containerWidth = container?.offsetWidth || 1000;
    const estimatedItemWidth = 100; // Item width (90) + margin (10)
    const itemsNeededForView = Math.ceil(containerWidth / estimatedItemWidth);
    // Adjust min items for 8s duration
    const minItemsToCreate = itemsNeededForView * 2.5; // Revert to this for 8s?
    const maxItemsToCreate = 400;

    const totalItemsToCreate = Math.max(
        minItemsToCreate,
        Math.min(ticketPool.length * ROULETTE_REPETITIONS, maxItemsToCreate)
    );

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < totalItemsToCreate; i++) {
        const participant = ticketPool[i % ticketPool.length];
        if (!participant || !participant.user) continue;

        const colorClass = `item-color-${(i % 5) + 1}`;
        const item = document.createElement('div');
        item.className = `roulette-item ${colorClass}`;
        item.dataset.userId = participant.user.id;

        const percentage = currentRound.totalValue > 0 ?
            ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(1) : '0.0';
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

function handleSpinEnd(winningElement, winner) {
    if (!isSpinning) return;
    isSpinning = false;
    console.log("Spin animation finished. Handling end state.");

    if (spinSound && !spinSound.paused) {
        spinSound.pause();
        spinSound.currentTime = 0;
    }

    if (winningElement) {
        winningElement.classList.add('winner-highlight');
    }

    setTimeout(() => {
        if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
            winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
            winnerAvatar.alt = winner.user.username || 'Winner';
            winnerName.textContent = winner.user.username || 'Winner';
            winnerDeposit.textContent = `$${(winner.value || 0).toFixed(2)}`;
            winnerChance.textContent = `${(winner.percentage || 0).toFixed(2)}%`;

            // Use flex as per CSS definition
             winnerInfo.style.display = 'flex';

            launchConfetti();

            if(returnToJackpot) returnToJackpot.style.display = 'none';
            setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);

        } else {
            console.error("Winner data is incomplete or DOM elements missing, cannot display winner info.");
            resetToJackpotView();
        }
    }, 500);
}

function resetToJackpotView() {
    console.log("Resetting to jackpot view.");
    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) {
         console.error("Cannot reset view: Missing essential DOM elements.");
         return;
    }
    jackpotHeader.classList.remove('roulette-mode');

    const jackpotValueDisplay = jackpotHeader.querySelector('.jackpot-value');
    const jackpotTimerDisplay = jackpotHeader.querySelector('.jackpot-timer');
    const jackpotStatsDisplay = jackpotHeader.querySelector('.jackpot-stats');
    // Check if elements exist before trying to show them
    if (jackpotValueDisplay) jackpotValueDisplay.style.display = 'flex'; // Use flex as per CSS
    if (jackpotTimerDisplay) jackpotTimerDisplay.style.display = 'flex';
    if (jackpotStatsDisplay) jackpotStatsDisplay.style.display = 'flex';


    inlineRoulette.style.display = 'none';
    winnerInfo.style.display = 'none';
    if (returnToJackpot) returnToJackpot.style.display = 'none';

    clearConfetti();

    const winnerElement = rouletteTrack.querySelector('.roulette-item.winner-highlight');
    if (winnerElement) {
        winnerElement.classList.remove('winner-highlight');
    }
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';
    setTimeout(() => {
        if(rouletteTrack) rouletteTrack.innerHTML = '';
    }, 50);

    isSpinning = false;
    timerActive = false;
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }

    initiateNewRoundVisualReset();
}

function initiateNewRoundVisualReset() {
    console.log("Visually resetting UI for the next round.");
    updateTimerUI(120);
     if(timerValue) timerValue.classList.remove('urgent-pulse', 'timer-pulse');

    if (participantsContainer) {
        participantsContainer.innerHTML = '';
        if (emptyPotMessage) {
            // Ensure it's appended if not already inside
            if (!participantsContainer.contains(emptyPotMessage)) {
                participantsContainer.appendChild(emptyPotMessage);
            }
            emptyPotMessage.style.display = 'block';
        } else {
            const tempEmptyMsg = document.createElement('div');
            tempEmptyMsg.className = 'empty-pot-message';
            tempEmptyMsg.innerHTML = '<p>Waiting for next round...</p>';
            participantsContainer.appendChild(tempEmptyMsg);
        }
    }

    if (potValue) potValue.textContent = "$0.00";
    if (participantCount) participantCount.textContent = "0/200";
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
        console.warn(`Winner with ID ${winnerId} not found in local participant list. Using data from server directly.`);
        return {
            user: { id: winnerData.winner.id, username: winnerData.winner.username || 'Unknown', avatar: winnerData.winner.avatar || '/img/default-avatar.png' },
            percentage: winnerData.winner.percentage || 0,
            value: winnerData.winner.value || 0
        };
    }

    const totalValue = currentRound.totalValue || 1;
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;

    return {
        user: { ...winnerParticipant.user }, // Return a copy of the user object
        percentage: percentage || 0,
        value: winnerParticipant.itemsValue || 0
    };
}

// Find a suitable index on the roulette track for the winning user ID
function findTargetItemIndex(items, winnerId) {
    if (!items || items.length === 0) return -1;

    const preferredMinIndex = Math.floor(items.length * 0.60);
    const preferredMaxIndex = Math.floor(items.length * 0.85);
    const potentialIndices = [];

    for (let i = preferredMinIndex; i <= preferredMaxIndex; i++) {
        if (items[i] && items[i].dataset.userId === winnerId.toString()) {
            potentialIndices.push(i);
        }
    }

    if (potentialIndices.length > 0) {
        const randomIndex = Math.floor(Math.random() * potentialIndices.length);
        console.log(`Found ${potentialIndices.length} winner items in preferred range. Choosing index: ${potentialIndices[randomIndex]}`);
        return potentialIndices[randomIndex];
    }

    console.warn(`No winner item found in preferred range (${preferredMinIndex}-${preferredMaxIndex}). Searching full track.`);
    const fallbackIndices = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].dataset.userId === winnerId.toString()) {
            fallbackIndices.push(i);
        }
    }

    if (fallbackIndices.length > 0) {
         const fallbackRandomIndex = Math.floor(Math.random() * fallbackIndices.length);
         console.log(`Found ${fallbackIndices.length} winner items in full track. Choosing index: ${fallbackIndices[fallbackRandomIndex]}`);
         return fallbackIndices[fallbackRandomIndex];
    }

    console.error(`FATAL: No roulette item found anywhere on the track for winner ID ${winnerId}!`);
    return Math.floor(items.length / 2); // Default fallback
}

// Launch confetti animation
function launchConfetti() {
    if (!confettiContainer) return;
    clearConfetti();

    const colors = ['#00ffaa', '#33ccff', '#9933ff', '#ffcc00', '#ff3366', '#ffffff'];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 8 + 5;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        if (Math.random() > 0.7) confetti.style.borderRadius = '50%';
        confetti.style.animationDuration = `${Math.random() * 3 + 2}s`;
        confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        confettiContainer.appendChild(confetti);
    }
}

// Clear confetti particles from the container
function clearConfetti() {
    if (confettiContainer) confettiContainer.innerHTML = '';
}

// Test function to trigger roulette animation with sample data (for development)
function testRouletteAnimation() {
    console.log("--- RUNNING TEST ROULETTE ANIMATION ---");
    if (isSpinning) {
        console.log("Already spinning, test ignored.");
        return;
    }

    let testRoundData = currentRound;
    if (!testRoundData || !testRoundData.participants || testRoundData.participants.length === 0) {
        console.log('No current round data, creating sample test data...');
        testRoundData = {
            roundId: Date.now(), status: 'active', totalValue: 194.66,
            participants: [
                { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
                { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
                { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
                 { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 },
            ],
            items: []
        };
         currentRound = testRoundData; // Temporarily set for animation functions
    }

     if (!testRoundData.participants || testRoundData.participants.length === 0) {
         showNotification('Test Error', 'Cannot run test spin, no participants in data.');
         return;
     }

    const winnerIndex = Math.floor(Math.random() * testRoundData.participants.length);
    const winnerParticipant = testRoundData.participants[winnerIndex];
    const mockWinnerData = {
        roundId: testRoundData.roundId,
        winner: winnerParticipant.user,
        winningTicket: Math.floor(Math.random() * (winnerParticipant.tickets || 1))
    };

    console.log('Test Winner Selected:', mockWinnerData.winner.username);
    handleWinnerAnnouncement(mockWinnerData);
}


// =================== PROVABLY FAIR ===================

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
    const clientSeed = clientSeedInput.value.trim();

    if (!roundId || !serverSeed || !clientSeed) {
        verificationResult.style.display = 'block';
        verificationResult.className = 'verification-result error';
        verificationResult.innerHTML = '<p>Please fill in Round ID, Server Seed, and Client Seed.</p>';
        return;
    }
    if (serverSeed.length !== 64) {
         verificationResult.style.display = 'block';
         verificationResult.className = 'verification-result error';
         verificationResult.innerHTML = '<p>Invalid Server Seed format (expected 64 hex characters).</p>';
         return;
    }

    try {
        verificationResult.style.display = 'block';
        verificationResult.className = 'verification-result loading';
        verificationResult.innerHTML = '<p>Verifying...</p>';

        const response = await fetch('/api/verify', { // Ensure this API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId, serverSeed, clientSeed })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Verification failed (${response.status})`);
        }

        verificationResult.className = `verification-result ${result.verified ? 'success' : 'error'}`;
        let resultHTML = `<h4>Verification Result (Round #${result.roundId || roundId})</h4>`;
        if (result.verified) {
            resultHTML += `
                <p style="color: green; font-weight: bold;">✅ Verification Successful! The round was fair.</p>
                <p><strong>Server Seed Hash (used):</strong> ${result.serverSeedHash || 'N/A'}</p>
                <p><strong>Server Seed (revealed):</strong> ${result.serverSeed}</p>
                <p><strong>Client Seed:</strong> ${result.clientSeed}</p>
                <p><strong>Combined String:</strong> ${result.combinedString || 'N/A'}</p>
                <p><strong>Resulting Hash:</strong> ${result.finalHash || 'N/A'}</p>
                <p><strong>Winning Ticket:</strong> ${result.winningTicket ?? 'N/A'}</p>
                 <p><strong>Actual Winner:</strong> ${result.winnerUsername || 'N/A'}</p>
            `;
        } else {
            resultHTML += `
                <p style="color: red; font-weight: bold;">❌ Verification Failed!</p>
                <p><strong>Reason:</strong> ${result.reason || 'Mismatch or error.'}</p>
                 ${result.serverSeedHash ? `<p><strong>Server Seed Hash (used):</strong> ${result.serverSeedHash}</p>` : ''}
                 ${result.serverSeed ? `<p><strong>Provided Server Seed:</strong> ${result.serverSeed}</p>` : ''}
                 ${result.clientSeed ? `<p><strong>Provided Client Seed:</strong> ${result.clientSeed}</p>` : ''}
                 ${result.winningTicket !== undefined ? `<p><strong>Calculated Ticket:</strong> ${result.winningTicket}</p>` : ''}
                 ${result.actualWinningTicket !== undefined ? `<p><strong>Actual Ticket:</strong> ${result.actualWinningTicket}</p>` : ''}
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
        console.warn("Rounds table body or pagination element not found.");
        return;
    }

    try {
        roundsTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading past rounds...</td></tr>';
        roundsPagination.innerHTML = '';

        const response = await fetch(`/api/rounds?page=${page}&limit=10`); // Ensure this API endpoint exists
        if (!response.ok) throw new Error(`Failed to load past rounds (${response.status})`);
        const data = await response.json();
        if (!data || !Array.isArray(data.rounds) || typeof data.currentPage !== 'number' || typeof data.totalPages !== 'number') {
             throw new Error('Invalid data format received for past rounds.');
        }

        roundsTableBody.innerHTML = '';
        if (data.rounds.length === 0 && data.currentPage === 1) {
            roundsTableBody.innerHTML = '<tr><td colspan="5" class="no-rounds-message">No past rounds found.</td></tr>';
        } else if (data.rounds.length === 0 && data.currentPage > 1) {
             roundsTableBody.innerHTML = '<tr><td colspan="5" class="no-rounds-message">No rounds found on this page.</td></tr>';
        } else {
            data.rounds.forEach(round => {
                const row = document.createElement('tr');
                let formattedDate = 'N/A';
                if (round.endTime) {
                    try {
                        const date = new Date(round.endTime);
                        if (!isNaN(date.getTime())) {
                             formattedDate = date.toLocaleString(undefined, {
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
                row.dataset.roundId = round.roundId;
                roundsTableBody.appendChild(row);
            });
        }
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
     const clientSeedInput = document.getElementById('client-seed');

     if (roundIdInput) roundIdInput.value = roundId || '';
     if (serverSeedInput) serverSeedInput.value = serverSeed || '';
     if (clientSeedInput) {
          // Clear client seed as it's usually user-provided for verification
           clientSeedInput.value = '';
           if (!serverSeed) {
               showNotification('Info', 'Server Seed is revealed after the round ends.');
           } else {
               showNotification('Info', 'Server Seed populated. Please provide the Client Seed used.');
           }
           clientSeedInput.focus();
     }

     document.getElementById('provably-fair-verification')?.scrollIntoView({ behavior: 'smooth' });
}

// Create pagination controls for the rounds history table
function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return;
    roundsPagination.innerHTML = '';
    if (totalPages <= 1) return;

    const maxPagesToShow = 5;
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
            button.addEventListener('click', (e) => { e.preventDefault(); loadPastRounds(pageNum); });
        }
        return button;
    };

    roundsPagination.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));

    if (totalPages <= maxPagesToShow) {
        for (let i = 1; i <= totalPages; i++) {
            roundsPagination.appendChild(createButton(i, i, i === currentPage));
        }
    } else {
        const pagesEitherSide = Math.floor((maxPagesToShow - 3) / 2);
        if (currentPage <= pagesEitherSide + 2) {
            for (let i = 1; i <= maxPagesToShow - 1; i++) roundsPagination.appendChild(createButton(i, i, i === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            roundsPagination.appendChild(createButton(totalPages, totalPages, totalPages === currentPage));
        } else if (currentPage >= totalPages - pagesEitherSide - 1) {
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            for (let i = totalPages - maxPagesToShow + 2; i <= totalPages; i++) roundsPagination.appendChild(createButton(i, i, i === currentPage));
        } else {
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            for (let i = currentPage - pagesEitherSide; i <= currentPage + pagesEitherSide; i++) roundsPagination.appendChild(createButton(i, i, i === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            roundsPagination.appendChild(createButton(totalPages, totalPages, totalPages === currentPage));
        }
    }

    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
