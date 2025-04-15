// Connect to socket.io server
// Ensure the Socket.IO client library is included in your HTML:
// <script src="/socket.io/socket.io.js"></script>
const socket = io();

// DOM Elements - Navigation
const homeLink = document.getElementById('home-link'); // Use ID for reliability
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
const SPIN_DURATION_SECONDS = 12;
const WINNER_DISPLAY_DURATION = 5000;
const CONFETTI_COUNT = 100;

// App State
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false;
let timerActive = false;
let roundTimer = null;
let animationFrameId = null;

// --- Helper Functions ---
function showModal(modalElement) {
    if (modalElement) modalElement.classList.add('active'); // Use class to show
    console.log('Showing modal:', modalElement?.id);
}

function hideModal(modalElement) {
    if (modalElement) modalElement.classList.remove('active'); // Use class to hide
    console.log('Hiding modal:', modalElement?.id);
}

function showPage(pageElement) {
    [homePage, faqPage, fairPage].forEach(page => { if (page) page.style.display = 'none'; });
    if (pageElement) pageElement.style.display = 'block';
    console.log('Showing page:', pageElement?.id);

    // Update active link
    document.querySelectorAll('.main-nav a').forEach(link => link.classList.remove('active'));
    if (pageElement === homePage && homeLink) homeLink.classList.add('active');
    else if (pageElement === faqPage && faqLink) faqLink.classList.add('active');
    else if (pageElement === fairPage && fairLink) fairLink.classList.add('active');

    // Load data if needed
    if (pageElement === fairPage) loadPastRounds();
}

function showNotification(title, message) {
    console.log(`Notification: ${title} - ${message}`);
    // Replace with a more robust notification system if available
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
// --- End Helper Functions ---

// --- Easing Function ---
function easeInOutSine(t) {
    // t is progress from 0 to 1
    return -(Math.cos(Math.PI * t) - 1) / 2;
}
// --- End Easing Function ---


// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }
    checkLoginStatus();
    setupEventListeners();
    setupSocketConnection();
    showPage(homePage); // Show home page by default
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

    // Roulette Reset Button
    if (returnToJackpot) returnToJackpot.addEventListener('click', resetToJackpotView);

    // Test Spin Button
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) testSpinButton.addEventListener('click', testRouletteAnimation);

    // Provably Fair Verify Button
    if (verifyBtn) verifyBtn.addEventListener('click', verifyRound);

    // Handle clicks outside modals to close them
    window.addEventListener('click', (e) => {
        // Check if the click target is the modal backdrop itself
        if (depositModal && e.target === depositModal) hideModal(depositModal);
        if (tradeUrlModal && e.target === tradeUrlModal) hideModal(tradeUrlModal);
        // Add other modals here if needed
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
    });
    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data); if (!data) { console.error("Invalid round data."); return; }
        currentRound = data; updateRoundUI();
        if (currentRound.status === 'rolling' && currentRound.winner) console.log("Connected during rolling phase.");
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
        // We need to find the original item object to pass back
        const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item;
        if (inventoryItemElement && originalItem) {
            toggleItemSelection(inventoryItemElement, originalItem);
        } else {
            // Fallback if the inventory element isn't found (e.g., inventory reloaded)
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
    // Basic validation - check for required parts
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') || !tradeUrl.includes('partner=') || !tradeUrl.includes('token=')) { showNotification('Invalid Format', 'Enter valid Steam Trade URL.'); return; }
    saveTradeUrl.disabled = true; saveTradeUrl.textContent = 'Saving...';
    try {
        const response = await fetch('/api/user/tradeurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tradeUrl }) });
        if (!response.ok) { const error = await response.json().catch(() => ({ error: 'Failed to save.' })); throw new Error(error.error || `Save fail (${response.status})`); }
        const result = await response.json(); if (currentUser) currentUser.tradeUrl = result.tradeUrl;
        hideModal(tradeUrlModal);
        // After saving, try opening the deposit modal again
        if (showDepositModal) showDepositModal.click(); // Simulate click to re-check conditions
        showNotification('Success', 'Trade URL saved.');
    } catch (error) { showNotification('Error Saving URL', error.message); console.error('Error updating trade URL:', error); }
    finally { saveTradeUrl.disabled = false; saveTradeUrl.textContent = 'Save Trade URL'; }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound || !potValue) return;
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;
    // Only update timer UI if the timer isn't actively running client-side
    if (!timerActive) {
        updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : 120);
    }
    updateParticipantsUI();
}

