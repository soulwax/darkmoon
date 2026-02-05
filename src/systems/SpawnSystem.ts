// File: src/systems/SpawnSystem.js
// Enemy and item spawning system

import { Enemy, EnemyTypes } from '../entities/Enemy';
import { XPGem } from '../entities/XPGem';
import { PowerUpPickup } from '../entities/PowerUpPickup';
import { eventBus, GameEvents } from '../core/EventBus';
import { MathUtils } from '../core/Math';
import { pickRandomPowerUpType, type PowerUpType } from '../powerups/PowerUps';
import type { Camera } from '../graphics/Camera';
import type { AssetLoader } from '../assets/AssetLoader';
import type { GameConfig } from '../config/GameConfig';
import type { Player } from '../entities/Player';

type EnemyTypeKey = keyof typeof EnemyTypes;

export class SpawnSystem {
    config: GameConfig;
    camera: Camera;
    assetLoader: AssetLoader | null;
    spawnRate: number;
    baseSpawnInterval: number;
    spawnTimer: number;
    minSpawnDistance: number;
    spawnMargin: number;
    waveNumber: number;
    waveDuration: number;
    waveTimer: number;
    enemies: Enemy[];
    xpGems: XPGem[];
    powerUps: PowerUpPickup[];
    target: Player | null;
    worldWidth: number;
    worldHeight: number;
    maxEnemies: number;
    spriteImages: Record<string, HTMLImageElement>;

    constructor(config: GameConfig, camera: Camera, assetLoader: AssetLoader | null = null) {
        this.config = config;
        this.camera = camera;
        this.assetLoader = assetLoader;

        // Spawn settings
        this.spawnRate = config.gameplay?.enemySpawnRate || 1.0;
        this.baseSpawnInterval = 2.0; // seconds
        this.spawnTimer = 0;
        this.minSpawnDistance = 100; // Min distance from player
        this.spawnMargin = 50; // Spawn outside visible area

        // Wave system
        this.waveNumber = 0;
        this.waveDuration = 30; // seconds between difficulty increases
        this.waveTimer = 0;

        // Entity lists
        this.enemies = [];
        this.xpGems = [];
        this.powerUps = [];

        // Target to spawn enemies around
        this.target = null;

        // World bounds
        this.worldWidth = config.world?.worldWidthTiles * config.world?.tileSize || 1600;
        this.worldHeight = config.world?.worldHeightTiles * config.world?.tileSize || 1600;

        // Max enemies
        this.maxEnemies = 50;

        // Sprite images cache
        this.spriteImages = {};
        this._loadSprites();

        // Setup event listeners
        this._setupEvents();
    }

    /**
     * Load enemy sprite images
     */
    _loadSprites() {
        // Prefer preloaded assets from the AssetLoader (manifest-driven)
        if (this.assetLoader) {
            const skeleton = this.assetLoader.getImage('skeleton');
            const slime = this.assetLoader.getImage('slime');
            if (skeleton) this.spriteImages.skeleton = skeleton;
            if (slime) this.spriteImages.slime = slime;
        }

        // Fallback: load directly (base-aware)
        const baseUrl = (import.meta?.env?.BASE_URL || '/');
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const resolve = (p: string) => `${base}${p.startsWith('/') ? p.slice(1) : p}`;

        if (!this.spriteImages.skeleton) {
            const skeletonImg = new Image();
            skeletonImg.src = resolve('/SpiteSheets/characters/skeleton.png');
            this.spriteImages.skeleton = skeletonImg;
        }

        if (!this.spriteImages.slime) {
            const slimeImg = new Image();
            slimeImg.src = resolve('/SpiteSheets/characters/slime.png');
            this.spriteImages.slime = slimeImg;
        }
    }

