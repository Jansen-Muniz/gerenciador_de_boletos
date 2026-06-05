const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db", (erro) => {
  if (erro) {
    console.error("Erro ao conectar banco:", erro.message);
  } else {
    console.log("Banco SQLite conectado 😄");
  }
});

db.serialize(() => {

  // Cria a tabela de boletos já com a coluna de controle de notificação
  db.run(`
    CREATE TABLE IF NOT EXISTS boletos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      valor REAL NOT NULL,
      vencimento TEXT NOT NULL,
      pago INTEGER NOT NULL,
      usuario TEXT,
      notificacao_enviada INTEGER DEFAULT 0 -- 👈 Garante o controle do WhatsApp
    )
  `);

  // Cria a tabela de usuários já com a coluna de telefone
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE,
      senha TEXT,
      telefone TEXT -- 👈 Garante o campo para o número de teste
    )
  `);

});

module.exports = db;
