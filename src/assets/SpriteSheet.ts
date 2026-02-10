// File: src/assets/SpriteSheet.ts

export interface DrawOptions {
    scale?: number;
    flipX?: boolean;
    flipY?: boolean;
    alpha?: number;
    rotation?: number;
    originX?: number;
    originY?: number;
    sheetFrameIndex?: number;
}

export interface SpriteSheetMeta {
    tile_size?: number;
    frame_rate?: number;
    loop?: boolean;
    file?: string | string[];
    files?: string[];
    frame_offset_start?: number;
}

export interface SpriteSheetFrame {
    x: number;
    y: number;
    width?: number;
    height?: number;
}

export interface SpriteSheetTile {
    id: number;
    direction?: string;
    type?: string;
    name?: string;
    atlas_x?: number;
    atlas_y?: number;
    start_x?: number;
    start_y?: number;
    width?: number;
    height?: number;
    frame_list?: SpriteSheetFrame[];
    frame_rate?: number;
    loop?: boolean;
}

export interface SpriteSheetData {
    meta?: SpriteSheetMeta;
    tiles?: SpriteSheetTile[];
}

export interface AnimationFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface AnimationData {
    id: number;
    name: string;
    frames: AnimationFrame[];
    frameRate: number;
    loop: boolean;
    frameCount: number;
}

export type TileData = SpriteSheetTile & { frame?: AnimationFrame };

const EMPTY_DRAW_OPTIONS: DrawOptions = {};

export class SpriteSheet {
    name: string;
    data: SpriteSheetData;
    images: HTMLImageElement[];
    image: HTMLImageElement;
    tileSize: number;
    defaultFrameRate: number;
    defaultLoop: boolean;
    animations: Map<string, AnimationData>;
    tiles: Map<number | string, TileData>;

    constructor(name: string, image: HTMLImageElement, yamlData: SpriteSheetData, images: HTMLImageElement[] | null = null) {
        this.name = name;
        this.data = yamlData;

        // Optional multi-image sheet (e.g., water tiles with per-frame atlases)
        this.images = Array.isArray(images) && images.length > 0 ? images : [image];
        this.image = this.images[0];

        // Parse metadata
        this.tileSize = yamlData.meta?.tile_size || 16;
        this.defaultFrameRate = yamlData.meta?.frame_rate || 10;
        this.defaultLoop = yamlData.meta?.loop !== false;

        // Build animation/tile lookup maps
        this.animations = new Map();
        this.tiles = new Map();

        this._parseData();
    }

    _parseData() {
        const tiles = this.data.tiles || [];

        for (const tile of tiles) {
            const id = tile.id;
            const direction = tile.direction || tile.type || tile.name || `tile_${id}`;

            // Store by both ID and direction name
            this.tiles.set(id, tile);

            // Parse animation data
            if (tile.frame_list && tile.frame_list.length > 0) {
                const animation: AnimationData = {
                    id: id,
                    name: direction,
                    frames: tile.frame_list.map(frame => ({
                        x: frame.x,
                        y: frame.y,
                        width: frame.width || this.tileSize,
                        height: frame.height || this.tileSize
                    })),
                    frameRate: tile.frame_rate || this.defaultFrameRate,
                    loop: tile.loop !== undefined ? tile.loop : this.defaultLoop,
                    frameCount: tile.frame_list.length
                };
                this.animations.set(direction, animation);
            } else {
                // Single frame tile
                const frame: AnimationFrame = {
                    x: tile.atlas_x || tile.start_x || 0,
                    y: tile.atlas_y || tile.start_y || 0,
                    width: tile.width || this.tileSize,
                    height: tile.height || this.tileSize
                };
                this.tiles.set(direction, { ...tile, frame });
            }
        }
    }

    /**
     * Get animation data by name
     * @param {string} name - Animation name (e.g., "down_idle", "left_running")
     * @returns {Object|null}
     */
    getAnimation(name: string) {
        return this.animations.get(name) || null;
    }

    /**
     * Get tile data by ID or name
     * @param {number|string} idOrName
     * @returns {Object|null}
     */
    getTile(idOrName: number | string) {
        return this.tiles.get(idOrName) || null;
    }

    /**
     * Check if animation exists
     * @param {string} name
     * @returns {boolean}
     */
    hasAnimation(name: string) {
        return this.animations.has(name);
    }

