// File: src/weapons/MagicMissiles.ts

import { Weapon, type WeaponUpgradeInfo } from './Weapon';
import { Projectile } from '../entities/Projectile';
import type { Enemy } from '../entities/Enemy';

export class MagicMissiles extends Weapon {
    projectileCount: number;
    projectileSpeed: number;
    piercing: number;
    projectiles: Projectile[];
    color: string;

    constructor(owner: Weapon['owner'], options: { damage?: number; cooldown?: number } = {}) {
        super(owner, {
            name: 'Magic Missiles',
            damage: 20,
            cooldown: 0.8,
            ...options
        });

        // Missile properties
        this.projectileCount = 1;
        this.projectileSpeed = 350;
        this.piercing = 1;

        // Active projectiles
        this.projectiles = [];

        // Visual
        this.color = '#f6f';
    }

    _applyUpgrade() {
        switch (this.level) {
            case 2:
                this.damage = 25;
                this.cooldown = 0.7;
                break;
            case 3:
                this.projectileCount = 2;
                this.damage = 30;
                break;
            case 4:
                this.piercing = 2;
                this.damage = 35;
                break;
            case 5:
                this.projectileCount = 3;
                this.cooldown = 0.6;
                break;
            case 6:
                this.damage = 45;
                this.projectileSpeed = 400;
                break;
            case 7:
                this.projectileCount = 4;
                this.piercing = 3;
                break;
            case 8:
                this.projectileCount = 5;
                this.damage = 55;
                this.cooldown = 0.5;
                break;
        }
    }

    /**
     * Find nearest enemy
     * @param {Entity[]} enemies
     * @returns {Entity|null}
     */
    findTarget(enemies: Enemy[]) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const enemy of enemies) {
            if (enemy.destroyed) continue;

            const dx = enemy.x - this.owner.x;
            const dy = enemy.y - this.owner.y;
            const dist = dx * dx + dy * dy;

            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    _doFire(enemies: Enemy[]) {
        const targets: Enemy[] = [];

        // Find multiple targets if we shoot multiple projectiles
        for (let i = 0; i < this.projectileCount; i++) {
            // Find target not already targeted
            let target = null;
            let nearestDist = Infinity;

            for (const enemy of enemies) {
                if (enemy.destroyed) continue;
                if (targets.includes(enemy)) continue;

                const dx = enemy.x - this.owner.x;
                const dy = enemy.y - this.owner.y;
                const dist = dx * dx + dy * dy;

                if (dist < nearestDist) {
                    nearestDist = dist;
                    target = enemy;
                }
            }

            if (target) {
                targets.push(target);
            }
        }

        // Spawn projectiles
        for (let i = 0; i < this.projectileCount; i++) {
            const target = targets[i] || targets[0];
            if (!target) continue;

            const dx = target.x - this.owner.x;
            const dy = target.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            const damageCtx = this.getDamageContext(this.damage, 0.12);
            const finalDamage = damageCtx.damage;

            const projectile = new Projectile(this.owner.x, this.owner.y, {
                damage: finalDamage,
                speed: this.projectileSpeed,
                dirX: dx / dist,
                dirY: dy / dist,
                size: 6,
                color: this.color,
                owner: this.owner,
                piercing: this.piercing,
                homing: true,
                homingStrength: 3,
                target: target,
                lifetime: 3
            });

            this.projectiles.push(projectile);
        }
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        // Update cooldown and auto-fire
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        // Only fire if there are enemies
        if (this.canFire() && enemies.length > 0) {
            this.fire(enemies);
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update(deltaTime);

            // Check collision with enemies
            for (const enemy of enemies) {
                if (enemy.destroyed) continue;
                if (!projectile.canHit(enemy)) continue;

                const dx = enemy.x - projectile.x;
                const dy = enemy.y - projectile.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < projectile.size + enemy.size) {
                    enemy.takeDamage(projectile.damage, this.owner);
                    projectile.registerHit(enemy);
                }
            }

            // Remove dead projectiles
            if (projectile.destroyed) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        for (const projectile of this.projectiles) {
            projectile.draw(ctx);
        }
    }

    getUpgradeInfo(): WeaponUpgradeInfo & { projectileCount: number; piercing: number } {
        return {
            ...super.getUpgradeInfo(),
            projectileCount: this.projectileCount,
            piercing: this.piercing
        };
    }
}
