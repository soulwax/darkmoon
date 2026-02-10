// File: src/ecs/components/MovementComponent.ts

import { Component } from '../Component';
import { MathUtils, type Direction } from '../../core/Math';

export class MovementComponent extends Component {
    speed: number;
    maxSpeed: number;
    acceleration: number;
    friction: number;
    vx: number;
    vy: number;
    inputX: number;
    inputY: number;
    facingDirection: Direction;
    dashEnabled: boolean;
    dashSpeed: number;
    dashDuration: number;
    dashCooldown: number;
    isDashing: boolean;
    dashTimer: number;
    dashCooldownTimer: number;
    dashDirection: { x: number; y: number };
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;

    constructor(options: {
        speed?: number;
        maxSpeed?: number;
        acceleration?: number;
        friction?: number;
        dashEnabled?: boolean;
        dashSpeed?: number;
        dashDuration?: number;
        dashCooldown?: number;
    } = {}) {
        super();

        // Movement speed
        this.speed = options.speed || 120;
        this.maxSpeed = options.maxSpeed || 500;

        // Acceleration/friction
        this.acceleration = options.acceleration || 0;  // 0 = instant
        this.friction = options.friction || 0.85;

        // Velocity
        this.vx = 0;
        this.vy = 0;

        // Input direction (normalized)
        this.inputX = 0;
        this.inputY = 0;

        // Facing direction
        this.facingDirection = 'down';

        // Dash
        this.dashEnabled = options.dashEnabled !== false;
        this.dashSpeed = options.dashSpeed || 300;
        this.dashDuration = options.dashDuration || 0.2;
        this.dashCooldown = options.dashCooldown || 1.0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.dashDirection = { x: 0, y: 0 };

        // World bounds (optional)
        this.bounds = null;
    }

    /**
     * Set movement input
     * @param {number} x - Input X (-1 to 1)
     * @param {number} y - Input Y (-1 to 1)
     */
    setInput(x: number, y: number) {
        this.inputX = x;
        this.inputY = y;

        // Update facing direction
        if (x !== 0 || y !== 0) {
            this.facingDirection = MathUtils.getDirection(x, y);
        }
    }

    /**
     * Start a dash
     * @returns {boolean} - True if dash started
     */
    dash() {
        if (!this.dashEnabled || this.isDashing || this.dashCooldownTimer > 0) {
            return false;
        }

        // Need movement input to dash
        if (this.inputX === 0 && this.inputY === 0) {
            return false;
        }

        this.isDashing = true;
        this.dashTimer = this.dashDuration;
        this.dashCooldownTimer = this.dashCooldown;

        // Store dash direction (normalized)
        const mag = Math.sqrt(this.inputX * this.inputX + this.inputY * this.inputY);
        this.dashDirection.x = this.inputX / mag;
        this.dashDirection.y = this.inputY / mag;

        return true;
    }

    /**
     * Set world bounds
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    setBounds(minX: number, minY: number, maxX: number, maxY: number) {
        this.bounds = { minX, minY, maxX, maxY };
    }

    update(deltaTime: number) {
        if (!this.entity) return;

        // Update dash
        if (this.isDashing) {
            this.dashTimer -= deltaTime;

            if (this.dashTimer <= 0) {
                this.isDashing = false;
            } else {
                // Apply dash velocity
                this.vx = this.dashDirection.x * this.dashSpeed;
                this.vy = this.dashDirection.y * this.dashSpeed;
            }
        } else {
            // Update dash cooldown
            if (this.dashCooldownTimer > 0) {
                this.dashCooldownTimer -= deltaTime;
            }

            // Normal movement
            if (this.acceleration > 0) {
                // Accelerate towards target velocity
                const targetVx = this.inputX * this.speed;
                const targetVy = this.inputY * this.speed;

                this.vx += (targetVx - this.vx) * this.acceleration * deltaTime;
                this.vy += (targetVy - this.vy) * this.acceleration * deltaTime;
            } else {
                // Instant velocity change
                this.vx = this.inputX * this.speed;
                this.vy = this.inputY * this.speed;
            }

            // Apply friction when no input
            if (this.inputX === 0 && this.inputY === 0) {
                this.vx *= this.friction;
                this.vy *= this.friction;

                // Stop if very slow
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
                if (Math.abs(this.vy) < 0.1) this.vy = 0;
            }
        }

        // Clamp to max speed
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > this.maxSpeed) {
            const scale = this.maxSpeed / currentSpeed;
            this.vx *= scale;
            this.vy *= scale;
        }

        // Apply velocity to entity
        this.entity.x += this.vx * deltaTime;
        this.entity.y += this.vy * deltaTime;

        // Also update entity velocity for other systems
        this.entity.vx = this.vx;
        this.entity.vy = this.vy;

        // Clamp to bounds
        if (this.bounds) {
            this.entity.x = MathUtils.clamp(
                this.entity.x,
                this.bounds.minX,
                this.bounds.maxX
            );
            this.entity.y = MathUtils.clamp(
                this.entity.y,
                this.bounds.minY,
                this.bounds.maxY
            );
        }
    }

    /**
     * Check if entity is moving
     */
    isMoving() {
        return Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1;
    }

    /**
     * Check if dash is available
     */
    canDash() {
        return this.dashEnabled && !this.isDashing && this.dashCooldownTimer <= 0;
    }

    /**
     * Get dash cooldown percentage (0-1)
     */
    getDashCooldownPercent() {
        if (this.dashCooldown <= 0) return 1;
        return 1 - (this.dashCooldownTimer / this.dashCooldown);
    }

    /**
     * Stop all movement
     */
    stop() {
        this.vx = 0;
        this.vy = 0;
        this.inputX = 0;
        this.inputY = 0;
    }
}
