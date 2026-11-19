//! Official Ootle engine tests for CapPurse.
//! These exercise the compiled WASM template via tari_template_test_tooling.

use tari_template_lib::prelude::RistrettoPublicKeyBytes;
use tari_template_lib::types::constants::TARI_TOKEN;
use tari_template_lib::types::{Amount, ComponentAddress, NonFungibleAddress};
use tari_template_test_tooling::byte_type::ToByteType;
use tari_template_test_tooling::crypto::RistrettoSecretKey;
use tari_template_test_tooling::engine_types::commit_result::RejectReason;
use tari_template_test_tooling::engine_types::virtual_substate::{VirtualSubstate, VirtualSubstateId};
use tari_template_test_tooling::support::assert_error::assert_reject_reason;
use tari_template_test_tooling::transaction::args;
use tari_template_test_tooling::TemplateTest;

const TEMPLATE: &str = "CapPurse";
const DEPOSIT: u64 = 1_000_000_000; // 1,000 TARI at 6 decimals; equals FUNDED_ACCOUNT_INITIAL_BALANCE
const CAP: u64 = 100_000_000; // 100 TARI
const FORTY: u64 = 40_000_000;
const SEVENTY: u64 = 70_000_000;
const TEN: u64 = 10_000_000;

struct World {
    test: TemplateTest,
    owner_account: ComponentAddress,
    owner_secret: RistrettoSecretKey,
    owner_proof: NonFungibleAddress,
    purse: ComponentAddress,
}

struct Person {
    account: ComponentAddress,
    secret: RistrettoSecretKey,
    proof: NonFungibleAddress,
    pk: RistrettoPublicKeyBytes,
}

fn funded(test: &mut TemplateTest) -> Person {
    let (account, proof, secret, public_key) = test.create_funded_account_with_keypair();
    Person {
        account,
        secret,
        proof,
        pk: public_key.to_byte_type(),
    }
}

fn empty(test: &mut TemplateTest) -> (ComponentAddress, NonFungibleAddress, RistrettoSecretKey) {
    test.create_empty_account()
}

fn new_purse() -> World {
    let mut test = TemplateTest::my_crate();
    let owner = funded(&mut test);
    let template = test.get_template_address(TEMPLATE);

    test.execute_expect_success(
        test.transaction()
            .allocate_component_address("alloc")
            .call_function(template, "new", args![Workspace("alloc")])
            .put_last_instruction_output_on_workspace("purse")
            .call_method(owner.account, "withdraw", args![TARI_TOKEN, DEPOSIT])
            .put_last_instruction_output_on_workspace("funds")
            .call_method("purse", "deposit", args![Workspace("funds")])
            .build_and_seal(&owner.secret),
        vec![owner.proof.clone()],
    );

    let (purse, _) = test
        .read_only_state_store()
        .get_components_by_template_address(template)
        .unwrap()
        .remove(0);

    World {
        test,
        owner_account: owner.account,
        owner_secret: owner.secret,
        owner_proof: owner.proof,
        purse,
    }
}

fn grant(
    world: &mut World,
    bob_pk: RistrettoPublicKeyBytes,
    allowlist: Vec<ComponentAddress>,
    period: u64,
    expiry: u64,
) {
    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(
                world.purse,
                "grant",
                args![
                    bob_pk,
                    "Assistant".to_string(),
                    CAP,
                    period,
                    expiry,
                    allowlist
                ],
            )
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );
}

fn set_epoch(world: &mut World, epoch: u64) {
    world.test.set_virtual_substate(
        VirtualSubstateId::CurrentEpoch,
        VirtualSubstate::CurrentEpoch(epoch),
    );
}

fn reject_message(reason: &RejectReason) -> String {
    match reason {
        RejectReason::ExecutionFailure { message, .. } => message.clone(),
        other => format!("{other:?}"),
    }
}

#[test]
fn exact_spend_pays_merchant_and_issues_receipt() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 50, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![FORTY, cafe, "lunch".to_string()])
            .put_last_instruction_output_on_workspace("receipt")
            .call_method(bob.account, "deposit", args![Workspace("receipt")])
            .build_and_seal(&bob.secret),
        vec![],
    );

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "vault_balance", args![])
            .build_and_seal(&bob.secret),
        vec![],
    );
    let vault: Amount = world.test.expect_return(0);
    assert_eq!(vault, Amount::from(DEPOSIT - FORTY));
}

#[test]
fn over_cap_is_rejected() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![FORTY, cafe, "first".to_string()])
            .put_last_instruction_output_on_workspace("r")
            .call_method(bob.account, "deposit", args![Workspace("r")])
            .build_and_seal(&bob.secret),
        vec![],
    );

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(
                world.purse,
                "spend",
                args![SEVENTY, cafe, "too much".to_string()],
            )
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "amount exceeds remaining cap");
}

#[test]
fn unlisted_merchant_is_rejected() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    let (shop, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![TEN, shop, "nope".to_string()])
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "merchant is not on the allowlist");
}

#[test]
fn non_helper_cannot_spend() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let mallory = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(
                world.purse,
                "spend",
                args![TEN, cafe, "intruder".to_string()],
            )
            .build_and_seal(&mallory.secret),
        vec![],
    );
    let msg = reject_message(&reason);
    assert!(
        msg.contains("not a helper") || msg.contains("Access Denied"),
        "unexpected reject: {msg}"
    );
}

