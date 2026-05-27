use anchor_lang::prelude::*;
use crate::state::{TileAccount, CharacterAccount};
use crate::instructions::character::MedievalLandError;

#[derive(Accounts)]
#[instruction(structure_type: u8, tile_x: u16, tile_y: u16)]
pub struct PlaceStructure<'info> {
    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    #[account(
        mut,
        seeds = [b"tile", tile.world.as_ref(), &tile_x.to_le_bytes(), &tile_y.to_le_bytes()],
        bump = tile.bump,
    )]
    pub tile: Account<'info, TileAccount>,

    pub owner: Signer<'info>,
}

pub fn place_structure(ctx: Context<PlaceStructure>, structure_type: u8, _tile_x: u16, _tile_y: u16) -> Result<()> {
    let tile = &mut ctx.accounts.tile;
    let character = &mut ctx.accounts.character;

    require!(tile.tile_type != 2, MedievalLandError::InSafeZone);
    require!(character.stamina >= 10, MedievalLandError::InsufficientStamina);

    character.stamina -= 10;
    tile.structure_type = structure_type;
    // HP set based on structure type (simplified — full lookup in client)
    tile.structure_hp = 80;
    tile.structure_owner = character.owner;

    Ok(())
}

#[derive(Accounts)]
#[instruction(tile_x: u16, tile_y: u16)]
pub struct DestroyStructure<'info> {
    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    #[account(
        mut,
        seeds = [b"tile", tile.world.as_ref(), &tile_x.to_le_bytes(), &tile_y.to_le_bytes()],
        bump = tile.bump,
    )]
    pub tile: Account<'info, TileAccount>,

    pub owner: Signer<'info>,
}

pub fn destroy_structure(ctx: Context<DestroyStructure>, _tile_x: u16, _tile_y: u16) -> Result<()> {
    let tile = &mut ctx.accounts.tile;
    let character = &mut ctx.accounts.character;

    require!(tile.tile_type != 2, MedievalLandError::InSafeZone);
    require!(character.stamina >= 12, MedievalLandError::InsufficientStamina);

    character.stamina -= 12;
    tile.structure_hp = tile.structure_hp.saturating_sub(10);

    if tile.structure_hp == 0 {
        tile.structure_type = 0;
        tile.structure_owner = Pubkey::default();
    }

    Ok(())
}
