// File: src/config/GameConfig.ts

export const DefaultConfig = {
    window: {
        title: 'Darkmoon',
        width: 1280,
        height: 720,
        fullscreen: false,
        resizable: true,
        vsync: true
    },

    graphics: {
        targetFPS: 60,
        fpsLimitEnabled: true,
        renderScale: 1.0,
        showFPS: true,
        antiAliasing: true,
        postProcessingEnabled: false
    },

    world: {
        tileSize: 16,
        worldWidthTiles: 100,
        worldHeightTiles: 100,
        gravity: 980.0,
        terminalVelocity: 500.0
    },

    player: {
        startX: 800,  // Center of 1600px world
        startY: 800,
        width: 48,
        height: 48,
        speed: 150.0,
        jumpForce: 300.0,
        maxHealth: 150,
        maxStamina: 100,
        staminaRegenRate: 10.0,
        canDoubleJump: false,
        dashEnabled: true,
        dashSpeed: 300.0,
        dashDuration: 0.2,
        dashCooldown: 0.8,
        pickupRange: 50,
        invulnerabilityDuration: 0.75
    },

    camera: {
        followPlayer: true,
        followSmoothing: 0.15,
        zoom: 1.0,
        shakeEnabled: true,
        maxShakeIntensity: 5.0,
        boundsEnabled: true,
        minX: 0,
        minY: 0,
        maxX: 1600,
        maxY: 1600,
        deadZoneWidth: 100,
        deadZoneHeight: 100
    },

    physics: {
        useGravity: false, // Top-down game
        friction: 0.85,
        airResistance: 0.95,
        collisionEnabled: true,
        maxVelocityX: 500.0,
        maxVelocityY: 500.0
    },

    input: {
        keyboard: {
            moveUp: 'KeyW',
            moveDown: 'KeyS',
            moveLeft: 'KeyA',
            moveRight: 'KeyD',
            jump: 'Space',
            dash: 'ShiftLeft',
            interact: 'KeyE',
            attack: 'KeyJ',
            special: 'KeyK',
            pause: 'Escape',
            inventory: 'KeyI',
            map: 'KeyM'
        },
        mouse: {
            enabled: true,
            aimMode: true,
            sensitivity: 1.0
        },
        gamepad: {
            enabled: true,
            deadzone: 0.15,
            vibration: true
        }
    },

    audio: {
        masterVolume: 1.0,
        musicVolume: 0.7,
        sfxVolume: 0.8,
        ambientVolume: 0.5,
        muteOnFocusLost: true
    },

    debug: {
        enabled: true,
        showFPSCounter: true,
        showEntityCount: true,
        showCollisionBoxes: false,
        showTileGrid: false,
        showCameraBounds: false,
        showVelocityVectors: false,
        logLevel: 'info'
    },

    ui: {
        showHUD: true,
        showMinimap: false,
        minimapScale: 0.2,
        healthBarPosition: 'top_left',
        staminaBarPosition: 'top_left',
        inventorySlots: 20,
        hotbarSlots: 8,
        fontSizeDefault: 16,
        fontSizeTitle: 32,
        fontSizeSmall: 12
    },

    gameplay: {
        difficulty: 'normal',
        permadeath: false,
        autoSave: true,
        autoSaveInterval: 300.0,
        dayNightCycle: false,
        dayLength: 1200.0,
        weatherEnabled: false,
        enemySpawnRate: 1.0
    },

    particles: {
        maxParticles: 1000,
        defaultLifetime: 2.0,
        poolSize: 500,
        enabled: true
    },

    animation: {
        defaultFrameDuration: 0.1,
        interpolateMovement: true,
        spriteFlipEnabled: true
    },

    collisionLayers: {
        world: 1,
        player: 2,
        enemies: 4,
        items: 8,
        projectiles: 16
    },

    progression: {
        baseXPToLevel: 10,
        xpScaling: 1.5,
        healthRecoveryOnLevelUp: 20
    }
};

export type GameConfigData = typeof DefaultConfig;

export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

export class GameConfig {
    data: GameConfigData;

    constructor(config: DeepPartial<GameConfigData> = {}) {
        this.data = this._deepMerge(DefaultConfig, config);
    }

    _deepMerge<T extends Record<string, unknown>>(target: T, source: DeepPartial<T>): T {
        const result = { ...target };
        for (const key in source) {
            if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
            const sourceValue = source[key];
            const targetValue = target[key];
            if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                result[key] = this._deepMerge((targetValue || {}) as Record<string, unknown>, sourceValue as DeepPartial<Record<string, unknown>>) as T[Extract<keyof T, string>];
            } else if (sourceValue !== undefined) {
                result[key] = sourceValue as T[Extract<keyof T, string>];
            }
        }
        return result as T;
    }

    get(path: string): unknown {
        const keys = path.split('.');
        let current: unknown = this.data as Record<string, unknown>;
        for (const key of keys) {
            if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
                current = (current as Record<string, unknown>)[key];
            } else {
                return undefined;
            }
        }
        return current;
    }

    set(path: string, value: unknown) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        if (!lastKey) return;
        let target = this.data as Record<string, unknown>;
        for (const key of keys) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key] as Record<string, unknown>;
        }
        target[lastKey] = value;
    }

    // Convenience getters
    get window() { return this.data.window; }
    get graphics() { return this.data.graphics; }
    get world() { return this.data.world; }
    get player() { return this.data.player; }
    get camera() { return this.data.camera; }
    get physics() { return this.data.physics; }
    get input() { return this.data.input; }
    get audio() { return this.data.audio; }
    get debug() { return this.data.debug; }
    get ui() { return this.data.ui; }
    get gameplay() { return this.data.gameplay; }
    get particles() { return this.data.particles; }
    get animation() { return this.data.animation; }
    get collisionLayers() { return this.data.collisionLayers; }
    get progression() { return this.data.progression; }

    // World dimensions in pixels
    get worldWidth() {
        return this.data.world.worldWidthTiles * this.data.world.tileSize;
    }

    get worldHeight() {
        return this.data.world.worldHeightTiles * this.data.world.tileSize;
    }
}
