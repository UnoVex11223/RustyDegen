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
        homeLink: document.getElementById('home-link'), // ** Use ID added in HTML **
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
    // User Authentication / Profile (*** MODIFIED/ADDED ***)
    user: {
        loginButton: document.getElementById('loginButton'),
        userProfileArea: document.getElementById('userProfile'), // The clickable area
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
        profileDropdown: document.getElementById('profileDropdown'), // The dropdown menu itself
        profileDropdownLink: document.getElementById('profileDropdownLink'), // Link inside dropdown
        logoutButton: document.getElementById('logoutButton'), // Button inside dropdown
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
    // Trade URL Modal (Keep initial one)
    tradeUrl: {
        tradeUrlModal: document.getElementById('tradeUrlModal'),
        closeTradeUrlModalButton: document.getElementById('closeTradeUrlModal'),
        tradeUrlInput: document.getElementById('tradeUrlInput'),
        saveTradeUrlButton: document.getElementById('saveTradeUrl'),
    },
    // *** NEW: Profile Modal Elements ***
    profile: {
        profileModal: document.getElementById('profileModal'),
        closeProfileModalButton: document.getElementById('closeProfileModal'),
        totalDepositedDisplay: document.getElementById('profileTotalDeposited'),
        totalWonDisplay: document.getElementById('profileTotalWon'),
        tradeUrlInput: document.getElementById('profileTradeUrlInput'), // Input inside profile modal
        saveTradeUrlButton: document.getElementById('profileSaveTradeUrlButton'), // Save button inside profile modal
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
    notificationBar: document.getElementById('notification-bar'),
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
// *** NEW: State for dropdown ***
let isProfileDropdownOpen = false;

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
    document.querySelectorAll('.main-nav a, .primary-nav a, .secondary-nav a') // Select all nav links
        .forEach(link => link?.classList.remove('active'));

    // Find the corresponding link element to activate based on page ID
    let activeLink = null;
    const pageId = pageElement?.id;
    if (pageId === 'home-page') activeLink = DOMElements.nav.homeLink;
    else if (pageId === 'faq-page') activeLink = DOMElements.nav.faqLink;
    else if (pageId === 'fair-page') activeLink = DOMElements.nav.fairLink;
    else if (pageId === 'about-page') activeLink = DOMElements.nav.aboutLink;
    else if (pageId === 'roadmap-page') activeLink = DOMElements.nav.roadmapLink;

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
        const response = await fetch('/api/user');
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                currentUser = null;
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
        // Don't show notification on initial load failure unless persistent issue
    } finally {
        updateUserUI(); // Update profile/login button visibility
        updateDepositButtonState(); // Update deposit button based on login status
        closeProfileDropdown(); // Ensure dropdown is closed on initial load/refresh
    }
}

/**
 * Updates the user profile section (avatar, name) or shows the login button.
 * Hides/shows the profile dropdown container based on login status.
 */
