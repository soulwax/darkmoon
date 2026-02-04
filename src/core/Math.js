// File: src/core/Math.js
// Vector2 and math utilities

export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    scale(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    multiply(v) {
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

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceToSquared(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }

    lerp(v, t) {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.y * sin;
        const y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    equals(v) {
        return this.x === v.x && this.y === v.y;
    }

    isZero() {
        return this.x === 0 && this.y === 0;
    }

    static add(a, b) {
        return new Vector2(a.x + b.x, a.y + b.y);
    }

    static sub(a, b) {
        return new Vector2(a.x - b.x, a.y - b.y);
    }

    static scale(v, scalar) {
        return new Vector2(v.x * scalar, v.y * scalar);
    }

    static lerp(a, b, t) {
        return new Vector2(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t
        );
    }

    static fromAngle(angle, length = 1) {
        return new Vector2(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }

    static random(minX = -1, maxX = 1, minY = -1, maxY = 1) {
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
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    // Linear interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    // Random float between min and max
    random(min = 0, max = 1) {
        return min + Math.random() * (max - min);
    },

    // Random integer between min and max (inclusive)
    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },

    // Convert degrees to radians
    degToRad(degrees) {
        return degrees * (Math.PI / 180);
    },

    // Convert radians to degrees
    radToDeg(radians) {
        return radians * (180 / Math.PI);
    },

    // Check if two circles intersect
    circlesIntersect(x1, y1, r1, x2, y2, r2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distSq = dx * dx + dy * dy;
        const radiusSum = r1 + r2;
        return distSq < radiusSum * radiusSum;
    },

    // Check if point is inside circle
    pointInCircle(px, py, cx, cy, radius) {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy < radius * radius;
    },

    // Check if two rectangles intersect (AABB)
    rectsIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    },

    // Get direction name from velocity
    getDirection(vx, vy) {
        if (Math.abs(vx) > Math.abs(vy)) {
            return vx > 0 ? 'right' : 'left';
        } else if (vy !== 0) {
            return vy > 0 ? 'down' : 'up';
        }
        return 'down'; // Default facing direction
    },

    // Normalize diagonal movement
    normalizeMovement(x, y) {
        if (x !== 0 && y !== 0) {
            const factor = 1 / Math.SQRT2; // ~0.707
            return { x: x * factor, y: y * factor };
        }
        return { x, y };
    }
};
