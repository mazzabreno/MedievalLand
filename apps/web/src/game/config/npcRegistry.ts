export interface NPCAction {
  type: "tutor" | "trade" | "craft" | "quest" | "link" | "placeholder" | "vault";
  label: string;
  url?: string;
  questId?: string;
}

export interface NPCDefinition {
  id: string;
  name: string;
  role: string;
  tileX: number;
  tileY: number;
  color: number;
  dialog: string[];
  action: NPCAction;
  spriteKey?: string;
  portrait?: string;
}

export const NPC_REGISTRY: NPCDefinition[] = [
  {
    id: "elder",
    name: "Elder Aldric",
    role: "Village Guide",
    tileX: 8,
    tileY: 8,
    color: 0x14f195,
    dialog: [
      "Welcome, adventurer. MedievalLand is a dangerous place.",
      "Every action you take here is recorded permanently on Solana via MagicBlock Rollups.",
      "What you build stays built. What you destroy stays destroyed. Resources are finite.",
      "Start by gathering Wood and Stone — you'll need both to survive.",
      "Beware of creatures in the open world. If you die outside a Safe Zone, you lose everything you're carrying.",
      "And if a corpse goes uncleaned... it rises as a Skeleton.",
    ],
    action: { type: "tutor", label: "Understood!" },
    spriteKey: "avatar-player",
  },
  {
    id: "blacksmith",
    name: "Gorin",
    role: "Blacksmith",
    tileX: 12,
    tileY: 6,
    color: 0xff6b35,
    dialog: [
      "Aye, I forge the tools of survival.",
      "Bring me Wood and Stone and I'll make you an Axe, Pickaxe, or Sword.",
      "Without tools, you cannot harvest trees or mine rock.",
      "My forge is open — use the Crafting Table near the Safe Zone entrance.",
    ],
    action: { type: "craft", label: "Open Crafting" },
    spriteKey: "avatar-player",
  },
  {
    id: "merchant",
    name: "Mira",
    role: "Merchant",
    tileX: 7,
    tileY: 12,
    color: 0xffd700,
    dialog: [
      "Pssst. Come closer.",
      "I trade in resources — Wood, Stone, Fiber, Food.",
      "Deposit your resources in the Safe Zone vault and they're protected forever.",
      "Items in your open-world inventory are lost if you die. Always secure what matters.",
    ],
    action: { type: "vault", label: "Open Vault" },
    spriteKey: "avatar-player",
  },
  {
    id: "ranger",
    name: "Sylva",
    role: "Forest Ranger",
    tileX: 14,
    tileY: 10,
    color: 0x00d1ff,
    dialog: [
      "I've mapped every tree and rock in these lands.",
      "Resource nodes are finite — once depleted, they don't come back unless replanted.",
      "Wolves and Bears roam the open fields. They won't attack first... usually.",
      "Tier 3 monsters like Ogres are a different matter. They'll tear down your walls.",
    ],
    action: { type: "tutor", label: "Thanks for the warning" },
    spriteKey: "avatar-player",
  },
  {
    id: "sage",
    name: "Veyra",
    role: "Lore Keeper",
    tileX: 5,
    tileY: 9,
    color: 0x9945ff,
    dialog: [
      "The world runs on Solana. Every tile, every item, every structure has an on-chain account.",
      "MagicBlock Ephemeral Rollups handle the real-time state — sub-50ms updates, no wallet popups.",
      "At the end of each Season, scores are tallied and rewards distributed.",
      "Build the most, survive the longest, and claim glory before the world resets.",
    ],
    action: { type: "link", label: "MagicBlock Docs", url: "https://docs.magicblock.gg" },
    spriteKey: "avatar-player",
  },
];
