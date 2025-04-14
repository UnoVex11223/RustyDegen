// Connect to socket.io server
const socket = io();

// DOM Elements - Navigation
const homeLink = document.querySelector('.main-nav a.active');
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
const ROULETTE_REPETITIONS = 30; // How many times to repeat participant list
const SPIN_DURATION_SECONDS = 8; // How long the spin animation lasts
const CONFETTI_COUNT = 100; // Number of confetti particles

// App State
let currentUser = null;
let currentRound = null;
let selectedItemsList = [];
let userInventory = [];
let isSpinning = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check for age verification in local storage
    if (!localStorage.getItem('ageVerified')) {
        showModal(ageVerificationModal);
    }

    // Check if user is logged in
    checkLoginStatus();

    // Setup event listeners
    setupEventListeners();

    // Connect to socket for real-time updates
    setupSocketConnection();
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(homePage);
    });

    faqLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(faqPage);
    });

    fairLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(fairPage);
    });

    // Login
    loginButton.addEventListener('click', () => {
        window.location.href = '/auth/steam';
    });

    // Deposit
    showDepositModal.addEventListener('click', () => {
        if (!currentUser) {
            alert('Please log in first');
            return;
        }

        // Check if user has set trade URL
        if (!currentUser.tradeUrl) {
            showModal(tradeUrlModal);
            return;
        }

        showModal(depositModal);
        loadUserInventory();
    });

    closeDepositModal.addEventListener('click', () => {
        hideModal(depositModal);
    });

    depositButton.addEventListener('click', submitDeposit);

    // Trade URL
    closeTradeUrlModal.addEventListener('click', () => {
        hideModal(tradeUrlModal);
    });

    saveTradeUrl.addEventListener('click', saveUserTradeUrl);

    // Age Verification
    agreeCheckbox.addEventListener('change', () => {
        agreeButton.disabled = !agreeCheckbox.checked;
    });

    agreeButton.addEventListener('click', () => {
        localStorage.setItem('ageVerified', 'true');
        hideModal(ageVerificationModal);
    });

    // Roulette
    returnToJackpot.addEventListener('click', resetToJackpotView);

    // Provably Fair
    if (verifyBtn) {
        verifyBtn.addEventListener('click', verifyRound);
    }

    // Handle clicks outside modals
    window.addEventListener('click', (e) => {
        if (e.target === depositModal) {
            hideModal(depositModal);
        }
        if (e.target === tradeUrlModal) {
            hideModal(tradeUrlModal);
        }
    });

    // **--- NEW CODE ADDED HERE ---**
    // Add event listener for the test spin button
    const testSpinButton = document.getElementById('testSpinButton');
    if (testSpinButton) {
        testSpinButton.addEventListener('click', testRouletteAnimation);
    }
    // **--- END OF NEW CODE ---**
}

// **--- NEW FUNCTION ADDED HERE ---**
// Function to test the roulette animation
function testRouletteAnimation() {
    // Create test data if no current round exists or it's empty
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        // Create sample participants
        currentRound = {
            roundId: 1,
            totalValue: 194.66,
            participants: [
                {
                    user: {
                        id: 'test_user_1',
                        username: 'DavE',
                        avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
                    },
                    itemsValue: 185.69,
                    tickets: 1857 // Example: Based on $0.10 per ticket logic
                },
                {
                    user: {
                        id: 'test_user_2',
                        username: 'Lisqo',
                        avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg'
                    },
                    itemsValue: 7.39,
                    tickets: 74  // Example: Based on $0.10 per ticket logic
                },
                {
                    user: {
                        id: 'test_user_3',
                        username: 'simon50110',
                        avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg'
                    },
                    itemsValue: 1.04,
                    tickets: 10  // Example: Based on $0.10 per ticket logic
                }
            ],
            items: [] // Assuming items array might be needed elsewhere
        };
        console.log('Using test data for roulette animation.'); // Log that test data is used
    }

    // Choose a random winner from participants (using currentRound, which might be real or test data)
    const winnerIndex = Math.floor(Math.random() * currentRound.participants.length);
    const winnerParticipant = currentRound.participants[winnerIndex];

    // Create winner data in the format expected by startRouletteAnimation
    // Note: The winningTicket calculation here is simplified for the test.
    // The actual winningTicket comes from server calculations in a real scenario.
    const winnerData = {
        roundId: currentRound.roundId,
        winner: winnerParticipant.user,
        winningTicket: Math.floor(Math.random() * winnerParticipant.tickets) // Example winning ticket
    };

    console.log('Test Winner Selected:', winnerData.winner.username);

    // Switch to roulette view and start animation
    switchToRouletteView();
    startRouletteAnimation(winnerData);
}
// **--- END OF NEW FUNCTION ---**


