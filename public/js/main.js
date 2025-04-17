// main.js (Incorporating Queuing, Limits, Timer Start, Button States, etc.)

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
const participantCount = document.getElementById('participantCount'); // Displays ITEM count
const itemsContainer = document.getElementById('itemsContainer'); // Container for deposit blocks
const emptyPotMessage = document.getElementById('emptyPotMessage');

// DOM Elements - Deposit
const showDepositModal = document.getElementById('showDepositModal'); // Main deposit button
const depositModal = document.getElementById('depositModal');
const closeDepositModal = document.getElementById('closeDepositModal');
const depositButton = document.getElementById('depositButton'); // Button inside the modal
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
const returnToJackpot = document.getElementById('returnToJackpot'); // Likely unused now
const confettiContainer = document.getElementById('confettiContainer');
const spinSound = document.getElementById('spinSound'); // Assumes <audio id="spinSound">

// DOM Elements - Provably Fair
const verifyBtn = document.getElementById('verify-btn');
const roundsTableBody = document.getElementById('rounds-table-body');
const roundsPagination = document.getElementById('rounds-pagination');

// Age Verification
const ageVerificationModal = document.getElementById('ageVerificationModal');
const agreeCheckbox = document.getElementById('agreeCheckbox');
const agreeButton = document.getElementById('agreeButton');

// --- Constants ---
const ROULETTE_REPETITIONS = 20; // Potentially unused old logic
const SPIN_DURATION_SECONDS = 6.5;
const WINNER_DISPLAY_DURATION = 7000;
const CONFETTI_COUNT = 150;
const MAX_DISPLAY_DEPOSITS = 10; // Max number of deposit blocks to show visually
const MAX_PARTICIPANTS = 20; // ** NEW ** Max participants allowed server-side
const MAX_ITEMS_PER_DEPOSIT = 20; // Max items selectable per single deposit action
const MAX_ITEMS_PER_POT = 200; // ** NEW ** Max total items allowed in the pot
const ROUND_DURATION = 99; // Timer duration in seconds

// Animation constants for roulette
const EASE_OUT_POWER = 5;
const BOUNCE_ENABLED = false;
const BOUNCE_OVERSHOOT_FACTOR = 0.07;
const BOUNCE_DAMPING = 0.35;
const BOUNCE_FREQUENCY = 3.5;
const LANDING_POSITION_VARIATION = 0.60;

// User Color Map
const userColorMap = new Map();
const colorPalette = [
    '#00bcd4', '#ff5722', '#9c27b0', '#4caf50', '#ffeb3b', '#2196f3', '#f44336', '#ff9800',
    '#e91e63', '#8bc34a', '#3f51b5', '#009688', '#cddc39', '#795548', '#607d8b', '#673ab7',
    '#ffc107', '#03a9f4', '#9e9e9e', '#8d6e63'
];

// --- App State ---
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false;
let timerActive = false;
let roundTimer = null; // Interval ID for the countdown
let animationFrameId = null; // For roulette animation loop
let spinStartTime = 0;
let queuedDeposit = null; // ** NEW ** Stores items deposited after timer hits 0 { assetId, name, image, price }[]
let roundEnded = false; // ** NEW ** Flag to indicate if timer reached 0 or server sent end event
let depositQueueNotification = null; // ** NEW ** Reference to the queue notification element

// --- Helper Functions ---
function showModal(modalElement) { /* ... as provided ... */ }
function hideModal(modalElement) { /* ... as provided ... */ }
function showPage(pageElement) { /* ... as provided ... */ }
function getUserColor(userId) { /* ... as provided ... */ }
function showNotification(title, message) { /* ... as provided ... */ }
function shuffleArray(array) { /* ... as provided ... */ }

// ** NEW / UPDATED **: Shows a temporary notification that the deposit is queued
function showDepositQueueNotification() {
    if (depositQueueNotification) {
        if (depositQueueNotification.parentNode) {
            document.body.removeChild(depositQueueNotification);
        }
        depositQueueNotification = null;
    }
    depositQueueNotification = document.createElement('div');
    depositQueueNotification.className = 'deposit-queue-notification'; // Needs CSS
    depositQueueNotification.innerHTML = `
        <span class="queue-title">Deposit Queued</span>
        <p>Your deposit will be processed in the next round.</p>`;
    document.body.appendChild(depositQueueNotification);
    void depositQueueNotification.offsetWidth; // Force reflow
    setTimeout(() => {
        if (depositQueueNotification) depositQueueNotification.classList.add('visible'); // Needs CSS transition
    }, 50);
    setTimeout(() => {
        if (depositQueueNotification) {
            depositQueueNotification.classList.remove('visible');
            setTimeout(() => {
                if (depositQueueNotification && depositQueueNotification.parentNode) {
                    document.body.removeChild(depositQueueNotification);
                    depositQueueNotification = null;
                }
            }, 300); // Match CSS transition duration
        }
    }, 5000); // Auto hide after 5 seconds
}

