// File: src/ecs/Component.js
// Base component class

export class Component {
    constructor() {
        this.entity = null;
        this.active = true;
    }

    /**
     * Called when component is added to an entity
     * @param {Entity} entity
     */
    onAdd(entity) {
        // Override in subclass
    }

    /**
     * Called when component is removed from an entity
     * @param {Entity} entity
     */
    onRemove(entity) {
        // Override in subclass
    }

    /**
     * Update component state
     * @param {number} deltaTime
     */
    update(deltaTime) {
        // Override in subclass
    }

    /**
     * Draw component
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        // Override in subclass
    }
}
