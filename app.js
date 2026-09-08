/* ============================== Ledger — vanilla JS PWA ============================== */

const STORAGE_KEY = "ledger_pwa_state_v1";

const DEFAULT_CATEGORIES = [
  { id: "food", name: "Food", type: "expense" },
  { id: "transport", name: "Transport", type: "expense" },
  { id: "rent", name: "Rent", type: "expense" },
  { id: "bills", name: "Bills", type: "expense" },
  { id: "shopping", name: "Shopping", type: "expense" },
  { id: "debt_new", name: "Debt", type: "income" },
  { id: "loan_given", name: "Loan", type: "expense" },
  { id: "debt", name: "Debt Repayment", type: "expense" },
  { id: "loan_repay", name: "Loan Repayment", type: "income" },
  { id: "salary", name: "Salary", type: "income" },
  { id: "business", name: "Business", type: "income" },
  { id: "investment", name: "Investment", type: "both" },
  { id: "transfer", name: "Transfer", type: "transfer" },
];

const CAT_COLORS = ["#A3412B", "#B08A2E", "#1F6F4A", "#2E6E86", "#8C3F63", "#5C6660", "#7A5C3E", "#6B7268"];

const NAV = [
  { id: "dashboard", label: "Dashboard", glyph: "≡" },
  { id: "transactions", label: "Transactions", glyph: "☰" },
  { id: "add", label: "Add Transaction", glyph: "+" },
  { id: "accounts", label: "Accounts", glyph: "$" },
  { id: "budget", label: "Budget", glyph: "%" },
  { id: "split", label: "Split Calculator", glyph: "÷" },
  { id: "reports", label: "Reports", glyph: "▲" },
  { id: "bills", label: "Bills", glyph: "▣" },
  { id: "goals", label: "Savings Goals", glyph: "◎" },
  { id: "debts", label: "Debts / Loans", glyph: "⇄" },
  { id: "networth", label: "Net Worth", glyph: "Σ" },
  { id: "investments", label: "Investments", glyph: "↗" },
  { id: "business", label: "Business Ledger", glyph: "▦" },
  { id: "more", label: "More", glyph: "…" },
  { id: "settings", label: "Settings", glyph: "⚙" },
  { id: "profile", label: "Profile", glyph: "◐" },
];

/* ---------------------------------- helpers ---------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fmt = (n) => "KES " + (Number(n) || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => (Number(n) || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; } };
const monthKey = (d) => String(d).slice(0, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const catName = (id) => state.categories.find((c) => c.id === id)?.name || id || "Uncategorised";
const accName = (id) => state.accounts.find((a) => a.id === id)?.name || "—";
const isLiquid = (a) => a.liquid72h !== false; // unset (older data) defaults to accessible
const startOfWeek = (d) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
function accountPnl(accId) {
  let pnl = 0;
  state.transactions.forEach((t) => {
    if (t.accountId !== accId) return;
    if (t.type === "income") pnl += t.amount;
    if (t.type === "expense") pnl -= t.amount;
  });
  return pnl;
}

async function hashPin(pin) {
  const enc = new TextEncoder().encode("ledger-app-salt::" + pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function amountHTML(value, type) {
  const sign = type === "income" ? "+" : type === "expense" ? "−" : "";
  const cls = type === "income" ? "pos" : type === "expense" ? "neg" : "neu";
  return `<span class="txt-mono amt ${cls}">${sign}${fmtShort(Math.abs(value))}</span>`;
}
function emptyHTML(label) { return `<div class="empty txt-mono muted">${esc(label)}</div>`; }

/* ---------------------------------- state ---------------------------------- */

function seedBlank() {
  return {
    accounts: [
      { id: "cash", name: "Cash @ Hand", type: "cash", balance: 0, liquid72h: true },
      { id: "mpesa", name: "M-Pesa", type: "mpesa", balance: 0, liquid72h: true },
      { id: "airtel", name: "Airtel Money", type: "mobile", balance: 0, liquid72h: true },
      { id: "bank", name: "Bank Account", type: "bank", balance: 0, liquid72h: true },
      { id: "savings", name: "Savings", type: "savings", balance: 0, liquid72h: true },
      { id: "invest", name: "Investment Account", type: "investment", balance: 0, liquid72h: false },
    ],
    transactions: [],
    debts: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    goals: [],
    bills: [],
    budget: { monthlyIncome: 0, categoryBudgets: {} },
    business: { enabled: false, entries: [] },
    settings: { name: "", contact: "", theme: "light", currency: "KES" },
    splitCalc: {
      amount: 0,
      rows: [
        { id: uid(), name: "Needs", pct: 50 },
        { id: uid(), name: "Wants", pct: 30 },
        { id: uid(), name: "Savings", pct: 20 },
      ],
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("load failed", e); }
  return seedBlank();
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error("save failed", e); }
}

let state = loadState();
if (!state.splitCalc) state.splitCalc = { amount: 0, rows: [], notes: "" }; // backward-compat for pre-existing saves

// UI-only (non-persisted) state
let ui = {
  editingTxId: null,
  openAccountId: null,
  payingDebtId: null,
  contributingGoalId: null,
  contributingInvId: null,
  addForm: null, // populated when entering add page
  addingCategoryInline: false,
};

function update(mutator) {
  mutator(state);
  saveState();
  updateBranding();
  render();
}

// Persists a change without re-rendering — for fields committed on blur where a
// re-render mid-click (e.g. a button clicked right after leaving a text field)
// would replace the DOM out from under the in-flight click event.
function updateSilent(mutator) {
  mutator(state);
  saveState();
}

/* ---------------------------------- dynamic branding ---------------------------------- */

function appName() {
  const n = (state.settings.name || "").trim();
  return n ? `${n}'s Ledger` : "___-Ledger";
}

function updateBranding() {
  const name = appName();
  document.title = name;
  document.documentElement.classList.toggle("theme-dark", state.settings.theme === "dark");

  const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (metaTitle) metaTitle.setAttribute("content", name);

  const brandTitleEl = document.getElementById("brand-title-text");
  if (brandTitleEl) brandTitleEl.textContent = name;

  const brandMarkEl = document.getElementById("brand-mark-text");
  if (brandMarkEl) brandMarkEl.textContent = state.settings.name ? state.settings.name.trim()[0].toUpperCase() : "L";

  const lockTitleEl = document.getElementById("lock-title-text");
  if (lockTitleEl) lockTitleEl.textContent = name + " is locked";

  const lockMarkEl = document.getElementById("lock-mark-text");
  if (lockMarkEl) lockMarkEl.textContent = state.settings.name ? state.settings.name.trim()[0].toUpperCase() : "L";

  const installTextEl = document.getElementById("install-banner-text");
  if (installTextEl) installTextEl.textContent = `Install ${name} on this device for one-tap, offline access.`;

  updateManifestLink(name);
}

