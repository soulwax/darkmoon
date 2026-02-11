// File: src/entities/Player.ts

import { Entity } from '../ecs/Entity';
import { AnimatorComponent } from '../ecs/components/AnimatorComponent';
import { ColliderComponent } from '../ecs/components/ColliderComponent';
import { HealthComponent } from '../ecs/components/HealthComponent';
import { MovementComponent } from '../ecs/components/MovementComponent';
import { eventBus, GameEvents } from '../core/EventBus';
import type { GameConfig } from '../config/GameConfig';
import type { SpriteSheet } from '../assets/SpriteSheet';
import type { InputManager } from '../input/InputManager';
import type { Weapon } from '../weapons/Weapon';
import type { Camera } from '../graphics/Camera';
import type { Direction } from '../core/Math';

export interface PlayerStats {
    moveSpeed: number;
    maxHealth: number;
    pickupRange: number;
    damageMultiplier: number;
    armor: number;
    luck: number;
    shieldCapacity: number;
}

type WeaponClass<T extends Weapon = Weapon> = new (owner: Player, options?: Record<string, unknown>) => T;

export interface PlayerEffect {
    id: string;
    name: string;
    icon: string;
    duration: number;
    remaining: number;
    multipliers: {
        moveSpeed?: number;
        damage?: number;
        pickupRange?: number;
    };
}

export class Player extends Entity {
    config: GameConfig;
    xp: number;
    level: number;
    xpToNextLevel: number;
    xpScaling: number;
    stats: PlayerStats;
    weapons: Weapon[];
    baseMoveSpeed: number;
    basePickupRange: number;
    baseShieldCapacity: number;
    baseShieldRechargeRate: number;
    shieldRechargeDelay: number;
    shield: number;
    shieldRechargeDelayTimer: number;
    shieldImpactTimer: number;
    effects: PlayerEffect[];
    animationLockTimer: number;

    constructor(x: number, y: number, config: GameConfig, spriteSheet: SpriteSheet | null) {
        super(x, y);

        this.addTag('player');

        // Configuration
        this.config = config;

        // XP and leveling
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = config.progression?.baseXPToLevel || 10;
        this.xpScaling = config.progression?.xpScaling || 1.5;

        // Stats multipliers (from upgrades)
        this.stats = {
            moveSpeed: 1.0,
            maxHealth: 1.0,
            pickupRange: 1.0,
            damageMultiplier: 1.0,
            armor: 0,
            luck: 0,
            shieldCapacity: 1.0
        };

        // Weapons
        this.weapons = [];

        // Base stats used for derived values
        this.baseMoveSpeed = config.player?.speed || 120;
        this.basePickupRange = config.player?.pickupRange || 50;
        this.baseShieldCapacity = config.player?.shieldCapacity || 45;
        this.baseShieldRechargeRate = config.player?.shieldRechargeRate || 16;
        this.shieldRechargeDelay = config.player?.shieldRechargeDelay || 2.5;
        this.shield = this.baseShieldCapacity;
        this.shieldRechargeDelayTimer = 0;
        this.shieldImpactTimer = 0;

        // Active timed effects (powerups, etc.)
        this.effects = [];

        // Prevent movement state from instantly overriding short one-shot animations (attacks).
        this.animationLockTimer = 0;

        // Setup components
        this._setupComponents(config, spriteSheet);

        // Handle death
        const health = this.getComponent<HealthComponent>('HealthComponent');
        if (health) {
            health.onDeath = () => {
                const movement = this.getComponent<MovementComponent>('MovementComponent');
                movement?.stop();
            };
        }
    }

    _setupComponents(config: GameConfig, spriteSheet: SpriteSheet | null) {
        const playerConfig = config.player || {};

        // Animator component (sprite rendering)
        if (spriteSheet) {
            const animator = new AnimatorComponent(spriteSheet);
            animator.setState('idle', 'down');
            this.addComponent(animator);
        }

        // Health component
        const health = new HealthComponent(playerConfig.maxHealth || 100);
        health.invulnerabilityDuration = playerConfig.invulnerabilityDuration || 0.5;
        this.addComponent(health);

        // Movement component
        const movement = new MovementComponent({
            speed: this.baseMoveSpeed,
            maxSpeed: config.physics?.maxVelocityX || 500,
            dashEnabled: playerConfig.dashEnabled !== false,
            dashSpeed: playerConfig.dashSpeed || 300,
            dashDuration: playerConfig.dashDuration || 0.2,
            dashCooldown: playerConfig.dashCooldown || 1.0
        });

        // Set world bounds
        const worldWidth = config.world?.worldWidthTiles * config.world?.tileSize || 1600;
        const worldHeight = config.world?.worldHeightTiles * config.world?.tileSize || 1600;
        movement.setBounds(24, 24, worldWidth - 24, worldHeight - 24);

        this.addComponent(movement);

        // Collider component
        const collider = new ColliderComponent({
            type: 'circle',
            radius: 16,
            layer: config.collisionLayers?.player || 2,
            offsetY: 8 // Offset down for feet collision
        });
        this.addComponent(collider);
    }

