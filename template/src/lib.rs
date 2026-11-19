// Copyright (c) 2026 Ali Ghaedi
// SPDX-License-Identifier: MIT
//
// CapPurse — a spend-capped allowance vault on Tari Ootle.
// The helper never takes custody. A payment either reaches the merchant
// in the same transaction or the whole call panics and nothing moves.

use tari_template_lib::prelude::*;

#[template]
mod cap_purse {
    use std::collections::HashMap;

    use super::*;

    const MAX_MEMO: usize = 128;
    const MAX_LABEL: usize = 64;

    pub struct CapPurse {
        vault: Vault,
        receipt_resource: ResourceAddress,
        next_receipt: u64,
        helpers: HashMap<RistrettoPublicKeyBytes, Allowance>,
    }

    pub struct Allowance {
        label: String,
        cap: Amount,
        remaining: Amount,
        period_epochs: u64,
        last_reset_epoch: u64,
        expires_at_epoch: u64,
        revoked: bool,
        allowlist: Vec<ComponentAddress>,
        spent_total: Amount,
        spend_count: u64,
    }

    pub struct AllowanceView {
        pub helper: RistrettoPublicKeyBytes,
        pub label: String,
        pub cap: Amount,
        pub remaining: Amount,
        pub period_epochs: u64,
        pub last_reset_epoch: u64,
        pub expires_at_epoch: u64,
        pub revoked: bool,
        pub expired: bool,
        pub allowlist: Vec<ComponentAddress>,
        pub spent_total: Amount,
        pub spend_count: u64,
        pub spendable: Amount,
        pub vault: Amount,
    }

    impl CapPurse {
        /// Create an empty purse. The transaction signer is the owner.
        pub fn new(alloc: ComponentAddressAllocation) -> Component<Self> {
            let component_addr = alloc.get_address();
            // Only this component may mint receipt NFTs, and that rule cannot be loosened.
            let receipt_resource = ResourceBuilder::non_fungible()
                .metadata("name", "CapPurse Receipt")
                .with_token_symbol("CPR")
                .mintable(rule!(component(component_addr)), UpdateRule::Locked)
                .build();

            let access = ComponentAccessRules::new()
                .method("deposit", rule![allow_all])
                .method("spend", rule![allow_all])
                .method("vault_balance", rule![allow_all])
                .method("allowance_of", rule![allow_all])
                .method("receipt_resource", rule![allow_all]);

            Component::new(Self {
                vault: Vault::new_empty(TARI_TOKEN),
                receipt_resource,
                next_receipt: 1,
                helpers: HashMap::new(),
            })
            .with_address_allocation(alloc)
            .with_owner_rule(OwnerRule::OwnedBySigner)
            .with_access_rules(access)
            .create()
        }

        /// Anyone may top up, but only with TARI.
        pub fn deposit(&mut self, payment: Bucket) {
            assert_eq!(
                payment.resource_address(),
                TARI_TOKEN,
                "You must deposit Tari tokens"
            );
            assert!(
                payment.amount() > Amount::zero(),
                "deposit amount must be greater than zero"
            );
            let amount = payment.amount();
            self.vault.deposit(payment);
            emit_event(
                "Deposited",
                metadata![
                    "amount" => amount.to_string(),
                    "vault" => self.vault.balance().to_string(),
                ],
            );
        }

