use anchor_lang::prelude::*;
use crate::state::{DroppedItemAccount, CharacterAccount};
use crate::instructions::character::MedievalLandError;

#[derive(Accounts)]
#[instruction(resource_type: u8, amount: u32, tile_x: u16, tile_y: u16)]
pub struct DropItem<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<DroppedItemAccount>(),
        seeds = [b"item", owner.key().as_ref(), &tile_x.to_le_bytes(), &tile_y.to_le_bytes()],
        bump,
    )]
    pub item: Account<'info, DroppedItemAccount>,

    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn drop_item(ctx: Context<DropItem>, resource_type: u8, amount: u32, tile_x: u16, tile_y: u16) -> Result<()> {
    let item = &mut ctx.accounts.item;
    item.resource_type = resource_type;
    item.amount = amount;
    item.dropped_by = ctx.accounts.owner.key();
    item.dropped_at = Clock::get()?.unix_timestamp;
    item.tile_x = tile_x;
    item.tile_y = tile_y;
    item.bump = ctx.bumps.item;
    Ok(())
}

#[derive(Accounts)]
pub struct PickUpItem<'info> {
    #[account(mut, close = picker)]
    pub item: Account<'info, DroppedItemAccount>,

    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    #[account(mut)]
    pub picker: Signer<'info>,
    pub owner: Signer<'info>,
}

pub fn pick_up_item(ctx: Context<PickUpItem>, _item_id: Pubkey) -> Result<()> {
    require!(ctx.accounts.character.stamina >= 2, MedievalLandError::InsufficientStamina);
    ctx.accounts.character.stamina -= 2;
    // Item account is closed (rent reclaimed) — ownership transferred implicitly
    Ok(())
}