    /**
     * Handle player input
     * @param {InputManager} inputManager
     */
    handleInput(inputManager: InputManager) {
        const movement = this.getComponent<MovementComponent>('MovementComponent');
        if (!movement) return;

        // Get movement vector
        const moveVec = inputManager.getMovementVector();
        movement.setInput(moveVec.x, moveVec.y);

        // Handle dash
        if (inputManager.isActionPressed('dash')) {
            movement.dash();
        }

        // Update animator based on movement
        const animator = this.getComponent<AnimatorComponent>('AnimatorComponent');
        if (animator) {
            if (this.animationLockTimer <= 0) {
                if (movement.isDashing) {
                    animator.setState('run', movement.facingDirection);
                    animator.setSpeed(2.0);
                } else if (movement.isMoving()) {
                    animator.setState('run', movement.facingDirection);
                    animator.setSpeed(1.0);
                } else {
                    animator.setState('idle', movement.facingDirection);
                    animator.setSpeed(1.0);
                }
            }
        }
    }

    lockAnimation(state: string, direction: Direction, durationSeconds: number, speed: number = 1.0) {
        const animator = this.getComponent<AnimatorComponent>('AnimatorComponent');
        if (!animator) return;

        animator.setState(state, direction);
        animator.setSpeed(speed);
        this.animationLockTimer = Math.max(this.animationLockTimer, Math.max(0, durationSeconds));
    }

    /**
     * Add XP and check for level up
     * @param {number} amount
     */
    gainXP(amount: number) {
        this.xp += amount;

        eventBus.emit(GameEvents.PLAYER_XP_GAINED, {
            player: this,
            amount: amount,
            total: this.xp
        });

        // Check for level up
        while (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
    }

    /**
     * Level up
     */
    levelUp() {
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * this.xpScaling);

        // Heal on level up
        const health = this.getComponent<HealthComponent>('HealthComponent');
        if (health) {
            const healAmount = this.config.progression?.healthRecoveryOnLevelUp || 20;
            health.heal(healAmount);
        }

        eventBus.emit(GameEvents.PLAYER_LEVELUP, {
            player: this,
            level: this.level,
            xpToNext: this.xpToNextLevel
        });
    }

    /**
     * Add a weapon
     * @param {Function} weaponClass
     * @param {Object} options
     */
    addWeapon<T extends Weapon>(weaponClass: WeaponClass<T>, options: Record<string, unknown> = {}) {
        const weapon = new weaponClass(this, options);
        this.weapons.push(weapon);

        eventBus.emit(GameEvents.WEAPON_ACQUIRED, {
            player: this,
            weapon: weapon
        });

        return weapon;
    }

    /**
     * Get weapon by class
     * @param {Function} weaponClass
     * @returns {Weapon|null}
     */
    getWeapon<T extends Weapon>(weaponClass: WeaponClass<T>): T | null {
        const match = this.weapons.find((w): w is T => w instanceof weaponClass);
        return match || null;
    }

    /**
     * Check if player has weapon
     * @param {Function} weaponClass
     * @returns {boolean}
     */
    hasWeapon(weaponClass: WeaponClass) {
        return this.weapons.some(w => w instanceof weaponClass);
    }