// Update timer UI
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;
    const timeToShow = Math.max(0, Math.round(timeLeft));
    if (timerActive || timeToShow > 0) timerValue.textContent = timeToShow; else if (isSpinning) timerValue.textContent = "Rolling"; else timerValue.textContent = "Ended";
    updateTimerCircle(timeToShow, 120); // Assuming 120s is the max time
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
    currentRound.participants = currentRound.participants.map(p => { if (p.user && p.user.id === data.userId) { participantFound = true; return { ...p, itemsValue: (p.itemsValue || 0) + data.itemsValue, tickets: data.tickets }; } return p; });
    if (!participantFound) currentRound.participants.push({ user: { id: data.userId, username: data.username || 'Unknown', avatar: data.avatar || '/img/default-avatar.png' }, itemsValue: data.itemsValue, tickets: data.tickets });
    currentRound.totalValue = data.totalValue;
    if (data.depositedItems && Array.isArray(data.depositedItems)) { if (!currentRound.items) currentRound.items = []; data.depositedItems.forEach(item => currentRound.items.push({ ...item, owner: data.userId })); }
    updateRoundUI();
    // Start timer only if exactly 2 participants and timer isn't already running
    if (currentRound.status === 'active' && currentRound.participants.length === 2 && !timerActive) {
        console.log("Threshold reached (2 participants). Starting timer.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || 120);
    } else if (currentRound.status === 'active' && currentRound.participants.length > 2 && !timerActive) {
         // If joining mid-round with >2 people, ensure timer is running
         console.log("Joined mid-round, ensuring timer is active.");
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
    if (!timerForeground) return; const circumference = 2 * Math.PI * 42; // 2 * PI * r (radius is 42 from SVG)
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
         if (!participantsContainer.contains(emptyPotMessage)) {
             participantsContainer.appendChild(emptyPotMessage);
         }
        return;
    } else { emptyPotMessage.style.display = 'none'; }
    // Sort participants by deposit value (highest first)
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
    const headerElement = document.createElement('div'); headerElement.className = 'participant-header';
    headerElement.innerHTML = `<div class="participant-info"><img src="${avatar}" alt="${username}" class="participant-avatar" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';"><div class="participant-details"><span class="participant-name" title="${username}">${username}</span><div class="participant-stats"><span class="participant-value" title="Deposited Value">$${participant.itemsValue.toFixed(2)}</span><span class="participant-percentage" title="Win Chance">${percentage.toFixed(2)}%</span></div></div></div>`;
    const itemsElement = document.createElement('div'); itemsElement.className = 'participant-items';
    if (items && items.length > 0) {
        items.sort((a, b) => (b.price || 0) - (a.price || 0)); // Sort items by price desc
        items.forEach(item => {
             if (!item || typeof item.price !== 'number' || !item.name || !item.image) return;
            const itemElement = document.createElement('div'); itemElement.className = 'item'; itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-item.png';"><span class="item-value">$${item.price.toFixed(2)}</span>`;
            itemsElement.appendChild(itemElement);
        });
    }
    participantElement.appendChild(headerElement); participantElement.appendChild(itemsElement); return participantElement;
}


// =================== ROULETTE ANIMATION ===================

function handleWinnerAnnouncement(data) {
    if (isSpinning) { console.warn("Already spinning."); return; }
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error("Missing participant data for winner."); resetToJackpotView(); return; }
    if (!data || !data.winner || !data.winner.id) { console.error("Invalid winner data."); resetToJackpotView(); return; }
    console.log(`Winner announced: ${data.winner.username}`);
    if (timerActive) { timerActive = false; clearInterval(roundTimer); roundTimer = null; console.log("Stopped client timer."); }
    switchToRouletteView(); startRouletteAnimation(data);
}

function switchToRouletteView() {
    if (!jackpotHeader || !inlineRoulette) { console.error("Missing roulette UI elements."); return; }
    // Jackpot header gets class, JS controls inline-roulette display
    jackpotHeader.classList.add('roulette-mode');
    inlineRoulette.style.display = 'flex'; // Use flex to enable centering
}

