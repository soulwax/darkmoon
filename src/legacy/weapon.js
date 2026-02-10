// File: src/legacy/weapon.js
// Base Weapon Class

class Weapon {
    constructor(player) {
        this.player = player;
        this.level = 1;
        this.damage = 10;
        this.cooldown = 1.0;
        this.currentCooldown = 0;
    }

    update(deltaTime, enemies) {
        this.currentCooldown = Math.max(0, this.currentCooldown - deltaTime);
    }

    draw(ctx) {
        // Override in subclasses
    }

    upgrade() {
        this.level++;
    }
}

// Magic Orbs - Rotate around player
class MagicOrbs extends Weapon {
    constructor(player) {
        super(player);
        this.name = "Magic Orbs";
        this.description = "Orbs that rotate around you";
        this.orbCount = 2;
        this.orbitRadius = 60;
        this.rotationSpeed = 2;
        this.damage = 15;
        this.angle = 0;
        this.orbs = [];
        this.initOrbs();
    }

    initOrbs() {
        this.orbs = [];
        for (let i = 0; i < this.orbCount; i++) {
            this.orbs.push({
                angle: (Math.PI * 2 * i) / this.orbCount,
                size: 8
            });
        }
    }

    update(deltaTime, enemies) {
        super.update(deltaTime, enemies);
        this.angle += this.rotationSpeed * deltaTime;
        
        // Check collision with enemies
        this.orbs.forEach(orb => {
            const orbX = this.player.x + Math.cos(this.angle + orb.angle) * this.orbitRadius;
            const orbY = this.player.y + Math.sin(this.angle + orb.angle) * this.orbitRadius;
            
            enemies.forEach(enemy => {
                if (!enemy.dead) {
                    const dx = enemy.x - orbX;
                    const dy = enemy.y - orbY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < orb.size + enemy.size) {
                        enemy.takeDamage(this.damage);
                    }
                }
            });
        });
    }

    draw(ctx) {
        this.orbs.forEach(orb => {
            const x = this.player.x + Math.cos(this.angle + orb.angle) * this.orbitRadius;
            const y = this.player.y + Math.sin(this.angle + orb.angle) * this.orbitRadius;
            
            // Draw glow
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#44f';
            ctx.beginPath();
            ctx.arc(x, y, orb.size * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw orb
            ctx.fillStyle = '#66f';
            ctx.strokeStyle = '#aaf';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, orb.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    upgrade() {
        super.upgrade();
        if (this.level === 2) {
            this.orbCount = 3;
            this.damage = 20;
        } else if (this.level === 3) {
            this.orbCount = 4;
            this.damage = 25;
        } else if (this.level === 4) {
            this.orbCount = 5;
            this.damage = 30;
            this.orbitRadius = 70;
        } else {
            this.damage += 10;
            this.orbCount = Math.min(8, this.orbCount + 1);
        }
        this.initOrbs();
    }
}

// Projectile Weapon - Shoots at nearest enemy
class Projectiles extends Weapon {
    constructor(player) {
        super(player);
        this.name = "Magic Missiles";
        this.description = "Shoots projectiles at enemies";
        this.projectiles = [];
        this.damage = 20;
        this.cooldown = 0.8;
        this.projectileSpeed = 300;
        this.projectileCount = 1;
        this.piercing = 1;
    }

    update(deltaTime, enemies) {
        super.update(deltaTime, enemies);
        
        // Shoot projectiles
        if (this.currentCooldown <= 0 && enemies.length > 0) {
            const aliveEnemies = enemies.filter(e => !e.dead);
            if (aliveEnemies.length > 0) {
                for (let i = 0; i < this.projectileCount; i++) {
                    // Find nearest enemy
                    let nearest = null;
                    let minDist = Infinity;
                    
                    aliveEnemies.forEach(enemy => {
                        const dx = enemy.x - this.player.x;
                        const dy = enemy.y - this.player.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = enemy;
                        }
                    });
                    
                    if (nearest) {
                        const angle = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
                        const spreadAngle = (i - (this.projectileCount - 1) / 2) * 0.2;
                        this.projectiles.push({
                            x: this.player.x,
                            y: this.player.y,
                            vx: Math.cos(angle + spreadAngle) * this.projectileSpeed,
                            vy: Math.sin(angle + spreadAngle) * this.projectileSpeed,
                            lifetime: 3.0,
                            piercing: this.piercing,
                            size: 6
                        });
                    }
                }
                this.currentCooldown = this.cooldown;
            }
        }
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.x += proj.vx * deltaTime;
            proj.y += proj.vy * deltaTime;
            proj.lifetime -= deltaTime;
            
            // Check collision with enemies
            let hit = false;
            enemies.forEach(enemy => {
                if (!enemy.dead && !hit) {
                    const dx = enemy.x - proj.x;
                    const dy = enemy.y - proj.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < proj.size + enemy.size) {
                        enemy.takeDamage(this.damage);
                        proj.piercing--;
                        if (proj.piercing <= 0) {
                            hit = true;
                        }
                    }
                }
            });
            
            if (proj.lifetime <= 0 || hit) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.projectiles.forEach(proj => {
            // Draw trail
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#f4f';
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw projectile
            ctx.fillStyle = '#f6f';
            ctx.strokeStyle = '#faf';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    upgrade() {
        super.upgrade();
        if (this.level === 2) {
            this.damage = 25;
            this.cooldown = 0.7;
        } else if (this.level === 3) {
            this.projectileCount = 2;
            this.damage = 30;
        } else if (this.level === 4) {
            this.piercing = 2;
            this.damage = 35;
        } else if (this.level === 5) {
            this.projectileCount = 3;
            this.cooldown = 0.6;
        } else {
            this.damage += 10;
            this.projectileCount = Math.min(5, this.projectileCount + 1);
        }
    }
}

// Area Attack - Periodic damage zones
class AreaAttack extends Weapon {
    constructor(player) {
        super(player);
        this.name = "Lightning Strike";
        this.description = "Strikes random enemies with lightning";
        this.damage = 40;
        this.cooldown = 2.0;
        this.strikeCount = 1;
        this.strikes = [];
        this.radius = 40;
    }

    update(deltaTime, enemies) {
        super.update(deltaTime, enemies);
        
        // Create strikes
        if (this.currentCooldown <= 0 && enemies.length > 0) {
            const aliveEnemies = enemies.filter(e => !e.dead);
            if (aliveEnemies.length > 0) {
                for (let i = 0; i < this.strikeCount; i++) {
                    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                    this.strikes.push({
                        x: target.x,
                        y: target.y,
                        lifetime: 0.3,
                        maxLifetime: 0.3,
                        hasDealtDamage: false
                    });
                }
                this.currentCooldown = this.cooldown;
            }
        }
        
        // Update strikes
        for (let i = this.strikes.length - 1; i >= 0; i--) {
            const strike = this.strikes[i];
            strike.lifetime -= deltaTime;
            
            // Deal damage once
            if (!strike.hasDealtDamage && strike.lifetime < strike.maxLifetime * 0.5) {
                enemies.forEach(enemy => {
                    if (!enemy.dead) {
                        const dx = enemy.x - strike.x;
                        const dy = enemy.y - strike.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < this.radius) {
                            enemy.takeDamage(this.damage);
                        }
                    }
                });
                strike.hasDealtDamage = true;
            }
            
            if (strike.lifetime <= 0) {
                this.strikes.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.strikes.forEach(strike => {
            const alpha = strike.lifetime / strike.maxLifetime;
            
            // Draw lightning circle
            ctx.save();
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = '#ff0';
            ctx.beginPath();
            ctx.arc(strike.x, strike.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw lightning bolt
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(strike.x, strike.y - this.radius * 2);
            ctx.lineTo(strike.x + 10, strike.y - this.radius);
            ctx.lineTo(strike.x - 10, strike.y);
            ctx.lineTo(strike.x + 10, strike.y + this.radius);
            ctx.lineTo(strike.x, strike.y + this.radius * 2);
            ctx.stroke();
            ctx.restore();
        });
    }

    upgrade() {
        super.upgrade();
        if (this.level === 2) {
            this.damage = 50;
            this.cooldown = 1.8;
        } else if (this.level === 3) {
            this.strikeCount = 2;
            this.damage = 60;
        } else if (this.level === 4) {
            this.radius = 50;
            this.damage = 70;
        } else if (this.level === 5) {
            this.strikeCount = 3;
            this.cooldown = 1.5;
        } else {
            this.damage += 15;
            this.strikeCount = Math.min(5, this.strikeCount + 1);
        }
    }
}
