// File: src/audio/ProceduralAudioSystem.ts

import { eventBus, GameEvents } from '../core/EventBus';

type AudioBus = 'music' | 'sfx' | 'ui';

interface AudioSettings {
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
}

interface ToneOptions {
    frequency: number;
    duration?: number;
    gain?: number;
    type?: OscillatorType;
    bus?: AudioBus;
    when?: number;
    attack?: number;
    frequencyEnd?: number;
    detune?: number;
    detuneEnd?: number;
}

interface NoiseOptions {
    duration?: number;
    gain?: number;
    bus?: AudioBus;
    when?: number;
    attack?: number;
    filterFrequency?: number;
    filterQ?: number;
}

interface AmbientNodes {
    oscA: OscillatorNode;
    oscB: OscillatorNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    filter: BiquadFilterNode;
    gain: GainNode;
}

interface WeaponEventData {
    weapon?: {
        name?: string;
    };
}

interface EnemyKilledEventData {
    type?: string;
}

const MIN_GAIN = 0.0001;

function clamp01(value: number) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

export class ProceduralAudioSystem {
    context: AudioContext | null;
    masterGain: GainNode | null;
    musicGain: GainNode | null;
    sfxGain: GainNode | null;
    uiGain: GainNode | null;
    ambient: AmbientNodes | null;
    unsubscribers: Array<() => void>;
    unlocked: boolean;
    enabled: boolean;
    lastPlayMs: Map<string, number>;
    volumes: {
        master: number;
        music: number;
        sfx: number;
    };

    constructor(settings: AudioSettings = {}) {
        this.context = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.uiGain = null;
        this.ambient = null;
        this.unsubscribers = [];
        this.unlocked = false;
        this.enabled = true;
        this.lastPlayMs = new Map();
        this.volumes = {
            master: clamp01(settings.masterVolume ?? 0.8),
            music: clamp01(settings.musicVolume ?? 0.35),
            sfx: clamp01(settings.sfxVolume ?? 0.8)
        };

        this._bindEvents();
    }

