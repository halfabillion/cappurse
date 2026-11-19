# Esmeralda publish — feasibility only (do not publish)

Assessed Saturday 14 November 2026, about 12:30 UK, from official Tari docs and the public forum. This note is a plan. It does not publish a template, create a wallet, claim a faucet, burn Minotari, or sign anything.

## Question

Can we publish the CapPurse template to the Esmeralda testnet for free, without spend, without a faucet KYC or identity check, and without opening a new personal account?

## Recommendation

**No. Do not attempt an Esmeralda publish under the current holds.**

The submitted judge path should stay the walletless DEMO MODE app, which the contest already accepts. Revisit a testnet publish only if Ali later approves all of: a fresh local Esmeralda wallet that is not the prize wallet, a confirmed funded faucet with no KYC, and explicit permission to sign a *testnet* fee transaction.

## What official docs require

Publishing is a signed `PublishTemplate` transaction that **pays a fee in tTARI** (`TTARI` in the docs):

- [Publishing Templates](https://ootle.tari.com/guides/publishing-templates/) — compile to WASM, then use the Ootle Wallet Web UI: pick a fee account that already holds `TTARI`, upload the `.wasm`, estimate the fee, and publish. “You’ll need some `TTARI` in your wallet to pay for transaction fees.” The fee rises with binary size (quadratic above a 96 KiB allowance, plus compile/load costs).
- [Wallet Setup](https://ootle.tari.com/guides/setup-a-wallet/) — run `tari_ootle_walletd --network esme`, create a local default account (a key and address), then fund it. The official funding paths are:
  1. Burn Minotari on the base layer and claim it as TARI (see [Burn Minotari for TARI](https://ootle.tari.com/guides/burn-minotari/)).
  2. Click “Claim Testnet Funds” in the wallet UI **if** the built-in faucet holds funds.
- The same wallet-setup page is explicit that **public testnets start with an empty faucet**, so the button shows “Faucet Empty” until someone deposits into it. A *local* network faucet is pre-funded (1,000 tTARI); Esmeralda is not.

The official burn path ([Burn Minotari for TARI](https://ootle.tari.com/guides/burn-minotari/)) needs a *funded* `minotari_console_wallet` on the **same network** (`--network esmeralda`, not mainnet) plus a running Ootle daemon, then a burn and a claim. A burn is a signed L1 transaction and is irreversible if the claim key is wrong.

No official Tari page reviewed for this note asks for KYC, a passport, or a Tari Labs website login in order to publish. The wallet daemon is local software. Its default UI auth is a local WebAuthn passkey ([Wallet Setup, §5](https://ootle.tari.com/guides/setup-a-wallet/)), not an identity check.

## What the live faucet situation adds

After the Esmeralda reset on 2 Nov 2026, builders reported the official network faucet (`IFaucet::take_faucet_funds`) at balance zero, and the older Caravel faucet component gone. Source: [Esmeralda faucet is empty after the reset](https://community.tari.com/t/esmeralda-faucet-is-empty-after-the-reset-test-ttari-to-re-publish-a-contest-entry/530) (4 Nov 2026). Fox pointed people at a faucet-then-burn path; a community faucet was also offered.

There is a third-party community faucet, [TariTracker · Ootle Faucet](https://testnet-faucet.taritracker.com/), which says it sends Esmeralda L2 testnet TARI if you paste a receive address (one claim per wallet and connection per hour). The page, as fetched on 14 Nov 2026, did not ask for a login, email, or identity document. It is **not** an official Tari Labs faucet, its balance changes, and it is not a guarantee.

We did not claim from it, and we should not treat it as a standing “free official path.”

## How this maps to our holds

| Requirement | Finding |
|---|---|
| Spend | Official publish **always spends a tTARI fee**. Those tokens have no monetary value, but a fee is still paid, and the official fallback (burn Minotari) is a signed L1 burn. We must never use or sign with the mainnet prize wallet. |
| Faucet KYC / identity check | Official docs describe no KYC. The built-in Esmeralda faucet is often empty. The community faucet showed no KYC on 14 Nov, but it is third-party and can change. |
| New personal account | No Tari Labs website account is required. A local Ootle testnet wallet (new key) *would* be required, plus a local passkey for the daemon UI. That is not a “personal account” in the forum/GitHub sense, but it is still a new wallet we have not been told to create or sign with. |

Our hard limits for this contest also include **no wallet signing**. A publish cannot be done without signing.

The November MVP rules do not require a live template. Several current entries ship a clearly labelled walletless demo, which is already our default judge path.

## If this is ever revisited (not now)

1. Get an explicit yes from Ali to create a **new local Esmeralda** Ootle wallet (and, if needed, a separate Esmeralda L1 wallet). Never touch `wallet/` prize secrets or the mainnet Minotari address.
2. Check whether the official “Claim Testnet Funds” button actually has a balance, or whether the community faucet still pays with no KYC.
3. If and only if a free, no-KYC faucet funds that testnet wallet, estimate the publish fee, then ask Ali before signing.
4. Only claim a network publish in the README or forum post once an explorer template address exists.

Until then: do not publish.
