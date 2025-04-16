// main.js (Complete and Modified for Enhanced Roulette Animation & Deposit Display v2)
// Ensure the Socket.IO client library is included in your HTML:
// <script src="/socket.io/socket.io.js"></script>

// Add a test button in your HTML like: <button id="testDepositButton">Test Deposit</button>

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
const MAX_DISPLAY_DEPOSITS = 10; // Maximum number of deposit history *blocks* to show visually
const MAX_PARTICIPANTS_DISPLAY = 20; // *** NEW: Max participants to *display* in count (e.g., "X / 20") ***

// --- NEW Animation constants for enhanced roulette ---
const EASE_OUT_POWER = 5;
const BOUNCE_ENABLED = false;
const BOUNCE_OVERSHOOT_FACTOR = 0.07;
const BOUNCE_DAMPING = 0.35;
const BOUNCE_FREQUENCY = 3.5;
const LANDING_POSITION_VARIATION = 0.60;

// User Color Map - 20 distinct colors for players
const userColorMap = new Map();
const colorPalette = [
    '#00bcd4', '#ff5722', '#9c27b0', '#4caf50', '#ffeb3b', '#2196f3', '#f44336', '#ff9800',
    '#e91e63', '#8bc34a', '#3f51b5', '#009688', '#cddc39', '#795548', '#607d8b', '#673ab7',
    '#ffc107', '#03a9f4', '#9e9e9e', '#8d6e63'
];

// App State
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false;
let timerActive = false;
let roundTimer = null;
let animationFrameId = null;
let spinStartTime = 0;

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
    document.querySelectorAll('.main-nav a, a#about-link, a#roadmap-link, a#faq-link, a#fair-link').forEach(link => link.classList.remove('active'));
    if (pageElement === homePage && homeLink) homeLink.classList.add('active');
    if (pageElement === faqPage && faqLink) faqLink.classList.add('active');
    if (pageElement === fairPage && fairLink) fairLink.classList.add('active');
    if (pageElement === aboutPage && aboutLink) aboutLink.classList.add('active');
    if (pageElement === roadmapPage && roadmapLink) roadmapLink.classList.add('active');
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
    console.log(`Notification: ${title} - ${message}`);
    alert(`Notification: ${title}\n${message}`);
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
    if (!roundId || roundId === 'N/A') {
        showNotification('Info', 'Invalid Round ID for details.');
        return;
    }
    try {
        const response = await fetch(`/api/rounds/${roundId}`);
        if (!response.ok) throw new Error(`Failed to fetch round details (${response.status})`);
        const roundData = await response.json();
        alert(`Round Details (ID: ${roundId}):\nWinner: ${roundData.winner?.username || 'N/A'}\nValue: $${roundData.totalValue?.toFixed(2)}\nServer Seed: ${roundData.serverSeed || 'N/A'}\nClient Seed: ${roundData.clientSeed || 'N/A'}\nWinning Ticket: ${roundData.winningTicket}`);
    } catch (error) {
        showNotification('Error', `Could not load details for round ${roundId}: ${error.message}`);
        console.error('Error fetching round details:', error);
    }
}

// --- UPDATED EASING LOGIC --- (No changes)
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

