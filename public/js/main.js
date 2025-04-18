// main.js (Optimized with requested changes: 99s timer, vertical deposits, 20 skins per deposit, Deposit Button Disabling)

const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a.active'); // Assuming the first link is initially active for home
const faqLink = document.getElementById('faq-link');
const fairLink = document.getElementById('fair-link');
const aboutLink = document.getElementById('about-link');
const roadmapLink = document.getElementById('roadmap-link');
const homePage = document.getElementById('home-page');
const faqPage = document.getElementById('faq-page');
const fairPage = document.getElementById('fair-page');
const aboutPage = document.getElementById('about-page');
const roadmapPage = document.getElementById('roadmap-page');

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
const participantsContainer = document.getElementById('itemsContainer'); // Updated ID for vertical list
const emptyPotMessage = document.getElementById('emptyPotMessage');

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
const confettiContainer = document.getElementById('confettiContainer');
const spinSound = document.getElementById('spinSound');

// DOM Elements - Provably Fair
const verifyBtn = document.getElementById('verify-btn');
const roundsTableBody = document.getElementById('rounds-table-body');
const roundsPagination = document.getElementById('rounds-pagination');

// Age Verification
const ageVerificationModal = document.getElementById('ageVerificationModal');
const agreeCheckbox = document.getElementById('agreeCheckbox');
const agreeButton = document.getElementById('agreeButton');

// Constants
const ROULETTE_REPETITIONS = 20;
const SPIN_DURATION_SECONDS = 6.5;
const WINNER_DISPLAY_DURATION = 7000; // 7 seconds
const CONFETTI_COUNT = 150;
const MAX_DISPLAY_DEPOSITS = 10; // Max vertical deposit blocks shown
const MAX_PARTICIPANTS_DISPLAY = 20; // Corresponds to backend MAX_PARTICIPANTS
const MAX_ITEMS_PER_DEPOSIT = 20; // Max selectable items per deposit action
const ROUND_DURATION = 99; // Timer duration in seconds
const MAX_ITEMS_PER_POT_FRONTEND = 200; // Frontend constant matching backend MAX_ITEMS_PER_POT

// Animation constants for roulette
const EASE_OUT_POWER = 5;
const BOUNCE_ENABLED = false; // Keep bounce disabled for simplicity unless desired
const BOUNCE_OVERSHOOT_FACTOR = 0.07;
const BOUNCE_DAMPING = 0.35;
const BOUNCE_FREQUENCY = 3.5;
const LANDING_POSITION_VARIATION = 0.60; // How much randomness in landing (0 to 1)

// User Color Map - distinct colors for players
const userColorMap = new Map();
const colorPalette = [
    '#00bcd4', '#ff5722', '#9c27b0', '#4caf50', '#ffeb3b', '#2196f3', '#f44336', '#ff9800',
    '#e91e63', '#8bc34a', '#3f51b5', '#009688', '#cddc39', '#795548', '#607d8b', '#673ab7',
    '#ffc107', '#03a9f4', '#9e9e9e', '#8d6e63' // 20 colors for 20 participants
];

// App State
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false; // Tracks if roulette animation is active
let timerActive = false; // Tracks if the client-side countdown interval is running
let roundTimer = null; // Holds the interval ID for the client timer
let animationFrameId = null; // Holds the ID for the roulette animation frame
let spinStartTime = 0; // Tracks start time for animation calculations

// --- Helper Functions ---
function showModal(modalElement) {
    if (modalElement) modalElement.style.display = 'flex';
}

function hideModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none';
}

function showPage(pageElement) {
    // Hide all pages
    [homePage, faqPage, fairPage, aboutPage, roadmapPage].forEach(page => {
        if (page) page.style.display = 'none';
    });

    // Show selected page
    if (pageElement) pageElement.style.display = 'block';

    // Update active links
    document.querySelectorAll('.main-nav a, a#about-link, a#roadmap-link, a#faq-link, a#fair-link')
        .forEach(link => link.classList.remove('active'));

    // Find the correct link to activate based on the pageElement
    let activeLink = null;
    if (pageElement === homePage) activeLink = homeLink;
    else if (pageElement === faqPage) activeLink = faqLink;
    else if (pageElement === fairPage) activeLink = fairLink;
    else if (pageElement === aboutPage) activeLink = aboutLink;
    else if (pageElement === roadmapPage) activeLink = roadmapLink;

    if (activeLink) activeLink.classList.add('active');

    // Load history if fair page is shown
    if (pageElement === fairPage) loadPastRounds();
}


function getUserColor(userId) {
    if (!userColorMap.has(userId)) {
        const colorIndex = userColorMap.size % colorPalette.length;
        userColorMap.set(userId, colorPalette[colorIndex]);
    }
    return userColorMap.get(userId);
}

function showNotification(title, message) {
    // Consider using a more user-friendly notification library instead of alert
    console.log(`Notification: ${title} - ${message}`);
    alert(`${title}\n${message}`);
}

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Animation Easing Functions
function easeOutAnimation(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - clampedT, EASE_OUT_POWER);
}

function calculateBounce(t) {
    if (!BOUNCE_ENABLED) return 0;
    const clampedT = Math.max(0, Math.min(1, t));
    const decay = Math.exp(-clampedT / BOUNCE_DAMPING);
    const oscillations = Math.sin(clampedT * Math.PI * 2 * BOUNCE_FREQUENCY);
    return -decay * oscillations;
}

// Color Utility Functions (if needed for confetti or other features)
function getComplementaryColor(hex) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenColor(hex, percent) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// *** NEW FUNCTION: Update Deposit Button State ***
/**
 * Checks conditions and enables/disables the main deposit button.
 * Also sets a helpful tooltip (title attribute).
 */
function updateDepositButtonState() {
    const depositTriggerButton = document.getElementById('showDepositModal');
    // Define frontend constants - ensure these match backend if logic depends on them
    const MAX_ITEMS_POT_FRONTEND = 200;
    const MAX_PARTICIPANTS_FRONTEND = MAX_PARTICIPANTS_DISPLAY; // Use existing constant

    if (!depositTriggerButton) {
        // console.warn("Deposit trigger button (#showDepositModal) not found."); // Reduce console noise
        return;
    }

    let disabled = false;
    let title = 'Deposit Rust skins into the pot'; // Default title

    if (!currentUser) {
        disabled = true;
        title = 'Log in to deposit';
    } else if (isSpinning) {
        disabled = true; // Disable during roulette animation
        title = 'Deposits closed during winner selection';
    } else if (!currentRound || currentRound.status !== 'active') {
        disabled = true; // Disable if no active round or round is rolling/ended/error/pending
        title = 'Deposits are currently closed';
        if (currentRound && currentRound.status === 'rolling') {
            title = 'Deposits closed during winner selection';
        } else if (currentRound && (currentRound.status === 'completed' || currentRound.status === 'error')) {
            title = 'Deposits closed (Round ended)';
        } else if (currentRound && currentRound.status === 'pending') {
             title = 'Deposits closed (Waiting for round)';
        }
    } else if (currentRound.participants && currentRound.participants.length >= MAX_PARTICIPANTS_FRONTEND) {
        disabled = true; // Disable if participants full
        title = `Participant limit (${MAX_PARTICIPANTS_FRONTEND}) reached`;
    } else if (currentRound.items && currentRound.items.length >= MAX_ITEMS_POT_FRONTEND) {
        // Note: currentRound.items needs to be accurately populated on the client for this check.
        // Server-side check is the primary enforcement.
        disabled = true; // Disable if items full
        title = `Pot item limit (${MAX_ITEMS_POT_FRONTEND}) reached`;
    } else if (timerActive && currentRound.timeLeft !== undefined && currentRound.timeLeft <= 0) {
         // Disable if timer is running and hits 0 (before status officially changes to 'rolling')
         disabled = true;
         title = 'Deposits closed (Round ending)';
    }


    depositTriggerButton.disabled = disabled;
    depositTriggerButton.title = title; // Set tooltip
    // Add/remove a specific CSS class if you want more styling options than just :disabled in styles.css
    depositTriggerButton.classList.toggle('deposit-disabled', disabled);
}


// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }
    // Check login status first, then update button state inside checkLoginStatus
    checkLoginStatus(); // This now calls updateDepositButtonState internally
    setupEventListeners();
    setupSocketConnection();
    showPage(homePage);
    initiateNewRoundVisualReset();
    // Initial button state update after UI setup
    updateDepositButtonState();
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    if (homeLink) homeLink.addEventListener('click', (e) => { e.preventDefault(); showPage(homePage); });
    if (faqLink) faqLink.addEventListener('click', (e) => { e.preventDefault(); showPage(faqPage); });
    if (fairLink) fairLink.addEventListener('click', (e) => { e.preventDefault(); showPage(fairPage); });
    if (aboutLink) aboutLink.addEventListener('click', (e) => { e.preventDefault(); showPage(aboutPage); });
    if (roadmapLink) roadmapLink.addEventListener('click', (e) => { e.preventDefault(); showPage(roadmapPage); });

    // Login
    if (loginButton) loginButton.addEventListener('click', () => { window.location.href = '/auth/steam'; });

    // Deposit Modal Trigger
    if (showDepositModal) {
        showDepositModal.addEventListener('click', () => {
            // *** ADDED CHECK AT THE TOP ***
            if (showDepositModal.disabled) {
                // Use the title attribute for the notification message
                showNotification('Deposits Closed', showDepositModal.title || 'Deposits are currently closed.');
                return; // Stop processing the click
            }
            // *** END ADDED CHECK ***

            // Existing checks below
            if (!currentUser) {
                showNotification('Login Required', 'Please log in first to deposit items.');
                return;
            }
            if (!currentUser.tradeUrl) {
                if (tradeUrlModal) showModal(tradeUrlModal);
                else showNotification('Trade URL Missing', 'Please set your Steam Trade URL.');
                return;
            }
            // Participant/Item limit check here is less critical now due to button disabling, but good safeguard
             if (currentRound && currentRound.participants &&
                 currentRound.participants.length >= MAX_PARTICIPANTS_DISPLAY) {
                 showNotification('Round Full',
                     `This round has reached the participant limit of ${MAX_PARTICIPANTS_DISPLAY}.`);
                 return; // Still prevent modal opening if somehow clicked while full
             }
            // Add item check if needed, though backend handles it
            // if (currentRound && currentRound.items && currentRound.items.length >= MAX_ITEMS_PER_POT_FRONTEND) {
            //    showNotification('Pot Full', `The pot item limit (${MAX_ITEMS_PER_POT_FRONTEND}) has been reached.`);
            //    return;
            // }


            if (depositModal) {
                showModal(depositModal);
                loadUserInventory();
            }
        });
    }

    // Deposit Modal Close / Submit
    if (closeDepositModal) closeDepositModal.addEventListener('click', () => {
        if (depositModal) hideModal(depositModal);
    });
    if (depositButton) depositButton.addEventListener('click', submitDeposit);

    // Trade URL Modal Close / Submit
    if (closeTradeUrlModal) closeTradeUrlModal.addEventListener('click', () => {
        if (tradeUrlModal) hideModal(tradeUrlModal);
    });
    if (saveTradeUrl) saveTradeUrl.addEventListener('click', saveUserTradeUrl);

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
        agreeButton.disabled = !agreeCheckbox.checked; // Initial state
    }

    // Test Buttons (Keep if needed for development)
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) testSpinButton.addEventListener('click', testRouletteAnimation);
    const testDepositButton = document.getElementById('testDepositButton');
    if (testDepositButton) testDepositButton.addEventListener('click', testDeposit);

    // Provably Fair
    if (verifyBtn) verifyBtn.addEventListener('click', verifyRound);

    // Modal Outside Click
    window.addEventListener('click', (e) => {
        if (depositModal && e.target === depositModal) hideModal(depositModal);
        if (tradeUrlModal && e.target === tradeUrlModal) hideModal(tradeUrlModal);
        // Optional: Allow closing age verification by clicking outside IF already verified
        if (ageVerificationModal && e.target === ageVerificationModal && localStorage.getItem('ageVerified')) {
            // hideModal(ageVerificationModal); // Uncomment if desired behavior
        }
    });

    // Keyboard Shortcut (Example: Test Spin)
    document.addEventListener('keydown', function(event) {
        // Avoid triggering during modal inputs or if spinning
        if (event.code === 'Space' && homePage.style.display === 'block' && !isSpinning &&
            !document.querySelector('.modal[style*="display: flex"]')) { // Check if modal is open
            // Check if focus is not on an input field
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                 testRouletteAnimation();
                 event.preventDefault();
            }
        }
    });
}

