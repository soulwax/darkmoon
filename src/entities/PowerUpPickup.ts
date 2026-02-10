// File: src/entities/PowerUpPickup.ts

import { Entity } from '../ecs/Entity';
import { eventBus, GameEvents } from '../core/EventBus';
import { PowerUps, type PowerUpType } from '../powerups/PowerUps';
import type { Player } from './Player';

export class PowerUpPickup extends Entity {
    type: PowerUpType;
    collected: boolean;
    collecting: boolean;
    collectSpeed: number;
    collectTarget: Player | null;
    size: number;
    lifetime: number;
    age: number;
    alpha: number;

    constructor(x: number, y: number, type: PowerUpType) {
        super(x, y);

        this.addTag('powerup');

        this.type = type;
        this.collected = false;
        this.collecting = false;
        this.collectSpeed = 420;
        this.collectTarget = null;

        this.size = 11;
        this.lifetime = 25;
        this.age = 0;
        this.alpha = 1;
    }

    update(deltaTime: number, player: Player | null = null, pickupRange: number = 50) {
        if (this.collected) return;

        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            this.collected = true;
            this.destroy();
            return;
        }

        // Start collecting when the player is close enough.
        if (player && !this.collecting) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < pickupRange) {
                this.collecting = true;
                this.collectTarget = player;
            }
        }

        // Move toward the player.
        if (this.collecting && this.collectTarget) {
            const dx = this.collectTarget.x - this.x;
            const dy = this.collectTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist < 18) {
                this.collected = true;
                eventBus.emit(GameEvents.POWERUP_COLLECTED, {
                    powerup: this,
                    type: this.type,
                    x: this.x,
                    y: this.y
                });
                this.destroy();
                return;
            }

            const speed = this.collectSpeed * (1 + (pickupRange - Math.min(pickupRange, dist)) / pickupRange);
            this.x += (dx / dist) * speed * deltaTime;
            this.y += (dy / dist) * speed * deltaTime;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.collected) return;

        const def = PowerUps[this.type];
        const pulse = 0.85 + Math.sin(this.age * 6) * 0.15;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        // Glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.2);
        gradient.addColorStop(0, `${def.color}66`);
        gradient.addColorStop(1, `${def.color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, this.x, this.y + 1);

        ctx.restore();
    }
}
