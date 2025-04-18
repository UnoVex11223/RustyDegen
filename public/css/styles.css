// main.js - Rust Jackpot Frontend Logic

// Ensure Socket.IO client library is loaded before this script
// Example: <script src="/socket.io/socket.io.js"></script>

// Establish Socket.IO connection
const socket = io();

// --- Configuration Constants ---
const CONFIG = {
    ROUND_DURATION: 99, // Timer duration in seconds
    MAX_ITEMS_PER_DEPOSIT: 20, // Max selectable items per deposit action
    MAX_DISPLAY_DEPOSITS: 10, // Max vertical deposit blocks shown visually
    MAX_PARTICIPANTS_DISPLAY: 20, // Max participants allowed (should match backend)
    MAX_ITEMS_PER_POT_FRONTEND: 200, // Max items in pot (should match backend)
    ROULETTE_REPETITIONS: 20, // How many times the participant pool is repeated visually in roulette
    SPIN_DURATION_SECONDS: 6.5, // Duration of the main roulette spin animation
    WINNER_DISPLAY_DURATION: 7000, // How long winner info is shown (ms)
    CONFETTI_COUNT: 150, // Number of confetti pieces
    // Roulette Animation Physics (Adjust for feel)
    EASE_OUT_POWER: 5, // Higher value = faster initial speed, slower end
    BOUNCE_ENABLED: false, // Enable/disable landing bounce effect
    BOUNCE_OVERSHOOT_FACTOR: 0.07, // How much it overshoots before bouncing back (if enabled)
    BOUNCE_DAMPING: 0.35, // How quickly the bounce settles (if enabled)
    BOUNCE_FREQUENCY: 3.5, // How many bounces occur (if enabled)
    LANDING_POSITION_VARIATION: 0.60, // Randomness in landing position (0 to 1, fraction of item width)
};

// User Color Palette (20 distinct colors)
const COLOR_PALETTE = [
    '#00bcd4', '#ff5722', '#9c27b0', '#4caf50', '#ffeb3b', '#2196f3', '#f44336', '#ff9800',
    '#e91e63', '#8bc34a', '#3f51b5', '#009688', '#cddc39', '#795548', '#607d8b', '#673ab7',
    '#ffc107', '#03a9f4', '#9e9e9e', '#8d6e63'
];

// --- DOM Element References ---
// Grouping DOM elements for better organization
const DOMElements = {
    // Navigation
    nav: {
        homeLink: document.querySelector('.main-nav a.active'), // Assuming first link is home
        faqLink: document.getElementById('faq-link'),
        fairLink: document.getElementById('fair-link'),
        aboutLink: document.getElementById('about-link'),
        roadmapLink: document.getElementById('roadmap-link'),
    },
    pages: {
        homePage: document.getElementById('home-page'),
        faqPage: document.getElementById('faq-page'),
        fairPage: document.getElementById('fair-page'),
        aboutPage: document.getElementById('about-page'),
        roadmapPage: document.getElementById('roadmap-page'),
    },
    // User Authentication / Profile
    user: {
        loginButton: document.getElementById('loginButton'),
        userProfile: document.getElementById('userProfile'),
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
    },
    // Jackpot Display
    jackpot: {
        potValue: document.getElementById('potValue'),
        timerValue: document.getElementById('timerValue'),
        timerForeground: document.querySelector('.timer-foreground'), // SVG Circle
        participantCount: document.getElementById('participantCount'),
        participantsContainer: document.getElementById('itemsContainer'), // Vertical list container
        emptyPotMessage: document.getElementById('emptyPotMessage'),
        jackpotHeader: document.getElementById('jackpotHeader'), // Container for value/timer/stats
    },
    // Deposit Modal & Inventory
    deposit: {
        showDepositModalButton: document.getElementById('showDepositModal'),
        depositModal: document.getElementById('depositModal'),
        closeDepositModalButton: document.getElementById('closeDepositModal'),
        depositButton: document.getElementById('depositButton'), // The actual "Deposit Items" button inside modal
        inventoryItemsContainer: document.getElementById('inventory-items'),
        selectedItemsContainer: document.getElementById('selectedItems'),
        totalValueDisplay: document.getElementById('totalValue'),
        inventoryLoadingIndicator: document.getElementById('inventory-loading'),
    },
    // Trade URL Modal
    tradeUrl: {
        tradeUrlModal: document.getElementById('tradeUrlModal'),
        closeTradeUrlModalButton: document.getElementById('closeTradeUrlModal'),
        tradeUrlInput: document.getElementById('tradeUrlInput'),
        saveTradeUrlButton: document.getElementById('saveTradeUrl'),
    },
    // Roulette Animation Elements
    roulette: {
        inlineRouletteContainer: document.getElementById('inlineRoulette'), // Main container shown during spin
        rouletteTrack: document.getElementById('rouletteTrack'), // The horizontally scrolling element
        winnerInfoBox: document.getElementById('winnerInfo'), // Box showing winner details after spin
        winnerAvatar: document.getElementById('winnerAvatar'),
        winnerName: document.getElementById('winnerName'),
        winnerDeposit: document.getElementById('winnerDeposit'), // Displays winner's deposited value
        winnerChance: document.getElementById('winnerChance'), // Displays winner's chance
        returnToJackpotButton: document.getElementById('returnToJackpot'), // Optional button
        confettiContainer: document.getElementById('confettiContainer'), // For confetti effect
        spinSound: document.getElementById('spinSound'), // <audio> element
    },
    // Provably Fair Elements
    provablyFair: {
        verifyButton: document.getElementById('verify-btn'),
        roundsTableBody: document.getElementById('rounds-table-body'),
        roundsPagination: document.getElementById('rounds-pagination'),
        roundIdInput: document.getElementById('round-id'),
        serverSeedInput: document.getElementById('server-seed'),
        clientSeedInput: document.getElementById('client-seed'),
        verificationResultDisplay: document.getElementById('verification-result'),
        verificationSection: document.getElementById('provably-fair-verification'), // Section for scrolling
    },
    // Age Verification Modal
    ageVerification: {
        modal: document.getElementById('ageVerificationModal'),
        checkbox: document.getElementById('agreeCheckbox'),
        agreeButton: document.getElementById('agreeButton'),
    },
    // General UI
    notificationBar: document.getElementById('notification-bar'), // Add this div to your HTML for notifications
};

// --- Application State ---
let currentUser = null; // Stores logged-in user data (null if not logged in)
let currentRound = null; // Stores data about the current jackpot round
let selectedItemsList = []; // Items selected in the deposit modal
let userInventory = []; // User's inventory items fetched from backend
let isSpinning = false; // Tracks if the roulette animation is currently active
let timerActive = false; // Tracks if the client-side countdown interval is running
let roundTimer = null; // Holds the interval ID for the client-side timer
let animationFrameId = null; // Holds the ID for the roulette animation frame request
let userColorMap = new Map(); // Maps userId to a color from the palette for consistency
let notificationTimeout = null; // Timeout ID for hiding the notification bar

// --- Helper Functions ---

/**
 * Displays a modal dialog.
 * @param {HTMLElement} modalElement - The modal element to show.
 */
function showModal(modalElement) {
    if (modalElement) modalElement.style.display = 'flex';
}

/**
 * Hides a modal dialog.
 * @param {HTMLElement} modalElement - The modal element to hide.
 */
function hideModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none';
}

/**
 * Shows a specific page section and hides others. Updates navigation link styles.
 * @param {HTMLElement} pageElement - The page element to display.
 */
function showPage(pageElement) {
    // Hide all page containers
    Object.values(DOMElements.pages).forEach(page => {
        if (page) page.style.display = 'none';
    });

    // Show the selected page container
    if (pageElement) pageElement.style.display = 'block';

    // Update active state on navigation links
    document.querySelectorAll('.main-nav a, a#about-link, a#roadmap-link, a#faq-link, a#fair-link')
        .forEach(link => link?.classList.remove('active'));

    // Find the corresponding link element to activate
    let activeLink = null;
    if (pageElement === DOMElements.pages.homePage) activeLink = DOMElements.nav.homeLink;
    else if (pageElement === DOMElements.pages.faqPage) activeLink = DOMElements.nav.faqLink;
    else if (pageElement === DOMElements.pages.fairPage) activeLink = DOMElements.nav.fairLink;
    else if (pageElement === DOMElements.pages.aboutPage) activeLink = DOMElements.nav.aboutLink;
    else if (pageElement === DOMElements.pages.roadmapPage) activeLink = DOMElements.nav.roadmapLink;

    if (activeLink) activeLink.classList.add('active');

    // Load round history if navigating to the Provably Fair page
    if (pageElement === DOMElements.pages.fairPage) {
        loadPastRounds();
    }
}

/**
 * Assigns and retrieves a consistent color for a given user ID.
 * Cycles through the COLOR_PALETTE.
 * @param {string} userId - The ID of the user.
 * @returns {string} The hex color code for the user.
 */
function getUserColor(userId) {
    if (!userColorMap.has(userId)) {
        const colorIndex = userColorMap.size % COLOR_PALETTE.length;
        userColorMap.set(userId, COLOR_PALETTE[colorIndex]);
    }
    return userColorMap.get(userId) || '#cccccc'; // Fallback color
}

/**
 * Displays a non-blocking notification message.
 * Requires a div with id="notification-bar" in the HTML.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', or 'info' (for styling). Default 'info'.
 * @param {number} duration - How long to show the message (ms). Default 4000.
 */
function showNotification(message, type = 'info', duration = 4000) {
    if (!DOMElements.notificationBar) {
        console.warn("Notification bar element (#notification-bar) not found. Using console.log as fallback.");
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    const bar = DOMElements.notificationBar;
    // Clear any existing timeout to prevent premature hiding
    if (notificationTimeout) clearTimeout(notificationTimeout);

    bar.textContent = message;
    // Remove previous type classes and add the new one
    bar.className = 'notification-bar'; // Reset classes
    bar.classList.add(type); // Add the type class for styling
    bar.classList.add('show'); // Add 'show' class to trigger CSS transition/animation

    // Set a timeout to hide the notification
    notificationTimeout = setTimeout(() => {
        bar.classList.remove('show');
        notificationTimeout = null; // Clear the timeout ID
    }, duration);
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} The shuffled array.
 */
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// --- Animation Easing Functions ---
function easeOutAnimation(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - clampedT, CONFIG.EASE_OUT_POWER);
}

function calculateBounce(t) {
    if (!CONFIG.BOUNCE_ENABLED) return 0;
    const clampedT = Math.max(0, Math.min(1, t));
    const decay = Math.exp(-clampedT / CONFIG.BOUNCE_DAMPING);
    const oscillations = Math.sin(clampedT * Math.PI * 2 * CONFIG.BOUNCE_FREQUENCY);
    return -decay * oscillations;
}

// --- Color Utility Functions --- (Used for Confetti)
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

// --- Core Application Logic ---

/**
 * Updates the enabled/disabled state and tooltip of the main deposit button
 * based on current user status, round status, limits, and timer.
 */
function updateDepositButtonState() {
    const button = DOMElements.deposit.showDepositModalButton;
    if (!button) return;

    let disabled = false;
    let title = 'Deposit Rust skins into the pot'; // Default tooltip

    if (!currentUser) {
        disabled = true;
        title = 'Log in to deposit';
    } else if (isSpinning) {
        disabled = true;
        title = 'Deposits closed during winner selection';
    } else if (!currentRound || currentRound.status !== 'active') {
        disabled = true;
        title = 'Deposits are currently closed';
        if (currentRound) {
            switch (currentRound.status) {
                case 'rolling': title = 'Deposits closed during winner selection'; break;
                case 'completed':
                case 'error': title = 'Deposits closed (Round ended)'; break;
                case 'pending': title = 'Deposits closed (Waiting for round)'; break;
            }
        }
    } else if (currentRound.participants && currentRound.participants.length >= CONFIG.MAX_PARTICIPANTS_DISPLAY) {
        disabled = true;
        title = `Participant limit (${CONFIG.MAX_PARTICIPANTS_DISPLAY}) reached`;
    } else if (currentRound.items && currentRound.items.length >= CONFIG.MAX_ITEMS_PER_POT_FRONTEND) {
        disabled = true;
        title = `Pot item limit (${CONFIG.MAX_ITEMS_PER_POT_FRONTEND}) reached`;
    } else if (timerActive && currentRound.timeLeft !== undefined && currentRound.timeLeft <= 0) {
        disabled = true;
        title = 'Deposits closed (Round ending)';
    }

    button.disabled = disabled;
    button.title = title;
    button.classList.toggle('deposit-disabled', disabled); // Optional class for styling
}

/**
 * Fetches the user's login status from the backend API.
 */
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user'); // Assumes API endpoint exists
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                currentUser = null; // Not logged in
            } else {
                throw new Error(`Server error fetching user: ${response.status}`);
            }
        } else {
            currentUser = await response.json();
            console.log('User logged in:', currentUser?.username);
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        currentUser = null;
        showNotification(`Error checking login: ${error.message}`, 'error');
    } finally {
        updateUserUI(); // Update profile/login button visibility
        updateDepositButtonState(); // Update deposit button based on login status
    }
}

/**
 * Updates the user profile section (avatar, name) or shows the login button.
 */
function updateUserUI() {
    const { loginButton, userProfile, userAvatar, userName } = DOMElements.user;
    if (!userProfile || !loginButton || !userAvatar || !userName) return;

    if (currentUser) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png'; // Use default if missing
        userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none';
        userProfile.style.display = 'flex';
    } else {
        loginButton.style.display = 'flex';
        userProfile.style.display = 'none';
    }
}

/**
 * Fetches the user's inventory from the backend API and displays it in the deposit modal.
 */
