// File: src/main.ts

import { Game } from './Game';
import { assetLoader } from './assets/AssetLoader';
import { CoreAssetManifest } from './assets/AssetManifest';
import { AudioSystem } from './audio/AudioSystem';
import { ProceduralAudioSystem } from './audio/ProceduralAudioSystem';
import { ConfigLoader } from './config/ConfigLoader';
import { GameConfig } from './config/GameConfig';
import { DebugLogger } from './core/DebugLogger';
import { eventBus, GameEvents } from './core/EventBus';
import { BrowserPlaytestHarness } from './playtest/BrowserPlaytestHarness';
import { GameScene } from './scenes/GameScene';
import { SceneManager } from './scenes/SceneManager';

DebugLogger.installConsoleBridge();

interface GameOverData {
    time?: number;
    kills?: number;
    level?: number;
    damageDealt?: number;
    gemsCollected?: number;
    message?: string;
    debug?: GameOverDebugData;
}

interface GameOverDebugData {
    reason?: string;
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
    errorName?: string;
    errorMessage?: string;
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

type RunPhase = 'menu' | 'playing' | 'gameover';

const AUDIO_PREFS_STORAGE_KEY = 'darkmoon.audio.preferences.v1';

export class Application {
    game: Game | null;
    config: GameConfig | null;
    sceneManager: SceneManager | null;
    audioSystem: AudioBackend | null;
    playtest: BrowserPlaytestHarness | null;
    audioPreferences: AudioPreferences;
    lastGameOverData: GameOverData | null;
    phase: RunPhase;
    globalErrorHandlersInstalled: boolean;

    constructor() {
        this.game = null;
        this.config = null;
        this.sceneManager = null;
        this.audioSystem = null;
        this.playtest = null;
        this.audioPreferences = {
            mode: 'authored',
            enabled: true,
            masterVolume: 0.8,
            musicVolume: 0.35,
            sfxVolume: 0.85
        };
        this.lastGameOverData = null;
        this.phase = 'menu';
        this.globalErrorHandlersInstalled = false;
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
        this.installGlobalErrorHandlers();

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

        this.playtest = new BrowserPlaytestHarness({
            startGame: (reason?: string) => this.startGame(reason),
            restartGame: (reason?: string) => this.restartGame(reason),
            getCurrentGameScene: () => this.getCurrentGameScene(),
            getPhase: () => this.getPhase(),
            isGameOverVisible: () => this.isGameOverVisible()
        });

        // Debug/dev convenience: auto-start game via URL param (?autostart=1)
        const params = new URLSearchParams(window.location.search);
        const hasAutostart = params.has('autostart');
        const playtestScenario = params.get('playtest');
        const rawPlaytestDuration = params.get('playtestDuration');
        const parsedPlaytestDuration = rawPlaytestDuration ? Number(rawPlaytestDuration) : undefined;
        const playtestDuration = typeof parsedPlaytestDuration === 'number' && Number.isFinite(parsedPlaytestDuration) && parsedPlaytestDuration > 0
            ? parsedPlaytestDuration
            : undefined;

        // Setup UI event handlers
        this.setupUI();
        if (!hasAutostart && !playtestScenario) {
            this.showMenu();
        }
        this.hideGameOver();
        this.setPhase('menu', 'init_complete');

        if (playtestScenario) {
            void this.playtest?.run({
                scenarioId: playtestScenario,
                durationSeconds: playtestDuration
            });
        } else if (hasAutostart) {
            this.startGame('autostart_param');
        }

        console.log('Darkmoon ready!');
    }

    normalizeErrorLike(error: unknown) {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        return {
            name: 'NonErrorThrow',
            message: typeof error === 'string' ? error : String(error),
            stack: undefined as string | undefined
        };
    }

