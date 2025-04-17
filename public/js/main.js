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
        if (data.winner) {
            // If round has a winner but we're not showing it, show it now
            if (!isSpinning && inlineRoulette && inlineRoulette.style.display !== 'block') {
                handleWinnerAnnouncement({ winner: data.winner, winningTicket: data.winningTicket, roundId: data.roundId });
            }
        }
    });

    socket.on('roundTimer', (data) => {
        console.log('Round timer update:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            currentRound.timeRemaining = data.timeRemaining;
            if (timerValue) timerValue.textContent = Math.max(0, Math.floor(data.timeRemaining));
            updateTimerCircle(data.timeRemaining, currentRound.roundDuration || 120);
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification('Error', error.message || 'An error occurred.');
    });
}

// Check login status
function checkLoginStatus() {
    fetch('/api/user/me')
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Not logged in');
        })
        .then(data => {
            console.log('User data:', data);
            currentUser = data;
            updateUserUI();
        })
        .catch(error => {
            console.log('Not logged in:', error);
            // User is not logged in, show login button
            if (loginButton) loginButton.style.display = 'block';
            if (userProfile) userProfile.style.display = 'none';
        });
}

// Update user UI
function updateUserUI() {
    if (!currentUser) return;
    
    // Hide login button and show user profile
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    
    // Update user avatar and name
    if (userAvatar) userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
    if (userName) userName.textContent = currentUser.username || 'User';
}

// Load user inventory
function loadUserInventory() {
    if (!currentUser) return;
    
    // Show loading indicator
    if (inventoryLoading) inventoryLoading.style.display = 'block';
    if (inventoryItems) inventoryItems.innerHTML = '';
    
    // Reset selected items
    selectedItemsList = [];
    if (selectedItems) selectedItems.innerHTML = '';
    if (totalValue) totalValue.textContent = '$0.00';
    if (depositButton) depositButton.disabled = true;
    
    fetch('/api/inventory')
        .then(response => {
            if (response.ok) return response.json();
            return response.json().then(err => { throw new Error(err.message || 'Failed to load inventory'); });
        })
        .then(data => {
            console.log('Inventory loaded:', data);
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

// Display inventory
function displayInventory() {
    if (!inventoryItems || !userInventory) return;
    
    // Clear container
    inventoryItems.innerHTML = '';
    
    // Check if inventory is empty
    if (userInventory.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-inventory-message';
        emptyMessage.textContent = 'Your inventory is empty.';
        inventoryItems.appendChild(emptyMessage);
        return;
    }
    
    // Sort items by value (optional)
    userInventory.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    
    // Add items to container
    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.itemId = item.id;
        
        // Create and add image
        const itemImage = document.createElement('img');
        itemImage.className = 'inventory-item-image';
        itemImage.src = item.imageUrl || '/img/default-item.png';
        itemImage.alt = item.name || 'Item';
        
        // Create and add item info container
        const infoContainer = document.createElement('div');
        infoContainer.className = 'inventory-item-info';
        
        // Add item name
        const nameElement = document.createElement('div');
        nameElement.className = 'inventory-item-name';
        nameElement.textContent = item.name || 'Unknown Item';
        
        // Add item value
        const valueElement = document.createElement('div');
        valueElement.className = 'inventory-item-value';
        valueElement.textContent = `$${parseFloat(item.value).toFixed(2)}`;
        
        // Assemble the item element
        infoContainer.appendChild(nameElement);
        infoContainer.appendChild(valueElement);
        
        itemElement.appendChild(itemImage);
        itemElement.appendChild(infoContainer);
        
        // Add click event listener
        itemElement.addEventListener('click', () => toggleItemSelection(item, itemElement));
        
        // Add to container
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(item, itemElement) {
    const itemIndex = selectedItemsList.findIndex(i => i.id === item.id);
    
    if (itemIndex === -1) {
        // Item is not selected, add it
        selectedItemsList.push(item);
        itemElement.classList.add('selected');
    } else {
        // Item is already selected, remove it
        selectedItemsList.splice(itemIndex, 1);
        itemElement.classList.remove('selected');
    }
    
    // Update selected items display
    displaySelectedItems();
}

// Display selected items
function displaySelectedItems() {
    if (!selectedItems) return;
    
    // Clear container
    selectedItems.innerHTML = '';
    
    // Calculate total value
    const totalValueAmount = selectedItemsList.reduce((sum, item) => sum + parseFloat(item.value), 0);
    if (totalValue) totalValue.textContent = `$${totalValueAmount.toFixed(2)}`;
    
    // Enable/disable deposit button
    if (depositButton) depositButton.disabled = selectedItemsList.length === 0;
    
    // Add items to container
    selectedItemsList.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'selected-item';
        
        // Create and add image
        const itemImage = document.createElement('img');
        itemImage.className = 'selected-item-image';
        itemImage.src = item.imageUrl || '/img/default-item.png';
        itemImage.alt = item.name || 'Item';
        
        // Create and add item info container
        const infoContainer = document.createElement('div');
        infoContainer.className = 'selected-item-info';
        
        // Add item name
        const nameElement = document.createElement('div');
        nameElement.className = 'selected-item-name';
        nameElement.textContent = item.name || 'Unknown Item';
        
        // Add item value
        const valueElement = document.createElement('div');
        valueElement.className = 'selected-item-value';
        valueElement.textContent = `$${parseFloat(item.value).toFixed(2)}`;
        
        // Create and add remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-item-btn';
        removeButton.innerHTML = '&times;';
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSelectedItem(item);
        });
        
        // Assemble the item element
        infoContainer.appendChild(nameElement);
        infoContainer.appendChild(valueElement);
        
        itemElement.appendChild(itemImage);
        itemElement.appendChild(infoContainer);
        itemElement.appendChild(removeButton);
        
        // Add to container
        selectedItems.appendChild(itemElement);
    });
}

