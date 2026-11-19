"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CapPurseEngine, parseTari, formatTari, MICRO } = require("./engine.js");

function setup() {
  const e = new CapPurseEngine();
  e.createAccount("alice", "Alice", parseTari("1000"));
  e.createAccount("bob", "Bob", 0n);
  e.createAccount("cafe", "Cafe", 0n);
  e.createAccount("vendor", "Software vendor", 0n);
  e.createAccount("shop", "Unlisted shop", 0n);
  e.createAccount("mallory", "Mallory", parseTari("50"));
  const purse = e.createPurse("alice");
  return { e, purse };
}

function balances(e) {
  const out = {};
  for (const [id, a] of e.accounts) out[id] = a.balance;
  return out;
}

test("exact spend forwards funds, cuts remaining, and issues a receipt", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", {
    label: "Assistant",
    cap: parseTari("100"),
    periodEpochs: 50n,
    allowlist: ["cafe", "vendor"],
  });

  const receipt = e.spend("bob", purse, parseTari("40"), "cafe", "lunch");
  assert.equal(receipt.amount, parseTari("40"));
  assert.equal(receipt.merchantId, "cafe");
  assert.equal(receipt.memo, "lunch");
  assert.equal(e.account("cafe").balance, parseTari("40"));
  assert.equal(e.account("alice").balance, 0n);
  assert.equal(e.vaultBalance(purse), parseTari("960"));
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("60"));
  assert.equal(e.allowanceOf(purse, "bob").spendable, parseTari("60"));
  assert.equal(e.account("bob").balance, 0n); // helper never takes custody
  assert.equal(e.account("bob").receipts.length, 1);
  assert.ok(e.events.some((ev) => ev.topic === "CapPurse.Spent"));
});

test("over-cap spend is rejected and balances are unchanged", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", { cap: parseTari("100"), allowlist: ["cafe"] });
  e.spend("bob", purse, parseTari("40"), "cafe", "first");
  const before = {
    vault: e.vaultBalance(purse),
    cafe: e.account("cafe").balance,
    remaining: e.allowanceOf(purse, "bob").remaining,
    receipts: e.account("bob").receipts.length,
  };
  assert.throws(
    () => e.spend("bob", purse, parseTari("70"), "cafe", "too much"),
    /exceeds remaining cap/
  );
  assert.equal(e.vaultBalance(purse), before.vault);
  assert.equal(e.account("cafe").balance, before.cafe);
  assert.equal(e.allowanceOf(purse, "bob").remaining, before.remaining);
  assert.equal(e.account("bob").receipts.length, before.receipts);
});

test("unlisted merchant is rejected", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", { cap: parseTari("100"), allowlist: ["cafe", "vendor"] });
  const before = { ...balances(e), vault: e.vaultBalance(purse) };
  assert.throws(
    () => e.spend("bob", purse, parseTari("10"), "shop", "nope"),
    /not on the allowlist/
  );
  assert.equal(e.vaultBalance(purse), before.vault);
  assert.equal(e.account("shop").balance, 0n);
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("100"));
});

test("empty allowlist means any merchant", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("100"));
  e.grant("alice", purse, "bob", { cap: parseTari("100"), allowlist: [] });
  e.spend("bob", purse, parseTari("10"), "shop", "ok");
  assert.equal(e.account("shop").balance, parseTari("10"));
});

test("expired allowance is rejected", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", {
    cap: parseTari("100"),
    expiresAtEpoch: 10n,
    allowlist: ["cafe"],
  });
  e.setEpoch(10n);
  assert.throws(
    () => e.spend("bob", purse, parseTari("10"), "cafe"),
    /expired/
  );
  assert.equal(e.account("cafe").balance, 0n);
  assert.equal(e.allowanceOf(purse, "bob").expired, true);
  assert.equal(e.allowanceOf(purse, "bob").spendable, 0n);
});

test("revoked helper cannot spend; funds stay in the vault", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", { cap: parseTari("100"), allowlist: ["cafe"] });
  e.revoke("alice", purse, "bob");
  assert.throws(
    () => e.spend("bob", purse, parseTari("10"), "cafe"),
    /revoked/
  );
  assert.equal(e.vaultBalance(purse), parseTari("1000"));
  assert.equal(e.account("cafe").balance, 0n);
});

test("period refill restores the cap; missed periods do not stack", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", {
    cap: parseTari("100"),
    periodEpochs: 50n,
    allowlist: ["cafe"],
  });
  e.spend("bob", purse, parseTari("80"), "cafe");
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("20"));
  e.advanceEpoch(50n);
  // Viewing reflects the refill; a spend commits it.
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("100"));
  e.spend("bob", purse, parseTari("100"), "cafe");
  assert.equal(e.allowanceOf(purse, "bob").remaining, 0n);
  // Jump two periods: remaining goes to one cap, not two.
  e.advanceEpoch(100n);
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("100"));
});

test("one-shot (period 0) does not refill", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", {
    cap: parseTari("100"),
    periodEpochs: 0n,
    allowlist: ["cafe"],
  });
  e.spend("bob", purse, parseTari("40"), "cafe");
  e.advanceEpoch(1000n);
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("60"));
});

test("non-helper cannot spend", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", { cap: parseTari("100"), allowlist: ["cafe"] });
  assert.throws(
    () => e.spend("mallory", purse, parseTari("10"), "cafe"),
    /not a helper/
  );
  assert.throws(
    () => e.spend("alice", purse, parseTari("10"), "cafe"),
    /not a helper/
  );
});

