// File: src/systems/SpawnSystem.ts

import { Enemy, EnemyTypes } from '../entities/Enemy';
import { XPGem } from '../entities/XPGem';
import { PowerUpPickup } from '../entities/PowerUpPickup';
import { eventBus, GameEvents } from '../core/EventBus';
import { MathUtils } from '../core/Math';
import { pickRandomPowerUpType, type PowerUpType } from '../powerups/PowerUps';
import type { Camera } from '../graphics/Camera';
import type { AssetLoader } from '../assets/AssetLoader';
import { SpriteSheet, type SpriteSheetData } from '../assets/SpriteSheet';
import type { GameConfig } from '../config/GameConfig';
import type { Player } from '../entities/Player';
import { DamageResolver } from '../combat/DamageResolver';

type EnemyTypeKey = keyof typeof EnemyTypes;

interface EnemySpritePackFrame {
    x: number;
    y: number;
    w?: number;
    h?: number;
}

interface EnemySpritePackEntry {
    image: string;
    frames?: Record<string, EnemySpritePackFrame>;
    animations?: Record<string, string[]>;
}

interface EnemySpritePackMeta {
    frame_size?: { w?: number; h?: number };
}

interface EnemySpritePackData {
    meta?: EnemySpritePackMeta;
    spritesheets?: Record<string, EnemySpritePackEntry>;
}

export class SpawnSystem {
    config: GameConfig;
    camera: Camera;
    assetLoader: AssetLoader | null;
    spawnRate: number;
    spawnBudget: number;
    spawnCadenceTimer: number;
    minSpawnDistance: number;
    spawnMargin: number;
    waveNumber: number;
    waveDuration: number;
    waveTimer: number;
    elapsedTime: number;
    enemies: Enemy[];
    xpGems: XPGem[];
    powerUps: PowerUpPickup[];
    target: Player | null;
    worldWidth: number;
    worldHeight: number;
    maxEnemies: number;
    spriteImages: Record<string, HTMLImageElement>;
    spriteSheets: Record<string, SpriteSheet>;
    unsubscribers: Array<() => void>;
    spawnGracePeriod: number;
    positionValidator: ((x: number, y: number) => boolean) | null;
    damageResolver: DamageResolver | null;

    constructor(config: GameConfig, camera: Camera, assetLoader: AssetLoader | null = null) {
        this.config = config;
        this.camera = camera;
        this.assetLoader = assetLoader;

        // Spawn settings
        this.spawnRate = config.gameplay?.enemySpawnRate || 1.0;
        this.spawnBudget = 0;
        this.spawnCadenceTimer = 0;
        this.minSpawnDistance = 140;
        this.spawnMargin = 96;

        // Wave system
        this.waveNumber = 0;
        this.waveDuration = 30;
        this.waveTimer = 0;
        this.elapsedTime = 0;

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
        this.spriteSheets = {};
        this.unsubscribers = [];
        this.spawnGracePeriod = 1.5;
        this.positionValidator = null;
        this.damageResolver = null;
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
            const enemySpriteSheets = ['skeleton', 'slime'];
            for (const key of enemySpriteSheets) {
                const spriteSheet = this.assetLoader.getSpriteSheet(key);
                if (spriteSheet) {
                    this.spriteSheets[key] = spriteSheet;
                }
            }

            const skeleton = this.assetLoader.getImage('skeleton');
            const slime = this.assetLoader.getImage('slime');
            if (skeleton) {
                this.spriteImages.skeleton = skeleton;
                this.spriteImages.tank = skeleton;
                this.spriteImages.elite = skeleton;
            }
            if (slime) {
                this.spriteImages.slime = slime;
                this.spriteImages.fast = slime;
            }

            this._buildEnemySpriteSheetsFromPack();
        }

        // Fallback: load directly (base-aware)
        const baseUrl = (import.meta?.env?.BASE_URL || '/');
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const resolve = (p: string) => `${base}${p.startsWith('/') ? p.slice(1) : p}`;

        if (!this.spriteImages.skeleton) {
            const skeletonImg = new Image();
            skeletonImg.src = resolve('/SpiteSheets/characters/skeleton.png');
            this.spriteImages.skeleton = skeletonImg;
            this.spriteImages.tank = skeletonImg;
            this.spriteImages.elite = skeletonImg;
        }

