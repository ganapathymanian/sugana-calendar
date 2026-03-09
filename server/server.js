/**
 * Sugana Calendar — Secure Backend Server
 * ========================================
 * - Azure SQL for all data storage
 * - TOTP (Authenticator app) + mobile number auth
 * - JWT tokens with short expiry
 * - Helmet security headers
 * - Rate limiting on login
 * - HTTPS-ready
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const { OTPAuth } = require("otpauth");
const QRCode = require("qrcode");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const path = require("path");

const app = express();

// ─── CONFIGURATION ─────────────────────────────
const fs = require("fs");
const CONFIG_FILE = path.join(__dirname, "config.json");

// Load config from file or environment
function loadConfig() {
  // 1. Try config.json first
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return cfg;
  }
  // 2. Try environment variables
  if (process.env.DB_SERVER) {
    return {
      dbServer: process.env.DB_SERVER,
      dbName: process.env.DB_NAME || "sugana-calendar",
      dbUser: process.env.DB_USER,
      dbPassword: process.env.DB_PASSWORD,
      jwtSecret: process.env.JWT_SECRET,
      port: parseInt(process.env.PORT) || 3002,
    };
  }
  // 3. No config found — will trigger setup prompt
  return null;
}

let appConfig = loadConfig();

const JWT_SECRET = appConfig?.jwtSecret || process.env.JWT_SECRET || `SC_fallback_${require('crypto').randomBytes(16).toString('hex')}`;
const JWT_EXPIRY = "4h";
const PORT = appConfig?.port || parseInt(process.env.PORT) || 3002;

// Azure SQL configuration — loaded from config.json (created by setup.js)
const DB_CONFIG = {
  server: appConfig?.dbServer || "",
  database: appConfig?.dbName || "sugana-calendar",
  user: appConfig?.dbUser || "",
  password: appConfig?.dbPassword || "",
  options: {
    encrypt: true,             // Required for Azure
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// ─── SECURITY MIDDLEWARE ───────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

// Rate limiter: max 5 login attempts per minute per IP
const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

// ─── DATABASE ──────────────────────────────────
let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(DB_CONFIG);
    console.log("✅ Connected to Azure SQL");
  }
  return pool;
}

async function query(queryStr, params = {}) {
  const p = await getPool();
  const req = p.request();
  for (const [key, val] of Object.entries(params)) {
    req.input(key, val);
  }
  const result = await req.query(queryStr);
  return result.recordset;
}

async function run(queryStr, params = {}) {
  const p = await getPool();
  const req = p.request();
  for (const [key, val] of Object.entries(params)) {
    req.input(key, val);
  }
  return req.query(queryStr);
}

// ─── INITIALIZE DATABASE TABLES ────────────────
async function initDatabase() {
  console.log("📦 Initializing database tables...");

  await run(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    CREATE TABLE users (
      id NVARCHAR(50) PRIMARY KEY,
      name NVARCHAR(100) NOT NULL,
      mobile_number NVARCHAR(20) NOT NULL UNIQUE,
      password_hash NVARCHAR(500) NOT NULL,
      totp_secret NVARCHAR(200) NOT NULL,
      totp_verified BIT DEFAULT 0,
      emoji NVARCHAR(10) DEFAULT '👤',
      color NVARCHAR(20) DEFAULT '#6366f1',
      role NVARCHAR(20) DEFAULT 'member',
      active BIT DEFAULT 1,
      last_login DATETIME2,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  await run(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'events')
    CREATE TABLE events (
      id NVARCHAR(50) PRIMARY KEY,
      title NVARCHAR(200) NOT NULL,
      description NVARCHAR(1000),
      event_date NVARCHAR(20) NOT NULL,
      start_time NVARCHAR(10) NOT NULL,
      end_time NVARCHAR(10) NOT NULL,
      member_id NVARCHAR(50) NOT NULL,
      category NVARCHAR(50) DEFAULT 'personal',
      priority NVARCHAR(10) DEFAULT 'medium',
      notify_sound NVARCHAR(50) DEFAULT 'default',
      notify_minutes INT DEFAULT 15,
      completed BIT DEFAULT 0,
      created_by NVARCHAR(50) NOT NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (member_id) REFERENCES users(id)
    )
  `);

  await run(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
    CREATE TABLE sessions (
      id NVARCHAR(100) PRIMARY KEY,
      user_id NVARCHAR(50) NOT NULL,
      token_hash NVARCHAR(500) NOT NULL,
      ip_address NVARCHAR(50),
      user_agent NVARCHAR(500),
      expires_at DATETIME2 NOT NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_log')
    CREATE TABLE audit_log (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id NVARCHAR(50),
      action NVARCHAR(100) NOT NULL,
      details NVARCHAR(MAX),
      ip_address NVARCHAR(50),
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  console.log("✅ Database tables ready");

  // Seed default family members if empty
  const users = await query("SELECT COUNT(*) as cnt FROM users");
  if (users[0].cnt === 0) {
    console.log("🌱 Seeding family members...");
    await seedFamilyMembers();
  }
}

async function seedFamilyMembers() {
  const OTPAuthLib = require("otpauth");
  const members = [
    { id: "gana", name: "Gana", mobile: "+353851234001", emoji: "👨", color: "#6366f1" },
    { id: "suganya", name: "Suganya", mobile: "+353851234002", emoji: "👩", color: "#ec4899" },
    { id: "aadarsh", name: "Aadarsh", mobile: "+353851234003", emoji: "👦", color: "#f59e0b" },
    { id: "avanthika", name: "Avanthika", mobile: "+353851234004", emoji: "👧", color: "#10b981" },
  ];

  for (const m of members) {
    // Generate TOTP secret
    const totp = new OTPAuthLib.TOTP({
      issuer: "Sugana Calendar",
      label: m.name,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuthLib.Secret({ size: 20 }),
    });

    // Default password from config or env, fallback to random
    const defaultPw = appConfig?.defaultPassword || process.env.DEFAULT_PASSWORD || require('crypto').randomBytes(12).toString('base64');
    const passwordHash = await argon2.hash(defaultPw);

    await run(`
      INSERT INTO users (id, name, mobile_number, password_hash, totp_secret, emoji, color, role)
      VALUES (@id, @name, @mobile, @passwordHash, @totpSecret, @emoji, @color, 'member')
    `, {
      id: m.id,
      name: m.name,
      mobile: m.mobile,
      passwordHash,
      totpSecret: totp.secret.base32,
      emoji: m.emoji,
      color: m.color,
    });

    console.log(`   ✅ ${m.emoji} ${m.name} — Mobile: ${m.mobile}`);
  }

  console.log(`\n   ⚠ Default password for all: ${appConfig?.defaultPassword || process.env.DEFAULT_PASSWORD || '(random — check setup.js output)'}`);
  console.log("   ⚠ Each member must scan their QR code in Authenticator app");
  console.log("   ⚠ Run the app and go to /setup to get QR codes\n");
}

// ─── AUDIT LOGGING ─────────────────────────────
async function auditLog(userId, action, details, ip) {
  try {
    await run(`INSERT INTO audit_log (user_id, action, details, ip_address) VALUES (@userId, @action, @details, @ip)`,
      { userId: userId || "system", action, details: typeof details === "string" ? details : JSON.stringify(details), ip: ip || "" });
  } catch (e) { /* silent */ }
}