// Socket connection and events
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('requestRoundData'); // Request data, button state will update on 'roundData'
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showNotification('Connection Lost', 'Disconnected from server.');
        // Update button state on disconnect
        updateDepositButtonState();
    });

    socket.on('connect_error', (error) => {
         console.error('Socket connection error:', error);
         showNotification('Connection Error', 'Could not connect to server.');
        // Update button state on connection error
        updateDepositButtonState();
    });


    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        // Reset view first, it handles flags and timers which affect button state
        resetToJackpotView(); // Should eventually call updateDepositButtonState
        updateRoundUI();
        // Call directly here too ensure it's updated after reset logic runs
        updateDepositButtonState();
    });

    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (!data.depositedItems) {
            console.warn("Received participantUpdated event WITHOUT 'depositedItems'. Old format?");
        }

        if (currentRound && currentRound.roundId === data.roundId) {
            handleNewDeposit(data); // This updates currentRound internally
            updateDepositButtonState(); // <-- Update after state change
        } else if (!currentRound && data.roundId) {
            console.warn("Participant update for unknown round.");
            socket.emit('requestRoundData');
        }
    });

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            // isSpinning will be set true in handleWinnerAnnouncement/startRouletteAnimation
            // which will trigger the button update
            handleWinnerAnnouncement(data); // This starts the spin process
            // Update state immediately as round is effectively over for deposits
            if(currentRound) currentRound.status = 'rolling'; // Mark as rolling even before animation starts visually
             updateDepositButtonState();
        } else {
            console.warn("Received winner for mismatched round.");
        }
    });

    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false;
            if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
            if(timerValue) timerValue.textContent = "Rolling";
            if(timerForeground) updateTimerCircle(0, ROUND_DURATION);
            // Ensure local status reflects rolling
            currentRound.status = 'rolling';
            updateDepositButtonState(); // <-- Update state
        }
    });

    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
             currentRound.status = 'completed'; // Mark as completed
        }
        // The resetToJackpotView called after winner display handles re-enabling
        updateDepositButtonState(); // Update state
        // ... rest of logic ...
    });

    socket.on('roundData', (data) => {
        console.log('Received initial/updated round data:', data);
        if (!data) {
            console.error("Invalid round data received from server.");
            return;
        }

        currentRound = data;
        // Don't necessarily reset view here, just update UI based on received state
        // initiateNewRoundVisualReset(); // This might clear valid ongoing round data
        updateRoundUI();
        updateDepositButtonState(); // <-- Update state based on received data

        // Logic to handle connecting mid-round or restarting timer
        if (currentRound.status === 'rolling' || currentRound.status === 'completed') {
            // If connected during rolling/completed, ensure view reflects it (reset handles this)
            if(!isSpinning && currentRound.winner) {
                 console.log("Connected during rolling phase with winner known, triggering animation.");
                 handleWinnerAnnouncement(currentRound); // Trigger spin if winner known
            } else if (!isSpinning) {
                console.log("Connected after round ended or during rolling without winner yet.");
                resetToJackpotView(); // Reset view if connected after round truly ended
            }
        } else if (currentRound.status === 'active') {
             if (currentRound.participants?.length >= 1 && currentRound.timeLeft > 0 && !timerActive) {
                 // Start timer if needed based on server's timeLeft (>= 1 participant now starts timer)
                 console.log(`Received active round with ${currentRound.participants?.length} participants and ${currentRound.timeLeft}s left. Starting/syncing timer.`);
                 timerActive = true;
                 startClientTimer(currentRound.timeLeft || ROUND_DURATION);
             } else if (currentRound.timeLeft <= 0 && timerActive) {
                 // Stop timer if server says time is up but client timer was still running
                 console.log("Server data indicates time is up, stopping client timer.");
                 timerActive = false;
                 if(roundTimer) clearInterval(roundTimer);
                 roundTimer = null;
                 updateTimerUI(0); // Show 0 or Ending
                 updateDepositButtonState();
             }
        }
    });

    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        if (currentUser && data.userId === currentUser._id) {
            showNotification('Trade Offer Sent', 'Check Steam for winnings!');
        }
    });

    // Add listener for potential errors disabling deposits
     socket.on('roundError', (data) => {
         console.error('Round Error event received:', data);
         if (currentRound && currentRound.roundId === data.roundId) {
             currentRound.status = 'error';
             showNotification('Round Error', data.error || 'An error occurred with the current round.');
             updateDepositButtonState(); // Disable deposits on error
         }
     });
}


// Check login status
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                currentUser = null;
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } else {
            currentUser = await response.json();
            console.log('User logged in:', currentUser?.username);
        }
        updateUserUI();
        updateDepositButtonState(); // <-- Update button after user status is known
    } catch (error) {
        console.error('Error checking login status:', error);
        currentUser = null;
        updateUserUI();
        updateDepositButtonState(); // <-- Update button even on error (logged out state)
    }
}

// Update user UI
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

// Load user inventory
async function loadUserInventory() {
    if (!inventoryItems || !selectedItems || !inventoryLoading || !totalValue) {
        console.error("Inventory DOM elements missing.");
        return;
    }

    selectedItemsList = [];
    selectedItems.innerHTML = '';
    updateTotalValue();

    inventoryLoading.style.display = 'flex';
    inventoryItems.innerHTML = ''; // Clear previous items

    try {
        const response = await fetch('/api/inventory');
        if (!response.ok) {
            let errorMsg = 'Inventory load failed.';
            try {
                 const errorData = await response.json();
                 errorMsg = errorData.error || `Inventory load failed (${response.status})`;
            } catch (e) { /* Ignore if response is not JSON */ }

            if (response.status === 401 || response.status === 403) {
                 errorMsg = 'Please log in first.';
            }
            throw new Error(errorMsg);
        }

        userInventory = await response.json();
        inventoryLoading.style.display = 'none';

        if (!Array.isArray(userInventory)) {
            throw new Error('Invalid inventory data received.');
        }

        if (userInventory.length === 0) {
            inventoryItems.innerHTML = '<p class="empty-inventory-message">Inventory empty or unavailable. Ensure it\'s public on Steam.</p>';
            return;
        }

        displayInventoryItems();
    } catch (error) {
        inventoryLoading.style.display = 'none';
        inventoryItems.innerHTML = `<p class="error-message">Error loading inventory: ${error.message}</p>`;
        console.error('Error loading inventory:', error);
        // No need for showNotification here, error is shown in modal
    }
}

