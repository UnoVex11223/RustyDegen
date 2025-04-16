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
function createParticipantElement(participant, items, totalPotValue) {
     if (!participant || !participant.user || typeof participant.itemsValue !== 'number') { console.error("Invalid participant data:", participant); const el = document.createElement('div'); el.textContent = "Err"; return el; }
     const participantElement = document.createElement('div'); participantElement.className = 'participant'; participantElement.dataset.userId = participant.user.id;
     const percentage = totalPotValue > 0 ? ((participant.itemsValue / totalPotValue) * 100) : 0;
     const username = participant.user.username || 'Unknown'; const avatar = participant.user.avatar || '/img/default-avatar.png';
     const userColor = getUserColor(participant.user.id);
     const headerElement = document.createElement('div');
     headerElement.className = 'participant-header';
     headerElement.style.borderLeft = `4px solid ${userColor}`;
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
         items.sort((a, b) => (b.price || 0) - (a.price || 0));
         items.forEach(item => {
             if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;
             const itemElement = document.createElement('div');
             itemElement.className = 'item';
             itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
             itemElement.style.borderColor = userColor;
             itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><span class="item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</span>`;
             itemsElement.appendChild(itemElement);
         });
     }
     participantElement.appendChild(headerElement); participantElement.appendChild(itemsElement); return participantElement;
}

// =================== ROULETTE / WINNER / CONFETTI (No Changes Needed Here) ===================
function createRouletteItems() {
    if (!rouletteTrack || !inlineRoulette) {
        console.error("Track or inline roulette element missing."); return;
    }
    rouletteTrack.innerHTML = '';
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';

    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('No participants data available to create roulette items.');
        rouletteTrack.innerHTML = '<div style="color: grey; text-align: center; padding: 20px; width: 100%;">Waiting for participants...</div>';
        return;
    }
    let ticketPool = [];
    const totalTicketsInRound = currentRound.participants.reduce((sum, p) => sum + (p.tickets || Math.max(1, Math.floor((p.itemsValue || 0) * 100))), 0);
    currentRound.participants.forEach(p => {
        const tickets = p.tickets !== undefined ? p.tickets : Math.max(1, Math.floor((p.itemsValue || 0) * 100));
        const targetVisualBlocks = 120;
        const visualBlocksForUser = Math.max(3, Math.ceil((tickets / Math.max(1, totalTicketsInRound)) * targetVisualBlocks));
        for (let i = 0; i < visualBlocksForUser; i++) ticketPool.push(p);
    });
    if (ticketPool.length === 0) { console.error("Ticket pool calculation resulted in zero items."); return; }
    ticketPool = shuffleArray([...ticketPool]);
    const container = inlineRoulette.querySelector('.roulette-container');
    const containerWidth = container?.offsetWidth || 1000;
    const itemWidthWithMargin = 90 + 10;
    const itemsInView = Math.ceil(containerWidth / itemWidthWithMargin);
    const itemsForSpin = Math.ceil((SPIN_DURATION_SECONDS * 1000) / 50);
    const totalItemsNeeded = (itemsInView * 2) + itemsForSpin + 200;
    const itemsToCreate = Math.max(totalItemsNeeded, 500);
    console.log(`Targeting ${itemsToCreate} roulette items for smooth animation.`);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < itemsToCreate; i++) {
        const participant = ticketPool[i % ticketPool.length];
        if (!participant || !participant.user) continue;
        const userId = participant.user.id;
        const userColor = getUserColor(userId);
        const item = document.createElement('div');
        item.className = 'roulette-item';
        item.dataset.userId = userId;
        item.style.borderColor = userColor;
        const percentage = currentRound.totalValue > 0 ? ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(1) : '0.0';
        const avatar = participant.user.avatar || '/img/default-avatar.png';
        const username = participant.user.username || 'Unknown';
        item.innerHTML = `
            <div class="profile-pic-container">
                <img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';">
            </div>
            <div class="roulette-info" style="border-top: 2px solid ${userColor}">
                <span class="roulette-name" title="${username}">${username}</span>
                <span class="roulette-percentage" style="color: ${userColor}">${percentage}%</span>
            </div>`;
        fragment.appendChild(item);
    }
    rouletteTrack.appendChild(fragment);
    console.log(`Created ${itemsToCreate} items for roulette animation.`);
}

