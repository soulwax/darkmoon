// File: src/core/GameLoop.js
// RAF-based game loop with fixed timestep

export class GameLoop {
    constructor(options = {}) {
        this.targetFPS = options.targetFPS || 60;
        this.fixedDeltaTime = 1 / this.targetFPS;
        this.maxDeltaTime = options.maxDeltaTime || 0.1; // Cap to prevent spiral of death

        this.updateCallback = options.update || (() => {});
        this.drawCallback = options.draw || (() => {});

        this.running = false;
        this.paused = false;
        this.rafId = null;

        this.lastTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.fpsTime = 0;
        this.currentFPS = 0;

        this.gameTime = 0; // Total game time (paused time not counted)

        this._boundLoop = this._loop.bind(this);
    }

    /**
     * Start the game loop
     */
    start() {
        if (this.running) return;

        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.fpsTime = this.lastTime;
        this.frameCount = 0;

        this.rafId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Stop the game loop completely
     */
    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /**
     * Pause the game (loop continues but update not called)
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume from pause
     */
    resume() {
        if (this.paused) {
            this.paused = false;
            this.lastTime = performance.now(); // Reset to avoid time jump
        }
    }

    /**
     * Check if loop is running
     */
    isRunning() {
        return this.running;
    }

    /**
     * Check if loop is paused
     */
    isPaused() {
        return this.paused;
    }

    /**
     * Get current FPS
     */
    getFPS() {
        return this.currentFPS;
    }

    /**
     * Get total game time
     */
    getGameTime() {
        return this.gameTime;
    }

    /**
     * Reset game time
     */
    resetGameTime() {
        this.gameTime = 0;
    }

    /**
     * Set update callback
     */
    setUpdate(callback) {
        this.updateCallback = callback;
    }

    /**
     * Set draw callback
     */
    setDraw(callback) {
        this.drawCallback = callback;
    }

    /**
     * Main loop
     */
    _loop(currentTime) {
        if (!this.running) return;

        // Calculate delta time in seconds
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap delta time to prevent spiral of death
        if (deltaTime > this.maxDeltaTime) {
            deltaTime = this.maxDeltaTime;
        }

        // FPS calculation
        this.frameCount++;
        if (currentTime - this.fpsTime >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.fpsTime = currentTime;
        }

        // Fixed timestep update
        if (!this.paused) {
            this.accumulator += deltaTime;

            // Run fixed updates
            while (this.accumulator >= this.fixedDeltaTime) {
                this.updateCallback(this.fixedDeltaTime);
                this.gameTime += this.fixedDeltaTime;
                this.accumulator -= this.fixedDeltaTime;
            }
        }

        // Render (always, even when paused)
        // Pass interpolation alpha for smooth rendering
        const alpha = this.accumulator / this.fixedDeltaTime;
        this.drawCallback(alpha);

        // Schedule next frame
        this.rafId = requestAnimationFrame(this._boundLoop);
    }
}
