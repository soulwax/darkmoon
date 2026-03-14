import { DebugLogger } from '../core/DebugLogger';
import type { GameScene } from '../scenes/GameScene';
import type {
    PlaytestActionName,
    PlaytestReport,
    PlaytestRunOptions,
    PlaytestSample,
    PlaytestSceneSnapshot,
    PlaytestUpgradeOptionSnapshot
} from './PlaytestTypes';

interface BrowserPlaytestHost {
    startGame(reason?: string): void;
    restartGame(reason?: string): void;
    getCurrentGameScene(): GameScene | null;
    getPhase(): string;
    isGameOverVisible(): boolean;
}

interface ResolvedPlaytestScenario {
    id: string;
    label: string;
    durationSeconds: number;
    autoRestart: boolean;
    sampleIntervalSeconds: number;
}

interface PlaytestDecision {
    actions: Partial<Record<PlaytestActionName, boolean>>;
    levelUpIndex?: number | null;
}

interface ActiveRun {
    scenario: ResolvedPlaytestScenario;
    policy: SurvivalAutoplayPolicy;
    startedAt: string;
    startedPerformanceTime: number;
    lastSampleAt: number;
    minHealthRatio: number;
    maxEnemiesAlive: number;
    upgradeSelections: string[];
    samples: PlaytestSample[];
    finalSnapshot: PlaytestSceneSnapshot | null;
    scene: GameScene | null;
    detachListener: (() => void) | null;
    monitorTimer: number | null;
    finished: boolean;
    resolve: (report: PlaytestReport) => void;
}

const PLAYTEST_ACTIONS: PlaytestActionName[] = [
    'moveUp',
    'moveDown',
    'moveLeft',
    'moveRight',
    'jump',
    'dash',
    'interact'
];

const BUILT_IN_SCENARIOS: Record<string, Omit<ResolvedPlaytestScenario, 'id'>> = {
    smoke: {
        label: 'Self-Play Smoke',
        durationSeconds: 45,
        autoRestart: true,
        sampleIntervalSeconds: 1
    },
    endurance: {
        label: 'Self-Play Endurance',
        durationSeconds: 120,
        autoRestart: true,
        sampleIntervalSeconds: 2
    }
};

class SurvivalAutoplayPolicy {
    jumpCooldownUntil: number;
    dashCooldownUntil: number;
    wanderAngle: number;
    lastWanderRefresh: number;
    recentPositions: Array<{ time: number; x: number; y: number }>;

    constructor() {
        this.jumpCooldownUntil = 0;
        this.dashCooldownUntil = 0;
        this.wanderAngle = Math.PI / 4;
        this.lastWanderRefresh = -Infinity;
        this.recentPositions = [];
    }

    decide(snapshot: PlaytestSceneSnapshot): PlaytestDecision {
        if (snapshot.levelUp.visible && snapshot.levelUp.options.length > 0) {
            return {
                actions: {},
                levelUpIndex: this._pickUpgrade(snapshot)
            };
        }

        this._trackPosition(snapshot);
        const movement = this._pickMovement(snapshot);
        const actions = this._vectorToActions(movement.x, movement.y);

        if (this._shouldDash(snapshot)) {
            actions.dash = true;
            this.dashCooldownUntil = snapshot.time + 1.1;
        }

        if (this._shouldSlash(snapshot)) {
            actions.jump = true;
            this.jumpCooldownUntil = snapshot.time + 0.75;
        }

        return { actions };
    }

    _pickUpgrade(snapshot: PlaytestSceneSnapshot) {
        let bestIndex = 0;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const option of snapshot.levelUp.options) {
            const score = this._scoreUpgrade(option, snapshot);
            if (score > bestScore) {
                bestIndex = option.index;
                bestScore = score;
            }
        }

