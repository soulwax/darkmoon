// File: src/config/ConfigLoader.js
// Loads and parses YAML configuration files

import yaml from 'js-yaml';
import { GameConfig } from './GameConfig.js';

export class ConfigLoader {
    static resolvePath(path) {
        if (!path) return path;
        if (/^https?:\/\//i.test(path)) return path;

        const baseUrl = (import.meta?.env?.BASE_URL || '/');
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
        return `${base}${normalizedPath}`;
    }

    /**
     * Load and parse a YAML configuration file
     * @param {string} path - Path to YAML file
     * @returns {Promise<Object>} Parsed configuration object
     */
    static async loadYaml(path) {
        try {
            const resolved = ConfigLoader.resolvePath(path);
            const response = await fetch(resolved);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${resolved} (${response.status})`);
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
    static async loadGameConfig(path = 'game.yaml') {
        try {
            const yamlConfig = await ConfigLoader.loadYaml(path);
            return new GameConfig(yamlConfig);
        } catch (error) {
            console.warn('Could not load game.yaml, using defaults:', error.message);
            return new GameConfig();
        }
    }
}
