// main.js (Complete - Bounce Disabled, Participant Item Logic Restored)
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
const SPIN_DURATION_SECONDS = 9; // Base duration for the main spin
const WINNER_DISPLAY_DURATION = 7000; // 7 seconds for winner info display
const CONFETTI_COUNT = 150;

// --- Animation constants ---
const EASE_OUT_POWER = 4;       // Power for ease-out curve (e.g., 3=cubic, 4=quart).
const BOUNCE_ENABLED = false;   // *** BOUNCE DISABLED AS REQUESTED ***
// --- Bounce constants (kept for reference, but unused if BOUNCE_ENABLED is false) ---
const BOUNCE_OVERSHOOT_FACTOR = 0.07;
const BOUNCE_DAMPING = 0.35;
const BOUNCE_FREQUENCY = 3.5;

// User Color Map - 20 distinct colors for players
const userColorMap = new Map();
const colorPalette = [
  '#00bcd4', '#ff5722', '#9c27b0', '#4caf50', '#ffeb3b',
  '#2196f3', '#f44336', '#ff9800', '#e91e63', '#8bc34a',
  '#3f51b5', '#009688', '#cddc39', '#795548', '#607d8b',
  '#673ab7', '#ffc107', '#03a9f4', '#9e9e9e', '#8d6e63'
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
    const colorIndex = userColorMap.size % colorPalette.length;
    userColorMap.set(userId, colorPalette[colorIndex]);
  }
  return userColorMap.get(userId);
}

function showNotification(title, message) {
    console.log(`Notification: ${title} - ${message}`);
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
        alert(`Round Details (ID: ${roundId}):\nWinner: ${roundData.winner?.username || 'N/A'}\nValue: ${roundData.totalValue?.toFixed(2)}\nServer Seed: ${roundData.serverSeed || 'N/A'}\nClient Seed: ${roundData.clientSeed || 'N/A'}\nWinning Ticket: ${roundData.winningTicket}`);
    } catch (error) {
        showNotification('Error', `Could not load details for round ${roundId}: ${error.message}`);
        console.error('Error fetching round details:', error);
    }
}

// --- EASING FUNCTION (No Bounce) ---
function easeOutAnimation(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - clampedT, EASE_OUT_POWER);
}

// calculateBounce function remains but won't be called if BOUNCE_ENABLED is false
function calculateBounce(t) {
    if (!BOUNCE_ENABLED) return 0; // Will always return 0 now
    const clampedT = Math.max(0, Math.min(1, t));
    const decay = Math.exp(-clampedT / BOUNCE_DAMPING);
    const oscillations = Math.sin(clampedT * Math.PI * 2 * BOUNCE_FREQUENCY);
    return -decay * oscillations;
}

// --- Color Helper Functions (Unchanged) ---
function getComplementaryColor(hex) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = 255 - r; g = 255 - g; b = 255 - b;
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

// --- App Initialization and Event Listeners (Unchanged) ---
document.addEventListener('DOMContentLoaded', function() {
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }
    checkLoginStatus();
    setupEventListeners();
    setupSocketConnection();
    showPage(homePage);
});

function setupEventListeners() {
    if (homeLink) homeLink.addEventListener('click', (e) => { e.preventDefault(); showPage(homePage); });
    if (faqLink) faqLink.addEventListener('click', (e) => { e.preventDefault(); showPage(faqPage); });
    if (fairLink) fairLink.addEventListener('click', (e) => { e.preventDefault(); showPage(fairPage); });
    if (loginButton) loginButton.addEventListener('click', () => { window.location.href = '/auth/steam'; });
    if (showDepositModal) {
        showDepositModal.addEventListener('click', () => {
            if (!currentUser) { showNotification('Login Required', 'Please log in first.'); return; }
            if (!currentUser.tradeUrl) { if (tradeUrlModal) showModal(tradeUrlModal); else showNotification('Trade URL Missing', 'Please set Trade URL.'); return; }
            if (depositModal) { showModal(depositModal); loadUserInventory(); }
        });
    }
    if (closeDepositModal) closeDepositModal.addEventListener('click', () => { if (depositModal) hideModal(depositModal); });
    if (depositButton) depositButton.addEventListener('click', submitDeposit);
    if (closeTradeUrlModal) closeTradeUrlModal.addEventListener('click', () => { if (tradeUrlModal) hideModal(tradeUrlModal); });
    if (saveTradeUrl) saveTradeUrl.addEventListener('click', saveUserTradeUrl);
    if (agreeCheckbox && agreeButton && ageVerificationModal) {
        agreeCheckbox.addEventListener('change', () => { agreeButton.disabled = !agreeCheckbox.checked; });
        agreeButton.addEventListener('click', () => { if (agreeCheckbox.checked) { localStorage.setItem('ageVerified', 'true'); hideModal(ageVerificationModal); } });
        agreeButton.disabled = !agreeCheckbox.checked;
    }
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) testSpinButton.addEventListener('click', testRouletteAnimation);
    if (verifyBtn) verifyBtn.addEventListener('click', verifyRound);
    window.addEventListener('click', (e) => {
        if (depositModal && e.target === depositModal) hideModal(depositModal);
        if (tradeUrlModal && e.target === tradeUrlModal) hideModal(tradeUrlModal);
        if (ageVerificationModal && e.target === ageVerificationModal && localStorage.getItem('ageVerified')) { /* Optional close */ }
    });
    document.addEventListener('keydown', function(event) {
        if (event.code === 'Space' && homePage.style.display === 'block' && !isSpinning) { testRouletteAnimation(); event.preventDefault(); }
    });
}

