// File: src/entities/Player.js
// Player entity with sprite animations

import { Entity } from '../ecs/Entity.js';
import { AnimatorComponent } from '../ecs/components/AnimatorComponent.js';
import { ColliderComponent } from '../ecs/components/ColliderComponent.js';
import { HealthComponent } from '../ecs/components/HealthComponent.js';
import { MovementComponent } from '../ecs/components/MovementComponent.js';
import { eventBus, GameEvents } from '../core/EventBus.js';

export class Player extends Entity {
    constructor(x, y, config, spriteSheet) {
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
            damageMultiplier: 1.0
        };

        // Weapons
        this.weapons = [];

        // Pickup range
        this.pickupRange = config.player?.pickupRange || 50;

        // Setup components
        this._setupComponents(config, spriteSheet);

        // Handle death
        const health = this.getComponent('HealthComponent');
        if (health) {
            health.onDeath = () => this._onDeath();
        }
    }

    _setupComponents(config, spriteSheet) {
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
            speed: playerConfig.speed || 120,
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
    handleInput(inputManager) {
        const movement = this.getComponent('MovementComponent');
        if (!movement) return;

        // Get movement vector
        const moveVec = inputManager.getMovementVector();
        movement.setInput(moveVec.x, moveVec.y);

        // Handle dash
        if (inputManager.isActionPressed('dash')) {
            movement.dash();
        }

        // Update animator based on movement
        const animator = this.getComponent('AnimatorComponent');
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
    gainXP(amount) {
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
        const health = this.getComponent('HealthComponent');
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
    addWeapon(weaponClass, options = {}) {
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
    getWeapon(weaponClass) {
        return this.weapons.find(w => w instanceof weaponClass) || null;
    }

    /**
     * Check if player has weapon
     * @param {Function} weaponClass
     * @returns {boolean}
     */
    hasWeapon(weaponClass) {
        return this.weapons.some(w => w instanceof weaponClass);
    }

    /**
     * Apply a stat upgrade
     * @param {string} stat
     * @param {number} value
     */
    applyStat(stat, value) {
        if (this.stats[stat] !== undefined) {
            this.stats[stat] += value;
        }

        // Apply stat effects
        switch (stat) {
            case 'moveSpeed':
                const movement = this.getComponent('MovementComponent');
                if (movement) {
                    movement.speed = (this.config.player?.speed || 120) * this.stats.moveSpeed;
                }
                break;

            case 'maxHealth':
                const health = this.getComponent('HealthComponent');
                if (health) {
                    const newMax = Math.floor((this.config.player?.maxHealth || 100) * this.stats.maxHealth);
                    health.setMaxHealth(newMax);
                    health.heal(20); // Heal 20 on max health increase
                }
                break;

            case 'pickupRange':
                this.pickupRange = (this.config.player?.pickupRange || 50) * this.stats.pickupRange;
                break;

            case 'damageMultiplier':
                // Weapons apply `stats.damageMultiplier` at hit time.
                break;
        }
    }

    /**
     * Get effective pickup range
     */
    getPickupRange() {
        return this.pickupRange * this.stats.pickupRange;
    }

    /**
     * Handle death
     */
    _onDeath() {
        eventBus.emit(GameEvents.GAME_OVER, {
            player: this,
            level: this.level,
            xp: this.xp
        });
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
            damageMultiplier: 1.0
        };

        this.weapons = [];

        // Reset health
        const health = this.getComponent('HealthComponent');
        if (health) {
            health.revive(1.0);
        }

        // Reset movement
        const movement = this.getComponent('MovementComponent');
        if (movement) {
            movement.stop();
            movement.speed = this.config.player?.speed || 120;
        }
    }

    update(deltaTime) {
        super.update(deltaTime);

        // Update weapons
        for (const weapon of this.weapons) {
            weapon.update(deltaTime);
        }
    }

    draw(ctx, camera) {
        const health = this.getComponent('HealthComponent');
        const animator = this.getComponent('AnimatorComponent');
        const movement = this.getComponent('MovementComponent');

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
    _drawFallback(ctx, movement) {
        const direction = movement?.facingDirection || 'down';
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
    _drawLevelBadge(ctx) {
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
