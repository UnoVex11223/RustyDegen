// main.js (Complete and Modified for Enhanced Roulette Animation)
// Ensure the Socket.IO client library is included in your HTML:
// <script src="/socket.io/socket.io.js"></script>
const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a.active'); // Might need adjustment if 'active' isn't default
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
const SPIN_DURATION_SECONDS = 6.5; // Total animation duration in seconds
const WINNER_DISPLAY_DURATION = 7000; // 7 seconds for winner info display
const CONFETTI_COUNT = 150; // Increased confetti slightly

// --- NEW Animation constants for enhanced roulette ---
const EASE_OUT_POWER = 2.2;       // Power for ease-out curve (e.g., 3=cubic, 4=quart). Lowered for more gradual slowdown.
const BOUNCE_ENABLED = false;     // Keep bounce disabled as requested

// Enhanced dramatic ending parameters
const DRAMATIC_ENDING_DURATION = 2.0; // Last two seconds are super engaging (as requested)
const FINAL_SLOWDOWN_FACTOR = 0.15;  // How slow it moves at the very end

// Landing variation parameters
const LANDING_VARIATIONS = [
    {type: "center", probability: 0.3, offsetRange: 0.1}, // Center landing (30% chance)
    {type: "offset", probability: 0.25, offsetRange: 0.35}, // Slightly off center (25% chance)
    {type: "onethird", probability: 0.15, offsetRange: 0.6}, // About 1/3 into the next item (15% chance)
    {type: "twothirds", probability: 0.15, offsetRange: 0.8}, // About 2/3 into the next item (15% chance)
    {type: "next", probability: 0.15, offsetRange: 1.0}  // Almost on the next item (15% chance)
];

// Advanced tension effects
const TENSION_OSCILLATIONS = true; // Enable the slight back-and-forth at end
const TENSION_FREQUENCY = 4; // Higher = more rapid oscillations
const TENSION_MAGNITUDE = 0.04; // Higher = more noticeable oscillations

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
    [homePage, faqPage, fairPage].forEach(page => { if (page) page.style.display = 'none'; });
    if (pageElement) pageElement.style.display = 'block';
    console.log('Showing page:', pageElement?.id);
    // Update active link state
    document.querySelectorAll('.main-nav a').forEach(link => link.classList.remove('active'));
    if (pageElement === homePage && homeLink) homeLink.classList.add('active');
    if (pageElement === faqPage && faqLink) faqLink.classList.add('active');
    if (pageElement === fairPage && fairLink) fairLink.classList.add('active');
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

// --- ENHANCED EASING & ANIMATION FUNCTIONS ---

/**
 * Calculates the eased progress using a custom ease-out function.
 * Enhanced for more dramatic and suspenseful slowdown
 * @param {number} t - Normalized time (0 to 1)
 * @returns {number} Eased progress (0 to 1)
 */
function easeOutAnimation(t) {
    // Using customized easing for dramatic effect
    // Clamp input time t to the range [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));

    // Start with standard power ease out
    let eased = 1 - Math.pow(1 - clampedT, EASE_OUT_POWER);

    // Add a custom curve for more dramatic slowdown at the end
    // We want the last 40% of the animation to be much slower
    if (clampedT > 0.6) {
        // In the final 40% of animation, make it even more gradual
        const finalPhaseT = (clampedT - 0.6) / 0.4; // Normalize to 0-1 for final phase

        // Custom curve that slows down dramatically
        const slowdownFactor = Math.pow(finalPhaseT, 0.6) * 0.15;
        eased = eased - slowdownFactor;
    }

    return eased;
}

/**
 * Selects a random landing variation based on defined probabilities
 * @returns {Object} The selected variation profile with type and offset range
 */
function selectLandingVariation() {
    const rand = Math.random();
    let cumulativeProbability = 0;

    for (const variation of LANDING_VARIATIONS) {
        cumulativeProbability += variation.probability;
        if (rand <= cumulativeProbability) {
            return variation;
        }
    }

    // Fallback to center if probabilities don't add up to 1
    return LANDING_VARIATIONS[0];
}

/**
 * Calculates final position with appropriate offset based on selected variation
 * @param {number} basePosition - The center position
 * @param {number} itemWidth - Width of a roulette item
 * @returns {number} The final target position with variation applied
 */
