// main.js (Complete and Modified for Enhanced Roulette Animation & Deposit Display)
// Ensure the Socket.IO client library is included in your HTML:
// <script src="/socket.io/socket.io.js"></script>
const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a.active'); // Might need adjustment if 'active' isn't default
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
const participantsContainer = document.getElementById('itemsContainer'); // Container for items in pot
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
const returnToJackpot = document.getElementById('returnToJackpot'); // This will be hidden, but keep the reference
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
const ROULETTE_REPETITIONS = 20; // How many times to repeat participant list (used in older logic, potentially unused now)
const SPIN_DURATION_SECONDS = 6.5; // Duration of the main spin animation
const WINNER_DISPLAY_DURATION = 7000; // 7 seconds for winner info display
const CONFETTI_COUNT = 150;
const MAX_DISPLAY_DEPOSITS = 5; // Maximum number of deposit history items to show

// --- NEW Animation constants for enhanced roulette ---
// MODIFIED: Increased power for a more dramatic final slowdown
const EASE_OUT_POWER = 5;           // Power for ease-out curve (e.g., 3=cubic, 4=quart, 5=quint). Higher = more dramatic slowdown.
const BOUNCE_ENABLED = false;      // Keep bounce disabled as per previous code
const BOUNCE_OVERSHOOT_FACTOR = 0.07; // How much to overshoot initially (percentage of total distance, e.g., 0.07 = 7%)
const BOUNCE_DAMPING = 0.35;       // How quickly the bounce decays (0 to 1, lower = decays faster, 0.3-0.5 is usually good)
const BOUNCE_FREQUENCY = 3.5;      // How many bounces (approx). Higher = more bounces in the same time.
// MODIFIED: Increased variation for more unpredictable stops (e.g., rollover, stop early/late)
const LANDING_POSITION_VARIATION = 0.60; // Controls how much the final position can vary (0.60 = ±60% of an item width)

// User Color Map - 20 distinct colors for players
const userColorMap = new Map();
const colorPalette = [
    '#00bcd4', // Cyan
    '#ff5722', // Deep Orange
    '#9c27b0', // Purple
    '#4caf50', // Green
    '#ffeb3b', // Yellow
    '#2196f3', // Blue
    '#f44336', // Red
    '#ff9800', // Orange
    '#e91e63', // Pink
    '#8bc34a', // Light Green
    '#3f51b5', // Indigo
    '#009688', // Teal
    '#cddc39', // Lime
    '#795548', // Brown
    '#607d8b', // Blue Grey
    '#673ab7', // Deep Purple
    '#ffc107', // Amber
    '#03a9f4', // Light Blue
    '#9e9e9e', // Grey
    '#8d6e63'  // Brown Light
];

// App State
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false;
let timerActive = false;
let roundTimer = null;
let animationFrameId = null; // To store the requestAnimationFrame ID
let spinStartTime = 0; // Track when the spin animation starts

// --- Helper Functions ---
function showModal(modalElement) {
    if (modalElement) modalElement.style.display = 'flex';
    console.log('Showing modal:', modalElement?.id);
}

function hideModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none';
    console.log('Hiding modal:', modalElement?.id);
}

function showPage(pageElement) {
    [homePage, faqPage, fairPage, aboutPage, roadmapPage].forEach(page => { if (page) page.style.display = 'none'; });
    if (pageElement) pageElement.style.display = 'block';
    console.log('Showing page:', pageElement?.id);
    // Update active link state
    document.querySelectorAll('.main-nav a, a#about-link, a#roadmap-link, a#faq-link, a#fair-link').forEach(link => link.classList.remove('active'));
    if (pageElement === homePage && homeLink) homeLink.classList.add('active');
    if (pageElement === faqPage && faqLink) faqLink.classList.add('active');
    if (pageElement === fairPage && fairLink) fairLink.classList.add('active');
    if (pageElement === aboutPage && aboutLink) aboutLink.classList.add('active');
    if (pageElement === roadmapPage && roadmapLink) roadmapLink.classList.add('active');
    // Load data if showing fair page
    if (pageElement === fairPage) loadPastRounds();
}

// Get consistent color for user
function getUserColor(userId) {
    if (!userColorMap.has(userId)) {
        // Assign a consistent color from the palette
        const colorIndex = userColorMap.size % colorPalette.length;
        userColorMap.set(userId, colorPalette[colorIndex]);
    }
    return userColorMap.get(userId);
}

function showNotification(title, message) {
    console.log(`Notification: ${title} - ${message}`);
    // Replace with a more sophisticated notification system if available
    alert(`Notification: ${title}\n${message}`); // Basic alert fallback
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

async function showRoundDetails(roundId) {
    console.log(`Showing details for round ${roundId}`);
    try {
        const response = await fetch(`/api/rounds/${roundId}`);
        if (!response.ok) throw new Error(`Failed to fetch round details (${response.status})`);
        const roundData = await response.json();
        // Consider showing details in a modal instead of alert for better UX
        alert(`Round Details (ID: ${roundId}):\nWinner: ${roundData.winner?.username || 'N/A'}\nValue: ${roundData.totalValue?.toFixed(2)}\nServer Seed: ${roundData.serverSeed || 'N/A'}\nClient Seed: ${roundData.clientSeed || 'N/A'}\nWinning Ticket: ${roundData.winningTicket}`);
    } catch (error) {
        showNotification('Error', `Could not load details for round ${roundId}: ${error.message}`);
        console.error('Error fetching round details:', error);
    }
}

// --- UPDATED EASING LOGIC ---

/**
 * Calculates the eased progress using an ease-out function.
 * Uses EASE_OUT_POWER to control the curve. Higher power = more dramatic slowdown at the end.
 * @param {number} t - Normalized time (0 to 1)
 * @returns {number} Eased progress (0 to 1)
 */
function easeOutAnimation(t) {
    // Clamp input time t to the range [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - clampedT, EASE_OUT_POWER);
}

/**
 * Calculates the bounce effect displacement after the main ease-out animation finishes.
 * @param {number} t - Normalized time *after* the main animation (0 to 1, represents bounce phase)
 * @returns {number} Normalized bounce displacement (-1 to 1, relative to overshoot amount)
 */
function calculateBounce(t) {
    if (!BOUNCE_ENABLED) return 0;
    // Clamp input time t to the range [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));
    // Simple decaying sine wave for bounce effect
    const decay = Math.exp(-clampedT / BOUNCE_DAMPING); // Exponential decay
    const oscillations = Math.sin(clampedT * Math.PI * 2 * BOUNCE_FREQUENCY); // Sine wave for oscillation
    // Start the bounce from the overshoot position (positive displacement initially)
    // We multiply by -1 because the initial overshoot moves opposite to the first bounce swing
    return -decay * oscillations;
}

// Helper functions for color manipulation
function getComplementaryColor(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Invert the colors
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Lighten
    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Darken
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }
    checkLoginStatus();
    setupEventListeners();
    setupSocketConnection();
    showPage(homePage); // Default to home page
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
            if (!currentUser) { showNotification('Login Required', 'Please log in first to deposit items.'); return; }
            if (!currentUser.tradeUrl) {
                if (tradeUrlModal) showModal(tradeUrlModal); else showNotification('Trade URL Missing', 'Please set your Steam Trade URL.');
                return;
            }
            if (depositModal) { showModal(depositModal); loadUserInventory(); }
        });
    }

    // Deposit Modal Close
    if (closeDepositModal) closeDepositModal.addEventListener('click', () => { if (depositModal) hideModal(depositModal); });
    if (depositButton) depositButton.addEventListener('click', submitDeposit);

    // Trade URL Modal Close
    if (closeTradeUrlModal) closeTradeUrlModal.addEventListener('click', () => { if (tradeUrlModal) hideModal(tradeUrlModal); });
    if (saveTradeUrl) saveTradeUrl.addEventListener('click', saveUserTradeUrl);

    // Age Verification
    if (agreeCheckbox && agreeButton && ageVerificationModal) {
        agreeCheckbox.addEventListener('change', () => { agreeButton.disabled = !agreeCheckbox.checked; });
        agreeButton.addEventListener('click', () => { if (agreeCheckbox.checked) { localStorage.setItem('ageVerified', 'true'); hideModal(ageVerificationModal); } });
        agreeButton.disabled = !agreeCheckbox.checked;
    }

    // Test Spin Button
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) testSpinButton.addEventListener('click', testRouletteAnimation);

    // Test Deposit Button (NEW)
    const testDepositButton = document.getElementById('testDepositButton');
    if (testDepositButton) testDepositButton.addEventListener('click', testDeposit);

    // Provably Fair Verify Button
    if (verifyBtn) verifyBtn.addEventListener('click', verifyRound);

    // Handle clicks outside modals
    window.addEventListener('click', (e) => {
        if (depositModal && e.target === depositModal) hideModal(depositModal);
        if (tradeUrlModal && e.target === tradeUrlModal) hideModal(tradeUrlModal);
        // Add other modals here if needed (e.g., age verification)
        if (ageVerificationModal && e.target === ageVerificationModal && localStorage.getItem('ageVerified')) {
            // Optional: hide age modal on outside click only if already verified?
            // hideModal(ageVerificationModal);
        }
    });

    // Add keyboard event listeners for spinning (optional test)
    document.addEventListener('keydown', function(event) {
        // Easter egg: Press spacebar to test the roulette while on home page
        if (event.code === 'Space' && homePage.style.display === 'block' && !isSpinning) {
            // Only if not already spinning
            testRouletteAnimation();
            event.preventDefault(); // Prevent page scrolling
        }
    });
}