function handleWinnerAnnouncement(data) {
    if (isSpinning) { console.warn("Received winner announcement but animation is already spinning."); return; }
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error("Missing participant data for winner announcement."); resetToJackpotView(); return; }
    const winnerDetails = data.winner || (currentRound && currentRound.winner);
    if (!winnerDetails || !winnerDetails.id) { console.error("Invalid winner data received."); resetToJackpotView(); return; }
    console.log(`Winner announced: ${winnerDetails.username}`);
    if (timerActive) { timerActive = false; clearInterval(roundTimer); roundTimer = null; console.log("Stopped client timer due to winner announcement."); }
    switchToRouletteView();
    setTimeout(() => { startRouletteAnimation({ winner: winnerDetails }); }, 500);
}

function switchToRouletteView() {
    if (!jackpotHeader || !inlineRoulette) { console.error("Missing roulette UI elements for view switch."); return; }
    const value = jackpotHeader.querySelector('.jackpot-value');
    const timer = jackpotHeader.querySelector('.jackpot-timer');
    const stats = jackpotHeader.querySelector('.jackpot-stats');
    [value, timer, stats].forEach(el => { if (el) { el.style.transition = 'opacity 0.5s ease'; el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 500); } });
    jackpotHeader.classList.add('roulette-mode');
    inlineRoulette.style.display = 'block'; inlineRoulette.style.opacity = '0'; inlineRoulette.style.transform = 'translateY(20px)';
    setTimeout(() => { inlineRoulette.style.transition = 'opacity 0.7s ease, transform 0.7s ease'; inlineRoulette.style.opacity = '1'; inlineRoulette.style.transform = 'translateY(0)'; }, 600);
    if (returnToJackpot) returnToJackpot.style.display = 'none';
}

function startRouletteAnimation(winnerData) {
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Cancelled previous animation frame before starting new spin."); }
    if (!winnerData || !winnerData.winner || !winnerData.winner.id) { console.error("Invalid winner data passed to startRouletteAnimation."); resetToJackpotView(); return; }
    isSpinning = true; spinStartTime = 0; if (winnerInfo) winnerInfo.style.display = 'none'; clearConfetti();
    createRouletteItems();
    const winner = findWinnerFromData(winnerData);
    if (!winner) { console.error('Could not process winner details in startRouletteAnimation.'); isSpinning = false; resetToJackpotView(); return; }
    console.log('Starting NEW enhanced animation for Winner:', winner.user.username);
    if (spinSound) {
        spinSound.volume = 0; spinSound.currentTime = 0; spinSound.playbackRate = 1.0; spinSound.play().catch(e => console.error('Error playing sound:', e));
        let volume = 0; const fadeInInterval = 50; const targetVolume = 0.8; const volumeStep = targetVolume / (500 / fadeInInterval);
        if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval); window.soundFadeInInterval = null;
        window.soundFadeInInterval = setInterval(() => {
            volume += volumeStep;
            if (volume >= targetVolume) { spinSound.volume = targetVolume; clearInterval(window.soundFadeInInterval); window.soundFadeInInterval = null; }
            else { spinSound.volume = volume; }
        }, fadeInInterval);
    } else console.warn("Spin sound element not found.");
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) { console.error('Cannot spin, no items rendered after createRouletteItems.'); isSpinning = false; resetToJackpotView(); return; }
        const minIndexPercent = 0.65; const maxIndexPercent = 0.85; const minIndex = Math.floor(items.length * minIndexPercent); const maxIndex = Math.floor(items.length * maxIndexPercent);
        let winnerItemsIndices = [];
        for (let i = minIndex; i <= maxIndex; i++) { if (items[i]?.dataset?.userId === winner.user.id) winnerItemsIndices.push(i); }
        if (winnerItemsIndices.length === 0) {
            console.warn(`No winner items found in preferred range [${minIndex}-${maxIndex}]. Expanding search.`);
            for (let i = 0; i < items.length; i++) { if (items[i]?.dataset?.userId === winner.user.id) winnerItemsIndices.push(i); }
        }
        let winningElement; let targetIndex;
        if (winnerItemsIndices.length === 0) {
            console.error(`No items found matching winner ID ${winner.user.id}. Using fallback index.`);
            targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(items.length * 0.75)));
            winningElement = items[targetIndex];
            if (!winningElement) { console.error('Fallback winning element is invalid!'); isSpinning = false; resetToJackpotView(); return; }
        } else {
            const randomWinnerIndex = winnerItemsIndices[Math.floor(Math.random() * winnerItemsIndices.length)];
            targetIndex = randomWinnerIndex; winningElement = items[targetIndex];
            if (!winningElement) { console.error(`Selected winning element at index ${targetIndex} is invalid!`); isSpinning = false; resetToJackpotView(); return; }
        }
        console.log(`Selected winning element at index ${targetIndex} of ${items.length} total items`);
        handleRouletteSpinAnimation(winningElement, winner);
    }, 100);
}

