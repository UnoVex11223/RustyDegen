// main.js - Client-Side Logic (Enhanced)

/*=========================
  STATE & CONFIGURATION
=========================*/

// Configuration Constants (Should match server where applicable)
const ROUND_DURATION_SECONDS = parseInt(document.body.dataset.roundDuration || '99');
const TICKET_VALUE = parseFloat(document.body.dataset.ticketValue || '0.01');
const MIN_ITEM_VALUE = parseFloat(document.body.dataset.minItemValue || '0.10');
const MAX_ITEMS_PER_POT = parseInt(document.body.dataset.maxItemsPerPot || '200');
const MAX_PARTICIPANTS = parseInt(document.body.dataset.maxParticipants || '20');

// Application State
const state = {
    isLoggedIn: false,
    user: null, // { steamId, username, avatar, tradeUrl, ... }
    currentRound: null, // { roundId, status, participants, items, totalValue, timeLeft, ... }
    inventory: [], // User's Steam inventory items
    selectedItems: [], // Items selected for deposit
    currentTimerInterval: null,
    rouletteAnimationActive: false, // Flag to prevent concurrent animations
    roundHistory: {
        rounds: [],
        currentPage: 1,
        totalPages: 1,
        loading: false,
    },
    isAgeVerified: localStorage.getItem('isAgeVerified') === 'true', // Check local storage
    currentView: 'home', // 'home', 'about', 'roadmap', 'faq', 'fair'
    activeNotificationTimeout: null, // Timeout ID for notification bar
};

/*=========================
  DOM ELEMENTS CACHE
=========================*/
// Use a more structured approach for selecting elements
const elements = {
    // Navigation & User
    loginButton: document.getElementById('loginButton'),
    userProfile: document.getElementById('userProfile'),
    userName: document.getElementById('userName'),
    userAvatar: document.getElementById('userAvatar'),
    logoutButton: document.getElementById('logoutButton'),
    navLinks: document.querySelectorAll('nav a'), // All nav links
    primaryNavLinks: document.querySelectorAll('.primary-nav a, .main-nav a'), // For routing
    profileNavLinks: document.querySelectorAll('.secondary-nav a'), // For profile-related actions

    // Main Content Sections
    pages: {
        home: document.getElementById('home-page'),
        about: document.getElementById('about-page'),
        roadmap: document.getElementById('roadmap-page'),
        faq: document.getElementById('faq-page'),
        fair: document.getElementById('fair-page'),
    },
    // Jackpot Display
    jackpotHeader: document.querySelector('.jackpot-header'),
    potValueElement: document.getElementById('potValue'),
    itemCountElement: document.getElementById('itemCount'), // Now uses participant count
    timerElement: document.getElementById('timer'),
    timerCircleForeground: document.querySelector('.timer-foreground'),
    timerCircleBackground: document.querySelector('.timer-background'),
    timerCircleRadius: document.querySelector('.timer-foreground').r.baseVal.value,
    timerCircleCircumference: 2 * Math.PI * document.querySelector('.timer-foreground').r.baseVal.value,
    depositButton: document.getElementById('showDepositModal'),
    itemsContainer: document.getElementById('itemsContainer'), // Vertical list container
    emptyPotMessage: document.getElementById('emptyPotMessage'),
    testButtonsContainer: document.getElementById('testButtonsContainer'), // For test buttons

    // Modals
    ageVerificationModal: document.getElementById('ageVerificationModal'),
    confirmAgeButton: document.getElementById('confirmAge'),
    depositModal: document.getElementById('depositModal'),
    depositModalContent: document.getElementById('depositModal').querySelector('.modal-content'),
    closeDepositModalButton: document.getElementById('closeDepositModal'),
    tradeUrlModal: document.getElementById('tradeUrlModal'),
    closeTradeUrlModalButton: document.getElementById('closeTradeUrlModal'),
    tradeUrlForm: document.getElementById('tradeUrlForm'),
    tradeUrlInput: document.getElementById('tradeUrl'),
    saveTradeUrlButton: document.getElementById('saveTradeUrl'),
    tradeUrlHelp: document.getElementById('tradeUrlHelp'), // Added help link
    tradeUrlStatus: document.getElementById('tradeUrlStatus'), // Status message

    // Deposit Modal Specific
    inventoryContainer: document.getElementById('inventoryItems'),
    selectedItemsContainer: document.getElementById('selectedItemsContainer'),
    inventoryLoadingIndicator: document.getElementById('inventoryLoadingIndicator'),
    inventoryErrorMessage: document.getElementById('inventoryErrorMessage'),
    selectedTotalValueElement: document.getElementById('selectedTotalValue'),
    confirmDepositButton: document.getElementById('confirmDeposit'),
    depositStatus: document.getElementById('depositStatus'),

    // Round History (Fairness Page)
    roundHistoryTableBody: document.getElementById('roundHistoryTableBody'),
    historyLoadingMessage: document.getElementById('historyLoadingMessage'),
    historyErrorMessage: document.getElementById('historyErrorMessage'),
    noHistoryMessage: document.getElementById('noHistoryMessage'),
    paginationContainer: document.getElementById('paginationContainer'),

    // Verification Form (Fairness Page)
    verifyForm: document.getElementById('verifyForm'),
    verifyRoundIdInput: document.getElementById('verifyRoundId'),
    verifyServerSeedInput: document.getElementById('verifyServerSeed'),
    verifyClientSeedInput: document.getElementById('verifyClientSeed'),
    verificationResultContainer: document.getElementById('verificationResult'),

    // Roulette / Winner Display
    inlineRouletteContainer: document.getElementById('inlineRoulette'),
    rouletteTrack: document.getElementById('rouletteTrack'),
    rouletteTicker: document.querySelector('.roulette-ticker'), // The ticker line itself
    winnerInfoContainer: document.getElementById('winnerInfo'),
    winnerAvatar: document.getElementById('winnerAvatar'),
    winnerName: document.getElementById('winnerName'),
    winnerValue: document.getElementById('winnerValue'),
    winnerPercentage: document.getElementById('winnerPercentage'),
    winnerTicket: document.getElementById('winnerTicket'),
    confettiContainer: document.getElementById('confettiContainer'),

    // Notification Bar
    notificationBar: document.getElementById('notificationBar'),
};

/*=========================
  UTILITY FUNCTIONS
=========================*/

// Format currency
const formatCurrency = (value, decimals = 2) => {
    return `$${Number(value).toFixed(decimals)}`;
};

// Get Color based on item value/rarity (example implementation)
const rarityColors = {
    common: '#b0c3d9',     // Grey/White
    uncommon: '#5e98d9',   // Blue
    rare: '#4b69ff',       // Darker Blue
    mythical: '#8847ff',   // Purple
    legendary: '#d32ce6',  // Pink/Magenta
    ancient: '#eb4b4b',    // Red
    contraband: '#e4ae39'  // Gold/Orange (Example for highest tier)
};

function getColorByValue(price) {
    if (price >= 100) return rarityColors.contraband; // $100+
    if (price >= 50) return rarityColors.ancient;    // $50 - $99.99
    if (price >= 20) return rarityColors.legendary;   // $20 - $49.99
    if (price >= 10) return rarityColors.mythical;    // $10 - $19.99
    if (price >= 2) return rarityColors.rare;        // $2 - $9.99
    if (price >= 0.5) return rarityColors.uncommon;   // $0.50 - $1.99
    return rarityColors.common;                     // Below $0.50
}

// Basic Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show/Hide Element Helper
const showElement = (element) => {
    if (element) {
        element.style.display = element.tagName === 'TABLE' ? 'table' : (element.classList.contains('loading-indicator') || element.classList.contains('modal') ? 'flex' : 'block');
    }
};
const hideElement = (element) => {
    if (element) {
        element.style.display = 'none';
    }
};

// Throttle Function
function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function(...args) {
    const context = this;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  }
}

// Show Notification Bar
function showNotification(message, type = 'info', duration = 5000) {
    if (!elements.notificationBar) return;

    // Clear any existing timeout
    if (state.activeNotificationTimeout) {
        clearTimeout(state.activeNotificationTimeout);
        elements.notificationBar.classList.remove('show'); // Hide immediately if new one comes
    }

    elements.notificationBar.textContent = message;
    // Remove existing type classes, add new one
    elements.notificationBar.className = 'notification-bar'; // Reset classes
    elements.notificationBar.classList.add(type); // Add new type

    // Show the bar
    requestAnimationFrame(() => {
        elements.notificationBar.classList.add('show');
    });


    // Set timeout to hide
    state.activeNotificationTimeout = setTimeout(() => {
        elements.notificationBar.classList.remove('show');
        state.activeNotificationTimeout = null; // Clear the reference
    }, duration);
}


/*=========================
  API CALL FUNCTIONS
=========================*/

