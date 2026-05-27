use anchor_lang::prelude::*;
use crate::state::{WorldState};

#[derive(Accounts)]
#[instruction(season_id: u32, seed: u64)]
pub struct InitializeWorld<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<WorldState>(),
        seeds = [b"world", &season_id.to_le_bytes()],
        bump,
    )]
    pub world: Account<'info, WorldState>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_world(ctx: Context<InitializeWorld>, season_id: u32, seed: u64) -> Result<()> {
    let world = &mut ctx.accounts.world;
    world.season_id = season_id;
    world.seed = seed;
    world.biome = 0; // GREEN_FIELD
    world.width = 64;
    world.height = 64;
    world.authority = ctx.accounts.authority.key();
    world.bump = ctx.bumps.world;
    Ok(())
}