// Socket connection and events
function setupSocketConnection() {
    // Round created event
    socket.on('roundCreated', (data) => {
        console.log('New round created:', data);
        currentRound = data;
        updateRoundUI();
    });

    // Time update event
    socket.on('timeUpdate', (data) => {
        updateTimerUI(data.timeLeft);
    });

    // Participant updated event
    socket.on('participantUpdated', (data) => {
        console.log('Participant updated:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            updateParticipantUI(data);
        }
    });

    // Round winner event
    socket.on('roundWinner', (data) => {
        console.log('Round winner:', data);
        if (currentRound && currentRound.roundId === data.roundId) {
            handleWinnerAnnouncement(data);
        }
    });

    // Trade offer sent event
    socket.on('tradeOfferSent', (data) => {
        console.log('Trade offer sent:', data);
        if (currentUser && data.userId === currentUser._id) {
            showNotification('Trade offer sent', 'Check your Steam trade offers to receive your winnings!');
        }
    });

    // Initial round data
    socket.on('roundData', (data) => {
        console.log('Received round data:', data);
        currentRound = data;
        updateRoundUI();
    });
}

// Check if user is logged in
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');

        if (response.ok) {
            currentUser = await response.json();
            updateUserUI();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

// Update user UI
function updateUserUI() {
    if (currentUser) {
        userAvatar.src = currentUser.avatar || '/img/default-avatar.png';
        userName.textContent = currentUser.username;
        loginButton.style.display = 'none';
        userProfile.style.display = 'flex';
    } else {
        loginButton.style.display = 'flex';
        userProfile.style.display = 'none';
    }
}

// Load user inventory
async function loadUserInventory() {
    selectedItemsList = [];
    selectedItems.innerHTML = '';
    updateTotalValue();

    inventoryLoading.style.display = 'flex';
    inventoryItems.innerHTML = '';

    try {
        const response = await fetch('/api/inventory');

        if (!response.ok) {
            throw new Error('Failed to load inventory');
        }

        userInventory = await response.json();

        inventoryLoading.style.display = 'none';

        if (userInventory.length === 0) {
            inventoryItems.innerHTML = '<p>Your inventory is empty.</p>';
            return;
        }

        displayInventoryItems();
    } catch (error) {
        inventoryLoading.style.display = 'none';
        inventoryItems.innerHTML = `<p>Error loading inventory: ${error.message}</p>`;
        console.error('Error loading inventory:', error);
    }
}

// Display inventory items
function displayInventoryItems() {
    inventoryItems.innerHTML = '';

    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.assetId = item.assetId;
        itemElement.dataset.name = item.name;
        itemElement.dataset.image = item.image;
        itemElement.dataset.price = item.price;

        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" onerror="this.src='/img/default-item.png'">
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-value">$${item.price.toFixed(2)}</div>
            </div>
        `;

        itemElement.addEventListener('click', () => toggleItemSelection(itemElement, item));

        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(element, item) {
    const index = selectedItemsList.findIndex(i => i.assetId === item.assetId);

    if (index === -1) {
        // Add to selected items
        selectedItemsList.push(item);
        element.classList.add('selected');

        // Add to visual selection
        const selectedElement = document.createElement('div');
        selectedElement.className = 'selected-item';
        selectedElement.dataset.assetId = item.assetId;

        selectedElement.innerHTML = `
            <button class="remove-item" data-asset-id="${item.assetId}">&times;</button>
            <img src="${item.image}" alt="${item.name}" onerror="this.src='/img/default-item.png'">
            <div class="selected-item-details">
                <div class="selected-item-value">$${item.price.toFixed(2)}</div>
            </div>
        `;

        selectedElement.querySelector('.remove-item').addEventListener('click', (e) => {
            e.stopPropagation();
            removeSelectedItem(item.assetId);
        });

        selectedItems.appendChild(selectedElement);
    } else {
        // Remove from selected items
        removeSelectedItem(item.assetId);
    }

    updateTotalValue();
}

// Remove selected item
function removeSelectedItem(assetId) {
    // Update selection list
    selectedItemsList = selectedItemsList.filter(item => item.assetId !== assetId);

    // Update UI
    const element = document.querySelector(`.inventory-item[data-asset-id="${assetId}"]`);
    if (element) {
        element.classList.remove('selected');
    }

    const selectedElement = document.querySelector(`.selected-item[data-asset-id="${assetId}"]`);
    if (selectedElement) {
        selectedElement.remove();
    }

    updateTotalValue();
}

// Update total value display
function updateTotalValue() {
    const total = selectedItemsList.reduce((sum, item) => sum + item.price, 0);
    totalValue.textContent = `$${total.toFixed(2)}`;

    // Update deposit button state
    depositButton.disabled = selectedItemsList.length === 0;
}

// Submit deposit
async function submitDeposit() {
    if (selectedItemsList.length === 0) {
        showNotification('Error', 'Please select at least one item to deposit');
        return;
    }

    try {
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: selectedItemsList
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to deposit items');
        }

        const result = await response.json();

        // Hide modal
        hideModal(depositModal);

        // Show success notification
        showNotification('Deposit Initiated', 'Please check your Steam trade offers to complete the deposit');

        // Clear selection
        selectedItemsList = [];
        selectedItems.innerHTML = '';
        updateTotalValue();
    } catch (error) {
        showNotification('Error', error.message);
        console.error('Error depositing items:', error);
    }
}

// Save user trade URL
async function saveUserTradeUrl() {
    const tradeUrl = tradeUrlInput.value.trim();

    if (!tradeUrl) {
        showNotification('Error', 'Please enter your trade URL');
        return;
    }

    if (!tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
        showNotification('Error', 'Invalid trade URL format');
        return;
    }

    try {
        const response = await fetch('/api/user/tradeurl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tradeUrl })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update trade URL');
        }

        const result = await response.json();

        // Update current user
        currentUser.tradeUrl = result.tradeUrl;

        // Hide modal
        hideModal(tradeUrlModal);

        // Show deposit modal
        showModal(depositModal);
        loadUserInventory();

        // Show success notification
        showNotification('Success', 'Trade URL saved successfully');
    } catch (error) {
        showNotification('Error', error.message);
        console.error('Error updating trade URL:', error);
    }
}

// Update round UI
function updateRoundUI() {
    if (!currentRound) return;

    // Update pot value
    potValue.textContent = `$${currentRound.totalValue.toFixed(2)}`;

    // Update timer
    updateTimerUI(currentRound.timeLeft);

    // Update participants
    updateParticipantsUI();
}

// Update timer UI
function updateTimerUI(timeLeft) {
    // Update timer text
    timerValue.textContent = timeLeft;

    // Update timer circle
    const totalTime = 120; // 2 minutes
    const circumference = 2 * Math.PI * 45;
    const progress = timeLeft / totalTime;
    const offset = circumference * (1 - progress);
    timerForeground.style.strokeDasharray = circumference;
    timerForeground.style.strokeDashoffset = Math.max(0, offset);

    // Add pulse effect when time is low
    if (timeLeft <= 10) {
        timerValue.classList.add('urgent-pulse');
        timerValue.classList.remove('timer-pulse');
    } else {
        timerValue.classList.remove('urgent-pulse');
        timerValue.classList.add('timer-pulse');
    }
}

// Update participants UI
function updateParticipantsUI() {
    if (!currentRound || !currentRound.participants) return;

    const participants = currentRound.participants;

    // Update participant count
    participantCount.textContent = `${participants.length}/200`;

    // Clear container
    participantsContainer.innerHTML = '';

    // Show empty message if no participants
    if (participants.length === 0) {
        // Check if emptyPotMessage exists before appending
        if(emptyPotMessage) {
           participantsContainer.appendChild(emptyPotMessage);
        } else {
            // Optionally create a message if the element doesn't exist
            const tempEmptyMsg = document.createElement('p');
            tempEmptyMsg.textContent = "Pot is currently empty. Deposit items to join!";
            participantsContainer.appendChild(tempEmptyMsg);
        }
        return;
    } else {
         // Remove empty message if it exists and participants are present
         if (emptyPotMessage && emptyPotMessage.parentNode === participantsContainer) {
            participantsContainer.removeChild(emptyPotMessage);
         }
    }

    // Add participants
    participants.forEach(participant => {
        // Find user's items (Ensure currentRound.items exists)
        const userItems = currentRound.items ? currentRound.items.filter(item => item.owner && item.owner.toString() === participant.user.id.toString()) : [];

        const participantElement = createParticipantElement(participant, userItems);
        participantsContainer.appendChild(participantElement);
    });
}


// Update a single participant
function updateParticipantUI(data) {
    // Update total pot value
    currentRound.totalValue = data.totalValue;
    potValue.textContent = `$${data.totalValue.toFixed(2)}`;

    // Ensure participants array exists
     if (!currentRound.participants) {
        currentRound.participants = [];
    }

    // Check if participant already exists
    let found = false;
    for (let i = 0; i < currentRound.participants.length; i++) {
        if (currentRound.participants[i].user.id === data.userId) {
            currentRound.participants[i].itemsValue = data.itemsValue;
            currentRound.participants[i].tickets = data.tickets; // Assuming tickets are sent in update
            found = true;
            break;
        }
    }

    // Add new participant if not found
    if (!found) {
        currentRound.participants.push({
            user: {
                id: data.userId,
                username: data.username,
                avatar: data.avatar
            },
            itemsValue: data.itemsValue,
            tickets: data.tickets // Assuming tickets are sent in update
        });
    }

    // Update UI
    updateParticipantsUI();
}


// Create participant element
function createParticipantElement(participant, items) {
    const participantElement = document.createElement('div');
    participantElement.className = 'participant';
    participantElement.dataset.userId = participant.user.id;

    // Calculate percentage
    const percentage = currentRound.totalValue > 0 ?
        ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(2) :
        '0.00';

    // Create header
    const headerElement = document.createElement('div');
    headerElement.className = 'participant-header';
    headerElement.innerHTML = `
        <div class="participant-info">
            <img src="${participant.user.avatar}" alt="${participant.user.username}" class="participant-avatar" onerror="this.src='/img/default-avatar.png'">
            <div class="participant-details">
                <span class="participant-name">${participant.user.username}</span>
                <div class="participant-stats">
                    <span class="participant-value">$${participant.itemsValue.toFixed(2)}</span>
                    <span class="participant-percentage">${percentage}%</span>
                </div>
            </div>
        </div>
    `;

    // Create items container
    const itemsElement = document.createElement('div');
    itemsElement.className = 'participant-items';

    // Add items
    if (items && items.length > 0) {
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item';
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" onerror="this.src='/img/default-item.png'">
                <span class="item-value">$${item.price.toFixed(2)}</span>
            `;
            itemsElement.appendChild(itemElement);
        });
    }

    // Append elements
    participantElement.appendChild(headerElement);
    participantElement.appendChild(itemsElement);

    return participantElement;
}