// Display inventory items
function displayInventoryItems() {
    if (!inventoryItems) return;
    inventoryItems.innerHTML = ''; // Clear previous items

    userInventory.forEach(item => {
        // Basic validation of item structure
        if (!item || typeof item.price !== 'number' || isNaN(item.price) ||
            !item.assetId || !item.name || !item.image) {
            console.warn("Skipping invalid inventory item:", item);
            return; // Skip this item
        }

        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId;
        itemElement.dataset.name = item.name; // Store name for potential use
        itemElement.dataset.image = item.image; // Store image for potential use
        itemElement.dataset.price = item.price.toFixed(2); // Store price

        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy"
                 onerror="this.onerror=null; this.src='/img/default-item.png';">
            <div class="item-details">
                <div class="item-name" title="${item.name}">${item.name}</div>
                <div class="item-value">$${item.price.toFixed(2)}</div>
            </div>`;

        // Check if item is already selected
        if (selectedItemsList.some(selected => selected.assetId === item.assetId)) {
            itemElement.classList.add('selected');
        }

        itemElement.addEventListener('click', () => toggleItemSelection(itemElement, item));
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(element, item) {
    // Validate item price again before selection
    if (typeof item.price !== 'number' || isNaN(item.price)) {
        console.error("Attempted to select item with invalid price:", item);
        showNotification('Selection Error', 'Cannot select item with invalid price.');
        return;
    }

    const assetId = item.assetId;
    const index = selectedItemsList.findIndex(i => i.assetId === assetId);

    if (index === -1) { // If not selected, add it
        // Check selection limit
        if (selectedItemsList.length >= MAX_ITEMS_PER_DEPOSIT) {
            showNotification('Selection Limit', `You can select a maximum of ${MAX_ITEMS_PER_DEPOSIT} items per deposit.`);
            return;
        }
        selectedItemsList.push(item);
        element.classList.add('selected');
        addSelectedItemElement(item); // Add to the visual selected list
    } else { // If already selected, remove it
        selectedItemsList.splice(index, 1);
        element.classList.remove('selected');
        removeSelectedItemElement(assetId); // Remove from the visual selected list
    }

    updateTotalValue();
}

// Add item to selected area
function addSelectedItemElement(item) {
    if (!selectedItems) return;

    // Validate price
    if (typeof item.price !== 'number' || isNaN(item.price)) {
        console.error("Cannot add selected item element, invalid price:", item);
        return;
    }

    const selectedElement = document.createElement('div');
    selectedElement.className = 'selected-item';
    selectedElement.dataset.assetId = item.assetId; // Use dataset for assetId
    selectedElement.innerHTML = `
        <button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button>
        <img src="${item.image}" alt="${item.name}" loading="lazy"
             onerror="this.onerror=null; this.src='/img/default-item.png';">
        <div class="selected-item-details">
            <div class="selected-item-value">$${item.price.toFixed(2)}</div>
        </div>`;

    // Add event listener to the remove button
    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering item selection toggle
        // Find the corresponding item in the main inventory list to toggle its class
        const inventoryItemElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);
        if (inventoryItemElement) {
            // Re-find the original item object from userInventory to pass correct data
             const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item; // Fallback
            toggleItemSelection(inventoryItemElement, originalItem);
        } else {
            // Fallback if item not visible in inventory list anymore (shouldn't happen often)
            removeSelectedItem(item.assetId); // Just remove from logic and selected list
            updateTotalValue();
        }
    });

    selectedItems.appendChild(selectedElement);
}


// Remove item from selected area
function removeSelectedItemElement(assetId) {
    const selectedElement = selectedItems.querySelector(`.selected-item[data-asset-id="${assetId}"]`);
    if (selectedElement) selectedElement.remove();
}

// Remove item logic (called when removing without direct element interaction)
function removeSelectedItem(assetId) {
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);

    // Deselect in the main inventory view if visible
    const inventoryElement = inventoryItems?.querySelector(`.inventory-item[data-asset-id="${assetId}"]`);
    if (inventoryElement) inventoryElement.classList.remove('selected');

    // Remove from the selected items display
    removeSelectedItemElement(assetId);
}


// Update total value display
function updateTotalValue() {
    if (!totalValue || !depositButton) return;

    const total = selectedItemsList.reduce((sum, item) => {
        // Ensure price is valid before adding
        const price = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
        return sum + price;
    }, 0);

    totalValue.textContent = `$${total.toFixed(2)}`;
    // Enable deposit button only if items are selected
    depositButton.disabled = selectedItemsList.length === 0;
}

// Submit deposit
async function submitDeposit() {
    if (selectedItemsList.length === 0) {
        showNotification('No Items Selected', 'Please select items from your inventory first.');
        return;
    }

    // Double check round status client-side (backend enforces anyway)
    if (!currentRound || currentRound.status !== 'active' || isSpinning) {
        showNotification('Deposit Error', 'Deposits are currently closed for this round.');
        return;
    }
    // Add checks for limits again, although button should be disabled
     if (currentRound.participants && currentRound.participants.length >= MAX_PARTICIPANTS_DISPLAY) {
        showNotification('Deposit Error', `The participant limit (${MAX_PARTICIPANTS_DISPLAY}) has been reached.`);
        return;
     }
     if (currentRound.items && currentRound.items.length + selectedItemsList.length > MAX_ITEMS_PER_POT_FRONTEND) {
         showNotification('Deposit Error', `Depositing these items would exceed the pot limit (${MAX_ITEMS_PER_POT_FRONTEND}).`);
         return;
     }


    if (!depositButton) return;

    depositButton.disabled = true; // Disable during processing
    depositButton.textContent = 'Processing...';

    try {
        // Step 1: Initiate deposit with the server to get token/URL
        const initiateResponse = await fetch('/api/deposit/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // We don't need to send items here, server just gives token/url
             body: JSON.stringify({}) // Empty body or specific flags if needed later
        });

        if (!initiateResponse.ok) {
            const error = await initiateResponse.json().catch(() => ({ error: 'Failed to initiate deposit.' }));
            throw new Error(error.error || `Deposit initiation failed (${initiateResponse.status})`);
        }

        const { depositToken, botTradeUrl } = await initiateResponse.json();

        if (!depositToken || !botTradeUrl) {
             throw new Error('Invalid response from deposit initiation.');
        }

        // Step 2: Construct the trade offer URL for the user
        // The user needs to manually send the trade offer via Steam
        // We provide the bot's trade URL and the token needed in the message
        const itemsQueryParam = selectedItemsList.map(item => item.assetId).join(','); // Pass asset IDs if needed, though backend doesn't use them here
        const fullBotTradeUrl = `${botTradeUrl}&message=${encodeURIComponent(depositToken)}`; // Add token to message param

        console.log("Deposit Token:", depositToken);
        console.log("Bot Trade URL:", botTradeUrl);
        console.log("Full URL for user:", fullBotTradeUrl); // Log for debugging

         // Step 3: Inform the user and potentially open the trade link
         // It's generally better NOT to automatically open windows due to popup blockers
         // Provide clear instructions instead.
         showNotification('Trade Offer Required',
             `Please send a trade offer to our bot with the following message: ${depositToken}\n\nSelected items: ${selectedItemsList.length} items, value: $${totalValue.textContent}\n\nBot Trade Link is available (check console or provide a button). You MUST include the message accurately.`);

         // Optionally provide a button/link for the user to click
         // Example: Add a temporary link/button in the deposit modal or main UI
         // const tradeLinkElement = document.getElementById('tradeLinkPlaceholder'); // Assume placeholder exists
         // if (tradeLinkElement) {
         //    tradeLinkElement.innerHTML = `<a href="${fullBotTradeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Open Trade Offer</a> (Copy Message: ${depositToken})`;
         //    tradeLinkElement.style.display = 'block';
         // }


        // Clear selection and close modal AFTER initiating
        if (depositModal) hideModal(depositModal);
        selectedItemsList = [];
        if(selectedItems) selectedItems.innerHTML = '';
        if (inventoryItems) {
            inventoryItems.querySelectorAll('.inventory-item.selected')
                .forEach(el => el.classList.remove('selected'));
        }
        updateTotalValue(); // Resets value and deposit button state


    } catch (error) {
        showNotification('Deposit Initiation Error', error.message);
        console.error('Error initiating deposit:', error);
        depositButton.disabled = selectedItemsList.length === 0; // Re-enable based on selection
        depositButton.textContent = 'Deposit Items';
    }
    // Note: 'Depositing...' state is removed because user action is required in Steam now.
    // Button should be re-enabled based on selection after modal closes or resets.
    // We don't set depositButton text back here, updateTotalValue handles enable/disable.
}


// Save trade URL
async function saveUserTradeUrl() {
    if (!tradeUrlInput || !saveTradeUrl || !tradeUrlModal || !depositModal) {
        console.error("Trade URL modal elements missing.");
        return;
    }

    const tradeUrl = tradeUrlInput.value.trim();
    // Basic validation
    if (!tradeUrl) {
        showNotification('Input Required', 'Please enter your Steam Trade URL.');
        return;
    }
    // More specific validation
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') ||
        !tradeUrl.includes('partner=') ||
        !tradeUrl.includes('token=')) {
        showNotification('Invalid Format', 'Please enter a valid Steam Trade URL including partner and token parameters.');
        return;
    }

    saveTradeUrl.disabled = true;
    saveTradeUrl.textContent = 'Saving...';

    try {
        const response = await fetch('/api/user/tradeurl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeUrl })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to save Trade URL.' }));
            throw new Error(error.error || `Save failed (${response.status})`);
        }

        const result = await response.json();
        if (currentUser) currentUser.tradeUrl = result.tradeUrl; // Update local user object

        hideModal(tradeUrlModal);

        // If the deposit modal was waiting for the trade url, try opening it again
        // Check if the deposit button exists and isn't disabled for other reasons
        const depositTriggerButton = document.getElementById('showDepositModal');
        if (depositTriggerButton && !depositTriggerButton.disabled) {
             // Optional: Automatically try to open deposit modal after setting URL
             // depositTriggerButton.click();
             showNotification('Success', 'Trade URL saved. You can now try depositing again.');
        } else {
            showNotification('Success', 'Trade URL saved.');
        }


    } catch (error) {
        showNotification('Error Saving URL', error.message);
        console.error('Error updating trade URL:', error);
    } finally {
        saveTradeUrl.disabled = false;
        saveTradeUrl.textContent = 'Save Trade URL';
    }
}

// Update round UI (Pot Value, Timer Display, Participant Count)
function updateRoundUI() {
    if (!currentRound || !potValue || !participantCount) return; // Added participantCount check

    // Update Pot Value
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;

    // Update Timer Display (only if timer isn't actively counting down client-side)
    if (!timerActive) {
        updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : ROUND_DURATION);
    }

    // Update Participant Count Display
    const participantNum = currentRound.participants?.length || 0;
    participantCount.textContent = `${participantNum}/${MAX_PARTICIPANTS_DISPLAY}`;

    // This function focuses on the header stats, deposit display is handled separately
    // updateParticipantsUI(); // Remove this call if it redraws the whole list
}


// Update timer UI elements (Text and Circle)
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;

    const timeToShow = Math.max(0, Math.round(timeLeft));

    // Update text based on state
    if (timerActive || (currentRound && currentRound.status === 'active' && timeToShow > 0)) {
         timerValue.textContent = timeToShow;
    } else if (isSpinning || (currentRound && currentRound.status === 'rolling')) {
         timerValue.textContent = "Rolling"; // Show Rolling if spinning or status is rolling
    } else if (currentRound && (currentRound.status === 'completed' || currentRound.status === 'error')) {
        timerValue.textContent = "Ended"; // Show Ended
    } else {
        timerValue.textContent = timeToShow; // Fallback or initial state
    }


    updateTimerCircle(timeToShow, ROUND_DURATION);

    // Update pulse animation based on time left and timer activity
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

// Update timer SVG circle
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return;

    // Check if it's an SVG circle element with radius accessible
    if (timerForeground.r && timerForeground.r.baseVal) {
        const radius = timerForeground.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        // Calculate progress (0 to 1), ensuring timeLeft isn't negative
        const progress = Math.min(1, Math.max(0, timeLeft / totalTime));
        // Calculate the stroke offset
        const offset = circumference * (1 - progress);

        timerForeground.style.strokeDasharray = `${circumference}`;
        timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`; // Ensure offset isn't negative
    } else {
        console.warn("timerForeground is not an SVG circle element or 'r' attribute is missing.");
    }
}


/**
 * Displays the latest deposit as a new block at the TOP of the participants container.
 * @param {object} data - The participant update data from the socket event.
 */
function displayLatestDeposit(data) {
    if (!participantsContainer) return;

    if (!data || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue)) {
        console.error("Invalid data passed to displayLatestDeposit:", data);
        return;
    }

    const username = data.username || 'Unknown User';
    const avatar = data.avatar || '/img/default-avatar.png';
    const value = data.itemsValue; // Value of *this* specific deposit
    const items = data.depositedItems || []; // Items from *this* specific deposit
    const userColor = getUserColor(data.userId);

    const depositContainer = document.createElement('div');
    depositContainer.dataset.userId = data.userId;
    depositContainer.className = 'player-deposit-container player-deposit-new'; // Add animation class

    const depositHeader = document.createElement('div');
    depositHeader.className = 'player-deposit-header';
    depositHeader.innerHTML = `
        <img src="${avatar}" alt="${username}" class="player-avatar" loading="lazy"
             onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor};">
        <div class="player-info">
            <div class="player-name" title="${username}">${username}</div>
            <div class="player-deposit-value" style="color: ${userColor}" title="Deposited Value: $${value.toFixed(2)}">$${value.toFixed(2)}</div>
        </div>`;

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';

    if (items.length > 0) {
        // Sort items by value (highest to lowest) for display
        items.sort((a, b) => (b.price || 0) - (a.price || 0));

        // Limit displayed items visually (use MAX_ITEMS_PER_DEPOSIT if that's the visual limit)
        const displayItems = items.slice(0, MAX_ITEMS_PER_DEPOSIT);

        displayItems.forEach(item => {
            if (!item || typeof item.price !== 'number' || isNaN(item.price) ||
                !item.name || !item.image) {
                console.warn("Skipping invalid item in deposit display:", item);
                return;
            }

            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`; // Tooltip for item
            itemElement.style.borderColor = userColor; // Use user color for border
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</div>
                </div>`;
            itemsGrid.appendChild(itemElement);
        });

        // Show a message if there were more items than visually displayed
        if (items.length > MAX_ITEMS_PER_DEPOSIT) {
            const moreItems = document.createElement('div');
            moreItems.className = 'player-deposit-item-more'; // Simple text or styled block
            moreItems.style.color = userColor;
            moreItems.textContent = `+${items.length - MAX_ITEMS_PER_DEPOSIT} more`;
            // Append after the grid or within it, depending on desired layout
            itemsGrid.appendChild(moreItems); // Example: append after items
        }
    }

    depositContainer.appendChild(depositHeader);
    depositContainer.appendChild(itemsGrid);

    // Add the new deposit block to the TOP of the container
    if (participantsContainer.firstChild) {
        participantsContainer.insertBefore(depositContainer, participantsContainer.firstChild);
    } else {
        participantsContainer.appendChild(depositContainer);
    }

    // Hide empty pot message if it was visible
    if (emptyPotMessage) emptyPotMessage.style.display = 'none';

    // Remove animation class after animation duration (e.g., 500ms matching CSS)
    setTimeout(() => {
        depositContainer.classList.remove('player-deposit-new');
    }, 500); // Match CSS animation duration

    // Limit the number of visible deposit blocks by removing from the BOTTOM
    const currentDepositBlocks = participantsContainer.querySelectorAll('.player-deposit-container');
    if (currentDepositBlocks.length > MAX_DISPLAY_DEPOSITS) {
        const blocksToRemove = currentDepositBlocks.length - MAX_DISPLAY_DEPOSITS;
        for (let i = 0; i < blocksToRemove; i++) {
            const oldestBlock = participantsContainer.querySelector('.player-deposit-container:last-child');
            if (oldestBlock && oldestBlock !== depositContainer) { // Don't remove the one just added
                // Optional: Add fade-out effect
                oldestBlock.style.transition = 'opacity 0.3s ease-out';
                oldestBlock.style.opacity = '0';
                setTimeout(() => {
                    if (oldestBlock.parentNode === participantsContainer) { // Check parent just in case
                         oldestBlock.remove();
                    }
                }, 300); // Remove after fade
            }
        }
    }
}


// Handle new deposit data from server
function handleNewDeposit(data) {
    // Validate incoming data
    if (!data || !data.roundId || !data.userId ||
        typeof data.itemsValue !== 'number' || isNaN(data.itemsValue) ||
        data.totalValue === undefined) { // Ensure totalValue is present
        console.error("Invalid participant update data received:", data);
        return;
    }
    // Ensure depositedItems is an array, even if empty
    if (!data.depositedItems) data.depositedItems = [];


    // Initialize currentRound if it doesn't exist (e.g., user joined mid-round)
    if (!currentRound) {
        currentRound = {
            roundId: data.roundId,
            status: 'active', // Assume active if receiving deposit
            timeLeft: ROUND_DURATION, // Default or fetch later
            totalValue: 0,
            participants: [],
            items: [] // Initialize items array
        };
        console.warn("Handling deposit for a non-existent local round. Initializing round.");
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Deposit received for wrong round (${data.roundId}). Current is ${currentRound.roundId}. Ignoring.`);
        return; // Ignore deposit for a different round
    }

    // Ensure participants array exists
    if (!currentRound.participants) currentRound.participants = [];

    // Find if participant already exists
    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user && p.user.id === data.userId) {
            participantFound = true;
            // Update existing participant's cumulative value and latest ticket count
            return {
                ...p,
                itemsValue: (p.itemsValue || 0) + data.itemsValue, // Add this deposit's value
                tickets: data.tickets // Update with the latest cumulative ticket count from server
            };
        }
        return p;
    });

    // If participant is new, add them to the array
    if (!participantFound) {
        currentRound.participants.push({
            user: {
                id: data.userId,
                username: data.username || 'Unknown User',
                avatar: data.avatar || '/img/default-avatar.png'
            },
            itemsValue: data.itemsValue, // Initial deposit value
            tickets: data.tickets // Initial ticket count
        });
    }

    // Update total round value from server data
    currentRound.totalValue = data.totalValue;

    // Add the newly deposited items to the master item list for the round
    if (Array.isArray(data.depositedItems)) {
        if (!currentRound.items) currentRound.items = []; // Ensure items array exists
        data.depositedItems.forEach(item => {
            // Validate item before adding
            if (item && typeof item.price === 'number' && !isNaN(item.price)) {
                // Add owner ID to the item object when adding to the main list
                currentRound.items.push({ ...item, owner: data.userId });
            } else {
                console.warn("Skipping invalid item while adding to round master list:", item);
            }
        });
    }

    // Update UI elements that show overall round stats
    updateRoundUI(); // Updates Pot Value, Timer, Participant Count display

    // Display this specific deposit visually
    displayLatestDeposit(data);

    // Start timer if this deposit makes it the *first* participant (backend handles actual start)
    // Client-side just needs to start the countdown visually if it receives data indicating this.
    if (currentRound.status === 'active' &&
        currentRound.participants.length === 1 && // Now starts on FIRST participant
        !timerActive) {
        console.log("First participant joined. Starting client timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || ROUND_DURATION);
    }
}


