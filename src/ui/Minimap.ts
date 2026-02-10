// File: src/ui/Minimap.ts

import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { XPGem } from '../entities/XPGem';
import type { Camera } from '../graphics/Camera';
import type { GameConfig } from '../config/GameConfig';
import type { MovementComponent } from '../ecs/components/MovementComponent';

export class Minimap {
    canvas: HTMLCanvasElement;
    config: GameConfig;
    width: number;
    height: number;
    margin: number;
    borderWidth: number;
    x: number;
    y: number;
    worldWidth: number;
    worldHeight: number;
    scaleX: number;
    scaleY: number;
    visible: boolean;
    alpha: number;

    constructor(canvas: HTMLCanvasElement, config: GameConfig) {
        this.canvas = canvas;
        this.config = config;

        // Minimap settings
        this.width = 150;
        this.height = 150;
        this.margin = 20;
        this.borderWidth = 2;

        // Position (bottom-right corner)
        this.x = canvas.width - this.width - this.margin;
        this.y = canvas.height - this.height - this.margin;

        // World dimensions
        this.worldWidth = config.world.worldWidthTiles * config.world.tileSize;
        this.worldHeight = config.world.worldHeightTiles * config.world.tileSize;

        // Scale factor
        this.scaleX = this.width / this.worldWidth;
        this.scaleY = this.height / this.worldHeight;

        // Visibility
        this.visible = true;
        this.alpha = 0.8;
    }

    /**
     * Toggle minimap visibility
     */
    toggle() {
        this.visible = !this.visible;
    }

    /**
     * Convert world position to minimap position
     */
    worldToMinimap(worldX: number, worldY: number) {
        return {
            x: this.x + worldX * this.scaleX,
            y: this.y + worldY * this.scaleY
        };
    }

    /**
     * Draw the minimap
     * @param {CanvasRenderingContext2D} ctx
     * @param {Player} player
     * @param {Enemy[]} enemies
     * @param {XPGem[]} xpGems
     * @param {Camera} camera
     */
    draw(ctx: CanvasRenderingContext2D, player: Player | null, enemies: Enemy[] = [], xpGems: XPGem[] = [], camera: Camera | null = null) {
        if (!this.visible) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.x - this.borderWidth, this.y - this.borderWidth,
                     this.width + this.borderWidth * 2, this.height + this.borderWidth * 2);

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = this.borderWidth;
        ctx.strokeRect(this.x - this.borderWidth, this.y - this.borderWidth,
                       this.width + this.borderWidth * 2, this.height + this.borderWidth * 2);

        // Draw camera viewport
        if (camera) {
            const bounds = camera.getVisibleBounds();
            const camPos = this.worldToMinimap(bounds.x, bounds.y);
            const camWidth = bounds.width * this.scaleX;
            const camHeight = bounds.height * this.scaleY;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(camPos.x, camPos.y, camWidth, camHeight);
        }

        // Draw XP gems (small green dots)
        ctx.fillStyle = '#4f4';
        for (const gem of xpGems) {
            const pos = this.worldToMinimap(gem.x, gem.y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw enemies (red dots)
        ctx.fillStyle = '#f44';
        for (const enemy of enemies) {
            const pos = this.worldToMinimap(enemy.x, enemy.y);
            const size = Math.max(2, enemy.size * this.scaleX * 2);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw player (blue dot with glow)
        if (player) {
            const playerPos = this.worldToMinimap(player.x, player.y);

            // Glow
            ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(playerPos.x, playerPos.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // Player dot
            ctx.fillStyle = '#5af';
            ctx.beginPath();
            ctx.arc(playerPos.x, playerPos.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Direction indicator
            const movement = player.getComponent<MovementComponent>('MovementComponent');
            if (movement) {
                const dir = movement.facingDirection;
                let dx = 0, dy = 0;
                switch(dir) {
                    case 'up': dy = -8; break;
                    case 'down': dy = 8; break;
                    case 'left': dx = -8; break;
                    case 'right': dx = 8; break;
                }
                ctx.strokeStyle = '#5af';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(playerPos.x, playerPos.y);
                ctx.lineTo(playerPos.x + dx, playerPos.y + dy);
                ctx.stroke();
            }
        }

        // Draw "MAP" label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('MAP', this.x + 4, this.y + 12);

        ctx.restore();
    }
}
