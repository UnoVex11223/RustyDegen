// main.js (Complete and Modified for Enhanced Roulette Animation)
// Ensure the Socket.IO client library is included in your HTML:
// <script src="/socket.io/socket.io.js"></script>
const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a'); // Main jackpot link
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
const participantsContainer = document.getElementById('participantsContainer'); // Container for items in pot
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
    [homePage, faqPage, fairPage, aboutPage, roadmapPage].forEach(page => { 
        if (page) page.style.display = 'none'; 
    });
    if (pageElement) pageElement.style.display = 'block';
    console.log('Showing page:', pageElement?.id);
    
    // Update active link state for all navigation areas
    document.querySelectorAll('.main-nav a, .secondary-nav a, .right-nav a').forEach(link => 
        link.classList.remove('active')
    );
    
    // Set the appropriate active link based on the page
    if (pageElement === homePage && homeLink) 
        homeLink.classList.add('active');
    if (pageElement === faqPage && faqLink) 
        faqLink.classList.add('active');
    if (pageElement === fairPage && fairLink) 
        fairLink.classList.add('active');
    if (pageElement === aboutPage && aboutLink) 
        aboutLink.classList.add('active');
    if (pageElement === roadmapPage && roadmapLink) 
        roadmapLink.classList.add('active');
    
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
    socket.on('connect', () => { console.log('Socket connected:', socket.id); socket.emit('requestRoundData'); });
    socket.on('disconnect', (reason) => { console.log('Socket disconnected:', reason); showNotification('Connection Lost', 'Disconnected from server.'); });
    socket.on('connect_error', (error) => { console.error('Socket connection error:', error); showNotification('Connection Error', 'Could not connect to server.'); });
    socket.on('roundCreated', (data) => { console.log('New round created:', data); currentRound = data; updateRoundUI(); resetToJackpotView(); });
    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.id === data.roundId) {
            // Update the current round data
            currentRound.participants = data.participants;
            currentRound.totalValue = data.totalValue;
            updateRoundUI();
        }
    });
    socket.on('timerUpdated', (data) => {
        console.log('Timer updated:', data);
        if (currentRound && currentRound.id === data.roundId) {
            // Update the timer
            currentRound.timeRemaining = data.timeRemaining;
            updateTimerUI();
        }
    });
    socket.on('roundEnded', (data) => {
        console.log('Round ended:', data);
        if (currentRound && currentRound.id === data.roundId) {
            // Update the current round with winner info
            currentRound.winner = data.winner;
            currentRound.winningTicket = data.winningTicket;
            // Start the roulette animation
            startRouletteAnimation(data.winner, data.participants);
        }
    });
}

// Check login status
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user/status');
        if (!response.ok) throw new Error(`Failed to fetch user status (${response.status})`);
        const data = await response.json();
        
        if (data.loggedIn) {
            // User is logged in
            currentUser = data.user;
            if (userProfile) userProfile.style.display = 'flex';
            if (loginButton) loginButton.style.display = 'none';
            if (userAvatar) userAvatar.src = currentUser.avatarUrl || '/img/default-avatar.png';
            if (userName) userName.textContent = currentUser.username;
            console.log('User logged in:', currentUser);
        } else {
            // User is not logged in
            if (userProfile) userProfile.style.display = 'none';
            if (loginButton) loginButton.style.display = 'flex';
            console.log('User not logged in');
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        showNotification('Error', 'Could not check login status. Please refresh the page.');
    }
}

// Load user inventory
async function loadUserInventory() {
    if (!currentUser) return;
    
    try {
        if (inventoryLoading) inventoryLoading.style.display = 'flex';
        if (inventoryItems) inventoryItems.innerHTML = ''; // Clear existing items
        
        const response = await fetch('/api/inventory');
        if (!response.ok) throw new Error(`Failed to fetch inventory (${response.status})`);
        const data = await response.json();
        
        userInventory = data.items || [];
        console.log('Inventory loaded:', userInventory);
        
        // Render inventory items
        renderInventoryItems();
    } catch (error) {
        console.error('Error loading inventory:', error);
        showNotification('Error', 'Could not load your inventory. Please try again later.');
    } finally {
        if (inventoryLoading) inventoryLoading.style.display = 'none';
    }
}