async function apiRequest(url, method = 'GET', body = null, requiresAuth = false) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        // Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            // Log specific auth errors for debugging, but show generic message to user
            if (response.status === 401 && requiresAuth) {
                 console.warn(`API Request 401 (Unauthorized) for URL: ${url}. Redirecting or showing login.`);
                 // Check if already redirecting or if it's a non-critical fetch
                 if (state.isLoggedIn) { // Only reset state if user thought they were logged in
                    resetUserState(); // Log out user state
                    // Optionally redirect to login or show a prominent login message
                    // window.location.href = '/auth/steam'; // Force re-login
                 }
                 throw new Error('Authentication required. Please log in.'); // More user-friendly
            }
            console.error(`API Request Error (${response.status}) for ${url}:`, errorData);
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        // Handle empty responses (e.g., 204 No Content)
        if (response.status === 204) {
            return null; // Return null or an empty object/array as appropriate
        }

        // Parse JSON response
        const data = await response.json();
        return data;

    } catch (error) {
        console.error(`API Request Failed for ${url}:`, error);
        // Rethrow the error so the calling function can handle it (e.g., showNotification)
        throw error;
    }
}

// --- Specific API Function Wrappers ---

async function fetchUserData() {
    try {
        const userData = await apiRequest('/api/user', 'GET', null, true); // Requires auth
        if (userData) {
            updateUserState(userData);
        } else {
            resetUserState();
        }
    } catch (error) {
         // API request handles 401, this catch handles other network/server errors
        console.error("Failed to fetch user data:", error.message);
        resetUserState(); // Assume logged out on error fetching user data
        // Don't show notification for initial fetch failure unless needed
    }
}

async function fetchInventory() {
    if (!state.isLoggedIn) return;
    showElement(elements.inventoryLoadingIndicator);
    hideElement(elements.inventoryErrorMessage);
    elements.inventoryContainer.innerHTML = ''; // Clear previous items

    try {
        const inventoryData = await apiRequest('/api/inventory', 'GET', null, true);
        state.inventory = inventoryData || [];
        renderInventory();
    } catch (error) {
        console.error("Failed to fetch inventory:", error.message);
        elements.inventoryErrorMessage.textContent = `Error loading inventory: ${error.message}. Ensure your Steam profile/inventory is public.`;
        showElement(elements.inventoryErrorMessage);
        state.inventory = []; // Clear inventory state on error
        renderInventory(); // Render the empty state/error
    } finally {
        hideElement(elements.inventoryLoadingIndicator);
    }
}

async function fetchRoundHistory(page = 1) {
    if (state.roundHistory.loading) return; // Prevent multiple simultaneous requests

    state.roundHistory.loading = true;
    showElement(elements.historyLoadingMessage);
    hideElement(elements.historyErrorMessage);
    hideElement(elements.noHistoryMessage);
    elements.roundHistoryTableBody.innerHTML = ''; // Clear table
    elements.paginationContainer.innerHTML = ''; // Clear pagination

    try {
        const data = await apiRequest(`/api/rounds?page=${page}&limit=10`, 'GET'); // Limit 10 per page
        if (data && data.rounds) {
            state.roundHistory.rounds = data.rounds;
            state.roundHistory.currentPage = data.currentPage;
            state.roundHistory.totalPages = data.totalPages;
            renderRoundHistory();
            renderPagination(data.totalPages, data.currentPage);
        } else {
            throw new Error("Invalid response format for round history.");
        }
    } catch (error) {
        console.error("Failed to fetch round history:", error.message);
        elements.historyErrorMessage.textContent = `Error loading round history: ${error.message}`;
        showElement(elements.historyErrorMessage);
    } finally {
        state.roundHistory.loading = false;
        hideElement(elements.historyLoadingMessage);
        if (state.roundHistory.rounds.length === 0 && !elements.historyErrorMessage.style.display !== 'none') {
             showElement(elements.noHistoryMessage);
        }
    }
}