// Remove selected item
function removeSelectedItem(item) {
    const itemIndex = selectedItemsList.findIndex(i => i.id === item.id);
    
    if (itemIndex !== -1) {
        // Remove item from selected items list
        selectedItemsList.splice(itemIndex, 1);
        
        // Update selected items display
        displaySelectedItems();
        
        // Update inventory item display
        const inventoryItemElement = document.querySelector(`.inventory-item[data-item-id="${item.id}"]`);
        if (inventoryItemElement) {
            inventoryItemElement.classList.remove('selected');
        }
    }
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
        // Use the modified addItemToPot function for the Rustypot-style implementation
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
    
    // Update pot value and participant count
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
    
    // Shuffle the elements for more randomness
    shuffleArray(participantElements);
    
    // Find the winner element index
    const winnerId = winnerData.winner.id;
    let winnerIndex = -1;
    
    for (let i = 0; i < participantElements.length; i++) {
        if (participantElements[i].dataset.userId === winnerId) {
            winnerIndex = i;
            break;
        }
    }
    
    if (winnerIndex === -1) {
        console.error('Winner not found in participant elements');
        isSpinning = false;
        return;
    }
    
    // Calculate landing position
    // We want the winner to land at the center of the viewport
    // Add some randomness to the landing position
    const landingPositionVariation = Math.random() * LANDING_POSITION_VARIATION - LANDING_POSITION_VARIATION / 2;
    const landingPosition = winnerIndex + landingPositionVariation;
    
    // Repeat the elements to create a longer track
    const repeatedElements = [];
    for (let i = 0; i < ROULETTE_REPETITIONS; i++) {
        participantElements.forEach(element => {
            repeatedElements.push(element.cloneNode(true));
        });
    }
    
    // Add the elements to the track
    repeatedElements.forEach(element => {
        if (rouletteTrack) rouletteTrack.appendChild(element);
    });
    
    // Show the roulette
    if (inlineRoulette) inlineRoulette.style.display = 'block';
    
    // Hide winner info
    if (winnerInfo) winnerInfo.style.display = 'none';
    
    // Play spin sound
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.log('Error playing sound:', e));
    }
    
    // Start the animation
    spinStartTime = performance.now();
    animateRoulette(landingPosition, participantElements.length, winnerData);
}

