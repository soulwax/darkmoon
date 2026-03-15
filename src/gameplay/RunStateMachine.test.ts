import { describe, expect, it } from 'vitest';
import { RunStateMachine } from './RunStateMachine';

describe('RunStateMachine', () => {
    it('supports the intended gameplay lifecycle transitions', () => {
        const machine = new RunStateMachine('menu');

        machine.transition('starting', 'start_clicked');
        expect(machine.phase).toBe('starting');

        machine.transition('playing', 'spawn_complete');
        expect(machine.phase).toBe('playing');

        machine.transition('levelup', 'levelup');
        expect(machine.phase).toBe('levelup');

        machine.transition('playing', 'upgrade_selected');
        machine.transition('dying', 'player_died');
        machine.transition('gameover', 'death_complete');
        expect(machine.phase).toBe('gameover');
    });

    it('rejects invalid transitions', () => {
        const machine = new RunStateMachine('menu');
        expect(() => machine.transition('gameover', 'skip')).toThrow(/Invalid run transition/);
    });
});

