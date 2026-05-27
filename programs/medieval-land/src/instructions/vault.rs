use anchor_lang::prelude::*;
use crate::state::{VaultAccount, CharacterAccount};
use crate::instructions::character::MedievalLandError;

#[derive(Accounts)]
pub struct DepositToVault<'info> {
    #[account(mut, has_one = owner)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    pub owner: Signer<'info>,
}

pub fn deposit_to_vault(ctx: Context<DepositToVault>, resource_type: u8, amount: u32) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    match resource_type {
        0 => vault.wood = vault.wood.checked_add(amount).unwrap(),
        1 => vault.stone = vault.stone.checked_add(amount).unwrap(),
        2 => vault.fiber = vault.fiber.checked_add(amount).unwrap(),
        3 => vault.food = vault.food.checked_add(amount).unwrap(),
        4 => vault.bone = vault.bone.checked_add(amount).unwrap(),
        5 => vault.pelt = vault.pelt.checked_add(amount).unwrap(),
        _ => return Err(MedievalLandError::InsufficientResources.into()),
    }
    // Score: item extracted
    ctx.accounts.character.score += (amount as u64) * 2;
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFromVault<'info> {
    #[account(mut, has_one = owner)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, has_one = owner)]
    pub character: Account<'info, CharacterAccount>,

    pub owner: Signer<'info>,
}

pub fn withdraw_from_vault(ctx: Context<WithdrawFromVault>, resource_type: u8, amount: u32) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let field = match resource_type {
        0 => &mut vault.wood,
        1 => &mut vault.stone,
        2 => &mut vault.fiber,
        3 => &mut vault.food,
        4 => &mut vault.bone,
        5 => &mut vault.pelt,
        _ => return Err(MedievalLandError::InsufficientResources.into()),
    };
    require!(*field >= amount, MedievalLandError::InsufficientResources);
    *field -= amount;
    Ok(())
}
