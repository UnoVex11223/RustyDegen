if (e.target === depositModal) {
            hideModal(depositModal);
        }
        if (e.target === tradeUrlModal) {
            hideModal(tradeUrlModal);
        }
    });
}

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
                <div class="item-value">${item.price.toFixed(2)}</div>
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
                <div class="selected-item-value">${item.price.toFixed(2)}</div>
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
    totalValue.textContent = `${total.toFixed(2)}`;
    
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
    potValue.textContent = `${currentRound.totalValue.toFixed(2)}`;
    
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
        participantsContainer.appendChild(emptyPotMessage);
        return;
    }
    
    // Add participants
    participants.forEach(participant => {
        // Find user's items
        const userItems = currentRound.items ? currentRound.items.filter(item => 
            item.owner && item.owner.toString() === participant.user.id.toString()
        ) : [];
        
        const participantElement = createParticipantElement(participant, userItems);
        participantsContainer.appendChild(participantElement);
    });
}

// Update a single participant
function updateParticipantUI(data) {
    // Update total pot value
    currentRound.totalValue = data.totalValue;
    potValue.textContent = `${data.totalValue.toFixed(2)}`;
    
    // Check if participant already exists
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
    
    // Add new participant if not found
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
                    <span class="participant-value">${participant.itemsValue.toFixed(2)}</span>
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
                <span class="item-value">${item.price.toFixed(2)}</span>
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

// Test Roulette Animation
function testRouletteAnimation() {
    // Create test data if no current round exists
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
                    tickets: 1857
                },
                {
                    user: {
                        id: 'test_user_2',
                        username: 'Lisqo',
                        avatar: 'https://avatars.steamstatic.com/bb8a0a497b4b1f46b96b6b0775e9368fc8c5c3b4_full.jpg'
                    },
                    itemsValue: 7.39,
                    tickets: 74
                },
                {
                    user: {
                        id: 'test_user_3',
                        username: 'simon50110',
                        avatar: 'https://avatars.steamstatic.com/3c4c5a7c9968414c3a1ddd1e73cb8e6aeeec5f32_full.jpg'
                    },
                    itemsValue: 1.04,
                    tickets: 10
                }
            ],
            items: []
        };
        
        // Update UI to reflect test data
        potValue.textContent = `${currentRound.totalValue.toFixed(2)}`;
        participantCount.textContent = `${currentRound.participants.length}/200`;
        
        // Update participants container
        updateParticipantsUI();
    }
    
    // Choose a random winner from participants
    const winnerIndex = Math.floor(Math.random() * currentRound.participants.length);
    const winner = currentRound.participants[winnerIndex];
    
    // Create winner data
    const winnerData = {
        roundId: currentRound.roundId,
        winner: winner.user,
        winningTicket: Math.floor(Math.random() * winner.tickets)
    };
    
    // Switch to roulette view and start animation
    switchToRouletteView();
    startRouletteAnimation(winnerData);
}

// Start roulette animation
function startRouletteAnimation(winnerData) {
    isSpinning = true;
    winnerInfo.style.display = 'none';
    returnToJackpot.style.display = 'none';
    clearConfetti();
    
    // Create roulette items from participants
    createRouletteItems();
    
    // Find or create winner element
    const winner = findWinnerFromData(winnerData);
    console.log('Selected Winner:', winner);
    
    // Play spin sound
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play().catch(e => console.error('Error playing sound:', e));
    }
    
    // Show roulette track
    setTimeout(() => {
        // Find a winning item element on the track
        const items = document.querySelectorAll('.roulette-item');
        if (items.length === 0) {
            console.error('Cannot spin, no items in track');
            isSpinning = false;
            resetToJackpotView();
            return;
        }
        
        const targetIndex = findTargetItemIndex(items, winner.user.id);
        const winningElement = items[targetIndex];
        
        if (!winningElement) {
            console.error('Could not find winning element on track');
            isSpinning = false;
            resetToJackpotView();
            return;
        }
        
        // Calculate stopping position
        const containerWidth = inlineRoulette.querySelector('.roulette-container').offsetWidth;
        const itemWidth = winningElement.offsetWidth;
        const itemOffset = winningElement.offsetLeft;
        
        // Position winning item in the center
        const targetPosition = -(itemOffset + (itemWidth / 2) - (containerWidth / 2));
        
        // Apply animation
        rouletteTrack.style.transition = `transform ${SPIN_DURATION_SECONDS}s cubic-bezier(0.08, 0.82, 0.17, 1)`;
        rouletteTrack.style.transform = `translateX(${targetPosition}px)`;
        
        // Handle end of animation
        setTimeout(() => {
            handleSpinEnd(winningElement, winner);
        }, SPIN_DURATION_SECONDS * 1000);
    }, 500);
}