async function loadUserInventory() {
    const { inventoryItemsContainer, selectedItemsContainer, inventoryLoadingIndicator, totalValueDisplay } = DOMElements.deposit;
    if (!inventoryItemsContainer || !selectedItemsContainer || !inventoryLoadingIndicator || !totalValueDisplay) {
        console.error("Inventory DOM elements missing.");
        return;
    }

    // Reset selection state
    selectedItemsList = [];
    selectedItemsContainer.innerHTML = '';
    updateTotalValue(); // Resets value display and deposit button state

    inventoryLoadingIndicator.style.display = 'flex';
    inventoryItemsContainer.innerHTML = ''; // Clear previous items

    try {
        const response = await fetch('/api/inventory'); // Assumes API endpoint exists
        if (!response.ok) {
            let errorMsg = 'Inventory load failed.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || `Inventory load failed (${response.status})`;
            } catch (e) { /* Ignore if response is not JSON */ }

            if (response.status === 401 || response.status === 403) {
                errorMsg = 'Please log in first.';
            }
            throw new Error(errorMsg);
        }

        userInventory = await response.json();
        inventoryLoadingIndicator.style.display = 'none';

        if (!Array.isArray(userInventory)) {
            throw new Error('Invalid inventory data received.');
        }

        if (userInventory.length === 0) {
            inventoryItemsContainer.innerHTML = '<p class="empty-inventory-message">Inventory empty or unavailable. Ensure it\'s public on Steam.</p>';
            return;
        }

        displayInventoryItems(); // Display the fetched items
    } catch (error) {
        inventoryLoadingIndicator.style.display = 'none';
        inventoryItemsContainer.innerHTML = `<p class="error-message">Error loading inventory: ${error.message}</p>`;
        console.error('Error loading inventory:', error);
        // Error is shown within the modal, no need for separate notification
    }
}

/**
 * Renders the user's inventory items in the deposit modal.
 */
function displayInventoryItems() {
    const container = DOMElements.deposit.inventoryItemsContainer;
    if (!container) return;
    container.innerHTML = ''; // Clear previous items

    userInventory.forEach(item => {
        // Basic validation of item structure
        if (!item || typeof item.price !== 'number' || isNaN(item.price) ||
            !item.assetId || !item.name || !item.image) {
            console.warn("Skipping invalid inventory item:", item);
            return; // Skip this item
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
                <div class="item-value">$${item.price.toFixed(2)}</div>
            </div>`;

        // Check if item is already selected (e.g., if modal was reopened)
        if (selectedItemsList.some(selected => selected.assetId === item.assetId)) {
            itemElement.classList.add('selected');
        }

        // Add click listener to toggle selection
        itemElement.addEventListener('click', () => toggleItemSelection(itemElement, item));
        container.appendChild(itemElement);
    });
}

/**
 * Toggles the selection state of an inventory item.
 * @param {HTMLElement} element - The DOM element of the item clicked.
 * @param {object} item - The inventory item data object.
 */
function toggleItemSelection(element, item) {
    // Validate item price again before selection
    if (typeof item.price !== 'number' || isNaN(item.price)) {
        console.error("Attempted to select item with invalid price:", item);
        showNotification('Selection Error: Cannot select item with invalid price.', 'error');
        return;
    }

    const assetId = item.assetId;
    const index = selectedItemsList.findIndex(i => i.assetId === assetId);

    if (index === -1) { // If not selected, add it
        // Check selection limit
        if (selectedItemsList.length >= CONFIG.MAX_ITEMS_PER_DEPOSIT) {
            showNotification(`Selection Limit: You can select a maximum of ${CONFIG.MAX_ITEMS_PER_DEPOSIT} items per deposit.`, 'info');
            return;
        }
        selectedItemsList.push(item);
        element.classList.add('selected');
        addSelectedItemElement(item); // Add to the visual selected list
    } else { // If already selected, remove it
        selectedItemsList.splice(index, 1);
        element.classList.remove('selected');
        removeSelectedItemElement(assetId); // Remove from the visual selected list
    }

    updateTotalValue(); // Update total value display and deposit button state
}

/**
 * Adds a visual representation of a selected item to the "Selected Items" area.
 * @param {object} item - The item data object.
 */
function addSelectedItemElement(item) {
    const container = DOMElements.deposit.selectedItemsContainer;
    if (!container) return;

    // Validate price
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
            <div class="selected-item-value">$${item.price.toFixed(2)}</div>
        </div>`;

    // Add event listener to the remove button within the selected item display
    selectedElement.querySelector('.remove-item')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering item selection toggle on the underlying grid item
        // Find the corresponding item in the main inventory list to toggle its class
        const inventoryItemElement = DOMElements.deposit.inventoryItemsContainer?.querySelector(`.inventory-item[data-asset-id="${item.assetId}"]`);
        if (inventoryItemElement) {
            // Re-find the original item object from userInventory to pass correct data
            const originalItem = userInventory.find(invItem => invItem.assetId === item.assetId) || item; // Fallback
            toggleItemSelection(inventoryItemElement, originalItem); // This handles logic and UI updates
        } else {
            // Fallback if item not visible in inventory list anymore (shouldn't happen often)
            removeSelectedItem(item.assetId); // Just remove from logic and selected list
            updateTotalValue();
        }
    });

    container.appendChild(selectedElement);
}

/**
 * Removes the visual representation of an item from the "Selected Items" area.
 * @param {string} assetId - The asset ID of the item to remove.
 */
function removeSelectedItemElement(assetId) {
    const container = DOMElements.deposit.selectedItemsContainer;
    const selectedElement = container?.querySelector(`.selected-item[data-asset-id="${assetId}"]`);
    if (selectedElement) selectedElement.remove();
}

/**
 * Removes an item from the selectedItemsList array and updates UI.
 * Called when removing without direct element interaction (e.g., from remove button).
 * @param {string} assetId - The asset ID of the item to remove.
 */
function removeSelectedItem(assetId) {
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);

    // Deselect in the main inventory view if visible
    const inventoryElement = DOMElements.deposit.inventoryItemsContainer?.querySelector(`.inventory-item[data-asset-id="${assetId}"]`);
    if (inventoryElement) inventoryElement.classList.remove('selected');

    // Remove from the selected items display area
    removeSelectedItemElement(assetId);
}

/**
 * Updates the total value display in the deposit modal and enables/disables the deposit button.
 */
function updateTotalValue() {
    const { totalValueDisplay, depositButton } = DOMElements.deposit;
    if (!totalValueDisplay || !depositButton) return;

    const total = selectedItemsList.reduce((sum, item) => {
        // Ensure price is valid before adding
        const price = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
        return sum + price;
    }, 0);

    totalValueDisplay.textContent = `$${total.toFixed(2)}`;
    // Enable deposit button only if items are selected AND user is logged in etc. (basic check here)
    depositButton.disabled = selectedItemsList.length === 0;
}

/**
 * Handles the deposit submission process.
 * Initiates the deposit with the backend and instructs the user on the trade offer process.
 */
async function submitDeposit() {
    const { depositButton: button, depositModal } = DOMElements.deposit;
    if (!button) return;

    if (selectedItemsList.length === 0) {
        showNotification('No Items Selected: Please select items from your inventory first.', 'info');
        return;
    }

    // Double-check round status client-side (backend enforces this anyway)
    if (!currentRound || currentRound.status !== 'active' || isSpinning) {
        showNotification('Deposit Error: Deposits are currently closed.', 'error');
        return;
    }
    // Add checks for limits again, although main button should be disabled
    if (currentRound.participants && currentRound.participants.length >= CONFIG.MAX_PARTICIPANTS_DISPLAY) {
        showNotification(`Deposit Error: The participant limit (${CONFIG.MAX_PARTICIPANTS_DISPLAY}) has been reached.`, 'error');
        return;
    }
    if (currentRound.items && currentRound.items.length + selectedItemsList.length > CONFIG.MAX_ITEMS_PER_POT_FRONTEND) {
        showNotification(`Deposit Error: Depositing these items would exceed the pot limit (${CONFIG.MAX_ITEMS_PER_POT_FRONTEND}).`, 'error');
        return;
    }

    button.disabled = true;
    button.textContent = 'Processing...';

    try {
        // Step 1: Initiate deposit with the server to get token/URL
        // The server generates a unique token for this deposit attempt.
        const initiateResponse = await fetch('/api/deposit/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}) // Body might include selected item asset IDs if needed by backend pre-trade
        });

        if (!initiateResponse.ok) {
            const error = await initiateResponse.json().catch(() => ({ error: 'Failed to initiate deposit.' }));
            throw new Error(error.error || `Deposit initiation failed (${initiateResponse.status})`);
        }

        const { depositToken, botTradeUrl } = await initiateResponse.json();

        if (!depositToken || !botTradeUrl) {
            throw new Error('Invalid response from deposit initiation.');
        }

        // Step 2: Construct the trade offer URL and instructions for the user
        // The user MUST manually send the trade offer via Steam, including the depositToken in the trade message.
        const fullBotTradeUrl = `${botTradeUrl}&message=${encodeURIComponent(depositToken)}`;

        console.log("Deposit Token:", depositToken);
        console.log("Bot Trade URL:", botTradeUrl);
        console.log("Full URL for user:", fullBotTradeUrl); // For debugging

        // Step 3: Inform the user clearly about the next steps.
        // Avoid automatically opening the trade link due to popup blockers.
        // Consider showing this info in a dedicated section within the modal or a new small modal.
        const selectedValue = DOMElements.deposit.totalValueDisplay?.textContent || '$?.??';
        const instructionMessage = `Trade Offer Required:\n\n` +
                                   `1. Open a trade offer with our bot.\n` +
                                   `2. Add the ${selectedItemsList.length} item(s) you selected (Value: ${selectedValue}).\n` +
                                   `3. IMPORTANT: Put this EXACT code in the trade message: ${depositToken}\n\n` +
                                   `You can use the link (check console or UI element if added) to open the trade window. The deposit will be processed once the trade is accepted with the correct message.`;

        showNotification(instructionMessage, 'info', 15000); // Show for longer duration

        // Optionally provide a clickable link (ensure placeholder exists in HTML)
        // const tradeLinkElement = document.getElementById('tradeLinkPlaceholder');
        // if (tradeLinkElement) {
        //     tradeLinkElement.innerHTML = `<a href="${fullBotTradeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Open Trade Offer</a> (Copy Message: ${depositToken})`;
        //     tradeLinkElement.style.display = 'block';
        // }

        // Clear selection and close modal AFTER initiating successfully
        if (depositModal) hideModal(depositModal);
        selectedItemsList = [];
        if (DOMElements.deposit.selectedItemsContainer) DOMElements.deposit.selectedItemsContainer.innerHTML = '';
        if (DOMElements.deposit.inventoryItemsContainer) {
            DOMElements.deposit.inventoryItemsContainer.querySelectorAll('.inventory-item.selected')
                .forEach(el => el.classList.remove('selected'));
        }
        updateTotalValue(); // Resets value and deposit button state

    } catch (error) {
        showNotification(`Deposit Initiation Error: ${error.message}`, 'error');
        console.error('Error initiating deposit:', error);
        // Re-enable button based on selection only if error occurred
        button.disabled = selectedItemsList.length === 0;
        button.textContent = 'Deposit Items';
    }
    // Note: Text remains 'Deposit Items' unless error, as user action is now required.
}


/**
 * Saves the user's Steam Trade URL via backend API call.
 */
async function saveUserTradeUrl() {
    const { tradeUrlInput, saveTradeUrlButton, tradeUrlModal } = DOMElements.tradeUrl;
    if (!tradeUrlInput || !saveTradeUrlButton || !tradeUrlModal) {
        console.error("Trade URL modal elements missing.");
        return;
    }

    const tradeUrl = tradeUrlInput.value.trim();

    // Basic validation
    if (!tradeUrl) {
        showNotification('Input Required: Please enter your Steam Trade URL.', 'error');
        return;
    }
    // More specific validation for common Steam trade URL format
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') ||
        !tradeUrl.includes('partner=') ||
        !tradeUrl.includes('token=')) {
        showNotification('Invalid Format: Please enter a valid Steam Trade URL including partner and token parameters.', 'error');
        return;
    }

    saveTradeUrlButton.disabled = true;
    saveTradeUrlButton.textContent = 'Saving...';

    try {
        const response = await fetch('/api/user/tradeurl', { // Assumes API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeUrl })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to save Trade URL.' }));
            throw new Error(error.error || `Save failed (${response.status})`);
        }

        const result = await response.json();
        if (currentUser) currentUser.tradeUrl = result.tradeUrl; // Update local user object

        hideModal(tradeUrlModal);

        // Check if the main deposit button is now potentially enabled
        const depositTriggerButton = DOMElements.deposit.showDepositModalButton;
        updateDepositButtonState(); // Re-evaluate deposit button state
        if (depositTriggerButton && !depositTriggerButton.disabled) {
            showNotification('Success: Trade URL saved. You can now try depositing again.', 'success');
            // Optional: Automatically try to open deposit modal after setting URL
            // depositTriggerButton.click();
        } else {
            showNotification('Success: Trade URL saved.', 'success');
        }

    } catch (error) {
        showNotification(`Error Saving URL: ${error.message}`, 'error');
        console.error('Error updating trade URL:', error);
    } finally {
        saveTradeUrlButton.disabled = false;
        saveTradeUrlButton.textContent = 'Save Trade URL';
    }
}

/**
 * Updates the main jackpot header UI elements (Pot Value, Timer Display, Participant Count).
 */
