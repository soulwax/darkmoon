// File: src/ecs/Component.js
// Base component class

import type { Entity } from './Entity';
import type { Camera } from '../graphics/Camera';

export class Component {
    entity: Entity | null;
    active: boolean;

    constructor() {
        this.entity = null;
        this.active = true;
    }

    /**
     * Called when component is added to an entity
     * @param {Entity} entity
     */
    onAdd(entity: Entity) {
        // Override in subclass
    }

    /**
     * Called when component is removed from an entity
     * @param {Entity} entity
     */
    onRemove(entity: Entity) {
        // Override in subclass
    }

    /**
     * Update component state
     * @param {number} deltaTime
     */
    update(deltaTime: number) {
        // Override in subclass
    }

    /**
     * Draw component
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        // Override in subclass
    }
}
