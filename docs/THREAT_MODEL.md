# CapPurse threat model (short)

What we are protecting: an owner's TARI in a purse vault, and the promise that a helper cannot spend more than the remaining cap, past expiry, after revoke, or to a merchant off the allowlist.

## Trust

- The Ootle engine enforces the template. If the engine is honest, panics roll back the whole transaction.
- The owner key can grant, revoke, change caps and allowlists, and withdraw. A stolen owner key is a total loss. That is stated, not hidden.
- Helpers never take custody. A stolen helper key can only spend within the current remaining cap, to allowlisted merchants, until the owner revokes.
- Merchants are ordinary accounts with a `deposit` method. A wrong merchant address is a payment to the wrong person; the allowlist is the mitigation.

## What is public

Vault balances, cap, remaining, allowlist, spend amounts and memos are public. This is a consequence of revealed vault deposits. Private delegated spend is out of scope.

## Checks we rely on

- Access rules: grant/revoke/set_cap/set_allowlist/withdraw are owner-only. `spend` and `deposit` are public and authorised inside the method (signer must be the helper; deposit must be TARI).
- The receipt resource is mintable only by this component (address allocation, mint rule locked). Helpers cannot mint a fake receipt.
- Amounts must be greater than zero. Memos are length-capped. Over-cap, expired, revoked, unlisted, and under-funded spends panic, so nothing moves.
- Period refill resets to one cap, not to stacked missed periods.

## What we do not claim

- The template is unaudited.
- The default demo is a browser simulation.
- The cap is a ceiling: the owner can withdraw, and spendable is `min(remaining, vault)`.
- We do not protect against owner malice toward a helper (the owner can revoke or drain the vault).
- We do not hide amounts, and we do not implement refunds or dispute flow.
