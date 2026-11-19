# CapPurse

A spend-capped allowance vault for [Tari Ootle](https://ootle.tari.com/). An owner deposits TARI, grants a helper a hard cap (optional period, expiry, and merchant allowlist), and can revoke it at once. The helper pays merchants from the purse vault; they never take custody. If a payment would break the cap, the transaction fails and nothing moves.

Built as an MVP entry for the [Tari November 2026 Build Contest](https://community.tari.com/t/november-build-contest-thread-mvp/520). MIT licensed. Author: Ali Ghaedi.

**Demo mode.** The live walletless demo is at [halfabillion.github.io/cappurse/web](https://halfabillion.github.io/cappurse/web/). The same app is in this repo at [`web/index.html`](web/index.html). It is not connected to a wallet or to the Tari network. The Rust template is the on-chain implementation; it is not claimed as published on Esmeralda or mainnet unless this README says so and links an explorer.

## Why it exists

People already hand a card or a wallet to an assistant, an employee, or an agent, and then hope they do not overspend. CapPurse makes the ceiling enforceable: a helper physically cannot spend more than the remaining cap.

This is not a pay-by-link invoice (merchant-side), not a tip jar, and not a membership pass. It is payer-side spending control.

## What's in this repo

- `template/` — Rust Ootle `#[template]` on `tari_template_lib` 0.40, with official-engine tests.
- `web/engine.js` — the same rules in JavaScript, used by the demo and by Node tests.
- `web/index.html` — walletless demo, including a one-click Alice/Bob guided path.
- `docs/THREAT_MODEL.md` — short threat model.
- `docs/ESMERALDA_FEASIBILITY.md` — why we are not publishing the template to Esmeralda under current holds.
- `docs/HOSTING_PLAN.md` — how the free GitHub Pages host is set up.
- Live demo: https://halfabillion.github.io/cappurse/web/

## Run the demo

Open `web/index.html` in a browser, or from this directory (the repo root):

```bash
python3 -m http.server 8765
```

Then visit http://127.0.0.1:8765/web/ and click **Run the guided demo**. Each step checks the ledger and narrates a pass or fail in plain words; a clean run ends with all 11 checks passed. The same path runs headless with `node web/demo.headless-check.js` (exit code 0 means every check and required narration phrase passed).

## Demo video

A silent, captioned recording of that same guided demo is at [`submit/video/cappurse-guided-demo.mp4`](submit/video/cappurse-guided-demo.mp4) (about 92 seconds, no voice). Storyboard stills are in [`submit/video/stills/`](submit/video/stills/). The walkthrough follows [`submit/DEMO_VIDEO_SCRIPT.md`](submit/DEMO_VIDEO_SCRIPT.md). The page is in demo mode throughout — not connected to a wallet or to the network — and the first shot keeps the DEMO MODE banner on screen. The file lives in this public repository. It has not been uploaded to YouTube.

To recapture it locally (headless Playwright, system Chrome, and ffmpeg; no wallet):

```bash
python3 submit/record-demo-video.py
```

## Run the tests (Linux)

JavaScript rules (fast, no Rust toolchain):

```bash
node --test web/engine.test.js
```

This runs 17 tests and should print `tests 17` / `pass 17`.

Headless guided demo (the same 11 ledger checks and 12 narration phrases as the video):

```bash
node web/demo.headless-check.js
```

Exit code 0 means every check and required phrase passed.

Ootle engine tests (needs Rust stable and the `wasm32-unknown-unknown` target):

```bash
rustup target add wasm32-unknown-unknown
cd template && cargo test
```

The first Rust build compiles the Ootle engine and takes a few minutes (about 1.5 minutes on a warm crate cache; longer when crates are downloaded for the first time). It runs 15 engine tests.

## How the template works

- `new` — the signer becomes the owner. A receipt NFT resource is created that only this component can mint.
- `deposit(bucket)` — anyone can top up, TARI only.
- `grant` / `set_cap` / `set_allowlist` / `revoke` / `reactivate` / `withdraw` — owner only.
- `spend(amount, merchant, memo)` — the helper. Pays `merchant.deposit` in the same transaction, cuts remaining, returns a receipt NFT. Period refill, if due, happens first (`Consensus::current_epoch()`).
- Invalid or unauthorised calls panic and roll back.

Spendable, as shown in the UI, is `min(remaining, vault)`. The cap is a ceiling, not a reserved lock on the owner's funds.

## Honest limits

The template is not audited. Amounts and memos are public. There are no refunds, no partial payments, and no multi-owner boards. Receipts prove a spend; they do not reverse one.

## Licence

[MIT](LICENSE). Copyright (c) 2026 Ali Ghaedi.
