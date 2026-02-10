// File: src/powerups/PowerUps.ts

export type PowerUpType = 'heal' | 'shield' | 'haste' | 'rage' | 'magnet' | 'xp' | 'bomb';

export interface PowerUpDefinition {
    type: PowerUpType;
    name: string;
    description: string;
    icon: string;
    color: string;
    weight: number;
}

export const PowerUps: Record<PowerUpType, PowerUpDefinition> = {
    heal: {
        type: 'heal',
        name: 'Healing',
        description: 'Restore health',
        icon: '❤️',
        color: '#ff4d6d',
        weight: 4
    },
    shield: {
        type: 'shield',
        name: 'Shield',
        description: 'Brief invulnerability',
        icon: '🛡️',
        color: '#4da3ff',
        weight: 2
    },
    haste: {
        type: 'haste',
        name: 'Haste',
        description: 'Move faster for a while',
        icon: '💨',
        color: '#7cffb2',
        weight: 3
    },
    rage: {
        type: 'rage',
        name: 'Rage',
        description: 'Deal more damage for a while',
        icon: '💥',
        color: '#ffb84d',
        weight: 2
    },
    magnet: {
        type: 'magnet',
        name: 'Magnet',
        description: 'Pull items from farther away',
        icon: '🧲',
        color: '#c46bff',
        weight: 2
    },
    xp: {
        type: 'xp',
        name: 'Wisdom',
        description: 'Instant XP',
        icon: '✨',
        color: '#ffd700',
        weight: 2
    },
    bomb: {
        type: 'bomb',
        name: 'Arcane Bomb',
        description: 'Damage all enemies on screen',
        icon: '💣',
        color: '#ffffff',
        weight: 1
    }
};

export function pickRandomPowerUpType(rng: () => number = Math.random): PowerUpType {
    const defs = Object.values(PowerUps);
    const total = defs.reduce((sum, def) => sum + def.weight, 0);
    let roll = rng() * total;

    for (const def of defs) {
        roll -= def.weight;
        if (roll <= 0) return def.type;
    }

    return 'heal';
}
