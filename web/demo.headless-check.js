const fs = require("fs");
const vm = require("vm");
const W = __dirname + "/";
const logs = [];

function el(id) {
  return {
    id,
    textContent: "",
    style: {},
    disabled: false,
    dataset: {},
    value: "",
    options: [],
    className: "",
    classList: { toggle() {}, add() {}, remove() {} },
    appendChild(c) {
      if (id === "log") logs.push(c);
    },
    replaceChildren() {},
    addEventListener() {},
    querySelector() {
      return el("q");
    },
    querySelectorAll() {
      return [];
    },
    getAttribute() {
      return "0";
    },
    setAttribute() {},
    set innerHTML(v) {},
    scrollTop: 0,
    scrollHeight: 0,
  };
}

const els = {};
const document = {
  getElementById: (id) => els[id] || (els[id] = el(id)),
  querySelector: (s) => el(s),
  querySelectorAll: () => [],
  createElement: () => el("x"),
  addEventListener: (e, f) => {
    if (e === "DOMContentLoaded") f();
  },
  readyState: "complete",
};
const ctx = {
  window: {},
  document,
  console,
  setTimeout: (f) => setImmediate(f),
  Promise,
};
ctx.window.document = document;
vm.createContext(ctx);
vm.runInContext("(function(){" + fs.readFileSync(W + "engine.js", "utf8") + "\n})();", ctx);
vm.runInContext(
  fs.readFileSync(W + "app.js", "utf8") +
    "\n;globalThis.__run=runGuidedDemo; globalThis.__boot=boot; globalThis.__narration=()=>narrationHistory;",
  ctx
);

function kindOf(line) {
  return line.logKind || (String(line.className).split(/\s+/).find((c) => c && c !== "log-item") || "");
}

function textOf(line) {
  return line.logText || String(line.textContent || "").replace(/^\[\d\d:\d\d:\d\d\]\s*/, "");
}

(async () => {
  ctx.__boot();
  await ctx.__run();

  const failLines = [];
  for (const l of logs) {
    const kind = kindOf(l);
    const text = textOf(l);
    console.log(String(kind).padEnd(5), text);
    if (kind === "fail") failLines.push(text);
  }

  const narration = typeof ctx.__narration === "function" ? ctx.__narration() : [];
  console.log("NARRATION_COUNT", narration.length);
  for (const n of narration) {
    console.log("narr", n.kind, n.text);
  }

  const hay = narration.map((n) => n.text).join("\n");
  const required = [
    "This worked. Alice put 1,000 TARI into the purse.",
    "This worked. Alice gave Bob a 100 TARI spending cap.",
    "This worked. Bob paid the cafe 40 TARI from the purse.",
    "This was blocked, as it should be. Bob tried to pay 70 TARI",
    "Nothing moved after that blocked payment",
    "This was blocked, as it should be. The unlisted shop is not on Alice's allowlist",
    "The unlisted shop still holds 0 TARI",
    "This worked. Fifty epochs passed, so Bob's cap refilled to 100 TARI",
    "This was blocked, as it should be. Alice has revoked Bob's allowance",
    "This was blocked, as it should be. Mallory is not the owner",
    "Final balances: Alice 860, cafe 40, vendor 100, vault 0",
    "all 11 of 11 checks passed",
  ];
  const missing = required.filter((phrase) => !hay.includes(phrase));
  if (missing.length) {
    console.log("MISSING_NARRATION", missing.length);
    for (const m of missing) console.log("  -", m);
  } else {
    console.log("NARRATION_PHRASES", required.length + "/" + required.length);
  }

  console.log("FAIL_LINES", failLines.length);
  process.exit(failLines.length || missing.length ? 1 : 0);
})();