        return bestIndex;
    }

    _scoreUpgrade(option: PlaytestUpgradeOptionSnapshot, snapshot: PlaytestSceneSnapshot) {
        const name = option.name.toLowerCase();
        const description = option.description.toLowerCase();
        let score = 0;

        if (option.type === 'new_weapon') score += 40;
        if (option.type === 'weapon_upgrade') score += 36;
        if (option.type === 'stat') score += 24;
        if (option.rarity === 'rare') score += 4;
        if (option.rarity === 'uncommon') score += 2;

        if (name.includes('magic orbs')) score += 28;
        if (name.includes('magic missiles')) score += 26;
        if (name.includes('lightning strike')) score += 20;
        if (name.includes('power')) score += 24;
        if (name.includes('swift feet')) score += 18;
        if (name.includes('magnetism')) score += 17;
        if (name.includes('armor')) score += snapshot.player.healthRatio < 0.65 ? 24 : 12;
        if (name.includes('vitality')) score += snapshot.player.healthRatio < 0.65 ? 22 : 11;
        if (name.includes('aegis')) score += snapshot.player.healthRatio < 0.8 ? 21 : 10;
        if (name.includes('lucky')) score += 4;
        if (description.includes('auto-targeting')) score += 10;
        if (description.includes('damaging enemies on contact')) score += 8;

        const weaponCount = snapshot.player.weapons.length;
        if (option.type === 'new_weapon' && weaponCount < 4) {
            score += 12;
        }

        if (option.type === 'weapon_upgrade' && weaponCount >= 3) {
            score += 8;
        }

        return score;
    }

    _trackPosition(snapshot: PlaytestSceneSnapshot) {
        this.recentPositions.push({
            time: snapshot.time,
            x: snapshot.player.x,
            y: snapshot.player.y
        });
        this.recentPositions = this.recentPositions.filter(
            (entry) => snapshot.time - entry.time <= 1.5
        );
    }

    _pickMovement(snapshot: PlaytestSceneSnapshot) {
        const enemy = snapshot.nearestEnemy;
        const gem = snapshot.nearestGem;
        const powerUp = snapshot.nearestPowerUp;
        const player = snapshot.player;
        const stuck = this._isStuck();

        if (powerUp && powerUp.distance < 260) {
            return this._normalize(powerUp.x - player.x, powerUp.y - player.y);
        }

        if (enemy && player.healthRatio < 0.42) {
            return this._blendVectors(
                this._awayFrom(player.x, player.y, enemy.x, enemy.y, 1),
                this._strafeAround(player.x, player.y, enemy.x, enemy.y, snapshot.time, 0.35),
                0.75,
                0.25
            );
        }

        if (gem && (enemy === null || enemy.distance > 72 || player.healthRatio > 0.7) && gem.distance < 260) {
            return this._normalize(gem.x - player.x, gem.y - player.y);
        }

        if (enemy && enemy.distance < 58) {
            return this._blendVectors(
                this._awayFrom(player.x, player.y, enemy.x, enemy.y, 1),
                this._strafeAround(player.x, player.y, enemy.x, enemy.y, snapshot.time, 0.45),
                0.8,
                0.2
            );
        }

        if (enemy && enemy.distance < 140) {
            return this._blendVectors(
                this._strafeAround(player.x, player.y, enemy.x, enemy.y, snapshot.time, 1),
                this._awayFrom(player.x, player.y, enemy.x, enemy.y, 0.4),
                0.7,
                0.3
            );
        }

        if (enemy && snapshot.enemiesAlive > 0) {
            return this._blendVectors(
                this._strafeAround(player.x, player.y, enemy.x, enemy.y, snapshot.time, 0.8),
                gem
                    ? this._normalize(gem.x - player.x, gem.y - player.y)
                    : this._currentWanderVector(snapshot.time, stuck),
                0.6,
                0.4
            );
        }

        return this._currentWanderVector(snapshot.time, stuck);
    }

    _shouldDash(snapshot: PlaytestSceneSnapshot) {
        const enemy = snapshot.nearestEnemy;
        if (!enemy) return false;
        if (snapshot.time < this.dashCooldownUntil) return false;

        return enemy.distance < 44 ||
            (snapshot.player.healthRatio < 0.55 && snapshot.enemiesAlive >= 7) ||
            (snapshot.player.healthRatio < 0.35 && enemy.distance < 80);
    }

    _shouldSlash(snapshot: PlaytestSceneSnapshot) {
        const enemy = snapshot.nearestEnemy;
        if (!enemy) return false;
        if (snapshot.time < this.jumpCooldownUntil) return false;

        return enemy.distance < 92 && snapshot.enemiesAlive > 0;
    }

    _isStuck() {
        if (this.recentPositions.length < 2) return false;

        const first = this.recentPositions[0];
        const last = this.recentPositions[this.recentPositions.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 18;
    }

    _currentWanderVector(time: number, forceRefresh: boolean) {
        if (forceRefresh || time - this.lastWanderRefresh >= 1.8) {
            this.wanderAngle = (this.wanderAngle + Math.PI * 0.58) % (Math.PI * 2);
            this.lastWanderRefresh = time;
        }

        return {
            x: Math.cos(this.wanderAngle),
            y: Math.sin(this.wanderAngle)
        };
    }

    _awayFrom(fromX: number, fromY: number, targetX: number, targetY: number, scale: number) {
        return this._normalize((fromX - targetX) * scale, (fromY - targetY) * scale);
    }

    _strafeAround(fromX: number, fromY: number, targetX: number, targetY: number, time: number, scale: number) {
        const orbitSign = Math.sin(time * 1.7) >= 0 ? 1 : -1;
        const dx = targetX - fromX;
        const dy = targetY - fromY;
        return this._normalize(-dy * orbitSign * scale, dx * orbitSign * scale);
    }

    _blendVectors(
        primary: { x: number; y: number },
        secondary: { x: number; y: number },
        primaryWeight: number,
        secondaryWeight: number
    ) {
        return this._normalize(
            primary.x * primaryWeight + secondary.x * secondaryWeight,
            primary.y * primaryWeight + secondary.y * secondaryWeight
        );
    }

    _normalize(x: number, y: number) {
        const length = Math.sqrt(x * x + y * y);
        if (length <= 0.0001) {
            return { x: 0, y: 0 };
        }

        return {
            x: x / length,
            y: y / length
        };
    }

    _vectorToActions(x: number, y: number) {
        const threshold = 0.24;
        const actions: Partial<Record<PlaytestActionName, boolean>> = {
            moveLeft: x < -threshold,
            moveRight: x > threshold,
            moveUp: y < -threshold,
            moveDown: y > threshold
        };

        return actions;
    }
}

