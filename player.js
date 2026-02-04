// File: player.js

// Player Class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 16;
        this.speed = 150;
        this.baseSpeed = 150;
        this.health = 100;
        this.maxHealth = 100;
        this.xp = 0;
        this.xpToNextLevel = 10;
        this.level = 1;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this.invulnerableDuration = 1.0;
        this.pickupRange = 100;
        this.weapons = [];
        this.damageFlash = 0;
        
        // Movement
        this.velocityX = 0;
        this.velocityY = 0;
        
        // Input
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };
        
        // Stats for upgrades
        this.stats = {
            moveSpeed: 1.0,
            maxHealth: 1.0,
            pickupRange: 1.0,
            damageMultiplier: 1.0
        };
        
        this.setupInput();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = false;
            }
        });
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        // Handle movement
        let moveX = 0;
        let moveY = 0;
        
        if (this.keys.w) moveY -= 1;
        if (this.keys.s) moveY += 1;
        if (this.keys.a) moveX -= 1;
        if (this.keys.d) moveX += 1;
        
        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }
        
        // Apply movement
        this.speed = this.baseSpeed * this.stats.moveSpeed;
        this.x += moveX * this.speed * deltaTime;
        this.y += moveY * this.speed * deltaTime;
        
        // Keep player in bounds
        this.x = Math.max(this.size, Math.min(canvasWidth - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvasHeight - this.size, this.y));
        
        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTimer -= deltaTime;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update damage flash
        this.damageFlash = Math.max(0, this.damageFlash - deltaTime * 3);
        
        // Update weapons
        this.weapons.forEach(weapon => weapon.update(deltaTime, []));
    }

    draw(ctx) {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size * 0.8, this.size * 0.8, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player with invulnerability flash
        ctx.save();
        if (this.invulnerable && Math.floor(this.invulnerableTimer * 10) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        if (this.damageFlash > 0) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = '#4af';
        }
        ctx.strokeStyle = '#28d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw face
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y - 3, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 5, this.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y + 2, 6, 0, Math.PI);
        ctx.stroke();
        
        ctx.restore();
        
        // Draw pickup range (debug)
        if (false) {
            ctx.strokeStyle = 'rgba(68, 255, 68, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.pickupRange * this.stats.pickupRange, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    takeDamage(amount) {
        if (this.invulnerable) return;
        
        this.health -= amount;
        this.damageFlash = 1;
        this.invulnerable = true;
        this.invulnerableTimer = this.invulnerableDuration;
        
        if (this.health <= 0) {
            this.health = 0;
        }
    }

    gainXP(amount) {
        this.xp += amount;
        
        // Check for level up
        if (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
        
        // Heal a bit on level up
        this.health = Math.min(this.maxHealth, this.health + 20);
        
        return true;
    }

    addWeapon(weaponClass) {
        const weapon = new weaponClass(this);
        this.weapons.push(weapon);
    }

    upgradeWeapon(weaponIndex) {
        if (weaponIndex < this.weapons.length) {
            this.weapons[weaponIndex].upgrade();
        }
    }

    hasWeapon(weaponClass) {
        return this.weapons.some(w => w instanceof weaponClass);
    }

    getWeapon(weaponClass) {
        return this.weapons.find(w => w instanceof weaponClass);
    }

    applyStat(statName, value) {
        switch(statName) {
            case 'moveSpeed':
                this.stats.moveSpeed += value;
                break;
            case 'maxHealth':
                this.stats.maxHealth += value;
                this.maxHealth = Math.floor(100 * this.stats.maxHealth);
                this.health = Math.min(this.maxHealth, this.health + 20);
                break;
            case 'pickupRange':
                this.stats.pickupRange += value;
                break;
            case 'damageMultiplier':
                this.stats.damageMultiplier += value;
                // Apply to all weapons
                this.weapons.forEach(weapon => {
                    weapon.damage = Math.floor(weapon.damage * 1.1);
                });
                break;
        }
    }

    reset() {
        this.health = 100;
        this.maxHealth = 100;
        this.xp = 0;
        this.xpToNextLevel = 10;
        this.level = 1;
        this.weapons = [];
        this.invulnerable = false;
        this.stats = {
            moveSpeed: 1.0,
            maxHealth: 1.0,
            pickupRange: 1.0,
            damageMultiplier: 1.0
        };
    }
}
