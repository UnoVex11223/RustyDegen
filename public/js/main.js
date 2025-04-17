// main.js (Complete with Rustypot-style item layout modifications)
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
            } else handleWinnerAnnouncement(data);
        } else if (!currentRound && data.roundId) { console.warn("Winner for unknown round."); socket.emit('requestRoundData'); }
    });

    socket.on('roundData', (data) => {
        console.log('Round data received:', data);
        currentRound = data;
        updateRoundUI();
    });

    socket.on('timerUpdate', (data) => {
        console.log('Timer update received:', data);
        if (timerValue) timerValue.textContent = data.seconds;
        updateTimerCircle(data.seconds, data.totalSeconds || 120);
    });

    socket.on('userUpdate', (data) => {
        console.log('User update received:', data);
        currentUser = data;
        updateUserUI();
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification('Error', error.message || 'An error occurred.');
    });
}

// Check login status
function checkLoginStatus() {
    fetch('/api/user')
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Not logged in');
        })
        .then(data => {
            currentUser = data;
            updateUserUI();
        })
        .catch(error => {
            console.log('Not logged in:', error);
            // User is not logged in, show login button
            if (loginButton) loginButton.style.display = 'flex';
            if (userProfile) userProfile.style.display = 'none';
        });
}

// Update user UI
function updateUserUI() {
    if (!currentUser) return;
    
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) {
        userProfile.style.display = 'flex';
        if (userAvatar) userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
        if (userName) userName.textContent = currentUser.username || 'Player';
    }
}

// Load user inventory
function loadUserInventory() {
    if (!currentUser) return;
    
    if (inventoryLoading) inventoryLoading.style.display = 'block';
    if (inventoryItems) inventoryItems.innerHTML = '';
    
    // Clear selected items
    selectedItemsList = [];
    if (selectedItems) selectedItems.innerHTML = '';
    if (totalValue) totalValue.textContent = '$0.00';
    if (depositButton) depositButton.disabled = true;
    
    // Fetch inventory from API
    fetch('/api/inventory')
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Failed to load inventory');
        })
        .then(data => {
            userInventory = data.items || [];
            displayInventory();
        })
        .catch(error => {
            console.error('Error loading inventory:', error);
            showNotification('Error', 'Failed to load inventory: ' + error.message);
        })
        .finally(() => {
            if (inventoryLoading) inventoryLoading.style.display = 'none';
        });
}

// Display inventory items
function displayInventory() {
    if (!inventoryItems || !userInventory) return;
    
    if (userInventory.length === 0) {
        inventoryItems.innerHTML = '<p class="empty-inventory">Your inventory is empty.</p>';
        return;
    }
    
    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.itemId = item.id;
        
        const itemImage = document.createElement('img');
        itemImage.className = 'inventory-item-image';
        itemImage.src = item.imageUrl || '/img/default-item.png';
        itemImage.alt = item.name || 'Item';
        
        const itemInfo = document.createElement('div');
        itemInfo.className = 'inventory-item-info';
        
        const itemName = document.createElement('div');
        itemName.className = 'inventory-item-name';
        itemName.textContent = item.name || 'Unknown Item';
        
        const itemValue = document.createElement('div');
        itemValue.className = 'inventory-item-value';
        itemValue.textContent = `$${parseFloat(item.value).toFixed(2)}`;
        
        itemInfo.appendChild(itemName);
        itemInfo.appendChild(itemValue);
        
        itemElement.appendChild(itemImage);
        itemElement.appendChild(itemInfo);
        
        // Add click event to select/deselect item
        itemElement.addEventListener('click', () => toggleItemSelection(item, itemElement));
        
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(item, element) {
    const itemIndex = selectedItemsList.findIndex(i => i.id === item.id);
    
    if (itemIndex === -1) {
        // Item not selected, add it
        selectedItemsList.push(item);
        element.classList.add('selected');
    } else {
        // Item already selected, remove it
        selectedItemsList.splice(itemIndex, 1);
        element.classList.remove('selected');
    }
    
    updateSelectedItemsDisplay();
}

// Update selected items display
function updateSelectedItemsDisplay() {
    if (!selectedItems || !totalValue || !depositButton) return;
    
    selectedItems.innerHTML = '';
    
    if (selectedItemsList.length === 0) {
        depositButton.disabled = true;
        totalValue.textContent = '$0.00';
        return;
    }
    
    let total = 0;
    
    selectedItemsList.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        
        const itemImage = document.createElement('img');
        itemImage.className = 'inventory-item-image';
        itemImage.src = item.imageUrl || '/img/default-item.png';
        itemImage.alt = item.name || 'Item';
        
        const itemInfo = document.createElement('div');
        itemInfo.className = 'inventory-item-info';
        
        const itemName = document.createElement('div');
        itemName.className = 'inventory-item-name';
        itemName.textContent = item.name || 'Unknown Item';
        
        const itemValue = document.createElement('div');
        itemValue.className = 'inventory-item-value';
        itemValue.textContent = `$${parseFloat(item.value).toFixed(2)}`;
        
        itemInfo.appendChild(itemName);
        itemInfo.appendChild(itemValue);
        
        itemElement.appendChild(itemImage);
        itemElement.appendChild(itemInfo);
        
        selectedItems.appendChild(itemElement);
        
        total += parseFloat(item.value);
    });
    
    totalValue.textContent = `$${total.toFixed(2)}`;
    depositButton.disabled = false;
}

