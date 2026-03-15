import { MathUtils } from '../core/Math';
import type { Enemy } from '../entities/Enemy';
import { Weapon, type WeaponUpgradeInfo } from './Weapon';

type StrikeTarget = Enemy | { x: number; y: number; isRandom: true };

interface PendingStrike {
    id: string;
    x: number;
    y: number;
    radius: number;
    telegraphTimer: number;
    telegraphDuration: number;
    damage: number;
    crit: boolean;
}

class LightningBolt {
    x: number;
    y: number;
    radius: number;
    lifetime: number;
    age: number;
    dead: boolean;
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;

    constructor(x: number, y: number, radius: number) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.lifetime = 0.3;
        this.age = 0;
        this.dead = false;
        this.segments = this._generateSegments();
    }

    _generateSegments() {
        const segments = [];
        const branchCount = MathUtils.randomInt(3, 6);

        for (let branch = 0; branch < branchCount; branch++) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const length = this.radius * MathUtils.random(0.5, 1);
            const segmentCount = MathUtils.randomInt(3, 6);
            let currentX = this.x;
            let currentY = this.y;

            for (let index = 0; index < segmentCount; index++) {
                const segLength = length / segmentCount;
                const deviation = MathUtils.random(-20, 20);
                const segAngle = angle + MathUtils.degToRad(deviation);
                const nextX = currentX + Math.cos(segAngle) * segLength;
                const nextY = currentY + Math.sin(segAngle) * segLength;
                segments.push({ x1: currentX, y1: currentY, x2: nextX, y2: nextY });
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

        const alpha = 1 - this.age / this.lifetime;
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const segment of this.segments) {
            ctx.beginPath();
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
            ctx.stroke();
        }

        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        for (const segment of this.segments) {
            ctx.beginPath();
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
            ctx.stroke();
        }

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
    pendingStrikes: PendingStrike[];
    telegraphDuration: number;

    constructor(owner: Weapon['owner'], options: { damage?: number; cooldown?: number } = {}) {
        super(owner, {
            name: 'Lightning Strike',
            damage: 40,
            cooldown: 2,
            ...options
        });

        this.strikeCount = 1;
        this.strikeRadius = 40;
        this.range = 300;
        this.strikes = [];
        this.pendingStrikes = [];
        this.telegraphDuration = 0.42;
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
        const validTargets = enemies.filter((enemy) => {
            if (enemy.destroyed) return false;
            const dx = enemy.x - this.owner.x;
            const dy = enemy.y - this.owner.y;
            return dx * dx + dy * dy < this.range * this.range;
        });

        const shuffled = [...validTargets].sort(() => Math.random() - 0.5);
        const targets: StrikeTarget[] = shuffled.slice(0, this.strikeCount);

        while (targets.length < this.strikeCount) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const distance = MathUtils.random(50, this.range);
            targets.push({
                x: this.owner.x + Math.cos(angle) * distance,
                y: this.owner.y + Math.sin(angle) * distance,
                isRandom: true
            });
        }

        for (let index = 0; index < targets.length; index++) {
            const target = targets[index];
            const damageContext = this.getDamageContext(this.damage, 0.1);
            this.pendingStrikes.push({
                id: `lightning:${this.owner.id}:${Date.now()}:${index}`,
                x: target.x,
                y: target.y,
                radius: this.strikeRadius,
                telegraphTimer: this.telegraphDuration,
                telegraphDuration: this.telegraphDuration,
                damage: damageContext.damage,
                crit: damageContext.crit
            });
        }
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        this.hitRegistry.tick(deltaTime);

        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        if (this.canFire() && enemies.some((enemy) => !enemy.destroyed)) {
            const hasValidTarget = enemies.some((enemy) => {
                const dx = enemy.x - this.owner.x;
                const dy = enemy.y - this.owner.y;
                return dx * dx + dy * dy < this.range * this.range;
            });

            if (hasValidTarget) {
                this.fire(enemies);
            }
        }

        for (let index = this.pendingStrikes.length - 1; index >= 0; index--) {
            const strike = this.pendingStrikes[index];
            strike.telegraphTimer -= deltaTime;

            if (strike.telegraphTimer > 0) {
                continue;
            }

            this.resolveStrike(strike, enemies);
            this.pendingStrikes.splice(index, 1);
        }

        for (let index = this.strikes.length - 1; index >= 0; index--) {
            this.strikes[index].update(deltaTime);
            if (this.strikes[index].dead) {
                this.strikes.splice(index, 1);
            }
        }
    }

    resolveStrike(strike: PendingStrike, enemies: Enemy[]) {
        this.strikes.push(new LightningBolt(strike.x, strike.y, strike.radius));

        for (const enemy of enemies) {
            if (enemy.destroyed) continue;
            const dx = enemy.x - strike.x;
            const dy = enemy.y - strike.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > strike.radius + enemy.size) continue;

            enemy.takeDamage(
                this.buildDamagePayload(
                    `${strike.id}:${enemy.id}`,
                    strike.damage,
                    'lightning',
                    {
                        crit: strike.crit,
                        staggerDuration: 0.18,
                        invulnerabilityDuration: 0.05,
                        knockback: {
                            x: dx / (distance || 1),
                            y: dy / (distance || 1),
                            force: 180
                        }
                    }
                )
            );
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        for (const strike of this.pendingStrikes) {
            const progress = 1 - strike.telegraphTimer / strike.telegraphDuration;
            const alpha = 0.12 + progress * 0.25;
            const pulse = 0.9 + Math.sin((1 - strike.telegraphTimer) * 18) * 0.08;

            ctx.save();
            ctx.strokeStyle = `rgba(255, 220, 100, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(strike.x, strike.y, strike.radius * pulse, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = `rgba(255, 235, 160, ${alpha * 0.35})`;
            ctx.beginPath();
            ctx.arc(strike.x, strike.y, strike.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

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

    cancel() {
        super.cancel();
        this.pendingStrikes = [];
        this.strikes = [];
    }
}
