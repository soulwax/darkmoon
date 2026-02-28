// File: src/Game.ts

import type { AssetLoader } from './assets/AssetLoader';
import { GameConfig } from './config/GameConfig';
import { eventBus, GameEvents } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import type { Camera } from './graphics/Camera';
import type { Renderer } from './graphics/Renderer';
import type { InputManager } from './input/InputManager';
import type { SceneManager } from './scenes/SceneManager';

export interface GameSystems {
    assetLoader: AssetLoader | null;
    inputManager: InputManager | null;
    camera: Camera | null;
    renderer: Renderer | null;
    sceneManager: SceneManager | null;
}

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    config: GameConfig;
    eventBus: typeof eventBus;
    running: boolean;
    gameOver: boolean;
    killCount: number;
    assetLoader: AssetLoader | null;
    inputManager: InputManager | null;
    camera: Camera | null;
    renderer: Renderer | null;
    sceneManager: SceneManager | null;
    gameLoop: GameLoop;

    constructor(canvas: HTMLCanvasElement, config: GameConfig) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to acquire 2D rendering context');
        }
        this.ctx = ctx;
        // Pixel art rendering: prevent interpolation artifacts (tile seams, blurry sprites)
        this.ctx.imageSmoothingEnabled = false;
        this.config = config;
        this.eventBus = eventBus;

        // Set canvas size from config
        this.canvas.width = config.window.width;
        this.canvas.height = config.window.height;

        // Game state
        this.running = false;
        this.gameOver = false;

        // Statistics
        this.killCount = 0;

        // Systems (will be initialized in init())
        this.assetLoader = null;
        this.inputManager = null;
        this.camera = null;
        this.renderer = null;
        this.sceneManager = null;

        // Game loop
        this.gameLoop = new GameLoop({
            targetFPS: config.graphics.targetFPS,
            update: (dt) => this.update(dt),
            draw: (alpha) => this.draw(alpha)
        });

        // Bind event handlers
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Game state events
        this.eventBus.on(GameEvents.GAME_START, () => this.start());
        this.eventBus.on(GameEvents.GAME_RESTART, () => this.restart());
        this.eventBus.on(GameEvents.GAME_OVER, () => this.endGame());

        // Track kills
        this.eventBus.on(GameEvents.ENEMY_KILLED, () => {
            this.killCount++;
        });

    }

    /**
     * Initialize all game systems
     * @param {Object} systems - Initialized system instances
     */
    async init(systems: GameSystems) {
        this.assetLoader = systems.assetLoader;
        this.inputManager = systems.inputManager;
        this.camera = systems.camera;
        this.renderer = systems.renderer;
        this.sceneManager = systems.sceneManager;

        console.log('Game initialized');
    }

    /**
     * Start the game
     */
    start() {
        this.running = true;
        this.gameOver = false;
        this.killCount = 0;
        this.gameLoop.resetGameTime();

        // If the loop is already running (e.g. after a game over), resume it.
        // Otherwise start it fresh.
        if (this.gameLoop.isRunning()) {
            this.gameLoop.resume();
        } else {
            this.gameLoop.start();
        }

        console.log('Game started');
    }

    /**
     * Restart the game
     */
    restart() {
        this.killCount = 0;
        this.gameOver = false;
        this.running = true;
        this.gameLoop.resetGameTime();

        // Reset current scene
        if (this.sceneManager) {
            if (this.sceneManager.getCurrent()) {
                this.sceneManager.restart();
            } else {
                this.sceneManager.switchTo('game', {}, true, 'wipe');
            }
        }

        if (this.gameLoop.isRunning()) {
            this.gameLoop.resume();
        } else {
            this.gameLoop.start();
        }
        console.log('Game restarted');
    }

    /**
     * End the game (game over)
     */
    endGame() {
        this.gameOver = true;
        this.running = false;
        this.gameLoop.pause();

        console.log('Game over');
    }

    /**
     * Main update loop
     * @param {number} deltaTime - Fixed timestep delta
     */
    update(deltaTime: number) {
        if (this.gameOver) return;

        // Update input manager
        if (this.inputManager) {
            this.inputManager.update();
        }

        // Update current scene
        if (this.sceneManager) {
            this.sceneManager.update(deltaTime);
        }
    }

    /**
     * Main draw loop
     * @param {number} alpha - Interpolation alpha for smooth rendering
     */
    draw(alpha: number) {
        // Ensure smoothing stays off even if other code toggles it.
        this.ctx.imageSmoothingEnabled = false;
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera transform
        if (this.camera) {
            this.camera.applyTransform(this.ctx);
        }

        // Draw current scene
        if (this.sceneManager) {
            this.sceneManager.draw(this.ctx, alpha);
        }

        // Reset camera transform for UI
        if (this.camera) {
            this.camera.resetTransform(this.ctx);
        }

        // Draw debug info
        if (this.config.debug.showFPSCounter) {
            this.drawDebugInfo();
        }
    }

    /**
     * Draw debug information
     */
    drawDebugInfo() {
        const fps = this.gameLoop.getFPS();
        const gameTime = this.gameLoop.getGameTime();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`FPS: ${fps}`, this.canvas.width - 10, 20);
        this.ctx.fillText(`Time: ${gameTime.toFixed(1)}s`, this.canvas.width - 10, 38);
        this.ctx.fillText(`Kills: ${this.killCount}`, this.canvas.width - 10, 56);
        this.ctx.textAlign = 'left';
    }

    /**
     * Get current game time
     */
    getGameTime() {
        return this.gameLoop.getGameTime();
    }

    /**
     * Returns true while the game is in an active / play state.
     * Note: This may be true even if the game loop is internally paused.
     */
    isActive() {
        return this.running && !this.gameOver;
    }

    /**
     * Check if game is running.
     *
     * @deprecated Use {@link isActive} instead. This method now returns true
     * even when the game loop may be paused internally.
     */
    isRunning() {
        return this.isActive();
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.gameLoop.stop();
        this.eventBus.clear();

        if (this.inputManager) {
            this.inputManager.destroy();
        }
    }
}
