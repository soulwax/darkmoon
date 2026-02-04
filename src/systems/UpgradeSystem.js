// File: src/systems/UpgradeSystem.js
// Handles upgrade definitions and applications

import { MagicOrbs } from '../weapons/MagicOrbs.js';
import { MagicMissiles } from '../weapons/MagicMissiles.js';
import { LightningStrike } from '../weapons/LightningStrike.js';

// All available weapons
export const WeaponDefinitions = {
    magicOrbs: {
        class: MagicOrbs,
        name: 'Magic Orbs',
        description: 'Orbs rotate around you, damaging enemies on contact',
        icon: '🔮',
        rarity: 'common'
    },
    magicMissiles: {
        class: MagicMissiles,
        name: 'Magic Missiles',
        description: 'Auto-targeting projectiles seek out enemies',
        icon: '✨',
        rarity: 'common'
    },
    lightningStrike: {
        class: LightningStrike,
        name: 'Lightning Strike',
        description: 'Summon lightning to strike random enemies',
        icon: '⚡',
        rarity: 'rare'
    }
};

// All available stat upgrades
export const StatUpgrades = {
    moveSpeed: {
        name: 'Swift Feet',
        description: '+15% movement speed',
        icon: '🏃',
        value: 0.15,
        maxStacks: 5,
        rarity: 'common'
    },
    maxHealth: {
        name: 'Vitality',
        description: '+20% maximum health',
        icon: '❤️',
        value: 0.20,
        maxStacks: 5,
        rarity: 'common'
    },
    pickupRange: {
        name: 'Magnetism',
        description: '+25% pickup range',
        icon: '🧲',
        value: 0.25,
        maxStacks: 4,
        rarity: 'common'
    },
    damageMultiplier: {
        name: 'Power',
        description: '+10% damage to all weapons',
        icon: '💪',
        value: 0.10,
        maxStacks: 10,
        rarity: 'uncommon'
    },
    armor: {
        name: 'Armor',
        description: 'Reduce damage taken by 5%',
        icon: '🛡️',
        value: 0.05,
        maxStacks: 5,
        rarity: 'uncommon'
    },
    luck: {
        name: 'Lucky Star',
        description: '+10% chance for bonus XP',
        icon: '🍀',
        value: 0.10,
        maxStacks: 5,
        rarity: 'rare'
    }
};

export class UpgradeSystem {
    constructor(player) {
        this.player = player;
        this.statStacks = {};

        // Initialize stat stacks
        for (const stat of Object.keys(StatUpgrades)) {
            this.statStacks[stat] = 0;
        }
    }

    /**
     * Generate upgrade options for level up
     * @param {number} count - Number of options to generate
     * @returns {Object[]}
     */
    generateOptions(count = 3) {
        const options = [];
        const availableOptions = [];

        // Add new weapons player doesn't have
        for (const [key, def] of Object.entries(WeaponDefinitions)) {
            if (!this.player.hasWeapon(def.class)) {
                availableOptions.push({
                    type: 'new_weapon',
                    key: key,
                    weaponClass: def.class,
                    name: `New: ${def.name}`,
                    description: def.description,
                    icon: def.icon,
                    rarity: def.rarity,
                    weight: def.rarity === 'rare' ? 1 : 3
                });
            }
        }

        // Add weapon upgrades
        for (const weapon of this.player.weapons) {
            if (weapon.level < weapon.maxLevel) {
                availableOptions.push({
                    type: 'weapon_upgrade',
                    weapon: weapon,
                    name: `${weapon.name} +`,
                    description: `Upgrade to level ${weapon.level + 1}`,
                    icon: '⬆️',
                    rarity: 'common',
                    weight: 4
                });
            }
        }

        // Add stat upgrades (if not maxed)
        for (const [key, def] of Object.entries(StatUpgrades)) {
            if (this.statStacks[key] < def.maxStacks) {
                availableOptions.push({
                    type: 'stat',
                    stat: key,
                    value: def.value,
                    name: def.name,
                    description: def.description,
                    icon: def.icon,
                    rarity: def.rarity,
                    weight: def.rarity === 'rare' ? 1 : def.rarity === 'uncommon' ? 2 : 3
                });
            }
        }

        // Weighted random selection
        const selected = this._weightedSample(availableOptions, count);
        return selected;
    }

    /**
     * Weighted random sampling
     */
    _weightedSample(items, count) {
        const result = [];
        const available = [...items];

        while (result.length < count && available.length > 0) {
            const totalWeight = available.reduce((sum, item) => sum + (item.weight || 1), 0);
            let random = Math.random() * totalWeight;

            for (let i = 0; i < available.length; i++) {
                random -= available[i].weight || 1;
                if (random <= 0) {
                    result.push(available[i]);
                    available.splice(i, 1);
                    break;
                }
            }
        }

        return result;
    }

    /**
     * Apply a selected upgrade
     * @param {Object} option
     */
    applyUpgrade(option) {
        switch (option.type) {
            case 'new_weapon':
                this.player.addWeapon(option.weaponClass);
                break;

            case 'weapon_upgrade':
                option.weapon.upgrade();
                break;

            case 'stat':
                this.player.applyStat(option.stat, option.value);
                this.statStacks[option.stat]++;
                break;
        }
    }

    /**
     * Get current stat level
     */
    getStatLevel(stat) {
        return this.statStacks[stat] || 0;
    }

    /**
     * Reset all upgrades
     */
    reset() {
        for (const stat of Object.keys(StatUpgrades)) {
            this.statStacks[stat] = 0;
        }
    }
}