// Handle winner announcement
function handleWinnerAnnouncement(data) {
    if (isSpinning) return;

    // Ensure we have participant data before starting
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error("Cannot announce winner: No participant data available.");
        return;
    }


    // Switch to roulette view
    switchToRouletteView();

    // Start roulette animation
    startRouletteAnimation(data);
}

// Switch to roulette view
function switchToRouletteView() {
    jackpotHeader.style.display = 'none';
    inlineRoulette.style.display = 'block';
}

// Start roulette animation
function startRouletteAnimation(winnerData) {
    isSpinning = true;
    winnerInfo.style.display = 'none';
    returnToJackpot.style.display = 'none';
    clearConfetti();

    // Create roulette items from participants
    // Ensure createRouletteItems uses the correct currentRound data
    createRouletteItems();

    // Find or create winner object based on winnerData and currentRound
    const winner = findWinnerFromData(winnerData);
    if (!winner) {
        console.error('Could not determine winner details for animation.');
        isSpinning = false;
        resetToJackpotView(); // Reset view if winner can't be found
        return;
    }
    console.log('Starting animation for Winner:', winner.user.username);


    // Play spin sound
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.error('Error playing sound:', e));
    }

    // Show roulette track and calculate spin
    setTimeout(() => {
        const items = rouletteTrack.querySelectorAll('.roulette-item');
        if (items.length === 0) {
            console.error('Cannot spin, no items rendered in roulette track');
            isSpinning = false;
            resetToJackpotView();
            return;
        }

        const targetIndex = findTargetItemIndex(items, winner.user.id);
        const winningElement = items[targetIndex];

        if (!winningElement) {
            console.error('Could not find a representative winning element on the track for user ID:', winner.user.id);
            // Fallback: maybe pick a random element or the last element with the winner's ID?
            // For now, let's just stop and reset.
             isSpinning = false;
             resetToJackpotView();
            return;
        }

        // Calculate stopping position
        const containerWidth = inlineRoulette.querySelector('.roulette-container').offsetWidth;
        const itemWidth = winningElement.offsetWidth;
        const itemOffset = winningElement.offsetLeft;

        // Position winning item roughly in the center
        const targetPosition = -(itemOffset + (itemWidth / 2) - (containerWidth / 2));

        // Apply animation
        rouletteTrack.style.transition = `transform ${SPIN_DURATION_SECONDS}s cubic-bezier(0.08, 0.82, 0.17, 1)`;
        rouletteTrack.style.transform = `translateX(${targetPosition}px)`;

        // Handle end of animation
        rouletteTrack.addEventListener('transitionend', () => {
             // Check if this is the intended final state
             if (isSpinning && Math.abs(parseFloat(rouletteTrack.style.transform.replace(/[^0-9.-]/g, '')) - targetPosition) < 1) {
                handleSpinEnd(winningElement, winner);
             }
        }, { once: true }); // Use { once: true } to ensure the listener is removed after firing


        // Fallback timer in case transitionend doesn't fire reliably
         setTimeout(() => {
             if(isSpinning) { // Only call if still spinning (transitionend might have already fired)
                 console.log("Fallback timer triggered for spin end.");
                 handleSpinEnd(winningElement, winner);
             }
         }, (SPIN_DURATION_SECONDS * 1000) + 200); // Add a small buffer


    }, 500); // Short delay to ensure elements are rendered
}

