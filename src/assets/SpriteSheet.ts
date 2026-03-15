// File: src/assets/SpriteSheet.ts

export interface DrawOptions {
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    flipX?: boolean;
    flipY?: boolean;
    alpha?: number;
    rotation?: number;
    originX?: number;
    originY?: number;
    tint?: string | null;
    tintAlpha?: number;
    sheetFrameIndex?: number;
}

export interface SpriteSheetMeta {
    tile_size?: number;
    sprite_width?: number;
    sprite_height?: number;
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
    sprite_count?: number;
    frame_rate?: number;
    loop?: boolean;
    flippable?: boolean;
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
    defaultFrameWidth: number;
    defaultFrameHeight: number;
    defaultFrameRate: number;
    defaultLoop: boolean;
    animations: Map<string, AnimationData>;
    animationBindings: Map<string, { name: string; flipX: boolean }>;
    tiles: Map<number | string, TileData>;

    constructor(name: string, image: HTMLImageElement, yamlData: SpriteSheetData, images: HTMLImageElement[] | null = null) {
        this.name = name;
        this.data = yamlData;

        // Optional multi-image sheet (e.g., water tiles with per-frame atlases)
        this.images = Array.isArray(images) && images.length > 0 ? images : [image];
        this.image = this.images[0];

        // Parse metadata
        this.defaultFrameWidth = yamlData.meta?.sprite_width || yamlData.meta?.tile_size || 16;
        this.defaultFrameHeight = yamlData.meta?.sprite_height || yamlData.meta?.tile_size || 16;
        this.tileSize = yamlData.meta?.tile_size || Math.max(this.defaultFrameWidth, this.defaultFrameHeight);
        this.defaultFrameRate = yamlData.meta?.frame_rate || 10;
        this.defaultLoop = yamlData.meta?.loop !== false;

        // Build animation/tile lookup maps
        this.animations = new Map();
        this.animationBindings = new Map();
        this.tiles = new Map();

        this._parseData();
    }

    _parseData() {
        const tiles = this.data.tiles || [];

        for (const tile of tiles) {
            const id = tile.id;
            const direction = tile.direction || tile.type || tile.name || `tile_${id}`;
            const frames = this._resolveFrames(tile);

            // Store by both ID and direction name
            this.tiles.set(id, tile);

            // Parse animation data
            if (frames.length > 0) {
                const animation: AnimationData = {
                    id: id,
                    name: direction,
                    frames,
                    frameRate: tile.frame_rate || this.defaultFrameRate,
                    loop: tile.loop !== undefined ? tile.loop : this.defaultLoop,
                    frameCount: frames.length
                };
                this.animations.set(direction, animation);
                this._registerAnimationBindings(direction, tile);
            } else {
                // Single frame tile
                const frame: AnimationFrame = {
                    x: tile.atlas_x ?? tile.start_x ?? 0,
                    y: tile.atlas_y ?? tile.start_y ?? 0,
                    width: tile.width || this.defaultFrameWidth,
                    height: tile.height || this.defaultFrameHeight
                };
                this.tiles.set(direction, { ...tile, frame });
            }
        }
    }

    _resolveFrames(tile: SpriteSheetTile): AnimationFrame[] {
        const spriteCount = Number.isFinite(tile.sprite_count)
            ? Math.max(0, Math.floor(tile.sprite_count as number))
            : 0;

        const explicitFrames = Array.isArray(tile.frame_list)
            ? tile.frame_list.map((frame) => ({
                x: frame.x,
                y: frame.y,
                width: frame.width || tile.width || this.defaultFrameWidth,
                height: frame.height || tile.height || this.defaultFrameHeight
            }))
            : [];

        if (spriteCount > 0 && explicitFrames.length >= spriteCount) {
            return explicitFrames.slice(0, spriteCount);
        }

        if (spriteCount > 1 && explicitFrames.length === 1) {
            const [firstFrame] = explicitFrames;
            return Array.from({ length: spriteCount }, (_, index) => ({
                x: firstFrame.x + index * firstFrame.width,
                y: firstFrame.y,
                width: firstFrame.width,
                height: firstFrame.height
            }));
        }

        if (explicitFrames.length > 0) {
            return explicitFrames;
        }

        if (spriteCount <= 0) {
            return [];
        }

        const startX = tile.atlas_x ?? tile.start_x ?? 0;
        const startY = tile.atlas_y ?? tile.start_y ?? 0;
        const frameWidth = tile.width || this.defaultFrameWidth;
        const frameHeight = tile.height || this.defaultFrameHeight;

        return Array.from({ length: spriteCount }, (_, index) => ({
            x: startX + index * frameWidth,
            y: startY,
            width: frameWidth,
            height: frameHeight
        }));
    }