function calculateVariedPosition(basePosition, itemWidth) {
    const variation = selectLandingVariation();
    const posSign = Math.random() > 0.5 ? 1 : -1; // Randomly choose direction

    // Calculate offset amount based on the variation type
    let offsetAmount;
    switch(variation.type) {
        case "center":
            // Small variation around center
            offsetAmount = (Math.random() * 0.2 - 0.1) * itemWidth * variation.offsetRange;
            break;
        case "offset":
            // Medium variation - slightly off center
            offsetAmount = posSign * Math.random() * itemWidth * variation.offsetRange;
            break;
        case "onethird":
            // About 1/3 into the next/prev item
            offsetAmount = posSign * (itemWidth / 3) * (0.8 + Math.random() * 0.4);
            break;
        case "twothirds":
            // About 2/3 into the next/prev item
            offsetAmount = posSign * (itemWidth * 2/3) * (0.8 + Math.random() * 0.4);
            break;
        case "next":
            // Almost fully on the next/prev item
            offsetAmount = posSign * itemWidth * (0.8 + Math.random() * 0.4);
            break;
        default:
            offsetAmount = 0;
    }

    console.log(`Selected variation: ${variation.type}, offset: ${offsetAmount.toFixed(2)}px`);
    return basePosition + offsetAmount;
}

/**
 * Applies tension effects (oscillation) during the dramatic ending
 * @param {number} progress - Progress through the dramatic phase (0-1)
 * @param {number} totalDistance - Total animation distance
 * @returns {number} The tension offset to apply
 */
function calculateTensionEffect(progress, totalDistance) {
    if (!TENSION_OSCILLATIONS) return 0;

    // Create a decaying oscillation effect
    const decayFactor = Math.pow(1 - progress, 1.2); // Decay accelerates toward end
    const oscillation = Math.sin(progress * Math.PI * TENSION_FREQUENCY) * decayFactor;

    // Scale the effect
    return oscillation * totalDistance * TENSION_MAGNITUDE;
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

    // Test Spin Button (If you have one)
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) testSpinButton.addEventListener('click', testRouletteAnimation);

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
        itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><div class="item-details"><div class="item-name" title="${item.name}">${item.name}</div><div class="item-value">$${item.price.toFixed(2)}</div></div>`;
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
    selectedElement.innerHTML = `<button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button><img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><div class="selected-item-details"><div class="selected-item-value">$${item.price.toFixed(2)}</div></div>`;
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
    totalValue.textContent = `$${total.toFixed(2)}`;
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
        showNotification('Success', 'Trade URL saved.');
    } catch (error) { showNotification('Error Saving URL', error.message); console.error('Error updating trade URL:', error); }
    finally { saveTradeUrl.disabled = false; saveTradeUrl.textContent = 'Save Trade URL'; }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound || !potValue) return;
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;
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

// Handle new deposit
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || data.itemsValue === undefined || data.totalValue === undefined) { console.error("Invalid participant update:", data); return; }
    if (!currentRound) { console.warn("Deposit for non-existent round."); currentRound = { roundId: data.roundId, status: 'active', timeLeft: 120, totalValue: 0, participants: [], items: [] }; }
    else if (currentRound.roundId !== data.roundId) { console.warn(`Deposit for wrong round (${data.roundId}). Current is ${currentRound.roundId}`); return; }

    if (!currentRound.participants) currentRound.participants = [];
    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user && p.user.id === data.userId) {
            participantFound = true;
            // Update existing participant
            return { ...p, itemsValue: (p.itemsValue || 0) + data.itemsValue, tickets: data.tickets };
        }
        return p;
    });

    if (!participantFound) {
        // Add new participant
        currentRound.participants.push({
            user: { id: data.userId, username: data.username || 'Unknown', avatar: data.avatar || '/img/default-avatar.png' },
            itemsValue: data.itemsValue,
            tickets: data.tickets
        });
    }

    currentRound.totalValue = data.totalValue;

    // Add deposited items to the round's item list
    if (data.depositedItems && Array.isArray(data.depositedItems)) {
        if (!currentRound.items) currentRound.items = [];
        data.depositedItems.forEach(item => currentRound.items.push({ ...item, owner: data.userId }));
    }

    updateRoundUI(); // Update pot value, participants display

    // Start timer only if exactly 2 participants and timer isn't already active
    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached (>= 2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120); // Use timeLeft from server if available
    }
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
    const radius = timerForeground.r.baseVal.value; // Get radius from SVG element
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(1, Math.max(0, timeLeft / totalTime));
    const offset = circumference * (1 - progress);
    timerForeground.style.strokeDasharray = `${circumference}`;
    timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`;
}

