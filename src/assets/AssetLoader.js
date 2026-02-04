// File: src/assets/AssetLoader.js
// Central asset loader for images and YAML files

import yaml from 'js-yaml';
import { SpriteSheet } from './SpriteSheet.js';

export class AssetLoader {
    constructor() {
        this.images = new Map();
        this.yaml = new Map();
        this.spriteSheets = new Map();
        this.loading = new Map();
        this.basePath = '';
    }

    /**
     * Set base path for all asset loading
     * @param {string} path
     */
    setBasePath(path) {
        this.basePath = path;
    }

    /**
     * Load an image
     * @param {string} key - Asset key
     * @param {string} path - Path to image
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImage(key, path) {
        // Return cached if already loaded
        if (this.images.has(key)) {
            return this.images.get(key);
        }

        // Return pending promise if already loading
        if (this.loading.has(key)) {
            return this.loading.get(key);
        }

        const fullPath = this.basePath + path;
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(key, img);
                this.loading.delete(key);
                resolve(img);
            };
            img.onerror = () => {
                this.loading.delete(key);
                reject(new Error(`Failed to load image: ${fullPath}`));
            };
            img.src = fullPath;
        });

        this.loading.set(key, promise);
        return promise;
    }

    /**
     * Load a YAML file
     * @param {string} key - Asset key
     * @param {string} path - Path to YAML file
     * @returns {Promise<Object>}
     */
    async loadYaml(key, path) {
        // Return cached if already loaded
        if (this.yaml.has(key)) {
            return this.yaml.get(key);
        }

        const fullPath = this.basePath + path;
        try {
            const response = await fetch(fullPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const text = await response.text();

            // Parse YAML
            const data = yaml.load(text);

            this.yaml.set(key, data);
            return data;
        } catch (error) {
            throw new Error(`Failed to load YAML: ${fullPath} - ${error.message}`);
        }
    }

    /**
     * Load a sprite sheet (YAML + image)
     * @param {string} key - Asset key
     * @param {string} yamlPath - Path to YAML definition
     * @param {string} [imagePath] - Optional explicit image path
     * @returns {Promise<SpriteSheet>}
     */
    async loadSpriteSheet(key, yamlPath, imagePath = null) {
        // Return cached if already loaded
        if (this.spriteSheets.has(key)) {
            return this.spriteSheets.get(key);
        }

        // Load YAML definition
        const yamlData = await this.loadYaml(key + '_yaml', yamlPath);

        // Determine image path
        let imgPath = imagePath;
        if (!imgPath && yamlData.meta && yamlData.meta.file) {
            // Get image path from YAML, relative to YAML file location
            const yamlDir = yamlPath.substring(0, yamlPath.lastIndexOf('/') + 1);
            const fileName = Array.isArray(yamlData.meta.file)
                ? yamlData.meta.file[0]
                : yamlData.meta.file;
            imgPath = yamlDir + fileName;
        }

        if (!imgPath) {
            throw new Error(`No image path specified for sprite sheet: ${key}`);
        }

        // Load image
        const image = await this.loadImage(key + '_img', imgPath);

        // Create sprite sheet
        const spriteSheet = new SpriteSheet(key, image, yamlData);
        this.spriteSheets.set(key, spriteSheet);

        return spriteSheet;
    }

    /**
     * Load multiple assets in parallel
     * @param {Object} manifest - Asset manifest
     * @returns {Promise<void>}
     */
    async loadManifest(manifest) {
        const promises = [];

        // Load images
        if (manifest.images) {
            for (const [key, path] of Object.entries(manifest.images)) {
                promises.push(this.loadImage(key, path));
            }
        }

        // Load YAML files
        if (manifest.yaml) {
            for (const [key, path] of Object.entries(manifest.yaml)) {
                promises.push(this.loadYaml(key, path));
            }
        }

        // Load sprite sheets
        if (manifest.spriteSheets) {
            for (const [key, config] of Object.entries(manifest.spriteSheets)) {
                if (typeof config === 'string') {
                    promises.push(this.loadSpriteSheet(key, config));
                } else {
                    promises.push(this.loadSpriteSheet(key, config.yaml, config.image));
                }
            }
        }

        await Promise.all(promises);
    }

    /**
     * Get a loaded image
     * @param {string} key
     * @returns {HTMLImageElement|null}
     */
    getImage(key) {
        return this.images.get(key) || null;
    }

    /**
     * Get loaded YAML data
     * @param {string} key
     * @returns {Object|null}
     */
    getYaml(key) {
        return this.yaml.get(key) || null;
    }

    /**
     * Get a loaded sprite sheet
     * @param {string} key
     * @returns {SpriteSheet|null}
     */
    getSpriteSheet(key) {
        return this.spriteSheets.get(key) || null;
    }

    /**
     * Check if an asset is loaded
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.images.has(key) ||
               this.yaml.has(key) ||
               this.spriteSheets.has(key);
    }

    /**
     * Clear all loaded assets
     */
    clear() {
        this.images.clear();
        this.yaml.clear();
        this.spriteSheets.clear();
        this.loading.clear();
    }
}

// Singleton instance
export const assetLoader = new AssetLoader();
