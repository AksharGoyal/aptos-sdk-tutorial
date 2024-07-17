module StackCoin::fa_coin {
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata, FungibleAsset};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use std::error;
    use std::signer;
    use std::string::utf8;
    use std::option;
      const ENOT_OWNER: u64 = 1;
    const ASSET_SYMBOL: vector<u8> = b"FA";

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct ManagedFungibleAsset has key {
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        burn_ref: BurnRef,
    }

    fun init_module(admin: &signer) {
        let constructor_ref = &object::create_named_object(admin, ASSET_SYMBOL);
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::none(),
            utf8(b"StackCoin"), /* name */
            utf8(ASSET_SYMBOL), /* symbol */
            8, /* decimals */
            utf8(b"http://example.com/favicon.ico"), /* icon */
            utf8(b"http://stackup.dev"), /* project */
        );
         let mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(constructor_ref);
        let metadata_object_signer = object::generate_signer(constructor_ref);
        move_to(
            &metadata_object_signer,
            ManagedFungibleAsset { mint_ref, transfer_ref, burn_ref }
        );
}
    #[view]
    public fun get_metadata(): Object<Metadata> {
        let asset_address = object::create_object_address(&@StackCoin, ASSET_SYMBOL);
        object::address_to_object<Metadata>(asset_address)
    }

    public entry fun mint(admin: &signer, to: address, amount: u64) acquires ManagedFungibleAsset {
        let asset = get_metadata();
        let managed_fungible_asset = authorized_borrow_refs(admin, asset);
        let to_wallet = primary_fungible_store::ensure_primary_store_exists(to, asset);
        let fa = fungible_asset::mint(&managed_fungible_asset.mint_ref, amount);
        fungible_asset::deposit_with_ref(&managed_fungible_asset.transfer_ref, to_wallet, fa);
    }
    public entry fun transfer(admin: &signer, from: address, to: address, amount: u64) acquires ManagedFungibleAsset {
    let asset = get_metadata();
    let transfer_ref = &authorized_borrow_refs(admin, asset).transfer_ref;
    let from_wallet = primary_fungible_store::primary_store(from, asset);
    let to_wallet = primary_fungible_store::ensure_primary_store_exists(to, asset);
    fungible_asset::transfer_with_ref(transfer_ref, from_wallet, to_wallet, amount);
}
public entry fun burn(admin: &signer, from: address, amount: u64) acquires ManagedFungibleAsset {
    let asset = get_metadata();
    let burn_ref = &authorized_borrow_refs(admin, asset).burn_ref;
    let from_wallet = primary_fungible_store::primary_store(from, asset);
    fungible_asset::burn_from(burn_ref, from_wallet, amount);
}

public entry fun freeze_account(admin: &signer, account: address) acquires ManagedFungibleAsset {
    let asset = get_metadata();
    let transfer_ref = &authorized_borrow_refs(admin, asset).transfer_ref;
    let wallet = primary_fungible_store::ensure_primary_store_exists(account, asset);
    fungible_asset::set_frozen_flag(transfer_ref, wallet, true);
}

public entry fun unfreeze_account(admin: &signer, account: address) acquires ManagedFungibleAsset {
    let asset = get_metadata();
    let transfer_ref = &authorized_borrow_refs(admin, asset).transfer_ref;
    let wallet = primary_fungible_store::ensure_primary_store_exists(account, asset);
    fungible_asset::set_frozen_flag(transfer_ref, wallet, false);
}
public fun withdraw(admin: &signer, amount: u64, from: address): FungibleAsset acquires ManagedFungibleAsset {
    let asset = get_metadata();
    let transfer_ref = &authorized_borrow_refs(admin, asset).transfer_ref;
    let from_wallet = primary_fungible_store::primary_store(from, asset);
    fungible_asset::withdraw_with_ref(transfer_ref, from_wallet, amount)
}

public fun deposit(admin: &signer, to: address, fa: FungibleAsset) acquires ManagedFungibleAsset {
    let asset = get_metadata();
    let transfer_ref = &authorized_borrow_refs(admin, asset).transfer_ref;
    let to_wallet = primary_fungible_store::ensure_primary_store_exists(to, asset);
    fungible_asset::deposit_with_ref(transfer_ref, to_wallet, fa);
}

inline fun authorized_borrow_refs(
    owner: &signer,
    asset: Object<Metadata>,
): &ManagedFungibleAsset acquires ManagedFungibleAsset {
    assert!(object::is_owner(asset, signer::address_of(owner)), error::permission_denied(ENOT_OWNER));
    borrow_global<ManagedFungibleAsset>(object::object_address(&asset))
}
}