    _bindEvents() {
        this.unsubscribers.push(
            eventBus.on(GameEvents.GAME_START, () => {
                void this.unlock();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.WEAPON_FIRED, (data: WeaponEventData | undefined) => {
                this.playWeaponImpact(data?.weapon?.name || '');
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.WEAPON_ACQUIRED, (data: WeaponEventData | undefined) => {
                const name = (data?.weapon?.name || '').toLowerCase();
                if (name.includes('orb')) {
                    this.playOrbHumCue();
                }
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.XP_COLLECTED, () => {
                this.playXpCollect();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.PLAYER_LEVELUP, () => {
                this.playLevelUpFanfare();
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.ENEMY_KILLED, (data: EnemyKilledEventData | undefined) => {
                this.playEnemyDeath(data?.type || 'basic');
            })
        );

        this.unsubscribers.push(
            eventBus.on(GameEvents.PLAYER_DAMAGED, () => {
                this.playPlayerDamaged();
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

        this.stopAmbientDrone();
        if (this.context) {
            const ctx = this.context;
            this.context = null;
            void ctx.close();
        }
    }

    async unlock() {
        if (!this.enabled) return false;
        if (!this._ensureContext()) return false;
        if (!this.context) return false;

        if (this.context.state === 'suspended') {
            try {
                await this.context.resume();
            } catch {
                return false;
            }
        }

        this.unlocked = true;
        this._applyVolumes();
        this.startAmbientDrone();
        return true;
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            this.stopAmbientDrone();
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
        }
        this._applyVolumes();
    }

    _ensureContext() {
        if (this.context) return true;
        if (typeof window === 'undefined') return false;

        const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;

        const ctx = new Ctor();
        const master = ctx.createGain();
        const music = ctx.createGain();
        const sfx = ctx.createGain();
        const ui = ctx.createGain();

        music.connect(master);
        sfx.connect(master);
        ui.connect(master);
        master.connect(ctx.destination);

        this.context = ctx;
        this.masterGain = master;
        this.musicGain = music;
        this.sfxGain = sfx;
        this.uiGain = ui;
        this._applyVolumes();
        return true;
    }

    _applyVolumes() {
        if (!this.masterGain || !this.musicGain || !this.sfxGain || !this.uiGain) return;
        this.masterGain.gain.value = this.volumes.master;
        this.musicGain.gain.value = this.volumes.music;
        this.sfxGain.gain.value = this.volumes.sfx;
        this.uiGain.gain.value = Math.min(1, this.volumes.sfx * 0.75);
    }

    _canPlay(key: string, minIntervalMs: number = 0) {
        const now = performance.now();
        const last = this.lastPlayMs.get(key) || -Infinity;
        if (now - last < minIntervalMs) return false;
        this.lastPlayMs.set(key, now);
        return true;
    }

    _getBusGain(bus: AudioBus) {
        if (!this.enabled || !this.unlocked) return null;
        if (bus === 'music') return this.musicGain;
        if (bus === 'ui') return this.uiGain;
        return this.sfxGain;
    }

    _playTone(options: ToneOptions) {
        if (!this.context) return;
        const bus = this._getBusGain(options.bus || 'sfx');
        if (!bus) return;

        const duration = Math.max(0.02, options.duration || 0.1);
        const attack = Math.max(0.001, Math.min(duration * 0.4, options.attack || 0.006));
        const gainAmount = Math.max(MIN_GAIN, options.gain || 0.05);
        const when = this.context.currentTime + (options.when || 0);

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = options.type || 'triangle';
        osc.frequency.setValueAtTime(Math.max(1, options.frequency), when);
        if (typeof options.frequencyEnd === 'number') {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.frequencyEnd), when + duration);
        }

        if (typeof options.detune === 'number') {
            osc.detune.setValueAtTime(options.detune, when);
        }
        if (typeof options.detuneEnd === 'number') {
            osc.detune.linearRampToValueAtTime(options.detuneEnd, when + duration);
        }

        gain.gain.setValueAtTime(MIN_GAIN, when);
        gain.gain.exponentialRampToValueAtTime(gainAmount, when + attack);
        gain.gain.exponentialRampToValueAtTime(MIN_GAIN, when + duration);

        osc.connect(gain);
        gain.connect(bus);

        osc.start(when);
        osc.stop(when + duration + 0.02);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }

    _createNoiseBuffer(duration: number) {
        if (!this.context) return null;
        const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
        const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        let last = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            const smoothed = (last * 0.85) + (white * 0.15);
            data[i] = smoothed;
            last = smoothed;
        }

        return buffer;
    }

    _playNoise(options: NoiseOptions = {}) {
        if (!this.context) return;
        const bus = this._getBusGain(options.bus || 'sfx');
        if (!bus) return;

        const duration = Math.max(0.02, options.duration || 0.12);
        const attack = Math.max(0.001, Math.min(duration * 0.4, options.attack || 0.004));
        const gainAmount = Math.max(MIN_GAIN, options.gain || 0.05);
        const when = this.context.currentTime + (options.when || 0);

        const source = this.context.createBufferSource();
        source.buffer = this._createNoiseBuffer(duration);
        if (!source.buffer) return;

        const filter = this.context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(Math.max(40, options.filterFrequency || 1200), when);
        filter.Q.setValueAtTime(Math.max(0.1, options.filterQ || 0.7), when);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(MIN_GAIN, when);
        gain.gain.exponentialRampToValueAtTime(gainAmount, when + attack);
        gain.gain.exponentialRampToValueAtTime(MIN_GAIN, when + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(bus);

        source.start(when);
        source.stop(when + duration + 0.02);
        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
        };
    }

    startAmbientDrone() {
        if (!this.context || !this.musicGain || !this.unlocked || this.ambient) return;

        const ctx = this.context;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        filter.Q.value = 0.75;

        const gain = ctx.createGain();
        gain.gain.value = MIN_GAIN;

        const oscA = ctx.createOscillator();
        oscA.type = 'sawtooth';
        oscA.frequency.value = 55;

        const oscB = ctx.createOscillator();
        oscB.type = 'triangle';
        oscB.frequency.value = 82.41;
        oscB.detune.value = -8;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.09;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 110;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(MIN_GAIN, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 1.2);

        oscA.start(now);
        oscB.start(now);
        lfo.start(now);

        this.ambient = { oscA, oscB, lfo, lfoGain, filter, gain };
    }

    stopAmbientDrone() {
        if (!this.ambient) return;
        const { oscA, oscB, lfo, lfoGain, filter, gain } = this.ambient;

        const safeStop = (node: OscillatorNode) => {
            try {
                node.stop();
            } catch {
                // no-op
            }
        };

        safeStop(oscA);
        safeStop(oscB);
        safeStop(lfo);

        oscA.disconnect();
        oscB.disconnect();
        lfo.disconnect();
        lfoGain.disconnect();
        filter.disconnect();
        gain.disconnect();
        this.ambient = null;
    }

    playUiSelect() {
        if (!this._canPlay('ui_select', 20)) return;
        this._playTone({
            frequency: 720,
            frequencyEnd: 980,
            duration: 0.06,
            gain: 0.05,
            type: 'square',
            bus: 'ui'
        });
    }

    playUiPause() {
        if (!this._canPlay('ui_pause', 60)) return;
        this._playTone({
            frequency: 430,
            frequencyEnd: 290,
            duration: 0.08,
            gain: 0.045,
            type: 'square',
            bus: 'ui'
        });
    }

    playUiResume() {
        if (!this._canPlay('ui_resume', 60)) return;
        this._playTone({
            frequency: 330,
            frequencyEnd: 520,
            duration: 0.07,
            gain: 0.04,
            type: 'triangle',
            bus: 'ui'
        });
    }

    playWeaponImpact(weaponName: string) {
        const name = weaponName.toLowerCase();
        if (!this._canPlay(`weapon_${name}`, 30)) return;

        if (name.includes('lightning')) {
            this._playNoise({
                duration: 0.16,
                gain: 0.1,
                filterFrequency: 3000,
                filterQ: 1.1
            });
            this._playTone({
                frequency: 940,
                frequencyEnd: 170,
                duration: 0.13,
                gain: 0.07,
                type: 'square'
            });
            return;
        }

        if (name.includes('sword')) {
            this._playNoise({
                duration: 0.09,
                gain: 0.07,
                filterFrequency: 1900,
                filterQ: 1.3
            });
            this._playTone({
                frequency: 260,
                frequencyEnd: 110,
                duration: 0.1,
                gain: 0.055,
                type: 'sawtooth'
            });
            return;
        }

        if (name.includes('missile')) {
            this._playTone({
                frequency: 390,
                frequencyEnd: 820,
                duration: 0.11,
                gain: 0.05,
                type: 'triangle'
            });
            return;
        }

        if (name.includes('orb')) {
            this.playOrbHumCue();
            return;
        }

        this._playTone({
            frequency: 480,
            frequencyEnd: 360,
            duration: 0.08,
            gain: 0.045,
            type: 'triangle'
        });
    }

    playOrbHumCue() {
        if (!this._canPlay('orb_hum', 200)) return;
        this._playTone({
            frequency: 170,
            frequencyEnd: 230,
            duration: 0.22,
            gain: 0.04,
            type: 'sine'
        });
    }

    playXpCollect() {
        if (!this._canPlay('xp_collect', 25)) return;
        const pitch = 840 + Math.random() * 180;
        this._playTone({
            frequency: pitch,
            frequencyEnd: pitch * 1.2,
            duration: 0.07,
            gain: 0.038,
            type: 'triangle'
        });
    }

    playLevelUpFanfare() {
        if (!this._canPlay('level_up', 250)) return;

        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) {
            this._playTone({
                frequency: notes[i],
                duration: i === notes.length - 1 ? 0.22 : 0.12,
                gain: i === notes.length - 1 ? 0.09 : 0.065,
                type: i % 2 === 0 ? 'square' : 'triangle',
                bus: 'ui',
                when: i * 0.085
            });
        }

        this._playNoise({
            duration: 0.12,
            gain: 0.04,
            filterFrequency: 2400,
            bus: 'ui',
            when: 0.16
        });
    }

    playEnemyDeath(enemyType: string) {
        if (!this._canPlay(`enemy_death_${enemyType}`, 20)) return;

        const type = enemyType.toLowerCase();
        if (type === 'slime') {
            this._playTone({
                frequency: 210,
                frequencyEnd: 95,
                duration: 0.12,
                gain: 0.05,
                type: 'sine'
            });
            this._playNoise({
                duration: 0.07,
                gain: 0.03,
                filterFrequency: 450
            });
            return;
        }

        if (type === 'skeleton') {
            this._playTone({
                frequency: 760,
                frequencyEnd: 420,
                duration: 0.07,
                gain: 0.05,
                type: 'square'
            });
            this._playTone({
                frequency: 520,
                frequencyEnd: 280,
                duration: 0.06,
                gain: 0.035,
                type: 'square',
                when: 0.03
            });
            return;
        }

        if (type === 'tank' || type === 'elite') {
            this._playNoise({
                duration: 0.11,
                gain: 0.07,
                filterFrequency: 700,
                filterQ: 0.8
            });
            this._playTone({
                frequency: 180,
                frequencyEnd: 80,
                duration: 0.15,
                gain: 0.06,
                type: 'sawtooth'
            });
            return;
        }

        this._playTone({
            frequency: 340,
            frequencyEnd: 140,
            duration: 0.09,
            gain: 0.045,
            type: 'triangle'
        });
    }

    playPlayerDamaged() {
        if (!this._canPlay('player_damaged', 80)) return;
        this._playNoise({
            duration: 0.08,
            gain: 0.06,
            filterFrequency: 650,
            filterQ: 0.9
        });
        this._playTone({
            frequency: 180,
            frequencyEnd: 120,
            duration: 0.09,
            gain: 0.055,
            type: 'sawtooth'
        });
    }
}
