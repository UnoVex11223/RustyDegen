// main.js (Optimized with requested changes: 120s -> 99s timer, vertical deposits, 200 skins per deposit)

const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a.active'); 
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
const participantsContainer = document.getElementById('itemsContainer'); 
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
const SPIN_DURATION_SECONDS = 6.5;
const WINNER_DISPLAY_DURATION = 7000;
const CONFETTI_COUNT = 150;
const MAX_DISPLAY_DEPOSITS = 10;
const MAX_PARTICIPANTS_DISPLAY = 20; // Max number of people able to join at once
const MAX_ITEMS_PER_DEPOSIT = 200; // Allow up to 200 items per pot
const ROUND_DURATION = 99; // CHANGED: Set timer to 99 seconds instead of 120

// Constants for tax calculation
const TAX_MIN_PERCENT = 5;  // Target 5% tax
const TAX_MAX_PERCENT = 10; // Maximum 10% tax if needed
const MIN_POT_FOR_TAX = 10; // Minimum pot value to apply tax

// Animation constants for roulette
const EASE_OUT_POWER = 5;
const BOUNCE_ENABLED = false;
const BOUNCE_OVERSHOOT_FACTOR = 0.07;
const BOUNCE_DAMPING = 0.35;
const BOUNCE_FREQUENCY = 3.5;
const LANDING_POSITION_VARIATION = 0.60;

// User Color Map - distinct colors for players
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
}

function hideModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none';
}

function showPage(pageElement) {
    // Hide all pages
    [homePage, faqPage, fairPage, aboutPage, roadmapPage].forEach(page => { 
        if (page) page.style.display = 'none'; 
    });
    
    // Show selected page
    if (pageElement) pageElement.style.display = 'block';
    
    // Update active links
    document.querySelectorAll('.main-nav a, a#about-link, a#roadmap-link, a#faq-link, a#fair-link')
        .forEach(link => link.classList.remove('active'));
        
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
    alert(`${title}\n${message}`);
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

// Animation Easing Functions
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

// Color Utility Functions
function getComplementaryColor(hex) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
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
            if (!currentUser) { 
                showNotification('Login Required', 'Please log in first to deposit items.'); 
                return; 
            }
            
            if (!currentUser.tradeUrl) {
                if (tradeUrlModal) showModal(tradeUrlModal);
                else showNotification('Trade URL Missing', 'Please set your Steam Trade URL.');
                return;
            }
            
            // Check participant limit before showing modal
            if (currentRound && currentRound.participants && 
                currentRound.participants.length >= MAX_PARTICIPANTS_DISPLAY) {
                showNotification('Round Full', 
                    `This round has reached the participant limit of ${MAX_PARTICIPANTS_DISPLAY}.`);
            }
            
            if (depositModal) { 
                showModal(depositModal); 
                loadUserInventory(); 
            }
        });
    }

    // Deposit Modal Close / Submit
    if (closeDepositModal) closeDepositModal.addEventListener('click', () => { 
        if (depositModal) hideModal(depositModal); 
    });
    
    if (depositButton) depositButton.addEventListener('click', submitDeposit);

    // Trade URL Modal Close / Submit
    if (closeTradeUrlModal) closeTradeUrlModal.addEventListener('click', () => { 
        if (tradeUrlModal) hideModal(tradeUrlModal); 
    });
    
    if (saveTradeUrl) saveTradeUrl.addEventListener('click', saveUserTradeUrl);

    // Age Verification
    if (agreeCheckbox && agreeButton && ageVerificationModal) {
        agreeCheckbox.addEventListener('change', () => { 
            agreeButton.disabled = !agreeCheckbox.checked; 
        });
        
        agreeButton.addEventListener('click', () => { 
            if (agreeCheckbox.checked) { 
                localStorage.setItem('ageVerified', 'true'); 
                hideModal(ageVerificationModal); 
            } 
        });
        
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
        if (ageVerificationModal && e.target === ageVerificationModal && 
            localStorage.getItem('ageVerified')) {
            // Optional hide for age verification
        }
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
    socket.on('connect', () => { 
        console.log('Socket connected:', socket.id); 
        socket.emit('requestRoundData'); 
    });
    
    socket.on('disconnect', (reason) => { 
        console.log('Socket disconnected:', reason); 
        showNotification('Connection Lost', 'Disconnected from server.'); 
    });
    
    socket.on('connect_error', (error) => { 
        console.error('Socket connection error:', error); 
        showNotification('Connection Error', 'Could not connect to server.'); 
    });

    socket.on('roundCreated', (data) => { 
        console.log('New round created:', data); 
        currentRound = data; 
        resetToJackpotView(); 
        updateRoundUI(); 
    });

    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (!data.depositedItems) {
            console.warn("Received participantUpdated event WITHOUT 'depositedItems'. Old format?");
        }
        
        if (currentRound && currentRound.roundId === data.roundId) {
            handleNewDeposit(data);
        } else if (!currentRound && data.roundId) { 
            console.warn("Participant update for unknown round."); 
            socket.emit('requestRoundData'); 
        }
    });

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            if (!currentRound.participants || currentRound.participants.length === 0) {
                console.warn("Received winner but no participants loaded locally.");
                socket.emit('requestRoundData');
                setTimeout(() => {
                    if (currentRound && currentRound.participants && 
                        currentRound.participants.length > 0) {
                        handleWinnerAnnouncement(data);
                    } else { 
                        console.error("Still no participants after requesting data."); 
                        resetToJackpotView(); 
                    }
                }, 1000);
            } else {
                handleWinnerAnnouncement(data);
            }
        } else {
            console.warn("Received winner for mismatched round.");
        }
    });

    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false; 
            if (roundTimer) { 
                clearInterval(roundTimer); 
                roundTimer = null; 
            }
            
            if(timerValue) timerValue.textContent = "Rolling"; 
            if(timerForeground) updateTimerCircle(0, ROUND_DURATION);
        }
    });

    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (data.message === "No participants." || 
            currentRound?.participants?.length === 0) {
            console.log("Round completed with no participants."); 
            setTimeout(resetToJackpotView, 1500);
        }
    });

    socket.on('roundData', (data) => {
        console.log('Received initial round data:', data); 
        if (!data) { 
            console.error("Invalid round data received from server."); 
            return; 
        }
        
        currentRound = data;
        initiateNewRoundVisualReset();
        updateRoundUI();

        if (currentRound.status === 'rolling' && currentRound.winner) {
            console.log("Connected during rolling phase.");
            if (!isSpinning) handleWinnerAnnouncement(currentRound);
        } else if (currentRound.status === 'active' && 
                  currentRound.participants?.length >= 2 && 
                  !timerActive) {
            timerActive = true; 
            startClientTimer(currentRound.timeLeft || ROUND_DURATION);
        } else if (currentRound.status === 'ended' || 
                  currentRound.status === 'completed') {
            console.log("Connected after round ended."); 
            resetToJackpotView();
        }
    });

    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        if (currentUser && data.userId === currentUser._id) {
            showNotification('Trade Offer Sent', 'Check Steam for winnings!');
        }
    });
}

