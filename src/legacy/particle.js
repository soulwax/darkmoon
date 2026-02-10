// File: src/legacy/particle.js
// Particle System for visual effects

class Particle {
    constructor(x, y, color, size, velocityX, velocityY, lifetime) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.alpha = 1;
    }

    update(deltaTime) {
        this.x += this.velocityX * deltaTime;
        this.y += this.velocityY * deltaTime;
        this.lifetime -= deltaTime;
        this.alpha = this.lifetime / this.maxLifetime;
        
        // Apply gravity for some particles
        this.velocityY += 200 * deltaTime;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.lifetime <= 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 100 + Math.random() * 100;
            const velocityX = Math.cos(angle) * speed;
            const velocityY = Math.sin(angle) * speed;
            const size = 2 + Math.random() * 3;
            const lifetime = 0.5 + Math.random() * 0.5;
            
            this.particles.push(new Particle(x, y, color, size, velocityX, velocityY, lifetime));
        }
    }

    createXPParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 50;
            const velocityX = Math.cos(angle) * speed;
            const velocityY = Math.sin(angle) * speed;
            const size = 3 + Math.random() * 2;
            const lifetime = 0.8 + Math.random() * 0.4;
            
            this.particles.push(new Particle(x, y, '#4f4', size, velocityX, velocityY, lifetime));
        }
    }

    createDamageNumbers(x, y, damage) {
        // Create floating damage number effect
        const particle = new DamageNumber(x, y, damage);
        this.particles.push(particle);
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(deltaTime);
            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.particles.forEach(particle => particle.draw(ctx));
    }

    clear() {
        this.particles = [];
    }
}

// Special particle for damage numbers
class DamageNumber extends Particle {
    constructor(x, y, damage) {
        super(x, y, '#fff', 12, 0, -100, 1.0);
        this.damage = Math.floor(damage);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ff4444';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.damage.toString(), this.x, this.y);
        ctx.fillText(this.damage.toString(), this.x, this.y);
        ctx.restore();
    }
}

// XP Gem that drops from enemies
class XPGem {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = 6 + value * 2;
        this.collected = false;
        this.velocityX = (Math.random() - 0.5) * 100;
        this.velocityY = (Math.random() - 0.5) * 100;
        this.magnetSpeed = 0;
        this.lifetime = 0;
    }

    update(deltaTime, player, pickupRange) {
        this.lifetime += deltaTime;
        
        // Initial scatter movement
        if (this.lifetime < 0.3) {
            this.x += this.velocityX * deltaTime;
            this.y += this.velocityY * deltaTime;
            this.velocityX *= 0.95;
            this.velocityY *= 0.95;
        } else {
            // Check if in pickup range
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < pickupRange) {
                // Move towards player
                const angle = Math.atan2(dy, dx);
                this.magnetSpeed = Math.min(this.magnetSpeed + 500 * deltaTime, 400);
                this.x += Math.cos(angle) * this.magnetSpeed * deltaTime;
                this.y += Math.sin(angle) * this.magnetSpeed * deltaTime;
                
                // Check if collected
                if (distance < 20) {
                    this.collected = true;
                }
            }
        }
    }

    draw(ctx) {
        // Draw glow
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#4f4';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Draw gem
        ctx.fillStyle = '#4f4';
        ctx.strokeStyle = '#2a2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw shine
        ctx.fillStyle = '#afa';
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}