export class BrowserPlaytestHarness {
    host: BrowserPlaytestHost;
    activeRun: ActiveRun | null;
    lastReport: PlaytestReport | null;

    constructor(host: BrowserPlaytestHost) {
        this.host = host;
        this.activeRun = null;
        this.lastReport = null;
    }

    listScenarios() {
        return Object.entries(BUILT_IN_SCENARIOS).map(([id, scenario]) => ({
            id,
            ...scenario
        }));
    }

    isRunning() {
        return this.activeRun !== null;
    }

    getLastReport() {
        return this.lastReport;
    }

    captureSnapshot() {
        const scene = this.host.getCurrentGameScene();
        return scene ? scene.getPlaytestSnapshot() : null;
    }

    async run(options: PlaytestRunOptions = {}) {
        if (this.activeRun) {
            this.stop('superseded_by_new_run');
        }

        const scenario = this._resolveScenario(options);

        return await new Promise<PlaytestReport>((resolve) => {
            const run: ActiveRun = {
                scenario,
                policy: new SurvivalAutoplayPolicy(),
                startedAt: new Date().toISOString(),
                startedPerformanceTime: performance.now(),
                lastSampleAt: -Infinity,
                minHealthRatio: 1,
                maxEnemiesAlive: 0,
                upgradeSelections: [],
                samples: [],
                finalSnapshot: null,
                scene: null,
                detachListener: null,
                monitorTimer: null,
                finished: false,
                resolve
            };

            this.activeRun = run;

            DebugLogger.info('Playtest', 'run_started', {
                scenarioId: scenario.id,
                label: scenario.label,
                durationSeconds: scenario.durationSeconds,
                autoRestart: scenario.autoRestart
            });

            void this._prepareAndAttach(run);
        });
    }

