// File: src/core/Math.js
// Vector2 and math utilities

export type Direction = 'up' | 'down' | 'left' | 'right';

export class Vector2 {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    set(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
    }

    copy(v: Vector2) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v: Vector2) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v: Vector2) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    scale(scalar: number) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    multiply(v: Vector2) {
        this.x *= v.x;
        this.y *= v.y;
        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    dot(v: Vector2) {
        return this.x * v.x + this.y * v.y;
    }

    distanceTo(v: Vector2) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceToSquared(v: Vector2) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }

    lerp(v: Vector2, t: number) {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    rotate(angle: number) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.y * sin;
        const y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    equals(v: Vector2) {
        return this.x === v.x && this.y === v.y;
    }

    isZero() {
        return this.x === 0 && this.y === 0;
    }

    static add(a: Vector2, b: Vector2) {
        return new Vector2(a.x + b.x, a.y + b.y);
    }

    static sub(a: Vector2, b: Vector2) {
        return new Vector2(a.x - b.x, a.y - b.y);
    }

    static scale(v: Vector2, scalar: number) {
        return new Vector2(v.x * scalar, v.y * scalar);
    }

    static lerp(a: Vector2, b: Vector2, t: number) {
        return new Vector2(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t
        );
    }

    static fromAngle(angle: number, length: number = 1) {
        return new Vector2(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }

    static random(minX: number = -1, maxX: number = 1, minY: number = -1, maxY: number = 1) {
        return new Vector2(
            MathUtils.random(minX, maxX),
            MathUtils.random(minY, maxY)
        );
    }

    static ZERO = new Vector2(0, 0);
    static ONE = new Vector2(1, 1);
    static UP = new Vector2(0, -1);
    static DOWN = new Vector2(0, 1);
    static LEFT = new Vector2(-1, 0);
    static RIGHT = new Vector2(1, 0);
}

export const MathUtils = {
    // Clamp value between min and max
    clamp(value: number, min: number, max: number) {
        return Math.max(min, Math.min(max, value));
    },

    // Linear interpolation
    lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    },

    // Random float between min and max
    random(min: number = 0, max: number = 1) {
        return min + Math.random() * (max - min);
    },

    // Random integer between min and max (inclusive)
    randomInt(min: number, max: number) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },

    // Convert degrees to radians
    degToRad(degrees: number) {
        return degrees * (Math.PI / 180);
    },

    // Convert radians to degrees
    radToDeg(radians: number) {
        return radians * (180 / Math.PI);
    },

    // Check if two circles intersect
    circlesIntersect(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distSq = dx * dx + dy * dy;
        const radiusSum = r1 + r2;
        return distSq < radiusSum * radiusSum;
    },

    // Check if point is inside circle
    pointInCircle(px: number, py: number, cx: number, cy: number, radius: number) {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy < radius * radius;
    },

    // Check if two rectangles intersect (AABB)
    rectsIntersect(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) {
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    },

    // Get direction name from velocity
    getDirection(vx: number, vy: number): Direction {
        if (Math.abs(vx) > Math.abs(vy)) {
            return vx > 0 ? 'right' : 'left';
        } else if (vy !== 0) {
            return vy > 0 ? 'down' : 'up';
        }
        return 'down'; // Default facing direction
    },

    // Normalize diagonal movement
    normalizeMovement(x: number, y: number) {
        if (x !== 0 && y !== 0) {
            const factor = 1 / Math.SQRT2; // ~0.707
            return { x: x * factor, y: y * factor };
        }
        return { x, y };
    },

    // Normalize angle to [-PI, PI]
    normalizeAngle(angle: number) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    },

    // Easing functions
    easeOutQuad(t: number) {
        return t * (2 - t);
    },

    easeInQuad(t: number) {
        return t * t;
    },

    easeInOutQuad(t: number) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    easeOutElastic(t: number) {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    },

    // Smooth step
    smoothStep(edge0: number, edge1: number, x: number) {
        const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }
};
