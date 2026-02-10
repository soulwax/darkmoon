// File: src/assets/AssetManifest.ts

import type { AssetManifest } from './AssetLoader';

export const GameAssetManifest: AssetManifest = {
    // Sprite sheets with YAML definitions
    spriteSheets: {
        // Player character
        'player': '/SpiteSheets/characters/player.yaml',

        // Enemies
        'skeleton': '/SpiteSheets/characters/skeleton.yaml',
        'slime': '/SpiteSheets/characters/slime.yaml',

        // Terrain
        'grass': '/SpiteSheets/grass.yaml',
        // 'water': '/SpiteSheets/water-sheet.yaml',

        // Objects
        'objects': '/SpiteSheets/objects.yaml',

        // Decorations
        'flowers': '/SpiteSheets/flowers.yaml',
        'fences': '/SpiteSheets/fences.yaml'
    },

    // Standalone images (no YAML)
    images: {
        // Enemy sprites and sheets
        'skeleton': '/SpiteSheets/characters/skeleton.png',
        'slime': '/SpiteSheets/characters/slime.png',
        'enemySheetBasic': '/SpiteSheets/characters/enemies/enemy_basic_sheet.png',
        'enemySheetFast': '/SpiteSheets/characters/enemies/enemy_fast_sheet.png',
        'enemySheetTank': '/SpiteSheets/characters/enemies/enemy_tank_sheet.png',
        'enemySheetElite': '/SpiteSheets/characters/enemies/enemy_elite_sheet.png',

        // UI elements
        // 'ui_heart': '/UI/heart.png',
    },

    // YAML configs (non-sprite)
    yaml: {
        'gameConfig': '/game.yaml',
        'keybindings': '/keybindings.yaml',
        'enemySpritePack': '/SpiteSheets/characters/enemies/enemies_spritesheets.yaml'
    }
};

/**
 * Minimal manifest for quick loading (testing/development)
 */
export const MinimalAssetManifest: AssetManifest = {
    spriteSheets: {
        'player': '/SpiteSheets/characters/player.yaml'
    },
    images: {},
    yaml: {}
};

/**
 * Core graphics manifest (player + enemies + world tiles)
 */
export const CoreAssetManifest: AssetManifest = {
    spriteSheets: {
        'player': '/SpiteSheets/characters/player.yaml',
        // Enemy sprite sheets
        'skeleton': '/SpiteSheets/characters/skeleton.yaml',
        'slime': '/SpiteSheets/characters/slime.yaml',
        // World tiles
        'grass': '/SpiteSheets/grass.yaml',
        'dirtGrass': '/SpiteSheets/dirt-grass.yaml',
        'decorGrass': '/SpiteSheets/decor-grass.yaml',
        'flowers': '/SpiteSheets/flowers.yaml',
        'shrooms': '/SpiteSheets/shrooms.yaml',
        'objects': '/SpiteSheets/objects.yaml',
        'water': '/SpiteSheets/water-sheet.yaml',
        'rockInWater': '/SpiteSheets/objects/rock_in_water_frames.yaml',
        'chest01': '/SpiteSheets/objects/chest_01.yaml',
        'chest02': '/SpiteSheets/objects/chest_02.yaml'
    },
    images: {
        // Enemy image fallbacks
        'skeleton': '/SpiteSheets/characters/skeleton.png',
        'slime': '/SpiteSheets/characters/slime.png',
        // Metadata-driven enemy sheets
        'enemySheetBasic': '/SpiteSheets/characters/enemies/enemy_basic_sheet.png',
        'enemySheetFast': '/SpiteSheets/characters/enemies/enemy_fast_sheet.png',
        'enemySheetTank': '/SpiteSheets/characters/enemies/enemy_tank_sheet.png',
        'enemySheetElite': '/SpiteSheets/characters/enemies/enemy_elite_sheet.png'
    },
    yaml: {
        'gameConfig': '/game.yaml',
        'keybindings': '/keybindings.yaml',
        'enemySpritePack': '/SpiteSheets/characters/enemies/enemies_spritesheets.yaml'
    }
};

/**
 * Get asset paths for a specific category
 * @param {string} category - 'characters', 'terrain', 'objects', etc.
 * @returns {Object}
 */
export interface AssetCategory {
    spriteSheets?: Record<string, string>;
    images?: Record<string, string>;
    yaml?: Record<string, string>;
}

export function getAssetCategory(category: string): AssetCategory {
    const categories: Record<string, AssetCategory> = {
        characters: {
            spriteSheets: {
                'player': '/SpiteSheets/characters/player.yaml',
                'skeleton': '/SpiteSheets/characters/skeleton.yaml',
                'slime': '/SpiteSheets/characters/slime.yaml'
            },
            images: {
                'skeleton': '/SpiteSheets/characters/skeleton.png',
                'slime': '/SpiteSheets/characters/slime.png',
                'enemySheetBasic': '/SpiteSheets/characters/enemies/enemy_basic_sheet.png',
                'enemySheetFast': '/SpiteSheets/characters/enemies/enemy_fast_sheet.png',
                'enemySheetTank': '/SpiteSheets/characters/enemies/enemy_tank_sheet.png',
                'enemySheetElite': '/SpiteSheets/characters/enemies/enemy_elite_sheet.png'
            },
            yaml: {
                'enemySpritePack': '/SpiteSheets/characters/enemies/enemies_spritesheets.yaml'
            }
        },
        terrain: {
            spriteSheets: {
                'grass': '/SpiteSheets/grass.yaml',
                'flowers': '/SpiteSheets/flowers.yaml',
                'fences': '/SpiteSheets/fences.yaml'
            }
        },
        objects: {
            spriteSheets: {
                'objects': '/SpiteSheets/objects.yaml'
            }
        }
    };

    return categories[category] || { spriteSheets: {}, images: {}, yaml: {} };
}