// Find winner details from winner data and current round participants
function findWinnerFromData(winnerData) {
     if (!currentRound || !currentRound.participants || !winnerData || !winnerData.winner) {
        console.error("Missing data to find winner details.");
        return null; // Return null if data is insufficient
    }

    const winnerParticipant = currentRound.participants.find(p => p.user.id === winnerData.winner.id);

    if (!winnerParticipant) {
         console.warn(`Winner with ID ${winnerData.winner.id} not found in current round participants. Using data from winnerData directly.`);
         // Fallback if participant somehow isn't in the list (shouldn't happen ideally)
         return {
             user: winnerData.winner,
             percentage: 0, // Cannot calculate percentage without totalValue and itemsValue
             value: 0      // Cannot get value without participant data
         };
    }

    const totalValue = currentRound.totalValue || 1; // Avoid division by zero
    const percentage = (winnerParticipant.itemsValue / totalValue) * 100;

    return {
        user: {
            id: winnerParticipant.user.id,
            username: winnerParticipant.user.username,
            avatar: winnerParticipant.user.avatar
        },
        percentage: percentage || 0,
        value: winnerParticipant.itemsValue || 0
    };
}


// Find target item index for animation stopping point
function findTargetItemIndex(items, winnerId) {
    // Look for winner items within a specific range of the track for a more realistic stop
    // e.g., between 60% and 90% of the total track length
    const minIndex = Math.floor(items.length * 0.6);
    const maxIndex = Math.floor(items.length * 0.9);

    const possibleIndices = [];
    for (let i = minIndex; i < maxIndex; i++) {
        // Ensure item exists and belongs to the winner
        if (items[i] && items[i].dataset.userId === winnerId) {
            possibleIndices.push(i);
        }
    }

    if (possibleIndices.length > 0) {
        // Return a random index from the suitable ones found in the range
        return possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
    }

    // Fallback 1: If no winner items found in the preferred range, search the entire track
    console.warn("No winner item found in preferred range (60-90%), searching full track.");
    const fallbackIndices = [];
     for (let i = 0; i < items.length; i++) {
         if (items[i] && items[i].dataset.userId === winnerId) {
             fallbackIndices.push(i);
         }
     }

     if (fallbackIndices.length > 0) {
        // Return a random index from anywhere on the track
         return fallbackIndices[Math.floor(Math.random() * fallbackIndices.length)];
     }


    // Fallback 2: If absolutely no item for the winner is found (should be impossible if createRouletteItems worked)
    console.error(`CRITICAL: No roulette item found for winner ID ${winnerId}. Selecting a default index.`);
    // Return an index near the end as a last resort
    return Math.max(0, items.length - 10); // Pick an item near the end
}

