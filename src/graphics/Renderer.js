// File: src/graphics/Renderer.js
// Canvas rendering wrapper

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Disable image smoothing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;

        // Default colors
        this.backgroundColor = '#1a1a2e';
        this.gridColor = 'rgba(255, 255, 255, 0.05)';
        this.gridSize = 40;
    }

    /**
     * Clear the entire canvas
     * @param {string} [color] - Optional background color
     */
    clear(color = this.backgroundColor) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw a background grid
     * @param {number} [offsetX=0] - Camera offset X
     * @param {number} [offsetY=0] - Camera offset Y
     */
    drawGrid(offsetX = 0, offsetY = 0) {
        this.ctx.strokeStyle = this.gridColor;
        this.ctx.lineWidth = 1;

        const startX = -(offsetX % this.gridSize);
        const startY = -(offsetY % this.gridSize);

        // Vertical lines
        for (let x = startX; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = startY; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Draw a filled rectangle
     */
    fillRect(x, y, width, height, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
    }

    /**
     * Draw a stroked rectangle
     */
    strokeRect(x, y, width, height, color, lineWidth = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeRect(x, y, width, height);
    }

    /**
     * Draw a filled circle
     */
    fillCircle(x, y, radius, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw a stroked circle
     */
    strokeCircle(x, y, radius, color, lineWidth = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    /**
     * Draw an ellipse (for shadows)
     */
    fillEllipse(x, y, radiusX, radiusY, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw text
     */
    fillText(text, x, y, options = {}) {
        const {
            color = '#fff',
            font = '16px Arial',
            align = 'left',
            baseline = 'top'
        } = options;

        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Draw text with outline
     */
    strokeText(text, x, y, options = {}) {
        const {
            color = '#fff',
            strokeColor = '#000',
            font = '16px Arial',
            align = 'left',
            baseline = 'top',
            lineWidth = 2
        } = options;

        this.ctx.font = font;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;

        // Draw stroke first
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeText(text, x, y);

        // Then fill
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Draw a line
     */
    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    /**
     * Draw an image
     */
    drawImage(image, x, y, width, height) {
        this.ctx.drawImage(image, x, y, width, height);
    }

    /**
     * Draw a portion of an image (sprite from spritesheet)
     */
    drawSprite(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    /**
     * Draw a health bar
     */
    drawHealthBar(x, y, width, height, percent, options = {}) {
        const {
            bgColor = '#333',
            fillColor = '#4f4',
            borderColor = '#fff',
            borderWidth = 1
        } = options;

        // Background
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(x, y, width, height);

        // Fill based on percent
        const fillWidth = width * Math.max(0, Math.min(1, percent));
        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(x, y, fillWidth, height);

        // Border
        if (borderWidth > 0) {
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = borderWidth;
            this.ctx.strokeRect(x, y, width, height);
        }
    }

    /**
     * Set global alpha
     */
    setAlpha(alpha) {
        this.ctx.globalAlpha = alpha;
    }

    /**
     * Reset global alpha
     */
    resetAlpha() {
        this.ctx.globalAlpha = 1;
    }

    /**
     * Save context state
     */
    save() {
        this.ctx.save();
    }

    /**
     * Restore context state
     */
    restore() {
        this.ctx.restore();
    }

    /**
     * Get canvas dimensions
     */
    get width() {
        return this.canvas.width;
    }

    get height() {
        return this.canvas.height;
    }
}