// Submit deposit
function submitDeposit() {
    if (!currentUser || selectedItemsList.length === 0) return;
    
    if (depositButton) depositButton.disabled = true;
    
    const depositData = {
        items: selectedItemsList.map(item => item.id),
        roundId: currentRound?.roundId
    };
    
    fetch('/api/deposit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(depositData)
    })
        .then(response => {
            if (response.ok) return response.json();
            return response.json().then(err => { throw new Error(err.message || 'Deposit failed'); });
        })
        .then(data => {
            console.log('Deposit successful:', data);
            showNotification('Success', 'Your items have been deposited!');
            if (depositModal) hideModal(depositModal);
            // Clear selected items
            selectedItemsList = [];
        })
        .catch(error => {
            console.error('Error submitting deposit:', error);
            showNotification('Error', 'Failed to deposit items: ' + error.message);
        })
        .finally(() => {
            if (depositButton) depositButton.disabled = false;
        });
}

// Save user trade URL
function saveUserTradeUrl() {
    if (!tradeUrlInput || !saveTradeUrl) return;
    
    const tradeUrl = tradeUrlInput.value.trim();
    
    if (!tradeUrl) {
        showNotification('Error', 'Please enter a valid trade URL.');
        return;
    }
    
    saveTradeUrl.disabled = true;
    
    fetch('/api/user/tradeurl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tradeUrl })
    })
        .then(response => {
            if (response.ok) return response.json();
            return response.json().then(err => { throw new Error(err.message || 'Failed to save trade URL'); });
        })
        .then(data => {
            console.log('Trade URL saved:', data);
            if (currentUser) currentUser.tradeUrl = tradeUrl;
            showNotification('Success', 'Your trade URL has been saved!');
            if (tradeUrlModal) hideModal(tradeUrlModal);
        })
        .catch(error => {
            console.error('Error saving trade URL:', error);
            showNotification('Error', 'Failed to save trade URL: ' + error.message);
        })
        .finally(() => {
            if (saveTradeUrl) saveTradeUrl.disabled = false;
        });
}

// Update round UI
function updateRoundUI() {
    if (!currentRound) return;
    
    // Update pot value
    if (potValue) {
        potValue.textContent = `$${parseFloat(currentRound.totalValue || 0).toFixed(2)}`;
    }
    
    // Update timer
    if (timerValue && currentRound.timeRemaining !== undefined) {
        timerValue.textContent = Math.max(0, Math.floor(currentRound.timeRemaining));
        updateTimerCircle(currentRound.timeRemaining, currentRound.roundDuration || 120);
    }
    
    // Update participant count
    if (participantCount) {
        const itemCount = currentRound.itemCount || 0;
        const maxItems = MAX_PARTICIPANTS_DISPLAY || 200;
        participantCount.textContent = `${itemCount}/${maxItems}`;
    }
    
    // Display participants/items
    displayParticipants();
}

// Update timer circle
function updateTimerCircle(seconds, totalSeconds) {
    if (!timerForeground) return;
    
    const radius = 42; // Match the r attribute in SVG
    const circumference = 2 * Math.PI * radius;
    
    // Set the stroke-dasharray to the circumference
    timerForeground.style.strokeDasharray = `${circumference} ${circumference}`;
    
    // Calculate the stroke-dashoffset
    const secondsLeft = Math.max(0, Math.min(seconds, totalSeconds));
    const progress = secondsLeft / totalSeconds;
    const dashOffset = circumference * (1 - progress);
    
    // Set the stroke-dashoffset
    timerForeground.style.strokeDashoffset = dashOffset;
}