function updateUserUI() {
    const { loginButton, userProfileArea, userAvatar, userName } = DOMElements.user;
    const userProfileContainer = userProfileArea?.closest('.user-profile-container'); // Get the parent container

    if (!loginButton || !userProfileArea || !userAvatar || !userName || !userProfileContainer) return;

    if (currentUser) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
        userName.textContent = currentUser.username || 'User';
        loginButton.style.display = 'none';
        userProfileContainer.style.display = 'block'; // Show the whole profile container
        userProfileArea.style.display = 'flex'; // Ensure inner flex is visible
    } else {
        loginButton.style.display = 'flex';
        userProfileContainer.style.display = 'none'; // Hide the whole profile container
        userProfileArea.style.display = 'none';
        closeProfileDropdown(); // Close dropdown if user logs out
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
        //     tradeLinkElement.innerHTML = \`<a href="\${fullBotTradeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Open Trade Offer</a> (Copy Message: \${depositToken})\`;
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
 * Saves the user's Steam Trade URL via backend API call - triggered from the initial prompt modal.
 */
async function saveUserTradeUrl() {
    const { tradeUrlInput, saveTradeUrlButton, tradeUrlModal } = DOMElements.tradeUrl;
    if (!tradeUrlInput || !saveTradeUrlButton || !tradeUrlModal) {
        console.error("Initial Trade URL modal elements missing.");
        return;
    }

    const tradeUrl = tradeUrlInput.value.trim();

    // Validation
    if (!tradeUrl) {
        showNotification('Input Required: Please enter your Steam Trade URL.', 'error');
        return;
    }
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') ||
        !tradeUrl.includes('partner=') ||
        !tradeUrl.includes('token=')) {
        showNotification('Invalid Format: Please enter a valid Steam Trade URL including partner and token parameters.', 'error');
        return;
    }

    saveTradeUrlButton.disabled = true;
    saveTradeUrlButton.textContent = 'Saving...';

    try {
        const response = await fetch('/api/user/tradeurl', {
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

        hideModal(tradeUrlModal); // Hide the initial prompt modal

        updateDepositButtonState(); // Re-evaluate deposit button state
        showNotification('Success: Trade URL saved. You can now deposit.', 'success');

    } catch (error) {
        showNotification(`Error Saving URL: ${error.message}`, 'error');
        console.error('Error updating trade URL:', error);
    } finally {
        saveTradeUrlButton.disabled = false;
        saveTradeUrlButton.textContent = 'Save Trade URL';
    }
}


/**
 * Saves the user's Steam Trade URL via backend API call - triggered from the PROFILE modal.
 */
async function saveUserTradeUrlFromProfile() {
    const { tradeUrlInput, saveTradeUrlButton } = DOMElements.profile; // Use PROFILE modal elements
    const profileModal = DOMElements.profile.profileModal; // Get profile modal element

    if (!tradeUrlInput || !saveTradeUrlButton || !profileModal) {
        console.error("Profile modal Trade URL elements missing.");
        return;
    }

    const tradeUrl = tradeUrlInput.value.trim();

    // Validation (keep existing logic)
    if (!tradeUrl) {
        showNotification('Input Required: Please enter your Steam Trade URL.', 'error', 3000);
        return;
    }
    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/') ||
        !tradeUrl.includes('partner=') ||
        !tradeUrl.includes('token=')) {
        showNotification('Invalid Format: Please enter a valid Steam Trade URL including partner and token parameters.', 'error', 4000);
        return;
    }

    saveTradeUrlButton.disabled = true;
    saveTradeUrlButton.textContent = 'Saving...';

    try {
        const response = await fetch('/api/user/tradeurl', { // Use the same backend endpoint
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

        showNotification('Success: Trade URL saved.', 'success');
        // Optionally close the profile modal after saving, or keep it open
        // hideModal(profileModal);

    } catch (error) {
        showNotification(`Error Saving URL: ${error.message}`, 'error');
        console.error('Error updating trade URL from profile:', error);
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

    if (circle.tagName === 'circle' && circle.r?.baseVal?.value) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const progress = Math.min(1, Math.max(0, timeLeft / Math.max(1, totalTime)));
        const offset = circumference * (1 - progress);

        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${Math.max(0, offset)}`;
    } else {
        console.warn("timerForeground is not an SVG circle element or 'r' attribute is missing.");
    }
}


/**
 * Displays the latest deposit as a new block at the TOP of the participants container.
 * Manages the maximum number of visible deposit blocks.
 * @param {object} data - The participant update data from the socket event.
 */
function displayLatestDeposit(data) {
    const container = DOMElements.jackpot.participantsContainer;
    const emptyMsg = DOMElements.jackpot.emptyPotMessage;
    if (!container) return;

    if (!data || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue)) {
        console.error("Invalid data passed to displayLatestDeposit:", data);
        return;
    }

    const username = data.username || 'Unknown User';
    const avatar = data.avatar || '/img/default-avatar.png';
    const value = data.itemsValue;
    const items = data.depositedItems || [];
    const userColor = getUserColor(data.userId);

    const depositContainer = document.createElement('div');
    depositContainer.dataset.userId = data.userId;
    depositContainer.className = 'player-deposit-container player-deposit-new';

    const depositHeader = document.createElement('div');
    depositHeader.className = 'player-deposit-header';
    depositHeader.innerHTML = `
        <img src="${avatar}" alt="${username}" class="player-avatar" loading="lazy"
             onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor};">
        <div class="player-info">
            <div class="player-name" title="${username}">${username}</div>
            <div class="player-deposit-value" style="color: ${userColor}" title="Deposited Value: $${value.toFixed(2)}">$${value.toFixed(2)}</div>
        </div>`;

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';

    if (items.length > 0) {
        items.sort((a, b) => (b.price || 0) - (a.price || 0));
        const displayItems = items.slice(0, CONFIG.MAX_ITEMS_PER_DEPOSIT);

        displayItems.forEach(item => {
            if (!item || typeof item.price !== 'number' || isNaN(item.price) || !item.name || !item.image) {
                console.warn("Skipping invalid item in deposit display:", item);
                return;
            }

            const itemElement = document.createElement('div');
            itemElement.className = 'player-deposit-item';
            itemElement.title = `${item.name} ($${item.price.toFixed(2)})`;
            itemElement.style.borderColor = userColor;
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy"
                     onerror="this.onerror=null; this.src='/img/default-item.png';">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name" title="${item.name}">${item.name}</div>
                    <div class="player-deposit-item-value" style="color: ${userColor}">$${item.price.toFixed(2)}</div>
                </div>`;
            itemsGrid.appendChild(itemElement);
        });

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

    if (container.firstChild) {
        container.insertBefore(depositContainer, container.firstChild);
    } else {
        container.appendChild(depositContainer);
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    setTimeout(() => {
        depositContainer.classList.remove('player-deposit-new');
    }, 500);

    const currentDepositBlocks = container.querySelectorAll('.player-deposit-container');
    if (currentDepositBlocks.length > CONFIG.MAX_DISPLAY_DEPOSITS) {
        const blocksToRemove = currentDepositBlocks.length - CONFIG.MAX_DISPLAY_DEPOSITS;
        for (let i = 0; i < blocksToRemove; i++) {
            const oldestBlock = container.querySelector('.player-deposit-container:last-child');
            if (oldestBlock && oldestBlock !== depositContainer) {
                oldestBlock.style.transition = 'opacity 0.3s ease-out';
                oldestBlock.style.opacity = '0';
                setTimeout(() => {
                    if (oldestBlock.parentNode === container) {
                        oldestBlock.remove();
                    }
                }, 300);
            }
        }
    }
}


/**
 * Handles incoming participant update data from the server via Socket.IO.
 * Updates the local `currentRound` state and triggers UI updates.
 * @param {object} data - Data received from the 'participantUpdated' socket event.
 */
function handleNewDeposit(data) {
    if (!data || !data.roundId || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue) || data.totalValue === undefined || data.tickets === undefined) {
        console.error("Invalid participant update data received:", data);
        return;
    }
    if (!data.depositedItems) data.depositedItems = [];

    if (!currentRound) {
        currentRound = {
            roundId: data.roundId, status: 'active', timeLeft: CONFIG.ROUND_DURATION,
            totalValue: 0, participants: [], items: []
        };
        console.warn("Handling deposit for a non-existent local round. Initializing round.");
    } else if (currentRound.roundId !== data.roundId) {
        console.warn(`Deposit received for wrong round (${data.roundId}). Current is ${currentRound.roundId}. Ignoring.`);
        return;
    }

    if (!currentRound.participants) currentRound.participants = [];
    if (!currentRound.items) currentRound.items = [];

    let participantIndex = currentRound.participants.findIndex(p => p.user?.id === data.userId);

    if (participantIndex !== -1) {
        currentRound.participants[participantIndex] = {
            ...currentRound.participants[participantIndex],
            itemsValue: (currentRound.participants[participantIndex].itemsValue || 0) + data.itemsValue,
            tickets: data.tickets
        };
    } else {
        currentRound.participants.push({
            user: { id: data.userId, username: data.username || 'Unknown User', avatar: data.avatar || '/img/default-avatar.png' },
            itemsValue: data.itemsValue,
            tickets: data.tickets
        });
    }

    currentRound.totalValue = data.totalValue;

    data.depositedItems.forEach(item => {
        if (item && typeof item.price === 'number' && !isNaN(item.price)) {
            currentRound.items.push({ ...item, owner: data.userId });
        } else {
            console.warn("Skipping invalid item while adding to round master list:", item);
        }
    });

    updateRoundUI();
    displayLatestDeposit(data);
    updateDepositButtonState();

    if (currentRound.status === 'active' && currentRound.participants.length === 1 && !timerActive) {
        console.log("First participant joined. Starting client timer visually.");
        timerActive = true;
        startClientTimer(currentRound.timeLeft || CONFIG.ROUND_DURATION);
    }
}

/**
 * Updates ONLY the participant count display in the header and the empty pot message visibility.
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
    participantCount.textContent = `${participantNum}/${CONFIG.MAX_PARTICIPANTS_DISPLAY}`;

    const hasDepositBlocks = container.querySelector('.player-deposit-container') !== null;

    if (!hasDepositBlocks) {
        emptyMsg.style.display = 'block';
        if (!container.contains(emptyMsg)) container.appendChild(emptyMsg);
    } else {
        emptyMsg.style.display = 'none';
    }
}

/**
 * Function to test deposit display with mock data. Adds a new deposit block to the top.
 */
function testDeposit() {
    console.log("--- TESTING DEPOSIT DISPLAY (Adds to Top) ---");

    if (!currentRound) {
        currentRound = { roundId: 'test-round-123', status: 'active', totalValue: 0, participants: [], items: [] };
    } else {
        currentRound.status = 'active';
        if (!currentRound.participants) currentRound.participants = [];
        if (!currentRound.items) currentRound.items = [];
    }

    const randomValue = parseFloat((Math.random() * 50 + 1).toFixed(2));
    const mockUserId = `test_user_${Math.floor(Math.random() * 1000)}`;
    const mockUsername = ["RustPlayer99", "ScrapCollector", "AK47Master", "TheNaked", "ZergLeader", "TheRaider", "OilRigEnjoyer"][Math.floor(Math.random() * 7)];
    const mockAvatar = ['https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg', 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg', 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg', '/img/default-avatar.png'][Math.floor(Math.random() * 4)];

    let existingParticipant = currentRound.participants.find(p => p.user.id === mockUserId);
    let cumulativeTickets = 0;
    let cumulativeValue = 0;

    if (existingParticipant) {
        cumulativeValue = (existingParticipant.itemsValue || 0) + randomValue;
        cumulativeTickets = Math.max(1, Math.floor(cumulativeValue * 100));
    } else {
        cumulativeValue = randomValue;
        cumulativeTickets = Math.max(1, Math.floor(cumulativeValue * 100));
    }

    const mockDepositData = {
        roundId: currentRound.roundId, userId: mockUserId, username: mockUsername, avatar: mockAvatar,
        itemsValue: randomValue, tickets: cumulativeTickets,
        totalValue: (currentRound.totalValue || 0) + randomValue, depositedItems: []
    };

    const rustItemNames = ["Assault Rifle", "Metal Facemask", "Garage Door", "Semi-Automatic Rifle", "Road Sign Kilt", "Coffee Can Helmet", "Sheet Metal Door", "Medical Syringe", "MP5A4", "LR-300", "Bolt Action Rifle", "Satchel Charge", "Explosive Ammo", "High Quality Metal", "Crude Oil", "Tech Trash", "Scrap"];
    const numItems = Math.floor(Math.random() * 10) + 1;
    let remainingValue = mockDepositData.itemsValue;
    let accumulatedValue = 0;

    for (let i = 0; i < numItems; i++) {
        const isLastItem = i === numItems - 1;
        let itemValue;
        if (isLastItem) {
            itemValue = Math.max(0.01, remainingValue);
        } else {
            itemValue = parseFloat((Math.random() * remainingValue * 0.6 + 0.01).toFixed(2));
            itemValue = Math.min(itemValue, remainingValue - (numItems - 1 - i) * 0.01);
            itemValue = Math.max(0.01, itemValue);
        }
        remainingValue -= itemValue;
        accumulatedValue += itemValue;
        if (isLastItem && Math.abs(accumulatedValue - mockDepositData.itemsValue) > 0.001) {
            itemValue += (mockDepositData.itemsValue - accumulatedValue);
            itemValue = Math.max(0.01, parseFloat(itemValue.toFixed(2)));
        } else {
            itemValue = parseFloat(itemValue.toFixed(2));
        }
        mockDepositData.depositedItems.push({
            assetId: `test_asset_${Math.floor(Math.random() * 100000)}`,
            name: rustItemNames[Math.floor(Math.random() * rustItemNames.length)],
            image: `/img/default-item.png`,
            price: itemValue
        });
    }
    mockDepositData.itemsValue = mockDepositData.depositedItems.reduce((sum, item) => sum + item.price, 0);
    mockDepositData.totalValue = (currentRound.totalValue || 0) + mockDepositData.itemsValue;

    console.log("Mock Deposit Data:", mockDepositData);
    handleNewDeposit(mockDepositData);
}


/**
 * Starts the client-side countdown timer interval.
 * @param {number} [initialTime=CONFIG.ROUND_DURATION] - The time to start counting down from.
 */
function startClientTimer(initialTime = CONFIG.ROUND_DURATION) {
    const timerDisplay = DOMElements.jackpot.timerValue;
    if (!timerDisplay) return;

    if (roundTimer) clearInterval(roundTimer);

    let timeLeft = Math.max(0, initialTime);
    console.log(`Starting/Syncing client timer from ${timeLeft}s`);
    timerActive = true;
    updateTimerUI(timeLeft);
    updateDepositButtonState();

    roundTimer = setInterval(() => {
        if (!timerActive) {
            clearInterval(roundTimer);
            roundTimer = null;
            console.log("Client timer interval stopped (timerActive is false).");
            return;
        }
        timeLeft--;
        if (currentRound) currentRound.timeLeft = timeLeft;
        updateTimerUI(timeLeft);
        updateDepositButtonState();

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            timerActive = false;
            console.log("Client timer reached zero.");
            if(timerDisplay) timerDisplay.textContent = "0";
            updateDepositButtonState();
        }
    }, 1000);
}

