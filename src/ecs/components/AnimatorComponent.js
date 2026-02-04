// File: src/ecs/components/AnimatorComponent.js
// Component for animated sprite rendering

import { Component } from '../Component.js';
import { AnimatedSprite } from '../../graphics/AnimatedSprite.js';

export class AnimatorComponent extends Component {
    constructor(spriteSheet) {
        super();

        this.animator = new AnimatedSprite(spriteSheet);
        this.spriteSheet = spriteSheet;

        // Direction tracking
        this.direction = 'down';
        this.state = 'idle';

        // Offset from entity position
        this.offsetX = 0;
        this.offsetY = 0;

        // Callbacks
        this.animator.onAnimationEnd = (name) => this._onAnimationEnd(name);
    }

    /**
     * Play an animation
     * @param {string} name - Animation name
     * @param {boolean} [loop=true]
     * @param {boolean} [restart=false]
     */
    play(name, loop = true, restart = false) {
        this.animator.play(name, loop, restart);
    }

    /**
     * Set state and direction to automatically determine animation
     * @param {string} state - 'idle', 'run', 'attack', etc.
     * @param {string} [direction] - 'up', 'down', 'left', 'right'
     */
    setState(state, direction) {
        if (direction) {
            this.direction = direction;
        }
        this.state = state;

        // Build animation name: e.g., "down_idle", "left_running"
        const animName = this._getAnimationName();

        if (this.animator.hasAnimation(animName)) {
            const loop = state !== 'attack';
            this.play(animName, loop);
        }
    }

    /**
     * Update direction based on velocity
     * @param {number} vx
     * @param {number} vy
     */
    updateDirection(vx, vy) {
        if (vx === 0 && vy === 0) return;

        // Determine primary direction
        if (Math.abs(vx) > Math.abs(vy)) {
            this.direction = vx > 0 ? 'right' : 'left';
        } else {
            this.direction = vy > 0 ? 'down' : 'up';
        }
    }

    /**
     * Get animation name from state and direction
     */
    _getAnimationName() {
        // Handle right direction (flip left animations)
        let dir = this.direction;
        let state = this.state;

        // Map states to animation names
        if (state === 'run' || state === 'walk') {
            state = 'running';
        }

        // Try direction_state format (e.g., "down_idle", "left_running")
        return `${dir}_${state}`;
    }

    /**
     * Handle animation end
     */
    _onAnimationEnd(animationName) {
        // Return to idle after non-looping animations
        if (this.state === 'attack') {
            this.setState('idle');
        }
    }

    update(deltaTime) {
        this.animator.update(deltaTime);

        // Handle flip for right direction (if using left sprites)
        if (this.direction === 'right') {
            // Check if we have right_* animations, if not flip left_*
            const rightAnim = `right_${this.state === 'run' ? 'running' : this.state}`;
            if (!this.animator.hasAnimation(rightAnim)) {
                this.animator.flipX = true;
            } else {
                this.animator.flipX = false;
            }
        } else {
            this.animator.flipX = false;
        }
    }

    draw(ctx, camera) {
        if (!this.entity) return;

        const x = this.entity.x + this.offsetX;
        const y = this.entity.y + this.offsetY;

        this.animator.draw(ctx, x, y);
    }

    /**
     * Get current frame size
     */
    getFrameSize() {
        return this.animator.getFrameSize();
    }

    /**
     * Set animation speed
     */
    setSpeed(speed) {
        this.animator.speed = speed;
    }

    /**
     * Set flip X
     */
    setFlipX(flip) {
        this.animator.flipX = flip;
    }

    /**
     * Set alpha
     */
    setAlpha(alpha) {
        this.animator.alpha = alpha;
    }

    /**
     * Set scale
     */
    setScale(scale) {
        this.animator.scale = scale;
    }
}