// Update participants UI (ONLY the count in the header)
function updateParticipantsUI() {
    // This function is now simplified as individual deposits handle their own display
    if (!participantCount || !emptyPotMessage) {
        console.error("Participants count/empty message elements missing.");
        return;
    }

    const participants = currentRound?.participants || [];
    const participantNum = participants.length;

    // Update participant count display in the header
    participantCount.textContent = `${participantNum}/${MAX_PARTICIPANTS_DISPLAY}`;

    // Hide/show empty pot message based ONLY on participant count now
    if (participantNum === 0 && participantsContainer) {
         // Check if container is truly empty (excluding the message itself)
         const hasVisibleChildren = Array.from(participantsContainer.children)
             .some(child => child !== emptyPotMessage);
         if (!hasVisibleChildren) {
             emptyPotMessage.style.display = 'block';
             // Ensure message is inside container if needed
             if (!participantsContainer.contains(emptyPotMessage)) {
                  participantsContainer.appendChild(emptyPotMessage);
             }
         } else {
             emptyPotMessage.style.display = 'none';
         }
    } else {
        emptyPotMessage.style.display = 'none';
    }
}

// Function to test deposit with mock data - Modified for vertical display
function testDeposit() {
    console.log("--- TESTING DEPOSIT DISPLAY (Adds to Top) ---");

    // Simulate current round state if needed
    if (!currentRound) {
         currentRound = { roundId: 'test-round-123', status: 'active', totalValue: 0, participants: [], items: [] };
    } else {
        // Ensure test doesn't break if round isn't active
        currentRound.status = 'active';
    }


    const randomValue = parseFloat((Math.random() * 50 + 5).toFixed(2));
    const mockUserId = `test_user_${Math.floor(Math.random() * 1000)}`;
    const mockUsername = ["RustPlayer99", "SkinCollector", "AK47Master", "HeadHunter",
                          "RustLord", "TheRaider", "ScrapDealer"][Math.floor(Math.random() * 7)];
    const mockAvatar = [
        'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
        'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg',
        'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg',
        '/img/default-avatar.png' // Default fallback
    ][Math.floor(Math.random() * 4)];

    // Find existing participant or simulate adding new one
    let existingParticipant = currentRound.participants.find(p => p.user.id === mockUserId);
    let cumulativeTickets = 0;
    let cumulativeValue = 0;

    if (existingParticipant) {
         cumulativeValue = existingParticipant.itemsValue + randomValue;
         cumulativeTickets = Math.max(1, Math.floor(cumulativeValue * 100)); // Recalculate total tickets
    } else {
         cumulativeValue = randomValue;
         cumulativeTickets = Math.max(1, Math.floor(cumulativeValue * 100));
    }

     const mockDepositData = {
         roundId: currentRound.roundId,
         userId: mockUserId,
         username: mockUsername,
         avatar: mockAvatar,
         itemsValue: randomValue, // Value of THIS deposit
         tickets: cumulativeTickets, // CUMULATIVE tickets for this user
         totalValue: (currentRound.totalValue || 0) + randomValue, // NEW round total value
         depositedItems: [] // Items for THIS deposit
     };


    // Generate items for this specific deposit
    const itemNames = [
        "AK-47 | Alien Red", "Metal Chest Plate", "Semi-Automatic Rifle",
        "Garage Door", "Assault Rifle", "Metal Facemask", "Road Sign Kilt",
        "Coffee Can Helmet", "Double Barrel Shotgun", "Revolver", "Sheet Metal Door",
        "Medical Syringe", "MP5A4", "LR-300", "Bolt Action Rifle", "Satchel Charge"
    ];
    const numItems = Math.floor(Math.random() * 15) + 1; // 1 to 15 items for test
    let remainingValue = mockDepositData.itemsValue;
    let accumulatedValue = 0;

    for (let i = 0; i < numItems; i++) {
        const isLastItem = i === numItems - 1;
        let itemValue;

        if (isLastItem) {
            itemValue = Math.max(0.01, remainingValue); // Assign remaining value to last item
        } else {
            // Assign a random portion, ensuring not too small
            itemValue = parseFloat((Math.random() * remainingValue * 0.6 + 0.01).toFixed(2));
            itemValue = Math.min(itemValue, remainingValue - (numItems - 1 - i) * 0.01); // Ensure enough remains
            itemValue = Math.max(0.01, itemValue); // Ensure minimum value
        }

        remainingValue -= itemValue;
        accumulatedValue += itemValue;

         // Adjust last item slightly if rounding caused issues
        if (isLastItem && Math.abs(accumulatedValue - mockDepositData.itemsValue) > 0.001) {
             itemValue += (mockDepositData.itemsValue - accumulatedValue);
             itemValue = Math.max(0.01, parseFloat(itemValue.toFixed(2)));
        } else {
             itemValue = parseFloat(itemValue.toFixed(2)); // Ensure 2 decimal places
        }


        mockDepositData.depositedItems.push({
            assetId: `test_asset_${Math.floor(Math.random() * 10000)}`,
            name: itemNames[Math.floor(Math.random() * itemNames.length)],
            image: `/img/default-item.png`, // Use a default image for testing
            price: itemValue
        });
    }
     // Recalculate exact deposit value from items generated due to rounding
     mockDepositData.itemsValue = mockDepositData.depositedItems.reduce((sum, item) => sum + item.price, 0);
     mockDepositData.totalValue = (currentRound.totalValue || 0) + mockDepositData.itemsValue; // Update total value based on actual items


    console.log("Mock Deposit Data:", mockDepositData);
    // Call the handler function which updates the currentRound state and UI
    handleNewDeposit(mockDepositData);
}


// Start client timer
function startClientTimer(initialTime = ROUND_DURATION) {
    if (!timerValue) return;

    if (roundTimer) clearInterval(roundTimer); // Clear any existing timer

    let timeLeft = Math.max(0, initialTime);
    console.log(`Starting/Syncing client timer from ${timeLeft}s`);
    timerActive = true; // Set flag indicating timer is running
    updateTimerUI(timeLeft); // Initial display
    updateDepositButtonState(); // Update button state when timer starts

    roundTimer = setInterval(() => {
        if (!timerActive) { // Check flag in case timer stopped externally
            clearInterval(roundTimer);
            roundTimer = null;
            console.log("Client timer interval stopped (timerActive is false).");
            return;
        }

        timeLeft--;
        // Update local round object timeLeft for consistency if needed elsewhere
        if (currentRound) currentRound.timeLeft = timeLeft;

        updateTimerUI(timeLeft); // Update display
        updateDepositButtonState(); // Update button state based on time

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            timerActive = false; // Timer finished
            console.log("Client timer reached zero.");
            if(timerValue) timerValue.textContent = "Ending"; // Indicate ending phase
            // Backend handles actual round end, button state updated via status change
             updateDepositButtonState(); // Final update
        }
    }, 1000); // Update every second
}

// --- Roulette/Winner Functions --- (Largely unchanged, ensure isSpinning updates trigger button state)