// Update participants UI
function updateParticipantsUI() {
    if (!participantsContainer || !participantCount || !emptyPotMessage) { console.error("Participants UI elements missing."); return; }
    const participants = currentRound?.participants || []; const totalPotValue = currentRound?.totalValue || 0;
    participantCount.textContent = `${participants.length}/200`; participantsContainer.innerHTML = '';
    if (participants.length === 0) {
        emptyPotMessage.style.display = 'block';
        // Ensure the message element is actually appended if it wasn't already
        if (!participantsContainer.contains(emptyPotMessage)) {
             participantsContainer.appendChild(emptyPotMessage);
        }
        return;
    } else { emptyPotMessage.style.display = 'none'; }
    // Sort participants by value descending
    participants.sort((a, b) => (b.itemsValue || 0) - (a.itemsValue || 0));
    participants.forEach(participant => {
        const userItems = currentRound?.items?.filter(item => item.owner && participant.user && item.owner.toString() === participant.user.id.toString()) || [];
        const participantElement = createParticipantElement(participant, userItems, totalPotValue); participantsContainer.appendChild(participantElement);
    });
}

// Create participant element
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
                    <span class="participant-value" title="Deposited Value" style="color: ${userColor}">$${participant.itemsValue.toFixed(2)}</span>
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
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            // Add user color to item border
            itemElement.style.borderColor = userColor;
            itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><span class="item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</span>`;
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

    console.log('Starting ENHANCED animation for Winner:', winner.user.username);

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
            if (items[i]?.dataset?.userId === winner.user.id) {
                winnerItemsIndices.push(i);
            }
        }

        // If no matching items in preferred range, expand search to the entire track
        if (winnerItemsIndices.length === 0) {
            console.warn(`No winner items found in preferred range [${minIndex}-${maxIndex}]. Expanding search.`);
            for (let i = 0; i < items.length; i++) {
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
        }

        console.log(`Selected winning element at index ${targetIndex} of ${items.length} total items`);
        // --- End Target Selection Logic ---

        // Call the animation handler
        handleRouletteSpinAnimation(winningElement, winner);

    }, 150); // Delay to ensure DOM is ready for measurements
}

