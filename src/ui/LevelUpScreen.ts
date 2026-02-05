// File: src/ui/LevelUpScreen.js
// Level-up upgrade selection screen

export interface UpgradeOptionBase {
    name: string;
    description: string;
    icon?: string;
    [key: string]: unknown;
}

export class LevelUpScreen {
    canvas: HTMLCanvasElement;
    config: unknown;
    visible: boolean;
    options: UpgradeOptionBase[];
    onSelect: ((option: UpgradeOptionBase) => void) | null;
    container: HTMLElement | null;
    optionsContainer: HTMLElement | null;
    _keyHandler: ((e: KeyboardEvent) => void) | null;

    constructor(canvas: HTMLCanvasElement, config: unknown) {
        this.canvas = canvas;
        this.config = config;

        this.visible = false;
        this.options = [];
        this.onSelect = null;
        this._keyHandler = null;

        // DOM elements
        this.container = document.getElementById('levelUpScreen');
        this.optionsContainer = document.getElementById('upgrade-options');

        // Ensure container uses correct class
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    /**
     * Show the level-up screen with options
     * @param {Object[]} options - Upgrade options
     * @param {Function} onSelect - Callback when option selected
     */
    show<T extends UpgradeOptionBase>(options: T[], onSelect: (option: T) => void) {
        this.options = options as UpgradeOptionBase[];
        this.onSelect = onSelect as (option: UpgradeOptionBase) => void;
        this.visible = true;

        if (this.container) {
            this.container.classList.remove('hidden');
            this.container.style.display = 'flex';
        }

        this._renderOptions();
    }

    /**
     * Hide the level-up screen
     */
    hide() {
        this.visible = false;

        if (this.container) {
            this.container.classList.add('hidden');
            this.container.style.display = 'none';
        }
    }

    _renderOptions() {
        if (!this.optionsContainer) return;

        // Clear existing options
        this.optionsContainer.innerHTML = '';

        // Create option buttons
        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const button = document.createElement('button');
            button.className = 'upgrade-option';
            button.innerHTML = `
                <span class="upgrade-icon">${option.icon || '⚡'}</span>
                <span class="upgrade-name">${option.name}</span>
                <span class="upgrade-desc">${option.description}</span>
            `;

            button.addEventListener('click', () => this._selectOption(i));

            // Keyboard shortcut hint
            button.setAttribute('data-key', (i + 1).toString());

            this.optionsContainer.appendChild(button);
        }

        // Add keyboard listener
        this._keyHandler = (e: KeyboardEvent) => {
            const num = parseInt(e.key);
            if (num >= 1 && num <= this.options.length) {
                this._selectOption(num - 1);
            }
        };

        document.addEventListener('keydown', this._keyHandler);
    }

    _selectOption(index: number) {
        if (index < 0 || index >= this.options.length) return;

        const option = this.options[index];

        // Remove keyboard listener
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        // Hide screen
        this.hide();

        // Callback
        if (this.onSelect) {
            this.onSelect(option);
        }
    }

    /**
     * Draw level-up screen (canvas overlay if needed)
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx: CanvasRenderingContext2D) {
        if (!this.visible) return;

        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // The actual UI is DOM-based
    }
}
