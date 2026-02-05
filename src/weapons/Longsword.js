// File: src/weapons/Longsword.js
// Manual longsword slash with vertical particle effect

import { Weapon } from './Weapon.js';

export class Longsword extends Weapon {
    constructor(owner, options = {}) {
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
        this.slashDuration = options.slashDuration || 0.08;
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
    trigger(enemies = []) {
        this.fire(enemies);
    }

    /**
     * Manual weapon: only update cooldown.
     */
    update(deltaTime) {
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

    _doFire(enemies = []) {
        const movement = this.owner.getComponent?.('MovementComponent');
        const facing = movement?.facingDirection || 'down';

        let slashX = this.owner.x;
        let slashY = this.owner.y;
        if (facing === 'up') slashY -= this.slashOffset;
        else if (facing === 'down') slashY += this.slashOffset;
        else if (facing === 'left') slashX -= this.slashOffset;
        else if (facing === 'right') slashX += this.slashOffset;

        const halfWidth = this.slashWidth / 2;
        const halfLength = this.slashLength / 2;
        const damage = Math.floor(this.damage * (this.owner.stats?.damageMultiplier || 1));

        for (const enemy of enemies) {
            if (enemy.destroyed) continue;

            const dx = enemy.x - slashX;
            const dy = enemy.y - slashY;

            if (Math.abs(dx) <= halfWidth + enemy.size &&
                Math.abs(dy) <= halfLength + enemy.size) {
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
        this.slashDirection = facing === 'up' ? 'up' : 'down';
        this.slashX = slashX;
        this.slashY = slashY;

        // Play attack animation (vertical slash)
        const animator = this.owner.getComponent?.('AnimatorComponent');
        if (animator) {
            const attackDir = facing === 'up' ? 'up' : 'down';
            animator.setState('attack', attackDir);
        }

        // Particle slash effect
        this.particleSystem?.createSwordSlashVertical(slashX, slashY, {
            length: this.slashLength,
            width: this.slashWidth,
            direction: facing === 'up' ? 'up' : 'down'
        });
    }

    draw(ctx) {
        if (!this.slashActive) return;

        const progress = 1 - (this.slashTimer / this.slashDuration);
        const alpha = Math.max(0, 1 - progress);
        const dir = this.slashDirection === 'up' ? -1 : 1;
        const slide = progress * 10;

        const drawX = this.slashX;
        const drawY = this.slashY + dir * slide + dir * (this.slashLength * 0.15);

        const halfW = this.slashWidth / 2;
        const halfL = this.slashLength / 2;

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.globalAlpha = alpha;

        // Outer glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(-halfW * 1.6, -halfL * 0.95, halfW * 3.2, halfL * 1.9);

        // Core blade streak
        const gradient = ctx.createLinearGradient(-halfW, 0, halfW, 0);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.35, 'rgba(210,225,255,0.9)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.65, 'rgba(200,210,245,0.85)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-halfW, -halfL, this.slashWidth, this.slashLength);

        // Edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(halfW - 0.5, -halfL);
        ctx.lineTo(halfW - 0.5, halfL);
        ctx.stroke();

        ctx.restore();
    }
}
