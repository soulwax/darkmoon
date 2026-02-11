// File: src/main.ts

import { Game } from './Game';
import { assetLoader } from './assets/AssetLoader';
import { CoreAssetManifest } from './assets/AssetManifest';
import { AudioSystem } from './audio/AudioSystem';
import { ProceduralAudioSystem } from './audio/ProceduralAudioSystem';
import { ConfigLoader } from './config/ConfigLoader';
import { GameConfig } from './config/GameConfig';
import { eventBus, GameEvents } from './core/EventBus';
import { GameScene } from './scenes/GameScene';
import { SceneManager } from './scenes/SceneManager';

interface GameOverData {
    time?: number;
    kills?: number;
    level?: number;
    damageDealt?: number;
    gemsCollected?: number;
    message?: string;
}

type AudioMode = 'authored' | 'procedural';

interface AudioSettingsLike {
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
}

interface AudioBackend {
    unlock(): Promise<boolean> | boolean;
    destroy(): void;
    setEnabled(enabled: boolean): void;
    setVolumes(settings: AudioSettingsLike): void;
    playUiSelect(): void;
}

interface AudioPreferences extends AudioSettingsLike {
    mode: AudioMode;
    enabled: boolean;
}

const AUDIO_PREFS_STORAGE_KEY = 'darkmoon.audio.preferences.v1';

class Application {
    game: Game | null;
    config: GameConfig | null;
    sceneManager: SceneManager | null;
    audioSystem: AudioBackend | null;
    audioPreferences: AudioPreferences;

    constructor() {
        this.game = null;
        this.config = null;
        this.sceneManager = null;
        this.audioSystem = null;
        this.audioPreferences = {
            mode: 'authored',
            enabled: true,
            masterVolume: 0.8,
            musicVolume: 0.35,
            sfxVolume: 0.85
        };
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

        this.audioPreferences = this.loadAudioPreferences(this.config.audio);
        this.audioSystem = this.createAudioSystem(this.audioPreferences.mode, this.audioPreferences);
        this.audioSystem.setEnabled(this.audioPreferences.enabled);
        this.audioSystem.setVolumes(this.audioPreferences);

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

    createAudioSystem(mode: AudioMode, settings: AudioSettingsLike): AudioBackend {
        if (mode === 'procedural') {
            return new ProceduralAudioSystem(settings);
        }
        return new AudioSystem(settings);
    }

    loadAudioPreferences(configAudio: AudioSettingsLike): AudioPreferences {
        const defaults: AudioPreferences = {
            mode: 'authored',
            enabled: true,
            masterVolume: configAudio.masterVolume ?? 0.8,
            musicVolume: configAudio.musicVolume ?? 0.35,
            sfxVolume: configAudio.sfxVolume ?? 0.85
        };

        try {
            const raw = localStorage.getItem(AUDIO_PREFS_STORAGE_KEY);
            if (!raw) return defaults;
            const parsed = JSON.parse(raw) as Partial<AudioPreferences>;

            const mode: AudioMode = parsed.mode === 'procedural' ? 'procedural' : 'authored';
            const enabled = parsed.enabled !== false;
            const masterVolume = typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : defaults.masterVolume;
            const musicVolume = typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : defaults.musicVolume;
            const sfxVolume = typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : defaults.sfxVolume;

            return { mode, enabled, masterVolume, musicVolume, sfxVolume };
        } catch {
            return defaults;
        }
    }

    saveAudioPreferences() {
        try {
            localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(this.audioPreferences));
        } catch {
            // Ignore storage quota/private mode errors.
        }
    }

    applyAudioPreferences(recreateSystem: boolean = false) {
        if (!this.audioSystem || recreateSystem) {
            this.audioSystem?.destroy();
            this.audioSystem = this.createAudioSystem(this.audioPreferences.mode, this.audioPreferences);
        }

        this.audioSystem.setEnabled(this.audioPreferences.enabled);
        this.audioSystem.setVolumes(this.audioPreferences);
        this.saveAudioPreferences();

        if (this.audioPreferences.enabled) {
            void this.audioSystem.unlock();
        }
    }

    setupUI() {
        const unlockAudio = () => {
            void this.audioSystem?.unlock();
        };

        window.addEventListener('pointerdown', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });

        const restartGame = () => {
            this.audioSystem?.playUiSelect();
            void this.audioSystem?.unlock();
            this.hidePauseOverlay();
            this.hideGameOver();
            this.hideMenu();
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
            restartButton.addEventListener('click', restartGame);
        }

        // Listen for game over
        eventBus.on(GameEvents.GAME_OVER, (data: GameOverData) => {
            this.hidePauseOverlay();
            this.showGameOver(data);
        });

        // Pause overlay controls
        const pauseResumeButton = document.getElementById('pauseResumeButton');
        if (pauseResumeButton) {
            pauseResumeButton.addEventListener('click', () => {
                this.audioSystem?.playUiSelect();
                eventBus.emit(GameEvents.GAME_RESUME);
            });
        }

        eventBus.on(GameEvents.GAME_PAUSE, () => {
            this.showPauseOverlay();
        });

        eventBus.on(GameEvents.GAME_RESUME, () => {
            this.hidePauseOverlay();
        });

        eventBus.on(GameEvents.GAME_START, () => {
            this.hidePauseOverlay();
        });