// Check login status
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) { 
            if (response.status === 401 || response.status === 403) {
                currentUser = null; 
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } else { 
            currentUser = await response.json(); 
            console.log('User logged in:', currentUser?.username); 
        }
        updateUserUI();
    } catch (error) { 
        console.error('Error checking login status:', error); 
        currentUser = null; 
        updateUserUI(); 
    }
}

// Update user UI
function updateUserUI() {
    if (currentUser && userProfile && loginButton && userAvatar && userName) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png'; 
        userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none'; 
        userProfile.style.display = 'flex';
    } else if (userProfile && loginButton) { 
        loginButton.style.display = 'flex'; 
        userProfile.style.display = 'none'; 
    }
}

// Load user inventory
async function loadUserInventory() {
    if (!inventoryItems || !selectedItems || !inventoryLoading || !totalValue) { 
        console.error("Inventory DOM elements missing."); 
        return; 
    }
    
    selectedItemsList = []; 
    selectedItems.innerHTML = ''; 
    updateTotalValue();
    
    inventoryLoading.style.display = 'flex'; 
    inventoryItems.innerHTML = '';
    
    try {
        const response = await fetch('/api/inventory');
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Please log in first.');
            } else { 
                const errorData = await response.text(); 
                throw new Error(`Inventory load failed (${response.status}): ${errorData}`); 
            }
        }
        
        userInventory = await response.json(); 
        inventoryLoading.style.display = 'none';
        
        if (!Array.isArray(userInventory)) {
            throw new Error('Invalid inventory data.');
        }
        
        if (userInventory.length === 0) { 
            inventoryItems.innerHTML = '<p class="empty-inventory-message">Inventory empty or unavailable.</p>'; 
            return; 
        }
        
        displayInventoryItems();
    } catch (error) { 
        inventoryLoading.style.display = 'none'; 
        inventoryItems.innerHTML = `<p class="error-message">Error loading inventory: ${error.message}</p>`; 
        console.error('Error loading inventory:', error); 
        showNotification('Inventory Error', error.message); 
    }
}

