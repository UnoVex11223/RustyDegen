// Connect to WebSocket

const socket = io();



// DOM Elements

const loginBtn = document.getElementById('login-btn');

const depositBtn = document.getElementById('deposit-btn');

const jackpotValue = document.querySelector('.jackpot-value');

const timerElement = document.querySelector('.timer');

const participantsList = document.getElementById('participants-list');

const chanceDisplay = document.getElementById('chance-display');

const itemsGrid = document.getElementById('items-grid');

const inventoryItems = document.getElementById('inventory-items');

const wheelItems = document.getElementById('wheel-items');



// App state

let currentUser = null;

let currentRound = null;

let selectedItems = [];

let userItems = [];



// Initialize the application

async function initApp() {

    // Check if user is logged in

    try {

        const response = await fetch('/api/user');

        if (response.ok) {

            currentUser = await response.json();

            updateUserUI();

        }

    } catch (err) {

        console.error('Error checking login status:', err);

    }

    

    // Listen for socket events

    setupSocketListeners();

}



// Setup WebSocket event listeners

function setupSocketListeners() {

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

            // Update total value

            currentRound.totalValue = data.totalValue;

            

            // Update or add participant

            let found = false;

            if (currentRound.participants) {

                for (let i = 0; i < currentRound.participants.length; i++) {

                    if (currentRound.participants[i].user.id === data.userId) {

                        currentRound.participants[i].itemsValue = data.itemsValue;

                        currentRound.participants[i].tickets = data.tickets;

                        found = true;

                        break;

                    }

                }

            } else {

                currentRound.participants = [];

            }

            

            if (!found) {

                currentRound.participants.push({

                    user: {

                        id: data.userId,

                        username: data.username,

                        avatar: data.avatar

                    },

                    itemsValue: data.itemsValue,

                    tickets: data.tickets

                });

            }

            

            updateRoundUI();

        }

    });

    

    // Round winner event

    socket.on('roundWinner', (data) => {

        console.log('Round winner:', data);

        if (currentRound && currentRound.roundId === data.roundId) {

            currentRound.winner = data.winner;

            currentRound.winningTicket = data.winningTicket;

            currentRound.serverSeed = data.serverSeed;

            currentRound.clientSeed = data.clientSeed;

            

            // Trigger winner animation

            animateWinner(data.winningTicket);

            

            // Show winner notification

            showWinnerNotification(data.winner);

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



// Update UI for logged in user

function updateUserUI() {

    if (currentUser) {

        loginBtn.innerHTML = `

            <img src="${currentUser.avatar}" alt="${currentUser.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 5px;">

            ${currentUser.username}

        `;

        depositBtn.disabled = false;

        

        // Update user's chance in current round

        updateUserChance();

    } else {

        loginBtn.innerHTML = `

            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">

                <path d="M11.5 6.027a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"/>

                <path d="M11.5 1a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 1 0v1.5H11V1.5a.5.5 0 0 1 .5-.5zM.8 1a.8.8 0 0 0-.8.8v9.6a.8.8 0 0 0 .8.8h14.4a.8.8 0 0 0 .8-.8V1.8a.8.8 0 0 0-.8-.8H.8z"/>

            </svg>

            Login with Steam

        `;

        depositBtn.disabled = true;

        chanceDisplay.innerHTML = '<p>Login to participate</p>';

    }

}



// Update round UI

function updateRoundUI() {

    if (!currentRound) return;

    

    // Update jackpot value

    jackpotValue.textContent = `Current Pot: ${currentRound.totalValue.toFixed(2)}`;

    

    // Update timer

    updateTimerUI(currentRound.timeLeft);

    

    // Update participants list

    updateParticipantsList();

    

    // Update items grid

    updateItemsGrid();

    

    // Update wheel items

    updateWheelItems();

    

    // Update user's chance

    updateUserChance();

}



// Update timer UI

function updateTimerUI(timeLeft) {

    const minutes = Math.floor(timeLeft / 60);

    const seconds = timeLeft % 60;

    timerElement.textContent = `Next round: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

}



// Update participants list

function updateParticipantsList() {

    participantsList.innerHTML = '';

    

    if (!currentRound.participants || currentRound.participants.length === 0) {

        participantsList.innerHTML = '<p>No participants yet.</p>';

        return;

    }

    

    // Sort participants by item value (highest first)

    currentRound.participants.sort((a, b) => b.itemsValue - a.itemsValue);

    

    // Update participants list

    currentRound.participants.forEach(participant => {

        const participantElement = document.createElement('div');

        participantElement.style.display = 'flex';

        participantElement.style.alignItems = 'center';

        participantElement.style.justifyContent = 'space-between';

        participantElement.style.margin = '10px 0';

        

        const chance = (participant.tickets / currentRound.participants.reduce((sum, p) => sum + p.tickets, 0)) * 100;

        

        participantElement.innerHTML = `

            <div style="display: flex; align-items: center;">

                <img src="${participant.user.avatar}" alt="${participant.user.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px;">

                <span>${participant.user.username}</span>

            </div>

            <div>

                <span>${participant.itemsValue.toFixed(2)}</span>

                <span style="margin-left: 10px; color: #ccc;">(${chance.toFixed(2)}%)</span>

            </div>

        `;

        

        participantsList.appendChild(participantElement);

    });

    

    // Update participants count

    document.querySelector('.participants h3').textContent = `Participants (${currentRound.participants.length})`;

}



// Update items grid

function updateItemsGrid() {

    itemsGrid.innerHTML = '';

    

    if (!currentRound.items || currentRound.items.length === 0) {

        itemsGrid.innerHTML = '<div class="item-card"><p>No items yet.</p></div>';

        return;

    }

    

    // Update items grid

    currentRound.items.forEach(item => {

        const itemElement = document.createElement('div');

        itemElement.className = 'item-card';

        

        // Find owner

        const owner = currentRound.participants.find(p => p.user.id === item.owner);

        const ownerName = owner ? owner.user.username : 'Unknown';

        

        itemElement.innerHTML = `

            <img src="${item.image}" alt="${item.name}">

            <div class="item-name">${item.name}</div>

            <div class="item-price">${item.price.toFixed(2)}</div>

            <div style="font-size: 12px; color: #aaa;">${ownerName}</div>

        `;

        

        itemsGrid.appendChild(itemElement);

    });

    

    // Update total value display

    document.querySelector('.items-header div').textContent = `Total value: ${currentRound.totalValue.toFixed(2)}`;

}



// Update wheel items

function updateWheelItems() {

    wheelItems.innerHTML = '';

    

    if (!currentRound.participants || currentRound.participants.length === 0) {

        return;

    }

    

    // Create ticket array based on participant tickets

    let tickets = [];

    currentRound.participants.forEach(participant => {

        for (let i = 0; i < participant.tickets; i++) {

            tickets.push({

                userId: participant.user.id,

                username: participant.user.username,

                avatar: participant.user.avatar

            });

        }

    });

    

    // Shuffle tickets

    tickets = shuffleArray(tickets);

    

    // Create wheel items

    tickets.forEach(ticket => {

        const wheelItem = document.createElement('div');

        wheelItem.className = 'wheel-item';

        wheelItem.style.backgroundColor = currentUser && ticket.userId === currentUser._id ? '#2b5797' : '#d44100';

        wheelItem.innerHTML = `

            <img src="${ticket.avatar}" alt="${ticket.username}" style="border-radius: 50%;">

        `;

        

        wheelItems.appendChild(wheelItem);

    });

    

    // Clone some items to make the wheel appear infinite

    const itemsToClone = Math.min(20, tickets.length);

    for (let i = 0; i < itemsToClone; i++) {

        wheelItems.appendChild(wheelItems.children[i].cloneNode(true));

    }

}



// Update user's chance

function updateUserChance() {

    if (!currentUser || !currentRound || !currentRound.participants) {

        chanceDisplay.innerHTML = '<p>Login to participate</p>';

        return;

    }

    

    // Find user in participants

    const userParticipant = currentRound.participants.find(p => p.user.id === currentUser._id);

    

    if (!userParticipant) {

        chanceDisplay.innerHTML = '<p>You have not deposited any items yet.</p>';

        return;

    }

    

    // Calculate chance

    const totalTickets = currentRound.participants.reduce((sum, p) => sum + p.tickets, 0);

    const chance = (userParticipant.tickets / totalTickets) * 100;

    

    chanceDisplay.innerHTML = `

        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${chance.toFixed(2)}%</div>

        <div>Your items: ${userParticipant.itemsValue.toFixed(2)}</div>

    `;

}



// Animate winner selection

function animateWinner(winningTicket) {

    // Disable deposit button during animation

    depositBtn.disabled = true;

    

    // Change timer text

    timerElement.textContent = 'Selecting winner...';

    

    // Calculate position to scroll to

    const wheelWidth = wheelItems.scrollWidth;

    const targetPosition = Math.floor(Math.random() * (wheelWidth / 2)) + (wheelWidth / 2);

    

    // Animate the wheel

    wheelItems.style.transform = `translateX(-${targetPosition}px)`;

    

    // Re-enable deposit button after animation

    setTimeout(() => {

        depositBtn.disabled = false;

    }, 5000);

}



// Show winner notification

function showWinnerNotification(winner) {

    const notification = document.createElement('div');

    notification.style.position = 'fixed';

    notification.style.top = '50%';

    notification.style.left = '50%';

    notification.style.transform = 'translate(-50%, -50%)';

    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';

    notification.style.padding = '30px';

    notification.style.borderRadius = '10px';

    notification.style.textAlign = 'center';

    notification.style.zIndex = '2000';

    notification.style.color = 'white';

    notification.style.boxShadow = '0 0 50px var(--primary)';

    

    notification.innerHTML = `

        <h2 style="margin-bottom: 20px;">Winner!</h2>

        <img src="${winner.avatar}" alt="${winner.username}" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px;">

        <h3>${winner.username}</h3>

        <p style="margin-top: 10px;">Won ${currentRound.totalValue.toFixed(2)}</p>

        ${currentUser && winner.id === currentUser._id ? '<p style="color: var(--primary); margin-top: 15px;">Check your Steam trade offers!</p>' : ''}

    `;

    

    document.body.appendChild(notification);

    

    // Remove notification after a few seconds

    setTimeout(() => {

        notification.style.opacity = '0';

        notification.style.transition = 'opacity 1s ease';

        setTimeout(() => {

            document.body.removeChild(notification);

        }, 1000);

    }, 5000);

}



// Show a notification

function showNotification(title, message) {

    const notification = document.createElement('div');

    notification.style.position = 'fixed';

    notification.style.bottom = '20px';

    notification.style.right = '20px';

    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';

    notification.style.padding = '15px';

    notification.style.borderRadius = '5px';

    notification.style.zIndex = '2000';

    notification.style.color = 'white';

    notification.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

    notification.style.width = '300px';

    

    notification.innerHTML = `

        <h4 style="margin: 0 0 5px 0; color: var(--primary);">${title}</h4>

        <p style="margin: 0;">${message}</p>

    `;

    

    document.body.appendChild(notification);

    

    // Remove notification after a few seconds

    setTimeout(() => {

        notification.style.opacity = '0';

        notification.style.transition = 'opacity 0.5s ease';

        setTimeout(() => {

            document.body.removeChild(notification);

        }, 500);

    }, 5000);

}



// Load user inventory

async function loadUserInventory() {

    try {

        inventoryItems.innerHTML = '<p>Loading your inventory...</p>';

        

        const response = await fetch('/api/inventory');

        if (!response.ok) {

            throw new Error('Failed to load inventory');

        }

        

        userItems = await response.json();

        

        // Clear selected items

        selectedItems = [];

        

        // Display items

        displayInventoryItems();

    } catch (err) {

        console.error('Error loading inventory:', err);

        inventoryItems.innerHTML = `<p>Error loading inventory: ${err.message}</p>`;

    }

}



// Display inventory items

function displayInventoryItems() {

    inventoryItems.innerHTML = '';

    

    if (userItems.length === 0) {

        inventoryItems.innerHTML = '<p>No items found in your inventory.</p>';

        return;

    }

    

    // Sort items by price (highest first)

    userItems.sort((a, b) => b.price - a.price);

    

    // Create item elements

    userItems.forEach(item => {

        const itemElement = document.createElement('div');

        itemElement.className = 'item-card';

        itemElement.dataset.assetId = item.assetId;

        

        itemElement.innerHTML = `

            <img src="${item.image}" alt="${item.name}">

            <div class="item-name">${item.name}</div>

            <div class="item-price">${item.price.toFixed(2)}</div>

        `;

        

        // Add selection functionality

        itemElement.addEventListener('click', () => {

            toggleItemSelection(itemElement, item);

        });

        

        inventoryItems.appendChild(itemElement);

    });

}



// Toggle item selection

function toggleItemSelection(element, item) {

    const index = selectedItems.findIndex(i => i.assetId === item.assetId);

    

    if (index === -1) {

        // Add to selected items

        selectedItems.push(item);

        element.style.border = '2px solid var(--primary)';

    } else {

        // Remove from selected items

        selectedItems.splice(index, 1);

        element.style.border = '';

    }

    

    // Update confirm button text with total value

    const totalValue = selectedItems.reduce((sum, item) => sum + item.price, 0);

    document.getElementById('confirm-deposit').textContent = selectedItems.length > 0 ? 

        `Deposit Items (${totalValue.toFixed(2)})` : 'Confirm Deposit';

}



// Deposit selected items

async function depositItems() {

    try {

        if (selectedItems.length === 0) {

            showNotification('Error', 'Please select at least one item to deposit.');

            return;

        }

        

        // Check if user has set trade URL

        if (!currentUser.tradeUrl) {

            const tradeUrl = prompt('Please enter your Steam trade URL:');

            if (!tradeUrl) return;

            

            // Update trade URL

            await updateTradeUrl(tradeUrl);

        }

        

        // Send deposit request

        const response = await fetch('/api/deposit', {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json'

            },

            body: JSON.stringify({

                items: selectedItems

            })

        });

        

        if (!response.ok) {

            const error = await response.json();

            throw new Error(error.error || 'Failed to deposit items');

        }

        

        const result = await response.json();

        

        // Close modal

        document.getElementById('deposit-modal').style.display = 'none';

        

        // Show success notification

        showNotification('Deposit Initiated', 'Please check your Steam trade offers to complete the deposit.');

        

    } catch (err) {

        console.error('Error depositing items:', err);

        showNotification('Error', err.message);

    }

}



// Update trade URL

async function updateTradeUrl(tradeUrl) {

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

        currentUser.tradeUrl = result.tradeUrl;

        

        return result;

    } catch (err) {

        console.error('Error updating trade URL:', err);

        throw err;

    }

}



// Helper function to shuffle array

function shuffleArray(array) {

    const newArray = [...array];

    for (let i = newArray.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];

    }

    return newArray;

}



// Verify round fairness

async function verifyRound(roundId) {

    try {

        // Get round data from form

        const serverSeed = document.getElementById('server-seed').value;

        const clientSeed = document.getElementById('client-seed').value;

        

        if (!serverSeed || !clientSeed) {

            showNotification('Error', 'Please enter both server seed and client seed.');

            return;

        }

        

        // Send verification request

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

        

        if (!response.ok) {

            const error = await response.json();

            throw new Error(error.error || 'Failed to verify round');

        }

        

        const result = await response.json();

        

        // Display verification result

        const verificationResultElement = document.getElementById('verification-result');

        

        if (result.verified) {

            verificationResultElement.innerHTML = `

                <div style="color: green; margin-top: 15px;">

                    <strong>Verification Successful</strong>

                    <p>Round #${result.roundId} has been verified as fair.</p>

                    <p>Server Seed: ${result.serverSeed}</p>

                    <p>Server Seed Hash: ${result.serverSeedHash}</p>

                    <p>Client Seed: ${result.clientSeed}</p>

                    <p>Winning Ticket: ${result.winningTicket}</p>

                </div>

            `;

        } else {

            verificationResultElement.innerHTML = `

                <div style="color: red; margin-top: 15px;">

                    <strong>Verification Failed</strong>

                    <p>Reason: ${result.reason}</p>

                </div>

            `;

        }

    } catch (err) {

        console.error('Error verifying round:', err);

        showNotification('Error', err.message);

    }

}



// Event Listeners

document.addEventListener('DOMContentLoaded', () => {

    // Initialize app

    initApp();

    

    // Navigation

    document.getElementById('home-link').addEventListener('click', (e) => {

        e.preventDefault();

        document.getElementById('home-page').style.display = 'block';

        document.getElementById('faq-page').style.display = 'none';

        document.getElementById('fair-page').style.display = 'none';

    });

    

    document.getElementById('faq-link').addEventListener('click', (e) => {

        e.preventDefault();

        document.getElementById('home-page').style.display = 'none';

        document.getElementById('faq-page').style.display = 'block';

        document.getElementById('fair-page').style.display = 'none';

    });

    

    document.getElementById('fair-link').addEventListener('click', (e) => {

        e.preventDefault();

        document.getElementById('home-page').style.display = 'none';

        document.getElementById('faq-page').style.display = 'none';

        document.getElementById('fair-page').style.display = 'block';

    });

    

    // Login button

    loginBtn.addEventListener('click', () => {

        if (!currentUser) {

            window.location.href = '/auth/steam';

        }

    });

    

    // Deposit button

    depositBtn.addEventListener('click', () => {

        if (!currentUser) {

            showNotification('Error', 'Please login first.');

            return;

        }

        

        document.getElementById('deposit-modal').style.display = 'flex';

        loadUserInventory();

    });

    

    // Close deposit modal

    document.getElementById('close-deposit-modal').addEventListener('click', () => {

        document.getElementById('deposit-modal').style.display = 'none';

    });

    

    // Confirm deposit button

    document.getElementById('confirm-deposit').addEventListener('click', depositItems);

    

    // Close modal when clicking outside

    window.addEventListener('click', (e) => {

        const modal = document.getElementById('deposit-modal');

        if (e.target === modal) {

            modal.style.display = 'none';

        }

    });

});