// Find winner from winner data
function findWinnerFromData(winnerData) {
    return {
        user: {
            id: winnerData.winner.id,
            username: winnerData.winner.username,
            avatar: winnerData.winner.avatar
        },
        percentage: currentRound.participants.find(p => p.user.id === winnerData.winner.id)?.itemsValue / currentRound.totalValue * 100 || 0,
        value: currentRound.participants.find(p => p.user.id === winnerData.winner.id)?.itemsValue || 0
    };
}

// Find target item index
function findTargetItemIndex(items, winnerId) {
    // Look for winner items between 60% and 90% of the track
    const minIndex = Math.floor(items.length * 0.6);
    const maxIndex = Math.floor(items.length * 0.9);
    
    const possibleIndices = [];
    for (let i = minIndex; i < maxIndex; i++) {
        if (items[i] && items[i].dataset.userId === winnerId) {
            possibleIndices.push(i);
        }
    }
    
    if (possibleIndices.length > 0) {
        // Return random index from possible ones
        return possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
    }
    
    // Fallback - find any winner item
    for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].dataset.userId === winnerId) {
            return i;
        }
    }
    
    // Ultimate fallback - just use an index near the end
    return Math.floor(items.length * 0.8);
}

// Handle end of spin animation
function handleSpinEnd(winningElement, winner) {
    isSpinning = false;
    
    // Highlight winner
    winningElement.classList.add('winner');
    
    // Show winner info after delay
    setTimeout(() => {
        // Set winner info
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
    }, 1000);
}

// Reset to jackpot view
function resetToJackpotView() {
    // Hide roulette and winner info
    inlineRoulette.style.display = 'none';
    winnerInfo.style.display = 'none';
    returnToJackpot.style.display = 'none';
    
    // Clear winner highlight and confetti
    const winnerElement = document.querySelector('.roulette-item.winner');
    if (winnerElement) {
        winnerElement.classList.remove('winner');
    }
    clearConfetti();
    
    // Reset roulette track
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';
    
    // Show jackpot header
    jackpotHeader.style.display = 'flex';
}

// Create roulette items
function createRouletteItems() {
    rouletteTrack.innerHTML = '';
    rouletteTrack.style.transition = 'none';
    rouletteTrack.style.transform = 'translateX(0)';
    
    if (!currentRound || !currentRound.participants || currentRound.participants.length === 0) {
        console.error('No participants for roulette');
        return;
    }
    
    // Create a pool of items based on tickets
    let itemsPool = [];
    
    currentRound.participants.forEach(participant => {
        // Calculate tickets (1 per $0.10)
        const tickets = Math.floor(participant.itemsValue * 10);
        
        // Add items to pool based on tickets
        for (let i = 0; i < tickets; i++) {
            itemsPool.push(participant);
        }
    });
    
    // Shuffle pool for more randomness
    itemsPool = shuffleArray(itemsPool);
    
    // Create items with repetitions
    const fragment = document.createDocumentFragment();
    
    for (let r = 0; r < ROULETTE_REPETITIONS; r++) {
        for (let i = 0; i < itemsPool.length; i++) {
            const participant = itemsPool[i];
            const colorClass = `item-${(i % 5) + 1}`;
            
            const item = document.createElement('div');
            item.className = `roulette-item ${colorClass}`;
            item.dataset.userId = participant.user.id;
            
            const picContainer = document.createElement('div');
            picContainer.className = 'profile-pic-container';
            
            const img = document.createElement('img');
            img.className = 'roulette-avatar';
            img.src = participant.user.avatar || '/img/default-avatar.png';
            img.alt = participant.user.username;
            img.onerror = () => { img.src = '/img/default-avatar.png'; };
            
            picContainer.appendChild(img);
            
            const infoContainer = document.createElement('div');
            infoContainer.className = 'roulette-info';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'roulette-name';
            nameSpan.textContent = participant.user.username;
            
            const percentSpan = document.createElement('span');
            percentSpan.className = 'roulette-percentage';
            const percentage = currentRound.totalValue > 0 ? 
                ((participant.itemsValue / currentRound.totalValue) * 100).toFixed(2) : 
                '0.00';
            percentSpan.textContent = `${percentage}%`;
            
            infoContainer.appendChild(nameSpan);
            infoContainer.appendChild(percentSpan);
            
            item.appendChild(picContainer);
            item.appendChild(infoContainer);
            
            fragment.appendChild(item);
        }
    }
    
    rouletteTrack.appendChild(fragment);
}