function updateRoundUI() {
    const { potValue, participantCount } = DOMElements.jackpot;
    if (!currentRound || !potValue || !participantCount) return;

    // Update Pot Value display
    potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;

    // Update Timer Display (only if timer isn't actively counting down client-side)
    // The updateTimerUI function handles the logic based on timerActive flag
    if (!timerActive) {
        updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : CONFIG.ROUND_DURATION);
    }

    // Update Participant Count display
    const participantNum = currentRound.participants?.length || 0;
    participantCount.textContent = `${participantNum}/${CONFIG.MAX_PARTICIPANTS_DISPLAY}`;

    // Note: Displaying individual deposits is handled by displayLatestDeposit
}


/**
 * Updates the timer text display and the SVG circle progress.
 * Handles different states like waiting, counting down, rolling, ended.
 * @param {number} timeLeft - The remaining time in seconds.
 */
function updateTimerUI(timeLeft) {
    const { timerValue, timerForeground } = DOMElements.jackpot;
    if (!timerValue || !timerForeground) return;

    const timeToShow = Math.max(0, Math.round(timeLeft));
    let displayValue = timeToShow.toString(); // Default numeric display

    // Determine display text based on round and timer state
    if (currentRound && currentRound.status === 'active' && !timerActive && currentRound.participants?.length === 0) {
        displayValue = CONFIG.ROUND_DURATION.toString(); // Show initial duration before first deposit
        // Alternative displays: displayValue = "--"; or displayValue = "Waiting";
    } else if (timerActive || (currentRound && currentRound.status === 'active' && timeToShow > 0)) {
        displayValue = timeToShow.toString(); // Show countdown number
    } else if (isSpinning || (currentRound && currentRound.status === 'rolling')) {
        displayValue = "Rolling"; // Show Rolling text
    } else if (currentRound && (currentRound.status === 'completed' || currentRound.status === 'error')) {
        displayValue = "Ended"; // Show Ended text
    } else if (!timerActive && timeToShow <= 0 && currentRound && currentRound.status === 'active') {
        displayValue = "0"; // Show "0" when client timer hits zero but server hasn't confirmed rolling yet
    }

    timerValue.textContent = displayValue;

    // Update the SVG circle based on the actual calculated time
    updateTimerCircle(timeToShow, CONFIG.ROUND_DURATION);

    // Update pulse animation based on time left and timer activity
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
 * Updates the stroke-dashoffset of the timer's SVG circle foreground.
 * @param {number} timeLeft - Current time left in seconds.
 * @param {number} totalTime - The total duration of the timer in seconds.
 */
function updateTimerCircle(timeLeft, totalTime) {
    const circle = DOMElements.jackpot.timerForeground;
    if (!circle) return;

    // Ensure it's an SVG circle element with radius accessible
    if (circle.tagName === 'circle' && circle.r?.baseVal?.value) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        // Calculate progress (0 to 1), clamp between 0 and 1
        const progress = Math.min(1, Math.max(0, timeLeft / Math.max(1, totalTime))); // Avoid division by zero
        const offset = circumference * (1 - progress);

        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${Math.max(0, offset)}`; // Ensure offset isn't negative
    } else {
        console.warn("timerForeground is not an SVG circle element or 'r' attribute is missing.");
    }
}


/**
 * Displays the latest deposit as a new block at the TOP of the participants container.
 * Manages the maximum number of visible deposit blocks.
 * @param {object} data - The participant update data from the socket event. Expected: { userId, username, avatar, itemsValue, depositedItems, ... }
 */
function displayLatestDeposit(data) {
    const container = DOMElements.jackpot.participantsContainer;
    const emptyMsg = DOMElements.jackpot.emptyPotMessage;
    if (!container) return;

    // Basic validation of incoming data for display
    if (!data || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue)) {
        console.error("Invalid data passed to displayLatestDeposit:", data);
        return;
    }

    const username = data.username || 'Unknown User';
    const avatar = data.avatar || '/img/default-avatar.png';
    const value = data.itemsValue; // Value of *this* specific deposit
    const items = data.depositedItems || []; // Items from *this* specific deposit
    const userColor = getUserColor(data.userId);

    const depositContainer = document.createElement('div');
    depositContainer.dataset.userId = data.userId;
    depositContainer.className = 'player-deposit-container player-deposit-new'; // Add animation class

    // --- Deposit Header ---
    const depositHeader = document.createElement('div');
    depositHeader.className = 'player-deposit-header';
    depositHeader.innerHTML = `
        <img src="${avatar}" alt="${username}" class="player-avatar" loading="lazy"
             onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor};">
        <div class="player-info">
            <div class="player-name" title="${username}">${username}</div>
            <div class="player-deposit-value" style="color: ${userColor}" title="Deposited Value: $${value.toFixed(2)}">$${value.toFixed(2)}</div>
        </div>`;

    // --- Items Grid ---
    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';

    if (items.length > 0) {
        // Sort items by value (highest to lowest) for display consistency
        items.sort((a, b) => (b.price || 0) - (a.price || 0));

        // Limit displayed items visually in the block
        const displayItems = items.slice(0, CONFIG.MAX_ITEMS_PER_DEPOSIT); // Use config constant

        displayItems.forEach(item => {
            // Validate each item before displaying
            if (!item || typeof item.price !== 'number' || isNaN(item.price) ||
                !item.name || !item.image) {
                console.warn("Skipping invalid item in deposit display:", item);
                return;
            }

            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`; // Tooltip
            itemElement.style.borderColor = userColor; // Use user color for border
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</div>
                </div>`;
            itemsGrid.appendChild(itemElement);
        });

        // Show a "+X more" indicator if items were truncated
        if (items.length > CONFIG.MAX_ITEMS_PER_DEPOSIT) {
            const moreItems = document.createElement('div');
            moreItems.className = 'player-deposit-item-more';
            moreItems.style.color = userColor;
            moreItems.textContent = `+${items.length - CONFIG.MAX_ITEMS_PER_DEPOSIT} more`;
            itemsGrid.appendChild(moreItems);
        }
    }

    depositContainer.appendChild(depositHeader);
    depositContainer.appendChild(itemsGrid);

    // --- Add to DOM & Manage List Length ---
    // Add the new deposit block to the TOP of the container
    if (container.firstChild) {
        container.insertBefore(depositContainer, container.firstChild);
    } else {
        container.appendChild(depositContainer);
    }

    // Hide empty pot message if it was visible
    if (emptyMsg) emptyMsg.style.display = 'none';

    // Remove animation class after CSS animation duration (e.g., 500ms)
    setTimeout(() => {
        depositContainer.classList.remove('player-deposit-new');
    }, 500);

    // Limit the number of visible deposit blocks by removing the oldest from the BOTTOM
    const currentDepositBlocks = container.querySelectorAll('.player-deposit-container');
    if (currentDepositBlocks.length > CONFIG.MAX_DISPLAY_DEPOSITS) {
        const blocksToRemove = currentDepositBlocks.length - CONFIG.MAX_DISPLAY_DEPOSITS;
        for (let i = 0; i < blocksToRemove; i++) {
            const oldestBlock = container.querySelector('.player-deposit-container:last-child');
            if (oldestBlock && oldestBlock !== depositContainer) { // Don't remove the one just added
                // Optional: Add fade-out effect before removing
                oldestBlock.style.transition = 'opacity 0.3s ease-out';
                oldestBlock.style.opacity = '0';
                setTimeout(() => {
                    if (oldestBlock.parentNode === container) { // Check parent just in case
                        oldestBlock.remove();
                    }
                }, 300); // Remove after fade
            }
        }
    }
}


/**
 * Handles incoming participant update data from the server via Socket.IO.
 * Updates the local `currentRound` state and triggers UI updates.
 * @param {object} data - Data received from the 'participantUpdated' socket event.
 * Expected: { roundId, userId, username, avatar, itemsValue (this deposit), totalValue (round total), tickets (user total), depositedItems (this deposit) }
 */
function handleNewDeposit(data) {
    // Validate essential incoming data fields
    if (!data || !data.roundId || !data.userId ||
        typeof data.itemsValue !== 'number' || isNaN(data.itemsValue) ||
        data.totalValue === undefined || data.tickets === undefined) {
        console.error("Invalid participant update data received:", data);
        return;
    }
    // Ensure depositedItems is an array, even if empty
    if (!data.depositedItems) data.depositedItems = [];

    // --- Update Local Round State ---
    // Initialize currentRound if it doesn't exist (e.g., user joined mid-round)
    if (!currentRound) {
        currentRound = {
            roundId: data.roundId,
            status: 'active', // Assume active if receiving deposit
            timeLeft: CONFIG.ROUND_DURATION, // Will be updated by 'roundData' or timer
            totalValue: 0,
            participants: [],
            items: [] // Master list of all items in the round
        };
        console.warn("Handling deposit for a non-existent local round. Initializing round.");
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Deposit received for wrong round (${data.roundId}). Current is ${currentRound.roundId}. Ignoring.`);
        return; // Ignore deposit for a different round
    }

    // Ensure participants and items arrays exist
    if (!currentRound.participants) currentRound.participants = [];
    if (!currentRound.items) currentRound.items = [];

    // Find if participant already exists in the local state
    let participantIndex = currentRound.participants.findIndex(p => p.user?.id === data.userId);

    if (participantIndex !== -1) {
        // Update existing participant's cumulative value and latest ticket count
        currentRound.participants[participantIndex] = {
            ...currentRound.participants[participantIndex],
            itemsValue: (currentRound.participants[participantIndex].itemsValue || 0) + data.itemsValue, // Add this deposit's value
            tickets: data.tickets // Update with the latest cumulative ticket count from server
        };
    } else {
        // If participant is new, add them to the array
        currentRound.participants.push({
            user: {
                id: data.userId,
                username: data.username || 'Unknown User',
                avatar: data.avatar || '/img/default-avatar.png'
            },
            itemsValue: data.itemsValue, // Initial deposit value for this user
            tickets: data.tickets // Initial ticket count for this user
        });
    }

    // Update total round value from server data (most reliable source)
    currentRound.totalValue = data.totalValue;

    // Add the newly deposited items to the master item list for the round
    data.depositedItems.forEach(item => {
        // Validate item before adding to master list
        if (item && typeof item.price === 'number' && !isNaN(item.price)) {
            // Add owner ID to the item object for potential use later (e.g., roulette build)
            currentRound.items.push({ ...item, owner: data.userId });
        } else {
            console.warn("Skipping invalid item while adding to round master list:", item);
        }
    });

    // --- Trigger UI Updates ---
    updateRoundUI(); // Updates Pot Value, Timer, Participant Count display in header
    displayLatestDeposit(data); // Display this specific deposit visually in the list
    updateDepositButtonState(); // Re-check deposit button state (e.g., if limits reached)

    // Start client timer visually if this is the *first* participant (backend handles actual start time)
    if (currentRound.status === 'active' &&
        currentRound.participants.length === 1 && // Check if it's the very first participant
        !timerActive) {
        console.log("First participant joined. Starting client timer visually.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || CONFIG.ROUND_DURATION); // Use server time if available
    }
}


/**
 * Updates ONLY the participant count display in the header and the empty pot message visibility.
 * Individual deposit blocks are handled by displayLatestDeposit.
 */
function updateParticipantsUI() {
    const { participantCount } = DOMElements.jackpot;
    const emptyMsg = DOMElements.jackpot.emptyPotMessage;
    const container = DOMElements.jackpot.participantsContainer;

    if (!participantCount || !emptyMsg || !container) {
        console.error("Participants count/empty message/container elements missing.");
        return;
    }

    const participantNum = currentRound?.participants?.length || 0;

    // Update participant count display in the header
    participantCount.textContent = `${participantNum}/${CONFIG.MAX_PARTICIPANTS_DISPLAY}`;

    // Hide/show empty pot message based ONLY on whether the container has deposit blocks
    const hasDepositBlocks = container.querySelector('.player-deposit-container') !== null;

    if (!hasDepositBlocks) {
        emptyMsg.style.display = 'block';
        // Ensure message is inside container if needed (might be handled by CSS)
        if (!container.contains(emptyMsg)) {
             container.appendChild(emptyMsg);
        }
    } else {
        emptyMsg.style.display = 'none';
    }
}

/**
 * Function to test deposit display with mock data. Adds a new deposit block to the top.
 * Uses Rust-themed item names.
 */