// --- Socket Connection and Event Handlers (Unchanged) ---
function setupSocketConnection() {
    socket.on('connect', () => { console.log('Socket connected:', socket.id); socket.emit('requestRoundData'); });
    socket.on('disconnect', (reason) => { console.log('Socket disconnected:', reason); showNotification('Connection Lost', 'Disconnected from server.'); });
    socket.on('connect_error', (error) => { console.error('Socket connection error:', error); showNotification('Connection Error', 'Could not connect to server.'); });
    socket.on('roundCreated', (data) => { console.log('New round created:', data); currentRound = data; updateRoundUI(); resetToJackpotView(); });
    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.roundId === data.roundId) handleNewDeposit(data); // Calls the restored handleNewDeposit
        else if (!currentRound && data.roundId) { console.warn("Participant update for unknown round."); socket.emit('requestRoundData'); }
    });
    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
             if (!currentRound.participants || currentRound.participants.length === 0) {
                console.warn("Received winner but no participants loaded. Requesting data.");
                socket.emit('requestRoundData');
                setTimeout(() => { if (currentRound?.participants?.length > 0) handleWinnerAnnouncement(data); else resetToJackpotView(); }, 1000);
             } else { handleWinnerAnnouncement(data); }
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
        if (data.message === "No participants." || currentRound?.participants?.length === 0) { console.log("Round completed with no participants."); setTimeout(resetToJackpotView, 1500); }
    });
    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data); if (!data) { console.error("Invalid round data."); return; }
        currentRound = data; updateRoundUI();
        if (currentRound.status === 'rolling' && currentRound.winner && !isSpinning) { console.log("Connected during rolling phase."); handleWinnerAnnouncement(currentRound); }
        else if (currentRound.status === 'active' && currentRound.participants?.length >= 2 && !timerActive) { timerActive = true; startClientTimer(currentRound.timeLeft || 120); }
        else if (currentRound.status === 'ended' || currentRound.status === 'completed') { console.log("Connected after round ended."); resetToJackpotView(); }
    });
    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        if (currentUser && data.userId === currentUser._id) showNotification('Trade Offer Sent', 'Check Steam for winnings!');
    });
}

// --- User and UI Functions (Unchanged) ---
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) { if (response.status === 401 || response.status === 403) currentUser = null; else throw new Error(`Server error: ${response.status}`); }
        else { currentUser = await response.json(); console.log('User logged in:', currentUser?.username); }
        updateUserUI();
    } catch (error) { console.error('Error checking login status:', error); currentUser = null; updateUserUI(); }
}
function updateUserUI() {
    if (currentUser && userProfile && loginButton && userAvatar && userName) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png'; userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none'; userProfile.style.display = 'flex';
    } else if (userProfile && loginButton) { loginButton.style.display = 'flex'; userProfile.style.display = 'none'; }
}

// --- Inventory and Deposit Functions (Unchanged) ---
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
function toggleItemSelection(element, item) {
    const assetId = item.assetId; const index = selectedItemsList.findIndex(i => i.assetId === assetId);
    if (index === -1) { selectedItemsList.push(item); element.classList.add('selected'); addSelectedItemElement(item); }
    else { selectedItemsList.splice(index, 1); element.classList.remove('selected'); removeSelectedItemElement(assetId); }
    updateTotalValue();
}
function addSelectedItemElement(item) {
    if (!selectedItems) return; const selectedElement = document.createElement('div');
    selectedElement.className = 'selected-item'; selectedElement.dataset.assetId = item.assetId;
    selectedElement.innerHTML = `<button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button><img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><div class="selected-item-details"><div class="selected-item-value">$${item.price.toFixed(2)}</div></div>`;
    const inventoryItemElement = inventoryItems.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);
    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item;
        if (inventoryItemElement && originalItem) { toggleItemSelection(inventoryItemElement, originalItem); }
        else { removeSelectedItem(item.assetId); updateTotalValue(); }
    });
    selectedItems.appendChild(selectedElement);
}
function removeSelectedItemElement(assetId) { const selectedElement = selectedItems.querySelector(`.selected-item[data-asset-id="${assetId}"]`); if (selectedElement) selectedElement.remove(); }
function removeSelectedItem(assetId) {
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);
    const inventoryElement = inventoryItems?.querySelector(`.inventory-item[data-asset-id="${assetId}"]`); if (inventoryElement) inventoryElement.classList.remove('selected');
    removeSelectedItemElement(assetId);
}
function updateTotalValue() {
    if (!totalValue || !depositButton) return;
    const total = selectedItemsList.reduce((sum, item) => sum + (item.price || 0), 0);
    totalValue.textContent = `$${total.toFixed(2)}`;
    depositButton.disabled = selectedItemsList.length === 0;
}
async function submitDeposit() {
    if (selectedItemsList.length === 0) { showNotification('No Items Selected', 'Select items first.'); return; }
    if (!currentRound || currentRound.status !== 'active') { showNotification('Deposit Error', 'Wait for next round or round not active.'); return; }
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
        if (showDepositModal) { showDepositModal.click(); }
        showNotification('Success', 'Trade URL saved.');
    } catch (error) { showNotification('Error Saving URL', error.message); console.error('Error updating trade URL:', error); }
    finally { saveTradeUrl.disabled = false; saveTradeUrl.textContent = 'Save Trade URL'; }
}

