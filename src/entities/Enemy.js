// File: src/entities/Enemy.js
// Base enemy entity

import { Entity } from '../ecs/Entity.js';
import { ColliderComponent } from '../ecs/components/ColliderComponent.js';
import { HealthComponent } from '../ecs/components/HealthComponent.js';
import { MovementComponent } from '../ecs/components/MovementComponent.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { MathUtils } from '../core/Math.js';

// Enemy type definitions
export const EnemyTypes = {
    basic: {
        name: 'Basic',
        health: 30,
        damage: 10,
        speed: 50,
        xpValue: 5,
        color: '#f44',
        size: 12
    },
    fast: {
        name: 'Fast',
        health: 20,
        damage: 8,
        speed: 100,
        xpValue: 8,
        color: '#4f4',
        size: 10
    },
    tank: {
        name: 'Tank',
        health: 80,
        damage: 15,
        speed: 30,
        xpValue: 15,
        color: '#44f',
        size: 18
    },
    elite: {
        name: 'Elite',
        health: 100,
        damage: 20,
        speed: 60,
        xpValue: 25,
        color: '#f4f',
        size: 16
    }
};

export class Enemy extends Entity {
    constructor(x, y, type = 'basic', config = {}) {
        super(x, y);

        this.addTag('enemy');

        // Get type definition
        const typeDef = EnemyTypes[type] || EnemyTypes.basic;
        this.type = type;
        this.typeDef = typeDef;

        // Enemy properties
        this.damage = typeDef.damage;
        this.xpValue = typeDef.xpValue;
        this.color = typeDef.color;
        this.size = typeDef.size;

        // Target to chase
        this.target = null;

        // Knockback
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDecay = 0.9;

        // Visual state
        this.hitFlash = false;
        this.hitFlashTimer = 0;

        // Setup components
        this._setupComponents(typeDef, config);
    }

    _setupComponents(typeDef, config) {
        // Health
        const health = new HealthComponent(typeDef.health);
        health.onDeath = () => this._onDeath();
        health.onDamage = (amount) => this._onDamage(amount);
        this.addComponent(health);

        // Movement
        const movement = new MovementComponent({
            speed: typeDef.speed,
            maxSpeed: typeDef.speed * 1.5
        });

        // Set world bounds
        const worldWidth = config.world?.worldWidthTiles * config.world?.tileSize || 1600;
        const worldHeight = config.world?.worldHeightTiles * config.world?.tileSize || 1600;
        movement.setBounds(0, 0, worldWidth, worldHeight);

        this.addComponent(movement);

        // Collider
        const collider = new ColliderComponent({
            type: 'circle',
            radius: this.size,
            layer: config.collisionLayers?.enemies || 4
        });
        this.addComponent(collider);
    }

    /**
     * Set the target to chase
     * @param {Entity} target
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Apply knockback force
     * @param {number} vx
     * @param {number} vy
     */
    applyKnockback(vx, vy) {
        this.knockbackVx = vx;
        this.knockbackVy = vy;
    }

    /**
     * Take damage (wrapper for component)
     * @param {number} amount
     * @param {Entity} source
     */
    takeDamage(amount, source = null) {
        const health = this.getComponent('HealthComponent');
        if (health) {
            health.takeDamage(amount, source);
        }

        // Apply knockback from source
        if (source) {
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            this.applyKnockback(dx / dist * 100, dy / dist * 100);
        }
    }

    /**
     * Handle damage effect
     */
    _onDamage(amount) {
        this.hitFlash = true;
        this.hitFlashTimer = 0.1;

        eventBus.emit(GameEvents.ENEMY_DAMAGED, {
            enemy: this,
            amount: amount
        });
    }

    /**
     * Handle death
     */
    _onDeath() {
        eventBus.emit(GameEvents.ENEMY_KILLED, {
            enemy: this,
            x: this.x,
            y: this.y,
            xpValue: this.xpValue,
            color: this.color
        });

        this.destroy();
    }

    /**
     * Check collision with another entity
     * @param {Entity} other
     * @returns {boolean}
     */
    checkCollision(other) {
        const myCollider = this.getComponent('ColliderComponent');
        const otherCollider = other.getComponent('ColliderComponent');

        if (myCollider && otherCollider) {
            return myCollider.intersects(otherCollider);
        }

        // Fallback: simple circle collision
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < this.size + 16;
    }

    update(deltaTime) {
        // Update hit flash
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.hitFlash = false;
            }
        }

        // Apply knockback
        if (Math.abs(this.knockbackVx) > 0.1 || Math.abs(this.knockbackVy) > 0.1) {
            this.x += this.knockbackVx * deltaTime;
            this.y += this.knockbackVy * deltaTime;

            this.knockbackVx *= this.knockbackDecay;
            this.knockbackVy *= this.knockbackDecay;
        }

        // Chase target
        if (this.target && !this.target.destroyed) {
            const movement = this.getComponent('MovementComponent');
            if (movement) {
                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    movement.setInput(dx / dist, dy / dist);
                }
            }
        }

        super.update(deltaTime);
    }

    draw(ctx, camera) {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size, this.size * 0.8, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw body
        ctx.fillStyle = this.hitFlash ? '#fff' : this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw eyes
        const eyeOffset = this.size * 0.3;
        const eyeSize = this.size * 0.2;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - eyeOffset, this.y - eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffset, this.y - eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw pupils (looking at target)
        ctx.fillStyle = '#000';
        let pupilOffsetX = 0;
        let pupilOffsetY = 0;

        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            pupilOffsetX = (dx / dist) * eyeSize * 0.3;
            pupilOffsetY = (dy / dist) * eyeSize * 0.3;
        }

        ctx.beginPath();
        ctx.arc(this.x - eyeOffset + pupilOffsetX, this.y - eyeOffset + pupilOffsetY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffset + pupilOffsetX, this.y - eyeOffset + pupilOffsetY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw health bar (only when damaged)
        const health = this.getComponent('HealthComponent');
        if (health && !health.isFullHealth()) {
            const barWidth = this.size * 2;
            const barHeight = 4;
            const barX = this.x - barWidth / 2;
            const barY = this.y - this.size - 10;

            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Health fill
            ctx.fillStyle = '#4f4';
            ctx.fillRect(barX, barY, barWidth * health.getHealthPercent(), barHeight);

            // Border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }
}
