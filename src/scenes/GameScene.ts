// File: src/scenes/GameScene.js
// Main gameplay scene

import { Scene } from './Scene';
import { Player } from '../entities/Player';
import { Camera } from '../graphics/Camera';
import { TileMap } from '../graphics/TileMap';
import { InputManager } from '../input/InputManager';
import { SpawnSystem } from '../systems/SpawnSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { MagicOrbs } from '../weapons/MagicOrbs';
import { MagicMissiles } from '../weapons/MagicMissiles';
import { LightningStrike } from '../weapons/LightningStrike';
import { Sword } from '../weapons/Sword';
import { Longsword } from '../weapons/Longsword';
import { eventBus, GameEvents } from '../core/EventBus';
import { HUD } from '../ui/HUD';
import { LevelUpScreen } from '../ui/LevelUpScreen';
import type { Game } from '../Game';
import type { GameConfig } from '../config/GameConfig';
import type { AssetLoader } from '../assets/AssetLoader';
import type { SpriteSheet } from '../assets/SpriteSheet';
import type { Weapon } from '../weapons/Weapon';
import type { PlayerStats } from '../entities/Player';
import type { HealthComponent } from '../ecs/components/HealthComponent';

type WeaponClass = new (owner: Player, options?: Record<string, unknown>) => Weapon;

type UpgradeOption =
    | { type: 'weapon'; weaponClass: WeaponClass; name: string; description: string; icon: string }
    | { type: 'upgrade'; weapon: Weapon; name: string; description: string; icon: string }
    | { type: 'stat'; stat: keyof PlayerStats; value: number; name: string; description: string; icon: string };

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
    showingLevelUp: boolean;
    gameTime: number;
    killCount: number;

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

        this._setupEventListeners();
    }

    _setupEventListeners() {
        eventBus.on(GameEvents.PLAYER_LEVELUP, (data: { player: Player; level: number; xpToNext: number }) => {
            this._showLevelUpScreen();
        });

        eventBus.on(GameEvents.ENEMY_KILLED, () => {
            this.killCount++;
        });

        eventBus.on(GameEvents.XP_COLLECTED, (data: { value: number; x: number; y: number }) => {
            if (this.player) {
                this.player.gainXP(data.value);
            }
            this.particleSystem?.createXPParticles(data.x, data.y);
        });

        eventBus.on(GameEvents.ENEMY_DAMAGED, (data: { enemy: { x: number; y: number }; amount: number }) => {
            this.particleSystem?.createHitEffect(data.enemy.x, data.enemy.y, '#fff');
            this.particleSystem?.createDamageNumber(data.enemy.x, data.enemy.y, data.amount, '#fff');
        });

        eventBus.on(GameEvents.PLAYER_DAMAGED, () => {
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
        if (!this.tileMap) return;
        const width = this.config.world.worldWidthTiles;
        const height = this.config.world.worldHeightTiles;

        this.tileMap.init(width, height);

        // --- Sprite sheets ---
        const sheets: Record<string, SpriteSheet | null> = {
            grass: this.assetLoader?.getSpriteSheet?.('grass') || null,
            water: this.assetLoader?.getSpriteSheet?.('water') || null,
            dirtGrass: this.assetLoader?.getSpriteSheet?.('dirtGrass') || null,
            decorGrass: this.assetLoader?.getSpriteSheet?.('decorGrass') || null,
            flowers: this.assetLoader?.getSpriteSheet?.('flowers') || null,
            shrooms: this.assetLoader?.getSpriteSheet?.('shrooms') || null,
            objects: this.assetLoader?.getSpriteSheet?.('objects') || null,
            rockInWater: this.assetLoader?.getSpriteSheet?.('rockInWater') || null
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

            rockInWater: 110
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
        const options: UpgradeOption[] = [];
        const weapons: Array<{ class: WeaponClass; name: string; desc: string; icon: string }> = [
            { class: Sword, name: 'Sword', desc: 'Melee swing with knockback', icon: '🗡️' },
            { class: MagicOrbs, name: 'Magic Orbs', desc: 'Rotating orbs damage nearby enemies', icon: '🔮' },
            { class: MagicMissiles, name: 'Magic Missiles', desc: 'Auto-targeting projectiles', icon: '✨' },
            { class: LightningStrike, name: 'Lightning Strike', desc: 'Area lightning attacks', icon: '⚡' }
        ];

        // Add new weapons player doesn't have
        for (const weapon of weapons) {
            if (!this.player.hasWeapon(weapon.class)) {
                options.push({
                    type: 'weapon',
                    weaponClass: weapon.class,
                    name: `New: ${weapon.name}`,
                    description: weapon.desc,
                    icon: weapon.icon || '⚔️'
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
        const stats: Array<{ stat: keyof PlayerStats; name: string; desc: string; value: number; icon: string }> = [
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

    _applyUpgrade(option: UpgradeOption) {
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

    update(deltaTime: number) {
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
                const health = this.player.getComponent<HealthComponent>('HealthComponent');
                if (health && !health.invulnerable) {
                    health.takeDamage(enemy.damage * deltaTime * 2);
                }
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
        // Debug: Draw a test rectangle before camera transform to verify canvas works
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(10, 10, 50, 50);

        // Apply camera transform
        this.camera.applyTransform(ctx);

        // Debug: Draw a rectangle at world origin to verify camera transform
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(0, 0, 100, 100);

        // Debug: Draw a rectangle at player position
        if (this.player) {
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(this.player.x - 25, this.player.y - 25, 50, 50);
        }

        // Draw tile map
        this.tileMap.draw(ctx, this.camera, this.gameTime);

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

        // Debug info overlay
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Player: ${Math.round(this.player?.x || 0)}, ${Math.round(this.player?.y || 0)}`, 10, 100);
        ctx.fillText(`Camera: ${Math.round(this.camera?.position?.x || 0)}, ${Math.round(this.camera?.position?.y || 0)}`, 10, 118);
        ctx.fillText(`TileMap: ${this.tileMap?.width || 0}x${this.tileMap?.height || 0} tiles`, 10, 136);
        ctx.fillText(`Sprites loaded: ${this.tileMap?.spriteSheets?.size || 0}`, 10, 154);

        // Draw level up screen if showing
        if (this.showingLevelUp) {
            this.levelUpScreen.draw(ctx);
        }
    }
}

