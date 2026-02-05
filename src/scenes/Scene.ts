// File: src/scenes/Scene.js
// Base scene class

import type { Game } from '../Game';
import type { InputManager } from '../input/InputManager';

export class Scene {
    game: Game;
    active: boolean;
    paused: boolean;

    constructor(game: Game) {
        this.game = game;
        this.active = false;
        this.paused = false;
    }

    /**
     * Called when scene becomes active
     * @param {Object} data - Data passed from previous scene
     */
    onEnter(data: Record<string, unknown> = {}) {
        this.active = true;
    }

    /**
     * Called when scene is deactivated
     */
    onExit() {
        this.active = false;
    }

    /**
     * Called when scene is paused (overlay pushed)
     */
    onPause() {
        this.paused = true;
    }

    /**
     * Called when scene is resumed (overlay popped)
     */
    onResume() {
        this.paused = false;
    }

    /**
     * Update scene
     * @param {number} deltaTime
     */
    update(deltaTime: number) {
        // Override in subclass
    }

    /**
     * Draw scene
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} alpha - Interpolation alpha
     */
    draw(ctx: CanvasRenderingContext2D, alpha: number) {
        // Override in subclass
    }

    /**
     * Handle input
     * @param {InputManager} inputManager
     */
    handleInput(inputManager: InputManager) {
        // Override in subclass
    }
}
