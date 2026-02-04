// File: src/assets/AssetManifest.js
// Default asset manifest for Darkmoon game

export const GameAssetManifest = {
    // Sprite sheets with YAML definitions
    spriteSheets: {
        // Player character
        'player': 'Resources/SpiteSheets/characters/player.yaml',

        // Enemies
        // 'skeleton': 'Resources/SpiteSheets/characters/skeleton.yaml',
        // 'slime': 'Resources/SpiteSheets/characters/slime.yaml',

        // Terrain
        'grass': 'Resources/SpiteSheets/grass.yaml',
        // 'water': 'Resources/SpiteSheets/water-sheet.yaml',

        // Objects
        'objects': 'Resources/SpiteSheets/objects.yaml',

        // Decorations
        'flowers': 'Resources/SpiteSheets/flowers.yaml',
        'fences': 'Resources/SpiteSheets/fences.yaml'
    },

    // Standalone images (no YAML)
    images: {
        // Enemy sprites without YAML (use direct rendering)
        'skeleton': 'Resources/SpiteSheets/characters/skeleton.png',
        'slime': 'Resources/SpiteSheets/characters/slime.png',

        // UI elements
        // 'ui_heart': 'Resources/UI/heart.png',
    },

    // YAML configs (non-sprite)
    yaml: {
        'gameConfig': 'Resources/game.yaml',
        'keybindings': 'Resources/keybindings.yaml'
    }
};

/**
 * Minimal manifest for quick loading (testing/development)
 */
export const MinimalAssetManifest = {
    spriteSheets: {
        'player': 'Resources/SpiteSheets/characters/player.yaml'
    },
    images: {},
    yaml: {}
};

/**
 * Get asset paths for a specific category
 * @param {string} category - 'characters', 'terrain', 'objects', etc.
 * @returns {Object}
 */
export function getAssetCategory(category) {
    const categories = {
        characters: {
            spriteSheets: {
                'player': 'Resources/SpiteSheets/characters/player.yaml'
            },
            images: {
                'skeleton': 'Resources/SpiteSheets/characters/skeleton.png',
                'slime': 'Resources/SpiteSheets/characters/slime.png'
            }
        },
        terrain: {
            spriteSheets: {
                'grass': 'Resources/SpiteSheets/grass.yaml',
                'flowers': 'Resources/SpiteSheets/flowers.yaml',
                'fences': 'Resources/SpiteSheets/fences.yaml'
            }
        },
        objects: {
            spriteSheets: {
                'objects': 'Resources/SpiteSheets/objects.yaml'
            }
        }
    };

    return categories[category] || { spriteSheets: {}, images: {}, yaml: {} };
}
