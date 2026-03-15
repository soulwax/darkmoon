export type RunPhase =
    | 'boot'
    | 'menu'
    | 'starting'
    | 'playing'
    | 'levelup'
    | 'dying'
    | 'gameover';

export interface RunTransition {
    previous: RunPhase;
    next: RunPhase;
    reason: string;
    data?: unknown;
}

const ALLOWED_TRANSITIONS: Record<RunPhase, RunPhase[]> = {
    boot: ['menu', 'starting'],
    menu: ['starting'],
    starting: ['playing', 'gameover'],
    playing: ['levelup', 'dying', 'gameover'],
    levelup: ['playing', 'dying', 'gameover'],
    dying: ['gameover'],
    gameover: ['starting', 'menu']
};

export class RunStateMachine {
    phase: RunPhase;
    phaseTime: number;
    runTime: number;

    constructor(initialPhase: RunPhase = 'boot') {
        this.phase = initialPhase;
        this.phaseTime = 0;
        this.runTime = 0;
    }

    transition(next: RunPhase, reason: string, data?: unknown): RunTransition {
        if (next !== this.phase) {
            const allowed = ALLOWED_TRANSITIONS[this.phase];
            if (!allowed.includes(next)) {
                throw new Error(`Invalid run transition: ${this.phase} -> ${next} (${reason})`);
            }
        }

        const previous = this.phase;
        this.phase = next;
        this.phaseTime = 0;

        if (next === 'starting') {
            this.runTime = 0;
        }

        return { previous, next, reason, data };
    }

    update(deltaTime: number) {
        this.phaseTime += deltaTime;
        if (this.phase === 'playing' || this.phase === 'dying') {
            this.runTime += deltaTime;
        }
    }

    isSimulationActive() {
        return this.phase === 'playing' || this.phase === 'dying' || this.phase === 'starting';
    }

    isInputBlocked() {
        return this.phase === 'levelup' || this.phase === 'dying' || this.phase === 'gameover';
    }
}