    stop(reason: string = 'manual_stop') {
        if (!this.activeRun) {
            return this.lastReport;
        }

        this._finishRun(this.activeRun, 'stopped', reason, this._safeSnapshot(this.activeRun.scene));
        return this.lastReport;
    }

    _resolveScenario(options: PlaytestRunOptions): ResolvedPlaytestScenario {
        const scenarioId = options.scenarioId || 'smoke';
        const fallback = BUILT_IN_SCENARIOS.smoke;
        const builtIn = BUILT_IN_SCENARIOS[scenarioId] || fallback;

        return {
            id: scenarioId,
            label: builtIn.label,
            durationSeconds: options.durationSeconds ?? builtIn.durationSeconds,
            autoRestart: options.autoRestart ?? builtIn.autoRestart,
            sampleIntervalSeconds: options.sampleIntervalSeconds ?? builtIn.sampleIntervalSeconds
        };
    }

    async _prepareAndAttach(run: ActiveRun) {
        try {
            const scene = await this._prepareScene(run.scenario);
            if (this.activeRun !== run || run.finished) {
                return;
            }

            run.scene = scene;
            run.detachListener = scene.addPlaytestBeforeUpdateListener(() => {
                this._tickRun(run);
            });
            run.monitorTimer = window.setInterval(() => {
                this._monitorRun(run);
            }, 125);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            DebugLogger.error('Playtest', 'run_failed_to_attach', {
                scenarioId: run.scenario.id,
                error: detail
            });
            this._finishRun(run, 'failed', `scene_attach_failed:${detail}`, null);
        }
    }

    async _prepareScene(scenario: ResolvedPlaytestScenario) {
        const currentScene = this.host.getCurrentGameScene();
        if (scenario.autoRestart && this.host.getPhase() === 'playing' && currentScene) {
            this.host.restartGame('playtest_auto_restart');
        } else if (this.host.getPhase() !== 'playing' || !currentScene) {
            this.host.startGame('playtest_auto_start');
        }

        return await this._waitForSceneReady();
    }

