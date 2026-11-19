> **Publication note (Thursday 19 Nov 2026, Europe/London).** This status file was written before the public repo went live. The source and the walletless demo are now at https://github.com/halfabillion/cappurse and https://halfabillion.github.io/cappurse/web/. The r/tari announcement and the community.tari.com forum reply had not been posted when this note was added.

# CapPurse — status (Saturday 14 Nov 2026, 12:30 UK)

**Update, Thursday 19 Nov 2026, Europe/London.** The local review pack is ready for Ali: [`submit/REVIEW_FOR_ALI.md`](submit/REVIEW_FOR_ALI.md). Video `submit/video/cappurse-guided-demo.mp4` plays (ffprobe: 92.2s, 1280×800, h264). Re-checked tests: JS 17/17, headless demo 11/11 checks and 12/12 phrases, cargo engine 15/15. README now also lists the headless demo command. No publish, push, post, or submit until Ali's go.

Local build only. Nothing has been published, posted, pushed, or submitted. No spend, no mainnet wallet moves, no signing.

## Concept

**CapPurse** is a spend-capped allowance vault on Tari Ootle. An owner deposits TARI, grants a helper (a person, employee, or agent) a hard cap with an optional period, expiry, and merchant allowlist, and can revoke it at once. The helper pays a merchant from the purse vault in the same transaction; they never take custody. If a payment would break the cap, the call fails and nothing moves.

One-line pitch: **give anyone a spending cap they cannot exceed.**

This is payer-side control, not a merchant invoice, tip jar, or membership pass. The closest new competitor (see field below) is Allowance (`ootle-allowance`), which gives an AI agent its *own* constrained account (per-payment cap, per-epoch budget, payment-count limit, reserved out-of-policy requests, panic freeze, MCP server). CapPurse is a different model: funds stay in the owner's vault and move vault-to-merchant under a remaining cap; the helper never holds the money; the owner can withdraw (spendable is `min(remaining, vault)`); a receipt NFT is minted to the helper; the story is parents, petty cash, and assistants, not only agents. We will not borrow their code.

## Official deadline and rules (re-checked live, 14 Nov 2026 ~02:00 UK)

Sources, still live:

- Contest thread: https://community.tari.com/t/november-build-contest-thread-mvp/520 (opened by Fox, 1 Nov 2026, 13:23 UK)
- Standing rules: https://community.tari.com/t/ootle-launch-date-and-launch-contest-rules/323

**Cutoff: Tuesday 1 December 2026, 00:00 UK** (00:00 UTC on 1 Dec — "the start of the first day of the following month, UTC"). That is the end of Monday 30 November 2026 in the UK. UK is on GMT (UTC+0) in late November. The official pages have not changed this.

Internal target, unchanged: freeze and be ready to submit by **Sunday 29 November 2026, 18:00 UK**. That leaves more than 24 hours of buffer.

As of this status file there are about **16 days 11 hours** to the official cutoff, and about **15 days 5 hours** to the internal target.

## Judging and how to submit (unchanged on the live pages)

- Theme: an MVP "you could go to market with today and start finding users for." Judging is "likely to get more subjective." Minor changes on existing projects score worse. November allows building on earlier open-source contest code; we still write original code and will not reskin any November entry, including Allowance.
- Voted on by the Tari Council. No published numeric rubric.
- Winners announced the following month (December 2026). Exact day not published.
- Prizes in XTM on the Tari base layer: 1,000,000 / 500,000 / 250,000 XTM. Payout goes to the Tari payment address in the forum post. USD value is not guaranteed; liquidity is thin.
- KYC is not published for this contest.

One forum reply on the November thread must include all five of:

1. A publicly viewable link to the code (OSI licence on the **source**; MIT is already in the repo).
2. A link to the running MVP app.
3. A description of the project.
4. A Tari payment address (mainnet Minotari one-sided receive address; already created and recorded in `ADDRESS.txt` at the event folder root, and already filled in the forum draft).
5. A link to a **public announcement** on **Bluesky, Reddit, Medium or YouTube** (X is not accepted this month). A Reddit throwaway on r/tari is acceptable.

Also: only one post per submission (updates go in that post); do not discuss entries in the contest thread; a community.tari.com account is required to post; coding agents are allowed but judges may score code quality. Public materials will not mention AI, per standing team policy.

