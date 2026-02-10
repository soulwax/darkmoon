// File: src/legacy/enemy.js
// Base Enemy Class

class Enemy {
    constructor(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = 12;
        this.speed = 50;
        this.health = 30;
        this.maxHealth = 30;
        this.damage = 10;
        this.dead = false;
        this.xpValue = 5;
        this.color = '#f44';
        this.hitFlash = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;
        
        // Set properties based on type
        this.initType();
    }

    initType() {
        switch(this.type) {
            case 'basic':
                this.speed = 50;
                this.health = 30;
                this.maxHealth = 30;
                this.damage = 10;
                this.xpValue = 5;
                this.color = '#f44';
                this.size = 12;
                break;
            case 'fast':
                this.speed = 100;
                this.health = 20;
                this.maxHealth = 20;
                this.damage = 8;
                this.xpValue = 8;
                this.color = '#4f4';
                this.size = 10;
                break;
            case 'tank':
                this.speed = 30;
                this.health = 100;
                this.maxHealth = 100;
                this.damage = 20;
                this.xpValue = 15;
                this.color = '#44f';
                this.size = 18;
                break;
            case 'elite':
                this.speed = 60;
                this.health = 150;
                this.maxHealth = 150;
                this.damage = 25;
                this.xpValue = 30;
                this.color = '#f4f';
                this.size = 20;
                break;
        }
    }

    update(deltaTime, player) {
        if (this.dead) return;
        
        // Apply knockback
        if (this.knockbackX !== 0 || this.knockbackY !== 0) {
            this.x += this.knockbackX * deltaTime;
            this.y += this.knockbackY * deltaTime;
            this.knockbackX *= 0.9;
            this.knockbackY *= 0.9;
            if (Math.abs(this.knockbackX) < 1) this.knockbackX = 0;
            if (Math.abs(this.knockbackY) < 1) this.knockbackY = 0;
        } else {
            // Move towards player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                this.x += (dx / distance) * this.speed * deltaTime;
                this.y += (dy / distance) * this.speed * deltaTime;
            }
        }
        
        // Reduce hit flash
        this.hitFlash = Math.max(0, this.hitFlash - deltaTime * 3);
    }

    draw(ctx) {
        if (this.dead) return;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size * 0.8, this.size * 0.8, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw enemy body
        ctx.save();
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.strokeStyle = this.getDarkerColor(this.color);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Draw eyes
        const eyeOffset = this.size * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x - eyeOffset, this.y - eyeOffset, this.size * 0.15, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffset, this.y - eyeOffset, this.size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw health bar
        if (this.health < this.maxHealth) {
            const barWidth = this.size * 2;
            const barHeight = 4;
            const barX = this.x - barWidth / 2;
            const barY = this.y - this.size - 10;
            
            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Health
            ctx.fillStyle = '#f44';
            const healthWidth = (this.health / this.maxHealth) * barWidth;
            ctx.fillRect(barX, barY, healthWidth, barHeight);
        }
    }

    getDarkerColor(color) {
        // Simple color darkening
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex[0], 16) - 3).toString(16);
        const g = Math.max(0, parseInt(hex[1], 16) - 3).toString(16);
        const b = Math.max(0, parseInt(hex[2], 16) - 3).toString(16);
        return '#' + r + g + b;
    }

    takeDamage(amount) {
        if (this.dead) return;
        
        this.health -= amount;
        this.hitFlash = 1;
        
        // Knockback
        const knockbackForce = 200;
        const angle = Math.random() * Math.PI * 2;
        this.knockbackX = Math.cos(angle) * knockbackForce;
        this.knockbackY = Math.sin(angle) * knockbackForce;
        
        if (this.health <= 0) {
            this.dead = true;
        }
    }

    checkCollision(player) {
        if (this.dead) return false;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < this.size + player.size;
    }
}

// Enemy Spawner
class EnemySpawner {
    constructor(canvas) {
        this.canvas = canvas;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2.0;
        this.enemiesPerSpawn = 1;
        this.difficultyTimer = 0;
        this.waveNumber = 1;
    }

    update(deltaTime, player) {
        this.spawnTimer += deltaTime;
        this.difficultyTimer += deltaTime;
        
        // Increase difficulty over time
        if (this.difficultyTimer >= 30) {
            this.difficultyTimer = 0;
            this.waveNumber++;
            this.spawnInterval = Math.max(0.5, this.spawnInterval - 0.1);
            this.enemiesPerSpawn = Math.min(5, this.enemiesPerSpawn + 1);
        }
        
        // Spawn enemies
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnWave(player);
        }
        
        // Update all enemies
        this.enemies.forEach(enemy => enemy.update(deltaTime, player));
        
        // Remove dead enemies
        this.enemies = this.enemies.filter(enemy => !enemy.dead);
    }

    spawnWave(player) {
        for (let i = 0; i < this.enemiesPerSpawn; i++) {
            const enemy = this.spawnEnemy(player);
            this.enemies.push(enemy);
        }
    }

    spawnEnemy(player) {
        // Spawn outside screen
        const margin = 100;
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch(side) {
            case 0: // Top
                x = Math.random() * this.canvas.width;
                y = -margin;
                break;
            case 1: // Right
                x = this.canvas.width + margin;
                y = Math.random() * this.canvas.height;
                break;
            case 2: // Bottom
                x = Math.random() * this.canvas.width;
                y = this.canvas.height + margin;
                break;
            case 3: // Left
                x = -margin;
                y = Math.random() * this.canvas.height;
                break;
        }
        
        // Determine enemy type based on wave
        let type = 'basic';
        const rand = Math.random();
        
        if (this.waveNumber >= 5) {
            if (rand < 0.1) type = 'elite';
            else if (rand < 0.3) type = 'tank';
            else if (rand < 0.6) type = 'fast';
        } else if (this.waveNumber >= 3) {
            if (rand < 0.2) type = 'tank';
            else if (rand < 0.5) type = 'fast';
        } else if (this.waveNumber >= 2) {
            if (rand < 0.3) type = 'fast';
        }
        
        return new Enemy(x, y, type);
    }

    draw(ctx) {
        this.enemies.forEach(enemy => enemy.draw(ctx));
    }

    getEnemies() {
        return this.enemies;
    }

    clear() {
        this.enemies = [];
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.waveNumber = 1;
        this.spawnInterval = 2.0;
        this.enemiesPerSpawn = 1;
    }
}