// ** NEW / UPDATED **: Updates the appearance and text of the main deposit button
function updateDepositButtonState() {
    if (!showDepositModal) return;

    const isRoundActive = currentRound && currentRound.status === 'active';
    const isRoundFullParticipants = currentRound && currentRound.participants &&
                               currentRound.participants.length >= MAX_PARTICIPANTS; // Use new constant
    const isPotFullItems = currentRound && currentRound.items &&
                           currentRound.items.length >= MAX_ITEMS_PER_POT; // Use new constant
    const isRoundEffectivelyEnded = roundEnded || (currentRound && ['rolling', 'ended', 'completed', 'error'].includes(currentRound.status));

    showDepositModal.classList.remove('disabled', 'queued');
    showDepositModal.disabled = false; // Enable by default

    if (isSpinning) {
        showDepositModal.classList.add('disabled');
        showDepositModal.textContent = 'ROLLING...';
        showDepositModal.disabled = true;
    } else if (isRoundEffectivelyEnded) {
        showDepositModal.classList.add('disabled');
        showDepositModal.textContent = 'ROUND ENDED';
        showDepositModal.disabled = true;
    } else if (isRoundFullParticipants) {
        showDepositModal.classList.add('disabled');
        showDepositModal.textContent = 'ROUND FULL';
        showDepositModal.disabled = true;
    } else if (isPotFullItems) {
        showDepositModal.classList.add('disabled');
        showDepositModal.textContent = 'POT FULL';
        showDepositModal.disabled = true;
    } else if (isRoundActive && roundEnded) { // Timer hit zero, but not yet rolling status from server
        showDepositModal.classList.add('queued');
        showDepositModal.textContent = 'QUEUE DEPOSIT';
        // Button remains enabled
    } else if (isRoundActive) {
        showDepositModal.textContent = 'DEPOSIT SKINS';
    } else { // Default/connecting state
        showDepositModal.classList.add('disabled');
        showDepositModal.textContent = 'LOADING...';
        showDepositModal.disabled = true;
    }
}

// --- Animation Easing Functions ---
function easeOutAnimation(t) { /* ... as provided ... */ }
function calculateBounce(t) { /* ... as provided ... */ }

// --- Color Utility Functions ---
function getComplementaryColor(hex) { /* ... as provided ... */ }
function lightenColor(hex, percent) { /* ... as provided ... */ }
function darkenColor(hex, percent) { /* ... as provided ... */ }

// --- Initialize the application ---
document.addEventListener('DOMContentLoaded', function() {
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }
    checkLoginStatus();
    setupEventListeners();
    setupSocketConnection();
    showPage(homePage);
    initiateNewRoundVisualReset(); // Set initial visual state
    updateDepositButtonState(); // Set initial button state
});

// --- Setup event listeners ---
function setupEventListeners() {
    // Navigation
    if (homeLink) homeLink.addEventListener('click', (e) => { e.preventDefault(); showPage(homePage); });
    if (faqLink) faqLink.addEventListener('click', (e) => { e.preventDefault(); showPage(faqPage); });
    if (fairLink) fairLink.addEventListener('click', (e) => { e.preventDefault(); showPage(fairPage); });
    if (aboutLink) aboutLink.addEventListener('click', (e) => { e.preventDefault(); showPage(aboutPage); });
    if (roadmapLink) roadmapLink.addEventListener('click', (e) => { e.preventDefault(); showPage(roadmapPage); });

    // Login
    if (loginButton) loginButton.addEventListener('click', () => { window.location.href = '/auth/steam'; });

    // ** UPDATED ** Deposit Modal Trigger (Main Deposit Button)
    if (showDepositModal) {
        showDepositModal.addEventListener('click', () => {
            // Check button state first (handles disabled/queued visual state)
            if (showDepositModal.classList.contains('disabled')) {
                 showNotification('Deposit Unavailable', showDepositModal.textContent === 'ROUND FULL' ? `This round has reached the participant limit of ${MAX_PARTICIPANTS}.` : showDepositModal.textContent === 'POT FULL' ? `This pot has reached the maximum capacity of ${MAX_ITEMS_PER_POT} items.` : 'Deposits are currently closed for this round.');
                 return;
            }

            if (!currentUser) { /* ... login required check ... */ }
            if (!currentUser.tradeUrl) { /* ... trade url check ... */ }

            // ** NEW / UPDATED ** Check limits again just before opening
            const isRoundFullParticipants = currentRound && currentRound.participants &&
                                       currentRound.participants.length >= MAX_PARTICIPANTS;
            const isPotFullItems = currentRound && currentRound.items &&
                                   currentRound.items.length >= MAX_ITEMS_PER_POT; // Check item limit
            if(isRoundFullParticipants || isPotFullItems){
                showNotification('Deposit Unavailable', isRoundFullParticipants ? `Participant limit (${MAX_PARTICIPANTS}) reached.` : `Pot item limit (${MAX_ITEMS_PER_POT}) reached.`);
                updateDepositButtonState(); // Ensure button reflects limit
                return;
            }

            // If queuing is indicated by button state, show notification
            if (showDepositModal.classList.contains('queued')) {
                showNotification('Round Ending', 'The round is ending soon. Your deposit will be queued for the next round if submitted.');
            }

            if (depositModal) {
                showModal(depositModal);
                loadUserInventory();
            }
        });
    }

    // Deposit Modal Close / Submit (Inside Modal)
    if (closeDepositModal) closeDepositModal.addEventListener('click', () => { hideModal(depositModal); });
    if (depositButton) depositButton.addEventListener('click', submitDeposit); // Button *inside* the modal

    // Trade URL Modal Close / Submit
    if (closeTradeUrlModal) closeTradeUrlModal.addEventListener('click', () => { hideModal(tradeUrlModal); });
    if (saveTradeUrl) saveTradeUrl.addEventListener('click', saveUserTradeUrl);

    // Age Verification
    if (agreeCheckbox && agreeButton && ageVerificationModal) { /* ... as provided ... */ }

    // Test Buttons
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) testSpinButton.addEventListener('click', testRouletteAnimation);
    const testDepositButton = document.getElementById('testDepositButton');
    if (testDepositButton) testDepositButton.addEventListener('click', testDeposit);

    // Provably Fair
    if (verifyBtn) verifyBtn.addEventListener('click', verifyRound);

    // Modal Outside Click Handling
    window.addEventListener('click', (e) => { /* ... as provided ... */ });

    // Keyboard Shortcut (Test Spin)
    document.addEventListener('keydown', function(event) { /* ... as provided ... */ });

    // --- CSS Alignment Note --- (Keep this comment)
    // Shifting the jackpot tab left requires CSS adjustments.
    // Target the elements within '.jackpot-header' (like '.jackpot-value', '.jackpot-timer')
    // Use CSS properties like 'margin', 'padding', 'flex-grow', 'order', or 'justify-content'
    // depending on the header's display type (flex, grid) to achieve the desired alignment.
}

