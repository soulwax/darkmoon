// File: src/entities/Enemy.ts

import { Entity } from '../ecs/Entity';
import { AnimatorComponent } from '../ecs/components/AnimatorComponent';
import { ColliderComponent } from '../ecs/components/ColliderComponent';
import { HealthComponent } from '../ecs/components/HealthComponent';
import { MovementComponent } from '../ecs/components/MovementComponent';
import { eventBus, GameEvents } from '../core/EventBus';
import { MathUtils, type Direction } from '../core/Math';
import type { GameConfig } from '../config/GameConfig';
import type { Camera } from '../graphics/Camera';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { AttackTimeline } from '../combat/AttackTimeline';
import type { AttackDefinition, CombatSource, DamagePayload } from '../combat/CombatTypes';
import { CombatStateComponent } from '../ecs/components/CombatStateComponent';
import { DamageResolver } from '../combat/DamageResolver';

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
    spriteSheet?: string;
    spriteScale?: number;
    spriteOffsetY?: number;
    contactWindup?: number;
    contactRecovery?: number;
    contactCooldown?: number;
    contactRange?: number;
    spawnThreat?: number;
    spawnWeight?: number;
    unlockWave?: number;
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
        frameWidth: 32,
        frameHeight: 48,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 9,
        animSpeed: 10,
        knockbackResist: 0.8,
        spriteSheet: 'skeleton',
        spriteScale: 1.05,
        spriteOffsetY: 2,
        contactWindup: 0.3,
        contactRecovery: 0.24,
        contactCooldown: 0.45,
        contactRange: 30,
        spawnThreat: 6,
        spawnWeight: 28,
        unlockWave: 0
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
        animFrames: 7,
        animSpeed: 6,
        knockbackResist: 0.5,
        spriteSheet: 'slime',
        spriteScale: 1.1,
        spriteOffsetY: 1,
        contactWindup: 0.38,
        contactRecovery: 0.28,
        contactCooldown: 0.48,
        contactRange: 26,
        spawnThreat: 4,
        spawnWeight: 40,
        unlockWave: 0
    },
    basic: {
        name: 'Basic',
        health: 26,
        damage: 8,
        speed: 45,
        xpValue: 5,
        color: '#f44',
        size: 12,
        sprite: 'basic',
        frameWidth: 32,
        frameHeight: 48,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 9,
        animSpeed: 9,
        knockbackResist: 1.0,
        spriteSheet: 'basic',
        spriteScale: 1.0,
        spriteOffsetY: 2,
        contactWindup: 0.26,
        contactRecovery: 0.22,
        contactCooldown: 0.38,
        contactRange: 28,
        spawnThreat: 5,
        spawnWeight: 24,
        unlockWave: 2
    },
    fast: {
        name: 'Fast',
        health: 18,
        damage: 6,
        speed: 85,
        xpValue: 8,
        color: '#4f4',
        size: 10,
        sprite: 'fast',
        frameWidth: 32,
        frameHeight: 32,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 7,
        animSpeed: 12,
        knockbackResist: 1.2,
        spriteSheet: 'fast',
        spriteScale: 0.95,
        spriteOffsetY: 1,
        contactWindup: 0.18,
        contactRecovery: 0.18,
        contactCooldown: 0.32,
        contactRange: 26,
        spawnThreat: 5,
        spawnWeight: 18,
        unlockWave: 2
    },
    tank: {
        name: 'Tank',
        health: 70,
        damage: 12,
        speed: 28,
        xpValue: 15,
        color: '#44f',
        size: 18,
        sprite: 'tank',
        frameWidth: 32,
        frameHeight: 48,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 9,
        animSpeed: 7,
        knockbackResist: 0.4,
        spriteSheet: 'tank',
        spriteScale: 1.18,
        spriteOffsetY: 2,
        contactWindup: 0.42,
        contactRecovery: 0.32,
        contactCooldown: 0.55,
        contactRange: 34,
        spawnThreat: 10,
        spawnWeight: 9,
        unlockWave: 4
    },
    elite: {
        name: 'Elite',
        health: 90,
        damage: 16,
        speed: 55,
        xpValue: 25,
        color: '#f4f',
        size: 16,
        sprite: 'elite',
        frameWidth: 32,
        frameHeight: 48,
        rows: { down: 0, left: 1, right: 2, up: 3 },
        animFrames: 9,
        animSpeed: 11,
        knockbackResist: 0.6,
        spriteSheet: 'elite',
        spriteScale: 1.12,
        spriteOffsetY: 2,
        contactWindup: 0.24,
        contactRecovery: 0.2,
        contactCooldown: 0.32,
        contactRange: 32,
        spawnThreat: 14,
        spawnWeight: 5,
        unlockWave: 6
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
    spriteSheet: SpriteSheet | null;
    spriteScale: number;
    spriteOffsetY: number;
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
    damageBlinkTimer: number;
    squashTimer: number;
    damageResolver: DamageResolver | null;
    attackTimeline: AttackTimeline<Entity>;
    contactAttack: AttackDefinition;
    contactHitApplied: boolean;
    contactRange: number;
    deathHandled: boolean;

    constructor(
        x: number,
        y: number,
        type: string = 'basic',
        config: GameConfig,
        spriteImage: HTMLImageElement | null = null,
        spriteSheet: SpriteSheet | null = null
    ) {
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
        this.spriteSheet = spriteSheet;
        this.spriteScale = typeDef.spriteScale || 1;
        this.spriteOffsetY = typeDef.spriteOffsetY || 0;
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
        this.damageBlinkTimer = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.squashTimer = 0;
        this.damageResolver = null;
        this.attackTimeline = new AttackTimeline<Entity>();
        this.contactAttack = {
            key: `${this.type}-contact`,
            timing: {
                windup: typeDef.contactWindup || 0.28,
                active: 0.06,
                recovery: typeDef.contactRecovery || 0.24,
                cooldown: typeDef.contactCooldown || 0.38
            },
            damageType: 'contact'
        };
        this.contactHitApplied = false;
        this.contactRange = typeDef.contactRange || this.size + 16;
        this.deathHandled = false;

        // Setup components
        this._setupComponents(typeDef, config);

        // Animator component for sprite-sheet enemies.
        if (this.spriteSheet) {
            const animator = new AnimatorComponent(this.spriteSheet);
            animator.setState('run', 'down');
            animator.setSpeed(Math.max(0.6, this.animSpeed / 10));
            this.addComponent(animator);
        }
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

        const combat = new CombatStateComponent('enemy', this.type);
        combat.setState('idle');
        this.addComponent(combat);
    }

    /**
     * Set the target to chase
     * @param {Entity} target
     */
    setTarget(target: Entity) {
        this.target = target;
    }

    setDamageResolver(resolver: DamageResolver | null) {
        this.damageResolver = resolver;
    }

    getCombatState() {
        return this.getComponent<CombatStateComponent>('CombatStateComponent');
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
    takeDamage(amount: number | DamagePayload, source: Entity | null = null) {
        if (this.damageResolver) {
            const payload = this._normalizeIncomingDamage(amount, source);
            return this.damageResolver.applyToEnemy(this, payload);
        }

        const health = this.getComponent<HealthComponent>('HealthComponent');
        const rawAmount = typeof amount === 'number' ? amount : amount.amount;
        if (health) {
            health.takeDamage(rawAmount, source);
        }

        if (source && Math.abs(this.knockbackVx) < 50 && Math.abs(this.knockbackVy) < 50) {
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            this.applyKnockback(dx / dist * 150, dy / dist * 150);
        }

        return null;
    }

    /**
     * Handle damage effect
     */
    _onDamage(amount: number) {
        this.hitFlash = true;
        this.hitFlashTimer = 0.1;
        this.damageBlinkTimer = 0.16;
    }

    /**
     * Handle death
     */
    _onDeath() {
        this.handleResolvedDeath();
    }

    handleResolvedDeath() {
        if (this.deathHandled) return;
        this.deathHandled = true;
        this.getCombatState()?.setState('dead');
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

    _normalizeIncomingDamage(amount: number | DamagePayload, source: Entity | null) {
        if (typeof amount !== 'number') {
            return amount;
        }

        return {
            id: `enemy-hit:${this.id}:${Math.random().toString(36).slice(2, 8)}`,
            source: this._toCombatSource(source),
            amount,
            baseAmount: amount,
            damageType: 'physical',
            invulnerabilityDuration: 0.05,
            staggerDuration: 0.08,
            knockback: source
                ? (() => {
                    const dx = this.x - source.x;
                    const dy = this.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    return {
                        x: dx / dist,
                        y: dy / dist,
                        force: 150
                    };
                })()
                : null
        } satisfies DamagePayload;
    }

    _toCombatSource(source: Entity | null): CombatSource | null {
        if (!source) return null;

        return {
            id: source.id,
            type: (source as { type?: string }).type || source.constructor.name || 'entity',
            faction: source.hasTag?.('player') ? 'player' : source.hasTag?.('enemy') ? 'enemy' : 'neutral',
            entity: source,
            x: source.x,
            y: source.y
        };
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

    canStartContactAttack(distanceToTarget: number) {
        const combat = this.getCombatState();
        return (
            !!combat &&
            combat.canAttack() &&
            this.attackTimeline.canStart() &&
            this.knockbackStunTime <= 0 &&
            distanceToTarget <= this.contactRange
        );
    }

    startContactAttack() {
        this.contactHitApplied = false;
        this.attackTimeline.start(this.contactAttack, this.target, {
            onStart: () => {
                this.getCombatState()?.setState('windup', this.contactAttack.timing.windup);
            },
            onPhaseChange: (change) => {
                if (change.phase === 'active') {
                    this.getCombatState()?.setState('active', this.contactAttack.timing.active);
                } else if (change.phase === 'recovery' || change.phase === 'cooldown') {
                    this.getCombatState()?.setState('recovery', change.phase === 'recovery'
                        ? this.contactAttack.timing.recovery
                        : this.contactAttack.timing.cooldown);
                }
            },
            onActiveTick: () => {
                if (this.contactHitApplied) return;
                if (!this.target || this.target.destroyed) return;

                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > this.contactRange + 8) return;

                const target = this.target as Entity & {
                    receiveHit?: (amount: DamagePayload) => unknown;
                };

                const dirX = distance > 0 ? dx / distance : 0;
                const dirY = distance > 0 ? dy / distance : 0;
                target.receiveHit?.({
                    id: `${this.type}-contact:${this.id}:${this.attackTimeline.attackId}`,
                    source: this._toCombatSource(this),
                    amount: this.damage,
                    baseAmount: this.damage,
                    damageType: 'contact',
                    invulnerabilityDuration: 0.4,
                    staggerDuration: 0.14,
                    knockback: {
                        x: dirX,
                        y: dirY,
                        force: 120
                    }
                });
                this.contactHitApplied = true;
            },
            onComplete: () => {
                this.contactHitApplied = false;
                if (!this.destroyed && !this.getCombatState()?.isDead()) {
                    this.getCombatState()?.setState('idle');
                }
            },
            onCancel: () => {
                this.contactHitApplied = false;
            }
        });
    }

    _updateFacing(dx: number, dy: number) {
        if (Math.abs(dx) > Math.abs(dy)) {
            this.facingDirection = dx > 0 ? 'right' : 'left';
        } else {
            this.facingDirection = dy > 0 ? 'down' : 'up';
        }
    }

    update(deltaTime: number) {
        // Update hit flash
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.hitFlash = false;
            }
        }

        if (this.damageBlinkTimer > 0) {
            this.damageBlinkTimer -= deltaTime;
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

        const movement = this.getComponent<MovementComponent>('MovementComponent');
        const combat = this.getCombatState();
        this.attackTimeline.update(deltaTime);

        if (movement) {
            movement.setInput(0, 0);
        }

        if (this.target && !this.target.destroyed) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0;
            if (dist > 0) {
                this._updateFacing(dx, dy);
            }

            let attackBusy = this.attackTimeline.isBusy();
            if (this.canStartContactAttack(dist)) {
                this.startContactAttack();
                attackBusy = true;
            }

            if (!attackBusy && this.knockbackStunTime <= 0 && combat?.canMove() && movement) {
                if (dist > this.contactRange * 0.9) {
                    movement.setInput(dx / dist, dy / dist);
                }
            }
        }

        if (this.knockbackStunTime > 0 || combat?.state === 'hurt' || combat?.state === 'staggered') {
            movement?.setInput(0, 0);
        }

        const animator = this.getComponent<AnimatorComponent>('AnimatorComponent');
        if (animator) {
            const moving = movement?.isMoving() || false;
            const state = this.attackTimeline.phase === 'windup' || this.attackTimeline.phase === 'active'
                ? 'attack'
                : combat?.state === 'hurt'
                    ? 'hurt'
                    : moving
                        ? 'run'
                        : 'idle';
            animator.setState(state, this.facingDirection);
            animator.setSpeed(Math.max(0.6, this.animSpeed / 10));
        } else {
            // Legacy frame animation fallback (image-sheet without YAML).
            this.animTimer += deltaTime * this.animSpeed;
            if (this.animTimer >= 1) {
                this.animTimer -= 1;
                this.currentFrame = (this.currentFrame + 1) % this.animFrames;
            }
        }

        if (
            combat &&
            combat.state !== 'hurt' &&
            combat.state !== 'staggered' &&
            combat.state !== 'dying' &&
            combat.state !== 'dead' &&
            this.attackTimeline.phase === 'idle'
        ) {
            combat.setState(movement?.isMoving() ? 'moving' : 'idle');
        }

        super.update(deltaTime);
    }

    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (this.damageBlinkTimer > 0) {
            const blinkPhase = Math.floor(this.damageBlinkTimer * 32);
            if (blinkPhase % 2 === 1) return;
        }

        this._drawShadow(ctx);
        this._drawAttackTelegraph(ctx);

        const animator = this.getComponent<AnimatorComponent>('AnimatorComponent');
        if (animator && this.spriteSheet) {
            this._drawAnimatedSprite(ctx, animator);
        } else if (this.spriteImage && this.spriteImage.complete) {
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

    _drawAttackTelegraph(ctx: CanvasRenderingContext2D) {
        if (this.attackTimeline.phase !== 'windup') return;

        const progress = this.attackTimeline.getPhaseProgress();
        const radius = this.contactRange + 4 + progress * 6;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 90, 90, ${0.25 + progress * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawShadow(ctx: CanvasRenderingContext2D) {
        const animator = this.getComponent<AnimatorComponent>('AnimatorComponent');
        const frame = animator?.animator.getCurrentFrameData();
        const frameWidth = frame?.width ? frame.width * this.spriteScale * Math.abs(this.scaleX) : this.size * 2;
        const frameHeight = frame?.height ? frame.height * this.spriteScale * Math.abs(this.scaleY) : this.size * 2;

        const shadowRadiusX = Math.max(this.size * 0.7, frameWidth * 0.23);
        const shadowRadiusY = Math.max(this.size * 0.28, frameHeight * 0.1);
        const shadowY = this.y + Math.max(this.size * 0.7, frameHeight * 0.25);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, shadowY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawAnimatedSprite(ctx: CanvasRenderingContext2D, animator: AnimatorComponent) {
        if (!this.spriteSheet) return;
        const animationName = animator.animator.getAnimationName();
        if (!animationName) return;

        this.spriteSheet.drawFrame(
            ctx,
            animationName,
            animator.animator.currentFrame,
            this.x,
            this.y + this.spriteOffsetY,
            {
                flipX: animator.animator.flipX,
                flipY: animator.animator.flipY,
                rotation: this.rotation,
                scaleX: this.spriteScale * this.scaleX,
                scaleY: this.spriteScale * this.scaleY,
                alpha: 1,
                tint: this.hitFlash ? '#ffffff' : this.attackTimeline.phase === 'windup' ? '#ff8080' : null,
                tintAlpha: this.hitFlash ? 0.55 : this.attackTimeline.phase === 'windup' ? 0.22 : 0
            }
        );
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

        // Draw sprite centered
        const drawWidth = this.frameWidth;
        const drawHeight = this.frameHeight;
        ctx.drawImage(
            this.spriteImage,
            srcX, srcY, this.frameWidth, this.frameHeight,
            -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight
        );

        if (this.hitFlash) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        }

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
