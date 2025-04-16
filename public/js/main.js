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
    [homePage, faqPage, fairPage].forEach(page => { if (page) page.style.display = 'none'; });
    if (pageElement) pageElement.style.display = 'block';
    console.log('Showing page:', pageElement?.id);
    // Update active link state
    document.querySelectorAll('.main-nav a, .side-nav a').forEach(link => link.classList.remove('active'));
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
        if (currentRound && data.roundId === currentRound.id) {
            updateParticipantUI(data.participant);
        }
    });
    socket.on('timerUpdated', (data) => {
        console.log('Timer updated:', data);
        if (currentRound && data.roundId === currentRound.id) {
            updateTimerUI(data.seconds);
        }
    });
    socket.on('roundEnded', (data) => {
        console.log('Round ended:', data);
        if (currentRound && data.roundId === currentRound.id) {
            currentRound.winner = data.winner;
            currentRound.winningTicket = data.winningTicket;
            startRouletteAnimation(data);
        }
    });
    socket.on('error', (error) => { console.error('Socket error:', error); showNotification('Error', error.message || 'An error occurred.'); });
}

// Check login status
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
            const userData = await response.json();
            console.log('User data:', userData);
            currentUser = userData;
            updateUserUI();
        } else {
            console.log('User not logged in');
            currentUser = null;
            updateUserUI();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        showNotification('Error', 'Could not check login status.');
    }
}

// Update user UI
function updateUserUI() {
    if (currentUser) {
        if (loginButton) loginButton.style.display = 'none';
        if (userProfile) {
            userProfile.style.display = 'flex';
            if (userAvatar) userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
            if (userName) userName.textContent = currentUser.username || 'User';
        }
    } else {
        if (loginButton) loginButton.style.display = 'flex';
        if (userProfile) userProfile.style.display = 'none';
    }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound) return;
    if (potValue) potValue.textContent = `$${currentRound.totalValue?.toFixed(2) || '0.00'}`;
    if (timerValue && currentRound.timeLeft !== undefined) updateTimerUI(currentRound.timeLeft);
    if (participantCount) participantCount.textContent = `${currentRound.itemCount || 0}/200`;
    updateParticipantsContainer();
}

// Update timer UI
function updateTimerUI(seconds) {
    if (!timerValue) return;
    const timeLeft = Math.max(0, Math.floor(seconds));
    timerValue.textContent = timeLeft;
    // Update timer circle if it exists
    if (timerForeground) {
        const radius = 42; // Match the r attribute in your SVG
        const circumference = 2 * Math.PI * radius;
        const dashOffset = circumference * (1 - timeLeft / 120); // Assuming 120 seconds total
        timerForeground.style.strokeDasharray = `${circumference} ${circumference}`;
        timerForeground.style.strokeDashoffset = dashOffset;
    }
}

// Update participants container
function updateParticipantsContainer() {
    if (!participantsContainer || !currentRound) return;
    if (!currentRound.participants || currentRound.participants.length === 0) {
        if (emptyPotMessage) emptyPotMessage.style.display = 'block';
        return;
    }
    if (emptyPotMessage) emptyPotMessage.style.display = 'none';
    // Clear existing participants
    participantsContainer.innerHTML = '';
    // Add each participant
    currentRound.participants.forEach(participant => {
        updateParticipantUI(participant);
    });
}