async function initiateDeposit() {
    if (state.selectedItems.length === 0) {
        showNotification("Please select items to deposit.", "warning");
        return;
    }
    if (!state.user || !state.user.tradeUrl) {
        showNotification("Please set your Trade URL in your profile before depositing.", "error");
        openModal(elements.tradeUrlModal); // Prompt user to set trade URL
        return;
    }

    // --- Server-Side Limit Checks (Redundant but good practice) ---
    if (!state.currentRound || state.currentRound.status !== 'active') {
         showNotification("Deposits are currently closed.", "error");
         return;
    }
    if (state.currentRound.participants.length >= MAX_PARTICIPANTS) {
         showNotification(`Participant limit (${MAX_PARTICIPANTS}) reached.`, "error");
         return;
    }
     // Calculate potential new item count
    const currentPotItemCount = state.currentRound.items.length;
    if (currentPotItemCount + state.selectedItems.length > MAX_ITEMS_PER_POT) {
        showNotification(`Depositing these items would exceed the pot limit (${MAX_ITEMS_PER_POT} items). Please select fewer items.`, "error");
        return;
    }
    // --- End Server-Side Limit Checks ---

    elements.confirmDepositButton.disabled = true;
    elements.depositStatus.textContent = 'Initiating deposit... Please wait.';
    showElement(elements.depositStatus);

    try {
        // 1. Request Deposit Token and Bot URL from Server
        const initResponse = await apiRequest('/api/deposit/initiate', 'POST', {}, true); // Requires auth
        if (!initResponse || !initResponse.success || !initResponse.depositToken || !initResponse.botTradeUrl) {
            throw new Error('Failed to initiate deposit. Invalid server response.');
        }
        const { depositToken, botTradeUrl } = initResponse;

        // 2. Construct the Trade Offer URL
        // Important: Pass Asset IDs and Token in the URL parameters for the trade window
        const assetIdsParam = state.selectedItems.map(item => item.assetId).join(',');
        const fullTradeUrl = `${botTradeUrl}&message=${encodeURIComponent(depositToken)}&for_item_assetids=${assetIdsParam}`; // Example: Add assetids, may vary

        // 3. Open Trade Offer Window/Link
        // Option A: Redirect (Simpler, less SPA-friendly)
        // window.location.href = fullTradeUrl;

        // Option B: Open in new window/tab (Better user experience)
        const tradeWindow = window.open(fullTradeUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (!tradeWindow) {
             throw new Error('Could not open trade window. Please ensure pop-ups are allowed for this site.');
        }

        // 4. Update UI - Indicate waiting for confirmation
        elements.depositStatus.textContent = 'Please complete the trade offer in the new window. Waiting for confirmation...';
        showNotification('Trade offer window opened. Please confirm the deposit.', 'info', 10000); // Longer duration

        // Close the deposit modal after initiating
        closeModal(elements.depositModal);

        // No need to reset button/status here, as the modal is closed.
        // Socket events will handle the confirmation/update.

    } catch (error) {
        console.error("Deposit initiation failed:", error);
        showNotification(`Deposit Error: ${error.message}`, "error");
        elements.depositStatus.textContent = `Error: ${error.message}`;
        elements.confirmDepositButton.disabled = false; // Re-enable button on failure
    }
}


async function saveTradeUrl(tradeUrl) {
    elements.saveTradeUrlButton.disabled = true;
    elements.tradeUrlStatus.textContent = 'Saving...';
    showElement(elements.tradeUrlStatus);

    try {
        const response = await apiRequest('/api/user/tradeurl', 'POST', { tradeUrl }, true); // Requires auth
        if (response && response.success) {
            showNotification('Trade URL saved successfully!', 'success');
            // Update local user state
            if (state.user) {
                state.user.tradeUrl = response.tradeUrl;
            }
            elements.tradeUrlInput.value = response.tradeUrl; // Ensure input reflects saved value
            hideElement(elements.tradeUrlStatus);
            closeModal(elements.tradeUrlModal); // Close modal on success
        } else {
            throw new Error(response?.error || 'Failed to save Trade URL.');
        }
    } catch (error) {
        console.error("Failed to save Trade URL:", error);
        showNotification(`Error saving Trade URL: ${error.message}`, 'error');
        elements.tradeUrlStatus.textContent = `Error: ${error.message}`;
    } finally {
        elements.saveTradeUrlButton.disabled = false;
    }
}

async function performVerification() {
    const roundId = elements.verifyRoundIdInput.value.trim();
    const serverSeed = elements.verifyServerSeedInput.value.trim();
    const clientSeed = elements.verifyClientSeedInput.value.trim();
    const resultContainer = elements.verificationResultContainer;

    resultContainer.innerHTML = `<div class="loading-indicator" style="display: flex;"><div class="spinner"></div> Verifying...</div>`;
    resultContainer.className = 'verification-result loading'; // Apply loading style
    showElement(resultContainer);


    if (!roundId || !serverSeed || !clientSeed) {
        resultContainer.textContent = 'Please fill in all fields.';
        resultContainer.className = 'verification-result error';
        return;
    }
     // Basic client-side format check (optional but helpful)
    if (!/^\d+$/.test(roundId)) { resultContainer.textContent = 'Invalid Round ID format (must be a number).'; resultContainer.className = 'verification-result error'; return; }
    if (!/^[a-f0-9]{64}$/i.test(serverSeed)) { resultContainer.textContent = 'Invalid Server Seed format (must be 64 hex characters).'; resultContainer.className = 'verification-result error'; return; }


    try {
        const result = await apiRequest('/api/verify', 'POST', { roundId, serverSeed, clientSeed });

        if (result.verified) {
            resultContainer.className = 'verification-result success';
            resultContainer.innerHTML = `
                <h4>✅ Verification Successful!</h4>
                <p><strong>Round:</strong> #${result.roundId}</p>
                <p><strong>Server Seed:</strong> <code class="seed-value wrap-anywhere">${result.serverSeed}</code></p>
                <p><strong>Server Seed Hash (Verified):</strong> <code class="seed-value wrap-anywhere">${result.serverSeedHash}</code></p>
                <p><strong>Client Seed:</strong> <code class="seed-value wrap-anywhere">${result.clientSeed}</code></p>
                <p><strong>Combined Seed:</strong> <code class="seed-value wrap-anywhere">${result.combinedString}</code></p>
                <p><strong>Final SHA256 Hash:</strong> <code class="seed-value wrap-anywhere">${result.finalHash}</code></p>
                <p><strong>Total Tickets:</strong> ${result.totalTickets}</p>
                <p><strong>Winning Ticket Number (0 - ${result.totalTickets - 1}):</strong> ${result.winningTicket}</p>
                <p><strong>Winner:</strong> ${result.winnerUsername || 'N/A'}</p>
                 <p><strong>Pot Value (After Tax):</strong> ${formatCurrency(result.totalValue)}</p>
            `;
        } else {
            resultContainer.className = 'verification-result error';
            resultContainer.innerHTML = `
                <h4>❌ Verification Failed</h4>
                <p><strong>Reason:</strong> ${result.reason || 'Unknown error'}</p>
                ${result.calculatedTicket !== undefined ? `<p><strong>Calculated Ticket:</strong> ${result.calculatedTicket}</p>` : ''}
                ${result.actualWinningTicket !== undefined ? `<p><strong>Actual Winning Ticket:</strong> ${result.actualWinningTicket}</p>` : ''}
                ${result.serverSeedHash ? `<p><strong>Expected Server Hash:</strong> <code class="seed-value wrap-anywhere">${result.serverSeedHash}</code></p>` : ''}
                 ${result.serverSeed ? `<p><strong>Expected Server Seed:</strong> <code class="seed-value wrap-anywhere">${result.serverSeed}</code></p>` : ''}
                 ${result.clientSeed ? `<p><strong>Expected Client Seed:</strong> <code class="seed-value wrap-anywhere">${result.clientSeed}</code></p>` : ''}
            `;
        }
    } catch (error) {
        console.error("Verification request failed:", error);
        resultContainer.className = 'verification-result error';
        resultContainer.innerHTML = `<h4>❌ Verification Error</h4><p>${error.message}</p>`;
    }
}

/*=========================
  UI UPDATE FUNCTIONS
=========================*/

// Update User State & UI
function updateUserState(userData) {
    state.isLoggedIn = true;
    state.user = userData;
    // console.log("User logged in:", state.user); // Less verbose log

    hideElement(elements.loginButton);
    showElement(elements.userProfile);
    showElement(elements.logoutButton); // Ensure logout button is visible
    elements.userName.textContent = state.user.username;
    elements.userAvatar.src = state.user.avatar || '/img/default-avatar.png'; // Use a default avatar
    elements.userAvatar.alt = `${state.user.username}'s avatar`;

    // Show deposit button only if logged in
    if (elements.depositButton) showElement(elements.depositButton);

    // Update Trade URL input if modal is open or user navigates there
    elements.tradeUrlInput.value = state.user.tradeUrl || '';

    // Enable/disable buttons based on state
    updateDepositButtonState();

    // Fetch inventory after login confirmation
    fetchInventory();
}

// Reset User State & UI
function resetUserState() {
    state.isLoggedIn = false;
    state.user = null;
    state.inventory = [];
    state.selectedItems = [];
    // console.log("User logged out or session expired.");

    showElement(elements.loginButton);
    hideElement(elements.userProfile);
    hideElement(elements.logoutButton); // Hide logout button
    elements.userName.textContent = '';
    elements.userAvatar.src = '/img/default-avatar.png';
    elements.userAvatar.alt = 'Default avatar';

    // Hide deposit button if logged out
    if (elements.depositButton) hideElement(elements.depositButton);

    renderInventory(); // Clear inventory display
    updateSelectedItemsUI(); // Clear selected items display
    updateDepositButtonState(); // Disable deposit button
}

// Update Deposit Button based on login and round state
function updateDepositButtonState() {
    if (!elements.depositButton) return;
    const roundActive = state.currentRound?.status === 'active';
    const loggedIn = state.isLoggedIn;
    const participantLimitReached = state.currentRound?.participants?.length >= MAX_PARTICIPANTS;
    const itemLimitReached = state.currentRound?.items?.length >= MAX_ITEMS_PER_POT;

    if (loggedIn && roundActive && !participantLimitReached && !itemLimitReached) {
        elements.depositButton.disabled = false;
        elements.depositButton.title = ''; // Clear any previous title
    } else {
        elements.depositButton.disabled = true;
        if (!loggedIn) elements.depositButton.title = 'Please log in to deposit.';
        else if (!roundActive) elements.depositButton.title = 'Deposits are closed for this round.';
        else if (participantLimitReached) elements.depositButton.title = `Participant limit (${MAX_PARTICIPANTS}) reached.`;
        else if (itemLimitReached) elements.depositButton.title = `Pot item limit (${MAX_ITEMS_PER_POT}) reached.`;
        else elements.depositButton.title = 'Deposits currently unavailable.';
    }
}

// Update Timer Display
function updateTimerDisplay(timeLeft) {
    if (!elements.timerElement || !elements.timerCircleForeground || !elements.timerCircleBackground) return;

    // Ensure timeLeft is a non-negative number
    const validTimeLeft = Math.max(0, parseInt(timeLeft)) || 0;

    elements.timerElement.textContent = validTimeLeft;

    // Update circle progress
    const percentage = (validTimeLeft / ROUND_DURATION_SECONDS);
    const offset = state.currentTimerInterval ? elements.timerCircleCircumference * (1 - percentage) : elements.timerCircleCircumference; // Full circle if no timer

    elements.timerCircleForeground.style.strokeDasharray = `${elements.timerCircleCircumference}`;
    elements.timerCircleForeground.style.strokeDashoffset = offset;

    // Add pulsing effect when time is low
    elements.timerElement.classList.toggle('urgent-pulse', validTimeLeft <= 10 && validTimeLeft > 0);
    elements.timerCircleForeground.style.stroke = (validTimeLeft <= 10 && validTimeLeft > 0) ? 'var(--error-color)' : 'var(--primary-color)';
    elements.timerCircleForeground.style.filter = (validTimeLeft <= 10 && validTimeLeft > 0) ? 'drop-shadow(0 0 4px var(--error-color))' : 'drop-shadow(0 0 4px var(--primary-color))';

    // Ensure text color resets if pulse is removed
    if (validTimeLeft > 10) {
        elements.timerElement.classList.remove('urgent-pulse');
        elements.timerElement.style.color = ''; // Reset to CSS default
    }
}

// Start Round Timer Countdown
function startTimer(endTime) {
    if (!endTime) return; // Need an end time

    clearInterval(state.currentTimerInterval); // Clear any existing timer

    const calculateAndUpdate = () => {
        const now = Date.now();
        const end = new Date(endTime).getTime();
        const secondsLeft = Math.max(0, Math.floor((end - now) / 1000));

        if (state.currentRound) state.currentRound.timeLeft = secondsLeft; // Update state
        updateTimerDisplay(secondsLeft);

        if (secondsLeft <= 0) {
            clearInterval(state.currentTimerInterval);
            state.currentTimerInterval = null;
             // Server handles actual round end, client just stops timer display update
             // console.log("Client timer reached zero."); // Less verbose log
        }
    };

    calculateAndUpdate(); // Initial call
    state.currentTimerInterval = setInterval(calculateAndUpdate, 1000);
}


// Update Jackpot Header Display (Value, Participants)
function updateJackpotHeader(round) {
    if (!round || !elements.potValueElement || !elements.itemCountElement) return;

    elements.potValueElement.textContent = formatCurrency(round.totalValue || 0);
    elements.itemCountElement.textContent = round.participants?.length || 0; // Display participant count

    // Add subtle animation on value change
    elements.potValueElement.classList.add('value-update');
    setTimeout(() => elements.potValueElement.classList.remove('value-update'), 300); // Animation duration

    // Ensure correct timer state
    if (round.status === 'active' && round.endTime) {
        startTimer(round.endTime);
    } else if (round.status !== 'active' && state.currentTimerInterval) {
        clearInterval(state.currentTimerInterval);
        state.currentTimerInterval = null;
        updateTimerDisplay(0); // Show 0 if round not active
    } else if (round.status === 'active' && !round.endTime) {
        // Timer hasn't started (e.g., no participants yet)
        clearInterval(state.currentTimerInterval);
        state.currentTimerInterval = null;
        updateTimerDisplay(ROUND_DURATION_SECONDS); // Show full duration initially
    }

    // Update deposit button state based on participant/item count
    updateDepositButtonState();
}

// Render Player Deposits Vertically
function renderPlayerDeposits(round) {
    if (!elements.itemsContainer) return;

    elements.itemsContainer.innerHTML = ''; // Clear existing content

    if (!round || !round.participants || round.participants.length === 0) {
        showElement(elements.emptyPotMessage);
        return;
    }

    hideElement(elements.emptyPotMessage);

    // Create a map of user ID -> { user, totalValue, items }
    const participantData = {};
    round.participants.forEach(p => {
        if (!p.user || !p.user.steamId) return; // Skip if user data is missing
        if (!participantData[p.user.steamId]) {
            participantData[p.user.steamId] = {
                user: p.user,
                totalValue: 0,
                items: []
            };
        }
         // Accumulate value - p.itemsValue represents TOTAL value by user in round
        participantData[p.user.steamId].totalValue = p.itemsValue || 0;
    });

    // Assign items to the correct participant
    round.items.forEach(item => {
        if (item.owner && item.owner.steamId && participantData[item.owner.steamId]) {
            participantData[item.owner.steamId].items.push(item);
        } else {
            // Fallback: If owner mapping is tricky or missing, assign based on participant loop (less accurate)
            // Find the participant owning this item (might require matching owner ID)
             const ownerParticipant = round.participants.find(p => p.user?._id?.toString() === item.owner?.toString() || p.user?.steamId === item.owner?.steamId); // Try matching ID or steamId
             if(ownerParticipant?.user?.steamId && participantData[ownerParticipant.user.steamId]) {
                 participantData[ownerParticipant.user.steamId].items.push(item);
             } else {
                console.warn("Could not reliably map item to participant:", item);
             }
        }
    });

    // Sort participants by total value (descending) or join time (needs timestamp)
    // Sorting by value:
    const sortedParticipants = Object.values(participantData).sort((a, b) => b.totalValue - a.totalValue);
    // Note: Sorting by join time would require storing that timestamp per participant

    // Create and append deposit blocks for each participant
    sortedParticipants.forEach(data => {
        const playerColor = getColorByValue(data.totalValue / (data.items.length || 1)); // Average item value color? Or based on total value?

        const depositContainer = document.createElement('div');
        depositContainer.className = 'player-deposit-container';
        depositContainer.dataset.steamid = data.user.steamId; // Add identifier

        // Sort items within the participant's block by value (descending)
        const sortedItems = data.items.sort((a, b) => b.price - a.price);

        let itemsHTML = '';
        sortedItems.forEach(item => {
            const itemColor = getColorByValue(item.price);
            itemsHTML += `
                <div class="player-deposit-item" style="border-left-color: ${itemColor};">
                    <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image" loading="lazy">
                    <div class="player-deposit-item-info">
                        <span class="player-deposit-item-name" title="${item.name}">${item.name}</span>
                        <span class="player-deposit-item-value" style="color: ${itemColor};">${formatCurrency(item.price)}</span>
                    </div>
                </div>
            `;
        });

        depositContainer.innerHTML = `
            <div class="player-deposit-header">
                <img src="${data.user.avatar || '/img/default-avatar.png'}" alt="${data.user.username}'s avatar" class="player-avatar" style="border-color: ${playerColor};">
                <div class="player-info">
                    <span class="player-name">${data.user.username}</span>
                    <span class="player-deposit-value" style="color: ${playerColor};">Deposited: ${formatCurrency(data.totalValue)} (${data.items.length} Items)</span>
                </div>
            </div>
            <div class="player-items-grid">
                ${itemsHTML}
            </div>
        `;
        elements.itemsContainer.appendChild(depositContainer);
    });
}

// Update Round Display (Header, Timer, Items)
function updateRoundDisplay(roundData, isInitialLoad = false) {
    if (!roundData) {
         // Handle case where there's no active round (e.g., on initial load before first round)
        console.log("No active round data received.");
        state.currentRound = null;
        updateJackpotHeader({ totalValue: 0, participants: [] }); // Reset header
        renderPlayerDeposits(null); // Show empty pot message
        updateDepositButtonState();
        return;
    }

    // Store the new round data
    const previousRoundId = state.currentRound?.roundId;
    state.currentRound = roundData;


    // If it's a new round, reset relevant UI parts
    if (roundData.roundId !== previousRoundId && !isInitialLoad) {
        console.log(`--- New Round #${roundData.roundId} Started ---`);
        showNotification(`Round #${roundData.roundId} has started!`, 'info');
        // Reset any winner display / roulette if active
        resetRouletteDisplay();
        state.rouletteAnimationActive = false;
        elements.jackpotHeader.classList.remove('roulette-mode');
        // Clear items immediately for new round
        renderPlayerDeposits(roundData);
    }

    // Update Header (Value, Participants, Timer)
    updateJackpotHeader(roundData);

    // Render deposited items unless roulette is active
    if (!state.rouletteAnimationActive) {
        renderPlayerDeposits(roundData);
    }

    // Ensure deposit button state is correct
    updateDepositButtonState();
}


// Render User Inventory in Modal
function renderInventory() {
    if (!elements.inventoryContainer) return;
    elements.inventoryContainer.innerHTML = ''; // Clear first

    if (state.inventory.length === 0 && elements.inventoryErrorMessage.style.display === 'none') {
         elements.inventoryContainer.innerHTML = '<p class="empty-inventory-message">Your inventory is empty or no tradable Rust items found.</p>';
        return;
    } else if (state.inventory.length === 0) {
        return; // Error message is already shown by fetchInventory
    }

    state.inventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId;
        itemElement.dataset.price = item.price;
        // Check if item is already selected
        if (state.selectedItems.some(selected => selected.assetId === item.assetId)) {
            itemElement.classList.add('selected');
        }

        const itemColor = getColorByValue(item.price);

        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <div class="item-details">
                <span class="item-name" title="${item.name}">${item.name}</span>
                <span class="item-value" style="color: ${itemColor}">${formatCurrency(item.price)}</span>
            </div>
        `;

        // Add click listener for selection
        itemElement.addEventListener('click', () => toggleItemSelection(item, itemElement));

        elements.inventoryContainer.appendChild(itemElement);
    });
}

// Toggle Item Selection in Deposit Modal
function toggleItemSelection(item, itemElement) {
    const index = state.selectedItems.findIndex(selected => selected.assetId === item.assetId);
    const currentPotItemCount = state.currentRound?.items?.length || 0; // Get current pot items

    if (index > -1) {
        // Deselect item
        state.selectedItems.splice(index, 1);
        itemElement.classList.remove('selected');
    } else {
         // Check against MAX_ITEMS_PER_POT considering items already in pot
        if (currentPotItemCount + state.selectedItems.length >= MAX_ITEMS_PER_POT) {
             showNotification(`Cannot add more items. Pot limit (${MAX_ITEMS_PER_POT}) will be reached.`, "warning");
             return; // Prevent selecting more items
        }

        // Select item
        if (item.price >= MIN_ITEM_VALUE) {
            state.selectedItems.push(item);
            itemElement.classList.add('selected');
        } else {
            showNotification(`Item value (${formatCurrency(item.price)}) is below the minimum deposit value (${formatCurrency(MIN_ITEM_VALUE)}).`, "warning");
        }
    }
    updateSelectedItemsUI();
}

// Update Selected Items Display and Total Value
function updateSelectedItemsUI() {
    if (!elements.selectedItemsContainer || !elements.selectedTotalValueElement) return;

    elements.selectedItemsContainer.innerHTML = ''; // Clear current selection
    let totalValue = 0;

    if (state.selectedItems.length === 0) {
        elements.selectedItemsContainer.innerHTML = '<p class="empty-inventory-message" style="font-size: 0.9em; padding: 10px;">No items selected.</p>';
    } else {
        state.selectedItems.forEach(item => {
            totalValue += item.price;
            const selectedItemElement = document.createElement('div');
            selectedItemElement.className = 'selected-item';
            selectedItemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <div class="selected-item-details">
                     <span class="selected-item-value">${formatCurrency(item.price)}</span>
                 </div>
                <button class="remove-item" data-asset-id="${item.assetId}" aria-label="Remove ${item.name}">&times;</button>
            `;
             // Add event listener to the remove button
            selectedItemElement.querySelector('.remove-item').addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent triggering item toggle
                 const assetId = e.target.dataset.assetId;
                 const itemToRemove = state.inventory.find(invItem => invItem.assetId === assetId);
                 const elementToRemove = elements.inventoryContainer.querySelector(`.inventory-item[data-asset-id="${assetId}"]`);
                 if(itemToRemove && elementToRemove) {
                     toggleItemSelection(itemToRemove, elementToRemove); // Deselect
                 }
            });
            elements.selectedItemsContainer.appendChild(selectedItemElement);
        });
    }

    // Update total value display
    elements.selectedTotalValueElement.textContent = formatCurrency(totalValue);

    // Enable/Disable Confirm Deposit button
    elements.confirmDepositButton.disabled = state.selectedItems.length === 0;
}