    async _waitForSceneReady(timeoutMs: number = 5000) {
        const start = performance.now();

        while (performance.now() - start < timeoutMs) {
            const scene = this.host.getCurrentGameScene();
            if (scene && scene.active) {
                return scene;
            }

            await new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => resolve());
            });
        }

        throw new Error(`Timed out waiting for GameScene after ${timeoutMs}ms`);
    }

    _tickRun(run: ActiveRun) {
        if (this.activeRun !== run || run.finished || !run.scene) {
            return;
        }

        const scene = run.scene;
        const snapshot = scene.getPlaytestSnapshot();
        run.finalSnapshot = snapshot;
        run.minHealthRatio = Math.min(run.minHealthRatio, snapshot.player.healthRatio);
        run.maxEnemiesAlive = Math.max(run.maxEnemiesAlive, snapshot.enemiesAlive);

        if (snapshot.time - run.lastSampleAt >= run.scenario.sampleIntervalSeconds) {
            run.lastSampleAt = snapshot.time;
            run.samples.push({
                time: snapshot.time,
                kills: snapshot.killCount,
                level: snapshot.player.level,
                healthRatio: snapshot.player.healthRatio,
                enemiesAlive: snapshot.enemiesAlive,
                xpGemsAlive: snapshot.xpGemsAlive,
                nearestEnemyDistance: snapshot.nearestEnemy?.distance ?? null
            });
        }

        if (snapshot.phase === 'gameover' || this.host.getPhase() === 'gameover' || this.host.isGameOverVisible()) {
            this._finishRun(run, 'died', snapshot.gameOver?.reason || 'game_over', snapshot);
            return;
        }

        if (snapshot.time >= run.scenario.durationSeconds) {
            this._finishRun(run, 'completed', 'duration_reached', snapshot);
            return;
        }

        const decision = run.policy.decide(snapshot);
        scene.inputManager.clearVirtualActions();

        if (snapshot.levelUp.visible) {
            if (typeof decision.levelUpIndex === 'number') {
                const selected = snapshot.levelUp.options[decision.levelUpIndex];
                const accepted = scene.selectLevelUpOption(decision.levelUpIndex);

                if (accepted && selected) {
                    const postSelectionSnapshot = scene.getPlaytestSnapshot();
                    if (!postSelectionSnapshot.levelUp.visible) {
                        run.upgradeSelections.push(selected.name);
                    }
                }
            }
            return;
        }

        for (const action of PLAYTEST_ACTIONS) {
            scene.inputManager.setVirtualAction(action, !!decision.actions[action]);
        }
    }

    _monitorRun(run: ActiveRun) {
        if (this.activeRun !== run || run.finished) {
            return;
        }

        const snapshot = this._safeSnapshot(run.scene || this.host.getCurrentGameScene());
        if (snapshot) {
            run.finalSnapshot = snapshot;
        }

        if (
            this.host.getPhase() === 'gameover' ||
            this.host.isGameOverVisible() ||
            snapshot?.phase === 'gameover'
        ) {
            this._finishRun(run, 'died', snapshot?.gameOver?.reason || 'game_over', snapshot);
        }
    }

    _safeSnapshot(scene: GameScene | null) {
        try {
            return scene ? scene.getPlaytestSnapshot() : null;
        } catch {
            return null;
        }
    }

    _finishRun(
        run: ActiveRun,
        outcome: PlaytestReport['outcome'],
        stopReason: string,
        snapshot: PlaytestSceneSnapshot | null
    ) {
        if (run.finished) {
            return;
        }

        run.finished = true;
        run.finalSnapshot = snapshot;

        if (run.scene) {
            run.scene.inputManager.clearVirtualActions();
        }

        run.detachListener?.();
        run.detachListener = null;
        if (run.monitorTimer !== null) {
            window.clearInterval(run.monitorTimer);
            run.monitorTimer = null;
        }

        const durationSeconds = snapshot
            ? snapshot.time
            : Number(((performance.now() - run.startedPerformanceTime) / 1000).toFixed(3));

        const report: PlaytestReport = {
            scenarioId: run.scenario.id,
            label: run.scenario.label,
            startedAt: run.startedAt,
            finishedAt: new Date().toISOString(),
            outcome,
            stopReason,
            durationSeconds,
            metrics: {
                survivedSeconds: durationSeconds,
                kills: snapshot?.killCount ?? 0,
                level: snapshot?.player.level ?? 1,
                gemsCollected: snapshot?.gemsCollected ?? 0,
                damageDealt: snapshot?.damageDealt ?? 0,
                minHealthRatio: Number(run.minHealthRatio.toFixed(4)),
                maxEnemiesAlive: run.maxEnemiesAlive,
                upgradeSelections: [...run.upgradeSelections]
            },
            samples: [...run.samples],
            finalSnapshot: snapshot
        };

        this.lastReport = report;
        if (this.activeRun === run) {
            this.activeRun = null;
        }

        DebugLogger.info('Playtest', 'run_finished', {
            scenarioId: report.scenarioId,
            outcome: report.outcome,
            stopReason: report.stopReason,
            durationSeconds: report.durationSeconds,
            metrics: report.metrics
        });

        run.resolve(report);
    }
}