    /**
     * Get all animation names
     * @returns {string[]}
     */
    getAnimationNames() {
        return Array.from(this.animations.keys());
    }

    /**
     * Get the current sheet-frame index for multi-image sprite sheets.
     * Uses `meta.files` + `meta.frame_rate` (heuristic: < 1 => seconds per frame, otherwise FPS).
     * @param {number} timeSeconds
     * @returns {number}
     */
    getSheetFrameIndex(timeSeconds: number = 0) {
        const frameCount = this.images?.length || 0;
        if (frameCount <= 1) return 0;

        const frameRate = this.data?.meta?.frame_rate;
        if (typeof frameRate !== 'number' || frameRate <= 0) return 0;

        const secondsPerFrame = frameRate < 1 ? frameRate : 1 / frameRate;
        if (!Number.isFinite(secondsPerFrame) || secondsPerFrame <= 0) return 0;

        const offsetStart = this.data.meta?.frame_offset_start;
        const offset = Number.isFinite(offsetStart)
            ? Math.max(0, Math.floor(offsetStart as number))
            : 0;

        return (offset + Math.floor(timeSeconds / secondsPerFrame)) % frameCount;
    }

    /**
     * Draw a specific frame from an animation
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} animationName
     * @param {number} frameIndex
     * @param {number} x - Destination X
     * @param {number} y - Destination Y
     * @param {Object} [options] - Drawing options
     */
    drawFrame(ctx: CanvasRenderingContext2D, animationName: string, frameIndex: number, x: number, y: number, options?: DrawOptions) {
        const animation = this.animations.get(animationName);
        if (!animation) {
            console.warn(`Animation not found: ${animationName}`);
            return;
        }

        const frame = animation.frames[frameIndex % animation.frames.length];
        this._drawFrame(ctx, frame, x, y, options || EMPTY_DRAW_OPTIONS);
    }

    /**
     * Draw a static tile
     * @param {CanvasRenderingContext2D} ctx
     * @param {number|string} tileId
     * @param {number} x
     * @param {number} y
     * @param {Object} [options]
     */
    drawTile(ctx: CanvasRenderingContext2D, tileId: number | string, x: number, y: number, options?: DrawOptions) {
        const tile = this.tiles.get(tileId);
        if (!tile) {
            console.warn(`Tile not found: ${tileId}`);
            return;
        }

        const rawFrame = tile.frame || tile.frame_list?.[0] || {
            x: tile.atlas_x || 0,
            y: tile.atlas_y || 0,
            width: tile.width || this.tileSize,
            height: tile.height || this.tileSize
        };

        const frame: AnimationFrame = {
            x: rawFrame.x,
            y: rawFrame.y,
            width: rawFrame.width ?? this.tileSize,
            height: rawFrame.height ?? this.tileSize
        };

        this._drawFrame(ctx, frame, x, y, options || EMPTY_DRAW_OPTIONS);
    }

    /**
     * Internal draw method
     */
    _drawFrame(ctx: CanvasRenderingContext2D, frame: AnimationFrame, x: number, y: number, options: DrawOptions) {
        const {
            scale = 1,
            flipX = false,
            flipY = false,
            alpha = 1,
            rotation = 0,
            originX = 0.5,
            originY = 0.5,
            sheetFrameIndex = 0
        } = options;

        const sourceImage = this.images?.[sheetFrameIndex] || this.image;

        const width = frame.width * scale;
        const height = frame.height * scale;

        ctx.save();

        // Apply alpha
        if (alpha !== 1) {
            ctx.globalAlpha = alpha;
        }

        // Move to draw position
        ctx.translate(x, y);

        // Apply rotation around origin
        if (rotation !== 0) {
            ctx.rotate(rotation);
        }

        // Apply flip
        if (flipX || flipY) {
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        }

        // Draw image centered on origin
        ctx.drawImage(
            sourceImage,
            frame.x, frame.y,           // Source position
            frame.width, frame.height,  // Source size
            -width * originX,           // Dest X (centered)
            -height * originY,          // Dest Y (centered)
            width, height               // Dest size
        );

        ctx.restore();
    }

    /**
     * Get image dimensions
     */
    get width() {
        return this.image.width;
    }

    get height() {
        return this.image.height;
    }
}