// Handle end of spin animation
function handleSpinEnd(winningElement, winner) {
     if (!isSpinning) return; // Prevent running multiple times if called by both timer and event listener

    isSpinning = false;
    console.log("Spin animation finished.");

    // Highlight winner element
    if (winningElement) {
       winningElement.classList.add('winner');
    } else {
        console.error("Winning element not provided to handleSpinEnd");
    }


    // Show winner info after a short delay for effect
    setTimeout(() => {
        // Set winner info
        if(winner && winner.user) {
            winnerAvatar.src = winner.user.avatar || '/img/default-avatar.png';
            winnerAvatar.alt = winner.user.username;
            winnerName.textContent = winner.user.username;
            winnerDeposit.textContent = `${winner.value.toFixed(2)}`;
            winnerChance.textContent = `${winner.percentage.toFixed(2)}%`;

             // Show winner info and return button
            winnerInfo.style.display = 'block';
            returnToJackpot.style.display = 'block';

            // Launch confetti
            launchConfetti();
        } else {
             console.error("Winner data is incomplete, cannot display winner info.");
             // Maybe reset to jackpot view as a fallback
             resetToJackpotView();
        }

    }, 500); // Delay before showing winner info
}

// Reset to jackpot view
function resetToJackpotView() {
    // Hide roulette and winner info
    inlineRoulette.style.display = 'none';
    winnerInfo.style.display = 'none';
    returnToJackpot.style.display = 'none';

    // Clear winner highlight and confetti
    const winnerElement = rouletteTrack.querySelector('.roulette-item.winner');
    if (winnerElement) {
        winnerElement.classList.remove('winner');
    }
    clearConfetti();

    // Reset roulette track position and transition
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';
    rouletteTrack.innerHTML = ''; // Clear items for the next round

    // Show jackpot header
    jackpotHeader.style.display = 'flex';

    // Reset spinning state just in case
    isSpinning = false;
}