function startRouletteAnimation(winnerData) {
    if (!rouletteTrack || !winnerInfo || !returnToJackpot) { console.error("Missing animation elements."); isSpinning = false; resetToJackpotView(); return; }
    if (animationFrameId) cancelAnimationFrame(animationFrameId); // Cancel previous frame

    isSpinning = true; winnerInfo.style.display = 'none'; returnToJackpot.style.display = 'none';
    clearConfetti(); createRouletteItems();

    const winner = findWinnerFromData(winnerData);
    if (!winner) { console.error('Could not find winner details.'); isSpinning = false; resetToJackpotView(); return; }
    console.log('Starting JS animation for Winner:', winner.user.username);

    if (spinSound) { spinSound.currentTime = 0; spinSound.play().catch(e => console.error('Error playing sound:', e)); }

    // --- JavaScript Animation Setup ---
    const startTime = performance.now();
    const startPosition = 0;
    let finalTargetPosition = 0;

    // Get track/item dimensions AFTER creating items and allowing brief render time
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) { console.error('Cannot spin, no items rendered.'); isSpinning = false; resetToJackpotView(); return; }
        const targetIndex = findTargetItemIndex(items, winner.user.id);
        if (targetIndex === -1 || !items[targetIndex]) { console.error('Could not find winning element.'); isSpinning = false; resetToJackpotView(); return; }
        const winningElement = items[targetIndex]; console.log(`Targeting index ${targetIndex}`);
        const container = inlineRoulette.querySelector('.roulette-container'); if (!container) { console.error("Roulette container missing."); isSpinning = false; resetToJackpotView(); return; }
        const containerWidth = container.offsetWidth;
        const itemWidth = winningElement.offsetWidth || 90; // Use measured or fallback
        const itemMargin = 5; // Horizontal margin from CSS
        const totalItemWidth = itemWidth + (itemMargin * 2);
        const itemOffsetLeft = winningElement.offsetLeft;

        // Calculate the position needed to center the winning item under the ticker
        // Ticker is at 50% of container width
        // Target position = -(item's left edge + half item width - half container width)
        const targetScrollPosition = -(itemOffsetLeft + (itemWidth / 2) - (containerWidth / 2));

        // Add a random offset within the item's width for variability
        const randomOffset = (Math.random() - 0.5) * itemWidth * 0.6; // Smaller random range
        finalTargetPosition = targetScrollPosition + randomOffset;

        rouletteTrack.style.transition = 'none'; // Ensure no CSS transition interferes

        // --- Animation Loop ---
        function animationStep(currentTime) {
            const elapsedTime = currentTime - startTime;
            let progress = Math.min(1, elapsedTime / (SPIN_DURATION_SECONDS * 1000));
            const easedProgress = easeInOutSine(progress);
            const currentPosition = startPosition + (finalTargetPosition - startPosition) * easedProgress;
            rouletteTrack.style.transform = `translateX(${currentPosition}px)`;

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animationStep);
            } else {
                console.log("JS Animation finished.");
                rouletteTrack.style.transform = `translateX(${finalTargetPosition}px)`;
                animationFrameId = null;
                handleSpinEnd(winningElement, winner);
            }
        }
        // --- End Animation Loop ---

        animationFrameId = requestAnimationFrame(animationStep);

    }, 100); // Delay for rendering
}


function createRouletteItems() {
    if (!rouletteTrack || !inlineRoulette) { console.error("Track or inline roulette element missing."); return; }
    rouletteTrack.innerHTML = ''; rouletteTrack.style.transition = 'none'; rouletteTrack.style.transform = 'translateX(0)';
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) { console.error('No participants data.'); return; }
    let ticketPool = [];
    // Create ticket pool based on $0.01 = 1 ticket (or use server tickets if available)
    currentRound.participants.forEach(p => {
        const tickets = p.tickets !== undefined ? p.tickets : Math.max(1, Math.floor((p.itemsValue || 0) * 100));
        for (let i = 0; i < tickets; i++) ticketPool.push(p);
    });
    if (ticketPool.length === 0) { console.error("Ticket pool empty."); return; }
    ticketPool = shuffleArray([...ticketPool]);

    // Calculate items needed based on duration and estimated speed
    const container = inlineRoulette.querySelector('.roulette-container');
    const containerWidth = container?.offsetWidth || 1000; // Fallback width
    const itemWidth = 90 + 10; // Item width + horizontal margin
    const itemsPerSecond = 10; // Estimated items passing per second
    const itemsNeeded = Math.ceil(itemsPerSecond * SPIN_DURATION_SECONDS + (containerWidth / itemWidth));
    const minItemsToCreate = Math.max(itemsNeeded, 150); // Ensure enough items
    const maxItemsToCreate = 500; // Limit total items

    const totalItemsToCreate = Math.max(minItemsToCreate, Math.min(ticketPool.length * ROULETTE_REPETITIONS, maxItemsToCreate));

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < totalItemsToCreate; i++) {
        const participant = ticketPool[i % ticketPool.length]; if (!participant || !participant.user) continue;
        const colorClass = `item-color-${(i % 5) + 1}`; const item = document.createElement('div');
        item.className = `roulette-item ${colorClass}`; item.dataset.userId = participant.user.id;
        const percentage = currentRound.totalValue > 0 ? ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(1) : '0.0';
        const avatar = participant.user.avatar || '/img/default-avatar.png'; const username = participant.user.username || 'Unknown';
        item.innerHTML = `<div class="profile-pic-container"><img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';"></div><div class="roulette-info"><span class="roulette-name" title="${username}">${username}</span><span class="roulette-percentage">${percentage}%</span></div>`;
        fragment.appendChild(item);
    }
    rouletteTrack.appendChild(fragment); console.log(`Created ${totalItemsToCreate} items.`);
}