// Render Round History Table
function renderRoundHistory() {
    const tableBody = elements.roundHistoryTableBody;
    if (!tableBody) return;
    tableBody.innerHTML = ''; // Clear previous entries

    if (state.roundHistory.rounds.length === 0) {
        // Message handled by fetch function (noHistoryMessage)
        return;
    }

    state.roundHistory.rounds.forEach(round => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>#${round.roundId}</td>
            <td>${formatCurrency(round.totalValue)} ${round.taxAmount > 0 ? `<span style="color: var(--error-color); font-size: 0.8em;">(-${formatCurrency(round.taxAmount)} tax)</span>` : ''}</td>
            <td>${round.winner ? `<img src="${round.winner.avatar || '/img/default-avatar.png'}" alt="${round.winner.username}" width="24" height="24" style="vertical-align: middle; border-radius: 50%; margin-right: 5px;"> ${round.winner.username}` : 'N/A'}</td>
            <td>${new Date(round.completedTime || round.endTime).toLocaleString()}</td>
             <td>
                 <button class="btn btn-secondary btn-details" data-round-id="${round.roundId}">Details</button>
                <button class="btn btn-verify btn-verify-history" data-round-id="${round.roundId}" data-server-seed="${round.serverSeed || ''}" data-client-seed="${round.clientSeed || ''}">Verify</button>
            </td>
        `;
    });
}


// Render Pagination Controls
function renderPagination(totalPages, currentPage) {
    const container = elements.paginationContainer;
    if (!container) return;
    container.innerHTML = ''; // Clear existing pagination

    if (totalPages <= 1) return; // No pagination needed for 1 page

    const maxPagesToShow = 5; // Max number of page buttons (excluding prev/next)

    // Helper function to create a button
    const createButton = (text, page, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.className = 'page-button';
        button.textContent = text;
        button.dataset.page = page;
        button.disabled = isDisabled;
        if (isActive) button.classList.add('active');
        button.addEventListener('click', () => fetchRoundHistory(page));
        return button;
    };

    // Previous Button
    container.appendChild(createButton('« Prev', currentPage - 1, currentPage === 1));

    // Page Number Buttons (with Ellipsis)
    let startPage, endPage;
    if (totalPages <= maxPagesToShow) {
        startPage = 1;
        endPage = totalPages;
    } else {
        const maxPagesBeforeCurrent = Math.floor((maxPagesToShow - 1) / 2);
        const maxPagesAfterCurrent = Math.ceil((maxPagesToShow - 1) / 2);

        if (currentPage <= maxPagesBeforeCurrent) {
            startPage = 1;
            endPage = maxPagesToShow;
        } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
            startPage = totalPages - maxPagesToShow + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrent;
            endPage = currentPage + maxPagesAfterCurrent;
        }
    }

    if (startPage > 1) {
        container.appendChild(createButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            container.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        container.appendChild(createButton(i, i, false, i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
             const ellipsis = document.createElement('span');
             ellipsis.className = 'page-ellipsis';
             ellipsis.textContent = '...';
             container.appendChild(ellipsis);
        }
        container.appendChild(createButton(totalPages, totalPages));
    }


    // Next Button
    container.appendChild(createButton('Next »', currentPage + 1, currentPage === totalPages));
}

/*=========================
  MODAL HANDLING
=========================*/

function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        // Trigger reflow to ensure transition plays
        modalElement.offsetHeight;
        if (modalElement.querySelector('.modal-content')) {
             modalElement.querySelector('.modal-content').style.animation = 'modalIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        }
    }
}

function closeModal(modalElement) {
    if (modalElement && modalElement.querySelector('.modal-content')) {
        const content = modalElement.querySelector('.modal-content');
        // Reverse animation (optional, but smoother)
        content.style.animation = 'modalOut 0.3s ease forwards'; // Define modalOut animation in CSS if desired
         // Hide modal after animation
        setTimeout(() => {
             modalElement.style.display = 'none';
             content.style.animation = ''; // Reset animation property
             // Reset deposit modal state when closed
             if (modalElement === elements.depositModal) {
                 resetDepositModal();
             }
             // Reset trade URL modal state
             if (modalElement === elements.tradeUrlModal) {
                  hideElement(elements.tradeUrlStatus);
                  elements.tradeUrlStatus.textContent = '';
                  elements.saveTradeUrlButton.disabled = false;
                  // Optionally clear the input or keep it as is:
                  // elements.tradeUrlInput.value = state.user?.tradeUrl || '';
             }
        }, 300); // Match animation duration
    } else if (modalElement) {
         modalElement.style.display = 'none'; // Hide immediately if no content/animation
    }
}

// Reset Deposit Modal State
function resetDepositModal() {
    state.selectedItems = [];
    updateSelectedItemsUI(); // Clear selection display and total
    elements.inventoryContainer.innerHTML = ''; // Clear inventory display
    hideElement(elements.inventoryLoadingIndicator);
    hideElement(elements.inventoryErrorMessage);
    hideElement(elements.depositStatus);
    elements.confirmDepositButton.disabled = true; // Disable confirm button initially
    elements.depositStatus.textContent = '';
    // Unselect items in the inventory display (if rendered)
    elements.inventoryContainer.querySelectorAll('.inventory-item.selected')
        .forEach(el => el.classList.remove('selected'));
}

/*=========================
  ROULETTE ANIMATION & WINNER DISPLAY
=========================*/
function buildRouletteTrack(participants) {
    if (!elements.rouletteTrack || !participants || participants.length === 0) {
        console.warn("Cannot build roulette: Track element or participants missing.");
        return []; // Return empty array if no participants
    }

    elements.rouletteTrack.innerHTML = ''; // Clear previous track
    const trackItems = [];

    // 1. Calculate total value and individual percentages
    const totalPotValue = participants.reduce((sum, p) => sum + p.itemsValue, 0);
    if (totalPotValue <= 0) return []; // Avoid division by zero

    const participantPercentages = participants.map(p => ({
        ...p,
        percentage: (p.itemsValue / totalPotValue) * 100
    }));

    // 2. Determine number of slots per participant (proportional to percentage)
    const totalSlots = 150; // Increase for smoother/longer spin, adjust as needed
    let slotsData = [];
    participantPercentages.forEach(p => {
        const numSlots = Math.max(1, Math.round((p.percentage / 100) * totalSlots)); // Ensure at least 1 slot
        for (let i = 0; i < numSlots; i++) {
            slotsData.push({
                userId: p.user._id, // Use MongoDB ID
                steamId: p.user.steamId,
                username: p.user.username,
                avatar: p.user.avatar,
                value: p.itemsValue,
                percentage: p.percentage,
                color: getColorByValue(p.itemsValue / (p.items?.length || 1)) // Example color logic
            });
        }
    });

    // 3. Shuffle the slots array thoroughly (Fisher-Yates Algorithm)
    for (let i = slotsData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slotsData[i], slotsData[j]] = [slotsData[j], slotsData[i]];
    }

    // 4. Create HTML elements for the shuffled slots
    slotsData.forEach((slot, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'roulette-item';
        itemElement.dataset.steamid = slot.steamId;
        itemElement.dataset.index = index; // Store original shuffled index
        // Apply color border based on participant's value/color
        itemElement.style.borderColor = slot.color;

        itemElement.innerHTML = `
            <div class="profile-pic-container">
                <img src="${slot.avatar || '/img/default-avatar.png'}" alt="${slot.username}" class="roulette-avatar" loading="lazy">
            </div>
            <div class="roulette-info" style="border-top-color: ${slot.color};">
                 <span class="roulette-name" title="${slot.username}">${slot.username}</span>
                 <span class="roulette-percentage" style="color: ${slot.color};">${slot.percentage.toFixed(1)}%</span>
            </div>
        `;
        elements.rouletteTrack.appendChild(itemElement);
        trackItems.push(itemElement); // Keep reference if needed later
    });

    return slotsData; // Return the shuffled slot data array
}

function calculateWinningIndex(shuffledSlots, winningTicket, totalTickets) {
    if (!shuffledSlots || shuffledSlots.length === 0 || totalTickets <= 0) return -1;

    // This approach assumes the shuffledSlots array directly represents the visual order.
    // The server determines the *winning ticket number*. We need to map this number
    // back to the visual index in our shuffled `slotsData`.

    // The server calculation: winningTicket = hash % totalTickets
    // The client needs to find which item in the shuffled visual list corresponds
    // to this logical ticket number.

    // A simpler client-side approach (if server provides winner's steamId):
    // Find the *first* slot in the shuffledSlots array that belongs to the winner.
    // This isn't truly random based on the ticket number but visually selects a winner's slot.

    // --> More accurate approach: Simulate the server's ticket assignment logic
    //     on the *original* (unshuffled) participant data.

    const originalParticipants = state.currentRound?.participants || [];
    if (originalParticipants.length === 0) return -1;

    let cumulativeTickets = 0;
    let winnerData = null;

    // Find the participant who owns the winning ticket number
    for (const participant of originalParticipants) {
        if (!participant || !participant.user || !participant.tickets) continue;
        cumulativeTickets += participant.tickets;
        if (winningTicket < cumulativeTickets) {
            winnerData = participant; // Found the winning participant
            break;
        }
    }

    if (!winnerData) {
        console.error("Could not determine winner from ticket number.");
        return Math.floor(Math.random() * shuffledSlots.length); // Fallback: random index
    }

    // Now, find the index of an item belonging to this winner *within the shuffledSlots array*.
    // We need to land the ticker on one of this winner's slots.
    const winnerSteamId = winnerData.user.steamId;
    const winnerIndices = shuffledSlots
        .map((slot, index) => (slot.steamId === winnerSteamId ? index : -1))
        .filter(index => index !== -1);

    if (winnerIndices.length === 0) {
         console.error(`No slots found for winner ${winnerData.user.username} in shuffled track.`);
         return Math.floor(Math.random() * shuffledSlots.length); // Fallback: random index
    }

    // Choose a random index from the winner's available slots in the shuffled track
    const randomIndexInWinners = Math.floor(Math.random() * winnerIndices.length);
    const targetIndex = winnerIndices[randomIndexInWinners];

    // console.log(`Targeting index ${targetIndex} (User: ${winnerData.user.username}, Ticket: ${winningTicket}/${totalTickets})`); // Less verbose

    return targetIndex;
}


function spinRoulette(winnerData, winningTicket, totalTickets) {
    if (state.rouletteAnimationActive || !state.currentRound?.participants) {
        console.warn("Cannot spin roulette: Animation active or no participants.");
        return;
    }
    state.rouletteAnimationActive = true;
    hideElement(elements.depositButton); // Hide deposit button during spin
    hideElement(elements.testButtonsContainer); // Hide test buttons
    elements.jackpotHeader.classList.add('roulette-mode'); // Optional: Style header during spin

    const shuffledSlots = buildRouletteTrack(state.currentRound.participants); // Build/Shuffle the track
    if (shuffledSlots.length === 0) {
        console.error("Spin failed: No slots generated.");
        state.rouletteAnimationActive = false;
        resetRouletteDisplay(); // Reset UI if build fails
        return;
    }

    const targetIndex = calculateWinningIndex(shuffledSlots, winningTicket, totalTickets);
    if (targetIndex === -1) {
         console.error("Spin failed: Could not determine target index.");
         state.rouletteAnimationActive = false;
         resetRouletteDisplay();
         return;
    }

    const itemWidth = 90 + 10; // Item width (90) + margin (10)
    const trackElement = elements.rouletteTrack;
    const containerWidth = elements.rouletteContainer.offsetWidth;

    // Calculate target position: Center the *middle* of the target item under the ticker
    // Ticker is at 50% of container width.
    // Target item's left edge position = targetIndex * itemWidth
    // Target item's center position = targetIndex * itemWidth + itemWidth / 2
    // We want this center position to align with the container's center (containerWidth / 2)
    // Required translateX = (containerWidth / 2) - (targetIndex * itemWidth + itemWidth / 2)
    let targetX = (containerWidth / 2) - (targetIndex * itemWidth + itemWidth / 2);

    // Add random offset within the winning item's bounds for variability
    const randomOffset = (Math.random() - 0.5) * (itemWidth * 0.6); // Random offset up to +/- 30% of item width
    targetX += randomOffset;

    // Ensure targetX doesn't go beyond track bounds (optional, but good practice)
    const minX = 0; // Cannot translate further left than the start
    const maxX = containerWidth - (shuffledSlots.length * itemWidth); // Max left translation
    targetX = Math.max(maxX, Math.min(minX, targetX)); // Clamp translation


    // Show roulette and hide header elements visually
    showElement(elements.inlineRouletteContainer);
    elements.inlineRouletteContainer.style.opacity = '1';


    // --- Animation ---
    const spinDuration = 8000; // milliseconds (e.g., 8 seconds)
    const easeOutCubic = t => (--t)*t*t+1; // Ease-out function

    // Reset transform before starting animation
    trackElement.style.transition = 'none';
    trackElement.style.transform = `translateX(${containerWidth / 2 - itemWidth / 2}px)`; // Start centered roughly

    // Force reflow/repaint before applying transition
    trackElement.offsetHeight;

    // Apply the animation transition
    trackElement.style.transition = `transform ${spinDuration}ms cubic-bezier(0.33, 1, 0.68, 1)`; // Smooth ease-out curve
    trackElement.style.transform = `translateX(${targetX}px)`;

    // Play spin sound (if you have one)
    // playSound('rouletteSpin');

    // After animation ends:
    setTimeout(() => {
        // console.log("Spin finished."); // Less verbose log
        finalizeSpin(winnerData, targetIndex, shuffledSlots); // Pass winner data and target slot
        // Play win sound
        // playSound('rouletteWin');
    }, spinDuration + 100); // Add slight buffer
}


function finalizeSpin(winner, winningSlotIndex, slotsData) {
    // 1. Highlight Winner in Track (Optional)
    const winningElement = elements.rouletteTrack.querySelector(`[data-index="${winningSlotIndex}"]`);
    if (winningElement) {
        winningElement.style.transition = 'all 0.5s ease';
        winningElement.style.transform = 'scale(1.1)';
        winningElement.style.boxShadow = `0 0 25px ${winner.color || 'var(--primary-color)'}`;
        winningElement.style.zIndex = '10'; // Bring to front
    }

    // 2. Prepare Winner Info Box
    const winnerSlotData = slotsData[winningSlotIndex]; // Get data for the landed slot
    if (!winnerSlotData) {
        console.error("Could not get winner slot data for finalization.");
        resetRouletteDisplay(); // Attempt to reset
        state.rouletteAnimationActive = false;
        return;
    }
    // Use the overall winner data passed from the server event for accuracy
    const winnerUser = state.currentRound?.participants?.find(p => p.user?._id === winner._id)?.user;
    const winnerPotValue = state.currentRound?.participants?.find(p => p.user?._id === winner._id)?.itemsValue || 0;
    const winnerPercentage = state.currentRound?.totalValue > 0 ? (winnerPotValue / state.currentRound?.totalValue) * 100 : 0;

    elements.winnerAvatar.src = winnerUser?.avatar || winnerSlotData.avatar || '/img/default-avatar.png';
    elements.winnerName.textContent = winnerUser?.username || winnerSlotData.username;
    elements.winnerValue.textContent = formatCurrency(winnerPotValue);
    elements.winnerPercentage.textContent = `(${winnerPercentage.toFixed(2)}%)`;
    elements.winnerTicket.textContent = state.currentRound?.winningTicket ?? 'N/A';

    // Use winner's representative color
    const winnerColor = winnerSlotData.color || 'var(--primary-color)';
    elements.winnerAvatar.style.borderColor = winnerColor;
    elements.winnerName.style.color = winnerColor;
    elements.winnerPercentage.style.color = winnerColor;


    // 3. Show Winner Info Box with Fade-in Animation
    elements.winnerInfoContainer.style.opacity = '0';
    elements.winnerInfoContainer.style.display = 'flex';
    requestAnimationFrame(() => {
        elements.winnerInfoContainer.style.transition = 'opacity 0.8s ease 0.2s'; // Delay fade-in slightly
        elements.winnerInfoContainer.style.opacity = '1';
        elements.winnerInfoContainer.style.animation = 'fadeIn 0.8s ease forwards'; // Add scale effect too
    });


    // 4. Trigger Confetti
    triggerConfetti(winnerColor);

    // 5. Schedule Reset (after a few seconds)
    setTimeout(() => {
        resetRouletteDisplay();
        state.rouletteAnimationActive = false; // Allow next spin/updates
        // Next round will be triggered by server `roundCreated` event
    }, 8000); // Show winner info for 8 seconds
}


function resetRouletteDisplay() {
    // Hide roulette container and winner info
    elements.inlineRouletteContainer.style.opacity = '0';
    hideElement(elements.winnerInfoContainer);
    elements.winnerInfoContainer.style.animation = ''; // Reset animation
    // Clear confetti
    elements.confettiContainer.innerHTML = '';

    // Reset track position and clear items
    elements.rouletteTrack.style.transition = 'none';
    elements.rouletteTrack.style.transform = 'translateX(0)';
    elements.rouletteTrack.innerHTML = '';

    // Restore header elements
    elements.jackpotHeader.classList.remove('roulette-mode');
    showElement(elements.depositButton);
    showElement(elements.testButtonsContainer); // Show test buttons if needed
    updateDepositButtonState(); // Ensure deposit button state is correct
}

/*=========================
  CONFETTI EFFECT
=========================*/
function triggerConfetti(baseColor = 'var(--primary-color)') {
    const container = elements.confettiContainer;
    if (!container) return;
    container.innerHTML = ''; // Clear old confetti

    const colors = [
        baseColor,
        '#FFD700', // Gold
        '#FF69B4', // Hot Pink
        '#00BFFF', // Deep Sky Blue
        '#ADFF2F', // Green Yellow
        '#FFA500', // Orange
        '#FFFFFF'  // White
    ];

    const confettiCount = 150; // Number of confetti particles

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');

        // Assign random properties using CSS variables
        confetti.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
        const startX = Math.random() * 100; // Start position %
        const fallX = (Math.random() - 0.5) * 200; // Horizontal drift px
        const delay = Math.random() * 1.5; // Delay start (0 to 1.5s)
        const duration = 2 + Math.random() * 3; // Duration (2 to 5s)
        const rotationStart = Math.random() * 360;
        const rotationEnd = rotationStart + (Math.random() - 0.5) * 1080; // Random end rotation
        const size = 5 + Math.random() * 8; // Size (5px to 13px)

        confetti.style.left = `${startX}%`;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.setProperty('--fall-x', `${fallX}px`);
        confetti.style.setProperty('--delay', `${delay}s`);
        confetti.style.setProperty('--duration', `${duration}s`);
        confetti.style.setProperty('--rotation-start', `${rotationStart}deg`);
        confetti.style.setProperty('--rotation-end', `${rotationEnd}deg`);

        container.appendChild(confetti);
    }
}


/*=========================
  SOCKET.IO EVENT HANDLING
=========================*/

const socket = io(); // Connect to the server

socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    // Request initial round data once connected
    socket.emit('requestRoundData');
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    showNotification('Connection lost. Attempting to reconnect...', 'error', 10000);
});

socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason !== 'io client disconnect') { // Don't show if user manually logs out/closes
        showNotification('Disconnected. Attempting to reconnect...', 'warning', 10000);
    }
    // Optionally clear timer, reset state if connection is lost unexpectedly
    clearInterval(state.currentTimerInterval);
    state.currentTimerInterval = null;
});


// Handle Initial Round Data / Updates
socket.on('roundData', (roundData) => {
    // console.log('Received roundData:', roundData); // Less verbose log
    updateRoundDisplay(roundData, !state.currentRound); // isInitialLoad if no round exists yet
});

socket.on('noActiveRound', () => {
     console.log("Received 'noActiveRound' event.");
     updateRoundDisplay(null); // Explicitly handle the case of no active round
});

socket.on('roundCreated', (newRound) => {
    console.log(`Event: roundCreated (ID: ${newRound.roundId})`);
    updateRoundDisplay(newRound); // Update UI with the new round
});

socket.on('timerUpdate', ({ timeLeft }) => {
    // Only update display if timer interval isn't already running locally
    // Or, always trust server - simpler:
    // if (state.currentRound) state.currentRound.timeLeft = timeLeft; // Update state silently
    // updateTimerDisplay(timeLeft); // Update visual timer
    // Let startTimer handle the countdown locally for smoother visuals
});

socket.on('participantUpdated', (update) => {
     console.log(`Event: participantUpdated (User: ${update.username}, Value: ${formatCurrency(update.itemsValue)})`);
     // Avoid full re-render if roulette is active
    if (state.rouletteAnimationActive) return;

    // More efficient update: Find or add participant block, update items/value
    if (state.currentRound && state.currentRound.roundId === update.roundId) {
        // Update the state first (find/update participant, add items, update total value)
        let participant = state.currentRound.participants.find(p => p.user?._id === update.userId);
        if (!participant) {
            // Add new participant to state
            participant = {
                user: { _id: update.userId, username: update.username, avatar: update.avatar, steamId: null }, // Need steamId if possible
                itemsValue: update.itemsValue,
                tickets: update.tickets,
                // items: update.depositedItems.map(i => ({ ...i, owner: update.userId })) // Map items to basic structure
            };
             state.currentRound.participants.push(participant);
        } else {
             // Update existing participant state
             participant.itemsValue += update.itemsValue; // Increment value
             participant.tickets = update.tickets; // Update total tickets
             // Add new items to participant's items (if tracked in detail)
        }

        // Add deposited items to the main round items list in state
        if(update.depositedItems) {
            const itemsToAdd = update.depositedItems.map(i => ({...i, owner: { _id: update.userId, username: update.username, avatar: update.avatar }})); // Add owner info
            state.currentRound.items.push(...itemsToAdd);
        }

        // Update total value
        state.currentRound.totalValue = update.totalValue;

        // Re-render the header and items list
        updateJackpotHeader(state.currentRound);
        renderPlayerDeposits(state.currentRound); // Re-render the list
         // Add highlight effect to the updated/new participant's block
        const participantBlock = elements.itemsContainer.querySelector(`.player-deposit-container[data-steamid="${participant.user?.steamId || ''}"]`); // Requires steamid on block
         if (participantBlock) {
              participantBlock.classList.add('player-deposit-new'); // Apply animation class
              setTimeout(() => participantBlock.classList.remove('player-deposit-new'), 1000); // Remove after animation
         }

        // Start timer if this was the first participant (check local state)
        if (state.currentRound.participants.length === 1 && !state.currentTimerInterval) {
            console.log("First participant joined. Starting timer via socket event.");
            if(state.currentRound.endTime) { startTimer(state.currentRound.endTime); }
            else { console.warn("Timer start requested but round has no endTime yet.")} // Should be set by server
        }
    }
});


socket.on('roundRolling', ({ roundId }) => {
    console.log(`Event: roundRolling (ID: ${roundId})`);
    if (state.currentRound && state.currentRound.roundId === roundId) {
        state.currentRound.status = 'rolling';
        // Stop client timer, UI changes handled by spinRoulette initiation (triggered by roundWinner)
        clearInterval(state.currentTimerInterval);
        state.currentTimerInterval = null;
        updateTimerDisplay(0); // Show 0
        showNotification(`Round #${roundId} is ending... Rolling winner!`, 'info', 4000);
        // Hide deposit button immediately
         elements.depositButton.disabled = true;
         elements.depositButton.title = 'Round is rolling...';
    }
});

