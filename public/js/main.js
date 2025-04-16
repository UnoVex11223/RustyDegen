// main.js (Complete and Modified for Enhanced Roulette Animation)
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
const itemsContainer = document.getElementById('itemsContainer'); // Container for items in pot
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
    if (testSpinButton) {
        testSpinButton.addEventListener('click', testRouletteAnimation);
        // Add a second click handler for testing item addition
        testSpinButton.addEventListener('dblclick', function(e) {
            e.preventDefault();
            addTestItemsToPot();
        });
    }

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

// Socket connection and event handling
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Connected to server');
        // Request current round data
        socket.emit('getRoundData');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        updateRoundDisplay();
    });

    socket.on('timerUpdate', (data) => {
        if (timerValue) timerValue.textContent = data.timeLeft;
        updateTimerCircle(data.timeLeft, ROUND_DURATION);
    });

    socket.on('depositReceived', (data) => {
        console.log('Deposit received:', data);
        // Update UI with new deposit
        updateRoundDisplay();
    });

    socket.on('roundRolling', (data) => {
        console.log('Round rolling:', data);
        startRouletteAnimation(data);
    });

    socket.on('roundCompleted', (data) => {
        console.log('Round completed:', data);
        // Update UI with winner info
        showWinnerInfo(data);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification('Error', error.message || 'An error occurred');
    });
}

// Check login status
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            updateUserDisplay();
        } else {
            // Not logged in, show login button
            if (loginButton) loginButton.style.display = 'block';
            if (userProfile) userProfile.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

// Update user display
function updateUserDisplay() {
    if (!currentUser) return;
    
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) {
        userProfile.style.display = 'flex';
        if (userName) userName.textContent = currentUser.username;
        if (userAvatar) userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
    }
}

// Update round display
function updateRoundDisplay() {
    if (!currentRound) return;
    
    if (potValue) potValue.textContent = `$${currentRound.totalValue.toFixed(2)}`;
    if (participantCount) participantCount.textContent = `${currentRound.items.length}/200`;
    
    // Update items in pot
    updateItemsDisplay();
}

// Update items display
function updateItemsDisplay() {
    if (!itemsContainer || !currentRound?.items) return;
    
    // Clear container
    itemsContainer.innerHTML = '';
    
    if (currentRound.items.length === 0) {
        if (emptyPotMessage) emptyPotMessage.style.display = 'block';
        return;
    }
    
    if (emptyPotMessage) emptyPotMessage.style.display = 'none';
    
    // Add items to container
    currentRound.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'pot-item';
        itemElement.dataset.itemId = item.id;
        
        const userColor = getUserColor(item.userId);
        
        itemElement.innerHTML = `
            <div class="pot-item-color-indicator" style="background-color: ${userColor};"></div>
            <img src="${item.image}" alt="${item.name}" class="pot-item-image">
            <div class="pot-item-info">
                <div class="pot-item-name">${item.name}</div>
                <div class="pot-item-value">$${item.price.toFixed(2)}</div>
                <div class="pot-item-user">
                    <img src="${item.userAvatar}" alt="${item.userName}" class="pot-item-avatar">
                    <span class="pot-item-username">${item.userName}</span>
                </div>
            </div>
        `;
        
        itemsContainer.appendChild(itemElement);
    });
}

// Update timer circle
function updateTimerCircle(timeLeft, totalTime) {
    if (!timerForeground) return;
    
    const normalizedTime = Math.min(1, Math.max(0, timeLeft / totalTime));
    const circumference = 2 * Math.PI * 42; // 42 is the radius from the SVG
    const dashOffset = circumference * (1 - normalizedTime);
    
    timerForeground.style.strokeDasharray = `${circumference} ${circumference}`;
    timerForeground.style.strokeDashoffset = dashOffset;
}

// Load user inventory
async function loadUserInventory() {
    if (!currentUser) return;
    
    if (inventoryLoading) inventoryLoading.style.display = 'block';
    if (inventoryItems) inventoryItems.innerHTML = '';
    
    try {
        const response = await fetch(`/api/inventory/${currentUser.steamId}`);
        if (!response.ok) throw new Error(`Failed to load inventory (${response.status})`);
        
        const data = await response.json();
        userInventory = data.items || [];
        
        displayInventoryItems();
    } catch (error) {
        console.error('Error loading inventory:', error);
        showNotification('Error', `Could not load inventory: ${error.message}`);
    } finally {
        if (inventoryLoading) inventoryLoading.style.display = 'none';
    }
}

