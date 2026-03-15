import { AttackTimeline } from '../combat/AttackTimeline';
import type { AttackDefinition } from '../combat/CombatTypes';
import type { Direction } from '../core/Math';
import type { Enemy } from '../entities/Enemy';
import type { AnimatorComponent } from '../ecs/components/AnimatorComponent';
import type { MovementComponent } from '../ecs/components/MovementComponent';
import type { ParticleSystem } from '../systems/ParticleSystem';
import { Weapon } from './Weapon';

interface LongswordContext {
    direction: Direction;
    slashX: number;
    slashY: number;
}

export class Longsword extends Weapon {
    baseDamage: number;
    baseCooldown: number;
    slashLength: number;
    slashWidth: number;
    slashOffset: number;
    knockback: number;
    particleSystem: ParticleSystem | null;
    timeline: AttackTimeline<LongswordContext>;
    currentEnemies: Enemy[];
    currentSlash: LongswordContext | null;

    constructor(owner: Weapon['owner'], options: {
        damage?: number;
        cooldown?: number;
        slashLength?: number;
        slashWidth?: number;
        slashOffset?: number;
        knockback?: number;
        particleSystem?: ParticleSystem | null;
    } = {}) {
        super(owner, {
            name: 'Longsword',
            damage: options.damage ?? 45,
            cooldown: options.cooldown ?? 0.7
        });

        this.baseDamage = options.damage ?? 45;
        this.baseCooldown = options.cooldown ?? 0.7;
        this.slashLength = options.slashLength || 96;
        this.slashWidth = options.slashWidth || 12;
        this.slashOffset = options.slashOffset || 28;
        this.knockback = options.knockback || 340;
        this.particleSystem = options.particleSystem || null;
        this.timeline = new AttackTimeline<LongswordContext>();
        this.currentEnemies = [];
        this.currentSlash = null;
    }

    _applyUpgrade() {
        // Longsword scales through getters and future config hooks.
    }

    get damage() {
        return this.baseDamage * (1 + (this.level - 1) * 0.24);
    }

    set damage(value: number) {
        this.baseDamage = value;
    }

    get cooldown() {
        return Math.max(0.32, this.baseCooldown * (1 - (this.level - 1) * 0.05));
    }

    set cooldown(value: number) {
        this.baseCooldown = value;
    }

    get attackDefinition(): AttackDefinition {
        return {
            key: 'longsword_slash',
            timing: {
                windup: 0.09,
                active: 0.08,
                recovery: 0.16,
                cooldown: this.cooldown
            },
            damageType: 'physical'
        };
    }

    trigger(enemies: Enemy[] = []) {
        this.currentEnemies = enemies;
        const movement = this.owner.getComponent<MovementComponent>('MovementComponent');
        const direction = movement?.facingDirection || 'down';
        const slash = this.buildSlashContext(direction);
        const definition = this.attackDefinition;
        const totalAttackDuration =
            definition.timing.windup + definition.timing.active + definition.timing.recovery;

        this.hitRegistry.clearChannel(definition.key);

        this.timeline.start(definition, slash, {
            onStart: ({ context }) => {
                this.currentSlash = context;
                this.owner.setCombatActionState('windup', definition.timing.windup);
                this.owner.lockAnimation('attack', context?.direction || direction, totalAttackDuration, 1.3);
            },
            onPhaseChange: ({ phase, attackId, context }) => {
                this.currentSlash = context;
                if (phase === 'active') {
                    this.owner.setCombatActionState('active', definition.timing.active);
                    this.particleSystem?.createSwordSlashVertical(context?.slashX ?? slash.slashX, context?.slashY ?? slash.slashY, {
                        length: this.slashLength,
                        width: this.slashWidth,
                        direction: context?.direction || direction
                    });
                } else if (phase === 'recovery' || phase === 'cooldown') {
                    this.owner.setCombatActionState('recovery', phase === 'recovery'
                        ? definition.timing.recovery
                        : definition.timing.cooldown);
                }
            },
            onActiveTick: ({ attackId, context }) => {
                this.resolveHits(attackId, context || slash);
            },
            onComplete: () => {
                this.currentSlash = null;
                this.owner.clearCombatActionState();
            },
            onCancel: () => {
                this.currentSlash = null;
                this.owner.clearCombatActionState();
            }
        });
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        this.currentEnemies = enemies;
        this.hitRegistry.tick(deltaTime);
        this.timeline.update(deltaTime);
    }

