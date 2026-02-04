// File: src/scenes/GameScene.js
// Main gameplay scene

import { Scene } from './Scene.js';
import { Player } from '../entities/Player.js';
import { Camera } from '../graphics/Camera.js';
import { TileMap } from '../graphics/TileMap.js';
import { InputManager } from '../input/InputManager.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { MagicOrbs } from '../weapons/MagicOrbs.js';
import { MagicMissiles } from '../weapons/MagicMissiles.js';
import { LightningStrike } from '../weapons/LightningStrike.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { HUD } from '../ui/HUD.js';
import { LevelUpScreen } from '../ui/LevelUpScreen.js';

export class GameScene extends Scene {
    constructor(game, config, assetLoader) {
        super(game);

        this.config = config;
        this.assetLoader = assetLoader;

        // Systems
        this.inputManager = new InputManager(config.input);
        this.camera = null;
        this.tileMap = null;
        this.spawnSystem = null;
        this.particleSystem = null;

        // Entities
        this.player = null;

        // UI
        this.hud = null;
        this.levelUpScreen = null;
        this.showingLevelUp = false;

        // Game state
        this.gameTime = 0;
        this.killCount = 0;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        eventBus.on(GameEvents.PLAYER_LEVELUP, (data) => {
            this._showLevelUpScreen();
        });

        eventBus.on(GameEvents.ENEMY_KILLED, () => {
            this.killCount++;
        });

        eventBus.on(GameEvents.XP_COLLECTED, (data) => {
            if (this.player) {
                this.player.gainXP(data.value);
            }
            this.particleSystem?.createXPParticles(data.x, data.y);
        });

        eventBus.on(GameEvents.ENEMY_DAMAGED, (data) => {
            this.particleSystem?.createHitEffect(data.enemy.x, data.enemy.y, '#fff');
            this.particleSystem?.createDamageNumber(data.enemy.x, data.enemy.y, data.amount, '#fff');
        });

        eventBus.on(GameEvents.PLAYER_DAMAGED, (data) => {
            this.camera?.shake(3, 0.2);
        });

        eventBus.on(GameEvents.PLAYER_DIED, () => {
            eventBus.emit(GameEvents.GAME_OVER, {
                time: this.gameTime,
                kills: this.killCount,
                level: this.player?.level || 1
            });
        });
    }

    onEnter(data) {
        super.onEnter(data);

        // Setup input
        this.inputManager.setCanvas(this.game.canvas);

        // Setup camera
        const worldWidth = this.config.world.worldWidthTiles * this.config.world.tileSize;
        const worldHeight = this.config.world.worldHeightTiles * this.config.world.tileSize;

        this.camera = new Camera(
            this.config.window.width,
            this.config.window.height,
            {
                ...this.config.camera,
                maxX: worldWidth,
                maxY: worldHeight
            }
        );
        this.inputManager.setCamera(this.camera);

        // Setup tile map
        this.tileMap = new TileMap({
            tileSize: this.config.world.tileSize,
            width: this.config.world.worldWidthTiles,
            height: this.config.world.worldHeightTiles
        });
        this._generateWorld();

        // Setup particle system
        this.particleSystem = new ParticleSystem(this.config.particles);

        // Create player
        const playerSprite = this.assetLoader?.getSpriteSheet('player');
        this.player = new Player(
            worldWidth / 2,
            worldHeight / 2,
            this.config,
            playerSprite
        );

        // Give starting weapon
        this.player.addWeapon(MagicOrbs);

        // Setup spawn system
        this.spawnSystem = new SpawnSystem(this.config, this.camera);
        this.spawnSystem.setTarget(this.player);

        // Setup camera to follow player
        this.camera.follow(this.player);

        // Setup UI
        this.hud = new HUD(this.game.canvas, this.config);
        this.levelUpScreen = new LevelUpScreen(this.game.canvas, this.config);

        // Reset state
        this.gameTime = 0;
        this.killCount = 0;
        this.showingLevelUp = false;
    }

    onExit() {
        super.onExit();

        // Cleanup
        this.spawnSystem?.clear();
        this.particleSystem?.clear();

        if (this.inputManager) {
            this.inputManager.destroy();
        }
    }

    _generateWorld() {
        this.tileMap.init(
            this.config.world.worldWidthTiles,
            this.config.world.worldHeightTiles
        );

        // Define tile types
        this.tileMap.defineTileType(1, {
            color: '#2d5a27',
            walkable: true
        });
        this.tileMap.defineTileType(2, {
            color: '#3d6a37',
            walkable: true
        });
        this.tileMap.defineTileType(3, {
            color: '#1d4a17',
            walkable: true
        });

        // Generate ground
        this.tileMap.generateGround({
            baseTile: 1,
            noiseTiles: [2, 3],
            noiseChance: 0.15
        });
    }