// Render inventory items
function renderInventoryItems() {
    if (!inventoryItems || !userInventory.length) return;
    
    inventoryItems.innerHTML = ''; // Clear existing items
    
    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.id = item.id;
        itemElement.dataset.value = item.value;
        itemElement.innerHTML = `
            <div class="item-image">
                <img src="${item.imageUrl}" alt="${item.name}">
            </div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-value">$${item.value.toFixed(2)}</div>
            </div>
        `;
        
        // Add click handler to select/deselect item
        itemElement.addEventListener('click', () => toggleItemSelection(item, itemElement));
        
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(item, element) {
    const isSelected = element.classList.contains('selected');
    
    if (isSelected) {
        // Deselect item
        element.classList.remove('selected');
        selectedItemsList = selectedItemsList.filter(i => i.id !== item.id);
    } else {
        // Select item
        element.classList.add('selected');
        selectedItemsList.push(item);
    }
    
    // Update selected items display and total value
    updateSelectedItemsUI();
}

// Update selected items UI
function updateSelectedItemsUI() {
    if (!selectedItems) return;
    
    selectedItems.innerHTML = ''; // Clear existing items
    
    if (selectedItemsList.length === 0) {
        selectedItems.innerHTML = '<div class="empty-selection">No items selected</div>';
        if (depositButton) depositButton.disabled = true;
        if (totalValue) totalValue.textContent = '$0.00';
        return;
    }
    
    let total = 0;
    
    selectedItemsList.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'selected-item';
        itemElement.innerHTML = `
            <div class="item-image">
                <img src="${item.imageUrl}" alt="${item.name}">
            </div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-value">$${item.value.toFixed(2)}</div>
            </div>
            <button class="remove-item" data-id="${item.id}">&times;</button>
        `;
        
        // Add click handler to remove button
        const removeButton = itemElement.querySelector('.remove-item');
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            removeSelectedItem(item.id);
        });
        
        selectedItems.appendChild(itemElement);
        total += item.value;
    });
    
    // Update total value
    if (totalValue) totalValue.textContent = `$${total.toFixed(2)}`;
    
    // Enable/disable deposit button based on minimum value
    if (depositButton) {
        const minimumDeposit = 1.00; // Minimum deposit value (adjust as needed)
        depositButton.disabled = total < minimumDeposit;
    }
}

// Remove selected item
function removeSelectedItem(itemId) {
    // Remove from selected items list
    selectedItemsList = selectedItemsList.filter(item => item.id !== itemId);
    
    // Update UI for selected items
    updateSelectedItemsUI();
    
    // Update inventory item UI (deselect)
    const inventoryItem = document.querySelector(`.inventory-item[data-id="${itemId}"]`);
    if (inventoryItem) inventoryItem.classList.remove('selected');
}

// Submit deposit
async function submitDeposit() {
    if (!currentUser || selectedItemsList.length === 0) return;
    
    try {
        if (depositButton) depositButton.disabled = true;
        
        const itemIds = selectedItemsList.map(item => item.id);
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds })
        });
        
        if (!response.ok) throw new Error(`Failed to submit deposit (${response.status})`);
        const data = await response.json();
        
        showNotification('Deposit Successful', 'Your items have been added to the pot!');
        
        // Clear selected items
        selectedItemsList = [];
        updateSelectedItemsUI();
        
        // Close deposit modal
        if (depositModal) hideModal(depositModal);
        
        // Refresh inventory (items are now in the pot)
        loadUserInventory();
    } catch (error) {
        console.error('Error submitting deposit:', error);
        showNotification('Error', 'Could not complete your deposit. Please try again later.');
    } finally {
        if (depositButton) depositButton.disabled = false;
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
        if (saveTradeUrl) saveTradeUrl.disabled = true;
        
        const response = await fetch('/api/user/tradeurl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeUrl })
        });
        
        if (!response.ok) throw new Error(`Failed to save trade URL (${response.status})`);
        
        // Update current user
        currentUser.tradeUrl = tradeUrl;
        
        showNotification('Success', 'Your trade URL has been saved.');
        
        // Close trade URL modal
        if (tradeUrlModal) hideModal(tradeUrlModal);
    } catch (error) {
        console.error('Error saving trade URL:', error);
        showNotification('Error', 'Could not save your trade URL. Please try again later.');
    } finally {
        if (saveTradeUrl) saveTradeUrl.disabled = false;
    }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound) return;
    
    // Update pot value
    if (potValue) potValue.textContent = `$${currentRound.totalValue.toFixed(2)}`;
    
    // Update timer
    updateTimerUI();
    
    // Update participant count
    if (participantCount) {
        const count = currentRound.participants ? currentRound.participants.length : 0;
        const maxCount = 200; // Maximum participants (adjust as needed)
        participantCount.textContent = `${count}/${maxCount}`;
    }
    
    // Update participants container
    updateParticipantsUI();
}