// Display inventory items
function displayInventoryItems() {
    if (!inventoryItems || !userInventory) return;
    
    inventoryItems.innerHTML = '';
    
    if (userInventory.length === 0) {
        inventoryItems.innerHTML = '<p class="empty-inventory">No items found in your inventory.</p>';
        return;
    }
    
    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId;
        itemElement.dataset.price = item.price;
        
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="inventory-item-image">
            <div class="inventory-item-info">
                <div class="inventory-item-name">${item.name}</div>
                <div class="inventory-item-price">$${item.price.toFixed(2)}</div>
            </div>
        `;
        
        itemElement.addEventListener('click', () => toggleItemSelection(item, itemElement));
        
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(item, element) {
    const isSelected = element.classList.contains('selected');
    
    if (isSelected) {
        // Remove from selection
        element.classList.remove('selected');
        selectedItemsList = selectedItemsList.filter(i => i.assetId !== item.assetId);
    } else {
        // Add to selection
        element.classList.add('selected');
        selectedItemsList.push(item);
    }
    
    updateSelectedItemsDisplay();
}

// Update selected items display
function updateSelectedItemsDisplay() {
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
        
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="selected-item-image">
            <div class="selected-item-info">
                <div class="selected-item-name">${item.name}</div>
                <div class="selected-item-price">$${item.price.toFixed(2)}</div>
            </div>
            <button class="remove-item-btn" data-asset-id="${item.assetId}">&times;</button>
        `;
        
        itemElement.querySelector('.remove-item-btn').addEventListener('click', () => removeSelectedItem(item));
        
        selectedItems.appendChild(itemElement);
        total += item.price;
    });
    
    totalValue.textContent = `$${total.toFixed(2)}`;
    depositButton.disabled = total < 1.00; // Minimum $1.00 deposit
}

// Remove selected item
function removeSelectedItem(item) {
    // Remove from selected list
    selectedItemsList = selectedItemsList.filter(i => i.assetId !== item.assetId);
    
    // Update UI
    const inventoryItem = document.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);
    if (inventoryItem) inventoryItem.classList.remove('selected');
    
    updateSelectedItemsDisplay();
}

// Submit deposit
async function submitDeposit() {
    if (!currentUser || selectedItemsList.length === 0) return;
    
    depositButton.disabled = true;
    
    try {
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser._id,
                items: selectedItemsList.map(item => ({
                    assetId: item.assetId,
                    name: item.name,
                    price: item.price
                }))
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Deposit failed (${response.status})`);
        }
        
        const result = await response.json();
        
        showNotification('Success', 'Deposit submitted successfully. Check your Steam trade offers.');
        hideModal(depositModal);
        
        // Clear selection
        selectedItemsList = [];
        
        // Refresh inventory after a short delay
        setTimeout(loadUserInventory, 2000);
    } catch (error) {
        console.error('Deposit error:', error);
        showNotification('Error', `Deposit failed: ${error.message}`);
    } finally {
        depositButton.disabled = false;
    }
}

// Save user trade URL
async function saveUserTradeUrl() {
    if (!currentUser || !tradeUrlInput) return;
    
    const tradeUrl = tradeUrlInput.value.trim();
    
    if (!tradeUrl) {
        showNotification('Error', 'Please enter a valid trade URL');
        return;
    }
    
    saveTradeUrl.disabled = true;
    
    try {
        const response = await fetch('/api/user/tradeurl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeUrl })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to save trade URL (${response.status})`);
        }
        
        currentUser.tradeUrl = tradeUrl;
        showNotification('Success', 'Trade URL saved successfully');
        hideModal(tradeUrlModal);
    } catch (error) {
        console.error('Save trade URL error:', error);
        showNotification('Error', `Failed to save trade URL: ${error.message}`);
    } finally {
        saveTradeUrl.disabled = false;
    }
}