// Display participants
function displayParticipants() {
    if (!participantsContainer || !currentRound || !currentRound.participants) return;
    
    // Clear container
    participantsContainer.innerHTML = '';
    
    // Check if there are participants
    if (currentRound.participants.length === 0) {
        if (emptyPotMessage) {
            emptyPotMessage.style.display = 'block';
            participantsContainer.appendChild(emptyPotMessage);
        }
        return;
    }
    
    // Hide empty pot message
    if (emptyPotMessage) {
        emptyPotMessage.style.display = 'none';
    }
    
    // Display all items from all participants
    let allItems = [];
    currentRound.participants.forEach(participant => {
        if (participant.items && participant.items.length > 0) {
            participant.items.forEach(item => {
                allItems.push({
                    ...item,
                    user: {
                        id: participant.id,
                        username: participant.username,
                        avatar: participant.avatar
                    }
                });
            });
        }
    });
    
    // Sort items by value (optional)
    allItems.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    
    // Add items to container
    allItems.forEach(item => {
        // Use the original addItemToPot function for the existing implementation
        // This will be replaced by the modified version in the Rustypot-style implementation
        addItemToPot(item);
    });
}

// ORIGINAL: Add item to pot
// This function is kept for reference but will be replaced by the Rustypot-style version
function addItemToPot_ORIGINAL(item) {
    // Hide empty pot message if it's visible
    if (emptyPotMessage) {
        emptyPotMessage.style.display = 'none';
    }
    
    // Create item element
    const itemElement = document.createElement('div');
    itemElement.className = 'pot-item pot-item-new';
    
    // Create and add image
    const itemImage = document.createElement('img');
    itemImage.className = 'pot-item-image';
    itemImage.src = item.imageUrl || '/img/default-item.png';
    itemImage.alt = item.name || 'Item';
    
    // Create and add item info container
    const infoContainer = document.createElement('div');
    infoContainer.className = 'pot-item-info';
    
    // Add item name
    const nameElement = document.createElement('div');
    nameElement.className = 'pot-item-name';
    nameElement.textContent = item.name || 'Unknown Item';
    
    // Add item value
    const valueElement = document.createElement('div');
    valueElement.className = 'pot-item-value';
    valueElement.textContent = `$${parseFloat(item.value).toFixed(2)}`;
    
    // Add user info if available
    if (item.user) {
        const userElement = document.createElement('div');
        userElement.className = 'pot-item-user';
        
        // Add user avatar if available
        if (item.user.avatar) {
            const avatarElement = document.createElement('img');
            avatarElement.className = 'pot-item-avatar';
            avatarElement.src = item.user.avatar;
            avatarElement.alt = item.user.username || 'User';
            userElement.appendChild(avatarElement);
        }
        
        // Add username if available
        if (item.user.username) {
            const usernameElement = document.createElement('span');
            usernameElement.className = 'pot-item-username';
            usernameElement.textContent = item.user.username;
            userElement.appendChild(usernameElement);
        }
        
        infoContainer.appendChild(userElement);
        
        // Add color indicator based on user ID
        if (item.user.id) {
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'pot-item-color-indicator';
            colorIndicator.style.backgroundColor = getUserColor(item.user.id);
            itemElement.appendChild(colorIndicator);
        }
    }
    
    // Assemble the item element
    infoContainer.insertBefore(nameElement, infoContainer.firstChild);
    infoContainer.insertBefore(valueElement, infoContainer.children[1] || null);
    
    itemElement.appendChild(itemImage);
    itemElement.appendChild(infoContainer);
    
    // Add to container
    if (participantsContainer) {
        participantsContainer.appendChild(itemElement);
    }
    
    // Remove animation class after animation completes
    setTimeout(() => {
        itemElement.classList.remove('pot-item-new');
    }, 1000);
    
    return itemElement;
}

// MODIFIED: Add item to pot with Rustypot-style layout
function addItemToPot(item) {
    // Hide empty pot message if it's visible
    if (emptyPotMessage) {
        emptyPotMessage.style.display = 'none';
    }
    
    // Create Rustypot-style item element
    const itemElement = document.createElement('div');
    itemElement.className = 'rustypot-item rustypot-item-new';
    
    // Create image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'rustypot-item-image-container';
    
    // Create and set up image
    const itemImage = document.createElement('img');
    itemImage.className = 'rustypot-item-image';
    itemImage.src = item.imageUrl || '/img/default-item.png';
    itemImage.alt = item.name || 'Item';
    
    // Create price element
    const priceElement = document.createElement('div');
    priceElement.className = 'rustypot-item-price';
    priceElement.textContent = `$${parseFloat(item.value).toFixed(2)}`;
    
    // Assemble the item element
    imageContainer.appendChild(itemImage);
    itemElement.appendChild(imageContainer);
    itemElement.appendChild(priceElement);
    
    // Add to container
    if (participantsContainer) {
        participantsContainer.appendChild(itemElement);
    }
    
    // Remove animation class after animation completes
    setTimeout(() => {
        itemElement.classList.remove('rustypot-item-new');
    }, 500);
    
    return itemElement;
}