// Update timer UI
function updateTimerUI() {
    if (!currentRound || !timerValue || !timerForeground) return;
    
    const timeRemaining = currentRound.timeRemaining || 0;
    const totalTime = 120; // Total round time in seconds (adjust as needed)
    
    // Update timer text
    timerValue.textContent = Math.max(0, Math.floor(timeRemaining)).toString();
    
    // Update timer circle
    const circumference = 2 * Math.PI * 42; // 42 is the radius of the circle
    const dashOffset = circumference * (1 - timeRemaining / totalTime);
    timerForeground.style.strokeDasharray = circumference;
    timerForeground.style.strokeDashoffset = dashOffset;
    
    // Start/stop timer animation
    if (timeRemaining > 0 && !timerActive) {
        startTimerAnimation();
    } else if (timeRemaining <= 0 && timerActive) {
        stopTimerAnimation();
    }
}

// Start timer animation
function startTimerAnimation() {
    if (timerActive || !currentRound) return;
    
    timerActive = true;
    const startTime = Date.now();
    const initialTimeRemaining = currentRound.timeRemaining || 0;
    
    function updateTimer() {
        if (!timerActive || !currentRound) return;
        
        const elapsed = (Date.now() - startTime) / 1000; // Elapsed time in seconds
        currentRound.timeRemaining = Math.max(0, initialTimeRemaining - elapsed);
        
        updateTimerUI();
        
        if (currentRound.timeRemaining > 0) {
            roundTimer = requestAnimationFrame(updateTimer);
        } else {
            stopTimerAnimation();
        }
    }
    
    roundTimer = requestAnimationFrame(updateTimer);
}

// Stop timer animation
function stopTimerAnimation() {
    timerActive = false;
    if (roundTimer) {
        cancelAnimationFrame(roundTimer);
        roundTimer = null;
    }
}

// Update participants UI
function updateParticipantsUI() {
    if (!currentRound || !participantsContainer) return;
    
    const participants = currentRound.participants || [];
    
    // Show/hide empty pot message
    if (emptyPotMessage) {
        emptyPotMessage.style.display = participants.length === 0 ? 'block' : 'none';
    }
    
    // Clear existing participants (except empty pot message)
    const existingItems = participantsContainer.querySelectorAll('.participant-item');
    existingItems.forEach(item => item.remove());
    
    // Add participants
    participants.forEach(participant => {
        const participantElement = document.createElement('div');
        participantElement.className = 'participant-item';
        
        // Get user color
        const userColor = getUserColor(participant.userId);
        
        participantElement.innerHTML = `
            <div class="participant-avatar" style="border-color: ${userColor};">
                <img src="${participant.avatarUrl || '/img/default-avatar.png'}" alt="${participant.username}">
            </div>
            <div class="participant-info">
                <div class="participant-name">${participant.username}</div>
                <div class="participant-items">${participant.items.length} item${participant.items.length !== 1 ? 's' : ''}</div>
                <div class="participant-value">$${participant.value.toFixed(2)}</div>
                <div class="participant-chance" style="color: ${userColor};">${(participant.chance * 100).toFixed(2)}%</div>
            </div>
        `;
        
        participantsContainer.appendChild(participantElement);
    });
}