    _showLevelUpScreen() {
        this.showingLevelUp = true;
        this.game.pause();

        // Generate upgrade options
        const options = this._generateUpgradeOptions();
        this.levelUpScreen.show(options, (selected) => {
            this._applyUpgrade(selected);
            this.showingLevelUp = false;
            this.game.resume();
        });
    }

    _generateUpgradeOptions() {
        const options = [];
        const weapons = [
            { class: MagicOrbs, name: 'Magic Orbs', desc: 'Rotating orbs damage nearby enemies' },
            { class: MagicMissiles, name: 'Magic Missiles', desc: 'Auto-targeting projectiles' },
            { class: LightningStrike, name: 'Lightning Strike', desc: 'Area lightning attacks' }
        ];

        // Add new weapons player doesn't have
        for (const weapon of weapons) {
            if (!this.player.hasWeapon(weapon.class)) {
                options.push({
                    type: 'weapon',
                    weaponClass: weapon.class,
                    name: `New: ${weapon.name}`,
                    description: weapon.desc,
                    icon: '⚔️'
                });
            }
        }

        // Add weapon upgrades
        for (const weapon of this.player.weapons) {
            if (weapon.level < weapon.maxLevel) {
                options.push({
                    type: 'upgrade',
                    weapon: weapon,
                    name: `Upgrade ${weapon.name}`,
                    description: `Level ${weapon.level} → ${weapon.level + 1}`,
                    icon: '⬆️'
                });
            }
        }

        // Add stat upgrades
        const stats = [
            { stat: 'moveSpeed', name: 'Speed Boost', desc: '+15% movement speed', value: 0.15, icon: '🏃' },
            { stat: 'maxHealth', name: 'Max Health', desc: '+20% max health', value: 0.20, icon: '❤️' },
            { stat: 'pickupRange', name: 'Magnet', desc: '+25% pickup range', value: 0.25, icon: '🧲' },
            { stat: 'damageMultiplier', name: 'Power', desc: '+10% damage', value: 0.10, icon: '💪' }
        ];

        for (const stat of stats) {
            options.push({
                type: 'stat',
                stat: stat.stat,
                value: stat.value,
                name: stat.name,
                description: stat.desc,
                icon: stat.icon
            });
        }

        // Shuffle and pick 3
        const shuffled = options.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
    }

    _applyUpgrade(option) {
        switch (option.type) {
            case 'weapon':
                this.player.addWeapon(option.weaponClass);
                break;
            case 'upgrade':
                option.weapon.upgrade();
                break;
            case 'stat':
                this.player.applyStat(option.stat, option.value);
                break;
        }
    }

    update(deltaTime) {
        if (this.showingLevelUp) return;

        this.gameTime += deltaTime;

        // Update input
        this.inputManager.update();

        // Handle pause
        if (this.inputManager.isActionPressed('pause')) {
            if (this.game.paused) {
                eventBus.emit(GameEvents.GAME_RESUME);
            } else {
                eventBus.emit(GameEvents.GAME_PAUSE);
            }
        }

        // Update player
        this.player.handleInput(this.inputManager);
        this.player.update(deltaTime);

        // Update spawn system (enemies and XP gems)
        this.spawnSystem.update(deltaTime);

        // Check player-enemy collisions
        const enemies = this.spawnSystem.getEnemies();
        for (const enemy of enemies) {
            if (enemy.checkCollision(this.player)) {
                const health = this.player.getComponent('HealthComponent');
                if (health && !health.invulnerable) {
                    health.takeDamage(enemy.damage * deltaTime * 2);
                }
            }
        }

        // Update player weapons with enemy list
        for (const weapon of this.player.weapons) {
            weapon.update(deltaTime, enemies);
        }

        // Update particles
        this.particleSystem.update(deltaTime);

        // Update camera
        this.camera.update(deltaTime);

        // Update HUD
        this.hud.update(this.player, this.gameTime, this.killCount);
    }

    draw(ctx, alpha) {
        // Apply camera transform
        this.camera.applyTransform(ctx);

        // Draw tile map
        this.tileMap.draw(ctx, this.camera);

        // Draw spawn system (enemies, XP gems)
        this.spawnSystem.draw(ctx, this.camera);

        // Draw player
        this.player.draw(ctx, this.camera);

        // Draw particles
        this.particleSystem.draw(ctx);

        // Reset camera transform for UI
        this.camera.resetTransform(ctx);

        // Draw HUD
        this.hud.draw(ctx);

        // Draw level up screen if showing
        if (this.showingLevelUp) {
            this.levelUpScreen.draw(ctx);
        }
    }
}