    _setupEvents() {
        // Spawn XP gem when enemy killed
        eventBus.on(GameEvents.ENEMY_KILLED, (data: { enemy: Enemy; x: number; y: number; xpValue: number }) => {
            this.spawnXPGem(data.x, data.y, data.xpValue);

            // Chance to spawn a powerup pickup (kept fairly rare)
            if (Math.random() < 0.12) {
                this.spawnPowerUp(data.x, data.y);
            }

            // Remove from enemies array
            const index = this.enemies.indexOf(data.enemy);
            if (index !== -1) {
                this.enemies.splice(index, 1);
            }
        });

        // Handle XP collection
        eventBus.on(GameEvents.XP_COLLECTED, (data: { gem: XPGem }) => {
            const index = this.xpGems.indexOf(data.gem);
            if (index !== -1) {
                this.xpGems.splice(index, 1);
            }
        });

        eventBus.on(GameEvents.POWERUP_COLLECTED, (data: { powerup: PowerUpPickup }) => {
            const index = this.powerUps.indexOf(data.powerup);
            if (index !== -1) {
                this.powerUps.splice(index, 1);
            }
        });
    }

    /**
     * Set the target entity (usually player)
     * @param {Entity} target
     */
    setTarget(target: Player) {
        this.target = target;
    }

    /**
     * Get spawn interval based on wave
     */
    getSpawnInterval() {
        // Decrease spawn interval as waves progress
        const reduction = Math.min(this.waveNumber * 0.1, 0.7);
        return (this.baseSpawnInterval * (1 - reduction)) / this.spawnRate;
    }

    /**
     * Get enemies per spawn based on wave
     */
    getEnemiesPerSpawn() {
        return 1 + Math.floor(this.waveNumber / 2);
    }

    /**
     * Get available enemy types based on wave
     */
    getAvailableTypes() {
        // Start with basic sprite enemies
        const types = ['slime'];

        if (this.waveNumber >= 1) types.push('skeleton');
        if (this.waveNumber >= 2) types.push('basic', 'fast');
        if (this.waveNumber >= 4) types.push('tank');
        if (this.waveNumber >= 6) types.push('elite');

        return types;
    }

    /**
     * Pick random enemy type with weighted probability
     */
    pickEnemyType(): EnemyTypeKey | string {
        const types = this.getAvailableTypes();
        const weights: Record<string, number> = {
            slime: 40,
            skeleton: 35,
            basic: 25,
            fast: 20,
            tank: 10,
            elite: 5
        };

        let totalWeight = 0;
        for (const type of types) {
            totalWeight += weights[type] || 10;
        }

        let random = Math.random() * totalWeight;
        for (const type of types) {
            random -= weights[type] || 10;
            if (random <= 0) return type;
        }

        return 'slime';
    }

    /**
     * Get spawn position outside camera view
     */
    getSpawnPosition() {
        if (!this.camera || !this.target) {
            return {
                x: MathUtils.random(50, this.worldWidth - 50),
                y: MathUtils.random(50, this.worldHeight - 50)
            };
        }

        const bounds = this.camera.getVisibleBounds();

        // Pick a random edge
        const edge = MathUtils.randomInt(0, 3);
        let x = 0;
        let y = 0;

        switch (edge) {
            case 0: // Top
                x = MathUtils.random(bounds.x - this.spawnMargin, bounds.x + bounds.width + this.spawnMargin);
                y = bounds.y - this.spawnMargin;
                break;
            case 1: // Right
                x = bounds.x + bounds.width + this.spawnMargin;
                y = MathUtils.random(bounds.y - this.spawnMargin, bounds.y + bounds.height + this.spawnMargin);
                break;
            case 2: // Bottom
                x = MathUtils.random(bounds.x - this.spawnMargin, bounds.x + bounds.width + this.spawnMargin);
                y = bounds.y + bounds.height + this.spawnMargin;
                break;
            case 3: // Left
                x = bounds.x - this.spawnMargin;
                y = MathUtils.random(bounds.y - this.spawnMargin, bounds.y + bounds.height + this.spawnMargin);
                break;
        }

        // Clamp to world bounds
        x = MathUtils.clamp(x, 20, this.worldWidth - 20);
        y = MathUtils.clamp(y, 20, this.worldHeight - 20);

        return { x, y };
    }