function handleRouletteSpinAnimation(winningElement, winner) {
    if (!winningElement || !rouletteTrack || !inlineRoulette) { console.error("Missing crucial elements for roulette animation."); isSpinning = false; resetToJackpotView(); return; }
    const container = inlineRoulette.querySelector('.roulette-container');
    if (!container) { console.error("Roulette container element not found."); isSpinning = false; resetToJackpotView(); return; }
    const containerWidth = container.offsetWidth; const itemWidth = winningElement.offsetWidth || 90; const itemOffsetLeft = winningElement.offsetLeft;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2); const positionVariation = (Math.random() * 2 - 1) * (itemWidth * LANDING_POSITION_VARIATION);
    const targetScrollPosition = -(itemOffsetLeft - centerOffset) + positionVariation; const finalTargetPosition = targetScrollPosition; const startPosition = 0;
    const duration = SPIN_DURATION_SECONDS * 1000; const bounceDuration = BOUNCE_ENABLED ? 1200 : 0; const totalAnimationTime = duration + bounceDuration;
    let startTime = performance.now(); const totalDistance = finalTargetPosition - startPosition; const overshootAmount = totalDistance * BOUNCE_OVERSHOOT_FACTOR;
    let currentSpeed = 0; let lastPosition = startPosition; let lastTimestamp = startTime;
    rouletteTrack.style.transition = 'none';
    function animateRoulette(timestamp) {
        if (!isSpinning) { console.log("Animation loop stopped because isSpinning is false."); if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; return; }
        const elapsed = timestamp - startTime; let currentPosition; let animationFinished = false;
        if (elapsed <= duration) { const animationPhaseProgress = elapsed / duration; const easedProgress = easeOutAnimation(animationPhaseProgress); currentPosition = startPosition + totalDistance * easedProgress; }
        else if (BOUNCE_ENABLED && elapsed <= totalAnimationTime) { const bouncePhaseProgress = (elapsed - duration) / bounceDuration; const bounceDisplacementFactor = calculateBounce(bouncePhaseProgress); currentPosition = finalTargetPosition - (overshootAmount * bounceDisplacementFactor); }
        else { currentPosition = finalTargetPosition; animationFinished = true; }
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;
        const deltaTime = (timestamp - lastTimestamp) / 1000;
        if (deltaTime > 0.001) {
            const deltaPosition = currentPosition - lastPosition; currentSpeed = Math.abs(deltaPosition / deltaTime);
            if (spinSound && !spinSound.paused) {
                const minRate = 0.5; const maxRate = 2.0; const speedThresholdLow = 300; const speedThresholdHigh = 5000; let targetRate;
                if (animationFinished) targetRate = 1.0;
                else if (currentSpeed < speedThresholdLow) targetRate = minRate + (maxRate - minRate) * (currentSpeed / speedThresholdLow) * 0.4;
                else if (currentSpeed > speedThresholdHigh) targetRate = maxRate;
                else { const speedRange = speedThresholdHigh - speedThresholdLow; const progressInRange = (currentSpeed - speedThresholdLow) / speedRange; targetRate = minRate + (maxRate - minRate) * (0.4 + progressInRange * 0.6); }
                const rateChangeFactor = 0.08; spinSound.playbackRate = spinSound.playbackRate + (targetRate - spinSound.playbackRate) * rateChangeFactor; spinSound.playbackRate = Math.max(minRate, Math.min(maxRate, spinSound.playbackRate));
            }
            lastPosition = currentPosition; lastTimestamp = timestamp;
        }
        if (!animationFinished) animationFrameId = requestAnimationFrame(animateRoulette);
        else { console.log("NEW Animation finished naturally in loop"); animationFrameId = null; finalizeSpin(winningElement, winner); }
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = requestAnimationFrame(animateRoulette);
}