        eventBus.on(GameEvents.GAME_RESTART, () => {
            this.hidePauseOverlay();
            this.hideGameOver();
        });

        // Allow keyboard restart directly from death screen.
        window.addEventListener('keydown', (e) => {
            if (!this.isGameOverVisible()) return;
            if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                restartGame();
            }
        });

        // Resume from pause even when gameplay loop is paused.
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.game?.paused) {
                e.preventDefault();
                eventBus.emit(GameEvents.GAME_RESUME);
            }
        });

        this.setupAudioOptionsUI();
    }

    setupAudioOptionsUI() {
        const openButton = document.getElementById('audioOptionsButton');
        const startOpenButton = document.getElementById('startAudioOptionsButton');
        const optionsScreen = document.getElementById('audioOptionsScreen');
        const closeButton = document.getElementById('audioOptionsCloseButton');
        const backendSelect = document.getElementById('audioBackendSelect');
        const enabledToggle = document.getElementById('audioEnabledToggle');
        const masterRange = document.getElementById('audioMasterVolume');
        const musicRange = document.getElementById('audioMusicVolume');
        const sfxRange = document.getElementById('audioSfxVolume');
        const masterValue = document.getElementById('audioMasterVolumeValue');
        const musicValue = document.getElementById('audioMusicVolumeValue');
        const sfxValue = document.getElementById('audioSfxVolumeValue');

        if (
            !(optionsScreen instanceof HTMLDivElement) ||
            !(backendSelect instanceof HTMLSelectElement) ||
            !(enabledToggle instanceof HTMLInputElement) ||
            !(masterRange instanceof HTMLInputElement) ||
            !(musicRange instanceof HTMLInputElement) ||
            !(sfxRange instanceof HTMLInputElement)
        ) {
            return;
        }

        const close = () => {
            optionsScreen.classList.add('hidden');
            optionsScreen.style.display = 'none';
        };

        const open = () => {
            this.audioSystem?.playUiSelect();
            void this.audioSystem?.unlock();
            optionsScreen.classList.remove('hidden');
            optionsScreen.style.display = 'flex';
        };

        const syncValues = () => {
            backendSelect.value = this.audioPreferences.mode;
            enabledToggle.checked = this.audioPreferences.enabled;

            const master = Math.round((this.audioPreferences.masterVolume ?? 0.8) * 100);
            const music = Math.round((this.audioPreferences.musicVolume ?? 0.35) * 100);
            const sfx = Math.round((this.audioPreferences.sfxVolume ?? 0.85) * 100);

            masterRange.value = master.toString();
            musicRange.value = music.toString();
            sfxRange.value = sfx.toString();

            if (masterValue) masterValue.textContent = `${master}%`;
            if (musicValue) musicValue.textContent = `${music}%`;
            if (sfxValue) sfxValue.textContent = `${sfx}%`;
        };

        const applyFromInputs = (recreateSystem: boolean = false) => {
            this.audioPreferences.mode = backendSelect.value === 'procedural' ? 'procedural' : 'authored';
            this.audioPreferences.enabled = enabledToggle.checked;
            this.audioPreferences.masterVolume = Number(masterRange.value) / 100;
            this.audioPreferences.musicVolume = Number(musicRange.value) / 100;
            this.audioPreferences.sfxVolume = Number(sfxRange.value) / 100;

            this.applyAudioPreferences(recreateSystem);
            syncValues();
        };

        syncValues();

        if (openButton) {
            openButton.addEventListener('click', open);
        }
        if (startOpenButton) {
            startOpenButton.addEventListener('click', open);
        }
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.audioSystem?.playUiSelect();
                close();
            });
        }

        optionsScreen.addEventListener('click', (e) => {
            if (e.target === optionsScreen) close();
        });

        backendSelect.addEventListener('change', () => {
            this.audioSystem?.playUiSelect();
            applyFromInputs(true);
        });

        enabledToggle.addEventListener('change', () => {
            this.audioSystem?.playUiSelect();
            applyFromInputs(false);
        });

        const onRangeInput = () => {
            applyFromInputs(false);
        };

        masterRange.addEventListener('input', onRangeInput);
        musicRange.addEventListener('input', onRangeInput);
        sfxRange.addEventListener('input', onRangeInput);

        window.addEventListener('keydown', (e) => {
            if (optionsScreen.classList.contains('hidden')) return;
            if (e.code === 'Escape') {
                close();
            }
        });
    }

    startGame() {
        void this.audioSystem?.unlock();

        // Switch to game scene
        this.sceneManager?.switchTo('game', {}, false, 'wipe');

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
            gameOver.classList.add('hidden');
            gameOver.style.display = 'none';
        }
    }

    showPauseOverlay() {
        const pause = document.getElementById('pauseOverlay');
        if (pause) {
            pause.classList.remove('hidden');
            pause.style.display = 'flex';
        }
    }

    hidePauseOverlay() {
        const pause = document.getElementById('pauseOverlay');
        if (pause) {
            pause.classList.add('hidden');
            pause.style.display = 'none';
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
            const damageEl = document.getElementById('finalDamage');
            const gemsEl = document.getElementById('finalGems');
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

            if (damageEl) {
                damageEl.textContent = Math.floor(data.damageDealt ?? 0).toLocaleString();
            }

            if (gemsEl) {
                gemsEl.textContent = (data.gemsCollected ?? 0).toLocaleString();
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