// Display inventory items
function displayInventoryItems() {
    if (!inventoryItems) return; 
    inventoryItems.innerHTML = '';
    
    userInventory.forEach(item => {
        if (!item || typeof item.price !== 'number' || isNaN(item.price) || 
            !item.assetId || !item.name || !item.image) {
            console.warn("Invalid inventory item:", item); 
            return;
        }
        
        const itemElement = document.createElement('div'); 
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId; 
        itemElement.dataset.name = item.name;
        itemElement.dataset.image = item.image; 
        itemElement.dataset.price = item.price.toFixed(2);
        
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy" 
                onerror="this.onerror=null; this.src='/img/default-item.png';">
            <div class="item-details">
                <div class="item-name" title="${item.name}">${item.name}</div>
                <div class="item-value">${item.price.toFixed(2)}</div>
            </div>`;
            
        if (selectedItemsList.some(selected => selected.assetId === item.assetId)) {
            itemElement.classList.add('selected');
        }
        
        itemElement.addEventListener('click', () => toggleItemSelection(itemElement, item));
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(element, item) {
    if (typeof item.price !== 'number' || isNaN(item.price)) {
        console.error("Attempted to select item with invalid price:", item); 
        showNotification('Selection Error', 'Cannot select item with invalid price.'); 
        return;
    }
    
    const assetId = item.assetId; 
    const index = selectedItemsList.findIndex(i => i.assetId === assetId);
    
    if (index === -1) { 
        // Do not allow more than 200 items in a single deposit
        if (selectedItemsList.length >= MAX_ITEMS_PER_DEPOSIT) {
            showNotification('Selection Limit', `You can select a maximum of ${MAX_ITEMS_PER_DEPOSIT} items per deposit.`);
            return;
        }
        
        selectedItemsList.push(item); 
        element.classList.add('selected'); 
        addSelectedItemElement(item); 
    } else { 
        selectedItemsList.splice(index, 1); 
        element.classList.remove('selected'); 
        removeSelectedItemElement(assetId); 
    }
    
    updateTotalValue();
}

// Add item to selected area
function addSelectedItemElement(item) {
    if (!selectedItems) return;
    
    if (typeof item.price !== 'number' || isNaN(item.price)) { 
        console.error("Cannot add selected item element, invalid price:", item); 
        return; 
    }
    
    const selectedElement = document.createElement('div');
    selectedElement.className = 'selected-item'; 
    selectedElement.dataset.assetId = item.assetId;
    selectedElement.innerHTML = `
        <button class="remove-item" data-asset-id="${item.assetId}" title="Remove Item">&times;</button>
        <img src="${item.image}" alt="${item.name}" loading="lazy" 
            onerror="this.onerror=null; this.src='/img/default-item.png';">
        <div class="selected-item-details">
            <div class="selected-item-value">${item.price.toFixed(2)}</div>
        </div>`;
        
    const inventoryItemElement = inventoryItems.querySelector(
        `.inventory-item[data-asset-id="${item.assetId}"]`);
        
    selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item;
        
        if (inventoryItemElement && originalItem) {
            toggleItemSelection(inventoryItemElement, originalItem);
        } else { 
            removeSelectedItem(item.assetId); 
            updateTotalValue(); 
        }
    });
    
    selectedItems.appendChild(selectedElement);
}

// Remove item from selected area
function removeSelectedItemElement(assetId) { 
    const selectedElement = selectedItems.querySelector(`.selected-item[data-asset-id="${assetId}"]`); 
    if (selectedElement) selectedElement.remove(); 
}

// Remove item logic
function removeSelectedItem(assetId) {
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);
    
    const inventoryElement = inventoryItems?.querySelector(
        `.inventory-item[data-asset-id="${assetId}"]`);
        
    if (inventoryElement) inventoryElement.classList.remove('selected');
    removeSelectedItemElement(assetId);
}

// Update total value display
function updateTotalValue() {
    if (!totalValue || !depositButton) return;
    
    const total = selectedItemsList.reduce((sum, item) => {
        const price = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
        return sum + price;
    }, 0);
    
    totalValue.textContent = `${total.toFixed(2)}`;
    depositButton.disabled = selectedItemsList.length === 0;
}

// Submit deposit
async function submitDeposit() {
    if (selectedItemsList.length === 0) { 
        showNotification('No Items Selected', 'Select items first.'); 
        return; 
    }
    
    if (!currentRound || currentRound.status !== 'active') { 
        showNotification('Deposit Error', 'Wait for next round or round is not active.'); 
        return; 
    }
    
    // Check if timer has hit zero - queue for next pot
    if (timerActive === false && roundTimer === null && currentRound.timeLeft <= 0) {
        showNotification('Round Ending', 'Timer has expired. Your deposit will be queued for the next pot.');
        // The server will handle queueing the deposit for the next round
    }
    
    // Check for participant limit before submitting
    if (currentRound.participants && currentRound.participants.length >= MAX_PARTICIPANTS_DISPLAY) {
        showNotification('Deposit Error', `The participant limit (${MAX_PARTICIPANTS_DISPLAY}) has been reached.`);
        return;
    }
    
    if (!depositButton) return;
    
    depositButton.disabled = true; 
    depositButton.textContent = 'Depositing...';
    
    try {
        const response = await fetch('/api/deposit/initiate', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ items: selectedItemsList.map(item => item.assetId) }) 
        });
        
        if (!response.ok) { 
            const error = await response.json().catch(() => ({ error: 'Deposit failed.' })); 
            throw new Error(error.error || `Deposit failed (${response.status})`); 
        }
        
        if (depositModal) hideModal(depositModal); 
        
        showNotification('Deposit Initiated', 'Accept Steam trade offer.');
        
        selectedItemsList = []; 
        if(selectedItems) selectedItems.innerHTML = ''; 
        if (inventoryItems) {
            inventoryItems.querySelectorAll('.inventory-item.selected')
                .forEach(el => el.classList.remove('selected'));
        }
        
        updateTotalValue();
    } catch (error) { 
        showNotification('Deposit Error', error.message); 
        console.error('Error depositing:', error); 
    } finally { 
        if(depositButton) { 
            depositButton.disabled = selectedItemsList.length === 0; 
            depositButton.textContent = 'Deposit Items'; 
        } 
    }
}

// Save trade URL
async function saveUserTradeUrl() {
    if (!tradeUrlInput || !saveTradeUrl || !tradeUrlModal || !depositModal) { 
        console.error("Trade URL elements missing."); 
        return; 
    }
    
    const tradeUrl = tradeUrlInput.value.trim();
    if (!tradeUrl) { 
        showNotification('Input Required', 'Enter Trade URL.'); 
        return; 
    }
    
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') || 
        !tradeUrl.includes('partner=') || 
        !tradeUrl.includes('token=')) { 
        showNotification('Invalid Format', 'Enter valid Steam Trade URL.'); 
        return; 
    }
    
    saveTradeUrl.disabled = true; 
    saveTradeUrl.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/user/tradeurl', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ tradeUrl }) 
        });
        
        if (!response.ok) { 
            const error = await response.json().catch(() => ({ error: 'Failed to save.' })); 
            throw new Error(error.error || `Save failed (${response.status})`); 
        }
        
        const result = await response.json(); 
        if (currentUser) currentUser.tradeUrl = result.tradeUrl;
        
        hideModal(tradeUrlModal);
        
        if (showDepositModal) showDepositModal.click(); // Re-trigger deposit modal check
        
        showNotification('Success', 'Trade URL saved.');
    } catch (error) { 
        showNotification('Error Saving URL', error.message); 
        console.error('Error updating trade URL:', error); 
    } finally { 
        saveTradeUrl.disabled = false; 
        saveTradeUrl.textContent = 'Save Trade URL'; 
    }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound || !potValue) return;
    
    potValue.textContent = `${(currentRound.totalValue || 0).toFixed(2)}`;
    
    if (!timerActive) updateTimerUI(currentRound.timeLeft !== undefined ? 
        currentRound.timeLeft : ROUND_DURATION);
        
    updateParticipantsUI();
}

// Update timer UI - Changed to use ROUND_DURATION (99 seconds)
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;
    
    const timeToShow = Math.max(0, Math.round(timeLeft));
    
    if (timerActive || timeToShow > 0) {
        timerValue.textContent = timeToShow;
    } else if (isSpinning) {
        timerValue.textContent = "Rolling";
    } else {
        timerValue.textContent = "Ended";
    }
    
    updateTimerCircle(timeToShow, ROUND_DURATION);
    
    if (timerActive && timeToShow <= 10 && timeToShow > 0) { 
        timerValue.classList.add('urgent-pulse'); 
        timerValue.classList.remove('timer-pulse'); 
    } else { 
        timerValue.classList.remove('urgent-pulse'); 
        if (timerActive && timeToShow > 10) {
            timerValue.classList.add('timer-pulse');
        } else {
            timerValue.classList.remove('timer-pulse');
        }
    }
}

/**
 * Displays the latest deposit as a new block at the TOP of the participants container.
 * @param {object} data - The participant update data from the socket event.
 */
function displayLatestDeposit(data) {
    if (!participantsContainer) return;
    
    if (!data || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue)) {
        console.error("Invalid data passed to displayLatestDeposit:", data); 
        return;
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
            <div class="player-deposit-value" style="color: ${userColor}" title="Deposited Value: ${value.toFixed(2)}">${value.toFixed(2)}</div>
        </div>`;

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';

    if (items.length > 0) {
        // Sort by value (highest to lowest)
        items.sort((a, b) => (b.price || 0) - (a.price || 0));
        
        // Limit to MAX_ITEMS_PER_DEPOSIT (200) 
        const displayItems = items.slice(0, MAX_ITEMS_PER_DEPOSIT);
        
        displayItems.forEach(item => {
            if (!item || typeof item.price !== 'number' || isNaN(item.price) || 
                !item.name || !item.image) {
                console.warn("Skipping invalid item in deposit display:", item);
                return;
            }
            
            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} (${item.price.toFixed(2)})`;
            itemElement.style.borderColor = userColor;
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">${item.price.toFixed(2)}</div>
                </div>`;
            itemsGrid.appendChild(itemElement);
        });
        
        // Show a message if there are more items than we display
        if (items.length > MAX_ITEMS_PER_DEPOSIT) {
            const moreItems = document.createElement('div');
            moreItems.className = 'player-deposit-item-more';
            moreItems.style.color = userColor;
            moreItems.textContent = `+${items.length - MAX_ITEMS_PER_DEPOSIT} more items`;
            itemsGrid.appendChild(moreItems);
        }
    }

    depositContainer.appendChild(depositHeader);
    depositContainer.appendChild(itemsGrid);

    // *** CHANGE: Add the new deposit block to the TOP ***
    if (participantsContainer.firstChild) {
        participantsContainer.insertBefore(depositContainer, participantsContainer.firstChild);
    } else {
        participantsContainer.appendChild(depositContainer);
    }

    // Hide empty pot message if it was visible
    if (emptyPotMessage) emptyPotMessage.style.display = 'none';

    // Remove animation class after animation duration
    setTimeout(() => { 
        depositContainer.classList.remove('player-deposit-new'); 
    }, 1000);

    // Limit the number of visible deposit containers by removing from the BOTTOM
    const currentDepositBlocks = participantsContainer.querySelectorAll('.player-deposit-container');
    if (currentDepositBlocks.length > MAX_DISPLAY_DEPOSITS) {
        const blocksToRemove = currentDepositBlocks.length - MAX_DISPLAY_DEPOSITS;
        for (let i = 0; i < blocksToRemove; i++) {
             // Get the last one (BOTTOM)
             const oldestBlock = participantsContainer.querySelector('.player-deposit-container:last-child'); 
             if (oldestBlock && oldestBlock !== depositContainer) {
                 // Add fade-out effect before removing
                 oldestBlock.style.transition = 'opacity 0.3s ease-out';
                 oldestBlock.style.opacity = '0';
                 setTimeout(() => { 
                    if (oldestBlock.parentNode === participantsContainer) {
                        oldestBlock.remove(); 
                    }
                 }, 300);
             }
        }
    }
}

// Handle new deposit - Updated to work with vertical stacking
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || 
        typeof data.itemsValue !== 'number' || isNaN(data.itemsValue) || 
        data.totalValue === undefined) {
        console.error("Invalid participant update data received:", data); 
        return;
    }
    
    if (!data.depositedItems) { 
        data.depositedItems = []; 
    }

    if (!currentRound) {
        currentRound = { 
            roundId: data.roundId, 
            status: 'active', 
            timeLeft: ROUND_DURATION, 
            totalValue: 0, 
            participants: [], 
            items: [] 
        };
        console.warn("Handling deposit for a non-existent local round. Initializing round.");
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Deposit received for wrong round (${data.roundId}). Current is ${currentRound.roundId}. Ignoring.`); 
        return;
    }

    if (!currentRound.participants) currentRound.participants = [];
    
    let participantFound = false;
    currentRound.participants = currentRound.participants.map(p => {
        if (p.user && p.user.id === data.userId) {
            participantFound = true;
            return { 
                ...p, 
                itemsValue: (p.itemsValue || 0) + data.itemsValue, 
                tickets: data.tickets 
            };
        }
        return p;
    });

    if (!participantFound) {
        currentRound.participants.push({
            user: { 
                id: data.userId, 
                username: data.username || 'Unknown', 
                avatar: data.avatar || '/img/default-avatar.png' 
            },
            itemsValue: data.itemsValue, 
            tickets: data.tickets
        });
    }

    currentRound.totalValue = data.totalValue;

    if (Array.isArray(data.depositedItems)) {
        if (!currentRound.items) currentRound.items = [];
        data.depositedItems.forEach(item => {
            if (item && typeof item.price === 'number' && !isNaN(item.price)) {
                currentRound.items.push({ ...item, owner: data.userId });
            } else {
                console.warn("Skipping invalid item while adding to round master list:", item);
            }
        });
    }

    updateRoundUI(); // Update Pot Value, Timer, Participant Count display
    displayLatestDeposit(data); // Display the new deposit visually

    if (currentRound.status === 'active' && 
        currentRound.participants.length >= 1 && 
        !timerActive) {
        console.log("Timer starting - first participant joined the pot.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || ROUND_DURATION);
    }
}

// Update participants UI - MODIFIED to use MAX_PARTICIPANTS_DISPLAY
function updateParticipantsUI() {
    if (!participantsContainer || !participantCount || !emptyPotMessage) {
        console.error("Participants UI elements missing."); 
        return;
    }

    const participants = currentRound?.participants || [];
    const participantNum = participants.length;

    // Update participant count display using the constant
    participantCount.textContent = `${participantNum}/${MAX_PARTICIPANTS_DISPLAY}`;

    // Manage the "Empty Pot" message visibility
    if (participantNum === 0) {
        const hasVisibleChildren = Array.from(participantsContainer.children)
            .some(child => child !== emptyPotMessage && 
                  child.style.display !== 'none' && 
                  parseFloat(child.style.opacity || '1') > 0);

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

// Function to test deposit with mock data - Modified for vertical display
function testDeposit() {
    console.log("--- TESTING DEPOSIT DISPLAY (Adds to Top) ---");
    
    const randomValue = parseFloat((Math.random() * 50 + 5).toFixed(2));
    const mockDeposit = {
        roundId: currentRound?.roundId || 'test-round-123',
        userId: `test_user_${Math.floor(Math.random() * 1000)}`,
        username: ["RustPlayer99", "SkinCollector", "AK47Master", "HeadHunter", 
                  "RustLord", "TheRaider", "ScrapDealer"][Math.floor(Math.random() * 7)],
        avatar: [
            'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg', 
            'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg', 
            'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg', 
            '/img/default-avatar.png'
        ][Math.floor(Math.random() * 4)],
        itemsValue: randomValue,
        tickets: Math.floor(randomValue * 100),
        totalValue: (currentRound?.totalValue || 0) + randomValue,
        depositedItems: []
    };
    
    const itemNames = [
        "AK-47 | Alien Red", "Metal Chest Plate", "Semi-Automatic Rifle", 
        "Garage Door", "Assault Rifle", "Metal Facemask", "Road Sign Kilt", 
        "Coffee Can Helmet", "Double Barrel Shotgun", "Revolver", "Sheet Metal Door", 
        "Medical Syringe"
    ];
    
    // Generate between 5-25 items (potentially more than 20 to test limits)
    const numItems = Math.floor(Math.random() * 20) + 5;
    let remainingValue = mockDeposit.itemsValue; 
    let accumulatedValue = 0;
    
    for (let i = 0; i < numItems; i++) {
        const isLastItem = i === numItems - 1; 
        let itemValue;
        
        if (isLastItem) { 
            itemValue = Math.max(0.01, remainingValue); 
        } else { 
            itemValue = parseFloat((Math.random() * remainingValue * 0.7 + 0.01).toFixed(2)); 
            itemValue = Math.min(itemValue, remainingValue); 
            
            if (remainingValue - itemValue < 0.01 && i < numItems - 2) { 
                itemValue = Math.max(0.01, remainingValue - 0.01); 
            } 
        }
        
        remainingValue -= itemValue; 
        accumulatedValue += itemValue;
        
        if (isLastItem && Math.abs(accumulatedValue - mockDeposit.itemsValue) > 0.001) { 
            itemValue += (mockDeposit.itemsValue - accumulatedValue); 
            itemValue = Math.max(0.01, itemValue); 
        }
        
        mockDeposit.depositedItems.push({ 
            assetId: `test_asset_${Math.floor(Math.random() * 10000)}`, 
            name: itemNames[Math.floor(Math.random() * itemNames.length)], 
            image: `/img/default-item.png`, 
            price: parseFloat(itemValue.toFixed(2)) 
        });
    }
    
    mockDeposit.itemsValue = mockDeposit.depositedItems.reduce((sum, item) => sum + item.price, 0);
    console.log("Mock Deposit Data:", mockDeposit);
    handleNewDeposit(mockDeposit);
}

// Start client timer - Changed to ROUND_DURATION (99)
function startClientTimer(initialTime = ROUND_DURATION) {
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }
    
    let timeLeft = initialTime;
    updateTimerUI(timeLeft);
    
    roundTimer = setInterval(() => {
        timeLeft -= 1;
        
        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            timerActive = false;
            updateTimerUI(0);
            console.log("Timer reached zero.");
        } else {
            updateTimerUI(timeLeft);
        }
    }, 1000);
}

// Update timer circle - Changed to ROUND_DURATION (99)
function updateTimerCircle(timeLeft, maxTime = ROUND_DURATION) {
    if (!timerForeground) return;
    
    const normalizedTime = Math.min(maxTime, Math.max(0, timeLeft));
    const percentage = normalizedTime / maxTime;
    const circumference = 2 * Math.PI * 42; // r=42 from SVG
    
    const dashOffset = circumference * (1 - percentage);
    timerForeground.style.strokeDasharray = `${circumference} ${circumference}`;
    timerForeground.style.strokeDashoffset = dashOffset;
}

// Reset to jackpot view
function resetToJackpotView() {
    if (inlineRoulette) inlineRoulette.style.display = 'none';
    if (jackpotHeader) jackpotHeader.classList.remove('roulette-mode');
    if (returnToJackpot) returnToJackpot.style.display = 'none';
    
    isSpinning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    initiateNewRoundVisualReset();
}

// Initialize new round visuals
function initiateNewRoundVisualReset() {
    if (participantsContainer) {
        // Clear all deposit blocks with animation
        const depositBlocks = participantsContainer.querySelectorAll('.player-deposit-container');
        depositBlocks.forEach(block => {
            block.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            block.style.opacity = '0';
            block.style.transform = 'translateY(20px)';
            setTimeout(() => block.remove(), 300);
        });
    }
    
    if (emptyPotMessage) emptyPotMessage.style.display = 'block';
    
    if (potValue) potValue.textContent = '0.00';
    if (participantCount) participantCount.textContent = `0/${MAX_PARTICIPANTS_DISPLAY}`;
    
    if (timerValue) {
        timerValue.textContent = ROUND_DURATION;
        timerValue.classList.remove('urgent-pulse', 'timer-pulse');
    }
    
    if (timerForeground) updateTimerCircle(ROUND_DURATION, ROUND_DURATION);
    
    userColorMap.clear();
}

// Handle winner announcement
function handleWinnerAnnouncement(data) {
    if (isSpinning) {
        console.log("Already spinning, ignoring duplicate winner announcement.");
        return;
    }
    
    if (!data || !data.winner || !data.winningTicket) {
        console.error("Invalid winner data:", data);
        return;
    }
    
    console.log("Handling winner announcement:", data);
    
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error("Cannot handle winner: no current round or participants.");
        return;
    }
    
    // Update current round with winner data
    currentRound.winner = data.winner;
    currentRound.winningTicket = data.winningTicket;
    currentRound.status = 'completed';
    
    // Stop timer if running
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }
    timerActive = false;
    
    // Prepare for roulette animation
    if (timerValue) timerValue.textContent = "Rolling";
    if (timerForeground) updateTimerCircle(0, ROUND_DURATION);
    
    // Start roulette animation
    startRouletteAnimation(data);
}

// Start roulette animation
function startRouletteAnimation(winnerData) {
    if (!rouletteTrack || !inlineRoulette || !jackpotHeader) {
        console.error("Roulette elements missing.");
        return;
    }
    
    if (isSpinning) {
        console.log("Already spinning, ignoring duplicate spin request.");
        return;
    }
    
    isSpinning = true;
    
    // Prepare roulette track
    rouletteTrack.innerHTML = '';
    jackpotHeader.classList.add('roulette-mode');
    inlineRoulette.style.display = 'block';
    
    // Get participants for roulette
    const participants = currentRound?.participants || [];
    if (participants.length === 0) {
        console.error("No participants for roulette animation.");
        isSpinning = false;
        return;
    }
    
    // Create ticket segments
    const ticketSegments = [];
    participants.forEach(participant => {
        if (!participant.user || !participant.tickets) return;
        
        const userColor = getUserColor(participant.user.id);
        const username = participant.user.username || 'Unknown';
        const avatar = participant.user.avatar || '/img/default-avatar.png';
        const tickets = participant.tickets;
        
        ticketSegments.push({
            userId: participant.user.id,
            username: username,
            avatar: avatar,
            tickets: tickets,
            color: userColor,
            isWinner: participant.user.id === winnerData.winner.id
        });
    });
    
    // Sort segments by user ID for consistency
    ticketSegments.sort((a, b) => a.userId.localeCompare(b.userId));
    
    // Create roulette items
    const rouletteItems = [];
    const totalTickets = ticketSegments.reduce((sum, segment) => sum + segment.tickets, 0);
    
    // Calculate minimum width based on ticket percentage
    const calculateWidth = (tickets) => {
        const percentage = (tickets / totalTickets) * 100;
        // Ensure minimum width for visibility
        return Math.max(percentage, 3) + '%';
    };
    
    // Create repeated segments for smooth animation
    for (let i = 0; i < ROULETTE_REPETITIONS; i++) {
        ticketSegments.forEach(segment => {
            const itemElement = document.createElement('div');
            itemElement.className = 'roulette-item';
            itemElement.dataset.userId = segment.userId;
            itemElement.style.backgroundColor = segment.color;
            itemElement.style.width = calculateWidth(segment.tickets);
            
            // Mark the winning segment in the final repetition
            if (i === ROULETTE_REPETITIONS - 1 && segment.isWinner) {
                itemElement.classList.add('winner-segment');
                itemElement.dataset.isWinner = 'true';
            }
            
            itemElement.innerHTML = `
                <img src="${segment.avatar}" alt="${segment.username}" class="roulette-avatar"
                     onerror="this.onerror=null; this.src='/img/default-avatar.png';">
                <div class="roulette-username">${segment.username}</div>`;
            
            rouletteItems.push(itemElement);
        });
    }
    
    // Shuffle all but the last repetition for randomness
    const nonWinningItems = rouletteItems.slice(0, -ticketSegments.length);
    const winningItems = rouletteItems.slice(-ticketSegments.length);
    shuffleArray(nonWinningItems);
    
    // Append all items to track
    [...nonWinningItems, ...winningItems].forEach(item => rouletteTrack.appendChild(item));
    
    // Find winning element for landing position
    const winningElement = rouletteTrack.querySelector('.winner-segment');
    if (!winningElement) {
        console.error("Winning element not found in roulette track.");
        isSpinning = false;
        return;
    }
    
    // Calculate landing position
    const trackWidth = rouletteTrack.scrollWidth;
    const itemWidth = winningElement.offsetWidth;
    const viewportWidth = inlineRoulette.offsetWidth;
    
    // Position the winning item in the center of viewport with some randomness
    const randomOffset = (Math.random() * 2 - 1) * LANDING_POSITION_VARIATION * itemWidth;
    const landingPosition = winningElement.offsetLeft - (viewportWidth / 2) + (itemWidth / 2) + randomOffset;
    
    // Ensure landing position is within bounds
    const maxScroll = trackWidth - viewportWidth;
    const finalPosition = Math.max(0, Math.min(landingPosition, maxScroll));
    
    // Play sound if available
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.warn("Could not play spin sound:", e));
    }
    
    // Start animation
    spinStartTime = performance.now();
    animateRoulette(finalPosition);
}

// Animate roulette
function animateRoulette(targetPosition) {
    const currentTime = performance.now();
    const elapsedTime = (currentTime - spinStartTime) / 1000; // seconds
    
    if (elapsedTime >= SPIN_DURATION_SECONDS) {
        // Animation complete
        if (rouletteTrack) rouletteTrack.style.transform = `translateX(-${targetPosition}px)`;
        
        // Show winner info after a short delay
        setTimeout(() => {
            showWinnerInfo();
        }, 500);
        
        return;
    }
    
    // Calculate progress with easing
    const progress = elapsedTime / SPIN_DURATION_SECONDS;
    const easedProgress = easeOutAnimation(progress);
    const bounceOffset = calculateBounce(progress) * 50; // Bounce amplitude
    
    // Apply transform
    const currentPosition = targetPosition * easedProgress;
    if (rouletteTrack) {
        rouletteTrack.style.transform = `translateX(-${currentPosition + bounceOffset}px)`;
    }
    
    // Continue animation
    animationFrameId = requestAnimationFrame(() => animateRoulette(targetPosition));
}

// Show winner info
function showWinnerInfo() {
    if (!winnerInfo || !winnerAvatar || !winnerName || !winnerDeposit || !winnerChance || !returnToJackpot) {
        console.error("Winner info elements missing.");
        return;
    }
    
    if (!currentRound || !currentRound.winner) {
        console.error("No winner data available.");
        return;
    }
    
    const winner = currentRound.winner;
    const winnerParticipant = currentRound.participants.find(p => p.user && p.user.id === winner.id);
    
    if (!winnerParticipant) {
        console.error("Winner participant data not found.");
        return;
    }
    
    // Set winner info
    winnerAvatar.src = winner.avatar || '/img/default-avatar.png';
    winnerAvatar.onerror = () => { winnerAvatar.src = '/img/default-avatar.png'; };
    winnerName.textContent = winner.username || 'Unknown';
    
    winnerDeposit.textContent = `$${winnerParticipant.itemsValue.toFixed(2)}`;
    
    const totalValue = currentRound.totalValue || 0;
    const winChance = totalValue > 0 ? (winnerParticipant.itemsValue / totalValue) * 100 : 0;
    winnerChance.textContent = `${winChance.toFixed(2)}%`;
    
    // Show winner info with animation
    winnerInfo.style.display = 'flex';
    winnerInfo.style.animation = 'fadeIn 0.5s forwards';
    
    // Create confetti
    createConfetti();
    
    // Show return button after delay
    setTimeout(() => {
        returnToJackpot.style.display = 'block';
        returnToJackpot.addEventListener('click', resetToJackpotView, { once: true });
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
        const size = Math.random() * 10 + 5;
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const left = Math.random() * 100;
        const duration = Math.random() * 3 + 2;
        const delay = Math.random() * 2;
        
        // Apply styles
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = color;
        confetti.style.left = `${left}%`;
        confetti.style.animation = `confettiFall ${duration}s ease-in ${delay}s forwards`;
        
        confettiContainer.appendChild(confetti);
    }
}

// Test roulette animation
function testRouletteAnimation() {
    if (!currentRound || !currentRound.participants || currentRound.participants.length < 2) {
        showNotification('Test Error', 'Need at least 2 participants for test spin.');
        return;
    }
    
    // Create mock winner data
    const participants = currentRound.participants;
    const randomIndex = Math.floor(Math.random() * participants.length);
    const mockWinner = participants[randomIndex];
    
    if (!mockWinner || !mockWinner.user) {
        showNotification('Test Error', 'Invalid participant data for test.');
        return;
    }
    
    const mockWinnerData = {
        winner: mockWinner.user,
        winningTicket: Math.floor(Math.random() * 10000)
    };
    
    console.log("Test spin with mock winner:", mockWinnerData);
    handleWinnerAnnouncement(mockWinnerData);
}

// Load past rounds for provably fair page
async function loadPastRounds(page = 1) {
    if (!roundsTableBody || !roundsPagination) return;
    
    roundsTableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    
    try {
        const response = await fetch(`/api/rounds?page=${page}&limit=10`);
        if (!response.ok) throw new Error(`Failed to load rounds (${response.status})`);
        
        const data = await response.json();
        if (!data.rounds || !Array.isArray(data.rounds)) {
            throw new Error('Invalid rounds data received.');
        }
        
        displayPastRounds(data.rounds, data.totalPages, page);
    } catch (error) {
        console.error('Error loading past rounds:', error);
        roundsTableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

// Display past rounds
function displayPastRounds(rounds, totalPages, currentPage) {
    if (!roundsTableBody || !roundsPagination) return;
    
    if (rounds.length === 0) {
        roundsTableBody.innerHTML = '<tr><td colspan="6">No rounds found.</td></tr>';
        roundsPagination.innerHTML = '';
        return;
    }
    
    roundsTableBody.innerHTML = '';
    
    rounds.forEach(round => {
        const row = document.createElement('tr');
        
        const formattedDate = new Date(round.completedTime || round.endTime || round.startTime).toLocaleString();
        const totalValue = round.totalValue || 0;
        const participantCount = round.participants?.length || 0;
        const winnerName = round.winner?.username || 'N/A';
        
        row.innerHTML = `
            <td>${round.roundId}</td>
            <td>${formattedDate}</td>
            <td>$${totalValue.toFixed(2)}</td>
            <td>${participantCount}</td>
            <td>${winnerName}</td>
            <td>
                <button class="btn btn-details" data-round-id="${round.roundId}">Details</button>
                <button class="btn btn-verify" data-round-id="${round.roundId}">Verify</button>
            </td>`;
        
        roundsTableBody.appendChild(row);
    });
    
    // Add event listeners to buttons
    roundsTableBody.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', () => showRoundDetails(btn.dataset.roundId));
    });
    
    roundsTableBody.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', () => showVerificationModal(btn.dataset.roundId));
    });
    
    // Create pagination
    createPagination(totalPages, currentPage);
}

// Create pagination
function createPagination(totalPages, currentPage) {
    if (!roundsPagination) return;
    
    roundsPagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const createPageLink = (page, text, isActive = false) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = text || page;
        if (isActive) link.classList.add('active');
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadPastRounds(page);
        });
        
        return link;
    };
    
    // Previous button
    if (currentPage > 1) {
        roundsPagination.appendChild(createPageLink(currentPage - 1, '←'));
    }
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        roundsPagination.appendChild(createPageLink(1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            roundsPagination.appendChild(ellipsis);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        roundsPagination.appendChild(createPageLink(i, i, i === currentPage));
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            roundsPagination.appendChild(ellipsis);
        }
        roundsPagination.appendChild(createPageLink(totalPages));
    }
    
    // Next button
    if (currentPage < totalPages) {
        roundsPagination.appendChild(createPageLink(currentPage + 1, '→'));
    }
}

// Show round details
function showRoundDetails(roundId) {
    console.log(`Show details for round ${roundId}`);
    // Implementation would fetch and display detailed round information
    showNotification('Round Details', `Details for Round #${roundId} (Not implemented in demo)`);
}