// ORIGINAL: Handle new deposit
// This function is kept for reference but will be modified for the Rustypot-style implementation
function handleNewDeposit_ORIGINAL(data) {
    if (!data || !data.participant) {
        console.error('Invalid deposit data received:', data);
        return;
    }
    
    // Update current round data
    if (currentRound) {
        // Update total value
        currentRound.totalValue = data.currentPotValue || currentRound.totalValue;
        
        // Update participant in the list or add if not exists
        const participantIndex = currentRound.participants.findIndex(p => p.id === data.participant.id);
        if (participantIndex !== -1) {
            currentRound.participants[participantIndex] = data.participant;
        } else {
            currentRound.participants.push(data.participant);
        }
    }
    
    // Update UI
    if (potValue) {
        potValue.textContent = `$${parseFloat(data.currentPotValue || 0).toFixed(2)}`;
    }
    
    if (participantCount) {
        const itemCount = data.itemCount || 0;
        const maxItems = MAX_PARTICIPANTS_DISPLAY || 200;
        participantCount.textContent = `${itemCount}/${maxItems}`;
    }
    
    // Add new items to the pot
    if (data.depositedItems && data.depositedItems.length > 0) {
        data.depositedItems.forEach(item => {
            const enhancedItem = {
                ...item,
                user: {
                    id: data.participant.id,
                    username: data.participant.username,
                    avatar: data.participant.avatar
                }
            };
            addItemToPot(enhancedItem);
        });
    }
}

// MODIFIED: Handle new deposit with Rustypot-style layout
function handleNewDeposit(data) {
    if (!data || !data.participant) {
        console.error('Invalid deposit data received:', data);
        return;
    }
    
    // Update pot value and participant count as before
    if (potValue) {
        potValue.textContent = `$${parseFloat(data.currentPotValue || 0).toFixed(2)}`;
    }
    
    if (participantCount) {
        const itemCount = data.itemCount || 0;
        const maxItems = MAX_PARTICIPANTS_DISPLAY || 200;
        participantCount.textContent = `${itemCount}/${maxItems}`;
    }
    
    // Add items to the pot with Rustypot-style layout
    if (data.depositedItems && data.depositedItems.length > 0) {
        data.depositedItems.forEach(item => {
            addItemToPot(item);
        });
    }
}

// Reset pot display
function resetPotDisplay() {
    if (participantsContainer) {
        // Clear all items
        participantsContainer.innerHTML = '';
        
        // Show empty pot message
        if (emptyPotMessage) {
            emptyPotMessage.style.display = 'block';
            participantsContainer.appendChild(emptyPotMessage);
        }
    }
    
    // Reset pot value and participant count
    if (potValue) {
        potValue.textContent = '$0.00';
    }
    
    if (participantCount) {
        participantCount.textContent = `0/${MAX_PARTICIPANTS_DISPLAY || 200}`;
    }
}

// Handle winner announcement
function handleWinnerAnnouncement(data) {
    if (!data || !data.winner || isSpinning) {
        console.error('Invalid winner data or already spinning:', data);
        return;
    }
    
    // Update current round with winner data
    if (currentRound) {
        currentRound.winner = data.winner;
        currentRound.winningTicket = data.winningTicket;
    }
    
    // Start roulette animation
    startRouletteAnimation(data);
}