// -- Handle the animation loop - COMPLETELY MODIFIED for more engaging and varied ending --
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

    // --- Position Calculation with ENHANCED variation ---
    const containerWidth = container.offsetWidth;
    const itemWidth = winningElement.offsetWidth || 90; // Use measured width or fallback
    const itemOffsetLeft = winningElement.offsetLeft;

    // Calculate the base center position (center of container aligns with center of item)
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    const basePosition = -(itemOffsetLeft - centerOffset);

    // Apply the varied landing position algorithm for more unpredictable endings
    const finalTargetPosition = calculateVariedPosition(basePosition, itemWidth);

    // --- Animation Time Calculation ---
    const mainDuration = (SPIN_DURATION_SECONDS - DRAMATIC_ENDING_DURATION) * 1000; // Main movement phase
    const dramaticDuration = DRAMATIC_ENDING_DURATION * 1000; // Super engaging ending phase
    const totalAnimationTime = mainDuration + dramaticDuration;

    // Starting position and parameters
    const startPosition = 0;
    const totalDistance = finalTargetPosition - startPosition;
    let startTime = performance.now();
    let currentSpeed = 0;
    let lastPosition = startPosition;
    let lastTimestamp = startTime;

    // Ensure track has no transition interfering
    rouletteTrack.style.transition = 'none';

    // --- ENHANCED Animation Loop ---
    function animateRoulette(timestamp) {
        if (!isSpinning) {
            console.log("Animation loop stopped because isSpinning is false.");
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return;
        }

        const elapsed = timestamp - startTime;
        let currentPosition;
        let animationFinished = false;

        // --- Main Movement Phase (first ~4.5 seconds) ---
        if (elapsed <= mainDuration) {
            const animationPhaseProgress = elapsed / mainDuration; // Progress 0 to 1
            const easedProgress = easeOutAnimation(animationPhaseProgress);

            // Use eased progress for smooth movement
            currentPosition = startPosition + totalDistance * easedProgress;
        }
        // --- Dramatic Ending Phase (last 2 seconds) ---
        else if (elapsed <= totalAnimationTime) {
            // Calculate progress through the dramatic phase
            const dramaticPhaseProgress = (elapsed - mainDuration) / dramaticDuration;

            // Start from near-final position (90-95% of the way there)
            // The remaining 5-10% of movement happens during the dramatic phase
            const baseProgress = Math.min(1, 0.95 + (dramaticPhaseProgress * 0.05));

            // Calculate the slow-motion movement with custom easing
            // This creates a very gradual approach to the final position
            const slowEase = 1 - Math.pow(1 - dramaticPhaseProgress, 3); // Cubic ease-in for final approach
            const basePos = startPosition + totalDistance * (0.95 + (slowEase * 0.05));

            // Add tension effect (subtle oscillation) if enabled
            const tensionOffset = calculateTensionEffect(dramaticPhaseProgress, totalDistance);
            currentPosition = basePos + tensionOffset;

            // Finish when we reach the end of dramatic phase
            if (dramaticPhaseProgress >= 0.99) {
                animationFinished = true;
                currentPosition = finalTargetPosition; // Ensure exact final position
            }
        }
        // --- Animation End ---
        else {
            currentPosition = finalTargetPosition; // Ensure it lands exactly at the end
            animationFinished = true;
        }

        // Apply the transform
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;

        // --- Sound Pitch / Speed Calculation ---
        const deltaTime = (timestamp - lastTimestamp) / 1000; // Time diff in seconds
        if (deltaTime > 0.001) { // Avoid calculations on near-zero delta times
             const deltaPosition = Math.abs(currentPosition - lastPosition);
             currentSpeed = deltaPosition / deltaTime; // Speed in pixels per second

             if (spinSound && !spinSound.paused) {
                 const minRate = 0.3; // Even lower minimum rate for more dramatic slowdown
                 const maxRate = 2.0; // Keep same max rate
                 const speedThresholdLow = 100; // Lower threshold for even slower pitch at end
                 const speedThresholdHigh = 5000; // Keep same max threshold

                 let targetRate;
                 if (animationFinished) {
                      targetRate = 1.0; // Reset rate at the very end
                 } else if (elapsed > mainDuration) {
                     // In dramatic phase, pitch should be very low and pulsing based on any tension effects
                     // This makes the sound match the visual tension
                     const dramaticPhaseProgress = (elapsed - mainDuration) / dramaticDuration;
                     const tensionPulse = Math.sin(elapsed * 0.01) * 0.05; // Subtle pulse

                     // Very low rate during dramatic ending that gets even lower as it approaches the end
                     targetRate = minRate + 0.1 * (1 - dramaticPhaseProgress) + tensionPulse;
                 } else if (currentSpeed < speedThresholdLow) {
                     // More gradual rate change at low speeds for tension
                     const speedRatio = currentSpeed / speedThresholdLow;
                     targetRate = minRate + (speedRatio * 0.3); // Very gradual change
                 } else if (currentSpeed > speedThresholdHigh) {
                     targetRate = maxRate;
                 } else {
                     const speedRange = speedThresholdHigh - speedThresholdLow;
                     const progressInRange = (currentSpeed - speedThresholdLow) / speedRange;
                     targetRate = minRate + (maxRate - minRate) * (0.3 + progressInRange * 0.7);
                 }

                 // More sensitive rate adjustment during dramatic phase for smoother sound changes
                 const rateChangeFactor = elapsed > mainDuration ? 0.15 : 0.08;
                 spinSound.playbackRate = spinSound.playbackRate + (targetRate - spinSound.playbackRate) * rateChangeFactor;
                 spinSound.playbackRate = Math.max(minRate, Math.min(maxRate, spinSound.playbackRate));

                 // Adjust volume slightly during dramatic phase for tension
                 if (elapsed > mainDuration) {
                      const dramaticPhaseProgress = (elapsed - mainDuration) / dramaticDuration;
                      // Reduce volume slightly as it approaches final position
                      spinSound.volume = Math.max(0.5, 0.8 - (dramaticPhaseProgress * 0.2));
                 }
             }
             lastPosition = currentPosition;
             lastTimestamp = timestamp;
        }
        // --- End Sound Pitch ---

        // Continue animation or finalize
        if (!animationFinished) {
            animationFrameId = requestAnimationFrame(animateRoulette);
        } else {
            console.log("Enhanced dramatic animation finished!");
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

        const depositValue = `$${(winner.value || 0).toFixed(2)}`;
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
    confetti.style.animationDuration = `${2 + Math.random() * 3}s`;

    // Randomize the color from our palette
    const color = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.backgroundColor = color;

    // Randomize size
    const size = Math.random() * 10 + 5; // 5-15px
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size}px`;

    // Randomize shape and rotation
    const rotation = Math.random() * 360;
    const fallX = (Math.random() - 0.5) * 100; // Horizontal movement
    confetti.style.setProperty('--fall-x', `${fallX}px`);
    confetti.style.setProperty('--rotation-start', `${rotation}deg`);
    confetti.style.setProperty('--rotation-end', `${rotation + (Math.random() - 0.5) * 720}deg`); // Add random spin

    const shape = Math.random();
    if (shape < 0.33) {
      confetti.style.borderRadius = '50%'; // Circle
    } else if (shape < 0.66) {
      confetti.style.borderRadius = '0'; // Square (will rotate)
    } else {
       // Keep some squares/rectangles, maybe add clip-path later if needed
       confetti.style.borderRadius = '0';
    }

    confettiContainer.appendChild(confetti);
  }
}

// Helper function for confetti color generation
function getComplementaryColor(hexColor) {
    try {
        if (hexColor.startsWith('#')) {
            hexColor = hexColor.slice(1);
        }
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        const compR = (255 - r).toString(16).padStart(2, '0');
        const compG = (255 - g).toString(16).padStart(2, '0');
        const compB = (255 - b).toString(16).padStart(2, '0');
        return `#${compR}${compG}${compB}`;
    } catch (e) {
        console.error("Error getting complementary color:", e);
        return '#cccccc'; // Fallback
    }
}

