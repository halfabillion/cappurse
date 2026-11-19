> **Update, Thursday 19 Nov 2026, Europe/London.** GitHub Pages is served from the `main` branch root of the public `halfabillion/cappurse` repository (no Actions workflows). The running demo is https://halfabillion.github.io/cappurse/web/. The pages below are the original plan and comparison.

# Hosting plan for the running MVP app (plan only — host nothing)

Assessed Saturday 14 November 2026, about 12:30 UK. This is a plan for the “link to the running MVP app” required by the November contest rules. Nothing has been hosted, no repository has been created or made public, and no vendor account has been opened.

The demo is a static walletless site (`web/index.html`, `web/styles.css`, `web/engine.js`, `web/app.js`). It needs no build step, no server, and no secrets. Footer links point at `../README.md` and `../LICENSE`, so the site should be served from the **repository root** with the app at `/web/`, matching the local `python3 -m http.server` path already documented in the README.

## Recommendation

**GitHub Pages from a public `halfabillion` repository that contains only the `cappurse/` tree**, served from the repository root, app URL of the form `https://halfabillion.github.io/<repo>/web/`.

Cost is $0. It uses Ali’s existing GitHub account, so it does not need a new hosting vendor. The contest already requires a publicly viewable source link, and GitHub Free Pages is included for public repositories. Several current November entries use the same pattern. Do not turn Pages on, and do not make the repo public, until Ali approves both (see `STATUS.md`).

Never publish the parent event folder (`tari-mvp/`), which contains the prize wallet.

## Options compared

| Option | Cost | Account needed | Must the repo be public? | Notes |
|---|---|---|---|---|
| **GitHub Pages** (recommended) | $0 on GitHub Free | Existing `halfabillion` GitHub account. No extra vendor. | **Yes**, on GitHub Free. Pages from a *private* repo needs a paid GitHub plan (Pro / Team / Enterprise). | Official: [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Project site URL is `https://<user>.github.io/<repo>/`. Soft limits: 1 GB site, 100 GB/month bandwidth, 10 builds/hour. The published site is public even if a paid plan allowed a private repo. |
| Cloudflare Pages | $0 on the Cloudflare Free plan (500 builds/month, 20,000 files, 25 MiB per file, 100 projects) | A **new Cloudflare account** unless Ali already has one. Can connect GitHub or upload directly. | **No** — Cloudflare can build from a private Git repository. | Official: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/). Useful fallback if we ever needed a private source repo, but the contest wants the source public anyway, and a Cloudflare signup is an extra personal account. |
| Netlify | $0 on the Free plan (300 credits/month, hard cap, no auto-charge; site pauses if credits run out) | A **new Netlify account**. Can deploy from Git or a drag-and-drop upload. | Not required. Netlify describes sites as “private by default until you publish.” | Official: [Netlify Pricing](https://www.netlify.com/pricing), [Credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/). Extra vendor account; credit cap is a mild reliability risk for a contest link. |

## How GitHub Pages would be switched on (later, after approval)

1. Create a new public repo under `halfabillion` (suggested name: `cappurse`) containing **only** `cappurse/` (MIT, author Ali Ghaedi). Keep `wallet/`, `ADDRESS.txt`, and the event-level tools out of it.
2. In the repo settings, enable GitHub Pages with the source set to the default branch, **root** of the branch (not the `/web` folder). That keeps `/web/` and the README/Licence footer links working.
3. Confirm in a private preview that `…/web/` loads the demo, “Run the guided demo” finishes 11/11, and the honesty banner is visible.
4. Put that `/web/` URL in the forum post and the announcement draft. Only then make the repo public and flip Pages on, once Ali has said yes to both.

## What this plan will not do

- Host or deploy anything now.
- Create a GitHub, Cloudflare, or Netlify resource.
- Put the prize wallet, seeds, or `ADDRESS.txt` on a hosting repo (the payment address belongs in the forum post, not on Pages).