function finalizeSpin(winningElement, winner) {
     if (!isSpinning && winningElement) { console.log("FinalizeSpin called, but isSpinning is already false."); if (!winningElement.classList.contains('winner-highlight')) winningElement.classList.add('winner-highlight'); return; }
     if (!winningElement || !winner || !winner.user) { console.error("Cannot finalize spin: Invalid winner element or winner data."); isSpinning = false; resetToJackpotView(); return; }
     console.log("Finalizing spin: Applying highlight, fading sound.");
     const userColor = getUserColor(winner.user.id); winningElement.classList.add('winner-highlight');
     const existingStyle = document.getElementById('winner-pulse-style'); if (existingStyle) existingStyle.remove();
     const style = document.createElement('style'); style.id = 'winner-pulse-style';
     style.textContent = `
         .winner-highlight { z-index: 5; border-width: 3px; border-color: ${userColor}; animation: winnerPulse 1.5s infinite; --winner-color: ${userColor}; transform: scale(1.05); }
         @keyframes winnerPulse { 0%, 100% { box-shadow: 0 0 15px var(--winner-color); transform: scale(1.05); } 50% { box-shadow: 0 0 25px var(--winner-color); transform: scale(1.1); } }`;
     document.head.appendChild(style);
     if (spinSound && !spinSound.paused) {
         if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); window.soundFadeOutInterval = null;
         let volume = spinSound.volume; const fadeOutInterval = 75; const volumeStep = volume / (1000 / fadeOutInterval);
         window.soundFadeOutInterval = setInterval(() => {
             volume -= volumeStep;
             if (volume <= 0) { spinSound.pause(); spinSound.volume = 1.0; spinSound.playbackRate = 1.0; clearInterval(window.soundFadeOutInterval); window.soundFadeOutInterval = null; console.log("Sound faded out."); }
             else { spinSound.volume = volume; }
         }, fadeOutInterval);
     }
     setTimeout(() => { handleSpinEnd(winningElement, winner); }, 300);
}

function handleSpinEnd(winningElement, winner) {
    if (!isSpinning && !winningElement) { console.warn("handleSpinEnd called but spin seems already reset or elements missing."); isSpinning = false; return; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    console.log("Handling spin end: Displaying winner info and confetti.");
    if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
        const userColor = getUserColor(winner.user.id);
        winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png'; winnerAvatar.alt = winner.user.username || 'Winner'; winnerAvatar.style.borderColor = userColor; winnerAvatar.style.boxShadow = `0 0 15px ${userColor}`;
        winnerName.textContent = winner.user.username || 'Winner'; winnerName.style.color = userColor;
        const depositValue = `$${(winner.value || 0).toFixed(2)}`; const chanceValue = `${(winner.percentage || 0).toFixed(2)}%`;
        winnerDeposit.textContent = ''; winnerChance.textContent = ''; winnerInfo.style.display = 'flex'; winnerInfo.style.opacity = '0';
        let opacity = 0; const fadeStep = 0.05;
        if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval); window.winnerFadeInInterval = null;
        window.winnerFadeInInterval = setInterval(() => {
            opacity += fadeStep; winnerInfo.style.opacity = opacity.toString();
            if (opacity >= 1) {
                clearInterval(window.winnerFadeInInterval); window.winnerFadeInInterval = null;
                let depositIndex = 0; let chanceIndex = 0; const typeDelay = 35;
                if (window.typeDepositInterval) clearInterval(window.typeDepositInterval); window.typeDepositInterval = null;
                if (window.typeChanceInterval) clearInterval(window.typeChanceInterval); window.typeChanceInterval = null;
                window.typeDepositInterval = setInterval(() => {
                    if (depositIndex < depositValue.length) { winnerDeposit.textContent += depositValue[depositIndex]; depositIndex++; }
                    else {
                        clearInterval(window.typeDepositInterval); window.typeDepositInterval = null;
                        window.typeChanceInterval = setInterval(() => {
                            if (chanceIndex < chanceValue.length) { winnerChance.textContent += chanceValue[chanceIndex]; chanceIndex++; }
                            else {
                                clearInterval(window.typeChanceInterval); window.typeChanceInterval = null;
                                setTimeout(() => { launchConfetti(userColor); }, 200);
                                isSpinning = false; console.log("isSpinning set to false after winner display and confetti.");
                                setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);
                            }
                        }, typeDelay);
                    }
                }, typeDelay);
            }
        }, 20);
    } else { console.error("Winner data/elements incomplete for display in handleSpinEnd"); isSpinning = false; resetToJackpotView(); }
}