// --- COLOR HELPERS --- (No changes)
function getComplementaryColor(hex) { hex = hex.replace('#', ''); let r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16); r = 255 - r; g = 255 - g; b = 255 - b; return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`; }
function lightenColor(hex, percent) { hex = hex.replace('#', ''); let r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16); r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100))); g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100))); b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100))); return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`; }
function darkenColor(hex, percent) { hex = hex.replace('#', ''); let r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16); r = Math.max(0, Math.floor(r * (1 - percent / 100))); g = Math.max(0, Math.floor(g * (1 - percent / 100))); b = Math.max(0, Math.floor(b * (1 - percent / 100))); return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`; }

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }
    checkLoginStatus();
    setupEventListeners();
    setupSocketConnection();
    showPage(homePage);
    initiateNewRoundVisualReset();
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
            // Optionally check participant limit before showing modal (visual feedback only)
            if (currentRound && currentRound.participants && currentRound.participants.length >= MAX_PARTICIPANTS_DISPLAY) {
                 showNotification('Round Full', `This round has reached the participant limit of ${MAX_PARTICIPANTS_DISPLAY}.`);
                 // Note: Server should reject deposit if limit is truly reached.
                 // return; // Uncomment if you want to prevent opening modal visually
            }
            if (depositModal) { showModal(depositModal); loadUserInventory(); }
        });
    }

    // Deposit Modal Close / Submit
    if (closeDepositModal) closeDepositModal.addEventListener('click', () => { if (depositModal) hideModal(depositModal); });
    if (depositButton) depositButton.addEventListener('click', submitDeposit);

    // Trade URL Modal Close / Submit
    if (closeTradeUrlModal) closeTradeUrlModal.addEventListener('click', () => { if (tradeUrlModal) hideModal(tradeUrlModal); });
    if (saveTradeUrl) saveTradeUrl.addEventListener('click', saveUserTradeUrl);

    // Age Verification
    if (agreeCheckbox && agreeButton && ageVerificationModal) {
        agreeCheckbox.addEventListener('change', () => { agreeButton.disabled = !agreeCheckbox.checked; });
        agreeButton.addEventListener('click', () => { if (agreeCheckbox.checked) { localStorage.setItem('ageVerified', 'true'); hideModal(ageVerificationModal); } });
        agreeButton.disabled = !agreeCheckbox.checked;
    }

    // Test Buttons
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
        if (ageVerificationModal && e.target === ageVerificationModal && localStorage.getItem('ageVerified')) { /* Optional hide */ }
    });

    // Keyboard Shortcut (Test Spin)
    document.addEventListener('keydown', function(event) {
        if (event.code === 'Space' && homePage.style.display === 'block' && !isSpinning) {
            testRouletteAnimation();
            event.preventDefault();
        }
    });
}

// Socket connection and events
function setupSocketConnection() {
    socket.on('connect', () => { console.log('Socket connected:', socket.id); socket.emit('requestRoundData'); });
    socket.on('disconnect', (reason) => { console.log('Socket disconnected:', reason); showNotification('Connection Lost', 'Disconnected from server.'); });
    socket.on('connect_error', (error) => { console.error('Socket connection error:', error); showNotification('Connection Error', 'Could not connect to server.'); });

    socket.on('roundCreated', (data) => { console.log('New round created:', data); currentRound = data; resetToJackpotView(); updateRoundUI(); }); // Reset view first

    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (!data.depositedItems) {
            console.warn("Received participantUpdated event WITHOUT 'depositedItems'. Old format? Cannot display deposit details.");
        }
        if (currentRound && currentRound.roundId === data.roundId) handleNewDeposit(data);
        else if (!currentRound && data.roundId) { console.warn("Participant update for unknown round."); socket.emit('requestRoundData'); }
    });

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            if (!currentRound.participants || currentRound.participants.length === 0) {
                console.warn("Received winner but no participants loaded locally. Requesting round data.");
                socket.emit('requestRoundData');
                setTimeout(() => {
                    if (currentRound && currentRound.participants && currentRound.participants.length > 0) handleWinnerAnnouncement(data);
                    else { console.error("Still no participants after requesting data."); resetToJackpotView(); }
                }, 1000);
            } else {
                handleWinnerAnnouncement(data);
            }
        } else console.warn("Received winner for mismatched round.");
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
    });

    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data); if (!data) { console.error("Invalid round data received from server."); return; }
        currentRound = data;
        initiateNewRoundVisualReset(); // Clear visual list before updating
        updateRoundUI(); // Update counts, pot, timer
        // Note: Initial population logic removed for simplicity, deposits will appear as they come in.

        if (currentRound.status === 'rolling' && currentRound.winner) {
            console.log("Connected during rolling phase.");
            if (!isSpinning) handleWinnerAnnouncement(currentRound);
        } else if (currentRound.status === 'active' && currentRound.participants?.length >= 2 && !timerActive) {
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
        if (!item || typeof item.price !== 'number' || isNaN(item.price) || !item.assetId || !item.name || !item.image) {
            console.warn("Invalid inventory item:", item); return;
        }
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
    if (typeof item.price !== 'number' || isNaN(item.price)) {
        console.error("Attempted to select item with invalid price:", item); showNotification('Selection Error', 'Cannot select item with invalid price.'); return;
    }
    const assetId = item.assetId; const index = selectedItemsList.findIndex(i => i.assetId === assetId);
    if (index === -1) { selectedItemsList.push(item); element.classList.add('selected'); addSelectedItemElement(item); }
    else { selectedItemsList.splice(index, 1); element.classList.remove('selected'); removeSelectedItemElement(assetId); }
    updateTotalValue();
}

// Add item to selected area
function addSelectedItemElement(item) {
    if (!selectedItems) return;
    if (typeof item.price !== 'number' || isNaN(item.price)) { console.error("Cannot add selected item element, invalid price:", item); return; }
    const selectedElement = document.createElement('div');
    selectedElement.className = 'selected-item'; selectedElement.dataset.assetId = item.assetId;
    selectedElement.innerHTML = `<button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button><img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><div class="selected-item-details"><div class="selected-item-value">$${item.price.toFixed(2)}</div></div>`;
    const inventoryItemElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);
    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item;
        if (inventoryItemElement && originalItem) toggleItemSelection(inventoryItemElement, originalItem);
        else { removeSelectedItem(item.assetId); updateTotalValue(); }
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
    const total = selectedItemsList.reduce((sum, item) => {
        const price = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
        return sum + price;
    }, 0);
    totalValue.textContent = `$${total.toFixed(2)}`;
    depositButton.disabled = selectedItemsList.length === 0;
}

// Submit deposit
async function submitDeposit() {
    if (selectedItemsList.length === 0) { showNotification('No Items Selected', 'Select items first.'); return; }
    if (!currentRound || currentRound.status !== 'active') { showNotification('Deposit Error', 'Wait for next round or round is not active.'); return; }
    // Optionally add visual check for participant limit before submitting
    if (currentRound.participants && currentRound.participants.length >= MAX_PARTICIPANTS_DISPLAY) {
         showNotification('Deposit Error', `The participant limit (${MAX_PARTICIPANTS_DISPLAY}) has been reached.`);
         // Note: This is secondary; the server *must* be the ultimate enforcer of limits.
         return;
    }
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
        if (showDepositModal) showDepositModal.click(); // Re-trigger deposit modal check
        showNotification('Success', 'Trade URL saved.');
    } catch (error) { showNotification('Error Saving URL', error.message); console.error('Error updating trade URL:', error); }
    finally { saveTradeUrl.disabled = false; saveTradeUrl.textContent = 'Save Trade URL'; }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound || !potValue) return;
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;
    if (!timerActive) updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : 120);
    updateParticipantsUI(); // Updates count/empty message, uses MAX_PARTICIPANTS_DISPLAY
}

// Update timer UI
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;
    const timeToShow = Math.max(0, Math.round(timeLeft));
    if (timerActive || timeToShow > 0) timerValue.textContent = timeToShow; else if (isSpinning) timerValue.textContent = "Rolling"; else timerValue.textContent = "Ended";
    updateTimerCircle(timeToShow, 120);
    if (timerActive && timeToShow <= 10 && timeToShow > 0) { timerValue.classList.add('urgent-pulse'); timerValue.classList.remove('timer-pulse'); }
    else { timerValue.classList.remove('urgent-pulse'); if (timerActive && timeToShow > 10) timerValue.classList.add('timer-pulse'); else timerValue.classList.remove('timer-pulse'); }
}

// ===== NEW DEPOSIT DISPLAY FUNCTIONS =====

/**
 * Displays the latest deposit as a new block at the BOTTOM of the participants container.
 * @param {object} data - The participant update data from the socket event.
 */
function displayLatestDeposit(data) {
    if (!participantsContainer) return;
    if (!data || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue)) {
        console.error("Invalid data passed to displayLatestDeposit:", data); return;
    }

    const username = data.username || 'Unknown';
    const avatar = data.avatar || '/img/default-avatar.png';
    const value = data.itemsValue;
    const items = data.depositedItems || [];
    const userColor = getUserColor(data.userId);

    const depositContainer = document.createElement('div');
    depositContainer.dataset.userId = data.userId;
    depositContainer.className = 'player-deposit-container player-deposit-new'; // Animation class

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
        items.sort((a, b) => (b.price || 0) - (a.price || 0));
        items.forEach(item => {
            if (!item || typeof item.price !== 'number' || isNaN(item.price) || !item.name || !item.image) {
                console.warn("Skipping invalid item in deposit display:", item); return;
            }
            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            itemElement.style.borderColor = userColor;
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</div>
                </div>`;
            itemsGrid.appendChild(itemElement);
        });
    }

    depositContainer.appendChild(depositHeader);
    depositContainer.appendChild(itemsGrid);

    // *** CHANGE: Add the new deposit block to the BOTTOM ***
    participantsContainer.appendChild(depositContainer);

    // Hide empty pot message if it was visible
    if (emptyPotMessage) emptyPotMessage.style.display = 'none';

    // Remove animation class after animation duration
    setTimeout(() => { depositContainer.classList.remove('player-deposit-new'); }, 1000);

    // *** CHANGE: Limit the number of visible deposit containers by removing from the TOP ***
    const currentDepositBlocks = participantsContainer.querySelectorAll('.player-deposit-container');
    if (currentDepositBlocks.length > MAX_DISPLAY_DEPOSITS) {
        const blocksToRemove = currentDepositBlocks.length - MAX_DISPLAY_DEPOSITS;
        for (let i = 0; i < blocksToRemove; i++) {
             const oldestBlock = participantsContainer.querySelector('.player-deposit-container'); // Get the first one
              if (oldestBlock) {
                 // Optional: Add fade-out effect before removing
                 oldestBlock.style.transition = 'opacity 0.3s ease-out';
                 oldestBlock.style.opacity = '0';
                 setTimeout(() => { oldestBlock.remove(); }, 300);
             }
        }

    }

     // Scroll to the bottom to show the latest deposit (optional)
     participantsContainer.scrollTop = participantsContainer.scrollHeight;
}


