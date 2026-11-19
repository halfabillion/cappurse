# CapPurse — review pack for Ali

Prepared **Thursday 19 Nov 2026**, Europe/London, for the internal review target of **Friday 20 Nov 2026, 18:00 UK**. This file began as an internal review pack. The GitHub repository and GitHub Pages demo are now public; the Reddit announcement and forum reply had not been posted when this note was added.

Official contest cutoff: **Tuesday 1 December 2026, 00:00 UK**. Internal freeze target remains **Sunday 29 November 2026, 18:00 UK**.

## Video

- Path: [`submit/video/cappurse-guided-demo.mp4`](video/cappurse-guided-demo.mp4)
- Checked with `ffprobe` on 19 Nov 2026: plays as `h264`, **1280×800**, **92.2 seconds**, about 1.16 MB, silent with on-screen captions.
- Storyboard stills: [`submit/video/stills/`](video/stills/).
- Script: [`submit/DEMO_VIDEO_SCRIPT.md`](DEMO_VIDEO_SCRIPT.md).
- It is a recording of the walletless guided demo (DEMO MODE banner on screen). It is not connected to a wallet or to the Tari network. It has not been uploaded to YouTube or posted publicly.

To replay the same path locally: open `web/index.html`, or `python3 -m http.server 8765` and visit http://127.0.0.1:8765/web/, then click **Run the guided demo**. Recapture with `python3 submit/record-demo-video.py` if needed.

## Key points

CapPurse is a spend-capped allowance vault for Tari Ootle. An owner deposits TARI, grants a helper a hard cap (optional period, expiry, and merchant allowlist), and can revoke it at once. The helper pays a merchant from the purse vault in the same transaction and never takes custody. If a payment would break the cap, the transaction fails and nothing moves.

- Payer-side control, not a pay-by-link invoice, tip jar, or membership pass.
- Distinct from Allowance: funds stay in the owner's vault; the helper never holds the money.
- Local package is complete enough to review: README (what it is, run steps, test commands, demo / video link), MIT licence, threat model, and honest DEMO MODE labelling.
- Re-checked on 19 Nov 2026, Europe/London:
  - JavaScript engine: `node --test web/engine.test.js` — **17 passed, 0 failed**
  - Headless guided demo: `node web/demo.headless-check.js` — **11/11 ledger checks**, **12/12 narration phrases**, exit 0
  - Rust Ootle engine: `cd template && cargo test --test engine` — **15 passed, 0 failed**
- The Rust template is **not** published on Esmeralda or mainnet. Recommendation stays: do not publish under current holds (see `docs/ESMERALDA_FEASIBILITY.md`).
- Planned free host, after your go: GitHub Pages from a public `halfabillion` repo of the **`cappurse/` tree only** — never the parent event folder, which contains the prize wallet (`docs/HOSTING_PLAN.md`).

## Draft submission fields

These are drafts only. Links that do not exist yet are left as placeholders. Do not post until you say so.

**Forum reply** (one post on https://community.tari.com/t/november-build-contest-thread-mvp/520). Full draft: [`FORUM_POST_DRAFT.md`](FORUM_POST_DRAFT.md).

| Field | Draft value |
|---|---|
| Project name | CapPurse — a spend-capped allowance vault on Tari Ootle |
| Code (public, OSI licence) | _[public GitHub link — repo is still local until you approve]_ |
| Running MVP app | _[GitHub Pages or other free static host — not published yet]_ |
| Description | See the "What it is" paragraph in the forum draft (payer-side cap, helper never takes custody, contrast with Allowance / invoices / tip jars). |
| Tari payment address | `128qiTtpHKyiabvrFTP1gHwRKdNQfYbJxQd32PStYMzVfRoqq2xVxZYKRSMMYAJekFeEiyFda3ECkmwpmaTDP8x1Z3M` (mainnet Minotari one-sided receive address already recorded in the contest payout record (public one-sided Minotari receive address only)) |
| Public announcement | _[Reddit r/tari / Medium / YouTube / Bluesky — draft only, not posted. X is not accepted this month.]_ |

**Reddit announcement draft** (if that is the channel): [`ANNOUNCEMENT_DRAFT_REDDIT.md`](ANNOUNCEMENT_DRAFT_REDDIT.md). Title: "CapPurse — a spend-capped allowance vault on Tari Ootle (November MVP contest)".

Account for the forum post: a community.tari.com login (bot email `batchandledger@mail.grokbot.com` is allowed). Not created yet.

## What needs your go

Nothing below has been done. Please do not paste seeds, passwords, or private keys into chat.

**For this review (no submit yet):**

1. Have you already backed up the prize-wallet seed and password, out of band, from this computer? If not, please do that yourself. Without a backup, a lost machine means any future XTM prize to this address cannot be recovered.
2. Should the contest payout use the existing mainnet Minotari one-sided receive address already in `ADDRESS.txt` and in the forum draft?

**Before submit (target: Sunday 29 Nov 2026, 18:00 UK):**

3. May we create a public GitHub repository under your `halfabillion` account containing only the `cappurse/` tree (MIT, Ali Ghaedi), and enable free GitHub Pages for the walletless demo?
4. May we open a free community.tari.com account with the bot email `batchandledger@mail.grokbot.com` when it is time to post, or do you already have an account you want to use?
5. Which announcement channel should we use: Reddit r/tari (a throwaway is officially acceptable), Medium, YouTube, or Bluesky? (X is not accepted this month.)
6. If the channel is Reddit, Medium, or Bluesky, may we create a free throwaway/account for that post when you approve the text, or will you post the approved draft yourself?
7. If you prefer YouTube, will you upload this 92-second silent captioned demo from `submit/video/cappurse-guided-demo.mp4`? We cannot upload to YouTube in your name without you.
8. When the package is frozen (links, description, payment address, announcement URL), do you approve posting the announcement and then the single forum reply? (Two separate yeses are fine.)

**Optional, not required to enter:**

9. Keep the submitted app as an honest walletless DEMO MODE (recommended), or later approve a fresh local Esmeralda wallet, a confirmed no-KYC faucet, and testnet signing? Current recommendation is not to publish to Esmeralda under present holds.
10. Is the standing rule still that public submission and announcement text must not mention AI?

## Holds still in force

No spend. No mainnet wallet moves or signing. The public GitHub repository and GitHub Pages demo are now live. No Reddit or forum posts, and no final contest submission, until those browser steps are done.