function createRouletteItems() {
    if (!rouletteTrack || !inlineRoulette) {
        console.error("Roulette track or inline roulette element missing.");
        return;
    }

    rouletteTrack.innerHTML = ''; // Clear previous items
    // Reset any previous transformations immediately
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';

    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('No participants data available to create roulette items.');
        // Display a message if needed, though this state shouldn't typically happen before spinning
        rouletteTrack.innerHTML = '<div style="color: grey; text-align: center; padding: 20px; width: 100%;">Waiting for participants...</div>';
        return;
    }

    // --- Calculate Ticket Pool for Visual Representation ---
    let ticketPool = [];
    // Calculate total tickets based on participant data
    const totalTicketsInRound = currentRound.participants.reduce(
        (sum, p) => sum + (p.tickets || 0), 0); // Use tickets field directly

    if (totalTicketsInRound <= 0) {
         console.warn("Total tickets in round is zero. Roulette cannot be built accurately.");
         // Optionally, build based on value percentage if tickets are missing/zero
         const totalValueNonZero = Math.max(0.01, currentRound.totalValue || 0.01);
         currentRound.participants.forEach(p => {
              const visualBlocks = Math.max(3, Math.ceil(((p.itemsValue || 0) / totalValueNonZero) * 120)); // Base on value% * target
              for (let i = 0; i < visualBlocks; i++) ticketPool.push(p);
         });

    } else {
        // Build pool based on tickets if available and valid
        currentRound.participants.forEach(p => {
            const tickets = p.tickets || 0;
            // Calculate representation (e.g., aim for ~120 blocks total visually)
            const targetVisualBlocks = 120; // Adjust for desired visual density
            // Ensure at least a few blocks per participant for visibility
            const visualBlocksForUser = Math.max(3, Math.ceil((tickets / totalTicketsInRound) * targetVisualBlocks));
            for (let i = 0; i < visualBlocksForUser; i++) {
                ticketPool.push(p); // Add participant reference multiple times based on tickets
            }
        });
    }


    if (ticketPool.length === 0) {
        console.error("Ticket pool calculation resulted in zero items for roulette.");
        return; // Cannot build roulette
    }

    // Shuffle the pool thoroughly for randomness in sequence
    ticketPool = shuffleArray([...ticketPool]); // Shuffle a copy

    // --- Determine Number of Items Needed for Smooth Animation ---
    const container = inlineRoulette.querySelector('.roulette-container');
    const containerWidth = container?.offsetWidth || 1000; // Get width of the visible area
    const itemWidthWithMargin = 90 + 10; // item width + margin (adjust if CSS changes)
    const itemsInView = Math.ceil(containerWidth / itemWidthWithMargin);
    // Estimate items needed based on spin duration and typical frame rate (e.g., 60fps -> ~16ms/frame)
    // A simpler approach: ensure enough items for multiple full "wraps" + view buffer
    const itemsForSpin = 300; // Fixed large number for safety, adjust as needed
    const totalItemsNeeded = itemsForSpin + (itemsInView * 2); // Ensure enough buffer on both sides
    const itemsToCreate = Math.max(totalItemsNeeded, 500); // Ensure a minimum number

    console.log(`Targeting ${itemsToCreate} roulette items for smooth animation.`);

    // --- Create and Append Items ---
    const fragment = document.createDocumentFragment(); // Use fragment for performance
    for (let i = 0; i < itemsToCreate; i++) {
        // Cycle through the shuffled ticket pool
        const participant = ticketPool[i % ticketPool.length];
        if (!participant || !participant.user) {
             console.warn(`Skipping roulette item creation at index ${i} due to invalid participant data.`);
             continue; // Skip if participant data is somehow invalid
        }

        const userId = participant.user.id;
        const userColor = getUserColor(userId);
        const item = document.createElement('div');
        item.className = 'roulette-item';
        item.dataset.userId = userId; // Store user ID for identifying the winner element later
        item.style.borderColor = userColor; // Set border color

        // Calculate display percentage based on item value / total value
         const totalValueForPercent = Math.max(0.01, currentRound.totalValue || 0.01); // Avoid division by zero
        const percentage = ((participant.itemsValue || 0) / totalValueForPercent * 100).toFixed(1);
        const avatar = participant.user.avatar || '/img/default-avatar.png';
        const username = participant.user.username || 'Unknown User';

        item.innerHTML = `
            <div class="profile-pic-container">
                <img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-avatar.png';">
            </div>
            <div class="roulette-info" style="border-top: 2px solid ${userColor}">
                <span class="roulette-name" title="${username}">${username}</span>
                <span class="roulette-percentage" style="color: ${userColor}">${percentage}%</span>
            </div>`;

        fragment.appendChild(item);
    }

    rouletteTrack.appendChild(fragment); // Append all items at once
    console.log(`Created ${rouletteTrack.children.length} items for roulette animation.`);
}


function handleWinnerAnnouncement(data) {
    if (isSpinning) {
        console.warn("Received winner announcement but animation is already spinning.");
        return;
    }

    // Ensure we have the necessary data locally to build the roulette
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error("Missing participant data for winner announcement. Requesting fresh data.");
        // Request fresh data and try again after a short delay
        socket.emit('requestRoundData');
        setTimeout(() => {
            if (currentRound && currentRound.participants && currentRound.participants.length > 0) {
                console.log("Retrying winner announcement after receiving data.");
                handleWinnerAnnouncement(data); // Retry
            } else {
                 console.error("Still no participant data after requesting. Cannot start spin.");
                 resetToJackpotView();
            }
        }, 1500); // Wait 1.5 seconds for data
        return;
    }


    // Extract winner details
    const winnerDetails = data.winner || (currentRound && currentRound.winner);
    if (!winnerDetails || !winnerDetails.id) {
        console.error("Invalid winner data received in announcement:", data);
        resetToJackpotView(); // Reset if data is bad
        return;
    }

    console.log(`Winner announced: ${winnerDetails.username}. Preparing roulette...`);

    // Stop client timer if it's somehow still running
    if (timerActive) {
        timerActive = false;
        clearInterval(roundTimer);
        roundTimer = null;
        console.log("Stopped client timer due to winner announcement.");
    }

    // Switch UI to roulette view
    switchToRouletteView();

    // Delay starting the animation slightly to allow UI transition
    setTimeout(() => {
        startRouletteAnimation({ winner: winnerDetails }); // Pass winner info
    }, 500); // 500ms delay
}


function switchToRouletteView() {
    if (!jackpotHeader || !inlineRoulette) {
        console.error("Missing roulette UI elements for view switch.");
        return;
    }

    const value = jackpotHeader.querySelector('.jackpot-value');
    const timer = jackpotHeader.querySelector('.jackpot-timer');
    const stats = jackpotHeader.querySelector('.jackpot-stats');

    // Fade out the normal header elements
    [value, timer, stats].forEach(el => {
        if (el) {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            // Use setTimeout to set display: none after fade out
            setTimeout(() => {
                el.style.display = 'none';
            }, 500); // Match transition duration
        }
    });

    // Prepare roulette view
    jackpotHeader.classList.add('roulette-mode'); // Apply class for potential background changes
    inlineRoulette.style.display = 'block'; // Make it visible
    inlineRoulette.style.opacity = '0'; // Start transparent
    inlineRoulette.style.transform = 'translateY(20px)'; // Start slightly down

    // Fade in roulette view
    setTimeout(() => {
        inlineRoulette.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
        inlineRoulette.style.opacity = '1';
        inlineRoulette.style.transform = 'translateY(0)';
    }, 600); // Start fade-in slightly after others fade out

    // Hide return button initially if it exists
    if (returnToJackpot) returnToJackpot.style.display = 'none';
}


function startRouletteAnimation(winnerData) {
    // Cancel any previous animation frame request
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Cancelled previous animation frame before starting new spin.");
    }

    // Ensure valid winner data
    if (!winnerData || !winnerData.winner || !winnerData.winner.id) {
        console.error("Invalid winner data passed to startRouletteAnimation.");
        resetToJackpotView(); // Reset if winner data is bad
        return;
    }

    isSpinning = true;
    updateDepositButtonState(); // Disable deposit button during spin
    spinStartTime = 0; // Reset spin start time

    // Hide winner info overlay initially
    if (winnerInfo) winnerInfo.style.display = 'none';

    // Clear any previous confetti and winner styles
    clearConfetti();
    // Build the roulette items based on currentRound participants
    createRouletteItems();

    // Find the actual participant object matching the winner ID to get value/percentage
    const winnerParticipant = findWinnerFromData(winnerData);
    if (!winnerParticipant) {
        console.error('Could not process winner details in startRouletteAnimation.');
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView();
        return;
    }

    console.log('Starting animation for Winner:', winnerParticipant.user.username);

    // --- Sound Handling ---
    if (spinSound) {
        spinSound.volume = 0; // Start muted for fade-in
        spinSound.currentTime = 0; // Rewind
        spinSound.playbackRate = 1.0; // Reset rate
        spinSound.play().catch(e => console.error('Error playing sound:', e));

        // Fade in sound
        let volume = 0;
        const fadeInInterval = 50; // ms
        const targetVolume = 0.7; // Max volume (0 to 1)
        const fadeDuration = 500; // ms
        const volumeStep = targetVolume / (fadeDuration / fadeInInterval);

        if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval); // Clear previous interval
        window.soundFadeInInterval = setInterval(() => {
            volume += volumeStep;
            if (volume >= targetVolume) {
                spinSound.volume = targetVolume;
                clearInterval(window.soundFadeInInterval);
                window.soundFadeInInterval = null;
            } else {
                spinSound.volume = volume;
            }
        }, fadeInInterval);
    } else {
        console.warn("Spin sound element not found.");
    }

    // --- Start Animation Logic ---
    // Delay slightly to ensure items are rendered
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) {
            console.error('Cannot spin, no items rendered after createRouletteItems.');
            isSpinning = false;
            updateDepositButtonState();
            resetToJackpotView();
            return;
        }

        // --- Find Target Element ---
        // Aim for an element representing the winner in the latter part of the track
        const minIndexPercent = 0.65; // Start looking from 65% mark
        const maxIndexPercent = 0.85; // Stop looking at 85% mark
        const minIndex = Math.floor(items.length * minIndexPercent);
        const maxIndex = Math.floor(items.length * maxIndexPercent);

        let winnerItemsIndices = [];
        for (let i = minIndex; i <= maxIndex; i++) {
            // Ensure item exists and has the dataset property
            if (items[i]?.dataset?.userId === winnerParticipant.user.id) {
                winnerItemsIndices.push(i);
            }
        }

        // Fallback: If no winner found in the preferred range, search the entire track
        if (winnerItemsIndices.length === 0) {
            console.warn(`No winner items found in preferred range [${minIndex}-${maxIndex}]. Expanding search.`);
            for (let i = 0; i < items.length; i++) {
                if (items[i]?.dataset?.userId === winnerParticipant.user.id) {
                    winnerItemsIndices.push(i);
                }
            }
        }

        let winningElement, targetIndex;
        if (winnerItemsIndices.length === 0) {
            // Critical fallback: If winner ID truly not found (data mismatch?), pick a default target
            console.error(`No items found matching winner ID ${winnerParticipant.user.id}. Using fallback index.`);
            targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(items.length * 0.75))); // e.g., 75% mark
            winningElement = items[targetIndex];

            if (!winningElement) { // Should not happen if items exist
                console.error('Fallback winning element is invalid!');
                isSpinning = false;
                updateDepositButtonState();
                resetToJackpotView();
                return;
            }
        } else {
            // Select a random index from the found winner elements
            const randomWinnerIndex = winnerItemsIndices[Math.floor(Math.random() * winnerItemsIndices.length)];
            targetIndex = randomWinnerIndex;
            winningElement = items[targetIndex];

            if (!winningElement) { // Should not happen if index is valid
                console.error(`Selected winning element at index ${targetIndex} is invalid!`);
                isSpinning = false;
                updateDepositButtonState();
                resetToJackpotView();
                return;
            }
        }

        console.log(`Selected winning element at index ${targetIndex} of ${items.length} total items`);
        // Pass both the target element and the processed winner data (with value/%)
        handleRouletteSpinAnimation(winningElement, winnerParticipant);
    }, 100); // Small delay for rendering
}


