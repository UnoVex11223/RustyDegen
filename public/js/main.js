// Connect to socket.io server
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
const ROULETTE_REPETITIONS = 20; // How many times to repeat participant list
const SPIN_DURATION_SECONDS = 9; // 9 seconds
const WINNER_DISPLAY_DURATION = 7000; // 7 seconds as requested
const CONFETTI_COUNT = 120; // Number of confetti particles

// Animation constants for enhanced roulette
const INITIAL_SPEED_PHASE = 0.08; // First 8% is acceleration
const CONSTANT_SPEED_PHASE = 0.10; // Middle 10% is constant speed
const SLOWDOWN_PHASE = 0.08;     // Final 8% is dramatic slowdown
const BOUNCE_COUNT = 0;          // Number of small bounces at the end
const BOUNCE_AMPLITUDE = 0;   // Size of the bounces (5% of the animation distance)

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
  '#8d6e63'  // Brown
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

// Completely redesigned easing function for more dramatic and smooth animation
function improvedEasing(t) {
  // Phase 1: Acceleration (0-15% of time)
  if (t < INITIAL_SPEED_PHASE) {
    // Quadratic ease-in for smooth acceleration
    return Math.pow(t / INITIAL_SPEED_PHASE, 2) * 0.2;
  }
  
  // Phase 2: Constant high speed (15-80% of time)
  else if (t < INITIAL_SPEED_PHASE + CONSTANT_SPEED_PHASE) {
    // Linear movement with normalized progress
    const phaseProgress = (t - INITIAL_SPEED_PHASE) / CONSTANT_SPEED_PHASE;
    return 0.2 + phaseProgress * 0.6; // Move from 20% to 80% during this phase
  }
  
  // Phase 3: Dramatic slowdown with bounces (80-100%)
  else {
    // Calculate progress within slowdown phase
    const phaseProgress = (t - (INITIAL_SPEED_PHASE + CONSTANT_SPEED_PHASE)) / SLOWDOWN_PHASE;
    
    // Base progress with cubic ease-out for natural slowdown
    const baseProgress = 0.8 + (1 - Math.pow(1 - phaseProgress, 3)) * 0.2;
    
    // Add bouncing effect with decreasing amplitude
    if (phaseProgress > 0.5) {
      // Only add bounces in the latter half of the slowdown
      const bounceFactor = (phaseProgress - 0.5) * 2; // Normalize to 0-1 range
      const bounceDecay = 1 - bounceFactor; // Bounces get smaller over time
      
      // Create sine wave oscillation with decreasing amplitude
      const bounceValue = Math.sin(bounceFactor * Math.PI * BOUNCE_COUNT) * BOUNCE_AMPLITUDE * bounceDecay;
      
      return baseProgress + bounceValue;
    }
    
    return baseProgress;
  }
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

    // Add keyboard event listeners for spinning
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
        if (currentRound && currentRound.roundId === data.roundId) handleWinnerAnnouncement(data);
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
        console.log('Received initial round data:', data); if (!data) { console.error("Invalid round data."); return; }
        currentRound = data; updateRoundUI();
        if (currentRound.status === 'rolling' && currentRound.winner) {
            console.log("Connected during rolling phase.");
            // Optionally trigger animation if needed, careful not to double-spin
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
    if (!currentRound || currentRound.status !== 'active') { showNotification('Deposit Error', 'Wait for next round.'); return; }
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
    updateTimerCircle(timeToShow, 120);
    if (timerActive && timeToShow <= 10 && timeToShow > 0) { timerValue.classList.add('urgent-pulse'); timerValue.classList.remove('timer-pulse'); }
    else { timerValue.classList.remove('urgent-pulse'); if (timerActive && timeToShow > 10) timerValue.classList.add('timer-pulse'); else timerValue.classList.remove('timer-pulse'); }
}

// Handle new deposit
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || data.itemsValue === undefined || data.totalValue === undefined) { console.error("Invalid participant update:", data); return; }
    if (!currentRound) { console.warn("Deposit for non-existent round."); currentRound = { roundId: data.roundId, status: 'active', timeLeft: 120, totalValue: 0, participants: [], items: [] }; }
    else if (currentRound.roundId !== data.roundId) { console.warn(`Deposit for wrong round (${data.roundId}).`); return; }
    if (!currentRound.participants) currentRound.participants = [];
    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => { if (p.user && p.user.id === data.userId) { participantFound = true; return { ...p, itemsValue: (p.itemsValue || 0) + data.itemsValue, tickets: data.tickets }; } return p; });
    if (!participantFound) currentRound.participants.push({ user: { id: data.userId, username: data.username || 'Unknown', avatar: data.avatar || '/img/default-avatar.png' }, itemsValue: data.itemsValue, tickets: data.tickets });
    currentRound.totalValue = data.totalValue;
    if (data.depositedItems && Array.isArray(data.depositedItems)) { if (!currentRound.items) currentRound.items = []; data.depositedItems.forEach(item => currentRound.items.push({ ...item, owner: data.userId })); }
    updateRoundUI();
    // Start timer only if exactly 2 participants and timer isn't already active
    if (currentRound.status === 'active' && currentRound.participants.length >= 2 && !timerActive) {
        console.log("Threshold reached. Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120);
    }
}