// Socket connection and events
function setupSocketConnection() {
    socket.on('connect', () => { console.log('Socket connected:', socket.id); socket.emit('requestRoundData'); });
    socket.on('disconnect', (reason) => { console.log('Socket disconnected:', reason); showNotification('Connection Lost', 'Disconnected from server.'); });
    socket.on('connect_error', (error) => { console.error('Socket connection error:', error); showNotification('Connection Error', 'Could not connect to server.'); });
    socket.on('roundCreated', (data) => { console.log('New round created:', data); currentRound = data; updateRoundUI(); resetToJackpotView(); });
    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.roundId === data.roundId) handleNewDeposit(data);
        else if (!currentRound && data.roundId) { console.warn("Participant update for unknown round."); socket.emit('requestRoundData'); }
    });
    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            // Ensure we have participants before announcing winner
            if (!currentRound.participants || currentRound.participants.length === 0) {
                console.warn("Received winner but no participants are loaded locally. Requesting round data.");
                socket.emit('requestRoundData'); // Try to get full data before proceeding
                // Add a small delay to allow data fetch before handling winner
                setTimeout(() => {
                    if (currentRound && currentRound.participants && currentRound.participants.length > 0) {
                        handleWinnerAnnouncement(data);
                    } else {
                        console.error("Still no participants after requesting data. Cannot proceed with winner announcement.");
                        resetToJackpotView();
                    }
                }, 1000); // 1 second delay
            } else {
                handleWinnerAnnouncement(data);
            }
        }
        else console.warn("Received winner for mismatched round.");
    });
    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false; if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
            if(timerValue) timerValue.textContent = "Rolling"; if(timerForeground) updateTimerCircle(0, 120);
        }
    });
    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (data.message === "No participants." || currentRound?.participants?.length === 0) {
            console.log("Round completed with no participants."); setTimeout(resetToJackpotView, 1500);
        }
        // Could also handle cases where winner was announced but needs visual reset later
    });
    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data); if (!data) { console.error("Invalid round data received from server."); return; }
        currentRound = data; updateRoundUI();
        if (currentRound.status === 'rolling' && currentRound.winner) {
            console.log("Connected during rolling phase.");
            // Optionally trigger animation if needed, careful not to double-spin
            // It might be safer to just wait for the 'roundWinner' event again or reset view
            if (!isSpinning) {
                console.log("Attempting to handle winner display from initial round data.");
                handleWinnerAnnouncement(currentRound); // Pass the whole round data which includes winner
            }
        }
        else if (currentRound.status === 'active' && currentRound.participants?.length >= 2 && !timerActive) {
            timerActive = true; startClientTimer(currentRound.timeLeft || 120);
        } else if (currentRound.status === 'ended' || currentRound.status === 'completed') {
            console.log("Connected after round ended."); resetToJackpotView();
        }
    });
    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        if (currentUser && data.userId === currentUser._id) showNotification('Trade Offer Sent', 'Check Steam for winnings!');
    });
}

// Check login status
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) { if (response.status === 401 || response.status === 403) currentUser = null; else throw new Error(`Server error: ${response.status}`); }
        else { currentUser = await response.json(); console.log('User logged in:', currentUser?.username); }
        updateUserUI();
    } catch (error) { console.error('Error checking login status:', error); currentUser = null; updateUserUI(); }
}

// Update user UI
function updateUserUI() {
    if (currentUser && userProfile && loginButton && userAvatar && userName) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png'; userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none'; userProfile.style.display = 'flex';
    } else if (userProfile && loginButton) { loginButton.style.display = 'flex'; userProfile.style.display = 'none'; }
}
// Load user inventory
async function loadUserInventory() {
    if (!inventoryItems || !selectedItems || !inventoryLoading || !totalValue) { console.error("Inv DOM elements missing."); return; }
    selectedItemsList = []; selectedItems.innerHTML = ''; updateTotalValue();
    inventoryLoading.style.display = 'flex'; inventoryItems.innerHTML = '';
    try {
        const response = await fetch('/api/inventory');
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error('Please log in first.');
            else { const errorData = await response.text(); throw new Error(`Inv load fail (${response.status}): ${errorData}`); }
        }
        userInventory = await response.json(); inventoryLoading.style.display = 'none';
        if (!Array.isArray(userInventory)) throw new Error('Invalid inv data.');
        if (userInventory.length === 0) { inventoryItems.innerHTML = '<p class="empty-inventory-message">Inventory empty or unavailable.</p>'; return; }
        displayInventoryItems();
    } catch (error) { inventoryLoading.style.display = 'none'; inventoryItems.innerHTML = `<p class="error-message">Error loading inventory: ${error.message}</p>`; console.error('Error loading inventory:', error); showNotification('Inventory Error', error.message); }
}

