// File: src/entities/Enemy.ts

import { Entity } from '../ecs/Entity';
import { ColliderComponent } from '../ecs/components/ColliderComponent';
import { HealthComponent } from '../ecs/components/HealthComponent';
import { MovementComponent } from '../ecs/components/MovementComponent';
import { eventBus, GameEvents } from '../core/EventBus';
import { MathUtils, type Direction } from '../core/Math';
import type { GameConfig } from '../config/GameConfig';
import type { Camera } from '../graphics/Camera';

// Enemy type definitions with sprite info
export interface EnemyTypeDefinition {
    name: string;
    health: number;
    damage: number;
    speed: number;
    xpValue: number;
    color: string;
    size: number;
    sprite?: string;
    frameWidth?: number;
    frameHeight?: number;
    rows?: Record<Direction, number>;
    animFrames?: number;
    animSpeed?: number;
    knockbackResist?: number;
}

export const EnemyTypes: Record<string, EnemyTypeDefinition> = {
    skeleton: {
        name: 'Skeleton',
        health: 30,
        damage: 10,
        speed: 40,
        xpValue: 8,
        color: '#d4c4a8',
        size: 14,
        sprite: 'skeleton',
        frameWidth: 64,
        frameHeight: 64,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 9,
        animSpeed: 10,
        knockbackResist: 0.8
    },
    slime: {
        name: 'Slime',
        health: 22,
        damage: 6,
        speed: 30,
        xpValue: 5,
        color: '#44ff44',
        size: 10,
        sprite: 'slime',
        frameWidth: 32,
        frameHeight: 32,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 4,
        animSpeed: 6,
        knockbackResist: 0.5
    },
    basic: {
        name: 'Basic',
        health: 26,
        damage: 8,
        speed: 45,
        xpValue: 5,
        color: '#f44',
        size: 12,
        knockbackResist: 1.0
    },
    fast: {
        name: 'Fast',
        health: 18,
        damage: 6,
        speed: 85,
        xpValue: 8,
        color: '#4f4',
        size: 10,
        knockbackResist: 1.2
    },
    tank: {
        name: 'Tank',
        health: 70,
        damage: 12,
        speed: 28,
        xpValue: 15,
        color: '#44f',
        size: 18,
        knockbackResist: 0.4
    },
    elite: {
        name: 'Elite',
        health: 90,
        damage: 16,
        speed: 55,
        xpValue: 25,
        color: '#f4f',
        size: 16,
        knockbackResist: 0.6
    }
};

export class Enemy extends Entity {
    type: string;
    typeDef: EnemyTypeDefinition;
    damage: number;
    xpValue: number;
    color: string;
    size: number;
    knockbackResist: number;
    spriteImage: HTMLImageElement | null;
    frameWidth: number;
    frameHeight: number;
    animFrames: number;
    animSpeed: number;
    rows: Record<Direction, number>;
    currentFrame: number;
    animTimer: number;
    facingDirection: Direction;
    target: Entity | null;
    knockbackVx: number;
    knockbackVy: number;
    knockbackFriction: number;
    isKnockedBack: boolean;
    knockbackStunTime: number;
    hitFlash: boolean;
    hitFlashTimer: number;
    squashTimer: number;

    constructor(x: number, y: number, type: string = 'basic', config: GameConfig, spriteImage: HTMLImageElement | null = null) {
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
        this.knockbackResist = typeDef.knockbackResist || 1.0;

        // Sprite properties
        this.spriteImage = spriteImage;
        this.frameWidth = typeDef.frameWidth || 32;
        this.frameHeight = typeDef.frameHeight || 32;
        this.animFrames = typeDef.animFrames || 4;
        this.animSpeed = typeDef.animSpeed || 8;
        this.rows = typeDef.rows || { down: 0, left: 1, right: 2, up: 3 };

        // Animation state
        this.currentFrame = 0;
        this.animTimer = 0;
        this.facingDirection = 'down';

        // Target to chase
        this.target = null;

        // Improved knockback physics
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackFriction = 8; // Deceleration rate
        this.isKnockedBack = false;
        this.knockbackStunTime = 0;

        // Visual state
        this.hitFlash = false;
        this.hitFlashTimer = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.squashTimer = 0;

        // Setup components
        this._setupComponents(typeDef, config);
    }