    /**
     * Spawn an enemy
     * @param {string} [type]
     */
    spawnEnemy(type: EnemyTypeKey | string | null = null) {
        if (this.enemies.length >= this.maxEnemies) return null;

        const pos = this.getSpawnPosition();
        const enemyType = type || this.pickEnemyType();

        // Get sprite image for this enemy type
        const spriteImage = this.spriteImages[enemyType] || null;

        const enemy = new Enemy(pos.x, pos.y, enemyType, this.config, spriteImage);
        if (this.target) {
            enemy.setTarget(this.target);
        }

        this.enemies.push(enemy);

        eventBus.emit(GameEvents.ENEMY_SPAWNED, {
            enemy: enemy,
            type: enemyType
        });

        return enemy;
    }

    /**
     * Spawn XP gem
     * @param {number} x
     * @param {number} y
     * @param {number} value
     */
    spawnXPGem(x: number, y: number, value: number) {
        // Add some random scatter
        const scatterX = MathUtils.random(-10, 10);
        const scatterY = MathUtils.random(-10, 10);

        const gem = new XPGem(x + scatterX, y + scatterY, value);
        this.xpGems.push(gem);

        return gem;
    }

    /**
     * Spawn a powerup pickup
     */
    spawnPowerUp(x: number, y: number, type: PowerUpType | null = null) {
        const scatterX = MathUtils.random(-12, 12);
        const scatterY = MathUtils.random(-12, 12);

        const chosenType = type || pickRandomPowerUpType();
        const powerup = new PowerUpPickup(x + scatterX, y + scatterY, chosenType);
        this.powerUps.push(powerup);

        return powerup;
    }

    /**
     * Update spawning
     * @param {number} deltaTime
     */
    update(deltaTime: number) {
        // Update wave timer
        this.waveTimer += deltaTime;
        if (this.waveTimer >= this.waveDuration) {
            this.waveTimer -= this.waveDuration;
            this.waveNumber++;
            console.log(`Wave ${this.waveNumber} started`);
        }

        // Update spawn timer
        this.spawnTimer += deltaTime;
        const spawnInterval = this.getSpawnInterval();

        if (this.spawnTimer >= spawnInterval) {
            this.spawnTimer -= spawnInterval;

            const count = this.getEnemiesPerSpawn();
            for (let i = 0; i < count; i++) {
                this.spawnEnemy();
            }
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime);

            if (enemy.destroyed) {
                this.enemies.splice(i, 1);
            }
        }

        // Update XP gems
        const player = this.target;
        const pickupRange = player?.getPickupRange?.() || 50;

        for (let i = this.xpGems.length - 1; i >= 0; i--) {
            const gem = this.xpGems[i];
            gem.update(deltaTime, player, pickupRange);

            if (gem.destroyed || gem.collected) {
                this.xpGems.splice(i, 1);
            }
        }

        // Update powerups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerup = this.powerUps[i];
            powerup.update(deltaTime, player, pickupRange);

            if (powerup.destroyed || powerup.collected) {
                this.powerUps.splice(i, 1);
            }
        }
    }

    /**
     * Draw all entities
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        // Draw powerups
        for (const powerup of this.powerUps) {
            if (camera.isVisible(powerup.x - 30, powerup.y - 30, 60, 60)) {
                powerup.draw(ctx);
            }
        }

        // Draw XP gems
        for (const gem of this.xpGems) {
            if (camera.isVisible(gem.x - 20, gem.y - 20, 40, 40)) {
                gem.draw(ctx, camera);
            }
        }

        // Draw enemies
        for (const enemy of this.enemies) {
            if (camera.isVisible(enemy.x - 30, enemy.y - 30, 60, 60)) {
                enemy.draw(ctx, camera);
            }
        }
    }

    /**
     * Get all enemies
     * @returns {Enemy[]}
     */
    getEnemies() {
        return this.enemies;
    }

    /**
     * Clear all spawned entities
     */
    clear() {
        for (const enemy of this.enemies) {
            enemy.destroy();
        }
        for (const gem of this.xpGems) {
            gem.destroy();
        }
        for (const powerup of this.powerUps) {
            powerup.destroy();
        }

        this.enemies = [];
        this.xpGems = [];
        this.powerUps = [];
        this.waveNumber = 0;
        this.waveTimer = 0;
        this.spawnTimer = 0;
    }
}