// Start roulette animation
function startRouletteAnimation(winnerData) {
    if (isSpinning || !currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('Cannot start roulette: already spinning or no participants');
        return;
    }
    
    isSpinning = true;
    
    // Prepare roulette track
    if (rouletteTrack) rouletteTrack.innerHTML = '';
    
    // Create participant elements for roulette
    const participantElements = [];
    
    // Create a list of all participants with their chance percentage
    const participantsWithChance = currentRound.participants.map(participant => {
        const depositValue = parseFloat(participant.depositValue || 0);
        const totalValue = parseFloat(currentRound.totalValue || 1);
        const chance = (depositValue / totalValue) * 100;
        return { ...participant, chance };
    });
    
    // Sort by chance (optional)
    participantsWithChance.sort((a, b) => b.chance - a.chance);
    
    // Create elements for each participant
    participantsWithChance.forEach(participant => {
        // Calculate how many elements to create based on chance
        // This creates a weighted distribution for the roulette
        const elementsCount = Math.max(1, Math.round(participant.chance / 5)); // At least 1, more for higher chances
        
        for (let i = 0; i < elementsCount; i++) {
            const participantElement = document.createElement('div');
            participantElement.className = 'roulette-participant';
            participantElement.dataset.userId = participant.id;
            
            const participantImage = document.createElement('img');
            participantImage.className = 'roulette-participant-image';
            participantImage.src = participant.avatar || '/img/default-avatar.png';
            participantImage.alt = participant.username || 'Participant';
            
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'roulette-participant-color';
            colorIndicator.style.backgroundColor = getUserColor(participant.id);
            
            participantElement.appendChild(participantImage);
            participantElement.appendChild(colorIndicator);
            
            participantElements.push(participantElement);
        }
    });
    
    // Shuffle the elements for randomness
    shuffleArray(participantElements);
    
    // Find the winner element index
    const winnerIndex = participantElements.findIndex(el => el.dataset.userId === winnerData.winner.id);
    
    // If winner not found in the elements, use a random element
    const effectiveWinnerIndex = winnerIndex !== -1 ? winnerIndex : Math.floor(Math.random() * participantElements.length);
    
    // Calculate how many elements to add to ensure the winner is positioned correctly
    const targetPosition = Math.floor(participantElements.length * 0.7); // Position winner at 70% of the visible elements
    const elementsToAdd = targetPosition - effectiveWinnerIndex;
    
    // If we need to add elements, clone from the beginning
    if (elementsToAdd > 0) {
        const additionalElements = participantElements.slice(0, elementsToAdd);
        participantElements.push(...additionalElements);
    }
    
    // Repeat the elements to fill the roulette track
    const repeatedElements = [];
    for (let i = 0; i < ROULETTE_REPETITIONS; i++) {
        const clonedElements = participantElements.map(el => el.cloneNode(true));
        repeatedElements.push(...clonedElements);
    }
    
    // Add all elements to the track
    if (rouletteTrack) {
        repeatedElements.forEach(el => rouletteTrack.appendChild(el));
    }
    
    // Show roulette
    if (jackpotHeader) jackpotHeader.classList.add('roulette-mode');
    if (inlineRoulette) inlineRoulette.style.display = 'block';
    
    // Play sound if available
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.warn('Could not play spin sound:', e));
    }
    
    // Start animation
    spinStartTime = performance.now();
    animateRoulette(winnerData);
}

// Animate roulette
function animateRoulette(winnerData) {
    // Calculate the width of the roulette track
    const trackWidth = rouletteTrack ? rouletteTrack.scrollWidth : 0;
    
    // Calculate the width of the viewport
    const viewportWidth = rouletteTrack ? rouletteTrack.parentElement.offsetWidth : 0;
    
    // Calculate the maximum scroll position
    const maxScroll = trackWidth - viewportWidth;
    
    // Calculate the target position (center of the viewport)
    const targetPosition = viewportWidth / 2;
    
    // Find the winner element
    const winnerElements = rouletteTrack ? Array.from(rouletteTrack.querySelectorAll(`[data-user-id="${winnerData.winner.id}"]`)) : [];
    
    // If no winner elements found, use a fallback
    if (winnerElements.length === 0) {
        console.warn('No winner elements found in roulette track');
        // Continue with animation but will stop at a random position
    }
    
    // Choose a winner element near the end of the track
    const winnerElement = winnerElements.length > 0 ? 
        winnerElements[Math.floor(winnerElements.length * 0.7)] : null;
    
    // Calculate the final scroll position to center the winner
    let finalScrollPosition;
    
    if (winnerElement) {
        // Get the position of the winner element relative to the track
        const winnerPosition = winnerElement.offsetLeft + (winnerElement.offsetWidth / 2);
        
        // Calculate the scroll position to center the winner
        finalScrollPosition = winnerPosition - targetPosition;
        
        // Add some randomness to the final position
        const randomOffset = (Math.random() * 2 - 1) * winnerElement.offsetWidth * LANDING_POSITION_VARIATION;
        finalScrollPosition += randomOffset;
    } else {
        // Fallback: use a position near the end of the track
        finalScrollPosition = maxScroll * 0.9 + (Math.random() * maxScroll * 0.05);
    }
    
    // Ensure the final position is within bounds
    finalScrollPosition = Math.max(0, Math.min(finalScrollPosition, maxScroll));
    
    // Animation function
    const animate = (timestamp) => {
        if (!spinStartTime) spinStartTime = timestamp;
        const elapsed = timestamp - spinStartTime;
        const duration = SPIN_DURATION_SECONDS * 1000; // Convert to milliseconds
        
        if (elapsed < duration) {
            // Calculate progress (0 to 1)
            const rawProgress = elapsed / duration;
            
            // Apply easing function
            const easedProgress = easeOutAnimation(rawProgress);
            
            // Apply bounce effect if enabled
            const bounceEffect = calculateBounce(rawProgress);
            
            // Calculate current scroll position
            const scrollPosition = finalScrollPosition * (easedProgress + bounceEffect);
            
            // Apply the transform
            if (rouletteTrack) {
                rouletteTrack.style.transform = `translateX(-${scrollPosition}px)`;
            }
            
            // Continue animation
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Animation complete
            if (rouletteTrack) {
                rouletteTrack.style.transform = `translateX(-${finalScrollPosition}px)`;
            }
            
            // Show winner info after a short delay
            setTimeout(() => {
                showWinnerInfo(winnerData);
            }, 500);
        }
    };
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate);
}