function testDeposit() {
    console.log("--- TESTING DEPOSIT DISPLAY (Adds to Top) ---");

    // Simulate current round state if needed for testing
    if (!currentRound) {
        currentRound = { roundId: 'test-round-123', status: 'active', totalValue: 0, participants: [], items: [] };
    } else {
        // Ensure test doesn't break if round isn't active (e.g., after a spin test)
        currentRound.status = 'active';
        // Ensure participants/items arrays exist
        if (!currentRound.participants) currentRound.participants = [];
        if (!currentRound.items) currentRound.items = [];
    }

    const randomValue = parseFloat((Math.random() * 50 + 1).toFixed(2)); // Value for this test deposit
    const mockUserId = `test_user_${Math.floor(Math.random() * 1000)}`;
    const mockUsername = ["RustPlayer99", "ScrapCollector", "AK47Master", "TheNaked",
                          "ZergLeader", "TheRaider", "OilRigEnjoyer"][Math.floor(Math.random() * 7)];
    const mockAvatar = [ // Example Steam avatars
        'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
        'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg',
        'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg',
        '/img/default-avatar.png' // Default fallback
    ][Math.floor(Math.random() * 4)];

    // Simulate calculating cumulative tickets and value for this user
    let existingParticipant = currentRound.participants.find(p => p.user.id === mockUserId);
    let cumulativeTickets = 0;
    let cumulativeValue = 0;

    if (existingParticipant) {
        cumulativeValue = (existingParticipant.itemsValue || 0) + randomValue;
        cumulativeTickets = Math.max(1, Math.floor(cumulativeValue * 100)); // Recalculate total tickets
    } else {
        cumulativeValue = randomValue;
        cumulativeTickets = Math.max(1, Math.floor(cumulativeValue * 100));
    }

    // Prepare mock data structure similar to 'participantUpdated' event
    const mockDepositData = {
        roundId: currentRound.roundId,
        userId: mockUserId,
        username: mockUsername,
        avatar: mockAvatar,
        itemsValue: randomValue, // Value of THIS specific deposit
        tickets: cumulativeTickets, // CUMULATIVE tickets for this user in the round
        totalValue: (currentRound.totalValue || 0) + randomValue, // NEW round total value
        depositedItems: [] // Items for THIS specific deposit (generated below)
    };

    // Generate mock Rust items for this specific deposit
    const rustItemNames = [
        "Assault Rifle", "Metal Facemask", "Garage Door", "Semi-Automatic Rifle",
        "Road Sign Kilt", "Coffee Can Helmet", "Sheet Metal Door", "Medical Syringe",
        "MP5A4", "LR-300", "Bolt Action Rifle", "Satchel Charge", "Explosive Ammo",
        "High Quality Metal", "Crude Oil", "Tech Trash", "Scrap"
    ];
    const numItems = Math.floor(Math.random() * 10) + 1; // 1 to 10 items for test deposit
    let remainingValue = mockDepositData.itemsValue;
    let accumulatedValue = 0;

    for (let i = 0; i < numItems; i++) {
        const isLastItem = i === numItems - 1;
        let itemValue;

        if (isLastItem) {
            itemValue = Math.max(0.01, remainingValue); // Assign remaining value
        } else {
            // Assign a random portion, ensuring not too small and enough remains
            itemValue = parseFloat((Math.random() * remainingValue * 0.6 + 0.01).toFixed(2));
            itemValue = Math.min(itemValue, remainingValue - (numItems - 1 - i) * 0.01);
            itemValue = Math.max(0.01, itemValue);
        }

        remainingValue -= itemValue;
        accumulatedValue += itemValue;

        // Adjust last item slightly if rounding caused issues
        if (isLastItem && Math.abs(accumulatedValue - mockDepositData.itemsValue) > 0.001) {
            itemValue += (mockDepositData.itemsValue - accumulatedValue);
            itemValue = Math.max(0.01, parseFloat(itemValue.toFixed(2)));
        } else {
            itemValue = parseFloat(itemValue.toFixed(2));
        }

        mockDepositData.depositedItems.push({
            assetId: `test_asset_${Math.floor(Math.random() * 100000)}`,
            name: rustItemNames[Math.floor(Math.random() * rustItemNames.length)],
            image: `/img/default-item.png`, // Use a default image for testing
            price: itemValue
        });
    }
    // Recalculate exact deposit value from items generated due to rounding
    mockDepositData.itemsValue = mockDepositData.depositedItems.reduce((sum, item) => sum + item.price, 0);
    mockDepositData.totalValue = (currentRound.totalValue || 0) + mockDepositData.itemsValue; // Update total value based on actual items

    console.log("Mock Deposit Data:", mockDepositData);
    // Call the handler function which updates the currentRound state and UI
    handleNewDeposit(mockDepositData);
}


/**
 * Starts the client-side countdown timer interval.
 * @param {number} [initialTime=CONFIG.ROUND_DURATION] - The time to start counting down from.
 */
function startClientTimer(initialTime = CONFIG.ROUND_DURATION) {
    const timerDisplay = DOMElements.jackpot.timerValue;
    if (!timerDisplay) return;

    if (roundTimer) clearInterval(roundTimer); // Clear any existing timer interval

    let timeLeft = Math.max(0, initialTime);
    console.log(`Starting/Syncing client timer from ${timeLeft}s`);
    timerActive = true; // Set flag indicating client timer is running
    updateTimerUI(timeLeft); // Initial display update
    updateDepositButtonState(); // Update button state when timer starts/syncs

    roundTimer = setInterval(() => {
        if (!timerActive) { // Check flag in case timer stopped externally (e.g., by server event)
            clearInterval(roundTimer);
            roundTimer = null;
            console.log("Client timer interval stopped (timerActive is false).");
            return;
        }

        timeLeft--;
        // Update local round object timeLeft for consistency if needed elsewhere
        if (currentRound) currentRound.timeLeft = timeLeft;

        updateTimerUI(timeLeft); // Update display (text and circle)
        updateDepositButtonState(); // Update button state based on time

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            timerActive = false; // Timer finished naturally
            console.log("Client timer reached zero.");
            // Display "0" explicitly, server events will handle changing to "Rolling"
            if(timerDisplay) timerDisplay.textContent = "0";
            updateDepositButtonState(); // Final update based on timer hitting zero
        }
    }, 1000); // Update every second
}

// --- Roulette/Winner Animation Functions ---

/**
 * Creates the visual items (player avatars/info) for the roulette animation track.
 * Uses the participants from the `currentRound` state.
 */
function createRouletteItems() {
    const track = DOMElements.roulette.rouletteTrack;
    const container = DOMElements.roulette.inlineRouletteContainer;
    if (!track || !container) {
        console.error("Roulette track or inline roulette element missing.");
        return;
    }

    track.innerHTML = ''; // Clear previous items
    // Reset any previous transformations immediately without animation
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';

    // Ensure participant data is available
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('No participants data available to create roulette items.');
        track.innerHTML = '<div class="roulette-message">Waiting for participants...</div>';
        return;
    }

    // --- Calculate Ticket Pool for Visual Representation ---
    // Create an array where each participant appears proportionally to their tickets/value
    let ticketPool = [];
    const totalTicketsInRound = currentRound.participants.reduce((sum, p) => sum + (p.tickets || 0), 0);

    if (totalTicketsInRound <= 0) {
        console.warn("Total tickets in round is zero or invalid. Building roulette based on value percentage.");
        // Fallback: Build based on value percentage if tickets are missing/zero
        const totalValueNonZero = Math.max(0.01, currentRound.totalValue || 0.01);
        const targetVisualBlocks = 150; // Target number of visual blocks
        currentRound.participants.forEach(p => {
            // Ensure at least a few blocks per participant for visibility
            const visualBlocks = Math.max(3, Math.ceil(((p.itemsValue || 0) / totalValueNonZero) * targetVisualBlocks));
            for (let i = 0; i < visualBlocks; i++) ticketPool.push(p); // Add participant reference
        });
    } else {
        // Build pool based on tickets
        const targetVisualBlocks = 150; // Adjust for desired visual density
        currentRound.participants.forEach(p => {
            const tickets = p.tickets || 0;
            // Ensure at least a few blocks per participant
            const visualBlocksForUser = Math.max(3, Math.ceil((tickets / totalTicketsInRound) * targetVisualBlocks));
            for (let i = 0; i < visualBlocksForUser; i++) {
                ticketPool.push(p); // Add participant reference multiple times
            }
        });
    }

    if (ticketPool.length === 0) {
        console.error("Ticket pool calculation resulted in zero items for roulette.");
        track.innerHTML = '<div class="roulette-message">Error building roulette items.</div>';
        return;
    }

    // Shuffle the pool thoroughly for a random visual sequence
    ticketPool = shuffleArray([...ticketPool]); // Shuffle a copy

    // --- Determine Number of Items Needed for Smooth Animation ---
    // Aim for enough items to cover multiple screen widths + buffer
    const rouletteContainer = container.querySelector('.roulette-container'); // Inner container if exists
    const containerWidth = rouletteContainer?.offsetWidth || container.offsetWidth || 1000; // Get width
    const itemWidthWithMargin = 90 + 10; // Approx item width + margin (adjust if CSS changes)
    const itemsInView = Math.ceil(containerWidth / itemWidthWithMargin);
    const itemsForSpin = 400; // Fixed large number for safety (adjust based on spin duration/speed)
    const totalItemsNeeded = itemsForSpin + (itemsInView * 2); // Ensure buffer on both sides
    const itemsToCreate = Math.max(totalItemsNeeded, 500); // Ensure a minimum number

    console.log(`Targeting ${itemsToCreate} roulette items for smooth animation.`);

    // --- Create and Append Items to the Track ---
    const fragment = document.createDocumentFragment(); // Use fragment for performance
    for (let i = 0; i < itemsToCreate; i++) {
        // Cycle through the shuffled ticket pool
        const participant = ticketPool[i % ticketPool.length];
        if (!participant || !participant.user) {
            console.warn(`Skipping roulette item creation at index ${i} due to invalid participant data.`);
            continue; // Skip if participant data is somehow invalid
        }

        const userId = participant.user.id;
        const userColor = getUserColor(userId);
        const itemElement = document.createElement('div');
        itemElement.className = 'roulette-item';
        itemElement.dataset.userId = userId; // Store user ID for identifying the winner element later
        itemElement.style.borderColor = userColor; // Set border color

        // Calculate display percentage based on participant's total value / round total value
        const totalValueForPercent = Math.max(0.01, currentRound.totalValue || 0.01); // Avoid division by zero
        const percentage = ((participant.itemsValue || 0) / totalValueForPercent * 100).toFixed(1);
        const avatar = participant.user.avatar || '/img/default-avatar.png';
        const username = participant.user.username || 'Unknown User';

        itemElement.innerHTML = `
            <div class="profile-pic-container">
                <img class="roulette-avatar" src="${avatar}" alt="${username}" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-avatar.png';">
            </div>
            <div class="roulette-info" style="border-top: 2px solid ${userColor}">
                <span class="roulette-name" title="${username}">${username}</span>
                <span class="roulette-percentage" style="color: ${userColor}">${percentage}%</span>
            </div>`;

        fragment.appendChild(itemElement);
    }

    track.appendChild(fragment); // Append all items at once
    console.log(`Created ${track.children.length} items for roulette animation.`);
}


/**
 * Handles the 'roundWinner' event from the server. Switches view and starts the animation.
 * @param {object} data - Data from the 'roundWinner' socket event. Expected: { roundId, winner: { id, username, avatar, ... }, winningTicket, ... }
 */
function handleWinnerAnnouncement(data) {
    if (isSpinning) {
        console.warn("Received winner announcement but animation is already spinning.");
        return;
    }

    // Ensure we have the necessary local round data to build the roulette visually
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error("Missing participant data for winner announcement. Requesting fresh data.");
        socket.emit('requestRoundData'); // Request fresh data
        // Retry after a delay, hoping data arrives
        setTimeout(() => {
            if (currentRound?.participants?.length > 0) {
                console.log("Retrying winner announcement after receiving data.");
                handleWinnerAnnouncement(data); // Retry
            } else {
                console.error("Still no participant data after requesting. Cannot start spin.");
                resetToJackpotView(); // Reset if data is bad
            }
        }, 1500); // Wait 1.5 seconds for data
        return;
    }

    // Extract winner details (prefer data from event, fallback to local if needed)
    const winnerDetails = data.winner || currentRound?.winner;
    if (!winnerDetails || !winnerDetails.id) {
        console.error("Invalid winner data received in announcement:", data);
        resetToJackpotView();
        return;
    }

    console.log(`Winner announced: ${winnerDetails.username}. Preparing roulette...`);

    // Stop client timer if it's somehow still running
    if (timerActive) {
        timerActive = false;
        clearInterval(roundTimer);
        roundTimer = null;
        console.log("Stopped client timer due to winner announcement.");
    }

    // Switch UI to show the roulette animation view
    switchToRouletteView();

    // Delay starting the animation slightly to allow UI transition/rendering
    setTimeout(() => {
        startRouletteAnimation({ winner: winnerDetails }); // Pass winner info
    }, 500); // 500ms delay
}


/**
 * Switches the UI from the main jackpot display to the roulette animation view.
 */
function switchToRouletteView() {
    const header = DOMElements.jackpot.jackpotHeader;
    const rouletteContainer = DOMElements.roulette.inlineRouletteContainer;
    if (!header || !rouletteContainer) {
        console.error("Missing roulette UI elements for view switch.");
        return;
    }

    const valueDisplay = header.querySelector('.jackpot-value');
    const timerDisplay = header.querySelector('.jackpot-timer');
    const statsDisplay = header.querySelector('.jackpot-stats');

    // Fade out the normal header elements (value, timer, stats)
    [valueDisplay, timerDisplay, statsDisplay].forEach(el => {
        if (el) {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            // Use setTimeout to set display: none after fade out to prevent layout issues
            setTimeout(() => { el.style.display = 'none'; }, 500);
        }
    });

    // Prepare roulette view (make visible but transparent and slightly offset)
    header.classList.add('roulette-mode'); // Apply class for potential background/style changes
    rouletteContainer.style.display = 'block';
    rouletteContainer.style.opacity = '0';
    rouletteContainer.style.transform = 'translateY(20px)'; // Start slightly down for entry animation

    // Fade in roulette view after a short delay
    setTimeout(() => {
        rouletteContainer.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
        rouletteContainer.style.opacity = '1';
        rouletteContainer.style.transform = 'translateY(0)';
    }, 600); // Start fade-in slightly after others start fading out

    // Hide return button initially if it exists
    if (DOMElements.roulette.returnToJackpotButton) {
        DOMElements.roulette.returnToJackpotButton.style.display = 'none';
    }
}


/**
 * Starts the roulette spinning animation after items are created.
 * @param {object} winnerData - Object containing winner details, e.g., { winner: { id, username, avatar } }
 */