function handleSpinEnd(winningElement, winner) {
    // Double check if animation was cancelled elsewhere
     if (!isSpinning && !animationFrameId && !winningElement) {
        console.warn("handleSpinEnd called but spin seems already reset or cancelled.");
        return;
     }
    // Ensure animation frame is cancelled if called externally before completion
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    isSpinning = false; // Set spinning to false *here*
    console.log("Handling spin end.");

    if (spinSound && !spinSound.paused) { spinSound.pause(); spinSound.currentTime = 0; }
    if (winningElement) winningElement.classList.add('winner-highlight');

    // Delay showing winner info slightly
    setTimeout(() => {
        if (winner && winner.user && winnerInfo && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
            winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png'; winnerAvatar.alt = winner.user.username || 'Winner';
            winnerName.textContent = winner.user.username || 'Winner'; winnerDeposit.textContent = `$${(winner.value || 0).toFixed(2)}`; winnerChance.textContent = `${(winner.percentage || 0).toFixed(2)}%`;
            winnerInfo.style.display = 'flex'; launchConfetti();
            // Hide return button initially, show it after a delay? Or only on reset? Let's hide it here.
            if(returnToJackpot) returnToJackpot.style.display = 'none';
            // Set timeout to reset the view
            setTimeout(resetToJackpotView, WINNER_DISPLAY_DURATION);
        } else { console.error("Winner data/elements incomplete for display."); resetToJackpotView(); }
    }, 300); // Short delay after spin stops visually
}

function resetToJackpotView() {
    console.log("Resetting to jackpot view.");
    // Cancel any ongoing animation frame loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Cancelled animation frame on reset.");
    }

    if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack) { console.error("Missing elements for reset."); return; }
    jackpotHeader.classList.remove('roulette-mode');
    inlineRoulette.style.display = 'none'; winnerInfo.style.display = 'none'; if (returnToJackpot) returnToJackpot.style.display = 'none';
    clearConfetti();
    const winnerElement = rouletteTrack.querySelector('.roulette-item.winner-highlight'); if (winnerElement) winnerElement.classList.remove('winner-highlight');
    rouletteTrack.style.transition = 'none'; rouletteTrack.style.transform = 'translateX(0)';
    // Clear track content after a very short delay to avoid visual glitches
    setTimeout(() => { if(rouletteTrack) rouletteTrack.innerHTML = ''; }, 50);
    isSpinning = false; timerActive = false; if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
    initiateNewRoundVisualReset();
     // Request fresh round data after reset to ensure sync
     socket.emit('requestRoundData');
}

function initiateNewRoundVisualReset() {
    console.log("Visual reset for next round."); updateTimerUI(120); if(timerValue) timerValue.classList.remove('urgent-pulse', 'timer-pulse');
    if (participantsContainer && emptyPotMessage) {
        participantsContainer.innerHTML = ''; // Clear participants
        emptyPotMessage.style.display = 'block'; // Show empty message
        if (!participantsContainer.contains(emptyPotMessage)) {
             participantsContainer.appendChild(emptyPotMessage); // Ensure it's there
        }
    }
    if (potValue) potValue.textContent = "$0.00"; if (participantCount) participantCount.textContent = "0/200";
}