// --- Round State and Timer Functions (Unchanged) ---
function updateRoundUI() {
    if (!currentRound || !potValue) return;
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;
    if (!timerActive) updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : 120);
    updateParticipantsUI(); // Calls the restored updateParticipantsUI
}
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;
    const timeToShow = Math.max(0, Math.round(timeLeft));
    if (timerActive || timeToShow > 0) timerValue.textContent = timeToShow; else if (isSpinning) timerValue.textContent = "Rolling"; else timerValue.textContent = "Ended";
    updateTimerCircle(timeToShow, 120); // Assume 120s total time
    if (timerActive && timeToShow <= 10 && timeToShow > 0) { timerValue.classList.add('urgent-pulse'); timerValue.classList.remove('timer-pulse'); }
    else { timerValue.classList.remove('urgent-pulse'); if (timerActive && timeToShow > 10) timerValue.classList.add('timer-pulse'); else timerValue.classList.remove('timer-pulse'); }
}
function startClientTimer(initialTime = 120) {
    if (!timerValue) return; if (roundTimer) clearInterval(roundTimer);
    let timeLeft = Math.max(0, initialTime); console.log(`Starting client timer from ${timeLeft}s`); updateTimerUI(timeLeft);
    roundTimer = setInterval(() => {
        if (!timerActive) { clearInterval(roundTimer); roundTimer = null; console.log("Client timer stopped (not active)."); return; }
        timeLeft--; updateTimerUI(timeLeft);
        if (timeLeft <= 0) { clearInterval(roundTimer); roundTimer = null; timerActive = false; console.log("Client timer reached zero."); if(timerValue) timerValue.textContent = "Ending"; }
    }, 1000);
}
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return;
    // Ensure radius is read correctly
    const radius = timerForeground.r?.baseVal?.value;
    if (typeof radius !== 'number' || radius <= 0) {
        console.warn("Could not get timer circle radius.");
        return; // Exit if radius is invalid
    }
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(1, Math.max(0, timeLeft / totalTime));
    const offset = circumference * (1 - progress);
    timerForeground.style.strokeDasharray = `${circumference}`;
    timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`;
}

// --- Participant Display Logic (Restored to Original) ---

// handleNewDeposit - Restored original logic for adding participant and items
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || data.itemsValue === undefined || data.totalValue === undefined) { console.error("Invalid participant update:", data); return; }
    if (!currentRound) { console.warn("Deposit for non-existent round."); currentRound = { roundId: data.roundId, status: 'active', timeLeft: 120, totalValue: 0, participants: [], items: [] }; }
    else if (currentRound.roundId !== data.roundId) { console.warn(`Deposit for wrong round (${data.roundId}). Current is ${currentRound.roundId}`); return; }

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
            itemsValue: data.itemsValue,
            tickets: data.tickets
        });
    }

    currentRound.totalValue = data.totalValue;

    // *** Original logic for adding items to the round ***
    if (data.depositedItems && Array.isArray(data.depositedItems)) {
        if (!currentRound.items) currentRound.items = [];
        // Add owner info to each item before pushing
        data.depositedItems.forEach(item => currentRound.items.push({ ...item, owner: data.userId }));
        console.log(`Added ${data.depositedItems.length} items for user ${data.userId} to round ${currentRound.roundId}. Total items now: ${currentRound.items.length}`);
    }
    // *** End of original item logic ***

    updateRoundUI(); // This calls the restored updateParticipantsUI

    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached (>= 2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120);
    }
}

// updateParticipantsUI - Restored original logic for filtering items per participant
function updateParticipantsUI() {
    if (!participantsContainer || !participantCount || !emptyPotMessage) { console.error("Participants UI elements missing."); return; }
    const participants = currentRound?.participants || [];
    const totalPotValue = currentRound?.totalValue || 0;

    participantCount.textContent = `${participants.length}/200`;
    participantsContainer.innerHTML = ''; // Clear previous entries

    if (participants.length === 0) {
        emptyPotMessage.style.display = 'block';
        if (!participantsContainer.contains(emptyPotMessage)) {
             participantsContainer.appendChild(emptyPotMessage);
        }
        return;
    } else {
        emptyPotMessage.style.display = 'none';
    }

    // Sort participants by value descending
    participants.sort((a, b) => (b.itemsValue || 0) - (a.itemsValue || 0));

    participants.forEach(participant => {
        // *** Original logic for filtering items for the current participant ***
        const userItems = currentRound?.items?.filter(item =>
            item.owner && participant.user && item.owner.toString() === participant.user.id.toString()
        ) || [];
        // *** End of original item filtering logic ***

        // Call the restored createParticipantElement with the filtered items
        const participantElement = createParticipantElement(participant, userItems, totalPotValue);
        participantsContainer.appendChild(participantElement);
    });
}

// createParticipantElement - Restored original logic for rendering participant items
function createParticipantElement(participant, items, totalPotValue) {
    if (!participant || !participant.user || typeof participant.itemsValue !== 'number') { console.error("Invalid participant data:", participant); const el = document.createElement('div'); el.textContent = "Err"; return el; }

    const participantElement = document.createElement('div');
    participantElement.className = 'participant';
    participantElement.dataset.userId = participant.user.id;

    const percentage = totalPotValue > 0 ? ((participant.itemsValue / totalPotValue) * 100) : 0;
    const username = participant.user.username || 'Unknown';
    const avatar = participant.user.avatar || '/img/default-avatar.png';
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

    // *** Original logic for creating and appending item elements ***
    const itemsElement = document.createElement('div');
    itemsElement.className = 'participant-items';
    if (items && items.length > 0) {
        items.sort((a, b) => (b.price || 0) - (a.price || 0)); // Sort items by price desc
        items.forEach(item => {
            if (!item || typeof item.price !== 'number' || !item.name || !item.image) return; // Basic validation
            const itemElement = document.createElement('div');
            itemElement.className = 'item'; // Use 'item' class as per CSS
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            itemElement.style.borderColor = userColor; // Add user color to item border
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';">
                <span class="item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</span>`; // Overlay value
            itemsElement.appendChild(itemElement);
        });
    }
    // *** End of original item rendering logic ***

    participantElement.appendChild(headerElement);
    participantElement.appendChild(itemsElement);
    return participantElement;
}


