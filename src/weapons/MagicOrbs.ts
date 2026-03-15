// File: src/weapons/MagicOrbs.ts

import { Weapon, type WeaponUpgradeInfo } from './Weapon';
import { MathUtils } from '../core/Math';
import type { Enemy } from '../entities/Enemy';

export class MagicOrbs extends Weapon {
    orbCount: number;
    orbRadius: number;
    orbitRadius: number;
    rotationSpeed: number;
    rotation: number;
    color: string;
    glowColor: string;

    constructor(owner: Weapon['owner'], options: { damage?: number; cooldown?: number } = {}) {
        super(owner, {
            name: 'Magic Orbs',
            damage: 15,
            cooldown: 0, // No cooldown, always active
            ...options
        });

        // Orb properties
        this.orbCount = 2;
        this.orbRadius = 8;
        this.orbitRadius = 50;
        this.rotationSpeed = 2; // radians per second
        this.rotation = 0;

        // Visual
        this.color = '#66f';
        this.glowColor = 'rgba(102, 102, 255, 0.3)';
    }

    _applyUpgrade() {
        // Upgrade progression
        switch (this.level) {
            case 2:
                this.orbCount = 3;
                this.damage = 20;
                break;
            case 3:
                this.orbCount = 4;
                this.damage = 25;
                break;
            case 4:
                this.orbCount = 5;
                this.damage = 30;
                this.orbitRadius = 60;
                break;
            case 5:
                this.orbCount = 6;
                this.damage = 35;
                break;
            case 6:
                this.orbCount = 7;
                this.damage = 40;
                this.orbitRadius = 70;
                break;
            case 7:
                this.orbCount = 8;
                this.damage = 45;
                break;
            case 8:
                this.damage = 50;
                this.rotationSpeed = 3;
                break;
        }
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        this.hitRegistry.tick(deltaTime);

        // Update rotation
        this.rotation += this.rotationSpeed * deltaTime;

        // Check collision with enemies
        const angleStep = (Math.PI * 2) / this.orbCount;

        for (let i = 0; i < this.orbCount; i++) {
            const angle = this.rotation + i * angleStep;
            const orbX = this.owner.x + Math.cos(angle) * this.orbitRadius;
            const orbY = this.owner.y + Math.sin(angle) * this.orbitRadius;
            const hitChannel = `magic-orb:${i}`;

            for (const enemy of enemies) {
                if (!this.hitRegistry.canHit(hitChannel, enemy.id)) continue;

                const dx = enemy.x - orbX;
                const dy = enemy.y - orbY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.orbRadius + enemy.size) {
                    const damageCtx = this.getDamageContext(this.damage, 0.07);
                    enemy.takeDamage(
                        this.buildDamagePayload(
                            `${hitChannel}:${enemy.id}`,
                            damageCtx.damage,
                            'arcane',
                            {
                                crit: damageCtx.crit,
                                staggerDuration: 0.05,
                                invulnerabilityDuration: 0.05,
                                knockback: {
                                    x: dx / (dist || 1),
                                    y: dy / (dist || 1),
                                    force: 120
                                }
                            }
                        )
                    );
                    this.hitRegistry.registerHit(hitChannel, enemy.id, 0.24);
                }
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const angleStep = (Math.PI * 2) / this.orbCount;

        for (let i = 0; i < this.orbCount; i++) {
            const angle = this.rotation + i * angleStep;
            const orbX = this.owner.x + Math.cos(angle) * this.orbitRadius;
            const orbY = this.owner.y + Math.sin(angle) * this.orbitRadius;

            // Draw glow
            ctx.fillStyle = this.glowColor;
            ctx.beginPath();
            ctx.arc(orbX, orbY, this.orbRadius * 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw orb
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(orbX, orbY, this.orbRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(orbX - this.orbRadius * 0.3, orbY - this.orbRadius * 0.3, this.orbRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    getUpgradeInfo(): WeaponUpgradeInfo & { orbCount: number; orbitRadius: number } {
        return {
            ...super.getUpgradeInfo(),
            orbCount: this.orbCount,
            orbitRadius: this.orbitRadius
        };
    }
}
