// File: src/ui/HUD.ts

import type { Player, PlayerEffect } from '../entities/Player';
import type { GameConfig } from '../config/GameConfig';
import type { HealthComponent } from '../ecs/components/HealthComponent';

export class HUD {
    canvas: HTMLCanvasElement;
    config: GameConfig;
    health: number;
    maxHealth: number;
    xp: number;
    xpToNext: number;
    level: number;
    gameTime: number;
    killCount: number;
    healthBar: HTMLElement | null;
    healthText: HTMLElement | null;
    xpBar: HTMLElement | null;
    levelText: HTMLElement | null;
    timeValue: HTMLElement | null;
    killValue: HTMLElement | null;
    buffs: HTMLElement | null;
    effects: PlayerEffect[];

    constructor(canvas: HTMLCanvasElement, config: GameConfig) {
        this.canvas = canvas;
        this.config = config;

        // Cached values
        this.health = 100;
        this.maxHealth = 100;
        this.xp = 0;
        this.xpToNext = 10;
        this.level = 1;
        this.gameTime = 0;
        this.killCount = 0;
        this.effects = [];

        // DOM elements
        this.healthBar = document.getElementById('health-bar');
        this.healthText = document.getElementById('health-text');
        this.xpBar = document.getElementById('xp-bar');
        this.levelText = document.getElementById('level-text');
        this.timeValue = document.getElementById('time-value');
        this.killValue = document.getElementById('kill-value');
        this.buffs = document.getElementById('buffs');

        // Show HUD
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'block';
    }

    /**
     * Update HUD with current values
     * @param {Player} player
     * @param {number} gameTime
     * @param {number} killCount
     */
    update(player: Player | null, gameTime: number, killCount: number) {
        if (!player) return;

        const health = player.getComponent<HealthComponent>('HealthComponent');
        if (health) {
            this.health = health.health;
            this.maxHealth = health.maxHealth;
        }

        this.xp = player.xp;
        this.xpToNext = player.xpToNextLevel;
        this.level = player.level;
        this.gameTime = gameTime;
        this.killCount = killCount;

        this.effects = typeof player.getActiveEffects === 'function' ? player.getActiveEffects() : [];

        this._updateDOM();
    }

    _updateDOM() {
        // Health bar
        if (this.healthBar) {
            const healthPercent = (this.health / this.maxHealth) * 100;
            this.healthBar.style.width = `${healthPercent}%`;

            // Color based on health
            if (healthPercent > 50) {
                this.healthBar.style.backgroundColor = '#4f4';
            } else if (healthPercent > 25) {
                this.healthBar.style.backgroundColor = '#ff0';
            } else {
                this.healthBar.style.backgroundColor = '#f44';
            }
        }

        if (this.healthText) {
            this.healthText.textContent = `${Math.ceil(this.health)}/${this.maxHealth}`;
        }

        // XP bar
        if (this.xpBar) {
            const xpPercent = (this.xp / this.xpToNext) * 100;
            this.xpBar.style.width = `${xpPercent}%`;
        }

        if (this.levelText) {
            this.levelText.textContent = `Level ${this.level}`;
        }

        // Time
        if (this.timeValue) {
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            this.timeValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        // Kills
        if (this.killValue) {
            this.killValue.textContent = this.killCount.toString();
        }

        // Active powerups/effects
        if (this.buffs) {
            if (this.effects.length === 0) {
                this.buffs.innerHTML = '';
            } else {
                this.buffs.innerHTML = this.effects
                    .slice(0, 6)
                    .map((effect) => {
                        const seconds = Math.max(0, Math.ceil(effect.remaining));
                        return `<span class="buff" title="${effect.name}">${effect.icon}<span class="buff-time">${seconds}s</span></span>`;
                    })
                    .join('');
            }
        }
    }

    /**
     * Draw HUD (canvas-based elements if needed)
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx: CanvasRenderingContext2D) {
        // Most HUD is DOM-based, but we can draw additional elements here
        // For example, weapon cooldowns or minimap
    }

    /**
     * Hide HUD
     */
    hide() {
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'none';
    }

    /**
     * Show HUD
     */
    show() {
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'block';
    }
}