// Animate roulette
function animateRoulette(landingPosition, itemCount, winnerData) {
    const currentTime = performance.now();
    const elapsedTime = (currentTime - spinStartTime) / 1000; // Convert to seconds
    
    if (elapsedTime >= SPIN_DURATION_SECONDS) {
        // Animation complete
        finishRouletteAnimation(winnerData);
        return;
    }
    
    // Calculate progress (0 to 1)
    const progress = elapsedTime / SPIN_DURATION_SECONDS;
    
    // Apply easing function
    const easedProgress = easeOutAnimation(progress);
    
    // Add bounce effect
    const bounceEffect = calculateBounce(progress);
    
    // Calculate total distance to travel
    // We want to spin multiple times and then land on the winning position
    const totalSpins = 10; // Number of complete spins
    const totalDistance = totalSpins * itemCount + landingPosition;
    
    // Calculate current position
    const currentPosition = easedProgress * totalDistance + bounceEffect * itemCount;
    
    // Calculate track position
    const trackPosition = -currentPosition * (rouletteTrack.firstChild?.offsetWidth || 50);
    
    // Apply transform
    if (rouletteTrack) {
        rouletteTrack.style.transform = `translateX(${trackPosition}px)`;
    }
    
    // Continue animation
    animationFrameId = requestAnimationFrame(() => animateRoulette(landingPosition, itemCount, winnerData));
}