    /**
     * Apply a stat upgrade
     * @param {string} stat
     * @param {number} value
     */
    applyStat(stat: keyof PlayerStats, value: number) {
        const previousValue = this.stats[stat];
        this.stats[stat] = previousValue + value;

        // Apply stat effects
        switch (stat) {
            case 'moveSpeed':
                this._syncMovementSpeed();
                break;

            case 'maxHealth':
                const health = this.getComponent<HealthComponent>('HealthComponent');
                if (health) {
                    const newMax = Math.floor((this.config.player?.maxHealth || 100) * this.stats.maxHealth);
                    health.setMaxHealth(newMax);
                    health.heal(20); // Heal 20 on max health increase
                }
                break;

            case 'pickupRange':
                break;

            case 'damageMultiplier':
                // Weapons apply `stats.damageMultiplier` at hit time.
                break;
            case 'armor':
                break;
            case 'luck':
                break;
            case 'shieldCapacity': {
                const oldMaxShield = this.baseShieldCapacity * previousValue;
                const newMaxShield = this.getMaxShield();
                const gainedShield = Math.max(0, newMaxShield - oldMaxShield);
                this.shield = Math.min(newMaxShield, this.shield + gainedShield);
                break;
            }
        }
    }

    _getEffectMultipliers() {
        let moveSpeed = 1;
        let damage = 1;
        let pickupRange = 1;

        for (const effect of this.effects) {
            if (effect.multipliers.moveSpeed) moveSpeed *= effect.multipliers.moveSpeed;
            if (effect.multipliers.damage) damage *= effect.multipliers.damage;
            if (effect.multipliers.pickupRange) pickupRange *= effect.multipliers.pickupRange;
        }

        return { moveSpeed, damage, pickupRange };
    }

    _syncMovementSpeed() {
        const movement = this.getComponent<MovementComponent>('MovementComponent');
        if (!movement) return;

        const mult = this._getEffectMultipliers();
        movement.speed = this.baseMoveSpeed * this.stats.moveSpeed * mult.moveSpeed;
    }

    getDamageMultiplier() {
        const mult = this._getEffectMultipliers();
        return this.stats.damageMultiplier * mult.damage;
    }

    getArmorReduction() {
        return Math.max(0, Math.min(0.8, this.stats.armor));
    }

    getDamageTakenMultiplier() {
        return 1 - this.getArmorReduction();
    }

    getLuckValue() {
        return Math.max(0, this.stats.luck);
    }

    getDropRateMultiplier() {
        return 1 + this.getLuckValue();
    }

    getCritChance(baseChance: number = 0.05) {
        // Each +0.10 luck contributes +5% crit chance.
        const chance = baseChance + this.getLuckValue() * 0.5;
        return Math.max(0, Math.min(0.65, chance));
    }

    rollCriticalHit(baseChance: number = 0.05) {
        return Math.random() < this.getCritChance(baseChance);
    }

    getCritDamageMultiplier() {
        // Slight scaling with luck to keep higher-luck runs impactful.
        return 1.8 + this.getLuckValue() * 0.4;
    }

    /**
     * Get effective pickup range
     */
    getPickupRange() {
        const mult = this._getEffectMultipliers();
        return this.basePickupRange * this.stats.pickupRange * mult.pickupRange;
    }

    getMaxShield() {
        return Math.max(0, Math.floor(this.baseShieldCapacity * this.stats.shieldCapacity));
    }

    getShield() {
        return Math.max(0, this.shield);
    }

    getShieldPercent() {
        const maxShield = this.getMaxShield();
        if (maxShield <= 0) return 0;
        return Math.max(0, Math.min(1, this.shield / maxShield));
    }

    getShieldRechargeRate() {
        return this.baseShieldRechargeRate;
    }

    absorbShieldDamage(amount: number) {
        if (amount <= 0) return 0;

        this.shieldRechargeDelayTimer = this.shieldRechargeDelay;

        const maxShield = this.getMaxShield();
        if (maxShield <= 0 || this.shield <= 0) return amount;

        const absorbed = Math.min(this.shield, amount);
        this.shield -= absorbed;
        this.shieldImpactTimer = Math.max(this.shieldImpactTimer, 0.2);

        return amount - absorbed;
    }

    restoreShield(amount: number) {
        if (amount <= 0) return;
        this.shield = Math.min(this.getMaxShield(), this.shield + amount);
    }

    refillShield() {
        this.shield = this.getMaxShield();
    }

    getProximityAutoAttackDamage() {
        const base = 5 + this.level;
        return Math.max(1, Math.floor(base * this.getDamageMultiplier()));
    }

    getProximityAutoAttackKnockback() {
        const shieldScaling = 1 + Math.max(0, this.stats.shieldCapacity - 1) * 0.3;
        return 260 * shieldScaling;
    }

    getProximityContactInterval() {
        return 0.38;
    }

    getActiveEffects() {
        return this.effects.map((e) => ({ ...e }));
    }