function startRouletteAnimation(winnerData) {
    // Cancel any previous animation frame request
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Cancelled previous animation frame before starting new spin.");
    }

    // Ensure valid winner data is passed
    if (!winnerData?.winner?.id) {
        console.error("Invalid winner data passed to startRouletteAnimation.");
        resetToJackpotView();
        return;
    }

    isSpinning = true;
    updateDepositButtonState(); // Disable deposit button during spin
    spinStartTime = 0; // Reset spin start time tracker

    // Hide winner info overlay initially
    if (DOMElements.roulette.winnerInfoBox) DOMElements.roulette.winnerInfoBox.style.display = 'none';

    // Clear any previous confetti and winner highlight styles
    clearConfetti();
    // Build the visual roulette items based on currentRound participants
    createRouletteItems(); // This populates the rouletteTrack

    // Find the full participant object matching the winner ID to get value/percentage later
    const winnerParticipantData = findWinnerFromData(winnerData); // Includes user, value, percentage
    if (!winnerParticipantData) {
        console.error('Could not find full winner details in startRouletteAnimation.');
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView();
        return;
    }

    console.log('Starting animation for Winner:', winnerParticipantData.user.username);

    // --- Sound Handling ---
    const sound = DOMElements.roulette.spinSound;
    if (sound) {
        sound.volume = 0; // Start muted for fade-in effect
        sound.currentTime = 0; // Rewind to start
        sound.playbackRate = 1.0; // Reset playback rate
        sound.play().catch(e => console.error('Error playing spin sound:', e));

        // Fade in sound volume smoothly
        let currentVolume = 0;
        const fadeInInterval = 50; // ms between volume steps
        const targetVolume = 0.7; // Max volume (0 to 1)
        const fadeDuration = 500; // ms for fade-in
        const volumeStep = targetVolume / (fadeDuration / fadeInInterval);

        if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval); // Clear previous interval if any
        window.soundFadeInInterval = setInterval(() => {
            currentVolume += volumeStep;
            if (currentVolume >= targetVolume) {
                sound.volume = targetVolume;
                clearInterval(window.soundFadeInInterval);
                window.soundFadeInInterval = null;
            } else {
                sound.volume = currentVolume;
            }
        }, fadeInInterval);
    } else {
        console.warn("Spin sound element not found.");
    }

    // --- Start Animation Logic ---
    // Delay slightly to ensure items are rendered before calculating positions
    setTimeout(() => {
        const track = DOMElements.roulette.rouletteTrack;
        const items = track?.querySelectorAll('.roulette-item');
        if (!track || !items || items.length === 0) {
            console.error('Cannot spin, no items rendered after createRouletteItems.');
            isSpinning = false;
            updateDepositButtonState();
            resetToJackpotView();
            return;
        }

        // --- Find Target Element ---
        // Aim for an element representing the winner in the latter part of the generated track
        const minIndexPercent = 0.65; // Start looking from 65% mark
        const maxIndexPercent = 0.85; // Stop looking at 85% mark
        const minIndex = Math.floor(items.length * minIndexPercent);
        const maxIndex = Math.floor(items.length * maxIndexPercent);

        let winnerItemsIndices = [];
        for (let i = minIndex; i <= maxIndex; i++) {
            if (items[i]?.dataset?.userId === winnerParticipantData.user.id) {
                winnerItemsIndices.push(i);
            }
        }

        // Fallback: If no winner found in the preferred range, search the entire track (should be rare)
        if (winnerItemsIndices.length === 0) {
            console.warn(`No winner items found in preferred range [${minIndex}-${maxIndex}]. Expanding search.`);
            for (let i = 0; i < items.length; i++) {
                if (items[i]?.dataset?.userId === winnerParticipantData.user.id) {
                    winnerItemsIndices.push(i);
                }
            }
        }

        let winningElement, targetIndex;
        if (winnerItemsIndices.length === 0) {
            // Critical fallback: If winner ID truly not found (data mismatch?), pick a default target near the end
            console.error(`No items found matching winner ID ${winnerParticipantData.user.id}. Using fallback index.`);
            targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(items.length * 0.75))); // e.g., 75% mark
            winningElement = items[targetIndex];
            if (!winningElement) { // Should not happen if items exist
                console.error('Fallback winning element is invalid!');
                isSpinning = false; updateDepositButtonState(); resetToJackpotView(); return;
            }
        } else {
            // Select a random index from the found winner elements in the target zone
            targetIndex = winnerItemsIndices[Math.floor(Math.random() * winnerItemsIndices.length)];
            winningElement = items[targetIndex];
            if (!winningElement) { // Should not happen if index is valid
                console.error(`Selected winning element at index ${targetIndex} is invalid!`);
                isSpinning = false; updateDepositButtonState(); resetToJackpotView(); return;
            }
        }

        console.log(`Selected winning element at index ${targetIndex} of ${items.length} total items`);
        // Pass both the target DOM element and the processed winner data (with value/%) to the animation handler
        handleRouletteSpinAnimation(winningElement, winnerParticipantData);
    }, 100); // Small delay for rendering
}


/**
 * Handles the core requestAnimationFrame loop for the roulette spin.
 * @param {HTMLElement} winningElement - The specific DOM element that should land under the ticker.
 * @param {object} winner - The processed winner data object { user, value, percentage }.
 */
function handleRouletteSpinAnimation(winningElement, winner) {
    const track = DOMElements.roulette.rouletteTrack;
    const container = DOMElements.roulette.inlineRouletteContainer?.querySelector('.roulette-container'); // Inner container for width calculation
    const sound = DOMElements.roulette.spinSound;

    if (!winningElement || !track || !container) {
        console.error("Missing crucial elements for roulette animation loop.");
        isSpinning = false; updateDepositButtonState(); resetToJackpotView(); return;
    }

    // --- Calculate Target Position ---
    const containerWidth = container.offsetWidth;
    const itemWidth = winningElement.offsetWidth || 90; // Use actual element width or default
    const itemOffsetLeft = winningElement.offsetLeft; // Position relative to track start

    // Calculate the scroll offset needed to center the item under the ticker (usually at container's horizontal center)
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    // Add randomness to the final landing position (slight overshoot/undershoot) based on config
    const positionVariation = (Math.random() * 2 - 1) * (itemWidth * CONFIG.LANDING_POSITION_VARIATION);
    // Target scroll position (negative because we move track left)
    const targetScrollPosition = -(itemOffsetLeft - centerOffset) + positionVariation;
    const finalTargetPosition = targetScrollPosition;

    // --- Animation Parameters ---
    const startPosition = parseFloat(track.style.transform?.match(/translateX\(([-.\d]+)px\)/)?.[1] || '0'); // Get current X or 0
    const duration = CONFIG.SPIN_DURATION_SECONDS * 1000; // Total spin duration in ms
    const bounceDuration = CONFIG.BOUNCE_ENABLED ? 1200 : 0; // Duration for bounce effect if enabled
    const totalAnimationTime = duration + bounceDuration;
    const totalDistance = finalTargetPosition - startPosition;
    const overshootAmount = totalDistance * CONFIG.BOUNCE_OVERSHOOT_FACTOR; // For bounce calculation

    // --- Animation Loop Setup ---
    let startTime = performance.now();
    let lastPosition = startPosition;
    let lastTimestamp = startTime;

    track.style.transition = 'none'; // Ensure CSS transitions are off during manual animation

    function animateRoulette(timestamp) {
        if (!isSpinning) { // Check if spin was cancelled externally
            console.log("Animation loop stopped because isSpinning is false.");
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return;
        }

        const elapsed = timestamp - startTime;
        let currentPosition;
        let animationFinished = false;

        // --- Calculate Position Based on Time and Easing/Bounce ---
        if (elapsed <= duration) { // Main easing phase
            const animationPhaseProgress = elapsed / duration;
            const easedProgress = easeOutAnimation(animationPhaseProgress); // Apply easing
            currentPosition = startPosition + totalDistance * easedProgress;
        } else if (CONFIG.BOUNCE_ENABLED && elapsed <= totalAnimationTime) { // Bounce phase (if enabled)
            const bouncePhaseProgress = (elapsed - duration) / bounceDuration;
            const bounceDisplacementFactor = calculateBounce(bouncePhaseProgress);
            currentPosition = finalTargetPosition - (overshootAmount * bounceDisplacementFactor);
        } else { // Animation finished
            currentPosition = finalTargetPosition;
            animationFinished = true;
        }

        // Apply the calculated position to the track
        track.style.transform = `translateX(${currentPosition}px)`;

        // --- Adjust Sound Playback Rate Based on Visual Speed ---
        const deltaTime = (timestamp - lastTimestamp) / 1000; // Time since last frame in seconds
        if (deltaTime > 0.001 && sound && !sound.paused) { // Avoid division by zero and only if sound exists/playing
            const deltaPosition = currentPosition - lastPosition;
            const currentSpeed = Math.abs(deltaPosition / deltaTime); // Speed in pixels/second

            // Define speed thresholds for pitch adjustment
            const minRate = 0.5; const maxRate = 2.0;
            const speedThresholdLow = 300; const speedThresholdHigh = 5000;
            let targetRate;

            if (animationFinished) {
                targetRate = 1.0; // Reset rate at end
            } else if (currentSpeed < speedThresholdLow) {
                targetRate = minRate + (maxRate - minRate) * (currentSpeed / speedThresholdLow) * 0.4; // Drop less drastically
            } else if (currentSpeed > speedThresholdHigh) {
                targetRate = maxRate;
            } else { // Interpolate between low and high thresholds
                const speedRange = speedThresholdHigh - speedThresholdLow;
                const progressInRange = (currentSpeed - speedThresholdLow) / speedRange;
                targetRate = minRate + (maxRate - minRate) * (0.4 + progressInRange * 0.6);
            }

            // Smoothly adjust playback rate towards the target rate
            const rateChangeFactor = 0.08; // Lower = smoother transition
            sound.playbackRate = sound.playbackRate + (targetRate - sound.playbackRate) * rateChangeFactor;
            sound.playbackRate = Math.max(minRate, Math.min(maxRate, sound.playbackRate)); // Clamp rate
        }
        lastPosition = currentPosition;
        lastTimestamp = timestamp;


        // --- Continue or End Animation ---
        if (!animationFinished) {
            animationFrameId = requestAnimationFrame(animateRoulette); // Request next frame
        } else {
            console.log("Animation finished naturally in loop.");
            animationFrameId = null;
            finalizeSpin(winningElement, winner); // Call finalize function when animation completes
        }
    }

    // Start the animation loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear any residual frame
    animationFrameId = requestAnimationFrame(animateRoulette);
}


/**
 * Called when the roulette animation physically stops. Applies winner highlighting and fades sound.
 * @param {HTMLElement} winningElement - The element that won.
 * @param {object} winner - The processed winner data object { user, value, percentage }.
 */
function finalizeSpin(winningElement, winner) {
    // Check if spin already ended or crucial elements/data missing
    if ((!isSpinning && winningElement?.classList.contains('winner-highlight')) || !winningElement || !winner?.user) {
        console.log("FinalizeSpin called, but spin seems already finalized or data is invalid.");
        if (isSpinning) { // If somehow called with invalid data while spinning, try to reset
             isSpinning = false; updateDepositButtonState(); resetToJackpotView();
        }
        return;
    }

    console.log("Finalizing spin: Applying highlight, fading sound.");
    const userColor = getUserColor(winner.user.id);

    // --- Apply Winner Highlighting ---
    // Add class for base highlight styles and inject dynamic style for pulse color
    winningElement.classList.add('winner-highlight');
    const styleId = 'winner-pulse-style';
    document.getElementById(styleId)?.remove(); // Remove old style if exists

    const style = document.createElement('style');
    style.id = styleId;
    // Define pulse animation using CSS variables for the winner's color
    style.textContent = `
        .winner-highlight {
            z-index: 5; /* Ensure highlighted item is above others */
            border-width: 3px; /* Make border thicker */
            border-color: ${userColor}; /* Set border color immediately */
            animation: winnerPulse 1.5s infinite;
            --winner-color: ${userColor}; /* Pass color to animation */
            transform: scale(1.05); /* Slightly larger */
        }
        @keyframes winnerPulse {
            0%, 100% { box-shadow: 0 0 15px var(--winner-color); transform: scale(1.05); }
            50% { box-shadow: 0 0 25px var(--winner-color), 0 0 10px var(--winner-color); transform: scale(1.1); }
        }`;
    document.head.appendChild(style);

    // --- Fade Out Sound ---
    const sound = DOMElements.roulette.spinSound;
    if (sound && !sound.paused) {
        if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); // Clear previous interval

        let currentVolume = sound.volume;
        const fadeOutInterval = 75; // ms interval
        const fadeDuration = 1000; // ms total fade time
        const volumeStep = currentVolume / (fadeDuration / fadeOutInterval);

        window.soundFadeOutInterval = setInterval(() => {
            currentVolume -= volumeStep;
            if (currentVolume <= 0) {
                sound.pause();
                sound.volume = 1.0; // Reset volume for next time
                sound.playbackRate = 1.0; // Reset rate
                clearInterval(window.soundFadeOutInterval);
                window.soundFadeOutInterval = null;
                console.log("Sound faded out.");
            } else {
                sound.volume = currentVolume;
            }
        }, fadeOutInterval);
    }

    // Delay slightly before showing winner info box to let highlight settle visually
    setTimeout(() => {
        handleSpinEnd(winningElement, winner); // Call the function to display winner info overlay
    }, 300); // 300ms delay
}


/**
 * Handles the final actions after the spin animation ends and highlighting is applied.
 * Displays the winner information overlay and triggers confetti.
 * @param {HTMLElement} winningElement - The element that won.
 * @param {object} winner - The processed winner data object { user, value, percentage }.
 */
