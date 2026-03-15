import { beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '../config/GameConfig';
import { resetEntityIds } from '../ecs/Entity';
import { Player } from '../entities/Player';
import { Camera } from '../graphics/Camera';
import { SpawnSystem } from './SpawnSystem';

class MockImage {
    src = '';
    complete = true;
    width = 32;
    height = 32;
}

describe('SpawnSystem', () => {
    beforeEach(() => {
        resetEntityIds();
        (globalThis as { Image?: typeof MockImage }).Image = MockImage;
    });

    it('chooses spawn positions off-screen and outside the frustration radius', () => {
        const config = new GameConfig();
        const worldWidth = config.world.worldWidthTiles * config.world.tileSize;
        const worldHeight = config.world.worldHeightTiles * config.world.tileSize;
        const camera = new Camera(640, 360, {
            minX: 0,
            minY: 0,
            maxX: worldWidth,
            maxY: worldHeight
        });
        const player = new Player(worldWidth / 2, worldHeight / 2, config, null);
        camera.centerOn(player.x, player.y);

        const spawnSystem = new SpawnSystem(config, camera, null);
        spawnSystem.setTarget(player);
        spawnSystem.setSpawnValidator((x, y) => x > 100 && y > 100);

        const position = spawnSystem.getSpawnPosition();
        const visibleBounds = camera.getVisibleBounds();
        const distanceToPlayer = Math.sqrt((position.x - player.x) ** 2 + (position.y - player.y) ** 2);

        expect(distanceToPlayer).toBeGreaterThanOrEqual(spawnSystem.minSpawnDistance);
        expect(
            position.x < visibleBounds.x ||
            position.x > visibleBounds.x + visibleBounds.width ||
            position.y < visibleBounds.y ||
            position.y > visibleBounds.y + visibleBounds.height
        ).toBe(true);
    });

    it('spends threat budget to create enemies once the grace period has passed', () => {
        const config = new GameConfig();
        const worldWidth = config.world.worldWidthTiles * config.world.tileSize;
        const worldHeight = config.world.worldHeightTiles * config.world.tileSize;
        const camera = new Camera(640, 360, {
            minX: 0,
            minY: 0,
            maxX: worldWidth,
            maxY: worldHeight
        });
        const player = new Player(worldWidth / 2, worldHeight / 2, config, null);
        camera.centerOn(player.x, player.y);

        const spawnSystem = new SpawnSystem(config, camera, null);
        spawnSystem.setTarget(player);
        spawnSystem.spawnGracePeriod = 0;
        spawnSystem.spawnBudget = 12;
        spawnSystem.spawnCadenceTimer = 999;

        spawnSystem.update(0.16);

        expect(spawnSystem.getEnemies().length).toBeGreaterThan(0);
        expect(spawnSystem.getAliveThreat()).toBeGreaterThan(0);
    });
});