        pub fn grant(
            &mut self,
            helper: RistrettoPublicKeyBytes,
            label: String,
            cap: Amount,
            period_epochs: u64,
            expires_at_epoch: u64,
            allowlist: Vec<ComponentAddress>,
        ) {
            assert!(cap > Amount::zero(), "cap must be greater than zero");
            let now = Consensus::current_epoch();
            if expires_at_epoch != 0 {
                assert!(expires_at_epoch > now, "expiry must be in the future");
            }
            if let Some(existing) = self.helpers.get(&helper) {
                assert!(
                    existing.revoked,
                    "helper already has an active allowance"
                );
            }
            let label = truncate(label, MAX_LABEL);
            self.helpers.insert(
                helper,
                Allowance {
                    label,
                    cap,
                    remaining: cap,
                    period_epochs,
                    last_reset_epoch: now,
                    expires_at_epoch,
                    revoked: false,
                    allowlist,
                    spent_total: Amount::zero(),
                    spend_count: 0,
                },
            );
            emit_event(
                "Granted",
                metadata![
                    "helper" => helper.to_string(),
                    "cap" => cap.to_string(),
                    "period_epochs" => period_epochs.to_string(),
                    "expires_at_epoch" => expires_at_epoch.to_string(),
                ],
            );
        }

        pub fn set_cap(&mut self, helper: RistrettoPublicKeyBytes, new_cap: Amount) {
            assert!(new_cap > Amount::zero(), "cap must be greater than zero");
            let a = self.helper_mut(&helper);
            Self::maybe_refill(a);
            a.cap = new_cap;
            if a.remaining > new_cap {
                a.remaining = new_cap;
            }
            emit_event(
                "CapSet",
                metadata![
                    "helper" => helper.to_string(),
                    "cap" => new_cap.to_string(),
                    "remaining" => a.remaining.to_string(),
                ],
            );
        }

        pub fn set_allowlist(
            &mut self,
            helper: RistrettoPublicKeyBytes,
            allowlist: Vec<ComponentAddress>,
        ) {
            let a = self.helper_mut(&helper);
            a.allowlist = allowlist;
            emit_event(
                "AllowlistSet",
                metadata!["helper" => helper.to_string()],
            );
        }

        pub fn revoke(&mut self, helper: RistrettoPublicKeyBytes) {
            let a = self.helper_mut(&helper);
            assert!(!a.revoked, "allowance already revoked");
            a.revoked = true;
            emit_event("Revoked", metadata!["helper" => helper.to_string()]);
        }

        pub fn reactivate(&mut self, helper: RistrettoPublicKeyBytes) {
            let now = Consensus::current_epoch();
            let a = self
                .helpers
                .get_mut(&helper)
                .expect("unknown helper");
            assert!(a.revoked, "allowance is not revoked");
            if a.expires_at_epoch != 0 {
                assert!(a.expires_at_epoch > now, "allowance has expired");
            }
            a.revoked = false;
            a.remaining = a.cap;
            a.last_reset_epoch = now;
            emit_event("Reactivated", metadata!["helper" => helper.to_string()]);
        }

        /// Owner withdraws TARI. The cap is a ceiling, not a reserved lock.
        pub fn withdraw(&mut self, amount: Amount) -> Bucket {
            assert!(
                amount > Amount::zero(),
                "withdraw amount must be greater than zero"
            );
            let bucket = self.vault.withdraw(amount);
            emit_event(
                "Withdrawn",
                metadata![
                    "amount" => amount.to_string(),
                    "vault" => self.vault.balance().to_string(),
                ],
            );
            bucket
        }

