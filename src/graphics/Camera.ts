// File: src/graphics/Camera.ts

import { Vector2, MathUtils } from '../core/Math';

export interface CameraTarget {
    x: number;
    y: number;
}

export class Camera {
    viewportWidth: number;
    viewportHeight: number;
    position: Vector2;
    target: CameraTarget | null;
    targetOffset: Vector2;
    smoothing: number;
    zoom: number;
    minZoom: number;
    maxZoom: number;
    boundsEnabled: boolean;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    deadZone: { width: number; height: number };
    shakeEnabled: boolean;
    shakeIntensity: number;
    shakeDuration: number;
    shakeOffset: Vector2;
    maxShakeIntensity: number;
    punchOffset: Vector2;
    punchDamping: number;

    constructor(viewportWidth: number, viewportHeight: number, config: {
        followSmoothing?: number;
        zoom?: number;
        boundsEnabled?: boolean;
        minX?: number;
        minY?: number;
        maxX?: number;
        maxY?: number;
        deadZoneWidth?: number;
        deadZoneHeight?: number;
        shakeEnabled?: boolean;
        maxShakeIntensity?: number;
    } = {}) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;

        // Camera position (top-left corner in world space)
        this.position = new Vector2(0, 0);

        // Target to follow
        this.target = null;
        this.targetOffset = new Vector2(0, 0);

        // Smoothing (0 = instant, 1 = very smooth)
        this.smoothing = config.followSmoothing || 0.15;

        // Zoom level
        this.zoom = config.zoom || 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 2.0;

        // World bounds
        this.boundsEnabled = config.boundsEnabled !== false;
        this.bounds = {
            minX: config.minX || 0,
            minY: config.minY || 0,
            maxX: config.maxX || 1600,
            maxY: config.maxY || 1600
        };

        // Dead zone (area where target can move without camera moving)
        this.deadZone = {
            width: config.deadZoneWidth || 0,
            height: config.deadZoneHeight || 0
        };

        // Camera shake
        this.shakeEnabled = config.shakeEnabled !== false;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffset = new Vector2(0, 0);
        this.maxShakeIntensity = config.maxShakeIntensity || 5;

