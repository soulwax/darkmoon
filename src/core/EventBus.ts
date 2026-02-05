// File: src/core/EventBus.js
// Pub/sub event system for decoupling game systems

export type EventCallback = (data: any) => void;

export class EventBus {
    listeners: Map<string, Set<EventCallback>>;

    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event: string, callback: EventCallback) {
        let handlers = this.listeners.get(event);
        if (!handlers) {
            handlers = new Set();
            this.listeners.set(event, handlers);
        }
        handlers.add(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(event, callback);
    }

    /**
     * Alias for subscribe
     */
    on(event: string, callback: EventCallback) {
        return this.subscribe(event, callback);
    }

    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event: string, callback: EventCallback) {
        const wrapper: EventCallback = (data) => {
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
    unsubscribe(event: string, callback: EventCallback) {
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
    off(event: string, callback: EventCallback) {
        this.unsubscribe(event, callback);
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} data - Data to pass to handlers
     */
    emit(event: string, data?: unknown) {
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
    clear(event?: string) {
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
    hasListeners(event: string) {
        const handlers = this.listeners.get(event);
        return !!handlers && handlers.size > 0;
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
    POWERUP_COLLECTED: 'powerup:collected',

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
} as const;

export type GameEvent = typeof GameEvents[keyof typeof GameEvents];

// Singleton instance
export const eventBus = new EventBus();