// Helper function for confetti color generation
function lightenColor(hexColor, percent) {
    try {
        if (hexColor.startsWith('#')) {
            hexColor = hexColor.slice(1);
        }
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);

        const newR = Math.min(255, r + Math.round(255 * (percent / 100))).toString(16).padStart(2, '0');
        const newG = Math.min(255, g + Math.round(255 * (percent / 100))).toString(16).padStart(2, '0');
        const newB = Math.min(255, b + Math.round(255 * (percent / 100))).toString(16).padStart(2, '0');
        return `#${newR}${newG}${newB}`;
    } catch (e) {
        console.error("Error lightening color:", e);
        return hexColor; // Fallback
    }
}
// Helper function for confetti color generation
function darkenColor(hexColor, percent) {
    try {
        if (hexColor.startsWith('#')) {
            hexColor = hexColor.slice(1);
        }
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);

        const newR = Math.max(0, r - Math.round(255 * (percent / 100))).toString(16).padStart(2, '0');
        const newG = Math.max(0, g - Math.round(255 * (percent / 100))).toString(16).padStart(2, '0');
        const newB = Math.max(0, b - Math.round(255 * (percent / 100))).toString(16).padStart(2, '0');
        return `#${newR}${newG}${newB}`;
    } catch (e) {
        console.error("Error darkening color:", e);
        return hexColor; // Fallback
    }
}


// clearConfetti - (Keep original implementation)
function clearConfetti() {
    if (confettiContainer) {
        confettiContainer.innerHTML = '';
    }
     // Also clear any dynamic winner pulse style
     const winnerPulseStyle = document.getElementById('winner-pulse-style');
     if (winnerPulseStyle) {
         winnerPulseStyle.remove();
     }
     // Remove highlight class from any items
     document.querySelectorAll('.roulette-item.winner-highlight').forEach(el => {
         el.classList.remove('winner-highlight');
         el.style.transform = ''; // Reset any transform applied by highlight
         el.style.borderColor = getUserColor(el.dataset.userId); // Reset border to base user color
     });
}

