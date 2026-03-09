/**
 * Sugana Calendar — Interactive Setup
 * ====================================
 * Run this once on a new server to configure Azure SQL connection.
 * Creates config.json with your Azure credentials.
 *
 * Usage: node setup.js
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const CONFIG_FILE = path.join(__dirname, "config.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultVal = "") {
  return new Promise((resolve) => {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("=".repeat(55));
  console.log("  📅 Sugana Calendar — Setup Wizard");
  console.log("=".repeat(55));

  // Check existing config
  if (fs.existsSync(CONFIG_FILE)) {
    const existing = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    console.log(`\n  Existing config found: ${existing.dbServer}`);
    const overwrite = await ask("  Overwrite? (y/N)", "N");
    if (overwrite.toUpperCase() !== "Y") {
      console.log("  Keeping existing config. Exiting.");
      rl.close();
      return;
    }
  }

  console.log("\n─── Azure SQL Database ───────────────────────");
  console.log("  You need an Azure SQL Server + Database.");
  console.log("  Create one at: https://portal.azure.com\n");

  const dbServer = await ask("  Azure SQL Server (e.g. myserver.database.windows.net)");
  if (!dbServer) {
    console.log("  ❌ Server is required. Exiting.");
    rl.close();
    return;
  }

  const dbName = await ask("  Database name", "sugana-calendar");
  const dbUser = await ask("  DB Username (e.g. sqladmin)");
  if (!dbUser) {
    console.log("  ❌ Username is required. Exiting.");
    rl.close();
    return;
  }

  const dbPassword = await askPassword("  DB Password");
  if (!dbPassword) {
    console.log("  ❌ Password is required. Exiting.");
    rl.close();
    return;
  }

  console.log("\n─── App Settings ─────────────────────────────");
  const port = await ask("  Server port", "3002");
  const jwtSecret = await ask("  JWT secret (press Enter for auto-generated)", "");

  const config = {
    dbServer: dbServer.includes(".database.windows.net") ? dbServer : `${dbServer}.database.windows.net`,
    dbName,
    dbUser,
    dbPassword,
    port: parseInt(port) || 3002,
    jwtSecret: jwtSecret || `SC_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
    createdAt: new Date().toISOString(),
  };

  // Test connection
  console.log("\n⏳ Testing Azure SQL connection...");
  try {
    const sql = require("mssql");
    const pool = await sql.connect({
      server: config.dbServer,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      options: { encrypt: true, trustServerCertificate: false, connectTimeout: 15000 },
    });
    const result = await pool.request().query("SELECT 1 as test");
    await pool.close();
    console.log("  ✅ Azure SQL connection successful!\n");
  } catch (e) {
    console.log(`  ❌ Connection failed: ${e.message}`);
    console.log("  Check your server name, credentials, and Azure firewall rules.");
    const proceed = await ask("  Save config anyway? (y/N)", "N");
    if (proceed.toUpperCase() !== "Y") {
      rl.close();
      return;
    }
  }

  // Save config
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`✅ Config saved to: ${CONFIG_FILE}`);

  console.log("\n─── Next Steps ───────────────────────────────");
  console.log("  1. Start the server:  node server.js");
  console.log("  2. Open browser:      http://localhost:" + config.port);
  console.log("  3. On first run, default users are seeded");
  console.log("     Set DEFAULT_PASSWORD env var or defaultPassword in config.json");
  console.log("  4. Scan QR code with Google/Microsoft Authenticator (localhost only)");
  console.log("  5. Change your password after first login!");
  console.log("=".repeat(55));

  rl.close();
}

main();
