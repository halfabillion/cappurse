"use strict";

// Avoid destructuring CapPurseEngine / parseTari / formatTari: those names are
// already lexical bindings from engine.js when both files run as classic scripts.
const capPurseApi = window.CapPurse;

const STARTING = {
  alice: "1000",
  bob: "0",
  cafe: "0",
  vendor: "0",
  shop: "0",
  mallory: "50",
};

let engine;
let purseId;
let role = "alice";
let stepDone = -1;
let runningDemo = false;

function boot() {
  engine = new window.CapPurse.CapPurseEngine();
  engine.createAccount("alice", "Alice", capPurseApi.parseTari(STARTING.alice));
  engine.createAccount("bob", "Bob", capPurseApi.parseTari(STARTING.bob));
  engine.createAccount("cafe", "Cafe", capPurseApi.parseTari(STARTING.cafe));
  engine.createAccount("vendor", "Software vendor", capPurseApi.parseTari(STARTING.vendor));
  engine.createAccount("shop", "Unlisted shop", capPurseApi.parseTari(STARTING.shop));
  engine.createAccount("mallory", "Mallory", capPurseApi.parseTari(STARTING.mallory));
  purseId = engine.createPurse("alice");
  stepDone = -1;
  clearLog();
  log("info", "A fresh demo ledger is ready. Alice holds 1,000 TARI, Mallory holds 50, and the purse is empty.");
  setNarration("info", "Click “Run the guided demo” to walk through the story in plain words. Each step will say whether it passed or failed, and why.");
  render();
}

const LOG_LABEL = { pass: "Passed", fail: "Failed", ok: "Done", err: "Blocked", info: "Note" };
let narrationHistory = [];

function clearLog() {
  const el = document.getElementById("log");
  el.textContent = "";
  narrationHistory = [];
}

function log(kind, message) {
  const el = document.getElementById("log");
  const item = document.createElement("article");
  item.className = "log-item " + kind;
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  const time = document.createElement("time");
  time.textContent = `${hh}:${mm}:${ss}`;
  const badge = document.createElement("span");
  badge.className = "log-badge";
  badge.textContent = LOG_LABEL[kind] || kind;
  const body = document.createElement("p");
  body.textContent = message;
  item.appendChild(badge);
  item.appendChild(time);
  item.appendChild(body);
  item.logKind = kind;
  item.logText = message;
  el.appendChild(item);
  el.scrollTop = el.scrollHeight;
}

function setNarration(kind, text) {
  narrationHistory.push({ kind, text });
  const panel = document.getElementById("narration");
  const el = document.getElementById("narration-text");
  if (panel) panel.className = "narration " + kind;
  if (el) el.textContent = text;
}

function tryCall(fn, okMsg) {
  try {
    const result = fn();
    if (okMsg) log("ok", okMsg);
    render();
    return result;
  } catch (err) {
    log("err", err.message);
    render();
    throw err;
  }
}