    installGlobalErrorHandlers() {
        if (this.globalErrorHandlersInstalled) return;
        this.globalErrorHandlersInstalled = true;

        window.addEventListener('error', (event) => {
            const error = event.error instanceof Error
                ? event.error
                : new Error(event.message || 'Unknown window error');
            this.handleRuntimeException('window_error', error, {
                filename: event.filename || null,
                lineno: event.lineno || null,
                colno: event.colno || null
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            const error = reason instanceof Error
                ? reason
                : new Error(typeof reason === 'string' ? reason : 'Unhandled promise rejection');
            this.handleRuntimeException('unhandled_rejection', error, {
                reason
            });
        });
    }

    handleRuntimeException(source: 'window_error' | 'unhandled_rejection', error: unknown, meta?: unknown) {
        const normalized = this.normalizeErrorLike(error);
        const gameTime = this.game?.getGameTime?.() ?? undefined;

        DebugLogger.error('Application', 'runtime_exception_captured', {
            source,
            phase: this.phase,
            gameTime: typeof gameTime === 'number' ? Number(gameTime.toFixed(3)) : null,
            meta: meta ?? null,
            error: normalized
        });

        if (this.phase !== 'playing') return;
        if (this.isGameOverVisible()) return;

        const payload: GameOverData = {
            time: gameTime,
            kills: this.game?.killCount ?? undefined,
            message: 'A runtime error interrupted the run. Start again?',
            debug: {
                reason: 'runtime_exception',
                sourceType: source,
                time: gameTime,
                errorName: normalized.name,
                errorMessage: normalized.message
            }
        };

        this.lastGameOverData = payload;
        eventBus.emit(GameEvents.GAME_OVER, payload);
        this.showGameOver(payload);
        this.ensureGameOverVisible(payload);
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

    getCurrentGameScene() {
        const scene = this.sceneManager?.getCurrent();
        return scene instanceof GameScene ? scene : null;
    }

    getPhase() {
        return this.phase;
    }

    setPhase(next: RunPhase, reason: string, data?: unknown) {
        const previous = this.phase;
        const redundant = previous === next && data === undefined;

        if (!redundant) {
            this.phase = next;
        }

        DebugLogger.info('Application', 'phase_transition', {
            previous,
            next,
            reason,
            data: data ?? null,
            redundant
        });
    }

    setupUI() {
        const unlockAudio = () => {
            void this.audioSystem?.unlock();
        };

        window.addEventListener('pointerdown', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });

        const restartGame = (reason: string = 'ui_restart') => {
            this.audioSystem?.playUiSelect();
            void this.audioSystem?.unlock();
            this.restartGame(reason);
        };

        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.audioSystem?.playUiSelect();
                void this.audioSystem?.unlock();
                this.startGame('ui_start_button');
            });
        }

        // Restart button
        const restartButton = document.getElementById('restartButton');
        if (restartButton) {
            restartButton.addEventListener('click', () => restartGame('ui_restart_button'));
        }

        // Listen for lifecycle events.
        eventBus.on(GameEvents.GAME_START, () => {
            this.hideMenu();
            this.hideGameOver();
            this.setPhase('playing', 'event_game_start');
        });

        eventBus.on(GameEvents.GAME_RESTART, () => {
            this.hideMenu();
            this.hideGameOver();
            this.setPhase('playing', 'event_game_restart');
        });

        eventBus.on(GameEvents.GAME_OVER, (data: GameOverData) => {
            this.lastGameOverData = data;
            this.showGameOver(data);
            this.ensureGameOverVisible(data);
            this.setPhase('gameover', 'event_game_over', {
                time: data.time ?? null,
                kills: data.kills ?? null,
                level: data.level ?? null,
                reason: data.debug?.reason ?? null
            });
        });

        // Allow keyboard restart directly from death screen.
        window.addEventListener('keydown', (e) => {
            if (!this.isGameOverVisible()) return;
            if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                restartGame('ui_restart_keyboard');
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

    startGame(reason: string = 'start_game') {
        if (this.phase === 'playing' && this.game?.isRunning()) {
            DebugLogger.debug('Application', 'start_ignored_already_playing', { reason });
            return;
        }

        void this.audioSystem?.unlock();
        this.lastGameOverData = null;
        this.hideMenu();
        this.hideGameOver();
        this.setPhase('playing', reason);

        // Switch to game scene
        this.sceneManager?.switchTo('game', {}, false, 'wipe');

        // Start game loop
        eventBus.emit(GameEvents.GAME_START);
    }

    restartGame(reason: string = 'restart_game') {
        void this.audioSystem?.unlock();
        this.lastGameOverData = null;
        this.hideMenu();
        this.hideGameOver();
        this.setPhase('playing', reason);
        eventBus.emit(GameEvents.GAME_RESTART);
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
        const debugEl = document.getElementById('deathDebug');
        if (debugEl) {
            debugEl.textContent = '';
            debugEl.style.display = 'none';
        }
    }

    isGameOverVisible() {
        const gameOver = document.getElementById('gameOverScreen');
        if (!gameOver) return false;
        return gameOver.style.display === 'flex' && !gameOver.classList.contains('hidden');
    }

    ensureGameOverVisible(data: GameOverData = {}, attempt: number = 0) {
        if (this.isGameOverVisible()) return;
        if (attempt >= 12) return;

        this.showGameOver(data);
        window.setTimeout(() => {
            this.ensureGameOverVisible(data, attempt + 1);
        }, 80);
    }

    formatGameOverDebug(debug?: GameOverDebugData) {
        if (!debug) return '';

        const parts: string[] = [];
        if (debug.reason) parts.push(`reason=${debug.reason}`);
        if (debug.sourceType) parts.push(`source=${debug.sourceType}${typeof debug.sourceId === 'number' ? `#${debug.sourceId}` : ''}`);
        if (typeof debug.incomingDamage === 'number') parts.push(`incoming=${debug.incomingDamage}`);
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
        if (debug.errorName || debug.errorMessage) {
            parts.push(`error=${debug.errorName || 'Error'}:${debug.errorMessage || 'unknown'}`);
        }

        return parts.join(' | ');
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
                const debugText = this.formatGameOverDebug(data.debug);
                debugEl.textContent = debugText;
                debugEl.style.display = debugText ? 'block' : 'none';
            }
        }
    }
}

// Bootstrap application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new Application();
    window.Darkmoon = app;
    try {
        await app.init();
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});

// Export for debugging
window.DarkmoonApp = Application;