// Display inventory items
function displayInventoryItems() {
    if (!inventoryItems) return; inventoryItems.innerHTML = '';
    userInventory.forEach(item => {
        if (!item || typeof item.price !== 'number' || !item.assetId || !item.name || !item.image) { console.warn("Invalid item:", item); return; }
        const itemElement = document.createElement('div'); itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId; itemElement.dataset.name = item.name;
        itemElement.dataset.image = item.image; itemElement.dataset.price = item.price.toFixed(2);
        itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><div class="item-details"><div class="item-name" title="${item.name}">${item.name}</div><div class="item-value">${item.price.toFixed(2)}</div></div>`;
        if (selectedItemsList.some(selected => selected.assetId === item.assetId)) itemElement.classList.add('selected');
        itemElement.addEventListener('click', () => toggleItemSelection(itemElement, item));
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(element, item) {
    const assetId = item.assetId; const index = selectedItemsList.findIndex(i => i.assetId === assetId);
    if (index === -1) { selectedItemsList.push(item); element.classList.add('selected'); addSelectedItemElement(item); }
    else { selectedItemsList.splice(index, 1); element.classList.remove('selected'); removeSelectedItemElement(assetId); }
    updateTotalValue();
}

// Add item to selected area
function addSelectedItemElement(item) {
    if (!selectedItems) return; const selectedElement = document.createElement('div');
    selectedElement.className = 'selected-item'; selectedElement.dataset.assetId = item.assetId;
    selectedElement.innerHTML = `<button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button><img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><div class="selected-item-details"><div class="selected-item-value">${item.price.toFixed(2)}</div></div>`;
    const inventoryItemElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);
    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        // Find the original item object from the full inventory list
        const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item;
        if (inventoryItemElement && originalItem) {
            toggleItemSelection(inventoryItemElement, originalItem);
        } else {
            // Fallback if inventory element isn't rendered (unlikely but safe)
            removeSelectedItem(item.assetId);
            updateTotalValue();
        }
    });
    selectedItems.appendChild(selectedElement);
}

// Remove item from selected area
function removeSelectedItemElement(assetId) { const selectedElement = selectedItems.querySelector(`.selected-item[data-asset-id="${assetId}"]`); if (selectedElement) selectedElement.remove(); }

// Remove item logic
function removeSelectedItem(assetId) {
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);
    const inventoryElement = inventoryItems?.querySelector(`.inventory-item[data-asset-id="${assetId}"]`); if (inventoryElement) inventoryElement.classList.remove('selected');
    removeSelectedItemElement(assetId);
}

// Update total value display
function updateTotalValue() {
    if (!totalValue || !depositButton) return;
    const total = selectedItemsList.reduce((sum, item) => sum + (item.price || 0), 0);
    totalValue.textContent = `${total.toFixed(2)}`;
    depositButton.disabled = selectedItemsList.length === 0;
}

// Submit deposit
async function submitDeposit() {
    if (selectedItemsList.length === 0) { showNotification('No Items Selected', 'Select items first.'); return; }
    if (!currentRound || currentRound.status !== 'active') { showNotification('Deposit Error', 'Wait for next round or round is not active.'); return; }
    if (!depositButton) return;
    depositButton.disabled = true; depositButton.textContent = 'Depositing...';
    try {
        const response = await fetch('/api/deposit/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: selectedItemsList.map(item => item.assetId) }) });
        if (!response.ok) { const error = await response.json().catch(() => ({ error: 'Deposit failed.' })); throw new Error(error.error || `Deposit fail (${response.status})`); }
        if (depositModal) hideModal(depositModal); showNotification('Deposit Initiated', 'Accept Steam trade offer.');
        selectedItemsList = []; if(selectedItems) selectedItems.innerHTML = ''; if (inventoryItems) inventoryItems.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
        updateTotalValue();
    } catch (error) { showNotification('Deposit Error', error.message); console.error('Error depositing:', error); }
    finally { if(depositButton) { depositButton.disabled = selectedItemsList.length === 0; depositButton.textContent = 'Deposit Items'; } }
}

// Save trade URL
async function saveUserTradeUrl() {
    if (!tradeUrlInput || !saveTradeUrl || !tradeUrlModal || !depositModal) { console.error("Trade URL elements missing."); return; }
    const tradeUrl = tradeUrlInput.value.trim();
    if (!tradeUrl) { showNotification('Input Required', 'Enter Trade URL.'); return; }
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') || !tradeUrl.includes('partner=') || !tradeUrl.includes('token=')) { showNotification('Invalid Format', 'Enter valid Steam Trade URL.'); return; }
    saveTradeUrl.disabled = true; saveTradeUrl.textContent = 'Saving...';
    try {
        const response = await fetch('/api/user/tradeurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tradeUrl }) });
        if (!response.ok) { const error = await response.json().catch(() => ({ error: 'Failed to save.' })); throw new Error(error.error || `Save fail (${response.status})`); }
        const result = await response.json(); if (currentUser) currentUser.tradeUrl = result.tradeUrl;
        hideModal(tradeUrlModal);
        // Automatically try opening deposit modal again after saving URL
        if (showDepositModal) {
            // Simulate click to re-trigger the check
            showDepositModal.click();
        }
        // showModal(depositModal); // Don't automatically show, let the click handler decide
        // loadUserInventory(); // Load inventory when deposit modal is shown by click handler
        showNotification('Success', 'Trade URL saved.');
    } catch (error) { showNotification('Error Saving URL', error.message); console.error('Error updating trade URL:', error); }
    finally { saveTradeUrl.disabled = false; saveTradeUrl.textContent = 'Save Trade URL'; }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound || !potValue) return;
    potValue.textContent = `${(currentRound.totalValue || 0).toFixed(2)}`;
    if (!timerActive) updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : 120);
    updateParticipantsUI();
}

// Update timer UI
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;
    const timeToShow = Math.max(0, Math.round(timeLeft));
    if (timerActive || timeToShow > 0) timerValue.textContent = timeToShow; else if (isSpinning) timerValue.textContent = "Rolling"; else timerValue.textContent = "Ended";
    updateTimerCircle(timeToShow, 120); // Assume 120s total time for circle
    if (timerActive && timeToShow <= 10 && timeToShow > 0) { timerValue.classList.add('urgent-pulse'); timerValue.classList.remove('timer-pulse'); }
    else { timerValue.classList.remove('urgent-pulse'); if (timerActive && timeToShow > 10) timerValue.classList.add('timer-pulse'); else timerValue.classList.remove('timer-pulse'); }
}

// ===== NEW DEPOSIT DISPLAY FUNCTIONS =====

// Function to display latest deposit with animation
function displayLatestDeposit(data) {
    if (!participantsContainer) return;
    
    // Get user data
    const username = data.username || 'Unknown';
    const avatar = data.avatar || '/img/default-avatar.png';
    const value = data.itemsValue || 0;
    const items = data.depositedItems || [];
    
    // Get or create user color
    const userColor = getUserColor(data.userId);
    
    // Create deposit container
    const depositContainer = document.createElement('div');
    depositContainer.className = 'player-deposit-container player-deposit-new';
    
    // Create deposit header
    const depositHeader = document.createElement('div');
    depositHeader.className = 'player-deposit-header';
    depositHeader.innerHTML = `
        <img src="${avatar}" alt="${username}" class="player-avatar" loading="lazy" 
             onerror="this.onerror=null; this.src='/img/default-avatar.png';">
        <div class="player-info">
            <div class="player-name">${username}</div>
            <div class="player-deposit-value" style="color: ${userColor}">${value.toFixed(2)}</div>
        </div>
    `;
    
    // Create items grid if there are items
    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';
    
    if (items && items.length > 0) {
        items.forEach(item => {
            if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} (${item.price.toFixed(2)})`;
            itemElement.style.borderColor = userColor;
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy" 
                     onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">${item.price.toFixed(2)}</div>
                </div>
            `;
            
            itemsGrid.appendChild(itemElement);
        });
    }
    
    // Assemble the deposit container
    depositContainer.appendChild(depositHeader);
    depositContainer.appendChild(itemsGrid);
    
    // Add to the container at the top
    if (participantsContainer.firstChild) {
        participantsContainer.insertBefore(depositContainer, participantsContainer.firstChild);
    } else {
        participantsContainer.appendChild(depositContainer);
    }
    
    // Hide empty pot message if visible
    if (emptyPotMessage) {
        emptyPotMessage.style.display = 'none';
    }
    
    // Remove animation class after animation completes to prevent replaying
    setTimeout(() => {
        depositContainer.classList.remove('player-deposit-new');
    }, 1000);
    
    // Limit the number of deposit containers to avoid overwhelming the display
    const depositContainers = participantsContainer.querySelectorAll('.player-deposit-container');
    if (depositContainers.length > MAX_DISPLAY_DEPOSITS) {
        for (let i = MAX_DISPLAY_DEPOSITS; i < depositContainers.length; i++) {
            depositContainers[i].remove();
        }
    }
}

// Handle new deposit
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || data.itemsValue === undefined || data.totalValue === undefined) { 
        console.error("Invalid participant update:", data); 
        return; 
    }
    
    if (!currentRound) { 
        console.warn("Deposit for non-existent round."); 
        currentRound = { 
            roundId: data.roundId, 
            status: 'active', 
            timeLeft: 120, 
            totalValue: 0, 
            participants: [], 
            items: [] 
        }; 
    }
    else if (currentRound.roundId !== data.roundId) { 
        console.warn(`Deposit for wrong round (${data.roundId}). Current is ${currentRound.roundId}`); 
        return; 
    }

    if (!currentRound.participants) currentRound.participants = [];
    let participantFound = false;
    
    // Update existing participant or add new one
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user && p.user.id === data.userId) {
            participantFound = true;
            return { 
                ...p, 
                itemsValue: (p.itemsValue || 0) + data.itemsValue, 
                tickets: data.tickets 
            };
        }
        return p;
    });

    if (!participantFound) {
        // Add new participant
        currentRound.participants.push({
            user: { 
                id: data.userId, 
                username: data.username || 'Unknown', 
                avatar: data.avatar || '/img/default-avatar.png' 
            },
            itemsValue: data.itemsValue,
            tickets: data.tickets
        });
    }

    currentRound.totalValue = data.totalValue;

    // Add deposited items to the round's item list
    if (data.depositedItems && Array.isArray(data.depositedItems)) {
        if (!currentRound.items) currentRound.items = [];
        data.depositedItems.forEach(item => {
            currentRound.items.push({ ...item, owner: data.userId });
        });
    }

    updateRoundUI(); // Update pot value, participants display
    displayLatestDeposit(data); // Display the new deposit animation

    // Start timer only if exactly 2 participants and timer isn't already active
    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached (>= 2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120); // Use timeLeft from server if available
    }
}

// Update participants UI - modified to accommodate the new deposit display
function updateParticipantsUI() {
    if (!participantsContainer || !participantCount || !emptyPotMessage) { 
        console.error("Participants UI elements missing."); 
        return; 
    }
    
    const participants = currentRound?.participants || []; 
    const totalPotValue = currentRound?.totalValue || 0;
    
    participantCount.textContent = `${participants.length}/200`; 
    
    // Don't clear participantsContainer here anymore, as we now maintain the deposit history
    // Only clear if there are no participants
    if (participants.length === 0) {
        participantsContainer.innerHTML = '';
        emptyPotMessage.style.display = 'block';
        // Ensure the message element is actually appended if it wasn't already
        if (!participantsContainer.contains(emptyPotMessage)) {
            participantsContainer.appendChild(emptyPotMessage);
        }
        return;
    } else { 
        emptyPotMessage.style.display = 'none'; 
    }
    
    // Check if we need to refresh the participant display
    // This prevents duplicating content when called from the updateRoundUI function
    const refreshDisplay = !participantsContainer.querySelector('.player-deposit-container');
    
    if (refreshDisplay) {
        // Sort participants by value descending for initial display
        const sortedParticipants = [...participants].sort((a, b) => (b.itemsValue || 0) - (a.itemsValue || 0));
        
        // Clear container for fresh start
        participantsContainer.innerHTML = '';
        
        // Create deposit containers for each participant
        sortedParticipants.forEach(participant => {
            const userItems = currentRound?.items?.filter(item => 
                item.owner && participant.user && 
                item.owner.toString() === participant.user.id.toString()
            ) || [];
            
            // Use a mock deposit data structure for displayLatestDeposit
            const mockDeposit = {
                userId: participant.user.id,
                username: participant.user.username,
                avatar: participant.user.avatar,
                itemsValue: participant.itemsValue,
                depositedItems: userItems
            };
            
            displayLatestDeposit(mockDeposit);
        });
    }
}

// Function to test deposit with mock data
function testDeposit() {
    console.log("--- TESTING DEPOSIT DISPLAY ---");
    
    // Create a mock deposit for testing
    const mockDeposit = {
        roundId: currentRound?.roundId || 'test-round',
        userId: `test_user_${Math.floor(Math.random() * 1000)}`, // Random user ID
        username: ["RustPlayer99", "SkinCollector", "AK47Master", "HeadHunter", "RustLord", "TheRaider", "ScrapDealer"][Math.floor(Math.random() * 7)],
        avatar: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
        itemsValue: (Math.random() * 50 + 5).toFixed(2) * 1, // Random value between 5 and 55
        tickets: Math.floor((Math.random() * 50 + 5) * 100), // Proportional tickets
        totalValue: currentRound?.totalValue ? currentRound.totalValue + parseFloat((Math.random() * 50 + 5).toFixed(2)) : parseFloat((Math.random() * 50 + 5).toFixed(2))
    };
    
    // Add mock deposited items
    const itemNames = [
        "AK-47 | Alien Red", "Metal Chest Plate", "Semi-Automatic Rifle", "Garage Door", 
        "Assault Rifle", "Metal Facemask", "Road Sign Kilt", "Coffee Can Helmet", 
        "Double Barrel Shotgun", "Revolver", "Sheet Metal Door", "Medical Syringe"
    ];
    
    const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items
    mockDeposit.depositedItems = [];
    
    let remainingValue = mockDeposit.itemsValue;
    
    for (let i = 0; i < numItems; i++) {
        const isLastItem = i === numItems - 1;
        const itemValue = isLastItem ? remainingValue : (Math.random() * remainingValue * 0.7).toFixed(2) * 1;
        remainingValue -= itemValue;
        
        mockDeposit.depositedItems.push({
            assetId: `test_asset_${Math.floor(Math.random() * 10000)}`,
            name: itemNames[Math.floor(Math.random() * itemNames.length)],
            image: `/img/default-item.png`, // Default image for testing
            price: itemValue
        });
    }
    
    // Handle the deposit
    handleNewDeposit(mockDeposit);
}

// Start client timer
function startClientTimer(initialTime = 120) {
    if (!timerValue) return; if (roundTimer) clearInterval(roundTimer);
    let timeLeft = Math.max(0, initialTime); console.log(`Starting client timer from ${timeLeft}s`); updateTimerUI(timeLeft);
    roundTimer = setInterval(() => {
        if (!timerActive) { clearInterval(roundTimer); roundTimer = null; console.log("Client timer stopped (not active)."); return; }
        timeLeft--; updateTimerUI(timeLeft);
        if (timeLeft <= 0) { clearInterval(roundTimer); roundTimer = null; timerActive = false; console.log("Client timer reached zero."); if(timerValue) timerValue.textContent = "Ending"; }
    }, 1000);
}

// Update timer circle
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return;
    // Added check for baseVal which exists on SVG elements
    if (timerForeground.r && timerForeground.r.baseVal) {
        const radius = timerForeground.r.baseVal.value; // Get radius from SVG element
        const circumference = 2 * Math.PI * radius;
        const progress = Math.min(1, Math.max(0, timeLeft / totalTime));
        const offset = circumference * (1 - progress);
        timerForeground.style.strokeDasharray = `${circumference}`;
        timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`;
    } else {
        console.warn("timerForeground is not an SVG circle element or 'r' attribute is missing.");
    }
}

// Create participant element (legacy function, kept for reference or potential fallback)
function createParticipantElement(participant, items, totalPotValue) {
    if (!participant || !participant.user || typeof participant.itemsValue !== 'number') { console.error("Invalid participant data:", participant); const el = document.createElement('div'); el.textContent = "Err"; return el; }
    const participantElement = document.createElement('div'); participantElement.className = 'participant'; participantElement.dataset.userId = participant.user.id;
    const percentage = totalPotValue > 0 ? ((participant.itemsValue / totalPotValue) * 100) : 0;
    const username = participant.user.username || 'Unknown'; const avatar = participant.user.avatar || '/img/default-avatar.png';

    // Get consistent color for this user
    const userColor = getUserColor(participant.user.id);

    const headerElement = document.createElement('div');
    headerElement.className = 'participant-header';
    headerElement.style.borderLeft = `4px solid ${userColor}`; // Apply user color

    headerElement.innerHTML = `
        <div class="participant-info">
            <img src="${avatar}" alt="${username}" class="participant-avatar" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor}">
            <div class="participant-details">
                <span class="participant-name" title="${username}">${username}</span>
                <div class="participant-stats">
                    <span class="participant-value" title="Deposited Value" style="color: ${userColor}">${participant.itemsValue.toFixed(2)}</span>
                    <span class="participant-percentage" title="Win Chance">${percentage.toFixed(2)}%</span>
                </div>
            </div>
        </div>`;

    const itemsElement = document.createElement('div'); itemsElement.className = 'participant-items';
    if (items && items.length > 0) {
        items.sort((a, b) => (b.price || 0) - (a.price || 0)); // Sort items by price desc
        items.forEach(item => {
            if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;
            const itemElement = document.createElement('div');
            itemElement.className = 'item';
            itemElement.title = `${item.name} (${item.price.toFixed(2)})`;
            // Add user color to item border
            itemElement.style.borderColor = userColor;
            itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><span class="item-value" style="color: ${userColor}">${item.price.toFixed(2)}</span>`;
            itemsElement.appendChild(itemElement);
        });
    }
    participantElement.appendChild(headerElement); participantElement.appendChild(itemsElement); return participantElement;
}


// =================== ENHANCED ROULETTE ANIMATION (MODIFIED) ===================

// Enhanced roulette item creation with consistent colors per user and more items for smoother animation
function createRouletteItems() {
    if (!rouletteTrack || !inlineRoulette) {
        console.error("Track or inline roulette element missing.");
        return;
    }

    rouletteTrack.innerHTML = '';
    rouletteTrack.style.transition = 'none'; // Ensure no CSS transitions interfere
    rouletteTrack.style.transform = 'translateX(0)'; // Reset position

    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('No participants data available to create roulette items.');
        // Optionally display a message in the roulette track area
        rouletteTrack.innerHTML = '<div style="color: grey; text-align: center; padding: 20px; width: 100%;">Waiting for participants...</div>';
        return;
    }

    let ticketPool = [];
    const totalTicketsInRound = currentRound.participants.reduce((sum, p) => sum + (p.tickets || Math.max(1, Math.floor((p.itemsValue || 0) * 100))), 0);

    // Create a pool representing ticket distribution for visual generation
    currentRound.participants.forEach(p => {
        const tickets = p.tickets !== undefined ? p.tickets : Math.max(1, Math.floor((p.itemsValue || 0) * 100));
        // Create a proportional representation for smoother animation feel
        // Aim for roughly 100-150 visual blocks in the base pool before repetition
        const targetVisualBlocks = 120;
        const visualBlocksForUser = Math.max(3, Math.ceil((tickets / Math.max(1, totalTicketsInRound)) * targetVisualBlocks));

        for (let i = 0; i < visualBlocksForUser; i++) {
            ticketPool.push(p); // Add reference to participant object
        }
    });

    if (ticketPool.length === 0) {
        console.error("Ticket pool calculation resulted in zero items.");
        return;
    }

    // Shuffle the initial pool for more randomness and visual interest
    ticketPool = shuffleArray([...ticketPool]);

    // Estimate items needed based on container width and item size
    const container = inlineRoulette.querySelector('.roulette-container');
    const containerWidth = container?.offsetWidth || 1000; // Fallback width
    const itemWidthWithMargin = 90 + 10; // Item width (90px) + margin (5px left + 5px right)

    // Calculate minimum items for seamless looping illusion during spin
    // Need enough items to fill the view + extra for the spin distance + buffers
    const itemsInView = Math.ceil(containerWidth / itemWidthWithMargin);
    const itemsForSpin = Math.ceil((SPIN_DURATION_SECONDS * 1000) / 50); // Rough estimate based on speed
    const totalItemsNeeded = (itemsInView * 2) + itemsForSpin + 200; // Viewport * 2 + spin + safety buffer
    const itemsToCreate = Math.max(totalItemsNeeded, 500); // Ensure at least 500 items

    console.log(`Targeting ${itemsToCreate} roulette items for smooth animation.`);

    // Create items using DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < itemsToCreate; i++) {
        // Cycle through the shuffled ticket pool
        const participant = ticketPool[i % ticketPool.length];
        if (!participant || !participant.user) continue; // Skip if data is somehow invalid

        const userId = participant.user.id;
        const userColor = getUserColor(userId); // Get consistent color

        const item = document.createElement('div');
        item.className = 'roulette-item';
        item.dataset.userId = userId; // Store user ID for winner selection

        // Apply user-specific color to border
        item.style.borderColor = userColor;

        // Calculate percentage (use totalValue from currentRound)
        const percentage = currentRound.totalValue > 0 ?
            ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(1) : '0.0';
        const avatar = participant.user.avatar || '/img/default-avatar.png';
        const username = participant.user.username || 'Unknown';

        item.innerHTML = `
            <div class="profile-pic-container">
                <img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-avatar.png';">
            </div>
            <div class="roulette-info" style="border-top: 2px solid ${userColor}">
                <span class="roulette-name" title="${username}">${username}</span>
                <span class="roulette-percentage" style="color: ${userColor}">${percentage}%</span>
            </div>
        `;

        fragment.appendChild(item);
    }

    // Append all items at once
    rouletteTrack.appendChild(fragment);

    console.log(`Created ${itemsToCreate} items for roulette animation.`);
}


function handleWinnerAnnouncement(data) {
    if (isSpinning) { console.warn("Received winner announcement but animation is already spinning."); return; }
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error("Missing participant data for winner announcement."); resetToJackpotView(); return; }
    // Winner data can come directly from 'roundWinner' event or embedded in 'roundData'
    const winnerDetails = data.winner || (currentRound && currentRound.winner);
    if (!winnerDetails || !winnerDetails.id) { console.error("Invalid winner data received."); resetToJackpotView(); return; }

    console.log(`Winner announced: ${winnerDetails.username}`);
    if (timerActive) { timerActive = false; clearInterval(roundTimer); roundTimer = null; console.log("Stopped client timer due to winner announcement."); }

    switchToRouletteView();

    // Small delay before starting animation for dramatic effect and view switch
    setTimeout(() => {
        // Pass the winner details object to the animation function
        startRouletteAnimation({ winner: winnerDetails });
    }, 500); // 500ms delay
}

// Initialize enhanced styles when switching to roulette view
function switchToRouletteView() {
    if (!jackpotHeader || !inlineRoulette) {
        console.error("Missing roulette UI elements for view switch.");
        return;
    }

    const value = jackpotHeader.querySelector('.jackpot-value');
    const timer = jackpotHeader.querySelector('.jackpot-timer');
    const stats = jackpotHeader.querySelector('.jackpot-stats');

    // Fade out the jackpot header elements first
    [value, timer, stats].forEach(el => {
        if (el) {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            setTimeout(() => { el.style.display = 'none'; }, 500); // Hide after fade
        }
    });

    // Add roulette mode class for background changes etc.
    jackpotHeader.classList.add('roulette-mode');

    // Prepare roulette container but keep hidden initially
    inlineRoulette.style.display = 'block'; // Make it part of the layout
    inlineRoulette.style.opacity = '0';
    inlineRoulette.style.transform = 'translateY(20px)'; // Start slightly lower

    // Fade in the roulette container after the header elements fade out
    setTimeout(() => {
        inlineRoulette.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
        inlineRoulette.style.opacity = '1';
        inlineRoulette.style.transform = 'translateY(0)';
    }, 600); // Start fade-in slightly after header starts fading out

    // Hide return button (if it existed)
    if (returnToJackpot) returnToJackpot.style.display = 'none';
}

// -- Start Roulette Animation - MODIFIED --
function startRouletteAnimation(winnerData) {
    // Cancel any ongoing animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Cancelled previous animation frame before starting new spin.");
    }

    if (!winnerData || !winnerData.winner || !winnerData.winner.id) {
        console.error("Invalid winner data passed to startRouletteAnimation.");
        resetToJackpotView();
        return;
    }

    isSpinning = true;
    spinStartTime = 0; // Reset start time, will be set on first frame of main spin
    if (winnerInfo) winnerInfo.style.display = 'none';
    clearConfetti();

    createRouletteItems(); // Generate the items for the track

    // Use the passed winner data directly
    const winner = findWinnerFromData(winnerData); // Still useful to get percentage/value
    if (!winner) {
        console.error('Could not process winner details in startRouletteAnimation.');
        isSpinning = false;
        resetToJackpotView();
        return;
    }

    console.log('Starting NEW enhanced animation for Winner:', winner.user.username);

    // Play sound with fade-in effect
    if (spinSound) {
        spinSound.volume = 0;
        spinSound.currentTime = 0;
        spinSound.playbackRate = 1.0; // Reset playback rate
        spinSound.play().catch(e => console.error('Error playing sound:', e));

        let volume = 0;
        const fadeInInterval = 50; // ms between volume steps
        const targetVolume = 0.8; // Don't make it full volume initially
        const volumeStep = targetVolume / (500 / fadeInInterval); // Fade in over 500ms

        // Clear any existing fade interval before starting a new one
        if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval);

        window.soundFadeInInterval = setInterval(() => {
            volume += volumeStep;
            if (volume >= targetVolume) {
                spinSound.volume = targetVolume;
                clearInterval(window.soundFadeInInterval);
                window.soundFadeInInterval = null; // Clear interval ID
            } else {
                spinSound.volume = volume;
            }
        }, fadeInInterval);
    } else {
        console.warn("Spin sound element not found.");
    }

    // Give time for DOM to render items before calculating positions
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) {
            console.error('Cannot spin, no items rendered after createRouletteItems.');
            isSpinning = false;
            resetToJackpotView();
            return;
        }

        // --- Target Selection Logic ---
        const minIndexPercent = 0.65; // Start searching 65% through the items
        const maxIndexPercent = 0.85; // Stop searching 85% through the items
        const minIndex = Math.floor(items.length * minIndexPercent);
        const maxIndex = Math.floor(items.length * maxIndexPercent);
        let winnerItemsIndices = [];

        // Find all indices of items matching the winner ID within our target range
        for (let i = minIndex; i <= maxIndex; i++) {
            // Add null/undefined check for items[i]
            if (items[i]?.dataset?.userId === winner.user.id) {
                winnerItemsIndices.push(i);
            }
        }

        // If no matching items in preferred range, expand search to the entire track
        if (winnerItemsIndices.length === 0) {
            console.warn(`No winner items found in preferred range [${minIndex}-${maxIndex}]. Expanding search.`);
            for (let i = 0; i < items.length; i++) {
                 // Add null/undefined check for items[i]
                if (items[i]?.dataset?.userId === winner.user.id) {
                    winnerItemsIndices.push(i);
                }
            }
        }

        let winningElement;
        let targetIndex;

        // Still no matching items? Fall back to an item near the target zone
        if (winnerItemsIndices.length === 0) {
            console.error(`No items found matching winner ID ${winner.user.id}. Using fallback index.`);
            targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(items.length * 0.75))); // Target 75% mark
            winningElement = items[targetIndex];
            if (!winningElement) {
                console.error('Fallback winning element is invalid!');
                isSpinning = false;
                resetToJackpotView();
                return;
            }
        } else {
            // Choose a random index from our collected winner indices
            const randomWinnerIndex = winnerItemsIndices[Math.floor(Math.random() * winnerItemsIndices.length)];
            targetIndex = randomWinnerIndex;
            winningElement = items[targetIndex];
             // Add check here too in case the randomly selected index somehow points to an invalid item
            if (!winningElement) {
                 console.error(`Selected winning element at index ${targetIndex} is invalid!`);
                 isSpinning = false;
                 resetToJackpotView();
                 return;
            }
        }

        console.log(`Selected winning element at index ${targetIndex} of ${items.length} total items`);
        // --- End Target Selection Logic ---

        // --- Start the Actual Animation Loop ---
        handleRouletteSpinAnimation(winningElement, winner);
        // --- End Animation Start ---

    }, 100); // 100ms delay for item rendering check
}

// -- Handle the animation loop - MODIFIED --
function handleRouletteSpinAnimation(winningElement, winner) {
    if (!winningElement || !rouletteTrack || !inlineRoulette) {
        console.error("Missing crucial elements for roulette animation.");
        isSpinning = false;
        resetToJackpotView();
        return;
    }

    const container = inlineRoulette.querySelector('.roulette-container');
    if (!container) {
        console.error("Roulette container element not found.");
        isSpinning = false;
        resetToJackpotView();
        return;
    }

    // --- Position Calculation ---
    const containerWidth = container.offsetWidth;
    const itemWidth = winningElement.offsetWidth || 90; // Use measured width or fallback
    const itemOffsetLeft = winningElement.offsetLeft;

    // Calculate the target NEGATIVE translateX value to center the winning item
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);

    // Add randomized variation to the landing position using the increased LANDING_POSITION_VARIATION
    // This creates a random offset within the range of ±LANDING_POSITION_VARIATION of an item width
    const positionVariation = (Math.random() * 2 - 1) * (itemWidth * LANDING_POSITION_VARIATION);

    // Apply the variation to the target position
    const targetScrollPosition = -(itemOffsetLeft - centerOffset) + positionVariation;

    const finalTargetPosition = targetScrollPosition;
    // --- End Position Calculation ---

    const startPosition = 0; // Assuming track starts at translateX(0) after reset

    // --- Animation variables ---
    const duration = SPIN_DURATION_SECONDS * 1000; // Main spin duration in ms (now 6.5 seconds)
    const bounceDuration = BOUNCE_ENABLED ? 1200 : 0; // Duration for bounce effect (ms)
    const totalAnimationTime = duration + bounceDuration;
    let startTime = performance.now(); // Use performance.now()

    // Calculate overshoot amount based on total distance
    const totalDistance = finalTargetPosition - startPosition;
    const overshootAmount = totalDistance * BOUNCE_OVERSHOOT_FACTOR; // Negative distance * positive factor = negative overshoot

    let currentSpeed = 0;
    let lastPosition = startPosition;
    let lastTimestamp = startTime;

    // Ensure track has no transition interfering
    rouletteTrack.style.transition = 'none';

    function animateRoulette(timestamp) {
        if (!isSpinning) { // Check if spinning was cancelled externally
            console.log("Animation loop stopped because isSpinning is false.");
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return;
        }

        const elapsed = timestamp - startTime;
        let currentPosition;
        let animationFinished = false;

        // --- Main Easing Phase ---
        if (elapsed <= duration) {
            const animationPhaseProgress = elapsed / duration; // Progress 0 to 1
            // Use the modified easeOutAnimation with the higher EASE_OUT_POWER
            const easedProgress = easeOutAnimation(animationPhaseProgress);
            currentPosition = startPosition + totalDistance * easedProgress;
        }
        // --- Bounce Phase ---
        else if (BOUNCE_ENABLED && elapsed <= totalAnimationTime) {
            const bouncePhaseProgress = (elapsed - duration) / bounceDuration; // Progress 0 to 1 for bounce
            const bounceDisplacementFactor = calculateBounce(bouncePhaseProgress); // Returns -1 to 1 relative value
            // Apply bounce relative to the final position, scaled by the overshoot amount
            currentPosition = finalTargetPosition - (overshootAmount * bounceDisplacementFactor);
        }
        // --- Animation End ---
        else {
            currentPosition = finalTargetPosition; // Ensure it lands exactly at the calculated final position
            animationFinished = true;
        }

        // Apply the transform
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;

        // --- Sound Pitch / Speed Calculation ---
        const deltaTime = (timestamp - lastTimestamp) / 1000; // Time diff in seconds
        if (deltaTime > 0.001) { // Avoid calculations on near-zero delta times
            const deltaPosition = currentPosition - lastPosition;
            currentSpeed = Math.abs(deltaPosition / deltaTime); // Speed in pixels per second

            if (spinSound && !spinSound.paused) {
                const minRate = 0.5; // Slower minimum rate
                const maxRate = 2.0; // Faster maximum rate
                const speedThresholdLow = 300; // Speed below which pitch starts dropping significantly
                const speedThresholdHigh = 5000; // Speed above which pitch maxes out

                let targetRate;
                if (animationFinished) {
                    targetRate = 1.0; // Reset rate at the very end
                } else if (currentSpeed < speedThresholdLow) {
                    targetRate = minRate + (maxRate - minRate) * (currentSpeed / speedThresholdLow) * 0.4; // More noticeable drop
                } else if (currentSpeed > speedThresholdHigh) {
                    targetRate = maxRate;
                } else {
                    const speedRange = speedThresholdHigh - speedThresholdLow;
                    const progressInRange = (currentSpeed - speedThresholdLow) / speedRange;
                    targetRate = minRate + (maxRate - minRate) * (0.4 + progressInRange * 0.6); // Weighted interpolation
                }
                // Smoothly adjust playbackRate towards the targetRate
                const rateChangeFactor = 0.08; // Slightly slower adjustment
                spinSound.playbackRate = spinSound.playbackRate + (targetRate - spinSound.playbackRate) * rateChangeFactor;
                spinSound.playbackRate = Math.max(minRate, Math.min(maxRate, spinSound.playbackRate)); // Clamp rate
            }
            lastPosition = currentPosition;
            lastTimestamp = timestamp;
        }
        // --- End Sound Pitch ---

        // Continue animation or finalize
        if (!animationFinished) {
            animationFrameId = requestAnimationFrame(animateRoulette);
        } else {
            console.log("NEW Animation finished naturally in loop");
            animationFrameId = null; // Stop requesting new frames
            finalizeSpin(winningElement, winner); // Handle highlighting, sound fade, winner display etc.
        }
    }

    // Start the animation loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId); // Ensure no duplicates
    animationFrameId = requestAnimationFrame(animateRoulette);
}


// -- Finalize Spin Actions (Highlight, Sound Fade, Trigger Winner Display) - MODIFIED --
function finalizeSpin(winningElement, winner) {
     if (!isSpinning && winningElement) {
         console.log("FinalizeSpin called, but isSpinning is already false. Possibly called after reset?");
         // Ensure highlight is applied if somehow missed
         if (!winningElement.classList.contains('winner-highlight')) {
             winningElement.classList.add('winner-highlight');
             // Re-apply dynamic style if needed (though ideally shouldn't be necessary here)
         }
         return; // Don't proceed further if spin already considered ended
     }
     if (!winningElement || !winner || !winner.user) {
         console.error("Cannot finalize spin: Invalid winner element or winner data.");
         isSpinning = false; // Set state even on error
         resetToJackpotView(); // Attempt reset
         return;
     }

     console.log("Finalizing spin: Applying highlight, fading sound.");

     // --- Winner Highlighting ---
     const userColor = getUserColor(winner.user.id);
     winningElement.classList.add('winner-highlight');

     // Remove any previous dynamic style for highlighting
     const existingStyle = document.getElementById('winner-pulse-style');
     if (existingStyle) existingStyle.remove();

     // Create and append new style for the current winner's color pulse
     const style = document.createElement('style');
     style.id = 'winner-pulse-style';
     // Use regular spaces for indentation within the style string
     style.textContent = `
         .winner-highlight {
             z-index: 5;
             border-width: 3px; /* Use a noticeable border */
             border-color: ${userColor}; /* Set initial border color */
             animation: winnerPulse 1.5s infinite;
             /* Store color in CSS variable for the animation */
             --winner-color: ${userColor};
             /* Ensure the item stays scaled slightly larger */
             transform: scale(1.05);
         }
         @keyframes winnerPulse {
             0%, 100% { box-shadow: 0 0 15px var(--winner-color); transform: scale(1.05); }
             50% { box-shadow: 0 0 25px var(--winner-color); transform: scale(1.1); }
         }
     `;
     document.head.appendChild(style);
     // --- End Highlighting ---


     // --- Fade Out Audio ---
     if (spinSound && !spinSound.paused) {
         // Clear any existing fade interval before starting a new one
         if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval);

         let volume = spinSound.volume;
         const fadeOutInterval = 75; // ms between volume steps
         const volumeStep = volume / (1000 / fadeOutInterval); // Fade out over 1 second

         window.soundFadeOutInterval = setInterval(() => {
             volume -= volumeStep;
             if (volume <= 0) {
                 spinSound.pause();
                 spinSound.volume = 1.0; // Reset volume for next time
                 spinSound.playbackRate = 1.0; // Reset playback rate
                 clearInterval(window.soundFadeOutInterval);
                 window.soundFadeOutInterval = null; // Clear interval ID
                 console.log("Sound faded out.");
             } else {
                 spinSound.volume = volume;
             }
         }, fadeOutInterval);
     }
     // --- End Audio Fade ---

     // --- Trigger Winner Info Display ---
     // Use a timeout to allow highlight and sound fade to start
     setTimeout(() => {
         handleSpinEnd(winningElement, winner); // Call the function that shows winner details, confetti, etc.
     }, 300); // Shorter delay before showing winner info box
}


// -- Handle Spin End (Display Winner Info, Confetti, Reset State) - MODIFIED --
function handleSpinEnd(winningElement, winner) {
    // Note: Highlighting and sound fadeout are now started in finalizeSpin()

    if (!isSpinning && !winningElement) { // Check if spin was already reset or if elements are missing
        console.warn("handleSpinEnd called but spin seems already reset or elements missing.");
        // If resetToJackpotView was called prematurely, we might not have winner/element.
        // It's probably safest to just ensure state is false and return.
        isSpinning = false;
        return;
    }

    // Ensure animation frame is stopped (just in case)
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    console.log("Handling spin end: Displaying winner info and confetti.");

    // --- Display Winner Info Box ---
    if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
        const userColor = getUserColor(winner.user.id);

        winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
        winnerAvatar.alt = winner.user.username || 'Winner';
        winnerAvatar.style.borderColor = userColor;
        winnerAvatar.style.boxShadow = `0 0 15px ${userColor}`;

        winnerName.textContent = winner.user.username || 'Winner';
        winnerName.style.color = userColor;

        const depositValue = `${(winner.value || 0).toFixed(2)}`;
        const chanceValue = `${(winner.percentage || 0).toFixed(2)}%`;

        winnerDeposit.textContent = ''; // Clear first
        winnerChance.textContent = '';

        winnerInfo.style.display = 'flex';
        winnerInfo.style.opacity = '0'; // Start transparent for fade in

        // Animate fade-in
        let opacity = 0;
        const fadeStep = 0.05;
        // Clear previous interval if any
        if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval);
        window.winnerFadeInInterval = setInterval(() => {
            opacity += fadeStep;
            winnerInfo.style.opacity = opacity.toString();

            if (opacity >= 1) {
                clearInterval(window.winnerFadeInInterval);
                window.winnerFadeInInterval = null;

                // Typing effect
                let depositIndex = 0;
                let chanceIndex = 0;
                const typeDelay = 35; // Typing speed

                // Clear previous intervals if any
                if (window.typeDepositInterval) clearInterval(window.typeDepositInterval);
                if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);

                window.typeDepositInterval = setInterval(() => {
                    if (depositIndex < depositValue.length) {
                        winnerDeposit.textContent += depositValue[depositIndex];
                        depositIndex++;
                    } else {
                        clearInterval(window.typeDepositInterval);
                        window.typeDepositInterval = null;
                        // Start typing chance after deposit
                        window.typeChanceInterval = setInterval(() => {
                            if (chanceIndex < chanceValue.length) {
                                winnerChance.textContent += chanceValue[chanceIndex];
                                chanceIndex++;
                            } else {
                                clearInterval(window.typeChanceInterval);
                                window.typeChanceInterval = null;
                                // Launch confetti after typing finishes
                                setTimeout(() => {
                                    launchConfetti(userColor);
                                }, 200); // Short delay before confetti

                                // Set final state and schedule reset *after* everything is shown
                                isSpinning = false; // Officially stop spinning state here
                                console.log("isSpinning set to false after winner display and confetti.");
                                setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);
                            }
                        }, typeDelay);
                    }
                }, typeDelay);
            }
        }, 20); // Interval for fade-in steps

    } else {
        console.error("Winner data/elements incomplete for display in handleSpinEnd");
        isSpinning = false; // Ensure state is reset even on error
        resetToJackpotView(); // Attempt reset
    }
    // --- End Winner Info Display ---
}

// launchConfetti - (Keep original implementation)
function launchConfetti(mainColor = '#00ffaa') {
    if (!confettiContainer) return;

    clearConfetti();

    // Create a color palette based on the winning user's color
    const baseColor = mainColor;
    const complementaryColor = getComplementaryColor(baseColor);
    const lighterColor = lightenColor(baseColor, 30);
    const darkerColor = darkenColor(baseColor, 30);

    const colors = [
        baseColor,
        lighterColor,
        darkerColor,
        complementaryColor,
        '#ffffff', // White for contrast
        lightenColor(complementaryColor, 20)
    ];

    // Create more confetti with varying sizes and shapes
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        // Randomize positioning
        confetti.style.left = `${Math.random() * 100}%`;

        // Randomize the delay for more natural effect
        confetti.style.animationDelay = `${Math.random() * 1.5}s`;

        // Randomize the duration for varying fall speeds
        confetti.style.animationDuration = `${2 + Math.random() * 3}