// --- Socket connection and events ---
function setupSocketConnection() {
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('requestRoundData'); // Ask for current state on connect
        updateDepositButtonState(); // Might initially be disabled until data arrives
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showNotification('Connection Lost', 'Disconnected from server. Attempting to reconnect...');
        timerActive = false;
        if(roundTimer) clearInterval(roundTimer); roundTimer = null;
        roundEnded = true; // Assume round ended on disconnect
        updateDepositButtonState(); // Disable deposit button
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showNotification('Connection Error', 'Could not connect to the server.');
        updateDepositButtonState(); // Update button to show error/loading state
    });

    // ** UPDATED ** Received when a new round object is created on the server
    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data; // Store the new round data
        roundEnded = false; // ** Reset ended flag **
        timerActive = false; // Reset timer active flag
        isSpinning = false; // Ensure spinning flag is reset
        if(roundTimer) clearInterval(roundTimer); roundTimer = null; // Clear any old timer interval
        if(animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; // Clear animation

        resetToJackpotView(); // Reset UI elements to jackpot view state
        updateRoundUI(); // Update pot value, item count, timer display (should be 0/default)
        updateDepositButtonState(); // ** Enable deposit button for the new round **

        // ** NEW ** Automatically submit any deposit that was queued from the previous round
        if (queuedDeposit) {
            console.log('Processing queued deposit for new round...');
            submitQueuedDeposit(); // Attempt to send the queued deposit initiation request
        }
    });

    // ** UPDATED ** Received *after* server confirms a successful deposit trade offer
    socket.on('participantUpdated', (data) => {
        console.log('Participant updated (deposit confirmed):', data);
        if (!data || !data.roundId || !data.userId || data.totalValue === undefined) { /* ... validation ... */ return; }
        if (!data.depositedItems) { data.depositedItems = []; }

        if (currentRound && currentRound.roundId === data.roundId) {
            // Client-side limit check (safeguard/UI consistency)
            const isNewParticipant = !currentRound.participants.some(p => p.user?.id === data.userId); // Check if user object exists
            if (isNewParticipant && currentRound.participants.length >= MAX_PARTICIPANTS) {
                console.warn(`UI: Participant limit (${MAX_PARTICIPANTS}) reached. Ignoring visual add for new participant ${data.username}.`);
                // Update totals, but don't add participant or display deposit visually
                currentRound.totalValue = data.totalValue;
                 if(currentRound.items && Array.isArray(data.depositedItems)) {
                     const itemsToAddCount = Math.max(0, MAX_ITEMS_PER_POT - currentRound.items.length);
                     currentRound.items.push(...data.depositedItems.slice(0, itemsToAddCount).map(i => ({...i, owner: data.userId}))); // Add item refs
                 }
                updateRoundUI(); // Update counts/values
                updateDepositButtonState();
                return;
            }
            if (currentRound.items && currentRound.items.length >= MAX_ITEMS_PER_POT) {
                 console.warn(`UI: Pot item limit (${MAX_ITEMS_PER_POT}) reached. Ignoring visual add for items from ${data.username}.`);
                 // Update totals and participant data, but don't display new deposit block
                 currentRound.totalValue = data.totalValue;
                 handleNewDeposit(data, false); // Update state but skip visual display
                 updateRoundUI();
                 updateDepositButtonState();
                 return;
             }

            // ** Process the update (update state, display deposit, start timer if first) **
            handleNewDeposit(data, true); // True indicates visual update should happen
            updateDepositButtonState(); // Re-check button state after deposit

        } else if (!currentRound && data.roundId) { /* ... request data ... */ }
          else if (currentRound && currentRound.roundId !== data.roundId) { /* ... ignore old round ... */ }
    });

    // ** UPDATED ** Received when the server has selected a winner
    socket.on('roundWinner', (data) => {
        console.log('Round winner received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            roundEnded = true; // ** Mark round as ended **
            timerActive = false; // Ensure timer is inactive
            if(roundTimer) clearInterval(roundTimer); roundTimer = null;
            updateDepositButtonState(); // Update button state (should be disabled)

            if (!currentRound.participants || currentRound.participants.length === 0) { /* ... handle missing local data ... */ }
            else {
                 // Update currentRound with final winner data before animating
                 currentRound.winner = data.winner;
                 currentRound.winningTicket = data.winningTicket;
                 currentRound.serverSeed = data.serverSeed;
                 currentRound.clientSeed = data.clientSeed;
                 currentRound.provableHash = data.provableHash;
                 currentRound.status = 'completed'; // Mark locally as completed
                 currentRound.totalValue = data.totalValue; // ** Update value (accounts for server-side tax) **
                 updateRoundUI(); // Update pot display one last time

                handleWinnerAnnouncement(data); // Proceed with animation
            }
        } else { /* ... handle mismatched round ... */ }
    });

    // ** UPDATED ** Received when the server enters the rolling phase
    socket.on('roundRolling', (data) => {
        console.log('Round rolling event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            timerActive = false;
            roundEnded = true; // ** Mark round as ended conceptually **
            currentRound.status = 'rolling'; // Update local status
            updateDepositButtonState(); // Disable deposits

            if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
            if (timerValue) timerValue.textContent = "Rolling";
            if (timerForeground) updateTimerCircle(0, ROUND_DURATION);
        }
    });

    // ** UPDATED ** Received when the server marks the round fully complete
    socket.on('roundCompleted', (data) => {
        console.log('Round completed event received:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
             currentRound.status = 'completed'; // Ensure local status is updated
             roundEnded = true; // ** Ensure ended flag is set **
             updateDepositButtonState(); // Keep deposit button disabled
        }
        if (data.message === "No participants." && (!currentRound || currentRound.participants?.length === 0)) { /* ... handle empty round reset ... */ }
    });

    // ** UPDATED ** Generic round data update
    socket.on('roundData', (data) => {
        console.log('Received general round data update:', data);
        if (!data) { /* ... validation ... */ return; }

        const isNewRound = !currentRound || currentRound.roundId !== data.roundId;
        currentRound = data; // Update local state

        if (isNewRound) {
             initiateNewRoundVisualReset();
             isSpinning = false;
             if(animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
             if(roundTimer) clearInterval(roundTimer); roundTimer = null;
             timerActive = false;
             roundEnded = false; // Reset for new round
         }

        // Determine round state from the received data
        if (['rolling', 'ended', 'completed', 'error'].includes(currentRound.status)) {
            roundEnded = true; // ** Update ended flag **
            timerActive = false;
            if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
        } else if (currentRound.status === 'active') {
             roundEnded = false; // ** Ensure ended flag is false for active round **
             // Check if timer needs starting/resuming
             if (currentRound.participants && currentRound.participants.length > 0 && !timerActive) {
                  console.log("Received active round data with participants, starting/resuming timer.");
                  timerActive = true;
                  startClientTimer(currentRound.timeLeft !== undefined ? currentRound.timeLeft : ROUND_DURATION); // Use remaining time
             } else if (!currentRound.participants || currentRound.participants.length === 0) {
                   timerActive = false; // No participants yet, timer shouldn't run
                   if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
             }
        } else { // e.g., 'pending' state
             roundEnded = false; // ** Ensure ended flag is false **
             timerActive = false;
             if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
        }

        updateRoundUI(); // Update pot value, item count, timer display etc.
        if(!isNewRound && currentRound.items && currentRound.participants) { // Avoid rebuild if we just reset visuals
            rebuildParticipantsDisplay(); // Rebuild display based on full list if needed
        }
        updateDepositButtonState(); // ** Update deposit button based on new state **

        if (currentRound.status === 'rolling' && !isSpinning) { /* ... handle connecting mid-roll ... */ }
    });

     // Handle case where server explicitly says no round is active
     socket.on('noActiveRound', () => {
          console.log("Server indicated no active round.");
          currentRound = null;
          roundEnded = true; // Treat as ended
          timerActive = false;
          if(roundTimer) clearInterval(roundTimer); roundTimer = null;
          initiateNewRoundVisualReset(); // Clear UI
          updateDepositButtonState(); // Disable deposit button
     });

     // Handle server-sent notifications
     socket.on('notification', (data) => { /* ... as before ... */ });

    // Received when server confirms a winning trade offer was sent
    socket.on('tradeOfferSent', (data) => { /* ... as before ... */ });

} // End setupSocketConnection


