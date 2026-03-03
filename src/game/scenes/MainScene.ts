// src/game/scenes/MainScene.ts
import Phaser from 'phaser';

export enum GameState {
  IDLE,
  PLAYING,
  GAME_OVER,
  PAUSED
}

interface Difficulty {
  speed: number;
  gap: number;
  level: string;
  theme: string;
  spawnDelay: number;
}

const DIFFICULTY_SETTINGS: Record<number, Difficulty> = {
  0: { speed: 200, gap: 300, level: "START", theme: "Neon", spawnDelay: 2000 },
  5: { speed: 240, gap: 260, level: "1-3", theme: "Neon", spawnDelay: 1800 },
  15: { speed: 280, gap: 220, level: "4-6", theme: "Cracked", spawnDelay: 1600 },
  30: { speed: 320, gap: 200, level: "7-9", theme: "Chained", spawnDelay: 1400 },
  50: { speed: 400, gap: 180, level: "10+", theme: "Chaos", spawnDelay: 1200 }
};

export class MainScene extends Phaser.Scene {
  private mpig!: Phaser.Physics.Arcade.Sprite;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private score: number = 0;
  private distance: number = 0;
  private totalOinks: number = 0;
  private state: GameState = GameState.IDLE;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private background!: Phaser.GameObjects.TileSprite;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private coinParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private floatingShapes!: Phaser.GameObjects.Group;
  private currentDifficulty: Difficulty = DIFFICULTY_SETTINGS[0];

  // Settings
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private bgMusic?: Phaser.Sound.BaseSound;
  private audioCtx?: AudioContext;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.load.image('mpig', '/assets/mpig.png');
    this.load.image('background', '/assets/background.png');
    this.load.image('rekt_zone', '/assets/rekt_zone.svg');
    this.load.image('safe_gap', '/assets/safe_gap.svg');
    this.load.image('sol_shape', '/assets/sol_particle.svg');
    this.load.image('coin', '/assets/coin.svg');