// Start client timer
function startClientTimer(initialTime = 120) {
    if (!timerValue) return; if (roundTimer) clearInterval(roundTimer);
    let timeLeft = Math.max(0, initialTime); console.log(`Starting client timer from ${timeLeft}s`); updateTimerUI(timeLeft);
    roundTimer = setInterval(() => {
        if (!timerActive) { clearInterval(roundTimer); roundTimer = null; console.log("Client timer stopped (not active)."); return; }
        timeLeft--; updateTimerUI(timeLeft);
        if (timeLeft <= 0) { clearInterval(roundTimer); roundTimer = null; timerActive = false; console.log("Client timer zero."); if(timerValue) timerValue.textContent = "Ending"; }
    }, 1000);
}

// Update timer circle
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return; const circumference = 2 * Math.PI * 42; // 2 * PI * r
    const progress = Math.min(1, Math.max(0, timeLeft / totalTime)); const offset = circumference * (1 - progress);
    timerForeground.style.strokeDasharray = `${circumference}`; timerForeground.style.strokeDashoffset = `${Math.max(0, offset)}`;
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
    headerElement.style.borderLeft = `4px solid ${userColor}`;
    
    headerElement.innerHTML = `<div class="participant-info"><img src="${avatar}" alt="${username}" class="participant-avatar" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor}"><div class="participant-details"><span class="participant-name" title="${username}">${username}</span><div class="participant-stats"><span class="participant-value" title="Deposited Value" style="color: ${userColor}">$${participant.itemsValue.toFixed(2)}</span><span class="participant-percentage" title="Win Chance">${percentage.toFixed(2)}%</span></div></div></div>`;
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

// =================== ENHANCED ROULETTE ANIMATION ===================

// Enhanced roulette item creation with consistent colors per user and more items for smoother animation
function createRouletteItems() {
  if (!rouletteTrack || !inlineRoulette) { 
    console.error("Track or inline roulette element missing."); 
    return; 
  }
  
  rouletteTrack.innerHTML = ''; 
  rouletteTrack.style.transition = 'none'; 
  rouletteTrack.style.transform = 'translateX(0)';
  
  if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { 
    console.error('No participants data.'); 
    return; 
  }
  
  let ticketPool = [];
  // Calculate tickets based on value ($0.01 = 1 ticket) or use server-provided tickets
  currentRound.participants.forEach(p => {
    const t = p.tickets !== undefined ? p.tickets : Math.max(1, Math.floor((p.itemsValue || 0) * 100));
    // Create proportional representation for smoother animation
    const ticketCount = Math.max(5, Math.ceil((t / Math.max(1, currentRound.totalValue * 100)) * 100));
    for (let i = 0; i < ticketCount; i++) ticketPool.push(p);
  });
  
  if (ticketPool.length === 0) { 
    console.error("Ticket pool empty."); 
    return; 
  }
  
  // Shuffle the initial pool for more randomness and visual interest
  ticketPool = shuffleArray([...ticketPool]);

  // Estimate items needed for smooth animation
  const container = inlineRoulette.querySelector('.roulette-container');
  const containerWidth = container?.offsetWidth || 1000; // Fallback width if needed
  const itemWidth = 90 + 10; // Item width + margin
  
  // Create significantly more items for the enhanced animation
  // More items = smoother animation and more dramatic effect
  const minItemsNeeded = Math.ceil(containerWidth / itemWidth) * 4; // At least 4 times the viewport width
  const itemsForAnimation = Math.max(minItemsNeeded, 500); // At least 500 items for smooth animation
  
  console.log(`Creating ${itemsForAnimation} roulette items for smooth animation`);
  
  // Create items with optimal batching
  const batchSize = 100; // Batch DOM updates for performance
  let currentBatch = document.createDocumentFragment();
  let batchCount = 0;
  
  for (let i = 0; i < itemsForAnimation; i++) {
    const participant = ticketPool[i % ticketPool.length]; 
    if (!participant || !participant.user) continue;
    
    const userId = participant.user.id;
    const userColor = getUserColor(userId);
    
    const item = document.createElement('div');
    item.className = 'roulette-item';
    item.dataset.userId = userId;
    
    // Apply user-specific color
    item.style.borderColor = userColor;
    
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
    
    currentBatch.appendChild(item);
    
    // Append batch when full or on last item
    if (++batchCount === batchSize || i === itemsForAnimation - 1) {
      rouletteTrack.appendChild(currentBatch);
      currentBatch = document.createDocumentFragment();
      batchCount = 0;
    }
  }
  
  console.log(`Created ${itemsForAnimation} items for smooth roulette animation.`);
}