// =================== ROULETTE ANIMATION (Bounce Disabled) ===================

// createRouletteItems - (Unchanged from previous version)
function createRouletteItems() {
  if (!rouletteTrack || !inlineRoulette) { console.error("Roulette track/inline missing."); return; }
  rouletteTrack.innerHTML = ''; rouletteTrack.style.transition = 'none'; rouletteTrack.style.transform = 'translateX(0)';
  if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error('No participants data for roulette items.'); rouletteTrack.innerHTML = '<div style="color: grey; text-align: center; padding: 20px; width: 100%;">Waiting...</div>'; return; }
  let ticketPool = []; const totalTicketsInRound = currentRound.participants.reduce((sum, p) => sum + (p.tickets || Math.max(1, Math.floor((p.itemsValue || 0) * 100))), 0);
  currentRound.participants.forEach(p => {
    const tickets = p.tickets !== undefined ? p.tickets : Math.max(1, Math.floor((p.itemsValue || 0) * 100));
    const targetVisualBlocks = 120; const visualBlocksForUser = Math.max(3, Math.ceil((tickets / Math.max(1, totalTicketsInRound)) * targetVisualBlocks));
    for (let i = 0; i < visualBlocksForUser; i++) { ticketPool.push(p); }
  });
  if (ticketPool.length === 0) { console.error("Ticket pool empty."); return; }
  ticketPool = shuffleArray([...ticketPool]);
  const container = inlineRoulette.querySelector('.roulette-container'); const containerWidth = container?.offsetWidth || 1000; const itemWidthWithMargin = 90 + 10;
  const itemsInView = Math.ceil(containerWidth / itemWidthWithMargin); const itemsForSpin = Math.ceil((SPIN_DURATION_SECONDS * 1000) / 50); const totalItemsNeeded = (itemsInView * 2) + itemsForSpin + 200; const itemsToCreate = Math.max(totalItemsNeeded, 500);
  console.log(`Targeting ${itemsToCreate} roulette items.`); const fragment = document.createDocumentFragment();
  for (let i = 0; i < itemsToCreate; i++) {
    const participant = ticketPool[i % ticketPool.length]; if (!participant || !participant.user) continue;
    const userId = participant.user.id; const userColor = getUserColor(userId); const item = document.createElement('div'); item.className = 'roulette-item'; item.dataset.userId = userId; item.style.borderColor = userColor;
    const percentage = currentRound.totalValue > 0 ? ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(1) : '0.0'; const avatar = participant.user.avatar || '/img/default-avatar.png'; const username = participant.user.username || 'Unknown';
    item.innerHTML = `<div class="profile-pic-container"><img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';"></div><div class="roulette-info" style="border-top: 2px solid ${userColor}"><span class="roulette-name" title="${username}">${username}</span><span class="roulette-percentage" style="color: ${userColor}">${percentage}%</span></div>`;
    fragment.appendChild(item);
  }
  rouletteTrack.appendChild(fragment); console.log(`Created ${itemsToCreate} items.`);
}

// handleWinnerAnnouncement - (Unchanged from previous version)
function handleWinnerAnnouncement(data) {
    if (isSpinning) { console.warn("Already spinning."); return; }
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error("Missing participant data for winner."); resetToJackpotView(); return; }
    const winnerDetails = data.winner || (currentRound && currentRound.winner);
    if (!winnerDetails || !winnerDetails.id) { console.error("Invalid winner data."); resetToJackpotView(); return; }
    console.log(`Winner announced: ${winnerDetails.username}`);
    if (timerActive) { timerActive = false; clearInterval(roundTimer); roundTimer = null; console.log("Stopped client timer."); }
    switchToRouletteView();
    setTimeout(() => { startRouletteAnimation({ winner: winnerDetails }); }, 500);
}

// switchToRouletteView - (Unchanged from previous version)
function switchToRouletteView() {
  if (!jackpotHeader || !inlineRoulette) { console.error("Missing roulette UI elements."); return; }
  const value = jackpotHeader.querySelector('.jackpot-value'); const timer = jackpotHeader.querySelector('.jackpot-timer'); const stats = jackpotHeader.querySelector('.jackpot-stats');
  [value, timer, stats].forEach(el => { if (el) { el.style.transition = 'opacity 0.5s ease'; el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 500); } });
  jackpotHeader.classList.add('roulette-mode');
  inlineRoulette.style.display = 'block'; inlineRoulette.style.opacity = '0'; inlineRoulette.style.transform = 'translateY(20px)';
  setTimeout(() => { inlineRoulette.style.transition = 'opacity 0.7s ease, transform 0.7s ease'; inlineRoulette.style.opacity = '1'; inlineRoulette.style.transform = 'translateY(0)'; }, 600);
  if (returnToJackpot) returnToJackpot.style.display = 'none';
}

