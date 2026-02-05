// File: src/systems/ParticleSystem.js
// Particle effects system

import { MathUtils } from '../core/Math.js';

class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;

        this.vx = options.vx || 0;
        this.vy = options.vy || 0;

        this.size = options.size || 4;
        this.sizeDecay = options.sizeDecay || 0;
        this.width = options.width || 0;
        this.height = options.height || 0;

        this.color = options.color || '#fff';
        this.alpha = options.alpha || 1;
        this.alphaDecay = options.alphaDecay || 0;

        this.lifetime = options.lifetime || 1;
        this.age = 0;

        this.gravity = options.gravity || 0;
        this.friction = options.friction || 1;

        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;

        this.dead = false;
    }

    update(deltaTime) {
        this.age += deltaTime;

        if (this.age >= this.lifetime) {
            this.dead = true;
            return;
        }

        // Apply velocity
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // Apply gravity
        this.vy += this.gravity * deltaTime;

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Apply decay
        this.alpha -= this.alphaDecay * deltaTime;
        this.size -= this.sizeDecay * deltaTime;
        if (this.width > 0) this.width -= this.sizeDecay * deltaTime;
        if (this.height > 0) this.height -= this.sizeDecay * deltaTime;

        // Apply rotation
        this.rotation += this.rotationSpeed * deltaTime;

        const width = this.width > 0 ? this.width : this.size;
        const height = this.height > 0 ? this.height : this.size;

        if (width <= 0 || height <= 0 || this.alpha <= 0) {
            this.dead = true;
        }
    }

    draw(ctx) {
        const width = this.width > 0 ? this.width : this.size;
        const height = this.height > 0 ? this.height : this.size;
        if (this.dead || this.alpha <= 0 || width <= 0 || height <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;

        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillRect(-width / 2, -height / 2, width, height);

        ctx.restore();
    }
}

class DamageNumber {
    constructor(x, y, damage, color = '#fff') {
        this.x = x;
        this.y = y;
        this.damage = Math.floor(damage);
        this.color = color;

        this.vy = -60;
        this.alpha = 1;
        this.lifetime = 1;
        this.age = 0;

        this.dead = false;
    }

    update(deltaTime) {
        this.age += deltaTime;

        if (this.age >= this.lifetime) {
            this.dead = true;
            return;
        }

        this.y += this.vy * deltaTime;
        this.vy *= 0.95;
        this.alpha = 1 - (this.age / this.lifetime);
    }

    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';

        ctx.strokeText(this.damage.toString(), this.x, this.y);
        ctx.fillText(this.damage.toString(), this.x, this.y);

        ctx.restore();
    }
}

export class ParticleSystem {
    constructor(config = {}) {
        this.particles = [];
        this.damageNumbers = [];

        this.maxParticles = config.maxParticles || 1000;
        this.enabled = config.enabled !== false;
    }

