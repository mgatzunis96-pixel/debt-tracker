import { useState, useEffect, useCallback } from "react";

const INITIAL_CARDS = [
  { id: "reserve", name: "Amex Delta Reserve", balance: 6096.78, originalBalance: 6096.78, apr: 28.49, color: "#FF6B35", priority: 1 },
  { id: "gold",    name: "Amex Gold",           balance: 2418.25, originalBalance: 2418.25, apr: 28.49, color: "#FFB800", priority: 2 },
  { id: "venture", name: "Capital One VentureX",balance: 1855.37, originalBalance: 1855.37, apr: 28.24, color: "#E63946", priority: 3 },
  { id: "blue",    name: "Amex Delta Blue",      balance: 3088.26, originalBalance: 3088.26, apr: 28.24, color: "#457B9D", priority: 4 },
  { id: "apple",   name: "Apple Card",           balance: 3995.46, originalBalance: 3995.46, apr: 25.49, color: "#6D6D6D", priority: 5 },
  { id: "citi",    name: "Citi Costco",          balance: 4049.45, originalBalance: 4049.45, apr: 23.74, color: "#2A9D8F", priority: 6 },
];

const MONTHLY_BUDGET = { rent: 1000, carInsurance: 175.75, lifeInsurance: 300, gym: 115, subscriptions: 45, groceries: 250 };
const TOTAL_FIXED = Object.values(MONTHLY_BUDGET).reduce((a, b) => a + b, 0);
const BIWEEKLY_INCOME = 2517.31;
const MONTHLY_INCOME = BIWEEKLY_INCOME * 2;
const MONTHLY_DEBT_PAYMENT = MONTHLY_INCOME - TOTAL_FIXED;
const CATEGORIES = ["Food & Dining", "Transport", "Shopping", "Entertainment", "Groceries", "Health", "Other"];
const INCOME_TYPES = ["Payroll", "Bonus", "Freelance", "Gift", "Refund", "Sale", "Other"];
const STARTING_BUFFER = 1278.40;
const TIPS = [
  "☕ Skip one coffee out = ~$5 saved toward debt payoff",
  "🛒 Meal prep this week saves ~$60 on dining",
  "📱 Review subscriptions — unused ones are silent debt killers",
  "💡 Every $100 extra toward Amex Gold saves ~$2.37/month in interest",
  "🎯 You're on track for debt freedom in October 2026 — keep going!",
  "🏋️ Gym already paid — use it instead of stress spending",
  "🍕 One fewer takeout meal/week = ~$200/month extra for debt",
  "💳 Pay more than minimum — interest accrues daily",
  "📊 Tracking every purchase alone reduces spending by ~15%",
  "🎉 4 of 6 cards gone by July — huge milestone ahead!",
];

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const inputStyle = {
  width: "100%", background: "#0a0a0f", border: "1px solid #2a2a3a", borderRadius: 8,
  padding: "10px 12px", color: "#e8e4dc", fontSize: 15, marginBottom: 10,
  boxSizing: "border-box", fontFamily: "Georgia, serif",
};
const btnStyle = (color, disabled) => ({
  width: "100%", background: disabled ? "#1a1a2a" : `${color}18`, border: `1px solid ${disabled ? "#2a2a3a" : color}`,
  borderRadius: 8, padding: "12px", color: disabled ? "#4a4a6a" : color, fontSize: 12, letterSpacing: 2,
  textTransform: "uppercase", fontFamily: "monospace", cursor: disabled ? "not-allowed" : "pointer",
});

// ── STORAGE HELPERS ──
const store = {
  async get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error("Storage set failed", e); }
  },
};

