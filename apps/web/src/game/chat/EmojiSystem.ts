import * as Phaser from "phaser";

export interface EmojiDef {
  id: string;
  label: string;
  key: string;
  symbol: string;
  color: string;
  artKey: string;
  uiSymbol: string;
}

export const EMOJI_REGISTRY: EmojiDef[] = [
  { id: "wave",  label: "Wave",  key: "1", symbol: "hail!",  color: "#14F195", artKey: "emoji-wave",  uiSymbol: "👋" },
  { id: "heart", label: "Heart", key: "2", symbol: "<3",     color: "#F72585", artKey: "emoji-heart", uiSymbol: "💜" },
  { id: "fire",  label: "Fire",  key: "3", symbol: "charge", color: "#FF6B35", artKey: "emoji-fire",  uiSymbol: "🔥" },
  { id: "laugh", label: "Laugh", key: "4", symbol: "haha",   color: "#FFD700", artKey: "emoji-laugh", uiSymbol: "😆" },
  { id: "think", label: "Think", key: "5", symbol: "hmm",    color: "#00D1FF", artKey: "emoji-think", uiSymbol: "🤔" },
  { id: "gg",    label: "GG",    key: "6", symbol: "glory",  color: "#9945FF", artKey: "emoji-gg",    uiSymbol: "⚔️" },
];

const EMOJI_DURATION = 2500;
const EMOJI_FLOAT_HEIGHT = 40;

export function showEmoji(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  emoji: EmojiDef
): void {
  const bubble = scene.add.container(0, -30);

  const bg = scene.add.graphics();
  bg.fillStyle(0x0a0a1e, 0.78);
  bg.fillRoundedRect(-18, -26, 36, 32, 8);
  bg.lineStyle(1.5, parseInt(emoji.color.replace("#", ""), 16), 0.35);
  bg.strokeRoundedRect(-18, -26, 36, 32, 8);

  const icon = scene.add.text(0, -12, emoji.uiSymbol, {
    fontSize: "20px",
    fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
  }).setOrigin(0.5);

  const label = scene.add.text(0, 8, emoji.symbol, {
    fontSize: "9px",
    fontFamily: '"Press Start 2P", monospace',
    color: emoji.color,
    stroke: "#0a0a1e",
    strokeThickness: 3,
  }).setOrigin(0.5);

  bubble.add([bg, icon, label]);
  target.add(bubble);

  scene.tweens.add({
    targets: bubble,
    y: -30 - EMOJI_FLOAT_HEIGHT,
    alpha: 0,
    duration: EMOJI_DURATION,
    ease: "Cubic.easeOut",
    onComplete: () => {
      target.remove(bubble);
      bubble.destroy();
    },
  });
}

export function setupEmojiKeys(
  scene: Phaser.Scene,
  getTarget: () => Phaser.GameObjects.Container,
  getChatActive: () => boolean,
  onEmoji?: (emoji: EmojiDef) => void
): void {
  for (const emoji of EMOJI_REGISTRY) {
    scene.input.keyboard!.on(`keydown-${emoji.key}`, () => {
      if (getChatActive()) return;
      showEmoji(scene, getTarget(), emoji);
      onEmoji?.(emoji);
    });
  }
}