// Launch confetti
function launchConfetti() {
    clearConfetti();
    
    const colors = ['#00ffaa', '#33ccff', '#9933ff', '#ffcc00', '#ff3366', '#ffffff'];
    
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random position
        confetti.style.left = `${Math.random() * 100}%`;
        
        // Random color
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Random size
        const size = Math.random() * 8 + 5;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        
        // Random shape (circle or square)
        if (Math.random() > 0.5) {
            confetti.style.borderRadius = '50%';
        }
        
        // Random animation delay and duration
        confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;
        confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        
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
            return;
        }
        
        // Add rounds to table
        data.rounds.forEach(round => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(round.endTime);
            const formattedDate = date.toLocaleString();
            
            row.innerHTML = `
                <td>${round.roundId}</td>
                <td>${formattedDate}</td>
                <td>${round.totalValue.toFixed(2)}</td>
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
    
    roundsPagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.className = 'page-button';
        prevButton.textContent = 'Previous';
        prevButton.addEventListener('click', () => loadPastRounds(currentPage - 1));
        roundsPagination.appendChild(prevButton);
    }
    
    // Page buttons
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `page-button ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => loadPastRounds(i));
        roundsPagination.appendChild(pageButton);
    }
    
    // Next button
    if (currentPage < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.className = 'page-button';
        nextButton.textContent = 'Next';
        nextButton.addEventListener('click', () => loadPastRounds(currentPage + 1));
        roundsPagination.appendChild(nextButton);
    }
}

// Verify round fairness
function verifyRound() {
    const roundId = document.getElementById('round-id').value;
    const serverSeed = document.getElementById('server-seed').value;
    const clientSeed = document.getElementById('client-seed').value;
    
    const verificationResult = document.getElementById('verification-result');
    
    if (!roundId || !serverSeed || !clientSeed) {
        verificationResult.style.display = 'block';
        verificationResult.style.color = 'red';
        verificationResult.textContent = 'Please fill in all fields';
        return;
    }
    
    try {
        verificationResult.style.display = 'block';
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
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Verification failed');
        }
        
        const result = await response.json();
        
        verificationResult.style.color = result.verified ? 'green' : 'red';
        
        if (result.verified) {
            verificationResult.innerHTML = `
                <div style="color: green">
                    <strong>Verification Successful!</strong>
                    <p>Round #${result.roundId} has been verified as fair.</p>
                    <p><strong>Server Seed:</strong> ${result.serverSeed}</p>
                    <p><strong>Server Seed Hash:</strong> ${result.serverSeedHash}</p>
                    <p><strong>Client Seed:</strong> ${result.clientSeed}</p>
                    <p><strong>Winning Ticket:</strong> ${result.winningTicket}</p>
                </div>
            `;
        } else {
            verificationResult.innerHTML = `
                <div style="color: red">
                    <strong>Verification Failed!</strong>
                    <p>Reason: ${result.reason}</p>
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
    
    if (page === homePage) {
        homeLink.classList.add('active');
    } else if (page === faqPage) {
        faqLink.classList.add('active');
    } else if (page === fairPage) {
        fairLink.classList.add('active');
        loadPastRounds();
    }
}

function showModal(modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function hideModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
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
    
    // Style notification
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.width = '300px';
    notification.style.backgroundColor = 'var(--background-medium)';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
    notification.style.overflow = 'hidden';
    notification.style.zIndex = '9999';
    notification.style.animation = 'slideIn 0.3s ease';
    
    // Style header
    notification.querySelector('.notification-header').style.padding = '10px 15px';
    notification.querySelector('.notification-header').style.backgroundColor = 'var(--background-light)';
    notification.querySelector('.notification-header').style.display = 'flex';
    notification.querySelector('.notification-header').style.justifyContent = 'space-between';
    notification.querySelector('.notification-header').style.alignItems = 'center';
    notification.querySelector('.notification-header strong').style.color = 'var(--primary-color)';
    
    // Style close button
    notification.querySelector('.close-notification').style.background = 'none';
    notification.querySelector('.close-notification').style.border = 'none';
    notification.querySelector('.close-notification').style.color = 'var(--text-secondary)';
    notification.querySelector('.close-notification').style.fontSize = '20px';
    notification.querySelector('.close-notification').style.cursor = 'pointer';
    
    // Style body
    notification.querySelector('.notification-body').style.padding = '15px';
    
    // Add keyframes for animation
    if (!document.getElementById('notification-keyframes')) {
        const style = document.createElement('style');
        style.id = 'notification-keyframes';
        style.innerHTML = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Close notification on click
    notification.querySelector('.close-notification').addEventListener('click', () => {
        closeNotification(notification);
    });
    
    // Auto close after 5 seconds
    setTimeout(() => {
        closeNotification(notification);
    }, 5000);
}

function closeNotification(notification) {
    notification.style.animation = 'slideOut 0.3s ease forwards';
    
    setTimeout(() => {
        notification.remove();
    }, 300);
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Expose some functions to global scope for button onclick handlers
window.showRoundDetails = function(roundId) {
    // Implement round details modal
    showNotification('Round Details', `Round details for #${roundId} would be shown here`);
};// Connect to socket.io server
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

// DOM Elements - Test Button
const testSpinButton = document.getElementById('testSpinButton');

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
    
    // Test Spin Button
    if (testSpinButton) {
        testSpinButton.addEventListener('click', testRouletteAnimation);
    }
    
    // Provably Fair
    if (verifyBtn) {
        verifyBtn.addEventListener('click', verifyRound);
    }
    
    // Handle clicks outside modals
    window.addEventListener('click', (e) => {
        if (e.target === depositModal) {