function handleRouletteSpinAnimation(winningElement, winner) {
    if (!winningElement || !rouletteTrack || !inlineRoulette) {
        console.error("Missing crucial elements for roulette animation.");
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView();
        return;
    }
    const container = inlineRoulette.querySelector('.roulette-container');
    if (!container) {
        console.error("Roulette container element not found.");
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView();
        return;
    }

    // --- Calculate Target Position ---
    const containerWidth = container.offsetWidth;
    const itemWidth = winningElement.offsetWidth || 90; // Use actual or default width
    const itemOffsetLeft = winningElement.offsetLeft; // Position relative to track start
    // Calculate the offset needed to center the item under the ticker
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    // Add randomness to the final landing position (slight overshoot/undershoot)
    const positionVariation = (Math.random() * 2 - 1) * (itemWidth * LANDING_POSITION_VARIATION);
    // Target scroll position (negative because we move track left)
    const targetScrollPosition = -(itemOffsetLeft - centerOffset) + positionVariation;
    const finalTargetPosition = targetScrollPosition;

    // --- Animation Parameters ---
    const startPosition = parseFloat(rouletteTrack.style.transform?.match(/translateX\(([-.\d]+)px\)/)?.[1] || '0'); // Get current X or 0
    const duration = SPIN_DURATION_SECONDS * 1000; // Total spin duration
    const bounceDuration = BOUNCE_ENABLED ? 1200 : 0; // Duration for bounce effect if enabled
    const totalAnimationTime = duration + bounceDuration;
    const totalDistance = finalTargetPosition - startPosition;
    const overshootAmount = totalDistance * BOUNCE_OVERSHOOT_FACTOR; // For bounce calculation

    // --- Animation Loop Setup ---
    let startTime = performance.now();
    let currentSpeed = 0;
    let lastPosition = startPosition;
    let lastTimestamp = startTime;

    rouletteTrack.style.transition = 'none'; // Ensure CSS transitions are off

    function animateRoulette(timestamp) {
        if (!isSpinning) {
            console.log("Animation loop stopped because isSpinning is false.");
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return; // Stop the loop if spin is cancelled
        }

        const elapsed = timestamp - startTime;
        let currentPosition;
        let animationFinished = false;

        // --- Calculate Position Based on Time ---
        if (elapsed <= duration) { // Main easing phase
            const animationPhaseProgress = elapsed / duration;
            const easedProgress = easeOutAnimation(animationPhaseProgress); // Apply easing
            currentPosition = startPosition + totalDistance * easedProgress;
        } else if (BOUNCE_ENABLED && elapsed <= totalAnimationTime) { // Bounce phase
            const bouncePhaseProgress = (elapsed - duration) / bounceDuration;
            const bounceDisplacementFactor = calculateBounce(bouncePhaseProgress); // Calculate bounce effect
            currentPosition = finalTargetPosition - (overshootAmount * bounceDisplacementFactor);
        } else { // Animation finished
            currentPosition = finalTargetPosition;
            animationFinished = true;
        }

        // Apply the calculated position
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;

        // --- Adjust Sound Playback Rate Based on Speed ---
        const deltaTime = (timestamp - lastTimestamp) / 1000; // Time since last frame in seconds
        if (deltaTime > 0.001) { // Avoid division by zero or tiny values
            const deltaPosition = currentPosition - lastPosition;
            currentSpeed = Math.abs(deltaPosition / deltaTime); // Speed in pixels/second

            // Adjust sound pitch based on speed
            if (spinSound && !spinSound.paused) {
                const minRate = 0.5;
                const maxRate = 2.0;
                const speedThresholdLow = 300; // Speed below which pitch starts dropping significantly
                const speedThresholdHigh = 5000; // Speed above which pitch is maxed out
                let targetRate;

                if (animationFinished) {
                     targetRate = 1.0; // Reset rate at end
                } else if (currentSpeed < speedThresholdLow) {
                    // Gradually decrease rate as speed drops below low threshold
                    targetRate = minRate + (maxRate - minRate) * (currentSpeed / speedThresholdLow) * 0.4; // Make drop less drastic
                } else if (currentSpeed > speedThresholdHigh) {
                    targetRate = maxRate;
                } else {
                    // Interpolate rate between low and high thresholds
                    const speedRange = speedThresholdHigh - speedThresholdLow;
                    const progressInRange = (currentSpeed - speedThresholdLow) / speedRange;
                    // Start from a base rate slightly above min, then scale up
                    targetRate = minRate + (maxRate - minRate) * (0.4 + progressInRange * 0.6);
                }

                // Smoothly transition to the target rate to avoid abrupt changes
                const rateChangeFactor = 0.08; // How quickly the rate adjusts (lower = smoother)
                spinSound.playbackRate = spinSound.playbackRate + (targetRate - spinSound.playbackRate) * rateChangeFactor;
                // Clamp playback rate within bounds
                spinSound.playbackRate = Math.max(minRate, Math.min(maxRate, spinSound.playbackRate));
            }

            lastPosition = currentPosition;
            lastTimestamp = timestamp;
        }

        // --- Continue or End Animation ---
        if (!animationFinished) {
            animationFrameId = requestAnimationFrame(animateRoulette); // Request next frame
        } else {
            console.log("Animation finished naturally in loop");
            animationFrameId = null;
            finalizeSpin(winningElement, winner); // Call finalize function
        }
    }

    // Start the animation loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear any residual frame
    animationFrameId = requestAnimationFrame(animateRoulette);
}


function finalizeSpin(winningElement, winner) {
    // Check if spin already ended or elements missing
    if (!isSpinning && winningElement && winningElement.classList.contains('winner-highlight')) {
        console.log("FinalizeSpin called, but spin seems already finalized.");
        return;
    }
     if (!winningElement || !winner || !winner.user) {
         console.error("Cannot finalize spin: Invalid winner element or winner data.");
         isSpinning = false; // Ensure flag is reset
         updateDepositButtonState();
         resetToJackpotView(); // Attempt to reset
         return;
     }

    console.log("Finalizing spin: Applying highlight, fading sound.");
    const userColor = getUserColor(winner.user.id);

    // Add highlighting class and dynamic style for pulse color
    winningElement.classList.add('winner-highlight');
    const styleId = 'winner-pulse-style';
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove(); // Remove old style if exists

    const style = document.createElement('style');
    style.id = styleId;
    // Define pulse animation using CSS variables for color
    style.textContent = `
        .winner-highlight {
            z-index: 5; /* Ensure highlighted item is above others */
            border-width: 3px; /* Make border thicker */
            border-color: ${userColor}; /* Set border color immediately */
            animation: winnerPulse 1.5s infinite;
            --winner-color: ${userColor}; /* Pass color to animation */
            transform: scale(1.05); /* Slightly larger */
        }
        @keyframes winnerPulse {
            0%, 100% {
                box-shadow: 0 0 15px var(--winner-color);
                transform: scale(1.05);
            }
            50% {
                box-shadow: 0 0 25px var(--winner-color), 0 0 10px var(--winner-color); /* More intense glow */
                transform: scale(1.1); /* Slightly larger pulse */
            }
        }`;
    document.head.appendChild(style);

    // --- Fade Out Sound ---
    if (spinSound && !spinSound.paused) {
        if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); // Clear previous

        let volume = spinSound.volume;
        const fadeOutInterval = 75; // ms interval
        const fadeDuration = 1000; // ms total fade time
        const volumeStep = volume / (fadeDuration / fadeOutInterval);

        window.soundFadeOutInterval = setInterval(() => {
            volume -= volumeStep;
            if (volume <= 0) {
                spinSound.pause();
                spinSound.volume = 1.0; // Reset volume for next time
                spinSound.playbackRate = 1.0; // Reset rate
                clearInterval(window.soundFadeOutInterval);
                window.soundFadeOutInterval = null;
                console.log("Sound faded out.");
            } else {
                spinSound.volume = volume;
            }
        }, fadeOutInterval);
    }

    // Delay slightly before showing winner info to let highlight settle
    setTimeout(() => {
        handleSpinEnd(winningElement, winner); // Call the function to display winner info
    }, 300); // 300ms delay
}


function handleSpinEnd(winningElement, winner) {
    // Check if already ended or data missing
    // Allow running even if isSpinning is false here, as finalizeSpin calls it
    if (!winningElement || !winner || !winner.user) {
        console.error("handleSpinEnd called with invalid data or element.");
        if (!isSpinning) return; // Don't reset if already reset
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView();
        return;
    }

    // Stop animation frame just in case it's still running (shouldn't be)
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    console.log("Handling spin end: Displaying winner info and confetti.");

    // Populate and show the winner info overlay
    if (winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
        const userColor = getUserColor(winner.user.id);

        // Set winner details
        winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
        winnerAvatar.alt = winner.user.username || 'Winner';
        winnerAvatar.style.borderColor = userColor;
        winnerAvatar.style.boxShadow = `0 0 15px ${userColor}`; // Add glow

        winnerName.textContent = winner.user.username || 'Winner';
        winnerName.style.color = userColor; // Color the name

        // Format values from the processed winner object
        const depositValueStr = `$${(winner.value || 0).toFixed(2)}`;
        const chanceValueStr = `${(winner.percentage || 0).toFixed(2)}%`;

        // Clear previous text for typing effect
        winnerDeposit.textContent = '';
        winnerChance.textContent = '';

        // Fade in the winner info box
        winnerInfo.style.display = 'flex'; // Make it visible
        winnerInfo.style.opacity = '0'; // Start transparent
        winnerInfo.style.animation = 'fadeIn 0.5s ease forwards'; // Use CSS animation


        // Start typing effect after fade-in starts
        setTimeout(() => {
            let depositIndex = 0;
            let chanceIndex = 0;
            const typeDelay = 35; // ms between characters

            // Clear previous typing intervals if any
            if (window.typeDepositInterval) clearInterval(window.typeDepositInterval);
            if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);

            // Type deposit value
            window.typeDepositInterval = setInterval(() => {
                if (depositIndex < depositValueStr.length) {
                    winnerDeposit.textContent += depositValueStr[depositIndex];
                    depositIndex++;
                } else {
                    clearInterval(window.typeDepositInterval);
                    window.typeDepositInterval = null;

                    // Type chance value after deposit is done
                    window.typeChanceInterval = setInterval(() => {
                        if (chanceIndex < chanceValueStr.length) {
                            winnerChance.textContent += chanceValueStr[chanceIndex];
                            chanceIndex++;
                        } else {
                            clearInterval(window.typeChanceInterval);
                            window.typeChanceInterval = null;

                            // Launch confetti after typing is complete
                            setTimeout(() => {
                                launchConfetti(userColor); // Use winner's color
                            }, 200);

                            // Set spinning to false AFTER all effects are initiated
                            isSpinning = false;
                            updateDepositButtonState(); // Update button state now that spin is truly over
                            console.log("isSpinning set to false after winner display and confetti.");

                            // Schedule the reset back to jackpot view
                            setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);
                        }
                    }, typeDelay);
                }
            }, typeDelay);
        }, 500); // Delay typing start to match fade-in duration

    } else {
        console.error("Winner info display elements are missing.");
        // Still need to handle end of spin state
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView(); // Reset even if display fails
    }
}


function launchConfetti(mainColor = '#00e676') { // Default to primary color
    if (!confettiContainer) return;
    clearConfetti(); // Clear previous confetti

    const baseColor = mainColor;
    // Generate related colors
    const complementaryColor = getComplementaryColor(baseColor);
    const lighterColor = lightenColor(baseColor, 30);
    const darkerColor = darkenColor(baseColor, 30);

    const colors = [ // Array of colors to use
        baseColor, lighterColor, darkerColor,
        complementaryColor, '#ffffff', lightenColor(complementaryColor, 20)
    ];

    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        // Random properties for variation
        confetti.style.left = `${Math.random() * 100}%`;
        const animDuration = 2 + Math.random() * 3; // Duration 2-5 seconds
        const animDelay = Math.random() * 1.5; // Delay 0-1.5 seconds

        // Set CSS variables for animation control (defined in CSS @keyframes)
        confetti.style.setProperty('--duration', `${animDuration}s`);
        confetti.style.setProperty('--delay', `${animDelay}s`);

        const color = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.setProperty('--color', color); // Use CSS variable for color too
        // confetti.style.backgroundColor = color; // Direct background color

        const size = Math.random() * 8 + 4; // Size 4px to 12px
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;

        // Rotation and horizontal fall properties for animation
        const rotationStart = Math.random() * 360;
        const rotationEnd = rotationStart + (Math.random() - 0.5) * 720; // Random end rotation
        const fallX = (Math.random() - 0.5) * 100; // Horizontal drift

        confetti.style.setProperty('--fall-x', `${fallX}px`);
        confetti.style.setProperty('--rotation-start', `${rotationStart}deg`);
        confetti.style.setProperty('--rotation-end', `${rotationEnd}deg`);

        // Random shape (square or circle)
        const shape = Math.random();
        if (shape < 0.5) confetti.style.borderRadius = '50%'; // Circle
        // else square (default)

        confettiContainer.appendChild(confetti);
    }
}