// Create roulette items
function createRouletteItems() {
    rouletteTrack.innerHTML = ''; // Clear previous items
    rouletteTrack.style.transition = 'none'; // Ensure no transition during setup
    rouletteTrack.style.transform = 'translateX(0)'; // Reset position

    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('Cannot create roulette items: No participants data available.');
        return; // Exit if no data
    }

    // Create a pool of "tickets" where each participant is represented proportionally
    let itemsPool = [];
    currentRound.participants.forEach(participant => {
        // Calculate number of tickets (e.g., 1 ticket per $0.01 value, adjust as needed)
        // Use participant.tickets if available and reliable, otherwise calculate from value
        const tickets = participant.tickets || Math.max(1, Math.floor(participant.itemsValue * 100)); // Ensure at least 1 ticket
        for (let i = 0; i < tickets; i++) {
            itemsPool.push(participant); // Add participant reference for each ticket
        }
    });

    // Shuffle the pool thoroughly for randomness in the visual sequence
    itemsPool = shuffleArray(itemsPool);

    // Create the visual items for the roulette track
    const fragment = document.createDocumentFragment(); // Use fragment for performance
    const totalItemsToCreate = Math.min(itemsPool.length * ROULETTE_REPETITIONS, 2000); // Limit total items for performance
    const poolLength = itemsPool.length;

    if (poolLength === 0) {
        console.error("Items pool is empty after processing participants.");
        return;
    }


    for (let i = 0; i < totalItemsToCreate; i++) {
        // Cycle through the shuffled pool
         const participant = itemsPool[i % poolLength];

        // Basic color cycling for visual distinction
        const colorClass = `item-${(i % 5) + 1}`;

        const item = document.createElement('div');
        item.className = `roulette-item ${colorClass}`;
        item.dataset.userId = participant.user.id; // Store user ID for identification

        // Calculate percentage for display (ensure totalValue is not zero)
         const percentage = currentRound.totalValue > 0 ?
            ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(2) :
            '0.00';


        // Use innerHTML for simpler element creation within the loop
        item.innerHTML = `
            <div class="profile-pic-container">
                <img class="roulette-avatar" src="${participant.user.avatar || '/img/default-avatar.png'}" alt="${participant.user.username}" onerror="this.src='/img/default-avatar.png';">
            </div>
            <div class="roulette-info">
                <span class="roulette-name">${participant.user.username}</span>
                <span class="roulette-percentage">${percentage}%</span>
            </div>
        `;

        fragment.appendChild(item);
    }

    rouletteTrack.appendChild(fragment); // Append all items at once
    console.log(`Created ${totalItemsToCreate} items for the roulette track.`);
}


// Launch confetti
function launchConfetti() {
    clearConfetti(); // Clear any existing confetti

    const colors = ['#00ffaa', '#33ccff', '#9933ff', '#ffcc00', '#ff3366', '#ffffff'];

    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        // Random position across the container width
        confetti.style.left = `${Math.random() * 100}%`;

        // Random color
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        // Random size
        const size = Math.random() * 8 + 5; // Size between 5px and 13px
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;

        // Random shape (slight variation - mostly square, sometimes circle)
        if (Math.random() > 0.7) { // 30% chance of being a circle
            confetti.style.borderRadius = '50%';
        }

        // Random animation delay and duration for variation
        confetti.style.animationDuration = `${Math.random() * 3 + 2}s`; // Duration 2s to 5s
        confetti.style.animationDelay = `${Math.random() * 0.5}s`; // Start delay up to 0.5s

        confettiContainer.appendChild(confetti);
    }
}

// Clear confetti
function clearConfetti() {
    confettiContainer.innerHTML = '';
}

// Load past rounds for provably fair page
async function loadPastRounds(page = 1) {
    if (!roundsTableBody) return;

    try {
        roundsTableBody.innerHTML = '<tr><td colspan="5">Loading past rounds...</td></tr>';

        const response = await fetch(`/api/rounds?page=${page}&limit=10`);

        if (!response.ok) {
            throw new Error('Failed to load past rounds');
        }

        const data = await response.json();

        // Clear table
        roundsTableBody.innerHTML = '';

        if (data.rounds.length === 0) {
            roundsTableBody.innerHTML = '<tr><td colspan="5">No rounds found</td></tr>';
             createPagination(data.currentPage, data.totalPages); // Still show pagination controls even if empty
            return;
        }

        // Add rounds to table
        data.rounds.forEach(round => {
            const row = document.createElement('tr');

            // Format date safely
            let formattedDate = 'N/A';
            try {
                 if(round.endTime) {
                    const date = new Date(round.endTime);
                     formattedDate = date.toLocaleString();
                 }
            } catch (e) { console.error("Error formatting date:", e); }


            row.innerHTML = `
                <td>${round.roundId}</td>
                <td>${formattedDate}</td>
                <td>${round.totalValue ? round.totalValue.toFixed(2) : '0.00'}</td>
                <td>${round.winner ? round.winner.username : 'N/A'}</td>
                <td>
                    <button class="btn" onclick="showRoundDetails(${round.roundId})">Details</button>
                </td>
            `;

            roundsTableBody.appendChild(row);
        });

        // Create pagination
        createPagination(data.currentPage, data.totalPages);
    } catch (error) {
        roundsTableBody.innerHTML = `<tr><td colspan="5">Error loading rounds: ${error.message}</td></tr>`;
        console.error('Error loading past rounds:', error);
    }
}