#[test]
fn non_owner_cannot_withdraw() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(world.purse, "withdraw", args![TEN])
            .build_and_seal(&bob.secret),
        vec![bob.proof],
    );
    let msg = reject_message(&reason);
    assert!(
        msg.to_lowercase().contains("access"),
        "unexpected reject: {msg}"
    );
}

#[test]
fn zero_cap_is_rejected() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(
                world.purse,
                "grant",
                args![
                    bob.pk,
                    "x".to_string(),
                    0u64,
                    0u64,
                    0u64,
                    Vec::<ComponentAddress>::new()
                ],
            )
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );
    assert_reject_reason(reason, "cap must be greater than zero");
}

#[test]
fn owner_withdraw_and_revoke() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "revoke", args![bob.pk])
            .call_method(world.purse, "withdraw", args![DEPOSIT])
            .put_last_instruction_output_on_workspace("back")
            .call_method(world.owner_account, "deposit", args![Workspace("back")])
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );
    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "vault_balance", args![])
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );
    let vault: Amount = world.test.expect_return(0);
    assert_eq!(vault, Amount::zero());

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![TEN, cafe, "after".to_string()])
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "allowance has been revoked");
}

#[test]
fn expired_allowance_is_rejected() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 10);
    set_epoch(&mut world, 10);

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![TEN, cafe, "late".to_string()])
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "allowance has expired");
}

#[test]
fn period_refill_restores_the_cap() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 50, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![FORTY, cafe, "first".to_string()])
            .put_last_instruction_output_on_workspace("r")
            .call_method(bob.account, "deposit", args![Workspace("r")])
            .build_and_seal(&bob.secret),
        vec![],
    );

    set_epoch(&mut world, 50);

    // After refill the remaining cap is 100 again, so a 100 spend should pass.
    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![CAP, cafe, "refill".to_string()])
            .put_last_instruction_output_on_workspace("r2")
            .call_method(bob.account, "deposit", args![Workspace("r2")])
            .build_and_seal(&bob.secret),
        vec![],
    );
    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "vault_balance", args![])
            .build_and_seal(&bob.secret),
        vec![],
    );
    let vault: Amount = world.test.expect_return(0);
    assert_eq!(vault, Amount::from(DEPOSIT - FORTY - CAP));
}

#[test]
fn one_shot_does_not_refill() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![FORTY, cafe, "first".to_string()])
            .put_last_instruction_output_on_workspace("r")
            .call_method(bob.account, "deposit", args![Workspace("r")])
            .build_and_seal(&bob.secret),
        vec![],
    );

    set_epoch(&mut world, 1000);

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(
                world.purse,
                "spend",
                args![SEVENTY, cafe, "no refill".to_string()],
            )
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "amount exceeds remaining cap");
}

#[test]
fn non_owner_cannot_grant() {
    let mut world = new_purse();
    let mallory = funded(&mut world.test);
    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(
                world.purse,
                "grant",
                args![
                    mallory.pk,
                    "self-grant".to_string(),
                    CAP,
                    0u64,
                    0u64,
                    Vec::<ComponentAddress>::new()
                ],
            )
            .build_and_seal(&mallory.secret),
        vec![mallory.proof],
    );
    let msg = reject_message(&reason);
    assert!(
        msg.to_lowercase().contains("access"),
        "unexpected reject: {msg}"
    );
}

#[test]
fn insufficient_vault_is_rejected() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    // Owner pulls all but 10 TARI back out; the cap is a ceiling, not a lock.
    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "withdraw", args![DEPOSIT - TEN])
            .put_last_instruction_output_on_workspace("back")
            .call_method(world.owner_account, "deposit", args![Workspace("back")])
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![FORTY, cafe, "short".to_string()])
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "insufficient vault balance");
}

#[test]
fn allowlist_update_admits_new_merchant() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    let (shop, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "set_allowlist", args![bob.pk, vec![cafe, shop]])
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![TEN, shop, "now listed".to_string()])
            .put_last_instruction_output_on_workspace("r")
            .call_method(bob.account, "deposit", args![Workspace("r")])
            .build_and_seal(&bob.secret),
        vec![],
    );
}

#[test]
fn lowering_cap_clamps_remaining() {
    let mut world = new_purse();
    let bob = funded(&mut world.test);
    let (cafe, _, _) = empty(&mut world.test);
    grant(&mut world, bob.pk, vec![cafe], 0, 0);

    world.test.execute_expect_success(
        world
            .test
            .transaction()
            .call_method(world.purse, "set_cap", args![bob.pk, TEN])
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );

    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(world.purse, "spend", args![FORTY, cafe, "old cap".to_string()])
            .build_and_seal(&bob.secret),
        vec![],
    );
    assert_reject_reason(reason, "amount exceeds remaining cap");
}

#[test]
fn wrong_asset_deposit_is_rejected() {
    let mut world = new_purse();
    let faucet = tari_template_lib::types::constants::NFT_FAUCET_COMPONENT_ADDRESS;

    let no_data = tari_template_lib::to_value(&()).unwrap();
    // A non-TARI resource (a test NFT) must never enter the purse vault.
    let reason = world.test.execute_expect_failure(
        world
            .test
            .transaction()
            .call_method(faucet, "mint", args![1u64, no_data])
            .put_last_instruction_output_on_workspace("nft")
            .call_method(world.purse, "deposit", args![Workspace("nft")])
            .build_and_seal(&world.owner_secret),
        vec![world.owner_proof.clone()],
    );
    assert_reject_reason(reason, "You must deposit Tari tokens");
}