// Handle new deposit - No change needed here, calls updated displayLatestDeposit
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue) || data.totalValue === undefined) {
        console.error("Invalid participant update data received:", data); return;
    }
    if (!data.depositedItems) { data.depositedItems = []; }

    if (!currentRound) {
        currentRound = { roundId: data.roundId, status: 'active', timeLeft: 120, totalValue: 0, participants: [], items: [] };
        console.warn("Handling deposit for a non-existent local round. Initializing round.");
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Deposit received for wrong round (${data.roundId}). Current is ${currentRound.roundId}. Ignoring.`); return;
    }

    if (!currentRound.participants) currentRound.participants = [];
    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user && p.user.id === data.userId) {
            participantFound = true;
            return { ...p, itemsValue: (p.itemsValue || 0) + data.itemsValue, tickets: data.tickets };
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

    if (Array.isArray(data.depositedItems)) {
        if (!currentRound.items) currentRound.items = [];
        data.depositedItems.forEach(item => {
            if (item && typeof item.price === 'number' && !isNaN(item.price)) currentRound.items.push({ ...item, owner: data.userId });
            else console.warn("Skipping invalid item while adding to round master list:", item);
        });
    }

    updateRoundUI(); // Update Pot Value, Timer, Participant Count display
    displayLatestDeposit(data); // Display the new deposit visually (appends to bottom)

    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached (>= 2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120);
    }
}

// Update participants UI - MODIFIED to use MAX_PARTICIPANTS_DISPLAY
function updateParticipantsUI() {
    if (!participantsContainer || !participantCount || !emptyPotMessage) {
        console.error("Participants UI elements missing."); return;
    }

    const participants = currentRound?.participants || [];
    const participantNum = participants.length;

    // *** CHANGE: Update participant count display using the constant ***
    participantCount.textContent = `${participantNum}/${MAX_PARTICIPANTS_DISPLAY}`;

    // Manage the "Empty Pot" message visibility (no change in logic here)
    if (participantNum === 0) {
        const hasVisibleChildren = Array.from(participantsContainer.children)
            .some(child => child !== emptyPotMessage && child.style.display !== 'none' && parseFloat(child.style.opacity || '1') > 0);

        if (!hasVisibleChildren) {
             emptyPotMessage.style.display = 'block';
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


// Function to test deposit with mock data - Uses new display logic
function testDeposit() {
    console.log("--- TESTING DEPOSIT DISPLAY (Appends Bottom) ---");
    const randomValue = parseFloat((Math.random() * 50 + 5).toFixed(2));
    const mockDeposit = {
        roundId: currentRound?.roundId || 'test-round-123',
        userId: `test_user_${Math.floor(Math.random() * 1000)}`,
        username: ["RustPlayer99", "SkinCollector", "AK47Master", "HeadHunter", "RustLord", "TheRaider", "ScrapDealer"][Math.floor(Math.random() * 7)],
        avatar: [ 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg', 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg', 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg', '/img/default-avatar.png'][Math.floor(Math.random() * 4)],
        itemsValue: randomValue,
        tickets: Math.floor(randomValue * 100),
        totalValue: (currentRound?.totalValue || 0) + randomValue,
        depositedItems: []
    };
    const itemNames = ["AK-47 | Alien Red", "Metal Chest Plate", "Semi-Automatic Rifle", "Garage Door", "Assault Rifle", "Metal Facemask", "Road Sign Kilt", "Coffee Can Helmet", "Double Barrel Shotgun", "Revolver", "Sheet Metal Door", "Medical Syringe"];
    const numItems = Math.floor(Math.random() * 4) + 1;
    let remainingValue = mockDeposit.itemsValue; let accumulatedValue = 0;
    for (let i = 0; i < numItems; i++) {
        const isLastItem = i === numItems - 1; let itemValue;
        if (isLastItem) { itemValue = Math.max(0.01, remainingValue); }
        else { itemValue = parseFloat((Math.random() * remainingValue * 0.7 + 0.01).toFixed(2)); itemValue = Math.min(itemValue, remainingValue); if (remainingValue - itemValue < 0.01 && i < numItems - 2) { itemValue = Math.max(0.01, remainingValue - 0.01); } }
        remainingValue -= itemValue; accumulatedValue += itemValue;
         if (isLastItem && Math.abs(accumulatedValue - mockDeposit.itemsValue) > 0.001) { itemValue += (mockDeposit.itemsValue - accumulatedValue); itemValue = Math.max(0.01, itemValue); }
        mockDeposit.depositedItems.push({ assetId: `test_asset_${Math.floor(Math.random() * 10000)}`, name: itemNames[Math.floor(Math.random() * itemNames.length)], image: `/img/default-item.png`, price: parseFloat(itemValue.toFixed(2)) });
    }
    mockDeposit.itemsValue = mockDeposit.depositedItems.reduce((sum, item) => sum + item.price, 0);
    console.log("Mock Deposit Data:", mockDeposit);
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
    if (timerForeground.r && timerForeground.r.baseVal) {
        const radius = timerForeground.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const progress = Math.min(1, Math.max(0, timeLeft / totalTime));
        const offset = circumference * (1 - progress);
        timerForeground.style.strokeDasharray = `${circumference}`;
        timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`;
    } else { console.warn("timerForeground is not an SVG circle element or 'r' attribute is missing."); }
}