// Find winner details
function findWinnerFromData(winnerData) {
    if (!currentRound || !currentRound.participants || !winnerData || !winnerData.winner || !winnerData.winner.id) { console.error("Missing data for findWinner."); return null; }
    const winnerId = winnerData.winner.id; const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winnerId);
    if (!winnerParticipant) { console.warn(`Winner ID ${winnerId} not found locally.`); return { user: { ...winnerData.winner }, percentage: 0, value: 0 }; }
    const totalValue = currentRound.totalValue > 0 ? currentRound.totalValue : 1; // Avoid division by zero
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;
    return { user: { ...winnerParticipant.user }, percentage: percentage || 0, value: winnerParticipant.itemsValue || 0 };
}

// Find target item index for roulette
function findTargetItemIndex(items, winnerId) {
    if (!items || items.length === 0) return -1;
    // Target a zone in the latter part of the strip for a better visual feel
    const minIndex = Math.floor(items.length * 0.65); // Start searching later
    const maxIndex = Math.floor(items.length * 0.85); // End search earlier
    const potentialIndices = [];
    for (let i = minIndex; i <= maxIndex; i++) {
        if (items[i] && items[i].dataset.userId === winnerId.toString()) {
            potentialIndices.push(i);
        }
    }
    if (potentialIndices.length > 0) {
        // Choose a random index from the potential winners in the target zone
        const chosenIndex = potentialIndices[Math.floor(Math.random() * potentialIndices.length)];
        console.log(`Found ${potentialIndices.length} in range [${minIndex}-${maxIndex}]. Choosing index ${chosenIndex}`);
        return chosenIndex;
    }
    // Fallback: If no winner found in the preferred zone, search the entire strip
    console.warn(`No winner item for ID ${winnerId} in range [${minIndex}-${maxIndex}]. Searching full track.`);
    const fallbackIndices = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].dataset.userId === winnerId.toString()) {
            fallbackIndices.push(i);
        }
    }
    if (fallbackIndices.length > 0) {
        // Choose a random index from all occurrences
         const chosenIndex = fallbackIndices[Math.floor(Math.random() * fallbackIndices.length)];
         console.log(`Found ${fallbackIndices.length} total. Choosing fallback index ${chosenIndex}`);
         return chosenIndex;
    }
    // Absolute fallback: If winner ID not found anywhere (should not happen with valid data)
    console.error(`FATAL: No item found for winner ID ${winnerId}! Defaulting to middle.`);
    return Math.floor(items.length / 2);
}

// Confetti
function launchConfetti() { if (!confettiContainer) return; clearConfetti(); const colors = ['#00ffaa', '#33ccff', '#9933ff', '#ffcc00', '#ff3366', '#ffffff']; for (let i = 0; i < CONFETTI_COUNT; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.style.left = `${Math.random() * 100}%`; c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; const s = Math.random() * 8 + 5; c.style.width = `${s}px`; c.style.height = `${s}px`; if (Math.random() > 0.7) c.style.borderRadius = '50%'; c.style.animationDuration = `${Math.random() * 3 + 2}s`; c.style.animationDelay = `${Math.random() * 0.5}s`; confettiContainer.appendChild(c); } }
function clearConfetti() { if (confettiContainer) confettiContainer.innerHTML = ''; }

