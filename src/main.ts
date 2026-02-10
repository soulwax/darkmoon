// File: src/main.ts

import { Game } from './Game';
import { ConfigLoader } from './config/ConfigLoader';
import { GameConfig } from './config/GameConfig';
import { eventBus, GameEvents } from './core/EventBus';
import { assetLoader } from './assets/AssetLoader';
import { CoreAssetManifest } from './assets/AssetManifest';
import { SceneManager } from './scenes/SceneManager';
import { GameScene } from './scenes/GameScene';
import { AudioSystem } from './audio/AudioSystem';

interface GameOverData {
    time?: number;
    kills?: number;
    level?: number;
    message?: string;
}

class Application {
    game: Game | null;
    config: GameConfig | null;
    sceneManager: SceneManager | null;
    audioSystem: AudioSystem | null;

    constructor() {
        this.game = null;
        this.config = null;
        this.sceneManager = null;
        this.audioSystem = null;
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
            const message = error instanceof Error ? error.message : String(error);
            console.warn('Using default configuration:', message);
            this.config = new GameConfig();
        }

        // Get canvas
        const canvas = document.getElementById('gameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Canvas element not found');
        }

        // Load assets
        try {
            await assetLoader.loadManifest(CoreAssetManifest);
            console.log('Assets loaded');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('Some assets failed to load:', message);
        }

        if (!this.config) {
            this.config = new GameConfig();
        }

        // Setup procedural audio engine and gameplay SFX hooks.
        this.audioSystem = new AudioSystem(this.config.audio);

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
        const unlockAudio = () => {
            void this.audioSystem?.unlock();
        };

        window.addEventListener('pointerdown', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });

        const restartFromGameOver = () => {
            this.audioSystem?.playUiSelect();
            void this.audioSystem?.unlock();
            this.hideGameOver();
            eventBus.emit(GameEvents.GAME_RESTART);
        };

        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.audioSystem?.playUiSelect();
                void this.audioSystem?.unlock();
                this.hideMenu();
                this.startGame();
            });
        }

        // Restart button
        const restartButton = document.getElementById('restartButton');
        if (restartButton) {
            restartButton.addEventListener('click', restartFromGameOver);
        }

        // In-game restart button
        const hudRestartButton = document.getElementById('hudRestartButton');
        if (hudRestartButton) {
            hudRestartButton.addEventListener('click', restartFromGameOver);
        }

        // Listen for game over
        eventBus.on(GameEvents.GAME_OVER, (data: GameOverData) => {
            this.showGameOver(data);
        });

        // Allow keyboard restart directly from death screen.
        window.addEventListener('keydown', (e) => {
            if (!this.isGameOverVisible()) return;
            if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                restartFromGameOver();
            }
        });
    }

    startGame() {
        void this.audioSystem?.unlock();

        // Switch to game scene
        this.sceneManager?.switchTo('game', {}, true);

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

    isGameOverVisible() {
        const gameOver = document.getElementById('gameOverScreen');
        if (!gameOver) return false;
        return gameOver.style.display === 'flex' && !gameOver.classList.contains('hidden');
    }

    showGameOver(data: GameOverData = {}) {
        const gameOver = document.getElementById('gameOverScreen');
        if (gameOver) {
            gameOver.classList.remove('hidden');
            gameOver.style.display = 'flex';

            // Update stats
            const timeEl = document.getElementById('finalTime');
            const killsEl = document.getElementById('finalKills');
            const levelEl = document.getElementById('finalLevel');
            const messageEl = document.getElementById('deathMessage');

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

            if (messageEl) {
                messageEl.textContent = data.message || 'You died.';
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
