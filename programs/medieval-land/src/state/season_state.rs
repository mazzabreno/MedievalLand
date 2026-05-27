use anchor_lang::prelude::*;

#[account]
pub struct SeasonState {
    pub season_id: u32,
    pub phase: u8,         // 0=OPENING 1=MAIN 2=FINAL_WEEK 3=SETTLEMENT
    pub start_ts: i64,
    pub end_ts: i64,
    pub pvp_enabled: bool,
    pub structure_destruction_enabled: bool,
    pub ogre_horde_multiplier: u8,
    pub bump: u8,
}

#[account]
pub struct PlayerSeasonScore {
    pub player: Pubkey,
    pub season_id: u32,
    pub total_score: u64,
    pub structures_score: u64,
    pub resources_score: u64,
    pub creatures_score: u64,
    pub pvp_score: u64,
    pub extraction_score: u64,
    pub bump: u8,
}
