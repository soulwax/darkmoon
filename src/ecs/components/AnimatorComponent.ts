// File: src/ecs/components/AnimatorComponent.js
// Component for animated sprite rendering

import { Component } from '../Component';
import { AnimatedSprite } from '../../graphics/AnimatedSprite';
import type { SpriteSheet } from '../../assets/SpriteSheet';
import type { Direction } from '../../core/Math';
import type { Camera } from '../../graphics/Camera';

export class AnimatorComponent extends Component {
    animator: AnimatedSprite;
    spriteSheet: SpriteSheet;
    direction: Direction;
    state: string;
    offsetX: number;
    offsetY: number;

    constructor(spriteSheet: SpriteSheet) {
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
    play(name: string, loop: boolean = true, restart: boolean = false) {
        this.animator.play(name, loop, restart);
    }

    /**
     * Set state and direction to automatically determine animation
     * @param {string} state - 'idle', 'run', 'attack', etc.
     * @param {string} [direction] - 'up', 'down', 'left', 'right'
     */
    setState(state: string, direction?: Direction) {
        if (direction) {
            this.direction = direction;
        }
        this.state = state;

        const resolved = this._resolveAnimation();
        this.animator.flipX = resolved.flipX;

        if (resolved.name && this.animator.hasAnimation(resolved.name)) {
            const loop = state !== 'attack';
            this.play(resolved.name, loop);
        }
    }

    /**
     * Update direction based on velocity
     * @param {number} vx
     * @param {number} vy
     */
    updateDirection(vx: number, vy: number) {
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
    _resolveAnimation() {
        const dir = this.direction;
        let state = this.state;

        if (state === 'run' || state === 'walk') {
            state = 'running';
        }

        const candidates: Array<{ name: string; flipX: boolean }> = [];
        const add = (name: string, flipX: boolean) => {
            if (!name) return;
            if (candidates.some((c) => c.name === name && c.flipX === flipX)) return;
            candidates.push({ name, flipX });
        };

        // Player sheet uses "attack_left" style for attacks, so try that first.
        if (state === 'attack') {
            add(`attack_${dir}`, false);
        }

        // Default convention: "left_running", "down_idle", etc.
        add(`${dir}_${state}`, false);

        // Mirror fallbacks: if only one horizontal direction exists, flip it.
        if (dir === 'right') {
            add(`left_${state}`, true);
            if (state === 'attack') add(`attack_left`, true);
        } else if (dir === 'left') {
            add(`right_${state}`, true);
            if (state === 'attack') add(`attack_right`, true);
        }

        // Directionless/fallback options.
        add(`down_${state}`, false);
        if (state === 'attack') add('attack_down', false);

        for (const candidate of candidates) {
            if (this.animator.hasAnimation(candidate.name)) {
                return candidate;
            }
        }

        return { name: candidates[0]?.name || '', flipX: false };
    }

    /**
     * Handle animation end
     */
    _onAnimationEnd(animationName: string) {
        // Return to idle after non-looping animations
        if (this.state === 'attack') {
            this.setState('idle');
        }
    }

    update(deltaTime: number) {
        this.animator.update(deltaTime);
    }

    draw(ctx: CanvasRenderingContext2D, camera: Camera) {
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
    setSpeed(speed: number) {
        this.animator.speed = speed;
    }

    /**
     * Set flip X
     */
    setFlipX(flip: boolean) {
        this.animator.flipX = flip;
    }

    /**
     * Set flip Y
     */
    setFlipY(flip: boolean) {
        this.animator.flipY = flip;
    }

    /**
     * Set alpha
     */
    setAlpha(alpha: number) {
        this.animator.alpha = alpha;
    }

    /**
     * Set scale
     */
    setScale(scale: number) {
        this.animator.scale = scale;
    }
}