socket.on('roundWinner', (winnerData) => {
    console.log(`Event: roundWinner (Round: ${winnerData.roundId}, Winner: ${winnerData.winner.username})`);
    if (state.currentRound && state.currentRound.roundId === winnerData.roundId) {
        // Update round state with winner info for completeness
        state.currentRound.status = 'completed';
        state.currentRound.winner = winnerData.winner; // Store winner object
        state.currentRound.winningTicket = winnerData.winningTicket;
        state.currentRound.serverSeed = winnerData.serverSeed;
        state.currentRound.clientSeed = winnerData.clientSeed;
        state.currentRound.provableHash = winnerData.provableHash;

        // Initiate the roulette spin animation
        spinRoulette(winnerData.winner, winnerData.winningTicket, winnerData.totalTickets);
    }
});

socket.on('roundCompleted', ({ roundId, message }) => {
    // This event might be used if a round ends without a winner (e.g., no participants)
     console.log(`Event: roundCompleted (ID: ${roundId}, Message: ${message})`);
     if (state.currentRound && state.currentRound.roundId === roundId) {
         state.currentRound.status = 'completed';
         showNotification(`Round #${roundId} completed. ${message || ''}`, 'info');
         resetRouletteDisplay(); // Ensure UI is reset
     }
     // Next round start handled by 'roundCreated'
});