// Reset to jackpot view
function resetToJackpotView() {
    if (!jackpotHeader || !inlineRoulette) return;
    
    // Hide roulette and winner info
    jackpotHeader.classList.remove('roulette-mode');
    inlineRoulette.style.display = 'none';
    if (winnerInfo) winnerInfo.style.display = 'none';
    
    // Stop any ongoing animations
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    isSpinning = false;
}

// Start roulette animation
function startRouletteAnimation(winner, participants) {
    if (!jackpotHeader || !inlineRoulette || !rouletteTrack || isSpinning) return;
    
    isSpinning = true;
    
    // Switch to roulette mode
    jackpotHeader.classList.add('roulette-mode');
    inlineRoulette.style.display = 'block';
    
    // Create roulette items
    createRouletteItems(participants, winner);
    
    // Play spin sound
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Start the animation
    spinStartTime = performance.now();
    animateRoulette(winner);
}

// Create roulette items
function createRouletteItems(participants, winner) {
    if (!rouletteTrack) return;
    
    // Clear existing items
    rouletteTrack.innerHTML = '';
    
    // Create a weighted list of participants based on their chance
    let weightedParticipants = [];
    participants.forEach(participant => {
        // Add each participant multiple times based on their chance
        const count = Math.max(1, Math.round(participant.chance * 100));
        for (let i = 0; i < count; i++) {
            weightedParticipants.push(participant);
        }
    });
    
    // Shuffle the weighted list
    weightedParticipants = shuffleArray(weightedParticipants);
    
    // Ensure the winner is included
    const winnerIncluded = weightedParticipants.some(p => p.userId === winner.userId);
    if (!winnerIncluded) {
        // Replace a random item with the winner
        const randomIndex = Math.floor(Math.random() * weightedParticipants.length);
        weightedParticipants[randomIndex] = winner;
    }
    
    // Create enough items to fill the track (repeat the list if needed)
    const itemWidth = 100; // Width of each item including margin
    const trackWidth = window.innerWidth * 3; // Make track 3x viewport width
    const itemsNeeded = Math.ceil(trackWidth / itemWidth);
    
    // Repeat the weighted list until we have enough items
    let allItems = [];
    while (allItems.length < itemsNeeded) {
        allItems = allItems.concat(shuffleArray([...weightedParticipants]));
    }
    
    // Trim to exact number needed
    allItems = allItems.slice(0, itemsNeeded);
    
    // Find the winner's position (we'll ensure it lands on the winner)
    const winnerIndex = allItems.findIndex(p => p.userId === winner.userId);
    
    // If winner not found (shouldn't happen), add them
    if (winnerIndex === -1) {
        // Replace the item that will land at the center
        const centerIndex = Math.floor(allItems.length * 0.8); // Position at 80% of the track
        allItems[centerIndex] = winner;
    }
    
    // Create DOM elements for each item
    allItems.forEach((participant, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'roulette-item';
        
        // Get user color
        const userColor = getUserColor(participant.userId);
        
        // Mark the winner for debugging (will be visually highlighted later)
        if (participant.userId === winner.userId) {
            itemElement.dataset.winner = 'true';
        }
        
        // Style with user color
        itemElement.style.borderColor = userColor;
        
        itemElement.innerHTML = `
            <div class="profile-pic-container">
                <img src="${participant.avatarUrl || '/img/default-avatar.png'}" alt="${participant.username}" class="roulette-avatar">
            </div>
            <div class="roulette-info">
                <div class="roulette-name">${participant.username}</div>
                <div class="roulette-percentage" style="color: ${userColor};">${(participant.chance * 100).toFixed(2)}%</div>
            </div>
        `;
        
        rouletteTrack.appendChild(itemElement);
    });
}

