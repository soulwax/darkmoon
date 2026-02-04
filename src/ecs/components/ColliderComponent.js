// File: src/ecs/components/ColliderComponent.js
// Component for collision detection

import { Component } from '../Component.js';
import { MathUtils } from '../../core/Math.js';

export class ColliderComponent extends Component {
    constructor(options = {}) {
        super();

        // Collider shape
        this.type = options.type || 'circle'; // 'circle' or 'box'

        // Dimensions
        this.width = options.width || 32;
        this.height = options.height || 32;
        this.radius = options.radius || 16;

        // Offset from entity position
        this.offsetX = options.offsetX || 0;
        this.offsetY = options.offsetY || 0;

        // Collision layer (bitmask)
        this.layer = options.layer || 1;
        this.mask = options.mask || 0xFFFF; // Collides with everything by default

        // Flags
        this.isTrigger = options.isTrigger || false; // Triggers don't block movement
        this.isStatic = options.isStatic || false;   // Static colliders don't move

        // Callback for collision events
        this.onCollision = null;
        this.onTriggerEnter = null;
        this.onTriggerExit = null;

        // Currently overlapping triggers
        this.overlapping = new Set();
    }

    /**
     * Get collider center position
     */
    getCenter() {
        return {
            x: this.entity.x + this.offsetX,
            y: this.entity.y + this.offsetY
        };
    }

    /**
     * Get axis-aligned bounding box
     */
    getBounds() {
        const center = this.getCenter();

        if (this.type === 'circle') {
            return {
                x: center.x - this.radius,
                y: center.y - this.radius,
                width: this.radius * 2,
                height: this.radius * 2
            };
        }

        return {
            x: center.x - this.width / 2,
            y: center.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Check if this collider intersects another
     * @param {ColliderComponent} other
     * @returns {boolean}
     */
    intersects(other) {
        // Check layer masks
        if ((this.layer & other.mask) === 0 || (other.layer & this.mask) === 0) {
            return false;
        }

        const a = this.getCenter();
        const b = other.getCenter();

        // Circle vs Circle
        if (this.type === 'circle' && other.type === 'circle') {
            return MathUtils.circlesIntersect(
                a.x, a.y, this.radius,
                b.x, b.y, other.radius
            );
        }

        // Box vs Box
        if (this.type === 'box' && other.type === 'box') {
            const boundsA = this.getBounds();
            const boundsB = other.getBounds();
            return MathUtils.rectsIntersect(
                boundsA.x, boundsA.y, boundsA.width, boundsA.height,
                boundsB.x, boundsB.y, boundsB.width, boundsB.height
            );
        }

        // Circle vs Box (or Box vs Circle)
        return this._circleBoxIntersect(this, other);
    }

    /**
     * Check circle-box intersection
     */
    _circleBoxIntersect(colliderA, colliderB) {
        const circle = colliderA.type === 'circle' ? colliderA : colliderB;
        const box = colliderA.type === 'box' ? colliderA : colliderB;

        const circleCenter = circle.getCenter();
        const boxBounds = box.getBounds();

        // Find closest point on box to circle center
        const closestX = MathUtils.clamp(circleCenter.x, boxBounds.x, boxBounds.x + boxBounds.width);
        const closestY = MathUtils.clamp(circleCenter.y, boxBounds.y, boxBounds.y + boxBounds.height);

        // Check if closest point is within circle
        const dx = circleCenter.x - closestX;
        const dy = circleCenter.y - closestY;
        return (dx * dx + dy * dy) < (circle.radius * circle.radius);
    }

    /**
     * Get overlap vector (for collision resolution)
     * @param {ColliderComponent} other
     * @returns {{x: number, y: number}|null}
     */
    getOverlap(other) {
        if (!this.intersects(other)) return null;

        const a = this.getCenter();
        const b = other.getCenter();

        // Circle vs Circle
        if (this.type === 'circle' && other.type === 'circle') {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const overlap = this.radius + other.radius - dist;

            if (dist === 0) {
                return { x: overlap, y: 0 };
            }

            return {
                x: (dx / dist) * overlap,
                y: (dy / dist) * overlap
            };
        }

        // Box vs Box (axis-aligned)
        if (this.type === 'box' && other.type === 'box') {
            const boundsA = this.getBounds();
            const boundsB = other.getBounds();

            const overlapX = Math.min(
                boundsA.x + boundsA.width - boundsB.x,
                boundsB.x + boundsB.width - boundsA.x
            );

            const overlapY = Math.min(
                boundsA.y + boundsA.height - boundsB.y,
                boundsB.y + boundsB.height - boundsA.y
            );

            // Return smallest overlap axis
            if (overlapX < overlapY) {
                const sign = a.x < b.x ? -1 : 1;
                return { x: overlapX * sign, y: 0 };
            } else {
                const sign = a.y < b.y ? -1 : 1;
                return { x: 0, y: overlapY * sign };
            }
        }

        // Mixed types - use simple push
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        return {
            x: dx / dist * 5,
            y: dy / dist * 5
        };
    }

    /**
     * Draw debug visualization
     */
    draw(ctx, camera) {
        if (!this.entity) return;

        ctx.save();
        ctx.strokeStyle = this.isTrigger ? 'rgba(255, 255, 0, 0.5)' : 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 2;

        const center = this.getCenter();

        if (this.type === 'circle') {
            ctx.beginPath();
            ctx.arc(center.x, center.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const bounds = this.getBounds();
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        ctx.restore();
    }
}