function render() {
  const snap = engine.snapshot(purseId);
  document.getElementById("epoch-label").textContent = "Epoch " + snap.epoch.toString();
  document.getElementById("purse-kicker").textContent = "Purse " + snap.purse.id + " · owner Alice";

  let bob = null;
  try { bob = engine.allowanceOf(purseId, "bob"); } catch (_) { /* not granted */ }

  const vault = snap.purse.vault;
  document.getElementById("stat-vault").textContent = capPurseApi.formatTari(vault);
  document.getElementById("stat-spendable").textContent = bob ? capPurseApi.formatTari(bob.spendable) : "—";
  document.getElementById("stat-receipts").textContent = String(engine.account("bob").receipts.length);

  const cap = bob ? bob.cap : 0n;
  const remaining = bob ? bob.remaining : 0n;
  const pct = cap > 0n ? Number((remaining * 1000n) / cap) / 10 : 0;
  const used = bob ? cap - remaining : 0n;
  const meterWrap = document.getElementById("meter-wrap");
  const meterEl = document.getElementById("meter");
  document.getElementById("meter-bar").style.width = (bob ? pct : 0) + "%";
  if (meterEl) {
    meterEl.setAttribute("aria-valuenow", String(Math.round(bob ? pct : 0)));
    meterEl.setAttribute("aria-valuemax", "100");
  }
  if (meterWrap) {
    meterWrap.classList.toggle("low", !!bob && pct > 0 && pct <= 25);
    meterWrap.classList.toggle("empty", !!bob && pct === 0);
    meterWrap.classList.toggle("revoked", !!(bob && (bob.revoked || bob.expired)));
  }
  const capLabel = document.getElementById("meter-cap-label");
  if (!bob) {
    document.getElementById("meter-title").textContent = "Bob's remaining cap";
    document.getElementById("meter-text").textContent = "No allowance yet";
    document.getElementById("meter-hint").textContent = "When Alice grants Bob a cap, this bar shows how much of it is still left to spend.";
    if (capLabel) capLabel.textContent = "cap";
  } else {
    document.getElementById("meter-title").textContent = bob.revoked
      ? "Bob's cap (revoked)"
      : bob.expired
        ? "Bob's cap (expired)"
        : "Bob's remaining cap";
    document.getElementById("meter-text").textContent = capPurseApi.formatTari(remaining) + " left of " + capPurseApi.formatTari(cap);
    if (capLabel) capLabel.textContent = capPurseApi.formatTari(cap);
    let hint = "Used " + capPurseApi.formatTari(used) + " of the " + capPurseApi.formatTari(cap) + " cap.";
    if (bob.revoked) hint = "Alice has revoked this allowance. Bob cannot spend, and the bar stays empty of new room to spend.";
    else if (bob.expired) hint = "This allowance has expired, so Bob cannot spend any more.";
    else if (bob.spendable < remaining) {
      hint += " He can only spend " + capPurseApi.formatTari(bob.spendable) + " right now, because the vault holds less than the remaining cap.";
    } else {
      hint += " He can spend up to " + capPurseApi.formatTari(bob.spendable) + " right now.";
    }
    document.getElementById("meter-hint").textContent = hint;
  }

  const accBody = document.querySelector("#accounts tbody");
  accBody.replaceChildren();
  for (const a of snap.accounts) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(a.label)}</td><td>${capPurseApi.formatTari(a.balance)}</td><td>${a.receipts.length}</td>`;
    accBody.appendChild(tr);
  }

  const allBody = document.querySelector("#allowance tbody");
  allBody.replaceChildren();
  if (snap.helpers.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="muted">No helpers granted yet.</td>`;
    allBody.appendChild(tr);
  } else {
    for (const h of snap.helpers) {
      const status = h.revoked ? "revoked" : h.expired ? "expired" : "active";
      const pill = h.revoked || h.expired ? "bad" : "ok";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(h.label)}</td><td>${capPurseApi.formatTari(h.cap)}</td><td>${capPurseApi.formatTari(h.remaining)}</td><td><span class="pill ${pill}">${status}</span></td><td>${h.allowlist.length ? h.allowlist.join(", ") : "any"}</td>`;
      allBody.appendChild(tr);
    }
  }

  document.querySelectorAll(".steps li").forEach((li) => {
    const n = Number(li.getAttribute("data-step"));
    li.classList.toggle("done", n <= stepDone);
    li.classList.toggle("active", n === stepDone + 1);
  });

  document.querySelectorAll(".roles button").forEach((b) => {
    b.classList.toggle("on", b.dataset.role === role);
  });
  document.getElementById("form-alice").classList.toggle("on", role === "alice");
  document.getElementById("form-bob").classList.toggle("on", role === "bob");
  document.getElementById("form-mallory").classList.toggle("on", role === "mallory");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function selected(select) {
  return [...select.options].filter((o) => o.selected).map((o) => o.value);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let demoChecks = { pass: 0, fail: 0 };

function bal(id) {
  return engine.account(id).balance;
}

function check(plain, cond) {
  if (cond) {
    demoChecks.pass += 1;
    setNarration("pass", plain);
    log("pass", plain);
  } else {
    demoChecks.fail += 1;
    const failText = "This check failed: " + plain;
    setNarration("fail", failText);
    log("fail", failText);
  }
  render();
}

function expectReject(fn, plainPass, plainFail) {
  try {
    fn();
  } catch (err) {
    demoChecks.pass += 1;
    const text = plainPass + " The exact reason was: " + err.message + ".";
    setNarration("pass", text);
    log("pass", text);
    render();
    return;
  }
  demoChecks.fail += 1;
  setNarration("fail", plainFail);
  log("fail", plainFail);
  render();
}

async function runGuidedDemo() {
  if (runningDemo) return;
  runningDemo = true;
  document.getElementById("run-demo").disabled = true;
  demoChecks = { pass: 0, fail: 0 };
  try {
    boot();
    await sleep(350);

    tryCall(
      () => engine.deposit("alice", purseId, capPurseApi.parseTari("1000")),
      "Alice deposits 1,000 TARI into the purse."
    );
    check(
      "This worked. Alice put 1,000 TARI into the purse. The vault now holds 1,000 TARI, and Alice's own balance is 0.",
      engine.vaultBalance(purseId) === capPurseApi.parseTari("1000") && bal("alice") === 0n
    );
    stepDone = 0; render(); await sleep(550);

    tryCall(
      () => engine.grant("alice", purseId, "bob", {
        label: "Assistant",
        cap: capPurseApi.parseTari("100"),
        periodEpochs: 50n,
        allowlist: ["cafe", "vendor"],
      }),
      "Alice grants Bob a 100 TARI cap, refilling every 50 epochs, cafe and vendor only."
    );
    check(
      "This worked. Alice gave Bob a 100 TARI spending cap. He may pay only the cafe and the software vendor, and the cap will refill every 50 epochs.",
      engine.allowanceOf(purseId, "bob").remaining === capPurseApi.parseTari("100")
    );
    stepDone = 1; render(); await sleep(550);

    tryCall(
      () => engine.spend("bob", purseId, capPurseApi.parseTari("40"), "cafe", "lunch"),
      "Bob pays the cafe 40 TARI."
    );
    check(
      "This worked. Bob paid the cafe 40 TARI from the purse. Bob still holds 0 TARI himself — he never takes the money. 60 TARI remain on his cap, and he has a receipt.",
      bal("cafe") === capPurseApi.parseTari("40") && bal("bob") === 0n &&
      engine.allowanceOf(purseId, "bob").remaining === capPurseApi.parseTari("60") &&
      engine.account("bob").receipts.length === 1
    );
    stepDone = 2; render(); await sleep(550);

    expectReject(
      () => engine.spend("bob", purseId, capPurseApi.parseTari("70"), "cafe", "too much"),
      "This was blocked, as it should be. Bob tried to pay 70 TARI, but only 60 remained on his cap.",
      "This should have been blocked, but Bob's 70 TARI payment went through."
    );
    check(
      "Nothing moved after that blocked payment: the cafe still has 40 TARI, and Bob's remaining cap is still 60.",
      bal("cafe") === capPurseApi.parseTari("40") && engine.allowanceOf(purseId, "bob").remaining === capPurseApi.parseTari("60")
    );
    stepDone = 3; render(); await sleep(550);

    expectReject(
      () => engine.spend("bob", purseId, capPurseApi.parseTari("10"), "shop", "unlisted"),
      "This was blocked, as it should be. The unlisted shop is not on Alice's allowlist, so the payment failed.",
      "This should have been blocked, but the unlisted shop was paid."
    );
    check(
      "The unlisted shop still holds 0 TARI. The allowlist did its job.",
      bal("shop") === 0n
    );
    stepDone = 4; render(); await sleep(550);

    engine.advanceEpoch(50n);
    log("info", "Fifty epochs pass. Bob's cap refills to 100 TARI because a new period has started.");
    tryCall(
      () => engine.spend("bob", purseId, capPurseApi.parseTari("100"), "vendor", "period refill"),
      "Bob pays the software vendor 100 TARI from the refilled cap."
    );
    check(
      "This worked. Fifty epochs passed, so Bob's cap refilled to 100 TARI. He then paid the software vendor the full 100. The vendor now has 100 TARI.",
      bal("vendor") === capPurseApi.parseTari("100")
    );
    stepDone = 5; render(); await sleep(550);

    tryCall(() => engine.revoke("alice", purseId, "bob"), "Alice revokes Bob's allowance.");
    expectReject(
      () => engine.spend("bob", purseId, capPurseApi.parseTari("1"), "cafe", "after revoke"),
      "This was blocked, as it should be. Alice has revoked Bob's allowance, so he can no longer spend.",
      "This should have been blocked, but Bob spent after his allowance was revoked."
    );
    expectReject(
      () => engine.withdraw("mallory", purseId, capPurseApi.parseTari("1")),
      "This was blocked, as it should be. Mallory is not the owner, so she cannot withdraw from Alice's purse.",
      "This should have been blocked, but Mallory withdrew from Alice's purse."
    );
    const leftover = engine.vaultBalance(purseId);
    tryCall(
      () => engine.withdraw("alice", purseId, leftover),
      "Alice withdraws the remaining " + capPurseApi.formatTari(leftover) + "."
    );
    check(
      "This worked. Alice revoked Bob, a further spend was blocked, and Mallory could not withdraw. Alice then took back the remaining 860 TARI. Final balances: Alice 860, cafe 40, vendor 100, vault 0.",
      bal("alice") === capPurseApi.parseTari("860") && bal("cafe") === capPurseApi.parseTari("40") &&
      bal("vendor") === capPurseApi.parseTari("100") && engine.vaultBalance(purseId) === 0n
    );
    stepDone = 6; render();
    const total = demoChecks.pass + demoChecks.fail;
    if (demoChecks.fail === 0) {
      const summary = "The guided story finished cleanly: all " + demoChecks.pass + " of " + total + " checks passed. You can reset the ledger and try the forms yourself.";
      setNarration("pass", summary);
      log("pass", summary);
    } else {
      const summary = "The guided story finished with problems: " + demoChecks.fail + " of " + total + " checks failed. Please report this.";
      setNarration("fail", summary);
      log("fail", summary);
    }
  } catch (err) {
    log("fail", "FAIL — guided demo stopped early: " + err.message);
  } finally {
    runningDemo = false;
    document.getElementById("run-demo").disabled = false;
  }
}

function mount() {
  const roles = document.getElementById("roles");
  [
    ["alice", "Alice (owner)"],
    ["bob", "Bob (helper)"],
    ["mallory", "Mallory (stranger)"],
  ].forEach(([id, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.role = id;
    b.textContent = label;
    b.addEventListener("click", () => { role = id; render(); });
    roles.appendChild(b);
  });

  document.getElementById("run-demo").addEventListener("click", runGuidedDemo);
  document.getElementById("reset").addEventListener("click", () => {
    boot();
  });

  document.getElementById("form-alice").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const doWhat = ev.submitter && ev.submitter.value;
    try {
      if (doWhat === "deposit") {
        const amt = capPurseApi.parseTari(form.deposit.value);
        tryCall(() => engine.deposit("alice", purseId, amt), "Alice deposits " + capPurseApi.formatTari(amt) + ".");
      } else if (doWhat === "grant") {
        tryCall(
          () => engine.grant("alice", purseId, "bob", {
            label: "Assistant",
            cap: capPurseApi.parseTari(form.cap.value),
            periodEpochs: BigInt(form.period.value || "0"),
            allowlist: selected(form.allowlist),
          }),
          "Alice grants Bob a " + capPurseApi.formatTari(capPurseApi.parseTari(form.cap.value)) + " cap."
        );
      } else if (doWhat === "revoke") {
        tryCall(() => engine.revoke("alice", purseId, "bob"), "Alice revokes Bob.");
      } else if (doWhat === "withdraw") {
        const amt = capPurseApi.parseTari(form.withdraw.value);
        tryCall(() => engine.withdraw("alice", purseId, amt), "Alice withdraws " + capPurseApi.formatTari(amt) + ".");
      }
    } catch (_) { /* already logged */ }
  });

  document.getElementById("form-bob").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target;
    try {
      const amt = capPurseApi.parseTari(form.amount.value);
      const merchant = form.merchant.value;
      const memo = form.memo.value;
      tryCall(
        () => engine.spend("bob", purseId, amt, merchant, memo),
        "Bob pays " + capPurseApi.formatTari(amt) + " to " + merchant + "."
      );
    } catch (_) { /* already logged */ }
  });

  document.getElementById("form-mallory").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const doWhat = ev.submitter && ev.submitter.value;
    try {
      if (doWhat === "deposit") {
        const amt = capPurseApi.parseTari(form.deposit.value);
        tryCall(() => engine.deposit("mallory", purseId, amt), "Mallory tops up " + capPurseApi.formatTari(amt) + ".");
      } else {
        tryCall(() => engine.spend("mallory", purseId, capPurseApi.parseTari("10"), "cafe", "intruder"), "unexpected success");
      }
    } catch (_) { /* already logged */ }
  });

  document.querySelectorAll(".tabs button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
      document.querySelectorAll(".tabpage").forEach((p) => {
        p.classList.toggle("on", p.id === "tab-" + b.dataset.tab);
      });
    });
  });

  boot();
}

document.addEventListener("DOMContentLoaded", mount);