function clearConfetti() {
    if (confettiContainer) confettiContainer.innerHTML = ''; // Clear confetti elements

    // Remove dynamic winner pulse style
    const winnerPulseStyle = document.getElementById('winner-pulse-style');
    if (winnerPulseStyle) winnerPulseStyle.remove();

    // Remove highlight class from any roulette item
    document.querySelectorAll('.roulette-item.winner-highlight').forEach(el => {
        el.classList.remove('winner-highlight');
        el.style.transform = ''; // Reset transform
        // Reset border to user's color if needed, or remove specific style
        // el.style.borderColor = ''; // Or set back to original user color if stored/retrievable
         if (el.dataset?.userId) el.style.borderColor = getUserColor(el.dataset.userId);
         else el.style.borderColor = 'transparent'; // Fallback
    });
}

// Reset view to jackpot state
function resetToJackpotView() {
    console.log("Resetting to jackpot view...");

    // Stop any ongoing animations/intervals
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval);
    window.soundFadeInInterval = null;
    if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval);
    window.soundFadeOutInterval = null;
    if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval);
    window.winnerFadeInInterval = null;
    if (window.typeDepositInterval) clearInterval(window.typeDepositInterval);
    window.typeDepositInterval = null;
    if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);
    window.typeChanceInterval = null;
    if (roundTimer) clearInterval(roundTimer); // Ensure client timer is stopped
    roundTimer = null;
    timerActive = false; // Mark timer as inactive


    isSpinning = false; // Mark spinning as false
    spinStartTime = 0; // Reset start time

    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) {
        console.error("Missing elements required for resetToJackpotView.");
        return; // Avoid errors if elements are missing
    }

    // Stop sound if playing
    if (spinSound && !spinSound.paused) {
        spinSound.pause();
        spinSound.currentTime = 0;
        spinSound.volume = 1.0; // Reset volume
        spinSound.playbackRate = 1.0; // Reset rate
    }

    // Fade out roulette/winner info
    inlineRoulette.style.transition = 'opacity 0.5s ease';
    inlineRoulette.style.opacity = '0';
    if (winnerInfo.style.display !== 'none') {
        winnerInfo.style.transition = 'opacity 0.3s ease'; // Faster fade for winner info
        winnerInfo.style.opacity = '0';
    }
    clearConfetti(); // Clear confetti and highlights

    // After fade out, reset structure and fade in jackpot header elements
    setTimeout(() => {
        jackpotHeader.classList.remove('roulette-mode'); // Remove class affecting background/layout
        // Clean up roulette track
        rouletteTrack.style.transition = 'none'; // Disable transitions for reset
        rouletteTrack.style.transform = 'translateX(0)'; // Reset position
        rouletteTrack.innerHTML = ''; // Clear items
        // Hide roulette/winner elements
        inlineRoulette.style.display = 'none';
        winnerInfo.style.display = 'none';
        winnerInfo.style.opacity = ''; // Reset opacity for next time
        winnerInfo.style.animation = ''; // Reset animation

        // Make jackpot header elements visible again
        const value = jackpotHeader.querySelector('.jackpot-value');
        const timer = jackpotHeader.querySelector('.jackpot-timer');
        const stats = jackpotHeader.querySelector('.jackpot-stats');

        [value, timer, stats].forEach((el, index) => {
            if (el) {
                el.style.display = 'flex'; // Use flex as defined in CSS
                el.style.opacity = '0'; // Start faded out
                // Staggered fade-in effect
                setTimeout(() => {
                    el.style.transition = 'opacity 0.5s ease';
                    el.style.opacity = '1';
                }, 50 + index * 50); // Stagger start time
            }
        });

        // Perform visual reset for the next round (timer, pot, participant list)
        initiateNewRoundVisualReset();

        // Update button state AFTER resetting everything
        updateDepositButtonState();

        // Request fresh round data from server
        if (socket.connected) {
             console.log("Requesting fresh round data after reset.");
             socket.emit('requestRoundData');
        } else {
            console.warn("Socket not connected, skipping requestRoundData after reset.");
            // Button state might be inaccurate until connection restored
        }

    }, 500); // Wait for fade-out transition to complete (match duration)
}


// Initiate visual reset for a new round
function initiateNewRoundVisualReset() {
    console.log("Visual reset for new round display");

    // Reset Timer display to ROUND_DURATION
    updateTimerUI(ROUND_DURATION); // Updates text and circle
    if (timerValue) {
        timerValue.classList.remove('urgent-pulse', 'timer-pulse');
        // updateTimerUI handles setting text now
        // timerValue.textContent = ROUND_DURATION.toString();
    }
     // Ensure client timer interval is stopped and flag is reset
     if (roundTimer) clearInterval(roundTimer);
     roundTimer = null;
     timerActive = false;


    // Clear the participants (deposit blocks) container
    if (participantsContainer && emptyPotMessage) {
        participantsContainer.innerHTML = ''; // Clear all previous deposit blocks
        // Ensure the empty pot message is present and displayed
        if (!participantsContainer.contains(emptyPotMessage)) {
            participantsContainer.appendChild(emptyPotMessage);
        }
        emptyPotMessage.style.display = 'block';
    }

    // Reset Pot Value display
    if (potValue) potValue.textContent = "$0.00";

    // Reset Participant Count display
    if (participantCount) participantCount.textContent = `0/${MAX_PARTICIPANTS_DISPLAY}`;

    // Clear user color map for the new round
    userColorMap.clear();

     // Ensure deposit button state is updated for the new round conditions
     updateDepositButtonState();
}

// Helper to find winner details from participant list
function findWinnerFromData(winnerData) {
    const winnerId = winnerData?.winner?.id;
    if (!winnerId) {
        console.error("Missing winner ID in findWinnerFromData input:", winnerData);
        return null;
    }

    // Use currentRound data if available
    if (!currentRound || !currentRound.participants) {
        console.warn("Missing currentRound or participants data for findWinnerFromData. Using provided winner data only.");
        // Fallback to using only the data passed in if local state is missing
        if (winnerData.winner) {
            return {
                user: { ...winnerData.winner }, // Assume basic user data is in winnerData.winner
                percentage: 0, // Cannot calculate without full round data
                value: 0       // Cannot calculate without full round data
            };
        }
        return null; // Cannot proceed
    }

    // Find the participant in the local round data
    const winnerParticipant = currentRound.participants.find(
        p => p.user && p.user.id === winnerId);

    if (!winnerParticipant) {
        console.warn(`Winner ID ${winnerId} not found in local participants list.`);
        // Fallback similar to above if participant not found locally
        if (winnerData.winner) return { user: { ...winnerData.winner }, percentage: 0, value: 0 };
        return null;
    }

    // Calculate percentage based on local round data
    const totalValue = currentRound.totalValue > 0 ? currentRound.totalValue : 1; // Avoid division by zero
    const percentage = ((winnerParticipant.itemsValue || 0) / totalValue) * 100;

    return {
        user: { ...winnerParticipant.user }, // Return full user object
        percentage: percentage || 0,
        value: winnerParticipant.itemsValue || 0
    };
}