socket.on('roundError', ({ roundId, error }) => {
    console.error(`Event: roundError (ID: ${roundId}, Error: ${error})`);
    if (state.currentRound && state.currentRound.roundId === roundId) {
        state.currentRound.status = 'error';
        // Optionally display error state in UI
    }
    showNotification(`Round Error: ${error}`, 'error');
    resetRouletteDisplay(); // Reset roulette if it was active
});

// Generic notifications from server
socket.on('notification', ({ type, userId, message }) => {
    // Show notification only if it's general or directed at the current user
    if (!userId || (state.user && state.user._id === userId)) {
         console.log(`Notification (${type}): ${message}`);
         showNotification(message, type);
    }
});

socket.on('tradeOfferSent', ({ userId, offerId, roundId }) => {
     if(state.user && state.user._id === userId) {
         showNotification(`Payout for Round #${roundId} sent! Offer ID: ${offerId}. Please accept it on Steam.`, 'success', 15000);
     }
});

/*=========================
  EVENT LISTENERS
=========================*/

function setupEventListeners() {
    // --- Authentication ---
    elements.loginButton?.addEventListener('click', () => {
        window.location.href = '/auth/steam'; // Redirect to Steam login
    });

    elements.logoutButton?.addEventListener('click', async () => {
        try {
            await apiRequest('/logout', 'POST');
            resetUserState();
            showNotification('Logged out successfully.', 'success');
            socket.disconnect(); // Manually disconnect socket on logout
            showPage('home'); // Redirect to home page view after logout
        } catch (error) {
            showNotification(`Logout failed: ${error.message}`, 'error');
        }
    });

    // --- Modals ---
    // Age Verification
    elements.confirmAgeButton?.addEventListener('click', () => {
        localStorage.setItem('isAgeVerified', 'true');
        state.isAgeVerified = true;
        closeModal(elements.ageVerificationModal);
    });
    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal);
        });
    });
    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Only close if clicking the background overlay
                closeModal(modal);
            }
        });
    });

    // Deposit Modal
    elements.depositButton?.addEventListener('click', () => {
        if (!state.isAgeVerified) {
             openModal(elements.ageVerificationModal);
             return;
        }
        if (state.isLoggedIn) {
            openModal(elements.depositModal);
            fetchInventory(); // Fetch fresh inventory when opening
        } else {
            showNotification("Please log in to deposit.", "warning");
        }
    });
    elements.confirmDepositButton?.addEventListener('click', initiateDeposit);

    // Trade URL Modal
    elements.tradeUrlForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = elements.tradeUrlInput.value.trim();
        saveTradeUrl(url);
    });
    // Open Trade URL Modal via Nav Link
    document.getElementById('navSetTradeUrl')?.addEventListener('click', (e) => {
         e.preventDefault();
         if (state.isLoggedIn) {
              elements.tradeUrlInput.value = state.user?.tradeUrl || ''; // Populate with current URL
              hideElement(elements.tradeUrlStatus); // Ensure status is hidden initially
              openModal(elements.tradeUrlModal);
         } else {
              showNotification("Please log in to set your Trade URL.", "warning");
         }
    });


    // --- Navigation / Routing ---
    elements.primaryNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Handle internal page navigation
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const pageId = href.substring(1); // Remove '#'
                showPage(pageId);
            }
            // External links or other actions will proceed normally
        });
    });


     // --- Provably Fair Page ---
    elements.verifyForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        performVerification();
    });

     // Event delegation for history table buttons
    const historyTable = document.getElementById('roundHistoryTable'); // Assuming table has this ID
    historyTable?.addEventListener('click', (e) => {
         const target = e.target;
         // Handle "Verify" button click
         if (target.classList.contains('btn-verify-history')) {
              e.preventDefault();
              const roundId = target.dataset.roundId;
              const serverSeed = target.dataset.serverSeed;
              const clientSeed = target.dataset.clientSeed;

              if (roundId && serverSeed && clientSeed) {
                    showPage('fair'); // Navigate to the fairness page
                    // Scroll to the verification section smoothly
                    elements.verifyForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Pre-fill the form
                    elements.verifyRoundIdInput.value = roundId;
                    elements.verifyServerSeedInput.value = serverSeed;
                    elements.verifyClientSeedInput.value = clientSeed;
                     // Clear any previous result and trigger verification
                    elements.verificationResultContainer.innerHTML = '';
                    hideElement(elements.verificationResultContainer);
                    performVerification(); // Auto-verify when pre-filled
              } else {
                   showNotification('Verification data missing for this round.', 'warning');
              }
         }
         // Handle "Details" button click (Example: Show modal with round items)
         else if (target.classList.contains('btn-details')) {
              e.preventDefault();
              const roundId = target.dataset.roundId;
              showNotification(`Details for Round #${roundId} (Not Implemented Yet)`, 'info');
              // TODO: Implement fetching/displaying round details (items, participants) in a modal
         }
    });


    // --- Test Buttons (REMOVE FOR PRODUCTION) ---
    // Example: Simulate deposit
    document.getElementById('testDeposit')?.addEventListener('click', () => {
        if (!state.currentRound || state.currentRound.status !== 'active') {
             console.warn("Test Deposit: Round not active."); return;
        }
        const testUser = { _id: `test_${Date.now()}`, username: `TestUser${Math.floor(Math.random()*100)}`, avatar: '/img/default-avatar.png', steamId: `test_${Date.now()}` };
        const testItem = {
            assetId: `test_asset_${Date.now()}`, name: `Test Item ${Math.floor(Math.random()*10)}`,
            image: 'https://community.akamai.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposbupIgthwczbYziB_NW0m5SOhcjnNq7CqW1V7cAlj--XrY-g3VKnqkE5ZWGlJIeXcVc3YFHTr1G7wey5hpPvvZmc1zI97e5z' || '/img/default-item.png',
            price: parseFloat((Math.random() * 20 + 0.1).toFixed(2)), // Random price > min
            owner: testUser // Assign owner info
        };
        const testValue = testItem.price;
        const testTickets = Math.max(1, Math.floor(testValue / TICKET_VALUE));

         // Simulate the participantUpdated event data structure
        const updateData = {
            roundId: state.currentRound.roundId,
            userId: testUser._id,
            username: testUser.username,
            avatar: testUser.avatar,
            itemsValue: testValue, // Value of *this* deposit
            tickets: (state.currentRound.participants.find(p => p.user._id === testUser._id)?.tickets || 0) + testTickets, // Cumulative tickets
            totalValue: state.currentRound.totalValue + testValue, // New total value
            depositedItems: [testItem] // Array of items in *this* deposit
        };
        socket.emit('participantUpdated', updateData); // Use the real event for consistency
        // // Manually trigger update (alternative to emitting)
        // handleParticipantUpdate(updateData);
        console.log(`Test Deposit: User ${testUser.username}, Value ${formatCurrency(testValue)}`);
    });
     // Example: Simulate round end (winner selection)
    document.getElementById('testEndRound')?.addEventListener('click', () => {
         if (!state.currentRound || state.currentRound.participants.length === 0 || state.rouletteAnimationActive) {
              console.warn("Test End Round: No active round/participants or already rolling."); return;
         }
         console.log("Test End Round: Simulating winner selection...");
         // Simulate server calculating winner
         const totalTickets = state.currentRound.participants.reduce((sum, p) => sum + p.tickets, 0);
         const winningTicket = Math.floor(Math.random() * totalTickets);
         let cumulativeTickets = 0;
         let winner = null;
         for (const participant of state.currentRound.participants) {
              cumulativeTickets += participant.tickets;
              if (winningTicket < cumulativeTickets) {
                   winner = participant.user;
                   break;
              }
         }
         if (!winner) { console.error("Test End Round: Failed to select winner."); return; }

         // Simulate the roundWinner event
         const winnerData = {
             roundId: state.currentRound.roundId,
             winner: winner, // The full user object
             winningTicket: winningTicket,
             totalTickets: totalTickets,
             // Add mock seeds/hash for display if needed
             serverSeed: 'mockServerSeed_'.padEnd(64, 'a'),
             clientSeed: 'mockClientSeed_'.padEnd(32, 'b'),
             provableHash: 'mockProvableHash_'.padEnd(64, 'c'),
             serverSeedHash: 'mockServerHash_'.padEnd(64, 'd')
         };
         socket.emit('roundWinner', winnerData); // Use the real event
          // Manually trigger spin (alternative)
          // spinRoulette(winner, winningTicket, totalTickets);
    });
}

