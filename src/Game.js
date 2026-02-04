// File: src/Game.js
// Main game orchestrator

import { GameLoop } from './core/GameLoop.js';
import { eventBus, GameEvents } from './core/EventBus.js';
import { GameConfig } from './config/GameConfig.js';

export class Game {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = config;
        this.eventBus = eventBus;

        // Set canvas size from config
        this.canvas.width = config.window.width;
        this.canvas.height = config.window.height;

        // Game state
        this.running = false;
        this.paused = false;
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
        this.eventBus.on(GameEvents.GAME_PAUSE, () => this.pause());
        this.eventBus.on(GameEvents.GAME_RESUME, () => this.resume());
        this.eventBus.on(GameEvents.GAME_RESTART, () => this.restart());
        this.eventBus.on(GameEvents.GAME_OVER, () => this.endGame());

        // Track kills
        this.eventBus.on(GameEvents.ENEMY_KILLED, () => {
            this.killCount++;
        });

        // Window focus handling
        window.addEventListener('blur', () => {
            if (this.running && !this.gameOver) {
                this.pause();
            }
        });
    }

    /**
     * Initialize all game systems
     * @param {Object} systems - Initialized system instances
     */
    async init(systems) {
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
        this.paused = false;
        this.gameOver = false;
        this.killCount = 0;
        this.gameLoop.resetGameTime();
        this.gameLoop.start();

        console.log('Game started');
    }

    /**
     * Pause the game
     */
    pause() {
        if (!this.running || this.gameOver) return;
        this.paused = true;
        this.gameLoop.pause();
        this.eventBus.emit(GameEvents.GAME_PAUSE);

        console.log('Game paused');
    }

    /**
     * Resume the game
     */
    resume() {
        if (!this.paused) return;
        this.paused = false;
        this.gameLoop.resume();
        this.eventBus.emit(GameEvents.GAME_RESUME);

        console.log('Game resumed');
    }

    /**
     * Restart the game
     */
    restart() {
        this.killCount = 0;
        this.gameOver = false;
        this.paused = false;
        this.gameLoop.resetGameTime();

        // Reset current scene
        if (this.sceneManager) {
            this.sceneManager.restart();
        }

        this.resume();
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
    update(deltaTime) {
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
    draw(alpha) {
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
     * Check if game is running
     */
    isRunning() {
        return this.running && !this.paused && !this.gameOver;
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
