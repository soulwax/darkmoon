export type PlaytestActionName =
    | 'moveUp'
    | 'moveDown'
    | 'moveLeft'
    | 'moveRight'
    | 'jump'
    | 'dash'
    | 'interact';

export type PlaytestOutcome = 'completed' | 'died' | 'stopped' | 'failed';

export interface PlaytestWeaponSnapshot {
    name: string;
    level: number;
    maxLevel: number;
}

export interface PlaytestPlayerSnapshot {
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    healthRatio: number;
    shield: number;
    maxShield: number;
    shieldRatio: number;
    level: number;
    xp: number;
    xpToNextLevel: number;
    pickupRange: number;
    invulnerable: boolean;
    weapons: PlaytestWeaponSnapshot[];
}

export interface PlaytestEnemySnapshot {
    id: number;
    type: string;
    x: number;
    y: number;
    distance: number;
    damage: number;
}

export interface PlaytestPickupSnapshot {
    x: number;
    y: number;
    distance: number;
    value?: number;
    type?: string;
}

export interface PlaytestUpgradeOptionSnapshot {
    index: number;
    name: string;
    description: string;
    rarity?: string;
    type?: string;
}

export interface PlaytestGameOverSnapshot {
    visible: boolean;
    message?: string;
    reason?: string;
}

export interface PlaytestSceneSnapshot {
    phase: 'starting' | 'playing' | 'levelup' | 'dying' | 'gameover';
    time: number;
    killCount: number;
    damageDealt: number;
    gemsCollected: number;
    wave: number;
    enemiesAlive: number;
    xpGemsAlive: number;
    powerUpsAlive: number;
    player: PlaytestPlayerSnapshot;
    nearestEnemy: PlaytestEnemySnapshot | null;
    nearestGem: PlaytestPickupSnapshot | null;
    nearestPowerUp: PlaytestPickupSnapshot | null;
    levelUp: {
        visible: boolean;
        options: PlaytestUpgradeOptionSnapshot[];
    };
    gameOver: PlaytestGameOverSnapshot | null;
    debugTail: string[];
}

export interface PlaytestSample {
    time: number;
    kills: number;
    level: number;
    healthRatio: number;
    enemiesAlive: number;
    xpGemsAlive: number;
    nearestEnemyDistance: number | null;
}

export interface PlaytestMetrics {
    survivedSeconds: number;
    kills: number;
    level: number;
    gemsCollected: number;
    damageDealt: number;
    minHealthRatio: number;
    maxEnemiesAlive: number;
    upgradeSelections: string[];
}

export interface PlaytestReport {
    scenarioId: string;
    label: string;
    startedAt: string;
    finishedAt: string;
    outcome: PlaytestOutcome;
    stopReason: string;
    durationSeconds: number;
    metrics: PlaytestMetrics;
    samples: PlaytestSample[];
    finalSnapshot: PlaytestSceneSnapshot | null;
}

export interface PlaytestRunOptions {
    scenarioId?: string;
    durationSeconds?: number;
    autoRestart?: boolean;
    sampleIntervalSeconds?: number;
}
