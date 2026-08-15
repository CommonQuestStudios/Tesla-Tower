// ==========================================
// TESLA TOWER GAME
// VERSION: Save Slots Update v1.0
// ==========================================

class TowerDefenseGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Canvas scaling (retina/HiDPI)
        this.dpr = 1;
        this.width = 0;  // logical (CSS pixel) width
        this.height = 0; // logical (CSS pixel) height
        
        // Mobile detection and optimization
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.baseMaxParticles = this.isMobile ? 50 : 200;
        this.baseMaxLightning = this.isMobile ? 5 : 20;
        this.maxParticles = this.baseMaxParticles;
        this.maxLightning = this.baseMaxLightning;
        this.hapticEnabled = this.isMobile && 'vibrate' in navigator;

        // Throttle DOM/UI updates (reduce layout work)
        this.uiLastUpdate = 0;
        this.uiUpdateInterval = 100; // ms

        // Timing accumulators
        this.spawnAccumulator = 0;

        // Screen shake
        this.shakeTime = 0;
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        
        // Current save slot (default to slot 1)
        this.currentSlot = parseInt(localStorage.getItem('currentSlot')) || 1;
        
        // Load permanent stats
        this.loadPermanentStats();
        
        // Game state
        this.isPaused = false;
        this.isGameOver = false;
        this.isGameStarted = false;
        this.wave = 1;
        this.kills = 0;
        this.gold = 100;
        
        // Game speed control
        this.gameSpeed = 1; // 1x, 2x, or 4x
        this.speedMultiplier = 1;
        
        // Session stats tracking
        this.sessionDamage = 0;
        this.sessionClicks = 0;
        this.sessionGoldEarned = 0;
        this.sessionBossKills = 0;
        
        // Session zombie type kills
        this.sessionZombieKills = {
            normal: 0,
            strong: 0,
            runner: 0,
            tank: 0,
            exploder: 0,
            spawner: 0,
            boss: 0
        };
        
        // Tower stats (base stats - bonuses will be applied after loading permStats)
        this.tower = {
            x: 0, // Will be set to center
            y: 0, // Will be set to center
            radius: 30,
            health: 100,
            maxHealth: 100,
            level: 1,
            damage: 7, // Reduced from 10 to 7 for harder difficulty
            range: 120, // Reduced from 150 to 120 for harder difficulty
            fireRate: 1000, // milliseconds
            lastFire: 0,
            maxTargets: 1, // Start with single target
            chainLightning: 0, // Number of chain jumps (0 = disabled)
            chainRange: 80, // How far lightning can jump to next target
            shield: 0, // Current shield points
            maxShield: 0, // Maximum shield capacity
            armor: 0, // Damage reduction per hit
            goldBoost: 1.0 // Gold multiplier from in-game upgrades
        };
        
        // Crit damage multiplier (2x base, increased by upgrades)
        this.critDamageMultiplier = 2.0;
        
        // Click/Tap damage (base - bonus will be applied after loading permStats)
        this.clickDamage = 5;
        this.isMouseDown = false;
        this.lastClickTime = 0;
        this.clickFireRate = 150; // Random strike spawn rate (150ms)
        this.clickStrikeRadius = 50; // Random strike radius (px) around cursor
        this.clickBeams = []; // Store multiple random strikes
        
        // Set canvas size (must be after tower is created)
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
        screen.orientation?.addEventListener('change', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
        
        // Upgrade costs
        this.upgradeCosts = {
            damage: 100,
            range: 80,
            fireRate: 120,
            health: 50,
            targets: 150, // Cost for multi-target upgrade
            clickDamage: 80, // Cost for click damage upgrade
            chainLightning: 200, // Cost for chain lightning upgrade
            shield: 150, // Cost for shield upgrade
            maxHealth: 120, // Cost for max health upgrade
            armor: 200, // Cost for armor upgrade
            critChance: 180, // Cost for crit chance upgrade
            critDamage: 220, // Cost for crit damage upgrade
            burnChance: 160, // Cost for burn chance upgrade
            slowChance: 130, // Cost for slow chance upgrade
            goldBoost: 175, // Cost for gold boost upgrade
            chainRange: 140, // Cost for chain range upgrade
            clickRadius: 100, // Cost for click radius upgrade
            clickRate: 110 // Cost for click rate upgrade
        };
        
        // Game objects
        this.zombies = [];
        this.lightning = []; // Lightning effects
        this.particles = []; // Visual effects
        this.damageNumbers = []; // Floating damage numbers
        this.goldCoins = []; // Flying gold coins effect
        this.towerSparks = []; // Electric sparks from tower
        this.impactParticles = []; // Impact burst effects
        this.explosionRings = []; // Explosion shockwave rings (radius indicators)
        
        // Daily Challenges
        this.loadDailyChallenges();
        this.challengeTracking = {
            upgradesUsed: 0,
            clickKills: 0,
            damageTaken: 0
        };
        
        // Leaderboards
        this.loadLeaderboards();
        this.runStartTime = null;
        
        // Spawning
        this.spawnRate = 2000; // Start slow
        this.lastSpawn = 0;
        this.zombiesPerWave = 5;
        this.zombiesSpawned = 0;
        this.bossSpawned = false; // Track if boss spawned this wave
        this.currentWaveTheme = null; // Theme for current wave (null = mixed, or specific type)
        this.splitBossSpawned = false; // Track if split boss spawned

        // Elite system (one elite per non-boss wave)
        this.eliteSpawnedThisWave = false;
        
        // Narration tracking
        this.criticalHealthWarned = false;
        this.narrationTimeout = null;
        
        // Load settings
        this.loadSettings();

        // Run meta systems (choices, objectives, abilities, status effects)
        this.runObjective = null;
        this.runCurses = [];
        this.waveChoiceState = { active: false, options: [], waveOffered: 0 };
        this.statusConfig = {
            slowChance: 0,
            slowFactor: 0.65,
            slowDurationMs: 1400,
            shockChance: 0,
            shockDps: 0,
            shockDurationMs: 1600
        };
        this.abilities = {
            emp: { unlocked: false, cooldownMs: 20000, lastUsedAt: -Infinity },
            overcharge: { unlocked: false, cooldownMs: 30000, lastUsedAt: -Infinity, activeUntil: 0, durationMs: 8000 }
        };
        this.baseAbilityCooldowns = { emp: 20000, overcharge: 30000 };
        this.hitPauseTime = 0;

        // Relics (Archero-style run identity + Tower-style meta)
        this.relicDropState = { active: false, waveOffered: 0, options: [] };
        this.relicDropOpenedAt = 0;

        // Background hum/music
        this.masterGain = null;
        this.musicOsc = null;
        this.musicGain = null;
        
        // Handle page visibility for battery saving
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isGameStarted && !this.isGameOver) {
                this.isPaused = true;
            }
        });
        
        this.init();
    }
    
    resizeCanvas() {
        const header = document.querySelector('.game-header');
        const headerHeight = header ? header.offsetHeight : 0;
        
        // Use available viewport dimensions
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        
        // Logical size (CSS pixels)
        this.width = vw;
        this.height = Math.max(0, vh - headerHeight);

        // Physical buffer size (device pixels)
        const maxDpr = this.isMobile ? 2 : 2;
        this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.canvas.width = Math.floor(this.width * this.dpr);
        this.canvas.height = Math.floor(this.height * this.dpr);

        // Draw using logical coordinates
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // Update tower position to center (logical coords)
        this.tower.x = this.width / 2;
        this.tower.y = this.height / 2;
    }
    
    init() {
        // Apply permanent bonuses now that tower exists
        this.applyPermanentBonuses();
        
        // Apply current theme
        this.applyTheme();

        this.cacheUIElements();
        
        this.setupEventListeners();
        this.setupBackdropCloseListeners();
        this.setupTitleScreen();
        this.updateUI();
        this.gameLoop();
    }

    readStorageJSON(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn(`Ignoring invalid saved data for ${key}`, error);
            localStorage.removeItem(key);
            return null;
        }
    }

    toFiniteNumber(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    getUpgradeTypeFromButtonId(buttonId) {
        if (typeof buttonId !== 'string' || !buttonId.startsWith('upgrade')) return null;
        const upgradeName = buttonId.slice('upgrade'.length);
        if (!upgradeName) return null;
        return upgradeName.charAt(0).toLowerCase() + upgradeName.slice(1);
    }

    getDefaultUpgradeCosts() {
        return {
            damage: 100,
            range: 80,
            fireRate: 120,
            health: 50,
            targets: 150,
            clickDamage: 80,
            chainLightning: 200,
            shield: 150,
            maxHealth: 120,
            armor: 200,
            critChance: 180,
            critDamage: 220,
            burnChance: 160,
            slowChance: 130,
            goldBoost: 175,
            chainRange: 140,
            clickRadius: 100,
            clickRate: 110
        };
    }

    getDefaultPermanentStats() {
        return {
            totalKills: 0,
            bonusDamage: 0,
            bonusHealth: 0,
            bonusClickDamage: 0,
            bonusStartGold: 0,
            gems: 0,
            gemUpgrades: {
                damageMultiplier: 0,
                healthMultiplier: 0,
                goldMultiplier: 0,
                xpMultiplier: 0,
                critChance: 0,
                healthRegen: 0
            },
            totalDamageDealt: 0,
            totalClicks: 0,
            highestWave: 0,
            totalGamesPlayed: 0,
            totalGoldEarned: 0,
            bossesKilled: 0,
            zombieKills: {
                normal: 0,
                strong: 0,
                runner: 0,
                tank: 0,
                exploder: 0,
                spawner: 0,
                boss: 0
            },
            dailyRewards: {
                lastLogin: null,
                streak: 0,
                claimed: []
            },
            themes: {
                unlocked: ['classic'],
                current: 'classic'
            },
            relics: {
                owned: [],
                equipped: [null, null, null],
                shards: 0,
                levels: {}
            }
        };
    }

    cacheUIElements() {
        this.ui = {
            wave: document.getElementById('wave'),
            kills: document.getElementById('kills'),
            gold: document.getElementById('gold'),
            towerHealth: document.getElementById('towerHealth'),
            runObjectiveText: document.getElementById('runObjectiveText'),
            currentPlayerName: document.getElementById('currentPlayerName'),
            gemsAmount: document.getElementById('gemsAmount'),
            soundToggle: document.getElementById('soundToggle'),
            abilitiesBar: document.getElementById('abilitiesBar'),
            abilityEmpBtn: document.getElementById('abilityEmpBtn'),
            abilityOverchargeBtn: document.getElementById('abilityOverchargeBtn'),
            waveChoiceBackdrop: document.getElementById('waveChoiceBackdrop'),
            waveChoicePanel: document.getElementById('waveChoicePanel'),
            waveChoiceOptions: document.getElementById('waveChoiceOptions'),
            waveChoiceSubtitle: document.getElementById('waveChoiceSubtitle')
        };
    }
    
    setupTitleScreen() {
        // Check if player name exists
        const playerName = localStorage.getItem('playerName');
        if (playerName) {
            // Player has a name, show main menu
            document.getElementById('titleScreen').classList.remove('active');
            document.getElementById('mainMenu').classList.add('active');
            document.getElementById('currentPlayerName').textContent = `Player: ${playerName}`;
            
            // Check for daily reward for returning players
            this.checkDailyReward();
        } else {
            // No player name, show title screen
            document.getElementById('titleScreen').classList.add('active');
            document.getElementById('mainMenu').classList.remove('active');
        }
    }
    
    setupBackdropCloseListeners() {
        // List of all panels that should close on backdrop click
        const panels = [
            { id: 'upgradePanel', backdropId: 'upgradeBackdrop', closeMethod: () => this.closeUpgradePanel() },
            { id: 'gemShopPanel', backdropId: 'gemShopBackdrop', closeMethod: () => this.closeGemShopPanel() },
            { id: 'statsPanel', backdropId: 'statsBackdrop', closeMethod: () => this.closeStatsPanel() },
            { id: 'achievementsPanel', backdropId: 'achievementsBackdrop', closeMethod: () => this.closeAchievementsPanel() },
            { id: 'saveSlotPanel', backdropId: 'saveSlotBackdrop', closeMethod: () => this.closeSaveSlotPanel() },
            { id: 'enemyTypesPanel', backdropId: 'enemyTypesBackdrop', closeMethod: () => this.closeEnemyTypesPanel() },
            { id: 'challengesPanel', backdropId: 'challengesBackdrop', closeMethod: () => this.closeChallengesPanel() },
            { id: 'leaderboardsPanel', backdropId: 'leaderboardsBackdrop', closeMethod: () => this.closeLeaderboardsPanel() },
            { id: 'settingsPanel', backdropId: 'settingsBackdrop', closeMethod: () => this.closeSettingsPanel() },
            { id: 'relicsPanel', backdropId: 'relicsBackdrop', closeMethod: () => this.closeRelicsPanel() },
            { id: 'relicDropPanel', backdropId: 'relicDropBackdrop', closeMethod: () => this.closeRelicDropPanel() }
        ];
        
        panels.forEach(panel => {
            const backdropElement = document.getElementById(panel.backdropId);
            if (backdropElement) {
                backdropElement.addEventListener('click', () => {
                    panel.closeMethod();
                });
            }
        });
    }
    
    setupEventListeners() {
        // Title Screen buttons
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.showNameInput();
        });
        
        document.getElementById('loadGameTitleBtn').addEventListener('click', () => {
            this.openSaveSlotPanel();
        });
        
        document.getElementById('closeGameBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to exit the game?')) {
                window.close();
                // If window.close() doesn't work (some browsers block it), show message
                setTimeout(() => {
                    alert('Please close this tab/window to exit the game.');
                }, 100);
            }
        });
        
        // Name Input buttons
        document.getElementById('confirmNameBtn').addEventListener('click', () => {
            this.confirmPlayerName();
        });
        
        document.getElementById('cancelNameBtn').addEventListener('click', () => {
            this.cancelNameInput();
        });
        
        // Allow Enter key in name input
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirmPlayerName();
            }
        });
        
        // Logout / New Player button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Start as a new player? This will return you to the title screen.')) {
                localStorage.removeItem('playerName');
                location.reload();
            }
        });
        
        // Start button
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });

        // Ability buttons
        const empBtn = document.getElementById('abilityEmpBtn');
        if (empBtn) empBtn.addEventListener('click', () => this.tryUseAbility('emp'));

        const overBtn = document.getElementById('abilityOverchargeBtn');
        if (overBtn) overBtn.addEventListener('click', () => this.tryUseAbility('overcharge'));
        
        // Permanent upgrade purchase buttons (now in gem shop)
        document.getElementById('buyPermDamage').addEventListener('click', () => {
            this.buyPermUpgrade('damage');
        });
        
        document.getElementById('buyPermHealth').addEventListener('click', () => {
            this.buyPermUpgrade('health');
        });
        
        document.getElementById('buyPermClick').addEventListener('click', () => {
            this.buyPermUpgrade('click');
        });
        
        document.getElementById('buyPermGold').addEventListener('click', () => {
            this.buyPermUpgrade('gold');
        });
        
        // Tooltip event listeners for permanent upgrades
        const permUpgradeButtons = [
            { id: 'buyPermDamage', type: 'permDamage' },
            { id: 'buyPermHealth', type: 'permHealth' },
            { id: 'buyPermClick', type: 'permClick' },
            { id: 'buyPermGold', type: 'permGold' }
        ];
        
        permUpgradeButtons.forEach(btn => {
            const element = document.getElementById(btn.id);
            element.addEventListener('mouseenter', () => {
                this.showTooltip(element, btn.type, true);
            });
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
        
        // Stats button
        document.getElementById('statsBtn').addEventListener('click', () => {
            this.openStatsPanel();
        });
        
        document.getElementById('closeStats').addEventListener('click', () => {
            this.closeStatsPanel();
        });
        
        // Gem Shop button
        document.getElementById('gemShopBtn').addEventListener('click', () => {
            this.openGemShopPanel();
        });
        
        document.getElementById('closeGemShop').addEventListener('click', () => {
            this.closeGemShopPanel();
        });
        
        // Gem shop purchase buttons
        document.getElementById('buyGemDamage').addEventListener('click', () => {
            this.buyGemUpgrade('damageMultiplier', 50);
        });
        
        document.getElementById('buyGemHealth').addEventListener('click', () => {
            this.buyGemUpgrade('healthMultiplier', 50);
        });
        
        document.getElementById('buyGemGold').addEventListener('click', () => {
            this.buyGemUpgrade('goldMultiplier', 75);
        });
        
        document.getElementById('buyGemXP').addEventListener('click', () => {
            this.buyGemUpgrade('xpMultiplier', 60);
        });
        
        document.getElementById('buyGemCrit').addEventListener('click', () => {
            this.buyGemUpgrade('critChance', 100);
        });
        
        document.getElementById('buyGemRegen').addEventListener('click', () => {
            this.buyGemUpgrade('healthRegen', 80);
        });
        
        // Daily reward claim button
        document.getElementById('claimRewardBtn').addEventListener('click', () => {
            this.claimDailyReward();
        });
        
        // Themes button
        document.getElementById('themesBtn').addEventListener('click', () => {
            this.openThemesPanel();
        });

        // Relics button
        const relicsBtn = document.getElementById('relicsBtn');
        if (relicsBtn) relicsBtn.addEventListener('click', () => this.openRelicsPanel());

        const closeRelics = document.getElementById('closeRelics');
        if (closeRelics) closeRelics.addEventListener('click', () => this.closeRelicsPanel());

        const closeRelicDrop = document.getElementById('closeRelicDrop');
        if (closeRelicDrop) closeRelicDrop.addEventListener('click', () => this.closeRelicDropPanel());
        
        document.getElementById('closeThemes').addEventListener('click', () => {
            this.closeThemesPanel();
        });
        
        // Achievements button
        document.getElementById('achievementsBtn').addEventListener('click', () => {
            console.log('Achievements button clicked!');
            this.openAchievementsPanel();
        });
        
        document.getElementById('closeAchievements').addEventListener('click', () => {
            console.log('Close achievements clicked!');
            this.closeAchievementsPanel();
        });
        
        // Enemy Types button
        document.getElementById('enemyTypesBtn').addEventListener('click', () => {
            this.openEnemyTypesPanel();
        });
        
        document.getElementById('enemyTypesUpgradeBtn').addEventListener('click', () => {
            this.openEnemyTypesPanel();
        });
        
        document.getElementById('closeEnemyTypes').addEventListener('click', () => {
            this.closeEnemyTypesPanel();
        });
        
        // Daily Challenges button
        document.getElementById('challengesBtn').addEventListener('click', () => {
            this.openChallengesPanel();
        });
        
        document.getElementById('closeChallenges').addEventListener('click', () => {
            this.closeChallengesPanel();
        });
        
        // Leaderboards button
        document.getElementById('leaderboardsBtn').addEventListener('click', () => {
            this.openLeaderboardsPanel();
        });
        
        document.getElementById('closeLeaderboards').addEventListener('click', () => {
            this.closeLeaderboardsPanel();
        });
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsPanel();
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.closeSettingsPanel();
        });
        
        // Settings controls
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            document.getElementById('volumeValue').textContent = e.target.value + '%';
        });
        
        document.getElementById('soundToggleBtn').addEventListener('click', (e) => {
            const btn = e.target;
            btn.classList.toggle('off');
            btn.textContent = btn.classList.contains('off') ? 'OFF' : 'ON';
        });

        const musicToggle = document.getElementById('musicToggleBtn');
        if (musicToggle) {
            musicToggle.addEventListener('click', (e) => {
                const btn = e.target;
                btn.classList.toggle('off');
                btn.textContent = btn.classList.contains('off') ? 'OFF' : 'ON';
            });
        }
        
        document.getElementById('particlesToggleBtn').addEventListener('click', (e) => {
            const btn = e.target;
            btn.classList.toggle('off');
            btn.textContent = btn.classList.contains('off') ? 'OFF' : 'ON';
        });
        
        document.getElementById('screenShakeToggleBtn').addEventListener('click', (e) => {
            const btn = e.target;
            btn.classList.toggle('off');
            btn.textContent = btn.classList.contains('off') ? 'OFF' : 'ON';
        });
        
        document.getElementById('applySettingsBtn').addEventListener('click', () => {
            this.applySettings();
        });
        
        // Clear all data button
        document.getElementById('clearAllDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });
        
        // Upgrade button
        document.getElementById('upgradeBtn').addEventListener('click', () => {
            this.openUpgradePanel();
        });
        
        // Close upgrade panel
        document.getElementById('closeUpgrade').addEventListener('click', () => {
            this.closeUpgradePanel();
        });
        
        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.closeUpgradePanel();
        });
        
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to quit to the main menu? Your current progress will be lost unless you save first!')) {
                this.backToMainMenu();
            }
        });
        
        // Upgrade buttons (auto-bind so newly added upgrade buttons work without extra wiring)
        const upgradeButtons = document.querySelectorAll('#upgradePanel .upgrade-option');
        upgradeButtons.forEach((element) => {
            const type = this.getUpgradeTypeFromButtonId(element.id);
            if (!type || !(type in this.upgradeCosts)) return;

            element.addEventListener('click', () => {
                this.buyUpgrade(type);
            });
            element.addEventListener('mouseenter', () => {
                this.showTooltip(element, type, false);
            });
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
        
        // Unified pointer events for better mobile support
        this.canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.isMouseDown = true;
            this.currentMouseX = e.clientX;
            this.currentMouseY = e.clientY;
            this.handleCanvasClick(e);
        });
        
        this.canvas.addEventListener('pointerup', () => {
            this.isMouseDown = false;
        });
        
        this.canvas.addEventListener('pointerleave', () => {
            this.isMouseDown = false;
        });
        
        this.canvas.addEventListener('pointermove', (e) => {
            if (this.isMouseDown) {
                this.currentMouseX = e.clientX;
                this.currentMouseY = e.clientY;
            }
        });
        
        this.canvas.addEventListener('pointercancel', () => {
            this.isMouseDown = false;
        });
        
        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restart();
        });
        
        // Sound toggle button
        document.getElementById('soundToggle').addEventListener('click', () => {
            this.toggleSound();
        });
        
        // Speed control button
        document.getElementById('speedToggle').addEventListener('click', () => {
            this.cycleGameSpeed();
        });
        
        // Save and Load buttons (open slot panel)
        document.getElementById('saveGameBtn').addEventListener('click', () => {
            console.log('Save button clicked!');
            this.openSaveSlotPanel();
        });
        
        document.getElementById('loadGameBtn').addEventListener('click', () => {
            console.log('Load button clicked!');
            this.openSaveSlotPanel();
        });
        
        document.getElementById('saveGameUpgradeBtn').addEventListener('click', () => {
            console.log('Save upgrade button clicked!');
            this.openSaveSlotPanel();
        });
        
        document.getElementById('loadGameUpgradeBtn').addEventListener('click', () => {
            console.log('Load upgrade button clicked!');
            this.openSaveSlotPanel();
        });
        
        // Save slot panel buttons
        document.getElementById('closeSaveSlots').addEventListener('click', () => {
            this.closeSaveSlotPanel();
        });
        
        // Slot 1 buttons
        document.getElementById('saveSlot1').addEventListener('click', () => {
            this.saveGame(1);
        });
        document.getElementById('loadSlot1').addEventListener('click', () => {
            this.loadGame(1);
            this.closeSaveSlotPanel();
        });
        document.getElementById('deleteSlot1').addEventListener('click', () => {
            if (confirm('Delete save in Slot 1?')) this.deleteSave(1);
        });
        
        // Slot 2 buttons
        document.getElementById('saveSlot2').addEventListener('click', () => {
            this.saveGame(2);
        });
        document.getElementById('loadSlot2').addEventListener('click', () => {
            this.loadGame(2);
            this.closeSaveSlotPanel();
        });
        document.getElementById('deleteSlot2').addEventListener('click', () => {
            if (confirm('Delete save in Slot 2?')) this.deleteSave(2);
        });
        
        // Slot 3 buttons
        document.getElementById('saveSlot3').addEventListener('click', () => {
            this.saveGame(3);
        });
        document.getElementById('loadSlot3').addEventListener('click', () => {
            this.loadGame(3);
            this.closeSaveSlotPanel();
        });
        document.getElementById('deleteSlot3').addEventListener('click', () => {
            if (confirm('Delete save in Slot 3?')) this.deleteSave(3);
        });
        
        // Cheat key for testing: Press '=' to get 500 gems
        // Initialize voice test index
        this.voiceTestIndex = 0;
        
        document.addEventListener('keydown', (e) => {
            if (e.key === '=') {
                this.permStats.gems += 500;
                this.savePermanentStats();
                this.updateUI();
                this.showMessage('CHEAT: +500 Gems! 💎', '#ff00ff');
                this.playSound('achievement');
                console.log('Cheat activated: +500 gems');
            }
            // Test voice with 'V' key - cycle through all announcements
            if (e.key === 'v' || e.key === 'V') {
                this.testVoiceAnnouncements();
            }
        });
    }
    
    testVoiceAnnouncements() {
        const announcements = [
            { text: '⚡ Wave 5 Incoming! ⚡', type: 'wave', description: 'Wave Announcement' },
            { text: '⚡ Wave 10 Incoming! ⚡', type: 'wave', description: 'Wave 10 Milestone' },
            { text: '💀 BOSS APPROACHING! 💀', type: 'boss', description: 'Boss Warning' },
            { text: '⚠️ TOWER CRITICAL! ⚠️', type: 'critical', description: 'Critical Health Warning' },
            { text: '🏆 ACHIEVEMENT UNLOCKED! 🏆', type: 'achievement', description: 'Achievement Unlock' },
            { text: '✓ Settings Applied!', type: 'normal', description: 'Settings Confirmation' }
        ];
        
        const current = announcements[this.voiceTestIndex];
        console.log(`🗣️ Voice Test ${this.voiceTestIndex + 1}/${announcements.length}: ${current.description}`);
        this.showMessage(`Voice Test: ${current.description}`, '#00ffff');
        
        // Use the showNarration function to get the proper voice settings
        this.showNarration(current.text, 2500);
        
        // Move to next announcement
        this.voiceTestIndex = (this.voiceTestIndex + 1) % announcements.length;
    }
    
    startGame() {
        console.log('Game started!');
        this.isGameStarted = true;
        this.isGameOver = false; // Reset game over flag
        this.isPaused = false; // Reset pause flag
        this.spawnAccumulator = 0;
        this.lastSpawn = performance.now(); // Initialize spawn timer
        this.runStartTime = Date.now(); // Start run timer
        this.criticalHealthWarned = false; // Reset health warning
        this.currentWaveTheme = null; // Reset themed waves
        this.splitBossSpawned = false; // Reset split boss flag
        
        // Show daily challenges
        console.log('=== DAILY CHALLENGES ===');
        this.dailyChallenges.forEach(c => {
            const status = c.completed ? '✅ COMPLETE' : '⏳ In Progress';
            console.log(`${status} - ${c.name}: ${c.description} (Reward: +${c.reward} kills)`);
        });
        
        const menu = document.getElementById('mainMenu');
        const upgradeBtn = document.getElementById('upgradeBtn');
        
        console.log('Menu before:', menu.classList.contains('active'));
        console.log('Upgrade button before:', upgradeBtn.classList.contains('active'));
        
        menu.classList.remove('active');
        upgradeBtn.classList.add('active');
        
        console.log('Menu after:', menu.classList.contains('active'));
        console.log('Upgrade button after:', upgradeBtn.classList.contains('active'));
        
        // Show speed control button
        document.getElementById('speedToggle').classList.add('active');
        this.updateSpeedButton();

        // Show abilities bar (buttons enable once unlocked)
        if (!this.ui) this.cacheUIElements();
        this.ui.abilitiesBar && this.ui.abilitiesBar.classList.add('active');

        // Reset run meta systems
        this.runCurses = [];
        this.statusConfig.slowChance = 0;
        this.statusConfig.shockChance = 0;
        this.statusConfig.shockDps = 0;
        this.abilities.emp.unlocked = false;
        this.abilities.overcharge.unlocked = false;
        this.abilities.emp.lastUsedAt = -Infinity;
        this.abilities.overcharge.lastUsedAt = -Infinity;
        this.abilities.overcharge.activeUntil = 0;
        this.waveChoiceState = { active: false, options: [], waveOffered: 0 };
        this.hitPauseTime = 0;

        // New objective for the run
        this.generateRunObjective();
        this.updateAbilityUI(performance.now(), true);
        this.updateUI();
        
        this.lastFrameTime = performance.now();
    }
    
    openUpgradePanel() {
        this.isPaused = true;
        document.getElementById('upgradeBackdrop').classList.add('active');
        document.getElementById('upgradePanel').classList.add('active');
        this.updateUpgradePanel();
    }
    
    closeUpgradePanel() {
        this.isPaused = false;
        document.getElementById('upgradeBackdrop').classList.remove('active');
        document.getElementById('upgradePanel').classList.remove('active');
    }
    
    backToMainMenu() {
        // Close upgrade panel first
        document.getElementById('upgradeBackdrop').classList.remove('active');
        document.getElementById('upgradePanel').classList.remove('active');
        
        // If game is in progress, save stats first
        if (!this.isGameOver && this.isGameStarted) {
            // Update permanent stats
            this.permStats.totalKills += this.kills;
            this.permStats.totalDamageDealt += this.sessionDamage;
            this.permStats.totalClicks += this.sessionClicks;
            this.permStats.totalGoldEarned += this.sessionGoldEarned;
            this.permStats.bossesKilled += this.sessionBossKills;
            this.permStats.totalGamesPlayed++;
            
            // Update zombie type kills
            for (let type in this.sessionZombieKills) {
                this.permStats.zombieKills[type] += this.sessionZombieKills[type];
            }
            
            // Track highest wave
            if (this.wave > this.permStats.highestWave) {
                this.permStats.highestWave = this.wave;
            }
            
            this.savePermanentStats();
            this.checkAchievements();
            this.checkDailyChallenges();
            this.updateLeaderboards();
        }
        
        // Reset the entire game state (similar to restart but stay on menu)
        this.wave = 1;
        this.kills = 0;
        this.zombies = [];
        this.lightning = [];
        this.particles = [];
        this.damageNumbers = [];
        this.goldCoins = [];
        this.towerSparks = [];
        this.impactParticles = [];
        this.explosionRings = [];
        this.zombiesSpawned = 0;
        this.spawnRate = 2000;
        this.bossSpawned = false;
        
        // Reset session stats
        this.sessionDamage = 0;
        this.sessionClicks = 0;
        this.sessionGoldEarned = 0;
        this.sessionBossKills = 0;
        this.sessionZombieKills = {
            normal: 0,
            strong: 0,
            runner: 0,
            tank: 0,
            exploder: 0,
            spawner: 0,
            boss: 0
        };
        
        // Reset challenge tracking
        this.challengeTracking = {
            upgradesUsed: 0,
            clickKills: 0,
            damageTaken: 0
        };
        
        // Reset tower to base + permanent bonuses
        this.tower.level = 1;
        this.tower.range = 150;
        this.tower.fireRate = 1000;
        this.tower.maxTargets = 1;
        this.tower.chainLightning = 0;
        this.tower.shield = 0;
        this.tower.maxShield = 0;
        this.applyPermanentBonuses();
        
        // Reset upgrade costs
        this.upgradeCosts = { 
            damage: 100, 
            range: 80, 
            fireRate: 120, 
            health: 50, 
            targets: 150, 
            clickDamage: 80, 
            chainLightning: 200, 
            shield: 150,
            maxHealth: 120,
            armor: 200,
            critChance: 180,
            critDamage: 220,
            burnChance: 160,
            slowChance: 130,
            goldBoost: 175,
            chainRange: 140,
            clickRadius: 100,
            clickRate: 110
        };
        
        // Reset game state flags
        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        
        // Reset game speed
        this.gameSpeed = 1;
        this.speedMultiplier = 1;
        
        // Hide upgrade button and speed button, show main menu
        document.getElementById('upgradeBtn').classList.remove('active');
        document.getElementById('speedToggle').classList.remove('active');
        document.getElementById('mainMenu').classList.add('active');
        document.getElementById('gameOver').classList.remove('active');
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Update UI
        this.updateUI();
    }
    
    handleCanvasClick(e) {
        // Don't process clicks if game is paused or not started
        if (this.isPaused || !this.isGameStarted || this.isGameOver) return;
        
        // Track click
        this.sessionClicks++;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Create a random lightning strike near the cursor
        const randomOffset = Math.max(8, Number(this.clickStrikeRadius ?? 50));
        const strikeX = x + (Math.random() - 0.5) * randomOffset * 2;
        const strikeY = y + (Math.random() - 0.5) * randomOffset * 2;
        
        // Create new lightning strike
        this.lightning.push({
            x1: this.tower.x,
            y1: this.tower.y,
            x2: strikeX,
            y2: strikeY,
            life: 8, // Short life for quick flash
            isClick: true,
            isContinuous: false
        });
        
        // Add to clickBeams array for tracking
        this.clickBeams.push({
            x: strikeX,
            y: strikeY,
            createdAt: Date.now()
        });
        
        // Clean up old strikes (older than 200ms)
        this.clickBeams = this.clickBeams.filter(beam => Date.now() - beam.createdAt < 200);
        
        // Play lightning sound
        this.playSound('lightning');
        
        // Create small yellow splash at strike location
        this.createParticles(strikeX, strikeY, '#ffff00', 3);
        
        // Clean up old lightning effects to prevent buildup on mobile
        if (this.lightning.length > this.maxLightning) {
            this.lightning = this.lightning.slice(-this.maxLightning);
        }
        
        // Check if strike hit any zombie and deal damage
        let hitZombie = false;
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            const dx = strikeX - zombie.x;
            const dy = strikeY - zombie.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if strike is within zombie radius (30px for random strikes)
            if (distance <= 30) {
                // Deal click damage (accounts for armored/phasing)
                const actualDamage = this.dealDamageToZombie(zombie, this.clickDamage);
                
                // Track if killed by click
                if (zombie.health <= 0) {
                    this.challengeTracking.clickKills++;
                }
                
                // Track damage dealt
                this.sessionDamage += actualDamage;
                
                // Create floating damage number
                if (actualDamage > 0) {
                    this.createDamageNumber(zombie.x, zombie.y - 20, actualDamage);
                } else {
                    this.createParticles(zombie.x, zombie.y, 'rgba(200, 200, 255, 0.55)', 2);
                }
                
                // Create red blood splash at zombie location
                this.createParticles(zombie.x, zombie.y, '#ff0000', 4);
                
                // Play hit sound
                this.playSound('zombieHit');
                
                // Haptic feedback on hit
                if (this.hapticEnabled) {
                    navigator.vibrate(10);
                }
                
                hitZombie = true;
                
                break; // Only hit one zombie per click
            }
        }
    }
    
    handleContinuousShooting(currentTime) {
        // If mouse/finger is down and enough time has passed, shoot again
        if (this.isMouseDown && this.isGameStarted && !this.isPaused && !this.isGameOver) {
            if (currentTime - this.lastClickTime >= this.clickFireRate) {
                // Fire at current mouse/touch position
                const clickEvent = {
                    clientX: this.currentMouseX,
                    clientY: this.currentMouseY
                };
                this.handleCanvasClick(clickEvent);
                this.lastClickTime = currentTime;
            }
        }
    }
    
    buyUpgrade(type) {
        const cost = this.upgradeCosts[type];
        
        // Check if can afford
        if (this.gold < cost) {
            this.showMessage('Not enough gold!', '#ff4444');
            return;
        }
        
        // Check if health upgrade when already at max
        if (type === 'health' && this.tower.health >= this.tower.maxHealth) {
            this.showMessage('Tower at full health!', '#ffff00');
            return;
        }
        
        this.gold -= cost;
        
        // Track upgrades for daily challenges
        this.challengeTracking.upgradesUsed++;
        
        switch(type) {
            case 'damage':
                this.tower.damage += 5;
                this.upgradeCosts.damage = Math.floor(this.upgradeCosts.damage * 1.5);
                break;
            case 'range':
                this.tower.range += 30;
                this.upgradeCosts.range = Math.floor(this.upgradeCosts.range * 1.5);
                break;
            case 'fireRate':
                this.tower.fireRate = Math.max(200, this.tower.fireRate - 100);
                this.upgradeCosts.fireRate = Math.floor(this.upgradeCosts.fireRate * 1.5);
                break;
            case 'health':
                this.tower.health = Math.min(this.tower.maxHealth, this.tower.health + 50);
                break;
            case 'targets':
                this.tower.maxTargets += 1;
                this.upgradeCosts.targets = Math.floor(this.upgradeCosts.targets * 1.5);
                break;
            case 'clickDamage':
                this.clickDamage += 2;
                this.upgradeCosts.clickDamage = Math.floor(this.upgradeCosts.clickDamage * 1.5);
                break;
            case 'chainLightning':
                this.tower.chainLightning += 1;
                this.upgradeCosts.chainLightning = Math.floor(this.upgradeCosts.chainLightning * 1.5);
                break;
            case 'shield':
                this.tower.maxShield += 5;
                this.tower.shield = this.tower.maxShield; // Fully charge shield
                this.upgradeCosts.shield = Math.floor(this.upgradeCosts.shield * 1.5);
                break;
            case 'maxHealth':
                this.tower.maxHealth += 25;
                this.tower.health = Math.min(this.tower.health + 25, this.tower.maxHealth);
                this.upgradeCosts.maxHealth = Math.floor(this.upgradeCosts.maxHealth * 1.5);
                break;
            case 'armor':
                this.tower.armor += 1;
                this.upgradeCosts.armor = Math.floor(this.upgradeCosts.armor * 1.5);
                break;
            case 'critChance':
                this.critChance = Math.min(0.75, (this.critChance || 0) + 0.05);
                this.upgradeCosts.critChance = Math.floor(this.upgradeCosts.critChance * 1.5);
                break;
            case 'critDamage':
                this.critDamageMultiplier = (this.critDamageMultiplier || 2) + 0.5;
                this.upgradeCosts.critDamage = Math.floor(this.upgradeCosts.critDamage * 1.5);
                break;
            case 'burnChance':
                this.statusConfig.shockChance = Math.min(0.8, (this.statusConfig.shockChance || 0) + 0.15);
                if ((this.statusConfig.shockDps || 0) === 0) this.statusConfig.shockDps = 3;
                else this.statusConfig.shockDps += 1;
                this.upgradeCosts.burnChance = Math.floor(this.upgradeCosts.burnChance * 1.5);
                break;
            case 'slowChance':
                this.statusConfig.slowChance = Math.min(0.8, (this.statusConfig.slowChance || 0) + 0.10);
                this.upgradeCosts.slowChance = Math.floor(this.upgradeCosts.slowChance * 1.5);
                break;
            case 'goldBoost':
                this.tower.goldBoost = (this.tower.goldBoost || 1) * 1.15;
                this.upgradeCosts.goldBoost = Math.floor(this.upgradeCosts.goldBoost * 1.5);
                break;
            case 'chainRange':
                this.tower.chainRange += 20;
                this.upgradeCosts.chainRange = Math.floor(this.upgradeCosts.chainRange * 1.5);
                break;
            case 'clickRadius':
                this.clickStrikeRadius += 15;
                this.upgradeCosts.clickRadius = Math.floor(this.upgradeCosts.clickRadius * 1.5);
                break;
            case 'clickRate':
                this.clickFireRate = Math.max(50, this.clickFireRate - 10);
                this.upgradeCosts.clickRate = Math.floor(this.upgradeCosts.clickRate * 1.5);
                break;
        }
        
        this.tower.level++;
        this.updateUI();
        this.updateUpgradePanel();
        this.playSound('upgrade');
        this.showMessage('Upgrade purchased!', '#00ffff');
        
        // Haptic feedback
        if (this.hapticEnabled) {
            navigator.vibrate(20);
        }
    }
    
    updateUpgradePanel() {
        document.getElementById('currentGold').textContent = this.gold;
        document.getElementById('towerLevel').textContent = this.tower.level;
        document.getElementById('towerDamage').textContent = this.tower.damage;
        document.getElementById('towerRange').textContent = this.tower.range;
        document.getElementById('towerFireRate').textContent = (this.tower.fireRate / 1000).toFixed(1) + 's';
        document.getElementById('towerTargets').textContent = this.tower.maxTargets;
        document.getElementById('towerClickDamage').textContent = this.clickDamage;
        document.getElementById('towerChainLightning').textContent = this.tower.chainLightning;
        document.getElementById('currentChainJumps').textContent = this.tower.chainLightning;
        document.getElementById('towerShield').textContent = this.tower.shield + '/' + this.tower.maxShield;
        document.getElementById('currentShield').textContent = this.tower.maxShield;
        document.getElementById('towerArmor').textContent = this.tower.armor || 0;
        document.getElementById('towerCritChance').textContent = Math.round((this.critChance || 0) * 100) + '%';
        document.getElementById('towerCritDamage').textContent = (this.critDamageMultiplier || 2).toFixed(1) + 'x';
        document.getElementById('towerBurnChance').textContent = Math.round((this.statusConfig.shockChance || 0) * 100) + '%';
        document.getElementById('towerSlowChance').textContent = Math.round((this.statusConfig.slowChance || 0) * 100) + '%';
        document.getElementById('towerGoldBoost').textContent = Math.round(((this.tower.goldBoost || 1) - 1) * 100) + '%';
        document.getElementById('towerChainRange').textContent = this.tower.chainRange || 80;
        document.getElementById('towerClickRadius').textContent = this.clickStrikeRadius;
        document.getElementById('towerClickRate').textContent = this.clickFireRate + 'ms';
        
        document.getElementById('damageCost').textContent = this.upgradeCosts.damage;
        document.getElementById('rangeCost').textContent = this.upgradeCosts.range;
        document.getElementById('fireRateCost').textContent = this.upgradeCosts.fireRate;
        document.getElementById('healthCost').textContent = this.upgradeCosts.health;
        document.getElementById('targetsCost').textContent = this.upgradeCosts.targets;
        document.getElementById('clickDamageCost').textContent = this.upgradeCosts.clickDamage;
        document.getElementById('chainLightningCost').textContent = this.upgradeCosts.chainLightning;
        document.getElementById('shieldCost').textContent = this.upgradeCosts.shield;
        document.getElementById('maxHealthCost').textContent = this.upgradeCosts.maxHealth;
        document.getElementById('armorCost').textContent = this.upgradeCosts.armor;
        document.getElementById('critChanceCost').textContent = this.upgradeCosts.critChance;
        document.getElementById('critDamageCost').textContent = this.upgradeCosts.critDamage;
        document.getElementById('burnChanceCost').textContent = this.upgradeCosts.burnChance;
        document.getElementById('slowChanceCost').textContent = this.upgradeCosts.slowChance;
        document.getElementById('goldBoostCost').textContent = this.upgradeCosts.goldBoost;
        document.getElementById('chainRangeCost').textContent = this.upgradeCosts.chainRange;
        document.getElementById('clickRadiusCost').textContent = this.upgradeCosts.clickRadius;
        document.getElementById('clickRateCost').textContent = this.upgradeCosts.clickRate;
        
        // Disable buttons if not enough gold
        const upgrades = ['damage', 'range', 'fireRate', 'health', 'targets', 'clickDamage', 'chainLightning', 'shield', 'maxHealth', 'armor', 'critChance', 'critDamage', 'burnChance', 'slowChance', 'goldBoost', 'chainRange', 'clickRadius', 'clickRate'];
        upgrades.forEach(type => {
            // Handle special capitalization cases
            let btnId;
            if (type === 'fireRate') {
                btnId = 'upgradeFireRate';
            } else if (type === 'clickDamage') {
                btnId = 'upgradeClickDamage';
            } else if (type === 'chainLightning') {
                btnId = 'upgradeChainLightning';
            } else {
                btnId = `upgrade${type.charAt(0).toUpperCase() + type.slice(1)}`;
            }
            
            const btn = document.getElementById(btnId);
            if (!btn) return; // Skip if button doesn't exist
            
            const cost = this.upgradeCosts[type];
            if (this.gold < cost || (type === 'health' && this.tower.health >= this.tower.maxHealth)) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
    }
    
    spawnZombie() {
        // Check if this is a boss wave (every 5 waves) and boss hasn't spawned yet
        const isBossWave = this.wave % 5 === 0;
        const spawnBoss = isBossWave && !this.bossSpawned;
        
        // Check if this is a split boss wave (every 10 waves)
        const isSplitBossWave = this.wave % 10 === 0;
        const spawnSplitBoss = isSplitBossWave && !this.splitBossSpawned && this.bossSpawned;
        
        // Spawn from random edge
        const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
        let x, y;
        
        switch(side) {
            case 0: // top
                x = Math.random() * this.width;
                y = -50;
                break;
            case 1: // right
                x = this.width + 50;
                y = Math.random() * this.height;
                break;
            case 2: // bottom
                x = Math.random() * this.width;
                y = this.height + 50;
                break;
            case 3: // left
                x = -50;
                y = Math.random() * this.height;
                break;
        }
        
        let zombie;
        
        if (spawnSplitBoss) {
            // Split Boss Zombie - Splits into 2 mini-bosses on death!
            zombie = {
                x: x,
                y: y,
                type: 'splitboss',
                radius: 35,
                health: 150 + this.wave * 25,
                maxHealth: 150 + this.wave * 25,
                speed: 0.35,
                goldValue: 150 + this.wave * 15,
                lastDamageTime: 0,
                damageRate: 900,
                damage: 5,
                color: '#ff00ff',
                emoji: '👹',
                isBoss: true,
                isSplitBoss: true
            };
            this.splitBossSpawned = true;
            this.playSound('boss');
            this.showMessage('💀 SPLIT BOSS INCOMING! 💀', '#ff00ff');
            this.showNarration('👹 BEWARE THE SPLIT BOSS! 👹', 3000);
        } else if (spawnBoss) {
            // Boss Zombie
            zombie = {
                x: x,
                y: y,
                type: 'boss',
                radius: 30,
                health: 100 + this.wave * 20,
                maxHealth: 100 + this.wave * 20,
                speed: 0.3,
                goldValue: 100 + this.wave * 10,
                lastDamageTime: 0,
                damageRate: 1000,
                damage: 4,
                color: '#ff0000',
                emoji: '👑',
                isBoss: true
            };
            this.bossSpawned = true;
            this.playSound('boss');
            this.showMessage('💀 BOSS ZOMBIE INCOMING! 💀', '#ff0000');
            this.showNarration('💀 BOSS APPROACHING! 💀', 3000);
        } else {
            // Determine zombie type - use themed wave if set, otherwise random
            let zombieType;
            
            if (this.currentWaveTheme) {
                // Themed wave - spawn only this type
                zombieType = this.currentWaveTheme;
            } else {
                // Random/mixed wave - determine based on wave and random chance
                const rand = Math.random();
                
                if (this.wave >= 15 && rand < 0.15) {
                    zombieType = 'exploder';
                } else if (this.wave >= 12 && rand < 0.2) {
                    zombieType = 'spawner';
                } else if (this.wave >= 10 && rand < 0.3) {
                    zombieType = 'tank';
                } else if (this.wave >= 7 && rand < 0.4) {
                    zombieType = 'runner';
                } else if (this.wave >= 3 && rand < 0.55) {
                    zombieType = 'strong';
                } else {
                    zombieType = 'normal';
                }
            }
            
            // Create zombie based on type
            switch(zombieType) {
                case 'normal':
                    // Regular Zombie - Balanced stats
                    zombie = {
                        x: x,
                        y: y,
                        type: 'normal',
                        radius: 15,
                        health: 20 + this.wave * 5,
                        maxHealth: 20 + this.wave * 5,
                        speed: 0.5 + this.wave * 0.05,
                        goldValue: 10 + this.wave,
                        lastDamageTime: 0,
                        damageRate: 1000,
                        damage: 2,
                        color: '#00ff00',
                        emoji: '🧟',
                        isBoss: false
                    };
                    break;
                    
                case 'strong':
                    // Strong Zombie - More health, slower
                    zombie = {
                        x: x,
                        y: y,
                        type: 'strong',
                        radius: 18,
                        health: 40 + this.wave * 8,
                        maxHealth: 40 + this.wave * 8,
                        speed: 0.3 + this.wave * 0.03,
                        goldValue: 15 + this.wave * 1.5,
                        lastDamageTime: 0,
                        damageRate: 1000,
                        damage: 4,
                        color: '#ffaa00',
                        emoji: '🧟‍♂️',
                        isBoss: false
                    };
                    break;
                    
                case 'runner':
                    // Fast Zombie - Low health, very fast
                    zombie = {
                        x: x,
                        y: y,
                        type: 'runner',
                        radius: 12,
                        health: 10 + this.wave * 3,
                        maxHealth: 10 + this.wave * 3,
                        speed: 1.6 + this.wave * 0.14,
                        goldValue: 12 + this.wave,
                        lastDamageTime: 0,
                        damageRate: 800,
                        damage: 2,
                        color: '#00ffff',
                        emoji: '🏃',
                        isBoss: false
                    };
                    break;
                    
                case 'tank':
                    // Tank Zombie - Very high health, very slow
                    zombie = {
                        x: x,
                        y: y,
                        type: 'tank',
                        radius: 22,
                        health: 80 + this.wave * 15,
                        maxHealth: 80 + this.wave * 15,
                        speed: 0.2 + this.wave * 0.02,
                        goldValue: 25 + this.wave * 2,
                        lastDamageTime: 0,
                        damageRate: 1200,
                        damage: 5,
                        color: '#888888',
                        emoji: '🛡️',
                        isBoss: false
                    };
                    break;
                    
                case 'exploder':
                    // Exploder Zombie - Explodes on death, damaging tower
                    zombie = {
                        x: x,
                        y: y,
                        type: 'exploder',
                        radius: 16,
                        health: 25 + this.wave * 4,
                        maxHealth: 25 + this.wave * 4,
                        speed: 0.6 + this.wave * 0.06,
                        goldValue: 20 + this.wave * 1.5,
                        lastDamageTime: 0,
                        damageRate: 1000,
                        damage: 2,
                        color: '#ff00ff',
                        emoji: '💣',
                        isBoss: false,
                        isExploder: true
                    };
                    break;
                    
                case 'spawner':
                    // Spawner Zombie - Splits into 2 smaller zombies on death
                    zombie = {
                        x: x,
                        y: y,
                        type: 'spawner',
                        radius: 20,
                        health: 35 + this.wave * 6,
                        maxHealth: 35 + this.wave * 6,
                        speed: 0.4 + this.wave * 0.04,
                        goldValue: 18 + this.wave * 1.5,
                        lastDamageTime: 0,
                        damageRate: 1000,
                        damage: 3,
                        color: '#00ff88',
                        emoji: '👥',
                        isBoss: false,
                        isSpawner: true
                    };
                    break;
            }

            // Elite spawn: at most one elite per non-boss wave
            const isBossWave = this.wave % 5 === 0;
            const canSpawnElite = this.wave >= 8 && !isBossWave && !this.eliteSpawnedThisWave;
            if (canSpawnElite) {
                const baseChance = 0.06;
                const scalingChance = Math.min(0.10, Math.max(0, (this.wave - 8) * 0.004));
                const eliteChance = baseChance + scalingChance;

                if (Math.random() < eliteChance) {
                    this.eliteSpawnedThisWave = true;
                    this.applyEliteModifiers(zombie);
                    if (zombie.eliteTitle) {
                        const msg = `⭐ ELITE: ${zombie.eliteTitle.toUpperCase()} ⭐`;
                        this.showMessage(msg, zombie.glowColor || '#ffff00');
                        this.showNarration(msg, 1600);
                    }
                }
            }
        }
        
        this.zombies.push(zombie);
    }
    
    // Helper function to brighten colors for elite zombies
    brightenColor(hexColor) {
        // Convert hex to RGB, brighten, and return
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Brighten by adding 60 to each component (max 255)
        const newR = Math.min(255, r + 80);
        const newG = Math.min(255, g + 80);
        const newB = Math.min(255, b + 80);
        
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    pickEliteModifiers(zombie) {
        const type = zombie?.type || 'normal';
        const pool = [
            { id: 'swift', label: 'Swift', weight: 2.2 },
            { id: 'juggernaut', label: 'Juggernaut', weight: 1.9 },
            { id: 'armored', label: 'Armored', weight: 1.7 },
            { id: 'regenerator', label: 'Regenerator', weight: 1.5 },
            { id: 'berserk', label: 'Berserk', weight: 1.4 },
            { id: 'phasing', label: 'Phasing', weight: 1.1 },
            { id: 'volatile', label: 'Volatile', weight: 1.2 }
        ];

        // Avoid stacking too much of what the base type already is
        const filtered = pool.filter(m => {
            if (type === 'runner' && m.id === 'swift') return false;
            if (type === 'tank' && (m.id === 'juggernaut' || m.id === 'armored')) return false;
            if (type === 'exploder' && m.id === 'volatile') return false;
            return true;
        });

        const modsToPick = this.wave >= 18 ? 2 : 1;
        const chosen = [];
        let available = filtered.slice();

        const pickOne = () => {
            const total = available.reduce((sum, m) => sum + m.weight, 0);
            let roll = Math.random() * total;
            for (let i = 0; i < available.length; i++) {
                roll -= available[i].weight;
                if (roll <= 0) {
                    const picked = available[i];
                    available.splice(i, 1);
                    return picked;
                }
            }
            return available.pop();
        };

        for (let i = 0; i < modsToPick; i++) {
            if (!available.length) break;
            chosen.push(pickOne());
        }

        return chosen;
    }

    applyEliteModifiers(zombie) {
        if (!zombie || zombie.isBoss) return;

        zombie.isElite = true;
        zombie.eliteMods = [];
        zombie.eliteModLabels = [];
        zombie.damageTakenMult = 1;

        const mods = this.pickEliteModifiers(zombie);
        const modsCount = mods.length;

        // Base elite bump (kept moderate; modifiers do the identity)
        const baseHealthMult = 1.45;
        const baseSpeedMult = 1.05;
        zombie.health = Math.floor(zombie.health * baseHealthMult);
        zombie.maxHealth = Math.floor(zombie.maxHealth * baseHealthMult);
        zombie.speed *= baseSpeedMult;
        zombie.damage = Math.max(1, Math.floor((zombie.damage || 1) * 1.15));
        zombie.goldValue = Math.floor((zombie.goldValue || 1) * (2.0 + 0.4 * modsCount));
        zombie.radius += 3;

        zombie.glowColor = this.brightenColor(zombie.color || '#00ff00');
        zombie.emoji = '⭐' + (zombie.emoji || '🧟');

        // Apply modifier effects
        mods.forEach(m => {
            zombie.eliteMods.push(m.id);
            zombie.eliteModLabels.push(m.label);

            switch (m.id) {
                case 'swift':
                    zombie.speed *= 1.55;
                    break;
                case 'juggernaut':
                    zombie.health = Math.floor(zombie.health * 1.8);
                    zombie.maxHealth = Math.floor(zombie.maxHealth * 1.8);
                    zombie.speed *= 0.88;
                    zombie.radius += 2;
                    break;
                case 'armored':
                    zombie.damageTakenMult *= 0.78;
                    break;
                case 'regenerator':
                    // Regen scales gently with maxHealth; ticks in update loop
                    zombie.regenPerSec = Math.max(0.6, zombie.maxHealth * 0.006);
                    break;
                case 'berserk':
                    zombie.hasBerserk = true;
                    zombie.baseSpeed = zombie.speed;
                    break;
                case 'phasing':
                    zombie.hasPhasing = true;
                    zombie.phaseIntervalMs = 2200;
                    zombie.phaseDurationMs = 650;
                    zombie.nextPhaseAt = performance.now() + 900 + Math.random() * 800;
                    zombie.phasedUntil = 0;
                    break;
                case 'volatile':
                    zombie.isVolatile = true;
                    break;
            }
        });

        zombie.eliteTitle = zombie.eliteModLabels.join(' + ');
    }

    updateEliteBehavior(zombie, deltaTime, currentTime) {
        if (!zombie || !zombie.isElite) return;

        if (zombie.regenPerSec && zombie.health > 0 && zombie.health < zombie.maxHealth) {
            zombie.health = Math.min(zombie.maxHealth, zombie.health + (zombie.regenPerSec * deltaTime) / 1000);
        }

        if (zombie.hasBerserk && Number.isFinite(zombie.baseSpeed)) {
            const hpFrac = zombie.maxHealth > 0 ? (zombie.health / zombie.maxHealth) : 1;
            zombie.speed = zombie.baseSpeed * (hpFrac < 0.4 ? 1.65 : 1.0);
        }

        if (zombie.hasPhasing) {
            if (currentTime >= (zombie.nextPhaseAt || 0)) {
                zombie.phasedUntil = currentTime + (zombie.phaseDurationMs || 650);
                zombie.nextPhaseAt = currentTime + (zombie.phaseIntervalMs || 2200);
            }
            zombie.isPhased = currentTime < (zombie.phasedUntil || 0);
        } else {
            zombie.isPhased = false;
        }
    }

    dealDamageToZombie(zombie, rawDamage) {
        if (!zombie || rawDamage <= 0) return 0;
        if (zombie.isPhased) return 0;

        const mult = Number.isFinite(zombie.damageTakenMult) ? zombie.damageTakenMult : 1;
        const finalDamage = Math.max(1, Math.floor(rawDamage * mult));
        zombie.health -= finalDamage;
        return finalDamage;
    }
    
    updateZombies(deltaTime, currentTime = performance.now()) {
        
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];

            // Elite behaviors (regen/phasing/berserk)
            this.updateEliteBehavior(zombie, deltaTime, currentTime);

            // Status ticking (shock)
            if (zombie.shockedUntil && currentTime < zombie.shockedUntil && zombie.shockDps) {
                const shockDamage = (zombie.shockDps * deltaTime) / 1000;
                if (shockDamage > 0) {
                    zombie.health -= shockDamage;
                    this.sessionDamage += shockDamage;
                }
            }

            // Boss patterns (shield/summon/rage)
            if (zombie.isBoss) {
                this.updateBossBehavior(zombie, currentTime);
            }
            
            // Move towards tower
            const dx = this.tower.x - zombie.x;
            const dy = this.tower.y - zombie.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.tower.radius + zombie.radius) {
                // Zombie hasn't reached tower yet - keep moving
                const isStunned = zombie.stunnedUntil && currentTime < zombie.stunnedUntil;
                const isSlowed = zombie.slowedUntil && currentTime < zombie.slowedUntil;
                const slowFactor = isSlowed ? (zombie.slowFactor || this.statusConfig.slowFactor) : 1;
                const moveFactor = isStunned ? 0 : slowFactor;
                zombie.x += (dx / distance) * zombie.speed * moveFactor * deltaTime / 16;
                zombie.y += (dy / distance) * zombie.speed * moveFactor * deltaTime / 16;
            } else {
                // Zombie reached tower - damage it periodically!
                if (currentTime - zombie.lastDamageTime >= zombie.damageRate) {
                    const zombieDamage = zombie.damage || 1;
                    // Shield absorbs damage first
                    if (this.tower.shield > 0) {
                        this.tower.shield = Math.max(0, this.tower.shield - zombieDamage);
                        // Create blue shield particle effect
                        this.createParticles(zombie.x, zombie.y, '#00ddff', 3);
                    } else {
                        const zombieDamageReduced = Math.max(1, zombieDamage - (this.tower.armor || 0));
                        this.tower.health -= zombieDamageReduced;
                        this.challengeTracking.damageTaken += zombieDamageReduced;
                        this.addScreenShake(2, 120);
                        // Create red damage particle effect
                        this.createParticles(zombie.x, zombie.y, '#ff0000', 3);
                        
                        // Check for critical health warning
                        const healthPercent = this.tower.health / this.tower.maxHealth;
                        if (healthPercent <= 0.25 && !this.criticalHealthWarned) {
                            this.showNarration('⚠️ TOWER CRITICAL! ⚠️', 3000);
                            this.criticalHealthWarned = true;
                        }
                    }
                    zombie.lastDamageTime = currentTime;
                    
                    if (this.tower.health <= 0) {
                        this.gameOver();
                    }
                }
                // Zombie stays at the tower and doesn't die
            }
            
            // Remove dead zombies
            if (zombie.health <= 0) {
                // Apply XP multiplier to kills
                const killsGained = Math.floor(1 * (this.xpMultiplier || 1));
                this.kills += killsGained;
                
                // Apply gold multiplier
                const goldGained = Math.floor(zombie.goldValue * (this.goldMultiplier || 1) * (this.tower.goldBoost || 1));
                this.gold += goldGained;
                this.sessionGoldEarned += goldGained;
                
                // Create flying gold coin
                const goldEl = document.getElementById('gold');
                if (goldEl) {
                    const rect = goldEl.getBoundingClientRect();
                    const targetX = rect.left + rect.width / 2;
                    const targetY = rect.top + rect.height / 2;
                    const midX = (zombie.x + targetX) / 2;
                    const midY = Math.min(zombie.y, targetY) - 100;
                    this.goldCoins.push({
                        x: zombie.x,
                        y: zombie.y,
                        startX: zombie.x,
                        startY: zombie.y,
                        midX: midX,
                        midY: midY,
                        targetX: targetX,
                        targetY: targetY,
                        progress: 0,
                        size: Math.min(zombie.goldValue / 5, 8) + 3
                    });
                }
                
                // Track zombie type kills
                if (zombie.type) {
                    this.sessionZombieKills[zombie.type]++;
                }
                
                // Track boss kills
                if (zombie.isBoss) {
                    this.sessionBossKills++;
                    this.maybeOfferRelicDrop(zombie);
                }
                
                // Exploder zombie deals damage to tower on death
                if (zombie.isExploder) {
                    const explosionDamage = 5 + Math.floor(this.wave / 2);
                    const dist = Math.sqrt((zombie.x - this.tower.x) ** 2 + (zombie.y - this.tower.y) ** 2);
                    const explosionRadius = 200;

                    // Visualize the blast radius ring
                    this.createExplosionRing(zombie.x, zombie.y, explosionRadius, '#ff00ff');
                    
                    // Only explode if within 200 pixels of tower
                    if (dist < explosionRadius) {
                        if (this.tower.shield > 0) {
                            this.tower.shield = Math.max(0, this.tower.shield - explosionDamage);
                        } else {
                            const reducedExplosionDamage = Math.max(1, explosionDamage - (this.tower.armor || 0));
                            this.tower.health -= reducedExplosionDamage;
                        }
                        this.addScreenShake(3, 180);
                        this.showMessage(`💥 EXPLOSION! -${explosionDamage} HP`, '#ff00ff');
                        // Large purple explosion particles
                        this.createParticles(zombie.x, zombie.y, '#ff00ff', 15);
                    } else {
                        // Small explosion even if far away
                        this.createParticles(zombie.x, zombie.y, '#ff00ff', 8);
                    }
                } else if (zombie.isElite && zombie.isVolatile) {
                    const explosionDamage = 3 + Math.floor(this.wave / 3);
                    const dist = Math.sqrt((zombie.x - this.tower.x) ** 2 + (zombie.y - this.tower.y) ** 2);
                    const explosionRadius = 170;
                    const ringColor = zombie.glowColor || '#ff00ff';

                    // Visualize the blast radius ring
                    this.createExplosionRing(zombie.x, zombie.y, explosionRadius, ringColor);
                    // Volatile elites punish close-range kills a bit
                    if (dist < explosionRadius) {
                        if (this.tower.shield > 0) {
                            this.tower.shield = Math.max(0, this.tower.shield - explosionDamage);
                        } else {
                            const reducedExplosionDamage = Math.max(1, explosionDamage - (this.tower.armor || 0));
                            this.tower.health -= reducedExplosionDamage;
                        }
                        this.addScreenShake(2, 140);
                        this.showMessage(`💥 VOLATILE BLAST! -${explosionDamage} HP`, ringColor);
                        this.createParticles(zombie.x, zombie.y, ringColor, 12);
                    } else {
                        this.createParticles(zombie.x, zombie.y, ringColor, 6);
                    }
                } else if (zombie.isSplitBoss) {
                    // Split Boss spawns 2 mini-bosses on death!
                    this.showMessage('👹 SPLIT BOSS DIVIDED! 2 MINI-BOSSES INCOMING! 👹', '#ff00ff');
                    this.showNarration('⚠️ TWO MINI-BOSSES! ⚠️', 2500);
                    this.createParticles(zombie.x, zombie.y, '#ff00ff', 20);
                    this.playSound('boss');
                    
                    // Spawn 2 mini-bosses at the death location
                    for (let j = 0; j < 2; j++) {
                        const angleOffset = (j === 0 ? -1 : 1);
                        const spawnX = zombie.x + Math.cos(angleOffset) * 50;
                        const spawnY = zombie.y + Math.sin(angleOffset) * 50;
                        
                        this.zombies.push({
                            x: spawnX,
                            y: spawnY,
                            type: 'miniboss',
                            radius: 25,
                            health: 60 + this.wave * 12,
                            maxHealth: 60 + this.wave * 12,
                            speed: 0.4,
                            goldValue: 60 + this.wave * 8,
                            lastDamageTime: 0,
                            damageRate: 950,
                            damage: 2,
                            color: '#ff0080',
                            emoji: '👿',
                            isBoss: true,
                            isMiniBoss: true
                        });
                    }
                } else if (zombie.isSpawner) {
                    // Spawner zombie splits into 2 smaller zombies on death
                    this.showMessage('👥 SPAWNER SPLIT!', '#00ff88');
                    this.createParticles(zombie.x, zombie.y, '#00ff88', 12);
                    
                    // Spawn 2 smaller zombies at the death location
                    for (let j = 0; j < 2; j++) {
                        const angleOffset = (j === 0 ? -0.5 : 0.5);
                        const spawnX = zombie.x + Math.cos(angleOffset) * 30;
                        const spawnY = zombie.y + Math.sin(angleOffset) * 30;
                        
                        this.zombies.push({
                            x: spawnX,
                            y: spawnY,
                            type: 'normal',
                            radius: 12,
                            health: 15 + this.wave * 3,
                            maxHealth: 15 + this.wave * 3,
                            speed: 0.7 + this.wave * 0.06,
                            goldValue: 8 + this.wave,
                            lastDamageTime: 0,
                            damageRate: 1000,
                            damage: 1,
                            color: '#00ff88',
                            emoji: '🧟',
                            isBoss: false,
                            isSpawn: true
                        });
                    }
                } else {
                    // Red blood splash when zombie dies
                    this.createParticles(zombie.x, zombie.y, '#ff0000', 5);
                }
                
                // Play death and gold sounds
                this.playSound('zombieDeath');
                this.playSound('gold');
                
                this.zombies.splice(i, 1);
            }
        }
    }
    
    towerAttack(currentTime) {
        if (currentTime - this.tower.lastFire < this.tower.fireRate) return;
        
        // Find zombies in range
        const targets = this.zombies.filter(zombie => {
            const dx = zombie.x - this.tower.x;
            const dy = zombie.y - this.tower.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= this.tower.range;
        });
        
        if (targets.length > 0) {
            // Create electric sparks around tower
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 * i / 6) + Math.random() * 0.5;
                const dist = this.tower.radius + 10 + Math.random() * 15;
                this.towerSparks.push({
                    x: this.tower.x + Math.cos(angle) * dist,
                    y: this.tower.y + Math.sin(angle) * dist,
                    vx: Math.cos(angle) * 2,
                    vy: Math.sin(angle) * 2,
                    life: 300,
                    size: Math.random() * 2 + 1,
                    color: Math.random() > 0.5 ? '#00ffff' : '#ffffff'
                });
            }
            
            // Attack up to maxTargets closest zombies with tesla effect
            const sorted = targets.sort((a, b) => {
                const distA = Math.sqrt((a.x - this.tower.x) ** 2 + (a.y - this.tower.y) ** 2);
                const distB = Math.sqrt((b.x - this.tower.x) ** 2 + (b.y - this.tower.y) ** 2);
                return distA - distB;
            });
            
            const attackCount = Math.min(this.tower.maxTargets, sorted.length);
            for (let i = 0; i < attackCount; i++) {
                const target = sorted[i];
                
                // Attack primary target and handle chain lightning
                this.attackTargetWithChain(target, this.tower.x, this.tower.y, [], 0, currentTime);
            }
            
            this.tower.lastFire = currentTime;
        }
    }
    
    attackTargetWithChain(target, fromX, fromY, hitTargets, chainCount = 0, currentTime = performance.now()) {
        // Prevent hitting the same zombie twice
        if (hitTargets.includes(target)) return;
        
        // Check for critical strike
        const isCrit = Math.random() < (this.critChance || 0);
        const damageDealt = isCrit ? Math.floor(this.tower.damage * (this.critDamageMultiplier || 2)) : this.tower.damage;

        // Deal damage to current target (accounts for armored/phasing)
        const actualDamage = this.dealDamageToZombie(target, damageDealt);
        hitTargets.push(target);

        // Track damage dealt
        this.sessionDamage += actualDamage;

        if (actualDamage > 0) {
            // Create floating damage number (yellow for crits)
            this.createDamageNumber(target.x, target.y - 20, actualDamage, isCrit);
        } else {
            // Phased hit: subtle effect so it doesn't feel like a bug
            this.createParticles(target.x, target.y, 'rgba(200, 200, 255, 0.55)', 2);
        }

        // Tiny hit pause on crits (feel)
        if (isCrit) this.triggerHitPause(35);

        // Apply status effects from upgrades
        this.tryApplyStatusEffectsFromAttack(target, currentTime, chainCount);
        
        // Create lightning effect from source to target
        this.lightning.push({
            x1: fromX,
            y1: fromY,
            x2: target.x,
            y2: target.y,
            life: 200, // milliseconds
            isChain: chainCount > 0 // Mark chain lightning for different effect
        });
        
        // Create impact effect
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8);
            const speed = Math.random() * 3 + 2;
            this.impactParticles.push({
                x: target.x,
                y: target.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 400,
                color: Math.random() > 0.5 ? '#ffff00' : '#ffffff',
                radius: Math.random() * 2 + 1
            });
        }
        
        // Create small cyan splash where tower attack lands
        this.createParticles(target.x, target.y, '#00ffff', 3);
        
        // If zombie is killed, add red blood splash
        if (target.health <= 0) {
            this.createParticles(target.x, target.y, '#ff0000', 4);
        }
        
        // Chain lightning logic
        if (chainCount < this.tower.chainLightning) {
            // Find nearby zombies that haven't been hit
            const nearbyTargets = this.zombies.filter(zombie => {
                if (hitTargets.includes(zombie)) return false;
                
                const dx = zombie.x - target.x;
                const dy = zombie.y - target.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return distance <= this.tower.chainRange;
            });
            
            if (nearbyTargets.length > 0) {
                // Find closest nearby zombie
                const nextTarget = nearbyTargets.sort((a, b) => {
                    const distA = Math.sqrt((a.x - target.x) ** 2 + (a.y - target.y) ** 2);
                    const distB = Math.sqrt((b.x - target.x) ** 2 + (b.y - target.y) ** 2);
                    return distA - distB;
                })[0];
                
                // Chain to next target
                this.attackTargetWithChain(nextTarget, target.x, target.y, hitTargets, chainCount + 1, currentTime);
            }
        }
    }
    
    createParticles(x, y, color, count = 5) {
        if (!this.particlesEnabled) return;
        // Reduce particle count on mobile
        if (this.isMobile) count = Math.ceil(count / 2);
        
        // Check particle limit
        if (this.particles.length >= this.maxParticles) return;
        
        const particlesToCreate = Math.min(count, this.maxParticles - this.particles.length);
        
        for (let i = 0; i < particlesToCreate; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 400, // Shorter life for smaller effect
                color: color,
                radius: Math.random() * 2 + 1 // Smaller particles
            });
        }
    }
    
    createDamageNumber(x, y, damage, isCrit = false) {
        this.damageNumbers.push({
            x: x,
            y: y,
            damage: damage,
            life: 800, // How long it lasts (ms)
            vy: -1.5, // Float upward speed
            isCrit: isCrit // Mark as critical hit
        });
    }
    
    updateDamageNumbers(deltaTime) {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.y += dn.vy;
            dn.life -= deltaTime;
            
            if (dn.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }
    
    updateParticles(deltaTime) {
        if (!this.particlesEnabled) {
            this.particles.length = 0;
            return;
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= deltaTime;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updateLightning(deltaTime) {
        for (let i = this.lightning.length - 1; i >= 0; i--) {
            this.lightning[i].life -= deltaTime;
            if (this.lightning[i].life <= 0) {
                this.lightning.splice(i, 1);
            }
        }
    }
    
    updateTowerSparks(deltaTime) {
        if (!this.particlesEnabled) {
            this.towerSparks.length = 0;
            return;
        }
        for (let i = this.towerSparks.length - 1; i >= 0; i--) {
            const spark = this.towerSparks[i];
            spark.x += spark.vx;
            spark.y += spark.vy;
            spark.life -= deltaTime;
            if (spark.life <= 0) {
                this.towerSparks.splice(i, 1);
            }
        }
    }
    
    updateImpactParticles(deltaTime) {
        if (!this.particlesEnabled) {
            this.impactParticles.length = 0;
            return;
        }
        for (let i = this.impactParticles.length - 1; i >= 0; i--) {
            const p = this.impactParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.impactParticles.splice(i, 1);
            }
        }
    }

    createExplosionRing(x, y, radius, color = '#ff00ff') {
        if (!Number.isFinite(radius) || radius <= 0) return;
        if (!this.explosionRings) this.explosionRings = [];

        // Keep it lightweight
        if (this.explosionRings.length >= 10) this.explosionRings.shift();

        this.explosionRings.push({
            x,
            y,
            targetRadius: radius,
            life: 650,
            maxLife: 650,
            color
        });
    }

    updateExplosionRings(deltaTime) {
        if (!this.explosionRings || this.explosionRings.length === 0) return;
        for (let i = this.explosionRings.length - 1; i >= 0; i--) {
            const r = this.explosionRings[i];
            r.life -= deltaTime;
            if (r.life <= 0) this.explosionRings.splice(i, 1);
        }
    }
    
    updateGoldCoins(deltaTime) {
        for (let i = this.goldCoins.length - 1; i >= 0; i--) {
            const coin = this.goldCoins[i];
            coin.progress += 0.02;
            if (coin.progress >= 1) {
                this.goldCoins.splice(i, 1);
            } else {
                const t = coin.progress;
                const invT = 1 - t;
                coin.x = invT * invT * coin.startX + 2 * invT * t * coin.midX + t * t * coin.targetX;
                coin.y = invT * invT * coin.startY + 2 * invT * t * coin.midY + t * t * coin.targetY;
            }
        }
    }
    
    draw() {
        this.ctx.save();

        if (this.screenShakeEnabled && this.shakeTime > 0 && this.shakeDuration > 0) {
            const t = Math.max(0, Math.min(1, this.shakeTime / this.shakeDuration));
            const mag = this.shakeIntensity * t;
            const ox = (Math.random() * 2 - 1) * mag;
            const oy = (Math.random() * 2 - 1) * mag;
            this.ctx.translate(ox, oy);
        }

        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw range indicator
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.tower.x, this.tower.y, this.tower.range, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw tower
        const healthPercent = Math.min(1, Math.max(0, this.tower.health / this.tower.maxHealth));
        const gradient = this.ctx.createRadialGradient(
            this.tower.x, this.tower.y, 0,
            this.tower.x, this.tower.y, this.tower.radius
        );
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(1, '#0088ff');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.tower.x, this.tower.y, this.tower.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw shield if active
        if (this.tower.shield > 0) {
            const shieldAlpha = 0.3 + (this.tower.shield / this.tower.maxShield) * 0.4;
            this.ctx.strokeStyle = `rgba(0, 221, 255, ${shieldAlpha})`;
            this.ctx.lineWidth = 4;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#00ddff';
            this.ctx.beginPath();
            this.ctx.arc(this.tower.x, this.tower.y, this.tower.radius + 10, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.lineWidth = 1;
        }
        
        // Tower health bar (fixed width)
        const barWidth = 60;
        const barHeight = 8;
        
        // Background bar
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.tower.x - barWidth/2, this.tower.y - this.tower.radius - 15, barWidth, barHeight);
        
        // Health fill (clamped to prevent overflow)
        const healthBarWidth = Math.min(barWidth, barWidth * healthPercent);
        this.ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : (healthPercent > 0.25 ? '#ffff00' : '#ff0000');
        this.ctx.fillRect(this.tower.x - barWidth/2, this.tower.y - this.tower.radius - 15, healthBarWidth, barHeight);
        
        // Shield bar (if shield exists)
        if (this.tower.maxShield > 0) {
            const shieldPercent = Math.min(1, Math.max(0, this.tower.shield / this.tower.maxShield));
            const shieldBarWidth = Math.min(barWidth, barWidth * shieldPercent);
            
            // Background
            this.ctx.fillStyle = '#222';
            this.ctx.fillRect(this.tower.x - barWidth/2, this.tower.y - this.tower.radius - 28, barWidth, barHeight);
            
            // Shield fill
            this.ctx.fillStyle = '#00ddff';
            this.ctx.fillRect(this.tower.x - barWidth/2, this.tower.y - this.tower.radius - 28, shieldBarWidth, barHeight);
        }
        
        // Draw lightning effects
        this.lightning.forEach(bolt => {
            // Different color for click lightning
            if (bolt.isClick) {
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.shadowColor = '#ffff00';
            } else {
                this.ctx.strokeStyle = '#00ffff';
                this.ctx.shadowColor = '#00ffff';
            }
            
            // All lightning bolts use the same erratic style
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 20;
            
            this.ctx.beginPath();
            this.ctx.moveTo(bolt.x1, bolt.y1);
            
            // Erratic lightning strike with sharp angles and varying offsets
            const segments = 6 + Math.floor(Math.random() * 4); // Random 6-10 segments
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                // Large, sporadic random offsets that vary in intensity
                const intensity = 20 + Math.random() * 30; // Random intensity per segment
                const x = bolt.x1 + (bolt.x2 - bolt.x1) * t + (Math.random() - 0.5) * intensity;
                const y = bolt.y1 + (bolt.y2 - bolt.y1) * t + (Math.random() - 0.5) * intensity;
                this.ctx.lineTo(x, y);
            }
            this.ctx.lineTo(bolt.x2, bolt.y2);
            this.ctx.stroke();
            
            // Add random branches for more lightning-like effect
            if (Math.random() < 0.3) {
                const branchStart = Math.floor(Math.random() * segments);
                const t = branchStart / segments;
                const branchX = bolt.x1 + (bolt.x2 - bolt.x1) * t + (Math.random() - 0.5) * 30;
                const branchY = bolt.y1 + (bolt.y2 - bolt.y1) * t + (Math.random() - 0.5) * 30;
                const branchEndX = branchX + (Math.random() - 0.5) * 80;
                const branchEndY = branchY + (Math.random() - 0.5) * 80;
                
                this.ctx.beginPath();
                this.ctx.moveTo(branchX, branchY);
                this.ctx.lineTo(branchEndX, branchEndY);
                this.ctx.stroke();
            }
        });
        
        this.ctx.shadowBlur = 0;
        
        // Draw zombies
        this.zombies.forEach(zombie => {
            // Elite zombies get extra glow ring
            if (zombie.isElite) {
                const pulseIntensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
                this.ctx.strokeStyle = zombie.glowColor;
                this.ctx.lineWidth = 4;
                this.ctx.shadowBlur = 25;
                this.ctx.shadowColor = zombie.glowColor;
                this.ctx.globalAlpha = pulseIntensity;
                this.ctx.beginPath();
                this.ctx.arc(zombie.x, zombie.y, zombie.radius + 5, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
                this.ctx.shadowBlur = 0;
            }
            
            // Zombie body with type-specific color and glow effect
            this.ctx.fillStyle = zombie.color || '#4a4';

            // Phasing visual: semi-transparent with a dashed ring
            if (zombie.isPhased) {
                this.ctx.globalAlpha = 0.45;
                this.ctx.setLineDash([6, 6]);
                this.ctx.strokeStyle = zombie.glowColor || 'rgba(200, 200, 255, 0.8)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(zombie.x, zombie.y, zombie.radius + 9, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            
            // Add glow effect for special zombies
            if (zombie.isBoss || zombie.type === 'exploder' || zombie.type === 'tank' || zombie.isElite) {
                this.ctx.shadowBlur = zombie.isElite ? 20 : 15;
                this.ctx.shadowColor = zombie.isElite ? zombie.glowColor : zombie.color;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(zombie.x, zombie.y, zombie.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            if (zombie.isPhased) {
                this.ctx.globalAlpha = 1;
            }

            // Status rings (slow/shock/stun)
            const now = performance.now();
            if (zombie.stunnedUntil && now < zombie.stunnedUntil) {
                this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(zombie.x, zombie.y, zombie.radius + 4, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (zombie.slowedUntil && now < zombie.slowedUntil) {
                this.ctx.strokeStyle = 'rgba(0, 221, 255, 0.55)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(zombie.x, zombie.y, zombie.radius + 4, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            if (zombie.shockedUntil && now < zombie.shockedUntil) {
                this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.45)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(zombie.x, zombie.y, zombie.radius + 7, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            // Zombie health bar
            const zhealthPercent = zombie.health / zombie.maxHealth;
            const zbarWidth = zombie.radius * 2;
            const zbarHeight = 4;
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(zombie.x - zbarWidth/2, zombie.y - zombie.radius - 10, zbarWidth, zbarHeight);
            
            // Health bar color based on type
            let healthBarColor = '#ff0000';
            if (zombie.health > zombie.maxHealth * 0.66) healthBarColor = '#00ff00';
            else if (zombie.health > zombie.maxHealth * 0.33) healthBarColor = '#ffff00';
            
            this.ctx.fillStyle = healthBarColor;
            this.ctx.fillRect(zombie.x - zbarWidth/2, zombie.y - zombie.radius - 10, zbarWidth * zhealthPercent, zbarHeight);
        });
        
        // Draw particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / 1000;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });
        
        // Draw damage numbers
        this.damageNumbers.forEach(dn => {
            const alpha = dn.life / 800;
            this.ctx.globalAlpha = alpha;
            
            // Different style for critical hits
            if (dn.isCrit) {
                this.ctx.font = 'bold 24px Arial';
                this.ctx.fillStyle = '#ff0000';
                this.ctx.shadowColor = '#ff0000';
                this.ctx.shadowBlur = 10;
            } else {
                this.ctx.font = 'bold 18px Arial';
                this.ctx.fillStyle = '#ffff00';
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.textAlign = 'center';
            this.ctx.strokeText(dn.isCrit ? `CRIT! ${dn.damage}` : dn.damage, dn.x, dn.y);
            this.ctx.fillText(dn.isCrit ? `CRIT! ${dn.damage}` : dn.damage, dn.x, dn.y);
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
        
        // Draw tower sparks
        this.towerSparks.forEach(s => {
            this.ctx.fillStyle = s.color;
            this.ctx.globalAlpha = s.life / 300;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });
        
        // Draw impact particles
        this.impactParticles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / 400;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });

        // Draw explosion radius rings
        if (this.explosionRings && this.explosionRings.length) {
            this.explosionRings.forEach(r => {
                const t = 1 - (r.life / r.maxLife);
                const eased = 1 - Math.pow(1 - t, 2); // easeOutQuad
                const currentRadius = r.targetRadius * eased;
                const alpha = Math.max(0, 0.55 * (1 - t));

                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.strokeStyle = r.color;
                this.ctx.lineWidth = Math.max(1.5, 6 * (1 - t));
                this.ctx.shadowColor = r.color;
                this.ctx.shadowBlur = 14 * (1 - t);
                this.ctx.beginPath();
                this.ctx.arc(r.x, r.y, currentRadius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();
            });
        }
        
        // Draw gold coins
        this.goldCoins.forEach(coin => {
            const alpha = coin.progress < 0.9 ? 1 : (1 - coin.progress) * 10;
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#ffd700';
            this.ctx.beginPath();
            this.ctx.arc(coin.x, coin.y, coin.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#ffed4e';
            this.ctx.beginPath();
            this.ctx.arc(coin.x - coin.size/3, coin.y - coin.size/3, coin.size/2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });

        this.ctx.restore();
    }
    
    updateUI() {
        if (!this.ui) this.cacheUIElements();

        this.ui.wave && (this.ui.wave.textContent = this.wave);
        this.ui.kills && (this.ui.kills.textContent = this.kills);
        this.ui.gold && (this.ui.gold.textContent = this.gold);
        this.ui.towerHealth && (this.ui.towerHealth.textContent = Math.max(0, Math.floor(this.tower.health)));

        // Objective HUD
        this.ui.runObjectiveText && (this.ui.runObjectiveText.textContent = this.getObjectiveDisplayText());
        
        // Update player name display
        const playerName = localStorage.getItem('playerName') || 'Guest';
        this.ui.currentPlayerName && (this.ui.currentPlayerName.textContent = `Player: ${playerName}`);
        
        // Update gems display
        this.ui.gemsAmount && this.permStats && (this.ui.gemsAmount.textContent = this.permStats.gems || 0);
    }

    updateUIThrottled(currentTime, force = false) {
        if (force || currentTime - this.uiLastUpdate >= this.uiUpdateInterval) {
            this.updateUI();
            this.uiLastUpdate = currentTime;
        }
    }

    addScreenShake(intensity = 2, duration = 120) {
        if (!this.screenShakeEnabled) return;
        if (duration <= 0 || intensity <= 0) return;
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
        this.shakeTime = Math.max(this.shakeTime, duration);
    }
    
    showMessage(text, color) {
        // Could add a toast notification here
        console.log(text);
    }

    // ==========================================
    // HIT PAUSE / STATUS EFFECTS / BOSSES
    // ==========================================

    triggerHitPause(ms = 30) {
        if (!Number.isFinite(ms) || ms <= 0) return;
        this.hitPauseTime = Math.min(80, Math.max(this.hitPauseTime, ms));
    }

    tryApplyStatusEffectsFromAttack(target, currentTime, chainCount) {
        if (!target) return;

        const overchargeActive = this.abilities?.overcharge?.activeUntil && currentTime < this.abilities.overcharge.activeUntil;
        const shockChance = (this.statusConfig.shockChance || 0) + (overchargeActive ? 0.08 : 0);
        if (shockChance > 0 && Math.random() < shockChance) {
            this.applyShock(target, currentTime, this.statusConfig.shockDurationMs, this.statusConfig.shockDps);
        }

        const slowChance = Math.max(0, (this.statusConfig.slowChance || 0) + (chainCount > 0 ? 0.05 : 0));
        if (slowChance > 0 && Math.random() < slowChance) {
            this.applySlow(target, currentTime, this.statusConfig.slowDurationMs, this.statusConfig.slowFactor);
        }
    }

    applySlow(zombie, currentTime, durationMs, slowFactor) {
        if (!zombie) return;
        const dur = Math.max(200, durationMs || 0);
        const factor = Math.max(0.2, Math.min(0.95, slowFactor || this.statusConfig.slowFactor));
        const until = currentTime + dur;
        zombie.slowedUntil = Math.max(zombie.slowedUntil || 0, until);
        zombie.slowFactor = Math.min(zombie.slowFactor || 1, factor);
    }

    applyShock(zombie, currentTime, durationMs, dps) {
        if (!zombie) return;
        const dur = Math.max(200, durationMs || 0);
        zombie.shockedUntil = Math.max(zombie.shockedUntil || 0, currentTime + dur);
        zombie.shockDps = Math.max(zombie.shockDps || 0, Math.max(0, dps || 0));
    }

    applyStun(zombie, currentTime, durationMs) {
        if (!zombie) return;
        let dur = Math.max(100, durationMs || 0);
        if (zombie.isBoss) dur = Math.floor(dur * 0.5);
        zombie.stunnedUntil = Math.max(zombie.stunnedUntil || 0, currentTime + dur);
    }

    updateBossBehavior(zombie, currentTime) {
        if (!zombie.bossInit) {
            zombie.bossInit = true;
            zombie.bossPhase = 1;
            zombie.bossMaxShield = Math.floor(20 + this.wave * 3);
            zombie.nextSummonAt = currentTime + 3500;
        }

        const hpPct = zombie.maxHealth > 0 ? (zombie.health / zombie.maxHealth) : 0;

        if (zombie.bossPhase === 1 && hpPct <= 0.7) {
            zombie.bossPhase = 2;
            this.showNarration('🛡️ BOSS SHIELD! 🛡️', 1800);
            this.triggerHitPause(60);
        } else if (zombie.bossPhase === 2 && hpPct <= 0.35) {
            zombie.bossPhase = 3;
            zombie.speed *= 1.25;
            this.showNarration('😡 BOSS RAGE! 😡', 1800);
            this.triggerHitPause(60);
        }

        if (currentTime >= (zombie.nextSummonAt || 0)) {
            zombie.nextSummonAt = currentTime + 6500;

            for (let j = 0; j < 2; j++) {
                const a = Math.random() * Math.PI * 2;
                const r = zombie.radius + 20;
                const spawnX = zombie.x + Math.cos(a) * r;
                const spawnY = zombie.y + Math.sin(a) * r;
                this.zombies.push({
                    x: spawnX,
                    y: spawnY,
                    type: (this.wave >= 7 && Math.random() < 0.35) ? 'runner' : 'normal',
                    radius: 12,
                    health: 14 + this.wave * 3,
                    maxHealth: 14 + this.wave * 3,
                    speed: 0.65 + this.wave * 0.04,
                    goldValue: 6 + this.wave,
                    lastDamageTime: 0,
                    damageRate: 1000,
                    damage: 1,
                    color: '#00ff00',
                    emoji: '🧟',
                    isBoss: false,
                    isSpawn: true
                });
            }

            this.createParticles(zombie.x, zombie.y, '#ff00ff', 8);
        }
    }

    // ==========================================
    // BETWEEN-WAVE CHOICES / OBJECTIVES / CURSES
    // ==========================================

    onWaveAdvanced(currentTime) {
        this.checkObjectiveCompletion();
        this.maybeOfferWaveChoice(currentTime);
    }

    maybeOfferWaveChoice(currentTime) {
        if (!this.isGameStarted || this.isGameOver) return;
        if (this.waveChoiceState.active) return;
        if (this.waveChoiceState.waveOffered === this.wave) return;

        const options = this.generateWaveChoices();
        if (!options || options.length === 0) return;

        this.waveChoiceState = { active: true, options, waveOffered: this.wave };
        this.openWaveChoicePanel(currentTime);
    }

    openWaveChoicePanel(currentTime) {
        if (!this.ui) this.cacheUIElements();
        this.isPaused = true;
        this.ui.waveChoiceBackdrop && this.ui.waveChoiceBackdrop.classList.add('active');
        this.ui.waveChoicePanel && this.ui.waveChoicePanel.classList.add('active');

        if (this.ui.waveChoiceSubtitle) {
            const objectiveText = this.getObjectiveDisplayText();
            this.ui.waveChoiceSubtitle.textContent = objectiveText && objectiveText !== '—'
                ? `Wave ${this.wave} • ${objectiveText}`
                : `Wave ${this.wave}`;
        }

        const container = this.ui.waveChoiceOptions;
        if (!container) return;
        container.innerHTML = '';

        this.waveChoiceState.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.className = 'upgrade-option wave-choice-option';
            btn.type = 'button';
            btn.innerHTML = `
                <div class="upgrade-icon">${opt.icon || '⚡'}</div>
                <div class="upgrade-name">${opt.name}</div>
                <div class="upgrade-desc">${opt.desc}</div>
            `;
            btn.addEventListener('click', () => this.applyWaveChoice(opt, currentTime));
            container.appendChild(btn);
        });
    }

    closeWaveChoicePanel() {
        if (!this.ui) this.cacheUIElements();
        this.ui.waveChoiceBackdrop && this.ui.waveChoiceBackdrop.classList.remove('active');
        this.ui.waveChoicePanel && this.ui.waveChoicePanel.classList.remove('active');
        this.ui.waveChoiceOptions && (this.ui.waveChoiceOptions.innerHTML = '');
        this.waveChoiceState.active = false;
        this.isPaused = false;
    }

    applyWaveChoice(choice, currentTime) {
        try {
            choice?.apply?.(this, currentTime);
        } catch (e) {
            console.error('Failed to apply choice:', e);
        }

        this.updateAbilityUI(currentTime, true);
        this.updateUI();
        this.playSound('upgrade');
        this.closeWaveChoicePanel();
    }

    generateWaveChoices() {
        const pool = [];

        pool.push({ id: 'damagePlus', icon: '💥', name: 'Damage Surge', desc: '+3 tower damage', apply: (g) => { g.tower.damage += 3; } });
        pool.push({ id: 'rangePlus', icon: '📡', name: 'Long Range Coils', desc: '+25 tower range', apply: (g) => { g.tower.range += 25; } });
        pool.push({ id: 'fireRatePlus', icon: '⚡', name: 'Faster Cycling', desc: '-70ms fire rate', apply: (g) => { g.tower.fireRate = Math.max(180, g.tower.fireRate - 70); } });
        pool.push({ id: 'shieldPack', icon: '🛡️', name: 'Shield Pack', desc: '+6 max shield and refill', apply: (g) => { g.tower.maxShield = (g.tower.maxShield || 0) + 6; g.tower.shield = g.tower.maxShield; } });

        // More general upgrades
        pool.push({ id: 'targetsPlus', icon: '🎯', name: 'Multi-Target Wiring', desc: '+1 max targets', apply: (g) => { g.tower.maxTargets = Math.min(8, (g.tower.maxTargets || 1) + 1); } });
        pool.push({ id: 'chainPlus', icon: '⛓️', name: 'Chain Amplifier', desc: '+1 chain jump', apply: (g) => { g.tower.chainLightning = Math.min(8, (g.tower.chainLightning || 0) + 1); } });
        pool.push({ id: 'chainRangePlus', icon: '🧲', name: 'Arc Reach', desc: '+18 chain range', apply: (g) => { g.tower.chainRange = Math.min(180, (g.tower.chainRange || 80) + 18); } });
        pool.push({ id: 'goldBurst', icon: '💰', name: 'Gold Burst', desc: '+120 gold now', apply: (g) => { g.gold += 120; } });
        pool.push({ id: 'healPulse', icon: '🧰', name: 'Repair Pulse', desc: '+35 HP (up to max)', apply: (g) => { g.tower.health = Math.min(g.tower.maxHealth, g.tower.health + 35); } });

        // Click upgrades (NOT skill-shot; just tighter randomness)
        pool.push({
            id: 'clickFocus',
            icon: '🎯',
            name: 'Focused Discharge',
            desc: 'Tighter click strike radius (-12px)',
            apply: (g) => { g.clickStrikeRadius = Math.max(10, (Number(g.clickStrikeRadius ?? 50) - 12)); }
        });
        pool.push({ id: 'clickDamagePlus', icon: '🖱️', name: 'Hot Click Coils', desc: '+3 click damage', apply: (g) => { g.clickDamage += 3; } });
        pool.push({ id: 'clickFaster', icon: '⚡', name: 'Rapid Taps', desc: 'Faster click fire rate (-20ms)', apply: (g) => { g.clickFireRate = Math.max(60, (g.clickFireRate || 150) - 20); } });

        // Crit as a run modifier (stacks with gem upgrades)
        pool.push({ id: 'critPlus', icon: '✨', name: 'Critical Coils', desc: '+3% crit chance', apply: (g) => { g.critChance = Math.min(0.5, (g.critChance || 0) + 0.03); } });

        pool.push({ id: 'slowUpgrade', icon: '❄️', name: 'Cryo Conductors', desc: 'Tower hits: +12% slow chance', apply: (g) => { g.statusConfig.slowChance = Math.min(0.6, (g.statusConfig.slowChance || 0) + 0.12); } });
        pool.push({ id: 'shockUpgrade', icon: '⚡', name: 'Static Field', desc: 'Tower hits: +10% shock chance (DoT)', apply: (g) => { g.statusConfig.shockChance = Math.min(0.6, (g.statusConfig.shockChance || 0) + 0.10); g.statusConfig.shockDps = Math.max(g.statusConfig.shockDps || 0, 6 + Math.floor(g.wave / 2)); } });
        pool.push({ id: 'slowLonger', icon: '🧊', name: 'Deep Freeze', desc: 'Slow lasts +350ms', apply: (g) => { g.statusConfig.slowDurationMs = Math.min(3200, (g.statusConfig.slowDurationMs || 1400) + 350); } });
        pool.push({ id: 'shockHarder', icon: '🌩️', name: 'Overvoltage', desc: '+2 shock DPS', apply: (g) => { g.statusConfig.shockDps = Math.min(50, (g.statusConfig.shockDps || 0) + 2); } });

        if (!this.abilities.emp.unlocked) {
            pool.push({ id: 'unlockEmp', icon: '⚡', name: 'Unlock: EMP Pulse', desc: 'Stun nearby zombies (active)', apply: (g) => { g.abilities.emp.unlocked = true; } });
        } else {
            pool.push({ id: 'empCooldown', icon: '⏱️', name: 'EMP Capacitors', desc: 'EMP cooldown -3s', apply: (g) => { g.abilities.emp.cooldownMs = Math.max(6000, (g.abilities.emp.cooldownMs || 20000) - 3000); } });
        }
        if (!this.abilities.overcharge.unlocked) {
            pool.push({ id: 'unlockOvercharge', icon: '⚙️', name: 'Unlock: Overcharge', desc: 'Boost fire rate (active)', apply: (g) => { g.abilities.overcharge.unlocked = true; } });
        } else {
            pool.push({ id: 'overCooldown', icon: '⏱️', name: 'Overcharge Inverters', desc: 'Overcharge cooldown -4s', apply: (g) => { g.abilities.overcharge.cooldownMs = Math.max(9000, (g.abilities.overcharge.cooldownMs || 30000) - 4000); } });
            pool.push({ id: 'overLonger', icon: '🔧', name: 'Sustained Overcharge', desc: 'Overcharge lasts +1.2s', apply: (g) => { g.abilities.overcharge.durationMs = Math.min(12000, (g.abilities.overcharge.durationMs || 8000) + 1200); } });
        }

        const shouldOfferCurse = this.wave >= 6 && this.wave % 4 === 0;
        if (shouldOfferCurse) {
            const curse = this.generateCurseChoice();
            curse && pool.push(curse);
        }

        const picks = [];
        const used = new Set();
        let safety = 0;
        while (picks.length < 3 && safety < 60) {
            safety++;
            const opt = pool[Math.floor(Math.random() * pool.length)];
            if (!opt || used.has(opt.id)) continue;
            used.add(opt.id);
            picks.push(opt);
        }
        return picks;
    }

    generateCurseChoice() {
        const curses = [
            {
                id: 'curseGlassTower',
                icon: '☠️',
                name: 'Curse: Glass Tower',
                desc: '+20% damage, -15% max HP',
                apply: (g) => {
                    g.runCurses.push('Glass Tower');
                    g.tower.damage = Math.floor(g.tower.damage * 1.2);
                    const newMax = Math.max(40, Math.floor(g.tower.maxHealth * 0.85));
                    g.tower.maxHealth = newMax;
                    g.tower.health = Math.min(g.tower.health, newMax);
                }
            },
            {
                id: 'curseNarrowCoils',
                icon: '☠️',
                name: 'Curse: Narrow Coils',
                desc: '+25% gold, -12% range',
                apply: (g) => {
                    g.runCurses.push('Narrow Coils');
                    g.goldMultiplier = (g.goldMultiplier || 1) * 1.25;
                    g.tower.range = Math.max(60, Math.floor(g.tower.range * 0.88));
                }
            }
        ];
        return curses[Math.floor(Math.random() * curses.length)];
    }

    generateRunObjective() {
        const targetWave = this.wave + 5;
        const candidates = [
            {
                id: 'objNoUpgrades',
                text: `Use ≤ 2 upgrades by Wave ${targetWave}`,
                targetWave,
                check: () => (this.challengeTracking.upgradesUsed || 0) <= 2 && this.wave >= targetWave,
                fail: () => (this.challengeTracking.upgradesUsed || 0) > 2 && this.wave < targetWave,
                reward: () => { this.gold += 180; this.showNarration('🎯 Objective Complete! +180 Gold', 1800); }
            },
            {
                id: 'objNoDamage',
                text: `Take ≤ 8 damage by Wave ${targetWave}`,
                targetWave,
                check: () => (this.challengeTracking.damageTaken || 0) <= 8 && this.wave >= targetWave,
                fail: () => (this.challengeTracking.damageTaken || 0) > 8 && this.wave < targetWave,
                reward: () => { this.gold += 220; this.showNarration('🎯 Objective Complete! +220 Gold', 1800); }
            },
            {
                id: 'objClickLimit',
                text: `Click-kill ≤ 1 zombie by Wave ${targetWave}`,
                targetWave,
                check: () => (this.challengeTracking.clickKills || 0) <= 1 && this.wave >= targetWave,
                fail: () => (this.challengeTracking.clickKills || 0) > 1 && this.wave < targetWave,
                reward: () => { this.tower.damage += 2; this.showNarration('🎯 Objective Complete! +2 Damage', 1800); }
            }
        ];
        this.runObjective = candidates[Math.floor(Math.random() * candidates.length)];
        this.runObjective.completed = false;
        this.runObjective.failed = false;
    }

    checkObjectiveCompletion() {
        if (!this.runObjective || this.runObjective.completed || this.runObjective.failed) return;

        if (typeof this.runObjective.fail === 'function' && this.runObjective.fail()) {
            this.runObjective.failed = true;
            this.showNarration('🎯 Objective Failed', 1400);
            return;
        }

        if (typeof this.runObjective.check === 'function' && this.runObjective.check()) {
            this.runObjective.completed = true;
            this.runObjective.reward && this.runObjective.reward();
        }
    }

    getObjectiveDisplayText() {
        if (!this.runObjective) return '—';
        if (this.runObjective.completed) return 'Complete ✓';
        if (this.runObjective.failed) return 'Failed ✖';
        return this.runObjective.text || '—';
    }

    // ==========================================
    // ABILITIES
    // ==========================================

    tryUseAbility(abilityKey) {
        if (!this.isGameStarted || this.isPaused || this.isGameOver) return;

        const now = performance.now();
        const ability = this.abilities?.[abilityKey];
        if (!ability || !ability.unlocked) return;
        if (now - (ability.lastUsedAt || -Infinity) < ability.cooldownMs) return;

        if (abilityKey === 'emp') {
            this.useEmp(now);
        } else if (abilityKey === 'overcharge') {
            this.useOvercharge(now);
        }

        ability.lastUsedAt = now;
        this.updateAbilityUI(now, true);
    }

    useEmp(now) {
        const radius = Math.max(140, this.tower.range * 0.8);
        const stunMs = 1400;
        let affected = 0;

        for (const z of this.zombies) {
            const dx = z.x - this.tower.x;
            const dy = z.y - this.tower.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= radius) {
                this.applyStun(z, now, stunMs);
                this.applyShock(z, now, 1200, Math.max(0, 6 + Math.floor(this.wave / 2)));
                affected++;
            }
        }

        this.createParticles(this.tower.x, this.tower.y, '#00ddff', 12);
        this.addScreenShake(3, 160);
        this.showNarration(`⚡ EMP! (${affected})`, 1200);
        this.playSound('boss');
    }

    useOvercharge(now) {
        const durationMs = Math.max(1500, Number(this.abilities?.overcharge?.durationMs ?? 8000));
        const oldFireRate = this.tower.fireRate;
        this.abilities.overcharge.activeUntil = now + durationMs;
        this.tower.fireRate = Math.max(160, Math.floor(oldFireRate * 0.82));
        this.createParticles(this.tower.x, this.tower.y, '#ffff00', 10);
        this.showNarration('⚙️ OVERCHARGE!', 1200);
        this.playSound('upgrade');

        setTimeout(() => {
            try {
                const now2 = performance.now();
                if (!this.abilities?.overcharge?.activeUntil || now2 < this.abilities.overcharge.activeUntil) return;
                this.tower.fireRate = Math.min(1200, Math.floor(oldFireRate));
            } catch (e) {}
        }, durationMs + 50);
    }

    updateAbilityUI(currentTime, force = false) {
        if (!this.ui) this.cacheUIElements();
        const empBtn = this.ui.abilityEmpBtn;
        const overBtn = this.ui.abilityOverchargeBtn;
        const format = (ms) => `${Math.ceil(ms / 1000)}s`;

        if (empBtn) {
            if (!this.abilities.emp.unlocked) {
                empBtn.classList.add('disabled');
                empBtn.textContent = '⚡ EMP (Locked)';
            } else {
                const rem = this.abilities.emp.cooldownMs - (currentTime - (this.abilities.emp.lastUsedAt || -Infinity));
                if (rem > 0) {
                    empBtn.classList.add('disabled');
                    empBtn.textContent = `⚡ EMP (${format(rem)})`;
                } else {
                    empBtn.classList.remove('disabled');
                    empBtn.textContent = '⚡ EMP (Ready)';
                }
            }
        }

        if (overBtn) {
            if (!this.abilities.overcharge.unlocked) {
                overBtn.classList.add('disabled');
                overBtn.textContent = '⚙ OVERCHARGE (Locked)';
            } else {
                const active = this.abilities.overcharge.activeUntil && currentTime < this.abilities.overcharge.activeUntil;
                const rem = this.abilities.overcharge.cooldownMs - (currentTime - (this.abilities.overcharge.lastUsedAt || -Infinity));
                if (active) {
                    overBtn.classList.add('disabled');
                    overBtn.textContent = '⚙ OVERCHARGE (Active)';
                } else if (rem > 0) {
                    overBtn.classList.add('disabled');
                    overBtn.textContent = `⚙ OVERCHARGE (${format(rem)})`;
                } else {
                    overBtn.classList.remove('disabled');
                    overBtn.textContent = '⚙ OVERCHARGE (Ready)';
                }
            }
        }
    }
    
    showNarration(text, duration = 2500) {
        // Visual-only narration (no Text-to-Speech)
        this.playSound('powerUp');
        this.showMessage(text, '#ffd700');
        // Keep signature for existing call sites; duration unused.
    }
    
    // Tooltip System
    showTooltip(element, upgradeType, isPermanent = false) {
        const tooltip = document.getElementById('tooltipDisplay');
        const tooltipTitle = document.getElementById('tooltipTitle');
        const tooltipContent = document.getElementById('tooltipContent');
        
        if (!tooltip || !tooltipTitle || !tooltipContent) return;
        
        // Get tooltip data
        const data = this.getTooltipData(upgradeType, isPermanent);
        if (!data) return;
        
        // Set tooltip content
        tooltipTitle.textContent = data.title;
        tooltipContent.innerHTML = data.content;
        
        // Position tooltip near the element
        const rect = element.getBoundingClientRect();
        const tooltipWidth = 300;
        const tooltipHeight = 150;
        
        // Position to the right if there's space, otherwise to the left
        let left = rect.right + 10;
        if (left + tooltipWidth > window.innerWidth) {
            left = rect.left - tooltipWidth - 10;
        }
        
        // Center vertically relative to element
        let top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        if (top < 10) top = 10;
        if (top + tooltipHeight > window.innerHeight) {
            top = window.innerHeight - tooltipHeight - 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.classList.add('show');
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('tooltipDisplay');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }
    
    getTooltipData(upgradeType, isPermanent) {
        if (isPermanent) {
            // Permanent upgrade tooltips
            const permData = {
                permDamage: {
                    title: '⚔️ Permanent Damage Bonus',
                    content: `
                        <p><span class="tooltip-current">Current Bonus:</span> +${this.permUpgrades.damage * 2} damage</p>
                        <p><span class="tooltip-upgrade">Next Level:</span> +${(this.permUpgrades.damage + 1) * 2} damage</p>
                        <p class="tooltip-effect">💡 Every point increases your tower's base damage for all future games</p>
                    `
                },
                permHealth: {
                    title: '❤️ Permanent Health Bonus',
                    content: `
                        <p><span class="tooltip-current">Current Bonus:</span> +${this.permUpgrades.health * 20} max HP</p>
                        <p><span class="tooltip-upgrade">Next Level:</span> +${(this.permUpgrades.health + 1) * 20} max HP</p>
                        <p class="tooltip-effect">💡 Start every game with more health to survive longer</p>
                    `
                },
                permClick: {
                    title: '🖱️ Permanent Click Power',
                    content: `
                        <p><span class="tooltip-current">Current Bonus:</span> +${this.permUpgrades.clickDamage} click damage</p>
                        <p><span class="tooltip-upgrade">Next Level:</span> +${this.permUpgrades.clickDamage + 1} click damage</p>
                        <p class="tooltip-effect">💡 Clicks/taps deal more damage to zombies</p>
                    `
                },
                permGold: {
                    title: '💰 Permanent Starting Gold',
                    content: `
                        <p><span class="tooltip-current">Current Bonus:</span> +${this.permUpgrades.startingGold * 50} starting gold</p>
                        <p><span class="tooltip-upgrade">Next Level:</span> +${(this.permUpgrades.startingGold + 1) * 50} starting gold</p>
                        <p class="tooltip-effect">💡 Begin each game with extra gold for early upgrades</p>
                    `
                }
            };

            return permData[upgradeType];
        }

        // In-game upgrade tooltips (minimal set)
        const gameData = {
            damage: {
                title: '⚡ Increase Damage',
                content: `
                    <p><span class="tooltip-current">Current Damage:</span> ${this.tower.damage}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${this.tower.damage + 5}</p>
                    <p class="tooltip-effect">💡 Higher damage kills zombies faster</p>
                `
            },
            range: {
                title: '📡 Increase Range',
                content: `
                    <p><span class="tooltip-current">Current Range:</span> ${this.tower.range.toFixed(0)}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${(this.tower.range + 30).toFixed(0)}</p>
                    <p class="tooltip-effect">💡 Larger range hits enemies sooner</p>
                `
            },
            fireRate: {
                title: '⏱️ Faster Fire Rate',
                content: `
                    <p><span class="tooltip-current">Current Speed:</span> ${this.tower.fireRate.toFixed(2)}s per attack</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${(this.tower.fireRate - 0.1).toFixed(2)}s per attack</p>
                    <p class="tooltip-effect">💡 Attack more frequently for higher DPS</p>
                `
            },
            health: {
                title: '🛠️ Repair Tower',
                content: `
                    <p><span class="tooltip-current">Current Health:</span> ${this.tower.health}/${this.tower.maxHealth}</p>
                    <p><span class="tooltip-upgrade">After Repair:</span> ${Math.min(this.tower.health + 50, this.tower.maxHealth)}/${this.tower.maxHealth}</p>
                    <p class="tooltip-effect">💡 Restore HP (can’t exceed max)</p>
                `
            },
            targets: {
                title: '🎯 Multi-Target',
                content: `
                    <p><span class="tooltip-current">Current Targets:</span> ${this.tower.maxTargets}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${this.tower.maxTargets + 1}</p>
                    <p class="tooltip-effect">💡 Attack more enemies at once</p>
                `
            },
            clickDamage: {
                title: '🖱️ Click Power',
                content: `
                    <p><span class="tooltip-current">Current Click Damage:</span> ${this.clickDamage || 10}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${(this.clickDamage || 10) + 5}</p>
                    <p class="tooltip-effect">💡 Click/tap damage increases</p>
                `
            },
            chainLightning: {
                title: '⚡ Chain Lightning',
                content: `
                    <p><span class="tooltip-current">Current Chains:</span> ${this.tower.chainLightning}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${this.tower.chainLightning + 1}</p>
                    <p class="tooltip-effect">💡 Lightning jumps to additional targets</p>
                `
            },
            shield: {
                title: '🛡️ Shield',
                content: `
                    <p><span class="tooltip-current">Current Shield:</span> ${this.tower.maxShield || 0}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${(this.tower.maxShield || 0) + 25}</p>
                    <p class="tooltip-effect">💡 Adds a buffer before HP is lost</p>
                `
            },
            maxHealth: {
                title: '💪 Max Health Up',
                content: `
                    <p><span class="tooltip-current">Current Max HP:</span> ${this.tower.maxHealth}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${this.tower.maxHealth + 25}</p>
                    <p class="tooltip-effect">💡 Permanently increases tower's max health capacity</p>
                `
            },
            armor: {
                title: '🔩 Armor Plating',
                content: `
                    <p><span class="tooltip-current">Current Armor:</span> ${this.tower.armor || 0}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${(this.tower.armor || 0) + 1}</p>
                    <p class="tooltip-effect">💡 Reduces all incoming damage by 1 per armor point</p>
                `
            },
            critChance: {
                title: '🎯 Critical Hit Chance',
                content: `
                    <p><span class="tooltip-current">Current Crit Chance:</span> ${Math.round((this.critChance || 0) * 100)}%</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${Math.round(((this.critChance || 0) + 0.05) * 100)}%</p>
                    <p class="tooltip-effect">💡 Chance to deal critical hits for double damage</p>
                `
            },
            critDamage: {
                title: '💢 Critical Hit Power',
                content: `
                    <p><span class="tooltip-current">Current Crit Multiplier:</span> ${(this.critDamageMultiplier || 2).toFixed(1)}x</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${((this.critDamageMultiplier || 2) + 0.5).toFixed(1)}x</p>
                    <p class="tooltip-effect">💡 Critical hits deal even more damage</p>
                `
            },
            burnChance: {
                title: '🔥 Burn Chance',
                content: `
                    <p><span class="tooltip-current">Current Burn Chance:</span> ${Math.round((this.statusConfig.shockChance || 0) * 100)}%</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${Math.min(80, Math.round(((this.statusConfig.shockChance || 0) + 0.15) * 100))}%</p>
                    <p class="tooltip-effect">💡 Burning enemies take damage over time</p>
                `
            },
            slowChance: {
                title: '🧊 Slow Chance',
                content: `
                    <p><span class="tooltip-current">Current Slow Chance:</span> ${Math.round((this.statusConfig.slowChance || 0) * 100)}%</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${Math.min(80, Math.round(((this.statusConfig.slowChance || 0) + 0.10) * 100))}%</p>
                    <p class="tooltip-effect">💡 Slow enemies on hit, reducing their movement speed</p>
                `
            },
            goldBoost: {
                title: '💰 Gold Boost',
                content: `
                    <p><span class="tooltip-current">Current Gold Bonus:</span> +${Math.round(((this.tower.goldBoost || 1) - 1) * 100)}%</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> +${Math.round(((this.tower.goldBoost || 1) * 1.15 - 1) * 100)}%</p>
                    <p class="tooltip-effect">💡 Each kill rewards more gold</p>
                `
            },
            chainRange: {
                title: '⚡📏 Chain Range',
                content: `
                    <p><span class="tooltip-current">Current Chain Range:</span> ${this.tower.chainRange || 80}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${(this.tower.chainRange || 80) + 20}</p>
                    <p class="tooltip-effect">💡 Lightning can jump farther to reach more enemies</p>
                `
            },
            clickRadius: {
                title: '💫 Click Strike Area',
                content: `
                    <p><span class="tooltip-current">Current Radius:</span> ${this.clickStrikeRadius}</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${this.clickStrikeRadius + 15}</p>
                    <p class="tooltip-effect">💡 Click/tap strikes spread over a wider area</p>
                `
            },
            clickRate: {
                title: '⚡👆 Click Fire Rate',
                content: `
                    <p><span class="tooltip-current">Current Interval:</span> ${this.clickFireRate}ms</p>
                    <p><span class="tooltip-upgrade">After Upgrade:</span> ${Math.max(50, this.clickFireRate - 10)}ms</p>
                    <p class="tooltip-effect">💡 Click/tap strikes spawn more rapidly</p>
                `
            }
        };

        return gameData[upgradeType];
    }

    gameOver() {
        this.isGameOver = true;
        this.isPaused = true;

        // Play game over sound
        this.playSound('gameOver');

        // Update permanent stats
        this.permStats.totalKills += this.kills;
        this.permStats.totalDamageDealt += this.sessionDamage;
        this.permStats.totalClicks += this.sessionClicks;
        this.permStats.totalGoldEarned += this.sessionGoldEarned;
        this.permStats.bossesKilled += this.sessionBossKills;
        this.permStats.totalGamesPlayed++;

        // Update zombie type kills
        for (let type in this.sessionZombieKills) {
            this.permStats.zombieKills[type] += this.sessionZombieKills[type];
        }

        // Track highest wave
        if (this.wave > this.permStats.highestWave) {
            this.permStats.highestWave = this.wave;
        }

        this.savePermanentStats();

        // Check for new achievements
        this.checkAchievements();

        // Check daily challenges
        this.checkDailyChallenges();

        // Update leaderboards
        this.updateLeaderboards();

        // Display leaderboards in console
        console.log('\n=== LEADERBOARDS ===');
        console.log('Highest Wave:');
        this.leaderboards.highestWave.slice(0, 5).forEach((entry, i) => {
            console.log(`${i + 1}. ${entry.name} - Wave ${entry.score} (${entry.date})`);
        });
        console.log('\nMost Kills:');
        this.leaderboards.mostKills.slice(0, 5).forEach((entry, i) => {
            console.log(`${i + 1}. ${entry.name} - ${entry.score} kills (${entry.date})`);
        });
        if (this.leaderboards.fastestToWave20.length > 0) {
            console.log('\nFastest to Wave 20:');
            this.leaderboards.fastestToWave20.slice(0, 5).forEach((entry, i) => {
                console.log(`${i + 1}. ${entry.name} - ${this.formatTime(entry.score)} (${entry.date})`);
            });
        }

        document.getElementById('finalWave').textContent = this.wave;
        document.getElementById('finalKills').textContent = this.kills;
        document.getElementById('gameOver').classList.add('active');
    }
    
    restart() {
        // Reset session stats
        this.sessionDamage = 0;
        this.sessionClicks = 0;
        this.sessionGoldEarned = 0;
        this.sessionBossKills = 0;
        
        // Reset game speed
        this.gameSpeed = 1;
        this.speedMultiplier = 1;
        this.updateSpeedButton();
        
        // Reset challenge tracking
        this.challengeTracking = {
            upgradesUsed: 0,
            clickKills: 0,
            damageTaken: 0
        };
        
        // Start run timer
        this.runStartTime = Date.now();
        
        // Reset session zombie type kills
        this.sessionZombieKills = {
            normal: 0,
            strong: 0,
            runner: 0,
            tank: 0,
            exploder: 0,
            spawner: 0,
            boss: 0
        };
        
        // Reset everything to base + permanent bonuses
        this.wave = 1;
        this.kills = 0;
        this.tower.level = 1;
        this.tower.range = 150;
        this.tower.fireRate = 1000;
        this.tower.maxTargets = 1;
        this.tower.chainLightning = 0;
        this.tower.shield = 0;
        this.tower.maxShield = 0;
        
        // Apply permanent bonuses (sets health, damage, click damage, gold)
        this.applyPermanentBonuses();
        
        this.upgradeCosts = { damage: 100, range: 80, fireRate: 120, health: 50, targets: 150, clickDamage: 80, chainLightning: 200, shield: 150, maxHealth: 120, armor: 200, critChance: 180, critDamage: 220, burnChance: 160, slowChance: 130, goldBoost: 175, chainRange: 140, clickRadius: 100, clickRate: 110 };
        this.zombies = [];
        this.lightning = [];
        this.particles = [];
        this.zombiesSpawned = 0;
        this.spawnRate = 2000;
        this.isGameOver = false;
        this.isPaused = false;
        this.isGameStarted = false;
        this.eliteSpawnedThisWave = false;
        
        document.getElementById('gameOver').classList.remove('active');
        document.getElementById('upgradeBtn').classList.remove('active');
        document.getElementById('mainMenu').classList.add('active');
        this.updateUI();
    }
    
    gameLoop(currentTime = 0) {
        if (!this.lastFrameTime) this.lastFrameTime = currentTime;
        let deltaTime = currentTime - this.lastFrameTime;
        if (!Number.isFinite(deltaTime) || deltaTime < 0) deltaTime = 0;
        // Clamp giant timesteps (tab switching / stutters)
        deltaTime = Math.min(deltaTime, 50);
        this.lastFrameTime = currentTime;

        // Hit pause: freeze game logic briefly for punchiness
        if (this.hitPauseTime > 0) {
            this.hitPauseTime = Math.max(0, this.hitPauseTime - deltaTime);
            this.updateUIThrottled(currentTime);
            this.draw();
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }
        
        // Apply speed multiplier to deltaTime for game logic
        const speedAdjustedDelta = deltaTime * this.speedMultiplier;
        
        if (!this.isPaused && !this.isGameOver && this.isGameStarted) {
            // Spawn zombies via a time accumulator (stable at high speed / low FPS)
            this.spawnAccumulator += speedAdjustedDelta;

            const spawnInterval = this.spawnRate;
            let spawnsThisFrame = 0;
            while (this.spawnAccumulator >= spawnInterval && spawnsThisFrame < 10) {
                this.spawnAccumulator -= spawnInterval;
                spawnsThisFrame++;

                this.spawnZombie();
                this.zombiesSpawned++;

                // Increase difficulty every wave
                if (this.zombiesSpawned >= this.zombiesPerWave) {
                    this.wave++;
                    this.zombiesSpawned = 0;
                    this.bossSpawned = false; // Reset boss flag for new wave
                    this.splitBossSpawned = false; // Reset split boss flag
                    this.eliteSpawnedThisWave = false; // Reset elite flag for new wave
                    this.zombiesPerWave = Math.floor(5 + this.wave * 1.5);
                    this.spawnRate = Math.max(500, 2000 - (this.wave * 50)); // Spawn faster

                    // Between-wave systems
                    this.onWaveAdvanced(currentTime);

                    // If a panel paused the game, stop spawning this frame
                    if (this.isPaused) {
                        this.spawnAccumulator = 0;
                        break;
                    }

                    // Determine themed wave (30% chance starting at wave 6)
                    this.currentWaveTheme = null; // Reset theme
                    if (this.wave >= 6 && Math.random() < 0.3 && this.wave % 5 !== 0) {
                        // Don't theme boss waves, pick random type for themed wave
                        const themeTypes = ['normal', 'strong', 'runner', 'tank'];
                        // Add advanced types if wave is high enough
                        if (this.wave >= 12) themeTypes.push('spawner');
                        if (this.wave >= 15) themeTypes.push('exploder');

                        this.currentWaveTheme = themeTypes[Math.floor(Math.random() * themeTypes.length)];

                        // Announce themed wave
                        const themeNames = {
                            'normal': '🧟 HORDE WAVE',
                            'strong': '🧟‍♂️ BRUTE WAVE',
                            'runner': '🏃 SPEED WAVE',
                            'tank': '🛡️ ARMOR WAVE',
                            'spawner': '👥 SPAWN WAVE',
                            'exploder': '💣 EXPLOSIVE WAVE'
                        };
                        this.showMessage(themeNames[this.currentWaveTheme] + '!', '#ffff00');
                        this.showNarration(themeNames[this.currentWaveTheme] + '!', 2000);
                    }

                    // Narration for milestone waves
                    if (this.wave % 5 === 0) {
                        this.showNarration(`⚡ Wave ${this.wave} Incoming! ⚡`, 2000);
                    }
                }
            }
            
            // Update game objects (with speed-adjusted deltaTime)
            this.updateZombies(speedAdjustedDelta, currentTime);
            this.towerAttack(currentTime);
            this.updateLightning(speedAdjustedDelta);
            this.updateParticles(speedAdjustedDelta);
            this.updateDamageNumbers(speedAdjustedDelta);
            this.updateTowerSparks(speedAdjustedDelta);
            this.updateImpactParticles(speedAdjustedDelta);
            this.updateExplosionRings(speedAdjustedDelta);
            this.updateGoldCoins(speedAdjustedDelta);
            this.handleContinuousShooting(currentTime);

            // Screen shake decay (real time)
            if (this.shakeTime > 0) {
                this.shakeTime = Math.max(0, this.shakeTime - deltaTime);
                if (this.shakeTime === 0) {
                    this.shakeIntensity = 0;
                    this.shakeDuration = 0;
                }
            }

            this.updateAbilityUI(currentTime);
            this.updateUIThrottled(currentTime);
            
            // Health regeneration (5 seconds = 5000ms)
            if (!this.lastRegenTime) this.lastRegenTime = currentTime;
            if (currentTime - this.lastRegenTime >= 5000) {
                if (this.healthRegen && this.healthRegen > 0) {
                    const healAmount = this.healthRegen;
                    if (this.tower.health < this.tower.maxHealth) {
                        this.tower.health = Math.min(this.tower.health + healAmount, this.tower.maxHealth);
                        this.createDamageNumber(this.tower.x, this.tower.y - 50, `+${healAmount} HP`);
                    }
                }
                this.lastRegenTime = currentTime;
            }
        }

        // Safety: if a relic drop paused the game but UI isn't visible, recover.
        this.ensureRelicDropNotStuck(currentTime);
        
        // Always draw (even on menu/pause)
        this.draw();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    saveGame(slot = null) {
        // If slot is provided, use it; otherwise use current slot
        const saveSlot = slot !== null ? slot : this.currentSlot;
        
        const playerName = localStorage.getItem('playerName') || 'Player';
        
        // Check if there's an active game or if we need to create a default save
        if (!this.isGameStarted) {
            // Check if there's existing save data to preserve
            const existingSave = localStorage.getItem(`teslaTowerSave_slot${saveSlot}`);
            if (!existingSave) {
                // Create a new save with default starting values
                const saveData = {
                    playerName: playerName,
                    wave: 1,
                    kills: 0,
                    gold: 100,
                    tower: {
                        health: this.tower.health,
                        maxHealth: this.tower.maxHealth,
                        level: 1,
                        damage: this.tower.damage,
                        range: this.tower.range,
                        fireRate: 1000,
                        maxTargets: 1,
                        chainLightning: 0,
                        shield: 0,
                        maxShield: 0,
                        armor: 0,
                        goldBoost: 1.0
                    },
                    clickDamage: this.clickDamage,
                    clickStrikeRadius: this.clickStrikeRadius,
                    clickFireRate: this.clickFireRate,
                    critDamageMultiplier: 2.0,
                    critChance: 0,
                    upgradeCosts: {
                        damage: 100, 
                        range: 80, 
                        fireRate: 120, 
                        health: 50, 
                        targets: 150, 
                        clickDamage: 80, 
                        chainLightning: 200, 
                        shield: 150,
                        maxHealth: 120,
                        armor: 200,
                        critChance: 180,
                        critDamage: 220,
                        burnChance: 160,
                        slowChance: 130,
                        goldBoost: 175,
                        chainRange: 140,
                        clickRadius: 100,
                        clickRate: 110
                    },
                    zombiesPerWave: 5,
                    spawnRate: 2000,
                    timestamp: Date.now()
                };
                localStorage.setItem(`teslaTowerSave_slot${saveSlot}`, JSON.stringify(saveData));
                this.showMessage(`New save created in Slot ${saveSlot}! ✓`, '#00ff00');
            } else {
                this.showMessage('Slot already has a save. Start a game to update it.', '#ffaa00');
            }
            this.updateSaveSlotInfo();
            return;
        }
        
        // Save active game state
        const saveData = {
            playerName: playerName,
            wave: this.wave,
            kills: this.kills,
            gold: this.gold,
            tower: {
                health: this.tower.health,
                maxHealth: this.tower.maxHealth,
                level: this.tower.level,
                damage: this.tower.damage,
                range: this.tower.range,
                fireRate: this.tower.fireRate,
                maxTargets: this.tower.maxTargets,
                chainLightning: this.tower.chainLightning,
                shield: this.tower.shield,
                maxShield: this.tower.maxShield,
                armor: this.tower.armor || 0,
                goldBoost: this.tower.goldBoost || 1.0
            },
            clickDamage: this.clickDamage,
            clickStrikeRadius: this.clickStrikeRadius,
            clickFireRate: this.clickFireRate,
            critDamageMultiplier: this.critDamageMultiplier || 2.0,
            critChance: this.critChance || 0,
            upgradeCosts: { ...this.upgradeCosts },
            zombiesPerWave: this.zombiesPerWave,
            spawnRate: this.spawnRate,
            runObjective: this.runObjective,
            runCurses: this.runCurses,
            statusConfig: this.statusConfig,
            abilities: this.abilities,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem(`teslaTowerSave_slot${saveSlot}`, JSON.stringify(saveData));
            this.showMessage(`Game Saved to Slot ${saveSlot}! ✓`, '#00ff00');
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('Storage full! Cannot save game. Please clear some data.');
            }
            console.error('Save failed:', e);
        }
        this.updateSaveSlotInfo();
    }
    
    loadGame(slot = null) {
        // If slot is provided, use it; otherwise use current slot
        const loadSlot = slot !== null ? slot : this.currentSlot;

        const data = this.readStorageJSON(`teslaTowerSave_slot${loadSlot}`);

        if (!data || !data.tower || typeof data.tower !== 'object') {
            this.showMessage(`No saved game in Slot ${loadSlot}!`, '#ff4444');
            return;
        }

        try {
            // Update current slot
            this.currentSlot = loadSlot;
            localStorage.setItem('currentSlot', String(loadSlot));
            
            // Restore player name if it exists in save data
            if (data.playerName) {
                localStorage.setItem('playerName', data.playerName);
            }
            
            // Reload permanent stats and achievements for this slot
            this.loadPermanentStats();
            this.loadAchievements();
            this.loadDailyChallenges();
            this.loadLeaderboards();
            
            // Check for daily reward for this slot
            this.checkDailyReward();
            
            // Restore game state
            const savedTower = data.tower;
            this.wave = Math.max(1, Math.floor(this.toFiniteNumber(data.wave, 1)));
            this.kills = Math.max(0, Math.floor(this.toFiniteNumber(data.kills, 0)));
            this.gold = Math.max(0, Math.floor(this.toFiniteNumber(data.gold, this.gold)));
            this.tower.health = this.toFiniteNumber(savedTower.health, this.tower.health);
            this.tower.maxHealth = Math.max(1, this.toFiniteNumber(savedTower.maxHealth, this.tower.maxHealth));
            this.tower.level = Math.max(1, Math.floor(this.toFiniteNumber(savedTower.level, this.tower.level)));
            this.tower.damage = Math.max(1, this.toFiniteNumber(savedTower.damage, this.tower.damage));
            this.tower.range = Math.max(1, this.toFiniteNumber(savedTower.range, this.tower.range));
            this.tower.fireRate = Math.max(100, this.toFiniteNumber(savedTower.fireRate, this.tower.fireRate));
            this.tower.maxTargets = Math.max(1, Math.floor(this.toFiniteNumber(savedTower.maxTargets, this.tower.maxTargets)));
            this.tower.chainLightning = Math.max(0, Math.floor(this.toFiniteNumber(savedTower.chainLightning, this.tower.chainLightning)));
            this.tower.shield = Math.max(0, this.toFiniteNumber(savedTower.shield, 0));
            this.tower.maxShield = Math.max(0, this.toFiniteNumber(savedTower.maxShield, this.tower.maxShield));
            this.tower.armor = Math.max(0, Math.floor(this.toFiniteNumber(savedTower.armor, 0)));
            this.tower.goldBoost = Math.max(1.0, this.toFiniteNumber(savedTower.goldBoost, 1.0));
            if (this.tower.health > this.tower.maxHealth) this.tower.health = this.tower.maxHealth;
            if (this.tower.shield > this.tower.maxShield) this.tower.shield = this.tower.maxShield;

            this.clickDamage = Math.max(1, this.toFiniteNumber(data.clickDamage, this.clickDamage));
            this.clickStrikeRadius = Math.max(10, this.toFiniteNumber(data.clickStrikeRadius, this.clickStrikeRadius ?? 50));
            this.clickFireRate = Math.max(60, this.toFiniteNumber(data.clickFireRate, this.clickFireRate ?? 150));
            this.critDamageMultiplier = Math.max(2.0, this.toFiniteNumber(data.critDamageMultiplier, 2.0));
            if (data.critChance != null) this.critChance = Math.max(0, this.toFiniteNumber(data.critChance, this.critChance || 0));
            this.upgradeCosts = { ...this.getDefaultUpgradeCosts(), ...(data.upgradeCosts && typeof data.upgradeCosts === 'object' ? data.upgradeCosts : {}) };
            this.zombiesPerWave = Math.max(1, Math.floor(this.toFiniteNumber(data.zombiesPerWave, this.zombiesPerWave)));
            this.spawnRate = Math.max(100, this.toFiniteNumber(data.spawnRate, this.spawnRate));

            // Restore meta systems (backward compatible)
            this.runObjective = data.runObjective || null;
            this.runCurses = Array.isArray(data.runCurses) ? data.runCurses : [];
            this.statusConfig = { ...this.statusConfig, ...(data.statusConfig || {}) };
            if (data.abilities) {
                this.abilities = { ...this.abilities, ...data.abilities };
            }
            
            // Clear existing zombies
            this.zombies = [];
            this.zombiesSpawned = 0;
            this.bossSpawned = false;
            
            // Reset game state flags
            this.isGameStarted = false;
            this.isGameOver = false;
            this.isPaused = false;
            
            // Close save slot panel and show main menu
            this.closeSaveSlotPanel();
            document.getElementById('titleScreen').classList.remove('active');
            document.getElementById('upgradeBtn').classList.remove('active');
            document.getElementById('mainMenu').classList.add('active');
            
            // Update player name display
            const loadedPlayerName = localStorage.getItem('playerName') || 'Player';
            document.getElementById('currentPlayerName').textContent = `Player: ${loadedPlayerName}`;
            
            this.updateUI();
            this.updateUpgradePanel();
            this.updateSaveSlotInfo();
            this.showMessage(`Game Loaded from Slot ${loadSlot}! ✓`, '#00ff00');
            
        } catch (error) {
            console.error('Failed to load game:', error);
            this.showMessage('Failed to load game!', '#ff4444');
        }
    }
    
    deleteSave(slot) {
        localStorage.removeItem(`teslaTowerSave_slot${slot}`);
        this.showMessage(`Slot ${slot} Deleted! ✓`, '#ff9900');
        this.updateSaveSlotInfo();
    }
    
    updateSaveSlotInfo() {
        for (let i = 1; i <= 3; i++) {
            const data = this.readStorageJSON(`teslaTowerSave_slot${i}`);
            const perm = this.readStorageJSON(`teslaTowerPermanent_slot${i}`);
            const slotElement = document.getElementById(`slotInfo${i}`);
            
            if (data) {
                const timestamp = this.toFiniteNumber(data.timestamp, Date.now());
                const date = new Date(timestamp);
                const hasValidDate = !Number.isNaN(date.getTime());
                const playerName = data.playerName || 'Player';
                const wave = Math.max(1, Math.floor(this.toFiniteNumber(data.wave, 1)));
                const kills = Math.max(0, Math.floor(this.toFiniteNumber(data.kills, 0)));

                let infoHTML = `
                    <strong style="color: #00ffff;">${playerName}</strong><br>
                    <strong>Wave ${wave}</strong> - ${kills} Kills<br>
                    <small>${hasValidDate ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : 'Unknown save time'}</small>
                `;

                if (perm && typeof perm === 'object') {
                    infoHTML += `<br><small style="color: #ffd700;">⭐ Total Kills: ${Math.max(0, Math.floor(this.toFiniteNumber(perm.totalKills, 0))).toLocaleString()}</small>`;
                }

                slotElement.innerHTML = infoHTML;
            } else {
                slotElement.innerHTML = '<span style="color: #888;">Empty Slot</span>';
            }
        }
        
        // Update current slot indicator
        document.querySelectorAll('.save-slot').forEach((slot, index) => {
            if (index + 1 === this.currentSlot) {
                slot.classList.add('current-slot');
            } else {
                slot.classList.remove('current-slot');
            }
        });
    }
    
    openSaveSlotPanel() {
        console.log('Opening save slot panel...');
        const backdrop = document.getElementById('saveSlotBackdrop');
        const panel = document.getElementById('saveSlotPanel');
        console.log('Panel element:', panel);
        if (panel && backdrop) {
            backdrop.classList.add('active');
            panel.classList.add('active');
            this.updateSaveSlotInfo();
            console.log('Panel should be visible now');
        } else {
            console.error('Save slot panel not found!');
        }
    }
    
    closeSaveSlotPanel() {
        console.log('Closing save slot panel...');
        document.getElementById('saveSlotBackdrop').classList.remove('active');
        document.getElementById('saveSlotPanel').classList.remove('active');
    }
    
    loadPermanentStats() {
        // Load permanent stats for current slot
        const saved = this.readStorageJSON(`teslaTowerPermanent_slot${this.currentSlot}`);
        if (saved && typeof saved === 'object') {
            this.permStats = saved;
            // Add zombie kills if not present (for backward compatibility)
            if (!this.permStats.zombieKills) {
                this.permStats.zombieKills = {
                    normal: 0,
                    strong: 0,
                    runner: 0,
                    tank: 0,
                    exploder: 0,
                    spawner: 0,
                    boss: 0
                };
            }
        } else {
            this.permStats = this.getDefaultPermanentStats();
        }
        
        // Add gems if not present (backward compatibility)
        if (this.permStats.gems === undefined) {
            this.permStats.gems = 0;
        }
        
        // Add gem upgrades if not present (backward compatibility)
        if (!this.permStats.gemUpgrades) {
            this.permStats.gemUpgrades = {
                damageMultiplier: 0,
                healthMultiplier: 0,
                goldMultiplier: 0,
                xpMultiplier: 0,
                critChance: 0,
                healthRegen: 0
            };
        }
        
        // Add daily rewards if not present (backward compatibility)
        if (!this.permStats.dailyRewards) {
            this.permStats.dailyRewards = {
                lastLogin: null,
                streak: 0,
                claimed: []
            };
        }
        
        // Add themes if not present (backward compatibility)
        if (!this.permStats.themes) {
            this.permStats.themes = {
                unlocked: ['classic'], // Classic is always unlocked
                current: 'classic'
            };
        }

        // Add relics if not present (backward compatibility)
        if (!this.permStats.relics) {
            this.permStats.relics = {
                owned: [],
                equipped: [null, null, null],
                shards: 0,
                levels: {}
            };
        }

        if (!Array.isArray(this.permStats.relics.owned)) this.permStats.relics.owned = [];
        if (!Array.isArray(this.permStats.relics.equipped) || this.permStats.relics.equipped.length !== 3) {
            this.permStats.relics.equipped = [null, null, null];
        }

        if (typeof this.permStats.relics.shards !== 'number') this.permStats.relics.shards = 0;
        if (!this.permStats.relics.levels || typeof this.permStats.relics.levels !== 'object') this.permStats.relics.levels = {};
        this.permStats.relics.owned.forEach(id => {
            if (this.permStats.relics.levels[id] == null) this.permStats.relics.levels[id] = 1;
        });
        
        // NOTE: Don't check daily reward here - it should only trigger after player logs in!
        // Daily reward check moved to: confirmPlayerName(), loadGame(), and setupTitleScreen()
        
        // NOTE: Don't call applyPermanentBonuses here - tower doesn't exist yet!
        // It will be called from init() after everything is set up
        
        // Initialize achievements
        this.loadAchievements();
        
        // Initialize daily challenges
        this.loadDailyChallenges();
        
        // Initialize leaderboards
        this.loadLeaderboards();
        
        // Initialize sound system
        this.initSounds();
    }
    
    checkDailyReward() {
        const today = new Date().toDateString();
        const lastLogin = this.permStats.dailyRewards.lastLogin;
        
        // If last login was not today, show reward
        if (lastLogin !== today) {
            // Calculate streak
            if (lastLogin) {
                const lastDate = new Date(lastLogin);
                const todayDate = new Date(today);
                const diffTime = todayDate - lastDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    // Consecutive day - increase streak
                    this.permStats.dailyRewards.streak++;
                } else if (diffDays > 1) {
                    // Streak broken - reset
                    this.permStats.dailyRewards.streak = 1;
                }
            } else {
                // First time login
                this.permStats.dailyRewards.streak = 1;
            }
            
            // Show reward popup after a delay
            setTimeout(() => {
                this.showDailyRewardPopup();
            }, 1500);
        }
    }
    
    showDailyRewardPopup() {
        const streak = this.permStats.dailyRewards.streak;
        const rewards = this.calculateDailyReward(streak);
        
        const popup = document.getElementById('dailyRewardPopup');
        const info = document.getElementById('dailyRewardInfo');
        
        info.innerHTML = `
            <p class="streak-info">🔥 Login Streak: Day ${streak}</p>
            <p>You've earned:</p>
            <p class="reward-highlight">💎 +${rewards.gems} Gems</p>
            ${streak % 7 === 0 ? '<p style="color: #ff00ff;">🎉 Weekly Bonus!</p>' : ''}
        `;
        
        popup.classList.add('show');
    }
    
    calculateDailyReward(streak) {
        // Base reward - gems only
        let gems = 5;
        
        // Bonus for streak
        const streakBonus = Math.floor(streak / 3); // Bonus every 3 days
        gems += streakBonus * 2;
        
        // Weekly bonus (day 7, 14, 21, etc.)
        if (streak % 7 === 0) {
            gems += 15;
        }
        
        return { gems };
    }
    
    claimDailyReward() {
        const streak = this.permStats.dailyRewards.streak;
        const rewards = this.calculateDailyReward(streak);
        
        // Add gems reward only
        this.permStats.gems += rewards.gems;
        
        // Update last login
        this.permStats.dailyRewards.lastLogin = new Date().toDateString();
        
        // Save
        this.savePermanentStats();
        
        // Hide popup
        document.getElementById('dailyRewardPopup').classList.remove('show');
        
        // Show confirmation
        this.showMessage(`Daily Reward Claimed! 💎 +${rewards.gems} Gems`, '#ffd700');
        this.playSound('achievement');
        
        // Update UI
        this.updateUI();
    }
    
    applyPermanentBonuses() {
        // Reset to base stats first
        const baseHealth = 100;
        const baseDamage = 10;
        const baseClickDamage = 5;
        const baseGold = 100;
        
        // Apply kill-based bonuses
        let health = baseHealth + this.permStats.bonusHealth;
        let damage = baseDamage + this.permStats.bonusDamage;
        let clickDamage = baseClickDamage + this.permStats.bonusClickDamage;
        let gold = baseGold + this.permStats.bonusStartGold;
        
        // Apply gem shop multipliers
        const damageMultiplier = 1 + (this.permStats.gemUpgrades.damageMultiplier * 0.1);
        const healthMultiplier = 1 + (this.permStats.gemUpgrades.healthMultiplier * 0.1);
        const goldMultiplier = 1 + (this.permStats.gemUpgrades.goldMultiplier * 0.2);
        
        damage = Math.floor(damage * damageMultiplier);
        health = Math.floor(health * healthMultiplier);
        gold = Math.floor(gold * goldMultiplier);
        
        // Set final values
        this.tower.health = health;
        this.tower.maxHealth = health;
        this.tower.damage = damage;
        this.clickDamage = clickDamage;
        this.gold = gold;

        // Reset other baseline combat knobs so equipped relic bonuses don't stack
        // (applyPermanentBonuses can run multiple times via UI actions).
        this.tower.range = 120;
        this.tower.fireRate = 1000;
        this.tower.maxTargets = 1;
        this.tower.chainLightning = 0;
        this.tower.chainRange = 80;
        this.tower.armor = 0;
        this.tower.goldBoost = 1.0;
        this.clickStrikeRadius = 50;
        this.critDamageMultiplier = 2.0;

        this.abilities.emp.cooldownMs = this.baseAbilityCooldowns.emp;
        this.abilities.overcharge.cooldownMs = this.baseAbilityCooldowns.overcharge;
        
        // Store multipliers for other systems
        this.goldMultiplier = goldMultiplier;
        this.xpMultiplier = 1 + (this.permStats.gemUpgrades.xpMultiplier * 0.15);
        this.critChance = this.permStats.gemUpgrades.critChance * 0.05; // 5% per level
        this.healthRegen = this.permStats.gemUpgrades.healthRegen; // 1 HP per 5 seconds per level

        // Apply equipped relic bonuses (additive on top of permanent bonuses)
        this.applyEquippedRelicBonuses();
    }

    getRelicCatalog() {
        return {
            coil_polished: {
                name: 'Polished Coil',
                desc: '+10% Tower Damage.'
            },
            capacitor_long_arc: {
                name: 'Long-Arc Capacitor',
                desc: '+25 Tower Range.'
            },
            emitter_rapid: {
                name: 'Rapid Emitter',
                desc: 'Tower attacks 8% faster.'
            },
            grounding_rod: {
                name: 'Grounding Rod',
                desc: '+1 Chain Lightning jump and +15 chain range.'
            },
            focusing_lens: {
                name: 'Focusing Lens',
                desc: 'Click lightning is tighter (−20% strike radius).' 
            },
            arc_battery: {
                name: 'Arc Battery',
                desc: '+15% Gold earned.'
            },
            stun_dynamo: {
                name: 'Stun Dynamo',
                desc: '+6% Slow chance on tower hits.'
            },
            overclock_module: {
                name: 'Overclock Module',
                desc: 'Abilities recharge 12% faster.'
            }
        };
    }

    getRelicDescription(relicId, levelOverride = null) {
        const level = Math.max(1, levelOverride ?? this.getRelicLevel(relicId));
        const scale = 1 + 0.20 * (level - 1);

        const pct = (v) => `${Math.round(v * 100)}%`;
        const int = (v) => `${Math.round(v)}`;

        switch (relicId) {
            case 'coil_polished':
                return `+${pct(0.10 * scale)} Tower Damage.`;
            case 'capacitor_long_arc':
                return `+${int(25 * scale)} Tower Range.`;
            case 'emitter_rapid': {
                const faster = Math.min(0.45, 0.08 * scale);
                return `Tower attacks ${pct(faster)} faster.`;
            }
            case 'grounding_rod': {
                const chainAdd = 1 + Math.floor((level - 1) / 3);
                return `+${chainAdd} Chain jump${chainAdd === 1 ? '' : 's'} and +${int(15 * scale)} chain range.`;
            }
            case 'focusing_lens': {
                const tighter = Math.min(0.65, 0.20 * scale);
                return `Click lightning is tighter (−${pct(tighter)} strike radius).`;
            }
            case 'arc_battery':
                return `+${pct(0.15 * scale)} Gold earned.`;
            case 'stun_dynamo':
                return `+${pct(0.06 * scale)} Slow chance on tower hits.`;
            case 'overclock_module': {
                const faster = Math.min(0.60, 0.12 * scale);
                return `Abilities recharge ${pct(faster)} faster.`;
            }
            default: {
                const catalog = this.getRelicCatalog();
                return catalog[relicId]?.desc || '';
            }
        }
    }

    getEquippedRelicIds() {
        const equipped = this.permStats?.relics?.equipped;
        if (!Array.isArray(equipped)) return [];
        return equipped.filter(Boolean);
    }

    getRelicLevel(relicId) {
        const levels = this.permStats?.relics?.levels;
        const level = levels && typeof levels === 'object' ? levels[relicId] : 1;
        return Math.max(1, Number.isFinite(level) ? level : 1);
    }

    getRelicUpgradeCost(currentLevel) {
        // Level 1 -> 2: 20, then ramps by +15 each level
        return 20 + Math.max(0, currentLevel - 1) * 15;
    }

    upgradeRelic(relicId) {
        const MAX_LEVEL = 5;
        const relics = this.permStats?.relics;
        if (!relics || !Array.isArray(relics.owned)) return;
        if (!relics.owned.includes(relicId)) return;

        if (!relics.levels || typeof relics.levels !== 'object') relics.levels = {};
        const currentLevel = this.getRelicLevel(relicId);
        if (currentLevel >= MAX_LEVEL) {
            this.showMessage('Relic is already max level.', '#ffaa00');
            return;
        }

        const cost = this.getRelicUpgradeCost(currentLevel);
        if ((relics.shards || 0) < cost) {
            this.showMessage(`Not enough shards. Need ${cost}.`, '#ff5555');
            return;
        }

        relics.shards -= cost;
        relics.levels[relicId] = currentLevel + 1;
        this.savePermanentStats();

        // Avoid resetting current-run combat stats while a run is active.
        const inRun = this.isGameStarted && !this.isGameOver;
        if (!inRun) {
            this.applyPermanentBonuses();
            this.updateUI();
        }
        this.updateRelicsPanel();
        this.playSound('achievement');
        this.showMessage(inRun ? 'Relic upgraded! (Applies next run)' : 'Relic upgraded!', 'rgba(255,255,255,0.9)');
    }

    computeEquippedRelicBonuses() {
        const ids = this.getEquippedRelicIds();
        const bonuses = {
            damageMult: 0,
            rangeAdd: 0,
            fireRateMult: 1,
            chainAdd: 0,
            chainRangeAdd: 0,
            clickRadiusMult: 1,
            goldMult: 0,
            slowChanceAdd: 0,
            abilityCooldownMult: 1
        };

        ids.forEach(id => {
            const level = this.getRelicLevel(id);
            const scale = 1 + 0.20 * (level - 1);
            switch (id) {
                case 'coil_polished':
                    bonuses.damageMult += 0.10 * scale;
                    break;
                case 'capacitor_long_arc':
                    bonuses.rangeAdd += Math.round(25 * scale);
                    break;
                case 'emitter_rapid':
                    bonuses.fireRateMult *= (1 - Math.min(0.45, 0.08 * scale));
                    break;
                case 'grounding_rod':
                    bonuses.chainAdd += 1 + Math.floor((level - 1) / 3);
                    bonuses.chainRangeAdd += Math.round(15 * scale);
                    break;
                case 'focusing_lens':
                    bonuses.clickRadiusMult *= (1 - Math.min(0.65, 0.20 * scale));
                    break;
                case 'arc_battery':
                    bonuses.goldMult += 0.15 * scale;
                    break;
                case 'stun_dynamo':
                    bonuses.slowChanceAdd += 0.06 * scale;
                    break;
                case 'overclock_module':
                    bonuses.abilityCooldownMult *= (1 - Math.min(0.60, 0.12 * scale));
                    break;
            }
        });

        return bonuses;
    }

    applyEquippedRelicBonuses() {
        const b = this.computeEquippedRelicBonuses();

        // Core combat
        if (b.damageMult) this.tower.damage = Math.max(1, Math.floor(this.tower.damage * (1 + b.damageMult)));
        if (b.rangeAdd) this.tower.range += b.rangeAdd;
        if (b.fireRateMult !== 1) this.tower.fireRate = Math.max(120, Math.floor(this.tower.fireRate * b.fireRateMult));

        // Chains
        if (b.chainAdd) this.tower.chainLightning += b.chainAdd;
        if (b.chainRangeAdd) this.tower.chainRange += b.chainRangeAdd;

        // Click tightening
        if (b.clickRadiusMult !== 1) {
            this.clickStrikeRadius = Math.max(10, Math.floor(this.clickStrikeRadius * b.clickRadiusMult));
        }

        // Economy
        if (b.goldMult) this.goldMultiplier *= (1 + b.goldMult);

        // Status config
        if (b.slowChanceAdd) this.statusConfig.slowChance = Math.min(1, (this.statusConfig.slowChance || 0) + b.slowChanceAdd);

        // Ability cooldown
        this.abilities.emp.cooldownMs = Math.floor(this.baseAbilityCooldowns.emp * b.abilityCooldownMult);
        this.abilities.overcharge.cooldownMs = Math.floor(this.baseAbilityCooldowns.overcharge * b.abilityCooldownMult);
    }

    openRelicsPanel() {
        const backdrop = document.getElementById('relicsBackdrop');
        const panel = document.getElementById('relicsPanel');
        if (!backdrop || !panel) return;
        backdrop.classList.add('active');
        panel.classList.add('active');
        this.updateRelicsPanel();
    }

    closeRelicsPanel() {
        const backdrop = document.getElementById('relicsBackdrop');
        const panel = document.getElementById('relicsPanel');
        if (!backdrop || !panel) return;
        backdrop.classList.remove('active');
        panel.classList.remove('active');
    }

    updateRelicsPanel() {
        const slotsEl = document.getElementById('relicSlots');
        const gridEl = document.getElementById('relicGrid');
        const metaEl = document.getElementById('relicsMeta');
        if (!slotsEl || !gridEl) return;

        const catalog = this.getRelicCatalog();
        const owned = new Set(this.permStats.relics.owned || []);
        const equipped = this.permStats.relics.equipped || [null, null, null];

        if (metaEl) {
            const shards = Math.max(0, Math.floor(this.permStats.relics.shards || 0));
            metaEl.textContent = `🔹 Shards: ${shards} (duplicates convert to shards)`;
        }

        // Slots
        slotsEl.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const id = equipped[i];
            const slot = document.createElement('div');
            slot.className = 'relic-slot';
            slot.innerHTML = `
                <div class="slot-label">Slot ${i + 1}</div>
                <div class="slot-name">${id && catalog[id] ? catalog[id].name : '— Empty —'}</div>
            `;
            slotsEl.appendChild(slot);
        }

        // Grid
        gridEl.innerHTML = '';
        Object.keys(catalog).forEach(id => {
            const data = catalog[id];
            const isOwned = owned.has(id);
            const isEquipped = equipped.includes(id);
            const level = isOwned ? this.getRelicLevel(id) : 0;
            const MAX_LEVEL = 5;

            const descText = isOwned
                ? this.getRelicDescription(id, level)
                : 'Defeat bosses to discover this relic.';

            const card = document.createElement('div');
            card.className = `relic-card${isOwned ? ' owned' : ''}`;
            card.innerHTML = `
                <div class="relic-name">${isOwned ? '🧿 ' : '🔒 '}${data.name}</div>
                ${isOwned ? `<div class="relic-level">Level ${level}${level >= MAX_LEVEL ? ' (Max)' : ''}</div>` : ''}
                <div class="relic-desc">${descText}</div>
            `;

            const actions = document.createElement('div');
            actions.className = 'relic-actions';

            const equipBtn = document.createElement('button');
            equipBtn.className = 'relic-btn';
            equipBtn.textContent = isEquipped ? 'UNEQUIP' : 'EQUIP';
            equipBtn.disabled = !isOwned;
            if (!isOwned) {
                equipBtn.style.opacity = '0.55';
                equipBtn.style.cursor = 'not-allowed';
            }
            equipBtn.addEventListener('click', () => {
                if (!isOwned) return;
                if (isEquipped) {
                    this.unequipRelic(id);
                } else {
                    this.equipRelic(id);
                }
                this.savePermanentStats();
                this.updateRelicsPanel();

                // Prevent mid-run stat resets (applyPermanentBonuses resets tower stats).
                const inRun = this.isGameStarted && !this.isGameOver;
                if (!inRun) {
                    this.applyPermanentBonuses();
                    this.updateUI();
                } else {
                    this.showMessage('Relic loadout saved (applies next run).', 'rgba(255,255,255,0.85)');
                }
            });

            const hintBtn = document.createElement('button');
            hintBtn.className = 'relic-btn secondary';
            hintBtn.textContent = 'INFO';
            hintBtn.addEventListener('click', () => {
                const msg = `${data.name}: ${data.desc}`;
                this.showMessage(msg, 'rgba(255,255,255,0.9)');
            });

            const upgradeBtn = document.createElement('button');
            upgradeBtn.className = 'relic-btn secondary';
            if (!isOwned) {
                upgradeBtn.textContent = 'UPGRADE';
                upgradeBtn.disabled = true;
                upgradeBtn.style.opacity = '0.55';
                upgradeBtn.style.cursor = 'not-allowed';
            } else if (level >= MAX_LEVEL) {
                upgradeBtn.textContent = 'MAX';
                upgradeBtn.disabled = true;
                upgradeBtn.style.opacity = '0.65';
                upgradeBtn.style.cursor = 'not-allowed';
            } else {
                const cost = this.getRelicUpgradeCost(level);
                upgradeBtn.textContent = `UPGRADE (${cost})`;
                upgradeBtn.addEventListener('click', () => this.upgradeRelic(id));
            }

            actions.appendChild(equipBtn);
            actions.appendChild(hintBtn);
            actions.appendChild(upgradeBtn);
            card.appendChild(actions);
            gridEl.appendChild(card);
        });
    }

    equipRelic(relicId) {
        const equipped = this.permStats.relics.equipped;
        // If already equipped, no-op
        if (equipped.includes(relicId)) return;

        // Put into first empty slot
        const emptyIndex = equipped.findIndex(v => !v);
        if (emptyIndex !== -1) {
            equipped[emptyIndex] = relicId;
            return;
        }

        // If full, replace slot 1 by default (simple behavior)
        equipped[0] = relicId;
    }

    unequipRelic(relicId) {
        const equipped = this.permStats.relics.equipped;
        for (let i = 0; i < equipped.length; i++) {
            if (equipped[i] === relicId) equipped[i] = null;
        }
    }

    maybeOfferRelicDrop(fromZombie) {
        if (this.relicDropState.active) return;
        if (!fromZombie || !fromZombie.isBoss || fromZombie.isMiniBoss) return;

        // Offer on boss waves (every 5 waves). Limit to once per wave.
        if (this.wave % 5 !== 0) return;
        if (this.relicDropState.waveOffered === this.wave) return;

        // If the UI isn't available (e.g., cached older HTML), don't activate relic-drop state.
        const backdrop = document.getElementById('relicDropBackdrop');
        const panel = document.getElementById('relicDropPanel');
        const optionsEl = document.getElementById('relicDropOptions');
        const subtitleEl = document.getElementById('relicDropSubtitle');
        if (!backdrop || !panel || !optionsEl || !subtitleEl) return;

        // Ensure save data shape exists (can be missing on older/partial saves)
        if (!this.permStats || typeof this.permStats !== 'object') return;
        if (!this.permStats.relics || typeof this.permStats.relics !== 'object') {
            this.permStats.relics = { owned: [], equipped: [null, null, null], shards: 0, levels: {} };
        }
        if (!Array.isArray(this.permStats.relics.owned)) this.permStats.relics.owned = [];
        if (!Array.isArray(this.permStats.relics.equipped) || this.permStats.relics.equipped.length !== 3) {
            this.permStats.relics.equipped = [null, null, null];
        }
        if (typeof this.permStats.relics.shards !== 'number') this.permStats.relics.shards = 0;
        if (!this.permStats.relics.levels || typeof this.permStats.relics.levels !== 'object') this.permStats.relics.levels = {};

        const catalog = this.getRelicCatalog();
        const owned = new Set(this.permStats.relics.owned || []);
        const allIds = Object.keys(catalog);
        const lockedPool = allIds.filter(id => !owned.has(id));
        const ownedPool = allIds.filter(id => owned.has(id));

        // Prefer new relics, but allow owned relics to appear (shards) so drops stay meaningful.
        const options = [];
        while (options.length < 3 && lockedPool.length) {
            const pick = lockedPool.splice(Math.floor(Math.random() * lockedPool.length), 1)[0];
            options.push(pick);
        }
        while (options.length < 3 && ownedPool.length) {
            const pick = ownedPool.splice(Math.floor(Math.random() * ownedPool.length), 1)[0];
            options.push(pick);
        }

        if (!options.length) return;

        this.relicDropState = { active: true, waveOffered: this.wave, options };
        try {
            this.openRelicDropPanel();
        } catch (e) {
            console.error('Relic drop UI failed to open:', e);
            this.relicDropState.active = false;
            this.isPaused = false;
            // Best-effort cleanup in case classes were partially applied
            document.getElementById('relicDropBackdrop')?.classList?.remove('active');
            document.getElementById('relicDropPanel')?.classList?.remove('active');
        }
    }

    openRelicDropPanel() {
        const backdrop = document.getElementById('relicDropBackdrop');
        const panel = document.getElementById('relicDropPanel');
        const optionsEl = document.getElementById('relicDropOptions');
        const subtitleEl = document.getElementById('relicDropSubtitle');
        if (!backdrop || !panel || !optionsEl || !subtitleEl) {
            // Roll back active state so we can retry next boss if UI is unavailable.
            this.relicDropState.active = false;
            return;
        }

        if (!this.relicDropState || !Array.isArray(this.relicDropState.options) || this.relicDropState.options.length === 0) {
            this.relicDropState.active = false;
            return;
        }

        const catalog = this.getRelicCatalog();
        const owned = new Set(this.permStats.relics.owned || []);

        subtitleEl.textContent = 'Choose 1 relic. Owned relics convert to shards.';
        optionsEl.innerHTML = '';

        // Make it obvious this is intentional (not a freeze)
        this.showNarration('🧿 RELIC DROP! Choose one.', 2200);

        this.isPaused = true;
        this.relicDropOpenedAt = Date.now();
        backdrop.classList.add('active');
        panel.classList.add('active');

        this.relicDropState.options.forEach(id => {
            const data = catalog[id];
            if (!data) return;
            const btn = document.createElement('button');
            btn.className = 'upgrade-option';
            const ownedTag = owned.has(id) ? ' (Owned)' : '';
            const descText = this.getRelicDescription(id, owned.has(id) ? this.getRelicLevel(id) : 1);
            btn.innerHTML = `
                <div class="upgrade-icon">🧿</div>
                <div class="upgrade-name">${data.name}${ownedTag}</div>
                <div class="upgrade-desc">${descText}</div>
                <div class="upgrade-cost">Boss Reward</div>
            `;
            btn.addEventListener('click', () => {
                this.claimRelic(id);
            });
            optionsEl.appendChild(btn);
        });
    }

    closeRelicDropPanel() {
        // Always unpause even if DOM is missing (prevents "stuck freeze")
        this.relicDropState.active = false;
        this.isPaused = false;
        this.relicDropOpenedAt = 0;

        const backdrop = document.getElementById('relicDropBackdrop');
        const panel = document.getElementById('relicDropPanel');
        backdrop?.classList?.remove('active');
        panel?.classList?.remove('active');
    }

    ensureRelicDropNotStuck(currentTime) {
        if (!this.relicDropState || !this.relicDropState.active) return;

        const backdrop = document.getElementById('relicDropBackdrop');
        const panel = document.getElementById('relicDropPanel');

        // If the DOM disappeared (cached/partial UI), immediately recover.
        if (!backdrop || !panel) {
            this.relicDropState.active = false;
            this.isPaused = false;
            return;
        }

        const isShowing = backdrop.classList.contains('active') && panel.classList.contains('active');
        if (!isShowing) {
            try {
                this.openRelicDropPanel();
            } catch (e) {
                console.error('Relic drop re-open failed:', e);
                this.relicDropState.active = false;
                this.isPaused = false;
                return;
            }
        }

        // If somehow stuck for too long, auto-skip to keep the run alive.
        const openedAt = this.relicDropOpenedAt || 0;
        if (openedAt && Date.now() - openedAt > 15000) {
            this.showMessage('Relic drop skipped (UI issue).', '#ffaa00');
            this.closeRelicDropPanel();
        }
    }

    claimRelic(relicId) {
        const catalog = this.getRelicCatalog();
        const data = catalog[relicId];
        if (!data) return;

        if (!this.permStats.relics || typeof this.permStats.relics !== 'object') {
            this.permStats.relics = { owned: [], equipped: [null, null, null], shards: 0, levels: {} };
        }
        if (typeof this.permStats.relics.shards !== 'number') this.permStats.relics.shards = 0;
        if (!this.permStats.relics.levels || typeof this.permStats.relics.levels !== 'object') this.permStats.relics.levels = {};

        const owned = this.permStats.relics.owned;
        if (!owned.includes(relicId)) {
            owned.push(relicId);
            if (this.permStats.relics.levels[relicId] == null) this.permStats.relics.levels[relicId] = 1;

            // Small shard grant so upgrading is possible before all relics are collected.
            const shardGain = 6;
            this.permStats.relics.shards += shardGain;
            // Auto-equip into an empty slot if available
            const equipped = this.permStats.relics.equipped;
            if (Array.isArray(equipped) && equipped.some(v => !v)) {
                this.equipRelic(relicId);
            }

            this.showMessage(`🧿 Relic Unlocked: ${data.name}! +${shardGain} Shards (Next run)`, 'rgba(255,255,255,0.95)');
            this.playSound('achievement');
        } else {
            const shardGain = 12;
            this.permStats.relics.shards += shardGain;
            this.showMessage(`🧿 Duplicate Relic: +${shardGain} Shards`, 'rgba(255,255,255,0.85)');
        }

        this.savePermanentStats();
        this.closeRelicDropPanel();
    }
    
    applyTheme(themeName = null) {
        // Use current theme if none specified
        const theme = themeName || this.permStats.themes.current;
        const themes = this.getThemes();
        const themeData = themes[theme];
        
        if (!themeData) {
            console.error('Theme not found:', theme);
            return;
        }
        
        // Helper function to convert hex to RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? 
                `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
                '0, 0, 0';
        };
        
        // Apply theme colors to CSS variables
        const root = document.documentElement;
        root.style.setProperty('--primary-color', themeData.colors.primary);
        root.style.setProperty('--secondary-color', themeData.colors.secondary);
        root.style.setProperty('--background-color', themeData.colors.background);
        root.style.setProperty('--panel-color', themeData.colors.panel);
        root.style.setProperty('--text-color', themeData.colors.text);
        root.style.setProperty('--border-color', themeData.colors.border);
        root.style.setProperty('--success-color', themeData.colors.success);
        root.style.setProperty('--danger-color', themeData.colors.danger);
        root.style.setProperty('--warning-color', themeData.colors.warning);
        root.style.setProperty('--gold-color', themeData.colors.gold);
        
        // Set RGB versions for rgba() usage
        root.style.setProperty('--primary-color-rgb', hexToRgb(themeData.colors.primary));
        root.style.setProperty('--secondary-color-rgb', hexToRgb(themeData.colors.secondary));
        
        // Update current theme
        this.permStats.themes.current = theme;
        this.savePermanentStats();
        
        // Show message
        if (themeName) {
            this.showMessage(`Theme applied: ${themeData.name}`, themeData.colors.primary);
            this.playSound('achievement');
        }
    }
    
    checkThemeUnlock(themeKey) {
        const themes = this.getThemes();
        const theme = themes[themeKey];
        
        if (!theme || !theme.requirement) return true;
        
        // Special case: check if all achievements are unlocked
        if (theme.requirement === 'allAchievements') {
            return this.achievements.every(a => a.unlocked);
        }
        
        // Check if specific achievement requirement is met
        const achievement = this.achievements.find(a => a.id === theme.requirement);
        return achievement && achievement.unlocked;
    }
    
    unlockTheme(themeKey) {
        const themes = this.getThemes();
        const theme = themes[themeKey];
        
        if (!theme) {
            this.showMessage('Theme not found!', '#ff0000');
            return false;
        }
        
        // Check if already unlocked
        if (this.permStats.themes.unlocked.includes(themeKey)) {
            this.showMessage('Theme already unlocked!', '#ffaa00');
            return false;
        }
        
        // Classic theme is always unlocked, others require achievements
        if (theme.requirement) {
            if (!this.checkThemeUnlock(themeKey)) {
                // Find achievement name for better message
                const achievement = this.achievements.find(a => a.id === theme.requirement);
                const achName = achievement ? achievement.name : 'required achievement';
                this.showMessage(`Complete "${achName}" to unlock this theme!`, '#ff0000');
                return false;
            }
        }
        
        // Unlock theme (no gem cost!)
        this.permStats.themes.unlocked.push(themeKey);
        this.savePermanentStats();
        
        this.showMessage(`Unlocked ${theme.name} theme!`, '#ffd700');
        this.playSound('achievement');
        
        // Apply theme immediately
        this.applyTheme(themeKey);
        
        // Update UI
        this.updateThemesPanel();
        this.updateUI();
        
        return true;
    }
    
    initSounds() {
        // Create audio context
        this.audioContext = null;
        this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        this.audioContextInitialized = false;
        
        // Initialize audio context on user interaction (required for mobile)
        const initAudio = () => {
            if (!this.audioContextInitialized) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    // Resume context immediately (required on iOS/Android)
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }

                    // Master gain for volume + shared routing
                    this.masterGain = this.audioContext.createGain();
                    this.masterGain.gain.value = (Math.max(0, Math.min(100, Number(this.settings?.volume ?? 50))) / 100);
                    this.masterGain.connect(this.audioContext.destination);

                    this.audioContextInitialized = true;

                    // Start/stop background hum based on settings
                    this.updateBackgroundHum();
                    console.log('Audio initialized successfully');
                } catch (e) {
                    console.error('Audio initialization failed:', e);
                }
            }
        };
        
        // Listen to multiple events for better mobile compatibility
        ['click', 'touchstart', 'pointerdown'].forEach(event => {
            document.addEventListener(event, initAudio, { passive: true });
        });
    }

    updateAudioGain() {
        if (!this.audioContext || !this.masterGain) return;
        const volume01 = Math.max(0, Math.min(1, (Number(this.settings?.volume ?? 50) / 100)));
        this.masterGain.gain.value = volume01;
    }

    stopBackgroundHum() {
        if (!this.audioContext) return;

        try {
            if (this.musicGain) {
                const now = this.audioContext.currentTime;
                this.musicGain.gain.cancelScheduledValues(now);
                this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
                this.musicGain.gain.linearRampToValueAtTime(0, now + 0.15);
            }
        } catch (e) {
            // ignore
        }

        try {
            if (this.musicOsc) {
                const stopAt = this.audioContext.currentTime + 0.18;
                this.musicOsc.stop(stopAt);
            }
        } catch (e) {
            // ignore
        }

        try { this.musicOsc && this.musicOsc.disconnect(); } catch (e) { /* ignore */ }
        try { this.musicGain && this.musicGain.disconnect(); } catch (e) { /* ignore */ }
        this.musicOsc = null;
        this.musicGain = null;
    }

    startBackgroundHum() {
        if (!this.audioContext || !this.masterGain) return;
        if (this.musicOsc && this.musicGain) return;

        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 58;
        gain.gain.value = 0;

        osc.connect(gain);
        gain.connect(this.masterGain);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.25);

        osc.start(now);

        this.musicOsc = osc;
        this.musicGain = gain;
    }

    updateBackgroundHum() {
        const enabled = !!this.settings?.musicEnabled;
        const soundOn = !!this.soundEnabled;

        if (!enabled || !soundOn) {
            this.stopBackgroundHum();
            return;
        }

        if (!this.audioContext || !this.audioContextInitialized) return;

        // If the context is suspended, it will resume on the next user gesture.
        if (this.audioContext.state === 'suspended') return;

        this.startBackgroundHum();
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('soundEnabled', this.soundEnabled);
        document.getElementById('soundToggle').textContent = this.soundEnabled ? '🔊' : '🔇';
        this.showMessage(this.soundEnabled ? 'Sound ON' : 'Sound OFF', this.soundEnabled ? '#00ff00' : '#ff0000');

        // Hum follows sound enabled
        this.updateBackgroundHum();
    }
    
    cycleGameSpeed() {
        // Cycle through speeds: 1x -> 2x -> 4x -> 1x
        if (this.gameSpeed === 1) {
            this.gameSpeed = 2;
            this.speedMultiplier = 2;
        } else if (this.gameSpeed === 2) {
            this.gameSpeed = 4;
            this.speedMultiplier = 4;
        } else {
            this.gameSpeed = 1;
            this.speedMultiplier = 1;
        }
        
        this.updateSpeedButton();
        this.playSound('click');
        
        // Show speed change message
        const speedColors = { 1: '#00ffff', 2: '#ffff00', 4: '#ff00ff' };
        this.showMessage(`Speed: ${this.gameSpeed}x`, speedColors[this.gameSpeed]);
    }
    
    getThemes() {
        return {
            classic: {
                name: 'Classic',
                description: 'The original Tesla Tower theme',
                cost: 0,
                requirement: null,
                colors: {
                    primary: '#00ffff',
                    secondary: '#ff00ff',
                    background: '#0a0a1a',
                    panel: '#1a1a2e',
                    text: '#ffffff',
                    border: '#00ffff',
                    success: '#00ff00',
                    danger: '#ff0000',
                    warning: '#ffff00',
                    gold: '#ffd700'
                }
            },
            darkPurple: {
                name: 'Dark Purple',
                description: 'Mystical purple energy (Unlock: Reach wave 5)',
                cost: 0,
                requirement: 'wave_5',
                colors: {
                    primary: '#9d4edd',
                    secondary: '#c77dff',
                    background: '#10002b',
                    panel: '#240046',
                    text: '#e0aaff',
                    border: '#7b2cbf',
                    success: '#06ffa5',
                    danger: '#ff006e',
                    warning: '#ffbe0b',
                    gold: '#ffd60a'
                }
            },
            oceanBlue: {
                name: 'Ocean Blue',
                description: 'Deep sea currents (Unlock: Reach wave 10)',
                cost: 0,
                requirement: 'wave_10',
                colors: {
                    primary: '#0077b6',
                    secondary: '#00b4d8',
                    background: '#03045e',
                    panel: '#023e8a',
                    text: '#caf0f8',
                    border: '#0096c7',
                    success: '#06ffa5',
                    danger: '#e63946',
                    warning: '#f77f00',
                    gold: '#ffd60a'
                }
            },
            forestGreen: {
                name: 'Forest Green',
                description: 'Nature\'s power (Unlock: Reach wave 20)',
                cost: 0,
                requirement: 'wave_20',
                colors: {
                    primary: '#2d6a4f',
                    secondary: '#52b788',
                    background: '#081c15',
                    panel: '#1b4332',
                    text: '#d8f3dc',
                    border: '#40916c',
                    success: '#95d5b2',
                    danger: '#d00000',
                    warning: '#ffba08',
                    gold: '#ffd60a'
                }
            },
            sunsetOrange: {
                name: 'Sunset Orange',
                description: 'Blazing fire energy (Unlock: Kill 100 zombies)',
                cost: 0,
                requirement: 'kills_100',
                colors: {
                    primary: '#ff6d00',
                    secondary: '#ff9e00',
                    background: '#1a0800',
                    panel: '#370617',
                    text: '#ffe5d9',
                    border: '#ff8500',
                    success: '#06ffa5',
                    danger: '#c9184a',
                    warning: '#ffd60a',
                    gold: '#ffe169'
                }
            },
            neonPink: {
                name: 'Neon Pink',
                description: 'Cyberpunk vibes (Unlock: Deal 10,000 damage)',
                cost: 0,
                requirement: 'damage_10000',
                colors: {
                    primary: '#ff006e',
                    secondary: '#ff0a54',
                    background: '#000000',
                    panel: '#1a001a',
                    text: '#ffccd5',
                    border: '#ff0080',
                    success: '#06ffa5',
                    danger: '#fb5607',
                    warning: '#ffbe0b',
                    gold: '#ffd60a'
                }
            },
            goldenRoyal: {
                name: 'Golden Royal',
                description: 'Luxurious gold and purple (Unlock: Get all achievements)',
                cost: 0,
                requirement: 'allAchievements',
                colors: {
                    primary: '#ffd700',
                    secondary: '#7209b7',
                    background: '#0f0a1e',
                    panel: '#1e1333',
                    text: '#f6e8ff',
                    border: '#b5179e',
                    success: '#06ffa5',
                    danger: '#d00000',
                    warning: '#ffba08',
                    gold: '#ffea00'
                }
            }
        };
    }
    
    updateSpeedButton() {
        const speedBtn = document.getElementById('speedToggle');
        const speedIcon = speedBtn.querySelector('.speed-icon');
        const speedText = speedBtn.querySelector('.speed-text');
        
        // Update text
        speedText.textContent = `${this.gameSpeed}x`;
        
        // Update icon
        if (this.gameSpeed === 1) {
            speedIcon.textContent = '▶';
            speedBtn.classList.remove('speed-2x', 'speed-4x');
        } else if (this.gameSpeed === 2) {
            speedIcon.textContent = '⏩';
            speedBtn.classList.remove('speed-4x');
            speedBtn.classList.add('speed-2x');
        } else if (this.gameSpeed === 4) {
            speedIcon.textContent = '⏭';
            speedBtn.classList.remove('speed-2x');
            speedBtn.classList.add('speed-4x');
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const ctx = this.audioContext;
        const out = this.masterGain || ctx.destination;
        const now = ctx.currentTime;
        
        switch(type) {
            case 'lightning':
                // Electric zap sound
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.connect(gain1);
                gain1.connect(out);
                
                osc1.frequency.setValueAtTime(800, now);
                osc1.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                gain1.gain.setValueAtTime(0.1, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                
                osc1.start(now);
                osc1.stop(now + 0.1);
                break;
                
            case 'zombieHit':
                // Thud sound
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(out);
                
                osc2.frequency.setValueAtTime(100, now);
                osc2.frequency.exponentialRampToValueAtTime(50, now + 0.15);
                gain2.gain.setValueAtTime(0.15, now);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc2.start(now);
                osc2.stop(now + 0.15);
                break;
                
            case 'zombieDeath':
                // Death sound
                const osc3 = ctx.createOscillator();
                const gain3 = ctx.createGain();
                osc3.connect(gain3);
                gain3.connect(out);
                
                osc3.type = 'sawtooth';
                osc3.frequency.setValueAtTime(300, now);
                osc3.frequency.exponentialRampToValueAtTime(50, now + 0.3);
                gain3.gain.setValueAtTime(0.2, now);
                gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                
                osc3.start(now);
                osc3.stop(now + 0.3);
                break;
                
            case 'gold':
                // Coin pickup sound
                const osc4 = ctx.createOscillator();
                const gain4 = ctx.createGain();
                osc4.connect(gain4);
                gain4.connect(out);
                
                osc4.frequency.setValueAtTime(800, now);
                osc4.frequency.setValueAtTime(1200, now + 0.05);
                gain4.gain.setValueAtTime(0.15, now);
                gain4.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc4.start(now);
                osc4.stop(now + 0.15);
                break;
                
            case 'upgrade':
                // Power up sound
                const osc5 = ctx.createOscillator();
                const gain5 = ctx.createGain();
                osc5.connect(gain5);
                gain5.connect(out);
                
                osc5.frequency.setValueAtTime(400, now);
                osc5.frequency.setValueAtTime(600, now + 0.05);
                osc5.frequency.setValueAtTime(800, now + 0.1);
                gain5.gain.setValueAtTime(0.2, now);
                gain5.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                
                osc5.start(now);
                osc5.stop(now + 0.2);
                break;
                
            case 'boss':
                // Boss warning sound
                const osc6 = ctx.createOscillator();
                const gain6 = ctx.createGain();
                osc6.connect(gain6);
                gain6.connect(out);
                
                osc6.type = 'square';
                osc6.frequency.setValueAtTime(200, now);
                osc6.frequency.setValueAtTime(150, now + 0.1);
                osc6.frequency.setValueAtTime(200, now + 0.2);
                gain6.gain.setValueAtTime(0.15, now);
                gain6.gain.setValueAtTime(0.15, now + 0.3);
                gain6.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                
                osc6.start(now);
                osc6.stop(now + 0.4);
                break;
                
            case 'achievement':
                // Achievement unlock sound
                const osc7a = ctx.createOscillator();
                const osc7b = ctx.createOscillator();
                const gain7 = ctx.createGain();
                osc7a.connect(gain7);
                osc7b.connect(gain7);
                gain7.connect(out);
                
                osc7a.frequency.setValueAtTime(523, now); // C5
                osc7b.frequency.setValueAtTime(659, now); // E5
                osc7a.frequency.setValueAtTime(784, now + 0.1); // G5
                osc7b.frequency.setValueAtTime(1047, now + 0.1); // C6
                gain7.gain.setValueAtTime(0.2, now);
                gain7.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                
                osc7a.start(now);
                osc7b.start(now);
                osc7a.stop(now + 0.3);
                osc7b.stop(now + 0.3);
                break;
                
            case 'gameOver':
                // Game over sound
                const osc8 = ctx.createOscillator();
                const gain8 = ctx.createGain();
                osc8.connect(gain8);
                gain8.connect(out);
                
                osc8.type = 'triangle';
                osc8.frequency.setValueAtTime(400, now);
                osc8.frequency.exponentialRampToValueAtTime(100, now + 0.5);
                gain8.gain.setValueAtTime(0.25, now);
                gain8.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                
                osc8.start(now);
                osc8.stop(now + 0.5);
                break;
        }
    }
    
    loadAchievements() {
        // Load achievements for current slot
        const saved = this.readStorageJSON(`teslaTowerAchievements_slot${this.currentSlot}`);
        if (Array.isArray(saved)) {
            this.achievements = saved;
        } else {
            this.achievements = [
                { id: 'kills_10', name: 'First Blood', desc: 'Kill 10 zombies', icon: '🩸', unlocked: false, requirement: 10, stat: 'totalKills', gemReward: 5 },
                { id: 'kills_100', name: 'Zombie Slayer', desc: 'Kill 100 zombies', icon: '⚔️', unlocked: false, requirement: 100, stat: 'totalKills', gemReward: 10 },
                { id: 'kills_500', name: 'Zombie Hunter', desc: 'Kill 500 zombies', icon: '🏹', unlocked: false, requirement: 500, stat: 'totalKills', gemReward: 25 },
                { id: 'kills_1000', name: 'Zombie Destroyer', desc: 'Kill 1000 zombies', icon: '💀', unlocked: false, requirement: 1000, stat: 'totalKills', gemReward: 50 },
                
                { id: 'wave_5', name: 'Getting Started', desc: 'Reach wave 5', icon: '🌊', unlocked: false, requirement: 5, stat: 'highestWave', gemReward: 5 },
                { id: 'wave_10', name: 'Wave Master', desc: 'Reach wave 10', icon: '🌀', unlocked: false, requirement: 10, stat: 'highestWave', gemReward: 15 },
                { id: 'wave_20', name: 'Wave Legend', desc: 'Reach wave 20', icon: '🌪️', unlocked: false, requirement: 20, stat: 'highestWave', gemReward: 30 },
                { id: 'wave_30', name: 'Wave God', desc: 'Reach wave 30', icon: '⚡', unlocked: false, requirement: 30, stat: 'highestWave', gemReward: 75 },
                
                { id: 'damage_10000', name: 'Power Striker', desc: 'Deal 10,000 damage', icon: '💥', unlocked: false, requirement: 10000, stat: 'totalDamageDealt', gemReward: 10 },
                { id: 'damage_100000', name: 'Damage Dealer', desc: 'Deal 100,000 damage', icon: '💣', unlocked: false, requirement: 100000, stat: 'totalDamageDealt', gemReward: 40 },
                
                { id: 'clicks_500', name: 'Click Happy', desc: 'Click 500 times', icon: '👆', unlocked: false, requirement: 500, stat: 'totalClicks', gemReward: 10 },
                { id: 'clicks_5000', name: 'Click Master', desc: 'Click 5000 times', icon: '🖱️', unlocked: false, requirement: 5000, stat: 'totalClicks', gemReward: 35 },
                
                { id: 'boss_1', name: 'Boss Buster', desc: 'Kill your first boss', icon: '👑', unlocked: false, requirement: 1, stat: 'bossesKilled', gemReward: 20 },
                { id: 'boss_10', name: 'Boss Hunter', desc: 'Kill 10 bosses', icon: '🏆', unlocked: false, requirement: 10, stat: 'bossesKilled', gemReward: 50 },
                
                { id: 'gold_5000', name: 'Gold Collector', desc: 'Earn 5000 gold', icon: '💰', unlocked: false, requirement: 5000, stat: 'totalGoldEarned', gemReward: 15 },
                { id: 'gold_50000', name: 'Gold Tycoon', desc: 'Earn 50,000 gold', icon: '💎', unlocked: false, requirement: 50000, stat: 'totalGoldEarned', gemReward: 45 },
                
                { id: 'games_10', name: 'Dedicated', desc: 'Play 10 games', icon: '🎮', unlocked: false, requirement: 10, stat: 'totalGamesPlayed', gemReward: 10 },
                { id: 'games_50', name: 'Persistent', desc: 'Play 50 games', icon: '🕹️', unlocked: false, requirement: 50, stat: 'totalGamesPlayed', gemReward: 40 }
            ];
        }
        
        // Add gem rewards to existing achievements if missing (backward compatibility)
        const gemRewards = {
            'kills_10': 5, 'kills_100': 10, 'kills_500': 25, 'kills_1000': 50,
            'wave_5': 5, 'wave_10': 15, 'wave_20': 30, 'wave_30': 75,
            'damage_10000': 10, 'damage_100000': 40,
            'clicks_500': 10, 'clicks_5000': 35,
            'boss_1': 20, 'boss_10': 50,
            'gold_5000': 15, 'gold_50000': 45,
            'games_10': 10, 'games_50': 40
        };
        this.achievements.forEach(ach => {
            if (ach.gemReward === undefined && gemRewards[ach.id]) {
                ach.gemReward = gemRewards[ach.id];
            }
        });
    }
    
    saveAchievements() {
        // Save achievements for current slot
        localStorage.setItem(`teslaTowerAchievements_slot${this.currentSlot}`, JSON.stringify(this.achievements));
    }
    
    checkAchievements() {
        let newUnlocks = 0;
        let totalGemsEarned = 0;
        
        this.achievements.forEach(achievement => {
            if (!achievement.unlocked) {
                const statValue = this.permStats[achievement.stat];
                if (statValue >= achievement.requirement) {
                    achievement.unlocked = true;
                    newUnlocks++;
                    
                    // Award gems for achievement
                    const gemReward = achievement.gemReward || 0;
                    this.permStats.gems += gemReward;
                    totalGemsEarned += gemReward;
                    
                    this.showAchievementUnlock(achievement);
                }
            }
        });
        
        if (newUnlocks > 0) {
            this.saveAchievements();
            this.savePermanentStats();
            
            // Show gems earned message
            if (totalGemsEarned > 0) {
                setTimeout(() => {
                    this.showMessage(`+${totalGemsEarned} Gems Earned! 💎`, '#ff00ff');
                }, 2000);
            }
        }
    }
    
    showAchievementUnlock(achievement) {
        // Play achievement sound
        this.playSound('achievement');
        
        // Show narration
        this.showNarration('🏆 ACHIEVEMENT UNLOCKED! 🏆', 3000);
        
        const gemReward = achievement.gemReward || 0;
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-info">
                <div class="achievement-title">Achievement Unlocked!</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
                ${gemReward > 0 ? `<div class="achievement-reward">+${gemReward} Gems 💎</div>` : ''}
            </div>
        `;
        document.body.appendChild(popup);
        
        // Animate in
        setTimeout(() => popup.classList.add('show'), 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 500);
        }, 4000);
    }
    
    savePermanentStats() {
        // Save permanent stats for current slot with quota management
        try {
            const data = JSON.stringify(this.permStats);
            // Warn if data is getting large (>4MB could cause issues on mobile)
            if (data.length > 4 * 1024 * 1024) {
                console.warn('Save data is large:', Math.round(data.length / 1024), 'KB');
            }
            localStorage.setItem(`teslaTowerPermanent_slot${this.currentSlot}`, data);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('Storage full! Please clear some save slots or use the "Clear All Data" option in Settings.');
                console.error('Storage quota exceeded');
            } else {
                console.error('Save failed:', e);
            }
        }
    }
    
    openPermUpgradesPanel() {
        this.openGemShopPanel();
    }
    
    closePermUpgradesPanel() {
        this.closeGemShopPanel();
    }
    
    // Gem Shop Functions
    openGemShopPanel() {
        document.getElementById('gemShopBackdrop').classList.add('active');
        document.getElementById('gemShopPanel').classList.add('active');
        this.updateGemShopPanel();
    }
    
    closeGemShopPanel() {
        document.getElementById('gemShopBackdrop').classList.remove('active');
        document.getElementById('gemShopPanel').classList.remove('active');
    }
    
    updateGemShopPanel() {
        document.getElementById('shopGemsAmount').textContent = this.permStats.gems;
        document.getElementById('shopTotalKills').textContent = this.permStats.totalKills;
        
        // Update gem upgrade owned levels
        document.getElementById('gemDamageLevel').textContent = this.permStats.gemUpgrades.damageMultiplier;
        document.getElementById('gemHealthLevel').textContent = this.permStats.gemUpgrades.healthMultiplier;
        document.getElementById('gemGoldLevel').textContent = this.permStats.gemUpgrades.goldMultiplier;
        document.getElementById('gemXPLevel').textContent = this.permStats.gemUpgrades.xpMultiplier;
        document.getElementById('gemCritLevel').textContent = this.permStats.gemUpgrades.critChance;
        document.getElementById('gemRegenLevel').textContent = this.permStats.gemUpgrades.healthRegen;
        
        // Update kill upgrade owned levels
        document.getElementById('permBonusDamageLevel').textContent = '+' + this.permStats.bonusDamage;
        document.getElementById('permBonusHealthLevel').textContent = '+' + this.permStats.bonusHealth;
        document.getElementById('permBonusClickLevel').textContent = '+' + this.permStats.bonusClickDamage;
        document.getElementById('permBonusGoldLevel').textContent = '+' + this.permStats.bonusStartGold;
        
        // Update gem upgrade costs (increase by 10% per level owned)
        const baseCosts = { damageMultiplier: 50, healthMultiplier: 50, goldMultiplier: 75, xpMultiplier: 60, critChance: 100, healthRegen: 80 };
        Object.keys(baseCosts).forEach(upgrade => {
            const level = this.permStats.gemUpgrades[upgrade];
            const cost = Math.floor(baseCosts[upgrade] * Math.pow(1.1, level));
            const upgradeMap = {
                damageMultiplier: 'gemDamageCost',
                healthMultiplier: 'gemHealthCost',
                goldMultiplier: 'gemGoldCost',
                xpMultiplier: 'gemXPCost',
                critChance: 'gemCritCost',
                healthRegen: 'gemRegenCost'
            };
            document.getElementById(upgradeMap[upgrade]).textContent = cost;
            
            // Disable button if not enough gems
            const btnMap = {
                damageMultiplier: 'buyGemDamage',
                healthMultiplier: 'buyGemHealth',
                goldMultiplier: 'buyGemGold',
                xpMultiplier: 'buyGemXP',
                critChance: 'buyGemCrit',
                healthRegen: 'buyGemRegen'
            };
            const btn = document.getElementById(btnMap[upgrade]);
            if (this.permStats.gems < cost) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
        
        // Update kill upgrade costs
        const killCosts = {
            damage: 50 + this.permStats.bonusDamage * 25,
            health: 100 + this.permStats.bonusHealth * 50,
            click: 75 + this.permStats.bonusClickDamage * 35,
            gold: 150 + this.permStats.bonusStartGold * 75
        };
        
        document.getElementById('permDamageCost').textContent = killCosts.damage;
        document.getElementById('permHealthCost').textContent = killCosts.health;
        document.getElementById('permClickCost').textContent = killCosts.click;
        document.getElementById('permGoldCost').textContent = killCosts.gold;
        
        // Disable kill upgrade buttons if not enough kills
        ['damage', 'health', 'click', 'gold'].forEach(type => {
            const btn = document.getElementById(`buyPerm${type.charAt(0).toUpperCase() + type.slice(1)}`);
            if (this.permStats.totalKills < killCosts[type]) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
    }
    
    buyGemUpgrade(upgradeType, baseCost) {
        const level = this.permStats.gemUpgrades[upgradeType];
        const cost = Math.floor(baseCost * Math.pow(1.1, level));
        
        if (this.permStats.gems >= cost) {
            this.permStats.gems -= cost;
            this.permStats.gemUpgrades[upgradeType]++;
            this.savePermanentStats();
            this.updateGemShopPanel();
            this.updateUI();
            this.playSound('powerUp');
            
            const upgradeNames = {
                damageMultiplier: 'Damage Multiplier',
                healthMultiplier: 'Health Multiplier',
                goldMultiplier: 'Gold Multiplier',
                xpMultiplier: 'XP Multiplier',
                critChance: 'Critical Strike',
                healthRegen: 'Health Regeneration'
            };
            this.showMessage(`Purchased ${upgradeNames[upgradeType]}!`, '#00ff00');
        } else {
            this.showMessage('Not enough gems!', '#ff4444');
            this.playSound('error');
        }
    }
    
    updatePermUpgradesPanel() {
        this.updateGemShopPanel();
    }
    
    buyPermUpgrade(type) {
        const costs = {
            damage: 50 + this.permStats.bonusDamage * 25,
            health: 100 + this.permStats.bonusHealth * 50,
            click: 75 + this.permStats.bonusClickDamage * 35,
            gold: 150 + this.permStats.bonusStartGold * 75
        };
        
        const cost = costs[type];
        
        if (this.permStats.totalKills < cost) {
            this.showMessage('Not enough total kills!', '#ff4444');
            return;
        }
        
        this.permStats.totalKills -= cost;
        
        switch(type) {
            case 'damage':
                this.permStats.bonusDamage += 2;
                this.tower.damage += 2;
                break;
            case 'health':
                this.permStats.bonusHealth += 20;
                this.tower.maxHealth += 20;
                this.tower.health += 20;
                break;
            case 'click':
                this.permStats.bonusClickDamage += 1;
                this.clickDamage += 1;
                break;
            case 'gold':
                this.permStats.bonusStartGold += 50;
                this.gold += 50;
                break;
        }
        
        this.savePermanentStats();
        this.updateGemShopPanel();
        this.showMessage('Permanent Upgrade Purchased! ✓', '#00ff00');
        this.playSound('powerUp');
    }
    
    openThemesPanel() {
        document.getElementById('themesBackdrop').classList.add('active');
        document.getElementById('themesPanel').classList.add('active');
        this.updateThemesPanel();
    }
    
    closeThemesPanel() {
        document.getElementById('themesBackdrop').classList.remove('active');
        document.getElementById('themesPanel').classList.remove('active');
    }
    
    updateThemesPanel() {
        document.getElementById('themesGemsAmount').textContent = this.permStats.gems;
        
        const themesGrid = document.getElementById('themesGrid');
        themesGrid.innerHTML = '';
        
        const themes = this.getThemes();
        const unlockedThemes = this.permStats.themes.unlocked;
        const currentTheme = this.permStats.themes.current;
        
        Object.entries(themes).forEach(([key, theme]) => {
            const isUnlocked = unlockedThemes.includes(key);
            const isCurrent = currentTheme === key;
            const canUnlock = this.checkThemeUnlock(key);
            
            const themeCard = document.createElement('div');
            themeCard.className = 'theme-card';
            if (isCurrent) themeCard.classList.add('current');
            if (!isUnlocked) themeCard.classList.add('locked');
            
            // Get requirement text
            let requirementText = '';
            if (!isUnlocked && theme.requirement) {
                const achievement = this.achievements.find(a => a.id === theme.requirement);
                if (achievement) {
                    requirementText = `<div class="theme-requirement ${canUnlock ? 'met' : 'unmet'}">
                        ${canUnlock ? '✓ Unlocked!' : '🔒 ' + achievement.name}
                    </div>`;
                }
            }
            
            themeCard.innerHTML = `
                <div class="theme-preview" style="background: ${theme.colors.background}; border-color: ${theme.colors.primary};">
                    <div class="theme-colors">
                        <span style="background: ${theme.colors.primary};"></span>
                        <span style="background: ${theme.colors.secondary};"></span>
                        <span style="background: ${theme.colors.success};"></span>
                    </div>
                </div>
                <div class="theme-name">${theme.name}</div>
                <div class="theme-desc">${theme.description}</div>
                ${requirementText}
                ${isCurrent ? '<div class="theme-current">✓ ACTIVE</div>' : ''}
                ${isUnlocked && !isCurrent ? '<button class="theme-apply-btn">APPLY</button>' : ''}
                ${!isUnlocked ? `<button class="theme-unlock-btn" ${!canUnlock ? 'disabled' : ''}>${canUnlock ? 'UNLOCK' : 'LOCKED'}</button>` : ''}
            `;
            
            // Add click handlers
            if (isUnlocked && !isCurrent) {
                themeCard.querySelector('.theme-apply-btn').addEventListener('click', () => {
                    this.applyTheme(key);
                    this.updateThemesPanel();
                });
            }
            
            if (!isUnlocked) {
                const unlockBtn = themeCard.querySelector('.theme-unlock-btn');
                unlockBtn.addEventListener('click', () => {
                    if (this.unlockTheme(key)) {
                        this.updateThemesPanel();
                    }
                });
            }
            
            themesGrid.appendChild(themeCard);
        });
    }
    
    openStatsPanel() {
        document.getElementById('statsBackdrop').classList.add('active');
        document.getElementById('statsPanel').classList.add('active');
        this.updateStatsPanel();
    }
    
    closeStatsPanel() {
        document.getElementById('statsBackdrop').classList.remove('active');
        document.getElementById('statsPanel').classList.remove('active');
    }
    
    updateStatsPanel() {
        document.getElementById('statTotalKills').textContent = this.permStats.totalKills.toLocaleString();
        document.getElementById('statTotalDamage').textContent = this.permStats.totalDamageDealt.toLocaleString();
        document.getElementById('statTotalClicks').textContent = this.permStats.totalClicks.toLocaleString();
        document.getElementById('statHighestWave').textContent = this.permStats.highestWave;
        document.getElementById('statTotalGames').textContent = this.permStats.totalGamesPlayed;
        document.getElementById('statTotalGold').textContent = this.permStats.totalGoldEarned.toLocaleString();
        document.getElementById('statBossesKilled').textContent = this.permStats.bossesKilled;
        
        // Calculate averages
        const gamesPlayed = this.permStats.totalGamesPlayed || 1;
        const avgKills = Math.floor(this.permStats.totalKills / gamesPlayed);
        const avgDamage = Math.floor(this.permStats.totalDamageDealt / gamesPlayed);
        const avgWave = Math.floor(this.permStats.highestWave / gamesPlayed);
        
        document.getElementById('statAvgKills').textContent = avgKills;
        document.getElementById('statAvgDamage').textContent = avgDamage.toLocaleString();
        document.getElementById('statAvgWave').textContent = avgWave;
    }
    
    openAchievementsPanel() {
        console.log('Opening achievements panel...');
        const backdrop = document.getElementById('achievementsBackdrop');
        const panel = document.getElementById('achievementsPanel');
        console.log('Achievements panel:', panel);
        console.log('Achievements array:', this.achievements);
        if (panel && backdrop) {
            backdrop.classList.add('active');
            panel.classList.add('active');
            this.updateAchievementsPanel();
        } else {
            console.error('Achievements panel not found!');
        }
    }
    
    closeAchievementsPanel() {
        document.getElementById('achievementsBackdrop').classList.remove('active');
        document.getElementById('achievementsPanel').classList.remove('active');
    }
    
    openEnemyTypesPanel() {
        document.getElementById('enemyTypesBackdrop').classList.add('active');
        document.getElementById('enemyTypesPanel').classList.add('active');
        this.updateEnemyTypesPanel();
    }
    
    closeEnemyTypesPanel() {
        document.getElementById('enemyTypesBackdrop').classList.remove('active');
        document.getElementById('enemyTypesPanel').classList.remove('active');
    }
    
    openChallengesPanel() {
        const backdrop = document.getElementById('challengesBackdrop');
        const panel = document.getElementById('challengesPanel');
        if (!backdrop || !panel) return; // Safety check
        
        backdrop.classList.add('active');
        panel.classList.add('active');
        this.updateChallengesPanel();
    }
    
    closeChallengesPanel() {
        const backdrop = document.getElementById('challengesBackdrop');
        const panel = document.getElementById('challengesPanel');
        if (!backdrop || !panel) return; // Safety check
        
        backdrop.classList.remove('active');
        panel.classList.remove('active');
    }
    
    openLeaderboardsPanel() {
        const backdrop = document.getElementById('leaderboardsBackdrop');
        const panel = document.getElementById('leaderboardsPanel');
        if (!backdrop || !panel) return; // Safety check
        
        backdrop.classList.add('active');
        panel.classList.add('active');
        this.updateLeaderboardsPanel();
    }
    
    closeLeaderboardsPanel() {
        const backdrop = document.getElementById('leaderboardsBackdrop');
        const panel = document.getElementById('leaderboardsPanel');
        if (!backdrop || !panel) return; // Safety check
        
        backdrop.classList.remove('active');
        panel.classList.remove('active');
    }
    
    updateEnemyTypesPanel() {
        // Update kill counts for each zombie type
        document.getElementById('killsNormal').textContent = this.permStats.zombieKills.normal;
        document.getElementById('killsStrong').textContent = this.permStats.zombieKills.strong;
        document.getElementById('killsRunner').textContent = this.permStats.zombieKills.runner;
        document.getElementById('killsTank').textContent = this.permStats.zombieKills.tank;
        document.getElementById('killsExploder').textContent = this.permStats.zombieKills.exploder;
        document.getElementById('killsSpawner').textContent = this.permStats.zombieKills.spawner;
        document.getElementById('killsBoss').textContent = this.permStats.zombieKills.boss;
    }
    
    updateChallengesPanel() {
        const container = document.getElementById('challengesList');
        if (!container) return; // Safety check
        
        container.innerHTML = '';
        
        this.dailyChallenges.forEach(challenge => {
            const challengeEl = document.createElement('div');
            challengeEl.className = `challenge-card ${challenge.completed ? 'completed' : ''}`;
            
            let progressText = '';
            if (challenge.completed) {
                progressText = '<div class="challenge-status completed">✓ COMPLETED</div>';
            } else {
                progressText = '<div class="challenge-status in-progress">In Progress...</div>';
            }
            
            challengeEl.innerHTML = `
                <h3>${challenge.name}</h3>
                <p>${challenge.description}</p>
                <p class="challenge-reward">Reward: +${challenge.reward} Gems 💎</p>
                ${progressText}
            `;
            
            container.appendChild(challengeEl);
        });
    }
    
    updateLeaderboardsPanel() {
        // Update Highest Wave Leaderboard
        const waveContainer = document.getElementById('leaderboardWave');
        if (!waveContainer) return; // Safety check
        
        waveContainer.innerHTML = '';
        this.leaderboards.highestWave.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = `leaderboard-entry rank-${index + 1}`;
            entryEl.innerHTML = `
                <span class="leaderboard-rank">${index + 1}</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-score">Wave ${entry.score}</span>
                <span class="leaderboard-date">${entry.date}</span>
            `;
            waveContainer.appendChild(entryEl);
        });
        
        // Update Most Kills Leaderboard
        const killsContainer = document.getElementById('leaderboardKills');
        if (!killsContainer) return; // Safety check
        
        killsContainer.innerHTML = '';
        this.leaderboards.mostKills.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = `leaderboard-entry rank-${index + 1}`;
            entryEl.innerHTML = `
                <span class="leaderboard-rank">${index + 1}</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-score">${entry.score} Kills</span>
                <span class="leaderboard-date">${entry.date}</span>
            `;
            killsContainer.appendChild(entryEl);
        });
        
        // Update Fastest to Wave 20 Leaderboard
        const speedContainer = document.getElementById('leaderboardSpeed');
        if (!speedContainer) return; // Safety check
        
        speedContainer.innerHTML = '';
        this.leaderboards.fastestToWave20.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = `leaderboard-entry rank-${index + 1}`;
            entryEl.innerHTML = `
                <span class="leaderboard-rank">${index + 1}</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-score">${this.formatTime(entry.score)}</span>
                <span class="leaderboard-date">${entry.date}</span>
            `;
            speedContainer.appendChild(entryEl);
        });
    }
    
    updateAchievementsPanel() {
        const container = document.getElementById('achievementsList');
        container.innerHTML = '';
        
        this.achievements.forEach(achievement => {
            const achievementEl = document.createElement('div');
            achievementEl.className = `achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`;
            
            const progress = this.permStats[achievement.stat] || 0;
            const percentage = Math.min(100, Math.floor((progress / achievement.requirement) * 100));
            
            const gemReward = achievement.gemReward || 0;
            achievementEl.innerHTML = `
                <div class="achievement-icon-large">${achievement.unlocked ? achievement.icon : '🔒'}</div>
                <div class="achievement-content">
                    <div class="achievement-header">
                        <span class="achievement-name">${achievement.name}</span>
                        ${achievement.unlocked ? '<span class="achievement-unlocked-badge">✓</span>' : ''}
                    </div>
                    <div class="achievement-desc">${achievement.desc}</div>
                    ${gemReward > 0 ? `<div class="achievement-gem-reward">💎 Reward: ${gemReward} Gems</div>` : ''}
                    <div class="achievement-progress-bar">
                        <div class="achievement-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="achievement-progress-text">${progress.toLocaleString()} / ${achievement.requirement.toLocaleString()}</div>
                </div>
            `;
            
            container.appendChild(achievementEl);
        });
        
        // Update achievements count
        const unlocked = this.achievements.filter(a => a.unlocked).length;
        const total = this.achievements.length;
        document.getElementById('achievementsCount').textContent = `${unlocked} / ${total} Unlocked`;
    }
    
    // ==========================================
    // TITLE SCREEN & NAME INPUT
    // ==========================================
    
    showNameInput() {
        document.getElementById('titleScreen').classList.remove('active');
        document.getElementById('nameInputScreen').classList.add('active');
        document.getElementById('playerNameInput').value = '';
        document.getElementById('playerNameInput').focus();
    }
    
    confirmPlayerName() {
        const nameInput = document.getElementById('playerNameInput');
        const playerName = nameInput.value.trim();
        
        if (playerName.length === 0) {
            alert('Please enter a name!');
            return;
        }
        
        if (playerName.length < 2) {
            alert('Name must be at least 2 characters long!');
            return;
        }
        
        // Save player name
        localStorage.setItem('playerName', playerName);
        
        // Reset to slot 1 for new player and clear any existing permanent stats
        this.currentSlot = 1;
        localStorage.setItem('currentSlot', '1');
        
        // Initialize fresh permanent stats for new player
        this.permStats = this.getDefaultPermanentStats();
        this.savePermanentStats();
        
        // Initialize achievements for new player
        this.loadAchievements();
        
        // Re-apply bonuses (which will be zero for new player)
        this.applyPermanentBonuses();
        
        // Apply the default theme
        this.applyTheme('classic');
        
        // Check for daily reward (will be first-time login for new player)
        this.checkDailyReward();
        
        // Hide name input, show main menu
        document.getElementById('nameInputScreen').classList.remove('active');
        document.getElementById('mainMenu').classList.add('active');
        document.getElementById('currentPlayerName').textContent = `Player: ${playerName}`;
        
        this.showMessage(`Welcome, ${playerName}! 👋`, '#00ff00');
    }
    
    cancelNameInput() {
        document.getElementById('nameInputScreen').classList.remove('active');
        document.getElementById('titleScreen').classList.add('active');
    }
    
    // ==========================================
    // DAILY CHALLENGES
    // ==========================================
    
    loadDailyChallenges() {
        const today = new Date().toDateString();
        const saved = this.readStorageJSON(`dailyChallenges_slot${this.currentSlot}`);
        
        // Define the challenge templates with check functions
        const challengeTemplates = [
            {
                id: 1,
                name: "No Upgrades Challenge",
                description: "Survive 10 waves without using any upgrades",
                goal: 10,
                progress: 0,
                completed: false,
                reward: 20,
                check: () => this.wave >= 10 && this.challengeTracking.upgradesUsed === 0
            },
            {
                id: 2,
                name: "Click Master",
                description: "Kill 100 zombies using only click damage",
                goal: 100,
                progress: 0,
                completed: false,
                reward: 30,
                check: () => this.challengeTracking.clickKills >= 100
            },
            {
                id: 3,
                name: "Untouchable",
                description: "Beat wave 15 without taking any damage",
                goal: 15,
                progress: 0,
                completed: false,
                reward: 40,
                check: () => this.wave >= 15 && this.challengeTracking.damageTaken === 0
            }
        ];
        
        if (saved && typeof saved === 'object') {
            const data = saved;
            // Check if challenges are from today
            if (data.date === today && Array.isArray(data.challenges) && data.challenges.length === challengeTemplates.length) {
                // Restore challenges and add check functions back
                this.dailyChallenges = data.challenges.map((savedChallenge, index) => {
                    return {
                        ...savedChallenge,
                        check: challengeTemplates[index].check
                    };
                });
                return;
            }
        }
        
        // Generate new challenges for today
        this.dailyChallenges = challengeTemplates;
        this.saveDailyChallenges();
    }
    
    saveDailyChallenges() {
        const today = new Date().toDateString();
        localStorage.setItem(`dailyChallenges_slot${this.currentSlot}`, JSON.stringify({
            date: today,
            challenges: this.dailyChallenges
        }));
    }
    
    checkDailyChallenges() {
        this.dailyChallenges.forEach(challenge => {
            try {
                if (!challenge.completed && challenge.check && challenge.check()) {
                    challenge.completed = true;
                    challenge.progress = challenge.goal;
                    this.permStats.gems += challenge.reward;
                    this.showMessage(`🏆 Challenge Complete! +${challenge.reward} Gems!`, '#ffd700');
                    this.saveDailyChallenges();
                    this.savePermanentStats();
                }
            } catch (error) {
                console.error('Error checking challenge:', challenge.name, error);
            }
        });
    }
    
    // ==========================================
    // LEADERBOARDS
    // ==========================================
    
    loadLeaderboards() {
        const saved = this.readStorageJSON(`leaderboards_slot${this.currentSlot}`);

        if (saved && typeof saved === 'object') {
            this.leaderboards = {
                highestWave: Array.isArray(saved.highestWave) ? saved.highestWave : [],
                mostKills: Array.isArray(saved.mostKills) ? saved.mostKills : [],
                fastestToWave20: Array.isArray(saved.fastestToWave20) ? saved.fastestToWave20 : []
            };
        } else {
            this.leaderboards = {
                highestWave: [],
                mostKills: [],
                fastestToWave20: []
            };
        }
    }
    
    saveLeaderboards() {
        localStorage.setItem(`leaderboards_slot${this.currentSlot}`, JSON.stringify(this.leaderboards));
    }
    
    updateLeaderboards() {
        const playerName = localStorage.getItem('playerName') || 'Player';
        const currentDate = new Date().toLocaleDateString();
        
        // Highest Wave
        const waveEntry = {
            name: playerName,
            score: this.wave,
            date: currentDate
        };
        this.leaderboards.highestWave.push(waveEntry);
        this.leaderboards.highestWave.sort((a, b) => b.score - a.score);
        this.leaderboards.highestWave = this.leaderboards.highestWave.slice(0, 10);
        
        // Most Kills
        const killsEntry = {
            name: playerName,
            score: this.kills,
            date: currentDate
        };
        this.leaderboards.mostKills.push(killsEntry);
        this.leaderboards.mostKills.sort((a, b) => b.score - a.score);
        this.leaderboards.mostKills = this.leaderboards.mostKills.slice(0, 10);
        
        // Fastest to Wave 20
        if (this.wave >= 20 && this.runStartTime) {
            const timeElapsed = Math.floor((Date.now() - this.runStartTime) / 1000);
            const timeEntry = {
                name: playerName,
                score: timeElapsed,
                date: currentDate
            };
            this.leaderboards.fastestToWave20.push(timeEntry);
            this.leaderboards.fastestToWave20.sort((a, b) => a.score - b.score);
            this.leaderboards.fastestToWave20 = this.leaderboards.fastestToWave20.slice(0, 10);
        }
        
        this.saveLeaderboards();
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ==========================================
    // SETTINGS
    // ==========================================
    
    loadSettings() {
        const defaults = {
            volume: 50,
            soundEnabled: true,
            musicEnabled: false,
            graphicsQuality: 'medium',
            particlesEnabled: true,
            screenShakeEnabled: true
        };
        const saved = this.readStorageJSON('gameSettings');

        this.settings = (saved && typeof saved === 'object')
            ? { ...defaults, ...saved }
            : defaults;
        this.settings.volume = Math.max(0, Math.min(100, this.toFiniteNumber(this.settings.volume, defaults.volume)));
        if (!['low', 'medium', 'high'].includes(this.settings.graphicsQuality)) {
            this.settings.graphicsQuality = defaults.graphicsQuality;
        }
        this.settings.soundEnabled = this.settings.soundEnabled !== false;
        this.settings.musicEnabled = this.settings.musicEnabled === true;
        this.settings.particlesEnabled = this.settings.particlesEnabled !== false;
        this.settings.screenShakeEnabled = this.settings.screenShakeEnabled !== false;
        
        // Apply settings
        this.applySettingsToGame();
    }
    
    saveSettings() {
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    }
    
    openSettingsPanel() {
        document.getElementById('settingsBackdrop').classList.add('active');
        document.getElementById('settingsPanel').classList.add('active');
        this.updateSettingsPanel();
    }
    
    closeSettingsPanel() {
        document.getElementById('settingsBackdrop').classList.remove('active');
        document.getElementById('settingsPanel').classList.remove('active');
    }
    
    updateSettingsPanel() {
        // Update volume slider
        document.getElementById('volumeSlider').value = this.settings.volume;
        document.getElementById('volumeValue').textContent = this.settings.volume + '%';
        
        // Update sound toggle
        const soundBtn = document.getElementById('soundToggleBtn');
        if (this.settings.soundEnabled) {
            soundBtn.classList.remove('off');
            soundBtn.textContent = 'ON';
        } else {
            soundBtn.classList.add('off');
            soundBtn.textContent = 'OFF';
        }
        
        // Update music toggle
        const musicBtn = document.getElementById('musicToggleBtn');
        if (musicBtn) {
            if (this.settings.musicEnabled) {
                musicBtn.classList.remove('off');
                musicBtn.textContent = 'ON';
            } else {
                musicBtn.classList.add('off');
                musicBtn.textContent = 'OFF';
            }
        }

        // (TTS removed)
        
        // Update graphics
        document.getElementById('graphicsSelect').value = this.settings.graphicsQuality;
        
        // Update particles toggle
        const particlesBtn = document.getElementById('particlesToggleBtn');
        if (this.settings.particlesEnabled) {
            particlesBtn.classList.remove('off');
            particlesBtn.textContent = 'ON';
        } else {
            particlesBtn.classList.add('off');
            particlesBtn.textContent = 'OFF';
        }
        
        // Update screen shake toggle
        const shakeBtn = document.getElementById('screenShakeToggleBtn');
        if (this.settings.screenShakeEnabled) {
            shakeBtn.classList.remove('off');
            shakeBtn.textContent = 'ON';
        } else {
            shakeBtn.classList.add('off');
            shakeBtn.textContent = 'OFF';
        }
    }
    
    applySettings() {
        // Get values from UI
        this.settings.volume = parseInt(document.getElementById('volumeSlider').value);
        this.settings.soundEnabled = !document.getElementById('soundToggleBtn').classList.contains('off');
        this.settings.musicEnabled = !document.getElementById('musicToggleBtn').classList.contains('off');
        // (TTS removed)
        this.settings.graphicsQuality = document.getElementById('graphicsSelect').value;
        this.settings.particlesEnabled = !document.getElementById('particlesToggleBtn').classList.contains('off');
        this.settings.screenShakeEnabled = !document.getElementById('screenShakeToggleBtn').classList.contains('off');
        
        // Save settings
        // (TTS removed)
        this.saveSettings();
        
        // Apply to game
        this.applySettingsToGame();
        
        // Close panel
        this.closeSettingsPanel();
        
        // Show confirmation
        this.showNarration('✓ Settings Applied!', 2000);
    }
    
    applySettingsToGame() {
        // Apply volume (affects sound system)
        this.updateAudioGain();
        
        // Apply sound enabled
        this.soundEnabled = this.settings.soundEnabled;

        // Apply background hum/music
        this.updateBackgroundHum();

        // Apply graphics/particles/screen shake
        this.particlesEnabled = !!this.settings.particlesEnabled;
        this.screenShakeEnabled = !!this.settings.screenShakeEnabled;

        const quality = this.settings.graphicsQuality || 'medium';
        const qualityMultiplier = quality === 'low' ? 0.6 : (quality === 'high' ? 1.4 : 1.0);
        this.maxParticles = Math.max(10, Math.floor(this.baseMaxParticles * qualityMultiplier));
        this.maxLightning = Math.max(3, Math.floor(this.baseMaxLightning * qualityMultiplier));

        if (!this.particlesEnabled) {
            this.particles.length = 0;
            this.towerSparks.length = 0;
            this.impactParticles.length = 0;
        }
        
        // Update sound toggle button display
        if (!this.ui) this.cacheUIElements();
        this.ui.soundToggle && (this.ui.soundToggle.textContent = this.soundEnabled ? '🔊' : '🔇');
    }
    
    // ==========================================
    // DATA MANAGEMENT
    // ==========================================
    
    clearAllData() {
        const confirmed = confirm('⚠️ WARNING ⚠️\n\nThis will permanently delete ALL saved data including:\n\n• All save slots (1, 2, 3)\n• All player profiles\n• All achievements\n• All statistics\n• All themes\n• Daily challenges\n• Leaderboards\n• Settings\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?');
        
        if (!confirmed) return;
        
        // Double confirmation
        const doubleConfirm = confirm('This is your LAST CHANCE!\n\nAll progress will be PERMANENTLY LOST.\n\nClick OK to DELETE EVERYTHING.');
        
        if (!doubleConfirm) return;
        
        try {
            // Clear all localStorage data
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Only remove game-related data
                if (key.startsWith('teslaTower') || 
                    key.startsWith('dailyChallenges') || 
                    key.startsWith('leaderboards') || 
                    key === 'playerName' || 
                    key === 'currentSlot' ||
                    key === 'gameSettings' ||
                    key === 'soundEnabled' ||
                    false) {
                    keysToRemove.push(key);
                }
            }
            
            // Remove all identified keys
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // Show success message
            alert('✓ All data has been cleared!\n\nThe page will now reload to start fresh.');
            
            // Reload the page to reset everything
            location.reload();
            
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('❌ Error clearing data. Please try clearing your browser cache manually.');
        }
    }
}

// Start game
window.addEventListener('load', () => {
    const game = new TowerDefenseGame();
    // Hide loading screen after initialization
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('active');
        }
    }, 500);
});