    addEffect(effect: Omit<PlayerEffect, 'remaining'>) {
        const existingIndex = this.effects.findIndex((e) => e.id === effect.id);
        const normalized: PlayerEffect = { ...effect, remaining: effect.duration };

        if (existingIndex !== -1) {
            this.effects[existingIndex] = normalized;
        } else {
            this.effects.push(normalized);
        }

        this._syncMovementSpeed();
    }

    applyPowerUp(type: 'heal' | 'shield' | 'haste' | 'rage' | 'magnet' | 'xp') {
        switch (type) {
            case 'heal': {
                const health = this.getComponent<HealthComponent>('HealthComponent');
                health?.heal(Math.max(20, Math.floor((health.maxHealth || 100) * 0.25)));
                break;
            }
            case 'shield': {
                this.restoreShield(Math.max(20, Math.floor(this.getMaxShield() * 0.65)));
                const health = this.getComponent<HealthComponent>('HealthComponent');
                if (health) {
                    health.invulnerable = true;
                    health.invulnerabilityTimer = Math.max(health.invulnerabilityTimer, 1.5);
                }
                break;
            }
            case 'haste':
                this.addEffect({
                    id: 'haste',
                    name: 'Haste',
                    icon: '💨',
                    duration: 8,
                    multipliers: { moveSpeed: 1.5 }
                });
                break;
            case 'rage':
                this.addEffect({
                    id: 'rage',
                    name: 'Rage',
                    icon: '💥',
                    duration: 8,
                    multipliers: { damage: 1.5 }
                });
                break;
            case 'magnet':
                this.addEffect({
                    id: 'magnet',
                    name: 'Magnet',
                    icon: '🧲',
                    duration: 10,
                    multipliers: { pickupRange: 1.75 }
                });
                break;
            case 'xp':
                this.gainXP(25);
                break;
        }
    }

    /**
     * Reset player to initial state
     */
    reset() {
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = this.config.progression?.baseXPToLevel || 10;

        this.stats = {
            moveSpeed: 1.0,
            maxHealth: 1.0,
            pickupRange: 1.0,
            damageMultiplier: 1.0,
            armor: 0,
            luck: 0,
            shieldCapacity: 1.0
        };

        this.weapons = [];
        this.effects = [];

        // Reset health
        const health = this.getComponent<HealthComponent>('HealthComponent');
        if (health) {
            health.revive(1.0);
        }

        // Reset movement
        const movement = this.getComponent<MovementComponent>('MovementComponent');
        if (movement) {
            movement.stop();
            this.baseMoveSpeed = this.config.player?.speed || 120;
            this.basePickupRange = this.config.player?.pickupRange || 50;
            movement.speed = this.baseMoveSpeed;
        }

        this.baseShieldCapacity = this.config.player?.shieldCapacity || 45;
        this.baseShieldRechargeRate = this.config.player?.shieldRechargeRate || 16;
        this.shieldRechargeDelay = this.config.player?.shieldRechargeDelay || 2.5;
        this.shield = this.getMaxShield();
        this.shieldRechargeDelayTimer = 0;
        this.shieldImpactTimer = 0;
    }

    update(deltaTime: number) {
        super.update(deltaTime);

        if (this.animationLockTimer > 0) {
            this.animationLockTimer -= deltaTime;
        }

        const maxShield = this.getMaxShield();
        if (this.shield > maxShield) {
            this.shield = maxShield;
        }

        if (this.shieldRechargeDelayTimer > 0) {
            this.shieldRechargeDelayTimer -= deltaTime;
        } else {
            if (this.shield < maxShield) {
                this.shield = Math.min(maxShield, this.shield + this.getShieldRechargeRate() * deltaTime);
            }
        }

        if (this.shieldImpactTimer > 0) {
            this.shieldImpactTimer -= deltaTime;
        }

        // Update timed effects
        if (this.effects.length > 0) {
            for (let i = this.effects.length - 1; i >= 0; i--) {
                this.effects[i].remaining -= deltaTime;
                if (this.effects[i].remaining <= 0) {
                    this.effects.splice(i, 1);
                }
            }
            this._syncMovementSpeed();
        }

        // Update weapons
        for (const weapon of this.weapons) {
            weapon.update(deltaTime);
        }
    }

    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        const health = this.getComponent<HealthComponent>('HealthComponent');
        const animator = this.getComponent<AnimatorComponent>('AnimatorComponent');
        const movement = this.getComponent<MovementComponent>('MovementComponent');
        const invulnBlink = health?.invulnerable
            ? (Math.floor(Math.max(0, health.invulnerabilityTimer) * 14) % 2 === 0 ? 0.6 : 1)
            : 1;