// --- User Authentication ---
async function checkLoginStatus() { /* ... as provided ... */ }
function updateUserUI() { /* ... as provided ... */ }

// --- Inventory and Deposit Modal ---
async function loadUserInventory() { /* ... as provided ... */ }
function displayInventoryItems() { /* ... as provided ... */ }
function toggleItemSelection(element, item) { /* ... as provided, includes MAX_ITEMS_PER_DEPOSIT check ... */ }
function addSelectedItemElement(item) { /* ... as provided ... */ }
function removeSelectedItemElement(assetId) { /* ... as provided ... */ }
function removeSelectedItem(assetId) { /* ... as provided ... */ }
function updateTotalValue() { /* ... as provided ... */ }

// ** UPDATED ** Handles the "Deposit Items" button click *inside* the modal
async function submitDeposit() {
    if (selectedItemsList.length === 0) { /* ... no items check ... */ return; }

    // ** UPDATED ** Re-check round status AND limits just before submitting
    if (!currentRound || currentRound.status !== 'active') {
        showNotification('Deposit Error', 'The round is no longer active. Please wait for the next round.');
        if (depositModal) hideModal(depositModal);
        return;
    }
    const isRoundFullParticipants = currentRound.participants && currentRound.participants.length >= MAX_PARTICIPANTS;
    const isPotFullItems = currentRound.items && currentRound.items.length >= MAX_ITEMS_PER_POT;
    if (isRoundFullParticipants || isPotFullItems) {
        showNotification('Deposit Error', isRoundFullParticipants ? 'Participant limit reached.' : 'Pot item limit reached.');
        if (depositModal) hideModal(depositModal);
        updateDepositButtonState(); // Ensure main button reflects limit
        return;
    }

    // ** NEW / UPDATED ** Deposit Queueing Logic
    if (roundEnded && currentRound.status === 'active') {
        queuedDeposit = [...selectedItemsList]; // Store a copy
        showDepositQueueNotification();
        if (depositModal) hideModal(depositModal);
        // Clear selection
        selectedItemsList = [];
        if (selectedItems) selectedItems.innerHTML = '';
        if (inventoryItems) inventoryItems.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
        updateTotalValue();
        updateDepositButtonState(); // Reflect queue possibility on main button
        return; // Stop regular deposit process
    }

    if (!depositButton) return;
    depositButton.disabled = true;
    depositButton.textContent = 'Processing...';

    try {
        // Call API to get token and bot URL
        const response = await fetch('/api/deposit/initiate', { /* ... as before ... */ });
        if (!response.ok) { /* ... error handling ... */ }
        const { success, depositToken, botTradeUrl } = await response.json();
        if (!success || !depositToken || !botTradeUrl) { /* ... error handling ... */ }

        const tradeUrlWithMessage = `${botTradeUrl}&message=${encodeURIComponent(depositToken)}`;
        window.open(tradeUrlWithMessage, '_blank');
        showNotification('Trade Offer Ready', 'Please complete the trade offer opened in the new tab/window. Send the selected items to the bot.');

        if (depositModal) hideModal(depositModal);

        // Clear selection AFTER successfully initiating
        selectedItemsList = [];
        if (selectedItems) selectedItems.innerHTML = '';
        if (inventoryItems) inventoryItems.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
        updateTotalValue();

    } catch (error) {
        showNotification('Deposit Initiation Error', error.message);
        console.error('Error initiating deposit:', error);
        // Re-enable button only on error
        if (depositButton) {
            depositButton.disabled = selectedItemsList.length === 0;
            depositButton.textContent = 'Deposit Items';
        }
    }
    // Button state remains 'Processing...' until server confirmation via websocket or error
}