function handleWinnerAnnouncement(data) {
    if (isSpinning) { console.warn("Already spinning."); return; }
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error("Missing participant data for winner."); resetToJackpotView(); return; }
    if (!data || !data.winner || !data.winner.id) { console.error("Invalid winner data."); resetToJackpotView(); return; }
    console.log(`Winner announced: ${data.winner.username}`);
    if (timerActive) { timerActive = false; clearInterval(roundTimer); roundTimer = null; console.log("Stopped client timer."); }
    switchToRouletteView(); 
    
    // Small delay before starting animation for dramatic effect
    setTimeout(() => {
      startRouletteAnimation(data);
    }, 500);
}

// Initialize enhanced styles when switching to roulette view
function switchToRouletteView() {
  if (!jackpotHeader || !inlineRoulette) { 
    console.error("Missing roulette UI elements."); 
    return; 
  }
  
  const value = jackpotHeader.querySelector('.jackpot-value');
  const timer = jackpotHeader.querySelector('.jackpot-timer');
  const stats = jackpotHeader.querySelector('.jackpot-stats');
  
  // Fade out the jackpot header elements first
  if (value) {
    value.style.transition = 'opacity 0.5s ease';
    value.style.opacity = '0';
    setTimeout(() => value.style.display = 'none', 500);
  }
  
  if (timer) {
    timer.style.transition = 'opacity 0.5s ease';
    timer.style.opacity = '0';
    setTimeout(() => timer.style.display = 'none', 500);
  }
  
  if (stats) {
    stats.style.transition = 'opacity 0.5s ease';
    stats.style.opacity = '0';
    setTimeout(() => stats.style.display = 'none', 500);
  }
  
  // Add roulette mode class for background changes
  jackpotHeader.classList.add('roulette-mode');
  
  // Prepare roulette container but keep hidden
  inlineRoulette.style.display = 'block';
  inlineRoulette.style.opacity = '0';
  inlineRoulette.style.transform = 'translateY(20px)';
  
  // Fade in the roulette container after the header elements fade out
  setTimeout(() => {
    inlineRoulette.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    inlineRoulette.style.opacity = '1';
    inlineRoulette.style.transform = 'translateY(0)';
  }, 600);
  
  // Hide return button
  if (returnToJackpot) returnToJackpot.style.display = 'none';
}

