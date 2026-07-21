require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", (err) => {
  console.error("❌ Erro inesperado no PostgreSQL:", err);
});

module.exports = pool;