/*=========================
  ROUTING / PAGE MANAGEMENT
=========================*/

function showPage(pageId) {
    state.currentView = pageId;
    // Hide all pages
    Object.values(elements.pages).forEach(page => hideElement(page));

    // Show the target page
    const targetPage = elements.pages[pageId];
    if (targetPage) {
        showElement(targetPage);
    } else {
        showElement(elements.pages.home); // Default to home if page not found
        console.warn(`Page not found: ${pageId}, showing home.`);
    }

    // Update active nav link state
    elements.primaryNavLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === `#${pageId}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Scroll to top of page
    window.scrollTo(0, 0);

    // Specific actions when showing certain pages
    if (pageId === 'fair') {
        fetchRoundHistory(1); // Load first page of history when viewing fairness page
    }
    if (pageId === 'home') {
        // Ensure jackpot UI is updated if navigating back home
         if (state.currentRound) updateRoundDisplay(state.currentRound);
         else socket.emit('requestRoundData'); // Request data if none exists
    }
}

function handleInitialRoute() {
    let initialPageId = 'home'; // Default to home
    const hash = window.location.hash;

    if (hash && hash.startsWith('#')) {
        const potentialPageId = hash.substring(1);
        if (elements.pages[potentialPageId]) { // Check if the hash corresponds to a valid page
            initialPageId = potentialPageId;
        }
    }
    showPage(initialPageId);
}

/*=========================
  INITIALIZATION
=========================*/

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed.');

    // Check age verification
    if (!state.isAgeVerified) {
        openModal(elements.ageVerificationModal);
    }

    // Set initial timer circle state
    elements.timerCircleForeground.style.strokeDasharray = elements.timerCircleCircumference;
    elements.timerCircleForeground.style.strokeDashoffset = elements.timerCircleCircumference; // Start empty

    // Initial check for user login status
    fetchUserData(); // Fetches user data and updates UI accordingly

    // Setup event listeners
    setupEventListeners();

    // Handle initial page load based on hash or default to home
    handleInitialRoute();

    // Show/hide test buttons based on environment (simple check)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
         showElement(elements.testButtonsContainer);
    } else {
         hideElement(elements.testButtonsContainer);
    }

    // Add hash change listener for back/forward navigation
    window.addEventListener('hashchange', handleInitialRoute);

    console.log("Client-side JavaScript initialized.");
});