// --- Roulette/Winner Animation Functions --- (Keep existing: createRouletteItems, handleWinnerAnnouncement, switchToRouletteView, startRouletteAnimation, handleRouletteSpinAnimation, finalizeSpin, handleSpinEnd, launchConfetti, clearConfetti, resetToJackpotView, initiateNewRoundVisualReset, findWinnerFromData, testRouletteAnimation)
// ... All Roulette/Winner functions from previous version ...


// --- Provably Fair Section Functions --- (Keep existing: verifyRound, loadPastRounds, populateVerificationFields, showRoundDetails, createPagination)
// ... All Provably Fair functions from previous version ...


// *** NEW: Profile Dropdown Functions ***

/**
 * Toggles the visibility of the profile dropdown menu.
 */
function toggleProfileDropdown() {
    const dropdown = DOMElements.user.profileDropdown;
    const profileArea = DOMElements.user.userProfileArea;
    if (!dropdown || !profileArea) return;

    isProfileDropdownOpen = !isProfileDropdownOpen;
    dropdown.classList.toggle('show', isProfileDropdownOpen);
    profileArea.classList.toggle('dropdown-open', isProfileDropdownOpen); // For caret rotation
}

/**
 * Closes the profile dropdown menu if it's open.
 */
function closeProfileDropdown() {
    const dropdown = DOMElements.user.profileDropdown;
    const profileArea = DOMElements.user.userProfileArea;
    if (isProfileDropdownOpen && dropdown && profileArea) {
        isProfileDropdownOpen = false;
        dropdown.classList.remove('show');
        profileArea.classList.remove('dropdown-open');
    }
}

