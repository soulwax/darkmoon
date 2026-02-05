// File: src/graphics/AnimatedSprite.js
// Animation controller for sprite-based animations

import type { SpriteSheet, AnimationData, AnimationFrame } from '../assets/SpriteSheet';

export class AnimatedSprite {
    spriteSheet: SpriteSheet;
    currentAnimation: string | null;
    currentFrame: number;
    animationTime: number;
    playing: boolean;
    loop: boolean;
    speed: number;
    frameRate: number;
    flipX: boolean;
    flipY: boolean;
    alpha: number;
    scale: number;
    rotation: number;
    tint: string | null;
    onAnimationEnd: ((name: string) => void) | null;
    onFrameChange: ((frame: number, name: string) => void) | null;

    constructor(spriteSheet: SpriteSheet) {
        this.spriteSheet = spriteSheet;

        // Current animation state
        this.currentAnimation = null;
        this.currentFrame = 0;
        this.animationTime = 0;
        this.playing = false;
        this.loop = true;

        // Playback settings
        this.speed = 1.0;           // Animation speed multiplier
        this.frameRate = 10;        // Frames per second

        // Drawing options
        this.flipX = false;
        this.flipY = false;
        this.alpha = 1.0;
        this.scale = 1.0;
        this.rotation = 0;
        this.tint = null;           // Color tint (not implemented yet)

        // Callbacks
        this.onAnimationEnd = null;
        this.onFrameChange = null;
    }

    /**
     * Play an animation
     * @param {string} name - Animation name
     * @param {boolean} [loop=true] - Whether to loop
     * @param {boolean} [restart=false] - Force restart if same animation
     */
    play(name: string, loop: boolean = true, restart: boolean = false) {
        // Don't restart same animation unless forced
        if (this.currentAnimation === name && !restart && this.playing) {
            return;
        }

        const animation = this.spriteSheet.getAnimation(name);
        if (!animation) {
            console.warn(`Animation not found: ${name}`);
            return;
        }

        this.currentAnimation = name;
        this.loop = loop;
        this.playing = true;
        this.currentFrame = 0;
        this.animationTime = 0;

        // Use animation's frame rate or default
        this.frameRate = animation.frameRate || 10;
    }

    /**
     * Stop the current animation
     */
    stop() {
        this.playing = false;
    }

    /**
     * Pause the current animation
     */
    pause() {
        this.playing = false;
    }

    /**
     * Resume the current animation
     */
    resume() {
        this.playing = true;
    }

    /**
     * Set animation to a specific frame
     * @param {number} frame
     */
    setFrame(frame: number) {
        this.currentFrame = frame;
        this.animationTime = frame / this.frameRate;
    }

    /**
     * Update animation state
     * @param {number} deltaTime
     */
    update(deltaTime: number) {
        if (!this.playing || !this.currentAnimation) return;

        const animation = this.spriteSheet.getAnimation(this.currentAnimation);
        if (!animation) return;

        // Update animation time
        this.animationTime += deltaTime * this.speed;

        // Calculate frame duration
        const frameDuration = 1 / this.frameRate;
        const totalDuration = frameDuration * animation.frameCount;

        // Calculate current frame
        const prevFrame = this.currentFrame;

        if (this.loop) {
            this.currentFrame = Math.floor(
                (this.animationTime / frameDuration) % animation.frameCount
            );
        } else {
            this.currentFrame = Math.min(
                Math.floor(this.animationTime / frameDuration),
                animation.frameCount - 1
            );

            // Check for animation end
            if (this.animationTime >= totalDuration) {
                this.playing = false;
                if (this.onAnimationEnd) {
                    this.onAnimationEnd(this.currentAnimation);
                }
            }
        }

        // Frame change callback
        if (prevFrame !== this.currentFrame && this.onFrameChange) {
            this.onFrameChange(this.currentFrame, this.currentAnimation);
        }
    }

    /**
     * Draw the current animation frame
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     */
    draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
        if (!this.currentAnimation) return;

        this.spriteSheet.drawFrame(ctx, this.currentAnimation, this.currentFrame, x, y, {
            flipX: this.flipX,
            flipY: this.flipY,
            alpha: this.alpha,
            scale: this.scale,
            rotation: this.rotation
        });
    }

    /**
     * Get the current animation's frame data
     * @returns {Object|null}
     */
    getCurrentFrameData(): AnimationFrame | null {
        if (!this.currentAnimation) return null;

        const animation = this.spriteSheet.getAnimation(this.currentAnimation) as AnimationData | null;
        if (!animation) return null;

        return animation.frames[this.currentFrame];
    }

    /**
     * Check if animation is currently playing
     * @returns {boolean}
     */
    isPlaying() {
        return this.playing;
    }

    /**
     * Check if current animation has finished (non-looping only)
     * @returns {boolean}
     */
    isFinished() {
        if (!this.currentAnimation || this.loop) return false;

        const animation = this.spriteSheet.getAnimation(this.currentAnimation);
        if (!animation) return true;

        return this.currentFrame >= animation.frameCount - 1;
    }

    /**
     * Get current animation name
     * @returns {string|null}
     */
    getAnimationName() {
        return this.currentAnimation;
    }

    /**
     * Check if sprite sheet has a specific animation
     * @param {string} name
     * @returns {boolean}
     */
    hasAnimation(name: string) {
        return this.spriteSheet.hasAnimation(name);
    }

    /**
     * Get frame dimensions
     * @returns {{width: number, height: number}}
     */
    getFrameSize() {
        const frameData = this.getCurrentFrameData();
        if (frameData) {
            return {
                width: frameData.width * this.scale,
                height: frameData.height * this.scale
            };
        }
        return {
            width: this.spriteSheet.tileSize * this.scale,
            height: this.spriteSheet.tileSize * this.scale
        };
    }
}