test("non-owner cannot grant, withdraw, or revoke", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("100"));
  assert.throws(
    () => e.grant("bob", purse, "mallory", { cap: parseTari("10") }),
    /owner only/
  );
  e.grant("alice", purse, "bob", { cap: parseTari("10"), allowlist: ["cafe"] });
  assert.throws(() => e.revoke("bob", purse, "bob"), /owner only/);
  assert.throws(() => e.withdraw("bob", purse, parseTari("10")), /owner only/);
  assert.throws(
    () => e.setCap("mallory", purse, "bob", parseTari("5")),
    /owner only/
  );
  assert.equal(e.vaultBalance(purse), parseTari("100"));
});

test("wrong or invalid inputs are rejected", () => {
  const { e, purse } = setup();
  assert.throws(() => e.deposit("alice", purse, 0n), /greater than zero/);
  assert.throws(() => e.deposit("alice", purse, parseTari("2000")), /insufficient account/);
  e.deposit("alice", purse, parseTari("50"));
  assert.throws(
    () => e.grant("alice", purse, "bob", { cap: 0n }),
    /cap must be greater than zero/
  );
  assert.throws(
    () => e.grant("alice", purse, "alice", { cap: parseTari("10") }),
    /own helper/
  );
  e.grant("alice", purse, "bob", { cap: parseTari("50"), allowlist: ["cafe"] });
  assert.throws(
    () => e.grant("alice", purse, "bob", { cap: parseTari("10") }),
    /already has an active/
  );
  assert.throws(() => e.spend("bob", purse, 0n, "cafe"), /greater than zero/);
  const long = "x".repeat(129);
  assert.throws(() => e.spend("bob", purse, parseTari("1"), "cafe", long), /memo too long/);
});

test("owner can withdraw; spend fails if the vault is short", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("100"));
  e.grant("alice", purse, "bob", { cap: parseTari("80"), allowlist: ["cafe"] });
  e.withdraw("alice", purse, parseTari("30"));
  assert.equal(e.account("alice").balance, parseTari("930"));
  assert.equal(e.vaultBalance(purse), parseTari("70"));
  // spendable is min(remaining 80, vault 70)
  assert.equal(e.allowanceOf(purse, "bob").spendable, parseTari("70"));
  e.spend("bob", purse, parseTari("70"), "cafe");
  assert.throws(
    () => e.spend("bob", purse, parseTari("10"), "cafe"),
    /insufficient vault/
  );
  assert.equal(e.account("cafe").balance, parseTari("70"));
});

test("owner can update the allowlist and the cap (remaining never exceeds cap)", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", { cap: parseTari("100"), allowlist: ["cafe"] });
  e.spend("bob", purse, parseTari("10"), "cafe");
  e.setAllowlist("alice", purse, "bob", ["vendor"]);
  assert.throws(() => e.spend("bob", purse, parseTari("10"), "cafe"), /allowlist/);
  e.spend("bob", purse, parseTari("10"), "vendor");
  e.setCap("alice", purse, "bob", parseTari("15"));
  assert.equal(e.allowanceOf(purse, "bob").cap, parseTari("15"));
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("15"));
  assert.throws(() => e.spend("bob", purse, parseTari("16"), "vendor"), /exceeds remaining/);
});

test("reactivate after revoke starts a fresh period", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("200"));
  e.grant("alice", purse, "bob", { cap: parseTari("50"), allowlist: ["cafe"] });
  e.spend("bob", purse, parseTari("40"), "cafe");
  e.revoke("alice", purse, "bob");
  e.reactivate("alice", purse, "bob");
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("50"));
  assert.equal(e.allowanceOf(purse, "bob").revoked, false);
  e.spend("bob", purse, parseTari("50"), "cafe");
  assert.equal(e.account("cafe").balance, parseTari("90"));
});

test("anyone may top up a purse from their own balance", () => {
  const { e, purse } = setup();
  e.deposit("mallory", purse, parseTari("50"));
  assert.equal(e.vaultBalance(purse), parseTari("50"));
  assert.equal(e.account("mallory").balance, 0n);
});

test("format and parse TARI amounts exactly", () => {
  assert.equal(parseTari("1"), MICRO);
  assert.equal(parseTari("1.5"), MICRO + MICRO / 2n);
  assert.equal(parseTari("0.000001"), 1n);
  assert.equal(formatTari(1n), "0.000001 TARI");
  assert.equal(formatTari(MICRO), "1 TARI");
  assert.equal(formatTari(parseTari("12.3400")), "12.34 TARI");
  assert.throws(() => parseTari("1.1234567"), /at most 6/);
});

test("guided Alice/Bob path used by the demo", () => {
  const { e, purse } = setup();
  e.deposit("alice", purse, parseTari("1000"));
  e.grant("alice", purse, "bob", {
    label: "Assistant",
    cap: parseTari("100"),
    periodEpochs: 50n,
    expiresAtEpoch: 0n,
    allowlist: ["cafe", "vendor"],
  });
  e.spend("bob", purse, parseTari("40"), "cafe", "lunch");
  assert.equal(e.allowanceOf(purse, "bob").remaining, parseTari("60"));
  assert.throws(() => e.spend("bob", purse, parseTari("70"), "cafe", "too much"), /exceeds/);
  assert.throws(() => e.spend("bob", purse, parseTari("10"), "shop", "unlisted"), /allowlist/);
  e.advanceEpoch(50n);
  e.spend("bob", purse, parseTari("100"), "vendor", "period refill");
  e.revoke("alice", purse, "bob");
  assert.throws(() => e.spend("bob", purse, parseTari("1"), "cafe"), /revoked/);
  e.withdraw("alice", purse, e.vaultBalance(purse));
  assert.equal(e.vaultBalance(purse), 0n);
  assert.equal(e.account("cafe").balance, parseTari("40"));
  assert.equal(e.account("vendor").balance, parseTari("100"));
  assert.equal(e.account("alice").balance, parseTari("860"));
});