// startRouletteAnimation - (Unchanged from previous version, relies on handleRouletteSpinAnimation)
function startRouletteAnimation(winnerData) {
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Cancelled previous frame."); }
    if (!winnerData || !winnerData.winner || !winnerData.winner.id) { console.error("Invalid winner data passed."); resetToJackpotView(); return; }
    isSpinning = true; spinStartTime = 0; if (winnerInfo) winnerInfo.style.display = 'none'; clearConfetti(); createRouletteItems();
    const winner = findWinnerFromData(winnerData);
    if (!winner) { console.error('Could not process winner details.'); isSpinning = false; resetToJackpotView(); return; }
    console.log('Starting animation for Winner:', winner.user.username);
    if (spinSound) {
        spinSound.volume = 0; spinSound.currentTime = 0; spinSound.playbackRate = 1.0; spinSound.play().catch(e => console.error('Error playing sound:', e));
        let volume = 0; const fadeInInterval = 50; const targetVolume = 0.8; const volumeStep = targetVolume / (500 / fadeInInterval);
        if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval);
        window.soundFadeInInterval = setInterval(() => { volume += volumeStep; if (volume >= targetVolume) { spinSound.volume = targetVolume; clearInterval(window.soundFadeInInterval); window.soundFadeInInterval = null; } else { spinSound.volume = volume; } }, fadeInInterval);
    } else { console.warn("Spin sound element not found."); }
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item'); if (items.length === 0) { console.error('No items rendered.'); isSpinning = false; resetToJackpotView(); return; }
        const minIndex = Math.floor(items.length * 0.65); const maxIndex = Math.floor(items.length * 0.85); let winnerItemsIndices = [];
        for (let i = minIndex; i <= maxIndex; i++) { if (items[i]?.dataset?.userId === winner.user.id) { winnerItemsIndices.push(i); } }
        if (winnerItemsIndices.length === 0) { console.warn(`No winner items in range. Expanding search.`); for (let i = 0; i < items.length; i++) { if (items[i]?.dataset?.userId === winner.user.id) { winnerItemsIndices.push(i); } } }
        let winningElement; let targetIndex;
        if (winnerItemsIndices.length === 0) { console.error(`No items for winner ID ${winner.user.id}. Fallback.`); targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(items.length * 0.75))); winningElement = items[targetIndex]; if (!winningElement) { console.error('Fallback element invalid!'); isSpinning = false; resetToJackpotView(); return; } }
        else { const randomWinnerIndex = winnerItemsIndices[Math.floor(Math.random() * winnerItemsIndices.length)]; targetIndex = randomWinnerIndex; winningElement = items[targetIndex]; }
        console.log(`Selected winner index ${targetIndex} of ${items.length}.`); handleRouletteSpinAnimation(winningElement, winner); // Calls the updated animation handler
    }, 150);
}


// handleRouletteSpinAnimation - UPDATED to disable bounce logic path
function handleRouletteSpinAnimation(winningElement, winner) {
    if (!winningElement || !rouletteTrack || !inlineRoulette) { console.error("Missing elements for animation."); isSpinning = false; resetToJackpotView(); return; }
    const container = inlineRoulette.querySelector('.roulette-container');
    if (!container) { console.error("Roulette container missing."); isSpinning = false; resetToJackpotView(); return; }

    const containerWidth = container.offsetWidth; const itemWidth = winningElement.offsetWidth || 90; const itemOffsetLeft = winningElement.offsetLeft;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2); const targetScrollPosition = -(itemOffsetLeft - centerOffset);
    const randomOffsetFactor = 0.10; const randomOffset = (Math.random() - 0.5) * (itemWidth * randomOffsetFactor);
    const finalTargetPosition = targetScrollPosition + randomOffset;
    const startPosition = 0;

    const duration = SPIN_DURATION_SECONDS * 1000;
    // Bounce duration is effectively 0 now as BOUNCE_ENABLED is false
    const bounceDuration = BOUNCE_ENABLED ? 1200 : 0;
    const totalAnimationTime = duration + bounceDuration; // Will equal 'duration' if bounce disabled
    let startTime = performance.now();

    // Overshoot amount calculation remains but won't be used if bounce is disabled
    const totalDistance = finalTargetPosition - startPosition;
    const overshootAmount = totalDistance * BOUNCE_OVERSHOOT_FACTOR;

    let currentSpeed = 0; let lastPosition = startPosition; let lastTimestamp = startTime;
    rouletteTrack.style.transition = 'none';

    function animateRoulette(timestamp) {
        if (!isSpinning) { console.log("Animation stopped: isSpinning false."); if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; return; }

        const elapsed = timestamp - startTime;
        let currentPosition;
        let animationFinished = false;

        // --- Main Easing Phase ---
        // This phase now runs for the entire duration since bounce phase is skipped
        if (elapsed <= totalAnimationTime) { // Use totalAnimationTime which equals 'duration' now
            // Normalize progress over the main duration only
            const animationPhaseProgress = Math.min(1, elapsed / duration);
            const easedProgress = easeOutAnimation(animationPhaseProgress);
            currentPosition = startPosition + totalDistance * easedProgress;
        }
        // --- Bounce Phase (Skipped if BOUNCE_ENABLED is false) ---
        // The condition 'else if (BOUNCE_ENABLED && elapsed <= totalAnimationTime)' prevents this block from running
        // --- Animation End ---
        else {
            currentPosition = finalTargetPosition;
            animationFinished = true;
        }

        // Apply the transform
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;

        // --- Sound Pitch / Speed Calculation (Unchanged) ---
        const deltaTime = (timestamp - lastTimestamp) / 1000;
        if (deltaTime > 0.001) {
             const deltaPosition = currentPosition - lastPosition; currentSpeed = Math.abs(deltaPosition / deltaTime);
             if (spinSound && !spinSound.paused) {
                 const minRate = 0.5; const maxRate = 2.0; const speedThresholdLow = 300; const speedThresholdHigh = 5000; let targetRate;
                 if (animationFinished) { targetRate = 1.0; }
                 else if (currentSpeed < speedThresholdLow) { targetRate = minRate + (maxRate - minRate) * (currentSpeed / speedThresholdLow) * 0.4; }
                 else if (currentSpeed > speedThresholdHigh) { targetRate = maxRate; }
                 else { const speedRange = speedThresholdHigh - speedThresholdLow; const progressInRange = (currentSpeed - speedThresholdLow) / speedRange; targetRate = minRate + (maxRate - minRate) * (0.4 + progressInRange * 0.6); }
                 const rateChangeFactor = 0.08; spinSound.playbackRate = spinSound.playbackRate + (targetRate - spinSound.playbackRate) * rateChangeFactor; spinSound.playbackRate = Math.max(minRate, Math.min(maxRate, spinSound.playbackRate));
             }
             lastPosition = currentPosition; lastTimestamp = timestamp;
        }
        // --- End Sound Pitch ---

        // Continue animation or finalize
        if (!animationFinished && elapsed <= duration) { // Ensure we only check against main duration now
            animationFrameId = requestAnimationFrame(animateRoulette);
        } else {
             // If time exceeds duration (and bounce is disabled), force finish
             if (!animationFinished) { // Ensure it lands exactly if loop terminates slightly early
                rouletteTrack.style.transform = `translateX(${finalTargetPosition}px)`;
             }
            console.log("Animation finished (Bounce Disabled).");
            animationFrameId = null;
            finalizeSpin(winningElement, winner); // Proceed to finalize
        }
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(animateRoulette);
}


