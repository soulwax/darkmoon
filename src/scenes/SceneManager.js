// File: src/scenes/SceneManager.js
// Manages scene transitions and overlays

import { eventBus, GameEvents } from '../core/EventBus.js';

export class SceneManager {
    constructor(game) {
        this.game = game;
        this.scenes = new Map();
        this.currentScene = null;
        this.overlays = [];

        // Transition state
        this.transitioning = false;
        this.transitionDuration = 0.3;
        this.transitionTimer = 0;
        this.transitionAlpha = 0;
        this.pendingScene = null;
        this.pendingData = null;
    }

    /**
     * Register a scene
     * @param {string} name
     * @param {Scene} scene
     */
    register(name, scene) {
        this.scenes.set(name, scene);
    }

    /**
     * Switch to a scene
     * @param {string} name
     * @param {Object} [data] - Data to pass to new scene
     * @param {boolean} [instant=false] - Skip transition
     */
    switchTo(name, data = {}, instant = false) {
        const scene = this.scenes.get(name);
        if (!scene) {
            console.error(`Scene not found: ${name}`);
            return;
        }

        if (instant) {
            this._doSwitch(scene, data);
        } else {
            this.transitioning = true;
            this.transitionTimer = 0;
            this.pendingScene = scene;
            this.pendingData = data;
        }

        eventBus.emit(GameEvents.SCENE_CHANGE, { name, data });
    }

    _doSwitch(scene, data) {
        // Exit current scene
        if (this.currentScene) {
            this.currentScene.onExit();
        }

        // Clear overlays
        for (const overlay of this.overlays) {
            overlay.onExit();
        }
        this.overlays = [];

        // Enter new scene
        this.currentScene = scene;
        this.currentScene.onEnter(data);

        eventBus.emit(GameEvents.SCENE_READY, { scene });
    }

    /**
     * Push an overlay scene (pause menu, etc.)
     * @param {string} name
     * @param {Object} [data]
     */
    pushOverlay(name, data = {}) {
        const scene = this.scenes.get(name);
        if (!scene) {
            console.error(`Overlay scene not found: ${name}`);
            return;
        }

        // Pause current scene
        if (this.currentScene) {
            this.currentScene.onPause();
        }

        // Pause top overlay if exists
        if (this.overlays.length > 0) {
            this.overlays[this.overlays.length - 1].onPause();
        }

        // Add overlay
        this.overlays.push(scene);
        scene.onEnter(data);
    }

    /**
     * Pop the top overlay
     */
    popOverlay() {
        if (this.overlays.length === 0) return;

        const overlay = this.overlays.pop();
        overlay.onExit();

        // Resume previous overlay or main scene
        if (this.overlays.length > 0) {
            this.overlays[this.overlays.length - 1].onResume();
        } else if (this.currentScene) {
            this.currentScene.onResume();
        }
    }

    /**
     * Get current scene
     * @returns {Scene|null}
     */
    getCurrent() {
        return this.currentScene;
    }

    /**
     * Check if an overlay is active
     * @returns {boolean}
     */
    hasOverlay() {
        return this.overlays.length > 0;
    }

    /**
     * Restart current scene
     */
    restart() {
        if (this.currentScene) {
            this.currentScene.onExit();
            this.currentScene.onEnter({});
        }
    }

    /**
     * Update scenes
     * @param {number} deltaTime
     */
    update(deltaTime) {
        // Handle transition
        if (this.transitioning) {
            this.transitionTimer += deltaTime;
            const halfDuration = this.transitionDuration / 2;

            if (this.transitionTimer < halfDuration) {
                // Fade out
                this.transitionAlpha = this.transitionTimer / halfDuration;
            } else {
                // Switch at midpoint
                if (this.pendingScene) {
                    this._doSwitch(this.pendingScene, this.pendingData);
                    this.pendingScene = null;
                    this.pendingData = null;
                }

                // Fade in
                this.transitionAlpha = 1 - (this.transitionTimer - halfDuration) / halfDuration;
            }

            if (this.transitionTimer >= this.transitionDuration) {
                this.transitioning = false;
                this.transitionAlpha = 0;
            }

            return;
        }

        // Update overlays (only top one)
        if (this.overlays.length > 0) {
            this.overlays[this.overlays.length - 1].update(deltaTime);
            return;
        }

        // Update current scene
        if (this.currentScene && !this.currentScene.paused) {
            this.currentScene.update(deltaTime);
        }
    }

    /**
     * Draw scenes
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} alpha
     */
    draw(ctx, alpha) {
        // Draw current scene
        if (this.currentScene) {
            this.currentScene.draw(ctx, alpha);
        }

        // Draw overlays
        for (const overlay of this.overlays) {
            overlay.draw(ctx, alpha);
        }

        // Draw transition fade
        if (this.transitioning && this.transitionAlpha > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.transitionAlpha})`;
            ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        }
    }
}
