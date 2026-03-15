import { describe, expect, it } from 'vitest';
import { AttackTimeline } from './AttackTimeline';

describe('AttackTimeline', () => {
    it('advances deterministically through windup, active, recovery, cooldown, and idle', () => {
        const timeline = new AttackTimeline<{ label: string }>();
        const phases: string[] = [];

        timeline.start(
            {
                key: 'test-slash',
                timing: {
                    windup: 0.1,
                    active: 0.2,
                    recovery: 0.15,
                    cooldown: 0.25
                }
            },
            { label: 'slash' },
            {
                onPhaseChange: ({ phase }) => phases.push(phase)
            }
        );

        expect(timeline.phase).toBe('windup');

        timeline.update(0.1);
        expect(timeline.phase).toBe('active');

        timeline.update(0.2);
        expect(timeline.phase).toBe('recovery');

        timeline.update(0.15);
        expect(timeline.phase).toBe('cooldown');

        timeline.update(0.25);
        expect(timeline.phase).toBe('idle');
        expect(timeline.isIdle()).toBe(true);
        expect(phases).toEqual(['windup', 'active', 'recovery', 'cooldown']);
    });
});

