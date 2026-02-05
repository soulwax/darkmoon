// File: src/assets/AssetManifest.js
// Default asset manifest for Darkmoon game

import type { AssetManifest } from './AssetLoader';

export const GameAssetManifest: AssetManifest = {
    // Sprite sheets with YAML definitions
    spriteSheets: {
        // Player character
        'player': '/SpiteSheets/characters/player.yaml',

        // Enemies
        // 'skeleton': '/SpiteSheets/characters/skeleton.yaml',
        // 'slime': '/SpiteSheets/characters/slime.yaml',

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
        // Enemy sprites without YAML (use direct rendering)
        'skeleton': '/SpiteSheets/characters/skeleton.png',
        'slime': '/SpiteSheets/characters/slime.png',

        // UI elements
        // 'ui_heart': '/UI/heart.png',
    },

    // YAML configs (non-sprite)
    yaml: {
        'gameConfig': '/game.yaml',
        'keybindings': '/keybindings.yaml'
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
        // World tiles
        'grass': '/SpiteSheets/grass.yaml',
        'dirtGrass': '/SpiteSheets/dirt-grass.yaml',
        'decorGrass': '/SpiteSheets/decor-grass.yaml',
        'flowers': '/SpiteSheets/flowers.yaml',
        'shrooms': '/SpiteSheets/shrooms.yaml',
        'objects': '/SpiteSheets/objects.yaml',
        'water': '/SpiteSheets/water-sheet.yaml',
        'rockInWater': '/SpiteSheets/objects/rock_in_water_frames.yaml'
    },
    images: {
        'skeleton': '/SpiteSheets/characters/skeleton.png',
        'slime': '/SpiteSheets/characters/slime.png'
    },
    yaml: {
        'gameConfig': '/game.yaml',
        'keybindings': '/keybindings.yaml'
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
                'player': '/SpiteSheets/characters/player.yaml'
            },
            images: {
                'skeleton': '/SpiteSheets/characters/skeleton.png',
                'slime': '/SpiteSheets/characters/slime.png'
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