// resetToJackpotView - (Keep original implementation, it already cancels animationFrameId)
function resetToJackpotView() {
    console.log("Resetting to jackpot view");

    // Cancel any ongoing animation frame FIRST
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Animation frame cancelled by resetToJackpotView.");
    }
    // Also clear any pending timeouts or intervals related to animation phases
    if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval);
    if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval);
    if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval);
    if (window.typeDepositInterval) clearInterval(window.typeDepositInterval);
    if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);


    isSpinning = false; // Ensure state is false

    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) {
        console.error("Missing elements required for resetToJackpotView.");
        return;
    }

    // Stop sound immediately if playing
    if (spinSound && !spinSound.paused) {
        spinSound.pause();
        spinSound.currentTime = 0;
        spinSound.volume = 1.0; // Reset volume
        spinSound.playbackRate = 1.0; // Reset rate
    }

    // Fade out roulette first
    inlineRoulette.style.transition = 'opacity 0.5s ease';
    inlineRoulette.style.opacity = '0';
    clearConfetti(); // Clear confetti and highlights immediately

    // After roulette fades out, reset everything
    setTimeout(() => {
        // Return header to normal state
        jackpotHeader.classList.remove('roulette-mode');

        // Reset roulette track visuals and clear content
        rouletteTrack.style.transition = 'none'; // IMPORTANT: Remove transition before resetting transform
        rouletteTrack.style.transform = 'translateX(0)';
        rouletteTrack.innerHTML = ''; // Clear items

        // Hide roulette and winner info containers
        inlineRoulette.style.display = 'none';
        winnerInfo.style.display = 'none';

        // Show jackpot UI elements with fade-in
        const value = jackpotHeader.querySelector('.jackpot-value');
        const timer = jackpotHeader.querySelector('.jackpot-timer');
        const stats = jackpotHeader.querySelector('.jackpot-stats');

        [value, timer, stats].forEach((el, index) => {
            if (el) {
                el.style.display = 'flex'; // Or 'block' depending on original style
                el.style.opacity = '0'; // Start transparent
                // Stagger fade-in slightly
                setTimeout(() => {
                    el.style.transition = 'opacity 0.5s ease';
                    el.style.opacity = '1';
                }, 50 + index * 50); // 50ms stagger
            }
        });


        // Reset state variables
        // isSpinning = false; // Already set at the beginning
        timerActive = false;
        spinStartTime = 0;

        if (roundTimer) {
            clearInterval(roundTimer);
            roundTimer = null;
        }

        // Reset UI for next round values (timer, pot, participants)
        initiateNewRoundVisualReset();

        // Get the latest round data in case a new one started during animation
        console.log("Requesting fresh round data after reset.");
        socket.emit('requestRoundData');
    }, 500); // Wait for fade out transition to complete
}

// initiateNewRoundVisualReset - (Keep original implementation)
function initiateNewRoundVisualReset() {
    console.log("Visual reset for next round");
    updateTimerUI(120); // Reset timer display to default

    if(timerValue) {
        timerValue.classList.remove('urgent-pulse', 'timer-pulse');
        timerValue.textContent = '120'; // Or whatever default start time is
    }

    if (participantsContainer && emptyPotMessage) {
        participantsContainer.innerHTML = ''; // Clear participants display
        // Ensure empty message exists and is shown
        if (!participantsContainer.contains(emptyPotMessage)) {
             participantsContainer.appendChild(emptyPotMessage);
        }
        emptyPotMessage.style.display = 'block';
    }

    if (potValue) potValue.textContent = "$0.00";
    if (participantCount) participantCount.textContent = "0/200"; // Reset participant count display
}

// findWinnerFromData - (Keep original implementation)
function findWinnerFromData(winnerData) {
    // Check if winner data is directly provided or needs lookup in currentRound
    const winnerId = winnerData?.winner?.id;

    if (!winnerId) {
        console.error("Missing winner ID in findWinnerFromData input:", winnerData);
        return null;
    }

    if (!currentRound || !currentRound.participants) {
        console.error("Missing currentRound or participants data for findWinnerFromData.");
        // Fallback: return basic winner info if available in input
        if (winnerData.winner) {
            return {
                user: { ...winnerData.winner }, // Clone user data
                percentage: 0, // Cannot calculate without full round data
                value: 0
            };
        }
        return null;
    }

    const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winnerId);

    if (!winnerParticipant) {
        console.warn(`Winner ID ${winnerId} not found in local participants list.`);
        // Fallback: return basic winner info if available in input
         if (winnerData.winner) {
             return {
                 user: { ...winnerData.winner },
                 percentage: 0,
                 value: 0
             };
        }
        return null;
    }

    const totalValue = currentRound.totalValue > 0 ? currentRound.totalValue : 1; // Avoid division by zero
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;

    return {
        user: { ...winnerParticipant.user }, // Return a clone of the user object
        percentage: percentage || 0,
        value: winnerParticipant.itemsValue || 0
    };
}


