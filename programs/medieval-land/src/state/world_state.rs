use anchor_lang::prelude::*;

#[account]
pub struct WorldState {
    pub season_id: u32,
    pub seed: u64,
    pub biome: u8,       // 0=GREEN_FIELD
    pub width: u16,
    pub height: u16,
    pub authority: Pubkey,
    pub bump: u8,
}

/// One on-chain tile — stores structure and corpse state
#[account]
pub struct TileAccount {
    pub world: Pubkey,
    pub x: u16,
    pub y: u16,
    pub tile_type: u8,    // 0=GRASS 1=DIRT 2=SAFE 3=TREE 4=ROCK 5=BERRY
    pub depleted: bool,
    pub structure_type: u8,  // 0=none
    pub structure_hp: u16,
    pub structure_owner: Pubkey,
    pub has_corpse: bool,
    pub corpse_deadline: i64,
    pub bump: u8,
}