// Animate the roulette
function animateRoulette(winner) {
    // Find all items marked as winner
    const winnerItems = rouletteTrack.querySelectorAll('[data-winner="true"]');
    if (!winnerItems.length) return;
    
    // Choose a winner item that will land at the center
    // Prefer one that's at least 70% into the track for a longer animation
    let targetWinnerItem = null;
    let targetWinnerIndex = -1;
    
    winnerItems.forEach((item, index) => {
        const itemIndex = Array.from(rouletteTrack.children).indexOf(item);
        if (itemIndex > targetWinnerIndex && itemIndex > rouletteTrack.children.length * 0.7) {
            targetWinnerItem = item;
            targetWinnerIndex = itemIndex;
        }
    });
    
    // If no suitable winner found, use the first one
    if (!targetWinnerItem) {
        targetWinnerItem = winnerItems[0];
        targetWinnerIndex = Array.from(rouletteTrack.children).indexOf(targetWinnerItem);
    }
    
    // Calculate the final position (center of the viewport)
    const viewportCenter = window.innerWidth / 2;
    const itemWidth = 100; // Width of each item including margin
    
    // Calculate the position where the winner item should end up
    // We want the winner item to be centered in the viewport
    const itemRect = targetWinnerItem.getBoundingClientRect();
    const trackRect = rouletteTrack.getBoundingClientRect();
    
    // Calculate the initial position of the track
    const initialPosition = 0;
    
    // Calculate how far the winner item is from the start of the track
    const winnerOffsetFromStart = targetWinnerIndex * itemWidth;
    
    // Calculate the final position where the winner will be centered
    // Add some random variation to make it less predictable
    const variation = (Math.random() * 2 - 1) * LANDING_POSITION_VARIATION * itemWidth;
    const finalPosition = -(winnerOffsetFromStart - viewportCenter + itemWidth / 2 + variation);
    
    // Calculate the total distance to travel
    const totalDistance = finalPosition - initialPosition;
    
    // Animation function
    function animate(timestamp) {
        if (!isSpinning) return;
        
        // Calculate elapsed time
        const elapsed = timestamp - spinStartTime;
        const duration = SPIN_DURATION_SECONDS * 1000; // Convert to milliseconds
        
        // Calculate progress (0 to 1)
        const linearProgress = Math.min(1, elapsed / duration);
        
        // Apply easing for smooth deceleration
        const easedProgress = easeOutAnimation(linearProgress);
        
        // Apply bounce effect if enabled
        let bounceOffset = 0;
        if (BOUNCE_ENABLED && linearProgress >= 1) {
            // Calculate bounce progress (0 to 1) for the bounce phase
            const bounceElapsed = elapsed - duration;
            const bounceDuration = 1000; // 1 second for bounce effect
            const bounceProgress = Math.min(1, bounceElapsed / bounceDuration);
            
            // Calculate bounce displacement
            bounceOffset = calculateBounce(bounceProgress) * BOUNCE_OVERSHOOT_FACTOR * totalDistance;
            
            // End animation when bounce is complete
            if (bounceProgress >= 1) {
                finishAnimation(winner);
                return;
            }
        }
        
        // Calculate current position
        const currentPosition = initialPosition + easedProgress * totalDistance + bounceOffset;
        
        // Apply transform
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;
        
        // Continue animation if not complete
        if (linearProgress < 1 || (BOUNCE_ENABLED && bounceOffset !== 0)) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            finishAnimation(winner);
        }
    }
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate);
}