// Load past rounds for provably fair page
async function loadPastRounds() {
    if (!roundsTableBody) return;
    
    try {
        const response = await fetch('/api/rounds/past');
        if (!response.ok) throw new Error(`Failed to load past rounds (${response.status})`);
        
        const data = await response.json();
        
        roundsTableBody.innerHTML = '';
        
        data.rounds.forEach(round => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${round.roundId}</td>
                <td>${new Date(round.completedTime).toLocaleString()}</td>
                <td>${round.winner?.username || 'N/A'}</td>
                <td>$${round.totalValue.toFixed(2)}</td>
                <td>
                    <button class="btn btn-details" data-round-id="${round.roundId}">Details</button>
                    <button class="btn btn-verify" data-round-id="${round.roundId}">Verify</button>
                </td>
            `;
            
            row.querySelector('.btn-details').addEventListener('click', () => showRoundDetails(round.roundId));
            row.querySelector('.btn-verify').addEventListener('click', () => verifyRound(round.roundId));
            
            roundsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading past rounds:', error);
        roundsTableBody.innerHTML = `<tr><td colspan="5">Error loading past rounds: ${error.message}</td></tr>`;
    }
}

// Verify round
async function verifyRound(roundId) {
    if (!roundId && verifyBtn) {
        // Get round ID from input if not provided
        const roundIdInput = document.getElementById('verify-round-id');
        if (!roundIdInput) return;
        
        roundId = roundIdInput.value.trim();
        if (!roundId) {
            showNotification('Error', 'Please enter a round ID');
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/rounds/${roundId}/verify`);
        if (!response.ok) throw new Error(`Failed to verify round (${response.status})`);
        
        const data = await response.json();
        
        // Display verification result
        showNotification('Verification Result', `Round ${roundId} verification: ${data.verified ? 'Valid' : 'Invalid'}\nServer Seed: ${data.serverSeed}\nClient Seed: ${data.clientSeed}\nWinning Ticket: ${data.winningTicket}`);
    } catch (error) {
        console.error('Verification error:', error);
        showNotification('Error', `Failed to verify round: ${error.message}`);
    }
}

// --- ROULETTE ANIMATION FUNCTIONS ---

/**
 * Test function to simulate a roulette spin with random data
 */
function testRouletteAnimation() {
    if (isSpinning) return;
    
    console.log('Testing roulette animation...');
    
    // Generate test data
    const testUsers = [
        { id: 'user1', name: 'RustPlayer123', avatar: '/img/default-avatar.png' },
        { id: 'user2', name: 'SkinCollector', avatar: '/img/default-avatar.png' },
        { id: 'user3', name: 'RaidMaster', avatar: '/img/default-avatar.png' },
        { id: 'user4', name: 'HeadshotKing', avatar: '/img/default-avatar.png' },
        { id: 'user5', name: 'LootGoblin', avatar: '/img/default-avatar.png' }
    ];
    
    // Assign random chances to users
    let remainingPercentage = 100;
    const testParticipants = testUsers.map((user, index) => {
        // Last user gets remaining percentage
        const isLast = index === testUsers.length - 1;
        const chance = isLast ? remainingPercentage : Math.floor(Math.random() * (remainingPercentage - 5)) + 5;
        remainingPercentage -= chance;
        
        return {
            user: user,
            chance: chance,
            value: chance * 10 // $10 per 1% for simplicity
        };
    });
    
    // Pick random winner
    const winnerIndex = Math.floor(Math.random() * testParticipants.length);
    const winner = testParticipants[winnerIndex];
    
    // Create test data object
    const testData = {
        participants: testParticipants,
        winner: winner,
        totalValue: testParticipants.reduce((sum, p) => sum + p.value, 0)
    };
    
    // Start animation
    startRouletteAnimation(testData);
}

/**
 * Start the roulette animation with the provided data
 * @param {Object} data - Round data with participants and winner
 */
function startRouletteAnimation(data) {
    if (isSpinning || !rouletteTrack || !inlineRoulette || !jackpotHeader) return;
    
    isSpinning = true;
    
    // Show roulette
    inlineRoulette.style.display = 'block';
    jackpotHeader.classList.add('roulette-mode');
    
    // Create roulette items
    createRouletteItems(data.participants);
    
    // Calculate final position
    const winnerIndex = data.participants.findIndex(p => p.user.id === data.winner.user.id);
    if (winnerIndex === -1) {
        console.error('Winner not found in participants');
        isSpinning = false;
        return;
    }
    
    // Play sound if available
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.log('Sound play error:', e));
    }
    
    // Start animation
    spinStartTime = performance.now();
    animateRoulette(winnerIndex);
}

/**
 * Create roulette items from participants data
 * @param {Array} participants - List of participants with user and chance data
 */
