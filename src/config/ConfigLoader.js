// File: src/config/ConfigLoader.js
// Loads and parses YAML configuration files

import yaml from 'js-yaml';
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
            return yaml.load(text);
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
}
