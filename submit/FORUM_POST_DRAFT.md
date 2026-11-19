# Forum reply draft — do not post until approved

Post as **one reply** on https://community.tari.com/t/november-build-contest-thread-mvp/520
Account: a community.tari.com login (bot email batchandledger@mail.grokbot.com is allowed). Not created yet.

---

## CapPurse — a spend-capped allowance vault on Tari Ootle

- Code (MIT): _[public GitHub link — repo is still local until submit is approved]_
- App (walletless demo): _[GitHub Pages or other free static host — not published yet]_
- Announcement: _[Reddit r/tari / Medium / YouTube / Bluesky link — draft only, not posted]_
- Tari payment address: `128qiTtpHKyiabvrFTP1gHwRKdNQfYbJxQd32PStYMzVfRoqq2xVxZYKRSMMYAJekFeEiyFda3ECkmwpmaTDP8x1Z3M`

**What it is.** People already hand a card or a wallet to an assistant, an employee, or an agent, and then hope they do not overspend. CapPurse makes the ceiling enforceable. An owner deposits TARI, grants a helper a hard cap (optional period, expiry, and merchant allowlist), and can revoke it at once. The helper pays a merchant from the purse vault in the same transaction; they never take custody. If a payment would break the cap, the transaction fails and nothing moves.

**Why it is not a reskin.**

- vs OotleInvoice: that is merchant-side pay-by-link. CapPurse is payer-side spending control. There is no invoice object.
- vs Ootip: that splits tips to maintainers. We cap delegated spend.
- vs Ootle Pass: that sells memberships. We do not sell access.
- vs Allowance: that gives an AI agent its own constrained account (caps, budgets, reserved approval requests, panic freeze, MCP). CapPurse is a non-custodial vault: the helper never holds the funds; payment goes vault-to-merchant in the same transaction.

**What's built and tested.**

- Rust `#[template]` on `tari_template_lib` 0.40, compiled to `wasm32-unknown-unknown` (release WASM about 253 KiB).
- 15 tests in the official Ootle engine via `tari_template_test_tooling` 0.53: exact spend pays the merchant and issues a receipt NFT; over-cap, unlisted merchant, expiry, revoke, insufficient vault, and wrong-asset deposit rejected; period refill restores the cap; one-shot does not refill; non-helper cannot spend; non-owner cannot grant or withdraw; zero cap rejected; allowlist update; lowering the cap clamps remaining; owner withdraw after revoke.
- Walletless web MVP: a clearly labelled DEMO MODE that mirrors the same rules in the browser (17 Node tests on the engine), with a one-click Alice/Bob guided path that narrates 11/11 PASS/FAIL checks. No wallet, faucet, or fee required.

**Honest limits.** The published app is a browser simulation and is not connected to a wallet or the Tari network. The template has not been published to Esmeralda or mainnet and is not audited. Spend amounts and memos are public. The cap is a ceiling, not a reserved lock: spendable is `min(remaining, vault)`. Refunds and private delegated spend are out of scope.

**Next.** Wallet-connected spend flow, then a network publish if we can do it without a paid fee.
