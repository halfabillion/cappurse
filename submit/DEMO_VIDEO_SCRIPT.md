# CapPurse — demo video script (about 90 seconds)

Status: local silent video recorded 18 Nov 2026 (Europe/London) at [`video/cappurse-guided-demo.mp4`](video/cappurse-guided-demo.mp4) (about 92 seconds) with stills in [`video/stills/`](video/stills/). Recapture with `python3 submit/record-demo-video.py` from `cappurse/`. Nothing uploaded or posted. A YouTube upload would be Ali's (his channel); the forum reply and Reddit post stay drafts until he says go.

Format: silent screen recording of the walletless demo with on-screen captions, so no voice is needed. An optional voice-over (Ali's own voice) is given in the right-hand column. Every caption below is taken from what the app really shows; nothing is staged.

Setup before recording: from `cappurse/`, run `python3 -m http.server 8765`, open http://127.0.0.1:8765/web/ at 1280×800, press **Reset** so the ledger reads "Alice holds 1,000 TARI, Mallory holds 50, and the purse is empty." Check `node web/demo.headless-check.js` prints `NARRATION_PHRASES 12/12` and `FAIL_LINES 0` first.

| Time | Screen | Caption (on screen) | Optional voice-over |
|---|---|---|---|
| 0:00–0:08 | Title area and the DEMO MODE banner | CapPurse: a spend-capped allowance vault for Tari Ootle. Demo mode, not connected to a wallet. | People hand a card to an assistant and hope. CapPurse makes the limit enforceable on Ootle. |
| 0:08–0:14 | Click **Run the guided demo** | One click runs a 7-step story. Every step checks the ledger. | — |
| 0:14–0:22 | Step 1 ticks | Alice deposits 1,000 TARI. Vault 1,000, Alice 0. | Alice funds the purse. |
| 0:22–0:32 | Step 2, allowance table | Bob gets a 100 TARI cap, cafe and vendor only, refilling every 50 epochs. | She gives Bob a cap, an allowlist and a refill period. |
| 0:32–0:40 | Step 3, balances | Bob pays the cafe 40. He still holds 0 himself, 60 remain, and he has a receipt. | Bob pays from the purse. He never takes custody. |
| 0:40–0:50 | Step 4, red narration | Bob tries 70 → blocked: "amount exceeds remaining cap". Nothing moved. | Over the cap, the transaction fails and nothing moves. |
| 0:50–0:57 | Step 5 | Unlisted shop → blocked: "merchant is not on the allowlist". | Merchants outside the list are refused. |
| 0:57–1:06 | Step 6 | 50 epochs pass, the cap refills to 100, Bob pays the vendor 100. | Each new period refills the cap. |
| 1:06–1:18 | Step 7 | Alice revokes Bob; his next spend is blocked. Mallory cannot withdraw ("Access Denied: owner only"). Alice takes back 860. | Revoke is instant, and only the owner can withdraw. |
| 1:18–1:22 | Final narration | All 11 of 11 checks passed. Final: Alice 860, cafe 40, vendor 100, vault 0. | — |
| 1:22–1:30 | Click the **How it maps to the template** tab, scroll slowly | The Rust template lists 12 public methods with caller rules; 15 Ootle engine tests and 17 JS rule tests pass. | The same rules ship as an Ootle template with engine tests. MIT licensed. |

End card (2 s): "CapPurse — MIT — Tari November 2026 Build Contest (MVP)". Add the public repo and demo links only once they exist; do not show the payout address in the video.

## Honesty checks before publishing

- Keep the DEMO MODE banner visible in the first shot.
- Do not claim the template is published on Esmeralda or mainnet (see `docs/ESMERALDA_FEASIBILITY.md`).
- Re-run both test suites the day of recording and update the counts if they change: `node --test web/engine.test.js` and `cd template && cargo test`.