// ** NEW / UPDATED ** Called when a new round starts to process any queued deposit
async function submitQueuedDeposit() {
    if (!queuedDeposit || queuedDeposit.length === 0) return;
    if (!currentRound || currentRound.status !== 'active') {
        console.warn("Cannot process queued deposit: No active round currently.");
        // Keep deposit queued
        return;
    }

    const itemsToSubmit = [...queuedDeposit];
    queuedDeposit = null; // Clear queue optimisticly

    console.log("Attempting to submit queued deposit for new round:", itemsToSubmit.map(i => i.name));

    try {
        // Initiate deposit for the *new* active round
        const response = await fetch('/api/deposit/initiate', { /* ... as before ... */ });
        if (!response.ok) {
            queuedDeposit = itemsToSubmit; // Re-queue on failure
            const error = await response.json().catch(() => ({ error: 'Failed to initiate queued deposit.' }));
            throw new Error(error.error || `Queued deposit failed (${response.status})`);
        }
        const { success, depositToken, botTradeUrl } = await response.json();
        if (!success || !depositToken || !botTradeUrl) {
            queuedDeposit = itemsToSubmit; // Re-queue on failure
            throw new Error("Invalid response for queued deposit initiation.");
        }

        const tradeUrlWithMessage = `${botTradeUrl}&message=${encodeURIComponent(depositToken)}`;
        window.open(tradeUrlWithMessage, '_blank');
        showNotification('Queued Deposit Ready', 'Your queued deposit is ready. Please complete the trade offer opened in the new tab/window.');
        // Queue is now empty

    } catch (error) {
        console.error('Error submitting queued deposit:', error);
        showNotification('Queued Deposit Error', error.message + " Items remain queued.");
        queuedDeposit = itemsToSubmit; // Ensure items are re-queued on error
    }
}


// --- Trade URL Modal ---
async function saveUserTradeUrl() { /* ... as provided ... */ }