function createRouletteItems(participants) {
    if (!rouletteTrack) return;
    
    // Clear track
    rouletteTrack.innerHTML = '';
    
    // Create weighted list based on chances
    const weightedItems = [];
    participants.forEach(participant => {
        // Add items proportional to chance (1 item per 1% chance)
        const itemCount = Math.max(1, Math.round(participant.chance));
        for (let i = 0; i < itemCount; i++) {
            weightedItems.push(participant);
        }
    });
    
    // Shuffle the weighted items for more randomness
    const shuffledItems = shuffleArray([...weightedItems]);
    
    // Create items and add to track
    shuffledItems.forEach(participant => {
        const itemElement = document.createElement('div');
        itemElement.className = 'roulette-item';
        itemElement.dataset.userId = participant.user.id;
        
        // Get user color
        const userColor = getUserColor(participant.user.id);
        itemElement.style.borderColor = userColor;
        
        itemElement.innerHTML = `
            <div class="profile-pic-container">
                <img src="${participant.user.avatar}" alt="${participant.user.name}" class="roulette-avatar">
            </div>
            <div class="roulette-info">
                <div class="roulette-name">${participant.user.name}</div>
                <div class="roulette-percentage" style="color: ${userColor}">${participant.chance.toFixed(1)}%</div>
            </div>
        `;
        
        rouletteTrack.appendChild(itemElement);
    });
}

/**
 * Animate the roulette to land on the winner
 * @param {number} winnerIndex - Index of the winner in the participants array
 */
