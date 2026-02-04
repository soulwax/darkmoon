// File: src/ecs/components/HealthComponent.js
// Component for health and damage system

import { Component } from '../Component.js';
import { eventBus, GameEvents } from '../../core/EventBus.js';

export class HealthComponent extends Component {
    constructor(maxHealth = 100) {
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

    /**
     * Take damage
     * @param {number} amount - Damage amount
     * @param {Object} [source] - Damage source entity
     * @returns {boolean} - True if damage was applied
     */
    takeDamage(amount, source = null) {
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

        // Emit event
        eventBus.emit(GameEvents.PLAYER_DAMAGED, {
            entity: this.entity,
            amount: amount,
            remaining: this.health,
            source: source
        });

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
    heal(amount) {
        if (this.isDead || amount <= 0) return 0;

        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        const healed = this.health - oldHealth;

        if (healed > 0) {
            eventBus.emit(GameEvents.PLAYER_HEALED, {
                entity: this.entity,
                amount: healed,
                current: this.health
            });

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
    setMaxHealth(maxHealth, healToFull = false) {
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

        eventBus.emit(GameEvents.PLAYER_DIED, {
            entity: this.entity
        });

        if (this.onDeath) {
            this.onDeath();
        }
    }

    /**
     * Revive entity
     * @param {number} [healthPercent=1.0] - Percentage of max health to restore
     */
    revive(healthPercent = 1.0) {
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

    update(deltaTime) {
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