        // Draw shadow
        ctx.save();
        ctx.globalAlpha = invulnBlink;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 20, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw the sprite directly to avoid rendering non-visual components (e.g. collider debug circle).
        if (animator) {
            animator.draw(ctx, camera);
        } else {
            // Fallback: draw a simple character shape
            this._drawFallback(ctx, movement);
        }
        ctx.restore();

        this._drawShieldOrb(ctx);

        // Draw dash trail
        if (movement && movement.isDashing) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#6af';
            ctx.beginPath();
            ctx.arc(this.x - this.vx * 0.05, this.y - this.vy * 0.05, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw weapons
        for (const weapon of this.weapons) {
            weapon.draw(ctx);
        }

        // Draw level indicator
        this._drawLevelBadge(ctx);
    }

    /**
     * Draw the rechargeable shield orb around the player.
     */
    _drawShieldOrb(ctx: CanvasRenderingContext2D) {
        const maxShield = this.getMaxShield();
        if (maxShield <= 0) return;

        const shieldRatio = this.getShieldPercent();
        const shouldDisplay =
            shieldRatio < 0.995 ||
            this.shieldImpactTimer > 0.01 ||
            this.shieldRechargeDelayTimer > 0.01;
        if (!shouldDisplay) return;

        const pulse = 0.9 + Math.sin(Date.now() / 200) * 0.1;
        const impactBoost = this.shieldImpactTimer > 0 ? 0.18 + this.shieldImpactTimer * 0.4 : 0;
        const alpha = Math.min(0.35, (0.03 + shieldRatio * 0.18) * pulse + impactBoost);
        if (alpha <= 0.01) return;

        const radius = 16 + shieldRatio * 6;
        const gradient = ctx.createRadialGradient(this.x, this.y, radius * 0.2, this.x, this.y, radius * 1.2);
        gradient.addColorStop(0, `rgba(160, 215, 255, ${alpha * 0.12})`);
        gradient.addColorStop(0.7, `rgba(110, 190, 255, ${alpha * 0.28})`);
        gradient.addColorStop(1, 'rgba(90, 165, 235, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(165, 225, 255, ${alpha * 0.95})`;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Draw fallback character when no sprite is loaded
     */
    _drawFallback(ctx: CanvasRenderingContext2D, movement?: MovementComponent | null) {
        const direction: Direction = movement?.facingDirection || 'down';
        const isMoving = movement?.isMoving() || false;

        // Body
        ctx.fillStyle = '#5599ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 16, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#3366cc';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Cape/cloak
        ctx.fillStyle = '#4444aa';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 8, 14, 10, 0, 0, Math.PI);
        ctx.fill();

        // Eyes based on direction
        ctx.fillStyle = '#fff';
        let eyeOffsetX = 0, eyeOffsetY = -2;

        switch(direction) {
            case 'left': eyeOffsetX = -4; break;
            case 'right': eyeOffsetX = 4; break;
            case 'up': eyeOffsetY = -6; break;
            case 'down': eyeOffsetY = 0; break;
        }

        // Left eye
        ctx.beginPath();
        ctx.arc(this.x - 5 + eyeOffsetX, this.y + eyeOffsetY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Right eye
        ctx.beginPath();
        ctx.arc(this.x + 5 + eyeOffsetX, this.y + eyeOffsetY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#000';
        const pupilOffset = isMoving ? 1 : 0;
        ctx.beginPath();
        ctx.arc(this.x - 5 + eyeOffsetX + pupilOffset, this.y + eyeOffsetY, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 5 + eyeOffsetX + pupilOffset, this.y + eyeOffsetY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Magic glow effect
        const glowIntensity = 0.3 + Math.sin(Date.now() / 200) * 0.1;
        ctx.fillStyle = `rgba(100, 150, 255, ${glowIntensity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw level badge above player
     */
    _drawLevelBadge(ctx: CanvasRenderingContext2D) {
        if (this.level <= 1) return;

        const badgeX = this.x;
        const badgeY = this.y - 35;

        // Badge background
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
        ctx.fill();

        // Badge border
        ctx.strokeStyle = '#cc9900';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Level number
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.level.toString(), badgeX, badgeY);
    }
}