function handleSpinEnd(winningElement, winner) {
    // Allow running even if isSpinning is false here, as finalizeSpin calls it, but check data
    if (!winningElement || !winner?.user) {
        console.error("handleSpinEnd called with invalid data or element.");
        if (!isSpinning) return; // Don't reset if already reset
        isSpinning = false; updateDepositButtonState(); resetToJackpotView(); return;
    }

    // Stop animation frame just in case it's still running (shouldn't be)
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }

    console.log("Handling spin end: Displaying winner info and confetti.");

    // --- Populate and Show Winner Info Overlay ---
    const { winnerInfoBox, winnerAvatar, winnerName, winnerDeposit, winnerChance } = DOMElements.roulette;
    if (winnerInfoBox && winnerAvatar && winnerName && winnerDeposit && winnerChance) {
        const userColor = getUserColor(winner.user.id);

        // Set winner details in the overlay
        winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
        winnerAvatar.alt = winner.user.username || 'Winner';
        winnerAvatar.style.borderColor = userColor;
        winnerAvatar.style.boxShadow = `0 0 15px ${userColor}`; // Add glow effect

        winnerName.textContent = winner.user.username || 'Winner';
        winnerName.style.color = userColor; // Color the name

        // Format values from the processed winner object (calculated in findWinnerFromData)
        const depositValueStr = `$${(winner.value || 0).toFixed(2)}`;
        const chanceValueStr = `${(winner.percentage || 0).toFixed(2)}%`;

        // Clear previous text for typing effect
        winnerDeposit.textContent = '';
        winnerChance.textContent = '';

        // Fade in the winner info box using CSS animation
        winnerInfoBox.style.display = 'flex';
        winnerInfoBox.style.opacity = '0'; // Start transparent
        winnerInfoBox.style.animation = 'fadeIn 0.5s ease forwards'; // Assumes fadeIn keyframes exist in CSS

        // --- Typing Effect for Value and Chance ---
        setTimeout(() => { // Start typing after fade-in begins
            let depositIndex = 0;
            let chanceIndex = 0;
            const typeDelay = 35; // ms between characters

            // Clear previous typing intervals if any
            if (window.typeDepositInterval) clearInterval(window.typeDepositInterval);
            if (window.typeChanceInterval) clearInterval(window.typeChanceInterval);

            // Type deposit value
            window.typeDepositInterval = setInterval(() => {
                if (depositIndex < depositValueStr.length) {
                    winnerDeposit.textContent += depositValueStr[depositIndex];
                    depositIndex++;
                } else {
                    clearInterval(window.typeDepositInterval);
                    window.typeDepositInterval = null;

                    // Type chance value after deposit is done
                    window.typeChanceInterval = setInterval(() => {
                        if (chanceIndex < chanceValueStr.length) {
                            winnerChance.textContent += chanceValueStr[chanceIndex];
                            chanceIndex++;
                        } else {
                            clearInterval(window.typeChanceInterval);
                            window.typeChanceInterval = null;

                            // --- Final Actions ---
                            // Launch confetti after typing is complete
                            setTimeout(() => { launchConfetti(userColor); }, 200);

                            // Set spinning to false AFTER all visual effects are initiated
                            isSpinning = false;
                            updateDepositButtonState(); // Update button state now that spin is truly over
                            console.log("isSpinning set to false after winner display and confetti.");

                            // Schedule the reset back to the main jackpot view
                            setTimeout(resetToJackpotView, CONFIG.WINNER_DISPLAY_DURATION);
                        }
                    }, typeDelay);
                }
            }, typeDelay);
        }, 500); // Delay typing start to match fade-in duration

    } else {
        console.error("Winner info display elements are missing.");
        // Still need to handle end of spin state even if display fails
        isSpinning = false;
        updateDepositButtonState();
        resetToJackpotView(); // Reset view immediately
    }
}


/**
 * Creates and launches confetti elements using the winner's color scheme.
 * @param {string} [mainColor='#00e676'] - The base color for the confetti.
 */
function launchConfetti(mainColor = '#00e676') {
    const container = DOMElements.roulette.confettiContainer;
    if (!container) return;
    clearConfetti(); // Clear previous confetti first

    // Generate related colors for variety
    const baseColor = mainColor;
    const complementaryColor = getComplementaryColor(baseColor);
    const lighterColor = lightenColor(baseColor, 30);
    const darkerColor = darkenColor(baseColor, 30);
    const colors = [ // Array of colors to use
        baseColor, lighterColor, darkerColor,
        complementaryColor, '#ffffff', lightenColor(complementaryColor, 20)
    ];

    for (let i = 0; i < CONFIG.CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti'; // Base class for styling and animation

        // Random properties for variation
        confetti.style.left = `${Math.random() * 100}%`; // Random horizontal start position
        const animDuration = 2 + Math.random() * 3; // Duration 2-5 seconds
        const animDelay = Math.random() * 1.5; // Delay 0-1.5 seconds

        // Set CSS variables used by the 'confetti-fall' animation (defined in CSS)
        confetti.style.setProperty('--duration', `${animDuration}s`);
        confetti.style.setProperty('--delay', `${animDelay}s`);
        const color = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.setProperty('--color', color); // Use CSS variable for color
        // confetti.style.backgroundColor = color; // Alternative: Direct background color

        const size = Math.random() * 8 + 4; // Size 4px to 12px
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;

        // Rotation and horizontal drift properties for animation keyframes
        const rotationStart = Math.random() * 360;
        const rotationEnd = rotationStart + (Math.random() - 0.5) * 720;
        const fallX = (Math.random() - 0.5) * 100; // Horizontal drift in pixels
        confetti.style.setProperty('--fall-x', `${fallX}px`);
        confetti.style.setProperty('--rotation-start', `${rotationStart}deg`);
        confetti.style.setProperty('--rotation-end', `${rotationEnd}deg`);

        // Random shape (square or circle)
        if (Math.random() < 0.5) confetti.style.borderRadius = '50%';

        container.appendChild(confetti);
    }
}


/**
 * Clears confetti elements and removes winner highlighting styles.
 */
function clearConfetti() {
    // Clear confetti elements
    if (DOMElements.roulette.confettiContainer) DOMElements.roulette.confettiContainer.innerHTML = '';

    // Remove dynamic winner pulse style element from head
    document.getElementById('winner-pulse-style')?.remove();

    // Remove highlight class and reset styles from any previously highlighted roulette item
    document.querySelectorAll('.roulette-item.winner-highlight').forEach(el => {
        el.classList.remove('winner-highlight');
        el.style.transform = ''; // Reset transform if applied
        // Reset border color back to the user's assigned color
        if (el.dataset?.userId) el.style.borderColor = getUserColor(el.dataset.userId);
        else el.style.borderColor = 'transparent'; // Fallback
    });
}

/**
 * Resets the UI back to the main jackpot view after a round ends and winner is displayed.
 * Stops animations, clears intervals, hides roulette, shows jackpot header.
 */
function resetToJackpotView() {
    console.log("Resetting to jackpot view...");

    // --- Stop all ongoing processes related to the previous round ---
    if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
    if (window.soundFadeInInterval) clearInterval(window.soundFadeInInterval); window.soundFadeInInterval = null;
    if (window.soundFadeOutInterval) clearInterval(window.soundFadeOutInterval); window.soundFadeOutInterval = null;
    if (window.typeDepositInterval) clearInterval(window.typeDepositInterval); window.typeDepositInterval = null;
    if (window.typeChanceInterval) clearInterval(window.typeChanceInterval); window.typeChanceInterval = null;
    if (roundTimer) clearInterval(roundTimer); roundTimer = null; // Stop client timer interval
    timerActive = false; // Mark timer as inactive

    isSpinning = false; // Mark spinning as false
    spinStartTime = 0; // Reset animation start time tracker

    // Ensure required elements exist
    const header = DOMElements.jackpot.jackpotHeader;
    const rouletteContainer = DOMElements.roulette.inlineRouletteContainer;
    const winnerInfoBox = DOMElements.roulette.winnerInfoBox;
    const track = DOMElements.roulette.rouletteTrack;
    if (!header || !rouletteContainer || !winnerInfoBox || !track) {
        console.error("Missing elements required for resetToJackpotView.");
        return; // Avoid errors if elements are missing
    }

    // Stop sound if playing
    const sound = DOMElements.roulette.spinSound;
    if (sound && !sound.paused) {
        sound.pause(); sound.currentTime = 0; sound.volume = 1.0; sound.playbackRate = 1.0;
    }

    // --- Transition UI Elements ---
    // Fade out roulette/winner info
    rouletteContainer.style.transition = 'opacity 0.5s ease';
    rouletteContainer.style.opacity = '0';
    if (winnerInfoBox.style.display !== 'none') {
        winnerInfoBox.style.transition = 'opacity 0.3s ease'; // Faster fade for winner info
        winnerInfoBox.style.opacity = '0';
    }
    clearConfetti(); // Clear confetti and winner highlights immediately

    // After fade out, reset structure and fade in jackpot header elements
    setTimeout(() => {
        header.classList.remove('roulette-mode'); // Remove class affecting background/layout
        // Clean up roulette track
        track.style.transition = 'none'; // Disable transitions for reset
        track.style.transform = 'translateX(0)'; // Reset position
        track.innerHTML = ''; // Clear items
        // Hide roulette/winner elements properly
        rouletteContainer.style.display = 'none';
        winnerInfoBox.style.display = 'none';
        winnerInfoBox.style.opacity = ''; // Reset opacity for next time
        winnerInfoBox.style.animation = ''; // Reset animation

        // Make jackpot header elements (value, timer, stats) visible again
        const valueDisplay = header.querySelector('.jackpot-value');
        const timerDisplay = header.querySelector('.jackpot-timer');
        const statsDisplay = header.querySelector('.jackpot-stats');

        [valueDisplay, timerDisplay, statsDisplay].forEach((el, index) => {
            if (el) {
                el.style.display = 'flex'; // Use flex or block as defined in CSS
                el.style.opacity = '0'; // Start faded out
                // Staggered fade-in effect
                setTimeout(() => {
                    el.style.transition = 'opacity 0.5s ease';
                    el.style.opacity = '1';
                }, 50 + index * 50); // Stagger start time
            }
        });

        // --- Reset State for New Round ---
        initiateNewRoundVisualReset(); // Resets timer display, pot value, participant list visuals
        updateDepositButtonState(); // Update button state AFTER resetting everything

        // Request fresh round data from server to ensure sync
        if (socket.connected) {
            console.log("Requesting fresh round data after reset.");
            socket.emit('requestRoundData');
        } else {
            console.warn("Socket not connected, skipping requestRoundData after reset.");
            // Button state might be inaccurate until connection restored
        }

    }, 500); // Wait for fade-out transition to complete (match CSS duration)
}


/**
 * Performs the visual reset needed when a new round starts or view is reset.
 * Clears timer, pot value, participant list visuals.
 */
function initiateNewRoundVisualReset() {
    console.log("Initiating visual reset for new round display");

    // Reset Timer display to initial state (e.g., showing ROUND_DURATION)
    updateTimerUI(CONFIG.ROUND_DURATION); // Updates text and circle
    if (DOMElements.jackpot.timerValue) {
        DOMElements.jackpot.timerValue.classList.remove('urgent-pulse', 'timer-pulse');
    }
    // Ensure client timer interval is stopped and flag is reset
    if (roundTimer) clearInterval(roundTimer); roundTimer = null;
    timerActive = false;

    // Clear the participants (deposit blocks) container and show empty message
    const container = DOMElements.jackpot.participantsContainer;
    const emptyMsg = DOMElements.jackpot.emptyPotMessage;
    if (container && emptyMsg) {
        container.innerHTML = ''; // Clear all previous deposit blocks
        // Ensure the empty pot message is present and displayed
        if (!container.contains(emptyMsg)) container.appendChild(emptyMsg);
        emptyMsg.style.display = 'block';
    }

    // Reset Pot Value display
    if (DOMElements.jackpot.potValue) DOMElements.jackpot.potValue.textContent = "$0.00";

    // Reset Participant Count display
    if (DOMElements.jackpot.participantCount) {
        DOMElements.jackpot.participantCount.textContent = `0/${CONFIG.MAX_PARTICIPANTS_DISPLAY}`;
    }

    // Clear user color map for the new round
    userColorMap.clear();

    // Ensure deposit button state is updated for the new round conditions
    updateDepositButtonState();
}

/**
 * Helper function to find winner details (user object, value, percentage) from local round data.
 * @param {object} winnerData - Data containing the winner ID, e.g., { winner: { id, ... } }
 * @returns {object|null} Object with { user, value, percentage } or null if not found/invalid.
 */
function findWinnerFromData(winnerData) {
    const winnerId = winnerData?.winner?.id;
    if (!winnerId) {
        console.error("Missing winner ID in findWinnerFromData input:", winnerData);
        return null;
    }

    // Use currentRound data if available and valid
    if (!currentRound || !currentRound.participants) {
        console.warn("Missing currentRound or participants data for findWinnerFromData.");
        // Fallback: Use only the data passed in if local state is missing (percentage/value will be 0)
        if (winnerData.winner) return { user: { ...winnerData.winner }, percentage: 0, value: 0 };
        return null; // Cannot proceed
    }

    // Find the participant in the local round data matching the winner ID
    const winnerParticipant = currentRound.participants.find(p => p.user?.id === winnerId);

    if (!winnerParticipant) {
        console.warn(`Winner ID ${winnerId} not found in local participants list.`);
        // Fallback similar to above if participant not found locally
        if (winnerData.winner) return { user: { ...winnerData.winner }, percentage: 0, value: 0 };
        return null;
    }

    // Calculate percentage based on local round data
    const totalValue = Math.max(0.01, currentRound.totalValue || 0.01); // Avoid division by zero
    const participantValue = winnerParticipant.itemsValue || 0;
    const percentage = (participantValue / totalValue) * 100;

    return {
        user: { ...winnerParticipant.user }, // Return full user object
        percentage: percentage || 0,
        value: participantValue
    };
}


/**
 * Test function to trigger the roulette animation with mock or current round data.
 * Selects a random winner from the participants. Uses Rust-themed mock data if needed.
 */