// Completely rewritten roulette animation
function startRouletteAnimation(winnerData) {
  if (!rouletteTrack || !winnerInfo) { 
    console.error("Missing animation elements."); 
    isSpinning = false; 
    resetToJackpotView(); 
    return; 
  }
  
  // Cancel any ongoing animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  isSpinning = true;
  spinStartTime = performance.now();
  winnerInfo.style.display = 'none';
  clearConfetti();
  
  // Create roulette items with better distribution
  createRouletteItems();

  const winner = findWinnerFromData(winnerData);
  if (!winner) { 
    console.error('Could not find winner details.'); 
    isSpinning = false; 
    resetToJackpotView(); 
    return; 
  }
  
  console.log('Starting enhanced animation for Winner:', winner.user.username);

  // Play sound with fade-in effect
  if (spinSound) {
    spinSound.volume = 0;
    spinSound.currentTime = 0;
    spinSound.play().catch(e => console.error('Error playing sound:', e));
    
    // Fade in sound
    let volume = 0;
    const fadeIn = setInterval(() => {
      volume += 0.05;
      if (volume >= 1) {
        spinSound.volume = 1;
        clearInterval(fadeIn);
      } else {
        spinSound.volume = volume;
      }
    }, 50);
  }

  // Give time for DOM to render all items before starting animation
  setTimeout(() => {
    const items = rouletteTrack.querySelectorAll('.roulette-item');
    if (items.length === 0) { 
      console.error('Cannot spin, no items rendered.'); 
      isSpinning = false; 
      resetToJackpotView(); 
      return; 
    }
    
    // Find suitable winning element - aiming for end of animation
    // Target the latter part of the strip but not too close to the end
    const minIndex = Math.floor(items.length * 0.65);
    const maxIndex = Math.floor(items.length * 0.85);
    const winnerItems = [];
    
    // Find all items matching the winner ID within our target range
    for (let i = minIndex; i <= maxIndex; i++) {
      if (items[i] && items[i].dataset.userId === winner.user.id) {
        winnerItems.push(i);
      }
    }
    
    // If no matching items in preferred range, expand search
    if (winnerItems.length === 0) {
      console.warn(`No winner items found in preferred range. Expanding search.`);
      for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].dataset.userId === winner.user.id) {
          winnerItems.push(i);
        }
      }
    }
    
    // Still no matching items? Fall back to a random item
    if (winnerItems.length === 0) {
      console.error(`No items found matching winner ID ${winner.user.id}. Using fallback.`);
      const randomIndex = Math.floor(items.length * 0.75); // Target 3/4 through the list
      const winningElement = items[randomIndex];
      handleRouletteSpinAnimation(winningElement, winner);
      return;
    }
    
    // Choose a random item from our collected winner items
    const targetIndex = winnerItems[Math.floor(Math.random() * winnerItems.length)];
    const winningElement = items[targetIndex];
    
    console.log(`Selected winning element at index ${targetIndex} of ${items.length} total items`);
    handleRouletteSpinAnimation(winningElement, winner);
  }, 100); // Small delay to ensure DOM is ready
}

