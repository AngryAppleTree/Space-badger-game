import Phaser from 'phaser';
import './style.css';

class GameScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  bullets!: Phaser.Physics.Arcade.Group;
  alienBullets!: Phaser.Physics.Arcade.Group;
  aliens!: Phaser.Physics.Arcade.Group;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  shootKey!: Phaser.Input.Keyboard.Key;
  lastFired: number = 0;
  isGameOver: boolean = false;
  alienDirection: number = 1;
  alienMoveTimer: number = 0;
  lives: number = 100;
  level: number = 1;
  score: number = 0;
  alienShotCount: number = 0;
  rapidFireShots: number = 0;
  hBombCount: number = 0;
  bossHealth: number = 0;
  levelKillCount: number = 0;
  kamikazeAliens!: Phaser.Physics.Arcade.Group;
  livesText!: Phaser.GameObjects.Text;
  levelText!: Phaser.GameObjects.Text;
  scoreText!: Phaser.GameObjects.Text;
  iceText!: Phaser.GameObjects.Text;
  catchStarText!: Phaser.GameObjects.Text;
  pauseText!: Phaser.GameObjects.Text;
  hBombText!: Phaser.GameObjects.Text;
  isGamePaused: boolean = false;
  currentTrackIndex: number = 0;
  playlist: string[] = [
    '01 - Space Badger.mp3',
    '02 - The polecat.mp3',
    '06 - Metamorphosis.mp3',
    '07 - The light from the stars.mp3'
  ];

  constructor() {
    super('game');
  }

  preload() {
    this.load.image('player', 'space-badger.png');
    this.load.image('alien', 'polecat.png');
    this.load.image('bullet', 'star.png');

    // Load all playlist tracks
    this.playlist.forEach((track, index) => {
      this.load.audio(`track${index}`, `${track}`);
    });
  }

  init(data: { level?: number, lives?: number, score?: number, alienShotCount?: number, rapidFireShots?: number, hBombCount?: number, currentTrackIndex?: number }) {
    this.level = data.level || 1;
    this.lives = data.lives !== undefined ? data.lives : 100;
    this.score = data.score || 0;
    this.alienShotCount = data.alienShotCount || 0;
    this.rapidFireShots = data.rapidFireShots || 0;
    this.hBombCount = data.hBombCount || 0;
    this.currentTrackIndex = data.currentTrackIndex !== undefined ? data.currentTrackIndex : 0;
    this.levelKillCount = 0;
    this.alienDirection = 1;
    this.isGameOver = false;
    this.isGamePaused = false;
  }

  create() {
    // UI
    this.livesText = this.add.text(10, 10, `Lives: ${this.lives}`, { fontSize: '24px', color: '#fff' });
    this.scoreText = this.add.text(this.scale.width / 2, 10, `Score: ${this.score}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5, 0);
    this.levelText = this.add.text(this.scale.width - 10, 10, `Level: ${this.level}`, { fontSize: '24px', color: '#fff' }).setOrigin(1, 0);
    this.hBombText = this.add.text(10, 40, `H-Bombs: ${this.hBombCount}`, { fontSize: '24px', color: '#ff0000' });
    this.iceText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, "Galaxy West defence", {
      fontSize: '32px',
      color: '#00ffff',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setVisible(this.rapidFireShots > 0);

    this.catchStarText = this.add.text(this.scale.width / 2, this.scale.height / 2, "Catch the Blue Star!", {
      fontSize: '32px',
      color: '#00ffff',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setVisible(false);

    // Pause UI
    const pauseInstruction = this.add.text(this.scale.width / 2, this.scale.height - 100, 'Press P to pause', {
      fontSize: '20px',
      color: '#fff'
    }).setOrigin(0.5);
    this.time.delayedCall(3000, () => pauseInstruction.destroy());

    this.pauseText = this.add.text(this.scale.width / 2, this.scale.height / 3, 'PAUSED', {
      fontSize: '48px',
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // Player
    this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 50, 'player');
    this.player.setDisplaySize(100, 100); // Resize to fit game
    this.player.setCollideWorldBounds(true);

    // Bullets
    this.bullets = this.physics.add.group({
      runChildUpdate: true
    });

    // Alien Bullets
    this.alienBullets = this.physics.add.group({
      runChildUpdate: true
    });

    // Aliens
    this.aliens = this.physics.add.group();
    this.kamikazeAliens = this.physics.add.group();
    this.createAlienGrid();

    // Music Playlist - only start if not already playing
    if (!this.sound.getAllPlaying().length) {
      this.playNextTrack();
    }

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.input.keyboard.on('keydown-P', () => {
        this.togglePause();
      });
      this.input.keyboard.on('keydown-H', () => {
        this.useHBomb();
      });
    }

    // Collisions
    this.physics.add.collider(this.bullets, this.aliens, (bullet, alien) => {
      bullet.destroy();

      if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) {
        this.bossHealth--;
        (alien as Phaser.Physics.Arcade.Sprite).setTint(0xff0000);
        this.time.delayedCall(100, () => (alien as Phaser.Physics.Arcade.Sprite).clearTint());

        if (this.bossHealth <= 0) {
          alien.destroy();
          let bonus = 100;
          if (this.level === 20) bonus = 200;
          if (this.level === 30) bonus = 500;
          if (this.level === 40) bonus = 1000;
          this.score += bonus;
          this.scoreText.setText(`Score: ${this.score}`);
          this.completeLevel();
        }
      } else {
        alien.destroy();
        this.score += 1;
        this.scoreText.setText(`Score: ${this.score}`);

        this.levelKillCount++;
        if (this.level % 5 === 3 && this.levelKillCount === 8) {
          this.activateKamikazeAlien();
        }

        if (this.aliens.countActive() === 0 && this.kamikazeAliens.countActive() === 0) {
          this.completeLevel();
        }
      }
    });

    this.physics.add.collider(this.bullets, this.kamikazeAliens, (bullet, _alien) => {
      bullet.destroy();
      // Invincible
    });

    this.physics.add.overlap(this.player, this.aliens, () => {
      this.loseLife();
    });

    this.physics.add.overlap(this.player, this.kamikazeAliens, () => {
      this.loseLife();
    });

    this.physics.add.overlap(this.player, this.alienBullets, (_player, bullet: any) => {
      if (bullet.getData('isPowerUp')) {
        this.activateRapidFire();
      } else {
        this.loseLife();
      }
      bullet.destroy();
    });

    // Alien Shooting Timer
    let shootDelay = 1000;
    if (this.level >= 20) {
      shootDelay = 333; // 3 stars per second
    } else if (this.level >= 10) {
      shootDelay = 500; // 2 stars per second
    }

    this.time.addEvent({
      delay: shootDelay,
      callback: this.alienShoot,
      callbackScope: this,
      loop: true
    });
  }

  update(_time: number, _delta: number) {
    if (this.isGameOver || this.isGamePaused) return;

    // Keyboard movement
    if (this.cursors) {
      if (this.cursors.left.isDown) {
        this.player.x -= 5;
      } else if (this.cursors.right.isDown) {
        this.player.x += 5;
      }

      // Vertical movement for Boss Levels
      if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) {
        if (this.cursors.up.isDown) {
          this.player.y -= 5;
        } else if (this.cursors.down.isDown) {
          this.player.y += 5;
        }
      }
    }

    // Clamp player
    this.player.x = Phaser.Math.Clamp(this.player.x, 25, this.scale.width - 25);
    if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) {
      this.player.y = Phaser.Math.Clamp(this.player.y, 25, this.scale.height - 25);
    }

    // Shooting (Keyboard or Auto)
    if ((this.shootKey && this.shootKey.isDown) || this.rapidFireShots > 0) {
      this.shoot();
    }

    // Alien movement logic
    this.moveAliens();



    // Cleanup bullets
    this.bullets.children.entries.forEach((b: any) => {
      if (b.y < 0) {
        b.destroy();
      }
    });

    this.alienBullets.children.entries.forEach((b: any) => {
      if (b.y > this.scale.height) {
        if (b.getData('isPowerUp')) {
          this.catchStarText.setVisible(false);
        }
        b.destroy();
      }
    });
  }

  moveAliens() {
    if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) return;

    let speed = 100;
    if (this.level <= 12) {
      speed = 100 * Math.pow(1.2, this.level - 1);
    } else if (this.level <= 20) {
      speed = 100 * Math.pow(1.2, 11) * Math.pow(1.05, this.level - 12);
    } else {
      // Cap speed at level 20
      speed = 100 * Math.pow(1.2, 11) * Math.pow(1.05, 8);
    }
    this.aliens.setVelocityX(speed * this.alienDirection);

    let changeDir = false;
    this.aliens.children.entries.forEach((alien: any) => {
      // Check right edge
      if (this.alienDirection === 1 && alien.x + alien.displayWidth / 2 >= this.scale.width) {
        changeDir = true;
      }
      // Check left edge
      else if (this.alienDirection === -1 && alien.x - alien.displayWidth / 2 <= 0) {
        changeDir = true;
      }

      if (alien.y >= this.scale.height - 50) {
        this.gameOver();
      }
    });

    if (changeDir) {
      this.alienDirection *= -1;
      this.aliens.setVelocityX(0);
      // Move down
      this.aliens.children.entries.forEach((alien: any) => {
        alien.y += 20;
      });
    }
  }

  shoot() {
    const time = this.time.now;
    const fireRate = this.rapidFireShots > 0 ? 100 : 300; // 10 shots/sec = 100ms

    if (time > this.lastFired && !this.isGameOver) {
      const bullet = this.physics.add.sprite(this.player.x, this.player.y - 50, 'bullet');
      bullet.setDisplaySize(30, 30);
      this.bullets.add(bullet);
      bullet.setVelocityY(-400);

      if (this.rapidFireShots > 0) {
        this.rapidFireShots--;
        if (this.rapidFireShots <= 0) {
          this.iceText.setVisible(false);
        }
      }

      this.lastFired = time + fireRate;
    }
  }

  createAlienGrid() {
    if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) {
      this.createBoss();
      return;
    }

    const rows = 5;
    const cols = 5;
    const padding = 10;

    // Responsive sizing: ensure 5 columns fit on screen
    const screenMargin = 10;
    const availableWidth = this.scale.width - (screenMargin * 2);
    const maxW = (availableWidth - (cols - 1) * padding) / cols;

    const alienWidth = Math.min(90, maxW);
    const alienHeight = alienWidth / 1.5; // Maintain aspect ratio

    // Centering
    const totalBlockWidth = cols * alienWidth + (cols - 1) * padding;
    const startX = (this.scale.width - totalBlockWidth) / 2 + (alienWidth / 2);
    const startY = 50 + (alienHeight / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (alienWidth + padding);
        const y = startY + r * (alienHeight + padding);
        const alien = this.physics.add.sprite(x, y, 'alien');
        alien.setDisplaySize(alienWidth, alienHeight);
        this.aliens.add(alien);
      }
    }
  }



  activateKamikazeAlien() {
    const activeAliens = this.aliens.getChildren().filter((a: any) => a.active);
    if (activeAliens.length === 0) return;

    const alien = Phaser.Utils.Array.GetRandom(activeAliens) as Phaser.Physics.Arcade.Sprite;
    this.aliens.remove(alien);
    this.kamikazeAliens.add(alien);

    alien.setTint(0xffd700); // Gold

    // Shoot timer
    const shootEvent = this.time.addEvent({
      delay: 100, // 10 shots per second
      callback: () => {
        if (alien.active) {
          this.kamikazeShoot(alien);
          this.physics.moveToObject(alien, this.player, 250);
        }
      },
      loop: true
    });

    // Death timer
    this.time.delayedCall(3000, () => {
      if (alien.active) {
        alien.destroy();
        shootEvent.remove();
        if (this.aliens.countActive() === 0 && this.kamikazeAliens.countActive() === 0) {
          this.completeLevel();
        }
      }
    });
  }

  kamikazeShoot(alien: Phaser.Physics.Arcade.Sprite) {
    const bullet = this.physics.add.sprite(alien.x, alien.y, 'bullet');
    bullet.setTint(0xffd700);
    bullet.setDisplaySize(20, 20);
    this.alienBullets.add(bullet);
    this.physics.moveToObject(bullet, this.player, 400);
  }

  createBoss() {
    // Only set health if it's a fresh level start (not a retry after death)
    if (this.bossHealth <= 0) {
      if (this.level === 40) this.bossHealth = 200;
      else if (this.level === 30) this.bossHealth = 100;
      else this.bossHealth = this.level === 20 ? 50 : 25;
    }

    const boss = this.physics.add.sprite(this.scale.width / 2, 150, 'alien');

    let size = 200;
    if (this.level === 20) size = 150;
    if (this.level === 30 || this.level === 40) size = 100;
    boss.setDisplaySize(size, size);

    boss.setCollideWorldBounds(true);
    boss.setBounce(1);
    boss.setVelocity(200, 200);
    this.aliens.add(boss);

    if (this.level === 30) {
      // Level 30 Boss Logic: Dash Attack
      this.time.addEvent({
        delay: 7000, // Every 7 seconds
        callback: () => {
          if (!boss.active) return;

          // Pause
          boss.setVelocity(0, 0);
          boss.setTint(0xff00ff); // Purple warning tint

          this.time.delayedCall(1000, () => {
            if (!boss.active) return;
            boss.clearTint();
            // Dash towards player
            this.physics.moveToObject(boss, this.player, 800); // Fast dash

            // Resume random movement after dash
            this.time.delayedCall(1000, () => {
              if (boss.active) {
                const targetX = Phaser.Math.Between(boss.displayWidth / 2, this.scale.width - boss.displayWidth / 2);
                const targetY = Phaser.Math.Between(boss.displayHeight / 2, this.scale.height - boss.displayHeight / 2);
                this.physics.moveTo(boss, targetX, targetY, 300);
              }
            });
          });
        },
        loop: true
      });
    } else if (this.level === 40) {
      // Level 40 Boss Logic: Teleport
      this.time.addEvent({
        delay: 5000, // Every 5 seconds
        callback: () => {
          if (!boss.active) return;

          // Warn
          boss.setTint(0x00ff00); // Green warning
          this.tweens.add({
            targets: boss,
            alpha: 0.2,
            duration: 500,
            yoyo: true,
            onYoyo: () => {
              if (!boss.active) return;
              // Teleport next to player
              const offsetX = Phaser.Math.RND.pick([-150, 150]);
              let newX = this.player.x + offsetX;
              newX = Phaser.Math.Clamp(newX, boss.displayWidth / 2, this.scale.width - boss.displayWidth / 2);
              boss.x = newX;
              boss.y = Math.max(boss.displayHeight / 2, this.player.y);
            },
            onComplete: () => {
              if (boss.active) boss.clearTint();
            }
          });
        },
        loop: true
      });
    }

    // Random movement (for all bosses, including 30/40 in between attacks)
    // For level 30, we handle it separately inside the dash logic to avoid conflict
    if (this.level !== 30) {
      this.time.addEvent({
        delay: 1000,
        callback: () => {
          if (boss.active) {
            const targetX = Phaser.Math.Between(boss.displayWidth / 2, this.scale.width - boss.displayWidth / 2);
            const targetY = Phaser.Math.Between(boss.displayHeight / 2, this.scale.height - boss.displayHeight / 2);
            this.physics.moveTo(boss, targetX, targetY, 300);
          }
        },
        loop: true
      });
    }
  }

  alienShoot() {
    if (this.isGameOver) return;
    const activeAliens = this.aliens.getChildren().filter((alien: any) => alien.active);
    if (activeAliens.length === 0) return;

    this.alienShotCount++;
    const randomAlien = Phaser.Utils.Array.GetRandom(activeAliens) as Phaser.Physics.Arcade.Sprite;
    const bullet = this.physics.add.sprite(randomAlien.x, randomAlien.y, 'bullet');

    if (this.alienShotCount % 25 === 0) {
      bullet.setTint(0x00ffff); // Blue star
      bullet.setData('isPowerUp', true);
      bullet.setDisplaySize(40, 40);
      this.catchStarText.setVisible(true);
    } else {
      bullet.setTint(0xff0000); // Red star
      bullet.setData('isPowerUp', false);
      bullet.setDisplaySize(30, 30);
    }

    this.alienBullets.add(bullet);
    this.physics.moveToObject(bullet, this.player, 200);
  }

  activateRapidFire() {
    this.rapidFireShots = 100;
    this.iceText.setVisible(true);
    this.catchStarText.setVisible(false);
  }

  useHBomb() {
    if (this.hBombCount <= 0 || this.isGameOver || this.isGamePaused) return;
    if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) return; // Cannot use in boss levels

    this.hBombCount--;
    this.hBombText.setText(`H-Bombs: ${this.hBombCount}`);

    // Visuals: Boom text
    const boomText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'BOOM', {
      fontSize: '120px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: boomText,
      scale: { from: 0.5, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 1000,
      onComplete: () => boomText.destroy()
    });

    // Visuals: Sonic Ring Explosion
    for (let i = 0; i < 50; i++) {
      const star = this.physics.add.sprite(this.scale.width / 2, this.scale.height / 2, 'bullet');
      star.setTint(0xffff00);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(200, 600);
      star.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      this.tweens.add({
        targets: star,
        alpha: 0,
        duration: 3500,
        onComplete: () => star.destroy()
      });
    }

    // Kill all aliens
    this.aliens.clear(true, true);
    this.kamikazeAliens.clear(true, true);
    this.alienBullets.clear(true, true);

    // Complete Level
    this.time.delayedCall(1000, () => {
      this.completeLevel();
    });
  }

  loseLife() {
    if (this.lives > 0) {
      this.lives--;
      this.livesText.setText(`Lives: ${this.lives}`);

      // Clear bullets
      this.alienBullets.clear(true, true);
      this.bullets.clear(true, true);
      // Do not clear kamikaze aliens so they persist through death until timer expires

      if (this.lives === 0) {
        this.gameOver();
      } else {
        // Shake screen
        this.cameras.main.shake(200, 0.01);

        // Reset Player
        this.player.setPosition(this.scale.width / 2, this.scale.height - 50);

        // Reset Aliens (Keep progress)
        if (this.level === 10 || this.level === 20 || this.level === 30 || this.level === 40) {
          const boss = this.aliens.getFirstAlive();
          if (boss) {
            (boss as Phaser.Physics.Arcade.Sprite).setPosition(this.scale.width / 2, 150);
            // Randomize direction again to prevent getting stuck
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = 300;
            (boss as Phaser.Physics.Arcade.Sprite).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          }
        } else {
          // Recalculate startY
          const cols = 5;
          const padding = 10;
          const screenMargin = 10;
          const availableWidth = this.scale.width - (screenMargin * 2);
          const maxW = (availableWidth - (cols - 1) * padding) / cols;
          const alienWidth = Math.min(90, maxW);
          const alienHeight = alienWidth / 1.5;
          const startY = 50 + (alienHeight / 2);

          // Find current top-most alien
          let minY = Infinity;
          this.aliens.children.entries.forEach((alien: any) => {
            if (alien.active && alien.y < minY) minY = alien.y;
          });

          if (minY !== Infinity) {
            const diff = minY - startY;
            this.aliens.children.entries.forEach((alien: any) => {
              if (alien.active) alien.y -= diff;
            });
          }
          this.alienDirection = 1;
        }
      }
    }
  }

  gameOver() {
    this.isGameOver = true;
    this.physics.pause();

    // Stop music on game over
    this.sound.stopAll();

    this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER\nTap to Restart', {
      fontSize: '32px',
      color: '#fff',
      align: 'center'
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.scene.restart();
      this.isGameOver = false;
      this.alienDirection = 1;
    });
  }

  resetGame() {
    this.scene.restart({ level: 1, lives: 100, score: 0, alienShotCount: 0, rapidFireShots: 0, hBombCount: 0 });
  }

  completeLevel() {
    this.physics.pause();
    this.alienBullets.clear(true, true);
    this.kamikazeAliens.clear(true, true);

    // Bonus points
    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);

    // H-Bomb Acquisition
    let nextHBombs = this.hBombCount;
    let bonusText = '\n+10 Bonus Points';
    if ((this.level + 1) % 5 === 0) {
      nextHBombs++;
      bonusText += '\nH-BOMB ACQUIRED!';
    }

    this.add.text(this.scale.width / 2, this.scale.height / 2, `Level ${this.level} Complete!${bonusText}`, {
      fontSize: '48px',
      color: '#00ff00',
      align: 'center'
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.scene.restart({
        level: this.level + 1,
        lives: this.lives,
        score: this.score,
        alienShotCount: this.alienShotCount,
        rapidFireShots: this.rapidFireShots,
        hBombCount: nextHBombs,
        currentTrackIndex: this.currentTrackIndex
      });
    });
  }

  togglePause() {
    if (this.isGameOver) return;

    this.isGamePaused = !this.isGamePaused;

    if (this.isGamePaused) {
      this.physics.pause();
      this.time.paused = true;
      this.pauseText.setVisible(true);
    } else {
      this.physics.resume();
      this.time.paused = false;
      this.pauseText.setVisible(false);
    }
  }

  playNextTrack() {
    const trackKey = `track${this.currentTrackIndex}`;

    // Don't stop music if already playing (for level transitions)
    const currentlyPlaying = this.sound.getAllPlaying();
    if (currentlyPlaying.length > 0) {
      return; // Music is already playing, don't restart
    }

    // Play the current track
    const music = this.sound.add(trackKey, { volume: 0.5 });
    music.play();

    // When track ends, play next track
    music.once('complete', () => {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
      this.playNextTrack();
    });
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0, x: 0 },
      debug: false
    }
  },
  scene: GameScene,
  backgroundColor: '#000033',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