        // Camera punch (impulse that quickly eases back to center)
        this.punchOffset = new Vector2(0, 0);
        this.punchDamping = 16;
    }

    /**
     * Set the target to follow
     * @param {Object} target - Object with x, y properties
     * @param {number} [offsetX=0] - Offset from target center
     * @param {number} [offsetY=0]
     */
    follow(target: CameraTarget, offsetX: number = 0, offsetY: number = 0) {
        this.target = target;
        this.targetOffset.set(offsetX, offsetY);
    }

    /**
     * Stop following target
     */
    unfollow() {
        this.target = null;
    }

    /**
     * Set camera position directly
     * @param {number} x
     * @param {number} y
     */
    setPosition(x: number, y: number) {
        this.position.set(x, y);
        this._clampToBounds();
    }

    /**
     * Center camera on a point
     * @param {number} x
     * @param {number} y
     */
    centerOn(x: number, y: number) {
        this.position.set(
            x - this.viewportWidth / (2 * this.zoom),
            y - this.viewportHeight / (2 * this.zoom)
        );
        this._clampToBounds();
    }

    /**
     * Set world bounds
     */
    setBounds(minX: number, minY: number, maxX: number, maxY: number) {
        this.bounds.minX = minX;
        this.bounds.minY = minY;
        this.bounds.maxX = maxX;
        this.bounds.maxY = maxY;
    }

    /**
     * Set zoom level
     * @param {number} level
     */
    setZoom(level: number) {
        this.zoom = MathUtils.clamp(level, this.minZoom, this.maxZoom);
    }

    /**
     * Trigger camera shake
     * @param {number} intensity
     * @param {number} duration - Duration in seconds
     */
    shake(intensity: number, duration: number) {
        if (!this.shakeEnabled) return;
        this.shakeIntensity = Math.min(intensity, this.maxShakeIntensity);
        this.shakeDuration = duration;
    }

    /**
     * Trigger camera punch in a direction
     * @param {number} dirX
     * @param {number} dirY
     * @param {number} intensity
     */
    punch(dirX: number, dirY: number, intensity: number = 5) {
        if (!this.shakeEnabled) return;

        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const nx = dirX / magnitude;
        const ny = dirY / magnitude;
        const clamped = Math.min(intensity, this.maxShakeIntensity * 2);

        // Accumulate so repeated hits stack briefly.
        this.punchOffset.x += nx * clamped;
        this.punchOffset.y += ny * clamped;
    }

    /**
     * Update camera position
     * @param {number} deltaTime
     */
    update(deltaTime: number) {
        // Follow target
        if (this.target) {
            const targetX = this.target.x + this.targetOffset.x - this.viewportWidth / (2 * this.zoom);
            const targetY = this.target.y + this.targetOffset.y - this.viewportHeight / (2 * this.zoom);

            // Apply dead zone
            let dx = targetX - this.position.x;
            let dy = targetY - this.position.y;

            const halfDeadX = this.deadZone.width / 2;
            const halfDeadY = this.deadZone.height / 2;

            if (Math.abs(dx) < halfDeadX) dx = 0;
            else dx -= Math.sign(dx) * halfDeadX;

            if (Math.abs(dy) < halfDeadY) dy = 0;
            else dy -= Math.sign(dy) * halfDeadY;

            // Smooth follow (lerp)
            if (this.smoothing > 0) {
                const t = 1 - Math.pow(this.smoothing, deltaTime * 60);
                this.position.x += dx * t;
                this.position.y += dy * t;
            } else {
                this.position.x = targetX;
                this.position.y = targetY;
            }
        }

        // Update shake
        if (this.shakeDuration > 0) {
            this.shakeDuration -= deltaTime;
            const t = this.shakeDuration > 0 ? this.shakeIntensity : 0;
            this.shakeOffset.set(
                MathUtils.random(-t, t),
                MathUtils.random(-t, t)
            );
        } else {
            this.shakeOffset.set(0, 0);
        }

        // Ease punch back to neutral.
        const punchLerp = Math.min(1, deltaTime * this.punchDamping);
        this.punchOffset.x = MathUtils.lerp(this.punchOffset.x, 0, punchLerp);
        this.punchOffset.y = MathUtils.lerp(this.punchOffset.y, 0, punchLerp);

        // Clamp to bounds
        this._clampToBounds();
    }

    /**
     * Clamp camera position to world bounds
     */
    _clampToBounds() {
        if (!this.boundsEnabled) return;

        const viewW = this.viewportWidth / this.zoom;
        const viewH = this.viewportHeight / this.zoom;

        // Clamp so camera doesn't show outside world
        this.position.x = MathUtils.clamp(
            this.position.x,
            this.bounds.minX,
            Math.max(this.bounds.minX, this.bounds.maxX - viewW)
        );

        this.position.y = MathUtils.clamp(
            this.position.y,
            this.bounds.minY,
            Math.max(this.bounds.minY, this.bounds.maxY - viewH)
        );
    }

    /**
     * Convert world coordinates to screen coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{x: number, y: number}}
     */
    worldToScreen(worldX: number, worldY: number) {
        return {
            x: (worldX - this.position.x - this.shakeOffset.x - this.punchOffset.x) * this.zoom,
            y: (worldY - this.position.y - this.shakeOffset.y - this.punchOffset.y) * this.zoom
        };
    }

    /**
     * Convert screen coordinates to world coordinates
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToWorld(screenX: number, screenY: number) {
        return {
            x: screenX / this.zoom + this.position.x + this.shakeOffset.x + this.punchOffset.x,
            y: screenY / this.zoom + this.position.y + this.shakeOffset.y + this.punchOffset.y
        };
    }

    /**
     * Check if a world rectangle is visible
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {boolean}
     */
    isVisible(x: number, y: number, width: number, height: number) {
        const viewW = this.viewportWidth / this.zoom;
        const viewH = this.viewportHeight / this.zoom;

        return x + width > this.position.x &&
               x < this.position.x + viewW &&
               y + height > this.position.y &&
               y < this.position.y + viewH;
    }

    /**
     * Apply camera transform to canvas context
     * @param {CanvasRenderingContext2D} ctx
     */
    applyTransform(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        const tx = -this.position.x - this.shakeOffset.x - this.punchOffset.x;
        const ty = -this.position.y - this.shakeOffset.y - this.punchOffset.y;

        // Pixel-snap camera translation in screen space to avoid subpixel seams between tiles/sprites.
        // Convert to screen pixels, round, then convert back to world units.
        const snappedTx = Math.round(tx * this.zoom) / this.zoom;
        const snappedTy = Math.round(ty * this.zoom) / this.zoom;

        ctx.translate(snappedTx, snappedTy);
    }

    /**
     * Reset camera transform
     * @param {CanvasRenderingContext2D} ctx
     */
    resetTransform(ctx: CanvasRenderingContext2D) {
        ctx.restore();
    }

    /**
     * Get visible world bounds
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getVisibleBounds() {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.viewportWidth / this.zoom,
            height: this.viewportHeight / this.zoom
        };
    }
}
