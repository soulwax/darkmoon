// File: src/audio/AudioSystem.ts
// Event-driven game audio using authored WAV files in Resources/Sounds.

import { eventBus, GameEvents } from '../core/EventBus';

type AudioBus = 'music' | 'sfx' | 'ui';
type AmbientTrackKey = 'menu' | 'dungeon' | 'spring' | 'death';

interface AudioSettings {
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
}

interface WeaponEventData {
    weapon?: {
        name?: string;
    };
}

interface EnemyEventData {
    type?: string;
}

interface PlayerLevelupEventData {
    level?: number;
}

interface SfxDefinition {
    path: string;
    bus: AudioBus;
    volume: number;
    maxVoices: number;
}

interface PlaySfxOptions {
    throttleMs?: number;
    volumeScale?: number;
    playbackRate?: number;
}

function clamp01(value: number) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function randomChoice<T>(items: T[]) {
    if (items.length === 0) return null;
    const index = Math.floor(Math.random() * items.length);
    return items[index];
}

export class AudioSystem {
    ambientTracks: Record<AmbientTrackKey, HTMLAudioElement | null>;
    sfxDefs: Record<string, SfxDefinition>;
    sfxPools: Map<string, HTMLAudioElement[]>;
    unsubscribers: Array<() => void>;
    lastPlayMs: Map<string, number>;
    unlocked: boolean;
    enabled: boolean;
    prepared: boolean;
    gameplayActive: boolean;
    activeAmbient: AmbientTrackKey | null;
    volumes: {
        master: number;
        music: number;
        sfx: number;
        ui: number;
    };

    constructor(settings: AudioSettings = {}) {
        this.ambientTracks = {
            menu: null,
            dungeon: null,
            spring: null,
            death: null
        };
        this.sfxDefs = this._createSfxDefinitions();
        this.sfxPools = new Map();
        this.unsubscribers = [];
        this.lastPlayMs = new Map();
        this.unlocked = false;
        this.enabled = true;
        this.prepared = false;
        this.gameplayActive = false;
        this.activeAmbient = null;
        this.volumes = {
            master: clamp01(settings.masterVolume ?? 0.8),
            music: clamp01(settings.musicVolume ?? 0.35),
            sfx: clamp01(settings.sfxVolume ?? 0.85),
            ui: clamp01((settings.sfxVolume ?? 0.85) * 0.75)
        };

        this._bindEvents();
    }

    _createSfxDefinitions() {
        return {
            click_ui: {
                path: '/Sounds/SFX/click_ui.wav',
                bus: 'ui',
                volume: 0.5,
                maxVoices: 3
            },
            menu_select: {
                path: '/Sounds/SFX/menu_select.wav',
                bus: 'ui',
                volume: 0.55,
                maxVoices: 3
            },
            hint_sound: {
                path: '/Sounds/SFX/hint_sound.wav',
                bus: 'ui',
                volume: 0.42,
                maxVoices: 3
            },
            start_game: {
                path: '/Sounds/SFX/start_game.wav',
                bus: 'ui',
                volume: 0.6,
                maxVoices: 2
            },
            gem_collect: {
                path: '/Sounds/SFX/gem_collect.wav',
                bus: 'sfx',
                volume: 0.5,
                maxVoices: 6
            },
            level_up: {
                path: '/Sounds/SFX/level_up.wav',
                bus: 'ui',
                volume: 0.65,
                maxVoices: 2
            },
            orb_hum: {
                path: '/Sounds/SFX/orb_hum.wav',
                bus: 'sfx',
                volume: 0.38,
                maxVoices: 3
            },
            knife_slash: {
                path: '/Sounds/SFX/knife_slash.wav',
                bus: 'sfx',
                volume: 0.6,
                maxVoices: 6
            },
            sword_slice: {
                path: '/Sounds/SFX/sword_slice.wav',
                bus: 'sfx',
                volume: 0.62,
                maxVoices: 6
            },
            sword_thunder: {
                path: '/Sounds/SFX/sword_thunder.wav',
                bus: 'sfx',
                volume: 0.67,
                maxVoices: 4
            },
            thunderclap: {
                path: '/Sounds/SFX/thunderclap.wav',
                bus: 'sfx',
                volume: 0.45,
                maxVoices: 2
            },
            zombie_death: {
                path: '/Sounds/SFX/zombie_death.wav',
                bus: 'sfx',
                volume: 0.58,
                maxVoices: 6
            },
            zombie_wounded: {
                path: '/Sounds/SFX/zombie_wounded.wav',
                bus: 'sfx',
                volume: 0.35,
                maxVoices: 4
            },
            player_hurt1: {
                path: '/Sounds/SFX/player_hurt1.wav',
                bus: 'sfx',
                volume: 0.62,
                maxVoices: 2
            },
            player_hurt2: {
                path: '/Sounds/SFX/player_hurt2.wav',
                bus: 'sfx',
                volume: 0.62,
                maxVoices: 2
            },
            player_death: {
                path: '/Sounds/SFX/player_death.wav',
                bus: 'sfx',
                volume: 0.8,
                maxVoices: 1
            }
        } as Record<string, SfxDefinition>;
    }