function testRouletteAnimation() {
    console.log("--- TESTING ROULETTE ANIMATION ---");

    if (isSpinning) {
        showNotification("Already spinning, test cancelled.", 'info');
        return;
    }

    let testData = currentRound; // Use current round data if available

    // If no current round or no participants, create mock Rust-themed data
    if (!testData || !testData.participants || testData.participants.length === 0) {
        console.log('Using sample Rust test data for animation...');
        testData = {
            roundId: `test-${Date.now()}`,
            status: 'active', // Simulate active before spin
            totalValue: 215.50,
            participants: [
                { user: { id: 'rust_user_1', username: 'Scrap King', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg' }, itemsValue: 150.25, tickets: 15025 },
                { user: { id: 'rust_user_2', username: 'Foundation Wipe', avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg' }, itemsValue: 45.75, tickets: 4575 },
                { user: { id: 'rust_user_3', username: 'Heli Enjoyer', avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg' }, itemsValue: 19.50, tickets: 1950 }
            ],
            items: [ // Simplified items list for mock data
                { owner: 'rust_user_1', name: 'Assault Rifle', price: 50.00, image: '/img/default-item.png' },
                { owner: 'rust_user_1', name: 'Metal Facemask', price: 40.25, image: '/img/default-item.png' },
                { owner: 'rust_user_1', name: 'Garage Door', price: 60.00, image: '/img/default-item.png' },
                { owner: 'rust_user_2', name: 'Semi-Automatic Rifle', price: 20.75, image: '/img/default-item.png' },
                { owner: 'rust_user_2', name: 'Road Sign Kilt', price: 25.00, image: '/img/default-item.png' },
                { owner: 'rust_user_3', name: 'MP5A4', price: 19.50, image: '/img/default-item.png' }
            ]
        };
        // Set this mock data as the current round for the test
        currentRound = testData;
        // Visually update the UI to reflect the mock data before spinning
        initiateNewRoundVisualReset(); // Clear display first
        updateRoundUI(); // Update pot/count based on mock data
        // Manually add deposit blocks for mock participants
        if (currentRound.participants?.length > 0) {
            // Sort for display consistency if desired (e.g., highest deposit first)
            const sortedParticipants = [...currentRound.participants].sort((a, b) => (b.itemsValue || 0) - (a.itemsValue || 0));
            sortedParticipants.forEach(p => {
                const userItems = currentRound.items?.filter(item => item.owner === p.user?.id) || [];
                const mockDepositData = { userId: p.user.id, username: p.user.username, avatar: p.user.avatar, itemsValue: p.itemsValue, depositedItems: userItems };
                displayLatestDeposit(mockDepositData);
                // Remove animation class immediately for test setup
                const element = DOMElements.jackpot.participantsContainer?.querySelector(`.player-deposit-container[data-user-id="${p.user.id}"]`);
                if (element) element.classList.remove('player-deposit-new');
            });
        }
    } else {
        // Ensure current round is marked active for test consistency if using real data
        currentRound.status = 'active';
    }

    // Ensure participants exist after potential mock data setup
    if (!currentRound?.participants?.length > 0) {
        showNotification('Test Error: No participants available for test spin.', 'error');
        return;
    }

    // Select a random winner from the participants list for the test
    const idx = Math.floor(Math.random() * currentRound.participants.length);
    const winningParticipant = currentRound.participants[idx];

    if (!winningParticipant?.user) {
        console.error("Selected winning participant is invalid in test data:", winningParticipant);
        showNotification('Test Error: Could not select a valid winner.', 'error');
        return;
    }

    // Create mock winner data structure similar to what server sends ('roundWinner' event)
    const mockWinnerData = {
        roundId: currentRound.roundId,
        winner: winningParticipant.user, // Pass the user object
        winningTicket: Math.floor(Math.random() * (winningParticipant.tickets || 1)) + 1 // Simulate a winning ticket number (1-based)
        // Server might also send serverSeed, clientSeed etc. after round end
    };

    console.log('Test Winner Selected:', mockWinnerData.winner.username);
    // Trigger the same function used for real winner announcements
    handleWinnerAnnouncement(mockWinnerData);
}


// --- Provably Fair Section Functions ---

/**
 * Sends data to the backend API to verify a past round's fairness.
 */
async function verifyRound() {
    const { roundIdInput, serverSeedInput, clientSeedInput, verificationResultDisplay } = DOMElements.provablyFair;

    if (!roundIdInput || !serverSeedInput || !clientSeedInput || !verificationResultDisplay) {
        console.error("Verify form elements missing.");
        return;
    }

    const roundId = roundIdInput.value.trim();
    const serverSeed = serverSeedInput.value.trim();
    const clientSeed = clientSeedInput.value.trim();
    const resultEl = verificationResultDisplay; // Alias for clarity

    // --- Basic Input Validation ---
    let validationError = null;
    if (!roundId || !serverSeed || !clientSeed) {
        validationError = 'Please fill in all fields (Round ID, Server Seed, Client Seed).';
    } else if (serverSeed.length !== 64 || !/^[a-f0-9]{64}$/i.test(serverSeed)) {
        validationError = 'Invalid Server Seed format (should be 64 hexadecimal characters).';
    } else if (clientSeed.length === 0) { // Basic check, could be more specific
        validationError = 'Client Seed cannot be empty.';
    }

    if (validationError) {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result error';
        resultEl.innerHTML = `<p>${validationError}</p>`;
        return;
    }

    // --- API Call ---
    try {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result loading'; // Show loading state
        resultEl.innerHTML = '<p>Verifying...</p>';

        const response = await fetch('/api/verify', { // Assumes API endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId, serverSeed, clientSeed })
        });

        const result = await response.json(); // Get response body

        if (!response.ok) {
            // Use error message from server if available
            throw new Error(result.error || `Verification failed (${response.status})`);
        }

        // --- Display Verification Result ---
        resultEl.className = `verification-result ${result.verified ? 'success' : 'error'}`;
        let html = `<h4>Result (Round #${result.roundId || roundId})</h4>`; // Use ID from result if available

        if (result.verified) {
            html += `<p style="color: var(--success-color); font-weight: bold;">✅ Verified Fair.</p>`;
            // Display relevant data for successful verification
            if (result.serverSeedHash) html += `<p><strong>Server Seed Hash (Used):</strong> <code class="seed-value">${result.serverSeedHash}</code></p>`;
            if (result.serverSeed) html += `<p><strong>Server Seed (Provided):</strong> <code class="seed-value">${result.serverSeed}</code></p>`;
            if (result.clientSeed) html += `<p><strong>Client Seed (Provided):</strong> <code class="seed-value">${result.clientSeed}</code></p>`;
            if (result.combinedString) html += `<p><strong>Combined String (Server-Client):</strong> <code class="seed-value wrap-anywhere">${result.combinedString}</code></p>`;
            if (result.finalHash) html += `<p><strong>Resulting SHA256 Hash:</strong> <code class="seed-value">${result.finalHash}</code></p>`;
            if (result.winningTicket !== undefined) html += `<p><strong>Winning Ticket Number:</strong> ${result.winningTicket} (out of ${result.totalTickets || 'N/A'} total tickets)</p>`;
            if (result.winnerUsername) html += `<p><strong>Verified Winner:</strong> ${result.winnerUsername}</p>`;
            if (result.totalValue !== undefined) html += `<p><strong>Final Pot Value:</strong> $${result.totalValue.toFixed(2)}</p>`;
        } else {
            html += `<p style="color: var(--error-color); font-weight: bold;">❌ Verification Failed.</p>`;
            html += `<p><strong>Reason:</strong> ${result.reason || 'Mismatch detected.'}</p>`;
            // Show relevant data for debugging the failure
            if (result.serverSeedHash) html += `<p><strong>Expected Server Seed Hash:</strong> <code class="seed-value">${result.serverSeedHash}</code></p>`;
            if (result.calculatedHash) html += `<p><strong>Calculated Hash from Provided Seed:</strong> <code class="seed-value">${result.calculatedHash}</code></p>`;
            if (result.serverSeed) html += `<p><strong>Expected Server Seed:</strong> <code class="seed-value">${result.serverSeed}</code></p>`;
            if (result.clientSeed) html += `<p><strong>Expected Client Seed:</strong> <code class="seed-value">${result.clientSeed}</code></p>`;
            if (result.calculatedWinningTicket !== undefined) html += `<p><strong>Calculated Ticket from Inputs:</strong> ${result.calculatedWinningTicket}</p>`;
            if (result.actualWinningTicket !== undefined) html += `<p><strong>Actual Recorded Ticket:</strong> ${result.actualWinningTicket}</p>`;
            if (result.totalTickets !== undefined) html += `<p><strong>Total Tickets in Round:</strong> ${result.totalTickets}</p>`;
        }

        resultEl.innerHTML = html;

    } catch (error) {
        resultEl.style.display = 'block';
        resultEl.className = 'verification-result error';
        resultEl.innerHTML = `<p>Verification Error: ${error.message}</p>`;
        console.error('Error verifying round:', error);
    }
}


/**
 * Loads a page of past round history from the backend API.
 * @param {number} [page=1] - The page number to load.
 */
async function loadPastRounds(page = 1) {
    const tableBody = DOMElements.provablyFair.roundsTableBody;
    const paginationContainer = DOMElements.provablyFair.roundsPagination;

    if (!tableBody || !paginationContainer) {
        console.warn("Rounds history table/pagination elements missing.");
        return;
    }

    try {
        // Show loading state
        tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading round history...</td></tr>';
        paginationContainer.innerHTML = ''; // Clear old pagination

        const response = await fetch(`/api/rounds?page=${page}&limit=10`); // Fetch specific page (limit 10 per page)

        if (!response.ok) {
            throw new Error(`Failed to load round history (${response.status})`);
        }

        const data = await response.json();

        // Validate received data structure
        if (!data || !Array.isArray(data.rounds) ||
            typeof data.currentPage !== 'number' || typeof data.totalPages !== 'number') {
            throw new Error('Invalid rounds data received from server.');
        }

        tableBody.innerHTML = ''; // Clear loading message

        if (data.rounds.length === 0) {
            // Display message if no rounds found
            const message = (page === 1) ? 'No past rounds found.' : 'No rounds found on this page.';
            tableBody.innerHTML = `<tr><td colspan="5" class="no-rounds-message">${message}</td></tr>`;
        } else {
            // Populate table with round data
            data.rounds.forEach(round => {
                const row = document.createElement('tr');
                row.dataset.roundId = round.roundId; // Store round ID for potential future use

                // Format date nicely using user's locale settings
                let date = 'N/A';
                const timeToFormat = round.completedTime || round.endTime; // Prefer completedTime
                if (timeToFormat) {
                    try {
                        const d = new Date(timeToFormat);
                        if (!isNaN(d.getTime())) {
                            date = d.toLocaleString(undefined, {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true
                            });
                        }
                    } catch (e) { console.error("Date formatting error:", e); }
                }

                // Prepare seeds for button (escape quotes for onclick attribute)
                // Note: Using onclick directly is less ideal than adding event listeners, but matches provided code.
                const serverSeedStr = (round.serverSeed || '').replace(/'/g, "\\'");
                const clientSeedStr = (round.clientSeed || '').replace(/'/g, "\\'");
                const roundIdStr = round.roundId || 'N/A';
                const winnerUsername = round.winner?.username || (round.status === 'error' ? 'ERROR' : 'N/A');
                const potValueStr = (round.totalValue !== undefined) ? `$${round.totalValue.toFixed(2)}` : '$0.00';

                row.innerHTML = `
                    <td>#${roundIdStr}</td>
                    <td>${date}</td>
                    <td>${potValueStr}</td>
                    <td>${winnerUsername}</td>
                    <td>
                        <button class="btn btn-details" onclick="showRoundDetails('${roundIdStr}')"
                                ${roundIdStr === 'N/A' ? 'disabled' : ''}>Details</button>
                        <button class="btn btn-verify" onclick="populateVerificationFields('${roundIdStr}', '${serverSeedStr}', '${clientSeedStr}')"
                                ${!round.serverSeed ? 'disabled title="Seed not revealed yet"' : ''}>Verify</button>
                    </td>`;
                tableBody.appendChild(row);
            });
        }

        // Create pagination controls based on current page and total pages
        createPagination(data.currentPage, data.totalPages);

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading rounds: ${error.message}</td></tr>`;
        console.error('Error loading past rounds:', error);
    }
}


/**
 * Populates the verification form fields when a "Verify" button in the history table is clicked.
 * This function is attached to the window object to be accessible via the `onclick` attribute.
 * Consider using event delegation on the table body instead for better practice.
 * @param {string} roundId - The round ID to populate.
 * @param {string} serverSeed - The server seed to populate.
 * @param {string} clientSeed - The client seed to populate.
 */
window.populateVerificationFields = function(roundId, serverSeed, clientSeed) {
    const { roundIdInput, serverSeedInput, clientSeedInput, verificationSection } = DOMElements.provablyFair;

    if (roundIdInput) roundIdInput.value = roundId || '';
    if (serverSeedInput) serverSeedInput.value = serverSeed || '';
    if (clientSeedInput) clientSeedInput.value = clientSeed || '';

    // Scroll to the verification section smoothly for user convenience
    if (verificationSection) {
        verificationSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Optionally notify user if seeds are missing (e.g., round too recent)
    if (!serverSeed && roundId && roundId !== 'N/A') {
        showNotification(`Info: Server Seed for Round #${roundId} is revealed after the round ends.`, 'info');
    }
};

/**
 * Placeholder function to show round details when "Details" button in history is clicked.
 * This function is attached to the window object for `onclick`.
 * TODO: Implement fetching and displaying details in a modal or dedicated view.
 * @param {string} roundId - The ID of the round to show details for.
 */
window.showRoundDetails = async function(roundId) {
    console.log(`Showing details for round ${roundId}`);

    if (!roundId || roundId === 'N/A') {
        showNotification('Info: Invalid Round ID for details.', 'info');
        return;
    }

    // --- Placeholder ---
    // Replace this alert with actual detail fetching and modal display logic.
    showNotification(`Fetching details for round #${roundId}... (Implementation needed)`, 'info');

    // --- Example Future Implementation ---
    // try {
    //     const response = await fetch(`/api/rounds/${roundId}/details`); // hypothetical endpoint
    //     if (!response.ok) {
    //         throw new Error(`Failed to fetch round details (${response.status})`);
    //     }
    //     const roundDetails = await response.json();
    //     // displayRoundDetailsModal(roundDetails); // Function to populate and show a modal
    // } catch (error) {
    //     showNotification(`Error: Could not load details for round ${roundId}: ${error.message}`, 'error');
    //     console.error('Error fetching round details:', error);
    // }
};


/**
 * Creates pagination controls for the round history table.
 * @param {number} currentPage - The currently active page number.
 * @param {number} totalPages - The total number of pages available.
 */
function createPagination(currentPage, totalPages) {
    const container = DOMElements.provablyFair.roundsPagination;
    if (!container) return;
    container.innerHTML = ''; // Clear previous pagination

    if (totalPages <= 1) return; // No pagination needed if only one page

    const maxPagesToShow = 5; // Max number of page number buttons to show (e.g., 1 ... 4 5 6 ... 10)

    // Helper to create button or ellipsis span
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
                loadPastRounds(page); // Load the clicked page
            });
        }
        return button;
    };

    // --- Build Pagination ---
    // Previous Button
    container.appendChild(createButton('« Prev', currentPage - 1, false, currentPage <= 1));

    // Page Number Buttons Calculation
    if (totalPages <= maxPagesToShow) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
            container.appendChild(createButton(i, i, i === currentPage));
        }
    } else {
        // Complex pagination logic (show first, last, current, neighbors, ellipsis)
        const pages = [];
        pages.push(1); // Always show page 1

        // Calculate range around current page
        const rangePadding = Math.floor((maxPagesToShow - 3) / 2); // How many neighbors on each side
        let rangeStart = Math.max(2, currentPage - rangePadding);
        let rangeEnd = Math.min(totalPages - 1, currentPage + rangePadding);

        // Adjust range if it bumps against the edges or doesn't fill maxPagesToShow
        const rangeLength = rangeEnd - rangeStart + 1;
        const needed = (maxPagesToShow - 3); // Buttons needed between first and last
        if (rangeLength < needed) {
            if (currentPage < totalPages / 2) { // Near the beginning
                rangeEnd = Math.min(totalPages - 1, rangeEnd + (needed - rangeLength));
            } else { // Near the end
                rangeStart = Math.max(2, rangeStart - (needed - rangeLength));
            }
        }

        // Add ellipsis before the range if needed
        if (rangeStart > 2) pages.push('...');

        // Add page numbers in the calculated range
        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }

        // Add ellipsis after the range if needed
        if (rangeEnd < totalPages - 1) pages.push('...');

        pages.push(totalPages); // Always show last page

        // Create buttons from the calculated pages array
        pages.forEach(page => {
            if (page === '...') {
                container.appendChild(createButton('...', null, false, true, true));
            } else {
                container.appendChild(createButton(page, page, page === currentPage));
            }
        });
    }

    // Next Button
    container.appendChild(createButton('Next »', currentPage + 1, false, currentPage >= totalPages));
}


// --- Socket.IO Event Handlers ---
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        showNotification('Connected to server.', 'success', 2000);
        socket.emit('requestRoundData'); // Request current round state on connect
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showNotification('Disconnected from server. Attempting to reconnect...', 'error', 5000);
        // Update button state to reflect disconnected status (likely disabled)
        updateDepositButtonState();
        // Optionally clear round data or show disconnected state visually
        // currentRound = null;
        // initiateNewRoundVisualReset(); // Reset visuals might be too abrupt
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showNotification('Connection Error. Please refresh.', 'error', 10000);
        // Update button state
        updateDepositButtonState();
    });

    // --- Round Lifecycle Events ---
    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        // Reset view first, it handles flags and timers which affect button state
        resetToJackpotView(); // This resets visuals and calls updateDepositButtonState
        updateRoundUI(); // Update header stats
        // Call directly here too ensure it's updated after reset logic runs fully
        updateDepositButtonState();
    });

    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        // Ensure data has expected structure (added in handleNewDeposit)
        if (currentRound && currentRound.roundId === data.roundId) {
            handleNewDeposit(data); // Updates state and UI
        } else if (!currentRound && data.roundId) {
            console.warn("Participant update for unknown round. Requesting full data.");
            socket.emit('requestRoundData'); // Request full state if out of sync
        }
    });

    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false; // Stop client timer if running
            if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
            if (DOMElements.jackpot.timerValue) DOMElements.jackpot.timerValue.textContent = "Rolling";
            if (DOMElements.jackpot.timerForeground) updateTimerCircle(0, CONFIG.ROUND_DURATION); // Set circle to empty
            // Ensure local status reflects rolling
            currentRound.status = 'rolling';
            updateDepositButtonState(); // Disable deposits
        }
    });

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            // Update local round state with winner info if not already present
            if (!currentRound.winner) currentRound.winner = data.winner;
            currentRound.status = 'rolling'; // Mark as rolling if not already
            // Trigger the animation sequence
            handleWinnerAnnouncement(data);
            // Button state is handled within the animation functions (isSpinning = true)
        } else {
            console.warn("Received winner for mismatched round ID.");
        }
    });

    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            currentRound.status = 'completed'; // Mark as completed
            // Update local round with final details if provided (e.g., revealed seeds)
            if(data.serverSeed) currentRound.serverSeed = data.serverSeed;
            if(data.clientSeed) currentRound.clientSeed = data.clientSeed;
        }
        // The resetToJackpotView called after winner display handles re-enabling deposits for the *next* round
        updateDepositButtonState(); // Update state (should still be disabled until new round starts)
    });

    socket.on('roundError', (data) => {
        console.error('Round Error event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            currentRound.status = 'error';
            showNotification(`Round Error: ${data.error || 'An unknown error occurred.'}`, 'error');
            updateDepositButtonState(); // Disable deposits on error
            // Optionally reset view or show error state more prominently
        }
    });

    // --- Initial/Sync Data ---
    socket.on('roundData', (data) => {
        console.log('Received initial/updated round data:', data);
        if (!data) {
            console.error("Invalid round data received from server.");
            showNotification('Error syncing with server.', 'error');
            return;
        }

        currentRound = data;
        updateRoundUI(); // Update header UI based on received state
        updateDepositButtonState(); // Update button state

        // --- Logic to handle connecting mid-round or syncing timer ---
        if (currentRound.status === 'rolling' || currentRound.status === 'completed') {
            // If connected during rolling/completed phase
            if (!isSpinning && currentRound.winner) {
                // If winner is known but animation hasn't run locally, trigger it
                console.log("Connected mid-round with winner known, triggering animation.");
                handleWinnerAnnouncement(currentRound); // Trigger spin using stored winner data
            } else if (!isSpinning) {
                // If round ended/errored but animation not running, reset view
                console.log("Connected after round ended or during rolling without winner yet. Resetting view.");
                resetToJackpotView();
            }
        } else if (currentRound.status === 'active') {
            // If round is active, sync or start the client timer
            if (currentRound.participants?.length >= 1 && currentRound.timeLeft > 0 && !timerActive) {
                // Start timer if needed based on server's timeLeft (>= 1 participant starts timer)
                console.log(`Received active round with ${currentRound.participants?.length} participants and ${currentRound.timeLeft}s left. Starting/syncing timer.`);
                timerActive = true;
                startClientTimer(currentRound.timeLeft || CONFIG.ROUND_DURATION);
            } else if (currentRound.timeLeft <= 0 && timerActive) {
                // Stop client timer if server says time is up but client timer was still running
                console.log("Server data indicates time is up, stopping client timer.");
                timerActive = false;
                if (roundTimer) clearInterval(roundTimer); roundTimer = null;
                updateTimerUI(0); // Show 0 or Ending state
                updateDepositButtonState();
            } else if (currentRound.participants?.length === 0 && timerActive) {
                 // Stop timer if server says no participants but client timer was running
                 console.log("Server data indicates no participants, stopping client timer.");
                 timerActive = false;
                 if (roundTimer) clearInterval(roundTimer); roundTimer = null;
                 updateTimerUI(CONFIG.ROUND_DURATION); // Reset timer display
                 updateDepositButtonState();
            }
        } else if (currentRound.status === 'pending') {
             // Handle pending state (e.g., show "Waiting for round")
             console.log("Received pending round state.");
             initiateNewRoundVisualReset(); // Reset visuals
             if(DOMElements.jackpot.timerValue) DOMElements.jackpot.timerValue.textContent = "Waiting";
             updateDepositButtonState(); // Should disable deposits
        }
    });

    // --- Other Events ---
    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        // Notify the specific user if it's them
        if (currentUser && data.userId === currentUser._id) {
            showNotification('Trade Offer Sent: Check Steam for your winnings!', 'success');
        }
    });

}