// --- Round UI Updates ---
function updateRoundUI() {
    if (!currentRound) { /* ... handle null round ... */ return; }
    if (potValue) potValue.textContent = `$${(currentRound.totalValue || 0).toFixed(2)}`;
    if (participantCount) participantCount.textContent = `${currentRound.items?.length || 0}/${MAX_ITEMS_PER_POT}`; // ** Use item count and constant **

    // Update timer display based on current state
    if (!timerActive && currentRound.status === 'active') {
         // If round is active but timer isn't running locally, use server's timeLeft or default
         updateTimerUI(currentRound.timeLeft !== undefined ? currentRound.timeLeft : ROUND_DURATION);
    } else if (!timerActive) {
         // Not active, show default duration if waiting, or 0 if ended/rolling
         const displayTime = (currentRound.status === 'active' || currentRound.status === 'pending') ? ROUND_DURATION : 0;
         updateTimerUI(displayTime);
    }
    // If timerActive is true, setInterval handles updates

    updateParticipantsUI(); // Update the item count / empty message display
}

// ** UPDATED ** Updates the visual timer circle and text
function updateTimerUI(timeLeft) {
    if (!timerValue || !timerForeground) return;
    const timeToShow = Math.max(0, Math.round(timeLeft));

    // Update text based on state
    if (isSpinning) {
        timerValue.textContent = "Rolling";
    } else if (roundEnded && currentRound?.status !== 'active') {
        timerValue.textContent = "Ended";
    } else if (timerActive || (currentRound?.status === 'active' && timeToShow > 0)) {
        timerValue.textContent = timeToShow;
    } else if (currentRound?.status === 'active' && (!currentRound.participants || currentRound.participants.length === 0)) {
        timerValue.textContent = ROUND_DURATION; // Show full duration while waiting
    } else {
        timerValue.textContent = "--"; // Default/fallback
    }

    updateTimerCircle(timeToShow, ROUND_DURATION);

    // ** NEW ** Check if timer reached zero *during this update*
    if (timerActive && timeToShow === 0 && !roundEnded) {
        console.log("Timer UI detected zero, setting roundEnded flag.");
        roundEnded = true; // Set the flag
        updateDepositButtonState(); // Update button to allow queuing
    }

    // Pulse animations
    if (timerActive && timeToShow <= 10 && timeToShow > 0) { /* ... pulse logic ... */ }
    else { /* ... remove pulse logic ... */ }
}


// ** NEW / UPDATED **: Rebuilds the display based on full round data (e.g., on connect)
function rebuildParticipantsDisplay() {
     if (!itemsContainer || !currentRound || !currentRound.items || !currentRound.participants) return;
     console.log("Rebuilding participants display from full round data...");
     itemsContainer.innerHTML = ''; // Clear existing

    // Group items by participant to reconstruct deposit blocks
    const itemsByParticipant = new Map();
    currentRound.participants.forEach(p => {
        if (p.user) {
            itemsByParticipant.set(p.user.id.toString(), {
                user: p.user,
                itemsValue: p.itemsValue, // Total value for the user in this round
                items: [] // Items belonging to this user
            });
        }
    });

    currentRound.items.forEach(item => {
        const ownerId = item.owner?.toString(); // Get owner ID as string
        if (ownerId && itemsByParticipant.has(ownerId)) {
            itemsByParticipant.get(ownerId).items.push(item);
        }
    });

    // Now display each participant's block
    // Note: Order might not perfectly reflect deposit order without timestamps, using participant list order
    itemsByParticipant.forEach(data => {
         displayLatestDeposit({ // Simulate the structure needed by displayLatestDeposit
              userId: data.user.id,
              username: data.user.username,
              avatar: data.user.avatar,
              itemsValue: data.itemsValue, // Display cumulative value
              depositedItems: data.items // Display all items associated with user in this round
         }, false); // False = don't animate entry on rebuild
     });


     updateParticipantsUI(); // Update counts and empty message state
}


// ** UPDATED **: Displays a deposit block
function displayLatestDeposit(data, animate = true) {
    if (!itemsContainer) { /* ... error check ... */ return; }
    if (!data || !data.userId || typeof data.itemsValue !== 'number' || isNaN(data.itemsValue)) { /* ... validation ... */ return; }

    const username = data.username || 'Unknown User';
    const avatar = data.avatar || '/img/default-avatar.png';
    const value = data.itemsValue; // ** Display cumulative value for user **
    const itemsInThisDeposit = data.depositedItems || []; // Items from *this specific* update
    const userColor = getUserColor(data.userId);

    const depositContainer = document.createElement('div');
    depositContainer.dataset.userId = data.userId;
    depositContainer.className = `player-deposit-container ${animate ? 'player-deposit-new' : ''}`; // Animation class

    const depositHeader = document.createElement('div');
    depositHeader.className = 'player-deposit-header';
    depositHeader.innerHTML = `
        <img src="${avatar}" alt="${username}" class="player-avatar" loading="lazy" onerror="this.onerror=null; this.src='/img/default-avatar.png';" style="border-color: ${userColor};">
        <div class="player-info">
            <div class="player-name" title="${username}">${username}</div>
            <div class="player-deposit-value" style="color: ${userColor}" title="Total Deposited: $${value.toFixed(2)}">$${value.toFixed(2)}</div>
        </div>`; // Show total value

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'player-items-grid';

    if (itemsInThisDeposit.length > 0) {
        itemsInThisDeposit.sort((a, b) => (b.price || 0) - (a.price || 0));
        const displayItems = itemsInThisDeposit.slice(0, MAX_ITEMS_PER_DEPOSIT); // Limit display per block

        displayItems.forEach(item => { /* ... create itemElement ... */ });

        if (itemsInThisDeposit.length > MAX_ITEMS_PER_DEPOSIT) { /* ... add more items indicator ... */ }
    }

    depositContainer.appendChild(depositHeader);
    depositContainer.appendChild(itemsGrid);

    // Add to top
    if (itemsContainer.firstChild) {
        itemsContainer.insertBefore(depositContainer, itemsContainer.firstChild);
    } else {
        itemsContainer.appendChild(depositContainer);
    }

    if (emptyPotMessage) emptyPotMessage.style.display = 'none'; // Hide empty message

    if (animate) { /* ... remove animation class after timeout ... */ }

    // Limit visible blocks
    const currentDepositBlocks = itemsContainer.querySelectorAll('.player-deposit-container');
    if (currentDepositBlocks.length > MAX_DISPLAY_DEPOSITS) { /* ... remove oldest blocks ... */ }
}


