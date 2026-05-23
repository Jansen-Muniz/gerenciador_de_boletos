const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./boletos.db", (erro) => {

  if (erro) {
    console.error("Erro ao conectar banco:", erro.message);
  } else {
    console.log("Banco SQLite conectado 😄");
  }

});

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS boletos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      valor REAL NOT NULL,
      vencimento TEXT NOT NULL,
      pago INTEGER NOT NULL
    )
  `);

});

module.exports = db;