    // Load User Provided Audio
    this.load.audio('bgm', '/assets/audio/bgm.mp3');
    this.load.audio('sfx-jump', '/assets/audio/sfx-jump.mp3');
    this.load.audio('sfx-coin', '/assets/audio/sfx-coin.mp3');
  }

  create() {
    const { width, height } = this.scale;
    this.state = GameState.IDLE;

    // 1. Background
    this.background = this.add.tileSprite(width / 2, height / 2, width, height, 'background');
    this.background.setDisplaySize(width, height).setAlpha(0.8);

    this.createFloatingShapes();

    // 2. Character Trail
    this.particles = this.add.particles(0, 0, 'sol_shape', {
      scale: { start: 0.1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      rotate: { min: 0, max: 360 },
      speed: 100,
      lifespan: 400,
      blendMode: 'ADD',
      frequency: 50
    });

    this.smokeParticles = this.add.particles(0, 0, 'sol_shape', {
      scale: { start: 0.1, end: 0.4 },
      alpha: { start: 0.2, end: 0 },
      speed: 20,
      lifespan: 800,
      tint: 0x666666,
      frequency: 100
    });

    // 3. Coin Particles
    this.coinParticles = this.add.particles(0, 0, 'coin', {
      scale: { start: 0.1, end: 0.4 },
      alpha: { start: 1, end: 0 },
      speed: { min: 100, max: 200 },
      lifespan: 800,
      gravityY: 200,
      blendMode: 'ADD',
      emitting: false
    });

    // 4. MPIG
    this.mpig = this.physics.add.sprite(width * 0.25, height / 2, 'mpig').setScale(0.1);
    this.mpig.setCollideWorldBounds(true);
    this.mpig.setBodySize(this.mpig.width * 0.55, this.mpig.height * 0.55);
    (this.mpig.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.particles.startFollow(this.mpig);

    // 5. Groups
    this.obstacles = this.physics.add.group();
    this.coins = this.physics.add.group();

    // 6. Collision
    this.physics.add.collider(this.mpig, this.obstacles, this.handleGameOver, undefined, this);
    this.physics.add.overlap(this.mpig, this.coins, this.collectCoin, undefined, this);

    // 7. Input
    this.input.on('pointerdown', () => this.handleAction());
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.handleAction());
      this.input.keyboard.on('keydown-P', () => this.togglePause());
    }

    // Clean up old listeners to prevent accumulation on restart
    this.game.events.off('toggle-sound');
    this.game.events.off('toggle-music');
    this.game.events.off('request-pause');
    this.game.events.off('request-restart');

    // Event Listeners from React
    this.game.events.on('toggle-sound', (val: boolean) => { this.soundEnabled = val; });
    this.game.events.on('toggle-music', (val: boolean) => {
      this.musicEnabled = val;
      if (this.bgMusic) {
        if (val) this.bgMusic.resume();
        else this.bgMusic.pause();
      }
    });

    // Use a flag or check state to prevent multiple restart triggers
    this.game.events.on('request-pause', () => {
      if (this.scene.isActive()) this.togglePause();
    });

    this.game.events.on('request-restart', () => {
      if (this.scene.isActive()) {
        this.state = GameState.IDLE;
        this.scene.restart();
      }
    });

    this.game.events.emit('game-init');
  }

  private createFloatingShapes() {
    this.floatingShapes = this.add.group();
    for (let i = 0; i < 5; i++) {
      const shape = this.add.image(
        Phaser.Math.Between(0, 450),
        Phaser.Math.Between(0, 800),
        'sol_shape'
      ).setAlpha(0.1).setScale(Phaser.Math.FloatBetween(0.5, 1.5));

      this.tweens.add({
        targets: shape,
        y: '+=50',
        angle: 360,
        duration: Phaser.Math.Between(5000, 10000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.floatingShapes.add(shape);
    }
  }

  private handleAction() {
    // Mobile Audio Warmup
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.state === GameState.IDLE) {
      this.startGame();
    } else if (this.state === GameState.PLAYING) {
      this.flap();
    }
  }

  private togglePause() {
    if (this.state === GameState.GAME_OVER || this.state === GameState.IDLE) return;

    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.physics.pause();
      if (this.spawnTimer) this.spawnTimer.paused = true;
      this.game.events.emit('ui-pause-state', true);
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.physics.resume();
      if (this.spawnTimer) this.spawnTimer.paused = false;
      this.game.events.emit('ui-pause-state', false);
    }
  }

  private startGame() {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.distance = 0;
    this.totalOinks = 0;
    this.currentDifficulty = DIFFICULTY_SETTINGS[0];
    (this.mpig.body as Phaser.Physics.Arcade.Body).allowGravity = true;
    (this.mpig.body as Phaser.Physics.Arcade.Body).setGravityY(1300);

    // Start Background Music if loaded and enabled
    if (this.musicEnabled && this.cache.audio.exists('bgm')) {
      if (!this.bgMusic) this.bgMusic = this.sound.add('bgm', { loop: true, volume: 0.5 });
      this.bgMusic.play();
    }

    this.game.events.emit('game-start');
    this.resetSpawnTimer();
    this.flap();
  }

  private resetSpawnTimer() {
    if (this.spawnTimer) this.spawnTimer.remove();
    this.spawnTimer = this.time.addEvent({
      delay: this.currentDifficulty.spawnDelay,
      callback: this.spawnObstacles,
      callbackScope: this,
      loop: true
    });
  }

  private flap() {
    if (this.state !== GameState.PLAYING) return;
    this.mpig.setVelocityY(-450);
    this.tweens.add({
      targets: this.mpig,
      angle: -15,
      duration: 150,
      ease: 'Power1'
    });
    if (this.soundEnabled) {
      if (this.cache.audio.exists('sfx-jump')) {
        this.sound.play('sfx-jump', { volume: 0.4 });
      } else {
        this.playSound(400, 0.05, 'triangle');
      }
    }
  }

  private spawnObstacles() {
    if (this.state !== GameState.PLAYING) return;

    const { width, height } = this.scale;
    const { speed, gap, theme } = this.currentDifficulty;

    let pattern = Phaser.Math.Between(0, 2);
    if (this.score < 5) pattern = Phaser.Math.Between(0, 1);

    const minClearance = 150;

    if (pattern === 0) {
      const h = Phaser.Math.Between(minClearance, height - 350);
      const obs = this.obstacles.create(width + 100, height - h, 'rekt_zone').setOrigin(0.5, 0);
      this.applyTheme(obs, theme);
      this.createScoreZone(width + 100, speed);
      this.spawnCoinRandomly(width + 100, height - h - 100, speed);
    }
    else if (pattern === 1) {
      const h = Phaser.Math.Between(minClearance, height - 350);
      const obs = this.obstacles.create(width + 100, h, 'rekt_zone').setOrigin(0.5, 1);
      obs.setFlipY(true);
      this.applyTheme(obs, theme);
      this.createScoreZone(width + 100, speed);
      this.spawnCoinRandomly(width + 100, h + 100, speed);
    }
    else {
      const topH = Phaser.Math.Between(150, height - gap - 150);
      const top = this.obstacles.create(width + 100, topH, 'rekt_zone').setOrigin(0.5, 1);
      top.setFlipY(true);
      const bottom = this.obstacles.create(width + 100, topH + gap, 'rekt_zone').setOrigin(0.5, 0);

      this.applyTheme(top, theme);
      this.applyTheme(bottom, theme);

      const safeGap = this.add.image(width + 100, topH + gap / 2, 'safe_gap').setDisplaySize(60, gap).setAlpha(0.4);
      this.createScoreZone(width + 100, speed, safeGap);
      this.spawnCoinRandomly(width + 100, topH + gap / 2, speed);
    }

    this.obstacles.getChildren().forEach((child: any) => {
      (child.body as Phaser.Physics.Arcade.Body).velocity.x = -speed;
    });
  }

  private spawnCoinRandomly(x: number, y: number, speed: number) {
    if (Phaser.Math.Between(0, 10) > 4) {
      const coin = this.coins.create(x, y, 'coin').setScale(0.8);
      (coin.body as Phaser.Physics.Arcade.Body).velocity.x = -speed;

      this.tweens.add({
        targets: coin,
        scaleX: 0.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Linear'
      });
    }
  }

  private collectCoin(mpig: any, coin: any) {
    if (coin.data?.get('collected')) return;
    coin.setData('collected', true);

    // Disable physics immediately to prevent double-hits which can trigger multiple sounds
    (coin.body as Phaser.Physics.Arcade.Body).enable = false;

    this.tweens.add({
      targets: coin,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => coin.destroy()
    });

    this.totalOinks += 10;
    this.game.events.emit('oinks-update', this.totalOinks);
    this.coinParticles.emitParticleAt(mpig.x, mpig.y, 8);

    // Floating +10 Text
    const floatText = this.add.text(coin.x, coin.y, '+10', {
      fontFamily: 'Orbitron',
      fontSize: '24px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100).setFontStyle('900 italic');

    this.tweens.add({
      targets: floatText,
      y: floatText.y - 80,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.out',
      onComplete: () => floatText.destroy()
    });

    this.triggerHaptics(20);
    this.playPickupSound();

    this.tweens.add({
      targets: mpig,
      scale: 0.12,
      duration: 100,
      yoyo: true
    });
  }

  private playPickupSound() {
    if (!this.soundEnabled) return;
    try {
      if (this.cache.audio.exists('sfx-coin')) {
        this.sound.play('sfx-coin', { volume: 0.6 });
      } else {
        this.playSound(800, 0.1, 'sine', 1200);
      }
    } catch (e) { }
  }

  private playSound(freq: number, duration: number, type: OscillatorType = 'sine', endFreq?: number) {
    if (!this.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio synthesis failed", e);
    }
  }

  private triggerHaptics(duration: number | number[] = 20) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(duration);
      }
    } catch (e) {
      // Silence haptic errors on unsupported hardware
    }
  }

  private createScoreZone(x: number, speed: number, visual?: Phaser.GameObjects.Image) {
    const zone = this.add.zone(x, 0, 10, this.scale.height).setOrigin(0);
    this.physics.add.existing(zone);
    (zone.body as Phaser.Physics.Arcade.Body).velocity.x = -speed;

    this.physics.add.overlap(this.mpig, zone, () => {
      zone.destroy();
      if (visual) visual.destroy();
      // Distance is now primary score, but we can play a sound for passing obstacles
      this.playSound(600, 0.08, 'sine');
    });

    if (visual) {
      this.time.delayedCall(10000, () => { if (visual && visual.active) visual.destroy(); });
    }
  }

  private checkDifficulty() {
    const keys = Object.keys(DIFFICULTY_SETTINGS).map(Number).sort((a, b) => b - a);
    const applicable = keys.find(k => this.score >= k);
    if (applicable !== undefined && DIFFICULTY_SETTINGS[applicable].level !== this.currentDifficulty.level) {
      const oldTheme = this.currentDifficulty.theme;
      this.currentDifficulty = DIFFICULTY_SETTINGS[applicable];

      if (oldTheme !== this.currentDifficulty.theme) {
        this.game.events.emit('level-up', this.currentDifficulty.theme);
        this.cameras.main.shake(100, 0.01);
        this.playSound(300, 0.3, 'sawtooth', 100);
      }
      this.resetSpawnTimer();
    }
  }

  private applyTheme(obs: any, theme: string) {
    if (theme === "Cracked") {
      obs.setTint(0xff5500);
      this.smokeParticles.emitParticleAt(obs.x, obs.y);
    } else if (theme === "Chained") {
      obs.setTint(0x9945FF);
    } else if (theme === "Chaos") {
      obs.setTint(0xff0000);
      if (this.score % 2 === 0) this.cameras.main.flash(100, 255, 0, 0, true);
    }
  }

  private incrementScore() {
    // This is now handled in update() based on distance
  }

  private handleGameOver() {
    if (this.state === GameState.GAME_OVER) return;
    this.state = GameState.GAME_OVER;

    this.cameras.main.shake(400, 0.03);
    this.physics.pause();
    this.spawnTimer?.remove();
    this.mpig.setTint(0xff0000);
    this.particles.stop();

    this.triggerHaptics(100);
    this.playSound(150, 0.4, 'square', 40);

    if (this.bgMusic) this.bgMusic.stop();

    // Delay event to let physics and camera shake settle - prevents mobile main thread hang
    this.time.delayedCall(150, () => {
      this.game.events.emit('game-over', this.score);
    });
  }

  update(time: number, delta: number) {
    if (this.state === GameState.PLAYING) {
      // 1. Update Distance-based Score
      // Increment distance based on speed (pixels/sec)
      this.distance += (this.currentDifficulty.speed * delta) / 1000;

      // Calculate score based on distance (1 score unit per 100 pixels)
      const newScore = Math.floor(this.distance / 100);
      if (newScore !== this.score) {
        this.score = newScore;
        this.game.events.emit('score-update', this.score);
        this.checkDifficulty();
      }

      this.background.tilePositionX += this.currentDifficulty.speed * 0.005;

      if ((this.mpig.body as Phaser.Physics.Arcade.Body).velocity.y > 0 && this.mpig.angle < 25) {
        this.mpig.angle += 1;
      }

      if (this.mpig.y > this.scale.height || this.mpig.y < 0) this.handleGameOver();

      this.obstacles.getChildren().forEach((obs: any) => {
        if (obs.x < -200) obs.destroy();
      });
      this.coins.getChildren().forEach((coin: any) => {
        if (coin.x < -100) coin.destroy();
      });
    }
  }
}