// finalizeSpin - (Unchanged from previous version)
function finalizeSpin(winningElement, winner) {
     if (!isSpinning && winningElement) { console.log("FinalizeSpin called, but isSpinning false."); if (!winningElement.classList.contains('winner-highlight')) { winningElement.classList.add('winner-highlight'); /* Maybe re-apply style? */ } return; }
     if (!winningElement || !winner || !winner.user) { console.error("Cannot finalize spin: Invalid data."); isSpinning = false; resetToJackpotView(); return; }
     console.log("Finalizing spin: Applying highlight, fading sound.");
     const userColor = getUserColor(winner.user.id); winningElement.classList.add('winner-highlight');
     const existingStyle = document.getElementById('winner-pulse-style'); if (existingStyle) existingStyle.remove();
     const style = document.createElement('style'); style.id = 'winner-pulse-style';
     style.textContent = `.winner-highlight { z-index: 5; border-width: 3px; border-color: ${userColor}; animation: winnerPulse 1.5s infinite; --winner-color: ${userColor}; transform: scale(1.05); } @keyframes winnerPulse { 0%, 100% { box-shadow: 0 0 15px var(--winner-color); transform: scale(1.05); } 50% { box-shadow: 0 0 25px var(--winner-color); transform: scale(1.1); } }`;
     document.head.appendChild(style);
     if (spinSound && !spinSound.paused) {
        if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); let volume = spinSound.volume; const fadeOutInterval = 75; const volumeStep = volume / (1000 / fadeOutInterval);
        window.soundFadeOutInterval = setInterval(() => { volume -= volumeStep; if (volume <= 0) { spinSound.pause(); spinSound.volume = 1.0; spinSound.playbackRate = 1.0; clearInterval(window.soundFadeOutInterval); window.soundFadeOutInterval = null; console.log("Sound faded."); } else { spinSound.volume = volume; } }, fadeOutInterval);
     }
     setTimeout(() => { handleSpinEnd(winningElement, winner); }, 300);
}

// handleSpinEnd - (Unchanged from previous version)
function handleSpinEnd(winningElement, winner) {
    if (!isSpinning && !winningElement) { console.warn("handleSpinEnd called but spin seems reset."); isSpinning = false; return; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    console.log("Handling spin end: Displaying winner info/confetti.");
    if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
        const userColor = getUserColor(winner.user.id); winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png'; winnerAvatar.alt = winner.user.username || 'Winner'; winnerAvatar.style.borderColor = userColor; winnerAvatar.style.boxShadow = `0 0 15px ${userColor}`;
        winnerName.textContent = winner.user.username || 'Winner'; winnerName.style.color = userColor;
        const depositValue = `$${(winner.value || 0).toFixed(2)}`; const chanceValue = `${(winner.percentage || 0).toFixed(2)}%`;
        winnerDeposit.textContent = ''; winnerChance.textContent = ''; winnerInfo.style.display = 'flex'; winnerInfo.style.opacity = '0';
        let opacity = 0; const fadeStep = 0.05; if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval);
        window.winnerFadeInInterval = setInterval(() => { opacity += fadeStep; winnerInfo.style.opacity = opacity.toString(); if (opacity >= 1) {
            clearInterval(window.winnerFadeInInterval); window.winnerFadeInInterval = null; let depositIndex = 0; let chanceIndex = 0; const typeDelay = 35;
            if (window.typeDepositInterval) clearInterval(window.typeDepositInterval); if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);
            window.typeDepositInterval = setInterval(() => { if (depositIndex < depositValue.length) { winnerDeposit.textContent += depositValue[depositIndex]; depositIndex++; } else {
                clearInterval(window.typeDepositInterval); window.typeDepositInterval = null; window.typeChanceInterval = setInterval(() => { if (chanceIndex < chanceValue.length) { winnerChance.textContent += chanceValue[chanceIndex]; chanceIndex++; } else {
                    clearInterval(window.typeChanceInterval); window.typeChanceInterval = null; setTimeout(() => { launchConfetti(userColor); }, 200); isSpinning = false; console.log("isSpinning set false after display."); setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION); } }, typeDelay); } }, typeDelay); } }, 20);
    } else { console.error("Winner data/elements incomplete for display."); isSpinning = false; resetToJackpotView(); }
}