    _setupComponents(typeDef: EnemyTypeDefinition, config: GameConfig) {
        // Health
        const health = new HealthComponent(typeDef.health);
        // Enemies shouldn't have long i-frames like the player.
        health.invulnerabilityDuration = 0.05;
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
    setTarget(target: Entity) {
        this.target = target;
    }

    /**
     * Set sprite image
     */
    setSprite(image: HTMLImageElement | null) {
        this.spriteImage = image;
    }

    /**
     * Apply knockback force with physics
     * @param {number} vx - X velocity
     * @param {number} vy - Y velocity
     */
    applyKnockback(vx: number, vy: number) {
        // Apply knockback resistance
        const resist = this.knockbackResist;
        this.knockbackVx += vx * resist;
        this.knockbackVy += vy * resist;
        this.isKnockedBack = true;
        this.knockbackStunTime = 0.15; // Brief stun during knockback

        // Squash/stretch effect
        this.squashTimer = 0.1;
        const knockbackMag = Math.sqrt(vx * vx + vy * vy);
        const stretchAmount = Math.min(0.3, knockbackMag / 500);
        this.scaleX = 1 - stretchAmount * 0.5;
        this.scaleY = 1 + stretchAmount;
    }

    /**
     * Take damage (wrapper for component)
     * @param {number} amount
     * @param {Entity} source
     */
    takeDamage(amount: number, source: Entity | null = null) {
        const health = this.getComponent<HealthComponent>('HealthComponent');
        if (health) {
            health.takeDamage(amount, source);
        }

        // Apply knockback from source (if not already being knocked back significantly)
        if (source && Math.abs(this.knockbackVx) < 50 && Math.abs(this.knockbackVy) < 50) {
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            this.applyKnockback(dx / dist * 150, dy / dist * 150);
        }
    }

    /**
     * Handle damage effect
     */
    _onDamage(amount: number) {
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
            type: this.type,
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
    checkCollision(other: Entity) {
        const myCollider = this.getComponent<ColliderComponent>('ColliderComponent');
        const otherCollider = other.getComponent<ColliderComponent>('ColliderComponent');

        if (myCollider && otherCollider) {
            return myCollider.intersects(otherCollider);
        }

        // Fallback: simple circle collision
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < this.size + 16;
    }

    update(deltaTime: number) {
        // Update hit flash
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.hitFlash = false;
            }
        }

        // Update squash/stretch
        if (this.squashTimer > 0) {
            this.squashTimer -= deltaTime;
            // Lerp back to normal scale
            this.scaleX = MathUtils.lerp(this.scaleX, 1, deltaTime * 15);
            this.scaleY = MathUtils.lerp(this.scaleY, 1, deltaTime * 15);
        } else {
            this.scaleX = 1;
            this.scaleY = 1;
        }

        // Update knockback stun
        if (this.knockbackStunTime > 0) {
            this.knockbackStunTime -= deltaTime;
        }

        // Apply knockback physics with friction
        const knockbackSpeed = Math.sqrt(this.knockbackVx * this.knockbackVx + this.knockbackVy * this.knockbackVy);
        if (knockbackSpeed > 1) {
            this.x += this.knockbackVx * deltaTime;
            this.y += this.knockbackVy * deltaTime;

            // Apply friction
            const friction = this.knockbackFriction * deltaTime;
            const frictionMultiplier = Math.max(0, 1 - friction);
            this.knockbackVx *= frictionMultiplier;
            this.knockbackVy *= frictionMultiplier;
        } else {
            this.knockbackVx = 0;
            this.knockbackVy = 0;
            this.isKnockedBack = false;
        }

        // Chase target (only if not stunned)
        if (this.target && !this.target.destroyed && this.knockbackStunTime <= 0) {
            const movement = this.getComponent<MovementComponent>('MovementComponent');
            if (movement) {
                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    movement.setInput(dx / dist, dy / dist);

                    // Update facing direction
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.facingDirection = dx > 0 ? 'right' : 'left';
                    } else {
                        this.facingDirection = dy > 0 ? 'down' : 'up';
                    }
                }
            }
        } else if (this.knockbackStunTime > 0) {
            // Stop movement input during stun
            const movement = this.getComponent<MovementComponent>('MovementComponent');
            if (movement) {
                movement.setInput(0, 0);
            }
        }

        // Update animation
        this.animTimer += deltaTime * this.animSpeed;
        if (this.animTimer >= 1) {
            this.animTimer -= 1;
            this.currentFrame = (this.currentFrame + 1) % this.animFrames;
        }

        super.update(deltaTime);
    }

    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size, this.size * 0.8, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Try to draw sprite
        if (this.spriteImage && this.spriteImage.complete) {
            this._drawSprite(ctx);
        } else {
            this._drawFallback(ctx);
        }

        // Draw health bar (only when damaged)
        const health = this.getComponent<HealthComponent>('HealthComponent');
        if (health && !health.isFullHealth()) {
            this._drawHealthBar(ctx, health);
        }
    }

    /**
     * Draw sprite-based enemy
     */
    _drawSprite(ctx: CanvasRenderingContext2D) {
        if (!this.spriteImage) return;
        const row = this.rows[this.facingDirection] || 0;
        const srcX = this.currentFrame * this.frameWidth;
        const srcY = row * this.frameHeight;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Apply squash/stretch
        ctx.scale(this.scaleX, this.scaleY);

        // Hit flash effect
        if (this.hitFlash) {
            ctx.globalAlpha = 0.7;
            ctx.filter = 'brightness(2)';
        }

        // Draw sprite centered
        const drawWidth = this.frameWidth;
        const drawHeight = this.frameHeight;
        ctx.drawImage(
            this.spriteImage,
            srcX, srcY, this.frameWidth, this.frameHeight,
            -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight
        );

        ctx.restore();
    }

    /**
     * Draw fallback (non-sprite) enemy
     */
    _drawFallback(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, this.scaleY);

        // Draw body
        ctx.fillStyle = this.hitFlash ? '#fff' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
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
        ctx.arc(-eyeOffset, -eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.arc(eyeOffset, -eyeOffset, eyeSize, 0, Math.PI * 2);
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
        ctx.arc(-eyeOffset + pupilOffsetX, -eyeOffset + pupilOffsetY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.arc(eyeOffset + pupilOffsetX, -eyeOffset + pupilOffsetY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Draw health bar
     */
    _drawHealthBar(ctx: CanvasRenderingContext2D, health: HealthComponent) {
        const barWidth = this.size * 2.5;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 12;

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPct = health.getHealthPercent();
        const healthColor = healthPct > 0.5 ? '#4f4' : healthPct > 0.25 ? '#ff0' : '#f44';
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);

        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}
