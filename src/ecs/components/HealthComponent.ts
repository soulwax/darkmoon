// File: src/ecs/components/HealthComponent.ts

import { Component } from '../Component';
import { eventBus, GameEvents } from '../../core/EventBus';
import type { Entity } from '../Entity';

export class HealthComponent extends Component {
    maxHealth: number;
    health: number;
    invulnerable: boolean;
    invulnerabilityDuration: number;
    invulnerabilityTimer: number;
    damageFlash: boolean;
    damageFlashDuration: number;
    damageFlashTimer: number;
    isDead: boolean;
    onDamage: ((amount: number, source?: Entity | null) => void) | null;
    onHeal: ((amount: number) => void) | null;
    onDeath: (() => void) | null;

    constructor(maxHealth: number = 100) {
        super();

        this.maxHealth = maxHealth;
        this.health = maxHealth;

        // Invulnerability
        this.invulnerable = false;
        this.invulnerabilityDuration = 0.5; // seconds
        this.invulnerabilityTimer = 0;

        // Damage flash
        this.damageFlash = false;
        this.damageFlashDuration = 0.1;
        this.damageFlashTimer = 0;

        // Death state
        this.isDead = false;

        // Callbacks
        this.onDamage = null;
        this.onHeal = null;
        this.onDeath = null;
    }

    _isPlayer() {
        return !!this.entity && this.entity.hasTag('player');
    }

    /**
     * Take damage
     * @param {number} amount - Damage amount
     * @param {Object} [source] - Damage source entity
     * @returns {boolean} - True if damage was applied
     */
    takeDamage(amount: number, source: Entity | null = null) {
        if (this.isDead || this.invulnerable || amount <= 0) {
            return false;
        }

        this.health = Math.max(0, this.health - amount);

        // Trigger invulnerability
        this.invulnerable = true;
        this.invulnerabilityTimer = this.invulnerabilityDuration;

        // Trigger damage flash
        this.damageFlash = true;
        this.damageFlashTimer = this.damageFlashDuration;

        // Emit event (player-only)
        if (this._isPlayer()) {
            eventBus.emit(GameEvents.PLAYER_DAMAGED, {
                entity: this.entity,
                amount: amount,
                remaining: this.health,
                source: source
            });
        }

        // Callback
        if (this.onDamage) {
            this.onDamage(amount, source);
        }

        // Check death
        if (this.health <= 0) {
            this._die();
        }

        return true;
    }

    /**
     * Heal
     * @param {number} amount
     * @returns {number} - Actual amount healed
     */
    heal(amount: number) {
        if (this.isDead || amount <= 0) return 0;

        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        const healed = this.health - oldHealth;

        if (healed > 0) {
            if (this._isPlayer()) {
                eventBus.emit(GameEvents.PLAYER_HEALED, {
                    entity: this.entity,
                    amount: healed,
                    current: this.health
                });
            }

            if (this.onHeal) {
                this.onHeal(healed);
            }
        }

        return healed;
    }

    /**
     * Set max health (and optionally heal to full)
     * @param {number} maxHealth
     * @param {boolean} [healToFull=false]
     */
    setMaxHealth(maxHealth: number, healToFull: boolean = false) {
        this.maxHealth = maxHealth;
        if (healToFull) {
            this.health = maxHealth;
        } else {
            this.health = Math.min(this.health, maxHealth);
        }
    }

    /**
     * Handle death
     */
    _die() {
        if (this.isDead) return;

        this.isDead = true;
        this.health = 0;

        if (this._isPlayer()) {
            eventBus.emit(GameEvents.PLAYER_DIED, {
                entity: this.entity
            });
        }

        if (this.onDeath) {
            this.onDeath();
        }
    }

    /**
     * Revive entity
     * @param {number} [healthPercent=1.0] - Percentage of max health to restore
     */
    revive(healthPercent: number = 1.0) {
        this.isDead = false;
        this.health = Math.floor(this.maxHealth * healthPercent);
        this.invulnerable = false;
        this.invulnerabilityTimer = 0;
    }

    /**
     * Get health percentage (0-1)
     */
    getHealthPercent() {
        return this.health / this.maxHealth;
    }

    /**
     * Check if at full health
     */
    isFullHealth() {
        return this.health >= this.maxHealth;
    }

    update(deltaTime: number) {
        // Update invulnerability timer
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= deltaTime;
            if (this.invulnerabilityTimer <= 0) {
                this.invulnerable = false;
            }
        }

        // Update damage flash timer
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= deltaTime;
            if (this.damageFlashTimer <= 0) {
                this.damageFlash = false;
            }
        }
    }

    /**
     * Check if entity should be visible (for invulnerability flashing)
     */
    isVisible() {
        if (!this.invulnerable) return true;
        // Flash every 0.1 seconds
        return Math.floor(this.invulnerabilityTimer * 10) % 2 === 0;
    }
}