function launchConfetti(mainColor = '#00ffaa') {
    if (!confettiContainer) return; clearConfetti();
    const baseColor = mainColor; const complementaryColor = getComplementaryColor(baseColor); const lighterColor = lightenColor(baseColor, 30); const darkerColor = darkenColor(baseColor, 30);
    const colors = [ baseColor, lighterColor, darkerColor, complementaryColor, '#ffffff', lightenColor(complementaryColor, 20) ];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div'); confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`; confetti.style.animationDelay = `${Math.random() * 1.5}s`; confetti.style.animationDuration = `${2 + Math.random() * 3}s`;
        const color = colors[Math.floor(Math.random() * colors.length)]; confetti.style.backgroundColor = color;
        const size = Math.random() * 10 + 5; confetti.style.width = `${size}px`; confetti.style.height = `${size}px`;
        const rotation = Math.random() * 360; const fallX = (Math.random() - 0.5) * 100;
        confetti.style.setProperty('--fall-x', `${fallX}px`); confetti.style.setProperty('--rotation-start', `${rotation}deg`); confetti.style.setProperty('--rotation-end', `${rotation + (Math.random() - 0.5) * 720}deg`);
        const shape = Math.random(); if (shape < 0.33) confetti.style.borderRadius = '50%'; else if (shape < 0.66) confetti.style.borderRadius = '0'; else confetti.style.borderRadius = '0';
        confettiContainer.appendChild(confetti);
    }
}

function clearConfetti() {
    if (confettiContainer) confettiContainer.innerHTML = '';
     const winnerPulseStyle = document.getElementById('winner-pulse-style'); if (winnerPulseStyle) winnerPulseStyle.remove();
     document.querySelectorAll('.roulette-item.winner-highlight').forEach(el => {
         el.classList.remove('winner-highlight'); el.style.transform = '';
         if (el.dataset?.userId) el.style.borderColor = getUserColor(el.dataset.userId);
     });
}

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

function findWinnerFromData(winnerData) {
    const winnerId = winnerData?.winner?.id; if (!winnerId) { console.error("Missing winner ID in findWinnerFromData input:", winnerData); return null; }
    if (!currentRound || !currentRound.participants) {
        console.error("Missing currentRound or participants data for findWinnerFromData.");
        if (winnerData.winner) return { user: { ...winnerData.winner }, percentage: 0, value: 0 };
        return null;
    }
    const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winnerId);
    if (!winnerParticipant) {
        console.warn(`Winner ID ${winnerId} not found in local participants list.`);
          if (winnerData.winner) return { user: { ...winnerData.winner }, percentage: 0, value: 0 };
        return null;
    }
    const totalValue = currentRound.totalValue > 0 ? currentRound.totalValue : 1;
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;
    return { user: { ...winnerParticipant.user }, percentage: percentage || 0, value: winnerParticipant.itemsValue || 0 };
}