// Separate function to handle the actual animation
function handleRouletteSpinAnimation(winningElement, winner) {
  if (!winningElement || !rouletteTrack || !inlineRoulette) {
    console.error("Missing elements for animation");
    isSpinning = false;
    resetToJackpotView();
    return;
  }
  
  const container = inlineRoulette.querySelector('.roulette-container');
  if (!container) {
    console.error("Roulette container missing");
    isSpinning = false;
    resetToJackpotView();
    return;
  }
  
  // Calculate positioning
  const containerWidth = container.offsetWidth;
  const itemWidth = winningElement.offsetWidth || 90;
  const itemMargin = 10; // Account for margin between items
  const itemOffsetLeft = winningElement.offsetLeft;
  
  // Center the winning item under the ticker line
  const centerOffset = (containerWidth / 2) - (itemWidth / 2);
  const targetScrollPosition = -(itemOffsetLeft - centerOffset);
  
  // Add tiny random offset for natural feel (but keep it small for precision)
  const randomOffset = (Math.random() - 0.5) * (itemWidth * 0.15);
  const finalTargetPosition = targetScrollPosition + randomOffset;
  
  // Remember our starting position
  rouletteTrack.style.transition = 'none';
  const startPosition = 0;
  
  // Animation variables
  const duration = SPIN_DURATION_SECONDS * 1000; // Convert to milliseconds
  
  // Add initial shake animation
  let shakePhase = true;
  let shakeDuration = 1000; // 1 second of shaking
  let shakeStartTime = performance.now();
  let lastShakeTime = shakeStartTime;
  let shakeAmount = 3; // pixels
  
  function shakeAnimation(timestamp) {
    if (!shakePhase) return false;
    
    const elapsed = timestamp - shakeStartTime;
    if (elapsed >= shakeDuration) {
      shakePhase = false;
      return false;
    }
    
    // Only update position every 16ms (approx. 60fps) for performance
    if (timestamp - lastShakeTime > 16) {
      lastShakeTime = timestamp;
      
      // Decrease shake amount as we progress
      const remainingShakeFactor = 1 - (elapsed / shakeDuration);
      const currentShakeAmount = shakeAmount * remainingShakeFactor;
      
      // Random shake amount
      const shake = (Math.random() - 0.5) * currentShakeAmount * 2;
      rouletteTrack.style.transform = `translateX(${shake}px)`;
    }
    
    return true;
  }
  
  // Main animation function
  function animateRoulette(timestamp) {
    // If we're still in shake phase, handle that first
    if (shakeAnimation(timestamp)) {
      animationFrameId = requestAnimationFrame(animateRoulette);
      return;
    }
    
    // Calculate progress based on time elapsed since the main animation started
    // (after the shake phase)
    let elapsed;
    if (!spinStartTime || spinStartTime === 0) {
      // If this is the first frame after shaking, set the spin start time
      spinStartTime = timestamp;
      elapsed = 0;
    } else {
      elapsed = timestamp - spinStartTime;
    }
    
    // Calculate normalized progress (0 to 1)
    let progress = Math.min(1, elapsed / duration);
    
    // Apply our improved easing function
    const easedProgress = improvedEasing(progress);
    
    // Calculate current position with easing
    const currentPosition = startPosition + (finalTargetPosition - startPosition) * easedProgress;
    rouletteTrack.style.transform = `translateX(${currentPosition}px)`;
    
    // Update sound pitch/speed based on animation phase
    if (spinSound && !spinSound.paused) {
      // For first 20% of animation, gradually increase playback rate
      if (progress < 0.2) {
        spinSound.playbackRate = 0.8 + (progress * 1.5);
      }
      // For last 30% of animation, gradually decrease playback rate
      else if (progress > 0.7) {
        const slowdownProgress = (progress - 0.7) / 0.3;
        spinSound.playbackRate = Math.max(0.5, 1.6 - (slowdownProgress * 1.1));
      }
      // Middle section stays at slightly faster rate
      else {
        spinSound.playbackRate = 1.5;
      }
    }
    
    // Continue animation if not finished
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animateRoulette);
    } else {
      // Animation completed
      console.log("Enhanced animation finished");
      rouletteTrack.style.transform = `translateX(${finalTargetPosition}px)`;
      animationFrameId = null;
      
      // Highlight winner with user-specific color
      if (winningElement) {
        const userColor = getUserColor(winner.user.id);
        winningElement.classList.add('winner-highlight');
        
        // Apply dynamic pulsing animation with user color
        const style = document.createElement('style');
        style.id = 'winner-pulse-style';
        style.textContent = `
          .winner-highlight {
            animation: winnerPulse 1.5s infinite;
            box-shadow: 0 0 25px ${userColor};
            z-index: 5;
            border-width: 3px;
          }
          @keyframes winnerPulse {
            0% { box-shadow: 0 0 20px ${userColor}; border-color: ${userColor}; transform: scale(1); }
            50% { box-shadow: 0 0 30px ${userColor}; border-color: ${userColor}; transform: scale(1.05);}
            100% { box-shadow: 0 0 20px ${userColor}; border-color: ${userColor}; transform: scale(1);}
          }
        `;
        
        // Remove any existing winner pulse style
        const existingStyle = document.getElementById('winner-pulse-style');
        if (existingStyle) existingStyle.remove();
        
        document.head.appendChild(style);
      }
      
      // Fade out audio
      if (spinSound && !spinSound.paused) {
        let volume = spinSound.volume;
        const fadeOut = setInterval(() => {
          volume -= 0.05;
          if (volume <= 0) {
            spinSound.pause();
            spinSound.volume = 1.0; // Reset for next time
            clearInterval(fadeOut);
          } else {
            spinSound.volume = volume;
          }
        }, 60);
      }
      
      // Show winner info after a short pause
      setTimeout(() => {
        handleSpinEnd(winningElement, winner);
      }, 800);
    }
  }
  
  // Start animation
  animationFrameId = requestAnimationFrame(animateRoulette);
}

