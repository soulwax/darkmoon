// File: src/entities/Player.js
// Player entity with sprite animations

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
    effects: PlayerEffect[];

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
            luck: 0
        };

        // Weapons
        this.weapons = [];

        // Base stats used for derived values
        this.baseMoveSpeed = config.player?.speed || 120;
        this.basePickupRange = config.player?.pickupRange || 50;

        // Active timed effects (powerups, etc.)
        this.effects = [];

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
        if (this.stats[stat] !== undefined) {
            this.stats[stat] += value;
        }

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
                // Placeholder for future damage reduction calculations.
                break;
            case 'luck':
                // Placeholder for future RNG modifiers.
                break;
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

    /**
     * Get effective pickup range
     */
    getPickupRange() {
        const mult = this._getEffectMultipliers();
        return this.basePickupRange * this.stats.pickupRange * mult.pickupRange;
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
                const health = this.getComponent<HealthComponent>('HealthComponent');
                if (health) {
                    health.invulnerable = true;
                    health.invulnerabilityTimer = Math.max(health.invulnerabilityTimer, 4);
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
            luck: 0
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
    }

    update(deltaTime: number) {
        super.update(deltaTime);

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

        // Skip drawing during invulnerability flash
        if (health && !health.isVisible()) {
            return;
        }

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 20, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw entity (animator will handle sprite if available)
        if (animator) {
            super.draw(ctx, camera);
        } else {
            // Fallback: draw a simple character shape
            this._drawFallback(ctx, movement);
        }

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