// ─── JWT MIDDLEWARE ─────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (e) {
    return res.status(403).json({ error: "Invalid or expired token. Please login again." });
  }
}

// ─── AUTH ROUTES ───────────────────────────────
// Step 1: Verify mobile + password → get temp token for TOTP step
app.post("/api/auth/login", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;

  // Rate limit
  try {
    await loginLimiter.consume(ip);
  } catch (e) {
    await auditLog(null, "login_rate_limited", { ip }, ip);
    return res.status(429).json({ error: "Too many login attempts. Wait 1 minute." });
  }

  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ error: "Mobile number and password required" });

    const users = await query("SELECT * FROM users WHERE mobile_number = @mobile AND active = 1", { mobile });
    if (users.length === 0) {
      await auditLog(null, "login_failed_user_not_found", { mobile }, ip);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];
    const validPassword = await argon2.verify(user.password_hash, password);
    if (!validPassword) {
      await auditLog(user.id, "login_failed_wrong_password", {}, ip);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Issue a temporary token (valid 5 min) for TOTP verification
    const tempToken = jwt.sign(
      { userId: user.id, step: "totp_pending" },
      JWT_SECRET,
      { expiresIn: "5m" }
    );

    await auditLog(user.id, "login_step1_success", {}, ip);
    res.json({
      success: true,
      tempToken,
      userName: user.name,
      totpRequired: true,
      totpSetup: !user.totp_verified,
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Step 2: Verify TOTP code → get full access token
app.post("/api/auth/verify-totp", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;

  try {
    const { tempToken, totpCode } = req.body;
    if (!tempToken || !totpCode) return res.status(400).json({ error: "Token and TOTP code required" });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (e) {
      return res.status(403).json({ error: "Temporary token expired. Start login again." });
    }

    if (decoded.step !== "totp_pending") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    const users = await query("SELECT * FROM users WHERE id = @id", { id: decoded.userId });
    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    const user = users[0];
    const OTPAuthLib = require("otpauth");
    const totp = new OTPAuthLib.TOTP({
      issuer: "Sugana Calendar",
      label: user.name,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuthLib.Secret.fromBase32(user.totp_secret),
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      await auditLog(user.id, "totp_failed", {}, ip);
      return res.status(401).json({ error: "Invalid authenticator code. Check your app and try again." });
    }

    // Mark TOTP as verified if first time
    if (!user.totp_verified) {
      await run("UPDATE users SET totp_verified = 1 WHERE id = @id", { id: user.id });
    }

    // Update last login
    await run("UPDATE users SET last_login = GETDATE() WHERE id = @id", { id: user.id });

    // Issue full access token
    const accessToken = jwt.sign(
      { userId: user.id, name: user.name, role: user.role, emoji: user.emoji, color: user.color },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Save session
    const sessionId = `ses-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    const tokenHash = await argon2.hash(accessToken.substring(0, 50));
    await run(`
      INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES (@id, @userId, @tokenHash, @ip, @ua, DATEADD(HOUR, 4, GETDATE()))
    `, {
      id: sessionId,
      userId: user.id,
      tokenHash,
      ip: ip || "",
      ua: (req.headers["user-agent"] || "").substring(0, 500),
    });

    await auditLog(user.id, "login_success", { sessionId }, ip);
    console.log(`🔐 ${user.emoji} ${user.name} logged in from ${ip}`);

    res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        emoji: user.emoji,
        color: user.color,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("TOTP verify error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Get TOTP QR code for setup — ONLY from localhost for security
app.post("/api/auth/totp-setup", async (req, res) => {
  try {
    // Block TOTP QR display from public internet
    const ip = req.ip || req.socket.remoteAddress || "";
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.includes("localhost");
    if (!isLocal) {
      await auditLog(null, "totp_setup_blocked_public", { ip }, ip);
      return res.status(403).json({ 
        error: "Authenticator setup is only available from localhost for security. " +
               "Please run setup on the server machine directly, or ask admin to add your authenticator." 
      });
    }

    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ error: "Token required" });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (e) {
      return res.status(403).json({ error: "Token expired" });
    }

    const users = await query("SELECT * FROM users WHERE id = @id", { id: decoded.userId });
    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    const user = users[0];
    const OTPAuthLib = require("otpauth");
    const totp = new OTPAuthLib.TOTP({
      issuer: "Sugana Calendar",
      label: user.name,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuthLib.Secret.fromBase32(user.totp_secret),
    });

    const uri = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 300, margin: 2 });

    res.json({
      success: true,
      qrCode: qrDataUrl,
      secret: user.totp_secret, // Show for manual entry in authenticator
      uri,
      instructions: "Scan this QR code with Google Authenticator or Microsoft Authenticator",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verify current session
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const users = await query("SELECT id, name, emoji, color, role, mobile_number, last_login FROM users WHERE id = @id", { id: req.user.userId });
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user: users[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Change password
app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const users = await query("SELECT * FROM users WHERE id = @id", { id: req.user.userId });
    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    const valid = await argon2.verify(users[0].password_hash, currentPassword);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await argon2.hash(newPassword);
    await run("UPDATE users SET password_hash = @hash, updated_at = GETDATE() WHERE id = @id",
      { hash: newHash, id: req.user.userId });

    await auditLog(req.user.userId, "password_changed", {}, req.ip);
    res.json({ success: true, message: "Password updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FAMILY MEMBERS ────────────────────────────
app.get("/api/members", authenticateToken, async (req, res) => {
  try {
    const members = await query("SELECT id, name, emoji, color, role FROM users WHERE active = 1");
    res.json({ success: true, members });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── EVENTS CRUD ───────────────────────────────
app.get("/api/events", authenticateToken, async (req, res) => {
  try {
    const { date, memberId, month, year } = req.query;
    let q = "SELECT * FROM events WHERE 1=1";
    const params = {};

    if (date) { q += " AND event_date = @date"; params.date = date; }
    if (memberId && memberId !== "all") { q += " AND member_id = @memberId"; params.memberId = memberId; }
    if (month && year) {
      q += " AND event_date LIKE @monthPrefix";
      params.monthPrefix = `${year}-${String(month).padStart(2, "0")}%`;
    }

    q += " ORDER BY event_date, start_time";
    const events = await query(q, params);
    res.json({ success: true, events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/events", authenticateToken, async (req, res) => {
  try {
    const { title, description, date, startTime, endTime, memberId, category, priority, notifySound, notifyMinutes } = req.body;
    if (!title || !date || !startTime || !endTime || !memberId) {
      return res.status(400).json({ error: "title, date, startTime, endTime, memberId required" });
    }

    const id = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Check for conflicts
    const conflicts = await query(
      `SELECT * FROM events WHERE event_date = @date AND member_id = @memberId
       AND start_time < @endTime AND end_time > @startTime`,
      { date, memberId, startTime, endTime }
    );

    await run(`
      INSERT INTO events (id, title, description, event_date, start_time, end_time, member_id, category, priority, notify_sound, notify_minutes, created_by)
      VALUES (@id, @title, @desc, @date, @startTime, @endTime, @memberId, @category, @priority, @notifySound, @notifyMinutes, @createdBy)
    `, {
      id, title, desc: description || "", date, startTime, endTime, memberId,
      category: category || "personal", priority: priority || "medium",
      notifySound: notifySound || "default", notifyMinutes: notifyMinutes || 15,
      createdBy: req.user.userId,
    });

    await auditLog(req.user.userId, "event_created", { id, title, date, memberId }, req.ip);
    res.json({ success: true, id, conflicts: conflicts.length > 0 ? conflicts : undefined });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/events/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, startTime, endTime, memberId, category, priority, completed, notifySound, notifyMinutes } = req.body;

    const updates = [];
    const params = { id };

    if (title !== undefined) { updates.push("title = @title"); params.title = title; }
    if (description !== undefined) { updates.push("description = @desc"); params.desc = description; }
    if (date !== undefined) { updates.push("event_date = @date"); params.date = date; }
    if (startTime !== undefined) { updates.push("start_time = @startTime"); params.startTime = startTime; }
    if (endTime !== undefined) { updates.push("end_time = @endTime"); params.endTime = endTime; }
    if (memberId !== undefined) { updates.push("member_id = @memberId"); params.memberId = memberId; }
    if (category !== undefined) { updates.push("category = @category"); params.category = category; }
    if (priority !== undefined) { updates.push("priority = @priority"); params.priority = priority; }
    if (completed !== undefined) { updates.push("completed = @completed"); params.completed = completed ? 1 : 0; }
    if (notifySound !== undefined) { updates.push("notify_sound = @notifySound"); params.notifySound = notifySound; }
    if (notifyMinutes !== undefined) { updates.push("notify_minutes = @notifyMinutes"); params.notifyMinutes = notifyMinutes; }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    updates.push("updated_at = GETDATE()");
    await run(`UPDATE events SET ${updates.join(", ")} WHERE id = @id`, params);

    await auditLog(req.user.userId, "event_updated", { id, fields: Object.keys(params) }, req.ip);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/events/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await run("DELETE FROM events WHERE id = @id", { id });
    await auditLog(req.user.userId, "event_deleted", { id }, req.ip);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle complete
app.post("/api/events/:id/toggle", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await run("UPDATE events SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END, updated_at = GETDATE() WHERE id = @id", { id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get events for a date range (calendar view)
app.get("/api/events/calendar/:year/:month", authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const events = await query(
      "SELECT id, title, event_date, start_time, end_time, member_id, category, priority, completed FROM events WHERE event_date LIKE @prefix ORDER BY event_date, start_time",
      { prefix: prefix + "%" }
    );
    res.json({ success: true, events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DAILY SUMMARY ─────────────────────────────
// Get today's events for all members (overview) + per member
app.get("/api/events/daily-summary", authenticateToken, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const allEvents = await query(
      `SELECT e.*, u.name as member_name, u.emoji as member_emoji, u.color as member_color
       FROM events e LEFT JOIN users u ON e.member_id = u.id
       WHERE e.event_date = @date ORDER BY e.start_time`,
      { date }
    );

    // Group by member
    const byMember = {};
    for (const evt of allEvents) {
      const mid = evt.member_id;
      if (!byMember[mid]) {
        byMember[mid] = { id: mid, name: evt.member_name, emoji: evt.member_emoji, color: evt.member_color, events: [] };
      }
      byMember[mid].events.push(evt);
    }

    res.json({ success: true, date, total: allEvents.length, allEvents, byMember: Object.values(byMember) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get upcoming reminders (events in next N minutes)
app.get("/api/events/reminders", authenticateToken, async (req, res) => {
  try {
    const minutesAhead = parseInt(req.query.minutes) || 15;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    // Calculate time window
    const futureDate = new Date(now.getTime() + minutesAhead * 60000);
    const futureTime = `${String(futureDate.getHours()).padStart(2,"0")}:${String(futureDate.getMinutes()).padStart(2,"0")}`;

    const upcoming = await query(
      `SELECT e.*, u.name as member_name, u.emoji as member_emoji
       FROM events e LEFT JOIN users u ON e.member_id = u.id
       WHERE e.event_date = @today AND e.start_time > @nowTime AND e.start_time <= @futureTime AND e.completed = 0
       ORDER BY e.start_time`,
      { today, nowTime, futureTime }
    );

    res.json({ success: true, reminders: upcoming, checkedAt: now.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AUDIT LOG API ─────────────────────────────
app.get("/api/audit-log", authenticateToken, async (req, res) => {
  try {
    const { userId, action, limit } = req.query;
    let q = `SELECT a.*, u.name as user_name, u.emoji as user_emoji 
             FROM audit_log a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1`;
    const params = {};

    if (userId) { q += " AND a.user_id = @userId"; params.userId = userId; }
    if (action) { q += " AND a.action LIKE @action"; params.action = `%${action}%`; }

    q += ` ORDER BY a.created_at DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
    params.limit = parseInt(limit) || 50;

    const logs = await query(q, params);
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SERVE WEB FRONTEND ────────────────────────
const distPath = path.join(__dirname, "..", "web", "dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distPath, "index.html"));
});

// ─── START SERVER ──────────────────────────────
async function start() {
  // Check if configured
  if (!DB_CONFIG.server || !DB_CONFIG.user || !DB_CONFIG.password) {
    console.log("=".repeat(55));
    console.log("  📅 Sugana Calendar — First Time Setup Required");
    console.log("=".repeat(55));
    console.log("\n  No Azure SQL configuration found.");
    console.log("  Run this first:\n");
    console.log("    node setup.js\n");
    console.log("  This will ask for your Azure SQL details and create config.json");
    console.log("=".repeat(55));
    process.exit(1);
  }

  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log("=".repeat(55));
      console.log("  📅 Sugana Calendar — Secure Server");
      console.log(`  🌐 http://localhost:${PORT}`);
      console.log(`  🗄️ Azure SQL: ${DB_CONFIG.server}`);
      console.log("  🔒 TOTP + JWT Authentication");
      console.log("=".repeat(55));
    });
  } catch (e) {
    console.error("❌ Failed to start:", e.message);
    console.error("   Check your Azure SQL configuration in config.json");
    process.exit(1);
  }
}

start();
