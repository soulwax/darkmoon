import type { Direction } from '../core/Math';
import type { Entity } from '../ecs/Entity';

export type Faction = 'player' | 'enemy' | 'neutral';

export type CombatantState =
    | 'spawning'
    | 'idle'
    | 'moving'
    | 'windup'
    | 'active'
    | 'recovery'
    | 'hurt'
    | 'staggered'
    | 'dying'
    | 'dead';

export type DamageType = 'physical' | 'arcane' | 'lightning' | 'contact' | 'pure';

export type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery' | 'cooldown';

export interface AttackTiming {
    windup: number;
    active: number;
    recovery: number;
    cooldown: number;
}

export interface AttackAnimationProfile {
    state: string;
    direction?: Direction;
    speed?: number;
}

export interface AttackControlProfile {
    canMoveDuringWindup?: boolean;
    canMoveDuringActive?: boolean;
    canMoveDuringRecovery?: boolean;
}

export interface AttackDefinition {
    key: string;
    timing: AttackTiming;
    damageType?: DamageType;
    critChance?: number;
    animation?: AttackAnimationProfile;
    controls?: AttackControlProfile;
}

export interface CombatSource {
    id: number | string;
    type: string;
    faction: Faction;
    entity: Entity | null;
    x: number;
    y: number;
}

export interface KnockbackVector {
    x: number;
    y: number;
    force: number;
}

export interface DamagePayload {
    id: string;
    source: CombatSource | null;
    amount: number;
    baseAmount?: number;
    damageType: DamageType;
    crit?: boolean;
    tags?: string[];
    hitCooldown?: number;
    invulnerabilityDuration?: number;
    staggerDuration?: number;
    knockback?: KnockbackVector | null;
    bypassShield?: boolean;
    burstClamp?: number | null;
}

export interface DamageResult {
    applied: boolean;
    defeated: boolean;
    rawDamage: number;
    healthDamage: number;
    shieldDamage: number;
    healthBefore: number;
    healthAfter: number;
    shieldBefore: number;
    shieldAfter: number;
    damageType: DamageType;
    sourceType: string;
    sourceId: number | string | null;
}

export interface AttackPhaseChange<TContext = unknown> {
    attackId: string;
    definition: AttackDefinition;
    previousPhase: AttackPhase;
    phase: AttackPhase;
    elapsed: number;
    context: TContext | null;
}