// Test function
function testRouletteAnimation() {
    console.log("--- TEST ROULETTE ---"); if (isSpinning) { console.log("Already spinning."); return; }
    // Use current round data if available and has participants, otherwise use mock data
    let testData = (currentRound && currentRound.participants && currentRound.participants.length > 0) ? currentRound : null;
    if (!testData) {
         console.log('Using sample test data...');
         testData = {
             roundId: `test-${Date.now()}`, status: 'active', totalValue: 194.66,
             participants: [
                 { user: { id: 'test_user_1', username: 'DavE', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 185.69, tickets: 18569 },
                 { user: { id: 'test_user_2', username: 'Lisqo', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 7.39, tickets: 739 },
                 { user: { id: 'test_user_3', username: 'simon50110', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 1.04, tickets: 104 },
                 { user: { id: 'test_user_4', username: 'Tester4', avatar: '/img/default-avatar.png' }, itemsValue: 0.54, tickets: 54 }
             ],
             items: [] // Populate items if needed for display testing
         };
         currentRound = testData; // Set currentRound to test data for animation functions
         updateParticipantsUI(); // Update UI with test data if needed
    }
    if (!testData.participants || testData.participants.length === 0) { showNotification('Test Error', 'No participants available for test.'); return; }
    // Select a random participant from the test data as the winner
    const winnerIndex = Math.floor(Math.random() * testData.participants.length);
    const winnerParticipant = testData.participants[winnerIndex];
    const mockWinnerData = {
        roundId: testData.roundId,
        winner: winnerParticipant.user,
        winningTicket: Math.floor(Math.random() * (winnerParticipant.tickets || 1))
    };
    console.log('Test Winner:', mockWinnerData.winner.username);
    handleWinnerAnnouncement(mockWinnerData); // Start animation with the mock winner
}


// =================== PROVABLY FAIR ===================
async function verifyRound() {
    const idInput = document.getElementById('round-id'), sSeedInput = document.getElementById('server-seed'), cSeedInput = document.getElementById('client-seed'), resultEl = document.getElementById('verification-result');
    if (!idInput || !sSeedInput || !cSeedInput || !resultEl) { console.error("Verify form elements missing."); return; }
    const roundId = idInput.value.trim(), serverSeed = sSeedInput.value.trim(), clientSeed = cSeedInput.value.trim();
    if (!roundId || !serverSeed || !clientSeed) { resultEl.style.display = 'block'; resultEl.className = 'verification-result error'; resultEl.innerHTML = '<p>Please fill in all fields.</p>'; return; }
    // Basic validation for server seed format (SHA256 hash)
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
            // Ensure serverSeed is treated as a string, even if null/undefined initially
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
    if (sSeedInput) sSeedInput.value = serverSeed || ''; // Populate server seed if revealed
    if (cSeedInput) cSeedInput.value = clientSeed || ''; // Populate client seed if available

    // Scroll to the verification section
    const verificationSection = document.getElementById('provably-fair-verification');
    if (verificationSection) {
         verificationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Optionally provide feedback
    if (!serverSeed && roundId) {
        showNotification('Info', `Server Seed for Round #${roundId} is revealed after the round ends.`);
        // Optionally clear the server seed input if it shouldn't be pre-filled yet
        // if (sSeedInput) sSeedInput.value = '';
    } else if (sSeedInput && sSeedInput.value && cSeedInput) {
        // If server seed is populated, focus client seed
        // cSeedInput.focus();
    }
}


function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return; roundsPagination.innerHTML = ''; if (totalPages <= 1) return;
    const maxPagesToShow = 5; // Max number of page buttons (excluding prev/next/ellipsis)

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
        if (!isDisabled && typeof page === 'number') {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                loadPastRounds(page);
            });
        }
        return button;
    };

    // Previous Button
    roundsPagination.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));

    if (totalPages <= maxPagesToShow) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
            roundsPagination.appendChild(createButton(i, i, i === currentPage));
        }
    } else {
        // Handle cases with many pages and ellipsis
        let startPage, endPage;
        if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
            // Near the beginning
            startPage = 1;
            endPage = maxPagesToShow - 1;
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            for (let i = 2; i <= endPage; i++) {
                roundsPagination.appendChild(createButton(i, i, i === currentPage));
            }
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            roundsPagination.appendChild(createButton(totalPages, totalPages, totalPages === currentPage));
        } else if (currentPage + Math.floor(maxPagesToShow / 2) >= totalPages) {
            // Near the end
            startPage = totalPages - maxPagesToShow + 2;
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            for (let i = startPage; i <= totalPages; i++) {
                roundsPagination.appendChild(createButton(i, i, i === currentPage));
            }
        } else {
            // Somewhere in the middle
            startPage = currentPage - Math.floor((maxPagesToShow - 2) / 2);
            endPage = currentPage + Math.ceil((maxPagesToShow - 2) / 2);
            roundsPagination.appendChild(createButton(1, 1, 1 === currentPage));
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            for (let i = startPage; i <= endPage; i++) {
                 // Ensure we don't duplicate page 1 or last page if they fall in range
                 if (i > 1 && i < totalPages) {
                    roundsPagination.appendChild(createButton(i, i, i === currentPage));
                 }
            }
            roundsPagination.appendChild(createButton('...', null, false, true, true));
            roundsPagination.appendChild(createButton(totalPages, totalPages, totalPages === currentPage));
        }
    }

    // Next Button
    roundsPagination.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}