// launchConfetti - (Unchanged from previous version)
function launchConfetti(mainColor = '#00ffaa') {
  if (!confettiContainer) return; clearConfetti();
  const baseColor = mainColor; const complementaryColor = getComplementaryColor(baseColor); const lighterColor = lightenColor(baseColor, 30); const darkerColor = darkenColor(baseColor, 30);
  const colors = [baseColor, lighterColor, darkerColor, complementaryColor, '#ffffff', lightenColor(complementaryColor, 20)];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const confetti = document.createElement('div'); confetti.className = 'confetti'; confetti.style.left = `${Math.random() * 100}%`; confetti.style.animationDelay = `${Math.random() * 1.5}s`; confetti.style.animationDuration = `${2 + Math.random() * 3}s`; const color = colors[Math.floor(Math.random() * colors.length)]; confetti.style.backgroundColor = color; const size = Math.random() * 10 + 5; confetti.style.width = `${size}px`; confetti.style.height = `${size}px`;
    const rotation = Math.random() * 360; const fallX = (Math.random() - 0.5) * 100; confetti.style.setProperty('--fall-x', `${fallX}px`); confetti.style.setProperty('--rotation-start', `${rotation}deg`); confetti.style.setProperty('--rotation-end', `${rotation + (Math.random() - 0.5) * 720}deg`);
    const shape = Math.random(); if (shape < 0.33) { confetti.style.borderRadius = '50%'; } else { confetti.style.borderRadius = '0'; } confettiContainer.appendChild(confetti);
  }
}

// clearConfetti - (Unchanged from previous version)
function clearConfetti() {
    if (confettiContainer) { confettiContainer.innerHTML = ''; }
    const winnerPulseStyle = document.getElementById('winner-pulse-style'); if (winnerPulseStyle) { winnerPulseStyle.remove(); }
    document.querySelectorAll('.roulette-item.winner-highlight').forEach(el => { el.classList.remove('winner-highlight'); el.style.transform = ''; if(el.dataset.userId) el.style.borderColor = getUserColor(el.dataset.userId); else el.style.borderColor = 'transparent'; });
}

// resetToJackpotView - (Unchanged from previous version)
function resetToJackpotView() {
    console.log("Resetting to jackpot view");
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Animation frame cancelled by reset."); }
    if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval); if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); if (window.winnerFadeInInterval) clearInterval(window.winnerFadeInInterval); if (window.typeDepositInterval) clearInterval(window.typeDepositInterval); if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);
    isSpinning = false;
    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) { console.error("Missing elements for reset."); return; }
    if (spinSound && !spinSound.paused) { spinSound.pause(); spinSound.currentTime = 0; spinSound.volume = 1.0; spinSound.playbackRate = 1.0; }
    inlineRoulette.style.transition = 'opacity 0.5s ease'; inlineRoulette.style.opacity = '0'; clearConfetti();
    setTimeout(() => {
        jackpotHeader.classList.remove('roulette-mode'); rouletteTrack.style.transition = 'none'; rouletteTrack.style.transform = 'translateX(0)'; rouletteTrack.innerHTML = ''; inlineRoulette.style.display = 'none'; winnerInfo.style.display = 'none';
        const value = jackpotHeader.querySelector('.jackpot-value'); const timer = jackpotHeader.querySelector('.jackpot-timer'); const stats = jackpotHeader.querySelector('.jackpot-stats');
        [value, timer, stats].forEach((el, index) => { if (el) { el.style.display = 'flex'; el.style.opacity = '0'; setTimeout(() => { el.style.transition = 'opacity 0.5s ease'; el.style.opacity = '1'; }, 50 + index * 50); } });
        timerActive = false; spinStartTime = 0; if (roundTimer) { clearInterval(roundTimer); roundTimer = null; } initiateNewRoundVisualReset();
        console.log("Requesting fresh round data after reset."); socket.emit('requestRoundData');
    }, 500);
}

// initiateNewRoundVisualReset - (Unchanged from previous version)
function initiateNewRoundVisualReset() {
    console.log("Visual reset for next round"); updateTimerUI(120);
    if(timerValue) { timerValue.classList.remove('urgent-pulse', 'timer-pulse'); timerValue.textContent = '120'; }
    if (participantsContainer && emptyPotMessage) { participantsContainer.innerHTML = ''; if (!participantsContainer.contains(emptyPotMessage)) { participantsContainer.appendChild(emptyPotMessage); } emptyPotMessage.style.display = 'block'; }
    if (potValue) potValue.textContent = "$0.00"; if (participantCount) participantCount.textContent = "0/200";
}

