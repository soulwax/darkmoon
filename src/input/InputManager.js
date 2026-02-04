// File: src/input/InputManager.js
// Keyboard and mouse input handling

import { Vector2, MathUtils } from '../core/Math.js';

export class InputManager {
    constructor(config = {}) {
        // Key states
        this.keys = new Map();           // Current frame
        this.keysPressed = new Map();    // Just pressed this frame
        this.keysReleased = new Map();   // Just released this frame
        this.previousKeys = new Map();   // Previous frame

        // Mouse state
        this.mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            buttons: new Set(),
            buttonsPressed: new Set(),
            buttonsReleased: new Set()
        };

        // Input bindings
        this.bindings = new Map();
        this._setupDefaultBindings(config.keyboard || {});

        // Event handlers (stored for cleanup)
        this._handlers = {};

        // Canvas reference for mouse position calculation
        this.canvas = null;
        this.camera = null;

        this._setupEventListeners();
    }

    /**
     * Setup default key bindings
     */
    _setupDefaultBindings(keyboardConfig) {
        const defaults = {
            moveUp: 'KeyW',
            moveDown: 'KeyS',
            moveLeft: 'KeyA',
            moveRight: 'KeyD',
            jump: 'Space',
            dash: 'ShiftLeft',
            interact: 'KeyE',
            attack: 'KeyJ',
            special: 'KeyK',
            pause: 'Escape',
            inventory: 'KeyI'
        };

        // Merge with config
        const config = { ...defaults, ...keyboardConfig };

        // Create bindings
        for (const [action, key] of Object.entries(config)) {
            this.bind(action, key);
        }
    }

    /**
     * Bind an action to a key
     * @param {string} action - Action name
     * @param {string|string[]} keys - Key code(s)
     */
    bind(action, keys) {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        this.bindings.set(action, keyArray);
    }

    /**
     * Setup keyboard and mouse event listeners
     */
    _setupEventListeners() {
        // Keyboard events
        this._handlers.keydown = (e) => {
            // Prevent default for game keys (but allow browser shortcuts)
            if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                const code = e.code;
                if (this._isGameKey(code)) {
                    e.preventDefault();
                }
            }
            this.keys.set(e.code, true);
        };

        this._handlers.keyup = (e) => {
            this.keys.set(e.code, false);
        };

        // Mouse events
        this._handlers.mousemove = (e) => {
            this._updateMousePosition(e);
        };

        this._handlers.mousedown = (e) => {
            this.mouse.buttons.add(e.button);
            this._updateMousePosition(e);
        };

        this._handlers.mouseup = (e) => {
            this.mouse.buttons.delete(e.button);
        };

        // Context menu prevention
        this._handlers.contextmenu = (e) => {
            e.preventDefault();
        };

        // Blur handling (release all keys when window loses focus)
        this._handlers.blur = () => {
            this.keys.clear();
            this.mouse.buttons.clear();
        };

        // Attach listeners
        window.addEventListener('keydown', this._handlers.keydown);
        window.addEventListener('keyup', this._handlers.keyup);
        window.addEventListener('mousemove', this._handlers.mousemove);
        window.addEventListener('mousedown', this._handlers.mousedown);
        window.addEventListener('mouseup', this._handlers.mouseup);
        window.addEventListener('contextmenu', this._handlers.contextmenu);
        window.addEventListener('blur', this._handlers.blur);
    }

    /**
     * Check if key is a game key (for preventDefault)
     */
    _isGameKey(code) {
        for (const keys of this.bindings.values()) {
            if (keys.includes(code)) return true;
        }
        return false;
    }

    /**
     * Update mouse position
     */
    _updateMousePosition(e) {
        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;

            // Update world position if camera is set
            if (this.camera) {
                const world = this.camera.screenToWorld(this.mouse.x, this.mouse.y);
                this.mouse.worldX = world.x;
                this.mouse.worldY = world.y;
            }
        }
    }

    /**
     * Set canvas reference for mouse position calculation
     * @param {HTMLCanvasElement} canvas
     */
    setCanvas(canvas) {
        this.canvas = canvas;
    }

    /**
     * Set camera reference for world position calculation
     * @param {Camera} camera
     */
    setCamera(camera) {
        this.camera = camera;
    }

    /**
     * Update input state (call at start of each frame)
     */
    update() {
        // Calculate pressed/released states
        this.keysPressed.clear();
        this.keysReleased.clear();
        this.mouse.buttonsPressed.clear();
        this.mouse.buttonsReleased.clear();

        for (const [key, isDown] of this.keys) {
            const wasDown = this.previousKeys.get(key) || false;

            if (isDown && !wasDown) {
                this.keysPressed.set(key, true);
            } else if (!isDown && wasDown) {
                this.keysReleased.set(key, true);
            }
        }

        // Copy current state to previous
        this.previousKeys = new Map(this.keys);
    }

    /**
     * Check if an action is currently held
     * @param {string} action
     * @returns {boolean}
     */
    isAction(action) {
        const keys = this.bindings.get(action);
        if (!keys) return false;

        return keys.some(key => this.keys.get(key));
    }

    /**
     * Check if an action was just pressed this frame
     * @param {string} action
     * @returns {boolean}
     */
    isActionPressed(action) {
        const keys = this.bindings.get(action);
        if (!keys) return false;

        return keys.some(key => this.keysPressed.get(key));
    }

    /**
     * Check if an action was just released this frame
     * @param {string} action
     * @returns {boolean}
     */
    isActionReleased(action) {
        const keys = this.bindings.get(action);
        if (!keys) return false;

        return keys.some(key => this.keysReleased.get(key));
    }

    /**
     * Get movement vector from input
     * @returns {Vector2}
     */
    getMovementVector() {
        let x = 0;
        let y = 0;

        if (this.isAction('moveUp')) y -= 1;
        if (this.isAction('moveDown')) y += 1;
        if (this.isAction('moveLeft')) x -= 1;
        if (this.isAction('moveRight')) x += 1;

        // Normalize diagonal movement
        const movement = MathUtils.normalizeMovement(x, y);

        return new Vector2(movement.x, movement.y);
    }

    /**
     * Check if any movement key is pressed
     * @returns {boolean}
     */
    isMoving() {
        return this.isAction('moveUp') ||
               this.isAction('moveDown') ||
               this.isAction('moveLeft') ||
               this.isAction('moveRight');
    }

    /**
     * Get mouse position
     * @returns {{x: number, y: number}}
     */
    getMousePosition() {
        return { x: this.mouse.x, y: this.mouse.y };
    }

    /**
     * Get mouse world position
     * @returns {{x: number, y: number}}
     */
    getMouseWorldPosition() {
        return { x: this.mouse.worldX, y: this.mouse.worldY };
    }

    /**
     * Check if mouse button is held
     * @param {number} button - 0=left, 1=middle, 2=right
     * @returns {boolean}
     */
    isMouseButton(button) {
        return this.mouse.buttons.has(button);
    }

    /**
     * Check if mouse button was just pressed
     * @param {number} button
     * @returns {boolean}
     */
    isMouseButtonPressed(button) {
        return this.mouse.buttonsPressed.has(button);
    }

    /**
     * Cleanup event listeners
     */
    destroy() {
        window.removeEventListener('keydown', this._handlers.keydown);
        window.removeEventListener('keyup', this._handlers.keyup);
        window.removeEventListener('mousemove', this._handlers.mousemove);
        window.removeEventListener('mousedown', this._handlers.mousedown);
        window.removeEventListener('mouseup', this._handlers.mouseup);
        window.removeEventListener('contextmenu', this._handlers.contextmenu);
        window.removeEventListener('blur', this._handlers.blur);
    }
}