// Enhanced winner celebration
function handleSpinEnd(winningElement, winner) {
  if (!isSpinning) {
    console.warn("handleSpinEnd called but spin seems already reset");
    return;
  }
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  isSpinning = false;
  console.log("Handling spin end with enhanced winner celebration");

  // Staggered winner reveal for more dramatic effect
  setTimeout(() => {
    if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
      // Apply user color to winner display elements
      const userColor = getUserColor(winner.user.id);
      
      winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
      winnerAvatar.alt = winner.user.username || 'Winner';
      winnerAvatar.style.borderColor = userColor;
      winnerAvatar.style.boxShadow = `0 0 15px ${userColor}`;
      
      winnerName.textContent = winner.user.username || 'Winner';
      winnerName.style.color = userColor;
      
      // Prepare dynamic content
      const depositValue = `$${(winner.value || 0).toFixed(2)}`;
      const chanceValue = `${(winner.percentage || 0).toFixed(2)}%`;
      
      // Initial empty state
      winnerDeposit.textContent = '';
      winnerChance.textContent = '';
      
      // Reveal winner info with fade in
      winnerInfo.style.display = 'flex';
      winnerInfo.style.opacity = '0';
      
      // Animate in with a smooth fade
      let opacity = 0;
      const fadeStep = 0.05;
      const fadeIn = setInterval(() => {
        opacity += fadeStep;
        winnerInfo.style.opacity = opacity.toString();
        
        if (opacity >= 1) {
          clearInterval(fadeIn);
          
          // Now do typing effect for values
          let depositIndex = 0;
          let chanceIndex = 0;
          
          // Type deposit value
          const typeDeposit = setInterval(() => {
            winnerDeposit.textContent += depositValue[depositIndex];
            depositIndex++;
            
            if (depositIndex >= depositValue.length) {
              clearInterval(typeDeposit);
              
              // Type chance value after deposit completes
              const typeChance = setInterval(() => {
                winnerChance.textContent += chanceValue[chanceIndex];
                chanceIndex++;
                
                if (chanceIndex >= chanceValue.length) {
                  clearInterval(typeChance);
                  
                  // Launch confetti with winning color
                  setTimeout(() => {
                    launchConfetti(userColor);
                  }, 300);
                }
              }, 40); // Faster typing
            }
          }, 40); // Faster typing
        }
      }, 20); // Smoother fade
      
      // Auto-reset after display duration
      setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);
    } else {
      console.error("Winner data/elements incomplete for display");
      resetToJackpotView();
    }
  }, 500); // Shorter delay to keep momentum
}