// ** UPDATED **: Handles the 'participantUpdated' event data
function handleNewDeposit(data, shouldDisplayVisual = true) {
    if (!currentRound) return;
    if (!currentRound.participants) currentRound.participants = [];
    if (!currentRound.items) currentRound.items = [];

    currentRound.totalValue = data.totalValue; // Update round total

    let participantFound = false;
    let isFirstParticipation = false; // ** NEW ** Flag to check if this is user's first deposit this round

    currentRound.participants = currentRound.participants.map(p => {
        if (p.user && p.user.id === data.userId) {
            participantFound = true;
            // Update cumulative values
            return { ...p, itemsValue: data.itemsValue, tickets: data.tickets };
        }
        return p;
    });

    if (!participantFound) {
        isFirstParticipation = true; // Mark as first participation
        currentRound.participants.push({
            user: { // Ensure user object structure
                id: data.userId,
                steamId: data.steamId || null,
                username: data.username || 'Unknown',
                avatar: data.avatar || '/img/default-avatar.png'
            },
            itemsValue: data.itemsValue,
            tickets: data.tickets
        });
    }

    // Add deposited items to the round's master item list
    if (Array.isArray(data.depositedItems)) {
        const itemsToAddCount = Math.max(0, MAX_ITEMS_PER_POT - currentRound.items.length);
         data.depositedItems.slice(0, itemsToAddCount).forEach(item => {
             if (item && typeof item.price === 'number' && !isNaN(item.price)) {
                 currentRound.items.push({ ...item, owner: data.userId });
             } else { /* ... warning ... */ }
         });
     }

    updateRoundUI(); // Update Pot Value, Item Count

    if (shouldDisplayVisual) {
        displayLatestDeposit(data); // Display the new deposit visually
    }

    // ** UPDATED ** Start timer only if round is active, timer isn't already active, AND this was the first participant joining
    if (currentRound.status === 'active' &&
        currentRound.participants.length === 1 &&
        isFirstParticipation && // Only trigger if this deposit added the first participant
        !timerActive) {
        console.log("First participant joined round. Starting timer.");
        timerActive = true;
        startClientTimer(ROUND_DURATION);
    }
}


// ** UPDATED **: Updates item count display and empty message
function updateParticipantsUI() {
    if (!itemsContainer || !participantCount || !emptyPotMessage) { /* ... error check ... */ return; }

    const totalItems = currentRound?.items?.length || 0;
    // ** Update item count display using MAX_ITEMS_PER_POT **
    participantCount.textContent = `${totalItems}/${MAX_ITEMS_PER_POT}`;

    // Manage the "Empty Pot" message visibility
    if (totalItems === 0) { /* ... show/hide empty message logic ... */ }
    else { emptyPotMessage.style.display = 'none'; }
}


// --- Test Function for Deposits ---
function testDeposit() { /* ... as provided, maybe update mock data if needed ... */ }

// --- Timer Functions ---
function startClientTimer(initialTime = ROUND_DURATION) { /* ... as provided, uses ROUND_DURATION ... */ }
function updateTimerCircle(timeLeft, totalTime) { /* ... as provided ... */ }

