// File: src/weapons/Longsword.ts

import { Weapon } from './Weapon';
import type { Direction } from '../core/Math';
import type { Enemy } from '../entities/Enemy';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { MovementComponent } from '../ecs/components/MovementComponent';
import type { AnimatorComponent } from '../ecs/components/AnimatorComponent';

export class Longsword extends Weapon {
    baseDamage: number;
    slashLength: number;
    slashWidth: number;
    slashOffset: number;
    knockback: number;
    particleSystem: ParticleSystem | null;
    slashActive: boolean;
    slashTimer: number;
    slashDuration: number;
    slashDirection: Direction;
    slashX: number;
    slashY: number;

    constructor(owner: Weapon['owner'], options: {
        damage?: number;
        cooldown?: number;
        slashLength?: number;
        slashWidth?: number;
        slashOffset?: number;
        knockback?: number;
        particleSystem?: ParticleSystem | null;
        slashDuration?: number;
    } = {}) {
        super(owner, {
            name: 'Longsword',
            damage: options.damage ?? 45,
            cooldown: options.cooldown ?? 0.9
        });

        this.baseDamage = options.damage ?? 45;
        this.slashLength = options.slashLength || 96;
        this.slashWidth = options.slashWidth || 8;
        this.slashOffset = options.slashOffset || 28;
        this.knockback = options.knockback || 320;
        this.particleSystem = options.particleSystem || null;

        // Slash visual state
        this.slashActive = false;
        this.slashTimer = 0;
        this.slashDuration = options.slashDuration || 0.11;
        this.slashDirection = 'down';
        this.slashX = 0;
        this.slashY = 0;
    }

    _applyUpgrade() {
        // Longsword upgrades could scale damage/size later.
    }

    /**
     * Manual trigger (Space)
     * @param {Entity[]} enemies
     */
    trigger(enemies: Enemy[] = []) {
        this.fire(enemies);
    }

    /**
     * Manual weapon: only update cooldown.
     */
    update(deltaTime: number) {
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        if (this.slashActive) {
            this.slashTimer -= deltaTime;
            if (this.slashTimer <= 0) {
                this.slashActive = false;
            }
        }
    }

    _doFire(enemies: Enemy[] = []) {
        const movement = this.owner.getComponent<MovementComponent>('MovementComponent');
        const facing = movement?.facingDirection || 'down';
        const horizontal = facing === 'left' || facing === 'right';

        let slashX = this.owner.x;
        let slashY = this.owner.y;
        if (facing === 'up') slashY -= this.slashOffset;
        else if (facing === 'down') slashY += this.slashOffset;
        else if (facing === 'left') slashX -= this.slashOffset;
        else if (facing === 'right') slashX += this.slashOffset;

        const halfWidth = this.slashWidth / 2;
        const halfLength = this.slashLength / 2;

        for (const enemy of enemies) {
            if (enemy.destroyed) continue;

            const dx = enemy.x - slashX;
            const dy = enemy.y - slashY;

            const inSlash = horizontal
                ? (Math.abs(dx) <= halfLength + enemy.size && Math.abs(dy) <= halfWidth + enemy.size)
                : (Math.abs(dx) <= halfWidth + enemy.size && Math.abs(dy) <= halfLength + enemy.size);

            if (inSlash) {
                const damageCtx = this.getDamageContext(this.damage, 0.08);
                const damage = damageCtx.damage;
                enemy.takeDamage(damage, this.owner);

                if (enemy.applyKnockback) {
                    const angle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
                    enemy.applyKnockback(Math.cos(angle) * this.knockback, Math.sin(angle) * this.knockback);
                }
            }
        }

        // Record slash visual
        this.slashActive = true;
        this.slashTimer = this.slashDuration;
        this.slashDirection = facing;
        this.slashX = slashX;
        this.slashY = slashY;

        // Play attack animation (vertical slash)
        const animator = this.owner.getComponent<AnimatorComponent>('AnimatorComponent');
        if (typeof (this.owner as any).lockAnimation === 'function') {
            (this.owner as any).lockAnimation('attack', facing, this.slashDuration * 1.6, 1.3);
        } else if (animator) {
            animator.setState('attack', facing);
        }

        // Particle slash effect
        this.particleSystem?.createSwordSlashVertical(slashX, slashY, {
            length: this.slashLength,
            width: this.slashWidth,
            direction: facing
        });
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.slashActive) return;

        const progress = 1 - (this.slashTimer / this.slashDuration);
        const alpha = Math.max(0, 1 - progress);
        const dirVec = {
            x: this.slashDirection === 'left' ? -1 : this.slashDirection === 'right' ? 1 : 0,
            y: this.slashDirection === 'up' ? -1 : this.slashDirection === 'down' ? 1 : 0
        };
        const slide = progress * 10;

        const drawX = this.slashX + dirVec.x * slide + dirVec.x * (this.slashLength * 0.15);
        const drawY = this.slashY + dirVec.y * slide + dirVec.y * (this.slashLength * 0.15);

        const halfW = this.slashWidth / 2;
        const halfL = this.slashLength / 2;
        const horizontal = dirVec.x !== 0;
        const drawWidth = horizontal ? this.slashLength : this.slashWidth;
        const drawHeight = horizontal ? this.slashWidth : this.slashLength;

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.globalAlpha = alpha;

        // Outer glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        if (horizontal) {
            ctx.fillRect(-halfL * 0.95, -halfW * 1.6, halfL * 1.9, halfW * 3.2);
        } else {
            ctx.fillRect(-halfW * 1.6, -halfL * 0.95, halfW * 3.2, halfL * 1.9);
        }

        // Core blade streak
        const gradient = horizontal
            ? ctx.createLinearGradient(0, -halfW, 0, halfW)
            : ctx.createLinearGradient(-halfW, 0, halfW, 0);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.35, 'rgba(210,225,255,0.9)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.65, 'rgba(200,210,245,0.85)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

        // Edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (horizontal) {
            ctx.moveTo(-halfL, -halfW + 0.5);
            ctx.lineTo(halfL, -halfW + 0.5);
        } else {
            ctx.moveTo(halfW - 0.5, -halfL);
            ctx.lineTo(halfW - 0.5, halfL);
        }
        ctx.stroke();

        ctx.restore();
    }
}