Code must be new as of the theme announcement (1 Nov 2026, 13:23 UK). This repo was started 12 Nov 2026.

## What works now (verified this session)

End-to-end local path is green:

- Rust `#[template]` on `tari_template_lib` 0.40 compiles to `wasm32-unknown-unknown`.
- Official engine tests: `cd template && cargo test --offline --test engine` — **15 passed, 0 failed** (about 4s on a warm cache). Covers exact spend and receipt NFT; over-cap; allowlist; expiry; revoke and owner withdraw; period refill; one-shot does not refill; non-helper cannot spend; non-owner cannot grant or withdraw; zero cap; insufficient vault; allowlist update; lowering cap clamps remaining; wrong-asset (non-TARI) deposit.
- JavaScript engine (browser/Node mirror of the same rules): `node --test web/engine.test.js` — **17 passed, 0 failed**.
- Guided Alice/Bob demo: click **Run the guided demo** at `web/index.html`, or `node web/demo.headless-check.js` — **11/11 ledger checks** and **12/12 required narration phrases**, exit 0. Each step asserts ledger state and narrates the result in plain words; expected rejections are checked; Mallory cannot withdraw.
- Walletless UI (updated 14 Nov ~12:30 UK): clearer cap meter (remaining vs cap, used amount, spendable hint, revoked/expired state), a readable activity log with plain-language badges, a proper single-column mobile layout below 880px, a “What just happened” narration panel, and a guided demo that narrates each pass or fail in plain words. Clearly labelled **DEMO MODE**. The template is **not** claimed as published on Esmeralda or mainnet.
- MIT licence, README five-minute run guide, `docs/THREAT_MODEL.md`, `docs/ESMERALDA_FEASIBILITY.md` (recommendation: **do not publish** under current holds), `docs/HOSTING_PLAN.md` (recommendation: GitHub Pages from a public `halfabillion` repo of `cappurse/` only, after Ali’s go). First drafts under `submit/` (not posted) already use 15 engine tests, 17 JS tests, and the Allowance contrast.

How to re-run on Linux, from `cappurse/`:

```bash
python3 -m http.server 8765          # then http://127.0.0.1:8765/web/
node --test web/engine.test.js
node web/demo.headless-check.js
cd template && cargo test --offline  # first full build is longer; needs wasm32-unknown-unknown
```

The official mainnet Minotari prize wallet already exists (created 12 Nov with Tari Suite v6.2.0). The seed and password are stored privately, outside this public repository, and must never be printed or pasted into chat.

## Live field (re-checked 14 Nov 2026 ~02:00 UK)