        /// Helper pays a merchant. Returns a receipt NFT.
        pub fn spend(
            &mut self,
            amount: Amount,
            merchant: ComponentAddress,
            memo: String,
        ) -> Bucket {
            assert!(
                amount > Amount::zero(),
                "spend amount must be greater than zero"
            );
            assert!(memo.len() <= MAX_MEMO, "memo too long");

            let helper = CallerContext::transaction_signer_public_key();
            let now = Consensus::current_epoch();
            let a = self
                .helpers
                .get_mut(&helper)
                .expect("Access Denied: not a helper on this purse");
            Self::maybe_refill(a);
            assert!(!a.revoked, "allowance has been revoked");
            if a.expires_at_epoch != 0 {
                assert!(now < a.expires_at_epoch, "allowance has expired");
            }
            assert!(amount <= a.remaining, "amount exceeds remaining cap");
            assert!(
                amount <= self.vault.balance(),
                "insufficient vault balance"
            );
            if !a.allowlist.is_empty() {
                assert!(
                    a.allowlist.contains(&merchant),
                    "merchant is not on the allowlist"
                );
            }

            let payment = self.vault.withdraw(amount);
            ComponentManager::get(merchant).invoke("deposit", args![payment]);

            a.remaining = a.remaining - amount;
            a.spent_total = a.spent_total + amount;
            a.spend_count += 1;
            let remaining = a.remaining;

            let receipt_id = self.next_receipt;
            self.next_receipt += 1;
            let receipt = ResourceManager::get(self.receipt_resource).mint_non_fungible(
                NonFungibleId::from_u64(receipt_id),
                &metadata![
                    "amount" => amount.to_string(),
                    "merchant" => merchant.to_string(),
                    "memo" => memo.clone(),
                    "epoch" => now.to_string(),
                    "helper" => helper.to_string(),
                ],
                &(),
            );

            emit_event(
                "Spent",
                metadata![
                    "helper" => helper.to_string(),
                    "merchant" => merchant.to_string(),
                    "amount" => amount.to_string(),
                    "memo" => memo,
                    "remaining" => remaining.to_string(),
                    "vault" => self.vault.balance().to_string(),
                    "receipt" => receipt_id.to_string(),
                ],
            );
            receipt
        }

        pub fn vault_balance(&self) -> Amount {
            self.vault.balance()
        }

        pub fn receipt_resource(&self) -> ResourceAddress {
            self.receipt_resource
        }

        pub fn allowance_of(&self, helper: RistrettoPublicKeyBytes) -> AllowanceView {
            let a = self.helpers.get(&helper).expect("unknown helper");
            let now = Consensus::current_epoch();
            let mut remaining = a.remaining;
            let mut last_reset = a.last_reset_epoch;
            if !a.revoked && a.period_epochs > 0 {
                if a.expires_at_epoch == 0 || now < a.expires_at_epoch {
                    if now >= last_reset + a.period_epochs {
                        let periods = (now - last_reset) / a.period_epochs;
                        last_reset += periods * a.period_epochs;
                        remaining = a.cap;
                    }
                }
            }
            let expired = a.expires_at_epoch != 0 && now >= a.expires_at_epoch;
            let remaining = if a.revoked || expired {
                Amount::zero()
            } else {
                remaining
            };
            let spendable = if remaining < self.vault.balance() {
                remaining
            } else {
                self.vault.balance()
            };
            AllowanceView {
                helper,
                label: a.label.clone(),
                cap: a.cap,
                remaining,
                period_epochs: a.period_epochs,
                last_reset_epoch: last_reset,
                expires_at_epoch: a.expires_at_epoch,
                revoked: a.revoked,
                expired,
                allowlist: a.allowlist.clone(),
                spent_total: a.spent_total,
                spend_count: a.spend_count,
                spendable,
                vault: self.vault.balance(),
            }
        }

        fn helper_mut(&mut self, helper: &RistrettoPublicKeyBytes) -> &mut Allowance {
            let a = self.helpers.get_mut(helper).expect("unknown helper");
            assert!(!a.revoked, "allowance has been revoked");
            a
        }

        fn maybe_refill(a: &mut Allowance) {
            if a.revoked || a.period_epochs == 0 {
                return;
            }
            let now = Consensus::current_epoch();
            if a.expires_at_epoch != 0 && now >= a.expires_at_epoch {
                return;
            }
            if now >= a.last_reset_epoch + a.period_epochs {
                let periods = (now - a.last_reset_epoch) / a.period_epochs;
                a.last_reset_epoch += periods * a.period_epochs;
                a.remaining = a.cap;
            }
        }
    }

    fn truncate(s: String, max: usize) -> String {
        if s.len() <= max {
            s
        } else {
            s.chars().take(max).collect()
        }
    }
}
