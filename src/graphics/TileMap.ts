// File: src/graphics/TileMap.ts

import { MathUtils } from '../core/Math';
import type { SpriteSheet, DrawOptions } from '../assets/SpriteSheet';
import type { Camera } from './Camera';

export interface TileTypeDefinition {
    spriteSheet?: string;
    tileId?: number;
    walkable?: boolean;
    animationName?: string | null;
    color?: string;
    drawOptions?: DrawOptions;
}

export class TileMap {
    tileSize: number;
    width: number;
    height: number;
    layers: {
        ground: Uint16Array | null;
        decoration: Uint16Array | null;
        collision: Uint8Array | null;
    };
    spriteSheets: Map<string, SpriteSheet>;
    tileTypes: Map<number, TileTypeDefinition>;

    constructor(config: {
        tileSize?: number;
        width?: number;
        height?: number;
    } = {}) {
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
    init(width: number, height: number) {
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
    registerSpriteSheet(name: string, spriteSheet: SpriteSheet) {
        this.spriteSheets.set(name, spriteSheet);
    }

    /**
     * Define a tile type
     * @param {number} id
     * @param {Object} definition
     */
    defineTileType(id: number, definition: TileTypeDefinition) {
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
    setTile(layer: 'ground' | 'decoration' | 'collision', x: number, y: number, tileId: number) {
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
    getTile(layer: 'ground' | 'decoration' | 'collision', x: number, y: number) {
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
    isWalkable(x: number, y: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

        const index = y * this.width + x;
        const collisionLayer = this.layers.collision;
        if (collisionLayer && collisionLayer[index] !== 0) {
            return false;
        }

        const groundTileId = this.layers.ground?.[index] || 0;
        if (groundTileId !== 0) {
            const groundDef = this.tileTypes.get(groundTileId);
            if (groundDef && groundDef.walkable === false) {
                return false;
            }
        }

        const decorationTileId = this.layers.decoration?.[index] || 0;
        if (decorationTileId !== 0) {
            const decorationDef = this.tileTypes.get(decorationTileId);
            if (decorationDef && decorationDef.walkable === false) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check collision at world position
     * @param {number} worldX
     * @param {number} worldY
     * @returns {boolean}
     */
    isWalkableWorld(worldX: number, worldY: number) {
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
    fillRect(layer: 'ground' | 'decoration' | 'collision', x: number, y: number, width: number, height: number, tileId: number) {
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
    generateGround(options: {
        baseTile?: number;
        noiseTiles?: number[];
        noiseChance?: number;
    } = {}) {
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
     * @param {number} [time] - World time in seconds (for animated tiles)
     */
    draw(ctx: CanvasRenderingContext2D, camera: Camera, time: number = 0) {
        const bounds = camera.getVisibleBounds();
        const sheetFrameCache = new Map();
        const sheetOptionsCache = new Map();

        // Calculate visible tile range (with margin)
        const margin = 2; // Extra tiles for smooth scrolling
        const startX = Math.max(0, Math.floor(bounds.x / this.tileSize) - margin);
        const startY = Math.max(0, Math.floor(bounds.y / this.tileSize) - margin);
        const endX = Math.min(this.width, Math.ceil((bounds.x + bounds.width) / this.tileSize) + margin);
        const endY = Math.min(this.height, Math.ceil((bounds.y + bounds.height) / this.tileSize) + margin);

        // Draw ground layer
        this._drawLayer(ctx, 'ground', startX, startY, endX, endY, time, sheetFrameCache, sheetOptionsCache);

        // Draw decoration layer
        this._drawLayer(ctx, 'decoration', startX, startY, endX, endY, time, sheetFrameCache, sheetOptionsCache);
    }

    _drawLayer(
        ctx: CanvasRenderingContext2D,
        layerName: 'ground' | 'decoration' | 'collision',
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        time: number,
        sheetFrameCache: Map<string, number>,
        sheetOptionsCache: Map<string, DrawOptions>
    ) {
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

                const sheetKey = tileDef.spriteSheet || 'default';
                const spriteSheet = this.spriteSheets.get(sheetKey);
                if (spriteSheet) {
                    const worldX = x * this.tileSize + this.tileSize / 2;
                    const worldY = y * this.tileSize + this.tileSize / 2;

                    let sheetFrameIndex = 0;
                    if (sheetFrameCache.has(sheetKey)) {
                        sheetFrameIndex = sheetFrameCache.get(sheetKey) || 0;
                    } else if (typeof spriteSheet.getSheetFrameIndex === 'function') {
                        sheetFrameIndex = spriteSheet.getSheetFrameIndex(time);
                        sheetFrameCache.set(sheetKey, sheetFrameIndex);
                    }

                    const baseOptions = tileDef.drawOptions || null;
                    let drawOptions: DrawOptions | null = baseOptions;

                    if (sheetFrameIndex !== 0) {
                        if (baseOptions) {
                            drawOptions = { ...baseOptions, sheetFrameIndex };
                        } else if (sheetOptionsCache.has(sheetKey)) {
                            drawOptions = sheetOptionsCache.get(sheetKey) || null;
                        } else {
                            drawOptions = { sheetFrameIndex };
                            sheetOptionsCache.set(sheetKey, drawOptions);
                        }
                    }

                    if (tileDef.animationName) {
                        const anim = spriteSheet.getAnimation?.(tileDef.animationName);
                        const frameCount = anim?.frameCount || anim?.frames?.length || 0;
                        const frameRate = anim?.frameRate && anim.frameRate > 0 ? anim.frameRate : 10;
                        const frameIndex = frameCount > 0 ? Math.floor(time * frameRate) % frameCount : 0;

                        spriteSheet.drawFrame(ctx, tileDef.animationName, frameIndex, worldX, worldY, drawOptions || undefined);
                    } else {
                        spriteSheet.drawTile(ctx, tileDef.tileId || 0, worldX, worldY, drawOptions || undefined);
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
    drawCollisionDebug(ctx: CanvasRenderingContext2D, camera: Camera) {
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