// Finish the animation and show winner
function finishAnimation(winner) {
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Highlight the winner items
    const winnerItems = rouletteTrack.querySelectorAll('[data-winner="true"]');
    winnerItems.forEach(item => {
        item.classList.add('winner-highlight');
        
        // Add pulsing animation
        const userColor = getUserColor(winner.userId);
        const keyframesName = `winnerPulse_${winner.userId.replace(/[^a-z0-9]/gi, '')}`;
        
        // Create keyframes for this winner's color if not already created
        if (!document.querySelector(`style[data-keyframes="${keyframesName}"]`)) {
            const style = document.createElement('style');
            style.dataset.keyframes = keyframesName;
            style.textContent = `
                @keyframes ${keyframesName} {
                    0% { box-shadow: 0 0 5px 2px ${userColor}40; }
                    50% { box-shadow: 0 0 15px 5px ${userColor}80; }
                    100% { box-shadow: 0 0 5px 2px ${userColor}40; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Apply the animation
        item.style.animation = `${keyframesName} 1.5s infinite`;
        item.style.borderColor = userColor;
        item.style.borderWidth = '3px';
    });
    
    // Show winner info after a short delay
    setTimeout(() => {
        if (!winnerInfo || !winnerAvatar || !winnerName || !winnerDeposit || !winnerChance) return;
        
        // Update winner info
        winnerAvatar.src = winner.avatarUrl || '/img/default-avatar.png';
        winnerName.textContent = winner.username;
        winnerDeposit.textContent = `$${winner.value.toFixed(2)}`;
        winnerChance.textContent = `${(winner.chance * 100).toFixed(2)}%`;
        
        // Show winner info with fade-in
        winnerInfo.style.display = 'flex';
        winnerInfo.style.opacity = '0';
        
        // Animate fade-in
        let startTime = null;
        function fadeIn(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const duration = 800; // 800ms fade-in
            
            const progress = Math.min(1, elapsed / duration);
            winnerInfo.style.opacity = progress.toString();
            
            if (progress < 1) {
                requestAnimationFrame(fadeIn);
            } else {
                // Create confetti effect
                createConfetti();
                
                // Show return button after a delay
                setTimeout(() => {
                    if (returnToJackpot) {
                        returnToJackpot.style.display = 'block';
                        returnToJackpot.addEventListener('click', resetToJackpotView, { once: true });
                    }
                }, 3000);
            }
        }
        
        requestAnimationFrame(fadeIn);
    }, 1000);
}

// Create confetti effect
function createConfetti() {
    if (!confettiContainer) return;
    
    // Clear any existing confetti
    confettiContainer.innerHTML = '';
    
    // Create confetti pieces
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random properties
        const size = Math.random() * 10 + 5; // 5-15px
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const left = Math.random() * 100; // 0-100%
        const spinSpeed = Math.random() * 360; // 0-360deg
        const fallDelay = Math.random() * 5; // 0-5s
        const fallDuration = Math.random() * 3 + 2; // 2-5s
        
        // Apply styles
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = color;
        confetti.style.left = `${left}%`;
        confetti.style.animation = `
            fall ${fallDuration}s ease-in ${fallDelay}s forwards,
            spin ${spinSpeed / 100}s linear infinite
        `;
        
        confettiContainer.appendChild(confetti);
    }
}

// Test roulette animation (for development)
function testRouletteAnimation() {
    if (isSpinning) return;
    
    // Create mock data for testing
    const mockParticipants = [];
    const participantCount = 10;
    
    for (let i = 0; i < participantCount; i++) {
        const value = Math.random() * 100 + 10; // $10-$110
        const chance = 1 / participantCount; // Equal chance for simplicity
        
        mockParticipants.push({
            userId: `user_${i}`,
            username: `Player ${i + 1}`,
            avatarUrl: '/img/default-avatar.png',
            value: value,
            chance: chance,
            items: Array(Math.floor(Math.random() * 5) + 1).fill(null) // 1-5 items
        });
    }
    
    // Select random winner
    const winnerIndex = Math.floor(Math.random() * mockParticipants.length);
    const mockWinner = mockParticipants[winnerIndex];
    
    // Start animation
    startRouletteAnimation(mockWinner, mockParticipants);
}

// Load past rounds for the Provably Fair page
async function loadPastRounds(page = 1) {
    if (!roundsTableBody) return;
    
    try {
        roundsTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
        
        const response = await fetch(`/api/rounds?page=${page}`);
        if (!response.ok) throw new Error(`Failed to fetch rounds (${response.status})`);
        const data = await response.json();
        
        // Clear loading message
        roundsTableBody.innerHTML = '';
        
        // Add rounds to table
        data.rounds.forEach(round => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${round.id}</td>
                <td>${new Date(round.endTime).toLocaleString()}</td>
                <td>$${round.totalValue.toFixed(2)}</td>
                <td>${round.winner ? round.winner.username : 'N/A'}</td>
                <td>
                    <button class="btn btn-details" onclick="showRoundDetails('${round.id}')">Details</button>
                    <button class="btn btn-verify" onclick="verifyRound('${round.id}')">Verify</button>
                </td>
            `;
            roundsTableBody.appendChild(row);
        });
        
        // Update pagination
        if (roundsPagination) {
            roundsPagination.innerHTML = '';
            
            // Previous page button
            if (data.currentPage > 1) {
                const prevButton = document.createElement('button');
                prevButton.className = 'btn btn-secondary';
                prevButton.textContent = 'Previous';
                prevButton.addEventListener('click', () => loadPastRounds(data.currentPage - 1));
                roundsPagination.appendChild(prevButton);
            }
            
            // Page numbers
            for (let i = Math.max(1, data.currentPage - 2); i <= Math.min(data.totalPages, data.currentPage + 2); i++) {
                const pageButton = document.createElement('button');
                pageButton.className = `btn ${i === data.currentPage ? 'btn-primary' : 'btn-secondary'}`;
                pageButton.textContent = i.toString();
                pageButton.addEventListener('click', () => loadPastRounds(i));
                roundsPagination.appendChild(pageButton);
            }
            
            // Next page button
            if (data.currentPage < data.totalPages) {
                const nextButton = document.createElement('button');
                nextButton.className = 'btn btn-secondary';
                nextButton.textContent = 'Next';
                nextButton.addEventListener('click', () => loadPastRounds(data.currentPage + 1));
                roundsPagination.appendChild(nextButton);
            }
        }
    } catch (error) {
        console.error('Error loading past rounds:', error);
        if (roundsTableBody) {
            roundsTableBody.innerHTML = '<tr><td colspan="5">Error loading rounds. Please try again later.</td></tr>';
        }
    }
}

