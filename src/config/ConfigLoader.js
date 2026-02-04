// File: src/config/ConfigLoader.js
// Loads and parses YAML configuration files

import { GameConfig } from './GameConfig.js';

export class ConfigLoader {
    /**
     * Load and parse a YAML configuration file
     * @param {string} path - Path to YAML file
     * @returns {Promise<Object>} Parsed configuration object
     */
    static async loadYaml(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${path} (${response.status})`);
            }
            const text = await response.text();

            // Use js-yaml if available (loaded via CDN)
            if (typeof jsyaml !== 'undefined') {
                return jsyaml.load(text);
            }

            // Fallback: simple YAML parser for basic structures
            return ConfigLoader.parseSimpleYaml(text);
        } catch (error) {
            console.error(`Error loading config from ${path}:`, error);
            throw error;
        }
    }

    /**
     * Load game configuration and merge with defaults
     * @param {string} path - Path to game.yaml
     * @returns {Promise<GameConfig>}
     */
    static async loadGameConfig(path = 'Resources/game.yaml') {
        try {
            const yamlConfig = await ConfigLoader.loadYaml(path);
            return new GameConfig(yamlConfig);
        } catch (error) {
            console.warn('Could not load game.yaml, using defaults:', error.message);
            return new GameConfig();
        }
    }

    /**
     * Simple YAML parser for basic structures
     * Handles: key: value, nested objects, simple arrays
     * @param {string} text - YAML text
     * @returns {Object}
     */
    static parseSimpleYaml(text) {
        const result = {};
        const lines = text.split('\n');
        const stack = [{ indent: -1, obj: result }];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip empty lines and comments
            if (!line.trim() || line.trim().startsWith('#')) continue;

            // Calculate indentation
            const indent = line.search(/\S/);
            const content = line.trim();

            // Pop stack until we find parent
            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            const parent = stack[stack.length - 1].obj;

            // Handle array item
            if (content.startsWith('- ')) {
                const value = content.slice(2).trim();
                if (!Array.isArray(parent)) {
                    // Convert parent's last key to array
                    const keys = Object.keys(parent);
                    const lastKey = keys[keys.length - 1];
                    if (parent[lastKey] === null || parent[lastKey] === undefined) {
                        parent[lastKey] = [];
                    }
                    if (Array.isArray(parent[lastKey])) {
                        if (value.includes(':')) {
                            // Object in array
                            const obj = {};
                            const [k, v] = value.split(':').map(s => s.trim());
                            obj[k] = ConfigLoader.parseValue(v);
                            parent[lastKey].push(obj);
                            stack.push({ indent, obj });
                        } else {
                            parent[lastKey].push(ConfigLoader.parseValue(value));
                        }
                    }
                }
                continue;
            }

            // Handle key: value
            const colonIndex = content.indexOf(':');
            if (colonIndex === -1) continue;

            const key = content.slice(0, colonIndex).trim();
            const value = content.slice(colonIndex + 1).trim();

            if (value === '' || value === null) {
                // Nested object
                parent[key] = {};
                stack.push({ indent, obj: parent[key] });
            } else {
                // Simple value
                parent[key] = ConfigLoader.parseValue(value);
            }
        }

        return result;
    }

    /**
     * Parse a YAML value to appropriate JS type
     * @param {string} value
     * @returns {*}
     */
    static parseValue(value) {
        if (value === '' || value === null || value === undefined) return null;
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null' || value === '~') return null;

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1);
        }

        // Try number
        const num = Number(value);
        if (!isNaN(num) && value !== '') return num;

        return value;
    }
}
