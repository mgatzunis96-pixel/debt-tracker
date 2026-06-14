import { useState, useEffect, useCallback } from "react";

// ── SUPABASE CONFIG ──
const SUPABASE_URL = "https://iyatrttokkinmhjgbrfz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5YXRydHRva2tpbm1oamdicmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjkxOTcsImV4cCI6MjA5MTI0NTE5N30.ZuyrpJqO_Vu52Ijar9PSYhcjYzfVp_CTHIfcjcbCTjA";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    ...opts,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const dbGet    = (table, order) => sb(`${table}?order=${order || "id"}`);
const dbInsert = (table, data)  => sb(table, { method: "POST", body: JSON.stringify(data) });
const dbUpdate = (table, id, data) => sb(`${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) });
const dbDelete = (table, id)    => sb(`${table}?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
const dbUpsert = (table, data)  => sb(table, { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify(data) });

// ── CONSTANTS ──
const INITIAL_CARDS = [
  { id: "reserve", name: "Amex Delta Reserve", balance: 6641.60, original_balance: 6641.60, apr: 28.49, color: "#FF6B35", priority: 1 },
  { id: "gold",    name: "Amex Gold",           balance: 3312.00, original_balance: 3312.00, apr: 28.49, color: "#FFB800", priority: 2 },
  { id: "venture", name: "Capital One VentureX",balance: 2525.79, original_balance: 2525.79, apr: 28.24, color: "#E63946", priority: 3 },
  { id: "blue",    name: "Amex Delta Blue",      balance: 2659.62, original_balance: 2659.62, apr: 28.24, color: "#457B9D", priority: 4 },
  { id: "apple",   name: "Apple Card",           balance: 4412.89, original_balance: 4412.89, apr: 25.49, color: "#6D6D6D", priority: 5 },
  { id: "citi",    name: "Citi Costco",          balance: 4027.60, original_balance: 4027.60, apr: 23.74, color: "#2A9D8F", priority: 6 },
];

const MONTHLY_BUDGET = { rent: 1000, carInsurance: 175.75, lifeInsurance: 300, gym: 115, subscriptions: 45, groceries: 250 };
const TOTAL_FIXED = Object.values(MONTHLY_BUDGET).reduce((a, b) => a + b, 0);
const BIWEEKLY_INCOME = 2559.47;
const MONTHLY_INCOME = BIWEEKLY_INCOME * 2;
const MONTHLY_DEBT_PAYMENT = MONTHLY_INCOME - TOTAL_FIXED;
const CATEGORIES = ["Food & Dining", "Transport", "Shopping", "Entertainment", "Groceries", "Health", "Other"];
const INCOME_TYPES = ["Payroll", "Bonus", "Freelance", "Gift", "Refund", "Sale", "Other"];
const STARTING_BUFFER = 1755.23;
const EMERGENCY_GOAL = 5000;
const HOUSE_GOAL = 50000;
const TOTAL_SAVINGS_GOAL = EMERGENCY_GOAL + HOUSE_GOAL;

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

export default function BudgetTracker() {
  const [cards, setCards]       = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dbError, setDbError]   = useState(null);
  const [syncing, setSyncing]   = useState(false);

  const [tab, setTab] = useState("dashboard");
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "Food & Dining", cardId: "none", note: "" });
  const [paymentForm, setPaymentForm] = useState({ cardId: "reserve", amount: "" });
  const [depositForm, setDepositForm] = useState({ amount: "", type: "Payroll", note: "" });
  const [toast, setToast]             = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── LOAD ALL DATA FROM SUPABASE ──
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setDbError(null);
      const [c, e, p, d] = await Promise.all([
        dbGet("cards", "priority"),
        dbGet("expenses", "id.desc"),
        dbGet("payments", "id.desc"),
        dbGet("deposits", "id.desc"),
      ]);
      if (!c || c.length === 0) {
        await dbUpsert("cards", INITIAL_CARDS);
        setCards(INITIAL_CARDS);
      } else {
        // Normalize — support both snake_case (Supabase) and camelCase
        setCards(c.map(card => ({
          ...card,
          originalBalance: card.original_balance ?? card.originalBalance ?? card.balance,
        })));
      }
      setExpenses(e || []);
      setPayments(p || []);
      setDeposits(d || []);
    } catch (err) {
      setDbError("Could not connect to database: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── DERIVED VALUES ──
  const today     = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);

  const todayExpenses = expenses.filter(e => e.date === today);
  const monthExpenses = expenses.filter(e => e.date?.startsWith(thisMonth));
  const spentToday    = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const spentMonth    = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const daysInMonth   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth    = new Date().getDate();

  const totalDebt    = cards.reduce((s, c) => s + (c.balance || 0), 0);
  const totalOriginal = cards.reduce((s, c) => s + (c.originalBalance || c.original_balance || c.balance || 0), 0);
  const paidOff      = Math.max(0, totalOriginal - totalDebt);
  const progress     = totalOriginal > 0 ? Math.min(100, (paidOff / totalOriginal) * 100) : 0;
  const activeCard   = [...cards].filter(c => c.balance > 0).sort((a, b) => a.priority - b.priority)[0];

  const totalDeposited = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const totalCashSpent = expenses.filter(e => e.card_id === "none" || e.cardId === "none").reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid      = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const bankBalance    = STARTING_BUFFER + totalDeposited - totalCashSpent - totalPaid;

  const monthDeposits     = deposits.filter(d => d.date?.startsWith(thisMonth));
  const monthDepositTotal = monthDeposits.reduce((s, d) => s + (d.amount || 0), 0);

  const currentSavings  = Math.max(0, bankBalance);
  const emergencyFunded = Math.min(currentSavings, EMERGENCY_GOAL);
  const emergencyPct    = Math.min(100, (emergencyFunded / EMERGENCY_GOAL) * 100);
  const emergencyMet    = currentSavings >= EMERGENCY_GOAL;
  const houseSaved      = emergencyMet ? Math.min(currentSavings - EMERGENCY_GOAL, HOUSE_GOAL) : 0;
  const housePct        = Math.min(100, (houseSaved / HOUSE_GOAL) * 100);
  const totalSaved      = emergencyFunded + houseSaved;
  const totalSavingsPct = Math.min(100, (totalSaved / TOTAL_SAVINGS_GOAL) * 100);

  const monthsToFreedom = totalDebt > 0 ? Math.max(1, Math.ceil(totalDebt / MONTHLY_DEBT_PAYMENT)) : 0;
  const freedomDate = new Date();
  freedomDate.setMonth(freedomDate.getMonth() + monthsToFreedom);
  const freedomStr = monthsToFreedom > 0 ? freedomDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Debt Free!";

  // ── ACTIONS ──
  const addExpense = async () => {
    const amt = parseFloat(expenseForm.amount);
    if (!amt || amt <= 0) return showToast("Enter a valid amount", "error");
    const isCard = expenseForm.cardId !== "none";
    const card   = INITIAL_CARDS.find(c => c.id === expenseForm.cardId);
    const newExp = {
      id: Date.now(), amount: amt, category: expenseForm.category,
      card_id: expenseForm.cardId, card_name: card?.name || null,
      note: expenseForm.note, date: today,
    };
    try {
      setSyncing(true);
      await dbInsert("expenses", newExp);
      if (isCard) {
        const cardObj = cards.find(c => c.id === expenseForm.cardId);
        const newBal  = (cardObj?.balance || 0) + amt;
        await dbUpdate("cards", expenseForm.cardId, { balance: newBal });
        setCards(prev => prev.map(c => c.id === expenseForm.cardId ? { ...c, balance: newBal } : c));
      }
      setExpenses(prev => [newExp, ...prev]);
      setExpenseForm({ amount: "", category: "Food & Dining", cardId: "none", note: "" });
      const over = spentToday + amt > 250 / daysInMonth * dayOfMonth;
      showToast(isCard ? `💳 ${fmt(amt)} added to ${card?.name}` : over ? `⚠️ ${fmt(amt)} logged — over budget` : `✅ ${fmt(amt)} deducted from bank`, isCard ? "success" : over ? "warn" : "success");
    } catch (e) { showToast("Failed to save: " + e.message, "error"); }
    finally { setSyncing(false); }
  };

  const addPayment = async () => {
    const amt  = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) return showToast("Enter a valid amount", "error");
    const card = cards.find(c => c.id === paymentForm.cardId);
    if (!card) return;
    const actual = Math.min(amt, card.balance);
    const newBal = Math.max(0, card.balance - actual);
    const newPay = { id: Date.now(), card_id: card.id, card_name: card.name, amount: actual, date: today };
    try {
      setSyncing(true);
      await dbInsert("payments", newPay);
      await dbUpdate("cards", card.id, { balance: newBal });
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, balance: newBal } : c));
      setPayments(prev => [newPay, ...prev]);
      setPaymentForm({ cardId: "reserve", amount: "" });
      if (newBal <= 0) showToast(`🎉 ${card.name} is PAID OFF!`, "celebrate");
      else showToast(`💳 ${fmt(actual)} applied to ${card.name} — ${fmt(newBal)} left`, "success");
    } catch (e) { showToast("Failed to save: " + e.message, "error"); }
    finally { setSyncing(false); }
  };

  const addDeposit = async () => {
    const amt = parseFloat(depositForm.amount);
    if (!amt || amt <= 0) return showToast("Enter a valid amount", "error");
    const newDep = { id: Date.now(), amount: amt, type: depositForm.type, note: depositForm.note, date: today };
    try {
      setSyncing(true);
      await dbInsert("deposits", newDep);
      setDeposits(prev => [newDep, ...prev]);
      setDepositForm({ amount: "", type: "Payroll", note: "" });
      showToast(`💰 ${fmt(amt)} ${depositForm.type} logged!`, "success");
    } catch (e) { showToast("Failed to save: " + e.message, "error"); }
    finally { setSyncing(false); }
  };

  const deleteExpense = async (id) => {
    const exp = expenses.find(x => x.id === id);
    if (!exp) return;
    try {
      setSyncing(true);
      await dbDelete("expenses", id);
      const cid = exp.card_id || exp.cardId;
      if (cid && cid !== "none") {
        const cardObj = cards.find(c => c.id === cid);
        const newBal  = Math.max(0, (cardObj?.balance || 0) - exp.amount);
        await dbUpdate("cards", cid, { balance: newBal });
        setCards(prev => prev.map(c => c.id === cid ? { ...c, balance: newBal } : c));
      }
      setExpenses(prev => prev.filter(x => x.id !== id));
      showToast(`Removed ${fmt(exp.amount)} expense`, "success");
    } catch (e) { showToast("Failed to delete: " + e.message, "error"); }
    finally { setSyncing(false); }
  };

  const deleteDeposit = async (id) => {
    const dep = deposits.find(x => x.id === id);
    try {
      setSyncing(true);
      await dbDelete("deposits", id);
      setDeposits(prev => prev.filter(x => x.id !== id));
      showToast(`Removed ${fmt(dep?.amount)} deposit`, "success");
    } catch (e) { showToast("Failed to delete: " + e.message, "error"); }
    finally { setSyncing(false); }
  };

  const resetAllData = async () => {
    try {
      setSyncing(true);
      await Promise.all([
        sb("expenses", { method: "DELETE", prefer: "return=minimal" }),
        sb("payments", { method: "DELETE", prefer: "return=minimal" }),
        sb("deposits", { method: "DELETE", prefer: "return=minimal" }),
      ]);
      await dbUpsert("cards", INITIAL_CARDS);
      setCards(INITIAL_CARDS); setExpenses([]); setPayments([]); setDeposits([]);
      setShowResetConfirm(false);
      showToast("✅ All data reset", "success");
      setTab("dashboard");
    } catch (e) { showToast("Reset failed: " + e.message, "error"); }
    finally { setSyncing(false); }
  };

  const TABS = ["dashboard", "log", "savings", "cards", "history", "settings"];

  // ── LOADING ──
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#6b6b8a" }}>
      <div style={{ fontSize: 28, marginBottom: 16 }}>💳</div>
      <div style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>Loading from cloud...</div>
      <div style={{ width: 160, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, #FF6B35, #FFB800)", borderRadius: 2 }} />
      </div>
    </div>
  );

  // ── DB ERROR ──
  if (dbError) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "monospace", color: "#e8e4dc", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 13, color: "#ff4444", marginBottom: 20, lineHeight: 1.6 }}>{dbError}</div>
      <button onClick={loadAll} style={btnStyle("#2A9D8F", false)}>↻ Retry Connection</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e4dc", fontFamily: "'Georgia', serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #0a0a0f, #141420, #0a0a0f)", borderBottom: "1px solid #2a2a3a", padding: "18px 16px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10, textAlign: "center" }}>
            BUDGET TRACKER {syncing && <span style={{ color: "#457B9D" }}>· SAVING...</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 3 }}>DEBT TRACKER</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: "#e8e4dc", lineHeight: 1 }}>{fmt(totalDebt)}</div>
              <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 2 }}>{totalOriginal > 0 ? `remaining of ${fmt(totalOriginal)}` : "start tracking"}</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b6b8a", marginBottom: 3, fontFamily: "monospace" }}>
                  <span>{fmt(paidOff)} paid</span><span>{progress.toFixed(1)}%</span>
                </div>
                <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", width: 140 }}>
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
                  <span>{totalSavingsPct.toFixed(1)}%</span><span style={{ color: "#FFB800" }}>🛡️ {emergencyMet ? "funded" : "building"}</span>
                </div>
                <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", width: 140 }}>
                  <div style={{ height: "100%", width: `${totalSavingsPct}%`, background: "linear-gradient(90deg, #2A9D8F, #457B9D)", borderRadius: 2, transition: "width 0.8s ease" }} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 1px", background: "none", border: "none", borderBottom: tab === t ? "2px solid #FFB800" : "2px solid transparent", color: tab === t ? "#FFB800" : "#6b6b8a", fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer" }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.type === "error" ? "#3a1010" : toast.type === "warn" ? "#2a2010" : toast.type === "celebrate" ? "#102a10" : "#101a2a", border: `1px solid ${toast.type === "error" ? "#ff4444" : toast.type === "warn" ? "#FFB800" : toast.type === "celebrate" ? "#2A9D8F" : "#2a4a6a"}`, color: "#e8e4dc", padding: "11px 18px", borderRadius: 8, fontSize: 13, maxWidth: 310, textAlign: "center", fontFamily: "monospace", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>{toast.msg}</div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "18px 16px 60px" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            {/* Savings Goals */}
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace" }}>🏦 TOTAL SAVINGS</div>
                <div style={{ fontSize: 12, color: "#e8e4dc", fontFamily: "monospace", fontWeight: "bold" }}>{fmt(totalSaved)} <span style={{ color: "#6b6b8a", fontWeight: "normal" }}>/ {fmt(TOTAL_SAVINGS_GOAL)}</span></div>
              </div>
              <div style={{ height: 5, background: "#1a1a2e", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${totalSavingsPct}%`, background: "linear-gradient(90deg, #2A9D8F, #457B9D)", borderRadius: 3, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11 }}>{emergencyMet ? "✅" : "🛡️"}</span>
                    <span style={{ fontSize: 11, color: emergencyMet ? "#2A9D8F" : "#e8e4dc", fontFamily: "monospace" }}>Emergency Fund</span>
                    {emergencyMet && <span style={{ fontSize: 9, background: "#2A9D8F22", color: "#2A9D8F", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>FUNDED</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#e8e4dc" }}>{fmt(emergencyFunded)} <span style={{ color: "#6b6b8a" }}>/ {fmt(EMERGENCY_GOAL)}</span></div>
                </div>
                <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${emergencyPct}%`, background: emergencyMet ? "#2A9D8F" : "#457B9D", borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
                {!emergencyMet && <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 4 }}>{fmt(EMERGENCY_GOAL - emergencyFunded)} to go · House savings unlocks after this</div>}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11 }}>{emergencyMet ? "🏡" : "🔒"}</span>
                    <span style={{ fontSize: 11, color: emergencyMet ? "#e8e4dc" : "#4a4a6a", fontFamily: "monospace" }}>House Savings</span>
                    {!emergencyMet && <span style={{ fontSize: 9, background: "#2a2a3a", color: "#4a4a6a", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>LOCKED</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: emergencyMet ? "#e8e4dc" : "#4a4a6a" }}>{fmt(houseSaved)} <span style={{ color: "#6b6b8a" }}>/ {fmt(HOUSE_GOAL)}</span></div>
                </div>
                <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${housePct}%`, background: emergencyMet ? "#FFB800" : "#2a2a3a", borderRadius: 2 }} />
                </div>
              </div>
            </div>

            {/* Spent / Bank */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>SPENT THIS MONTH</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: spentMonth > TOTAL_FIXED + 250 ? "#ff4444" : "#e8e4dc" }}>{fmt(spentMonth)}</div>
                <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>budget {fmt(TOTAL_FIXED + 250)}</div>
                <div style={{ marginTop: 6, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (spentMonth / (TOTAL_FIXED + 250)) * 100)}%`, background: spentMonth > TOTAL_FIXED + 250 ? "#ff4444" : "#2A9D8F", borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>BANK BALANCE</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: bankBalance < 500 ? "#ff4444" : "#2A9D8F" }}>{fmt(Math.max(0, bankBalance))}</div>
                <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>est. running balance</div>
              </div>
            </div>

            {/* Monthly Snapshot */}
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>MONTHLY SNAPSHOT</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["Income", fmt(MONTHLY_INCOME), "#2A9D8F"], ["Fixed Bills", fmt(TOTAL_FIXED), "#e8e4dc"], ["To Debt", fmt(MONTHLY_DEBT_PAYMENT), "#FFB800"]].map(([l, v, c]) => (
                  <div key={l}><div style={{ fontSize: 10, color: "#6b6b8a", marginBottom: 3 }}>{l}</div><div style={{ fontSize: 13, color: c, fontWeight: "bold" }}>{v}</div></div>
                ))}
              </div>
            </div>

            {/* Target Card */}
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

            {/* Insights */}
            {(() => {
              const insights = [];
              const catSpend = {};
              monthExpenses.forEach(e => { catSpend[e.category] = (catSpend[e.category] || 0) + e.amount; });
              const topCat = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
              if (topCat && topCat[1] > 50) insights.push({ icon: "📊", color: "#457B9D", title: "Top Spend Category", text: `${topCat[0]} is your biggest expense this month at ${fmt(topCat[1])}. Consider setting a specific limit here.` });
              const highAprIds = ["reserve", "gold", "venture"];
              const highAprSpend = monthExpenses.filter(e => highAprIds.includes(e.card_id || e.cardId)).reduce((s, e) => s + e.amount, 0);
              if (highAprSpend > 0) insights.push({ icon: "⚠️", color: "#ff4444", title: "High APR Card Usage", text: `You've charged ${fmt(highAprSpend)} to your highest APR cards (28%+) this month. Use Citi Costco or cash instead.` });
              const budgetUsedPct = (spentMonth / (TOTAL_FIXED + 250)) * 100;
              const daysPct = (dayOfMonth / daysInMonth) * 100;
              if (budgetUsedPct > daysPct + 15 && spentMonth > 100) {
                const projected = (spentMonth / dayOfMonth) * daysInMonth;
                insights.push({ icon: "🔥", color: "#FF6B35", title: "Over Budget Pace", text: `At current rate you'll spend ${fmt(projected)} this month — ${fmt(projected - (TOTAL_FIXED + 250))} over budget.` });
              } else if (budgetUsedPct < daysPct - 20 && spentMonth > 0) {
                insights.push({ icon: "✅", color: "#2A9D8F", title: "Under Budget", text: `Great discipline — spending ${Math.round(daysPct - budgetUsedPct)}% below pace. Consider redirecting surplus to ${activeCard?.name || "your top card"}.` });
              }
              const monthPaid = payments.filter(p => p.date?.startsWith(thisMonth)).reduce((s, p) => s + p.amount, 0);
              if (monthPaid > MONTHLY_DEBT_PAYMENT) insights.push({ icon: "🚀", color: "#2A9D8F", title: "Ahead of Schedule", text: `${fmt(monthPaid)} paid toward debt this month — ${fmt(monthPaid - MONTHLY_DEBT_PAYMENT)} above your ${fmt(MONTHLY_DEBT_PAYMENT)} target!` });
              else if (monthPaid > 0 && monthPaid < MONTHLY_DEBT_PAYMENT * 0.5 && dayOfMonth > 15) insights.push({ icon: "📉", color: "#FFB800", title: "Behind on Payments", text: `Only ${fmt(monthPaid)} paid so far. Need ${fmt(MONTHLY_DEBT_PAYMENT - monthPaid)} more to stay on track.` });
              const totalInterest = cards.reduce((s, c) => s + (c.balance > 0 ? c.balance * (c.apr / 100 / 12) : 0), 0);
              if (totalInterest > 0) insights.push({ icon: "💸", color: "#ff6b6b", title: "Interest Costing You", text: `Your balances are accruing ${fmt(totalInterest)} in interest this month. Every extra dollar toward ${activeCard?.name || "your top card"} reduces this.` });
              if (expenses.length === 0) { insights.push({ icon: "💡", color: "#2A9D8F", title: "Start Tracking", text: "Log your first expense to unlock personalized spend analysis and budget insights." }); insights.push({ icon: "🎯", color: "#FFB800", title: "Your Goal", text: `Paying ${fmt(MONTHLY_DEBT_PAYMENT)}/month clears all ${fmt(totalDebt)} in debt by ${freedomStr}.` }); }
              if (insights.length === 0) return null;
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>💡 INSIGHTS & ANALYSIS</div>
                  {insights.slice(0, 4).map((ins, i) => (
                    <div key={i} style={{ background: "#111118", border: `1px solid ${ins.color}33`, borderLeft: `3px solid ${ins.color}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: ins.color, fontFamily: "monospace", marginBottom: 4 }}>{ins.icon} {ins.title}</div>
                      <div style={{ fontSize: 13, color: "#c8c4bc", lineHeight: 1.6 }}>{ins.text}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Wedding Fund */}
            <div style={{ background: "#1a100a", border: "1px solid #FF6B3533", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#FF6B35", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }}>💍 WEDDING FUND</div>
              <div style={{ fontSize: 13, color: "#c8c4bc", lineHeight: 1.6 }}>$10,000 of vested stock is <strong style={{ color: "#FFB800" }}>reserved for July 2026</strong>. Do not allocate to debt.</div>
            </div>

            {/* Recent Expenses */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>RECENT EXPENSES</div>
              {expenses.length === 0
                ? <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: 14, textAlign: "center", color: "#6b6b8a", fontSize: 13, fontFamily: "monospace" }}>No expenses logged yet</div>
                : expenses.slice(0, 8).map(e => {
                  const card = INITIAL_CARDS.find(c => c.id === (e.card_id || e.cardId));
                  return (
                    <div key={e.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8e4dc" }}>{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                        <div style={{ fontSize: 10, fontFamily: "monospace", marginTop: 2, color: card ? card.color : "#6b6b8a" }}>{card ? `💳 ${card.name}` : "💵 Cash / Debit"} · {e.date}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: card ? card.color : "#FF6B35" }}>{fmt(e.amount)}</div>
                    </div>
                  );
                })}
              {expenses.length > 8 && <button onClick={() => setTab("history")} style={{ width: "100%", background: "none", border: "1px solid #2a2a3a", borderRadius: 8, padding: "10px", color: "#6b6b8a", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>VIEW ALL {expenses.length} EXPENSES →</button>}
            </div>
          </div>
        )}

        {/* ── LOG ── */}
        {tab === "log" && (
          <div>
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>LOG EXPENSE</div>
              <input type="number" placeholder="Amount ($)" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
              <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              <select value={expenseForm.cardId} onChange={e => setExpenseForm(p => ({ ...p, cardId: e.target.value }))} style={{ ...inputStyle, color: expenseForm.cardId === "none" ? "#6b6b8a" : "#e8e4dc" }}>
                <option value="none">💵 Cash / Debit</option>
                {INITIAL_CARDS.map(c => <option key={c.id} value={c.id}>💳 {c.name}</option>)}
              </select>
              <input type="text" placeholder="Note (optional)" value={expenseForm.note} onChange={e => setExpenseForm(p => ({ ...p, note: e.target.value }))} style={inputStyle} />
              <button onClick={addExpense} disabled={syncing} style={btnStyle("#2A9D8F", syncing)}>{syncing ? "Saving..." : "Log Expense"}</button>
            </div>
            <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>LOG DEBT PAYMENT</div>
              <select value={paymentForm.cardId} onChange={e => setPaymentForm(p => ({ ...p, cardId: e.target.value }))} style={inputStyle}>
                {cards.filter(c => c.balance > 0).map(c => <option key={c.id} value={c.id}>{c.name} — {fmt(c.balance)}</option>)}
              </select>
              <input type="number" placeholder="Payment amount ($)" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
              <button onClick={addPayment} disabled={syncing} style={btnStyle("#FFB800", syncing)}>{syncing ? "Saving..." : "Apply Payment"}</button>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#6b6b8a", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>TODAY'S EXPENSES</div>
              {todayExpenses.length === 0
                ? <div style={{ color: "#6b6b8a", fontSize: 13, textAlign: "center", padding: "14px 0", fontFamily: "monospace" }}>No expenses logged today</div>
                : todayExpenses.map(e => {
                  const card = INITIAL_CARDS.find(c => c.id === (e.card_id || e.cardId));
                  return (
                    <div key={e.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8e4dc" }}>{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                        <div style={{ fontSize: 10, color: card ? card.color : "#6b6b8a", marginTop: 2, fontFamily: "monospace" }}>{card ? `💳 ${card.name}` : "💵 Cash / Debit"}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: "bold", color: "#FF6B35" }}>{fmt(e.amount)}</div>
                        <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", color: "#6b6b8a", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
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
              {[["Starting Buffer", fmt(STARTING_BUFFER), "#e8e4dc"], ["Total Deposited", `+${fmt(totalDeposited)}`, "#2A9D8F"], ["Cash/Debit Expenses", `−${fmt(totalCashSpent)}`, "#FF6B35"], ["Debt Payments Made", `−${fmt(totalPaid)}`, "#FFB800"]].map(([label, value, color]) => (
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
              <select value={depositForm.type} onChange={e => setDepositForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>{INCOME_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              <input type="text" placeholder="Note (e.g. May 6 payroll)" value={depositForm.note} onChange={e => setDepositForm(p => ({ ...p, note: e.target.value }))} style={inputStyle} />
              <button onClick={addDeposit} disabled={syncing} style={btnStyle("#2A9D8F", syncing)}>{syncing ? "Saving..." : "Add Deposit"}</button>
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setDepositForm({ amount: String(BIWEEKLY_INCOME), type: "Payroll", note: "Bi-weekly payroll" })} style={btnStyle("#457B9D", false)}>⚡ Pre-fill Payroll — {fmt(BIWEEKLY_INCOME)}</button>
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
                      <button onClick={() => deleteDeposit(d.id)} style={{ background: "none", border: "none", color: "#6b6b8a", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
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
              const origBal = card.originalBalance || card.original_balance || card.balance;
              const pct = Math.min(100, Math.max(0, ((origBal - card.balance) / origBal) * 100));
              const isPaid = card.balance <= 0;
              const monthlyCharges = monthExpenses.filter(e => (e.card_id || e.cardId) === card.id).reduce((s, e) => s + e.amount, 0);
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
                    <span>{fmt(origBal - card.balance)} paid</span><span>{pct.toFixed(1)}% done</span>
                  </div>
                  {!isPaid && (() => {
                    let tempBalances = cards.map(c => ({ ...c }));
                    let monthsElapsed = 0;
                    for (let m = 0; m < 120; m++) {
                      tempBalances = tempBalances.map(c => ({ ...c, balance: c.balance > 0 ? c.balance + c.balance * (c.apr / 100 / 12) : 0 }));
                      let budget = MONTHLY_DEBT_PAYMENT;
                      const ordered = [...tempBalances].filter(c => c.balance > 0).sort((a, b) => a.priority - b.priority);
                      for (const oc of ordered) {
                        if (budget <= 0) break;
                        const pay = Math.min(budget, oc.balance);
                        tempBalances.find(c => c.id === oc.id).balance -= pay;
                        budget -= pay;
                      }
                      if ((tempBalances.find(c => c.id === card.id)?.balance || 0) <= 0.01) { monthsElapsed = m + 1; break; }
                    }
                    if (!monthsElapsed) return null;
                    const pd = new Date(); pd.setMonth(pd.getMonth() + monthsElapsed);
                    const pdStr = pd.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    return (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1a1a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: "#6b6b8a", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>Est. Payoff</span>
                        <span style={{ fontSize: 11, color: card.color, fontFamily: "monospace", fontWeight: "bold" }}>{pdStr} · {monthsElapsed}mo</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            {/* Total Freedom */}
            {totalDebt > 0 && (() => {
              let tempBalances = cards.map(c => ({ ...c }));
              let totalMonths = 0;
              for (let m = 0; m < 120; m++) {
                tempBalances = tempBalances.map(c => ({ ...c, balance: c.balance > 0 ? c.balance + c.balance * (c.apr / 100 / 12) : 0 }));
                let budget = MONTHLY_DEBT_PAYMENT;
                const ordered = [...tempBalances].filter(c => c.balance > 0).sort((a, b) => a.priority - b.priority);
                for (const oc of ordered) { if (budget <= 0) break; const pay = Math.min(budget, oc.balance); tempBalances.find(c => c.id === oc.id).balance -= pay; budget -= pay; }
                if (tempBalances.every(c => c.balance <= 0.01)) { totalMonths = m + 1; break; }
              }
              const fd = new Date(); fd.setMonth(fd.getMonth() + totalMonths);
              const fdStr = fd.toLocaleDateString("en-US", { month: "long", year: "numeric" });
              return (
                <div style={{ background: "#111118", border: "1px solid #FFB80033", borderLeft: "3px solid #FFB800", borderRadius: 12, padding: 14, marginTop: 4 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: "#FFB800", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>🏁 TOTAL DEBT FREEDOM</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: "bold", color: "#FFB800" }}>{fdStr}</div>
                      <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 2 }}>at {fmt(MONTHLY_DEBT_PAYMENT)}/month</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: "bold", color: "#e8e4dc" }}>{totalMonths}mo</div>
                      <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", marginTop: 2 }}>remaining</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#6b6b8a", fontFamily: "monospace", textAlign: "center" }}>Paying off {cards.filter(c => c.balance > 0).length} cards · Avalanche method · Includes interest</div>
                </div>
              );
            })()}
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
                    <div style={{ fontSize: 13, color: "#e8e4dc" }}>{p.card_name || p.cardName}</div>
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
                  const card = INITIAL_CARDS.find(c => c.id === (e.card_id || e.cardId));
                  return (
                    <div key={e.id} style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8e4dc" }}>{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                        <div style={{ fontSize: 10, fontFamily: "monospace", marginTop: 2, color: card ? card.color : "#6b6b8a" }}>{card ? `💳 ${card.name}` : "💵 Cash / Debit"} · {e.date}</div>
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
              {[["Strategy","Avalanche (highest APR first)"],["Bi-weekly Income",fmt(BIWEEKLY_INCOME)],["Monthly Income",fmt(MONTHLY_INCOME)],["Fixed Expenses",fmt(TOTAL_FIXED)],["Monthly to Debt",fmt(MONTHLY_DEBT_PAYMENT)],["Starting Debt",fmt(totalOriginal)],["Target Date",freedomStr],["Wedding Reserve","$10,000 (July 2026)"]].map(([l,v]) => (
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
                <span style={{ fontSize: 13, color: "#FFB800", fontWeight: "bold" }}>{fmt(TOTAL_FIXED + 250)}</span>
              </div>
            </div>
            <div style={{ background: "#0a1a0a", border: "1px solid #2A9D8F33", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#2A9D8F", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>☁️ CLOUD SYNC</div>
              <div style={{ fontSize: 13, color: "#c8c4bc", lineHeight: 1.6, marginBottom: 12 }}>Data saved to <strong style={{ color: "#2A9D8F" }}>Supabase cloud</strong> — syncs across all devices instantly.</div>
              <button onClick={loadAll} style={btnStyle("#2A9D8F", false)}>↻ Refresh from Cloud</button>
            </div>
            <div style={{ background: "#1a0a0a", border: "1px solid #ff444422", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#ff4444", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>DANGER ZONE</div>
              <div style={{ fontSize: 13, color: "#6b6b8a", marginBottom: 14, lineHeight: 1.6 }}>Resets all cloud data — expenses, deposits, payments, and card balances. Cannot be undone.</div>
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
            <div style={{ fontSize: 13, color: "#6b6b8a", marginBottom: 22, lineHeight: 1.6 }}>This will permanently erase all cloud data and reset all balances. Cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, background: "#1a1a2a", border: "1px solid #2a2a3a", borderRadius: 8, padding: "12px", color: "#e8e4dc", fontSize: 13, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
              <button onClick={resetAllData} disabled={syncing} style={{ flex: 1, background: "#2a0a0a", border: "1px solid #ff4444", borderRadius: 8, padding: "12px", color: "#ff4444", fontSize: 13, textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer" }}>{syncing ? "..." : "Reset"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