// testRouletteAnimation - (Keep original implementation)
function testRouletteAnimation() {
  console.log("--- TESTING ENHANCED ROULETTE ANIMATION ---");

  if (isSpinning) {
    console.log("Already spinning, test cancelled.");
    return;
  }

  // Use current round if available and has participants, otherwise mock data
  let testData = currentRound;
  if (!testData || !testData.participants || testData.participants.length === 0) {
    console.log('Using sample test data for animation...');
    testData = {
      roundId: `test-${Date.now()}`,
      status: 'active', // Ensure status allows spinning
      totalValue: 194.66,
      participants: [
        { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
        { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
        { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
        { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 }
      ],
      items: [ // Add some mock items for display
         { owner: 'test_user_1', name: 'AK-47 | Redline', price: 15.50, image: '/img/default-item.png' },
         { owner: 'test_user_1', name: 'AWP | Asiimov', price: 70.19, image: '/img/default-item.png' },
         { owner: 'test_user_2', name: 'Glock-18 | Water Elem...', price: 1.39, image: '/img/default-item.png' },
         { owner: 'test_user_3', name: 'USP-S | Cortex', price: 1.04, image: '/img/default-item.png' },
      ]
    };
    // Temporarily set currentRound for the test if using mock data
    currentRound = testData;
    updateParticipantsUI(); // Update UI with mock participants
  }

  if (!testData.participants || testData.participants.length === 0) {
    showNotification('Test Error', 'No participants available for test spin.');
    return;
  }

  // Select random winner from the available participants
  const idx = Math.floor(Math.random() * testData.participants.length);
  const winningParticipant = testData.participants[idx];
  const mockWinnerData = {
    roundId: testData.roundId,
    winner: winningParticipant.user, // Pass the user object
    winningTicket: Math.floor(Math.random() * (winningParticipant.tickets || 1)) + 1 // Example ticket number
  };

  console.log('Test Winner Selected:', mockWinnerData.winner.username);
  // Use the same function the socket event uses
  handleWinnerAnnouncement(mockWinnerData);
}


// =================== PROVABLY FAIR ===================
// (Keep all original Provably Fair functions: verifyRound, loadPastRounds, populateVerificationFields, createPagination)

async function verifyRound() {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed'), resultEl = document.getElementById('verification-result');
    if (!idInput || !sSeedInput || !cSeedInput || !resultEl) { console.error("Verify form elements missing."); return; }
    const roundId = idInput.value.trim(), serverSeed = sSeedInput.value.trim(), clientSeed = cSeedInput.value.trim();
    if (!roundId || !serverSeed || !clientSeed) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Please fill in all fields.</p>'; return; }
    // Basic server seed format validation (SHA256 hex string)
    if (serverSeed.length !== 64 || !/^[a-f0-9]{64}$/i.test(serverSeed)) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Invalid Server Seed format (should be 64 hex characters).</p>'; return; }
    try {
        resultEl.style.display = 'block'; resultEl.className = 'verification-result loading'; resultEl.innerHTML = '<p>Verifying...</p>';
        const response = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId, serverSeed, clientSeed }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || `Verify fail (${response.status})`);
        resultEl.className = `verification-result ${result.verified ? 'success' : 'error'}`; let html = `<h4>Result (Round #${result.roundId || roundId})</h4>`;
        if (result.verified) { html += `<p style="color: var(--success-color); font-weight: bold;">✅ Verified Fair.</p><p><strong>Server Seed Hash:</strong> ${result.serverSeedHash || 'N/A'}</p><p><strong>Server Seed:</strong> ${result.serverSeed}</p><p><strong>Client Seed:</strong> ${result.clientSeed}</p><p><strong>Combined:</strong> ${result.combinedString || 'N/A'}</p><p><strong>Result Hash:</strong> ${result.finalHash || 'N/A'}</p><p><strong>Winning Ticket:</strong> ${result.winningTicket ?? 'N/A'}</p><p><strong>Winner:</strong> ${result.winnerUsername || 'N/A'}</p>`; }
        else { html += `<p style="color: var(--error-color); font-weight: bold;">❌ Verification Failed.</p><p><strong>Reason:</strong> ${result.reason || 'Mismatch.'}</p>${result.serverSeedHash ? `<p><strong>Server Seed Hash:</strong> ${result.serverSeedHash}</p>` : ''}${result.serverSeed ? `<p><strong>Provided Server Seed:</strong> ${result.serverSeed}</p>` : ''}${result.clientSeed ? `<p><strong>Provided Client Seed:</strong> ${result.clientSeed}</p>` : ''}${result.winningTicket !== undefined ? `<p><strong>Calculated Ticket:</strong> ${result.winningTicket}</p>` : ''}${result.actualWinningTicket !== undefined ? `<p><strong>Actual Ticket:</strong> ${result.actualWinningTicket}</p>` : ''}${result.winnerUsername ? `<p><strong>Actual Winner:</strong> ${result.winnerUsername}</p>` : ''}`; }
        resultEl.innerHTML = html;
    } catch (error) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = `<p>Error: ${error.message}</p>`; console.error('Error verifying:', error); }
}