// --- Roulette Animation Functions ---
// ** PASTE FULL IMPLEMENTATIONS HERE from the previous correct response **
function createRouletteItems() { /* ... PASTE FULL CODE ... */ }
function handleWinnerAnnouncement(data) { /* ... PASTE FULL CODE ... */ }
function switchToRouletteView() { /* ... PASTE FULL CODE ... */ }
function startRouletteAnimation(winnerData) { /* ... PASTE FULL CODE ... */ }
function handleRouletteSpinAnimation(winningElement, winner) { /* ... PASTE FULL CODE ... */ }
function finalizeSpin(winningElement, winner) { /* ... PASTE FULL CODE ... */ }
function handleSpinEnd(winningElement, winner) { /* ... PASTE FULL CODE ... */ }
function launchConfetti(mainColor = '#00ffaa') { /* ... PASTE FULL CODE ... */ }
function clearConfetti() { /* ... PASTE FULL CODE ... */ }
// ** UPDATED resetToJackpotView **
function resetToJackpotView() {
     console.log("Resetting to jackpot view");

     // Cancel animation/timers
     if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
     clearTimeout(window.soundFadeInInterval); window.soundFadeInInterval = null;
     clearTimeout(window.soundFadeOutInterval); window.soundFadeOutInterval = null;
     clearTimeout(window.winnerFadeInInterval); window.winnerFadeInInterval = null;
     clearTimeout(window.typeDepositInterval); window.typeDepositInterval = null;
     clearTimeout(window.typeChanceInterval); window.typeChanceInterval = null;
     if (roundTimer) { clearInterval(roundTimer); roundTimer = null; } // Clear timer interval

     isSpinning = false;
     timerActive = false; // Reset timer active flag on view reset
     // roundEnded is reset by roundCreated

     if (!jackpotHeader || !inlineRoulette || !winnerInfo || !rouletteTrack || !itemsContainer) { /* ... error check ... */ return; }

     // Stop sound
     if (spinSound && !spinSound.paused) { /* ... stop sound ... */ }

     // Fade out roulette
     inlineRoulette.style.transition = 'opacity 0.5s ease';
     inlineRoulette.style.opacity = '0';
     clearConfetti(); // Clear confetti/highlights

     setTimeout(() => {
         // Reset header class
         jackpotHeader.classList.remove('roulette-mode');

         // Reset roulette track
         rouletteTrack.style.transition = 'none';
         rouletteTrack.style.transform = 'translateX(0)';
         rouletteTrack.innerHTML = '';

         // Hide roulette/winner info
         inlineRoulette.style.display = 'none';
         winnerInfo.style.display = 'none';
         winnerInfo.style.opacity = '0';

         // *** Clear the main deposit items container ***
         if(itemsContainer) itemsContainer.innerHTML = '';
         // Show empty pot message again
         if(emptyPotMessage) emptyPotMessage.style.display = 'block';
         if(itemsContainer && emptyPotMessage && !itemsContainer.contains(emptyPotMessage)) {
              itemsContainer.appendChild(emptyPotMessage);
         }

         // Show jackpot UI elements
         const value = jackpotHeader.querySelector('.jackpot-value');
         const timer = jackpotHeader.querySelector('.jackpot-timer');
         const stats = jackpotHeader.querySelector('.jackpot-stats');
         [value, timer, stats].forEach((el, index) => { /* ... fade in elements ... */ });

         // Reset UI values via initiate function
         initiateNewRoundVisualReset();
         updateDepositButtonState(); // Update button state for the reset view

         // (Optional: Request fresh data again, but roundCreated usually handles this)
         // if (socket.connected) socket.emit('requestRoundData');

     }, 500); // Wait for fade out
}
// ** UPDATED initiateNewRoundVisualReset **
function initiateNewRoundVisualReset() {
    console.log("Visual reset for new round initiated.");

    // Reset Pot Value and Item Count display
    if (potValue) potValue.textContent = "$0.00";
    if (participantCount) participantCount.textContent = `0/${MAX_ITEMS_PER_POT}`; // Use constant

    // Reset Timer Display to full duration (99s)
    updateTimerUI(ROUND_DURATION);
    if (timerValue) {
        timerValue.classList.remove('urgent-pulse', 'timer-pulse');
        // updateTimerUI already sets text content
    }
    updateTimerCircle(ROUND_DURATION, ROUND_DURATION); // Reset circle to full

    // Clear the main deposit display area (itemsContainer)
    if (itemsContainer) itemsContainer.innerHTML = '';
    if (emptyPotMessage) {
         emptyPotMessage.style.display = 'block';
         if (itemsContainer && !itemsContainer.contains(emptyPotMessage)) {
              itemsContainer.appendChild(emptyPotMessage);
         }
    }

    // Clear roulette track (just in case)
    if (rouletteTrack) {
        rouletteTrack.innerHTML = '';
        rouletteTrack.style.transform = 'translateX(0)';
    }
    clearConfetti(); // Clear confetti/winner styles

    // Hide winner info box / roulette container
    if (winnerInfo) { winnerInfo.style.display = 'none'; winnerInfo.style.opacity = '0'; }
    if(inlineRoulette) { inlineRoulette.style.display = 'none'; inlineRoulette.style.opacity = '0'; }
    if (jackpotHeader) jackpotHeader.classList.remove('roulette-mode');

    // State flags are reset by event handlers (e.g., roundCreated)
}
function findWinnerFromData(winnerData) { /* ... PASTE FULL CODE ... */ }
function testRouletteAnimation() { /* ... PASTE FULL CODE ... */ }

// --- Provably Fair Functions ---
async function verifyRound() { /* ... as provided ... */ }
async function loadPastRounds(page = 1) { /* ... as provided ... */ }
function populateVerificationFields(roundId, serverSeed, clientSeed) { /* ... as provided ... */ }
function createPagination(currentPage, totalPages) { /* ... as provided ... */ }

// Define globally accessible functions for HTML onclick attributes
window.showRoundDetails = async function(roundId) { /* ... as provided ... */ };
window.populateVerificationFields = populateVerificationFields; // Already defined, just assign