    _bindEvents() {
        this.unsubscribers.push(
            eventBus.on(GameEvents.GAME_START, () => {
                this.gameplayActive = true;
                void this.unlock();
                this._playSfx('start_game', { throttleMs: 300, playbackRate: 1 });
                this.switchGameplayAmbient();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.GAME_RESTART, () => {
                this.gameplayActive = true;
                void this.unlock();
                this._playSfx('start_game', { throttleMs: 300, playbackRate: 1.03 });
                this.switchGameplayAmbient();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.GAME_OVER, () => {
                this.gameplayActive = false;
                this.switchAmbient('death');
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.WEAPON_FIRED, (data: WeaponEventData | undefined) => {
                this.playWeaponImpact(data?.weapon?.name || '');
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.XP_COLLECTED, () => {
                this.playXpCollect();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.PLAYER_LEVELUP, (data: PlayerLevelupEventData | undefined) => {
                this.playLevelUpFanfare();

                const level = data?.level || 1;
                // Every few levels, shift to the spring ambient variation.
                if (level > 0 && level % 5 === 0) {
                    this.switchAmbient('spring');
                }
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.ENEMY_KILLED, (data: EnemyEventData | undefined) => {
                this.playEnemyDeath(data?.type || 'basic');
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.ENEMY_DAMAGED, () => {
                this.playEnemyWounded();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.PLAYER_DAMAGED, () => {
                this.playPlayerDamaged();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.PLAYER_DIED, () => {
                this._playSfx('player_death', { throttleMs: 200 });
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.GAME_PAUSE, () => {
                this.playUiPause();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.GAME_RESUME, () => {
                this.playUiResume();
            })
        );
    }

    destroy() {
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers = [];

        for (const key of Object.keys(this.ambientTracks) as AmbientTrackKey[]) {
            const ambient = this.ambientTracks[key];
            if (!ambient) continue;
            ambient.pause();
            ambient.currentTime = 0;
        }
        this.activeAmbient = null;

        for (const pool of this.sfxPools.values()) {
            for (const audio of pool) {
                audio.pause();
            }
        }
        this.sfxPools.clear();
    }

    async unlock() {
        if (!this.enabled) return false;
        this._prepareAudio();
        this.unlocked = true;

        const targetAmbient: AmbientTrackKey = this.gameplayActive ? this._pickGameplayAmbient() : 'menu';
        this.switchAmbient(targetAmbient);
        return true;
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            this._pauseAllAmbient();
        } else if (this.unlocked) {
            const targetAmbient: AmbientTrackKey = this.gameplayActive ? this._pickGameplayAmbient() : 'menu';
            this.switchAmbient(targetAmbient);
        }
    }

    setVolumes(settings: AudioSettings) {
        if (typeof settings.masterVolume === 'number') {
            this.volumes.master = clamp01(settings.masterVolume);
        }
        if (typeof settings.musicVolume === 'number') {
            this.volumes.music = clamp01(settings.musicVolume);
        }
        if (typeof settings.sfxVolume === 'number') {
            this.volumes.sfx = clamp01(settings.sfxVolume);
            this.volumes.ui = clamp01(settings.sfxVolume * 0.75);
        }

        // Refresh ambient volume immediately.
        if (this.activeAmbient) {
            const ambient = this.ambientTracks[this.activeAmbient];
            if (ambient) {
                ambient.volume = this._volumeForBus('music');
            }
        }
    }

    _prepareAudio() {
        if (this.prepared) return;
        this.prepared = true;

        const ambientPaths: Record<AmbientTrackKey, string> = {
            menu: '/Sounds/Ambient/ui-background-ambient.wav',
            dungeon: '/Sounds/Ambient/dungeon_ambient.wav',
            spring: '/Sounds/Ambient/first_spring_ambient.wav',
            death: '/Sounds/Ambient/river_of_death.wav'
        };

        for (const key of Object.keys(ambientPaths) as AmbientTrackKey[]) {
            const audio = new Audio(this._resolveAssetPath(ambientPaths[key]));
            audio.preload = 'auto';
            audio.loop = true;
            audio.volume = this._volumeForBus('music');
            this.ambientTracks[key] = audio;
        }

        for (const [key, def] of Object.entries(this.sfxDefs)) {
            const audio = new Audio(this._resolveAssetPath(def.path));
            audio.preload = 'auto';
            audio.loop = false;
            audio.volume = this._volumeForBus(def.bus) * def.volume;
            this.sfxPools.set(key, [audio]);
        }
    }

    _resolveAssetPath(path: string) {
        const base = import.meta.env.BASE_URL || '/';
        const normalizedBase = base.endsWith('/') ? base : `${base}/`;
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
        return `${normalizedBase}${normalizedPath}`;
    }

    _canPlay(key: string, throttleMs: number = 0) {
        const now = performance.now();
        const last = this.lastPlayMs.get(key) || -Infinity;
        if (now - last < throttleMs) return false;
        this.lastPlayMs.set(key, now);
        return true;
    }

    _volumeForBus(bus: AudioBus) {
        const busVolume = bus === 'music'
            ? this.volumes.music
            : bus === 'ui'
                ? this.volumes.ui
                : this.volumes.sfx;
        return clamp01(this.volumes.master * busVolume);
    }

    _pauseAllAmbient() {
        for (const key of Object.keys(this.ambientTracks) as AmbientTrackKey[]) {
            const ambient = this.ambientTracks[key];
            if (!ambient) continue;
            ambient.pause();
        }
        this.activeAmbient = null;
    }

    _pickGameplayAmbient() {
        // Mostly dungeon ambient, with occasional spring variation.
        return Math.random() < 0.25 ? 'spring' : 'dungeon';
    }

    switchGameplayAmbient() {
        this.switchAmbient(this._pickGameplayAmbient());
    }

    switchAmbient(key: AmbientTrackKey) {
        if (!this.enabled || !this.unlocked) return;
        this._prepareAudio();

        const next = this.ambientTracks[key];
        if (!next) return;
        if (this.activeAmbient === key && !next.paused) return;

        if (this.activeAmbient) {
            const current = this.ambientTracks[this.activeAmbient];
            if (current && current !== next) {
                current.pause();
                current.currentTime = 0;
            }
        }

        next.volume = this._volumeForBus('music');
        const playPromise = next.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Browser autoplay/user gesture restrictions.
            });
        }
        this.activeAmbient = key;
    }

    _borrowSfxVoice(key: string) {
        const def = this.sfxDefs[key];
        const pool = this.sfxPools.get(key);
        if (!def || !pool) return null;

        for (const voice of pool) {
            if (voice.paused || voice.ended) {
                return voice;
            }
        }

        if (pool.length >= def.maxVoices) {
            return pool[0];
        }

        const clone = new Audio(this._resolveAssetPath(def.path));
        clone.preload = 'auto';
        clone.loop = false;
        pool.push(clone);
        return clone;
    }

    _playSfx(key: string, options: PlaySfxOptions = {}) {
        if (!this.enabled || !this.unlocked) return;
        const def = this.sfxDefs[key];
        if (!def) return;

        const throttleMs = options.throttleMs || 0;
        if (!this._canPlay(`sfx_${key}`, throttleMs)) return;

        this._prepareAudio();
        const voice = this._borrowSfxVoice(key);
        if (!voice) return;

        const volumeScale = options.volumeScale ?? 1;
        voice.volume = clamp01(this._volumeForBus(def.bus) * def.volume * volumeScale);
        voice.playbackRate = options.playbackRate || 1;
        voice.currentTime = 0;

        const playPromise = voice.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Ignore interrupted or blocked playback attempts.
            });
        }
    }

    playUiSelect() {
        this._playSfx('menu_select', { throttleMs: 20 });
    }

    playUiPause() {
        this._playSfx('click_ui', { throttleMs: 40, playbackRate: 0.95 });
    }

    playUiResume() {
        this._playSfx('click_ui', { throttleMs: 40, playbackRate: 1.04 });
    }

    playWeaponImpact(weaponName: string) {
        const name = weaponName.toLowerCase();

        if (name.includes('lightning')) {
            this._playSfx('sword_thunder', { throttleMs: 120 });
            if (Math.random() < 0.35) {
                this._playSfx('thunderclap', { throttleMs: 500, volumeScale: 0.8 });
            }
            return;
        }

        if (name.includes('longsword')) {
            this._playSfx('knife_slash', { throttleMs: 50, playbackRate: 0.98 });
            return;
        }

        if (name.includes('sword')) {
            this._playSfx('sword_slice', { throttleMs: 45, playbackRate: 1 + Math.random() * 0.06 });
            return;
        }

        if (name.includes('orb')) {
            this._playSfx('orb_hum', { throttleMs: 180, volumeScale: 0.85 });
            return;
        }

        if (name.includes('missile')) {
            this._playSfx('hint_sound', { throttleMs: 60, playbackRate: 1.1, volumeScale: 0.75 });
            return;
        }

        this._playSfx('click_ui', { throttleMs: 45, volumeScale: 0.7 });
    }

    playXpCollect() {
        this._playSfx('gem_collect', {
            throttleMs: 28,
            playbackRate: 0.96 + Math.random() * 0.12,
            volumeScale: 0.9
        });
    }

    playLevelUpFanfare() {
        this._playSfx('level_up', { throttleMs: 220 });
    }

    playEnemyDeath(enemyType: string) {
        const type = enemyType.toLowerCase();
        let rate = 1;
        if (type === 'slime') rate = 1.2;
        else if (type === 'tank') rate = 0.86;
        else if (type === 'elite') rate = 0.82;
        else if (type === 'skeleton') rate = 1.03;

        this._playSfx('zombie_death', {
            throttleMs: 22,
            playbackRate: rate,
            volumeScale: type === 'elite' ? 1.15 : 1
        });
    }

    playEnemyWounded() {
        this._playSfx('zombie_wounded', {
            throttleMs: 80,
            playbackRate: 0.95 + Math.random() * 0.12,
            volumeScale: 0.8
        });
    }

    playPlayerDamaged() {
        const key = randomChoice(['player_hurt1', 'player_hurt2']) || 'player_hurt1';
        this._playSfx(key, { throttleMs: 100, playbackRate: 0.96 + Math.random() * 0.08 });
    }
}
