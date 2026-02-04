// File: src/ecs/components/SpriteComponent.js
// Component for static sprite rendering

import { Component } from '../Component.js';

export class SpriteComponent extends Component {
    constructor(spriteSheet, tileId = 0) {
        super();

        this.spriteSheet = spriteSheet;
        this.tileId = tileId;

        // Drawing options
        this.flipX = false;
        this.flipY = false;
        this.alpha = 1.0;
        this.scale = 1.0;
        this.rotation = 0;

        // Offset from entity position
        this.offsetX = 0;
        this.offsetY = 0;

        // Tint color (null = no tint)
        this.tint = null;

        // Layer for sorting
        this.layer = 0;
    }

    /**
     * Set the sprite to display
     * @param {number|string} tileId
     */
    setTile(tileId) {
        this.tileId = tileId;
    }

    draw(ctx, camera) {
        if (!this.spriteSheet || !this.entity) return;

        const x = this.entity.x + this.offsetX;
        const y = this.entity.y + this.offsetY;

        this.spriteSheet.drawTile(ctx, this.tileId, x, y, {
            flipX: this.flipX,
            flipY: this.flipY,
            alpha: this.alpha,
            scale: this.scale * this.entity.scaleX,
            rotation: this.rotation + this.entity.rotation
        });
    }
}