// Update or add a single participant
function updateParticipantUI(participant) {
    if (!participantsContainer || !participant) return;
    if (emptyPotMessage) emptyPotMessage.style.display = 'none';
    // Check if participant already exists
    let participantElement = document.getElementById(`participant-${participant.id}`);
    if (!participantElement) {
        // Create new participant element
        participantElement = document.createElement('div');
        participantElement.id = `participant-${participant.id}`;
        participantElement.className = 'participant';
        participantsContainer.appendChild(participantElement);
    }
    // Get user color
    const userColor = getUserColor(participant.userId);
    // Update participant content
    participantElement.innerHTML = `
        <div class="participant-header" style="border-left-color: ${userColor};">
            <div class="participant-info">
                <img src="${participant.avatar || '/img/default-avatar.png'}" alt="${participant.username}" class="participant-avatar" style="border-color: ${userColor};">
                <div class="participant-details">
                    <span class="participant-name">${participant.username}</span>
                    <div class="participant-stats">
                        <span class="participant-value" style="color: ${userColor};">$${participant.value.toFixed(2)}</span>
                        <span class="participant-percentage">${participant.percentage.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="participant-items">
            ${participant.items.map(item => `
                <div class="item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="item-value" style="color: ${userColor};">$${item.value.toFixed(2)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Load user inventory
async function loadUserInventory() {
    if (!currentUser) return;
    if (inventoryLoading) inventoryLoading.style.display = 'block';
    if (inventoryItems) inventoryItems.innerHTML = '<div class="loading">Loading inventory...</div>';
    try {
        const response = await fetch(`/api/inventory/${currentUser.id}`);
        if (!response.ok) throw new Error(`Failed to fetch inventory (${response.status})`);
        const data = await response.json();
        userInventory = data.items || [];
        console.log('User inventory:', userInventory);
        renderInventory();
    } catch (error) {
        console.error('Error loading inventory:', error);
        if (inventoryItems) inventoryItems.innerHTML = `<div class="error-message">Error loading inventory: ${error.message}</div>`;
    } finally {
        if (inventoryLoading) inventoryLoading.style.display = 'none';
    }
}

// Render inventory
function renderInventory() {
    if (!inventoryItems) return;
    if (!userInventory || userInventory.length === 0) {
        inventoryItems.innerHTML = '<div class="empty-inventory-message">Your inventory is empty.</div>';
        return;
    }
    inventoryItems.innerHTML = '';
    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.id = item.id;
        itemElement.dataset.value = item.value;
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-value">$${item.value.toFixed(2)}</div>
            </div>
        `;
        itemElement.addEventListener('click', () => toggleItemSelection(item, itemElement));
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(item, element) {
    if (!element) return;
    const isSelected = element.classList.contains('selected');
    if (isSelected) {
        // Remove from selection
        element.classList.remove('selected');
        selectedItemsList = selectedItemsList.filter(i => i.id !== item.id);
    } else {
        // Add to selection
        element.classList.add('selected');
        selectedItemsList.push(item);
    }
    updateSelectedItemsUI();
}

// Update selected items UI
function updateSelectedItemsUI() {
    if (!selectedItems || !totalValue) return;
    selectedItems.innerHTML = '';
    if (selectedItemsList.length === 0) {
        depositButton.disabled = true;
        totalValue.textContent = '$0.00';
        return;
    }
    let total = 0;
    selectedItemsList.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'selected-item';
        itemElement.dataset.id = item.id;
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="item-value">$${item.value.toFixed(2)}</div>
        `;
        itemElement.addEventListener('click', () => {
            // Remove from selection
            selectedItemsList = selectedItemsList.filter(i => i.id !== item.id);
            // Update inventory item display
            const inventoryItem = document.querySelector(`.inventory-item[data-id="${item.id}"]`);
            if (inventoryItem) inventoryItem.classList.remove('selected');
            updateSelectedItemsUI();
        });
        selectedItems.appendChild(itemElement);
        total += item.value;
    });
    totalValue.textContent = `$${total.toFixed(2)}`;
    depositButton.disabled = total < 1.00; // Minimum deposit $1.00
}

// Submit deposit
async function submitDeposit() {
    if (!currentUser || selectedItemsList.length === 0) return;
    const itemIds = selectedItemsList.map(item => item.id);
    try {
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds, roundId: currentRound?.id })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to deposit (${response.status})`);
        }
        const data = await response.json();
        console.log('Deposit successful:', data);
        showNotification('Success', 'Deposit successful! Check your Steam trade offers to complete the transaction.');
        // Clear selection and close modal
        selectedItemsList = [];
        updateSelectedItemsUI();
        hideModal(depositModal);
    } catch (error) {
        console.error('Error submitting deposit:', error);
        showNotification('Error', `Failed to deposit: ${error.message}`);
    }
}

// Save user trade URL
async function saveUserTradeUrl() {
    if (!currentUser || !tradeUrlInput) return;
    const tradeUrl = tradeUrlInput.value.trim();
    if (!tradeUrl) {
        showNotification('Error', 'Please enter a valid trade URL.');
        return;
    }
    try {
        const response = await fetch('/api/user/tradeurl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeUrl })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to save trade URL (${response.status})`);
        }
        const data = await response.json();
        console.log('Trade URL saved:', data);
        currentUser.tradeUrl = tradeUrl;
        showNotification('Success', 'Trade URL saved successfully!');
        hideModal(tradeUrlModal);
    } catch (error) {
        console.error('Error saving trade URL:', error);
        showNotification('Error', `Failed to save trade URL: ${error.message}`);
    }
}