// Create pagination controls
function createPagination(currentPage, totalPages) {
    if (!roundsPagination) return;

    roundsPagination.innerHTML = ''; // Clear existing controls

    if (totalPages <= 1) return; // No pagination needed for 1 or fewer pages

    const createButton = (text, pageNum, isActive = false, isDisabled = false) => {
        const button = document.createElement('button');
        button.className = `page-button ${isActive ? 'active' : ''}`;
        button.textContent = text;
        button.disabled = isDisabled;
        if (!isDisabled) {
            button.addEventListener('click', () => loadPastRounds(pageNum));
        }
        return button;
    };

    // Previous button
    roundsPagination.appendChild(createButton('Previous', currentPage - 1, false, currentPage <= 1));


    // Page number buttons (e.g., show current, 2 before, 2 after)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

     // Adjust startPage if endPage is at the limit
     if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
     }


    // Add "..." if startPage is far from 1
     if (startPage > 1) {
         roundsPagination.appendChild(createButton('1', 1));
         if (startPage > 2) {
             const ellipsis = document.createElement('span');
             ellipsis.textContent = '...';
             ellipsis.className = 'page-ellipsis';
             roundsPagination.appendChild(ellipsis);
         }
     }


    for (let i = startPage; i <= endPage; i++) {
        roundsPagination.appendChild(createButton(i, i, i === currentPage));
    }

     // Add "..." if endPage is far from totalPages
      if (endPage < totalPages) {
          if (endPage < totalPages - 1) {
              const ellipsis = document.createElement('span');
              ellipsis.textContent = '...';
              ellipsis.className = 'page-ellipsis';
              roundsPagination.appendChild(ellipsis);
          }
          roundsPagination.appendChild(createButton(totalPages, totalPages));
      }

    // Next button
    roundsPagination.appendChild(createButton('Next', currentPage + 1, false, currentPage >= totalPages));
}

// Verify round fairness
async function verifyRound() {
    const roundIdInput = document.getElementById('round-id');
    const serverSeedInput = document.getElementById('server-seed');
    const clientSeedInput = document.getElementById('client-seed');
    const verificationResult = document.getElementById('verification-result');

     // Basic validation
     if (!roundIdInput || !serverSeedInput || !clientSeedInput || !verificationResult) {
        console.error("Missing elements for verification.");
        return;
     }

    const roundId = roundIdInput.value.trim();
    const serverSeed = serverSeedInput.value.trim();
    const clientSeed = clientSeedInput.value.trim();


    if (!roundId || !serverSeed || !clientSeed) {
        verificationResult.style.display = 'block';
        verificationResult.style.color = 'red';
        verificationResult.textContent = 'Please fill in Round ID, Server Seed, and Client Seed.';
        return;
    }

    try {
        verificationResult.style.display = 'block';
        verificationResult.style.color = 'var(--text-secondary)'; // Indicate loading
        verificationResult.textContent = 'Verifying...';

        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roundId,
                serverSeed,
                clientSeed
            })
        });

        const result = await response.json(); // Get response regardless of status

        if (!response.ok) {
             // Use error message from server if available
            throw new Error(result.error || `Verification failed with status ${response.status}`);
        }


        verificationResult.style.color = result.verified ? 'green' : 'red';

        if (result.verified) {
            // Display detailed success information
            verificationResult.innerHTML = `
                <div style="color: green; text-align: left; padding: 10px; border: 1px solid green; border-radius: 4px; background-color: rgba(0, 255, 0, 0.05);">
                    <strong>Verification Successful!</strong><br>
                    <p>Round #${result.roundId} has been verified as fair.</p>
                    <p><strong>Server Seed:</strong> ${result.serverSeed}</p>
                    <p><strong>Server Seed Hash (used during round):</strong> ${result.serverSeedHash}</p>
                    <p><strong>Client Seed:</strong> ${result.clientSeed}</p>
                    <p><strong>Combined Hash (Server + Client Seed):</strong> ${result.combinedHash || 'N/A'}</p>
                    <p><strong>Calculated Winning Ticket:</strong> ${result.winningTicket}</p>
                     <p><strong>Winner Determined By Server:</strong> ${result.winnerUsername || 'N/A'}</p>
                </div>
            `;
        } else {
            // Display failure information
             verificationResult.innerHTML = `
                <div style="color: red; text-align: left; padding: 10px; border: 1px solid red; border-radius: 4px; background-color: rgba(255, 0, 0, 0.05);">
                    <strong>Verification Failed!</strong><br>
                    <p>Reason: ${result.reason || 'Unknown error during verification.'}</p>
                    ${result.winningTicket ? `<p>Calculated Winning Ticket (for reference): ${result.winningTicket}</p>` : ''}
                     ${result.serverSeedHash ? `<p>Server Seed Hash (used during round): ${result.serverSeedHash}</p>` : ''}
                </div>
            `;
        }
    } catch (error) {
        verificationResult.style.display = 'block';
        verificationResult.style.color = 'red';
        verificationResult.textContent = `Error: ${error.message}`;
        console.error('Error verifying round:', error);
    }
}

