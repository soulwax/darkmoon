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
        this.slashWidth = options.slashWidth || 20;
        this.slashOffset = options.slashOffset || 28;
        this.knockback = options.knockback || 320;
        this.particleSystem = options.particleSystem || null;
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
}