Twelve visible submissions on the contest thread (five were listed on 12 Nov; the previously hidden post #7 is now readable). Three paid places. We will not clone any of these.

| # | Entry | Author | What it is | Notes |
|---|---|---|---|---|
| 3 | QuietTicket | @hycorange, 3 Nov | Claim-ticket silent voting | Walletless demo |
| 4 | Ootle Pass | @rajeshmullippa, 5 Nov | Paid memberships / expiring passes | Walletless demo; author disclosed an AI agent |
| 5 | Ootip | @GeiserX, 9 Nov | Tip jars with maintainer splits | Live on Esmeralda |
| 6 | Signal Desk | @Og.boy, 10 Nov | Sealed trading calls | Live on Ootle mainnet; strong competitor on "live" evidence |
| 7 | Ootle Lockbox | @Zein, 10 Nov | Verifiable time-locks | Was hidden on 12 Nov; now visible; later also used by #13 |
| 8 | OotleInvoice | @GenieBuilds, 12 Nov | Pay-by-link invoices, receipt NFTs | Walletless demo |
| 9 | **Allowance** | @boowenchen, 12 Nov 11:58 UK | Spend-limited *accounts* for AI agents | Closest overlap. Live on Esmeralda; MCP server; 14 engine tests. Distinct model (see Concept). |
| 10 | Skydrop + ATProto | @0xhra, 12 Nov | Bluesky identity, tips, campaign rewards | Live apps |
| 11 | Specter | @yezo4, 12 Nov | Transaction privacy inspector | Live app; MIT |
| 12 | hidebox | @c7b, 12 Nov | Sell encrypted files for TARI | Claims Ootle mainnet |
| 13 | Launch Commitments | @Zein, 13 Nov | Fixed-supply token launches + Lockbox allocations | Live on mainnet |
| 14 | Stake | @iammzee, 13 Nov | Private goal, referee, locked TARI | Walletless demo; 20 engine tests |

The field is more crowded than on 12 Nov. We should not try to beat Signal Desk / Lockbox / Launch Commitments on "already live on mainnet" unless a later free Esmeralda publish actually works. We compete on a clear, usable payer-side cap product, honest demo, and tight tests, and on a clean contrast with Allowance.

## Remaining milestones (from PLAN.md)

- **M1 (template + tests + README guide):** complete.
- **M2 (17–20 Nov) — complete for this slice:** UI polish (meter, activity log, mobile layout, plain-word guided narration) is in. Submit drafts were already refreshed. Esmeralda: assessed in `docs/ESMERALDA_FEASIBILITY.md` — **do not publish** under current holds (fee + signing; official faucet often empty; never use the prize wallet). Hosting: assessed in `docs/HOSTING_PLAN.md` — GitHub Pages after approval; host nothing now.
- **M3 (21–25 Nov) — packaging:** final README and honesty-banner review; screenshots or a short silent recording of the guided path; prepare (but do not publish) a `halfabillion` GitHub repo of the **`cappurse/` tree only** — never the parent event folder, which contains the prize wallet; GitHub Pages ready to flip on once approved, per `docs/HOSTING_PLAN.md`.
- **M4 (26–29 Nov) — freeze:** 26 Nov feature freeze; 27 Nov full local QA; 28 Nov final forum and announcement drafts with links and the payment address; **29 Nov 18:00 UK** package ready, then wait for the go-ahead. Do not post.

## Holds (still in force)

No spend. No mainnet wallet moves or signing. No public repo or push. No posts (forum, Reddit, Bluesky, Medium, YouTube, X). No final submission. No new personal accounts until approved (bot email is allowed later for a free forum signup). Optional Esmeralda work stays testnet/local and unclaimed until explorer evidence exists.

## Every item that needs Ali — as exact questions

Nothing in this list is requested as a go-ahead tonight. The build can continue locally without them. Please do not paste seeds, passwords, or private keys into chat.

### Needed soon (not a submit step)

1. Have you already backed up the prize-wallet seed and password, out of band? If not, please do that yourself and do not paste them here. Without a backup, a lost machine means any future XTM prize to this address cannot be recovered.

2. Should the contest payout use the existing mainnet Minotari one-sided receive address already recorded in `ADDRESS.txt` and filled in `cappurse/submit/FORUM_POST_DRAFT.md`?

### Needed before submit (target: by Sunday 29 Nov 2026, 18:00 UK)

3. May we create a public GitHub repository under your `halfabillion` account containing only the `cappurse/` tree (MIT, Ali Ghaedi), and enable free GitHub Pages for the walletless demo?

4. May we open a free community.tari.com account with the bot email `batchandledger@mail.grokbot.com` when it is time to post the entry, or do you already have an account you want to use?

5. Which announcement channel should we use: Reddit r/tari (a throwaway is officially acceptable), Medium, YouTube, or Bluesky? (X is not accepted this month.)

6. If the channel is Reddit, Medium, or Bluesky, may we create a free throwaway/account for that post when you approve the text, or will you post the approved draft yourself?

7. If you prefer YouTube, will you upload a short silent (or voiced) recording of the guided demo from a file we prepare? We cannot upload to YouTube in your name without you.

8. When the package is frozen (links, description, payment address, announcement URL), do you approve posting the announcement and then the single forum reply on the November contest thread? (Two separate yeses are fine: first the announcement, then the forum post.)

### Optional, not required to enter

9. `docs/ESMERALDA_FEASIBILITY.md` recommends **not** publishing to Esmeralda under current holds (a tTARI fee and a signature are required; the official faucet is often empty; the prize wallet must not be used). Do you want to keep the submitted app as an honest walletless DEMO MODE (recommended), or later approve a fresh local Esmeralda wallet, a confirmed no-KYC faucet, and testnet signing?

10. Is the standing rule still that public submission and announcement text must not mention AI?