    /**
     * Create an explosion effect
     * @param {number} x
     * @param {number} y
     * @param {string} color
     * @param {number} count
     */
    createExplosion(x, y, color = '#f44', count = 20) {
        if (!this.enabled) return;

        for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const speed = MathUtils.random(50, 150);

            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: MathUtils.random(3, 8),
                color: color,
                alpha: 1,
                alphaDecay: 1.5,
                lifetime: MathUtils.random(0.3, 0.8),
                gravity: 200,
                friction: 0.98
            }));
        }
    }

    /**
     * Create XP collection particles
     * @param {number} x
     * @param {number} y
     */
    createXPParticles(x, y) {
        if (!this.enabled) return;

        for (let i = 0; i < 8 && this.particles.length < this.maxParticles; i++) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const speed = MathUtils.random(30, 80);

            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                size: MathUtils.random(2, 5),
                color: '#4f4',
                alpha: 1,
                alphaDecay: 2,
                lifetime: 0.5,
                gravity: -50,
                friction: 0.95
            }));
        }
    }

    /**
     * Create hit effect
     * @param {number} x
     * @param {number} y
     * @param {string} color
     */
    createHitEffect(x, y, color = '#fff') {
        if (!this.enabled) return;

        for (let i = 0; i < 5 && this.particles.length < this.maxParticles; i++) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const speed = MathUtils.random(30, 80);

            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: MathUtils.random(2, 5),
                color: color,
                alpha: 1,
                alphaDecay: 3,
                lifetime: 0.3,
                friction: 0.9
            }));
        }
    }

    /**
     * Create lightning effect
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     */
    createLightningEffect(x, y, radius) {
        if (!this.enabled) return;

        // Central flash
        this.particles.push(new Particle(x, y, {
            size: radius * 2,
            color: '#ff0',
            alpha: 0.5,
            alphaDecay: 5,
            lifetime: 0.2
        }));

        // Sparks
        for (let i = 0; i < 10 && this.particles.length < this.maxParticles; i++) {
            const angle = MathUtils.random(0, Math.PI * 2);
            const dist = MathUtils.random(0, radius);

            this.particles.push(new Particle(
                x + Math.cos(angle) * dist,
                y + Math.sin(angle) * dist,
                {
                    vx: MathUtils.random(-50, 50),
                    vy: MathUtils.random(-100, -50),
                    size: MathUtils.random(2, 4),
                    color: '#ff0',
                    alpha: 1,
                    alphaDecay: 3,
                    lifetime: 0.4,
                    gravity: 200
                }
            ));
        }
    }

    /**
     * Create a vertical sword slash particle effect
     * @param {number} x
     * @param {number} y
     * @param {Object} options
     */
    createSwordSlashVertical(x, y, options = {}) {
        if (!this.enabled) return;

        const length = options.length || 110;
        const width = options.width || 8;
        const direction = options.direction === 'up' ? 'up' : 'down';
        const color = options.color || '#f3f7ff';
        const glow = options.glow || '#ffffff';
        const speedY = direction === 'up' ? -10 : 10;
        const tipOffset = direction === 'up' ? -length / 2 : length / 2;

        // Sharp blade streak (outer glow)
        this.particles.push(new Particle(x, y, {
            vx: 0,
            vy: speedY,
            width: width * 1.9,
            height: length * 0.95,
            color: glow,
            alpha: 0.25,
            alphaDecay: 6,
            lifetime: 0.12
        }));

        // Blade core
        this.particles.push(new Particle(x, y, {
            vx: 0,
            vy: speedY,
            width: width,
            height: length,
            color: color,
            alpha: 0.95,
            alphaDecay: 7,
            lifetime: 0.11
        }));

        // Edge highlight
        this.particles.push(new Particle(x + width * 0.15, y, {
            vx: 0,
            vy: speedY,
            width: width * 0.35,
            height: length * 0.9,
            color: '#ffffff',
            alpha: 0.9,
            alphaDecay: 9,
            lifetime: 0.09
        }));

        // Subtle motion blur (offset duplicate)
        this.particles.push(new Particle(x + width * 0.4, y + speedY * 2, {
            vx: 0,
            vy: speedY * 1.2,
            width: width * 0.7,
            height: length * 0.85,
            color: glow,
            alpha: 0.22,
            alphaDecay: 7,
            lifetime: 0.1
        }));

        // Tip spark (precise point)
        const tipX = x;
        const tipY = y + tipOffset;
        for (let i = 0; i < 4 && this.particles.length < this.maxParticles; i++) {
            const angle = (direction === 'up' ? -Math.PI / 2 : Math.PI / 2) + MathUtils.random(-0.35, 0.35);
            const speed = MathUtils.random(120, 180);
            this.particles.push(new Particle(tipX, tipY, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                width: MathUtils.random(2, 3),
                height: MathUtils.random(6, 10),
                color: '#ffffff',
                alpha: 0.85,
                alphaDecay: 8,
                lifetime: 0.08,
                friction: 0.85,
                rotation: angle
            }));
        }
    }

    /**
     * Create damage number
     * @param {number} x
     * @param {number} y
     * @param {number} damage
     * @param {string} color
     */
    createDamageNumber(x, y, damage, color = '#fff') {
        if (!this.enabled) return;

        this.damageNumbers.push(new DamageNumber(
            x + MathUtils.random(-10, 10),
            y - 10,
            damage,
            color
        ));
    }

    /**
     * Update all particles
     * @param {number} deltaTime
     */
    update(deltaTime) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(deltaTime);

            if (this.particles[i].dead) {
                this.particles.splice(i, 1);
            }
        }

        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            this.damageNumbers[i].update(deltaTime);

            if (this.damageNumbers[i].dead) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    /**
     * Draw all particles
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        for (const particle of this.particles) {
            particle.draw(ctx);
        }

        for (const number of this.damageNumbers) {
            number.draw(ctx);
        }
    }

    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
        this.damageNumbers = [];
    }

    /**
     * Get particle count
     */
    getCount() {
        return this.particles.length + this.damageNumbers.length;
    }
}