// Verify a round
async function verifyRound(roundId) {
    const inputRoundId = document.getElementById('round-id');
    const verificationResult = document.getElementById('verification-result');
    
    // If roundId is provided, set it in the input field
    if (roundId && inputRoundId) {
        inputRoundId.value = roundId;
    } else if (inputRoundId) {
        // Otherwise, get it from the input field
        roundId = inputRoundId.value.trim();
    }
    
    if (!roundId) {
        showNotification('Error', 'Please enter a valid Round ID.');
        return;
    }
    
    try {
        if (verificationResult) {
            verificationResult.innerHTML = '<div class="loading">Verifying...</div>';
            verificationResult.style.display = 'block';
        }
        
        const response = await fetch(`/api/verify/${roundId}`);
        if (!response.ok) throw new Error(`Failed to verify round (${response.status})`);
        const data = await response.json();
        
        if (verificationResult) {
            verificationResult.innerHTML = `
                <div class="verification-header ${data.verified ? 'verified' : 'not-verified'}">
                    ${data.verified ? 'Round Verified ✓' : 'Verification Failed ✗'}
                </div>
                <div class="verification-details">
                    <div class="detail-row">
                        <span class="detail-label">Round ID:</span>
                        <span class="detail-value">${data.roundId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Server Seed:</span>
                        <span class="detail-value">${data.serverSeed}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Server Seed Hash:</span>
                        <span class="detail-value">${data.serverSeedHash}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Client Seed:</span>
                        <span class="detail-value">${data.clientSeed}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Combined Hash:</span>
                        <span class="detail-value">${data.combinedHash}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Tickets:</span>
                        <span class="detail-value">${data.totalTickets}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Winning Ticket:</span>
                        <span class="detail-value">${data.winningTicket}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Winner:</span>
                        <span class="detail-value">${data.winner}</span>
                    </div>
                </div>
                <div class="verification-explanation">
                    <p>${data.verified 
                        ? 'The round has been successfully verified. The winning ticket was fairly determined using the server seed and client seed.' 
                        : 'Verification failed. The calculated winning ticket does not match the recorded winning ticket.'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error verifying round:', error);
        if (verificationResult) {
            verificationResult.innerHTML = '<div class="error">Error verifying round. Please try again later.</div>';
        }
    }
}