// Verify round
async function verifyRound() {
    const roundIdInput = document.getElementById('roundId');
    if (!roundIdInput) return;
    const roundId = roundIdInput.value.trim();
    if (!roundId) {
        showNotification('Error', 'Please enter a valid round ID.');
        return;
    }
    const resultElement = document.getElementById('verification-result');
    if (resultElement) {
        resultElement.className = 'loading';
        resultElement.style.display = 'block';
        resultElement.innerHTML = '<div class="spinner"></div><p>Verifying round...</p>';
    }
    try {
        const response = await fetch(`/api/verify/${roundId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to verify round (${response.status})`);
        }
        const data = await response.json();
        console.log('Round verification:', data);
        if (resultElement) {
            resultElement.className = 'success';
            resultElement.innerHTML = `
                <h4>Round Verification</h4>
                <p>Round ID: <strong>${data.roundId}</strong></p>
                <p>Server Seed: <strong>${data.serverSeed}</strong></p>
                <p>Server Seed Hash: <strong>${data.serverSeedHash}</strong></p>
                <p>Client Seed: <strong>${data.clientSeed}</strong></p>
                <p>Combined Hash: <strong>${data.combinedHash}</strong></p>
                <p>Winning Ticket: <strong>${data.winningTicket}</strong></p>
                <p>Winner: <strong>${data.winner?.username || 'N/A'}</strong></p>
                <p>Verification: <strong>${data.verified ? 'Valid ✓' : 'Invalid ✗'}</strong></p>
            `;
        }
    } catch (error) {
        console.error('Error verifying round:', error);
        if (resultElement) {
            resultElement.className = 'error';
            resultElement.innerHTML = `<h4>Verification Error</h4><p>${error.message}</p>`;
        }
    }
}

// Load past rounds
async function loadPastRounds(page = 1) {
    const recentRounds = document.getElementById('recentRounds');
    if (!recentRounds) return;
    try {
        const response = await fetch(`/api/rounds?page=${page}&limit=10`);
        if (!response.ok) throw new Error(`Failed to fetch rounds (${response.status})`);
        const data = await response.json();
        console.log('Past rounds:', data);
        recentRounds.innerHTML = '';
        data.rounds.forEach(round => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${round.id}</td>
                <td>${new Date(round.endTime).toLocaleString()}</td>
                <td>$${round.totalValue.toFixed(2)}</td>
                <td>${round.winner?.username || 'N/A'}</td>
                <td>
                    <button class="btn btn-details" onclick="showRoundDetails('${round.id}')">Details</button>
                    <button class="btn btn-verify" onclick="document.getElementById('roundId').value='${round.id}';document.getElementById('verifyButton').click()">Verify</button>
                </td>
            `;
            recentRounds.appendChild(row);
        });
        // Update pagination
        if (roundsPagination) {
            roundsPagination.innerHTML = '';
            const totalPages = Math.ceil(data.total / 10);
            for (let i = 1; i <= totalPages; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `pagination-btn ${i === page ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => loadPastRounds(i));
                roundsPagination.appendChild(pageBtn);
            }
        }
    } catch (error) {
        console.error('Error loading past rounds:', error);
        recentRounds.innerHTML = `<tr><td colspan="5">Error loading rounds: ${error.message}</td></tr>`;
    }
}

