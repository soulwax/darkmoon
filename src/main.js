// File: src/main.js
// Entry point for Darkmoon game

import { Game } from './Game.js';
import { ConfigLoader } from './config/ConfigLoader.js';
import { GameConfig } from './config/GameConfig.js';
import { eventBus, GameEvents } from './core/EventBus.js';
import { assetLoader } from './assets/AssetLoader.js';
import { CoreAssetManifest } from './assets/AssetManifest.js';
import { SceneManager } from './scenes/SceneManager.js';
import { GameScene } from './scenes/GameScene.js';

class Application {
    constructor() {
        this.game = null;
        this.config = null;
        this.sceneManager = null;
    }

    async init() {
        console.log('Darkmoon initializing...');

        // Make asset/config fetches base-aware (Vite base "./" builds)
        assetLoader.setBasePath(import.meta.env.BASE_URL);

        // Load configuration
        try {
            this.config = await ConfigLoader.loadGameConfig('game.yaml');
            console.log('Configuration loaded');
        } catch (error) {
            console.warn('Using default configuration:', error.message);
            this.config = new GameConfig();
        }

        // Get canvas
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        // Load assets
        try {
            await assetLoader.loadManifest(CoreAssetManifest);
            console.log('Assets loaded');
        } catch (error) {
            console.warn('Some assets failed to load:', error.message);
        }

        // Create game instance
        this.game = new Game(canvas, this.config);

        // Create scene manager
        this.sceneManager = new SceneManager(this.game);

        // Register scenes
        const gameScene = new GameScene(this.game, this.config, assetLoader);
        this.sceneManager.register('game', gameScene);

        // Initialize game with systems
        await this.game.init({
            assetLoader: assetLoader,
            inputManager: null, // Managed by GameScene
            camera: null,       // Managed by GameScene
            renderer: null,
            sceneManager: this.sceneManager
        });

        // Setup UI event handlers
        this.setupUI();

        // Debug/dev convenience: auto-start game via URL param (?autostart=1)
        const params = new URLSearchParams(window.location.search);
        if (params.has('autostart')) {
            this.hideMenu();
            this.startGame();
        }

        console.log('Darkmoon ready!');
    }

    setupUI() {
        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.hideMenu();
                this.startGame();
            });
        }

        // Restart button
        const restartButton = document.getElementById('restartButton');
        if (restartButton) {
            restartButton.addEventListener('click', () => {
                this.hideGameOver();
                this.startGame();
            });
        }

        // Listen for game over
        eventBus.on(GameEvents.GAME_OVER, (data) => {
            this.showGameOver(data);
        });
    }

    startGame() {
        // Switch to game scene
        this.sceneManager.switchTo('game', {}, true);

        // Start game loop
        eventBus.emit(GameEvents.GAME_START);
    }

    hideMenu() {
        const menu = document.getElementById('startScreen');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    showMenu() {
        const menu = document.getElementById('startScreen');
        if (menu) {
            menu.style.display = 'flex';
        }
    }

    hideGameOver() {
        const gameOver = document.getElementById('gameOverScreen');
        if (gameOver) {
            gameOver.style.display = 'none';
        }
    }

    showGameOver(data = {}) {
        const gameOver = document.getElementById('gameOverScreen');
        if (gameOver) {
            gameOver.classList.remove('hidden');
            gameOver.style.display = 'flex';

            // Update stats
            const timeEl = document.getElementById('finalTime');
            const killsEl = document.getElementById('finalKills');

            if (timeEl && data.time !== undefined) {
                const minutes = Math.floor(data.time / 60);
                const seconds = Math.floor(data.time % 60);
                timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            if (killsEl && data.kills !== undefined) {
                killsEl.textContent = data.kills.toString();
            }
        }
    }
}

// Bootstrap application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new Application();
    try {
        await app.init();
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});

// Export for debugging
window.DarkmoonApp = Application;