// Finish roulette animation
function finishRouletteAnimation(winnerData) {
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Update winner info
    if (winnerAvatar) winnerAvatar.src = winnerData.winner.avatar || '/img/default-avatar.png';
    if (winnerName) winnerName.textContent = winnerData.winner.username || 'Winner';
    if (winnerDeposit) winnerDeposit.textContent = `$${parseFloat(winnerData.winner.depositValue || 0).toFixed(2)}`;
    if (winnerChance) winnerChance.textContent = `${(parseFloat(winnerData.winner.chance || 0)).toFixed(2)}%`;
    
    // Show winner info
    if (winnerInfo) winnerInfo.style.display = 'block';
    
    // Show return button
    if (returnToJackpot) returnToJackpot.style.display = 'block';
    
    // Add event listener to return button
    if (returnToJackpot) {
        returnToJackpot.onclick = () => {
            resetToJackpotView();
            socket.emit('requestRoundData'); // Request new round data
        };
    }
    
    // Create confetti
    createConfetti();
    
    // Reset spinning state after a delay
    setTimeout(() => {
        isSpinning = false;
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
        
        // Random properties
        const size = Math.random() * 10 + 5; // 5-15px
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const left = Math.random() * 100; // 0-100%
        const duration = Math.random() * 3 + 2; // 2-5s
        const delay = Math.random() * 2; // 0-2s
        
        // Apply styles
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = color;
        confetti.style.left = `${left}%`;
        confetti.style.animationDuration = `${duration}s`;
        confetti.style.animationDelay = `${delay}s`;
        
        // Add to container
        confettiContainer.appendChild(confetti);
    }
}

// Reset to jackpot view
function resetToJackpotView() {
    // Hide roulette
    if (inlineRoulette) inlineRoulette.style.display = 'none';
    
    // Hide winner info
    if (winnerInfo) winnerInfo.style.display = 'none';
    
    // Hide return button
    if (returnToJackpot) returnToJackpot.style.display = 'none';
    
    // Clear confetti
    if (confettiContainer) confettiContainer.innerHTML = '';
    
    // Reset spinning state
    isSpinning = false;
    
    // Reset pot display
    resetPotDisplay();
}

// Initiate new round visual reset
function initiateNewRoundVisualReset() {
    resetToJackpotView();
}

// Test roulette animation
function testRouletteAnimation() {
    if (isSpinning) return;
    
    // Create fake winner data
    const fakeWinner = {
        id: 'test-user-1',
        username: 'Test Winner',
        avatar: '/img/default-avatar.png',
        depositValue: 100,
        chance: 50
    };
    
    // Create fake participants
    const fakeParticipants = [
        {
            id: 'test-user-1',
            username: 'Test User 1',
            avatar: '/img/default-avatar.png',
            depositValue: 100,
            items: [
                { id: 'item-1', name: 'Test Item 1', value: 50, imageUrl: '/img/default-item.png' },
                { id: 'item-2', name: 'Test Item 2', value: 50, imageUrl: '/img/default-item.png' }
            ]
        },
        {
            id: 'test-user-2',
            username: 'Test User 2',
            avatar: '/img/default-avatar.png',
            depositValue: 50,
            items: [
                { id: 'item-3', name: 'Test Item 3', value: 25, imageUrl: '/img/default-item.png' },
                { id: 'item-4', name: 'Test Item 4', value: 25, imageUrl: '/img/default-item.png' }
            ]
        },
        {
            id: 'test-user-3',
            username: 'Test User 3',
            avatar: '/img/default-avatar.png',
            depositValue: 50,
            items: [
                { id: 'item-5', name: 'Test Item 5', value: 50, imageUrl: '/img/default-item.png' }
            ]
        }
    ];
    
    // Set current round data
    currentRound = {
        roundId: 'test-round',
        totalValue: 200,
        participants: fakeParticipants,
        timeRemaining: 0,
        roundDuration: 120
    };
    
    // Update UI
    updateRoundUI();
    
    // Start roulette animation
    handleWinnerAnnouncement({
        winner: fakeWinner,
        winningTicket: 0.5,
        roundId: 'test-round'
    });
}

// Test deposit
function testDeposit() {
    // Create fake deposit data
    const fakeDeposit = {
        participant: {
            id: 'test-user-' + Math.floor(Math.random() * 1000),
            username: 'Test User ' + Math.floor(Math.random() * 1000),
            avatar: '/img/default-avatar.png',
            depositValue: Math.random() * 100 + 10
        },
        depositedItems: [
            {
                id: 'item-' + Math.floor(Math.random() * 1000),
                name: 'Test Item ' + Math.floor(Math.random() * 1000),
                value: Math.random() * 50 + 5,
                imageUrl: '/img/default-item.png'
            },
            {
                id: 'item-' + Math.floor(Math.random() * 1000),
                name: 'Test Item ' + Math.floor(Math.random() * 1000),
                value: Math.random() * 50 + 5,
                imageUrl: '/img/default-item.png'
            }
        ],
        currentPotValue: (parseFloat(currentRound?.totalValue || 0) + Math.random() * 100 + 10),
        itemCount: (parseInt(participantCount?.textContent?.split('/')[0] || 0) + 2),
        roundId: currentRound?.roundId || 'test-round'
    };
    
    // If no current round, create one
    if (!currentRound) {
        currentRound = {
            roundId: 'test-round',
            totalValue: fakeDeposit.currentPotValue,
            participants: [fakeDeposit.participant],
            timeRemaining: 120,
            roundDuration: 120
        };
    } else {
        // Update current round
        currentRound.totalValue = fakeDeposit.currentPotValue;
        
        // Add participant if not exists
        const participantIndex = currentRound.participants.findIndex(p => p.id === fakeDeposit.participant.id);
        if (participantIndex === -1) {
            currentRound.participants.push(fakeDeposit.participant);
        }
    }
    
    // Handle deposit
    handleNewDeposit(fakeDeposit);
}

// Load past rounds
function loadPastRounds(page = 1) {
    if (!roundsTableBody) return;
    
    // Clear table
    roundsTableBody.innerHTML = '';
    
    // Add loading indicator
    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.colSpan = 5;
    loadingCell.textContent = 'Loading...';
    loadingCell.style.textAlign = 'center';
    loadingRow.appendChild(loadingCell);
    roundsTableBody.appendChild(loadingRow);
    
    fetch(`/api/rounds?page=${page}&limit=10`)
        .then(response => {
            if (response.ok) return response.json();
            throw new Error(`Failed to fetch rounds (${response.status})`);
        })
        .then(data => {
            console.log('Past rounds loaded:', data);
            
            // Clear loading indicator
            roundsTableBody.innerHTML = '';
            
            // Check if there are rounds
            if (!data.rounds || data.rounds.length === 0) {
                const noDataRow = document.createElement('tr');
                const noDataCell = document.createElement('td');
                noDataCell.colSpan = 5;
                noDataCell.textContent = 'No rounds found.';
                noDataCell.style.textAlign = 'center';
                noDataRow.appendChild(noDataCell);
                roundsTableBody.appendChild(noDataRow);
                return;
            }
            
            // Add rounds to table
            data.rounds.forEach(round => {
                const row = document.createElement('tr');
                
                // Round ID
                const idCell = document.createElement('td');
                idCell.textContent = round.roundId || 'N/A';
                row.appendChild(idCell);
                
                // Winner
                const winnerCell = document.createElement('td');
                if (round.winner) {
                    const winnerAvatar = document.createElement('img');
                    winnerAvatar.className = 'winner-avatar-small';
                    winnerAvatar.src = round.winner.avatar || '/img/default-avatar.png';
                    winnerAvatar.alt = round.winner.username || 'Winner';
                    
                    const winnerName = document.createElement('span');
                    winnerName.textContent = round.winner.username || 'Unknown';
                    
                    winnerCell.appendChild(winnerAvatar);
                    winnerCell.appendChild(winnerName);
                } else {
                    winnerCell.textContent = 'N/A';
                }
                row.appendChild(winnerCell);
                
                // Value
                const valueCell = document.createElement('td');
                valueCell.textContent = `$${parseFloat(round.totalValue || 0).toFixed(2)}`;
                row.appendChild(valueCell);
                
                // Winning Ticket
                const ticketCell = document.createElement('td');
                ticketCell.textContent = round.winningTicket ? round.winningTicket.toFixed(8) : 'N/A';
                row.appendChild(ticketCell);
                
                // Actions
                const actionsCell = document.createElement('td');
                
                const detailsButton = document.createElement('button');
                detailsButton.className = 'btn btn-details';
                detailsButton.textContent = 'Details';
                detailsButton.addEventListener('click', () => showRoundDetails(round.roundId));
                
                const verifyButton = document.createElement('button');
                verifyButton.className = 'btn btn-verify';
                verifyButton.textContent = 'Verify';
                verifyButton.addEventListener('click', () => verifyRound(round.roundId));
                
                actionsCell.appendChild(detailsButton);
                actionsCell.appendChild(verifyButton);
                
                row.appendChild(actionsCell);
                
                roundsTableBody.appendChild(row);
            });
            
            // Update pagination
            updatePagination(data.currentPage, data.totalPages);
        })
        .catch(error => {
            console.error('Error loading past rounds:', error);
            
            // Clear loading indicator
            roundsTableBody.innerHTML = '';
            
            // Show error message
            const errorRow = document.createElement('tr');
            const errorCell = document.createElement('td');
            errorCell.colSpan = 5;
            errorCell.textContent = `Error loading rounds: ${error.message}`;
            errorCell.style.textAlign = 'center';
            errorRow.appendChild(errorCell);
            roundsTableBody.appendChild(errorRow);
        });
}

// Update pagination
function updatePagination(currentPage, totalPages) {
    if (!roundsPagination) return;
    
    // Clear pagination
    roundsPagination.innerHTML = '';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'btn btn-pagination';
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => loadPastRounds(currentPage - 1));
    roundsPagination.appendChild(prevButton);
    
    // Page indicator
    const pageIndicator = document.createElement('span');
    pageIndicator.className = 'pagination-indicator';
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    roundsPagination.appendChild(pageIndicator);
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'btn btn-pagination';
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => loadPastRounds(currentPage + 1));
    roundsPagination.appendChild(nextButton);
}

// Verify round
function verifyRound(roundId) {
    console.log(`Verifying round ${roundId}`);
    if (!roundId) {
        showNotification('Info', 'Invalid Round ID for verification.');
        return;
    }
    
    // Redirect to verification page
    window.location.href = `/verify.html?roundId=${roundId}`;
}
