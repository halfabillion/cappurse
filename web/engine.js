/**
 * CapPurse engine — a faithful browser/Node mirror of the Ootle template rules.
 * Amounts are integer micro-TARI (1 TARI = 1_000_000).
 *
 * This is DEMO MODE: it never talks to a wallet or to the Tari network.
 * The Rust template in ../template is the on-chain implementation.
 */
"use strict";

const MICRO = 1_000_000n;
const MAX_MEMO = 128;
const MAX_LABEL = 64;

function asAmount(value) {
  const n = typeof value === "bigint" ? value : BigInt(value);
  if (n < 0n) throw new Error("amount must be non-negative");
  return n;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

class CapPurseEngine {
  constructor() {
    this.epoch = 0n;
    this.nextPurse = 1;
    this.nextReceipt = 1;
    this.accounts = new Map();
    this.purses = new Map();
    this.events = [];
  }

  /* ---------- clock ---------- */

  currentEpoch() {
    return this.epoch;
  }

  setEpoch(epoch) {
    const e = asAmount(epoch);
    assert(e >= this.epoch, "epoch can only move forward");
    this.epoch = e;
  }

  advanceEpoch(by) {
    this.setEpoch(this.epoch + asAmount(by));
  }

  /* ---------- accounts (demo ledger) ---------- */

  createAccount(id, label, balance = 0n) {
    assert(!this.accounts.has(id), "account already exists");
    const account = {
      id,
      label: String(label || id).slice(0, MAX_LABEL),
      balance: asAmount(balance),
      receipts: [],
    };
    this.accounts.set(id, account);
    return account;
  }

  account(id) {
    const a = this.accounts.get(id);
    assert(a, "unknown account: " + id);
    return a;
  }

  /* ---------- purse ---------- */

  createPurse(ownerId) {
    this.account(ownerId);
    const id = "purse-" + this.nextPurse++;
    const purse = {
      id,
      ownerId,
      vault: 0n,
      helpers: new Map(),
    };
    this.purses.set(id, purse);
    this.emit("Created", { purse: id, owner: ownerId });
    return id;
  }

  purse(id) {
    const p = this.purses.get(id);
    assert(p, "unknown purse: " + id);
    return p;
  }

  assertOwner(actorId, purse) {
    assert(actorId === purse.ownerId, "Access Denied: owner only");
  }

  deposit(actorId, purseId, amount) {
    const purse = this.purse(purseId);
    const amt = asAmount(amount);
    assert(amt > 0n, "deposit amount must be greater than zero");
    const src = this.account(actorId);
    assert(src.balance >= amt, "insufficient account balance");
    src.balance -= amt;
    purse.vault += amt;
    this.emit("Deposited", {
      purse: purseId,
      from: actorId,
      amount: amt.toString(),
      vault: purse.vault.toString(),
    });
    return purse.vault;
  }

  grant(
    actorId,
    purseId,
    helperId,
    {
      label = "",
      cap,
      periodEpochs = 0n,
      expiresAtEpoch = 0n,
      allowlist = [],
    } = {}
  ) {
    const purse = this.purse(purseId);
    this.assertOwner(actorId, purse);
    this.account(helperId);
    assert(helperId !== purse.ownerId, "owner cannot be their own helper");
    const capAmt = asAmount(cap);
    assert(capAmt > 0n, "cap must be greater than zero");
    const period = asAmount(periodEpochs);
    const expires = asAmount(expiresAtEpoch);
    if (expires !== 0n) {
      assert(expires > this.epoch, "expiry must be in the future");
    }
    const existing = purse.helpers.get(helperId);
    assert(!existing || existing.revoked, "helper already has an active allowance");
    const allow = uniqueAddresses(allowlist);
    const allowance = {
      helperId,
      label: String(label || helperId).slice(0, MAX_LABEL),
      cap: capAmt,
      remaining: capAmt,
      periodEpochs: period,
      lastResetEpoch: this.epoch,
      expiresAtEpoch: expires,
      revoked: false,
      allowlist: allow,
      spentTotal: 0n,
      spendCount: 0n,
    };
    purse.helpers.set(helperId, allowance);
    this.emit("Granted", {
      purse: purseId,
      helper: helperId,
      cap: capAmt.toString(),
      periodEpochs: period.toString(),
      expiresAtEpoch: expires.toString(),
    });
    return this.viewAllowance(purse, allowance);
  }

  setCap(actorId, purseId, helperId, newCap) {
    const purse = this.purse(purseId);
    this.assertOwner(actorId, purse);
    const a = this.requireAllowance(purse, helperId);
    const capAmt = asAmount(newCap);
    assert(capAmt > 0n, "cap must be greater than zero");
    this.maybeRefill(a);
    a.cap = capAmt;
    if (a.remaining > capAmt) a.remaining = capAmt;
    this.emit("CapSet", {
      purse: purseId,
      helper: helperId,
      cap: capAmt.toString(),
      remaining: a.remaining.toString(),
    });
    return this.viewAllowance(purse, a);
  }

  setAllowlist(actorId, purseId, helperId, allowlist) {
    const purse = this.purse(purseId);
    this.assertOwner(actorId, purse);
    const a = this.requireAllowance(purse, helperId);
    a.allowlist = uniqueAddresses(allowlist);
    this.emit("AllowlistSet", {
      purse: purseId,
      helper: helperId,
      allowlist: a.allowlist.slice(),
    });
    return this.viewAllowance(purse, a);
  }

  revoke(actorId, purseId, helperId) {
    const purse = this.purse(purseId);
    this.assertOwner(actorId, purse);
    const a = this.requireAllowance(purse, helperId);
    assert(!a.revoked, "allowance already revoked");
    a.revoked = true;
    this.emit("Revoked", { purse: purseId, helper: helperId });
    return this.viewAllowance(purse, a);
  }

  reactivate(actorId, purseId, helperId) {
    const purse = this.purse(purseId);
    this.assertOwner(actorId, purse);
    const a = purse.helpers.get(helperId);
    assert(a, "unknown helper");
    assert(a.revoked, "allowance is not revoked");
    if (a.expiresAtEpoch !== 0n) {
      assert(a.expiresAtEpoch > this.epoch, "allowance has expired");
    }
    a.revoked = false;
    a.remaining = a.cap;
    a.lastResetEpoch = this.epoch;
    this.emit("Reactivated", { purse: purseId, helper: helperId });
    return this.viewAllowance(purse, a);
  }

  withdraw(actorId, purseId, amount) {
    const purse = this.purse(purseId);
    this.assertOwner(actorId, purse);
    const amt = asAmount(amount);
    assert(amt > 0n, "withdraw amount must be greater than zero");
    assert(purse.vault >= amt, "insufficient vault balance");
    purse.vault -= amt;
    this.account(actorId).balance += amt;
    this.emit("Withdrawn", {
      purse: purseId,
      to: actorId,
      amount: amt.toString(),
      vault: purse.vault.toString(),
    });
    return purse.vault;
  }

  spend(actorId, purseId, amount, merchantId, memo = "") {
    const purse = this.purse(purseId);
    const a = purse.helpers.get(actorId);
    assert(a, "Access Denied: not a helper on this purse");
    const amt = asAmount(amount);
    assert(amt > 0n, "spend amount must be greater than zero");
    memo = String(memo || "");
    assert(memo.length <= MAX_MEMO, "memo too long");
    this.account(merchantId);

    this.maybeRefill(a);
    assert(!a.revoked, "allowance has been revoked");
    if (a.expiresAtEpoch !== 0n) {
      assert(this.epoch < a.expiresAtEpoch, "allowance has expired");
    }
    assert(amt <= a.remaining, "amount exceeds remaining cap");
    assert(amt <= purse.vault, "insufficient vault balance");
    if (a.allowlist.length > 0) {
      assert(a.allowlist.includes(merchantId), "merchant is not on the allowlist");
    }

    purse.vault -= amt;
    this.account(merchantId).balance += amt;
    a.remaining -= amt;
    a.spentTotal += amt;
    a.spendCount += 1n;

    const receipt = {
      id: this.nextReceipt++,
      purseId,
      helperId: actorId,
      merchantId,
      amount: amt,
      memo,
      epoch: this.epoch,
      remaining: a.remaining,
    };
    this.account(actorId).receipts.push(receipt);

    this.emit("Spent", {
      purse: purseId,
      helper: actorId,
      merchant: merchantId,
      amount: amt.toString(),
      memo,
      remaining: a.remaining.toString(),
      vault: purse.vault.toString(),
      receipt: receipt.id,
    });
    return receipt;
  }

  /* ---------- internals ---------- */

  requireAllowance(purse, helperId) {
    const a = purse.helpers.get(helperId);
    assert(a, "unknown helper");
    assert(!a.revoked, "allowance has been revoked");
    return a;
  }

  maybeRefill(a) {
    if (a.revoked) return;
    if (a.periodEpochs === 0n) return;
    if (a.expiresAtEpoch !== 0n && this.epoch >= a.expiresAtEpoch) return;
    if (this.epoch >= a.lastResetEpoch + a.periodEpochs) {
      const elapsed = this.epoch - a.lastResetEpoch;
      const periods = elapsed / a.periodEpochs;
      a.lastResetEpoch = a.lastResetEpoch + periods * a.periodEpochs;
      a.remaining = a.cap;
    }
  }

  viewAllowance(purse, a) {
    const copy = { ...a, allowlist: a.allowlist.slice() };
    this.maybeRefill(copy);
    const expired =
      copy.expiresAtEpoch !== 0n && this.epoch >= copy.expiresAtEpoch;
    const spendable = expired || copy.revoked
      ? 0n
      : min(copy.remaining, purse.vault);
    return {
      helperId: copy.helperId,
      label: copy.label,
      cap: copy.cap,
      remaining: expired || copy.revoked ? 0n : copy.remaining,
      periodEpochs: copy.periodEpochs,
      lastResetEpoch: copy.lastResetEpoch,
      expiresAtEpoch: copy.expiresAtEpoch,
      revoked: copy.revoked,
      expired,
      allowlist: copy.allowlist,
      spentTotal: copy.spentTotal,
      spendCount: copy.spendCount,
      spendable,
      vault: purse.vault,
    };
  }

  allowanceOf(purseId, helperId) {
    const purse = this.purse(purseId);
    const a = purse.helpers.get(helperId);
    assert(a, "unknown helper");
    return this.viewAllowance(purse, a);
  }

  vaultBalance(purseId) {
    return this.purse(purseId).vault;
  }

  snapshot(purseId) {
    const purse = this.purse(purseId);
    const helpers = [];
    for (const a of purse.helpers.values()) {
      helpers.push(this.viewAllowance(purse, a));
    }
    const accounts = [...this.accounts.values()].map((x) => ({
      id: x.id,
      label: x.label,
      balance: x.balance,
      receipts: x.receipts.map((r) => ({ ...r })),
    }));
    return {
      epoch: this.epoch,
      purse: { id: purse.id, ownerId: purse.ownerId, vault: purse.vault },
      helpers,
      accounts,
      events: this.events.slice(),
    };
  }

  emit(topic, payload) {
    this.events.push({
      topic: "CapPurse." + topic,
      payload,
      epoch: this.epoch,
    });
  }
}

function uniqueAddresses(list) {
  const out = [];
  for (const item of list || []) {
    const s = String(item);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function min(a, b) {
  return a < b ? a : b;
}

function formatTari(micro) {
  const n = asAmount(micro);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / MICRO;
  const frac = (abs % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toString() + (frac ? "." + frac : "") + " TARI";
}

function parseTari(text) {
  const s = String(text).trim().replace(/[,\s]/g, "");
  assert(/^-?\d+(\.\d+)?$/.test(s), "invalid TARI amount");
  const neg = s.startsWith("-");
  const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
  assert(f.length <= 6, "TARI has at most 6 decimal places");
  const micro = BigInt(w) * MICRO + BigInt((f + "000000").slice(0, 6));
  return neg ? -micro : micro;
}

const api = {
  MICRO,
  MAX_MEMO,
  MAX_LABEL,
  CapPurseEngine,
  formatTari,
  parseTari,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}
if (typeof window !== "undefined") {
  window.CapPurse = api;
}
