use anchor_lang::prelude::*;
use crate::state::{CharacterAccount, VaultAccount};

#[derive(Accounts)]
pub struct CreateCharacter<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<CharacterAccount>() + 32,
        seeds = [b"character", owner.key().as_ref()],
        bump,
    )]
    pub character: Account<'info, CharacterAccount>,

    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<VaultAccount>(),
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_character(ctx: Context<CreateCharacter>, name: String, class: u8) -> Result<()> {
    require!(name.len() <= 32, MedievalLandError::NameTooLong);
    require!(class < 5, MedievalLandError::InvalidClass);

    let character = &mut ctx.accounts.character;
    character.owner = ctx.accounts.owner.key();
    character.name = name;
    character.class = class;
    character.hp = 100;
    character.max_hp = 100;
    character.stamina = 200;
    character.max_stamina = 200;
    character.speed = 5;
    character.attack = 10;
    character.defense = 0;
    character.score = 0;
    character.season_id = 1;
    character.bump = ctx.bumps.character;

    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.owner.key();
    vault.bump = ctx.bumps.vault;

    Ok(())
}

#[error_code]
pub enum MedievalLandError {
    #[msg("Character name must be 32 characters or fewer")]
    NameTooLong,
    #[msg("Invalid character class")]
    InvalidClass,
    #[msg("Insufficient stamina")]
    InsufficientStamina,
    #[msg("Insufficient resources")]
    InsufficientResources,
    #[msg("Tile is in a Safe Zone")]
    InSafeZone,
    #[msg("Resource node is depleted")]
    NodeDepleted,
}
