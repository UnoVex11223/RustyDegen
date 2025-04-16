// main.js (Complete and Modified for Enhanced Roulette Animation and Item Deposit)
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
    socket.on('connect', () => {
        console.log('Connected to server.');
        socket.emit('requestRoundData'); // Request current round data
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
    });

    socket.on('newDeposit', (data) => {
        console.log('New deposit received:', data);
        handleNewDeposit(data);
    });

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        handleWinnerAnnouncement(data);
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
        // showModal(depositModal); // Don't automatically show, let the click handler decide
        // loadUserInventory(); // Load inventory when deposit modal is shown by click handler
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

// Create participant element - UPDATED for RustyPot style
function createParticipantElement(participant, items, totalPotValue) {
    if (!participant || !participant.user || typeof participant.itemsValue !== 'number') { console.error("Invalid participant data:", participant); const el = document.createElement('div'); el.textContent = "Err"; return el; }
    
    // Create player deposit container
    const playerDepositContainer = document.createElement('div');
    playerDepositContainer.className = 'player-deposit-container';
    playerDepositContainer.dataset.userId = participant.user.id;
    
    const percentage = totalPotValue > 0 ? ((participant.itemsValue / totalPotValue) * 100) : 0;
    const username = participant.user.username || 'Unknown';
    const avatar = participant.user.avatar || '/img/default-avatar.png';

    // Get consistent color for this user
    const userColor = getUserColor(participant.user.id);

    // Create player header with avatar and info
    const headerElement = document.createElement('div');
    headerElement.className = 'player-deposit-header';
    
    headerElement.innerHTML = `
        <img src="${avatar}" alt="${username}" class="player-avatar" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor}">
        <div class="player-info">
            <div class="player-name" title="${username}">${username}</div>
            <div class="player-deposit-value" style="color: ${userColor}">$${participant.itemsValue.toFixed(2)} (${percentage.toFixed(2)}%)</div>
        </div>`;

    // Create grid for player's items
    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';
    
    if (items && items.length > 0) {
        items.sort((a, b) => (b.price || 0) - (a.price || 0)); // Sort items by price desc
        items.forEach(item => {
            if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</div>
                </div>`;
            
            itemsGrid.appendChild(itemElement);
        });
    }
    
    // Assemble the complete player deposit container
    playerDepositContainer.appendChild(headerElement);
    playerDepositContainer.appendChild(itemsGrid);
    
    // Add animation class for new deposits
    playerDepositContainer.classList.add('player-deposit-new');
    
    return playerDepositContainer;
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
                <img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';">
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

        // Get the container and item dimensions
        const container = inlineRoulette.querySelector('.roulette-container');
        const containerWidth = container?.offsetWidth || 1000; // Fallback width
        const itemWidth = winningElement.offsetWidth || 90; // Fallback to 90px if not measurable
        const itemMargin = 10; // 5px left + 5px right
        const itemWidthWithMargin = itemWidth + itemMargin;

        // Calculate the center position of the container
        const containerCenter = containerWidth / 2;

        // Calculate the current position of the winning element
        const trackRect = rouletteTrack.getBoundingClientRect();
        const winningElementRect = winningElement.getBoundingClientRect();
        const currentWinningElementCenter = winningElementRect.left + (winningElementRect.width / 2) - trackRect.left;

        // Calculate the distance to move the track so the winning element is centered
        let distanceToMove = containerCenter - currentWinningElementCenter;

        // Add variation to the landing position for more natural feel
        // This makes it not always land perfectly centered
        const variation = (Math.random() * 2 - 1) * LANDING_POSITION_VARIATION * itemWidth;
        distanceToMove += variation;

        // Calculate total animation distance (initial fast movement + precise landing)
        // We want to move a significant distance to create the illusion of a long spin
        const initialDistance = -containerWidth * 15; // Move 15 viewport widths (negative = move left)
        const totalDistance = initialDistance + distanceToMove;

        // Start the animation
        animateRoulette(totalDistance, SPIN_DURATION_SECONDS * 1000, winningElement, winner);

    }, 100); // Short delay to ensure DOM is ready
}

// Find winner from data
function findWinnerFromData(winnerData) {
    if (!winnerData || !winnerData.winner || !winnerData.winner.id || !currentRound) {
        console.error("Invalid winner data or missing current round.");
        return null;
    }

    const winnerId = winnerData.winner.id;
    
    // First try to find the winner in the participants array
    if (currentRound.participants) {
        const winnerFromParticipants = currentRound.participants.find(p => p.user && p.user.id === winnerId);
        if (winnerFromParticipants) return winnerFromParticipants;
    }

    // If not found, construct a winner object from the winner data
    return {
        user: {
            id: winnerId,
            username: winnerData.winner.username || 'Unknown',
            avatar: winnerData.winner.avatar || '/img/default-avatar.png'
        },
        itemsValue: winnerData.winner.itemsValue || 0,
        tickets: winnerData.winner.tickets || 0
    };
}

// Animate the roulette with enhanced physics
function animateRoulette(totalDistance, duration, winningElement, winner) {
    if (!rouletteTrack) {
        console.error("Roulette track element missing.");
        isSpinning = false;
        return;
    }

    // Start time of the animation
    spinStartTime = performance.now();
    const startPosition = 0; // Starting from 0 (initial position)
    const endPosition = totalDistance; // Target position

    // Animation function using requestAnimationFrame
    function animate(currentTime) {
        // Calculate elapsed time
        const elapsedTime = currentTime - spinStartTime;
        
        // Calculate progress (0 to 1)
        const rawProgress = Math.min(elapsedTime / duration, 1);
        
        // Apply easing function for smooth deceleration
        const easedProgress = easeOutAnimation(rawProgress);
        
        // Calculate current position
        let currentPosition = startPosition + (endPosition - startPosition) * easedProgress;
        
        // Apply bounce effect if enabled and in the final phase
        if (rawProgress === 1 && BOUNCE_ENABLED) {
            // Start bounce animation
            const bounceStartTime = currentTime;
            
            function animateBounce(bounceTime) {
                const bounceElapsed = bounceTime - bounceStartTime;
                const bounceDuration = 1000; // 1 second for bounce effect
                const bounceProgress = Math.min(bounceElapsed / bounceDuration, 1);
                
                // Calculate bounce displacement
                const bounceDisplacement = calculateBounce(bounceProgress) * BOUNCE_OVERSHOOT_FACTOR * (endPosition - startPosition);
                
                // Apply bounce to position
                const bouncePosition = endPosition + bounceDisplacement;
                
                // Update track position
                rouletteTrack.style.transform = `translateX(${bouncePosition}px)`;
                
                // Continue bounce animation until complete
                if (bounceProgress < 1) {
                    animationFrameId = requestAnimationFrame(animateBounce);
                } else {
                    // Bounce complete, show winner
                    showWinner(winningElement, winner);
                }
            }
            
            // Start bounce animation
            animationFrameId = requestAnimationFrame(animateBounce);
            return;
        }
        
        // Update track position
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;
        
        // Adjust sound effects based on progress
        if (spinSound) {
            // Gradually slow down playback rate as we approach the end
            if (rawProgress > 0.5) {
                const playbackProgress = (1 - rawProgress) * 2; // 1 to 0 in the second half
                spinSound.playbackRate = 0.5 + (playbackProgress * 0.5); // Slow down from 1.0 to 0.5
                
                // Also fade out volume near the very end
                if (rawProgress > 0.9) {
                    const volumeFadeProgress = (1 - rawProgress) * 10; // 1 to 0 in the last 10%
                    spinSound.volume = Math.max(0, volumeFadeProgress * 0.8); // Fade from 0.8 to 0
                }
            }
        }
        
        // Continue animation if not complete
        if (rawProgress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Animation complete, show winner (if not using bounce)
            if (!BOUNCE_ENABLED) {
                showWinner(winningElement, winner);
            }
        }
    }
    
    // Start the animation
    animationFrameId = requestAnimationFrame(animate);
}

// Show winner after animation completes
function showWinner(winningElement, winner) {
    if (!winningElement || !winner || !winner.user) {
        console.error("Invalid winning element or winner data.");
        resetToJackpotView();
        return;
    }

    // Highlight the winning element
    winningElement.classList.add('winner-highlight');
    
    // Get user color for winner
    const userColor = getUserColor(winner.user.id);
    
    // Create dynamic keyframes for winner pulse animation
    const keyframeStyle = document.createElement('style');
    keyframeStyle.textContent = `
        @keyframes winnerPulse {
            0% { box-shadow: 0 0 5px ${userColor}; border-color: ${userColor}; }
            50% { box-shadow: 0 0 20px ${userColor}, 0 0 30px ${userColor}; border-color: ${lightenColor(userColor, 30)}; }
            100% { box-shadow: 0 0 5px ${userColor}; border-color: ${userColor}; }
        }
    `;
    document.head.appendChild(keyframeStyle);
    
    // Apply animation to winning element
    winningElement.style.animation = 'winnerPulse 1.5s infinite';
    winningElement.style.borderWidth = '3px';
    winningElement.style.borderColor = userColor;
    winningElement.style.zIndex = '10';
    
    // Update winner info display
    if (winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
        // Calculate percentage
        const percentage = currentRound && currentRound.totalValue > 0 ? 
            ((winner.itemsValue / currentRound.totalValue) * 100).toFixed(2) : '0.00';
        
        winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
        winnerName.textContent = winner.user.username || 'Unknown';
        winnerDeposit.textContent = `$${winner.itemsValue.toFixed(2)}`;
        winnerChance.textContent = `${percentage}%`;
        
        // Show winner info with fade-in
        winnerInfo.style.opacity = '0';
        winnerInfo.style.display = 'flex';
        setTimeout(() => {
            winnerInfo.style.transition = 'opacity 0.5s ease';
            winnerInfo.style.opacity = '1';
            
            // Create confetti effect
            createConfetti(userColor);
        }, 500);
    }
    
    // Show return button after delay
    setTimeout(() => {
        if (returnToJackpot) {
            returnToJackpot.style.display = 'block';
            returnToJackpot.style.opacity = '0';
            setTimeout(() => {
                returnToJackpot.style.transition = 'opacity 0.5s ease';
                returnToJackpot.style.opacity = '1';
            }, 100);
            
            // Add event listener to return button
            returnToJackpot.onclick = resetToJackpotView;
        }
    }, WINNER_DISPLAY_DURATION - 1000); // Show 1 second before winner display ends
    
    // Automatically return to jackpot view after display duration
    setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);
}

// Reset to jackpot view
function resetToJackpotView() {
    isSpinning = false;
    
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Stop and reset sound
    if (spinSound) {
        spinSound.pause();
        spinSound.currentTime = 0;
    }
    
    // Clear any fade interval
    if (window.soundFadeInInterval) {
        clearInterval(window.soundFadeInInterval);
        window.soundFadeInInterval = null;
    }
    
    // Hide winner info and roulette
    if (winnerInfo) winnerInfo.style.display = 'none';
    if (inlineRoulette) inlineRoulette.style.display = 'none';
    if (returnToJackpot) returnToJackpot.style.display = 'none';
    
    // Clear confetti
    clearConfetti();
    
    // Reset jackpot header
    if (jackpotHeader) {
        jackpotHeader.classList.remove('roulette-mode');
        
        const value = jackpotHeader.querySelector('.jackpot-value');
        const timer = jackpotHeader.querySelector('.jackpot-timer');
        const stats = jackpotHeader.querySelector('.jackpot-stats');
        
        [value, timer, stats].forEach(el => {
            if (el) {
                el.style.display = 'flex';
                el.style.opacity = '0';
                setTimeout(() => {
                    el.style.transition = 'opacity 0.5s ease';
                    el.style.opacity = '1';
                }, 100);
            }
        });
    }
    
    // Request new round data from server
    socket.emit('requestRoundData');
}

// Create confetti effect
function createConfetti(winnerColor) {
    if (!confettiContainer) return;
    
    confettiContainer.innerHTML = '';
    
    // Define confetti colors based on winner color
    const colors = [
        winnerColor,
        lightenColor(winnerColor, 20),
        darkenColor(winnerColor, 20),
        '#FFFFFF',
        getComplementaryColor(winnerColor)
    ];
    
    // Create confetti pieces
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        
        // Random properties
        const size = Math.random() * 10 + 5; // 5-15px
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100; // 0-100%
        const spinDirection = Math.random() > 0.5 ? 'normal' : 'reverse';
        const spinSpeed = Math.random() * 3 + 1; // 1-4s
        const fallDelay = Math.random() * 3; // 0-3s
        const fallDuration = Math.random() * 3 + 3; // 3-6s
        
        // Apply styles
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = color;
        confetti.style.left = `${left}%`;
        confetti.style.animation = `fall ${fallDuration}s ease-in ${fallDelay}s forwards, spin ${spinSpeed}s linear ${spinDirection} infinite`;
        
        confettiContainer.appendChild(confetti);
    }
}

// Clear confetti
function clearConfetti() {
    if (confettiContainer) confettiContainer.innerHTML = '';
}

// Test roulette animation (for development)
function testRouletteAnimation() {
    if (isSpinning) {
        console.log("Animation already in progress.");
        return;
    }
    
    if (!currentRound || !currentRound.participants || currentRound.participants.length < 2) {
        console.log("Not enough participants for test spin.");
        showNotification('Test Spin', 'Need at least 2 participants to test spin.');
        return;
    }
    
    // Select a random participant as the winner
    const randomIndex = Math.floor(Math.random() * currentRound.participants.length);
    const randomWinner = currentRound.participants[randomIndex];
    
    if (!randomWinner || !randomWinner.user) {
        console.error("Invalid random winner selected.");
        return;
    }
    
    console.log(`Test spin with random winner: ${randomWinner.user.username}`);
    
    // Create a winner data object similar to what the server would send
    const testWinnerData = {
        winner: {
            id: randomWinner.user.id,
            username: randomWinner.user.username,
            avatar: randomWinner.user.avatar,
            itemsValue: randomWinner.itemsValue,
            tickets: randomWinner.tickets
        }
    };
    
    // Switch to roulette view and start animation
    switchToRouletteView();
    setTimeout(() => {
        startRouletteAnimation(testWinnerData);
    }, 500);
}

// Load past rounds for provably fair page
async function loadPastRounds(page = 1) {
    if (!roundsTableBody) return;
    
    try {
        const response = await fetch(`/api/rounds/past?page=${page}&limit=10`);
        if (!response.ok) throw new Error(`Failed to fetch past rounds (${response.status})`);
        
        const data = await response.json();
        const rounds = data.rounds || [];
        
        roundsTableBody.innerHTML = '';
        
        if (rounds.length === 0) {
            roundsTableBody.innerHTML = '<tr><td colspan="6" class="no-rounds">No past rounds found.</td></tr>';
            return;
        }
        
        rounds.forEach(round => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(round.endTime || round.createdAt);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            
            // Calculate winner percentage if possible
            let winnerPercentage = '0.00%';
            if (round.winner && round.totalValue > 0) {
                winnerPercentage = ((round.winner.itemsValue / round.totalValue) * 100).toFixed(2) + '%';
            }
            
            row.innerHTML = `
                <td>${round.roundId || 'N/A'}</td>
                <td>${formattedDate}</td>
                <td>$${round.totalValue?.toFixed(2) || '0.00'}</td>
                <td>${round.winner ? `<img src="${round.winner.avatar || '/img/default-avatar.png'}" alt="${round.winner.username}" class="winner-avatar-small"> ${round.winner.username}` : 'N/A'}</td>
                <td>${winnerPercentage}</td>
                <td>
                    <button class="btn btn-details" onclick="showRoundDetails('${round.roundId}')">Details</button>
                    <button class="btn btn-verify" onclick="verifyRound('${round.roundId}')">Verify</button>
                </td>
            `;
            
            roundsTableBody.appendChild(row);
        });
        
        // Update pagination if needed
        if (roundsPagination) {
            updatePagination(data.currentPage, data.totalPages);
        }
    } catch (error) {
        console.error('Error loading past rounds:', error);
        roundsTableBody.innerHTML = `<tr><td colspan="6" class="error-message">Error loading rounds: ${error.message}</td></tr>`;
    }
}

// Update pagination controls
function updatePagination(currentPage, totalPages) {
    if (!roundsPagination) return;
    
    roundsPagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn';
    prevButton.textContent = '← Prev';
    prevButton.disabled = currentPage <= 1;
    if (currentPage > 1) {
        prevButton.addEventListener('click', () => loadPastRounds(currentPage - 1));
    }
    roundsPagination.appendChild(prevButton);
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        if (i !== currentPage) {
            pageButton.addEventListener('click', () => loadPastRounds(i));
        }
        roundsPagination.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn';
    nextButton.textContent = 'Next →';
    nextButton.disabled = currentPage >= totalPages;
    if (currentPage < totalPages) {
        nextButton.addEventListener('click', () => loadPastRounds(currentPage + 1));
    }
    roundsPagination.appendChild(nextButton);
}

// Verify round
async function verifyRound(roundId) {
    if (!roundId) {
        showNotification('Verification Error', 'No round ID provided.');
        return;
    }
    
    try {
        const response = await fetch(`/api/rounds/${roundId}/verify`);
        if (!response.ok) throw new Error(`Verification failed (${response.status})`);
        
        const data = await response.json();
        
        // Show verification result in a more user-friendly way (could be a modal)
        const verificationMessage = `
            Round ID: ${data.roundId}
            Server Seed (Hashed): ${data.hashedServerSeed}
            Server Seed (Revealed): ${data.serverSeed}
            Client Seed: ${data.clientSeed}
            Winning Ticket: ${data.winningTicket}
            Winner: ${data.winner?.username || 'N/A'}
            
            Verification Result: ${data.verified ? 'VERIFIED ✓' : 'FAILED ✗'}
        `;
        
        showNotification('Verification Result', verificationMessage);
    } catch (error) {
        console.error('Error verifying round:', error);
        showNotification('Verification Error', error.message);
    }
}

// Global error handler
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message, source, lineno, colno, error);
    // Optionally show a user-friendly error notification
    // showNotification('Error', 'Something went wrong. Please refresh the page.');
    return false; // Let default error handling continue
};