function animateRoulette(winnerIndex) {
    // Get all roulette items
    const items = rouletteTrack.querySelectorAll('.roulette-item');
    if (items.length === 0) {
        isSpinning = false;
        return;
    }
    
    // Calculate item width (including margins)
    const itemWidth = items[0].offsetWidth + 10; // 10px for margins
    
    // Calculate total track width
    const trackWidth = itemWidth * items.length;
    
    // Calculate center position of viewport
    const viewportWidth = rouletteTrack.parentElement.offsetWidth;
    const centerPosition = viewportWidth / 2;
    
    // Calculate position of winner item
    // Add random variation to make it less predictable
    const variation = (Math.random() * 2 - 1) * LANDING_POSITION_VARIATION * itemWidth;
    const winnerPosition = winnerIndex * itemWidth + variation;
    
    // Calculate final position (center winner in viewport)
    const finalPosition = -(winnerPosition - centerPosition + itemWidth / 2);
    
    // Calculate total distance to travel
    // Start with 2-4 full rotations plus distance to final position
    const rotations = 2 + Math.random() * 2; // 2-4 rotations
    const startPosition = 0; // Start from current position
    const totalDistance = trackWidth * rotations + (startPosition - finalPosition);
    
    // Animation function
    function animate(timestamp) {
        if (!isSpinning || !rouletteTrack) {
            cancelAnimationFrame(animationFrameId);
            return;
        }
        
        // Calculate elapsed time
        const elapsed = timestamp - spinStartTime;
        const progress = Math.min(1, elapsed / (SPIN_DURATION_SECONDS * 1000));
        
        // Apply easing
        const easedProgress = easeOutAnimation(progress);
        
        // Calculate current position
        let currentPosition = startPosition - totalDistance * easedProgress;
        
        // Add bounce effect if enabled
        if (BOUNCE_ENABLED && progress >= 1) {
            // Calculate bounce progress (0-1 scale for the bounce phase)
            const bounceElapsed = timestamp - spinStartTime - SPIN_DURATION_SECONDS * 1000;
            const bounceProgress = Math.min(1, bounceElapsed / 1000); // 1 second for bounce
            
            // Calculate bounce displacement
            const bounceAmount = calculateBounce(bounceProgress);
            
            // Apply bounce to position (scaled by overshoot factor and total distance)
            currentPosition += bounceAmount * BOUNCE_OVERSHOOT_FACTOR * totalDistance;
            
            // End animation after bounce completes
            if (bounceProgress >= 1) {
                finishAnimation();
                return;
            }
        } else if (progress >= 1) {
            // If no bounce, end animation when main progress completes
            currentPosition = finalPosition; // Ensure exact final position
            finishAnimation();
            return;
        }
        
        // Apply position
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`;
        
        // Continue animation
        animationFrameId = requestAnimationFrame(animate);
    }
    
    // Function to finish animation
    function finishAnimation() {
        // Highlight winner
        const winnerItem = items[winnerIndex];
        if (winnerItem) {
            winnerItem.classList.add('winner-highlight');
            
            // Get user color for winner effects
            const userId = winnerItem.dataset.userId;
            const userColor = getUserColor(userId);
            
            // Create keyframes for winner pulse animation
            const keyframes = document.createElement('style');
            keyframes.innerHTML = `
                @keyframes winnerPulse {
                    0% { box-shadow: 0 0 10px ${userColor}80; border-color: ${userColor}; }
                    50% { box-shadow: 0 0 20px ${userColor}; border-color: ${lightenColor(userColor, 30)}; }
                    100% { box-shadow: 0 0 10px ${userColor}80; border-color: ${userColor}; }
                }
                
                .winner-highlight {
                    animation: winnerPulse 1s infinite ease-in-out;
                    border-width: 3px !important;
                    z-index: 10;
                }
            `;
            document.head.appendChild(keyframes);
        }
        
        // Show winner info after a short delay
        setTimeout(() => {
            if (!isSpinning) return;
            
            // Find winner data
            const winner = participants.find(p => p.user.id === winnerItem?.dataset.userId);
            if (winner) {
                showWinnerInfo(winner);
            }
        }, 2000);
    }
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate);
}

/**
 * Show winner information
 * @param {Object} winner - Winner data
 */
function showWinnerInfo(winner) {
    if (!winnerInfo || !winnerAvatar || !winnerName || !winnerDeposit || !winnerChance) return;
    
    // Set winner info
    winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
    winnerName.textContent = winner.user.name;
    winnerDeposit.textContent = `$${winner.value.toFixed(2)}`;
    winnerChance.textContent = `${winner.chance.toFixed(1)}%`;
    
    // Show winner info
    winnerInfo.style.display = 'flex';
    winnerInfo.style.opacity = '0';
    
    // Fade in
    setTimeout(() => {
        winnerInfo.style.transition = 'opacity 0.8s ease-out';
        winnerInfo.style.opacity = '1';
        
        // Create confetti if container exists
        if (confettiContainer) {
            createConfetti();
        }
        
        // Show return button after delay
        setTimeout(() => {
            if (returnToJackpot) {
                returnToJackpot.style.display = 'block';
                returnToJackpot.addEventListener('click', resetRoulette);
            }
        }, 3000);
        
        // Auto reset after delay
        setTimeout(resetRoulette, WINNER_DISPLAY_DURATION);
    }, 100);
}

/**
 * Reset roulette to initial state
 */
function resetRoulette() {
    if (!isSpinning) return;
    
    isSpinning = false;
    
    // Hide roulette
    if (inlineRoulette) inlineRoulette.style.display = 'none';
    if (jackpotHeader) jackpotHeader.classList.remove('roulette-mode');
    
    // Reset winner info
    if (winnerInfo) {
        winnerInfo.style.opacity = '0';
        setTimeout(() => {
            winnerInfo.style.display = 'none';
            
            // Clear confetti
            if (confettiContainer) {
                confettiContainer.innerHTML = '';
            }
            
            // Hide return button
            if (returnToJackpot) {
                returnToJackpot.style.display = 'none';
                returnToJackpot.removeEventListener('click', resetRoulette);
            }
        }, 800);
    }
    
    // Clear track
    if (rouletteTrack) {
        rouletteTrack.innerHTML = '';
        rouletteTrack.style.transform = 'translateX(0)';
    }
    
    // Create new round
    socket.emit('getRoundData');
}

/**
 * Create confetti effect
 */
function createConfetti() {
    if (!confettiContainer) return;
    
    confettiContainer.innerHTML = '';
    
    // Get winner color for confetti
    const winnerItem = document.querySelector('.winner-highlight');
    const userId = winnerItem?.dataset.userId;
    const userColor = userId ? getUserColor(userId) : '#00e676';
    
    // Create confetti pieces
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        
        // Random properties
        const size = Math.random() * 10 + 5; // 5-15px
        const color = i % 3 === 0 ? userColor : (i % 3 === 1 ? lightenColor(userColor, 30) : darkenColor(userColor, 20));
        const rotation = Math.random() * 360;
        const x = Math.random() * 100; // 0-100%
        const y = -20 - Math.random() * 80; // Start above container
        const duration = Math.random() * 3 + 2; // 2-5s
        const delay = Math.random() * 2; // 0-2s
        
        // Apply styles
        piece.style.width = `${size}px`;
        piece.style.height = `${size}px`;
        piece.style.backgroundColor = color;
        piece.style.transform = `rotate(${rotation}deg)`;
        piece.style.left = `${x}%`;
        piece.style.top = `${y}px`;
        piece.style.animation = `confettiFall ${duration}s ${delay}s ease-in forwards`;
        
        confettiContainer.appendChild(piece);
    }
}

// Function to create a visual item card for the pot
function createPotItemElement(item) {
    // Hide empty pot message if it's visible
    if (emptyPotMessage) {
        emptyPotMessage.style.display = 'none';
    }
    
    // Create the item card element
    const itemElement = document.createElement('div');
    itemElement.className = 'pot-item pot-item-new';
    itemElement.dataset.itemId = item.id;
    
    // Get user color for the color indicator
    const userColor = getUserColor(item.userId);
    
    // Create the HTML structure
    itemElement.innerHTML = `
        <div class="pot-item-color-indicator" style="background-color: ${userColor};"></div>
        <img src="${item.imageUrl || '/img/default-item.png'}" alt="${item.name}" class="pot-item-image">
        <div class="pot-item-info">
            <div class="pot-item-name">${item.name}</div>
            <div class="pot-item-value">$${parseFloat(item.value).toFixed(2)}</div>
            <div class="pot-item-user">
                <img src="${item.userAvatar || '/img/default-avatar.png'}" alt="${item.userName}" class="pot-item-avatar">
                <span class="pot-item-username">${item.userName}</span>
            </div>
        </div>
    `;
    
    // Add to container
    itemsContainer.appendChild(itemElement);
    
    // Remove the animation class after animation completes
    setTimeout(() => {
        itemElement.classList.remove('pot-item-new');
    }, 800);
    
    return itemElement;
}

// Function to handle new item deposits
function handleItemDeposit(item) {
    // Create visual element
    createPotItemElement(item);
    
    // Update pot value and participant count
    updatePotStats();
}

// Function to update pot statistics
function updatePotStats() {
    // This would typically be called after receiving updated data from the server
    // For now, we'll just count the items in the container
    const itemCount = itemsContainer.querySelectorAll('.pot-item').length;
    
    // Update the participant count display
    if (participantCount) {
        participantCount.textContent = `${itemCount}/200`;
    }
    
    // Calculate total pot value (in a real app, this would come from the server)
    let totalValue = 0;
    itemsContainer.querySelectorAll('.pot-item').forEach(item => {
        const valueText = item.querySelector('.pot-item-value').textContent;
        const value = parseFloat(valueText.replace('$', ''));
        if (!isNaN(value)) {
            totalValue += value;
        }
    });
    
    // Update pot value display
    if (potValue) {
        potValue.textContent = `$${totalValue.toFixed(2)}`;
    }
}

// Test function to add sample items to the pot
function addTestItemsToPot() {
    // Sample test users
    const testUsers = [
        { id: 'user1', name: 'RustPlayer123', avatar: '/img/default-avatar.png' },
        { id: 'user2', name: 'SkinCollector', avatar: '/img/default-avatar.png' },
        { id: 'user3', name: 'RaidMaster', avatar: '/img/default-avatar.png' }
    ];
    
    // Sample items
    const testItems = [
        { id: 'item1', name: 'AK-47 | Rust Raider', value: 12.50, imageUrl: '/img/default-item.png' },
        { id: 'item2', name: 'Tactical Gloves', value: 8.75, imageUrl: '/img/default-item.png' },
        { id: 'item3', name: 'Combat Knife | Fade', value: 22.30, imageUrl: '/img/default-item.png' },
        { id: 'item4', name: 'Desert Eagle | Blaze', value: 15.20, imageUrl: '/img/default-item.png' },
        { id: 'item5', name: 'Hoodie | Camo', value: 5.50, imageUrl: '/img/default-item.png' }
    ];
    
    // Clear existing items
    if (itemsContainer) {
        itemsContainer.innerHTML = '';
    }
    
    // Add items with a delay between each
    let delay = 0;
    testItems.forEach((item, index) => {
        // Assign a random user to each item
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        
        // Create complete item object
        const completeItem = {
            ...item,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar
        };
        
        // Add with delay for visual effect
        setTimeout(() => {
            handleItemDeposit(completeItem);
        }, delay);
        
        delay += 800; // 800ms between items
    });
}
