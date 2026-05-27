use anchor_lang::prelude::*;
use crate::state::{TileAccount, CharacterAccount};
use crate::instructions::character::MedievalLandError;

#[derive(Accounts)]
pub struct HarvestResource<'info> {
    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    #[account(mut)]
    pub tile: Account<'info, TileAccount>,

    pub owner: Signer<'info>,
}

pub fn harvest_resource(ctx: Context<HarvestResource>) -> Result<()> {
    let tile = &mut ctx.accounts.tile;
    let character = &mut ctx.accounts.character;

    require!(!tile.depleted, MedievalLandError::NodeDepleted);
    require!(character.stamina >= 4, MedievalLandError::InsufficientStamina);

    character.stamina -= 4;

    // Mark depleted on last hit (simplified: deplete after 1 harvest for MVP)
    tile.depleted = true;

    // Score for gathering
    character.score += 1;

    Ok(())
}