async function loadPastRounds(page = 1) {
    if (!roundsTableBody || !roundsPagination) { console.warn("Rounds history elements missing."); return; }
    try {
        roundsTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading...</td></tr>'; roundsPagination.innerHTML = '';
        const response = await fetch(`/api/rounds?page=${page}&limit=10`); if (!response.ok) throw new Error(`Load fail (${response.status})`);
        const data = await response.json(); if (!data || !Array.isArray(data.rounds) || typeof data.currentPage !== 'number' || typeof data.totalPages !== 'number') throw new Error('Invalid rounds data.');
        roundsTableBody.innerHTML = '';
        if (data.rounds.length === 0 && data.currentPage === 1) roundsTableBody.innerHTML = '<tr><td colspan="5" class="no-rounds-message">No rounds found.</td></tr>';
        else if (data.rounds.length === 0 && data.currentPage > 1) roundsTableBody.innerHTML = '<tr><td colspan="5" class="no-rounds-message">No rounds on this page.</td></tr>';
        else data.rounds.forEach(round => {
            const row = document.createElement('tr'); let date = 'N/A'; if (round.endTime) try { const d = new Date(round.endTime); if (!isNaN(d.getTime())) date = d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { console.error("Date format error:", e); }
             // Ensure seeds are strings for the onclick attribute
             const serverSeedStr = round.serverSeed || '';
             const clientSeedStr = round.clientSeed || '';
             row.innerHTML = `<td>#${round.roundId||'N/A'}</td><td>${date}</td><td>$${round.totalValue?round.totalValue.toFixed(2):'0.00'}</td><td>${round.winner?(round.winner.username||'N/A'):'N/A'}</td><td><button class="btn btn-details" onclick="showRoundDetails(${round.roundId})">Details</button><button class="btn btn-verify" onclick="populateVerificationFields(${round.roundId}, '${serverSeedStr}', '${clientSeedStr}')" ${!round.serverSeed ? 'disabled title="Seed not revealed yet"' : ''}>Verify</button></td>`;
            row.dataset.roundId = round.roundId; roundsTableBody.appendChild(row);
        });
        createPagination(data.currentPage, data.totalPages);
    } catch (error) { roundsTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading rounds: ${error.message}</td></tr>`; console.error('Error loading rounds:', error); }
}

function populateVerificationFields(roundId, serverSeed, clientSeed) {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed');
    if (idInput) idInput.value = roundId || '';
    if (sSeedInput) sSeedInput.value = serverSeed || ''; // Populate server seed if available
    if (cSeedInput) cSeedInput.value = clientSeed || ''; // Populate client seed if available

    const verificationSection = document.getElementById('provably-fair-verification');
    if (verificationSection) {
         verificationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Provide feedback if server seed isn't populated yet
    if (!serverSeed && roundId) {
        showNotification('Info', `Server Seed for Round #${roundId} is revealed after the round ends.`);
    }
}

function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return; roundsPagination.innerHTML = ''; if (totalPages <= 1) return;
    const maxPagesToShow = 5; // Example: Prev 1 ... 4 5 6 ... 10 Next

    const createButton = (text, page, isActive = false, isDisabled = false, isEllipsis = false) => {
        if (isEllipsis) { const span = document.createElement('span'); span.className = 'page-ellipsis'; span.textContent = '...'; return span; }
        const button = document.createElement('button'); button.className = `page-button ${isActive ? 'active' : ''}`; button.textContent = text; button.disabled = isDisabled;
        if (!isDisabled && typeof page === 'number') { button.addEventListener('click', (e) => { e.preventDefault(); loadPastRounds(page); }); }
        return button;
    };

    // Prev Button
    roundsPagination.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));

    if (totalPages <= maxPagesToShow) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) { roundsPagination.appendChild(createButton(i, i, i === currentPage)); }
    } else {
        // Show ellipsis logic
        const pages = [];
        pages.push(1); // Always show first page

        const rangeStart = Math.max(2, currentPage - 1);
        const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

        if (rangeStart > 2) pages.push('...'); // Ellipsis after page 1

        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }

        if (rangeEnd < totalPages - 1) pages.push('...'); // Ellipsis before last page

        pages.push(totalPages); // Always show last page

        // Render buttons
        pages.forEach(page => {
            if (page === '...') roundsPagination.appendChild(createButton('...', null, false, true, true));
            else roundsPagination.appendChild(createButton(page, page, page === currentPage));
        });
    }

    // Next Button
    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
