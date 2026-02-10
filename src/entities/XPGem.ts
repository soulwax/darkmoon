// File: src/entities/XPGem.ts

import { Entity } from '../ecs/Entity';
import { eventBus, GameEvents } from '../core/EventBus';
import type { Player } from './Player';

export class XPGem extends Entity {
    value: number;
    size: number;
    collected: boolean;
    collecting: boolean;
    collectSpeed: number;
    collectTarget: Player | null;
    bobOffset: number;
    bobSpeed: number;
    bobAmount: number;
    shimmerTime: number;
    shimmerSpeed: number;
    color: string;
    lifetime: number;
    age: number;
    fadeStart: number;
    alpha: number;
    burstVx: number;
    burstVy: number;
    burstTimeRemaining: number;
    burstDrag: number;
    magnetDelay: number;

    constructor(x: number, y: number, value: number = 5) {
        super(x, y);

        this.addTag('xp');

        this.value = value;
        this.size = 8 + Math.min(value / 5, 4); // Size scales with value

        // Collection state
        this.collected = false;
        this.collecting = false;
        this.collectSpeed = 400;

        // Target to move towards when collecting
        this.collectTarget = null;

        // Visual effects
        this.bobOffset = Math.random() * Math.PI * 2;
        this.bobSpeed = 3;
        this.bobAmount = 2;

        this.shimmerTime = 0;
        this.shimmerSpeed = 5;

        // Color based on value
        this.color = value >= 20 ? '#ff0' : value >= 10 ? '#4ff' : '#4f4';

        // Lifetime (despawn if not collected)
        this.lifetime = 30; // seconds
        this.age = 0;

        // Fade out near end of life
        this.fadeStart = 25;
        this.alpha = 1;

        // Spawn burst before magnet behavior kicks in.
        const angle = Math.random() * Math.PI * 2;
        const burstSpeed = 90 + Math.random() * 110;
        this.burstVx = Math.cos(angle) * burstSpeed;
        this.burstVy = Math.sin(angle) * burstSpeed;
        this.burstTimeRemaining = 0.18 + Math.random() * 0.08;
        this.burstDrag = 11;
        this.magnetDelay = 0.16;
    }

    /**
     * Update XP gem
     * @param {number} deltaTime
     * @param {Entity} player
     * @param {number} pickupRange
     */
    update(deltaTime: number, player: Player | null = null, pickupRange: number = 50) {
        if (this.collected) return;

        this.age += deltaTime;
        this.shimmerTime += deltaTime;

        // Check lifetime
        if (this.age >= this.lifetime) {
            this.collected = true;
            this.destroy();
            return;
        }

        // Fade out
        if (this.age >= this.fadeStart) {
            this.alpha = 1 - (this.age - this.fadeStart) / (this.lifetime - this.fadeStart);
        }

        // Initial outward burst.
        if (this.burstTimeRemaining > 0 && !this.collecting) {
            this.burstTimeRemaining -= deltaTime;
            this.x += this.burstVx * deltaTime;
            this.y += this.burstVy * deltaTime;

            const drag = Math.max(0, 1 - this.burstDrag * deltaTime);
            this.burstVx *= drag;
            this.burstVy *= drag;
        }

        // Check if player is in pickup range
        if (player && !this.collecting && this.age >= this.magnetDelay) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < pickupRange) {
                this.collecting = true;
                this.collectTarget = player;
            }
        }

        // Move towards player when collecting
        if (this.collecting && this.collectTarget) {
            const dx = this.collectTarget.x - this.x;
            const dy = this.collectTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 16) {
                // Collected!
                this.collected = true;

                eventBus.emit(GameEvents.XP_COLLECTED, {
                    gem: this,
                    value: this.value,
                    x: this.x,
                    y: this.y
                });

                this.destroy();
            } else {
                // Move towards player with acceleration
                const speed = this.collectSpeed * (1 + (pickupRange - dist) / pickupRange);
                this.x += (dx / dist) * speed * deltaTime;
                this.y += (dy / dist) * speed * deltaTime;
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D, camera?: unknown) {
        if (this.collected) return;

        // Calculate bob offset
        const bob = Math.sin(this.age * this.bobSpeed + this.bobOffset) * this.bobAmount;
        const drawY = this.y + bob;

        // Draw glow
        const gradient = ctx.createRadialGradient(
            this.x, drawY, 0,
            this.x, drawY, this.size * 2
        );
        gradient.addColorStop(0, this.color + '44');
        gradient.addColorStop(1, this.color + '00');

        ctx.globalAlpha = this.alpha;

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, drawY, this.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw gem body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, drawY, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw shimmer highlight
        const shimmerX = Math.cos(this.shimmerTime * this.shimmerSpeed) * this.size * 0.3;
        const shimmerY = Math.sin(this.shimmerTime * this.shimmerSpeed) * this.size * 0.3;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x + shimmerX - this.size * 0.2, drawY + shimmerY - this.size * 0.2, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
    }
}
