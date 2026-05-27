use anchor_lang::prelude::*;

/// A dropped item stack on a world tile
#[account]
pub struct DroppedItemAccount {
    pub world: Pubkey,
    pub tile_x: u16,
    pub tile_y: u16,
    pub resource_type: u8,  // 0=WOOD 1=STONE 2=FIBER 3=FOOD 4=BONE 5=PELT
    pub amount: u32,
    pub dropped_by: Pubkey,
    pub dropped_at: i64,
    pub bump: u8,
}