// Test function for roulette animation
function testRouletteAnimation() {
    console.log("--- TESTING ROULETTE ANIMATION ---");

    if (isSpinning) {
        console.log("Already spinning, test cancelled.");
        return;
    }

    let testData = currentRound; // Use current round data if available

    // If no current round or no participants, create mock data
    if (!testData || !testData.participants || testData.participants.length === 0) {
        console.log('Using sample test data for animation...');
        // Create richer mock data
        testData = {
            roundId: `test-${Date.now()}`,
            status: 'active', // Simulate active before spin
            totalValue: 194.66,
            participants: [
                { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
                { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
                { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
                { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 }
            ],
            items: [ /* Basic items list if needed */
                { owner: 'test_user_1', name: 'AK-47 | Redline', price: 15.50, image: '/img/default-item.png' },
                { owner: 'test_user_1', name: 'AWP | Asiimov', price: 70.19, image: '/img/default-item.png' },
                { owner: 'test_user_1', name: 'M4A4 | Howl', price: 100.00, image: '/img/default-item.png' },
                { owner: 'test_user_2', name: 'Glock-18 | Water Elemental', price: 1.39, image: '/img/default-item.png' },
                { owner: 'test_user_2', name: 'P250 | Sand Dune', price: 6.00, image: '/img/default-item.png' },
                { owner: 'test_user_3', name: 'USP-S | Cortex', price: 1.04, image: '/img/default-item.png' },
                { owner: 'test_user_4', name: 'Tec-9 | Fuel Injector', price: 0.54, image: '/img/default-item.png' }
            ]
        };
        // Set this mock data as the current round for the test
        currentRound = testData;
        // Visually update the UI to reflect the mock data before spinning
        initiateNewRoundVisualReset(); // Clear display first
        updateRoundUI(); // Update pot/count based on mock data
        // Manually add deposit blocks for mock participants
        if (currentRound.participants && currentRound.participants.length > 0) {
            // Sort for display consistency if desired
             const sortedParticipants = [...currentRound.participants].sort((a, b) => (b.itemsValue || 0) - (a.itemsValue || 0));
             sortedParticipants.forEach(p => {
                 const userItems = currentRound.items?.filter(item => item.owner && p.user && item.owner === p.user.id) || [];
                 const mockDepositData = { userId: p.user.id, username: p.user.username, avatar: p.user.avatar, itemsValue: p.itemsValue, depositedItems: userItems };
                 displayLatestDeposit(mockDepositData);
                 // Remove animation class immediately for test setup
                 const element = participantsContainer?.querySelector(`.player-deposit-container[data-user-id="${p.user.id}"]`);
                 if (element) element.classList.remove('player-deposit-new');
             });
        }

    } else {
        // Ensure current round is marked active for test consistency
        currentRound.status = 'active';
    }


    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        showNotification('Test Error', 'No participants available for test spin.');
        return;
    }

    // Select a random winner from the participants list for the test
    const idx = Math.floor(Math.random() * currentRound.participants.length);
    const winningParticipant = currentRound.participants[idx];

    if (!winningParticipant || !winningParticipant.user) {
        console.error("Selected winning participant is invalid in test data:", winningParticipant);
        return;
    }

    // Create mock winner data structure similar to what server sends
    const mockWinnerData = {
        roundId: currentRound.roundId,
        winner: winningParticipant.user, // Pass the user object
        winningTicket: Math.floor(Math.random() * (winningParticipant.tickets || 1)) // Simulate a winning ticket
        // Server would also send serverSeed, clientSeed etc. after round end
    };

    console.log('Test Winner Selected:', mockWinnerData.winner.username);
    // Trigger the same function used for real winner announcements
    handleWinnerAnnouncement(mockWinnerData);
}


// --- Provably Fair Section ---

// Verify round using backend API
async function verifyRound() {
    const idInput = document.getElementById('round-id');
    const sSeedInput = document.getElementById('server-seed');
    const cSeedInput = document.getElementById('client-seed');
    const resultEl = document.getElementById('verification-result');

    if (!idInput || !sSeedInput || !cSeedInput || !resultEl) {
        console.error("Verify form elements missing.");
        return;
    }

    const roundId = idInput.value.trim();
    const serverSeed = sSeedInput.value.trim();
    const clientSeed = cSeedInput.value.trim();

    // Basic Input Validation
    if (!roundId || !serverSeed || !clientSeed) {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result error';
        resultEl.innerHTML = '<p>Please fill in all fields (Round ID, Server Seed, Client Seed).</p>';
        return;
    }
    // SHA256 hash is 64 hex characters
    if (serverSeed.length !== 64 || !/^[a-f0-9]{64}$/i.test(serverSeed)) {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result error';
        resultEl.innerHTML = '<p>Invalid Server Seed format (should be 64 hexadecimal characters).</p>';
        return;
    }
     // Basic check for client seed (can be more complex depending on format)
     if (clientSeed.length === 0) {
         resultEl.style.display = 'block';
         resultEl.className = 'verification-result error';
         resultEl.innerHTML = '<p>Client Seed cannot be empty.</p>';
         return;
     }


    try {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result loading'; // Show loading state
        resultEl.innerHTML = '<p>Verifying...</p>';

        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId, serverSeed, clientSeed })
        });

        const result = await response.json(); // Get response body

        if (!response.ok) {
            // Use error message from server if available
            throw new Error(result.error || `Verification failed (${response.status})`);
        }

        // Update result display based on verification outcome
        resultEl.className = `verification-result ${result.verified ? 'success' : 'error'}`;

        let html = `<h4>Result (Round #${result.roundId || roundId})</h4>`; // Use ID from result if available

        if (result.verified) {
            html += `<p style="color: var(--success-color); font-weight: bold;">✅ Verified Fair.</p>`;
            if (result.serverSeedHash) html += `<p><strong>Server Seed Hash:</strong> <code class="seed-value">${result.serverSeedHash}</code></p>`;
            if (result.serverSeed) html += `<p><strong>Server Seed:</strong> <code class="seed-value">${result.serverSeed}</code></p>`;
            if (result.clientSeed) html += `<p><strong>Client Seed:</strong> <code class="seed-value">${result.clientSeed}</code></p>`;
            if (result.combinedString) html += `<p><strong>Combined String (Server-Client):</strong> <code class="seed-value wrap-anywhere">${result.combinedString}</code></p>`;
            if (result.finalHash) html += `<p><strong>Resulting SHA256 Hash:</strong> <code class="seed-value">${result.finalHash}</code></p>`;
            if (result.winningTicket !== undefined) html += `<p><strong>Winning Ticket Number:</strong> ${result.winningTicket} (out of ${result.totalTickets || 'N/A'} total tickets)</p>`;
            if (result.winnerUsername) html += `<p><strong>Winner:</strong> ${result.winnerUsername}</p>`;
            if (result.totalValue !== undefined) html += `<p><strong>Final Pot Value:</strong> $${result.totalValue.toFixed(2)}</p>`;

        } else {
            html += `<p style="color: var(--error-color); font-weight: bold;">❌ Verification Failed.</p>`;
            html += `<p><strong>Reason:</strong> ${result.reason || 'Mismatch detected.'}</p>`;
            // Show relevant data for debugging the failure
            if (result.serverSeedHash) html += `<p><strong>Expected Server Seed Hash:</strong> <code class="seed-value">${result.serverSeedHash}</code></p>`;
             if (result.calculatedHash) html += `<p><strong>Calculated Hash from Provided Seed:</strong> <code class="seed-value">${result.calculatedHash}</code></p>`; // If server provides this on mismatch
             if (result.serverSeed) html += `<p><strong>Expected Server Seed:</strong> <code class="seed-value">${result.serverSeed}</code></p>`;
             if (result.clientSeed) html += `<p><strong>Expected Client Seed:</strong> <code class="seed-value">${result.clientSeed}</code></p>`;
            if (result.calculatedWinningTicket !== undefined) html += `<p><strong>Calculated Ticket:</strong> ${result.calculatedWinningTicket}</p>`;
            if (result.actualWinningTicket !== undefined) html += `<p><strong>Actual Recorded Ticket:</strong> ${result.actualWinningTicket}</p>`;
             if (result.totalTickets !== undefined) html += `<p><strong>Total Tickets in Round:</strong> ${result.totalTickets}</p>`;
        }

        resultEl.innerHTML = html;

    } catch (error) {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result error';
        resultEl.innerHTML = `<p>Error: ${error.message}</p>`;
        console.error('Error verifying round:', error);
    }
}


// Load past rounds for history table
async function loadPastRounds(page = 1) {
    if (!roundsTableBody || !roundsPagination) {
        console.warn("Rounds history table/pagination elements missing.");
        return;
    }

    try {
        // Show loading state
        roundsTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading round history...</td></tr>';
        roundsPagination.innerHTML = ''; // Clear old pagination

        const response = await fetch(`/api/rounds?page=${page}&limit=10`); // Fetch specific page

        if (!response.ok) {
            throw new Error(`Failed to load round history (${response.status})`);
        }

        const data = await response.json();

        // Validate received data structure
        if (!data || !Array.isArray(data.rounds) ||
            typeof data.currentPage !== 'number' ||
            typeof data.totalPages !== 'number') {
            throw new Error('Invalid rounds data received from server.');
        }

        roundsTableBody.innerHTML = ''; // Clear loading message

        if (data.rounds.length === 0) {
            // Display message if no rounds found
            const message = (page === 1) ? 'No past rounds found.' : 'No rounds found on this page.';
            roundsTableBody.innerHTML = `<tr><td colspan="5" class="no-rounds-message">${message}</td></tr>`;
        } else {
            // Populate table with round data
            data.rounds.forEach(round => {
                const row = document.createElement('tr');
                row.dataset.roundId = round.roundId; // Store round ID for potential future use

                // Format date nicely
                let date = 'N/A';
                if (round.completedTime || round.endTime) { // Prefer completedTime if available
                    try {
                        const d = new Date(round.completedTime || round.endTime);
                        if (!isNaN(d.getTime())) {
                            date = d.toLocaleString(undefined, { // Use user's locale
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true
                            });
                        }
                    } catch (e) { console.error("Date formatting error:", e); }
                }

                // Prepare seeds for button (escape quotes for onclick)
                const serverSeedStr = (round.serverSeed || '').replace(/'/g, "\\'");
                const clientSeedStr = (round.clientSeed || '').replace(/'/g, "\\'");
                const roundIdStr = round.roundId || 'N/A';
                const winnerUsername = round.winner ? (round.winner.username || 'N/A') : (round.status === 'error' ? 'ERROR' : 'N/A');
                const potValueStr = (round.totalValue !== undefined) ? `$${round.totalValue.toFixed(2)}` : '$0.00';


                row.innerHTML = `
                    <td>#${roundIdStr}</td>
                    <td>${date}</td>
                    <td>${potValueStr}</td>
                    <td>${winnerUsername}</td>
                    <td>
                        <button class="btn btn-details" onclick="showRoundDetails('${roundIdStr}')"
                                ${roundIdStr === 'N/A' ? 'disabled' : ''}>Details</button>
                        <button class="btn btn-verify" onclick="populateVerificationFields('${roundIdStr}', '${serverSeedStr}', '${clientSeedStr}')"
                                ${!round.serverSeed ? 'disabled title="Seed not revealed yet"' : ''}>Verify</button>
                    </td>`;

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


// Populate verification form fields when "Verify" button in history is clicked
// Made globally accessible for onclick attribute
window.populateVerificationFields = function(roundId, serverSeed, clientSeed) {
    const idInput = document.getElementById('round-id');
    const sSeedInput = document.getElementById('server-seed');
    const cSeedInput = document.getElementById('client-seed');

    if (idInput) idInput.value = roundId || '';
    if (sSeedInput) sSeedInput.value = serverSeed || '';
    if (cSeedInput) cSeedInput.value = clientSeed || '';

    // Scroll to the verification section smoothly
    const verificationSection = document.getElementById('provably-fair-verification');
    if (verificationSection) {
        verificationSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Optionally notify user if seeds are missing
    if (!serverSeed && roundId && roundId !== 'N/A') {
        showNotification('Info', `Server Seed for Round #${roundId} is revealed after the round ends.`);
    }
};

// Function to show round details (basic alert for now)
// Made globally accessible for onclick attribute
window.showRoundDetails = async function(roundId) {
    console.log(`Showing details for round ${roundId}`);

    if (!roundId || roundId === 'N/A') {
        showNotification('Info', 'Invalid Round ID for details.');
        return;
    }

    // Consider creating a dedicated modal for details instead of alert
    alert(`Workspaceing details for round #${roundId}... (Implementation needed)`);

    // TODO: Implement actual detail fetching and display (e.g., in a modal)
    // try {
    //     // Example: Fetch more details if needed (API endpoint would be required)
    //     // const response = await fetch(`/api/rounds/${roundId}/details`); // hypothetical endpoint
    //     // if (!response.ok) {
    //     //     throw new Error(`Failed to fetch round details (${response.status})`);
    //     // }
    //     // const roundDetails = await response.json();
    //     // Display details in a modal...
    // } catch (error) {
    //     showNotification('Error', `Could not load details for round ${roundId}: ${error.message}`);
    //     console.error('Error fetching round details:', error);
    // }
};


// Create pagination controls
function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return;
    roundsPagination.innerHTML = ''; // Clear previous pagination

    if (totalPages <= 1) return; // No pagination needed if only one page

    const maxPagesToShow = 5; // Number of page buttons to show (excluding prev/next)

    // Helper to create button/ellipsis
    const createButton = (text, page, isActive = false, isDisabled = false, isEllipsis = false) => {
        if (isEllipsis) {
            const span = document.createElement('span');
            span.className = 'page-ellipsis';
            span.textContent = '...';
            return span;
        }

        const button = document.createElement('button');
        button.className = `page-button ${isActive ? 'active' : ''}`;
        button.textContent = text;
        button.disabled = isDisabled;

        // Add click listener only if it's a valid page number and not disabled
        if (!isDisabled && typeof page === 'number') {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                loadPastRounds(page); // Load the clicked page
            });
        }
        return button;
    };

    // Previous Button
    roundsPagination.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));

    // Page Number Buttons Calculation
    if (totalPages <= maxPagesToShow) {
        // Show all pages if total pages is less than or equal to max display
        for (let i = 1; i <= totalPages; i++) {
            roundsPagination.appendChild(createButton(i, i, i === currentPage));
        }
    } else {
        // Complex pagination logic (show first, last, current, and neighbours with ellipsis)
        const pages = [];
        pages.push(1); // Always show page 1

        // Calculate range around current page
        let rangeStart = Math.max(2, currentPage - Math.floor((maxPagesToShow - 3) / 2));
        let rangeEnd = Math.min(totalPages - 1, currentPage + Math.ceil((maxPagesToShow - 3) / 2));

        // Adjust range if it bumps against the edges
         const rangeLength = rangeEnd - rangeStart + 1;
         const needed = (maxPagesToShow - 3); // Number of middle buttons needed

         if(rangeLength < needed) {
             if(currentPage < totalPages / 2) {
                 rangeEnd = Math.min(totalPages - 1, rangeEnd + (needed - rangeLength));
             } else {
                 rangeStart = Math.max(2, rangeStart - (needed - rangeLength));
             }
         }


        // Add ellipsis if needed before the range
        if (rangeStart > 2) pages.push('...');

        // Add page numbers in the calculated range
        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }

        // Add ellipsis if needed after the range
        if (rangeEnd < totalPages - 1) pages.push('...');

        pages.push(totalPages); // Always show last page

        // Create buttons from the calculated pages array
        pages.forEach(page => {
            if (page === '...') {
                roundsPagination.appendChild(createButton('...', null, false, true, true));
            } else {
                roundsPagination.appendChild(createButton(page, page, page === currentPage));
            }
        });
    }

    // Next Button
    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