// Show winner info
function showWinnerInfo(winnerData) {
    if (!winnerData || !winnerData.winner) return;
    
    // Update winner info elements
    if (winnerAvatar) winnerAvatar.src = winnerData.winner.avatar || '/img/default-avatar.png';
    if (winnerName) winnerName.textContent = winnerData.winner.username || 'Winner';
    if (winnerDeposit) winnerDeposit.textContent = `$${parseFloat(winnerData.winner.depositValue || 0).toFixed(2)}`;
    if (winnerChance) winnerChance.textContent = `${(winnerData.winner.chance || 0).toFixed(2)}%`;
    
    // Show winner info
    if (winnerInfo) winnerInfo.style.display = 'flex';
    
    // Create confetti
    createConfetti();
    
    // Show return button after a delay
    setTimeout(() => {
        if (returnToJackpot) returnToJackpot.style.display = 'block';
        
        // Add click event to return button
        if (returnToJackpot) {
            returnToJackpot.addEventListener('click', resetToJackpotView, { once: true });
        }
    }, 2000);
    
    // Auto-reset after a delay
    setTimeout(() => {
        resetToJackpotView();
    }, WINNER_DISPLAY_DURATION);
}

// Create confetti
function createConfetti() {
    if (!confettiContainer) return;
    
    // Clear existing confetti
    confettiContainer.innerHTML = '';
    
    // Create confetti pieces
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random position
        const left = Math.random() * 100;
        confetti.style.left = `${left}%`;
        
        // Random color
        const colorIndex = Math.floor(Math.random() * colorPalette.length);
        confetti.style.backgroundColor = colorPalette[colorIndex];
        
        // Random size
        const size = Math.random() * 10 + 5;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        
        // Random rotation
        const rotation = Math.random() * 360;
        confetti.style.transform = `rotate(${rotation}deg)`;
        
        // Random shape
        const shapes = ['', '50%'];
        const shapeIndex = Math.floor(Math.random() * shapes.length);
        confetti.style.borderRadius = shapes[shapeIndex];
        
        // Random animation duration
        const duration = Math.random() * 3 + 2;
        confetti.style.animationDuration = `${duration}s`;
        
        // Random delay
        const delay = Math.random() * 2;
        confetti.style.animationDelay = `${delay}s`;
        
        confettiContainer.appendChild(confetti);
    }
}

// Reset to jackpot view
function resetToJackpotView() {
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Reset spinning state
    isSpinning = false;
    spinStartTime = 0;
    
    // Hide roulette elements
    if (jackpotHeader) jackpotHeader.classList.remove('roulette-mode');
    if (inlineRoulette) inlineRoulette.style.display = 'none';
    if (winnerInfo) winnerInfo.style.display = 'none';
    if (returnToJackpot) returnToJackpot.style.display = 'none';
    
    // Reset roulette track
    if (rouletteTrack) {
        rouletteTrack.style.transform = 'translateX(0)';
        rouletteTrack.innerHTML = '';
    }
    
    // Clear confetti
    if (confettiContainer) confettiContainer.innerHTML = '';
    
    // Request new round data
    socket.emit('requestRoundData');
}

// Initiate new round visual reset
function initiateNewRoundVisualReset() {
    resetToJackpotView();
}

// Load past rounds for provably fair page
function loadPastRounds(page = 1) {
    if (!roundsTableBody) return;
    
    fetch(`/api/rounds?page=${page}`)
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Failed to load past rounds');
        })
        .then(data => {
            displayPastRounds(data.rounds, data.pagination);
        })
        .catch(error => {
            console.error('Error loading past rounds:', error);
            showNotification('Error', 'Failed to load past rounds: ' + error.message);
        });
}

