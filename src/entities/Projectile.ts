// File: src/entities/Projectile.ts

import { Entity } from '../ecs/Entity';
import { ColliderComponent } from '../ecs/components/ColliderComponent';
import { MathUtils } from '../core/Math';
import type { GameConfig } from '../config/GameConfig';

interface ProjectileOptions {
    damage?: number;
    speed?: number;
    size?: number;
    color?: string;
    owner?: Entity | null;
    dirX?: number;
    dirY?: number;
    lifetime?: number;
    piercing?: number;
    trailLength?: number;
    homing?: boolean;
    homingStrength?: number;
    target?: Entity | null;
    config?: GameConfig;
}

export class Projectile extends Entity {
    damage: number;
    speed: number;
    size: number;
    color: string;
    owner: Entity | null;
    dirX: number;
    dirY: number;
    lifetime: number;
    age: number;
    piercing: number;
    hitCount: number;
    hitEntities: Set<number>;
    trailLength: number;
    trail: Array<{ x: number; y: number }>;
    homing: boolean;
    homingStrength: number;
    target: Entity | null;

    constructor(x: number, y: number, options: ProjectileOptions = {}) {
        super(x, y);

        this.addTag('projectile');

        // Projectile properties
        this.damage = options.damage || 10;
        this.speed = options.speed || 300;
        this.size = options.size || 8;
        this.color = options.color || '#f6f';
        this.owner = options.owner || null;

        // Direction
        this.dirX = options.dirX || 0;
        this.dirY = options.dirY || 1;

        // Normalize direction
        const mag = Math.sqrt(this.dirX * this.dirX + this.dirY * this.dirY);
        if (mag > 0) {
            this.dirX /= mag;
            this.dirY /= mag;
        }

        // Velocity
        this.vx = this.dirX * this.speed;
        this.vy = this.dirY * this.speed;

        // Lifetime
        this.lifetime = options.lifetime || 3;
        this.age = 0;

        // Piercing (how many enemies can it hit)
        this.piercing = options.piercing || 1;
        this.hitCount = 0;
        this.hitEntities = new Set();

        // Trail effect
        this.trailLength = options.trailLength || 5;
        this.trail = [];

        // Homing
        this.homing = options.homing || false;
        this.homingStrength = options.homingStrength || 5;
        this.target = options.target || null;

        // Setup collider
        this._setupCollider(options.config);
    }

    _setupCollider(config?: GameConfig) {
        const collider = new ColliderComponent({
            type: 'circle',
            radius: this.size,
            layer: config?.collisionLayers?.projectiles || 16,
            isTrigger: true
        });
        this.addComponent(collider);
    }

    /**
     * Set target for homing
     * @param {Entity} target
     */
    setTarget(target: Entity) {
        this.target = target;
        this.homing = true;
    }

    /**
     * Check if projectile can hit an entity
     * @param {Entity} entity
     * @returns {boolean}
     */
    canHit(entity: Entity) {
        if (this.hitEntities.has(entity.id)) return false;
        if (entity === this.owner) return false;
        if (this.hitCount >= this.piercing) return false;
        return true;
    }

    /**
     * Register a hit on an entity
     * @param {Entity} entity
     */
    registerHit(entity: Entity) {
        this.hitEntities.add(entity.id);
        this.hitCount++;

        if (this.hitCount >= this.piercing) {
            this.destroy();
        }
    }

    update(deltaTime: number) {
        this.age += deltaTime;

        // Check lifetime
        if (this.age >= this.lifetime) {
            this.destroy();
            return;
        }

        // Homing behavior
        if (this.homing && this.target && !this.target.destroyed) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                // Gradually turn towards target
                const targetDirX = dx / dist;
                const targetDirY = dy / dist;

                this.dirX += (targetDirX - this.dirX) * this.homingStrength * deltaTime;
                this.dirY += (targetDirY - this.dirY) * this.homingStrength * deltaTime;

                // Renormalize
                const mag = Math.sqrt(this.dirX * this.dirX + this.dirY * this.dirY);
                if (mag > 0) {
                    this.dirX /= mag;
                    this.dirY /= mag;
                }

                this.vx = this.dirX * this.speed;
                this.vy = this.dirY * this.speed;
            }
        }

        // Store trail point
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }

        // Move
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        super.update(deltaTime);
    }

    draw(ctx: CanvasRenderingContext2D, camera?: unknown) {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color + '80';
            ctx.lineWidth = this.size * 0.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);

            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
        }

        // Draw glow
        ctx.fillStyle = this.color + '40';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw projectile body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw highlight
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}
