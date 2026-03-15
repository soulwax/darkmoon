import { beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '../config/GameConfig';
import { eventBus, GameEvents } from '../core/EventBus';
import { resetEntityIds } from '../ecs/Entity';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { DamageResolver } from './DamageResolver';

describe('DamageResolver', () => {
    beforeEach(() => {
        eventBus.clear();
        resetEntityIds();
    });

    it('applies armor before shield and respects invulnerability on the player', () => {
        const config = new GameConfig();
        const resolver = new DamageResolver();
        const player = new Player(100, 100, config, null);
        player.setDamageResolver(resolver);
        player.applyStat('armor', 0.5);

        const firstHit = player.receiveHit({
            id: 'enemy-contact-1',
            source: null,
            amount: 20,
            damageType: 'contact'
        });

        expect(firstHit.applied).toBe(true);
        expect(firstHit.rawDamage).toBe(10);
        expect(firstHit.shieldDamage).toBe(10);
        expect(firstHit.healthDamage).toBe(0);

        const secondHit = player.receiveHit({
            id: 'enemy-contact-2',
            source: null,
            amount: 20,
            damageType: 'contact'
        });

        expect(secondHit.applied).toBe(false);

        player.update(1);

        const thirdHit = player.receiveHit({
            id: 'enemy-contact-3',
            source: null,
            amount: 20,
            damageType: 'contact'
        });

        expect(thirdHit.applied).toBe(true);
    });

    it('kills enemies through the unified resolver and emits the kill event once', () => {
        const config = new GameConfig();
        const resolver = new DamageResolver();
        const enemy = new Enemy(0, 0, 'slime', config, null, null);
        enemy.setDamageResolver(resolver);

        let killEvents = 0;
        eventBus.on(GameEvents.ENEMY_KILLED, () => {
            killEvents += 1;
        });

        enemy.takeDamage({
            id: 'test-kill',
            source: null,
            amount: 999,
            damageType: 'physical'
        });

        expect(enemy.destroyed).toBe(true);
        expect(killEvents).toBe(1);
    });
});

