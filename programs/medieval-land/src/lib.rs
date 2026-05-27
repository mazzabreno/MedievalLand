use anchor_lang::prelude::*;

mod state;
mod instructions;

use instructions::*;

declare_id!("MedLand11111111111111111111111111111111111");

#[program]
pub mod medieval_land {
    use super::*;

    // --- World initialization ---
    pub fn initialize_world(ctx: Context<InitializeWorld>, season_id: u32, seed: u64) -> Result<()> {
        instructions::world::initialize_world(ctx, season_id, seed)
    }

    // --- Character ---
    pub fn create_character(ctx: Context<CreateCharacter>, name: String, class: u8) -> Result<()> {
        instructions::character::create_character(ctx, name, class)
    }

    // --- Resources ---
    pub fn harvest_resource(ctx: Context<HarvestResource>) -> Result<()> {
        instructions::resource::harvest_resource(ctx)
    }

    // --- Building ---
    pub fn place_structure(ctx: Context<PlaceStructure>, structure_type: u8, tile_x: u16, tile_y: u16) -> Result<()> {
        instructions::building::place_structure(ctx, structure_type, tile_x, tile_y)
    }

    pub fn destroy_structure(ctx: Context<DestroyStructure>, tile_x: u16, tile_y: u16) -> Result<()> {
        instructions::building::destroy_structure(ctx, tile_x, tile_y)
    }

    // --- Items ---
    pub fn drop_item(ctx: Context<DropItem>, resource_type: u8, amount: u32, tile_x: u16, tile_y: u16) -> Result<()> {
        instructions::item::drop_item(ctx, resource_type, amount, tile_x, tile_y)
    }

    pub fn pick_up_item(ctx: Context<PickUpItem>, item_id: Pubkey) -> Result<()> {
        instructions::item::pick_up_item(ctx, item_id)
    }

    // --- Safe Zone vault ---
    pub fn deposit_to_vault(ctx: Context<DepositToVault>, resource_type: u8, amount: u32) -> Result<()> {
        instructions::vault::deposit_to_vault(ctx, resource_type, amount)
    }

    pub fn withdraw_from_vault(ctx: Context<WithdrawFromVault>, resource_type: u8, amount: u32) -> Result<()> {
        instructions::vault::withdraw_from_vault(ctx, resource_type, amount)
    }

    // --- Season ---
    pub fn record_score(ctx: Context<RecordScore>, reason: u8, points: u32) -> Result<()> {
        instructions::season::record_score(ctx, reason, points)
    }
}