// Regenerates the manifest in-memory with the current name so the Android/Chrome
// "Install" prompt picks up the personalised name too. iOS Safari's "Add to Home
// Screen" instead reads apple-mobile-web-app-title (updated above), not the manifest.
let lastManifestBlobUrl = null;
function updateManifestLink(name) {
  try {
    const base = location.href.slice(0, location.href.lastIndexOf("/") + 1);
    const manifest = {
      name, short_name: name.length > 14 ? name.slice(0, 14) : name,
      description: "Offline personal finance tracker: transactions, budgets, debts, goals and reports.",
      start_url: "./index.html", scope: "./", id: "./index.html",
      display: "standalone", orientation: "portrait-primary",
      background_color: "#17211B", theme_color: "#17211B",
      icons: [
        { src: base + "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: base + "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: base + "icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: base + "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute("href", url);
    if (lastManifestBlobUrl) URL.revokeObjectURL(lastManifestBlobUrl);
    lastManifestBlobUrl = url;
  } catch (e) { console.error("manifest update failed", e); }
}

/* ---------------------------------- router ---------------------------------- */

const main = document.getElementById("main");

function render() {
  const hash = (location.hash || "#dashboard").slice(1);
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.nav === hash));
  const renderer = PAGES[hash] || PAGES.dashboard;
  main.innerHTML = renderer();
  if (hash === "transactions") initTxFilters();
  if (hash === "split") initSplitCalc();
  document.getElementById("app-shell").scrollTop = 0;
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);

/* ---------------------------------- charts ---------------------------------- */

function lineChartSVG(trend) {
  if (!trend.length) return emptyHTML("Not enough history yet.");
  const w = 600, h = 220, padL = 46, padB = 26, padT = 14, padR = 10;
  const max = Math.max(1, ...trend.map((t) => Math.max(t.income, t.expense)));
  const stepX = trend.length > 1 ? (w - padL - padR) / (trend.length - 1) : 0;
  const x = (i) => padL + i * stepX;
  const y = (v) => h - padB - (v / max) * (h - padT - padB);
  const path = (key, color) => {
    const d = trend.map((t, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(t[key]).toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.25" />`;
  };
  const gridLines = [0, 0.5, 1].map((f) => {
    const gy = h - padB - f * (h - padT - padB);
    return `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="#CDD3C7" stroke-dasharray="3,3" />
      <text x="4" y="${gy + 4}" font-size="10" fill="#5C6660" font-family="ui-monospace,monospace">${Math.round(max * f)}</text>`;
  }).join("");
  const labels = trend.map((t, i) => `<text x="${x(i)}" y="${h - 8}" font-size="10" fill="#5C6660" text-anchor="middle" font-family="ui-monospace,monospace">${esc(t.month.slice(2))}</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;max-height:240px">
    ${gridLines}${labels}${path("income", "#1F6F4A")}${path("expense", "#A3412B")}
  </svg>
  <div style="display:flex;gap:16px;font-size:12px;margin-top:6px">
    <span><span style="display:inline-block;width:9px;height:9px;background:#1F6F4A;border-radius:2px;margin-right:5px"></span>Income</span>
    <span><span style="display:inline-block;width:9px;height:9px;background:#A3412B;border-radius:2px;margin-right:5px"></span>Expenses</span>
  </div>`;
}

function pieChartHTML(items) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return emptyHTML("No expenses recorded yet.");
  let acc = 0;
  const stops = items.map((item, i) => {
    const start = (acc / total) * 100;
    acc += item.value;
    const end = (acc / total) * 100;
    return `${CAT_COLORS[i % CAT_COLORS.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  }).join(", ");
  const legend = items.map((item, i) => `
    <div class="pie-legend-row">
      <span class="chip-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></span>
      <span>${esc(item.name)}</span>
      <span class="txt-mono muted">${((item.value / total) * 100).toFixed(0)}% · ${fmtShort(item.value)}</span>
    </div>`).join("");
  return `<div class="pie-wrap">
    <div class="pie-circle" style="background:conic-gradient(${stops})"></div>
    <div class="pie-legend">${legend}</div>
  </div>`;
}

/* ---------------------------------- page: dashboard ---------------------------------- */

function pageDashboard() {
  const freeLiquidity = state.accounts.filter(isLiquid).reduce((s, a) => s + a.balance, 0);
  const lockedLiquidity = state.accounts.filter((a) => !isLiquid(a)).reduce((s, a) => s + a.balance, 0);

  const now = new Date();
  const thisMonth = monthKey(now.toISOString());
  const txThisMonth = state.transactions.filter((t) => monthKey(t.date) === thisMonth);
  const moneyIn = txThisMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const moneyOut = txThisMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = moneyIn - moneyOut;

  const weekStart = startOfWeek(now);
  const txThisWeek = state.transactions.filter((t) => new Date(t.date) >= weekStart);
  const weekIn = txThisWeek.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const weekOut = txThisWeek.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const weekNet = weekIn - weekOut;

  const recent = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return `
    <div class="page-head"><div><h1>Dashboard</h1><p class="muted">${esc(fmtDate(now))}</p></div></div>

    <div class="hero-card">
      <div class="hero-duo">
        <div><div class="hero-label">Free Liquidity</div><div class="hero-figure-sm pos">${fmt(freeLiquidity)}</div></div>
        <div><div class="hero-label">Locked Liquidity</div><div class="hero-figure-sm">${fmt(lockedLiquidity)}</div></div>
      </div>
      <div class="hero-rule"></div>
      <div class="hero-row">
        <div><span class="muted">In this month</span><div class="txt-mono pos">+${fmtShort(moneyIn)}</div></div>
        <div><span class="muted">Out this month</span><div class="txt-mono neg">−${fmtShort(moneyOut)}</div></div>
        <div><span class="muted">Net (month)</span><div class="txt-mono ${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : "−"}${fmtShort(Math.abs(net))}</div></div>
      </div>
      <div class="hero-row" style="margin-top:14px">
        <div><span class="muted">In this week</span><div class="txt-mono pos">+${fmtShort(weekIn)}</div></div>
        <div><span class="muted">Out this week</span><div class="txt-mono neg">−${fmtShort(weekOut)}</div></div>
        <div><span class="muted">Net (week)</span><div class="txt-mono ${weekNet >= 0 ? "pos" : "neg"}">${weekNet >= 0 ? "+" : "−"}${fmtShort(Math.abs(weekNet))}</div></div>
      </div>
      <div class="quick-actions" style="margin:16px 0 0">
        <button class="qa-pill primary" data-action="goto" data-hash="add">+ Add income</button>
        <button class="qa-pill secondary" data-action="goto" data-hash="add">+ Add expense</button>
        <button class="qa-pill secondary" data-action="goto" data-hash="add">⇄ Transfer</button>
      </div>
    </div>

    <div class="section-title">Recent transactions</div>
    <div class="ledger-list">
      ${recent.length === 0 ? emptyHTML("No transactions yet — add your first one.") : recent.map((t) => `
        <div class="ledger-row">
          <div>
            <div class="row-title">${esc(t.description || catName(t.category))}</div>
            <div class="row-sub txt-mono muted">${esc(fmtDate(t.date))} · ${esc(catName(t.category))}</div>
          </div>
          ${amountHTML(t.amount, t.type)}
        </div>`).join("")}
    </div>`;
}

/* ---------------------------------- page: transactions ---------------------------------- */

function pageTransactions() {
  const rows = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  return `
    <div class="page-head"><div><h1>Transactions</h1><p class="muted"><span id="tx-count">${rows.length}</span> of ${rows.length} records</p></div></div>

    <div class="filter-bar">
      <div class="search-box">🔍<input id="tx-search" placeholder="Search description…" /></div>
      <select id="tx-filter-type"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option></select>
      <select id="tx-filter-cat"><option value="all">All categories</option>${state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <select id="tx-filter-acc"><option value="all">All accounts</option>${state.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
      <input type="date" id="tx-filter-from" />
      <input type="date" id="tx-filter-to" />
    </div>

    <div class="ledger-list" id="tx-list">
      ${rows.length === 0 ? emptyHTML("No transactions yet.") : rows.map((t) => `
        <div class="ledger-row" data-tx-row data-type="${t.type}" data-cat="${t.category}" data-acc="${t.accountId}|${t.toAccountId || ""}" data-date="${t.date}" data-desc="${esc((t.description || "").toLowerCase())}">
          <div>
            <div class="row-title">${t.type === "transfer" ? `${esc(accName(t.accountId))} → ${esc(accName(t.toAccountId))}` : esc(t.description || catName(t.category))}</div>
            <div class="row-sub txt-mono muted">${esc(fmtDate(t.date))} · ${esc(catName(t.category))} · ${esc(accName(t.accountId))}</div>
          </div>
          <div class="row-actions">
            ${amountHTML(t.amount, t.type)}
            <button class="icon-btn" data-action="edit-tx" data-id="${t.id}" aria-label="Edit">✎</button>
            <button class="icon-btn" data-action="delete-tx" data-id="${t.id}" aria-label="Delete">🗑</button>
          </div>
        </div>`).join("")}
    </div>`;
}

function initTxFilters() {
  const apply = () => {
    const q = (document.getElementById("tx-search")?.value || "").toLowerCase();
    const type = document.getElementById("tx-filter-type")?.value || "all";
    const cat = document.getElementById("tx-filter-cat")?.value || "all";
    const acc = document.getElementById("tx-filter-acc")?.value || "all";
    const from = document.getElementById("tx-filter-from")?.value || "";
    const to = document.getElementById("tx-filter-to")?.value || "";
    let shown = 0;
    document.querySelectorAll("[data-tx-row]").forEach((row) => {
      const okType = type === "all" || row.dataset.type === type;
      const okCat = cat === "all" || row.dataset.cat === cat;
      const okAcc = acc === "all" || row.dataset.acc.split("|").includes(acc);
      const okFrom = !from || row.dataset.date >= from;
      const okTo = !to || row.dataset.date <= to + "T23:59";
      const okQ = !q || row.dataset.desc.includes(q);
      const visible = okType && okCat && okAcc && okFrom && okTo && okQ;
      row.style.display = visible ? "" : "none";
      if (visible) shown++;
    });
    const countEl = document.getElementById("tx-count");
    if (countEl) countEl.textContent = shown;
  };
  ["tx-search"].forEach((id) => document.getElementById(id)?.addEventListener("input", apply));
  ["tx-filter-type", "tx-filter-cat", "tx-filter-acc", "tx-filter-from", "tx-filter-to"].forEach((id) => document.getElementById(id)?.addEventListener("change", apply));
}

/* ---------------------------------- page: add transaction ---------------------------------- */

function defaultAddForm() {
  return { type: "expense", amount: "", date: nowLocalInput(), category: "food", accountId: state.accounts[0]?.id || "", toAccountId: "", description: "", recurring: false, frequency: "monthly", debtPartyName: "", linkDebtId: "" };
}

function accountFieldLabel(f) {
  if (f.type === "transfer") return "From account";
  if (f.category === "debt_new") return "Debt from account";
  if (f.category === "loan_given") return "Loan to account";
  if (f.category === "debt") return "Debt repaid to account";
  if (f.category === "loan_repay") return "Loan repaid from account";
  return "Account / payment method";
}

function pageAdd() {
  const editing = ui.editingTxId ? state.transactions.find((t) => t.id === ui.editingTxId) : null;
  if (!ui.addForm) {
    ui.addForm = editing
      ? { type: editing.type, amount: String(editing.amount), date: editing.date, category: editing.category, accountId: editing.accountId, toAccountId: editing.toAccountId || "", description: editing.description || "", recurring: !!editing.recurring, frequency: editing.frequency || "monthly", debtPartyName: "", linkDebtId: editing.debtId || "" }
      : defaultAddForm();
    ui.addingCategoryInline = false;
  }
  const f = ui.addForm;
  const cats = state.categories.filter((c) => c.type === f.type || c.type === "both" || (f.type === "transfer" && c.type === "transfer"));

  const showNewDebtField = f.category === "debt_new" || f.category === "loan_given";
  const showLinkDebtField = f.category === "debt" || f.category === "loan_repay";
  const linkDebtDirection = f.category === "debt" ? "owe" : "owed";
  const eligibleDebts = state.debts.filter((d) => d.direction === linkDebtDirection && d.amount - d.paid > 0);

  return `
    <div class="page-head"><div><h1>${editing ? "Edit transaction" : "Add transaction"}</h1><p class="muted">Income, expense or transfer between your accounts</p></div></div>
    <form class="ledger-form" data-form="add-transaction">
      <div class="type-toggle">
        ${["income", "expense", "transfer"].map((t) => `<button type="button" class="type-btn ${f.type === t ? "active " + t : ""}" data-action="set-type" data-value="${t}">${t === "income" ? "↑" : t === "expense" ? "↓" : "⇄"} ${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
      </div>

      <label>Amount (KES)<input type="number" step="0.01" min="0" name="amount" value="${esc(f.amount)}" required /></label>
      <label>Date &amp; time<input type="datetime-local" name="date" value="${esc(f.date)}" required /></label>
      <label>${accountFieldLabel(f)}
        <select name="accountId">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === f.accountId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
      </label>
      ${f.type === "transfer" ? `<label>To account
        <select name="toAccountId"><option value="">Select account…</option>${state.accounts.filter((a) => a.id !== f.accountId).map((a) => `<option value="${a.id}" ${a.id === f.toAccountId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
      </label>` : ""}
      <label>Category<select name="category">${cats.map((c) => `<option value="${c.id}" ${c.id === f.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}<option value="__new__">+ Add new category…</option></select></label>
      ${ui.addingCategoryInline ? `
        <div class="inline-form" style="margin:0 0 4px">
          <input id="new-cat-name" placeholder="New category name" />
          <select id="new-cat-type"><option value="expense">Expense</option><option value="income">Income</option></select>
          <button type="button" class="btn btn-primary" data-action="create-inline-category">Create</button>
          <button type="button" class="btn btn-ghost" data-action="cancel-inline-category">Cancel</button>
        </div>` : ""}
      ${showNewDebtField ? `<label>${f.category === "debt_new" ? "Lender" : "Borrower"} name (optional — creates a linked debt record)
        <input name="debtPartyName" value="${esc(f.debtPartyName)}" placeholder="e.g. Kopa Cash, Sally, Daisy" />
      </label>` : ""}
      ${showLinkDebtField ? `<label>Which ${f.category === "debt" ? "debt" : "loan"}? (optional)
        <select name="linkDebtId">
          <option value="">None — just record the transaction</option>
          ${eligibleDebts.map((d) => `<option value="${d.id}" ${f.linkDebtId === d.id ? "selected" : ""}>${esc(d.name)} (${fmtShort(d.amount - d.paid)} remaining)</option>`).join("")}
        </select>
      </label>` : ""}
      <label>Description / notes<textarea rows="2" name="description" placeholder="What was this for?">${esc(f.description)}</textarea></label>
      <label class="checkbox-row"><input type="checkbox" name="recurring" ${f.recurring ? "checked" : ""} data-action="toggle-recurring" /> This repeats</label>
      ${f.recurring ? `<label>Frequency<select name="frequency">
        ${["daily", "weekly", "monthly", "yearly"].map((fr) => `<option value="${fr}" ${fr === f.frequency ? "selected" : ""}>${fr[0].toUpperCase() + fr.slice(1)}</option>`).join("")}
      </select></label>` : ""}
      <div class="form-actions">
        ${editing ? `<button type="button" class="btn btn-ghost" data-action="cancel-edit">Cancel edit</button>` : ""}
        <button type="submit" class="btn btn-primary">${editing ? "Save changes" : "Save transaction"}</button>
      </div>
    </form>`;
}

function syncAddFormFromDOM() {
  const form = document.querySelector('[data-form="add-transaction"]');
  if (!form || !ui.addForm) return;
  const fd = new FormData(form);
  ui.addForm.amount = fd.get("amount") || ui.addForm.amount;
  ui.addForm.date = fd.get("date") || ui.addForm.date;
  ui.addForm.accountId = fd.get("accountId") || ui.addForm.accountId;
  ui.addForm.toAccountId = fd.get("toAccountId") || ui.addForm.toAccountId;
  ui.addForm.description = fd.get("description") ?? ui.addForm.description;
  ui.addForm.debtPartyName = fd.get("debtPartyName") ?? ui.addForm.debtPartyName;
  ui.addForm.linkDebtId = fd.get("linkDebtId") ?? ui.addForm.linkDebtId;
}

/* ---------------------------------- page: accounts ---------------------------------- */

let addingAccount = false;
let showLiquidOnly = false;

function pageAccounts() {
  const list = showLiquidOnly ? state.accounts.filter(isLiquid) : state.accounts;
  return `
    <div class="page-head"><div><h1>Accounts &amp; wallets</h1><p class="muted">Cash, mobile money, bank, savings and investment balances</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ${showLiquidOnly ? "btn-primary" : "btn-outline"}" data-action="toggle-liquid-filter">⚡ Accessible only (&lt;72h)</button>
        <button class="btn btn-primary" data-action="toggle-add-account">+ New account</button>
      </div></div>

    ${addingAccount ? `<form class="inline-form" data-form="add-account">
      <input name="name" placeholder="Account name" required />
      <select name="type"><option value="cash">Cash</option><option value="mobile">Mobile money</option><option value="bank">Bank</option><option value="savings">Savings</option><option value="investment">Investment</option><option value="credit">Credit / debt</option></select>
      <input name="description" placeholder="Notes (optional)" />
      <label class="checkbox-row" style="margin:0"><input type="checkbox" name="liquid" checked /> Accessible within 72h</label>
      <button class="btn btn-primary" type="submit">Add</button>
    </form>` : ""}

    <div class="grid-cards">
      ${list.length === 0 ? emptyHTML("No accounts match this filter.") : list.map((a) => {
        const pnl = accountPnl(a.id);
        const liquid = isLiquid(a);
        return `
        <div class="account-card">
          <div class="account-top">
            <span class="tag txt-mono">${esc(a.type)}</span>
            <span class="liquid-tag ${liquid ? "yes" : "no"}">${liquid ? "Accessible <72h" : "Locked"}</span>
            <button class="icon-btn" data-action="delete-account" data-id="${a.id}" aria-label="Remove">🗑</button>
          </div>
          <div class="account-name" data-action="toggle-account" data-id="${a.id}">${esc(a.name)}</div>
          <div class="account-balance ${a.balance < 0 ? "neg" : ""}">${fmt(a.balance)}</div>
          <div class="pnl-line">P&amp;L: ${amountHTML(Math.abs(pnl), pnl >= 0 ? "income" : "expense")}</div>
          <textarea class="acc-desc-input" rows="2" placeholder="Notes about this account (optional)" data-action="set-account-desc" data-id="${a.id}">${esc(a.description || "")}</textarea>
          <label class="liquid-toggle-row"><input type="checkbox" data-action="toggle-liquid" data-id="${a.id}" ${liquid ? "checked" : ""} /> Accessible within 72h</label>
          ${ui.openAccountId === a.id ? renderAccountHistory(a.id) : ""}
        </div>`;
      }).join("")}
    </div>`;
}

function renderAccountHistory(accId) {
  const rows = state.transactions.filter((t) => t.accountId === accId || t.toAccountId === accId)
    .sort((x, y) => new Date(y.date) - new Date(x.date)).slice(0, 8);
  if (!rows.length) return `<div class="account-history"><div class="muted txt-mono">No activity yet</div></div>`;
  return `<div class="account-history">${rows.map((t) => `
    <div class="mini-row"><span class="muted txt-mono">${esc(fmtDate(t.date))}</span><span>${esc(t.description || catName(t.category))}</span>
    ${amountHTML(t.amount, t.accountId === accId ? t.type : (t.type === "transfer" ? "income" : t.type))}</div>`).join("")}</div>`;
}

/* ---------------------------------- page: budget ---------------------------------- */

function pageBudget() {
  const thisMonth = monthKey(new Date().toISOString());
  const spentByCat = {};
  state.transactions.filter((t) => t.type === "expense" && monthKey(t.date) === thisMonth).forEach((t) => { spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount; });
  const expenseCats = state.categories.filter((c) => c.type === "expense" || c.type === "both");
  const totalBudgeted = Object.values(state.budget.categoryBudgets || {}).reduce((s, v) => s + v, 0);
  const totalSpent = Object.values(spentByCat).reduce((s, v) => s + v, 0);

  return `
    <div class="page-head"><div><h1>Budget</h1><p class="muted">Split income by percentage and track category spend</p></div></div>

    <div class="ledger-card">
      <div class="section-title" style="margin-top:0">Monthly income</div>
      <div class="inline-form" style="margin-top:0">
        <input type="number" id="budget-income" value="${state.budget.monthlyIncome || 0}" data-action="set-income" />
        <span class="muted txt-mono">/ month</span>
      </div>
    </div>

    <div class="section-title">Category budgets</div>
    <div class="ledger-list">
      ${expenseCats.map((c) => {
        const budgeted = state.budget.categoryBudgets[c.id] || 0;
        const spent = spentByCat[c.id] || 0;
        const pct = budgeted ? Math.min(100, (spent / budgeted) * 100) : 0;
        const incomePct = state.budget.monthlyIncome ? ((budgeted / state.budget.monthlyIncome) * 100).toFixed(1) : 0;
        return `<div class="ledger-row budget-row">
          <div style="flex:1">
            <div class="row-title">${esc(c.name)} <span class="muted txt-mono">(${incomePct}% of income)</span></div>
            <div class="progress-track"><div class="progress-fill ${pct >= 100 ? "over" : ""}" style="width:${pct}%"></div></div>
            <div class="row-sub txt-mono muted">${fmtShort(spent)} spent · ${fmtShort(Math.max(0, budgeted - spent))} remaining ${pct >= 100 ? '<span class="neg"> · over budget</span>' : ""}</div>
          </div>
          <input type="number" class="budget-input" value="${budgeted || ""}" placeholder="0.00" data-action="set-cat-budget" data-id="${c.id}" />
        </div>`;
      }).join("")}
    </div>

    <div class="ledger-card">
      <div class="hero-row">
        <div><span class="muted">Total budgeted</span><div class="txt-mono">${fmt(totalBudgeted)}</div></div>
        <div><span class="muted">Total spent</span><div class="txt-mono neg">${fmt(totalSpent)}</div></div>
        <div><span class="muted">Left to allocate</span><div class="txt-mono">${fmt((state.budget.monthlyIncome || 0) - totalBudgeted)}</div></div>
      </div>
    </div>`;
}

/* ---------------------------------- page: categories ---------------------------------- */

function categoriesSectionHTML() {
  return `
    <form class="inline-form" data-form="add-category">
      <input name="name" placeholder="New category name" required />
      <select name="type"><option value="expense">Expense</option><option value="income">Income</option></select>
      <button class="btn btn-primary" type="submit">Add category</button>
    </form>
    <div class="chip-grid">
      ${state.categories.map((c, i) => `
        <div class="chip" style="border-color:${CAT_COLORS[i % CAT_COLORS.length]}">
          <span class="chip-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></span>
          ${esc(c.name)} <span class="muted txt-mono">· ${esc(c.type)}</span>
          <button class="icon-btn" data-action="delete-category" data-id="${c.id}" aria-label="Delete">✕</button>
        </div>`).join("")}
    </div>`;
}

/* ---------------------------------- page: reports ---------------------------------- */

function pageReports() {
  const months = [...new Set(state.transactions.map((t) => monthKey(t.date)))].sort().slice(-6);
  const trend = months.map((m) => ({
    month: m,
    income: state.transactions.filter((t) => t.type === "income" && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0),
    expense: state.transactions.filter((t) => t.type === "expense" && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0),
  }));
  const byCat = {};
  state.transactions.filter((t) => t.type === "expense").forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const pieData = Object.entries(byCat).map(([k, v]) => ({ name: catName(k), value: v }));
  const largest = [...state.transactions].filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
  const totalIncome = state.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = state.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return `
    <div class="page-head"><div><h1>Reports &amp; analytics</h1><p class="muted">Income vs expenses, spending patterns and trends</p></div></div>
    <div class="ledger-card"><div class="hero-row">
      <div><span class="muted">All-time income</span><div class="txt-mono pos">${fmt(totalIncome)}</div></div>
      <div><span class="muted">All-time expenses</span><div class="txt-mono neg">${fmt(totalExpense)}</div></div>
      <div><span class="muted">Cash-flow</span><div class="txt-mono ${totalIncome - totalExpense >= 0 ? "pos" : "neg"}">${fmt(totalIncome - totalExpense)}</div></div>
    </div></div>

    <div class="section-title">Monthly trend</div>
    <div class="chart-box">${lineChartSVG(trend)}</div>

    <div class="section-title">Spending by category</div>
    <div class="chart-box">${pieChartHTML(pieData)}</div>

    <div class="section-title">Largest expenses</div>
    <div class="ledger-list">
      ${largest.length === 0 ? emptyHTML("No expenses recorded yet.") : largest.map((t) => `
        <div class="ledger-row"><div><div class="row-title">${esc(t.description || catName(t.category))}</div><div class="row-sub txt-mono muted">${esc(fmtDate(t.date))} · ${esc(catName(t.category))}</div></div>${amountHTML(t.amount, "expense")}</div>`).join("")}
    </div>`;
}

/* ---------------------------------- page: bills ---------------------------------- */

function pageBills() {
  const sorted = [...state.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return `
    <div class="page-head"><div><h1>Bills &amp; recurring payments</h1><p class="muted">Upcoming bills, due dates and status</p></div></div>
    <form class="ledger-form" data-form="add-bill">
      <label>Bill name<input name="name" placeholder="e.g. Rent, DSTV, Electricity" required /></label>
      <label>Amount<input type="number" name="amount" required /></label>
      <label>Due date<input type="date" name="dueDate" value="${todayISO()}" /></label>
      <label>Pay from<select name="accountId">${state.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
      <label class="checkbox-row"><input type="checkbox" name="recurring" checked /> Recurring</label>
      <label>Frequency<select name="frequency"><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option><option value="yearly">Yearly</option></select></label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Add bill</button></div>
    </form>
    <div class="ledger-list">
      ${sorted.length === 0 ? emptyHTML("No bills tracked yet.") : sorted.map((b) => `
        <div class="ledger-row">
          <div><div class="row-title">${esc(b.name)} ${b.recurring ? `<span class="tag txt-mono">${esc(b.frequency)}</span>` : ""}</div>
          <div class="row-sub txt-mono muted">Due ${esc(fmtDate(b.dueDate))} · ${esc(accName(b.accountId))}</div></div>
          <div class="row-actions">
            <span class="txt-mono amt">${fmtShort(b.amount)}</span>
            <button class="status-pill ${b.status}" data-action="toggle-bill" data-id="${b.id}">${b.status === "paid" ? "✓ paid" : "unpaid"}</button>
            <button class="icon-btn" data-action="delete-bill" data-id="${b.id}">🗑</button>
          </div>
        </div>`).join("")}
    </div>`;
}

/* ---------------------------------- page: goals ---------------------------------- */

function pageGoals() {
  return `
    <div class="page-head"><div><h1>Savings goals</h1><p class="muted">Set targets and track contributions</p></div></div>
    <form class="ledger-form" data-form="add-goal">
      <label>Goal name<input name="name" placeholder="e.g. Emergency fund" required /></label>
      <label>Target amount<input type="number" name="target" required /></label>
      <label>Deadline<input type="date" name="deadline" /></label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Add goal</button></div>
    </form>
    <div class="grid-cards">
      ${state.goals.length === 0 ? emptyHTML("No savings goals yet.") : state.goals.map((g) => {
        const pct = Math.min(100, (g.current / g.target) * 100);
        return `<div class="account-card">
          <div class="account-top"><span class="tag txt-mono">${g.deadline ? esc(fmtDate(g.deadline)) : "no deadline"}</span>
            <button class="icon-btn" data-action="delete-goal" data-id="${g.id}">🗑</button></div>
          <div class="account-name">${esc(g.name)}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="row-sub txt-mono muted">${fmtShort(g.current)} of ${fmtShort(g.target)} · ${pct.toFixed(0)}%</div>
          ${ui.contributingGoalId === g.id
            ? `<form class="inline-form" style="margin-top:8px" data-form="contribute-goal" data-id="${g.id}"><input type="number" name="amount" placeholder="Amount" /><button class="btn btn-primary" type="submit">Add</button></form>`
            : `<button class="btn btn-outline" style="margin-top:8px" data-action="toggle-contribute-goal" data-id="${g.id}">+ Contribute</button>`}
        </div>`;
      }).join("")}
    </div>`;
}

/* ---------------------------------- page: debts ---------------------------------- */

function debtLinkedTx(debtId) {
  return state.transactions.filter((t) => t.debtId === debtId).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function debtListHTML(list) {
  if (!list.length) return emptyHTML("Nothing here.");
  return list.map((d) => {
    const remaining = d.amount - d.paid;
    const linkedTx = debtLinkedTx(d.id);
    const actionLabel = d.direction === "owe" ? "Record payment" : "Record collection";
    const formLabel = d.direction === "owe" ? "Pay from account" : "Received into account";
    return `<div class="ledger-row">
      <div style="flex:1">
        <div class="row-title">${esc(d.name)} ${d.accountId ? `<span class="tag txt-mono">${esc(accName(d.accountId))}</span>` : ""} ${d.dueDate ? `<span class="tag txt-mono">due ${esc(fmtDate(d.dueDate))}</span>` : ""}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${(d.paid / d.amount) * 100 || 0}%"></div></div>
        <div class="row-sub txt-mono muted">${fmtShort(d.paid)} paid of ${fmtShort(d.amount)} · ${fmtShort(remaining)} remaining</div>
        ${ui.payingDebtId === d.id ? `<form class="inline-form" style="margin-top:6px" data-form="pay-debt" data-id="${d.id}">
            <input type="number" name="amount" placeholder="Amount" required />
            <select name="accountId">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === d.accountId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
            <span class="muted" style="font-size:11px">${esc(formLabel)}</span>
            <button class="btn btn-primary" type="submit">Record</button>
          </form>` : ""}
        ${linkedTx.length ? `<div class="account-history">${linkedTx.slice(0, 4).map((t) => `
          <div class="mini-row"><span class="muted txt-mono">${esc(fmtDate(t.date))}</span><span>${esc(t.description || catName(t.category))}</span>${amountHTML(t.amount, t.type)}</div>`).join("")}</div>` : ""}
      </div>
      <div class="row-actions">
        ${remaining > 0 && ui.payingDebtId !== d.id ? `<button class="btn btn-outline" data-action="toggle-pay-debt" data-id="${d.id}">${actionLabel}</button>` : ""}
        <button class="icon-btn" data-action="delete-debt" data-id="${d.id}">🗑</button>
      </div>
    </div>`;
  }).join("");
}

function pageDebts() {
  const owe = state.debts.filter((d) => d.direction === "owe");
  const owed = state.debts.filter((d) => d.direction === "owed");
  const totalOwe = owe.reduce((s, d) => s + (d.amount - d.paid), 0);
  const totalOwed = owed.reduce((s, d) => s + (d.amount - d.paid), 0);

  return `
    <div class="page-head"><div><h1>Debts &amp; loans</h1><p class="muted">Money you owe and money owed to you</p></div></div>
    <div class="ledger-card"><div class="hero-row">
      <div><span class="muted">Total you owe</span><div class="txt-mono neg">${fmt(totalOwe)}</div></div>
      <div><span class="muted">Total owed to you</span><div class="txt-mono pos">${fmt(totalOwed)}</div></div>
    </div></div>

    <form class="ledger-form" data-form="add-debt">
      <label>Name<input name="name" placeholder="Lender / borrower" required /></label>
      <label>Amount<input type="number" name="amount" required /></label>
      <label>Direction<select name="direction" data-role="debt-direction"><option value="owe">I owe this (I borrowed)</option><option value="owed">Owed to me (I lent it)</option></select></label>
      <label>Linked account<select name="accountId"><option value="">None</option>${state.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
      <label>Due date<input type="date" name="dueDate" /></label>
      <label class="checkbox-row"><input type="checkbox" name="recordTx" /> <span data-role="debt-tx-label">Record this as a transaction now (money received into the linked account)</span></label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Add</button></div>
    </form>

    <div class="section-title">You owe</div><div class="ledger-list">${debtListHTML(owe)}</div>
    <div class="section-title">Owed to you</div><div class="ledger-list">${debtListHTML(owed)}</div>`;
}

/* ---------------------------------- page: net worth ---------------------------------- */

function pageNetWorth() {
  const liabilities = state.debts.filter((d) => d.direction === "owe").reduce((s, d) => s + (d.amount - d.paid), 0);
  const receivables = state.debts.filter((d) => d.direction === "owed").reduce((s, d) => s + (d.amount - d.paid), 0);
  const assets = state.accounts.reduce((s, a) => s + Math.max(0, a.balance), 0) + receivables + state.goals.reduce((s, g) => s + g.current, 0);
  const netWorth = assets - liabilities;

  return `
    <div class="page-head"><div><h1>Net worth</h1><p class="muted">Assets minus liabilities, right now</p></div></div>
    <div class="hero-card">
      <div class="hero-label">Net worth</div><div class="hero-figure">${fmt(netWorth)}</div><div class="hero-rule"></div>
      <div class="hero-row"><div><span class="muted">Assets</span><div class="txt-mono pos">${fmt(assets)}</div></div><div><span class="muted">Liabilities</span><div class="txt-mono neg">${fmt(liabilities)}</div></div></div>
    </div>
    <div class="section-title">Assets</div>
    <div class="ledger-list">
      ${state.accounts.filter((a) => a.balance > 0).map((a) => `<div class="ledger-row"><div class="row-title">${esc(a.name)}</div>${amountHTML(a.balance, "income")}</div>`).join("")}
      ${state.debts.filter((d) => d.direction === "owed").map((d) => `<div class="ledger-row"><div class="row-title">${esc(d.name)} <span class="tag txt-mono">receivable</span></div>${amountHTML(d.amount - d.paid, "income")}</div>`).join("")}
      ${state.goals.map((g) => `<div class="ledger-row"><div class="row-title">${esc(g.name)} <span class="tag txt-mono">savings goal</span></div>${amountHTML(g.current, "income")}</div>`).join("")}
    </div>
    <div class="section-title">Liabilities</div>
    <div class="ledger-list">
      ${state.debts.filter((d) => d.direction === "owe").map((d) => `<div class="ledger-row"><div class="row-title">${esc(d.name)}</div>${amountHTML(d.amount - d.paid, "expense")}</div>`).join("")}
      ${state.accounts.filter((a) => a.balance < 0).map((a) => `<div class="ledger-row"><div class="row-title">${esc(a.name)}</div>${amountHTML(Math.abs(a.balance), "expense")}</div>`).join("")}
    </div>`;
}

/* ---------------------------------- page: investments ---------------------------------- */

function pageInvestments() {
  const invAccounts = state.accounts.filter((a) => a.type === "investment");
  const total = invAccounts.reduce((s, a) => s + a.balance, 0);
  return `
    <div class="page-head"><div><h1>Investments</h1><p class="muted">Stocks, funds, crypto — track contributions and value</p></div></div>
    <div class="ledger-card"><span class="muted">Total invested</span><div class="txt-mono" style="font-size:20px">${fmt(total)}</div></div>
    <div class="grid-cards">
      ${invAccounts.length === 0 ? emptyHTML("Mark an account as 'investment' type in Accounts to see it here.") : invAccounts.map((a) => `
        <div class="account-card">
          <div class="account-top"><span class="tag txt-mono">investment</span></div>
          <div class="account-name">${esc(a.name)}</div>
          <div class="account-balance">${fmt(a.balance)}</div>
          ${ui.contributingInvId === a.id
            ? `<form class="inline-form" style="margin-top:8px" data-form="contribute-invest" data-id="${a.id}"><input type="number" name="amount" placeholder="Amount" /><button class="btn btn-primary" type="submit">Add</button></form>`
            : `<button class="btn btn-outline" style="margin-top:8px" data-action="toggle-contribute-invest" data-id="${a.id}">+ Add contribution</button>`}
        </div>`).join("")}
    </div>`;
}

/* ---------------------------------- page: business ---------------------------------- */

let businessFormType = "sale";

function pageBusiness() {
  const sales = state.business.entries.filter((e) => e.type === "sale").reduce((s, e) => s + e.amount, 0);
  const expenses = state.business.entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);

  return `
    <div class="page-head"><div><h1>Business ledger</h1><p class="muted">Keep business finances separate from personal</p></div>
      <button class="btn btn-outline" data-action="toggle-business-enabled">${state.business.enabled ? "In use" : "Enable"}</button></div>
    ${!state.business.enabled ? emptyHTML("Business ledger is off. Turn it on above if you want to track sales and expenses separately.") : `
      <div class="ledger-card"><div class="hero-row">
        <div><span class="muted">Sales</span><div class="txt-mono pos">${fmt(sales)}</div></div>
        <div><span class="muted">Business expenses</span><div class="txt-mono neg">${fmt(expenses)}</div></div>
        <div><span class="muted">Profit / loss</span><div class="txt-mono ${sales - expenses >= 0 ? "pos" : "neg"}">${fmt(sales - expenses)}</div></div>
      </div></div>
      <form class="ledger-form" data-form="add-business-entry">
        <div class="type-toggle">
          <button type="button" class="type-btn ${businessFormType === "sale" ? "active income" : ""}" data-action="set-biz-type" data-value="sale">Sale</button>
          <button type="button" class="type-btn ${businessFormType === "expense" ? "active expense" : ""}" data-action="set-biz-type" data-value="expense">Expense</button>
        </div>
        <label>Amount<input type="number" name="amount" required /></label>
        <label>Date<input type="date" name="date" value="${todayISO()}" /></label>
        <label>Customer / supplier<input name="party" /></label>
        <label>Description<input name="description" /></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Add entry</button></div>
      </form>
      <div class="ledger-list">
        ${state.business.entries.length === 0 ? emptyHTML("No business entries yet.") : [...state.business.entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => `
          <div class="ledger-row">
            <div><div class="row-title">${esc(e.description || e.party || (e.type === "sale" ? "Sale" : "Expense"))}</div><div class="row-sub txt-mono muted">${esc(fmtDate(e.date))}${e.party ? " · " + esc(e.party) : ""}</div></div>
            <div class="row-actions">${amountHTML(e.amount, e.type === "sale" ? "income" : "expense")}<button class="icon-btn" data-action="delete-business" data-id="${e.id}">🗑</button></div>
          </div>`).join("")}
      </div>`}
  `;
}

/* ---------------------------------- page: more ---------------------------------- */

function pageMore() {
  const notifications = [];
  state.bills.filter((b) => b.status === "unpaid").forEach((b) => notifications.push(`${b.name} is due ${fmtDate(b.dueDate)} — ${fmtShort(b.amount)}`));
  Object.entries(state.budget.categoryBudgets || {}).forEach(([catId, budget]) => {
    const spent = state.transactions.filter((t) => t.type === "expense" && t.category === catId && monthKey(t.date) === monthKey(new Date().toISOString())).reduce((s, t) => s + t.amount, 0);
    if (budget && spent >= budget) notifications.push(`${catName(catId)} budget exceeded (${fmtShort(spent)} of ${fmtShort(budget)})`);
  });
  const upcoming = [...state.bills].filter((b) => b.status === "unpaid").sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return `
    <div class="page-head"><div><h1>More</h1><p class="muted">Notifications, calendar, and import / export</p></div></div>
    <div class="section-title">🔔 Notifications</div>
    <div class="ledger-list">${notifications.length === 0 ? emptyHTML("Nothing needs your attention.") : notifications.map((n) => `<div class="ledger-row"><div class="row-title">${esc(n)}</div></div>`).join("")}</div>
    <div class="section-title">📅 Upcoming on the calendar</div>
    <div class="ledger-list">${upcoming.length === 0 ? emptyHTML("No upcoming bills.") : upcoming.map((b) => `<div class="ledger-row"><div class="row-title">${esc(b.name)}</div><span class="txt-mono muted">${esc(fmtDate(b.dueDate))}</span></div>`).join("")}</div>
    <div class="section-title">Import / export</div>
    <div class="ledger-card">
      <div class="quick-actions" style="margin-top:0">
        <button class="btn btn-outline" data-action="export-csv">⬇ Export CSV</button>
        <button class="btn btn-outline" data-action="export-json">⬇ Export full backup (JSON)</button>
      </div>
      <label style="display:block;margin-top:14px">Paste a JSON backup to restore
        <textarea rows="4" id="import-text" placeholder="Paste ledger-backup.json contents here"></textarea>
      </label>
      <button class="btn btn-primary" style="margin-top:8px" data-action="import-json">⬆ Import</button>
    </div>`;
}

/* ---------------------------------- page: settings / profile ---------------------------------- */

function pageSettings() {
  const hasPin = !!state.settings.pinHash;
  return `
    <div class="page-head"><div><h1>Settings</h1><p class="muted">Currency, appearance and data</p></div></div>
    <div class="ledger-form" style="max-width:420px">
      <label>Currency<input value="${esc(state.settings.currency)}" disabled /></label>
      <label>Theme<select data-action="set-theme"><option value="light" ${state.settings.theme === "light" ? "selected" : ""}>Light</option><option value="dark" ${state.settings.theme === "dark" ? "selected" : ""}>Dark</option></select></label>
      <label class="checkbox-row"><input type="checkbox" checked /> Bill &amp; budget notifications</label>
    </div>

    <div class="section-title">App lock</div>
    <div class="ledger-card" style="max-width:420px">
      ${hasPin ? `
        <p class="muted" style="margin-top:0">A PIN protects this app on this device.</p>
        <form class="ledger-form" style="padding:0;border:none;background:none;margin-bottom:12px" data-form="change-pin">
          <label>Current PIN<input type="password" inputmode="numeric" pattern="[0-9]*" name="oldPin" required /></label>
          <label>New PIN (4+ digits)<input type="password" inputmode="numeric" pattern="[0-9]*" name="newPin" minlength="4" required /></label>
          <button class="btn btn-outline" type="submit">Change PIN</button>
        </form>
        <form class="inline-form" style="margin:0" data-form="remove-pin">
          <input type="password" inputmode="numeric" pattern="[0-9]*" name="oldPin" placeholder="Current PIN" required />
          <button class="btn btn-ghost" type="submit">Remove PIN</button>
        </form>
      ` : `
        <p class="muted" style="margin-top:0">Add a PIN so this app can't be opened without it, even if someone unlocks your phone.</p>
        <form class="ledger-form" style="padding:0;border:none;background:none;margin-bottom:0" data-form="set-pin">
          <label>New PIN (4+ digits)<input type="password" inputmode="numeric" pattern="[0-9]*" name="newPin" minlength="4" required /></label>
          <label>Confirm PIN<input type="password" inputmode="numeric" pattern="[0-9]*" name="confirmPin" minlength="4" required /></label>
          <button class="btn btn-primary" type="submit">Set PIN</button>
        </form>
      `}
      ${hasPin ? `<button class="btn btn-ghost" style="margin-top:12px" data-action="lock-now">🔒 Lock now</button>` : ""}
    </div>

    <div class="section-title">Categories</div>
    <div class="ledger-card">${categoriesSectionHTML()}</div>

    <div class="section-title">Manage</div>
    <p class="muted">Accounts have their own page — see Accounts in the sidebar.</p>
    <div class="section-title">Install</div>
    <p class="muted">Install this app to your phone's home screen from the banner at the top, or your browser's "Add to Home Screen" / "Install app" menu.</p>`;
}

function pageProfile() {
  return `
    <div class="page-head"><div><h1>Profile</h1><p class="muted">Your details, stored only on this device</p></div></div>
    <div class="ledger-form" style="max-width:420px">
      <label>Name<input value="${esc(state.settings.name)}" data-action="set-name" /></label>
      <label>Email / phone<input value="${esc(state.settings.contact)}" data-action="set-contact" /></label>
    </div>`;
}

/* ---------------------------------- split calculator ---------------------------------- */

function pageSplitCalculator() {
  const sc = state.splitCalc;
  const totalPct = sc.rows.reduce((s, r) => s + (r.pct || 0), 0);
  return `
    <div class="page-head"><div><h1>Split calculator</h1><p class="muted">Work out how to divide an amount across your desired categories, by percentage</p></div></div>

    <div class="ledger-card">
      <label style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--muted);max-width:260px">
        Amount to split (KES)
        <input type="number" id="split-amount-input" value="${sc.amount || ""}" placeholder="0.00" />
      </label>
    </div>

    <div class="section-title">Allocations</div>
    <div class="ledger-card" id="split-rows-wrap">
      ${sc.rows.map((r) => `
        <div class="split-row" data-split-row data-id="${r.id}">
          <input name="rowName" value="${esc(r.name)}" placeholder="e.g. Rent, Savings, Fun money" />
          <input name="rowPct" type="number" min="0" max="100" value="${r.pct}" />
          <span class="muted txt-mono" style="font-size:12px">%</span>
          <span class="split-kes txt-mono" id="split-kes-${r.id}">${fmt((sc.amount || 0) * (r.pct || 0) / 100)}</span>
          <button class="icon-btn" data-action="delete-split-row" data-id="${r.id}">🗑</button>
        </div>`).join("")}
      <button class="btn btn-outline" style="margin-top:12px" data-action="add-split-row">+ Add allocation</button>

      <div class="split-summary">
        <div><span class="muted">Allocated</span><div class="txt-mono" id="split-total-pct">${totalPct}%</div></div>
        <div><span class="muted">Remaining</span><div class="txt-mono" id="split-remaining-pct">${100 - totalPct}%</div></div>
        <div><span class="muted">Amount allocated</span><div class="txt-mono" id="split-total-kes">${fmt((sc.amount || 0) * totalPct / 100)}</div></div>
      </div>
    </div>

    <div class="section-title">Notes</div>
    <div class="ledger-card">
      <textarea id="split-notes-input" rows="3" placeholder="Why this split, reminders, anything worth noting…">${esc(sc.notes || "")}</textarea>
    </div>`;
}

function initSplitCalc() {
  const amountInput = document.getElementById("split-amount-input");
  const notesInput = document.getElementById("split-notes-input");
  const recalc = () => {
    const amount = parseFloat(amountInput?.value) || 0;
    let totalPct = 0;
    document.querySelectorAll("[data-split-row]").forEach((row) => {
      const pct = parseFloat(row.querySelector('[name="rowPct"]').value) || 0;
      totalPct += pct;
      const kesEl = document.getElementById("split-kes-" + row.dataset.id);
      if (kesEl) kesEl.textContent = fmt(amount * pct / 100);
    });
    const totalEl = document.getElementById("split-total-pct");
    const remEl = document.getElementById("split-remaining-pct");
    const totalKesEl = document.getElementById("split-total-kes");
    if (totalEl) totalEl.textContent = totalPct + "%";
    if (remEl) { remEl.textContent = (100 - totalPct) + "%"; remEl.className = "txt-mono " + (100 - totalPct < 0 ? "neg" : ""); }
    if (totalKesEl) totalKesEl.textContent = fmt(amount * totalPct / 100);
  };
  amountInput?.addEventListener("input", recalc);
  document.querySelectorAll('[data-split-row] input[name="rowPct"]').forEach((el) => el.addEventListener("input", recalc));

  const commit = () => {
    const amount = parseFloat(amountInput?.value) || 0;
    const rows = [...document.querySelectorAll("[data-split-row]")].map((row) => ({
      id: row.dataset.id,
      name: row.querySelector('[name="rowName"]').value,
      pct: parseFloat(row.querySelector('[name="rowPct"]').value) || 0,
    }));
    const notes = notesInput?.value || "";
    updateSilent((s) => { s.splitCalc = { amount, rows, notes }; });
  };
  amountInput?.addEventListener("change", commit);
  notesInput?.addEventListener("change", commit);
  document.querySelectorAll('[data-split-row] input').forEach((el) => el.addEventListener("change", commit));
}

/* ---------------------------------- page registry ---------------------------------- */

const PAGES = {
  dashboard: pageDashboard, transactions: pageTransactions, add: pageAdd, accounts: pageAccounts,
  budget: pageBudget, split: pageSplitCalculator, reports: pageReports, bills: pageBills,
  goals: pageGoals, debts: pageDebts, networth: pageNetWorth, investments: pageInvestments,
  business: pageBusiness, more: pageMore, settings: pageSettings, profile: pageProfile,
};

/* ---------------------------------- transaction posting helpers ---------------------------------- */

function applyTxEffect(t, sign) {
  const acc = state.accounts.find((a) => a.id === t.accountId);
  if (t.type === "income" && acc) acc.balance += sign * t.amount;
  if (t.type === "expense" && acc) acc.balance -= sign * t.amount;
  if (t.type === "transfer") {
    if (acc) acc.balance -= sign * t.amount;
    const to = state.accounts.find((a) => a.id === t.toAccountId);
    if (to) to.balance += sign * t.amount;
  }
}

/* ---------------------------------- global event delegation ---------------------------------- */

main.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  if (action === "goto") { location.hash = "#" + el.dataset.hash; return; }

  if (action === "set-type") {
    syncAddFormFromDOM();
    ui.addForm.type = el.dataset.value;
    render();
  }
  if (action === "toggle-recurring") {
    syncAddFormFromDOM();
    ui.addForm.recurring = el.checked;
    render();
  }
  if (action === "cancel-edit") { ui.editingTxId = null; ui.addForm = null; render(); }
  if (action === "edit-tx") { ui.editingTxId = id; ui.addForm = null; location.hash = "#add"; }
  if (action === "delete-tx") {
    if (!confirm("Delete this transaction? Account balances will be reversed.")) return;
    const t = state.transactions.find((x) => x.id === id);
    update((s) => { applyTxEffect(t, -1); s.transactions = s.transactions.filter((x) => x.id !== id); });
  }

  if (action === "toggle-add-account") { addingAccount = !addingAccount; render(); }
  if (action === "delete-account") {
    if (!confirm("Remove this account? Its transaction history stays in Transactions.")) return;
    update((s) => { s.accounts = s.accounts.filter((a) => a.id !== id); });
  }
  if (action === "toggle-account") { ui.openAccountId = ui.openAccountId === id ? null : id; render(); }
  if (action === "toggle-liquid-filter") { showLiquidOnly = !showLiquidOnly; render(); }

  if (action === "add-split-row") {
    update((s) => { s.splitCalc.rows.push({ id: uid(), name: "", pct: 0 }); });
  }
  if (action === "delete-split-row") {
    update((s) => { s.splitCalc.rows = s.splitCalc.rows.filter((r) => r.id !== id); });
  }

  if (action === "delete-category") update((s) => { s.categories = s.categories.filter((c) => c.id !== id); });

  if (action === "create-inline-category") {
    const nameEl = document.getElementById("new-cat-name");
    const typeEl = document.getElementById("new-cat-type");
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }
    const type = typeEl.value;
    syncAddFormFromDOM();
    const newId = uid();
    ui.addForm.category = newId;
    ui.addingCategoryInline = false;
    update((s) => { s.categories.push({ id: newId, name, type }); });
  }
  if (action === "cancel-inline-category") {
    syncAddFormFromDOM();
    ui.addingCategoryInline = false;
    render();
  }

  if (action === "set-cat-budget") {
    // handled on change (see below); click not needed
  }

  if (action === "toggle-bill") update((s) => { const b = s.bills.find((x) => x.id === id); b.status = b.status === "paid" ? "unpaid" : "paid"; });
  if (action === "delete-bill") update((s) => { s.bills = s.bills.filter((b) => b.id !== id); });

  if (action === "toggle-contribute-goal") { ui.contributingGoalId = ui.contributingGoalId === id ? null : id; render(); }
  if (action === "delete-goal") update((s) => { s.goals = s.goals.filter((g) => g.id !== id); });

  if (action === "toggle-pay-debt") { ui.payingDebtId = ui.payingDebtId === id ? null : id; render(); }
  if (action === "delete-debt") update((s) => { s.debts = s.debts.filter((d) => d.id !== id); });

  if (action === "toggle-contribute-invest") { ui.contributingInvId = ui.contributingInvId === id ? null : id; render(); }

  if (action === "toggle-business-enabled") update((s) => { s.business.enabled = !s.business.enabled; });
  if (action === "delete-business") update((s) => { s.business.entries = s.business.entries.filter((x) => x.id !== id); });
  if (action === "set-biz-type") { businessFormType = el.dataset.value; render(); }

  if (action === "export-csv") exportCSV();
  if (action === "export-json") exportJSON();
  if (action === "import-json") importJSON();

  if (action === "install-app") triggerInstall();
  if (action === "dismiss-install-banner") hideInstallBanner();
  if (action === "lock-now") lockApp();
});

main.addEventListener("change", (e) => {
  const el = e.target;
  const action = el.dataset.action;
  if (action === "set-income") update((s) => { s.budget.monthlyIncome = parseFloat(el.value) || 0; });
  if (action === "set-cat-budget") update((s) => { s.budget.categoryBudgets[el.dataset.id] = parseFloat(el.value) || 0; });
  if (action === "set-theme") update((s) => { s.settings.theme = el.value; });
  if (action === "set-name") update((s) => { s.settings.name = el.value; });
  if (action === "set-contact") update((s) => { s.settings.contact = el.value; });
  if (action === "toggle-liquid") update((s) => { const a = s.accounts.find((x) => x.id === el.dataset.id); a.liquid72h = el.checked; });
  if (action === "set-account-desc") updateSilent((s) => { const a = s.accounts.find((x) => x.id === el.dataset.id); a.description = el.value; });

  if (el.matches('select[name="category"]') && el.closest('[data-form="add-transaction"]')) {
    syncAddFormFromDOM();
    if (el.value === "__new__") { ui.addingCategoryInline = true; }
    else { ui.addForm.category = el.value; ui.addingCategoryInline = false; }
    render();
  }

  if (el.matches('select[data-role="debt-direction"]')) {
    const labelEl = el.closest("form")?.querySelector('[data-role="debt-tx-label"]');
    if (labelEl) labelEl.textContent = el.value === "owe"
      ? "Record this as a transaction now (money received into the linked account)"
      : "Record this as a transaction now (money leaves the linked account)";
  }
});

main.addEventListener("submit", (e) => {
  const form = e.target;
  if (!form.dataset.form) return;
  e.preventDefault();
  const fd = new FormData(form);

  if (form.dataset.form === "add-transaction") {
    const amount = parseFloat(fd.get("amount"));
    if (!amount || amount <= 0) return alert("Enter a valid amount.");
    const f = ui.addForm;
    f.amount = fd.get("amount"); f.date = fd.get("date"); f.accountId = fd.get("accountId");
    f.toAccountId = fd.get("toAccountId") || ""; f.description = fd.get("description") || "";
    f.recurring = fd.get("recurring") === "on"; f.frequency = fd.get("frequency") || "monthly";
    f.debtPartyName = fd.get("debtPartyName") || ""; f.linkDebtId = fd.get("linkDebtId") || "";
    if (f.type === "transfer" && f.accountId === f.toAccountId) return alert("Choose two different accounts.");

    const editing = ui.editingTxId ? state.transactions.find((t) => t.id === ui.editingTxId) : null;
    update((s) => {
      if (editing) applyTxEffect(editing, -1);

      let debtId = editing ? editing.debtId || null : null;
      if (!editing) {
        if (f.category === "debt_new" && f.debtPartyName.trim()) {
          debtId = uid();
          s.debts.push({ id: debtId, name: f.debtPartyName.trim(), amount, direction: "owe", paid: 0, dueDate: "", accountId: f.accountId });
        } else if (f.category === "loan_given" && f.debtPartyName.trim()) {
          debtId = uid();
          s.debts.push({ id: debtId, name: f.debtPartyName.trim(), amount, direction: "owed", paid: 0, dueDate: "", accountId: f.accountId });
        } else if ((f.category === "debt" || f.category === "loan_repay") && f.linkDebtId) {
          const d = s.debts.find((x) => x.id === f.linkDebtId);
          if (d) { d.paid = Math.min(d.amount, d.paid + amount); debtId = d.id; }
        }
      }

      const record = { id: editing ? editing.id : uid(), type: f.type, amount, date: f.date, category: f.category, accountId: f.accountId, toAccountId: f.type === "transfer" ? f.toAccountId : null, description: f.description, recurring: f.recurring, frequency: f.recurring ? f.frequency : null, debtId };
      applyTxEffect(record, 1);
      if (editing) s.transactions = s.transactions.map((t) => (t.id === editing.id ? record : t));
      else s.transactions.push(record);
    });
    ui.editingTxId = null; ui.addForm = null;
    location.hash = "#transactions";
  }

  if (form.dataset.form === "add-account") {
    const name = fd.get("name"); const type = fd.get("type");
    if (!name?.trim()) return;
    const liquid = fd.get("liquid") === "on";
    const description = fd.get("description") || "";
    update((s) => { s.accounts.push({ id: uid(), name, type, balance: 0, liquid72h: liquid, description }); });
    addingAccount = false;
  }

  if (form.dataset.form === "add-category") {
    const name = fd.get("name"); const type = fd.get("type");
    if (!name?.trim()) return;
    update((s) => { s.categories.push({ id: uid(), name, type }); });
  }

  if (form.dataset.form === "add-bill") {
    update((s) => { s.bills.push({ id: uid(), name: fd.get("name"), amount: parseFloat(fd.get("amount")) || 0, dueDate: fd.get("dueDate"), accountId: fd.get("accountId"), recurring: fd.get("recurring") === "on", frequency: fd.get("frequency"), status: "unpaid" }); });
  }

  if (form.dataset.form === "add-goal") {
    update((s) => { s.goals.push({ id: uid(), name: fd.get("name"), target: parseFloat(fd.get("target")) || 0, current: 0, deadline: fd.get("deadline"), contributions: [] }); });
  }

  if (form.dataset.form === "contribute-goal") {
    const amt = parseFloat(fd.get("amount"));
    if (amt) update((s) => { const g = s.goals.find((x) => x.id === form.dataset.id); g.current += amt; g.contributions = g.contributions || []; g.contributions.push({ date: todayISO(), amount: amt }); });
    ui.contributingGoalId = null;
  }

  if (form.dataset.form === "add-debt") {
    const amount = parseFloat(fd.get("amount")) || 0;
    const direction = fd.get("direction");
    const accountId = fd.get("accountId") || null;
    const recordTx = fd.get("recordTx") === "on";
    if (recordTx && !accountId) { alert("Choose a linked account to record this as a transaction."); return; }
    update((s) => {
      const debtId = uid();
      s.debts.push({ id: debtId, name: fd.get("name"), amount, direction, paid: 0, dueDate: fd.get("dueDate"), accountId });
      if (recordTx && accountId) {
        const txType = direction === "owe" ? "income" : "expense";
        const record = { id: uid(), type: txType, amount, date: nowLocalInput(), category: "debt", accountId, toAccountId: null, description: (direction === "owe" ? "Loan received: " : "Money lent: ") + fd.get("name"), recurring: false, debtId };
        applyTxEffect(record, 1);
        s.transactions.push(record);
      }
    });
  }

  if (form.dataset.form === "pay-debt") {
    const amt = parseFloat(fd.get("amount"));
    const accountId = fd.get("accountId");
    if (amt && accountId) update((s) => {
      const d = s.debts.find((x) => x.id === form.dataset.id);
      d.paid = Math.min(d.amount, d.paid + amt);
      if (!d.accountId) d.accountId = accountId;
      const txType = d.direction === "owe" ? "expense" : "income";
      const record = { id: uid(), type: txType, amount: amt, date: nowLocalInput(), category: "debt", accountId, toAccountId: null, description: (d.direction === "owe" ? "Debt payment: " : "Debt collected: ") + d.name, recurring: false, debtId: d.id };
      applyTxEffect(record, 1);
      s.transactions.push(record);
    });
    ui.payingDebtId = null;
  }

  if (form.dataset.form === "contribute-invest") {
    const amt = parseFloat(fd.get("amount"));
    if (amt) update((s) => {
      const a = s.accounts.find((x) => x.id === form.dataset.id);
      a.balance += amt;
      s.transactions.push({ id: uid(), type: "income", amount: amt, date: nowLocalInput(), category: "investment", accountId: a.id, toAccountId: null, description: "Investment contribution", recurring: false });
    });
    ui.contributingInvId = null;
  }

  if (form.dataset.form === "add-business-entry") {
    update((s) => { s.business.entries.push({ id: uid(), type: businessFormType, amount: parseFloat(fd.get("amount")) || 0, date: fd.get("date"), party: fd.get("party") || "", description: fd.get("description") || "" }); });
  }

  if (form.dataset.form === "set-pin") {
    const newPin = fd.get("newPin"); const confirmPin = fd.get("confirmPin");
    if (newPin.length < 4) { alert("PIN must be at least 4 digits."); return; }
    if (newPin !== confirmPin) { alert("PINs don't match."); return; }
    (async () => {
      const h = await hashPin(newPin);
      update((s) => { s.settings.pinHash = h; });
    })();
  }

  if (form.dataset.form === "change-pin") {
    const oldPin = fd.get("oldPin"); const newPin = fd.get("newPin");
    if (newPin.length < 4) { alert("New PIN must be at least 4 digits."); return; }
    (async () => {
      const oldHash = await hashPin(oldPin);
      if (oldHash !== state.settings.pinHash) { alert("Current PIN is incorrect."); return; }
      const newHash = await hashPin(newPin);
      update((s) => { s.settings.pinHash = newHash; });
    })();
  }

  if (form.dataset.form === "remove-pin") {
    const oldPin = fd.get("oldPin");
    (async () => {
      const oldHash = await hashPin(oldPin);
      if (oldHash !== state.settings.pinHash) { alert("Current PIN is incorrect."); return; }
      update((s) => { s.settings.pinHash = null; });
    })();
  }
});

/* ---------------------------------- export / import ---------------------------------- */

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportCSV() {
  const rows = [["date", "type", "amount", "category", "account", "description"]];
  state.transactions.forEach((t) => rows.push([t.date, t.type, t.amount, catName(t.category), accName(t.accountId), (t.description || "").replace(/,/g, ";")]));
  downloadBlob(rows.map((r) => r.join(",")).join("\n"), "transactions.csv", "text/csv");
}
function exportJSON() { downloadBlob(JSON.stringify(state, null, 2), "ledger-backup.json", "application/json"); }
function importJSON() {
  const text = document.getElementById("import-text")?.value || "";
  try {
    const parsed = JSON.parse(text);
    if (!parsed.accounts || !parsed.transactions) { alert("This doesn't look like a valid backup file."); return; }
    state = parsed;
    saveState();
    render();
    alert("Data imported.");
  } catch { alert("Couldn't parse that JSON."); }
}

/* ---------------------------------- install prompt ---------------------------------- */

let deferredInstallPrompt = null;
function showInstallBanner() { document.getElementById("install-banner")?.classList.add("show"); }
function hideInstallBanner() { document.getElementById("install-banner")?.classList.remove("show"); }
function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; hideInstallBanner(); });
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});
window.addEventListener("appinstalled", hideInstallBanner);

/* ---------------------------------- sidebar / mobile nav ---------------------------------- */

function buildSidebar() {
  const nav = document.getElementById("nav-list");
  nav.innerHTML = NAV.map((n) => `<button class="nav-item" data-nav="${n.id}" data-action="goto" data-hash="${n.id}"><span class="nav-glyph">${n.glyph}</span><span>${esc(n.label)}</span></button>`).join("");
}
document.getElementById("mobile-menu-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("scrim").classList.add("open");
});
function closeMobileNav() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("scrim").classList.remove("open");
}
document.getElementById("mobile-close-btn").addEventListener("click", closeMobileNav);
document.getElementById("scrim").addEventListener("click", closeMobileNav);
document.getElementById("nav-list").addEventListener("click", (e) => {
  const item = e.target.closest(".nav-item");
  if (!item) return;
  const targetHash = "#" + item.dataset.hash;
  if (location.hash === targetHash) render(); else location.hash = targetHash;
  closeMobileNav();
});
document.getElementById("fab-add").addEventListener("click", () => {
  const targetHash = "#add";
  if (location.hash === targetHash) render(); else location.hash = targetHash;
});

/* ---------------------------------- lock screen ---------------------------------- */

function showAppShell() {
  document.getElementById("lock-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "flex";
  render();
}
function showLockScreen() {
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("lock-screen").style.display = "flex";
  const input = document.getElementById("lock-pin-input");
  document.getElementById("lock-error").textContent = "";
  input.value = "";
  setTimeout(() => input.focus(), 50);
}
function lockApp() { showLockScreen(); }

async function attemptUnlock() {
  const input = document.getElementById("lock-pin-input");
  const errorEl = document.getElementById("lock-error");
  const h = await hashPin(input.value);
  if (h === state.settings.pinHash) {
    showAppShell();
  } else {
    errorEl.textContent = "Incorrect PIN — try again.";
    input.value = "";
    input.focus();
  }
}

document.getElementById("lock-unlock-btn").addEventListener("click", attemptUnlock);
document.getElementById("lock-pin-input").addEventListener("keydown", (e) => { if (e.key === "Enter") attemptUnlock(); });
document.getElementById("lock-forgot-btn").addEventListener("click", () => {
  if (!confirm("Resetting removes the PIN AND erases all data stored in this app on this device — this can't be undone. Continue?")) return;
  if (!confirm("Are you absolutely sure? All accounts, transactions, budgets and goals will be permanently deleted.")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

/* ---------------------------------- boot ---------------------------------- */

buildSidebar();
updateBranding();
if (state.settings.pinHash) {
  showLockScreen();
} else {
  showAppShell();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.error("SW registration failed", err));
  });
}
