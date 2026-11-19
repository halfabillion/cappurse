# Reddit announcement draft — do not post until approved

Subreddit: https://www.reddit.com/r/tari/
A throwaway is acceptable (Fox, 2 Oct 2026). This text is a draft only.

**Title:** CapPurse — a spend-capped allowance vault on Tari Ootle (November MVP contest)

**Body:**

I built CapPurse for the Tari Council's November MVP contest.

It lets you deposit TARI, give a person or an agent a hard spending cap (with an optional period, expiry, and merchant allowlist), and revoke it at once. The helper never holds the funds: a payment goes from the purse vault straight to the merchant, or the whole transaction fails and nothing moves.

This is payer-side control, not a pay-by-link invoice, not a tip jar, and not an agent account the helper holds. The helper never takes custody.

The default demo runs in the browser with no wallet and no fee, and the Rust Ootle template is tested in the official engine.

- Demo: _[link, not published yet]_
- Code (MIT): _[link, not published yet]_
- Contest thread: https://community.tari.com/t/november-build-contest-thread-mvp/520

Feedback welcome.