// --- Event Listener Setup ---
function setupEventListeners() {
    // Navigation Links
    Object.entries(DOMElements.nav).forEach(([key, element]) => {
        if (element && DOMElements.pages[key.replace('Link', 'Page')]) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                showPage(DOMElements.pages[key.replace('Link', 'Page')]);
            });
        }
    });

    // Login Button
    DOMElements.user.loginButton?.addEventListener('click', () => {
        window.location.href = '/auth/steam'; // Redirect to Steam auth route
    });

    // Deposit Modal Trigger Button
    DOMElements.deposit.showDepositModalButton?.addEventListener('click', () => {
        const button = DOMElements.deposit.showDepositModalButton;
        // Check if button is disabled (state handled by updateDepositButtonState)
        if (button.disabled) {
            showNotification(button.title || 'Deposits are currently closed.', 'info');
            return; // Stop processing if disabled
        }
        // Additional checks (redundant if button state is accurate, but good safeguard)
        if (!currentUser) {
            showNotification('Login Required: Please log in first to deposit items.', 'error'); return;
        }
        if (!currentUser.tradeUrl) {
            showModal(DOMElements.tradeUrl.tradeUrlModal); // Show trade URL modal if missing
            return;
        }
        // Open the deposit modal if all checks pass
        showModal(DOMElements.deposit.depositModal);
        loadUserInventory(); // Load inventory when modal opens
    });

    // Deposit Modal Close / Submit Buttons
    DOMElements.deposit.closeDepositModalButton?.addEventListener('click', () => hideModal(DOMElements.deposit.depositModal));
    DOMElements.deposit.depositButton?.addEventListener('click', submitDeposit);

    // Trade URL Modal Close / Submit Buttons
    DOMElements.tradeUrl.closeTradeUrlModalButton?.addEventListener('click', () => hideModal(DOMElements.tradeUrl.tradeUrlModal));
    DOMElements.tradeUrl.saveTradeUrlButton?.addEventListener('click', saveUserTradeUrl);

    // Age Verification Modal Logic
    const { modal: ageModal, checkbox: ageCheckbox, agreeButton: ageAgreeButton } = DOMElements.ageVerification;
    if (ageModal && ageCheckbox && ageAgreeButton) {
        ageCheckbox.addEventListener('change', () => { ageAgreeButton.disabled = !ageCheckbox.checked; });
        ageAgreeButton.addEventListener('click', () => {
            if (ageCheckbox.checked) {
                localStorage.setItem('ageVerified', 'true');
                hideModal(ageModal);
            }
        });
        ageAgreeButton.disabled = !ageCheckbox.checked; // Initial state
    }

    // Test Buttons (Keep if needed for development, remove for production)
    document.getElementById('testSpinButton')?.addEventListener('click', testRouletteAnimation);
    document.getElementById('testDepositButton')?.addEventListener('click', testDeposit);

    // Provably Fair Verify Button
    DOMElements.provablyFair.verifyButton?.addEventListener('click', verifyRound);

    // Modal Outside Click Listener (to close modals)
    window.addEventListener('click', (e) => {
        if (e.target === DOMElements.deposit.depositModal) hideModal(DOMElements.deposit.depositModal);
        if (e.target === DOMElements.tradeUrl.tradeUrlModal) hideModal(DOMElements.tradeUrl.tradeUrlModal);
        // Don't close age verification by clicking outside unless maybe already verified?
        // if (e.target === DOMElements.ageVerification.modal && localStorage.getItem('ageVerified')) {
        //     hideModal(DOMElements.ageVerification.modal);
        // }
    });

    // Keyboard Shortcut (Example: Spacebar for Test Spin - remove for production)
    document.addEventListener('keydown', function(event) {
        // Check if Spacebar pressed, not in input, not spinning, home page visible, no modal open
        if (event.code === 'Space' &&
            DOMElements.pages.homePage?.style.display === 'block' &&
            !isSpinning &&
            !document.querySelector('.modal[style*="display: flex"]') && // Check if any modal is open
            !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName))
        {
            console.log("Spacebar pressed for test spin.");
            testRouletteAnimation();
            event.preventDefault(); // Prevent default spacebar action (e.g., scrolling)
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // Show age verification modal if not previously verified
    if (DOMElements.ageVerification.modal && !localStorage.getItem('ageVerified')) {
        showModal(DOMElements.ageVerification.modal);
    }

    // Initial setup calls
    checkLoginStatus(); // Checks login, then updates UI and button state
    setupEventListeners(); // Sets up click handlers etc.
    setupSocketConnection(); // Establishes socket connection and sets up listeners
    showPage(DOMElements.pages.homePage); // Show the main jackpot page initially
    initiateNewRoundVisualReset(); // Set initial visual state for timer/pot/participants
    // updateDepositButtonState(); // Called within checkLoginStatus and reset functions
});

console.log("main.js loaded.");