// Display past rounds
function displayPastRounds(rounds, pagination) {
    if (!roundsTableBody) return;
    
    roundsTableBody.innerHTML = '';
    
    if (!rounds || rounds.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 6;
        emptyCell.textContent = 'No rounds found.';
        emptyCell.style.textAlign = 'center';
        emptyRow.appendChild(emptyCell);
        roundsTableBody.appendChild(emptyRow);
        return;
    }
    
    rounds.forEach(round => {
        const row = document.createElement('tr');
        
        // Round ID
        const idCell = document.createElement('td');
        idCell.textContent = round.roundId || 'N/A';
        row.appendChild(idCell);
        
        // Date
        const dateCell = document.createElement('td');
        dateCell.textContent = round.createdAt ? new Date(round.createdAt).toLocaleString() : 'N/A';
        row.appendChild(dateCell);
        
        // Value
        const valueCell = document.createElement('td');
        valueCell.textContent = `$${parseFloat(round.totalValue || 0).toFixed(2)}`;
        row.appendChild(valueCell);
        
        // Winner
        const winnerCell = document.createElement('td');
        if (round.winner) {
            const winnerName = document.createElement('span');
            winnerName.textContent = round.winner.username || 'Unknown';
            winnerCell.appendChild(winnerName);
            
            if (round.winner.chance) {
                const winnerChance = document.createElement('span');
                winnerChance.textContent = ` (${round.winner.chance.toFixed(2)}%)`;
                winnerChance.style.color = 'var(--text-secondary)';
                winnerCell.appendChild(winnerChance);
            }
        } else {
            winnerCell.textContent = 'N/A';
        }
        row.appendChild(winnerCell);
        
        // Ticket
        const ticketCell = document.createElement('td');
        ticketCell.textContent = round.winningTicket ? round.winningTicket.toFixed(8) : 'N/A';
        row.appendChild(ticketCell);
        
        // Actions
        const actionsCell = document.createElement('td');
        
        const detailsButton = document.createElement('button');
        detailsButton.className = 'btn btn-details';
        detailsButton.textContent = 'Details';
        detailsButton.addEventListener('click', () => showRoundDetails(round.roundId));
        actionsCell.appendChild(detailsButton);
        
        const verifyButton = document.createElement('button');
        verifyButton.className = 'btn btn-verify';
        verifyButton.textContent = 'Verify';
        verifyButton.addEventListener('click', () => verifyRound(round.roundId));
        actionsCell.appendChild(verifyButton);
        
        row.appendChild(actionsCell);
        
        roundsTableBody.appendChild(row);
    });
    
    // Update pagination
    updatePagination(pagination);
}

// Update pagination
function updatePagination(pagination) {
    if (!roundsPagination || !pagination) return;
    
    roundsPagination.innerHTML = '';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'btn btn-secondary';
    prevButton.textContent = 'Previous';
    prevButton.disabled = pagination.currentPage <= 1;
    prevButton.addEventListener('click', () => loadPastRounds(pagination.currentPage - 1));
    roundsPagination.appendChild(prevButton);
    
    // Page indicator
    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
    pageIndicator.style.margin = '0 10px';
    roundsPagination.appendChild(pageIndicator);
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'btn btn-secondary';
    nextButton.textContent = 'Next';
    nextButton.disabled = pagination.currentPage >= pagination.totalPages;
    nextButton.addEventListener('click', () => loadPastRounds(pagination.currentPage + 1));
    roundsPagination.appendChild(nextButton);
}

// Verify round
function verifyRound(roundId) {
    console.log(`Verifying round ${roundId}`);
    if (!roundId) {
        showNotification('Info', 'Please select a round to verify.');
        return;
    }
    
    fetch(`/api/rounds/${roundId}/verify`)
        .then(response => {
            if (response.ok) return response.json();
            throw new Error(`Failed to verify round (${response.status})`);
        })
        .then(data => {
            showVerificationResult(data);
        })
        .catch(error => {
            showNotification('Error', `Could not verify round: ${error.message}`);
            console.error('Error verifying round:', error);
        });
}

