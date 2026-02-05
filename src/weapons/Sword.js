// File: src/weapons/Sword.js
// Melee sword weapon with swing animation and knockback

import { Weapon } from './Weapon.js';
import { MathUtils } from '../core/Math.js';

export class Sword extends Weapon {
    constructor(owner) {
        super(owner);

        this.name = 'Sword';
        this.maxLevel = 8;

        // Base stats
        this.baseDamage = 25;
        this.baseKnockback = 300;
        this.baseCooldown = 0.8;
        this.baseRange = 60;
        this.baseArc = Math.PI * 0.6; // 108 degree arc

        // Current swing state
        this.swinging = false;
        this.swingAngle = 0;
        this.swingProgress = 0;
        this.swingDuration = 0.2;
        this.swingDirection = 1;

        // Visual properties
        this.bladeLength = 40;
        this.bladeWidth = 8;
        this.trailPositions = [];
        this.maxTrailLength = 8;

        // Enemies hit this swing (prevent double-hit)
        this.hitThisSwing = new Set();

        // Auto-attack settings
        this.autoAttack = true;
        this.nearestEnemy = null;

        // Cooldown timer
        this.currentCooldown = 0;
    }

    _applyUpgrade() {
        // Sword stats are derived from getters that depend on `level`.
        // No direct stat mutation needed on upgrade.
    }

    /**
     * Get current stats based on level
     */
    get damage() {
        return this.baseDamage * (1 + (this.level - 1) * 0.2);
    }

    get knockback() {
        return this.baseKnockback * (1 + (this.level - 1) * 0.15);
    }

    get cooldown() {
        return Math.max(0.3, this.baseCooldown * (1 - (this.level - 1) * 0.08));
    }

    get range() {
        return this.baseRange * (1 + (this.level - 1) * 0.1);
    }

    get arc() {
        return Math.min(Math.PI, this.baseArc * (1 + (this.level - 1) * 0.05));
    }

