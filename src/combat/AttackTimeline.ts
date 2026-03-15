import type { AttackDefinition, AttackPhase, AttackPhaseChange } from './CombatTypes';

export interface AttackTimelineCallbacks<TContext = unknown> {
    onStart?: (change: AttackPhaseChange<TContext>) => void;
    onPhaseChange?: (change: AttackPhaseChange<TContext>) => void;
    onActiveTick?: (change: AttackPhaseChange<TContext>, deltaTime: number) => void;
    onComplete?: (change: AttackPhaseChange<TContext>) => void;
    onCancel?: (change: AttackPhaseChange<TContext>) => void;
}

const PHASE_ORDER: AttackPhase[] = ['windup', 'active', 'recovery', 'cooldown'];

export class AttackTimeline<TContext = unknown> {
    phase: AttackPhase;
    definition: AttackDefinition | null;
    context: TContext | null;
    timeRemaining: number;
    elapsedInPhase: number;
    attackCounter: number;
    attackId: string | null;
    callbacks: AttackTimelineCallbacks<TContext> | null;

    constructor() {
        this.phase = 'idle';
        this.definition = null;
        this.context = null;
        this.timeRemaining = 0;
        this.elapsedInPhase = 0;
        this.attackCounter = 0;
        this.attackId = null;
        this.callbacks = null;
    }

    isIdle() {
        return this.phase === 'idle' || !this.definition || !this.attackId;
    }

    isBusy() {
        return !this.isIdle();
    }

    canStart() {
        return this.isIdle();
    }

    start(
        definition: AttackDefinition,
        context: TContext | null = null,
        callbacks: AttackTimelineCallbacks<TContext> = {}
    ) {
        if (!this.canStart()) {
            return false;
        }

        this.attackCounter += 1;
        this.definition = definition;
        this.context = context;
        this.callbacks = callbacks;
        this.attackId = `${definition.key}:${this.attackCounter}`;
        this._enterPhase('windup');

        return true;
    }

    cancel() {
        if (this.isIdle() || !this.attackId || !this.definition) {
            return;
        }

        const change = this._buildChange(this.phase, this.phase);
        this.callbacks?.onCancel?.(change);
        this._reset();
    }

    update(deltaTime: number) {
        if (this.isIdle() || !this.definition || !this.attackId) {
            return;
        }

        let remainingDelta = deltaTime;

        while (remainingDelta > 0 && !this.isIdle()) {
            const consumed = Math.min(remainingDelta, this.timeRemaining > 0 ? this.timeRemaining : remainingDelta);
            this.timeRemaining = Math.max(0, this.timeRemaining - consumed);
            this.elapsedInPhase += consumed;

            if (this.phase === 'active') {
                const change = this._buildChange(this.phase, this.phase);
                this.callbacks?.onActiveTick?.(change, consumed);
            }

            remainingDelta -= consumed;

            if (this.timeRemaining > 0) {
                break;
            }

            const nextPhase = this._getNextPhase();
            if (!nextPhase) {
                const change = this._buildChange(this.phase, this.phase);
                this.callbacks?.onComplete?.(change);
                this._reset();
                break;
            }

            this._enterPhase(nextPhase);
        }
    }

    getPhaseProgress() {
        if (this.isIdle() || !this.definition) {
            return 0;
        }

        const duration = this._getPhaseDuration(this.phase);
        if (duration <= 0) {
            return 1;
        }

        return Math.max(0, Math.min(1, this.elapsedInPhase / duration));
    }

    private _enterPhase(phase: AttackPhase) {
        if (!this.definition || !this.attackId) {
            return;
        }

        const previousPhase = this.phase;
        this.phase = phase;
        this.elapsedInPhase = 0;
        this.timeRemaining = this._getPhaseDuration(phase);

        const change = this._buildChange(previousPhase, phase);
        if (previousPhase === 'idle') {
            this.callbacks?.onStart?.(change);
        }
        this.callbacks?.onPhaseChange?.(change);

        if (this.timeRemaining <= 0) {
            this.update(0);
        }
    }

    private _getPhaseDuration(phase: AttackPhase) {
        if (!this.definition) {
            return 0;
        }

        switch (phase) {
            case 'windup':
                return this.definition.timing.windup;
            case 'active':
                return this.definition.timing.active;
            case 'recovery':
                return this.definition.timing.recovery;
            case 'cooldown':
                return this.definition.timing.cooldown;
            default:
                return 0;
        }
    }

    private _getNextPhase() {
        if (this.isIdle()) {
            return null;
        }

        const currentIndex = PHASE_ORDER.indexOf(this.phase);
        if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
            return null;
        }

        return PHASE_ORDER[currentIndex + 1];
    }

    private _buildChange(previousPhase: AttackPhase, phase: AttackPhase): AttackPhaseChange<TContext> {
        return {
            attackId: this.attackId || 'unknown',
            definition: this.definition as AttackDefinition,
            previousPhase,
            phase,
            elapsed: this.elapsedInPhase,
            context: this.context
        };
    }

    private _reset() {
        this.phase = 'idle';
        this.definition = null;
        this.context = null;
        this.timeRemaining = 0;
        this.elapsedInPhase = 0;
        this.attackId = null;
        this.callbacks = null;
    }
}