// Reset to jackpot view
function resetToJackpotView() {
    if (jackpotHeader) jackpotHeader.classList.remove('roulette-mode');
    if (inlineRoulette) inlineRoulette.style.display = 'none';
    if (winnerInfo) {
        winnerInfo.style.display = 'none';
        winnerInfo.style.opacity = '0';
    }
    if (confettiContainer) confettiContainer.innerHTML = '';
    isSpinning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// --- ROULETTE ANIMATION FUNCTIONS ---

// Test roulette animation with mock data
function testRouletteAnimation() {
    if (isSpinning) return; // Prevent multiple spins
    console.log('Testing roulette animation');
    // Create mock participants if needed
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        const mockParticipants = [];
        for (let i = 0; i < 5; i++) {
            const userId = `user-${i}`;
            mockParticipants.push({
                id: `participant-${i}`,
                userId,
                username: `Player ${i + 1}`,
                avatar: `/img/default-avatar.png`,
                value: Math.random() * 100 + 10,
                percentage: 20,
                items: [
                    { id: `item-${i}-1`, name: 'Test Item 1', image: '/img/default-item.png', value: Math.random() * 50 + 5 },
                    { id: `item-${i}-2`, name: 'Test Item 2', image: '/img/default-item.png', value: Math.random() * 50 + 5 }
                ]
            });
        }
        if (!currentRound) currentRound = { id: 'test-round', participants: mockParticipants };
        else currentRound.participants = mockParticipants;
        updateParticipantsContainer();
    }
    // Pick a random winner
    const winnerIndex = Math.floor(Math.random() * currentRound.participants.length);
    const winner = currentRound.participants[winnerIndex];
    // Start animation
    startRouletteAnimation({
        winner,
        winningTicket: Math.floor(Math.random() * 10000)
    });
}

// Start roulette animation
function startRouletteAnimation(data) {
    if (isSpinning || !data.winner || !currentRound || !currentRound.participants || currentRound.participants.length === 0) return;
    console.log('Starting roulette animation with winner:', data.winner);
    isSpinning = true;
    // Prepare UI
    if (jackpotHeader) jackpotHeader.classList.add('roulette-mode');
    if (inlineRoulette) inlineRoulette.style.display = 'block';
    if (rouletteTrack) rouletteTrack.innerHTML = '';
    // Create roulette items
    const participants = currentRound.participants;
    const itemWidth = 100; // Width of each item including margin
    const winnerColor = getUserColor(data.winner.userId);
    // Create a weighted list of participants based on their percentage
    let rouletteItems = [];
    participants.forEach(participant => {
        // Add items proportional to percentage (minimum 1)
        const count = Math.max(1, Math.round(participant.percentage / 5));
        for (let i = 0; i < count; i++) {
            rouletteItems.push(participant);
        }
    });
    // Shuffle the items to make it more random
    rouletteItems = shuffleArray(rouletteItems);
    // Make sure the winner is included
    const winnerIncluded = rouletteItems.some(item => item.id === data.winner.id);
    if (!winnerIncluded) {
        // Replace a random item with the winner
        const randomIndex = Math.floor(Math.random() * rouletteItems.length);
        rouletteItems[randomIndex] = data.winner;
    }
    // Find the winner's index
    const winnerIndex = rouletteItems.findIndex(item => item.id === data.winner.id);
    // Create the roulette track with items
    rouletteItems.forEach(participant => {
        const isWinner = participant.id === data.winner.id;
        const userColor = getUserColor(participant.userId);
        const itemElement = document.createElement('div');
        itemElement.className = `roulette-item ${isWinner ? 'winner-highlight' : ''}`;
        itemElement.style.borderColor = userColor;
        itemElement.innerHTML = `
            <div class="profile-pic-container">
                <img src="${participant.avatar || '/img/default-avatar.png'}" alt="${participant.username}" class="roulette-avatar">
            </div>
            <div class="roulette-info">
                <div class="roulette-name">${participant.username}</div>
                <div class="roulette-percentage" style="color: ${userColor};">${participant.percentage.toFixed(2)}%</div>
            </div>
        `;
        rouletteTrack.appendChild(itemElement);
    });
    // Set up winner info
    if (winnerInfo) {
        if (winnerAvatar) winnerAvatar.src = data.winner.avatar || '/img/default-avatar.png';
        if (winnerName) {
            winnerName.textContent = data.winner.username;
            winnerName.style.color = winnerColor;
        }
        if (winnerDeposit) winnerDeposit.textContent = `$${data.winner.value.toFixed(2)}`;
        if (winnerChance) winnerChance.textContent = `${data.winner.percentage.toFixed(2)}%`;
    }
    // Play sound if available
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.log('Could not play sound:', e));
    }
    // Calculate final position
    // We want the winner to end up at the center ticker
    const trackWidth = rouletteItems.length * itemWidth;
    // Calculate the position where the winner should end up (center of viewport)
    const viewportWidth = rouletteTrack.parentElement.offsetWidth;
    const centerPosition = viewportWidth / 2;
    // Calculate the position of the winner item
    const winnerPosition = winnerIndex * itemWidth + itemWidth / 2;
    // Calculate how far we need to move the track so the winner is at the center
    let finalPosition = centerPosition - winnerPosition;
    // Add some randomness to the final position (within the item width)
    const randomVariation = (Math.random() * 2 - 1) * LANDING_POSITION_VARIATION * itemWidth;
    finalPosition += randomVariation;
    // Start the animation
    spinStartTime = performance.now();
    animateRoulette(finalPosition);
}