function testRouletteAnimation() {
    console.log("--- TESTING ENHANCED ROULETTE ANIMATION ---");
    if (isSpinning) { console.log("Already spinning, test cancelled."); return; }
    let testData = currentRound;
    if (!testData || !testData.participants || testData.participants.length === 0) {
        console.log('Using sample test data for animation...');
        testData = {
            roundId: `test-${Date.now()}`, status: 'active', totalValue: 194.66,
            participants: [
                { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
                { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
                { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
                { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 }
            ],
            items: [
                { owner: 'test_user_1', name: 'AK-47 | Redline', price: 15.50, image: '/img/default-item.png' }, { owner: 'test_user_1', name: 'AWP | Asiimov', price: 70.19, image: '/img/default-item.png' },
                { owner: 'test_user_1', name: 'M4A4 | Howl', price: 100.00, image: '/img/default-item.png' }, { owner: 'test_user_2', name: 'Glock-18 | Water Elem...', price: 1.39, image: '/img/default-item.png' },
                { owner: 'test_user_2', name: 'P250 | Sand Dune', price: 6.00, image: '/img/default-item.png' }, { owner: 'test_user_3', name: 'USP-S | Cortex', price: 1.04, image: '/img/default-item.png' },
                { owner: 'test_user_4', name: 'Tec-9 | Fuel Injector', price: 0.54, image: '/img/default-item.png' }
            ]
        };
        currentRound = testData;
        initiateNewRoundVisualReset(); // Clear display first
        updateRoundUI(); // Update pot/count
         if (currentRound.participants && currentRound.participants.length > 0) { // Manually populate display for test
             const sortedParticipants = [...currentRound.participants].sort((a, b) => (b.itemsValue || 0) - (a.itemsValue || 0));
             sortedParticipants.forEach(p => {
                const userItems = currentRound.items?.filter(item => item.owner && p.user && item.owner.toString() === p.user.id.toString()) || [];
                const mockDepositData = { userId: p.user.id, username: p.user.username, avatar: p.user.avatar, itemsValue: p.itemsValue, depositedItems: userItems };
                displayLatestDeposit(mockDepositData);
                 const element = participantsContainer.querySelector(`.player-deposit-container[data-user-id="${p.user.id}"]`);
                 if(element) element.classList.remove('player-deposit-new'); // Remove animation for setup
             });
         }
    }
    if (!testData.participants || testData.participants.length === 0) { showNotification('Test Error', 'No participants available for test spin.'); return; }
    const idx = Math.floor(Math.random() * testData.participants.length);
    const winningParticipant = testData.participants[idx];
     if (!winningParticipant || !winningParticipant.user) { console.error("Selected winning participant is invalid in test data:", winningParticipant); return; }
    const mockWinnerData = { roundId: testData.roundId, winner: winningParticipant.user, winningTicket: Math.floor(Math.random() * (winningParticipant.tickets || 1)) + 1 };
    console.log('Test Winner Selected:', mockWinnerData.winner.username);
    handleWinnerAnnouncement(mockWinnerData);
}


// =================== PROVABLY FAIR (No Changes Needed Here) ===================
async function verifyRound() {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed'), resultEl = document.getElementById('verification-result');
    if (!idInput || !sSeedInput || !cSeedInput || !resultEl) { console.error("Verify form elements missing."); return; }
    const roundId = idInput.value.trim(), serverSeed = sSeedInput.value.trim(), clientSeed = cSeedInput.value.trim();
    if (!roundId || !serverSeed || !clientSeed) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Please fill in all fields.</p>'; return; }
    if (serverSeed.length !== 64 || !/^[a-f0-9]{64}$/i.test(serverSeed)) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Invalid Server Seed format (should be 64 hex characters).</p>'; return; }
    try {
        resultEl.style.display = 'block'; resultEl.className = 'verification-result loading'; resultEl.innerHTML = '<p>Verifying...</p>';
        const response = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId, serverSeed, clientSeed }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || `Verify fail (${response.status})`);
        resultEl.className = `verification-result ${result.verified ? 'success' : 'error'}`;
        let html = `<h4>Result (Round #${result.roundId || roundId})</h4>`;
        if (result.verified) {
             html += `<p style="color: var(--success-color); font-weight: bold;">✅ Verified Fair.</p>`;
             if (result.serverSeedHash) html += `<p><strong>Server Seed Hash:</strong> <span class="seed-value">${result.serverSeedHash}</span></p>`;
             if (result.serverSeed) html += `<p><strong>Server Seed:</strong> <span class="seed-value">${result.serverSeed}</span></p>`;
             if (result.clientSeed) html += `<p><strong>Client Seed:</strong> <span class="seed-value">${result.clientSeed}</span></p>`;
             if (result.combinedString) html += `<p><strong>Combined:</strong> <span class="seed-value wrap-anywhere">${result.combinedString}</span></p>`;
             if (result.finalHash) html += `<p><strong>Result Hash:</strong> <span class="seed-value">${result.finalHash}</span></p>`;
             if (result.winningTicket !== undefined) html += `<p><strong>Winning Ticket:</strong> ${result.winningTicket}</p>`;
             if (result.winnerUsername) html += `<p><strong>Winner:</strong> ${result.winnerUsername}</p>`;
        } else {
            html += `<p style="color: var(--error-color); font-weight: bold;">❌ Verification Failed.</p>`;
            html += `<p><strong>Reason:</strong> ${result.reason || 'Mismatch.'}</p>`;
             if (result.serverSeedHash) html += `<p><strong>Server Seed Hash:</strong> <span class="seed-value">${result.serverSeedHash}</span></p>`;
             if (result.serverSeed) html += `<p><strong>Provided Server Seed:</strong> <span class="seed-value">${result.serverSeed}</span></p>`;
             if (result.clientSeed) html += `<p><strong>Provided Client Seed:</strong> <span class="seed-value">${result.clientSeed}</span></p>`;
             if (result.winningTicket !== undefined) html += `<p><strong>Calculated Ticket:</strong> ${result.winningTicket}</p>`;
             if (result.actualWinningTicket !== undefined) html += `<p><strong>Actual Ticket:</strong> ${result.actualWinningTicket}</p>`;
             if (result.winnerUsername) html += `<p><strong>Actual Winner:</strong> ${result.winnerUsername}</p>`;
        }
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
             const serverSeedStr = (round.serverSeed || '').replace(/'/g, "\\'"); const clientSeedStr = (round.clientSeed || '').replace(/'/g, "\\'"); const roundIdStr = round.roundId || 'N/A';
             row.innerHTML = `
                <td>#${roundIdStr}</td> <td>${date}</td> <td>$${round.totalValue?round.totalValue.toFixed(2):'0.00'}</td> <td>${round.winner?(round.winner.username||'N/A'):'N/A'}</td>
                <td> <button class="btn btn-details" onclick="showRoundDetails('${roundIdStr}')" ${roundIdStr === 'N/A' ? 'disabled' : ''}>Details</button> <button class="btn btn-verify" onclick="populateVerificationFields('${roundIdStr}', '${serverSeedStr}', '${clientSeedStr}')" ${!round.serverSeed ? 'disabled title="Seed not revealed yet"' : ''}>Verify</button> </td>`;
            row.dataset.roundId = round.roundId; roundsTableBody.appendChild(row);
        });
        createPagination(data.currentPage, data.totalPages);
    } catch (error) { roundsTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading rounds: ${error.message}</td></tr>`; console.error('Error loading rounds:', error); }
}

function populateVerificationFields(roundId, serverSeed, clientSeed) {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed');
    if (idInput) idInput.value = roundId || ''; if (sSeedInput) sSeedInput.value = serverSeed || ''; if (cSeedInput) cSeedInput.value = clientSeed || '';
    const verificationSection = document.getElementById('provably-fair-verification'); if (verificationSection) verificationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!serverSeed && roundId && roundId !== 'N/A') showNotification('Info', `Server Seed for Round #${roundId} is revealed after the round ends.`);
}

function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return; roundsPagination.innerHTML = ''; if (totalPages <= 1) return;
    const maxPagesToShow = 5;
    const createButton = (text, page, isActive = false, isDisabled = false, isEllipsis = false) => {
        if (isEllipsis) { const span = document.createElement('span'); span.className = 'page-ellipsis'; span.textContent = '...'; return span; }
        const button = document.createElement('button'); button.className = `page-button ${isActive ? 'active' : ''}`; button.textContent = text; button.disabled = isDisabled;
        if (!isDisabled && typeof page === 'number') { button.addEventListener('click', (e) => { e.preventDefault(); loadPastRounds(page); }); }
        return button;
    };
    roundsPagination.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));
    if (totalPages <= maxPagesToShow) { for (let i = 1; i <= totalPages; i++) { roundsPagination.appendChild(createButton(i, i, i === currentPage)); } }
    else {
        const pages = []; pages.push(1);
        let rangeStart = Math.max(2, currentPage - Math.floor((maxPagesToShow - 3) / 2)); let rangeEnd = Math.min(totalPages - 1, currentPage + Math.ceil((maxPagesToShow - 3) / 2));
         if (rangeStart === 2 && rangeEnd < totalPages - 1) rangeEnd = Math.min(totalPages - 1, rangeStart + (maxPagesToShow - 3));
         if (rangeEnd === totalPages - 1 && rangeStart > 2) rangeStart = Math.max(2, rangeEnd - (maxPagesToShow - 3));
        if (rangeStart > 2) pages.push('...');
        for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
        if (rangeEnd < totalPages - 1) pages.push('...');
        pages.push(totalPages);
        pages.forEach(page => {
            if (page === '...') roundsPagination.appendChild(createButton('...', null, false, true, true));
            else roundsPagination.appendChild(createButton(page, page, page === currentPage));
        });
    }
    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
