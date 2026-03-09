import React, { useState, useEffect, useCallback } from "react";

// ─── TYPES ──────────────────────────────────────
interface User { id: string; name: string; emoji: string; color: string; role: string; }
interface CalEvent {
  id: string; title: string; description: string; event_date: string;
  start_time: string; end_time: string; member_id: string; category: string;
  priority: string; completed: boolean | number; notify_sound: string; notify_minutes: number;
}

const CATEGORIES = [
  { id: "work", label: "Work", icon: "💼" }, { id: "school", label: "School", icon: "📚" },
  { id: "health", label: "Health", icon: "🏥" }, { id: "sports", label: "Sports", icon: "⚽" },
  { id: "shopping", label: "Shopping", icon: "🛒" }, { id: "travel", label: "Travel", icon: "✈️" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧‍👦" }, { id: "personal", label: "Personal", icon: "⭐" },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const api = async (url: string, opts?: RequestInit) => {
  const token = localStorage.getItem("sc_token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  return res.json();
};

// ─── STYLES ─────────────────────────────────────
const css = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#0f172a; color:#e2e8f0; min-height:100vh; }
  .page { max-width:960px; margin:0 auto; padding:16px; }
  .card { background:#1e293b; border-radius:16px; padding:20px; margin-bottom:16px; }
  .btn { padding:12px 24px; border:none; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; transition:all .2s; }
  .btn:hover { transform:translateY(-1px); }
  .btn-primary { background:#6366f1; color:#fff; }
  .btn-danger { background:#ef4444; color:#fff; }
  .btn-ghost { background:#334155; color:#e2e8f0; }
  .input { width:100%; padding:12px 16px; border-radius:12px; border:1px solid #334155; background:#0f172a; color:#e2e8f0; font-size:15px; outline-color:#6366f1; }
  .input:focus { border-color:#6366f1; }
  .label { color:#94a3b8; font-size:13px; font-weight:600; margin-bottom:6px; display:block; }
  .chip { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:#0f172a; border:1px solid #334155; cursor:pointer; font-size:13px; color:#94a3b8; font-weight:600; transition:all .15s; }
  .chip.active { background:#6366f1; border-color:#6366f1; color:#fff; }
  .chip-row { display:flex; flex-wrap:wrap; gap:8px; }
  .nav { display:flex; gap:4px; background:#1e293b; border-radius:14px; padding:4px; margin-bottom:16px; }
  .nav-btn { flex:1; padding:10px; border:none; border-radius:10px; background:transparent; color:#94a3b8; font-size:14px; font-weight:600; cursor:pointer; }
  .nav-btn.active { background:#6366f1; color:#fff; }
  .flex { display:flex; } .gap-2 { gap:8px; } .gap-3 { gap:12px; } .gap-4 { gap:16px; }
  .items-center { align-items:center; } .justify-between { justify-content:space-between; }
  .text-center { text-align:center; }
  .mt-2 { margin-top:8px; } .mt-4 { margin-top:16px; } .mb-2 { margin-bottom:8px; } .mb-4 { margin-bottom:16px; }
  .grid-7 { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .day-cell { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:10px; cursor:pointer; transition:all .15s; font-size:14px; }
  .day-cell:hover { background:#334155; }
  .day-cell.today { background:rgba(99,102,241,.15); color:#818cf8; font-weight:800; }
  .day-cell.selected { background:#6366f1; color:#fff; font-weight:800; }
  .dots { display:flex; gap:3px; margin-top:2px; }
  .dot { width:5px; height:5px; border-radius:50%; }
  .event-card { background:#1e293b; border-radius:14px; padding:14px; margin-bottom:8px; border-left:4px solid #6366f1; cursor:pointer; transition:all .15s; }
  .event-card:hover { background:#283548; }
  .priority-dot { width:8px; height:8px; border-radius:50%; }
  .pin-dot { width:18px; height:18px; border-radius:50%; border:2px solid #475569; }
  .pin-dot.filled { background:#6366f1; border-color:#6366f1; }
  .numkey { width:68px; height:68px; border-radius:50%; background:#1e293b; border:none; color:#e2e8f0; font-size:26px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .numkey:hover { background:#334155; }
  .qr-box { background:#fff; padding:16px; border-radius:12px; display:inline-block; }
  .completed { text-decoration:line-through; color:#64748b; }
  @media(max-width:640px) { .page { padding:12px; } .card { padding:14px; } }
`;

// ─── APP ────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("sc_token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"login" | "calendar" | "add" | "today" | "profile" | "audit">("login");

  useEffect(() => {
    if (token) {
      api("/api/auth/me").then(d => {
        if (d.success) {
          setUser(d.user);
          setView("today");
        } else {
          localStorage.removeItem("sc_token");
          setToken("");
        }
      }).catch(() => { localStorage.removeItem("sc_token"); setToken(""); });
    }
  }, [token]);

  const onLogin = (t: string, u: User) => {
    localStorage.setItem("sc_token", t);
    setToken(t);
    setUser(u);
    setView("today");
  };

  const onLogout = () => {
    localStorage.removeItem("sc_token");
    setToken("");
    setUser(null);
    setView("login");
  };

  return (
    <>
      <style>{css}</style>
      {view === "login" || !user ? (
        <LoginPage onLogin={onLogin} />
      ) : (
        <div className="page">
          <div className="nav">
            <button className={`nav-btn ${view === "today" ? "active" : ""}`} onClick={() => setView("today")}>📋 Today</button>
            <button className={`nav-btn ${view === "calendar" ? "active" : ""}`} onClick={() => setView("calendar")}>📅 Calendar</button>
            <button className={`nav-btn ${view === "add" ? "active" : ""}`} onClick={() => setView("add")}>➕ Add</button>
            <button className={`nav-btn ${view === "audit" ? "active" : ""}`} onClick={() => setView("audit")}>📜 Audit</button>
            <button className={`nav-btn ${view === "profile" ? "active" : ""}`} onClick={() => setView("profile")}>👤 Profile</button>
          </div>
          {view === "today" && <TodayPage user={user} />}
          {view === "calendar" && <CalendarPage user={user} />}
          {view === "add" && <AddEventPage user={user} onDone={() => setView("today")} />}
          {view === "audit" && <AuditPage user={user} />}
          {view === "profile" && <ProfilePage user={user} onLogout={onLogout} />}
        </div>
      )}
    </>
  );
}

// ─── LOGIN PAGE ─────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (t: string, u: User) => void }) {
  const [step, setStep] = useState<"credentials" | "totp" | "setup">("credentials");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [userName, setUserName] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async () => {
    if (!mobile || !password) { setError("Enter mobile number and password"); return; }
    setLoading(true); setError("");
    try {
      const d = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ mobile, password }) });
      if (d.success) {
        setTempToken(d.tempToken);
        setUserName(d.userName);
        if (d.totpSetup) {
          // First time — show QR (only works from localhost)
          const setup = await api("/api/auth/totp-setup", { method: "POST", body: JSON.stringify({ tempToken: d.tempToken }) });
          if (setup.success) {
            setQrCode(setup.qrCode);
            setSecret(setup.secret);
            setStep("setup");
          } else {
            // Blocked from public — tell user to set up on server
            setError(setup.error || "Authenticator setup not available from this network. Please set up from localhost.");
          }
        } else {
          setStep("totp");
        }
      } else {
        setError(d.error || "Login failed");
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleTotp = async () => {
    if (totpCode.length !== 6) { setError("Enter 6-digit code from authenticator"); return; }
    setLoading(true); setError("");
    try {
      const d = await api("/api/auth/verify-totp", { method: "POST", body: JSON.stringify({ tempToken, totpCode }) });
      if (d.success) {
        onLogin(d.accessToken, d.user);
      } else {
        setError(d.error || "Invalid code");
        setTotpCode("");
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 20 }}>
        <div className="text-center mb-4">
          <div style={{ fontSize: 64 }}>📅</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>Sugana Calendar</h1>
          <p style={{ color: "#94a3b8", marginTop: 4 }}>Family Activity Planner</p>
        </div>

        <div className="card">
          {step === "credentials" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🔐 Sign In</h2>
              <label className="label">Mobile Number</label>
              <input className="input mb-2" type="tel" placeholder="+353851234001" value={mobile} onChange={e => setMobile(e.target.value)} />
              <label className="label mt-2">Password</label>
              <input className="input mb-2" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCredentials()} />
              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button className="btn btn-primary mt-4" style={{ width: "100%" }} onClick={handleCredentials} disabled={loading}>
                {loading ? "⏳ Verifying..." : "Continue →"}
              </button>
            </>
          )}

          {step === "setup" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>📱 Setup Authenticator</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
                Hi {userName}! Scan this QR code with <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>
              </p>
              {qrCode && <div className="text-center mb-4"><div className="qr-box"><img src={qrCode} alt="QR" style={{ width: 200 }} /></div></div>}
              <div style={{ background: "#0f172a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <p style={{ color: "#94a3b8", fontSize: 11 }}>Manual entry key:</p>
                <p style={{ fontFamily: "monospace", color: "#6366f1", fontSize: 14, wordBreak: "break-all" }}>{secret}</p>
              </div>
              <label className="label">Enter 6-digit code from authenticator</label>
              <input className="input mb-2" type="text" maxLength={6} placeholder="000000" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleTotp()} style={{ textAlign: "center", fontSize: 24, letterSpacing: 8 }} />
              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button className="btn btn-primary mt-4" style={{ width: "100%" }} onClick={handleTotp} disabled={loading}>
                {loading ? "⏳ Verifying..." : "✅ Verify & Login"}
              </button>
            </>
          )}

          {step === "totp" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>🔑 Authenticator Code</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>Hi {userName}! Enter the code from your authenticator app</p>
              <input className="input mb-2" type="text" maxLength={6} placeholder="000000" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleTotp()} autoFocus style={{ textAlign: "center", fontSize: 28, letterSpacing: 10, fontWeight: 700 }} />
              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button className="btn btn-primary mt-4" style={{ width: "100%" }} onClick={handleTotp} disabled={loading}>
                {loading ? "⏳ Verifying..." : "🔓 Verify & Login"}
              </button>
              <button className="btn btn-ghost mt-2" style={{ width: "100%", fontSize: 13 }} onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}>
                ← Back to sign in
              </button>
            </>
          )}
        </div>

        <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 16 }}>
          🔒 Secured with TOTP Authenticator + Argon2 + Azure SQL
        </p>
      </div>
    </div>
  );
}

// ─── CALENDAR PAGE ──────────────────────────────
function CalendarPage({ user }: { user: User }) {
  const [members, setMembers] = useState<User[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedMember, setSelectedMember] = useState("all");
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);

  const load = useCallback(async () => {
    const [m, e] = await Promise.all([
      api("/api/members"),
      api(`/api/events/calendar/${year}/${month + 1}`),
    ]);
    if (m.success) setMembers(m.members);
    if (e.success) setEvents(e.events);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const dayEvents = events
    .filter(e => e.event_date === selectedDate && (selectedMember === "all" || e.member_id === selectedMember))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const getMember = (id: string) => members.find(m => m.id === id);
  const getCatIcon = (c: string) => CATEGORIES.find(cat => cat.id === c)?.icon || "📌";
  const getPriorityColor = (p: string) => p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#22c55e";

  const toggleComplete = async (id: string) => {
    await api(`/api/events/${id}/toggle`, { method: "POST" });
    load();
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await api(`/api/events/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>📅 Sugana Calendar</h1>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Hi {user.emoji} {user.name}</span>
      </div>

      {/* Member filter */}
      <div className="chip-row mb-4" style={{ overflowX: "auto" }}>
        <span className={`chip ${selectedMember === "all" ? "active" : ""}`} onClick={() => setSelectedMember("all")}>👨‍👩‍👧‍👦 All</span>
        {members.map(m => (
          <span key={m.id} className={`chip ${selectedMember === m.id ? "active" : ""}`}
            style={selectedMember === m.id ? { background: m.color, borderColor: m.color } : {}}
            onClick={() => setSelectedMember(m.id)}>{m.emoji} {m.name}</span>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-ghost" onClick={prevMonth}>◀</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{MONTHS[month]} {year}</span>
        <button className="btn btn-ghost" onClick={nextMonth}>▶</button>
      </div>

      {/* Day headers */}
      <div className="grid-7 mb-2">
        {DAYS.map(d => <div key={d} style={{ textAlign: "center", color: "#64748b", fontSize: 12, fontWeight: 600, padding: 4 }}>{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div className="grid-7 mb-4">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const de = events.filter(e => e.event_date === ds);
          const memberDots = [...new Set(de.map(e => e.member_id))];
          const isToday = ds === todayStr();
          const isSel = ds === selectedDate;
          return (
            <div key={ds} className={`day-cell ${isToday ? "today" : ""} ${isSel ? "selected" : ""}`} onClick={() => setSelectedDate(ds)}>
              <span>{day}</span>
              {memberDots.length > 0 && (
                <div className="dots">
                  {memberDots.slice(0, 4).map(mid => <div key={mid} className="dot" style={{ background: getMember(mid)?.color || "#6366f1" }} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Events for selected date */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        {selectedDate === todayStr() ? "Today" : new Date(selectedDate + "T00:00").toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short" })}
        {" · "}{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
      </h3>

      {dayEvents.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <p style={{ color: "#94a3b8" }}>No events — enjoy your free time!</p>
        </div>
      ) : (
        dayEvents.map(event => {
          const m = getMember(event.member_id);
          return (
            <div key={event.id} className="event-card" style={{ borderLeftColor: m?.color || "#6366f1" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ flex: 1 }}>
                  <span style={{ fontSize: 20 }}>{m?.emoji}</span>
                  <div>
                    <div className={event.completed ? "completed" : ""} style={{ fontWeight: 700, fontSize: 15 }}>{event.title}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>{getCatIcon(event.category)} {event.start_time} - {event.end_time} · {m?.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="priority-dot" style={{ background: getPriorityColor(event.priority) }} />
                  <span style={{ cursor: "pointer", fontSize: 16 }} onClick={() => setEditEvent(event)} title="Edit">✏️</span>
                  <span style={{ cursor: "pointer", fontSize: 20 }} onClick={() => toggleComplete(event.id)}>{event.completed ? "✅" : "⬜"}</span>
                  <span style={{ cursor: "pointer", fontSize: 16, color: "#ef4444" }} onClick={() => deleteEvent(event.id)}>🗑</span>
                </div>
              </div>
              {event.description && <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>{event.description}</p>}
            </div>
          );
        })
      )}

      {/* Edit Event Modal */}
      {editEvent && (
        <EditEventModal
          event={editEvent}
          members={members}
          onClose={() => setEditEvent(null)}
          onSaved={() => { setEditEvent(null); load(); }}
        />
      )}
    </>
  );
}

// ─── EDIT EVENT MODAL ───────────────────────────
function EditEventModal({ event, members, onClose, onSaved }: { event: CalEvent; members: User[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [desc, setDesc] = useState(event.description || "");
  const [date, setDate] = useState(event.event_date);
  const [startTime, setStartTime] = useState(event.start_time);
  const [endTime, setEndTime] = useState(event.end_time);
  const [memberId, setMemberId] = useState(event.member_id);
  const [category, setCategory] = useState(event.category);
  const [priority, setPriority] = useState(event.priority);
  const [notifySound, setNotifySound] = useState(event.notify_sound || "default");
  const [notifyMin, setNotifyMin] = useState(String(event.notify_minutes || 15));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setMsg("Enter a title"); return; }
    setSaving(true); setMsg("");
    const d = await api(`/api/events/${event.id}`, {
      method: "PUT",
      body: JSON.stringify({ title, description: desc, date, startTime, endTime, memberId, category, priority, notifySound, notifyMinutes: parseInt(notifyMin) || 15 }),
    });
    setSaving(false);
    if (d.success) { onSaved(); } else { setMsg(d.error || "Failed to update"); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>✏️ Edit Event</h2>
          <span style={{ cursor: "pointer", fontSize: 20, color: "#94a3b8" }} onClick={onClose}>✕</span>
        </div>

        <label className="label">Title *</label>
        <input className="input mb-2" value={title} onChange={e => setTitle(e.target.value)} />

        <label className="label mt-2">Description</label>
        <textarea className="input mb-2" value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ resize: "vertical" }} />

        <div className="flex gap-3">
          <div style={{ flex: 1 }}><label className="label mt-2">Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label mt-2">Start</label><input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label mt-2">End</label><input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
        </div>

        <label className="label mt-4">Assign To</label>
        <div className="chip-row mb-2">
          {members.map(m => (
            <span key={m.id} className={`chip ${memberId === m.id ? "active" : ""}`}
              style={memberId === m.id ? { background: m.color, borderColor: m.color } : {}}
              onClick={() => setMemberId(m.id)}>{m.emoji} {m.name}</span>
          ))}
        </div>

        <label className="label mt-4">Category</label>
        <div className="chip-row mb-2">
          {CATEGORIES.map(c => (
            <span key={c.id} className={`chip ${category === c.id ? "active" : ""}`} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</span>
          ))}
        </div>

        <label className="label mt-4">Priority</label>
        <div className="chip-row mb-2">
          {[{id:"low",icon:"🟢",label:"Low"},{id:"medium",icon:"🟡",label:"Medium"},{id:"high",icon:"🔴",label:"High"}].map(p => (
            <span key={p.id} className={`chip ${priority === p.id ? "active" : ""}`} onClick={() => setPriority(p.id)}>{p.icon} {p.label}</span>
          ))}
        </div>

        <label className="label mt-4">🔔 Sound & Reminder</label>
        <div className="flex gap-3">
          <select className="input" value={notifySound} onChange={e => setNotifySound(e.target.value)} style={{ flex: 1 }}>
            <option value="default">Default</option><option value="gentle">Gentle</option><option value="none">Silent</option>
          </select>
          <input className="input" type="number" value={notifyMin} onChange={e => setNotifyMin(e.target.value)} style={{ width: 80 }} />
          <span style={{ color: "#64748b", fontSize: 13, alignSelf: "center" }}>min</span>
        </div>

        {msg && <p style={{ marginTop: 12, color: "#f87171", fontSize: 14 }}>{msg}</p>}

        <div className="flex gap-3 mt-4">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Saving..." : "💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD EVENT PAGE ─────────────────────────────
function AddEventPage({ user, onDone }: { user: User; onDone: () => void }) {
  const [members, setMembers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [memberId, setMemberId] = useState(user.id);
  const [category, setCategory] = useState("personal");
  const [priority, setPriority] = useState("medium");
  const [notifySound, setNotifySound] = useState("default");
  const [notifyMin, setNotifyMin] = useState("15");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api("/api/members").then(d => d.success && setMembers(d.members)); }, []);

  const save = async () => {
    if (!title.trim()) { setMsg("Enter a title"); return; }
    setSaving(true); setMsg("");
    const d = await api("/api/events", {
      method: "POST",
      body: JSON.stringify({ title, description: desc, date, startTime, endTime, memberId, category, priority, notifySound, notifyMinutes: parseInt(notifyMin) || 15 }),
    });
    setSaving(false);
    if (d.success) {
      const conflictMsg = d.conflicts ? `\n⚠️ Note: overlaps with ${d.conflicts.length} event(s)` : "";
      setMsg(`✅ "${title}" added!${conflictMsg}`);
      setTitle(""); setDesc("");
      setTimeout(onDone, 1000);
    } else { setMsg(d.error || "Failed"); }
  };

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>➕ New Event</h1>
      <div className="card">
        <label className="label">Title *</label>
        <input className="input mb-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="What's happening?" />

        <label className="label mt-2">Description</label>
        <textarea className="input mb-2" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add details..." rows={3} style={{ resize: "vertical" }} />

        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <label className="label mt-2">Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label mt-2">Start</label>
            <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label mt-2">End</label>
            <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        <label className="label mt-4">Assign To</label>
        <div className="chip-row mb-2">
          {members.map(m => (
            <span key={m.id} className={`chip ${memberId === m.id ? "active" : ""}`}
              style={memberId === m.id ? { background: m.color, borderColor: m.color } : {}}
              onClick={() => setMemberId(m.id)}>{m.emoji} {m.name}</span>
          ))}
        </div>

        <label className="label mt-4">Category</label>
        <div className="chip-row mb-2">
          {CATEGORIES.map(c => (
            <span key={c.id} className={`chip ${category === c.id ? "active" : ""}`} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</span>
          ))}
        </div>

        <label className="label mt-4">Priority</label>
        <div className="chip-row mb-2">
          {[{id:"low",icon:"🟢",label:"Low"},{id:"medium",icon:"🟡",label:"Medium"},{id:"high",icon:"🔴",label:"High"}].map(p => (
            <span key={p.id} className={`chip ${priority === p.id ? "active" : ""}`} onClick={() => setPriority(p.id)}>{p.icon} {p.label}</span>
          ))}
        </div>

        <label className="label mt-4">🔔 Sound & Reminder</label>
        <div className="flex gap-3">
          <select className="input" value={notifySound} onChange={e => setNotifySound(e.target.value)} style={{ flex: 1 }}>
            <option value="default">Default</option><option value="gentle">Gentle</option><option value="none">Silent</option>
          </select>
          <input className="input" type="number" value={notifyMin} onChange={e => setNotifyMin(e.target.value)} style={{ width: 100 }} placeholder="Minutes" />
          <span style={{ color: "#64748b", fontSize: 13, alignSelf: "center" }}>min before</span>
        </div>

        {msg && <p style={{ marginTop: 12, color: msg.startsWith("✅") ? "#22c55e" : "#f87171", fontSize: 14 }}>{msg}</p>}

        <button className="btn btn-primary mt-4" style={{ width: "100%" }} onClick={save} disabled={saving}>
          {saving ? "⏳ Saving..." : "✅ Add Event"}
        </button>
      </div>
    </>
  );
}

// ─── PROFILE PAGE ───────────────────────────────
function ProfilePage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [members, setMembers] = useState<User[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [changePw, setChangePw] = useState(false);
  const [curPw, setCurPw] = useState(""); const [newPw, setNewPw] = useState(""); const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    api("/api/members").then(d => d.success && setMembers(d.members));
    api(`/api/events?memberId=${user.id}`).then(d => d.success && setEvents(d.events));
  }, [user.id]);

  const myEvents = events;
  const upcoming = myEvents.filter(e => e.event_date >= todayStr() && !e.completed).length;
  const completed = myEvents.filter(e => e.completed).length;

  const handleChangePw = async () => {
    const d = await api("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
    setPwMsg(d.success ? "✅ Password updated!" : d.error || "Failed");
    if (d.success) { setCurPw(""); setNewPw(""); }
  };

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>👤 Profile</h1>

      <div className="card text-center" style={{ borderTop: `4px solid ${user.color}` }}>
        <div style={{ fontSize: 64 }}>{user.emoji}</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: user.color, marginTop: 8 }}>{user.name}</h2>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Family Member</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="card text-center" style={{ flex: 1 }}><div style={{ fontSize: 28, fontWeight: 800 }}>{myEvents.length}</div><div style={{ color: "#64748b", fontSize: 11 }}>Total</div></div>
        <div className="card text-center" style={{ flex: 1 }}><div style={{ fontSize: 28, fontWeight: 800, color: "#6366f1" }}>{upcoming}</div><div style={{ color: "#64748b", fontSize: 11 }}>Upcoming</div></div>
        <div className="card text-center" style={{ flex: 1 }}><div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>{completed}</div><div style={{ color: "#64748b", fontSize: 11 }}>Done</div></div>
      </div>

      <h3 style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Family Members</h3>
      {members.map(m => (
        <div key={m.id} className="card flex items-center gap-3" style={{ padding: 14, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>{m.emoji}</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{m.name}</div></div>
          <span style={{ background: m.color, color: "#fff", padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{m.id === user.id ? "You" : "Family"}</span>
        </div>
      ))}

      {/* Change Password */}
      <div className="card mt-4">
        <div className="flex items-center justify-between" style={{ cursor: "pointer" }} onClick={() => setChangePw(!changePw)}>
          <span style={{ fontWeight: 700 }}>🔑 Change Password</span>
          <span>{changePw ? "▲" : "▼"}</span>
        </div>
        {changePw && (
          <div className="mt-2">
            <input className="input mb-2" type="password" placeholder="Current password" value={curPw} onChange={e => setCurPw(e.target.value)} />
            <input className="input mb-2" type="password" placeholder="New password (min 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} />
            {pwMsg && <p style={{ color: pwMsg.startsWith("✅") ? "#22c55e" : "#f87171", fontSize: 13, marginBottom: 8 }}>{pwMsg}</p>}
            <button className="btn btn-primary" onClick={handleChangePw}>Update Password</button>
          </div>
        )}
      </div>

      <div className="card mt-2" style={{ fontSize: 13, color: "#94a3b8" }}>
        <span style={{ color: "#6366f1", fontWeight: 700 }}>🔒 Security</span>
        <p className="mt-2">TOTP Authenticator · Argon2id passwords · JWT 4h expiry · Azure SQL encrypted · TLS 1.2+</p>
      </div>

      <button className="btn btn-danger mt-4" style={{ width: "100%" }} onClick={onLogout}>🚪 Sign Out</button>
    </>
  );
}

// ─── TODAY PAGE (Daily Summary + Reminders) ─────
function TodayPage({ user }: { user: User }) {
  const [summary, setSummary] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState("all");

  const load = async () => {
    const [s, r] = await Promise.all([
      api(`/api/events/daily-summary?date=${todayStr()}`),
      api("/api/events/reminders?minutes=60"),
    ]);
    if (s.success) setSummary(s);
    if (r.success) setReminders(r.reminders || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 60 seconds for reminders
  useEffect(() => {
    const interval = setInterval(async () => {
      const r = await api("/api/events/reminders?minutes=15");
      if (r.success && r.reminders?.length > 0) {
        setReminders(r.reminders);
        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
          r.reminders.forEach((evt: any) => {
            new Notification(`📅 ${evt.title} in ${evt.start_time}`, {
              body: `${evt.member_emoji} ${evt.member_name} — ${evt.category || "Event"}`,
              icon: "📅",
            });
          });
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  if (loading) return <div className="card text-center" style={{ padding: 40 }}>⏳ Loading...</div>;

  const getCatIcon = (c: string) => CATEGORIES.find(cat => cat.id === c)?.icon || "📌";
  const getPriorityColor = (p: string) => p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#22c55e";
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const filteredEvents = selectedMember === "all"
    ? (summary?.allEvents || [])
    : (summary?.allEvents || []).filter((e: any) => e.member_id === selectedMember);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>📋 Today's Schedule</h1>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>
            {new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ background: "#6366f1", padding: "8px 16px", borderRadius: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{summary?.total || 0}</span>
          <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>events</span>
        </div>
      </div>

      {/* Reminders Banner */}
      {reminders.length > 0 && (
        <div className="card mb-4" style={{ background: "#7c3aed", borderRadius: 14 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>🔔 Coming Up Soon</h3>
          {reminders.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2" style={{ padding: "6px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
              <span style={{ fontSize: 18 }}>{r.member_emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.start_time} · {r.member_name}</div>
              </div>
              <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 8 }}>
                ⏰ {r.start_time}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Member filter */}
      <div className="chip-row mb-4">
        <span className={`chip ${selectedMember === "all" ? "active" : ""}`} onClick={() => setSelectedMember("all")}>👨‍👩‍👧‍👦 All ({summary?.total || 0})</span>
        {(summary?.byMember || []).map((m: any) => (
          <span key={m.id} className={`chip ${selectedMember === m.id ? "active" : ""}`}
            style={selectedMember === m.id ? { background: m.color, borderColor: m.color } : {}}
            onClick={() => setSelectedMember(m.id)}>
            {m.emoji} {m.name} ({m.events.length})
          </span>
        ))}
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <p style={{ color: "#94a3b8" }}>
            {selectedMember === "all" ? "No events today — enjoy your day!" : "No events for this member today"}
          </p>
        </div>
      ) : (
        filteredEvents.map((event: any) => {
          const isPast = event.start_time < currentTime;
          const isNow = event.start_time <= currentTime && event.end_time > currentTime;
          return (
            <div key={event.id} className="event-card" style={{
              borderLeftColor: event.member_color || "#6366f1",
              opacity: isPast && event.completed ? 0.5 : 1,
              background: isNow ? "#1e3a5f" : "#1e293b",
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ flex: 1 }}>
                  <span style={{ fontSize: 20 }}>{event.member_emoji}</span>
                  <div>
                    <div className={event.completed ? "completed" : ""} style={{ fontWeight: 700, fontSize: 15 }}>
                      {isNow && <span style={{ color: "#60a5fa", marginRight: 6, fontSize: 12 }}>▶ NOW</span>}
                      {event.title}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {getCatIcon(event.category)} {event.start_time} - {event.end_time} · {event.member_name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="priority-dot" style={{ background: getPriorityColor(event.priority) }} />
                  {event.completed ? <span>✅</span> : <span style={{ color: "#94a3b8", fontSize: 12 }}>{isPast ? "Past" : "Upcoming"}</span>}
                </div>
              </div>
              {event.description && <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>{event.description}</p>}
            </div>
          );
        })
      )}

      {/* Per-member breakdown */}
      {selectedMember === "all" && (summary?.byMember || []).length > 0 && (
        <div className="mt-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>👥 Individual Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {(summary?.byMember || []).map((m: any) => (
              <div key={m.id} className="card" style={{ borderTop: `3px solid ${m.color}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 24 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{m.events.length} event{m.events.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {m.events.map((e: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: "#94a3b8", padding: "3px 0", borderTop: i > 0 ? "1px solid #334155" : "none" }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{e.start_time}</span> {e.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-ghost mt-4" style={{ width: "100%" }} onClick={load}>🔄 Refresh</button>
    </>
  );
}

// ─── AUDIT LOG PAGE ─────────────────────────────
function AuditPage({ user }: { user: User }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterAction, setFilterAction] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const actionParam = filterAction ? `&action=${filterAction}` : "";
    const d = await api(`/api/audit-log?limit=100${actionParam}`);
    if (d.success) setLogs(d.logs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterAction]);

  const getActionColor = (action: string) => {
    if (action.includes("success") || action.includes("created")) return "#22c55e";
    if (action.includes("failed") || action.includes("blocked")) return "#ef4444";
    if (action.includes("login")) return "#6366f1";
    if (action.includes("deleted")) return "#f59e0b";
    return "#94a3b8";
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString("en-IE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>📜 Audit Log</h1>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>Track who logged in, what was changed, and from where</p>

      <div className="chip-row mb-4">
        {["", "login", "event", "password", "totp", "blocked"].map(f => (
          <span key={f} className={`chip ${filterAction === f ? "active" : ""}`} onClick={() => setFilterAction(f)}>
            {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </span>
        ))}
      </div>

      {loading ? <div className="card text-center">⏳ Loading...</div> : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>When</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Who</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Action</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #1e293b" }}>
                  <td style={{ padding: "8px 12px", color: "#94a3b8", fontSize: 12 }}>{formatDate(log.created_at)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span>{log.user_emoji || "🔧"} {log.user_name || log.user_id || "System"}</span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ color: getActionColor(log.action), fontWeight: 600, fontSize: 12 }}>{log.action}</span>
                    {log.details && log.details !== "{}" && (
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{log.details.substring(0, 80)}</div>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#64748b", fontSize: 11, fontFamily: "monospace" }}>{log.ip_address}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── HELPERS ────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