// Enhanced confetti with user color
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
    
    // Randomize shape
    const shape = Math.random();
    if (shape < 0.33) {
      confetti.style.borderRadius = '50%'; // Circle
    } else if (shape < 0.66) {
      confetti.style.borderRadius = '0'; // Square
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`; // Random rotation
    } else {
      // Stars and custom shapes
      if (Math.random() > 0.5) {
        confetti.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'; // Star
      } else {
        confetti.style.borderRadius = '0';
        confetti.style.transform = 'rotate(45deg)'; // Diamond
      }
    }
    
    confettiContainer.appendChild(confetti);
  }
}

function resetToJackpotView() {
    console.log("Resetting to jackpot view");
    
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) { 
        console.error("Missing elements for reset"); 
        return; 
    }
    
    // Fade out roulette first
    inlineRoulette.style.transition = 'opacity 0.5s ease';
    inlineRoulette.style.opacity = '0';
    
    // After roulette fades out, reset everything
    setTimeout(() => {
        // Return header to normal state
        jackpotHeader.classList.remove('roulette-mode');
        
        // Reset roulette track
        rouletteTrack.style.transition = 'none';
        rouletteTrack.style.transform = 'translateX(0)'; 
        clearConfetti();
        
        // Clear roulette items to free memory
        rouletteTrack.innerHTML = '';
        
        // Hide roulette and winner info
        inlineRoulette.style.display = 'none';
        winnerInfo.style.display = 'none';
        
        // Show jackpot UI elements
        const value = jackpotHeader.querySelector('.jackpot-value');
        const timer = jackpotHeader.querySelector('.jackpot-timer');
        const stats = jackpotHeader.querySelector('.jackpot-stats');
        
        if (value) {
            value.style.display = 'flex';
            value.style.opacity = '0';
            setTimeout(() => {
                value.style.transition = 'opacity 0.5s ease';
                value.style.opacity = '1';
            }, 50);
        }
        
        if (timer) {
            timer.style.display = 'flex';
            timer.style.opacity = '0';
            setTimeout(() => {
                timer.style.transition = 'opacity 0.5s ease';
                timer.style.opacity = '1';
            }, 100);
        }
        
        if (stats) {
            stats.style.display = 'flex';
            stats.style.opacity = '0';
            setTimeout(() => {
                stats.style.transition = 'opacity 0.5s ease';
                stats.style.opacity = '1';
            }, 150);
        }
        
        // Reset state variables
        isSpinning = false;
        timerActive = false;
        spinStartTime = 0;
        
        if (roundTimer) {
            clearInterval(roundTimer);
            roundTimer = null;
        }
        
        // Reset UI for next round
        initiateNewRoundVisualReset();
        
        // Get the latest round data
        socket.emit('requestRoundData');
    }, 500);
}

function initiateNewRoundVisualReset() {
    console.log("Visual reset for next round"); 
    updateTimerUI(120); 
    
    if(timerValue) {
        timerValue.classList.remove('urgent-pulse', 'timer-pulse');
    }
    
    if (participantsContainer && emptyPotMessage) {
        participantsContainer.innerHTML = ''; // Clear participants
        
        // Ensure empty message exists and is shown
        if (!participantsContainer.contains(emptyPotMessage)) {
             participantsContainer.appendChild(emptyPotMessage);
        }
        emptyPotMessage.style.display = 'block';
    }
    
    if (potValue) potValue.textContent = "$0.00"; 
    if (participantCount) participantCount.textContent = "0/200";
}

// Find winner details
function findWinnerFromData(winnerData) {
    if (!currentRound || !currentRound.participants || !winnerData || !winnerData.winner || !winnerData.winner.id) { 
        console.error("Missing data for findWinner"); 
        return null; 
    }
    
    const winnerId = winnerData.winner.id; 
    const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winnerId);
    
    if (!winnerParticipant) { 
        console.warn(`Winner ID ${winnerId} not found locally`); 
        return { 
            user: { ...winnerData.winner }, 
            percentage: 0, 
            value: 0 
        }; 
    }
    
    const totalValue = currentRound.totalValue > 0 ? currentRound.totalValue : 1; // Avoid division by zero
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;
    
    return { 
        user: { ...winnerParticipant.user }, 
        percentage: percentage || 0, 
        value: winnerParticipant.itemsValue || 0 
    };
}

// Confetti
function clearConfetti() { 
    if (confettiContainer) {
        confettiContainer.innerHTML = ''; 
    }
}

// Test function for the roulette animation
function testRouletteAnimation() {
  console.log("--- TESTING ENHANCED ROULETTE ANIMATION ---"); 
  
  if (isSpinning) { 
    console.log("Already spinning"); 
    return; 
  }
  
  // Use current round if available, otherwise mock data
  let testData = currentRound;
  if (!testData || !testData.participants || testData.participants.length === 0) {
    console.log('Using sample test data...');
    testData = {
      roundId: `test-${Date.now()}`, 
      status: 'active', 
      totalValue: 194.66,
      participants: [
        { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
        { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
        { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
        { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 }
      ],
      items: []
    };
    currentRound = testData;
    updateParticipantsUI();
  }

  if (!testData.participants || testData.participants.length === 0) { 
    showNotification('Test Error', 'No participants available for test'); 
    return; 
  }
  
  // Select random winner from the available participants
  const idx = Math.floor(Math.random() * testData.participants.length);
  const p = testData.participants[idx];
  const mockData = {
    roundId: testData.roundId,
    winner: p.user,
    winningTicket: Math.floor(Math.random() * (p.tickets || 1))
  };
  
  console.log('Test Winner:', mockData.winner.username);
  handleWinnerAnnouncement(mockData);
}

// =================== PROVABLY FAIR ===================
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