export default function DebtTracker() {
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("dashboard");
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "Food & Dining", cardId: "none", note: "" });
  const [paymentForm, setPaymentForm] = useState({ cardId: "reserve", amount: "" });
  const [depositForm, setDepositForm] = useState({ amount: "", type: "Payroll", note: "" });
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [tip] = useState(TIPS[Math.floor(Math.random() * TIPS.length)]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── LOAD ALL DATA ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, e, p, d] = await Promise.all([
        store.get("dt-cards"),
        store.get("dt-expenses"),
        store.get("dt-payments"),
        store.get("dt-deposits"),
      ]);
      setCards(c || INITIAL_CARDS);
      setExpenses(e || []);
      setPayments(p || []);
      setDeposits(d || []);
      setLoading(false);
    })();
  }, []);

  // ── PERSIST on every change ──
  useEffect(() => { if (!loading) store.set("dt-cards", cards); }, [cards, loading]);
  useEffect(() => { if (!loading) store.set("dt-expenses", expenses); }, [expenses, loading]);
  useEffect(() => { if (!loading) store.set("dt-payments", payments); }, [payments, loading]);
  useEffect(() => { if (!loading) store.set("dt-deposits", deposits); }, [deposits, loading]);

  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);

  const todayExpenses = expenses.filter(e => e.date === today);
  const monthExpenses = expenses.filter(e => e.date?.startsWith(thisMonth));
  const spentToday = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const spentMonth = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const dailyBudget = (250 / daysInMonth) * 2;

  const totalDebt = cards.reduce((s, c) => s + (c.balance || 0), 0);
  const totalOriginal = 21503.57;
  const paidOff = totalOriginal - totalDebt;
  const progress = Math.max(0, Math.min(100, (paidOff / totalOriginal) * 100));
  const activeCard = [...cards].filter(c => c.balance > 0).sort((a, b) => a.priority - b.priority)[0];

  const totalDeposited = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const totalCashSpent = expenses.filter(e => e.cardId === "none").reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const bankBalance = STARTING_BUFFER + totalDeposited - totalCashSpent - totalPaid;
  const monthDeposits = deposits.filter(d => d.date?.startsWith(thisMonth));
  const monthDepositTotal = monthDeposits.reduce((s, d) => s + (d.amount || 0), 0);

  // ── SAVINGS GOALS ──
  const EMERGENCY_GOAL = 5000;
  const HOUSE_GOAL = 50000;
  const TOTAL_SAVINGS_GOAL = EMERGENCY_GOAL + HOUSE_GOAL;
  const currentSavings = Math.max(0, bankBalance);
  const emergencyFunded = Math.min(currentSavings, EMERGENCY_GOAL);
  const emergencyPct = Math.min(100, (emergencyFunded / EMERGENCY_GOAL) * 100);
  const emergencyMet = currentSavings >= EMERGENCY_GOAL;
  const houseSaved = emergencyMet ? Math.min(currentSavings - EMERGENCY_GOAL, HOUSE_GOAL) : 0;
  const housePct = Math.min(100, (houseSaved / HOUSE_GOAL) * 100);
  const totalSaved = emergencyFunded + houseSaved;
  const totalSavingsPct = Math.min(100, (totalSaved / TOTAL_SAVINGS_GOAL) * 100);

  const monthsToFreedom = Math.max(1, Math.ceil(totalDebt / MONTHLY_DEBT_PAYMENT));
  const freedomDate = new Date();
  freedomDate.setMonth(freedomDate.getMonth() + monthsToFreedom);
  const freedomStr = freedomDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── ACTIONS ──
  const addExpense = async () => {
    const amt = parseFloat(expenseForm.amount);
    if (!amt || amt <= 0) return showToast("Enter a valid amount", "error");
    const isCard = expenseForm.cardId !== "none";
    const card = INITIAL_CARDS.find(c => c.id === expenseForm.cardId);
    const newExp = { id: Date.now(), amount: amt, category: expenseForm.category, cardId: expenseForm.cardId, cardName: card?.name || null, note: expenseForm.note, date: today };
    setSaving(true);
    const newExpenses = [newExp, ...expenses];
    let newCards = cards;
    if (isCard) {
      newCards = cards.map(c => c.id === expenseForm.cardId ? { ...c, balance: c.balance + amt } : c);
      setCards(newCards);
    }
    setExpenses(newExpenses);
    setExpenseForm({ amount: "", category: "Food & Dining", cardId: "none", note: "" });
    const over = spentToday + amt > 250 / daysInMonth * dayOfMonth;
    showToast(isCard ? `💳 ${fmt(amt)} added to ${card?.name}` : over ? `⚠️ ${fmt(amt)} logged — over budget` : `✅ ${fmt(amt)} deducted from bank`, isCard ? "success" : over ? "warn" : "success");
    setSaving(false);
  };

  const addPayment = async () => {
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) return showToast("Enter a valid amount", "error");
    const card = cards.find(c => c.id === paymentForm.cardId);
    if (!card) return;
    const actual = Math.min(amt, card.balance);
    const newBal = Math.max(0, card.balance - actual);
    setSaving(true);
    const newPayment = { id: Date.now(), cardId: card.id, cardName: card.name, amount: actual, date: today };
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, balance: newBal } : c));
    setPayments(prev => [newPayment, ...prev]);
    setPaymentForm({ cardId: "reserve", amount: "" });
    if (newBal <= 0) showToast(`🎉 ${card.name} is PAID OFF!`, "celebrate");
    else showToast(`💳 ${fmt(actual)} applied to ${card.name} — ${fmt(newBal)} left`, "success");
    setSaving(false);
  };

  const addDeposit = async () => {
    const amt = parseFloat(depositForm.amount);
    if (!amt || amt <= 0) return showToast("Enter a valid amount", "error");
    setSaving(true);
    const newDep = { id: Date.now(), amount: amt, type: depositForm.type, note: depositForm.note, date: today };
    setDeposits(prev => [newDep, ...prev]);
    setDepositForm({ amount: "", type: "Payroll", note: "" });
    showToast(`💰 ${fmt(amt)} ${depositForm.type} logged!`, "success");
    setSaving(false);
  };

  const deleteExpense = (id) => {
    const exp = expenses.find(x => x.id === id);
    if (!exp) return;
    if (exp.cardId && exp.cardId !== "none") {
      setCards(prev => prev.map(c => c.id === exp.cardId ? { ...c, balance: Math.max(0, c.balance - exp.amount) } : c));
    }
    setExpenses(prev => prev.filter(x => x.id !== id));
    showToast(`Removed ${fmt(exp.amount)} expense`, "success");
  };

  const deleteDeposit = (id) => {
    const dep = deposits.find(x => x.id === id);
    setDeposits(prev => prev.filter(x => x.id !== id));
    showToast(`Removed ${fmt(dep?.amount)} deposit`, "success");
  };

  const resetAllData = async () => {
    setSaving(true);
    setCards(INITIAL_CARDS);
    setExpenses([]);
    setPayments([]);
    setDeposits([]);
    setShowResetConfirm(false);
    showToast("✅ All data reset", "success");
    setTab("dashboard");
    setSaving(false);
  };

  const TABS = ["dashboard", "log", "savings", "cards", "history", "settings"];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#6b6b8a" }}>
      <div style={{ fontSize: 28, marginBottom: 16 }}>💳</div>
      <div style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>Loading your data...</div>
      <div style={{ width: 160, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, #FF6B35, #FFB800)", borderRadius: 2 }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e4dc", fontFamily: "'Georgia', serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #0a0a0f, #141420, #0a0a0f)", borderBottom: "1px solid #2a2a3a", padding: "18px 16px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* App title + saving indicator */}
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10, textAlign: "center" }}>
            BUDGET TRACKER {saving && <span style={{ color: "#457B9D" }}>· SAVING...</span>}
          </div>
          {/* Two stats side by side */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 3 }}>DEBT TRACKER</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: "#e8e4dc", lineHeight: 1 }}>{fmt(totalDebt)}</div>
              <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 2 }}>remaining of {fmt(totalOriginal)}</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b6b8a", marginBottom: 3, fontFamily: "monospace" }}>
                  <span>{fmt(paidOff)} paid</span><span>{progress.toFixed(1)}%</span>
                </div>
                <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", width: 150 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #FF6B35, #FFB800)", borderRadius: 2, transition: "width 0.8s ease" }} />
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 3 }}>TOTAL SAVINGS</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: "#2A9D8F", lineHeight: 1 }}>{fmt(totalSaved)}</div>
              <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 2 }}>of {fmt(TOTAL_SAVINGS_GOAL)} goal</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b6b8a", marginBottom: 3, fontFamily: "monospace" }}>
                  <span>{totalSavingsPct.toFixed(1)}%</span><span style={{ color: emergencyMet ? "#2A9D8F" : "#FFB800" }}>{emergencyMet ? "🛡️ funded" : "🛡️ building"}</span>
                </div>
                <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", width: 150 }}>
                  <div style={{ height: "100%", width: `${totalSavingsPct}%`, background: "linear-gradient(90deg, #2A9D8F, #457B9D)", borderRadius: 2, transition: "width 0.8s ease" }} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "8px 1px", background: "none", border: "none",
                borderBottom: tab === t ? "2px solid #FFB800" : "2px solid transparent",
                color: tab === t ? "#FFB800" : "#6b6b8a", fontSize: 8.5, letterSpacing: 0.5,
                textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer",
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          background: toast.type === "error" ? "#3a1010" : toast.type === "warn" ? "#2a2010" : toast.type === "celebrate" ? "#102a10" : "#101a2a",
          border: `1px solid ${toast.type === "error" ? "#ff4444" : toast.type === "warn" ? "#FFB800" : toast.type === "celebrate" ? "#2A9D8F" : "#2a4a6a"}`,
          color: "#e8e4dc", padding: "11px 18px", borderRadius: 8, fontSize: 13, maxWidth: 310,
          textAlign: "center", fontFamily: "monospace", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>{toast.msg}</div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "18px 16px 60px" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>

            {/* ── SAVINGS GOALS ── */}
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace" }}>🏦 TOTAL SAVINGS</div>
                <div style={{ fontSize: 12, color: "#e8e4dc", fontFamily: "monospace", fontWeight: "bold" }}>{fmt(totalSaved)} <span style={{ color: "#6b6b8a", fontWeight: "normal" }}>/ {fmt(TOTAL_SAVINGS_GOAL)}</span></div>
              </div>
              {/* Total progress bar */}
              <div style={{ height: 5, background: "#1a1a2e", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${totalSavingsPct}%`, background: "linear-gradient(90deg, #2A9D8F, #457B9D)", borderRadius: 3, transition: "width 0.8s ease" }} />
              </div>

              {/* Emergency Fund */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11 }}>{emergencyMet ? "✅" : "🛡️"}</span>
                    <span style={{ fontSize: 11, color: emergencyMet ? "#2A9D8F" : "#e8e4dc", fontFamily: "monospace" }}>Emergency Fund</span>
                    {emergencyMet && <span style={{ fontSize: 9, background: "#2A9D8F22", color: "#2A9D8F", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>FUNDED</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: emergencyMet ? "#2A9D8F" : "#e8e4dc" }}>
                    {fmt(emergencyFunded)} <span style={{ color: "#6b6b8a" }}>/ {fmt(EMERGENCY_GOAL)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${emergencyPct}%`, background: emergencyMet ? "#2A9D8F" : "#457B9D", borderRadius: 2, transition: "width 0.8s ease" }} />
                </div>
                {!emergencyMet && (
                  <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 4 }}>
                    {fmt(EMERGENCY_GOAL - emergencyFunded)} to go · House savings unlocks after this
                  </div>
                )}
              </div>

              {/* House Savings */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11 }}>{houseSaved >= HOUSE_GOAL ? "✅" : emergencyMet ? "🏡" : "🔒"}</span>
                    <span style={{ fontSize: 11, color: emergencyMet ? "#e8e4dc" : "#4a4a6a", fontFamily: "monospace" }}>House Savings</span>
                    {!emergencyMet && <span style={{ fontSize: 9, background: "#2a2a3a", color: "#4a4a6a", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>LOCKED</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: emergencyMet ? "#e8e4dc" : "#4a4a6a" }}>
                    {fmt(houseSaved)} <span style={{ color: "#6b6b8a" }}>/ {fmt(HOUSE_GOAL)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${housePct}%`, background: emergencyMet ? "#FFB800" : "#2a2a3a", borderRadius: 2, transition: "width 0.8s ease" }} />
                </div>
                {emergencyMet && houseSaved < HOUSE_GOAL && (
                  <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 4 }}>
                    {fmt(HOUSE_GOAL - houseSaved)} remaining toward house
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>SPENT THIS MONTH</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: spentMonth > TOTAL_FIXED + 250 ? "#ff4444" : "#e8e4dc" }}>{fmt(spentMonth)}</div>
                <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>budget {fmt(TOTAL_FIXED + 250)}</div>
                <div style={{ marginTop: 6, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (spentMonth / (TOTAL_FIXED + 250)) * 100)}%`, background: spentMonth > TOTAL_FIXED + 250 ? "#ff4444" : "#2A9D8F", borderRadius: 2, transition: "width 0.5s ease" }} />
                </div>
              </div>
              <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>BANK BALANCE</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: bankBalance < 500 ? "#ff4444" : "#2A9D8F" }}>{fmt(Math.max(0, bankBalance))}</div>
                <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>est. running balance</div>
              </div>
            </div>

            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>MONTHLY SNAPSHOT</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["Income", fmt(MONTHLY_INCOME), "#2A9D8F"], ["Fixed Bills", fmt(TOTAL_FIXED), "#e8e4dc"], ["To Debt", fmt(MONTHLY_DEBT_PAYMENT), "#FFB800"]].map(([l, v, c]) => (
                  <div key={l}><div style={{ fontSize: 10, color: "#6b6b8a", marginBottom: 3 }}>{l}</div><div style={{ fontSize: 14, color: c, fontWeight: "bold" }}>{v}</div></div>
                ))}
              </div>
            </div>

            {activeCard && (
              <div style={{ background: "#111118", border: `1px solid ${activeCard.color}44`, borderLeft: `3px solid ${activeCard.color}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>🎯 CURRENT TARGET</div>
                <div style={{ fontSize: 14, fontWeight: "bold", color: "#e8e4dc", marginBottom: 6 }}>{activeCard.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: activeCard.color }}>{fmt(activeCard.balance)}</div>
                    <div style={{ fontSize: 10, color: "#6b6b8a" }}>{activeCard.apr}% APR · Priority #{activeCard.priority}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#6b6b8a" }}>Monthly interest</div>
                    <div style={{ fontSize: 14, color: "#ff6b6b" }}>{fmt(activeCard.balance * (activeCard.apr / 100 / 12))}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, ((activeCard.originalBalance - activeCard.balance) / activeCard.originalBalance) * 100)}%`, background: activeCard.color, borderRadius: 2 }} />
                </div>
              </div>
            )}

            <div style={{ background: "#0f1a1a", border: "1px solid #1a3a3a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#2A9D8F", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>💡 TIP OF THE DAY</div>
              <div style={{ fontSize: 13, color: "#c8c4bc", lineHeight: 1.6 }}>{tip}</div>
            </div>

            <div style={{ background: "#1a100a", border: "1px solid #FF6B3533", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#FF6B35", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>💍 WEDDING FUND</div>
              <div style={{ fontSize: 13, color: "#c8c4bc", lineHeight: 1.6 }}>$10,000 of vested stock is <strong style={{ color: "#FFB800" }}>reserved for July 2026</strong>. Do not allocate to debt.</div>
            </div>

            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>RECENT EXPENSES</div>
              {expenses.length === 0
                ? <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: 14, textAlign: "center", color: "#6b6b8a", fontSize: 13, fontFamily: "monospace" }}>No expenses logged yet</div>
                : expenses.slice(0, 8).map(e => {
                  const card = INITIAL_CARDS.find(c => c.id === e.cardId);
                  return (
                    <div key={e.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8e4dc" }}>{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                        <div style={{ fontSize: 10, fontFamily: "monospace", marginTop: 2, color: card ? card.color : "#6b6b8a" }}>
                          {card ? `💳 ${card.name}` : "💵 Cash / Debit"} · {e.date}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: card ? card.color : "#FF6B35" }}>{fmt(e.amount)}</div>
                    </div>
                  );
                })}
              {expenses.length > 8 && (
                <button onClick={() => setTab("history")} style={{ width: "100%", background: "none", border: "1px solid #2a2a3a", borderRadius: 8, padding: "10px", color: "#6b6b8a", fontSize: 11, fontFamily: "monospace", cursor: "pointer", letterSpacing: 1 }}>
                  VIEW ALL {expenses.length} EXPENSES →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── LOG ── */}
        {tab === "log" && (
          <div>
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>LOG EXPENSE</div>
              <input type="number" placeholder="Amount ($)" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
              <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={expenseForm.cardId} onChange={e => setExpenseForm(p => ({ ...p, cardId: e.target.value }))} style={{ ...inputStyle, color: expenseForm.cardId === "none" ? "#6b6b8a" : "#e8e4dc" }}>
                <option value="none">💵 Cash / Debit</option>
                {INITIAL_CARDS.map(c => <option key={c.id} value={c.id}>💳 {c.name}</option>)}
              </select>
              <input type="text" placeholder="Note (optional)" value={expenseForm.note} onChange={e => setExpenseForm(p => ({ ...p, note: e.target.value }))} style={inputStyle} />
              <button onClick={addExpense} style={btnStyle("#2A9D8F", saving)}>Log Expense</button>
            </div>

            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>LOG DEBT PAYMENT</div>
              <select value={paymentForm.cardId} onChange={e => setPaymentForm(p => ({ ...p, cardId: e.target.value }))} style={inputStyle}>
                {cards.filter(c => c.balance > 0).map(c => <option key={c.id} value={c.id}>{c.name} — {fmt(c.balance)}</option>)}
              </select>
              <input type="number" placeholder="Payment amount ($)" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
              <button onClick={addPayment} style={btnStyle("#FFB800", saving)}>Apply Payment</button>
            </div>

            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>TODAY'S EXPENSES</div>
              {todayExpenses.length === 0
                ? <div style={{ color: "#6b6b8a", fontSize: 13, textAlign: "center", padding: "14px 0", fontFamily: "monospace" }}>No expenses logged today</div>
                : todayExpenses.map(e => {
                  const card = INITIAL_CARDS.find(c => c.id === e.cardId);
                  return (
                    <div key={e.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8e4dc" }}>{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                        <div style={{ fontSize: 10, color: card ? card.color : "#6b6b8a", marginTop: 2, fontFamily: "monospace" }}>
                          {card ? `💳 ${card.name}` : "💵 Cash / Debit"}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: "bold", color: "#FF6B35" }}>{fmt(e.amount)}</div>
                        <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", color: "#6b6b8a", cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── SAVINGS ── */}
        {tab === "savings" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#111118", border: "1px solid #2A9D8F44", borderLeft: "3px solid #2A9D8F", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>EST. BALANCE</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: bankBalance < 500 ? "#ff4444" : "#2A9D8F" }}>{fmt(Math.max(0, bankBalance))}</div>
                <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>deposits − outflow</div>
              </div>
              <div style={{ background: "#111118", border: "1px solid #FFB80044", borderLeft: "3px solid #FFB800", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>THIS MONTH IN</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: "#FFB800" }}>{fmt(monthDepositTotal)}</div>
                <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>{monthDeposits.length} deposit{monthDeposits.length !== 1 ? "s" : ""}</div>
              </div>
            </div>

            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>ALL TIME SUMMARY</div>
              {[
                ["Starting Buffer", fmt(STARTING_BUFFER), "#e8e4dc"],
                ["Total Deposited", `+${fmt(totalDeposited)}`, "#2A9D8F"],
                ["Cash/Debit Expenses", `−${fmt(totalCashSpent)}`, "#FF6B35"],
                ["Debt Payments Made", `−${fmt(totalPaid)}`, "#FFB800"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #1a1a2a" }}>
                  <span style={{ fontSize: 11, color: "#6b6b8a", fontFamily: "monospace" }}>{label}</span>
                  <span style={{ fontSize: 13, color, fontWeight: "bold" }}>{value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 2 }}>
                <span style={{ fontSize: 11, color: "#FFB800", fontFamily: "monospace" }}>EST. BALANCE</span>
                <span style={{ fontSize: 14, color: "#FFB800", fontWeight: "bold" }}>{fmt(Math.max(0, bankBalance))}</span>
              </div>
            </div>

            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>ADD DEPOSIT</div>
              <input type="number" placeholder="Amount ($)" value={depositForm.amount} onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
              <select value={depositForm.type} onChange={e => setDepositForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input type="text" placeholder="Note (e.g. Apr 22 payroll)" value={depositForm.note} onChange={e => setDepositForm(p => ({ ...p, note: e.target.value }))} style={inputStyle} />
              <button onClick={addDeposit} style={btnStyle("#2A9D8F", saving)}>Add Deposit</button>
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setDepositForm({ amount: String(BIWEEKLY_INCOME), type: "Payroll", note: "Bi-weekly payroll" })} style={btnStyle("#457B9D", false)}>
                  ⚡ Pre-fill Payroll — {fmt(BIWEEKLY_INCOME)}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>DEPOSIT HISTORY</div>
              {deposits.length === 0
                ? <div style={{ color: "#6b6b8a", fontSize: 13, textAlign: "center", padding: "14px 0", fontFamily: "monospace" }}>No deposits logged yet</div>
                : deposits.map(d => (
                  <div key={d.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#e8e4dc" }}>{d.type}{d.note ? ` — ${d.note}` : ""}</div>
                      <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 2 }}>{d.date}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: "bold", color: "#2A9D8F" }}>+{fmt(d.amount)}</div>
                      <button onClick={() => deleteDeposit(d.id)} style={{ background: "none", border: "none", color: "#6b6b8a", cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── CARDS ── */}
        {tab === "cards" && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>PAYOFF ORDER — AVALANCHE METHOD</div>
            {[...cards].sort((a, b) => a.priority - b.priority).map(card => {
              const pct = Math.min(100, Math.max(0, ((card.originalBalance - card.balance) / card.originalBalance) * 100));
              const isPaid = card.balance <= 0;
              const monthlyCharges = monthExpenses.filter(e => e.cardId === card.id).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={card.id} style={{ background: isPaid ? "#0a1a0a" : "#111118", border: `1px solid ${isPaid ? "#2A9D8F33" : card.id === activeCard?.id ? `${card.color}55` : "#2a2a3a"}`, borderLeft: `3px solid ${isPaid ? "#2A9D8F" : card.color}`, borderRadius: 12, padding: 14, marginBottom: 12, opacity: isPaid ? 0.7 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 9, background: isPaid ? "#2A9D8F22" : "#ffffff0f", color: isPaid ? "#2A9D8F" : "#6b6b8a", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{isPaid ? "PAID" : `#${card.priority}`}</span>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "#e8e4dc" }}>{card.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace" }}>{card.apr}% APR</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: isPaid ? "#2A9D8F" : card.color }}>{isPaid ? "✓ DONE" : fmt(card.balance)}</div>
                      {!isPaid && <div style={{ fontSize: 10, color: "#ff6b6b", fontFamily: "monospace" }}>{fmt(card.balance * (card.apr / 100 / 12))}/mo</div>}
                    </div>
                  </div>
                  {monthlyCharges > 0 && <div style={{ fontSize: 10, color: "#FFB800", fontFamily: "monospace", marginBottom: 7 }}>⚠️ {fmt(monthlyCharges)} charged this month</div>}
                  <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: isPaid ? "#2A9D8F" : card.color, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b6b8a", fontFamily: "monospace" }}>
                    <span>{fmt(card.originalBalance - card.balance)} paid</span>
                    <span>{pct.toFixed(1)}% done</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>PAYMENT HISTORY</div>
            {payments.length === 0
              ? <div style={{ color: "#6b6b8a", fontSize: 13, textAlign: "center", padding: "14px 0", fontFamily: "monospace" }}>No payments logged yet</div>
              : payments.map(p => (
                <div key={p.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#e8e4dc" }}>{p.cardName}</div>
                    <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 2 }}>{p.date}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#2A9D8F" }}>−{fmt(p.amount)}</div>
                </div>
              ))}

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>ALL EXPENSES</div>
              {expenses.length === 0
                ? <div style={{ color: "#6b6b8a", fontSize: 13, textAlign: "center", padding: "14px 0", fontFamily: "monospace" }}>No expenses logged yet</div>
                : expenses.map(e => {
                  const card = INITIAL_CARDS.find(c => c.id === e.cardId);
                  return (
                    <div key={e.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8e4dc" }}>{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                        <div style={{ fontSize: 10, fontFamily: "monospace", marginTop: 2, color: card ? card.color : "#6b6b8a" }}>
                          {card ? `💳 ${card.name}` : "💵 Cash / Debit"} · {e.date}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#FF6B35" }}>{fmt(e.amount)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 14 }}>SETTINGS</div>
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>YOUR PLAN</div>
              {[["Strategy","Avalanche (highest APR first)"],["Bi-weekly Income",fmt(BIWEEKLY_INCOME)],["Monthly Income",fmt(MONTHLY_INCOME)],["Fixed Expenses",fmt(TOTAL_FIXED)],["Monthly to Debt",fmt(MONTHLY_DEBT_PAYMENT)],["Starting Debt",fmt(totalOriginal)],["Target Date","October 2026"],["Wedding Reserve","$10,000 (July 2026)"]].map(([l,v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #1a1a2a" }}>
                  <span style={{ fontSize: 11, color: "#6b6b8a", fontFamily: "monospace" }}>{l}</span>
                  <span style={{ fontSize: 12, color: "#e8e4dc", fontWeight: "bold" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>MONTHLY BUDGET</div>
              {[["Rent",fmt(MONTHLY_BUDGET.rent)],["Car Insurance",fmt(MONTHLY_BUDGET.carInsurance)],["Life Insurance",fmt(MONTHLY_BUDGET.lifeInsurance)],["Gym",fmt(MONTHLY_BUDGET.gym)],["Subscriptions",fmt(MONTHLY_BUDGET.subscriptions)],["Groceries (flex)",fmt(MONTHLY_BUDGET.groceries)]].map(([l,v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #1a1a2a" }}>
                  <span style={{ fontSize: 11, color: "#6b6b8a", fontFamily: "monospace" }}>{l}</span>
                  <span style={{ fontSize: 12, color: "#e8e4dc" }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#FFB800", fontFamily: "monospace" }}>TOTAL</span>
                <span style={{ fontSize: 13, color: "#FFB800", fontWeight: "bold" }}>{fmt(TOTAL_FIXED)}</span>
              </div>
            </div>
            <div style={{ background: "#0a1a0a", border: "1px solid #2A9D8F33", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#2A9D8F", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>☁️ DATA STORAGE</div>
              <div style={{ fontSize: 13, color: "#c8c4bc", lineHeight: 1.6 }}>Your data is saved to <strong style={{ color: "#2A9D8F" }}>local storage on your device</strong>. It persists across app restarts and sessions on this device.</div>
            </div>
            <div style={{ background: "#1a0a0a", border: "1px solid #ff444422", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#ff4444", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>DANGER ZONE</div>
              <div style={{ fontSize: 13, color: "#6b6b8a", marginBottom: 14, lineHeight: 1.6 }}>Resets all data — expenses, deposits, payments, and card balances. Cannot be undone.</div>
              <button onClick={() => setShowResetConfirm(true)} style={btnStyle("#ff4444", false)}>Reset All Data</button>
            </div>
          </div>
        )}
      </div>

      {/* ── RESET MODAL ── */}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#111118", border: "1px solid #ff444455", borderRadius: 16, padding: 26, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#ff4444", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>⚠️ CONFIRM RESET</div>
            <div style={{ fontSize: 15, color: "#e8e4dc", marginBottom: 8, fontWeight: "bold" }}>Are you sure?</div>
            <div style={{ fontSize: 13, color: "#6b6b8a", marginBottom: 22, lineHeight: 1.6 }}>This will permanently erase all payments, expenses, deposits and reset all balances. Cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, background: "#1a1a2a", border: "1px solid #2a2a3a", borderRadius: 8, padding: "12px", color: "#e8e4dc", fontSize: 13, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
              <button onClick={resetAllData} style={{ flex: 1, background: "#2a0a0a", border: "1px solid #ff4444", borderRadius: 8, padding: "12px", color: "#ff4444", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer" }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
