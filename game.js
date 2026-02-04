// File: game.js

// Main Game Class
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = 1280;
        this.canvas.height = 720;
        
        // Game state
        this.running = false;
        this.paused = false;
        this.gameOver = false;
        this.gameTime = 0;
        this.killCount = 0;
        
        // Game objects
        this.player = null;
        this.enemySpawner = null;
        this.particleSystem = null;
        this.xpGems = [];
        this.ui = null;
        
        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Camera
        this.cameraX = 0;
        this.cameraY = 0;
        
        this.init();
    }

    init() {
        // Initialize game objects
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.enemySpawner = new EnemySpawner(this.canvas);
        this.particleSystem = new ParticleSystem();
        this.ui = new UIManager(this);
        
        // Give player starting weapon
        this.player.addWeapon(MagicOrbs);
        
        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();
    }

    start() {
        this.running = true;
        this.paused = false;
        this.gameOver = false;
        this.gameTime = 0;
        this.killCount = 0;
    }

    restart() {
        // Reset everything
        this.player.reset();
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height / 2;
        this.player.addWeapon(MagicOrbs);
        
        this.enemySpawner.clear();
        this.particleSystem.clear();
        this.xpGems = [];
        
        this.gameTime = 0;
        this.killCount = 0;
        this.gameOver = false;
        this.paused = false;
        this.running = true;
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }

    gameLoop() {
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        if (this.running && !this.paused && !this.gameOver) {
            this.update(this.deltaTime);
        }
        
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        this.gameTime += deltaTime;
        
        // Update player
        this.player.update(deltaTime, this.canvas.width, this.canvas.height);
        
        // Update enemies
        this.enemySpawner.update(deltaTime, this.player);
        const enemies = this.enemySpawner.getEnemies();
        
        // Update weapons with enemy list
        this.player.weapons.forEach(weapon => {
            weapon.update(deltaTime, enemies);
        });
        
        // Check enemy collisions with player
        enemies.forEach(enemy => {
            if (enemy.checkCollision(this.player)) {
                this.player.takeDamage(enemy.damage * deltaTime);
            }
        });
        
        // Collect dead enemies and spawn XP
        enemies.forEach(enemy => {
            if (enemy.dead && enemy.health <= 0) {
                this.killCount++;
                this.spawnXPGem(enemy.x, enemy.y, enemy.xpValue);
                this.particleSystem.createExplosion(enemy.x, enemy.y, enemy.color, 15);
            }
        });
        
        // Update XP gems
        const pickupRange = this.player.pickupRange * this.player.stats.pickupRange;
        for (let i = this.xpGems.length - 1; i >= 0; i--) {
            this.xpGems[i].update(deltaTime, this.player, pickupRange);
            
            if (this.xpGems[i].collected) {
                this.player.gainXP(this.xpGems[i].value);
                this.particleSystem.createXPParticles(this.xpGems[i].x, this.xpGems[i].y);
                this.xpGems.splice(i, 1);
                
                // Check for level up
                if (this.player.xp >= this.player.xpToNextLevel) {
                    this.ui.showLevelUpScreen(this.player);
                }
            }
        }
        
        // Update particles
        this.particleSystem.update(deltaTime);
        
        // Update UI
        this.ui.updateHUD(this.player, this.gameTime, this.killCount);
        
        // Check game over
        if (this.player.health <= 0) {
            this.endGame();
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid background
        this.drawGrid();
        
        if (!this.running) {
            return;
        }
        
        // Draw XP gems
        this.xpGems.forEach(gem => gem.draw(this.ctx));
        
        // Draw enemies
        this.enemySpawner.draw(this.ctx);
        
        // Draw player
        this.player.draw(this.ctx);
        
        // Draw weapons
        this.player.weapons.forEach(weapon => weapon.draw(this.ctx));
        
        // Draw particles
        this.particleSystem.draw(this.ctx);
    }

    drawGrid() {
        const gridSize = 40;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    spawnXPGem(x, y, value) {
        this.xpGems.push(new XPGem(x, y, value));
    }

    endGame() {
        this.gameOver = true;
        this.running = false;
        this.ui.showGameOverScreen(this.gameTime, this.killCount, this.player.level);
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    const game = new Game();
});