/**
 * Handles the logout process initiated from the dropdown.
 */
async function handleLogout() {
    closeProfileDropdown(); // Close dropdown first
    console.log("Initiating logout...");
    try {
        const response = await fetch('/logout', { method: 'POST' });
        const result = await response.json();

        if (response.ok && result.success) {
            currentUser = null;
            updateUserUI(); // Show login button
            updateDepositButtonState(); // Disable deposit button
            showNotification('You have been logged out.', 'success');
            // Optionally redirect to home or refresh
            // window.location.href = '/';
        } else {
            throw new Error(result.error || 'Logout failed.');
        }
    } catch (error) {
        console.error('Logout Error:', error);
        showNotification(`Logout failed: ${error.message}`, 'error');
    }
}

/**
 * Fetches user statistics (deposited, won) from the backend.
 */
async function fetchUserStats() {
    if (!currentUser) return null; // Only fetch if logged in

    try {
        const response = await fetch('/api/user/stats');
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Failed to fetch stats (${response.status})`);
        }
        const stats = await response.json();
        return stats; // Returns { success: true, totalDeposited: number, totalWon: number }
    } catch (error) {
        console.error("Error fetching user stats:", error);
        showNotification(`Error loading stats: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Opens the profile modal, fetches stats, and populates the content.
 */
async function showProfileModal() {
    closeProfileDropdown(); // Close dropdown when opening modal
    if (!currentUser) {
        showNotification("Please log in to view your profile.", 'info');
        return;
    }

    const { profileModal, totalDepositedDisplay, totalWonDisplay, tradeUrlInput } = DOMElements.profile;
    if (!profileModal || !totalDepositedDisplay || !totalWonDisplay || !tradeUrlInput) {
        console.error("Profile modal elements missing.");
        return;
    }

    // Show loading state for stats
    totalDepositedDisplay.textContent = 'Loading...';
    totalWonDisplay.textContent = 'Loading...';

    // Populate Trade URL from current user data
    tradeUrlInput.value = currentUser.tradeUrl || '';

    showModal(profileModal); // Show modal immediately

    // Fetch stats
    const stats = await fetchUserStats();

    // Update stats display
    if (stats && stats.success) {
        totalDepositedDisplay.textContent = `$${(stats.totalDeposited || 0).toFixed(2)}`;
        totalWonDisplay.textContent = `$${(stats.totalWon || 0).toFixed(2)}`;
    } else {
        totalDepositedDisplay.textContent = '$?.??';
        totalWonDisplay.textContent = '$?.??';
        // Error notification is shown in fetchUserStats
    }
}


// --- Socket.IO Event Handlers ---
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        showNotification('Connected to server.', 'success', 2000);
        socket.emit('requestRoundData'); // Request current round state on connect
         // If user is logged in upon connection, maybe fetch their status too
        if (!currentUser) {
             checkLoginStatus();
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showNotification('Disconnected from server. Attempting to reconnect...', 'error', 5000);
        updateDepositButtonState();
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showNotification('Connection Error. Please refresh.', 'error', 10000);
        updateDepositButtonState();
    });

    // --- Round Lifecycle Events ---
    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        resetToJackpotView();
        updateRoundUI();
        updateDepositButtonState();
    });

    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            handleNewDeposit(data);
        } else if (!currentRound && data.roundId) {
            console.warn("Participant update for unknown round. Requesting full data.");
            socket.emit('requestRoundData');
        }
    });

    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false;
            if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
            if (DOMElements.jackpot.timerValue) DOMElements.jackpot.timerValue.textContent = "Rolling";
            if (DOMElements.jackpot.timerForeground) updateTimerCircle(0, CONFIG.ROUND_DURATION);
            currentRound.status = 'rolling';
            updateDepositButtonState();
        }
    });

    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            if (!currentRound.winner) currentRound.winner = data.winner;
            currentRound.status = 'rolling';
            handleWinnerAnnouncement(data);
        } else {
            console.warn("Received winner for mismatched round ID.");
        }
    });

    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            currentRound.status = 'completed';
            if(data.serverSeed) currentRound.serverSeed = data.serverSeed;
            if(data.clientSeed) currentRound.clientSeed = data.clientSeed;
        }
        updateDepositButtonState();
    });

    socket.on('roundError', (data) => {
        console.error('Round Error event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            currentRound.status = 'error';
            showNotification(`Round Error: ${data.error || 'An unknown error occurred.'}`, 'error');
            updateDepositButtonState();
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
        updateRoundUI();
        updateDepositButtonState();

        if (currentRound.status === 'rolling' || currentRound.status === 'completed') {
            if (!isSpinning && currentRound.winner) {
                console.log("Connected mid-round with winner known, triggering animation.");
                handleWinnerAnnouncement(currentRound);
            } else if (!isSpinning) {
                console.log("Connected after round ended or during rolling without winner yet. Resetting view.");
                resetToJackpotView();
            }
        } else if (currentRound.status === 'active') {
            if (currentRound.participants?.length >= 1 && currentRound.timeLeft > 0 && !timerActive) {
                console.log(`Received active round with ${currentRound.participants?.length} participants and ${currentRound.timeLeft}s left. Starting/syncing timer.`);
                timerActive = true;
                startClientTimer(currentRound.timeLeft || CONFIG.ROUND_DURATION);
            } else if (currentRound.timeLeft <= 0 && timerActive) {
                console.log("Server data indicates time is up, stopping client timer.");
                timerActive = false;
                if (roundTimer) clearInterval(roundTimer); roundTimer = null;
                updateTimerUI(0);
                updateDepositButtonState();
            } else if (currentRound.participants?.length === 0 && timerActive) {
                console.log("Server data indicates no participants, stopping client timer.");
                timerActive = false;
                if (roundTimer) clearInterval(roundTimer); roundTimer = null;
                updateTimerUI(CONFIG.ROUND_DURATION);
                updateDepositButtonState();
            }
        } else if (currentRound.status === 'pending') {
             console.log("Received pending round state.");
             initiateNewRoundVisualReset();
             if(DOMElements.jackpot.timerValue) DOMElements.jackpot.timerValue.textContent = "Waiting";
             updateDepositButtonState();
        }
    });

    // --- Other Events ---
    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent event received:', data);
        if (currentUser && data.userId === currentUser._id && data.offerId) {
            showNotification(`Trade Offer Sent (ID: ${data.offerId}): Check Steam for your winnings!`, 'success', 8000);
        }
    });

    socket.on('notification', (data) => {
        console.log('Notification received:', data);
        if (!data.userId || (currentUser && data.userId === currentUser._id)) {
             const type = data.type || 'info';
            const message = data.message || 'Notification from server.';
            showNotification(message, type, 6000);
        }
    });
}