// Show verification modal
function showVerificationModal(roundId) {
    console.log(`Show verification for round ${roundId}`);
    // Implementation would show a modal with verification tools
    showNotification('Verify Round', `Verification for Round #${roundId} (Not implemented in demo)`);
}

// Verify round
function verifyRound() {
    console.log('Verify round clicked');
    // Implementation would verify the current round
    showNotification('Verify Round', 'Round verification (Not implemented in demo)');
}

// Calculate tax for winner payout
function calculateTax(items, totalValue) {
    // Skip tax if pot is less than minimum required
    if (totalValue < MIN_POT_FOR_TAX) {
        console.log(`Pot value ($${totalValue.toFixed(2)}) below minimum for tax ($${MIN_POT_FOR_TAX}). Skipping tax.`);
        return { taxItems: [], taxValue: 0 };
    }
    
    // Sort items by value (lowest to highest)
    const sortedItems = [...items].sort((a, b) => a.price - b.price);
    
    // Target tax amount (5-10% of total value)
    const minTaxAmount = totalValue * (TAX_MIN_PERCENT / 100);
    const maxTaxAmount = totalValue * (TAX_MAX_PERCENT / 100);
    
    let taxItems = [];
    let taxValue = 0;
    
    // Try to get as close to minTaxAmount as possible without exceeding maxTaxAmount
    for (const item of sortedItems) {
        const newTaxValue = taxValue + item.price;
        
        // If adding this item exceeds maxTaxAmount and we already have some tax items, stop
        if (newTaxValue > maxTaxAmount && taxItems.length > 0) {
            break;
        }
        
        // Add item to tax
        taxItems.push(item);
        taxValue = newTaxValue;
        
        // If we've reached or exceeded minTaxAmount, stop
        if (taxValue >= minTaxAmount) {
            break;
        }
    }
    
    // Special case: If we couldn't get close to minTaxAmount (e.g., only two $50 items in $100 pot)
    // and taking one item would exceed maxTaxAmount, skip tax
    if (taxItems.length === 1 && taxValue > maxTaxAmount) {
        console.log(`Single tax item value ($${taxValue.toFixed(2)}) exceeds max tax ($${maxTaxAmount.toFixed(2)}). Skipping tax.`);
        return { taxItems: [], taxValue: 0 };
    }
    
    console.log(`Tax calculated: $${taxValue.toFixed(2)} (${(taxValue / totalValue * 100).toFixed(2)}% of pot)`);
    return { taxItems, taxValue };
}
