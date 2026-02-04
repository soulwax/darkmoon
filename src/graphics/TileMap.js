// File: src/graphics/TileMap.js
// Tile-based world rendering

import { MathUtils } from '../core/Math.js';

export class TileMap {
    constructor(config = {}) {
        this.tileSize = config.tileSize || 16;
        this.width = config.width || 100;   // Width in tiles
        this.height = config.height || 100; // Height in tiles

        // Tile data layers
        this.layers = {
            ground: null,       // Background tiles
            decoration: null,   // Decorative overlay
            collision: null     // Collision data
        };

        // Sprite sheets for rendering
        this.spriteSheets = new Map();

        // Tile type definitions
        this.tileTypes = new Map();
    }

    /**
     * Initialize tile map with dimensions
     * @param {number} width - Width in tiles
     * @param {number} height - Height in tiles
     */
    init(width, height) {
        this.width = width;
        this.height = height;

        // Create empty layers
        this.layers.ground = new Uint16Array(width * height);
        this.layers.decoration = new Uint16Array(width * height);
        this.layers.collision = new Uint8Array(width * height);
    }

    /**
     * Register a sprite sheet for tile rendering
     * @param {string} name
     * @param {SpriteSheet} spriteSheet
     */
    registerSpriteSheet(name, spriteSheet) {
        this.spriteSheets.set(name, spriteSheet);
    }

    /**
     * Define a tile type
     * @param {number} id
     * @param {Object} definition
     */
    defineTileType(id, definition) {
        this.tileTypes.set(id, {
            spriteSheet: definition.spriteSheet || 'default',
            tileId: definition.tileId || 0,
            walkable: definition.walkable !== false,
            animationName: definition.animationName || null,
            ...definition
        });
    }

    /**
     * Set a tile at position
     * @param {string} layer - 'ground', 'decoration', or 'collision'
     * @param {number} x - Tile X
     * @param {number} y - Tile Y
     * @param {number} tileId
     */
    setTile(layer, x, y, tileId) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        const index = y * this.width + x;
        if (this.layers[layer]) {
            this.layers[layer][index] = tileId;
        }
    }

    /**
     * Get a tile at position
     * @param {string} layer
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    getTile(layer, x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;

        const index = y * this.width + x;
        return this.layers[layer]?.[index] || 0;
    }

    /**
     * Check if tile is walkable
     * @param {number} x - Tile X
     * @param {number} y - Tile Y
     * @returns {boolean}
     */
    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

        const index = y * this.width + x;
        const collisionValue = this.layers.collision[index];
        return collisionValue === 0;
    }

    /**
     * Check collision at world position
     * @param {number} worldX
     * @param {number} worldY
     * @returns {boolean}
     */
    isWalkableWorld(worldX, worldY) {
        const tileX = Math.floor(worldX / this.tileSize);
        const tileY = Math.floor(worldY / this.tileSize);
        return this.isWalkable(tileX, tileY);
    }

    /**
     * Fill a rectangular area with a tile
     * @param {string} layer
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} tileId
     */
    fillRect(layer, x, y, width, height, tileId) {
        for (let ty = y; ty < y + height; ty++) {
            for (let tx = x; tx < x + width; tx++) {
                this.setTile(layer, tx, ty, tileId);
            }
        }
    }

    /**
     * Generate a simple procedural ground layer
     * @param {Object} options
     */
    generateGround(options = {}) {
        const {
            baseTile = 1,
            noiseTiles = [],
            noiseChance = 0.1
        } = options;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let tileId = baseTile;

                // Add random variation
                if (noiseTiles.length > 0 && Math.random() < noiseChance) {
                    tileId = noiseTiles[MathUtils.randomInt(0, noiseTiles.length - 1)];
                }

                this.setTile('ground', x, y, tileId);
            }
        }
    }

    /**
     * Draw visible tiles
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const bounds = camera.getVisibleBounds();

        // Calculate visible tile range (with margin)
        const margin = 2; // Extra tiles for smooth scrolling
        const startX = Math.max(0, Math.floor(bounds.x / this.tileSize) - margin);
        const startY = Math.max(0, Math.floor(bounds.y / this.tileSize) - margin);
        const endX = Math.min(this.width, Math.ceil((bounds.x + bounds.width) / this.tileSize) + margin);
        const endY = Math.min(this.height, Math.ceil((bounds.y + bounds.height) / this.tileSize) + margin);

        // Draw ground layer
        this._drawLayer(ctx, 'ground', startX, startY, endX, endY);

        // Draw decoration layer
        this._drawLayer(ctx, 'decoration', startX, startY, endX, endY);
    }

    _drawLayer(ctx, layerName, startX, startY, endX, endY) {
        const layer = this.layers[layerName];
        if (!layer) return;

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = y * this.width + x;
                const tileId = layer[index];

                if (tileId === 0) continue; // Skip empty tiles

                const tileDef = this.tileTypes.get(tileId);
                if (!tileDef) {
                    // Default: draw colored rectangle for unknown tiles
                    ctx.fillStyle = '#448844';
                    ctx.fillRect(
                        x * this.tileSize,
                        y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                    continue;
                }

                const spriteSheet = this.spriteSheets.get(tileDef.spriteSheet);
                if (spriteSheet) {
                    const worldX = x * this.tileSize + this.tileSize / 2;
                    const worldY = y * this.tileSize + this.tileSize / 2;

                    if (tileDef.animationName) {
                        spriteSheet.drawFrame(ctx, tileDef.animationName, 0, worldX, worldY);
                    } else {
                        spriteSheet.drawTile(ctx, tileDef.tileId, worldX, worldY);
                    }
                } else {
                    // Fallback: draw colored rectangle
                    ctx.fillStyle = tileDef.color || '#448844';
                    ctx.fillRect(
                        x * this.tileSize,
                        y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }
    }

    /**
     * Draw collision debug overlay
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    drawCollisionDebug(ctx, camera) {
        const bounds = camera.getVisibleBounds();

        const startX = Math.max(0, Math.floor(bounds.x / this.tileSize));
        const startY = Math.max(0, Math.floor(bounds.y / this.tileSize));
        const endX = Math.min(this.width, Math.ceil((bounds.x + bounds.width) / this.tileSize));
        const endY = Math.min(this.height, Math.ceil((bounds.y + bounds.height) / this.tileSize));

        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (!this.isWalkable(x, y)) {
                    ctx.fillRect(
                        x * this.tileSize,
                        y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }
    }

    /**
     * Get world dimensions in pixels
     */
    get worldWidth() {
        return this.width * this.tileSize;
    }

    get worldHeight() {
        return this.height * this.tileSize;
    }
}
