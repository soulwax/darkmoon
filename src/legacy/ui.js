// File: src/legacy/ui.js

a// UI Manager
class UIManager {
    constructor(game) {
        this.game = game;
        this.levelUpScreen = document.getElementById('level-up-screen');
        this.upgradeOptions = document.getElementById('upgrade-options');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.startScreen = document.getElementById('start-screen');
        this.finalStats = document.getElementById('final-stats');
        
        // HUD elements
        this.healthBar = document.getElementById('health-bar');
        this.healthText = document.getElementById('health-text');
        this.xpBar = document.getElementById('xp-bar');
        this.levelText = document.getElementById('level-text');
        this.timeValue = document.getElementById('time-value');
        this.killValue = document.getElementById('kill-value');
        
        // Buttons
        this.startButton = document.getElementById('start-button');
        this.restartButton = document.getElementById('restart-button');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => {
            this.hideStartScreen();
            this.game.start();
        });

        this.restartButton.addEventListener('click', () => {
            this.hideGameOverScreen();
            this.game.restart();
        });
    }

    updateHUD(player, gameTime, killCount) {
        // Update health
        const healthPercent = (player.health / player.maxHealth) * 100;
        this.healthBar.style.width = healthPercent + '%';
        this.healthText.textContent = `${Math.floor(player.health)}/${player.maxHealth}`;
        
        // Update XP
        const xpPercent = (player.xp / player.xpToNextLevel) * 100;
        this.xpBar.style.width = xpPercent + '%';
        this.levelText.textContent = `Level ${player.level}`;
        
        // Update time
        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        this.timeValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update kills
        this.killValue.textContent = killCount;
    }

    showLevelUpScreen(player) {
        this.levelUpScreen.classList.remove('hidden');
        this.game.pause();
        
        // Generate upgrade options
        const upgrades = this.generateUpgrades(player);
        this.upgradeOptions.innerHTML = '';
        
        upgrades.forEach((upgrade, index) => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
                <div class="upgrade-effect">${upgrade.effect}</div>
            `;
            card.addEventListener('click', () => {
                this.selectUpgrade(upgrade);
            });
            this.upgradeOptions.appendChild(card);
        });
    }

    generateUpgrades(player) {
        const availableUpgrades = [];
        
        // Weapon upgrades
        if (!player.hasWeapon(MagicOrbs)) {
            availableUpgrades.push({
                name: 'Magic Orbs',
                description: 'Orbs that rotate around you, damaging enemies',
                effect: '+2 Orbs',
                type: 'weapon',
                weaponClass: MagicOrbs
            });
        } else {
            const weapon = player.getWeapon(MagicOrbs);
            if (weapon.level < 8) {
                availableUpgrades.push({
                    name: 'Upgrade Magic Orbs',
                    description: 'Increase orb count and damage',
                    effect: `Level ${weapon.level} → ${weapon.level + 1}`,
                    type: 'weaponUpgrade',
                    weaponClass: MagicOrbs
                });
            }
        }
        
        if (!player.hasWeapon(Projectiles)) {
            availableUpgrades.push({
                name: 'Magic Missiles',
                description: 'Shoots projectiles at nearby enemies',
                effect: 'Auto-targeting',
                type: 'weapon',
                weaponClass: Projectiles
            });
        } else {
            const weapon = player.getWeapon(Projectiles);
            if (weapon.level < 8) {
                availableUpgrades.push({
                    name: 'Upgrade Magic Missiles',
                    description: 'More projectiles and damage',
                    effect: `Level ${weapon.level} → ${weapon.level + 1}`,
                    type: 'weaponUpgrade',
                    weaponClass: Projectiles
                });
            }
        }
        
        if (!player.hasWeapon(AreaAttack)) {
            availableUpgrades.push({
                name: 'Lightning Strike',
                description: 'Strikes random enemies with lightning',
                effect: 'Area Damage',
                type: 'weapon',
                weaponClass: AreaAttack
            });
        } else {
            const weapon = player.getWeapon(AreaAttack);
            if (weapon.level < 8) {
                availableUpgrades.push({
                    name: 'Upgrade Lightning Strike',
                    description: 'More strikes and damage',
                    effect: `Level ${weapon.level} → ${weapon.level + 1}`,
                    type: 'weaponUpgrade',
                    weaponClass: AreaAttack
                });
            }
        }
        
        // Stat upgrades
        availableUpgrades.push({
            name: 'Speed Boost',
            description: 'Increase movement speed',
            effect: '+15% Speed',
            type: 'stat',
            stat: 'moveSpeed',
            value: 0.15
        });
        
        availableUpgrades.push({
            name: 'Max Health',
            description: 'Increase maximum health',
            effect: '+20% Max HP',
            type: 'stat',
            stat: 'maxHealth',
            value: 0.2
        });
        
        availableUpgrades.push({
            name: 'Pickup Range',
            description: 'Increase XP pickup range',
            effect: '+25% Range',
            type: 'stat',
            stat: 'pickupRange',
            value: 0.25
        });
        
        availableUpgrades.push({
            name: 'Damage Boost',
            description: 'Increase all weapon damage',
            effect: '+10% Damage',
            type: 'stat',
            stat: 'damageMultiplier',
            value: 0.1
        });
        
        // Randomly select 3 upgrades
        const selected = [];
        const shuffled = availableUpgrades.sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(3, shuffled.length); i++) {
            selected.push(shuffled[i]);
        }
        
        return selected;
    }

    selectUpgrade(upgrade) {
        const player = this.game.player;
        
        switch(upgrade.type) {
            case 'weapon':
                player.addWeapon(upgrade.weaponClass);
                break;
            case 'weaponUpgrade':
                const weapon = player.getWeapon(upgrade.weaponClass);
                if (weapon) {
                    weapon.upgrade();
                }
                break;
            case 'stat':
                player.applyStat(upgrade.stat, upgrade.value);
                break;
        }
        
        this.hideLevelUpScreen();
        this.game.resume();
    }

    hideLevelUpScreen() {
        this.levelUpScreen.classList.add('hidden');
    }

    showGameOverScreen(gameTime, killCount, level) {
        this.gameOverScreen.classList.remove('hidden');
        
        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        this.finalStats.innerHTML = `
            <div><strong>Survived:</strong> ${timeString}</div>
            <div><strong>Level Reached:</strong> ${level}</div>
            <div><strong>Enemies Killed:</strong> ${killCount}</div>
        `;
    }

    hideGameOverScreen() {
        this.gameOverScreen.classList.add('hidden');
    }

    hideStartScreen() {
        this.startScreen.classList.add('hidden');
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
    }
}