// Helper functions
function showPage(page) {
    // Hide all pages
    homePage.style.display = 'none';
    faqPage.style.display = 'none';
    fairPage.style.display = 'none';

    // Show selected page
    page.style.display = 'block';

    // Update active nav link
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to the correct link
    if (page === homePage && homeLink) {
        homeLink.classList.add('active');
    } else if (page === faqPage && faqLink) {
        faqLink.classList.add('active');
    } else if (page === fairPage && fairLink) {
        fairLink.classList.add('active');
        // Load initial data for the fair page when shown
        loadPastRounds(1); // Load first page of rounds
    }
}


function showModal(modal) {
    if(!modal) return; // Prevent errors if modal doesn't exist
    modal.style.display = 'flex';
    // Use requestAnimationFrame for smoother transition start
     requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function hideModal(modal) {
    if(!modal) return;
    modal.classList.remove('active');
    // Listen for transition end to set display: none
     modal.addEventListener('transitionend', () => {
         if (!modal.classList.contains('active')) { // Check if it's still hidden
             modal.style.display = 'none';
         }
     }, { once: true });

     // Fallback timer in case transitionend doesn't fire
     setTimeout(() => {
         if (!modal.classList.contains('active')) {
             modal.style.display = 'none';
         }
     }, 350); // Should match transition duration
}


function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-header">
            <strong>${title}</strong>
            <button class="close-notification">&times;</button>
        </div>
        <div class="notification-body">
            ${message}
        </div>
    `;

    document.body.appendChild(notification);

    // Add keyframes for animation if not already present
    if (!document.getElementById('notification-keyframes')) {
        const style = document.createElement('style');
        style.id = 'notification-keyframes';
        style.innerHTML = `
            .notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 300px;
                background-color: var(--background-medium);
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                z-index: 9999;
                animation: slideIn 0.3s ease forwards;
                color: var(--text-primary); /* Ensure text is visible */
            }
             .notification.closing {
                animation: slideOut 0.3s ease forwards;
             }
            .notification-header {
                padding: 10px 15px;
                background-color: var(--background-light);
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--border-color); /* Add separator */
            }
            .notification-header strong { color: var(--primary-color); }
            .close-notification {
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 20px;
                cursor: pointer;
                padding: 0 5px; /* Easier to click */
                line-height: 1; /* Prevent extra spacing */
            }
            .close-notification:hover { color: var(--primary-color); } /* Hover effect */
            .notification-body { padding: 15px; }

            @keyframes slideIn {
                from { transform: translateX(110%); opacity: 0; } /* Start further off-screen */
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(110%); opacity: 0; } /* Move further off-screen */
            }
        `;
        document.head.appendChild(style);
    }

    // Close notification function
    const close = () => {
        notification.classList.add('closing');
        // Remove after animation completes
        notification.addEventListener('animationend', () => {
             notification.remove();
        }, { once: true });
         // Fallback removal
         setTimeout(() => {
            if(notification.parentNode) {
                 notification.remove();
            }
         }, 350);
    };


    // Close on button click
    notification.querySelector('.close-notification').addEventListener('click', close);

    // Auto close after 5 seconds
    setTimeout(close, 5000);
}


// Fisher-Yates (aka Knuth) Shuffle algorithm
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

// Expose necessary functions to global scope for button onclick handlers etc.
window.showRoundDetails = function(roundId) {
    // Basic implementation: Fetch round details and show in a modal or notification
    // Replace with a proper modal implementation later
     fetch(`/api/round/${roundId}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok.');
            return response.json();
        })
        .then(round => {
            // Simple alert for now, replace with modal
            alert(`Round Details #${round.roundId}:\nWinner: ${round.winner ? round.winner.username : 'N/A'}\nValue: $${round.totalValue.toFixed(2)}\nServer Seed Hash: ${round.serverSeedHash}\nEnded: ${new Date(round.endTime).toLocaleString()}`);
        })
        .catch(error => {
            console.error("Error fetching round details:", error);
            showNotification('Error', `Could not load details for round #${roundId}.`);
        });
};

// Make verifyRound globally accessible if the button uses onclick="verifyRound()"
window.verifyRound = verifyRound;
