// File: src/core/EventBus.js
// Pub/sub event system for decoupling game systems

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(event, callback);
    }

    /**
     * Alias for subscribe
     */
    on(event, callback) {
        return this.subscribe(event, callback);
    }

    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.unsubscribe(event, wrapper);
            callback(data);
        };
        return this.subscribe(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    unsubscribe(event, callback) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(callback);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Alias for unsubscribe
     */
    off(event, callback) {
        this.unsubscribe(event, callback);
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} data - Data to pass to handlers
     */
    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for '${event}':`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event (or all events)
     * @param {string} [event] - Event name (optional)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Check if an event has listeners
     * @param {string} event - Event name
     * @returns {boolean}
     */
    hasListeners(event) {
        return this.listeners.has(event) && this.listeners.get(event).size > 0;
    }
}

// Game event constants
export const GameEvents = {
    // Player events
    PLAYER_DAMAGED: 'player:damaged',
    PLAYER_HEALED: 'player:healed',
    PLAYER_DIED: 'player:died',
    PLAYER_LEVELUP: 'player:levelup',
    PLAYER_XP_GAINED: 'player:xp_gained',

    // Enemy events
    ENEMY_SPAWNED: 'enemy:spawned',
    ENEMY_DAMAGED: 'enemy:damaged',
    ENEMY_KILLED: 'enemy:killed',

    // Weapon events
    WEAPON_FIRED: 'weapon:fired',
    WEAPON_UPGRADED: 'weapon:upgraded',
    WEAPON_ACQUIRED: 'weapon:acquired',

    // Item events
    XP_COLLECTED: 'xp:collected',
    ITEM_COLLECTED: 'item:collected',

    // Game state events
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_OVER: 'game:over',
    GAME_RESTART: 'game:restart',

    // Scene events
    SCENE_CHANGE: 'scene:change',
    SCENE_READY: 'scene:ready',

    // UI events
    UI_UPGRADE_SELECTED: 'ui:upgrade_selected',
    UI_MENU_OPEN: 'ui:menu_open',
    UI_MENU_CLOSE: 'ui:menu_close'
};

// Singleton instance
export const eventBus = new EventBus();
