// File: src/ecs/Entity.ts

import type { Component } from './Component';
import type { Camera } from '../graphics/Camera';

let entityIdCounter = 0;

export class Entity {
    id: number;
    active: boolean;
    destroyed: boolean;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    vx: number;
    vy: number;
    components: Map<string, Component>;
    tags: Set<string>;
    parent: Entity | null;
    children: Entity[];

    constructor(x: number = 0, y: number = 0) {
        this.id = entityIdCounter++;
        this.active = true;
        this.destroyed = false;

        // Transform (built-in for convenience)
        this.x = x;
        this.y = y;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;

        // Velocity (commonly used)
        this.vx = 0;
        this.vy = 0;

        // Components
        this.components = new Map();

        // Tags for filtering
        this.tags = new Set();

        // Parent/child relationships
        this.parent = null;
        this.children = [];
    }

    /**
     * Add a component to this entity
     * @param {Component} component
     * @returns {Entity} this (for chaining)
     */
    addComponent<T extends Component>(component: T): this {
        const type = component.constructor.name;
        component.entity = this;
        this.components.set(type, component);

        if (component.onAdd) {
            component.onAdd(this);
        }

        return this;
    }

    /**
     * Get a component by type
     * @param {Function|string} componentClass - Component class or name
     * @returns {Component|null}
     */
    getComponent<T extends Component>(componentClass: string | (new (...args: never[]) => T)): T | null {
        const name = typeof componentClass === 'string'
            ? componentClass
            : componentClass.name;
        return (this.components.get(name) as T | undefined) || null;
    }

    /**
     * Check if entity has a component
     * @param {Function|string} componentClass
     * @returns {boolean}
     */
    hasComponent(componentClass: string | (new (...args: never[]) => Component)) {
        return this.getComponent(componentClass) !== null;
    }

    /**
     * Remove a component
     * @param {Function|string} componentClass
     */
    removeComponent(componentClass: string | (new (...args: never[]) => Component)) {
        const name = typeof componentClass === 'string'
            ? componentClass
            : componentClass.name;

        const component = this.components.get(name);
        if (component) {
            if (component.onRemove) {
                component.onRemove(this);
            }
            component.entity = null;
            this.components.delete(name);
        }
    }

    /**
     * Add a tag
     * @param {string} tag
     * @returns {Entity}
     */
    addTag(tag: string) {
        this.tags.add(tag);
        return this;
    }

    /**
     * Remove a tag
     * @param {string} tag
     */
    removeTag(tag: string) {
        this.tags.delete(tag);
    }

    /**
     * Check if entity has a tag
     * @param {string} tag
     * @returns {boolean}
     */
    hasTag(tag: string) {
        return this.tags.has(tag);
    }

    /**
     * Add a child entity
     * @param {Entity} child
     * @returns {Entity}
     */
    addChild(child: Entity) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
        return this;
    }

    /**
     * Remove a child entity
     * @param {Entity} child
     */
    removeChild(child: Entity) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    /**
     * Get world position (accounting for parent transforms)
     * @returns {{x: number, y: number}}
     */
    getWorldPosition(): { x: number; y: number } {
        if (this.parent) {
            const parentPos = this.parent.getWorldPosition();
            return {
                x: parentPos.x + this.x,
                y: parentPos.y + this.y
            };
        }
        return { x: this.x, y: this.y };
    }

    /**
     * Update entity and all components
     * @param {number} deltaTime
     */
    update(deltaTime: number) {
        if (!this.active) return;

        // Update all components
        for (const component of this.components.values()) {
            if (component.active && component.update) {
                component.update(deltaTime);
            }
        }

        // Update children
        for (const child of this.children) {
            child.update(deltaTime);
        }
    }

    /**
     * Draw entity
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (!this.active) return;

        // Draw all drawable components
        for (const component of this.components.values()) {
            if (component.active && component.draw) {
                component.draw(ctx, camera);
            }
        }

        // Draw children
        for (const child of this.children) {
            child.draw(ctx, camera);
        }
    }

    /**
     * Mark entity for destruction
     */
    destroy() {
        this.destroyed = true;
        this.active = false;

        // Destroy all components
        for (const component of this.components.values()) {
            if (component.onRemove) {
                component.onRemove(this);
            }
        }
        this.components.clear();

        // Destroy children
        for (const child of this.children) {
            child.destroy();
        }
        this.children = [];

        // Remove from parent
        if (this.parent) {
            this.parent.removeChild(this);
        }
    }

    /**
     * Set position
     * @param {number} x
     * @param {number} y
     * @returns {Entity}
     */
    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * Set velocity
     * @param {number} vx
     * @param {number} vy
     * @returns {Entity}
     */
    setVelocity(vx: number, vy: number) {
        this.vx = vx;
        this.vy = vy;
        return this;
    }

    /**
     * Move by velocity * deltaTime
     * @param {number} deltaTime
     */
    applyVelocity(deltaTime: number) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    /**
     * Get distance to another entity or point
     * @param {Entity|{x: number, y: number}} other
     * @returns {number}
     */
    distanceTo(other: { x: number; y: number }) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get squared distance (faster, good for comparisons)
     * @param {Entity|{x: number, y: number}} other
     * @returns {number}
     */
    distanceToSquared(other: { x: number; y: number }) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return dx * dx + dy * dy;
    }
}

/**
 * Reset entity ID counter (useful for testing)
 */
export function resetEntityIds() {
    entityIdCounter = 0;
}