// Show verification result
function showVerificationResult(data) {
    if (!data) {
        showNotification('Error', 'Invalid verification data received.');
        return;
    }
    
    const message = `
        Round ID: ${data.roundId || 'N/A'}
        Server Seed: ${data.serverSeed || 'N/A'}
        Client Seed: ${data.clientSeed || 'N/A'}
        Winning Ticket: ${data.winningTicket || 'N/A'}
        Winner: ${data.winner?.username || 'N/A'}
        Verification Result: ${data.verified ? 'VERIFIED ✓' : 'FAILED ✗'}
    `;
    
    showNotification(data.verified ? 'Verification Successful' : 'Verification Failed', message);
}

// Test roulette animation
function testRouletteAnimation() {
    if (isSpinning || !currentRound) return;
    
    // Create mock winner data
    const mockWinner = {
        roundId: currentRound.roundId || 'test-round',
        winner: {
            id: 'test-user',
            username: 'Test Winner',
            avatar: '/img/default-avatar.png',
            depositValue: 50,
            chance: 25
        },
        winningTicket: 0.12345678
    };
    
    // If we have real participants, use one of them as the winner
    if (currentRound.participants && currentRound.participants.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentRound.participants.length);
        const randomParticipant = currentRound.participants[randomIndex];
        
        mockWinner.winner = {
            id: randomParticipant.id,
            username: randomParticipant.username,
            avatar: randomParticipant.avatar,
            depositValue: randomParticipant.depositValue || 50,
            chance: (randomParticipant.depositValue / currentRound.totalValue) * 100 || 25
        };
    }
    
    // Start roulette animation with mock winner
    handleWinnerAnnouncement(mockWinner);
}

// ORIGINAL: Test deposit function
// This function is kept for reference but will be modified for the Rustypot-style implementation
function testDeposit_ORIGINAL() {
    console.log('Testing deposit');
    
    // Create sample items
    const sampleItems = [
        { name: 'AK-47 | Redline', value: 12.50, imageUrl: '/img/items/ak47_redline.png' },
        { name: 'AWP | Asiimov', value: 45.00, imageUrl: '/img/items/awp_asiimov.png' },
        { name: 'Karambit | Fade', value: 320.75, imageUrl: '/img/items/karambit_fade.png' },
        { name: 'M4A4 | Howl', value: 1250.00, imageUrl: '/img/items/m4a4_howl.png' },
        { name: 'Glock-18 | Fade', value: 85.30, imageUrl: '/img/items/glock_fade.png' }
    ];
    
    // Randomly select 1-3 items
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedItems = [];
    
    for (let i = 0; i < numItems; i++) {
        const randomIndex = Math.floor(Math.random() * sampleItems.length);
        selectedItems.push(sampleItems[randomIndex]);
    }
    
    // Calculate total value
    const totalValue = selectedItems.reduce((sum, item) => sum + parseFloat(item.value), 0);
    
    // Create mock deposit data
    const mockDeposit = {
        participant: {
            id: 'test-user-' + Date.now(),
            username: 'TestUser',
            avatar: '/img/default-avatar.png',
            depositValue: totalValue
        },
        depositedItems: selectedItems,
        currentPotValue: totalValue,
        itemCount: selectedItems.length
    };
    
    // Handle the mock deposit
    handleNewDeposit(mockDeposit);
}

// MODIFIED: Test deposit function with Rustypot-style layout
function testDeposit() {
    console.log('Testing deposit with Rustypot-style layout');
    
    // Create sample items
    const sampleItems = [
        { name: 'AK-47 | Redline', value: 12.50, imageUrl: '/img/items/ak47_redline.png' },
        { name: 'AWP | Asiimov', value: 45.00, imageUrl: '/img/items/awp_asiimov.png' },
        { name: 'Karambit | Fade', value: 320.75, imageUrl: '/img/items/karambit_fade.png' },
        { name: 'M4A4 | Howl', value: 1250.00, imageUrl: '/img/items/m4a4_howl.png' },
        { name: 'Glock-18 | Fade', value: 85.30, imageUrl: '/img/items/glock_fade.png' }
    ];
    
    // Randomly select 1-3 items
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedItems = [];
    
    for (let i = 0; i < numItems; i++) {
        const randomIndex = Math.floor(Math.random() * sampleItems.length);
        selectedItems.push(sampleItems[randomIndex]);
    }
    
    // Calculate total value
    const totalValue = selectedItems.reduce((sum, item) => sum + parseFloat(item.value), 0);
    
    // Create mock deposit data
    const mockDeposit = {
        participant: {
            id: 'test-user-' + Date.now(),
            username: 'TestUser',
            avatar: '/img/default-avatar.png'
        },
        depositedItems: selectedItems,
        currentPotValue: totalValue,
        itemCount: selectedItems.length
    };
    
    // Handle the mock deposit
    handleNewDeposit(mockDeposit);
}