// --- Event Listener Setup ---
function setupEventListeners() {
    // Navigation Links
    Object.entries(DOMElements.nav).forEach(([key, element]) => {
        const pageId = (key === 'homeLink') ? 'homePage' : key.replace('Link', 'Page');
        const pageElement = DOMElements.pages[pageId];
        if (element && pageElement) {
             element.addEventListener('click', (e) => {
                 e.preventDefault();
                 showPage(pageElement);
                 closeProfileDropdown();
             });
        }
    });

    // Login Button
    DOMElements.user.loginButton?.addEventListener('click', () => {
        window.location.href = '/auth/steam';
    });

    // --- Profile Dropdown Listeners ---
    DOMElements.user.userProfileArea?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileDropdown();
    });
    DOMElements.user.profileDropdownLink?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showProfileModal();
    });
    DOMElements.user.logoutButton?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleLogout();
    });

    // Deposit Modal Trigger Button
    DOMElements.deposit.showDepositModalButton?.addEventListener('click', () => {
        const button = DOMElements.deposit.showDepositModalButton;
        if (button.disabled) {
            showNotification(button.title || 'Deposits are currently closed.', 'info');
            return;
        }
        if (!currentUser) {
            showNotification('Login Required: Please log in first to deposit items.', 'error'); return;
        }
        if (!currentUser.tradeUrl) {
             // Show PROFILE modal if trade URL is missing
             showProfileModal();
             setTimeout(() => { // Delay notification slightly
                  showNotification("Please set your Trade URL in your profile before depositing.", "info", 5000);
             }, 200);
            return;
        }
        showModal(DOMElements.deposit.depositModal);
        loadUserInventory();
    });

    // Deposit Modal Close / Submit Buttons
    DOMElements.deposit.closeDepositModalButton?.addEventListener('click', () => hideModal(DOMElements.deposit.depositModal));
    DOMElements.deposit.depositButton?.addEventListener('click', submitDeposit);

    // Trade URL Modal (Initial prompt) Close / Submit Buttons
    DOMElements.tradeUrl.closeTradeUrlModalButton?.addEventListener('click', () => hideModal(DOMElements.tradeUrl.tradeUrlModal));
    DOMElements.tradeUrl.saveTradeUrlButton?.addEventListener('click', saveUserTradeUrl); // Keep this for the initial modal

    // Profile Modal Close / Submit Buttons
    DOMElements.profile.closeProfileModalButton?.addEventListener('click', () => hideModal(DOMElements.profile.profileModal));
    DOMElements.profile.saveTradeUrlButton?.addEventListener('click', saveUserTradeUrlFromProfile); // Use the new function

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
        ageAgreeButton.disabled = !ageCheckbox.checked;
    }

    // Test Buttons
    document.getElementById('testSpinButton')?.addEventListener('click', testRouletteAnimation);
    document.getElementById('testDepositButton')?.addEventListener('click', testDeposit);

    // Provably Fair Verify Button
    DOMElements.provablyFair.verifyButton?.addEventListener('click', verifyRound);

    // Modal/Dropdown Outside Click Listener
    window.addEventListener('click', (e) => {
        if (e.target === DOMElements.deposit.depositModal) hideModal(DOMElements.deposit.depositModal);
        if (e.target === DOMElements.tradeUrl.tradeUrlModal) hideModal(DOMElements.tradeUrl.tradeUrlModal);
        if (e.target === DOMElements.profile.profileModal) hideModal(DOMElements.profile.profileModal);

        const profileContainer = DOMElements.user.userProfileArea?.closest('.user-profile-container');
        if (isProfileDropdownOpen && profileContainer && !profileContainer.contains(e.target)) {
            closeProfileDropdown();
        }
    });

     // Keyboard Shortcut (Example: Spacebar for Test Spin - remove for production)
    document.addEventListener('keydown', function(event) {
        if (event.code === 'Space' &&
            DOMElements.pages.homePage?.style.display === 'block' &&
            !isSpinning &&
            !document.querySelector('.modal[style*="display: flex"]') &&
            !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName))
        {
            console.log("Spacebar pressed for test spin.");
            testRouletteAnimation();
            event.preventDefault();
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    if (DOMElements.ageVerification.modal && !localStorage.getItem('ageVerified')) {
        showModal(DOMElements.ageVerification.modal);
    }

    checkLoginStatus();
    setupEventListeners();
    setupSocketConnection();
    showPage(DOMElements.pages.homePage);
    initiateNewRoundVisualReset();
});

console.log("main.js loaded.");
`;

        // --- Canvas Drawing Logic ---
        const canvas = document.getElementById('codeCanvas');
        const ctx = canvas.getContext('2d');

        const lines = mainJsCode.trim().split('\n');
        const lineHeight = 16; // Adjust as needed
        const padding = 20;
        const font = '13px Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'; // Monospace font

        // Estimate canvas dimensions (may need adjustment)
        canvas.width = 1000; // Adjust width as needed
        canvas.height = (lines.length * lineHeight) + (2 * padding);

        // Set context styles
        ctx.fillStyle = '#333'; // Text color
        ctx.font = font;
        ctx.textBaseline = 'top';

        // Draw background (optional)
        // ctx.fillStyle = '#ffffff';
        // ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw lines
        let y = padding;
        lines.forEach(line => {
            // Replace leading spaces with non-breaking spaces for visual indentation
            // This is a basic approach; proper tab handling is more complex.
            const indentedLine = line.replace(/^ +/gm, match => '\u00A0'.repeat(match.length));
            ctx.fillText(indentedLine, padding, y);
            y += lineHeight;
        });

        console.log(`Drew ${lines.length} lines of code onto the canvas.`);

    </script>
</body>
</html>
