import { AttackTimeline } from '../combat/AttackTimeline';
import type { AttackDefinition } from '../combat/CombatTypes';
import { MathUtils, type Direction } from '../core/Math';
import type { Enemy } from '../entities/Enemy';
import type { AnimatorComponent } from '../ecs/components/AnimatorComponent';
import { Weapon } from './Weapon';

interface SwordContext {
    targetAngle: number;
    direction: Direction;
}

export class Sword extends Weapon {
    baseDamage: number;
    baseKnockback: number;
    baseCooldown: number;
    baseRange: number;
    baseArc: number;
    bladeLength: number;
    bladeWidth: number;
    trailPositions: Array<{ angle: number; alpha: number }>;
    maxTrailLength: number;
    autoAttack: boolean;
    nearestEnemy: Enemy | null;
    swingDirection: number;
    timeline: AttackTimeline<SwordContext>;
    currentEnemies: Enemy[];

    constructor(owner: Weapon['owner']) {
        super(owner);

        this.name = 'Sword';
        this.maxLevel = 8;
        this.baseDamage = 12;
        this.baseKnockback = 300;
        this.baseCooldown = 0.36;
        this.baseRange = 60;
        this.baseArc = Math.PI * 0.75;
        this.bladeLength = 28;
        this.bladeWidth = 6;
        this.trailPositions = [];
        this.maxTrailLength = 12;
        this.autoAttack = true;
        this.nearestEnemy = null;
        this.swingDirection = 1;
        this.timeline = new AttackTimeline<SwordContext>();
        this.currentEnemies = [];
    }

    _applyUpgrade() {
        // Sword scales from getters based on level.
    }

    get damage() {
        return this.baseDamage * (1 + (this.level - 1) * 0.2);
    }

    set damage(value: number) {
        this.baseDamage = value;
    }

    get knockback() {
        return this.baseKnockback * (1 + (this.level - 1) * 0.15);
    }

    get cooldown() {
        return Math.max(0.18, this.baseCooldown * (1 - (this.level - 1) * 0.06));
    }

    set cooldown(value: number) {
        this.baseCooldown = value;
    }

    get range() {
        return this.baseRange * (1 + (this.level - 1) * 0.08);
    }

    get arc() {
        return Math.min(Math.PI, this.baseArc * (1 + (this.level - 1) * 0.05));
    }

    get attackDefinition(): AttackDefinition {
        return {
            key: 'sword_slash',
            timing: {
                windup: 0.06,
                active: 0.11,
                recovery: 0.1,
                cooldown: this.cooldown
            },
            damageType: 'physical'
        };
    }

    findNearestEnemy(enemies: Enemy[]) {
        let nearest: Enemy | null = null;
        let nearestDistSq = this.range * this.range * 1.8;

        for (const enemy of enemies) {
            if (enemy.destroyed) continue;

            const dx = enemy.x - this.owner.x;
            const dy = enemy.y - this.owner.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = enemy;
            }
        }

