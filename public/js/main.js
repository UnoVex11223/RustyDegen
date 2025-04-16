// Complete main.js with item deposit logic integrated

// DOM Elements - Global references
let loginButton, userProfile, userAvatar, userName, showDepositModal, depositModal;
let closeDepositModal, ageVerificationModal, agreeCheckbox, agreeButton;
let tradeUrlModal, closeTradeUrlModal, saveTradeUrl, tradeUrlInput;
let testSpinButton, inlineRoulette, jackpotHeader, depositBtnContainer;
let returnToJackpot, rouletteTrack, winnerInfo, winnerAvatar, winnerName;
let winnerDeposit, winnerChance, spinSound, confettiContainer;
let timerValue, potValue, participantCount, timerForeground;
let itemsContainer, emptyPotMessage;
let jackpotLink, faqLink, fairLink, aboutLink, roadmapLink;
let homePage, faqPage, fairPage, aboutPage, roadmapPage;
let inventoryItems, selectedItems, totalValueDisplay, depositButton;

// Timer variables
let timerInterval;
let timerSeconds = 120;
const timerDuration = 120;
let timerCircumference;

// Sample test users for demonstration
const testUsers = [
    { id: 1, name: 'RustPlayer123', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg', color: '#00e676' },
    { id: 2, name: 'SkinCollector', avatar: 'https://avatars.steamstatic.com/8a9586a31c4adf176236b8c36afe3a59e97cda97_full.jpg', color: '#ff9100' },
    { id: 3, name: 'RustLord', avatar: 'https://avatars.steamstatic.com/5c0c7c7c9d1af8c1e631e08b9d915c835abe3f09_full.jpg', color: '#2196f3' }
];

// Sample test items for demonstration
const testItems = [
    { id: 101, name: 'AK-47 | Alien Red', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPrxN7LEmyVQ7MEpiLuSrYmnjQO3-UdsZGHyd4_Bd1RvNQ7T_FDrw-_ng5Pu75iY1zI97bhLsvQz', value: 45.00, userId: 1 },
    { id: 102, name: 'Metal Chest Plate', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopbuyLgNv1fX3cih9_92hkYSEkfHLPb7ShGRc6ctyj_v--YXygED6_BVlZDv3LYCWJAFoMFnU_gC5xb_o0JC5tJrMwHBmuiQh4X_D30vgBTYQHg', value: 5.20, userId: 1 },
    { id: 103, name: 'Semi-Automatic Rifle', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV08u_mpSOhcj5Nr_Yg2YfvJIniO3HpNrw0Ae2-Us_Mj_3doKTcAQ9MFjW-1K8xOvn1pW-6JrB1zI97QYLQKgV', value: 10.00, userId: 2 },
    { id: 104, name: 'Garage Door', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopbuyLgNv1fX3cih9_92hkYSEkfHLPb7ShGRc6ctyj_v--YXygED6_BVlZDv3LYCWJAFoMFnU_gC5xb_o0JC5tJrMwHBmuiQh4X_D30vgBTYQHg', value: 3.50, userId: 2 },
    { id: 105, name: 'Assault Rifle', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV08-3hJCDnuXxDLbQhGld7cxrj-3--YXygED6_BVvMWrwctKdcAZqZVrW_lG_kLzq0cK-vJjOwHNn7HEgsHmMmR2_1BlFafsv26JVbZUXsA', value: 8.50, userId: 3 },
    { id: 106, name: 'Metal Facemask', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopbuyLgNv1fX3cih9_92hkYSEkfHLPb7ShGRc6ctyj_v--YXygED6_BVlZDv3LYCWJAFoMFnU_gC5xb_o0JC5tJrMwHBmuiQh4X_D30vgBTYQHg', value: 6.00, userId: 3 }
];

// User inventory for deposit selection
let userInventory = [
    { id: 201, name: 'AK-47 | Tempered Steel', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPrxN7LEmyVQ7MEpiLuSrYmnjQO3-UdsZGHyd4_Bd1RvNQ7T_FDrw-_ng5Pu75iY1zI97bhLsvQz', value: 35.50, selected: false },
    { id: 202, name: 'Garage Door | Blackout', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopbuyLgNv1fX3cih9_92hkYSEkfHLPb7ShGRc6ctyj_v--YXygED6_BVlZDv3LYCWJAFoMFnU_gC5xb_o0JC5tJrMwHBmuiQh4X_D30vgBTYQHg', value: 4.20, selected: false },
    { id: 203, name: 'Thompson | Rust Raider', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV08u_mpSOhcj5Nr_Yg2YfvJIniO3HpNrw0Ae2-Us_Mj_3doKTcAQ9MFjW-1K8xOvn1pW-6JrB1zI97QYLQKgV', value: 8.75, selected: false },
    { id: 204, name: 'Hoodie | Rust Rebel', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopbuyLgNv1fX3cih9_92hkYSEkfHLPb7ShGRc6ctyj_v--YXygED6_BVlZDv3LYCWJAFoMFnU_gC5xb_o0JC5tJrMwHBmuiQh4X_D30vgBTYQHg', value: 5.30, selected: false },
    { id: 205, name: 'Python Revolver | Outlaw', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV08-3hJCDnuXxDLbQhGld7cxrj-3--YXygED6_BVvMWrwctKdcAZqZVrW_lG_kLzq0cK-vJjOwHNn7HEgsHmMmR2_1BlFafsv26JVbZUXsA', value: 12.40, selected: false },
    { id: 206, name: 'Metal Facemask | Rust Hunter', image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopbuyLgNv1fX3cih9_92hkYSEkfHLPb7ShGRc6ctyj_v--YXygED6_BVlZDv3LYCWJAFoMFnU_gC5xb_o0JC5tJrMwHBmuiQh4X_D30vgBTYQHg', value: 7.80, selected: false }
];

// Selected items for deposit
let selectedItemsArray = [];

// Initialize all DOM elements on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM element references
    initializeDOMElements();
    
    // Set initial timer stroke dasharray
    timerCircumference = 2 * Math.PI * 42; // 42 is the radius of the circle
    timerForeground.style.strokeDasharray = `${timerCircumference} ${timerCircumference}`;
    timerForeground.style.strokeDashoffset = '0';
    
    // Set up event listeners
    setupEventListeners();
    
    // Check if age verification is needed
    if (ageVerificationModal && !localStorage.getItem('ageVerified')) {
        ageVerificationModal.style.display = 'flex';
    }
    
    // Start timer on page load
    startTimer();
});

// Initialize all DOM element references
function initializeDOMElements() {
    // User interface elements
    loginButton = document.getElementById('loginButton');
    userProfile = document.getElementById('userProfile');
    userAvatar = document.getElementById('userAvatar');
    userName = document.getElementById('userName');
    
    // Modal elements
    showDepositModal = document.getElementById('showDepositModal');
    depositModal = document.getElementById('depositModal');
    closeDepositModal = document.getElementById('closeDepositModal');
    ageVerificationModal = document.getElementById('ageVerificationModal');
    agreeCheckbox = document.getElementById('agreeCheckbox');
    agreeButton = document.getElementById('agreeButton');
    tradeUrlModal = document.getElementById('tradeUrlModal');
    closeTradeUrlModal = document.getElementById('closeTradeUrlModal');
    saveTradeUrl = document.getElementById('saveTradeUrl');
    tradeUrlInput = document.getElementById('tradeUrlInput');
    
    // Deposit modal elements
    inventoryItems = document.getElementById('inventory-items');
    selectedItems = document.getElementById('selectedItems');
    totalValueDisplay = document.getElementById('totalValue');
    depositButton = document.getElementById('depositButton');
    
    // Jackpot and roulette elements
    testSpinButton = document.getElementById('testSpinButton');
    inlineRoulette = document.getElementById('inlineRoulette');
    jackpotHeader = document.getElementById('jackpotHeader');
    depositBtnContainer = document.getElementById('depositBtnContainer');
    returnToJackpot = document.getElementById('returnToJackpot');
    rouletteTrack = document.getElementById('rouletteTrack');
    
    // Winner info elements
    winnerInfo = document.getElementById('winnerInfo');
    winnerAvatar = document.getElementById('winnerAvatar');
    winnerName = document.getElementById('winnerName');
    winnerDeposit = document.getElementById('winnerDeposit');
    winnerChance = document.getElementById('winnerChance');
    spinSound = document.getElementById('spinSound');
    confettiContainer = document.getElementById('confettiContainer');
    
    // Timer and stats elements
    timerValue = document.getElementById('timerValue');
    potValue = document.getElementById('potValue');
    participantCount = document.getElementById('participantCount');
    timerForeground = document.querySelector('.timer-foreground');
    
    // Items container elements
    itemsContainer = document.getElementById('itemsContainer');
    emptyPotMessage = document.getElementById('emptyPotMessage');
    
    // Navigation links
    jackpotLink = document.querySelector('.main-nav a.active');
    faqLink = document.getElementById('faq-link');
    fairLink = document.getElementById('fair-link');
    aboutLink = document.getElementById('about-link');
    roadmapLink = document.getElementById('roadmap-link');
    
    // Pages
    homePage = document.getElementById('home-page');
    faqPage = document.getElementById('faq-page');
    fairPage = document.getElementById('provably-fair-page');
    aboutPage = document.getElementById('about-page');
    roadmapPage = document.getElementById('roadmap-page');
}

// Set up all event listeners
function setupEventListeners() {
    // Navigation event listeners
    setupNavigationListeners();
    
    // Age verification modal
    if (agreeCheckbox) {
        agreeCheckbox.addEventListener('change', function() {
            agreeButton.disabled = !this.checked;
        });
    }
    
    if (agreeButton) {
        agreeButton.addEventListener('click', function() {
            ageVerificationModal.style.display = 'none';
            localStorage.setItem('ageVerified', 'true');
        });
    }
    
    // Login button
    if (loginButton) {
        loginButton.addEventListener('click', function() {
            // Simulate login
            loginButton.style.display = 'none';
            userProfile.style.display = 'flex';
            userAvatar.src = testUsers[0].avatar;
            userName.textContent = testUsers[0].name;
        });
    }
    
    // Deposit modal
    if (showDepositModal) {
        showDepositModal.addEventListener('click', function() {
            // Check if user is logged in
            if (loginButton.style.display !== 'none') {
                alert('Please log in to deposit items.');
                return;
            }
            
            // Check if trade URL is set
            if (!localStorage.getItem('tradeUrl')) {
                tradeUrlModal.style.display = 'flex';
                return;
            }
            
            // Load user inventory
            loadUserInventory();
            
            // Reset selected items
            selectedItemsArray = [];
            selectedItems.innerHTML = '<div class="empty-selection">No items selected</div>';
            totalValueDisplay.textContent = '$0.00';
            depositButton.disabled = true;
            
            depositModal.style.display = 'flex';
        });
    }
    
    if (closeDepositModal) {
        closeDepositModal.addEventListener('click', function() {
            depositModal.style.display = 'none';
        });
    }
    
    // Trade URL modal
    if (closeTradeUrlModal) {
        closeTradeUrlModal.addEventListener('click', function() {
            tradeUrlModal.style.display = 'none';
        });
    }
    
    if (saveTradeUrl) {
        saveTradeUrl.addEventListener('click', function() {
            const tradeUrl = tradeUrlInput.value.trim();
            if (tradeUrl) {
                localStorage.setItem('tradeUrl', tradeUrl);
                tradeUrlModal.style.display = 'none';
                
                // Load user inventory
                loadUserInventory();
                
                depositModal.style.display = 'flex';
            } else {
                alert('Please enter a valid trade URL.');
            }
        });
    }
    
    // Deposit button
    if (depositButton) {
        depositButton.addEventListener('click', function() {
            if (selectedItemsArray.length === 0) {
                alert('Please select at least one item to deposit.');
                return;
            }
            
            // Close deposit modal
            depositModal.style.display = 'none';
            
            // Show trade request notification
            showTradeRequestNotification();
            
            // Simulate trade acceptance after a delay
            setTimeout(function() {
                // Process the deposit
                processDeposit(selectedItemsArray);
                
                // Reset selected items
                selectedItemsArray = [];
            }, 3000);
        });
    }
    
    // Return to jackpot button
    if (returnToJackpot) {
        returnToJackpot.addEventListener('click', function() {
            inlineRoulette.style.display = 'none';
            jackpotHeader.classList.remove('roulette-mode');
            depositBtnContainer.style.display = 'block';
            winnerInfo.style.display = 'none';
            returnToJackpot.style.display = 'none';
            confettiContainer.innerHTML = '';
            
            // Reset roulette track
            rouletteTrack.style.transition = 'none';
            rouletteTrack.style.transform = 'translateX(0)';
            
            // Clear items container
            itemsContainer.innerHTML = '';
            emptyPotMessage.style.display = 'block';
            
            // Reset pot value and participant count
            potValue.textContent = '$0.00';
            participantCount.textContent = '0/200';
            
            // Restart timer
            startTimer();
        });
    }
    
    // Test spin button
    if (testSpinButton) {
        testSpinButton.addEventListener('click', function() {
            startRoulette();
        });
        
        // Add double-click event for testing item display
        testSpinButton.addEventListener('dblclick', function() {
            displayAllTestItems();
        });
    }
}

// Set up navigation event listeners
function setupNavigationListeners() {
    if (faqLink) {
        faqLink.addEventListener('click', function(e) {
            e.preventDefault();
            homePage.style.display = 'none';
            faqPage.style.display = 'block';
            fairPage.style.display = 'none';
            aboutPage.style.display = 'none';
            roadmapPage.style.display = 'none';
            
            // Update active link
            jackpotLink.classList.remove('active');
            faqLink.classList.add('active');
            fairLink.classList.remove('active');
            aboutLink.classList.remove('active');
            roadmapLink.classList.remove('active');
        });
    }
    
    if (fairLink) {
        fairLink.addEventListener('click', function(e) {
            e.preventDefault();
            homePage.style.display = 'none';
            faqPage.style.display = 'none';
            fairPage.style.display = 'block';
            aboutPage.style.display = 'none';
            roadmapPage.style.display = 'none';
            
            // Update active link
            jackpotLink.classList.remove('active');
            faqLink.classList.remove('active');
            fairLink.classList.add('active');
            aboutLink.classList.remove('active');
            roadmapLink.classList.remove('active');
        });
    }
    
    if (aboutLink) {
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            homePage.style.display = 'none';
            faqPage.style.display = 'none';
            fairPage.style.display = 'none';
            aboutPage.style.display = 'block';
            roadmapPage.style.display = 'none';
            
            // Update active link
            jackpotLink.classList.remove('active');
            faqLink.classList.remove('active');
            fairLink.classList.remove('active');
            aboutLink.classList.add('active');
            roadmapLink.classList.remove('active');
        });
    }
    
    if (roadmapLink) {
        roadmapLink.addEventListener('click', function(e) {
            e.preventDefault();
            homePage.style.display = 'none';
            faqPage.style.display = 'none';
            fairPage.style.display = 'none';
            aboutPage.style.display = 'none';
            roadmapPage.style.display = 'block';
            
            // Update active link
            jackpotLink.classList.remove('active');
            faqLink.classList.remove('active');
            fairLink.classList.remove('active');
            aboutLink.classList.remove('active');
            roadmapLink.classList.add('active');
        });
    }
    
    if (jackpotLink) {
        jackpotLink.addEventListener('click', function(e) {
            e.preventDefault();
            homePage.style.display = 'block';
            faqPage.style.display = 'none';
            fairPage.style.display = 'none';
            aboutPage.style.display = 'none';
            roadmapPage.style.display = 'none';
            
            // Update active link
            jackpotLink.classList.add('active');
            faqLink.classList.remove('active');
            fairLink.classList.remove('active');
            aboutLink.classList.remove('active');
            roadmapLink.classList.remove('active');
        });
    }
}

// Timer functions
function startTimer() {
    clearInterval(timerInterval);
    timerSeconds = timerDuration;
    timerValue.textContent = timerSeconds;
    timerForeground.style.strokeDashoffset = '0';
    
    timerInterval = setInterval(function() {
        timerSeconds--;
        timerValue.textContent = timerSeconds;
        
        // Update timer circle
        const progress = timerSeconds / timerDuration;
        const dashoffset = timerCircumference * (1 - progress);
        timerForeground.style.strokeDashoffset = dashoffset;
        
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            startRoulette();
        }
    }, 1000);
}

// Roulette functions
function startRoulette() {
    inlineRoulette.style.display = 'block';
    jackpotHeader.classList.add('roulette-mode');
    depositBtnContainer.style.display = 'none';
    
    // Create roulette items
    createRouletteItems();
    
    // Play sound
    if (spinSound) {
        spinSound.play().catch(e => console.log('Sound play error:', e));
    }
    
    // Animate roulette
    setTimeout(function() {
        const trackWidth = rouletteTrack.scrollWidth;
        const containerWidth = rouletteTrack.parentElement.offsetWidth;
        const randomOffset = Math.random() * 80 - 40; // Random offset for more natural landing
        
        // Calculate final position to land on winner (middle item)
        const finalPosition = -(trackWidth - containerWidth) / 2 + randomOffset;
        
        // Animate the track
        rouletteTrack.style.transition = 'transform 8s cubic-bezier(0.1, 0.7, 0.1, 1)';
        rouletteTrack.style.transform = `translateX(${finalPosition}px)`;
        
        // Show winner after animation
        setTimeout(showWinner, 8500);
    }, 500);
}

function createRouletteItems() {
    // Clear existing items
    rouletteTrack.innerHTML = '';
    
    // Get all users who have deposited items
    const users = getDepositUsers();
    
    if (users.length === 0) {
        // If no users, use test users
        users.push(...testUsers);
    }
    
    // Calculate total pot value
    const totalPotValue = parseFloat(potValue.textContent.replace('$', ''));
    
    // Create a large number of items for smooth animation
    const itemCount = 100;
    
    // Select a random winner
    const winnerIndex = Math.floor(Math.random() * users.length);
    const winner = users[winnerIndex];
    
    // Create roulette items
    for (let i = 0; i < itemCount; i++) {
        // Distribute users evenly, but ensure winner is in the middle
        const userIndex = (i === Math.floor(itemCount / 2)) ? winnerIndex : (i % users.length);
        const user = users[userIndex];
        
        // Create roulette item
        const item = document.createElement('div');
        item.className = 'roulette-item';
        item.style.borderColor = user.color;
        
        // Create avatar
        const avatar = document.createElement('img');
        avatar.src = user.avatar;
        avatar.alt = user.name;
        avatar.className = 'roulette-avatar';
        
        // Create name
        const name = document.createElement('div');
        name.className = 'roulette-name';
        name.textContent = user.name;
        
        // Append elements
        item.appendChild(avatar);
        item.appendChild(name);
        rouletteTrack.appendChild(item);
        
        // Store winner data
        if (i === Math.floor(itemCount / 2)) {
            // Calculate winner's deposit value and chance
            const winnerItems = getItemsByUser(winner.id);
            const winnerValue = winnerItems.reduce((sum, item) => sum + item.value, 0);
            const winnerChanceValue = totalPotValue > 0 ? (winnerValue / totalPotValue * 100) : 0;
            
            // Store for later use
            winner.depositValue = winnerValue;
            winner.chance = winnerChanceValue;
        }
    }
}

function showWinner() {
    // Get the middle item (winner)
    const items = rouletteTrack.querySelectorAll('.roulette-item');
    const middleIndex = Math.floor(items.length / 2);
    const winnerItem = items[middleIndex];
    
    // Get winner data from the item
    const winnerName = winnerItem.querySelector('.roulette-name').textContent;
    const winnerAvatar = winnerItem.querySelector('.roulette-avatar').src;
    const winnerColor = winnerItem.style.borderColor;
    
    // Find the winner in users array
    const winner = testUsers.find(user => user.name === winnerName);
    
    // Update winner info
    this.winnerAvatar.src = winnerAvatar;
    this.winnerName.textContent = winnerName;
    this.winnerDeposit.textContent = formatCurrency(winner.depositValue || 0);
    this.winnerChance.textContent = (winner.chance || 0).toFixed(2) + '%';
    
    // Show winner info
    winnerInfo.style.display = 'flex';
    returnToJackpot.style.display = 'block';
    
    // Create confetti
    createConfetti();
}

function createConfetti() {
    confettiContainer.innerHTML = '';
    
    // Create confetti pieces
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random properties
        const size = Math.random() * 10 + 5;
        const color = getRandomColor();
        const left = Math.random() * 100;
        const animationDuration = Math.random() * 3 + 2;
        const animationDelay = Math.random() * 2;
        
        // Apply styles
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = color;
        confetti.style.left = `${left}%`;
        confetti.style.animationDuration = `${animationDuration}s`;
        confetti.style.animationDelay = `${animationDelay}s`;
        
        confettiContainer.appendChild(confetti);
    }
}

function getRandomColor() {
    const colors = ['#00e676', '#ff9100', '#2196f3', '#e91e63', '#9c27b0', '#ffeb3b'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Helper functions
function formatCurrency(value) {
    return '$' + value.toFixed(2);
}

function getDepositUsers() {
    // In a real implementation, this would get users from the database
    // For now, return test users who have items in the pot
    const userIds = new Set();
    const items = document.querySelectorAll('.pot-item');
    
    items.forEach(item => {
        const userId = parseInt(item.dataset.userId);
        if (!isNaN(userId)) {
            userIds.add(userId);
        }
    });
    
    return Array.from(userIds).map(id => testUsers.find(user => user.id === id)).filter(Boolean);
}

function getItemsByUser(userId) {
    // In a real implementation, this would get items from the database
    // For now, return test items for the user
    return testItems.filter(item => item.userId === userId);
}

function groupItemsByUser(items) {
    const userGroups = [];
    const userMap = {};
    
    items.forEach(item => {
        if (!userMap[item.userId]) {
            const user = testUsers.find(u => u.id === item.userId);
            userMap[item.userId] = {
                user: user,
                items: [],
                totalValue: 0
            };
            userGroups.push(userMap[item.userId]);
        }
        
        userMap[item.userId].items.push(item);
        userMap[item.userId].totalValue += item.value;
    });
    
    return userGroups;
}

// Function to create player deposit HTML
function createPlayerDepositHTML(userDeposit, isNew = false) {
    const { user, items, totalValue } = userDeposit;
    
    // Create container
    const depositDiv = document.createElement('div');
    depositDiv.className = 'player-deposit-container';
    if (isNew) {
        depositDiv.classList.add('player-deposit-new');
    }
    
    // Create header
    const headerHTML = `
        <div class="player-deposit-header">
            <img src="${user.avatar}" alt="${user.name}" class="player-avatar">
            <div class="player-info">
                <div class="player-name">${user.name}</div>
                <div class="player-deposit-value">${formatCurrency(totalValue)}</div>
            </div>
        </div>
    `;
    
    // Create items grid
    let itemsHTML = '<div class="player-items-grid">';
    
    items.forEach(item => {
        itemsHTML += `
            <div class="player-deposit-item">
                <img src="${item.image}" alt="${item.name}" class="player-deposit-item-image">
                <div class="player-deposit-item-info">
                    <div class="player-deposit-item-name">${item.name}</div>
                    <div class="player-deposit-item-value">${formatCurrency(item.value)}</div>
                </div>
            </div>
        `;
    });
    
    itemsHTML += '</div>';
    
    depositDiv.innerHTML = headerHTML + itemsHTML;
    return depositDiv;
}

// Function to handle item deposit
function handleItemDeposit(userId, items) {
    // Hide empty pot message if visible
    if (emptyPotMessage.style.display !== 'none') {
        emptyPotMessage.style.display = 'none';
    }
    
    // Group items by user
    const userDeposit = {
        user: testUsers.find(u => u.id === userId),
        items: items,
        totalValue: items.reduce((sum, item) => sum + item.value, 0)
    };
    
    // Add to container
    const depositElement = createPlayerDepositHTML(userDeposit, true);
    itemsContainer.appendChild(depositElement);
    
    // Update participant count (assuming this is the total items count)
    const totalItems = document.querySelectorAll('.player-deposit-item').length;
    participantCount.textContent = `${totalItems}/200`;
    
    // Update pot value
    const currentValue = parseFloat(potValue.textContent.replace('$', ''));
    const newValue = currentValue + userDeposit.totalValue;
    potValue.textContent = formatCurrency(newValue);
}

// Function to display all test items (for demonstration)
function displayAllTestItems() {
    // Clear container
    itemsContainer.innerHTML = '';
    emptyPotMessage.style.display = 'none';
    
    // Group items by user
    const userGroups = groupItemsByUser(testItems);
    
    // Create and append deposit elements
    userGroups.forEach(group => {
        const depositElement = createPlayerDepositHTML(group);
        itemsContainer.appendChild(depositElement);
    });
    
    // Update participant count
    const totalItems = testItems.length;
    participantCount.textContent = `${totalItems}/200`;
    
    // Update pot value
    const totalValue = testItems.reduce((sum, item) => sum + item.value, 0);
    potValue.textContent = formatCurrency(totalValue);
}

// New functions for item deposit flow

// Load user inventory
function loadUserInventory() {
    // Clear inventory container
    inventoryItems.innerHTML = '';
    
    // Create inventory items
    userInventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        if (item.selected) {
            itemElement.classList.add('selected');
        }
        
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="inventory-item-image">
            <div class="inventory-item-info">
                <div class="inventory-item-name">${item.name}</div>
                <div class="inventory-item-value">${formatCurrency(item.value)}</div>
            </div>
            <div class="inventory-item-select">
                <div class="tick-marker"></div>
            </div>
        `;
        
        // Add data attributes
        itemElement.dataset.id = item.id;
        itemElement.dataset.value = item.value;
        
        // Add click event
        itemElement.addEventListener('click', function() {
            toggleItemSelection(item.id, itemElement);
        });
        
        inventoryItems.appendChild(itemElement);
    });
}

// Toggle item selection
function toggleItemSelection(itemId, itemElement) {
    // Find the item in inventory
    const item = userInventory.find(item => item.id === itemId);
    if (!item) return;
    
    // Toggle selection
    item.selected = !item.selected;
    
    // Update UI
    if (item.selected) {
        itemElement.classList.add('selected');
        addToSelectedItems(item);
    } else {
        itemElement.classList.remove('selected');
        removeFromSelectedItems(item.id);
    }
    
    // Update total value
    updateTotalValue();
    
    // Enable/disable deposit button
    depositButton.disabled = selectedItemsArray.length === 0;
}

// Add item to selected items
function addToSelectedItems(item) {
    // Add to array
    selectedItemsArray.push(item);
    
    // Clear empty selection message if present
    const emptySelection = selectedItems.querySelector('.empty-selection');
    if (emptySelection) {
        selectedItems.innerHTML = '';
    }
    
    // Create selected item element
    const itemElement = document.createElement('div');
    itemElement.className = 'selected-item';
    itemElement.dataset.id = item.id;
    
    itemElement.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="selected-item-image">
        <div class="selected-item-info">
            <div class="selected-item-name">${item.name}</div>
            <div class="selected-item-value">${formatCurrency(item.value)}</div>
        </div>
        <button class="remove-item" data-id="${item.id}">&times;</button>
    `;
    
    // Add remove button event
    const removeButton = itemElement.querySelector('.remove-item');
    removeButton.addEventListener('click', function(e) {
        e.stopPropagation();
        const itemId = parseInt(this.dataset.id);
        removeItemSelection(itemId);
    });
    
    selectedItems.appendChild(itemElement);
}

// Remove item from selected items
function removeFromSelectedItems(itemId) {
    // Remove from array
    selectedItemsArray = selectedItemsArray.filter(item => item.id !== itemId);
    
    // Remove from UI
    const itemElement = selectedItems.querySelector(`.selected-item[data-id="${itemId}"]`);
    if (itemElement) {
        itemElement.remove();
    }
    
    // Show empty selection message if no items
    if (selectedItemsArray.length === 0) {
        selectedItems.innerHTML = '<div class="empty-selection">No items selected</div>';
    }
}

// Remove item selection (from both inventory and selected items)
function removeItemSelection(itemId) {
    // Update inventory item
    const item = userInventory.find(item => item.id === itemId);
    if (item) {
        item.selected = false;
    }
    
    // Update inventory UI
    const inventoryItem = inventoryItems.querySelector(`.inventory-item[data-id="${itemId}"]`);
    if (inventoryItem) {
        inventoryItem.classList.remove('selected');
    }
    
    // Remove from selected items
    removeFromSelectedItems(itemId);
    
    // Update total value
    updateTotalValue();
    
    // Enable/disable deposit button
    depositButton.disabled = selectedItemsArray.length === 0;
}

// Update total value
function updateTotalValue() {
    const totalValue = selectedItemsArray.reduce((sum, item) => sum + item.value, 0);
    totalValueDisplay.textContent = formatCurrency(totalValue);
}

// Show trade request notification
function showTradeRequestNotification() {
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'trade-notification';
    notification.innerHTML = `
        <div class="trade-notification-content">
            <div class="trade-notification-header">
                <i class="fa-solid fa-exchange"></i>
                <h3>Trade Request Sent</h3>
            </div>
            <p>A trade request has been sent to your Steam account.</p>
            <p>Please accept the trade to complete your deposit.</p>
            <div class="trade-notification-progress">
                <div class="trade-progress-bar"></div>
            </div>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Animate progress bar
    const progressBar = notification.querySelector('.trade-progress-bar');
    progressBar.style.width = '100%';
    
    // Remove notification after animation
    setTimeout(function() {
        notification.classList.add('trade-notification-success');
        notification.innerHTML = `
            <div class="trade-notification-content">
                <div class="trade-notification-header">
                    <i class="fa-solid fa-check-circle"></i>
                    <h3>Trade Accepted</h3>
                </div>
                <p>Your items have been added to the pot!</p>
            </div>
        `;
        
        setTimeout(function() {
            notification.remove();
        }, 2000);
    }, 3000);
}

// Process deposit
function processDeposit(items) {
    // In a real implementation, this would send the deposit to the server
    // For now, simulate adding items to the pot
    
    // Add user ID to items
    const itemsWithUserId = items.map(item => ({
        ...item,
        userId: 1 // Current user ID (from testUsers[0])
    }));
    
    // Handle deposit
    handleItemDeposit(1, itemsWithUserId);
}

// Socket connection and event handling would go here in a real implementation
// For example:
// const socket = io();
// socket.on('newDeposit', function(data) {
//     handleItemDeposit(data.userId, data.items);
// });

// Additional functions for inventory management, trade offers, etc. would be added here
