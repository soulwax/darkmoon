// File: src/scenes/Scene.js
// Base scene class

export class Scene {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.paused = false;
    }

    /**
     * Called when scene becomes active
     * @param {Object} data - Data passed from previous scene
     */
    onEnter(data) {
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
    update(deltaTime) {
        // Override in subclass
    }

    /**
     * Draw scene
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} alpha - Interpolation alpha
     */
    draw(ctx, alpha) {
        // Override in subclass
    }

    /**
     * Handle input
     * @param {InputManager} inputManager
     */
    handleInput(inputManager) {
        // Override in subclass
    }
}
