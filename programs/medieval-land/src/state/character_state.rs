use anchor_lang::prelude::*;

#[account]
pub struct CharacterAccount {
    pub owner: Pubkey,
    pub name: String,       // max 32 chars
    pub class: u8,          // 0=WARRIOR 1=RANGER 2=BUILDER 3=MAGE 4=MERCHANT
    pub hp: u16,
    pub max_hp: u16,
    pub stamina: u16,
    pub max_stamina: u16,
    pub speed: u8,
    pub attack: u8,
    pub defense: u8,
    pub score: u64,
    pub season_id: u32,
    pub bump: u8,
}

#[account]
pub struct VaultAccount {
    pub owner: Pubkey,
    pub wood: u32,
    pub stone: u32,
    pub fiber: u32,
    pub food: u32,
    pub bone: u32,
    pub pelt: u32,
    pub bump: u8,
}