        return nearest;
    }

    startSwing(targetAngle: number) {
        if (!this.timeline.canStart()) return false;

        let direction: Direction = 'down';
        if (targetAngle > -Math.PI * 0.75 && targetAngle < -Math.PI * 0.25) direction = 'up';
        else if (targetAngle >= -Math.PI * 0.25 && targetAngle <= Math.PI * 0.25) direction = 'right';
        else if (targetAngle > Math.PI * 0.25 && targetAngle < Math.PI * 0.75) direction = 'down';
        else direction = 'left';

        const definition = this.attackDefinition;
        const totalAttackDuration =
            definition.timing.windup + definition.timing.active + definition.timing.recovery;

        this.swingDirection = Math.random() > 0.5 ? 1 : -1;
        this.trailPositions = [];
        this.hitRegistry.clearChannel(definition.key);

        return this.timeline.start(definition, { targetAngle, direction }, {
            onStart: ({ context }) => {
                this.owner.setCombatActionState('windup', definition.timing.windup);
                this.owner.lockAnimation('attack', context?.direction || direction, totalAttackDuration, 1.2);
            },
            onPhaseChange: ({ phase }) => {
                if (phase === 'active') {
                    this.owner.setCombatActionState('active', definition.timing.active);
                } else if (phase === 'recovery' || phase === 'cooldown') {
                    this.owner.setCombatActionState('recovery', phase === 'recovery'
                        ? definition.timing.recovery
                        : definition.timing.cooldown);
                }
            },
            onActiveTick: ({ attackId, context }) => {
                const currentAngle = this.getCurrentSwingAngle();
                this.trailPositions.push({ angle: currentAngle, alpha: 1 });
                while (this.trailPositions.length > this.maxTrailLength) {
                    this.trailPositions.shift();
                }
                for (let i = 0; i < this.trailPositions.length; i++) {
                    this.trailPositions[i].alpha = ((i + 1) / this.trailPositions.length) * 0.6;
                }

                this.checkHits(attackId, context?.targetAngle ?? targetAngle);
            },
            onComplete: () => {
                this.owner.clearCombatActionState();
                this.trailPositions = [];
            },
            onCancel: () => {
                this.owner.clearCombatActionState();
                this.trailPositions = [];
            }
        });
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        this.currentEnemies = enemies;
        this.hitRegistry.tick(deltaTime);

        if (this.autoAttack && this.timeline.canStart()) {
            this.nearestEnemy = this.findNearestEnemy(enemies);
            if (this.nearestEnemy) {
                const dx = this.nearestEnemy.x - this.owner.x;
                const dy = this.nearestEnemy.y - this.owner.y;
                this.startSwing(Math.atan2(dy, dx));
            }
        }

        this.timeline.update(deltaTime);
    }

    getCurrentSwingAngle() {
        const context = this.timeline.context;
        const targetAngle = context?.targetAngle ?? 0;
        const halfArc = this.arc / 2;
        const startAngle = targetAngle - halfArc * this.swingDirection;
        const endAngle = targetAngle + halfArc * this.swingDirection;
        const progress = this.timeline.phase === 'active'
            ? MathUtils.easeOutQuad(this.timeline.getPhaseProgress())
            : this.timeline.phase === 'recovery'
                ? 1
                : 0;

        return MathUtils.lerp(startAngle, endAngle, progress);
    }

    checkHits(attackId: string, targetAngle: number) {
        const currentAngle = this.getCurrentSwingAngle();
        const hitWindow = this.arc * 0.35;

        for (const enemy of this.currentEnemies) {
            if (enemy.destroyed) continue;
            if (!this.hitRegistry.canHit(attackId, enemy.id)) continue;

            const dx = enemy.x - this.owner.x;
            const dy = enemy.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > this.range + enemy.size) continue;

            const enemyAngle = Math.atan2(dy, dx);
            const angleDiff = MathUtils.normalizeAngle(enemyAngle - currentAngle);
            if (Math.abs(angleDiff) > hitWindow) continue;

            const damageContext = this.getDamageContext(this.damage, 0.08);
            const knockbackX = Math.cos(enemyAngle);
            const knockbackY = Math.sin(enemyAngle);

            enemy.takeDamage(
                this.buildDamagePayload(
                    `${attackId}:${enemy.id}`,
                    damageContext.damage,
                    'physical',
                    {
                        crit: damageContext.crit,
                        staggerDuration: 0.09,
                        invulnerabilityDuration: 0.05,
                        knockback: {
                            x: knockbackX,
                            y: knockbackY,
                            force: this.knockback
                        }
                    }
                )
            );

            this.hitRegistry.registerHit(attackId, enemy.id, 999);
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.timeline.phase === 'idle' && this.trailPositions.length === 0) {
            return;
        }

        const slashRadius = this.range * 0.8;
        const currentAngle = this.getCurrentSwingAngle();
        const trailStartAngle = this.trailPositions[0]?.angle ?? currentAngle;
        const trailEndAngle = this.trailPositions[this.trailPositions.length - 1]?.angle ?? currentAngle;

        ctx.save();
        ctx.translate(this.owner.x, this.owner.y);

        if (this.trailPositions.length >= 2) {
            ctx.beginPath();
            ctx.arc(0, 0, slashRadius + 8, trailStartAngle, trailEndAngle, this.swingDirection < 0);
            ctx.strokeStyle = 'rgba(150, 200, 255, 0.18)';
            ctx.lineWidth = 16;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, slashRadius, trailStartAngle, trailEndAngle, this.swingDirection < 0);
            const gradient = ctx.createRadialGradient(0, 0, slashRadius - 10, 0, 0, slashRadius + 10);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
            gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.82)');
            gradient.addColorStop(1, 'rgba(150, 180, 255, 0.28)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        if (this.timeline.phase === 'active') {
            const tipX = Math.cos(currentAngle) * slashRadius;
            const tipY = Math.sin(currentAngle) * slashRadius;

            ctx.beginPath();
            ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        ctx.restore();
    }

    cancel() {
        super.cancel();
        this.timeline.cancel();
        this.trailPositions = [];
        this.owner.clearCombatActionState();
    }
}