    /**
     * Find nearest enemy in attack range
     */
    findNearestEnemy(enemies) {
        let nearest = null;
        let nearestDist = this.range * 1.5;

        for (const enemy of enemies) {
            if (enemy.destroyed) continue;

            const dx = enemy.x - this.owner.x;
            const dy = enemy.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    /**
     * Start a swing attack
     */
    startSwing(targetAngle) {
        if (this.swinging || this.currentCooldown > 0) return;

        this.swinging = true;
        this.swingProgress = 0;
        this.swingAngle = targetAngle;
        this.swingDirection = Math.random() > 0.5 ? 1 : -1;
        this.hitThisSwing.clear();
        this.trailPositions = [];

        // Trigger attack animation on owner
        const animator = this.owner.getComponent?.('AnimatorComponent');
        if (animator) {
            // Determine direction from angle
            let dir = 'down';
            if (targetAngle > -Math.PI * 0.75 && targetAngle < -Math.PI * 0.25) dir = 'up';
            else if (targetAngle >= -Math.PI * 0.25 && targetAngle <= Math.PI * 0.25) dir = 'right';
            else if (targetAngle > Math.PI * 0.25 && targetAngle < Math.PI * 0.75) dir = 'down';
            else dir = 'left';

            animator.setState('attack', dir);
        }
    }

    update(deltaTime, enemies = []) {
        // Update cooldown
        if (this.currentCooldown > 0) {
            this.currentCooldown -= deltaTime;
        }

        // Auto-attack: find target and swing
        if (this.autoAttack && !this.swinging && this.currentCooldown <= 0) {
            this.nearestEnemy = this.findNearestEnemy(enemies);

            if (this.nearestEnemy) {
                const dx = this.nearestEnemy.x - this.owner.x;
                const dy = this.nearestEnemy.y - this.owner.y;
                const targetAngle = Math.atan2(dy, dx);
                this.startSwing(targetAngle);
            }
        }

        // Update swing
        if (this.swinging) {
            this.swingProgress += deltaTime / this.swingDuration;

            // Store trail position
            const currentAngle = this._getCurrentSwingAngle();
            this.trailPositions.push({
                angle: currentAngle,
                alpha: 1.0
            });

            // Limit trail length
            if (this.trailPositions.length > this.maxTrailLength) {
                this.trailPositions.shift();
            }

            // Fade trail
            for (let i = 0; i < this.trailPositions.length; i++) {
                this.trailPositions[i].alpha = (i + 1) / this.trailPositions.length * 0.6;
            }

            // Check for hits during swing
            this._checkHits(enemies);

            // End swing
            if (this.swingProgress >= 1) {
                this.swinging = false;
                this.currentCooldown = this.cooldown;
                this.trailPositions = [];
            }
        }
    }

    /**
     * Get current swing angle based on progress
     */
    _getCurrentSwingAngle() {
        const halfArc = this.arc / 2;
        const startAngle = this.swingAngle - halfArc * this.swingDirection;
        const endAngle = this.swingAngle + halfArc * this.swingDirection;

        // Ease in-out for smoother swing
        const t = MathUtils.easeOutQuad(this.swingProgress);
        return MathUtils.lerp(startAngle, endAngle, t);
    }

    /**
     * Check for enemies hit by the swing
     */
    _checkHits(enemies) {
        const currentAngle = this._getCurrentSwingAngle();

        for (const enemy of enemies) {
            if (enemy.destroyed || this.hitThisSwing.has(enemy)) continue;

            const dx = enemy.x - this.owner.x;
            const dy = enemy.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if in range
            if (dist > this.range + enemy.size) continue;

            // Check if within arc
            const enemyAngle = Math.atan2(dy, dx);
            const angleDiff = MathUtils.normalizeAngle(enemyAngle - currentAngle);

            if (Math.abs(angleDiff) < this.arc / 4) {
                this._hitEnemy(enemy, enemyAngle);
            }
        }
    }

    /**
     * Apply hit to enemy
     */
    _hitEnemy(enemy, angle) {
        this.hitThisSwing.add(enemy);

        // Apply damage
        const damage = Math.floor(this.damage * (this.owner.stats?.damageMultiplier || 1));
        enemy.takeDamage(damage, this.owner);

        // Apply knockback
        const knockbackX = Math.cos(angle) * this.knockback;
        const knockbackY = Math.sin(angle) * this.knockback;
        enemy.applyKnockback(knockbackX, knockbackY);
    }

    draw(ctx) {
        if (!this.swinging && this.trailPositions.length === 0) return;

        const { x, y } = this.owner;

        ctx.save();
        ctx.translate(x, y);

        // Draw trail
        for (const trail of this.trailPositions) {
            ctx.save();
            ctx.rotate(trail.angle);
            ctx.globalAlpha = trail.alpha;

            // Trail blade
            ctx.fillStyle = '#aaccff';
            ctx.beginPath();
            ctx.moveTo(15, -2);
            ctx.lineTo(15 + this.bladeLength, -this.bladeWidth / 2);
            ctx.lineTo(15 + this.bladeLength + 8, 0);
            ctx.lineTo(15 + this.bladeLength, this.bladeWidth / 2);
            ctx.lineTo(15, 2);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        // Draw current blade
        if (this.swinging) {
            const currentAngle = this._getCurrentSwingAngle();

            ctx.rotate(currentAngle);
            ctx.globalAlpha = 1;

            // Handle
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(5, -3, 12, 6);

            // Guard
            ctx.fillStyle = '#DAA520';
            ctx.fillRect(15, -6, 4, 12);

            // Blade
            const gradient = ctx.createLinearGradient(19, 0, 19 + this.bladeLength, 0);
            gradient.addColorStop(0, '#e0e0e0');
            gradient.addColorStop(0.5, '#ffffff');
            gradient.addColorStop(1, '#c0c0c0');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(19, -this.bladeWidth / 2);
            ctx.lineTo(19 + this.bladeLength - 5, -this.bladeWidth / 2);
            ctx.lineTo(19 + this.bladeLength + 5, 0);
            ctx.lineTo(19 + this.bladeLength - 5, this.bladeWidth / 2);
            ctx.lineTo(19, this.bladeWidth / 2);
            ctx.closePath();
            ctx.fill();

            // Blade edge highlight
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(19, -this.bladeWidth / 2 + 1);
            ctx.lineTo(19 + this.bladeLength - 5, -this.bladeWidth / 2 + 1);
            ctx.stroke();

            // Blade outline
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(19, -this.bladeWidth / 2);
            ctx.lineTo(19 + this.bladeLength - 5, -this.bladeWidth / 2);
            ctx.lineTo(19 + this.bladeLength + 5, 0);
            ctx.lineTo(19 + this.bladeLength - 5, this.bladeWidth / 2);
            ctx.lineTo(19, this.bladeWidth / 2);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }

    upgrade() {
        if (this.level < this.maxLevel) {
            this.level++;
            return true;
        }
        return false;
    }
}