// Animate the roulette
function animateRoulette(finalPosition) {
    const currentTime = performance.now();
    const elapsedTime = (currentTime - spinStartTime) / 1000; // Convert to seconds
    const duration = SPIN_DURATION_SECONDS;
    // Calculate progress (0 to 1)
    let progress = Math.min(elapsedTime / duration, 1);
    // Apply easing to the progress
    const easedProgress = easeOutAnimation(progress);
    // Calculate current position
    let currentPosition;
    if (progress < 1) {
        // Main animation phase
        currentPosition = finalPosition * easedProgress;
    } else {
        // Bounce phase (if enabled)
        const bounceProgress = Math.min((elapsedTime - duration) / 0.5, 1); // 0.5 seconds for bounce
        const bounceDisplacement = calculateBounce(bounceProgress);
        const overshootAmount = finalPosition * BOUNCE_OVERSHOOT_FACTOR;
        currentPosition = finalPosition + bounceDisplacement * overshootAmount;
    }
    // Apply the transform
    if (rouletteTrack) {
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;
    }
    // Continue animation if not complete
    if (progress < 1 || (BOUNCE_ENABLED && elapsedTime < duration + 0.5)) {
        animationFrameId = requestAnimationFrame(() => animateRoulette(finalPosition));
    } else {
        // Animation complete
        finishRouletteAnimation();
    }
}

// Finish the roulette animation
function finishRouletteAnimation() {
    console.log('Roulette animation complete');
    // Show winner info
    if (winnerInfo) {
        winnerInfo.style.display = 'flex';
        // Fade in
        setTimeout(() => {
            winnerInfo.style.opacity = '1';
        }, 100);
    }
    // Create confetti
    createConfetti();
    // Schedule reset
    setTimeout(() => {
        resetToJackpotView();
        // Request new round data
        socket.emit('requestRoundData');
    }, WINNER_DISPLAY_DURATION);
}

// Create confetti
function createConfetti() {
    if (!confettiContainer) return;
    confettiContainer.innerHTML = '';
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        // Random properties
        const size = Math.random() * 8 + 4; // 4-12px
        const color = `hsl(${Math.random() * 360}, 80%, 60%)`; // Random hue
        const duration = Math.random() * 2 + 2; // 2-4s
        const delay = Math.random() * 0.5; // 0-0.5s
        const fallX = (Math.random() * 2 - 1) * 100; // -100px to 100px
        const rotationStart = Math.random() * 360; // 0-360deg
        const rotationEnd = rotationStart + Math.random() * 720 - 360; // -360 to 360 from start
        // Set styles
        confetti.style.setProperty('--color', color);
        confetti.style.setProperty('--duration', `${duration}s`);
        confetti.style.setProperty('--delay', `${delay}s`);
        confetti.style.setProperty('--fall-x', `${fallX}px`);
        confetti.style.setProperty('--rotation-start', `${rotationStart}deg`);
        confetti.style.setProperty('--rotation-end', `${rotationEnd}deg`);
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.left = `${Math.random() * 100}%`;
        // Add to container
        confettiContainer.appendChild(confetti);
    }
}

// Export functions for global access if needed
window.showRoundDetails = showRoundDetails;
window.verifyRound = verifyRound;
