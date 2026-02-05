// File: src/weapons/Weapon.js
// Base weapon class

import { eventBus, GameEvents } from '../core/EventBus.js';

export class Weapon {
    constructor(owner, options = {}) {
        this.owner = owner;
        this.name = options.name || 'Weapon';

        // Damage
        this.baseDamage = options.damage ?? 10;
        try {
            this.damage = this.baseDamage;
        } catch {
            // Some weapons expose `damage` as a getter-only accessor.
            // In modules (strict mode) assigning would throw, so skip.
        }

        // Cooldown
        try {
            this.cooldown = options.cooldown ?? 1.0;
        } catch {
            // Some weapons expose `cooldown` as a getter-only accessor.
        }
        this.cooldownTimer = 0;

        // Level system
        this.level = 1;
        this.maxLevel = options.maxLevel || 8;

        // Active state
        this.active = true;
    }

    /**
     * Check if weapon can fire
     * @returns {boolean}
     */
    canFire() {
        return this.active && this.cooldownTimer <= 0;
    }

    /**
     * Fire the weapon
     * @param {Entity[]} enemies
     */
    fire(enemies) {
        if (!this.canFire()) return;

        this.cooldownTimer = this.cooldown;
        this._doFire(enemies);

        eventBus.emit(GameEvents.WEAPON_FIRED, {
            weapon: this,
            owner: this.owner
        });
    }

    /**
     * Implementation of weapon firing (override in subclass)
     * @param {Entity[]} enemies
     */
    _doFire(enemies) {
        // Override in subclass
    }

    /**
     * Upgrade the weapon
     */
    upgrade() {
        if (this.level >= this.maxLevel) return false;

        this.level++;
        this._applyUpgrade();

        eventBus.emit(GameEvents.WEAPON_UPGRADED, {
            weapon: this,
            level: this.level
        });

        return true;
    }

    /**
     * Apply upgrade effects (override in subclass)
     */
    _applyUpgrade() {
        // Override in subclass
        this.damage = Math.floor(this.baseDamage * (1 + (this.level - 1) * 0.2));
    }

    /**
     * Update weapon state
     * @param {number} deltaTime
     * @param {Entity[]} enemies
     */
    update(deltaTime, enemies = []) {
        // Update cooldown
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        // Auto-fire logic (override in subclass if needed)
        if (this.canFire()) {
            this.fire(enemies);
        }
    }

    /**
     * Draw weapon effects
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        // Override in subclass
    }

    /**
     * Get upgrade info for UI
     * @returns {Object}
     */
    getUpgradeInfo() {
        return {
            name: this.name,
            level: this.level,
            maxLevel: this.maxLevel,
            damage: this.damage,
            cooldown: this.cooldown
        };
    }
}
