// src/game/config.ts
import { MainScene } from './scenes/MainScene';
import Phaser from 'phaser';

export const GameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#0D0B21',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 450,
        height: 800,
        parent: 'game-container',
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        },
    },
    scene: [MainScene],
    pixelArt: false,
    roundPixels: true,
};
