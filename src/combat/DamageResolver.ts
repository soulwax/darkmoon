import { eventBus, GameEvents } from '../core/EventBus';
import type { HealthComponent } from '../ecs/components/HealthComponent';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import { CombatStateComponent } from '../ecs/components/CombatStateComponent';
import type { DamagePayload, DamageResult } from './CombatTypes';

export class DamageResolver {
    applyToPlayer(player: Player, payload: DamagePayload): DamageResult {
        const health = player.getComponent<HealthComponent>('HealthComponent');
        const combat = player.getComponent<CombatStateComponent>('CombatStateComponent');
        const mitigatedAmount = payload.damageType === 'pure'
            ? payload.amount
            : Math.max(1, Math.round(payload.amount * player.getDamageTakenMultiplier()));
        const clampedAmount = payload.burstClamp != null
            ? Math.min(mitigatedAmount, payload.burstClamp)
            : mitigatedAmount;

        return this._apply({
            targetType: 'player',
            health,
            combat,
            rawDamage: clampedAmount,
            damageType: payload.damageType,
            source: payload.source,
            shieldBefore: player.getShield(),
            shieldHandler: payload.bypassShield
                ? null
                : (amount) => {
                    const remaining = player.absorbShieldDamage(amount);
                    return {
                        remaining,
                        shieldAfter: player.getShield()
                    };
                },
            damageHandler: (amount) => {
                health?.takeDamage(amount, payload.source?.entity ?? null, {
                    applyInvulnerability: false,
                    emitPlayerEvents: false
                });
            },
            onApplied: (result) => {
                const invulnerabilityDuration = payload.invulnerabilityDuration ?? health?.invulnerabilityDuration ?? 0;
                if (!result.defeated) {
                    health?.setInvulnerability(invulnerabilityDuration);
                    combat?.setInvulnerable(invulnerabilityDuration);
                    combat?.setState('hurt', payload.staggerDuration ?? 0.12);
                } else {
                    combat?.setState('dying');
                    player.beginDeath();
                }

                eventBus.emit(GameEvents.PLAYER_DAMAGED, {
                    entity: player,
                    amount: result.rawDamage,
                    healthDamage: result.healthDamage,
                    shieldDamage: result.shieldDamage,
                    remaining: result.healthAfter,
                    shield: result.shieldAfter,
                    source: payload.source?.entity ?? payload.source ?? null,
                    damageType: payload.damageType,
                    crit: payload.crit === true
                });
            }
        });
    }

    applyToEnemy(enemy: Enemy, payload: DamagePayload): DamageResult {
        const health = enemy.getComponent<HealthComponent>('HealthComponent');
        const combat = enemy.getComponent<CombatStateComponent>('CombatStateComponent');

        const result = this._apply({
            targetType: 'enemy',
            health,
            combat,
            rawDamage: payload.amount,
            damageType: payload.damageType,
            source: payload.source,
            shieldBefore: 0,
            shieldHandler: null,
            damageHandler: (amount) => {
                health?.takeDamage(amount, payload.source?.entity ?? null, {
                    applyInvulnerability: false,
                    emitPlayerEvents: false
                });
            },
            onApplied: (applied) => {
                const invulnerabilityDuration = payload.invulnerabilityDuration ?? 0.05;
                if (!applied.defeated) {
                    health?.setInvulnerability(invulnerabilityDuration);
                    combat?.setInvulnerable(invulnerabilityDuration);
                    combat?.setState('hurt', payload.staggerDuration ?? 0.08);
                } else {
                    combat?.setState('dying');
                }

                if (payload.knockback) {
                    enemy.applyKnockback(
                        payload.knockback.x * payload.knockback.force,
                        payload.knockback.y * payload.knockback.force
                    );
                }

                eventBus.emit(GameEvents.ENEMY_DAMAGED, {
                    enemy,
                    amount: applied.healthDamage,
                    damageType: payload.damageType,
                    crit: payload.crit === true,
                    source: payload.source?.entity ?? payload.source ?? null
                });
            }
        });

        if (result.defeated) {
            enemy.handleResolvedDeath();
        }

        return result;
    }

    private _apply(args: {
        targetType: 'player' | 'enemy';
        health: HealthComponent | null;
        combat: CombatStateComponent | null;
        rawDamage: number;
        damageType: DamagePayload['damageType'];
        source: DamagePayload['source'];
        shieldBefore: number;
        shieldHandler: ((amount: number) => { remaining: number; shieldAfter: number }) | null;
        damageHandler: (amount: number) => void;
        onApplied: (result: DamageResult) => void;
    }): DamageResult {
        const {
            health,
            combat,
            rawDamage,
            damageType,
            source,
            shieldBefore,
            shieldHandler,
            damageHandler,
            onApplied
        } = args;

        const sourceType = source?.type || 'unknown';
        const sourceId = source?.id ?? null;

        const noOp = (): DamageResult => ({
            applied: false,
            defeated: health?.isDead ?? false,
            rawDamage,
            healthDamage: 0,
            shieldDamage: 0,
            healthBefore: health?.health ?? 0,
            healthAfter: health?.health ?? 0,
            shieldBefore,
            shieldAfter: shieldBefore,
            damageType,
            sourceType,
            sourceId
        });

        if (!health || !combat || rawDamage <= 0) {
            return noOp();
        }

        if (!combat.canReceiveDamage() || health.isDead || health.invulnerable) {
            return noOp();
        }

        let remainingDamage = rawDamage;
        let shieldAfter = shieldBefore;

        if (shieldHandler) {
            const shieldResult = shieldHandler(remainingDamage);
            remainingDamage = shieldResult.remaining;
            shieldAfter = shieldResult.shieldAfter;
        }

        const healthBefore = health.health;

        if (remainingDamage > 0) {
            damageHandler(remainingDamage);
        }

        const healthAfter = health.health;
        const healthDamage = Math.max(0, healthBefore - healthAfter);
        const shieldDamage = Math.max(0, shieldBefore - shieldAfter);
        const result: DamageResult = {
            applied: healthDamage > 0 || shieldDamage > 0,
            defeated: health.isDead,
            rawDamage,
            healthDamage,
            shieldDamage,
            healthBefore,
            healthAfter,
            shieldBefore,
            shieldAfter,
            damageType,
            sourceType,
            sourceId
        };

        if (!result.applied) {
            return result;
        }

        eventBus.emit(GameEvents.DAMAGE_RESOLVED, {
            targetType: args.targetType,
            result
        });
        onApplied(result);
        return result;
    }
}
