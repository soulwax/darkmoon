// File: src/weapons/Sword.js
// Melee sword weapon with swing animation and knockback

import { Weapon } from './Weapon';
import { MathUtils, type Direction } from '../core/Math';
import type { Enemy } from '../entities/Enemy';
import type { AnimatorComponent } from '../ecs/components/AnimatorComponent';

export class Sword extends Weapon {
    baseDamage: number;
    baseKnockback: number;
    baseCooldown: number;
    baseRange: number;
    baseArc: number;
    swinging: boolean;
    swingAngle: number;
    swingProgress: number;
    swingDuration: number;
    swingDirection: number;
    bladeLength: number;
    bladeWidth: number;
    trailPositions: Array<{ angle: number; alpha: number }>;
    maxTrailLength: number;
    hitThisSwing: Set<Enemy>;
    autoAttack: boolean;
    nearestEnemy: Enemy | null;
    currentCooldown: number;

    constructor(owner: Weapon['owner']) {
        super(owner);

        this.name = 'Sword';
        this.maxLevel = 8;

        // Base stats
        this.baseDamage = 25;
        this.baseKnockback = 300;
        this.baseCooldown = 0.8;
        this.baseRange = 60;
        this.baseArc = Math.PI * 0.75; // 135 degree arc for wider slash

        // Current swing state
        this.swinging = false;
        this.swingAngle = 0;
        this.swingProgress = 0;
        this.swingDuration = 0.15; // Faster swing
        this.swingDirection = 1;

        // Visual properties
        this.bladeLength = 28;
        this.bladeWidth = 6;
        this.trailPositions = [];
        this.maxTrailLength = 12;

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

    set damage(value: number) {
        this.baseDamage = value;
    }

    get knockback() {
        return this.baseKnockback * (1 + (this.level - 1) * 0.15);
    }

    get cooldown() {
        return Math.max(0.3, this.baseCooldown * (1 - (this.level - 1) * 0.08));
    }

    set cooldown(value: number) {
        this.baseCooldown = value;
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
    findNearestEnemy(enemies: Enemy[]) {
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
    startSwing(targetAngle: number) {
        if (this.swinging || this.currentCooldown > 0) return;

        this.swinging = true;
        this.swingProgress = 0;
        this.swingAngle = targetAngle;
        this.swingDirection = Math.random() > 0.5 ? 1 : -1;
        this.hitThisSwing.clear();
        this.trailPositions = [];

        // Trigger attack animation on owner (lock so movement doesn't instantly override it)
        let dir: Direction = 'down';
        if (targetAngle > -Math.PI * 0.75 && targetAngle < -Math.PI * 0.25) dir = 'up';
        else if (targetAngle >= -Math.PI * 0.25 && targetAngle <= Math.PI * 0.25) dir = 'right';
        else if (targetAngle > Math.PI * 0.25 && targetAngle < Math.PI * 0.75) dir = 'down';
        else dir = 'left';

        if (typeof (this.owner as any).lockAnimation === 'function') {
            (this.owner as any).lockAnimation('attack', dir, this.swingDuration * 1.2, 1.25);
        } else {
            const animator = this.owner.getComponent<AnimatorComponent>('AnimatorComponent');
            animator?.setState('attack', dir);
        }
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
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
    _checkHits(enemies: Enemy[]) {
        const currentAngle = this._getCurrentSwingAngle();
        // Only apply damage during the "active" portion of the swing.
        if (this.swingProgress < 0.12 || this.swingProgress > 0.88) return;
        const hitWindow = this.arc * 0.35;

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

            if (Math.abs(angleDiff) < hitWindow) {
                this._hitEnemy(enemy, enemyAngle);
            }
        }
    }

    /**
     * Apply hit to enemy
     */
    _hitEnemy(enemy: Enemy, angle: number) {
        this.hitThisSwing.add(enemy);

        // Apply damage
        const mult = typeof this.owner.getDamageMultiplier === 'function' ? this.owner.getDamageMultiplier() : (this.owner.stats?.damageMultiplier || 1);
        const damage = Math.floor(this.damage * mult);
        enemy.takeDamage(damage, this.owner);

        // Apply knockback
        const knockbackX = Math.cos(angle) * this.knockback;
        const knockbackY = Math.sin(angle) * this.knockback;
        enemy.applyKnockback(knockbackX, knockbackY);
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.swinging && this.trailPositions.length === 0) return;

        const { x, y } = this.owner;
        const slashRadius = this.range * 0.8;

        ctx.save();
        ctx.translate(x, y);

        // Draw arc slash trail
        if (this.trailPositions.length >= 2) {
            const startAngle = this.trailPositions[0].angle;
            const endAngle = this.trailPositions[this.trailPositions.length - 1].angle;

            // Outer glow
            ctx.beginPath();
            ctx.arc(0, 0, slashRadius + 8, startAngle, endAngle, this.swingDirection < 0);
            ctx.strokeStyle = 'rgba(150, 200, 255, 0.2)';
            ctx.lineWidth = 16;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Main slash arc
            ctx.beginPath();
            ctx.arc(0, 0, slashRadius, startAngle, endAngle, this.swingDirection < 0);
            const gradient = ctx.createRadialGradient(0, 0, slashRadius - 10, 0, 0, slashRadius + 10);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(150, 180, 255, 0.3)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Inner bright edge
            ctx.beginPath();
            ctx.arc(0, 0, slashRadius - 2, startAngle, endAngle, this.swingDirection < 0);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw blade tip at current position
        if (this.swinging) {
            const currentAngle = this._getCurrentSwingAngle();
            const tipX = Math.cos(currentAngle) * slashRadius;
            const tipY = Math.sin(currentAngle) * slashRadius;

            // Blade tip glow
            ctx.beginPath();
            ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();

            // Blade tip core
            ctx.beginPath();
            ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
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