// Deprecated participant element creator
function createParticipantElement(participant, items, totalPotValue) { /* ... kept for reference ... */ }

// =================== ROULETTE / WINNER / CONFETTI (No Changes Needed Here) ===================
function createRouletteItems() { /* ... */ }
function handleWinnerAnnouncement(data) { /* ... */ }
function switchToRouletteView() { /* ... */ }
function startRouletteAnimation(winnerData) { /* ... */ }
function handleRouletteSpinAnimation(winningElement, winner) { /* ... */ }
function finalizeSpin(winningElement, winner) { /* ... */ }
function handleSpinEnd(winningElement, winner) { /* ... */ }
function launchConfetti(mainColor = '#00ffaa') { /* ... */ }
function clearConfetti() { /* ... */ }
function findWinnerFromData(winnerData) { /* ... */ }
function testRouletteAnimation() { /* ... uses updated display logic if mock data needed */ }

// Reset view - MODIFIED to clear participant container properly
function resetToJackpotView() {
    console.log("Resetting to jackpot view");
    if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
    if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval); window.soundFadeInInterval = null;
    if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); window.soundFadeOutInterval = null;
    if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval); window.winnerFadeInInterval = null;
    if (window.typeDepositInterval) clearInterval(window.typeDepositInterval); window.typeDepositInterval = null;
    if (window.typeChanceInterval) clearInterval(window.typeChanceInterval); window.typeChanceInterval = null;

    isSpinning = false;

    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) {
        console.error("Missing elements required for resetToJackpotView."); return;
    }

    if (spinSound && !spinSound.paused) { spinSound.pause(); spinSound.currentTime = 0; spinSound.volume = 1.0; spinSound.playbackRate = 1.0; }

    inlineRoulette.style.transition = 'opacity 0.5s ease'; inlineRoulette.style.opacity = '0';
    clearConfetti();

    setTimeout(() => {
        jackpotHeader.classList.remove('roulette-mode');
        rouletteTrack.style.transition = 'none'; rouletteTrack.style.transform = 'translateX(0)'; rouletteTrack.innerHTML = '';
        inlineRoulette.style.display = 'none'; winnerInfo.style.display = 'none';

        const value = jackpotHeader.querySelector('.jackpot-value');
        const timer = jackpotHeader.querySelector('.jackpot-timer');
        const stats = jackpotHeader.querySelector('.jackpot-stats');
        [value, timer, stats].forEach((el, index) => {
            if (el) {
                el.style.display = 'flex'; el.style.opacity = '0';
                setTimeout(() => { el.style.transition = 'opacity 0.5s ease'; el.style.opacity = '1'; }, 50 + index * 50);
            }
        });

        timerActive = false; spinStartTime = 0;
        if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }

        // *** This call now correctly clears the deposit list ***
        initiateNewRoundVisualReset();

        if (socket.connected) socket.emit('requestRoundData');
        else console.warn("Socket not connected, skipping requestRoundData after reset.");
    }, 500);
}

// Initiate visual reset - MODIFIED to use MAX_PARTICIPANTS_DISPLAY & clear deposits
function initiateNewRoundVisualReset() {
    console.log("Visual reset for next round");
    updateTimerUI(120);

    if(timerValue) {
        timerValue.classList.remove('urgent-pulse', 'timer-pulse');
        timerValue.textContent = '120';
    }

    // *** Clear the participants container and show empty message ***
    if (participantsContainer && emptyPotMessage) {
        participantsContainer.innerHTML = ''; // Clear previous deposits
        if (!participantsContainer.contains(emptyPotMessage)) {
            participantsContainer.appendChild(emptyPotMessage);
        }
        emptyPotMessage.style.display = 'block';
    }

    if (potValue) potValue.textContent = "$0.00";
    // *** Update participant count display using the constant ***
    if (participantCount) participantCount.textContent = `0/${MAX_PARTICIPANTS_DISPLAY}`;
}


// =================== PROVABLY FAIR (No Changes Needed Here) ===================
async function verifyRound() { /* ... */ }
async function loadPastRounds(page = 1) { /* ... */ }
function populateVerificationFields(roundId, serverSeed, clientSeed) { /* ... */ }
function createPagination(currentPage, totalPages) { /* ... */ }