    _registerAnimationBindings(animationName: string, tile: SpriteSheetTile) {
        this._bindAnimation(animationName, animationName, false);

        const semantics = this._parseAnimationSemantics(animationName);
        if (!semantics) {
            return;
        }

        const { action, direction } = semantics;
        const bindDirectionalAliases = (targetDirection: string, flipX: boolean) => {
            for (const actionAlias of this._getActionAliases(action)) {
                this._bindAnimation(`${targetDirection}_${actionAlias}`, animationName, flipX);
                this._bindAnimation(`${actionAlias}_${targetDirection}`, animationName, flipX);
            }
        };

        if (direction === 'none') {
            for (const actionAlias of this._getActionAliases(action)) {
                this._bindAnimation(actionAlias, animationName, false);
            }
            return;
        }

        if (direction === 'sideways') {
            bindDirectionalAliases('sideways', false);

            if (tile.flippable) {
                // Sideways rows are treated as right-facing source art by convention.
                bindDirectionalAliases('right', false);
                bindDirectionalAliases('left', true);
            }
            return;
        }

        bindDirectionalAliases(direction, false);
    }

    _bindAnimation(alias: string, animationName: string, flipX: boolean) {
        const key = alias.trim().toLowerCase();
        if (!key || this.animationBindings.has(key)) {
            return;
        }

        this.animationBindings.set(key, { name: animationName, flipX });
    }

    _parseAnimationSemantics(animationName: string) {
        const tokens = animationName.trim().toLowerCase().split('_').filter(Boolean);
        if (tokens.length === 0) {
            return null;
        }

        if (tokens.length === 1) {
            const action = this._normalizeActionToken(tokens[0]);
            return action === 'death' ? { action, direction: 'none' as const } : null;
        }

        const firstAction = this._normalizeActionToken(tokens[0]);
        const lastAction = this._normalizeActionToken(tokens[tokens.length - 1]);
        const firstDirection = this._normalizeDirectionToken(tokens[0]);
        const lastDirection = this._normalizeDirectionToken(tokens[tokens.length - 1]);

        if (firstAction && lastDirection) {
            return { action: firstAction, direction: lastDirection };
        }

        if (firstDirection && lastAction) {
            return { action: lastAction, direction: firstDirection };
        }

        return null;
    }

    _normalizeActionToken(token: string) {
        switch (token) {
            case 'idle':
                return 'idle' as const;
            case 'run':
            case 'running':
            case 'walk':
            case 'move':
                return 'running' as const;
            case 'attack':
                return 'attack' as const;
            case 'hurt':
                return 'hurt' as const;
            case 'death':
            case 'dead':
            case 'die':
                return 'death' as const;
            default:
                return null;
        }
    }

    _normalizeDirectionToken(token: string) {
        switch (token) {
            case 'up':
            case 'down':
            case 'left':
            case 'right':
            case 'sideways':
                return token;
            default:
                return null;
        }
    }

    _getActionAliases(action: 'idle' | 'running' | 'attack' | 'hurt' | 'death') {
        switch (action) {
            case 'running':
                return ['running', 'move', 'walk', 'run'];
            case 'death':
                return ['death', 'dead', 'die'];
            default:
                return [action];
        }
    }

    getAnimationBinding(name: string) {
        return this.animationBindings.get(name.trim().toLowerCase()) || null;
    }

    /**
     * Get animation data by name
     * @param {string} name - Animation name (e.g., "down_idle", "left_running")
     * @returns {Object|null}
     */
    getAnimation(name: string) {
        const binding = this.getAnimationBinding(name);
        if (!binding) {
            return null;
        }

        return this.animations.get(binding.name) || null;
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
        return this.getAnimationBinding(name) !== null;
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
        const animation = this.getAnimation(animationName);
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
            x: tile.atlas_x ?? tile.start_x ?? 0,
            y: tile.atlas_y ?? tile.start_y ?? 0,
            width: tile.width || this.defaultFrameWidth,
            height: tile.height || this.defaultFrameHeight
        };

        const frame: AnimationFrame = {
            x: rawFrame.x,
            y: rawFrame.y,
            width: rawFrame.width ?? this.defaultFrameWidth,
            height: rawFrame.height ?? this.defaultFrameHeight
        };

        this._drawFrame(ctx, frame, x, y, options || EMPTY_DRAW_OPTIONS);
    }

    /**
     * Internal draw method
     */
    _drawFrame(ctx: CanvasRenderingContext2D, frame: AnimationFrame, x: number, y: number, options: DrawOptions) {
        const {
            scale = 1,
            scaleX = scale,
            scaleY = scale,
            flipX = false,
            flipY = false,
            alpha = 1,
            rotation = 0,
            originX = 0.5,
            originY = 0.5,
            tint = null,
            tintAlpha = 0.5,
            sheetFrameIndex = 0
        } = options;

        const sourceImage = this.images?.[sheetFrameIndex] || this.image;

        const width = frame.width * scaleX;
        const height = frame.height * scaleY;

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

        // Optional tint overlay (useful for hit flashes, status effects).
        if (tint) {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = prevAlpha * Math.max(0, Math.min(1, tintAlpha));
            ctx.fillStyle = tint;
            ctx.fillRect(-width * originX, -height * originY, width, height);
        }

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
