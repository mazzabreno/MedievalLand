use anchor_lang::prelude::*;
use crate::state::{PlayerSeasonScore, CharacterAccount};

#[derive(Accounts)]
pub struct RecordScore<'info> {
    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + std::mem::size_of::<PlayerSeasonScore>(),
        seeds = [b"score", owner.key().as_ref(), &character.season_id.to_le_bytes()],
        bump,
    )]
    pub score: Account<'info, PlayerSeasonScore>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn record_score(ctx: Context<RecordScore>, reason: u8, points: u32) -> Result<()> {
    let score = &mut ctx.accounts.score;
    let character = &mut ctx.accounts.character;
    let pts = points as u64;

    score.player = ctx.accounts.owner.key();
    score.season_id = character.season_id;
    score.total_score += pts;
    character.score += pts;

    match reason {
        0 => score.structures_score += pts,
        1 => score.resources_score += pts,
        2 => score.creatures_score += pts,
        3 => score.pvp_score += pts,
        4 => score.extraction_score += pts,
        _ => {}
    }

    Ok(())
}