        if (!this.spriteImages.basic) {
            const basicImg = new Image();
            basicImg.src = resolve('/SpiteSheets/characters/enemies/enemy_basic_sheet.png');
            this.spriteImages.basic = basicImg;
        }

        if (!this.spriteImages.slime) {
            const slimeImg = new Image();
            slimeImg.src = resolve('/SpiteSheets/characters/slime.png');
            this.spriteImages.slime = slimeImg;
            this.spriteImages.fast = slimeImg;
        }

        if (!this.spriteImages.fast) {
            const fastImg = new Image();
            fastImg.src = resolve('/SpiteSheets/characters/enemies/enemy_fast_sheet.png');
            this.spriteImages.fast = fastImg;
        }

        if (!this.spriteImages.tank) {
            const tankImg = new Image();
            tankImg.src = resolve('/SpiteSheets/characters/enemies/enemy_tank_sheet.png');
            this.spriteImages.tank = tankImg;
        }

        if (!this.spriteImages.elite) {
            const eliteImg = new Image();
            eliteImg.src = resolve('/SpiteSheets/characters/enemies/enemy_elite_sheet.png');
            this.spriteImages.elite = eliteImg;
        }
    }

    _buildEnemySpriteSheetsFromPack() {
        if (!this.assetLoader) return;

        const pack = this.assetLoader.getYaml<EnemySpritePackData>('enemySpritePack');
        if (!pack || !pack.spritesheets) return;

        const frameWidth = pack.meta?.frame_size?.w || 32;
        const frameHeight = pack.meta?.frame_size?.h || 32;
        const imageKeys: Record<string, string> = {
            basic: 'enemySheetBasic',
            fast: 'enemySheetFast',
            tank: 'enemySheetTank',
            elite: 'enemySheetElite'
        };

        for (const enemyType of Object.keys(imageKeys)) {
            const entry = pack.spritesheets[enemyType];
            if (!entry) continue;

            const image = this.assetLoader.getImage(imageKeys[enemyType]);
            if (!image) continue;

            const spriteSheetData = this._createSpriteSheetDataFromPackEntry(enemyType, entry, frameWidth, frameHeight);
            const spriteSheet = new SpriteSheet(enemyType, image, spriteSheetData);
            this.spriteSheets[enemyType] = spriteSheet;
            this.spriteImages[enemyType] = image;
            this.assetLoader.spriteSheets.set(enemyType, spriteSheet);
        }
    }

    _createSpriteSheetDataFromPackEntry(
        enemyType: string,
        entry: EnemySpritePackEntry,
        frameWidth: number,
        frameHeight: number
    ): SpriteSheetData {
        const frames = entry.frames || {};
        const animations = entry.animations || {};
        const directions = ['down', 'left', 'right', 'up'];
        const tiles: SpriteSheetData['tiles'] = [];
        let nextId = 0;

        const runningRate = EnemyTypes[enemyType as EnemyTypeKey]?.animSpeed || 10;

        for (const direction of directions) {
            const animationKey = `walk_${direction}`;
            const frameNames = animations[animationKey] || Object.keys(frames).filter((name) => name.startsWith(`${direction}_`)).sort();
            const runningFrames = frameNames
                .map((name) => frames[name])
                .filter((frame): frame is EnemySpritePackFrame => !!frame)
                .map((frame) => ({
                    x: frame.x,
                    y: frame.y,
                    width: frame.w || frameWidth,
                    height: frame.h || frameHeight
                }));

            if (runningFrames.length === 0) continue;

            tiles.push({
                id: nextId++,
                direction: `${direction}_running`,
                frame_rate: runningRate,
                loop: true,
                frame_list: runningFrames
            });

            tiles.push({
                id: nextId++,
                direction: `${direction}_idle`,
                frame_rate: 4,
                loop: true,
                frame_list: [runningFrames[0]]
            });
        }

        return {
            meta: {
                tile_size: Math.max(frameWidth, frameHeight),
                frame_rate: runningRate,
                loop: true,
                file: [entry.image]
            },
            tiles
        };
    }

    _setupEvents() {
        // Spawn XP gem when enemy killed
        const unsubscribeEnemyKilled = eventBus.on(GameEvents.ENEMY_KILLED, (data: { enemy: Enemy; x: number; y: number; xpValue: number }) => {
            this.spawnXPGem(data.x, data.y, data.xpValue);

            // Chance to spawn a powerup pickup (kept fairly rare)
            const dropMult =
                this.target && typeof this.target.getDropRateMultiplier === 'function'
                    ? this.target.getDropRateMultiplier()
                    : 1;
            const powerUpChance = Math.min(0.45, 0.12 * dropMult);
            if (Math.random() < powerUpChance) {
                this.spawnPowerUp(data.x, data.y);
            }

            // Remove from enemies array
            const index = this.enemies.indexOf(data.enemy);
            if (index !== -1) {
                this.enemies.splice(index, 1);
            }
        });
        this.unsubscribers.push(unsubscribeEnemyKilled);

        // Handle XP collection
        const unsubscribeXpCollected = eventBus.on(GameEvents.XP_COLLECTED, (data: { gem: XPGem }) => {
            const index = this.xpGems.indexOf(data.gem);
            if (index !== -1) {
                this.xpGems.splice(index, 1);
            }
        });
        this.unsubscribers.push(unsubscribeXpCollected);

        const unsubscribePowerUpCollected = eventBus.on(GameEvents.POWERUP_COLLECTED, (data: { powerup: PowerUpPickup }) => {
            const index = this.powerUps.indexOf(data.powerup);
            if (index !== -1) {
                this.powerUps.splice(index, 1);
            }
        });
        this.unsubscribers.push(unsubscribePowerUpCollected);
    }

    /**
     * Set the target entity (usually player)
     * @param {Entity} target
     */
    setTarget(target: Player) {
        this.target = target;
    }

    setSpawnValidator(validator: ((x: number, y: number) => boolean) | null) {
        this.positionValidator = validator;
    }

    setDamageResolver(resolver: DamageResolver | null) {
        this.damageResolver = resolver;
    }

    getThreatBudgetCap() {
        return Math.min(96, 18 + this.waveNumber * 7);
    }

    getThreatIncomePerSecond() {
        return (4.5 + this.waveNumber * 1.6) * this.spawnRate;
    }

    getSpawnCadence() {
        return Math.max(0.12, 0.52 - this.waveNumber * 0.018);
    }

    getAliveThreat() {
        return this.enemies.reduce((total, enemy) => {
            if (enemy.destroyed) return total;
            return total + (enemy.typeDef.spawnThreat || 5);
        }, 0);
    }

    getAvailableTypes() {
        return Object.entries(EnemyTypes)
            .filter(([, definition]) => this.waveNumber >= (definition.unlockWave || 0))
            .map(([key]) => key);
    }

    pickEnemyTypeForBudget() {
        const available = this.getAvailableTypes().filter((type) => {
            const definition = EnemyTypes[type as EnemyTypeKey];
            return (definition.spawnThreat || 5) <= this.spawnBudget;
        });

        if (available.length === 0) {
            return null;
        }

        let totalWeight = 0;
        for (const type of available) {
            totalWeight += EnemyTypes[type as EnemyTypeKey].spawnWeight || 1;
        }

        let random = Math.random() * totalWeight;
        for (const type of available) {
            random -= EnemyTypes[type as EnemyTypeKey].spawnWeight || 1;
            if (random <= 0) {
                return type;
            }
        }

        return available[0];
    }

    getSpawnPosition() {
        if (!this.camera || !this.target) {
            return {
                x: MathUtils.random(50, this.worldWidth - 50),
                y: MathUtils.random(50, this.worldHeight - 50)
            };
        }

        const bounds = this.camera.getVisibleBounds();
        const expandedBounds = {
            x: bounds.x - 32,
            y: bounds.y - 32,
            width: bounds.width + 64,
            height: bounds.height + 64
        };
        const requiredDistance = this.minSpawnDistance + Math.min(140, this.waveNumber * 10);

        for (let attempt = 0; attempt < 24; attempt++) {
            const edge = MathUtils.randomInt(0, 3);
            let x = 0;
            let y = 0;

            switch (edge) {
                case 0:
                    x = MathUtils.random(bounds.x - this.spawnMargin, bounds.x + bounds.width + this.spawnMargin);
                    y = bounds.y - this.spawnMargin;
                    break;
                case 1:
                    x = bounds.x + bounds.width + this.spawnMargin;
                    y = MathUtils.random(bounds.y - this.spawnMargin, bounds.y + bounds.height + this.spawnMargin);
                    break;
                case 2:
                    x = MathUtils.random(bounds.x - this.spawnMargin, bounds.x + bounds.width + this.spawnMargin);
                    y = bounds.y + bounds.height + this.spawnMargin;
                    break;
                default:
                    x = bounds.x - this.spawnMargin;
                    y = MathUtils.random(bounds.y - this.spawnMargin, bounds.y + bounds.height + this.spawnMargin);
                    break;
            }

            x = MathUtils.clamp(x, 20, this.worldWidth - 20);
            y = MathUtils.clamp(y, 20, this.worldHeight - 20);

            const dx = x - this.target.x;
            const dy = y - this.target.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < requiredDistance) continue;
            if (MathUtils.rectsIntersect(x - 16, y - 16, 32, 32, expandedBounds.x, expandedBounds.y, expandedBounds.width, expandedBounds.height)) {
                continue;
            }
            if (this.positionValidator && !this.positionValidator(x, y)) {
                continue;
            }
            if (this.enemies.some((enemy) => !enemy.destroyed && enemy.distanceToSquared({ x, y }) < 32 * 32)) {
                continue;
            }

            return { x, y };
        }

        return {
            x: MathUtils.clamp(this.target.x + requiredDistance, 20, this.worldWidth - 20),
            y: MathUtils.clamp(this.target.y, 20, this.worldHeight - 20)
        };
    }

    /**
     * Spawn an enemy
     * @param {string} [type]
     */
    spawnEnemy(type: EnemyTypeKey | string | null = null) {
        if (this.enemies.length >= this.maxEnemies) return null;

        const pos = this.getSpawnPosition();
        const enemyType = type || this.pickEnemyTypeForBudget();
        if (!enemyType) return null;

        // Get sprite image for this enemy type
        const spriteImage = this.spriteImages[enemyType] || null;
        const spriteSheet = this.spriteSheets[enemyType] || null;

        const enemy = new Enemy(pos.x, pos.y, enemyType, this.config, spriteImage, spriteSheet);
        if (this.target) {
            enemy.setTarget(this.target);
        }
        enemy.setDamageResolver(this.damageResolver);

        this.enemies.push(enemy);

        eventBus.emit(GameEvents.ENEMY_SPAWNED, {
            enemy: enemy,
            type: enemyType,
            wave: this.waveNumber
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
        this.elapsedTime += deltaTime;
        const nextWave = Math.floor(this.elapsedTime / this.waveDuration);
        if (nextWave !== this.waveNumber) {
            this.waveNumber = nextWave;
            console.log(`Wave ${this.waveNumber} started`);
        }
        this.waveTimer = this.elapsedTime - this.waveNumber * this.waveDuration;

        this.spawnBudget = Math.min(
            this.getThreatBudgetCap(),
            this.spawnBudget + this.getThreatIncomePerSecond() * deltaTime
        );
        this.spawnCadenceTimer += deltaTime;

        if (
            this.elapsedTime >= this.spawnGracePeriod &&
            this.spawnCadenceTimer >= this.getSpawnCadence() &&
            this.getAliveThreat() < this.getThreatBudgetCap() &&
            this.enemies.length < this.maxEnemies
        ) {
            const enemyType = this.pickEnemyTypeForBudget();
            if (enemyType) {
                const spawned = this.spawnEnemy(enemyType);
                if (spawned) {
                    this.spawnBudget = Math.max(
                        0,
                        this.spawnBudget - (EnemyTypes[enemyType as EnemyTypeKey].spawnThreat || 5)
                    );
                    this.spawnCadenceTimer = 0;
                }
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

    getXPGems() {
        return this.xpGems;
    }

    getPowerUps() {
        return this.powerUps;
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
        this.elapsedTime = 0;
        this.spawnBudget = 0;
        this.spawnCadenceTimer = 0;
    }

    destroy() {
        this.clear();
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers = [];
    }
}