// findWinnerFromData - (Unchanged from previous version)
function findWinnerFromData(winnerData) {
    const winnerId = winnerData?.winner?.id; if (!winnerId) { console.error("Missing winner ID:", winnerData); return null; }
    if (!currentRound || !currentRound.participants) { console.error("Missing round/participants data."); if (winnerData.winner) { return { user: { ...winnerData.winner }, percentage: 0, value: 0 }; } return null; }
    const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winnerId);
    if (!winnerParticipant) { console.warn(`Winner ID ${winnerId} not found locally.`); if (winnerData.winner) { return { user: { ...winnerData.winner }, percentage: 0, value: 0 }; } return null; }
    const totalValue = currentRound.totalValue > 0 ? currentRound.totalValue : 1; const percentage = (winnerParticipant.itemsValue / totalValue) * 100;
    return { user: { ...winnerParticipant.user }, percentage: percentage || 0, value: winnerParticipant.itemsValue || 0 };
}


// testRouletteAnimation - (Unchanged from previous version)
function testRouletteAnimation() {
  console.log("--- TESTING ROULETTE ANIMATION (BOUNCE DISABLED) ---");
  if (isSpinning) { console.log("Already spinning"); return; }
  let testData = currentRound;
  if (!testData || !testData.participants || testData.participants.length === 0) {
    console.log('Using sample test data...');
    testData = {
      roundId: `test-${Date.now()}`, status: 'active', totalValue: 194.66,
      participants: [ { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 }, { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 }, { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 }, { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 } ],
      items: [ { owner: 'test_user_1', name: 'AK-47 | Redline', price: 15.50, image: '/img/default-item.png' }, { owner: 'test_user_1', name: 'AWP | Asiimov', price: 70.19, image: '/img/default-item.png' }, { owner: 'test_user_2', name: 'Glock-18 | Water Elem...', price: 1.39, image: '/img/default-item.png' }, { owner: 'test_user_3', name: 'USP-S | Cortex', price: 1.04, image: '/img/default-item.png' }, ]
    };
    currentRound = testData; updateParticipantsUI(); // Update UI with mock participants
  }
  if (!testData.participants || testData.participants.length === 0) { showNotification('Test Error', 'No participants for test'); return; }
  const idx = Math.floor(Math.random() * testData.participants.length); const p = testData.participants[idx];
  const mockData = { roundId: testData.roundId, winner: p.user, winningTicket: Math.floor(Math.random() * (p.tickets || 1)) + 1 };
  console.log('Test Winner:', mockData.winner.username); handleWinnerAnnouncement(mockData);
}

// --- Provably Fair Functions (Unchanged) ---
async function verifyRound() {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed'), resultEl = document.getElementById('verification-result');
    if (!idInput || !sSeedInput || !cSeedInput || !resultEl) { console.error("Verify form elements missing."); return; }
    const roundId = idInput.value.trim(), serverSeed = sSeedInput.value.trim(), clientSeed = cSeedInput.value.trim();
    if (!roundId || !serverSeed || !clientSeed) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Please fill in all fields.</p>'; return; }
    if (serverSeed.length !== 64 || !/^[a-f0-9]{64}$/i.test(serverSeed)) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Invalid Server Seed format.</p>'; return; }
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
             const serverSeedStr = round.serverSeed || ''; const clientSeedStr = round.clientSeed || '';
             row.innerHTML = `<td>#${round.roundId||'N/A'}</td><td>${date}</td><td>$${round.totalValue?round.totalValue.toFixed(2):'0.00'}</td><td>${round.winner?(round.winner.username||'N/A'):'N/A'}</td><td><button class="btn btn-details" onclick="showRoundDetails(${round.roundId})">Details</button><button class="btn btn-verify" onclick="populateVerificationFields(${round.roundId}, '${serverSeedStr}', '${clientSeedStr}')" ${!round.serverSeed ? 'disabled title="Seed not revealed yet"' : ''}>Verify</button></td>`;
            row.dataset.roundId = round.roundId; roundsTableBody.appendChild(row);
        });
        createPagination(data.currentPage, data.totalPages);
    } catch (error) { roundsTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading rounds: ${error.message}</td></tr>`; console.error('Error loading rounds:', error); }
}
function populateVerificationFields(roundId, serverSeed, clientSeed) {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed');
    if (idInput) idInput.value = roundId || ''; if (sSeedInput) sSeedInput.value = serverSeed || ''; if (cSeedInput) cSeedInput.value = clientSeed || '';
    const verificationSection = document.getElementById('provably-fair-verification'); if (verificationSection) { verificationSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (!serverSeed && roundId) { showNotification('Info', `Server Seed for Round #${roundId} is revealed after the round ends.`); }
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
    else { const pages = []; pages.push(1); const rangeStart = Math.max(2, currentPage - 1); const rangeEnd = Math.min(totalPages - 1, currentPage + 1); if (rangeStart > 2) pages.push('...'); for (let i = rangeStart; i <= rangeEnd; i++) { pages.push(i); } if (rangeEnd < totalPages - 1) pages.push('...'); pages.push(totalPages); pages.forEach(page => { if (page === '...') roundsPagination.appendChild(createButton('...', null, false, true, true)); else roundsPagination.appendChild(createButton(page, page, page === currentPage)); }); }
    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