    buildSlashContext(direction: Direction): LongswordContext {
        let slashX = this.owner.x;
        let slashY = this.owner.y;
        if (direction === 'up') slashY -= this.slashOffset;
        else if (direction === 'down') slashY += this.slashOffset;
        else if (direction === 'left') slashX -= this.slashOffset;
        else if (direction === 'right') slashX += this.slashOffset;

        return { direction, slashX, slashY };
    }

    resolveHits(attackId: string, slash: LongswordContext) {
        const horizontal = slash.direction === 'left' || slash.direction === 'right';
        const halfWidth = this.slashWidth / 2;
        const halfLength = this.slashLength / 2;

        for (const enemy of this.currentEnemies) {
            if (enemy.destroyed) continue;
            if (!this.hitRegistry.canHit(attackId, enemy.id)) continue;

            const dx = enemy.x - slash.slashX;
            const dy = enemy.y - slash.slashY;
            const inSlash = horizontal
                ? Math.abs(dx) <= halfLength + enemy.size && Math.abs(dy) <= halfWidth + enemy.size
                : Math.abs(dx) <= halfWidth + enemy.size && Math.abs(dy) <= halfLength + enemy.size;

            if (!inSlash) continue;

            const damageContext = this.getDamageContext(this.damage, 0.1);
            const dirX = enemy.x - this.owner.x;
            const dirY = enemy.y - this.owner.y;
            const distance = Math.sqrt(dirX * dirX + dirY * dirY) || 1;

            enemy.takeDamage(
                this.buildDamagePayload(
                    `${attackId}:${enemy.id}`,
                    damageContext.damage,
                    'physical',
                    {
                        crit: damageContext.crit,
                        staggerDuration: 0.12,
                        invulnerabilityDuration: 0.06,
                        knockback: {
                            x: dirX / distance,
                            y: dirY / distance,
                            force: this.knockback
                        }
                    }
                )
            );

            this.hitRegistry.registerHit(attackId, enemy.id, 999);
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.currentSlash) return;
        if (this.timeline.phase !== 'windup' && this.timeline.phase !== 'active' && this.timeline.phase !== 'recovery') {
            return;
        }

        const progress = this.timeline.phase === 'windup'
            ? this.timeline.getPhaseProgress() * 0.4
            : this.timeline.phase === 'active'
                ? 0.4 + this.timeline.getPhaseProgress() * 0.4
                : 0.8 + this.timeline.getPhaseProgress() * 0.2;
        const alpha = this.timeline.phase === 'recovery'
            ? Math.max(0, 1 - this.timeline.getPhaseProgress())
            : 0.2 + progress * 0.8;

        const dirVec = {
            x: this.currentSlash.direction === 'left' ? -1 : this.currentSlash.direction === 'right' ? 1 : 0,
            y: this.currentSlash.direction === 'up' ? -1 : this.currentSlash.direction === 'down' ? 1 : 0
        };
        const slide = progress * 16;
        const drawX = this.currentSlash.slashX + dirVec.x * slide + dirVec.x * (this.slashLength * 0.12);
        const drawY = this.currentSlash.slashY + dirVec.y * slide + dirVec.y * (this.slashLength * 0.12);

        const halfW = this.slashWidth / 2;
        const halfL = this.slashLength / 2;
        const horizontal = dirVec.x !== 0;
        const drawWidth = horizontal ? this.slashLength : this.slashWidth;
        const drawHeight = horizontal ? this.slashWidth : this.slashLength;

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        if (horizontal) {
            ctx.fillRect(-halfL * 0.95, -halfW * 1.6, halfL * 1.9, halfW * 3.2);
        } else {
            ctx.fillRect(-halfW * 1.6, -halfL * 0.95, halfW * 3.2, halfL * 1.9);
        }

        const gradient = horizontal
            ? ctx.createLinearGradient(0, -halfW, 0, halfW)
            : ctx.createLinearGradient(-halfW, 0, halfW, 0);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.35, 'rgba(210,225,255,0.92)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.65, 'rgba(200,210,245,0.88)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
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

    cancel() {
        super.cancel();
        this.timeline.cancel();
        this.currentSlash = null;
        this.owner.clearCombatActionState();
    }
}
