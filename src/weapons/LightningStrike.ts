// File: src/weapons/LightningStrike.ts

import { Weapon, type WeaponUpgradeInfo } from './Weapon';
import { MathUtils } from '../core/Math';
import type { Enemy } from '../entities/Enemy';

type StrikeTarget = Enemy | { x: number; y: number; isRandom: true };

class LightningBolt {
    x: number;
    y: number;
    radius: number;
    damage: number;
    lifetime: number;
    age: number;
    dead: boolean;
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;

    constructor(x: number, y: number, radius: number, damage: number) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.damage = damage;

        this.lifetime = 0.3;
        this.age = 0;
        this.dead = false;

        // Generate lightning bolt segments
        this.segments = this._generateSegments();
    }

    _generateSegments() {
        const segments = [];
        const branchCount = MathUtils.randomInt(3, 6);

        for (let b = 0; b < branchCount; b++) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const length = this.radius * MathUtils.random(0.5, 1);
            const segmentCount = MathUtils.randomInt(3, 6);

            let currentX = this.x;
            let currentY = this.y;

            for (let i = 0; i < segmentCount; i++) {
                const segLength = length / segmentCount;
                const deviation = MathUtils.random(-20, 20);
                const segAngle = angle + MathUtils.degToRad(deviation);

                const nextX = currentX + Math.cos(segAngle) * segLength;
                const nextY = currentY + Math.sin(segAngle) * segLength;

                segments.push({
                    x1: currentX,
                    y1: currentY,
                    x2: nextX,
                    y2: nextY
                });

                currentX = nextX;
                currentY = nextY;
            }
        }

        return segments;
    }

    update(deltaTime: number) {
        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            this.dead = true;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.dead) return;

        const alpha = 1 - (this.age / this.lifetime);

        // Draw area fill
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw lightning bolts
        ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const seg of this.segments) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
        }

        // Draw glow
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1;

        for (const seg of this.segments) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
        }

        // Draw center flash
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class LightningStrike extends Weapon {
    strikeCount: number;
    strikeRadius: number;
    range: number;
    strikes: LightningBolt[];
    color: string;

    constructor(owner: Weapon['owner'], options: { damage?: number; cooldown?: number } = {}) {
        super(owner, {
            name: 'Lightning Strike',
            damage: 40,
            cooldown: 2.0,
            ...options
        });

        // Strike properties
        this.strikeCount = 1;
        this.strikeRadius = 40;
        this.range = 300; // Max range from player

        // Active strikes
        this.strikes = [];

        // Visual
        this.color = '#ff0';
    }

    _applyUpgrade() {
        switch (this.level) {
            case 2:
                this.damage = 50;
                this.cooldown = 1.8;
                break;
            case 3:
                this.strikeCount = 2;
                this.damage = 60;
                break;
            case 4:
                this.strikeRadius = 50;
                this.damage = 70;
                break;
            case 5:
                this.strikeCount = 3;
                this.cooldown = 1.5;
                break;
            case 6:
                this.damage = 85;
                this.strikeRadius = 60;
                break;
            case 7:
                this.strikeCount = 4;
                this.damage = 100;
                break;
            case 8:
                this.strikeCount = 5;
                this.damage = 120;
                this.cooldown = 1.2;
                break;
        }
    }

    _doFire(enemies: Enemy[]) {
        const validTargets = enemies.filter(e => {
            if (e.destroyed) return false;
            const dx = e.x - this.owner.x;
            const dy = e.y - this.owner.y;
            return dx * dx + dy * dy < this.range * this.range;
        });

        // Pick random targets
        const shuffled = [...validTargets].sort(() => Math.random() - 0.5);
        const targets: StrikeTarget[] = shuffled.slice(0, this.strikeCount);

        // If not enough targets, strike random positions
        while (targets.length < this.strikeCount) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const dist = MathUtils.random(50, this.range);
            targets.push({
                x: this.owner.x + Math.cos(angle) * dist,
                y: this.owner.y + Math.sin(angle) * dist,
                isRandom: true
            });
        }

        // Create strikes
        for (const target of targets) {
            const damageCtx = this.getDamageContext(this.damage, 0.1);
            const finalDamage = damageCtx.damage;

            const strike = new LightningBolt(
                target.x,
                target.y,
                this.strikeRadius,
                finalDamage
            );

            this.strikes.push(strike);

            // Damage enemies in radius
            if (!('isRandom' in target)) {
                for (const enemy of enemies) {
                    if (enemy.destroyed) continue;

                    const dx = enemy.x - target.x;
                    const dy = enemy.y - target.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < this.strikeRadius) {
                        enemy.takeDamage(finalDamage, this.owner);
                    }
                }
            }
        }
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        // Update cooldown and auto-fire
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        // Only fire if there are enemies in range
        if (this.canFire() && enemies.length > 0) {
            const hasValidTarget = enemies.some(e => {
                const dx = e.x - this.owner.x;
                const dy = e.y - this.owner.y;
                return dx * dx + dy * dy < this.range * this.range;
            });

            if (hasValidTarget) {
                this.fire(enemies);
            }
        }

        // Update strikes
        for (let i = this.strikes.length - 1; i >= 0; i--) {
            this.strikes[i].update(deltaTime);

            if (this.strikes[i].dead) {
                this.strikes.splice(i, 1);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        for (const strike of this.strikes) {
            strike.draw(ctx);
        }
    }

    getUpgradeInfo(): WeaponUpgradeInfo & { strikeCount: number; strikeRadius: number } {
        return {
            ...super.getUpgradeInfo(),
            strikeCount: this.strikeCount,
            strikeRadius: this.strikeRadius
        };
    }
}
