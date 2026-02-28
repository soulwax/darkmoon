// File: src/scenes/GameScene.ts

import { Scene } from './Scene';
import { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import { Camera } from '../graphics/Camera';
import { TileMap } from '../graphics/TileMap';
import { InputManager } from '../input/InputManager';
import { SpawnSystem } from '../systems/SpawnSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { Sword } from '../weapons/Sword';
import { Longsword } from '../weapons/Longsword';
import { DebugLogger } from '../core/DebugLogger';
import { eventBus, GameEvents } from '../core/EventBus';
import { HUD } from '../ui/HUD';
import { LevelUpScreen } from '../ui/LevelUpScreen';
import { UpgradeSystem, type UpgradeOption } from '../systems/UpgradeSystem';
import type { Game } from '../Game';
import type { GameConfig } from '../config/GameConfig';
import type { AssetLoader } from '../assets/AssetLoader';
import type { SpriteSheet } from '../assets/SpriteSheet';
import type { Component } from '../ecs/Component';
import type { HealthComponent } from '../ecs/components/HealthComponent';
import type { ColliderComponent } from '../ecs/components/ColliderComponent';
import type { MovementComponent } from '../ecs/components/MovementComponent';

interface WorldChest {
    tileX: number;
    tileY: number;
    worldX: number;
    worldY: number;
    closedTileId: number;
    openTileId: number;
    opened: boolean;
    baseXpValue: number;
    powerUpChance: number;
}

interface TileCollisionEntity {
    x: number;
    y: number;
    vx: number;
    vy: number;
    knockbackVx?: number;
    knockbackVy?: number;
    getComponent<T extends Component>(
        componentClass: string | (new (...args: never[]) => T)
    ): T | null;
}

interface DamageSnapshot {
    time: number;
    amount: number;
    sourceType: string;
    sourceId: number | null;
    sourceX: number | null;
    sourceY: number | null;
    playerHealthAfter: number;
    playerShieldAfter: number;
}

interface DeathDebugInfo {
    reason: string;
    sourceType?: string;
    sourceId?: number;
    incomingDamage?: number;
    healthBefore?: number;
    healthAfter?: number;
    shieldBefore?: number;
    shieldAfter?: number;
    playerX?: number;
    playerY?: number;
    time?: number;
}

interface GameOverPayload {
    time?: number;
    kills?: number;
    level?: number;
    damageDealt?: number;
    gemsCollected?: number;
    message?: string;
    debug?: DeathDebugInfo;
}

type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';

interface EnemyProximitySnapshot {
    enemyId: number;
    enemyType: string;
    enemyDamage: number;
    enemyX: number;
    enemyY: number;
    playerX: number;
    playerY: number;
    distance: number;
}

export class GameScene extends Scene {
    config: GameConfig;
    assetLoader: AssetLoader;
    inputManager: InputManager;
    camera!: Camera;
    tileMap!: TileMap;
    spawnSystem!: SpawnSystem;
    particleSystem!: ParticleSystem;
    player!: Player;
    hud!: HUD;
    levelUpScreen!: LevelUpScreen;
    upgradeSystem!: UpgradeSystem;
    showingLevelUp: boolean;
    gameTime: number;
    killCount: number;
    damageDealt: number;
    gemsCollected: number;
    hitstopTimer: number;
    weaponShakeCooldown: number;
    worldChests: WorldChest[];
    nearestChest: WorldChest | null;
    chestInteractRange: number;
    enemyContactCooldowns: Map<number, number>;
    playerContactDamageCooldown: number;
    playerContactDamageInterval: number;
    gameOverTriggered: boolean;
    playerSpawnInvulnerabilityTimer: number;
    debugOverlayEnabled: boolean;
    lastDamageSnapshot: DamageSnapshot | null;
    deathDebugInfo: DeathDebugInfo | null;
    debugLog: string[];
    lastGameOverPayload: GameOverPayload | null;
    lastProximityEnemyId: number | null;
    lastProximityBand: string;
    lastProximityLogTime: number;
    lastContactGateLogTime: number;

    constructor(game: Game, config: GameConfig, assetLoader: AssetLoader) {
        super(game);

        this.config = config;
        this.assetLoader = assetLoader;

        // Systems
        this.inputManager = new InputManager(config.input);
        // initialized in onEnter

        // Entities
        // initialized in onEnter

        // UI
        // initialized in onEnter
        this.showingLevelUp = false;

        // Game state
        this.gameTime = 0;
        this.killCount = 0;
        this.damageDealt = 0;
        this.gemsCollected = 0;
        this.hitstopTimer = 0;
        this.weaponShakeCooldown = 0;
        this.worldChests = [];
        this.nearestChest = null;
        this.chestInteractRange = 36;
        this.enemyContactCooldowns = new Map();
        this.playerContactDamageCooldown = 0;
        this.playerContactDamageInterval = 0.6;
        this.gameOverTriggered = false;
        this.playerSpawnInvulnerabilityTimer = 0;
        this.debugOverlayEnabled = true;
        this.lastDamageSnapshot = null;
        this.deathDebugInfo = null;
        this.debugLog = [];
        this.lastGameOverPayload = null;
        this.lastProximityEnemyId = null;
        this.lastProximityBand = 'none';
        this.lastProximityLogTime = -Infinity;
        this.lastContactGateLogTime = -Infinity;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        eventBus.on(GameEvents.PLAYER_LEVELUP, (data: { player: Player; level: number; xpToNext: number }) => {
            this._pushDebugLog('player_levelup_event', 'warn', {
                level: data.level,
                xpToNext: data.xpToNext,
                xpRemainder: data.player?.xp ?? null,
                gamePaused: this.game.paused,
                gameTime: Number(this.gameTime.toFixed(2))
            });
            this._showLevelUpScreen();
        });

        eventBus.on(GameEvents.ENEMY_KILLED, () => {
            this.killCount++;
        });

        eventBus.on(GameEvents.XP_COLLECTED, (data: { value: number; x: number; y: number }) => {
            this.gemsCollected++;
            if (this.player) {
                this.player.gainXP(data.value);
            }
            this.particleSystem?.createXPParticles(data.x, data.y);
        });

        eventBus.on(GameEvents.ENEMY_DAMAGED, (data: { enemy: { x: number; y: number }; amount: number }) => {
            if (typeof data.amount === 'number' && data.amount > 0) {
                this.damageDealt += data.amount;
                if (data.amount >= 18) {
                    const targetFps = this.config.graphics?.targetFPS || 60;
                    const frame = 1 / targetFps;
                    const hitstopFrames = data.amount >= 35 ? 3 : 2;
                    this.hitstopTimer = Math.max(this.hitstopTimer, frame * hitstopFrames);
                }
            }
            this.particleSystem?.createHitEffect(data.enemy.x, data.enemy.y, '#fff');
            this.particleSystem?.createDamageNumber(data.enemy.x, data.enemy.y, data.amount, '#fff');
        });

        eventBus.on(GameEvents.PLAYER_DAMAGED, (data?: {
            source?: { x?: number; y?: number; type?: string; id?: number } | null;
            amount?: number;
            remaining?: number;
        }) => {
            this.camera?.shake(3, 0.2);

            if (!this.camera) return;

            const source = data?.source;
            const sourceInfo = this._extractSourceDebugInfo(source);
            const health = this.player?.getComponent<HealthComponent>('HealthComponent');
            this.lastDamageSnapshot = {
                time: this.gameTime,
                amount: Math.max(0, data?.amount || 0),
                sourceType: sourceInfo.sourceType,
                sourceId: sourceInfo.sourceId,
                sourceX: sourceInfo.sourceX,
                sourceY: sourceInfo.sourceY,
                playerHealthAfter: health?.health ?? 0,
                playerShieldAfter: typeof this.player?.getShield === 'function' ? this.player.getShield() : 0
            };
            this._pushDebugLog('player_damaged_event', 'warn', {
                sourceType: sourceInfo.sourceType,
                sourceId: sourceInfo.sourceId,
                sourceX: sourceInfo.sourceX,
                sourceY: sourceInfo.sourceY,
                rawAmount: data?.amount ?? null,
                remainingDamage: data?.remaining ?? null,
                healthAfter: this.lastDamageSnapshot.playerHealthAfter,
                shieldAfter: this.lastDamageSnapshot.playerShieldAfter
            });

            if (source && this.player) {
                const sx = typeof source.x === 'number' ? source.x : this.player.x;
                const sy = typeof source.y === 'number' ? source.y : this.player.y;
                const dx = this.player.x - sx;
                const dy = this.player.y - sy;
                this.camera.punch(dx, dy, 6);
            } else {
                this.camera.punch(0, -1, 4);
            }
        });

        eventBus.on(GameEvents.WEAPON_FIRED, (data?: { weapon?: { name?: string } }) => {
            if (!this.camera || this.weaponShakeCooldown > 0) return;

            const weaponName = data?.weapon?.name || '';
            const presets: Record<string, { intensity: number; duration: number; cooldown: number }> = {
                Sword: { intensity: 1.2, duration: 0.06, cooldown: 0.05 },
                Longsword: { intensity: 2.2, duration: 0.1, cooldown: 0.08 },
                'Magic Missiles': { intensity: 0.8, duration: 0.05, cooldown: 0.06 },
                'Lightning Strike': { intensity: 3.5, duration: 0.16, cooldown: 0.14 }
            };
            const preset = presets[weaponName];
            if (!preset) return;

            this.camera.shake(preset.intensity, preset.duration);
            this.weaponShakeCooldown = preset.cooldown;
        });

        eventBus.on(GameEvents.POWERUP_COLLECTED, (data: { type: string; x: number; y: number }) => {
            if (!this.player) return;

            if (data.type === 'bomb') {
                const enemies = this.spawnSystem?.getEnemies?.() || [];
                const base = 40 + (this.player.level - 1) * 4;
                const mult = typeof this.player.getDamageMultiplier === 'function' ? this.player.getDamageMultiplier() : 1;
                const crit = typeof this.player.rollCriticalHit === 'function' ? this.player.rollCriticalHit(0.08) : false;
                const critMult = crit && typeof this.player.getCritDamageMultiplier === 'function' ? this.player.getCritDamageMultiplier() : 1;
                const bombDamage = Math.floor(base * mult * critMult);

                for (const enemy of enemies) {
                    if (enemy.destroyed) continue;
                    enemy.takeDamage(bombDamage, this.player);
                }

                this.camera?.shake(6, 0.25);
                this.particleSystem?.createLightningEffect(data.x, data.y, 120);
                return;
            }

            if (data.type === 'heal' || data.type === 'shield' || data.type === 'haste' || data.type === 'rage' || data.type === 'magnet' || data.type === 'xp') {
                this.player.applyPowerUp(data.type);
            }
        });

        eventBus.on(GameEvents.PLAYER_DIED, () => {
            this._pushDebugLog('player_died_event_received', 'error', {
                deathDebug: this.deathDebugInfo,
                lastDamageSnapshot: this.lastDamageSnapshot
            });
            const message = this._formatDeathMessage('You were overwhelmed. Start again?');
            this._emitGameOver(message);
        });

        eventBus.on(GameEvents.GAME_PAUSE, () => {
            this._pushDebugLog('event_game_pause_received', 'warn', {
                gamePaused: this.game.paused,
                showingLevelUp: this.showingLevelUp,
                hasFocus: document.hasFocus()
            });
        });

        eventBus.on(GameEvents.GAME_RESUME, () => {
            this._pushDebugLog('event_game_resume_received', 'info', {
                gamePaused: this.game.paused,
                showingLevelUp: this.showingLevelUp,
                hasFocus: document.hasFocus()
            });
        });
    }

    _extractSourceDebugInfo(source: unknown) {
        let sourceType = 'unknown';
        let sourceId: number | null = null;
        let sourceX: number | null = null;
        let sourceY: number | null = null;

        if (source && typeof source === 'object') {
            const candidate = source as {
                type?: unknown;
                name?: unknown;
                id?: unknown;
                x?: unknown;
                y?: unknown;
            };
            if (typeof candidate.type === 'string' && candidate.type.length > 0) {
                sourceType = candidate.type;
            } else if (typeof candidate.name === 'string' && candidate.name.length > 0) {
                sourceType = candidate.name;
            }
            if (typeof candidate.id === 'number') {
                sourceId = candidate.id;
            }
            if (typeof candidate.x === 'number') {
                sourceX = candidate.x;
            }
            if (typeof candidate.y === 'number') {
                sourceY = candidate.y;
            }
        }

        return { sourceType, sourceId, sourceX, sourceY };
    }

    _formatDeathDebug(debug?: DeathDebugInfo | null) {
        if (!debug) return '';

        const parts: string[] = [];
        parts.push(`reason=${debug.reason}`);
        if (debug.sourceType) {
            parts.push(`source=${debug.sourceType}${typeof debug.sourceId === 'number' ? `#${debug.sourceId}` : ''}`);
        }
        if (typeof debug.incomingDamage === 'number') {
            parts.push(`incoming=${debug.incomingDamage}`);
        }
        if (typeof debug.healthBefore === 'number' || typeof debug.healthAfter === 'number') {
            parts.push(`hp=${Math.round(debug.healthBefore ?? 0)}->${Math.round(debug.healthAfter ?? 0)}`);
        }
        if (typeof debug.shieldBefore === 'number' || typeof debug.shieldAfter === 'number') {
            parts.push(`shield=${Math.round(debug.shieldBefore ?? 0)}->${Math.round(debug.shieldAfter ?? 0)}`);
        }
        if (typeof debug.playerX === 'number' && typeof debug.playerY === 'number') {
            parts.push(`pos=(${Math.round(debug.playerX)}, ${Math.round(debug.playerY)})`);
        }
        if (typeof debug.time === 'number') {
            parts.push(`t=${debug.time.toFixed(2)}s`);
        }
        return parts.join(' | ');
    }

    _formatDeathMessage(fallback: string) {
        if (this.deathDebugInfo?.sourceType) {
            return `Felled by ${this.deathDebugInfo.sourceType}. Start again?`;
        }
        if (this.lastDamageSnapshot?.sourceType && this.lastDamageSnapshot.sourceType !== 'unknown') {
            return `Felled by ${this.lastDamageSnapshot.sourceType}. Start again?`;
        }
        return fallback;
    }

    _getNearestEnemySnapshot(enemies: Enemy[]): EnemyProximitySnapshot | null {
        if (!this.player || !enemies || enemies.length === 0) return null;

        let nearestEnemy: Enemy | null = null;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;

        for (const enemy of enemies) {
            if (!enemy || enemy.destroyed) continue;
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
                nearestEnemy = enemy;
            }
        }

        if (!nearestEnemy || !Number.isFinite(nearestDistanceSq)) return null;
        const distance = Math.sqrt(nearestDistanceSq);
        return {
            enemyId: nearestEnemy.id,
            enemyType: nearestEnemy.type || 'enemy',
            enemyDamage: nearestEnemy.damage,
            enemyX: nearestEnemy.x,
            enemyY: nearestEnemy.y,
            playerX: this.player.x,
            playerY: this.player.y,
            distance: Number(distance.toFixed(2))
        };
    }

    _getProximityBand(distance: number) {
        if (distance <= 30) return 'contact';
        if (distance <= 55) return 'danger-close';
        if (distance <= 90) return 'close';
        if (distance <= 140) return 'near';
        return 'far';
    }

    _trackEnemyProximity(enemies: Enemy[]) {
        const nearest = this._getNearestEnemySnapshot(enemies);
        if (!nearest) {
            if (this.lastProximityEnemyId !== null) {
                this._pushDebugLog('enemy_proximity_clear', 'debug', {
                    enemiesAlive: enemies.filter((enemy) => !enemy.destroyed).length
                });
            }
            this.lastProximityEnemyId = null;
            this.lastProximityBand = 'none';
            return;
        }

        const band = this._getProximityBand(nearest.distance);
        const shouldLog =
            nearest.enemyId !== this.lastProximityEnemyId ||
            band !== this.lastProximityBand ||
            (this.gameTime - this.lastProximityLogTime) >= 1.25;

        if (!shouldLog) return;

        this.lastProximityEnemyId = nearest.enemyId;
        this.lastProximityBand = band;
        this.lastProximityLogTime = this.gameTime;

        const level: DebugLogLevel = (band === 'contact' || band === 'danger-close') ? 'warn' : 'debug';
        this._pushDebugLog('enemy_proximity', level, {
            ...nearest,
            band,
            enemiesAlive: enemies.filter((enemy) => !enemy.destroyed).length
        });
    }

    _getPauseInputSnapshot() {
        const pauseKeys = this.inputManager.bindings.get('pause') || [];
        return pauseKeys.map((code) => ({
            code,
            down: !!this.inputManager.keys.get(code),
            pressed: !!this.inputManager.keysPressed.get(code),
            released: !!this.inputManager.keysReleased.get(code)
        }));
    }

    _pushDebugLog(message: string, level: DebugLogLevel = 'debug', data?: unknown) {
        const timestamp = this.gameTime.toFixed(2);
        this.debugLog.push(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        if (this.debugLog.length > 16) {
            this.debugLog.shift();
        }

        const payload = data === undefined
            ? { t: Number(timestamp), message }
            : { t: Number(timestamp), message, data };

        switch (level) {
            case 'info':
                DebugLogger.info('GameScene', message, payload);
                break;
            case 'warn':
                DebugLogger.warn('GameScene', message, payload);
                break;
            case 'error':
                DebugLogger.error('GameScene', message, payload);
                break;
            default:
                DebugLogger.debug('GameScene', message, payload);
                break;
        }
    }

    _emitGameOver(message: string = 'You were overwhelmed. Start again?') {
        if (this.gameOverTriggered) return;
        this.gameOverTriggered = true;

        const debugPayload: DeathDebugInfo = this.deathDebugInfo || {
            reason: 'unknown',
            sourceType: this.lastDamageSnapshot?.sourceType || 'unknown',
            sourceId: this.lastDamageSnapshot?.sourceId ?? undefined,
            incomingDamage: this.lastDamageSnapshot?.amount,
            healthAfter: this.lastDamageSnapshot?.playerHealthAfter,
            shieldAfter: this.lastDamageSnapshot?.playerShieldAfter,
            playerX: this.player?.x,
            playerY: this.player?.y,
            time: this.gameTime
        };

        const payload: GameOverPayload = {
            time: this.gameTime,
            kills: this.killCount,
            level: this.player?.level || 1,
            damageDealt: this.damageDealt,
            gemsCollected: this.gemsCollected,
            message,
            debug: debugPayload
        };
        this.lastGameOverPayload = payload;
        this._pushDebugLog(`game_over -> ${this._formatDeathDebug(debugPayload)}`, 'warn', payload);

        // End the game loop deterministically.
        this.game.endGame();
        eventBus.emit(GameEvents.GAME_OVER, payload);
        this._forceShowGameOverOverlay(payload);
        this._ensureGameOverOverlayVisible(payload);
    }

    _ensureGameOverOverlayVisible(data: GameOverPayload, attempt: number = 0) {
        const gameOver = document.getElementById('gameOverScreen');
        const visible = !!gameOver && gameOver.style.display === 'flex' && !gameOver.classList.contains('hidden');
        if (visible || attempt >= 12) return;

        this._forceShowGameOverOverlay(data);
        window.setTimeout(() => {
            this._ensureGameOverOverlayVisible(data, attempt + 1);
        }, 80);
    }

    _forceShowGameOverOverlay(data: GameOverPayload) {
        const gameOver = document.getElementById('gameOverScreen');
        if (gameOver) {
            gameOver.classList.remove('hidden');
            gameOver.style.display = 'flex';
        }

        const timeEl = document.getElementById('finalTime');
        const killsEl = document.getElementById('finalKills');
        const levelEl = document.getElementById('finalLevel');
        const damageEl = document.getElementById('finalDamage');
        const gemsEl = document.getElementById('finalGems');
        const messageEl = document.getElementById('deathMessage');
        const debugEl = document.getElementById('deathDebug');

        if (timeEl && data.time !== undefined) {
            const minutes = Math.floor(data.time / 60);
            const seconds = Math.floor(data.time % 60);
            timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (killsEl && data.kills !== undefined) {
            killsEl.textContent = data.kills.toString();
        }

        if (levelEl) {
            levelEl.textContent = (data.level ?? 1).toString();
        }

        if (damageEl) {
            damageEl.textContent = Math.floor(data.damageDealt ?? 0).toLocaleString();
        }

        if (gemsEl) {
            gemsEl.textContent = (data.gemsCollected ?? 0).toLocaleString();
        }

        if (messageEl) {
            messageEl.textContent = data.message || 'You died.';
        }

        if (debugEl) {
            const debugText = this._formatDeathDebug(data.debug);
            debugEl.textContent = debugText;
            debugEl.style.display = debugText ? 'block' : 'none';
        }
    }

    onEnter(data: Record<string, unknown> = {}) {
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

        // Give starting weapon (Sword for melee combat)
        this.player.addWeapon(Sword);
        this.player.addWeapon(Longsword, { particleSystem: this.particleSystem });

        // Setup spawn system with asset loader for enemy sprites
        this.spawnSystem = new SpawnSystem(this.config, this.camera, this.assetLoader);
        this.spawnSystem.setTarget(this.player);

        // Setup camera to follow player
        this.camera.follow(this.player);

        // Setup UI
        this.hud = new HUD(this.game.canvas, this.config);
        this.levelUpScreen = new LevelUpScreen(this.game.canvas, this.config);
        this.upgradeSystem = new UpgradeSystem(this.player);

        // Reset state
        this.gameTime = 0;
        this.killCount = 0;
        this.damageDealt = 0;
        this.gemsCollected = 0;
        this.hitstopTimer = 0;
        this.weaponShakeCooldown = 0;
        this.showingLevelUp = false;
        this.nearestChest = null;
        this.enemyContactCooldowns.clear();
        this.playerContactDamageCooldown = 0;
        this.gameOverTriggered = false;
        this.playerSpawnInvulnerabilityTimer = 1.2;
        this.lastDamageSnapshot = null;
        this.deathDebugInfo = null;
        this.lastGameOverPayload = null;
        this.debugLog = [];
        this.lastProximityEnemyId = null;
        this.lastProximityBand = 'none';
        this.lastProximityLogTime = -Infinity;
        this.lastContactGateLogTime = -Infinity;
        this._pushDebugLog('Scene entered');
    }

    onExit() {
        super.onExit();

        // Cleanup
        this.spawnSystem?.destroy();
        this.particleSystem?.clear();
        this.worldChests = [];
        this.nearestChest = null;
        this.enemyContactCooldowns.clear();
        this.playerContactDamageCooldown = 0;
        this.gameOverTriggered = false;
        this.playerSpawnInvulnerabilityTimer = 0;
        this.lastDamageSnapshot = null;
        this.deathDebugInfo = null;
        this.lastGameOverPayload = null;
        this.lastProximityEnemyId = null;
        this.lastProximityBand = 'none';
        this.lastProximityLogTime = -Infinity;
        this.lastContactGateLogTime = -Infinity;
        this._pushDebugLog('Scene exited');
    }

    _generateWorld() {
        if (!this.tileMap) return;
        const width = this.config.world.worldWidthTiles;
        const height = this.config.world.worldHeightTiles;

        this.tileMap.init(width, height);
        this.worldChests = [];

        // --- Sprite sheets ---
        const sheets: Record<string, SpriteSheet | null> = {
            grass: this.assetLoader?.getSpriteSheet?.('grass') || null,
            water: this.assetLoader?.getSpriteSheet?.('water') || null,
            dirtGrass: this.assetLoader?.getSpriteSheet?.('dirtGrass') || null,
            decorGrass: this.assetLoader?.getSpriteSheet?.('decorGrass') || null,
            flowers: this.assetLoader?.getSpriteSheet?.('flowers') || null,
            shrooms: this.assetLoader?.getSpriteSheet?.('shrooms') || null,
            objects: this.assetLoader?.getSpriteSheet?.('objects') || null,
            rockInWater: this.assetLoader?.getSpriteSheet?.('rockInWater') || null,
            chest01: this.assetLoader?.getSpriteSheet?.('chest01') || null,
            chest02: this.assetLoader?.getSpriteSheet?.('chest02') || null
        };

        for (const [name, sheet] of Object.entries(sheets)) {
            if (sheet) this.tileMap.registerSpriteSheet(name, sheet);
        }

        // --- Tile type IDs ---
        const G = {
            grass: 1,
            waterFill: 10,
            waterNW: 11,
            waterN: 12,
            waterNE: 13,
            waterE: 14,
            waterSE: 15,
            waterS: 16,
            waterSW: 17,
            waterW: 18
        };

        const D = {
            dirtHWest: 50,
            dirtHCenter: 51,
            dirtHEast: 52,
            dirtVNorth: 53,
            dirtVCenter: 54,
            dirtVSouth: 55,

            decorGrass0: 60,

            flower0: 70,

            shroomCluster: 90,

            rock1: 100,
            rock2: 101,
            rock3: 102,

            rockInWater: 110,

            chest01BigClosed: 120,
            chest01SmallClosed: 121,
            chest01BigOpen: 122,
            chest01SmallOpen: 123,
            chest02BigClosed: 124,
            chest02SmallClosed: 125,
            chest02BigOpen: 126,
            chest02SmallOpen: 127
        };

        // --- Ground (always) ---
        if (sheets.grass) {
            this.tileMap.defineTileType(G.grass, { spriteSheet: 'grass', tileId: 0, walkable: true });
        } else {
            this.tileMap.defineTileType(G.grass, { color: '#2d5a27', walkable: true });
        }
        this.tileMap.fillRect('ground', 0, 0, width, height, G.grass);

        // --- Water tiles (optional) ---
        if (sheets.water) {
            this.tileMap.defineTileType(G.waterFill, { spriteSheet: 'water', tileId: 12, walkable: false });
            this.tileMap.defineTileType(G.waterNW, { spriteSheet: 'water', tileId: 0, walkable: false });
            this.tileMap.defineTileType(G.waterN, { spriteSheet: 'water', tileId: 1, walkable: false });
            this.tileMap.defineTileType(G.waterNE, { spriteSheet: 'water', tileId: 2, walkable: false });
            this.tileMap.defineTileType(G.waterE, { spriteSheet: 'water', tileId: 3, walkable: false });
            this.tileMap.defineTileType(G.waterSE, { spriteSheet: 'water', tileId: 4, walkable: false });
            this.tileMap.defineTileType(G.waterS, { spriteSheet: 'water', tileId: 5, walkable: false });
            this.tileMap.defineTileType(G.waterSW, { spriteSheet: 'water', tileId: 6, walkable: false });
            this.tileMap.defineTileType(G.waterW, { spriteSheet: 'water', tileId: 7, walkable: false });
        }

        // --- Dirt path overlay (optional) ---
        if (sheets.dirtGrass) {
            this.tileMap.defineTileType(D.dirtHWest, { spriteSheet: 'dirtGrass', tileId: 13, walkable: true });
            this.tileMap.defineTileType(D.dirtHCenter, { spriteSheet: 'dirtGrass', tileId: 14, walkable: true });
            this.tileMap.defineTileType(D.dirtHEast, { spriteSheet: 'dirtGrass', tileId: 15, walkable: true });
            this.tileMap.defineTileType(D.dirtVNorth, { spriteSheet: 'dirtGrass', tileId: 0, walkable: true });
            this.tileMap.defineTileType(D.dirtVCenter, { spriteSheet: 'dirtGrass', tileId: 1, walkable: true });
            this.tileMap.defineTileType(D.dirtVSouth, { spriteSheet: 'dirtGrass', tileId: 2, walkable: true });
        }

        // --- Decorations (optional) ---
        if (sheets.decorGrass) {
            for (let i = 0; i < 4; i++) {
                this.tileMap.defineTileType(D.decorGrass0 + i, { spriteSheet: 'decorGrass', tileId: i, walkable: true });
            }
        }

        if (sheets.flowers) {
            for (let i = 0; i < 16; i++) {
                this.tileMap.defineTileType(D.flower0 + i, { spriteSheet: 'flowers', tileId: i, walkable: true });
            }
        }

        if (sheets.shrooms) {
            this.tileMap.defineTileType(D.shroomCluster, { spriteSheet: 'shrooms', tileId: 3, walkable: false });
        }

        if (sheets.objects) {
            this.tileMap.defineTileType(D.rock1, { spriteSheet: 'objects', tileId: 12, walkable: false });
            this.tileMap.defineTileType(D.rock2, { spriteSheet: 'objects', tileId: 13, walkable: false });
            this.tileMap.defineTileType(D.rock3, { spriteSheet: 'objects', tileId: 14, walkable: false });
        }

        if (sheets.rockInWater) {
            this.tileMap.defineTileType(D.rockInWater, { spriteSheet: 'rockInWater', tileId: 0, walkable: false });
        }

        if (sheets.chest01) {
            this.tileMap.defineTileType(D.chest01BigClosed, { spriteSheet: 'chest01', tileId: 0, walkable: false });
            this.tileMap.defineTileType(D.chest01SmallClosed, { spriteSheet: 'chest01', tileId: 1, walkable: false });
            this.tileMap.defineTileType(D.chest01BigOpen, { spriteSheet: 'chest01', tileId: 2, walkable: false });
            this.tileMap.defineTileType(D.chest01SmallOpen, { spriteSheet: 'chest01', tileId: 3, walkable: false });
        }

        if (sheets.chest02) {
            this.tileMap.defineTileType(D.chest02BigClosed, { spriteSheet: 'chest02', tileId: 0, walkable: false });
            this.tileMap.defineTileType(D.chest02SmallClosed, { spriteSheet: 'chest02', tileId: 1, walkable: false });
            this.tileMap.defineTileType(D.chest02BigOpen, { spriteSheet: 'chest02', tileId: 2, walkable: false });
            this.tileMap.defineTileType(D.chest02SmallOpen, { spriteSheet: 'chest02', tileId: 3, walkable: false });
        }

        // --- Procedural placement ---
        const mulberry32 = (seed: number) => () => {
            let t = (seed += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const rand = mulberry32(1337);
        const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);

        const stampPond = (x0: number, y0: number, w: number, h: number) => {
            if (!sheets.water) return;
            if (w < 2 || h < 2) return;

            const x1 = x0 + w - 1;
            const y1 = y0 + h - 1;

            // Corners
            this.tileMap.setTile('ground', x0, y0, G.waterNW);
            this.tileMap.setTile('ground', x1, y0, G.waterNE);
            this.tileMap.setTile('ground', x1, y1, G.waterSE);
            this.tileMap.setTile('ground', x0, y1, G.waterSW);

            // Edges
            for (let x = x0 + 1; x < x1; x++) {
                this.tileMap.setTile('ground', x, y0, G.waterN);
                this.tileMap.setTile('ground', x, y1, G.waterS);
            }
            for (let y = y0 + 1; y < y1; y++) {
                this.tileMap.setTile('ground', x0, y, G.waterW);
                this.tileMap.setTile('ground', x1, y, G.waterE);
            }

            // Fill
            for (let y = y0 + 1; y < y1; y++) {
                for (let x = x0 + 1; x < x1; x++) {
                    this.tileMap.setTile('ground', x, y, G.waterFill);
                }
            }
        };

        const stampHorizontalPath = (x0: number, y0: number, length: number) => {
            if (!sheets.dirtGrass) return;
            if (length < 2) return;

            this.tileMap.setTile('decoration', x0, y0, D.dirtHWest);
            for (let x = x0 + 1; x < x0 + length - 1; x++) {
                this.tileMap.setTile('decoration', x, y0, D.dirtHCenter);
            }
            this.tileMap.setTile('decoration', x0 + length - 1, y0, D.dirtHEast);
        };

        const stampVerticalPath = (x0: number, y0: number, length: number) => {
            if (!sheets.dirtGrass) return;
            if (length < 2) return;

            this.tileMap.setTile('decoration', x0, y0, D.dirtVNorth);
            for (let y = y0 + 1; y < y0 + length - 1; y++) {
                this.tileMap.setTile('decoration', x0, y, D.dirtVCenter);
            }
            this.tileMap.setTile('decoration', x0, y0 + length - 1, D.dirtVSouth);
        };

        // Place a small pond near the start (if water is available)
        if (sheets.water) {
            const pondW = 12;
            const pondH = 9;
            const pondX = Math.max(2, centerX - 14);
            const pondY = Math.max(2, centerY - 13);
            stampPond(pondX, pondY, pondW, pondH);

            // Add a few animated rocks in the water (optional)
            if (sheets.rockInWater) {
                for (let i = 0; i < 3; i++) {
                    const rx = randInt(pondX + 2, pondX + pondW - 3);
                    const ry = randInt(pondY + 2, pondY + pondH - 3);
                    if (this.tileMap.getTile('ground', rx, ry) === G.waterFill) {
                        this.tileMap.setTile('decoration', rx, ry, D.rockInWater);
                    }
                }
            }
        }

        // Simple road cross (optional)
        stampHorizontalPath(centerX - 18, centerY + 6, 37);
        stampVerticalPath(centerX + 10, centerY - 16, 33);

        // Scatter decorations
        const safeRadius = 6;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Keep a clear area around spawn
                if (Math.abs(x - centerX) <= safeRadius && Math.abs(y - centerY) <= safeRadius) continue;

                // Don't overwrite authored decoration
                if (this.tileMap.getTile('decoration', x, y) !== 0) continue;

                const groundTile = this.tileMap.getTile('ground', x, y);

                // Water-only decoration
                if (groundTile === G.waterFill) {
                    if (sheets.rockInWater && rand() < 0.02) {
                        this.tileMap.setTile('decoration', x, y, D.rockInWater);
                    }
                    continue;
                }

                // Land decorations
                const roll = rand();
                if (sheets.objects && roll < 0.004) {
                    this.tileMap.setTile('decoration', x, y, randInt(D.rock1, D.rock3));
                } else if (sheets.shrooms && roll < 0.010) {
                    this.tileMap.setTile('decoration', x, y, D.shroomCluster);
                } else if (sheets.flowers && roll < 0.030) {
                    this.tileMap.setTile('decoration', x, y, D.flower0 + randInt(0, 15));
                } else if (sheets.decorGrass && roll < 0.150) {
                    this.tileMap.setTile('decoration', x, y, D.decorGrass0 + randInt(0, 3));
                }
            }
        }

        // Place interactable chests after base decoration.
        const chestVariants: Array<{ closedTileId: number; openTileId: number; baseXpValue: number; powerUpChance: number }> = [];
        if (sheets.chest01) {
            chestVariants.push(
                { closedTileId: D.chest01BigClosed, openTileId: D.chest01BigOpen, baseXpValue: 9, powerUpChance: 0.28 },
                { closedTileId: D.chest01SmallClosed, openTileId: D.chest01SmallOpen, baseXpValue: 6, powerUpChance: 0.18 }
            );
        }
        if (sheets.chest02) {
            chestVariants.push(
                { closedTileId: D.chest02BigClosed, openTileId: D.chest02BigOpen, baseXpValue: 10, powerUpChance: 0.32 },
                { closedTileId: D.chest02SmallClosed, openTileId: D.chest02SmallOpen, baseXpValue: 7, powerUpChance: 0.2 }
            );
        }

        const canPlaceChest = (x: number, y: number) => {
            if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return false;
            if (Math.abs(x - centerX) <= safeRadius + 1 && Math.abs(y - centerY) <= safeRadius + 1) return false;
            if (this.tileMap.getTile('decoration', x, y) !== 0) return false;
            return this.tileMap.isWalkable(x, y);
        };

        if (chestVariants.length > 0) {
            const desiredChests = 10;
            const maxAttempts = desiredChests * 40;
            let placed = 0;

            for (let attempt = 0; attempt < maxAttempts && placed < desiredChests; attempt++) {
                const x = randInt(2, width - 3);
                const y = randInt(2, height - 3);
                if (!canPlaceChest(x, y)) continue;

                const variant = chestVariants[randInt(0, chestVariants.length - 1)];
                this.tileMap.setTile('decoration', x, y, variant.closedTileId);

                this.worldChests.push({
                    tileX: x,
                    tileY: y,
                    worldX: x * this.tileMap.tileSize + this.tileMap.tileSize / 2,
                    worldY: y * this.tileMap.tileSize + this.tileMap.tileSize / 2,
                    closedTileId: variant.closedTileId,
                    openTileId: variant.openTileId,
                    opened: false,
                    baseXpValue: variant.baseXpValue + randInt(0, 4),
                    powerUpChance: variant.powerUpChance
                });
                placed++;
            }
        }
    }

    _showLevelUpScreen() {
        this.showingLevelUp = true;
        this._pushDebugLog('level_up_screen_open', 'warn', {
            level: this.player?.level ?? null,
            xp: this.player?.xp ?? null,
            xpToNextLevel: this.player?.xpToNextLevel ?? null,
            gamePaused: this.game.paused
        });
        this.game.pause('level_up_screen');

        const options = this.upgradeSystem.generateOptions(3);
        this.levelUpScreen.show(options, (selected) => {
            this.upgradeSystem.applyUpgrade(selected as UpgradeOption);
            this.showingLevelUp = false;
            this._pushDebugLog('level_up_selection_applied', 'info', {
                selected,
                level: this.player?.level ?? null,
                xp: this.player?.xp ?? null,
                xpToNextLevel: this.player?.xpToNextLevel ?? null
            });
            this.game.resume('level_up_selection');
        });
    }

    _getNearestClosedChest(maxDistance: number) {
        if (!this.player || this.worldChests.length === 0) return null;

        let nearest: WorldChest | null = null;
        let nearestDistanceSq = maxDistance * maxDistance;

        for (const chest of this.worldChests) {
            if (chest.opened) continue;

            const dx = chest.worldX - this.player.x;
            const dy = chest.worldY - this.player.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq <= nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
                nearest = chest;
            }
        }

        return nearest;
    }

    _openChest(chest: WorldChest) {
        if (chest.opened) return;

        chest.opened = true;
        this.tileMap.setTile('decoration', chest.tileX, chest.tileY, chest.openTileId);

        let totalXp = 0;
        const gemCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < gemCount; i++) {
            const value = chest.baseXpValue + Math.floor(Math.random() * 4);
            totalXp += value;
            this.spawnSystem.spawnXPGem(chest.worldX, chest.worldY, value);
        }

        const dropMult = this.player && typeof this.player.getDropRateMultiplier === 'function'
            ? this.player.getDropRateMultiplier()
            : 1;
        const chestPowerUpChance = Math.min(0.85, chest.powerUpChance * dropMult);
        if (Math.random() < chestPowerUpChance) {
            this.spawnSystem.spawnPowerUp(chest.worldX, chest.worldY);
        }

        this.particleSystem.createHitEffect(chest.worldX, chest.worldY, '#ffd27a');
        this.particleSystem.createDamageNumber(chest.worldX, chest.worldY - 4, totalXp, '#ffd27a');
        this.camera.shake(2.5, 0.12);
    }

    _circleIntersectsTile(
        centerX: number,
        centerY: number,
        radius: number,
        tileX: number,
        tileY: number
    ) {
        const tileSize = this.tileMap.tileSize;
        const rectX = tileX * tileSize;
        const rectY = tileY * tileSize;

        const closestX = Math.max(rectX, Math.min(centerX, rectX + tileSize));
        const closestY = Math.max(rectY, Math.min(centerY, rectY + tileSize));

        const dx = centerX - closestX;
        const dy = centerY - closestY;
        return dx * dx + dy * dy < radius * radius;
    }

    _circleIntersectsBlockedTiles(centerX: number, centerY: number, radius: number) {
        const tileSize = this.tileMap.tileSize;
        const startX = Math.floor((centerX - radius) / tileSize);
        const endX = Math.floor((centerX + radius) / tileSize);
        const startY = Math.floor((centerY - radius) / tileSize);
        const endY = Math.floor((centerY + radius) / tileSize);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (this.tileMap.isWalkable(x, y)) continue;
                if (this._circleIntersectsTile(centerX, centerY, radius, x, y)) {
                    return true;
                }
            }
        }

        return false;
    }

    _setAxisVelocityZero(entity: TileCollisionEntity, axis: 'x' | 'y') {
        if (axis === 'x') {
            entity.vx = 0;
            if (typeof entity.knockbackVx === 'number') {
                entity.knockbackVx = 0;
            }
        } else {
            entity.vy = 0;
            if (typeof entity.knockbackVy === 'number') {
                entity.knockbackVy = 0;
            }
        }

        const movement = entity.getComponent<MovementComponent>('MovementComponent');
        if (!movement) return;
        if (axis === 'x') {
            movement.vx = 0;
        } else {
            movement.vy = 0;
        }
    }

    _resolveEntityTileCollision(entity: TileCollisionEntity, previousX: number, previousY: number) {
        const collider = entity.getComponent<ColliderComponent>('ColliderComponent');
        const offsetX = collider?.offsetX || 0;
        const offsetY = collider?.offsetY || 0;
        const radius = Math.max(
            4,
            (collider?.type === 'circle' ? collider.radius : this.tileMap.tileSize * 0.45) - 2
        );

        const targetX = entity.x;
        const targetY = entity.y;

        entity.x = targetX;
        if (this._circleIntersectsBlockedTiles(entity.x + offsetX, previousY + offsetY, radius)) {
            entity.x = previousX;
            this._setAxisVelocityZero(entity, 'x');
        }

        entity.y = targetY;
        if (this._circleIntersectsBlockedTiles(entity.x + offsetX, entity.y + offsetY, radius)) {
            entity.y = previousY;
            this._setAxisVelocityZero(entity, 'y');
        }
    }

    _drawChestPrompt(ctx: CanvasRenderingContext2D) {
        const chest = this.nearestChest;
        if (!chest || chest.opened) return;

        const label = 'E OPEN';
        const promptY = chest.worldY - this.tileMap.tileSize;

        ctx.save();
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const boxWidth = ctx.measureText(label).width + 12;
        const boxHeight = 15;
        const boxX = chest.worldX - boxWidth / 2;
        const boxY = promptY - boxHeight;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = 'rgba(255, 210, 122, 0.9)';
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);

        ctx.fillStyle = '#ffd27a';
        ctx.fillText(label, chest.worldX, boxY + boxHeight - 3);

        ctx.restore();
    }

    _tickEnemyContactCooldowns(deltaTime: number, enemies: Enemy[]) {
        const aliveEnemyIds = new Set<number>();
        for (const enemy of enemies) {
            if (!enemy.destroyed) {
                aliveEnemyIds.add(enemy.id);
            }
        }

        for (const [enemyId, cooldown] of this.enemyContactCooldowns.entries()) {
            if (!aliveEnemyIds.has(enemyId)) {
                this.enemyContactCooldowns.delete(enemyId);
                continue;
            }

            const remaining = cooldown - deltaTime;
            if (remaining <= 0) {
                this.enemyContactCooldowns.delete(enemyId);
            } else {
                this.enemyContactCooldowns.set(enemyId, remaining);
            }
        }
    }

    _resolvePlayerEnemyContact(enemy: Enemy) {
        if (enemy.destroyed) return;

        const initialDx = enemy.x - this.player.x;
        const initialDy = enemy.y - this.player.y;
        const initialDistance = Number((Math.sqrt(initialDx * initialDx + initialDy * initialDy) || 0).toFixed(2));
        const enemyContactCooldown = this.enemyContactCooldowns.get(enemy.id) || 0;
        if (enemyContactCooldown > 0) {
            if ((this.gameTime - this.lastContactGateLogTime) >= 0.35) {
                this.lastContactGateLogTime = this.gameTime;
                this._pushDebugLog('enemy_contact_skipped_enemy_cooldown', 'debug', {
                    enemyId: enemy.id,
                    enemyType: enemy.type || 'enemy',
                    distance: initialDistance,
                    cooldownRemaining: Number(enemyContactCooldown.toFixed(3))
                });
            }
            return;
        }
        if (this.playerSpawnInvulnerabilityTimer > 0) {
            if ((this.gameTime - this.lastContactGateLogTime) >= 0.35) {
                this.lastContactGateLogTime = this.gameTime;
                this._pushDebugLog('enemy_contact_skipped_spawn_invulnerability', 'debug', {
                    enemyId: enemy.id,
                    enemyType: enemy.type || 'enemy',
                    distance: initialDistance,
                    invulnerabilityRemaining: Number(this.playerSpawnInvulnerabilityTimer.toFixed(3))
                });
            }
            return;
        }

        const proximityDamage = this.player.getProximityAutoAttackDamage();
        const knockbackStrength = this.player.getProximityAutoAttackKnockback();
        const contactInterval = this.player.getProximityContactInterval();
        const playerCollider = this.player.getComponent<ColliderComponent>('ColliderComponent');
        const enemyCollider = enemy.getComponent<ColliderComponent>('ColliderComponent');
        const enemyHealth = enemy.getComponent<HealthComponent>('HealthComponent');
        const enemyHealthBefore = enemyHealth?.health ?? null;

        // Require meaningful overlap so "near misses" don't count as contact hits.
        if (
            playerCollider?.type === 'circle' &&
            enemyCollider?.type === 'circle'
        ) {
            const playerCenterX = this.player.x + playerCollider.offsetX;
            const playerCenterY = this.player.y + playerCollider.offsetY;
            const enemyCenterX = enemy.x + enemyCollider.offsetX;
            const enemyCenterY = enemy.y + enemyCollider.offsetY;
            const dx = enemyCenterX - playerCenterX;
            const dy = enemyCenterY - playerCenterY;
            const contactRadius = Math.max(6, playerCollider.radius + enemyCollider.radius - 6);

            if ((dx * dx + dy * dy) > (contactRadius * contactRadius)) {
                if ((this.gameTime - this.lastContactGateLogTime) >= 0.35) {
                    this.lastContactGateLogTime = this.gameTime;
                    this._pushDebugLog('enemy_contact_overlap_rejected', 'debug', {
                        enemyId: enemy.id,
                        enemyType: enemy.type || 'enemy',
                        centerDistance: Number(Math.sqrt(dx * dx + dy * dy).toFixed(2)),
                        requiredContactRadius: Number(contactRadius.toFixed(2))
                    });
                }
                return;
            }
        }

        enemy.takeDamage(proximityDamage, this.player);
        this._pushDebugLog('enemy_proximity_attack_applied', 'info', {
            enemyId: enemy.id,
            enemyType: enemy.type || 'enemy',
            enemyDamage: enemy.damage,
            enemyHealthBefore,
            enemyHealthAfter: enemyHealth?.health ?? null,
            enemyDestroyed: enemy.destroyed,
            playerProximityDamage: proximityDamage,
            contactInterval,
            distance: initialDistance
        });

        if (!enemy.destroyed) {
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            enemy.applyKnockback((dx / dist) * knockbackStrength, (dy / dist) * knockbackStrength);

            const health = this.player.getComponent<HealthComponent>('HealthComponent');
            // Global hit-gate: swarms shouldn't apply full stacked damage in a single frame.
            if (
                this.playerContactDamageCooldown <= 0 &&
                health &&
                !health.isDead &&
                !health.invulnerable
            ) {
                const armorMult = this.player.getDamageTakenMultiplier();
                const incomingDamage = Math.max(1, Math.round(enemy.damage * armorMult));
                const healthBefore = health.health;
                const shieldBefore = this.player.getShield();
                const remainingDamage = this.player.absorbShieldDamage(incomingDamage);
                this.playerContactDamageCooldown = this.playerContactDamageInterval;

                if (remainingDamage > 0) {
                    health.takeDamage(remainingDamage, enemy);
                }

                const healthAfter = health.health;
                const shieldAfter = this.player.getShield();
                this.lastDamageSnapshot = {
                    time: this.gameTime,
                    amount: remainingDamage,
                    sourceType: enemy.type || 'enemy',
                    sourceId: enemy.id,
                    sourceX: enemy.x,
                    sourceY: enemy.y,
                    playerHealthAfter: healthAfter,
                    playerShieldAfter: shieldAfter
                };
                this._pushDebugLog(remainingDamage > 0 ? 'player_contact_damage_applied' : 'player_contact_damage_absorbed_by_shield', remainingDamage > 0 ? 'warn' : 'info', {
                    enemyId: enemy.id,
                    enemyType: enemy.type || 'enemy',
                    enemyDamage: enemy.damage,
                    armorMultiplier: Number(armorMult.toFixed(3)),
                    incomingDamage,
                    remainingDamage,
                    healthBefore,
                    healthAfter,
                    shieldBefore,
                    shieldAfter,
                    playerDamageCooldown: Number(this.playerContactDamageCooldown.toFixed(3)),
                    distance: Number(dist.toFixed(2))
                });

                if (health.isDead || healthAfter <= 0) {
                    this.deathDebugInfo = {
                        reason: 'enemy_contact',
                        sourceType: enemy.type || 'enemy',
                        sourceId: enemy.id,
                        incomingDamage,
                        healthBefore,
                        healthAfter,
                        shieldBefore,
                        shieldAfter,
                        playerX: this.player.x,
                        playerY: this.player.y,
                        time: this.gameTime
                    };
                    this._pushDebugLog('death_debug_enemy_contact_captured', 'error', this.deathDebugInfo);
                }
            } else if ((this.gameTime - this.lastContactGateLogTime) >= 0.35) {
                this.lastContactGateLogTime = this.gameTime;
                this._pushDebugLog('player_contact_damage_gated', 'debug', {
                    enemyId: enemy.id,
                    enemyType: enemy.type || 'enemy',
                    enemyDamage: enemy.damage,
                    playerDamageCooldown: Number(this.playerContactDamageCooldown.toFixed(3)),
                    healthPresent: !!health,
                    healthDead: health ? health.isDead : null,
                    healthInvulnerable: health ? health.invulnerable : null
                });
            }
        }

        this.enemyContactCooldowns.set(enemy.id, contactInterval);
    }

    _drawLowHealthVignette(ctx: CanvasRenderingContext2D) {
        const health = this.player?.getComponent<HealthComponent>('HealthComponent');
        if (!health || health.maxHealth <= 0) return;

        const healthRatio = health.health / health.maxHealth;
        if (healthRatio >= 0.4) return;

        const intensity = Math.max(0, Math.min(1, (0.4 - healthRatio) / 0.4));
        const pulse = 0.9 + Math.sin(this.gameTime * 6) * 0.1;
        const alpha = intensity * pulse;
        const width = this.game.canvas.width;
        const height = this.game.canvas.height;

        const gradient = ctx.createRadialGradient(
            width * 0.5,
            height * 0.5,
            Math.min(width, height) * 0.2,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.72
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.65, `rgba(95, 0, 0, ${0.2 * alpha})`);
        gradient.addColorStop(1, `rgba(95, 0, 0, ${0.6 * alpha})`);

        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    _validatePlayerState() {
        if (!this.player || this.player.destroyed) {
            this.deathDebugInfo = {
                reason: 'player_entity_missing',
                playerX: this.player?.x,
                playerY: this.player?.y,
                time: this.gameTime
            };
            this._emitGameOver(this._formatDeathMessage('The player entity vanished. Start again?'));
            return true;
        }

        if (!Number.isFinite(this.player.x) || !Number.isFinite(this.player.y)) {
            this.deathDebugInfo = {
                reason: 'player_position_invalid',
                playerX: this.player.x,
                playerY: this.player.y,
                time: this.gameTime
            };
            this._emitGameOver('Player position became invalid (NaN/Infinity). Start again?');
            return true;
        }

        const health = this.player.getComponent<HealthComponent>('HealthComponent');
        if (!health) {
            this.deathDebugInfo = {
                reason: 'player_health_component_missing',
                playerX: this.player.x,
                playerY: this.player.y,
                time: this.gameTime
            };
            this._emitGameOver('Player health component vanished. Start again?');
            return true;
        }

        if (health.isDead) {
            if (!this.deathDebugInfo) {
                this.deathDebugInfo = {
                    reason: 'health_component_dead',
                    sourceType: this.lastDamageSnapshot?.sourceType || 'unknown',
                    sourceId: this.lastDamageSnapshot?.sourceId ?? undefined,
                    incomingDamage: this.lastDamageSnapshot?.amount,
                    healthAfter: health.health,
                    shieldAfter: this.player.getShield(),
                    playerX: this.player.x,
                    playerY: this.player.y,
                    time: this.gameTime
                };
            }
            this._emitGameOver(this._formatDeathMessage('You were overwhelmed. Start again?'));
            return true;
        }

        return false;
    }

    _drawDebugOverlay(ctx: CanvasRenderingContext2D) {
        if (!this.debugOverlayEnabled) return;

        const health = this.player?.getComponent<HealthComponent>('HealthComponent');
        const shield = this.player?.getShield?.() ?? 0;
        const lines: string[] = [
            'Debug Overlay (F3)',
            `time=${this.gameTime.toFixed(2)} wave=${this.spawnSystem?.waveNumber ?? 0} enemies=${this.spawnSystem?.getEnemies().length ?? 0}`,
            `player=(${this.player ? this.player.x.toFixed(1) : 'n/a'}, ${this.player ? this.player.y.toFixed(1) : 'n/a'})`,
            `hp=${health ? `${Math.round(health.health)}/${Math.round(health.maxHealth)}` : 'missing'} shield=${Math.round(shield)}`,
            `flags: paused=${this.game.paused} over=${this.gameOverTriggered} levelup=${this.showingLevelUp}`
        ];

        if (this.lastDamageSnapshot) {
            lines.push(
                `last-hit: ${this.lastDamageSnapshot.sourceType}${this.lastDamageSnapshot.sourceId !== null ? `#${this.lastDamageSnapshot.sourceId}` : ''} dmg=${this.lastDamageSnapshot.amount} hpAfter=${Math.round(this.lastDamageSnapshot.playerHealthAfter)}`
            );
        }

        if (this.deathDebugInfo) {
            lines.push(`death: ${this._formatDeathDebug(this.deathDebugInfo)}`);
        }

        if (this.debugLog.length > 0) {
            lines.push('events:');
            for (const entry of this.debugLog.slice(-6)) {
                lines.push(`- ${entry}`);
            }
        }

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '12px monospace';

        const padding = 8;
        const lineHeight = 15;
        const width = Math.min(this.game.canvas.width - 20, 700);
        const height = padding * 2 + lines.length * lineHeight;
        const x = 10;
        const y = Math.max(10, this.game.canvas.height - height - 10);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

        ctx.fillStyle = '#d8f5ff';
        let textY = y + padding;
        for (const line of lines) {
            ctx.fillText(line, x + padding, textY);
            textY += lineHeight;
        }

        ctx.restore();
    }

    update(deltaTime: number) {
        // Update input (even if a level-up overlay is showing)
        this.inputManager.update();

        if (this.inputManager.isActionPressed('debugToggle')) {
            this.debugOverlayEnabled = !this.debugOverlayEnabled;
            this._pushDebugLog(`debug_overlay=${this.debugOverlayEnabled ? 'on' : 'off'}`, 'info');
        }

        if (this._validatePlayerState()) {
            return;
        }

        if (this.showingLevelUp) return;

        if (this.weaponShakeCooldown > 0) {
            this.weaponShakeCooldown -= deltaTime;
        }
        if (this.playerContactDamageCooldown > 0) {
            this.playerContactDamageCooldown = Math.max(0, this.playerContactDamageCooldown - deltaTime);
        }
        if (this.playerSpawnInvulnerabilityTimer > 0) {
            this.playerSpawnInvulnerabilityTimer = Math.max(0, this.playerSpawnInvulnerabilityTimer - deltaTime);
        }

        // Handle pause
        if (this.inputManager.isActionPressed('pause')) {
            const pauseNearestEnemy = this._getNearestEnemySnapshot(this.spawnSystem?.getEnemies?.() || []);
            this._pushDebugLog('pause_action_pressed', 'warn', {
                gamePausedBeforeToggle: this.game.paused,
                showingLevelUp: this.showingLevelUp,
                hasFocus: document.hasFocus(),
                pauseInput: this._getPauseInputSnapshot(),
                nearestEnemy: pauseNearestEnemy
            });
            if (this.game.paused) {
                eventBus.emit(GameEvents.GAME_RESUME);
            } else {
                eventBus.emit(GameEvents.GAME_PAUSE);
            }
        }

        if (this.hitstopTimer > 0) {
            this.hitstopTimer = Math.max(0, this.hitstopTimer - deltaTime);
            return;
        }

        this.gameTime += deltaTime;

        // Update player
        const playerPreviousX = this.player.x;
        const playerPreviousY = this.player.y;
        this.player.handleInput(this.inputManager);
        this.player.update(deltaTime);
        this._resolveEntityTileCollision(this.player, playerPreviousX, playerPreviousY);

        // Update spawn system (enemies and XP gems)
        const enemyPreviousPositions = new Map<number, { x: number; y: number }>();
        for (const enemy of this.spawnSystem.getEnemies()) {
            enemyPreviousPositions.set(enemy.id, { x: enemy.x, y: enemy.y });
        }
        this.spawnSystem.update(deltaTime);

        const enemies = this.spawnSystem.getEnemies();
        for (const enemy of enemies) {
            const previous = enemyPreviousPositions.get(enemy.id);
            if (previous) {
                this._resolveEntityTileCollision(enemy, previous.x, previous.y);
            }
        }
        this._tickEnemyContactCooldowns(deltaTime, enemies);
        this._trackEnemyProximity(enemies);

        this.nearestChest = this._getNearestClosedChest(this.chestInteractRange);
        if (this.nearestChest && this.inputManager.isActionPressed('interact')) {
            this._openChest(this.nearestChest);
            this.nearestChest = null;
        }

        // Check player-enemy collisions
        for (const enemy of enemies) {
            if (enemy.checkCollision(this.player)) {
                this._resolvePlayerEnemyContact(enemy);
            }
        }

        // Manual longsword slash (Space)
        if (this.inputManager.isActionPressed('jump')) {
        const longsword = this.player.getWeapon(Longsword);
        longsword?.trigger(enemies);
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

    draw(ctx: CanvasRenderingContext2D, alpha: number) {
        // Apply camera transform
        this.camera.applyTransform(ctx);

        // Draw tile map
        this.tileMap.draw(ctx, this.camera, this.gameTime);

        // Draw spawn system (enemies, XP gems)
        this.spawnSystem.draw(ctx, this.camera);

        // Draw player
        this.player.draw(ctx, this.camera);

        // Draw world-space prompts
        this._drawChestPrompt(ctx);

        // Draw particles
        this.particleSystem.draw(ctx);

        if (this.config.debug.showCollisionBoxes) {
            this.tileMap.drawCollisionDebug(ctx, this.camera);
        }

        // Reset camera transform for UI
        this.camera.resetTransform(ctx);

        this._drawLowHealthVignette(ctx);

        // Draw HUD
        this.hud.draw(ctx);

        this._drawDebugOverlay(ctx);

        // Draw level up screen if showing
        if (this.showingLevelUp) {
            this.levelUpScreen.draw(ctx);
        }
    }
}
