const cors = require("cors");
const express = require("express");
const app = express();
const db = require("./database");
const path = require("path");
const session = require("express-session"); // Movido para cima
const bcrypt = require("bcrypt");           // Movido para cima

function criarAdminSeNaoExistir() {
  const bcrypt = require("bcrypt");
  const senhaHash = bcrypt.hashSync("123456", 10);
  db.run(`
    INSERT OR IGNORE INTO usuarios (usuario, senha)
    VALUES (?, ?)
  `, ["admin", senhaHash]);
}
criarAdminSeNaoExistir();

// 1º Habilita a leitura de JSON
app.use(express.json());

// 2º ATIVA A SESSÃO (DEVE VIR ANTES DOS ESTÁTICOS E ROTAS)
app.use(session({
  secret: "segredo_super_seguro",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Mantém false para localhost
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// 3º Serve as páginas do frontend
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = 3000;
// ... restante do seu código (rotas /login, /boletos, etc.) continua igual ...

let boletos = [

];

function verificarLogin(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }
  next();
}

app.post("/login", (req, res) => {

  console.log("bateu na rota login");

  const { usuario, senha } = req.body;

  console.log("usuario:", usuario);

  db.get(
    "SELECT * FROM usuarios WHERE usuario = ?",
    [usuario],
    (err, user) => {

      console.log("resultado banco:", user);

      if (err) {

        console.log("erro banco");

        return res.status(500).json({
          erro: err.message
        });

      }

      if (!user) {

        console.log("usuario nao encontrado");

        return res.status(401).json({
          erro: "Usuário não encontrado"
        });

      }

      const senhaOk = bcrypt.compareSync(senha, user.senha);

      console.log("senha ok?", senhaOk);

      if (!senhaOk) {

        console.log("senha invalida");

        return res.status(401).json({
          erro: "Senha inválida"
        });

      }

      req.session.usuario = user.usuario;

      console.log("sessao criada");
      console.log(req.session);

      res.json({
        mensagem: "Login realizado 😄"
      });

    }
  );

});

app.get("/boletos", verificarLogin, (req, res) => {

  db.all("SELECT * FROM boletos", [], (erro, rows) => {

    if (erro) {
      return res.status(500).json({
        erro: erro.message
      });
    }

    res.json(rows);

  });

});

app.post("/boletos", verificarLogin, (req, res) => {

  const { nome, valor, vencimento, pago } = req.body;

  const sql = `
    INSERT INTO boletos
    (nome, valor, vencimento, pago)
    VALUES (?, ?, ?, ?)
  `;

  db.run(
    sql,
    [nome, valor, vencimento, pago ? 1 : 0],
    function (erro) {

      if (erro) {
        return res.status(500).json({
          erro: erro.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        nome,
        valor,
        vencimento,
        pago
      });

    }
  );

});

app.put("/boletos/:id", verificarLogin, (req, res) => {

  const { id } = req.params;

  const { nome, valor, vencimento, pago } = req.body;

  db.run(
    `
    UPDATE boletos
    SET nome = ?, valor = ?, vencimento = ?, pago = ?
    WHERE id = ?
    `,
    [
      nome,
      valor,
      vencimento,
      pago ? 1 : 0,
      id
    ],
    function (erro) {

      if (erro) {
        return res.status(500).json({
          erro: erro.message
        });
      }

      res.json({
        mensagem: "Atualizado com sucesso 😄"
      });

    }
  );

});

app.delete("/boletos/:id", verificarLogin, (req, res) => {

  const { id } = req.params;

  db.run(
    "DELETE FROM boletos WHERE id = ?",
    [id],
    function (erro) {

      if (erro) {
        return res.status(500).json({
          erro: erro.message
        });
      }

      res.json({
        mensagem: "Boleto excluído 😄"
      });

    }
  );

});

app.post("/logout", (req, res) => {
  if (req.session) {
    // Destrói a sessão no servidor
    req.session.destroy((erro) => {
      if (erro) {
        return res.status(500).json({ erro: "Erro ao encerrar a sessão" });
      }
      // Limpa o cookie no navegador do usuário
      res.clearCookie("connect.sid");
      return res.json({ mensagem: "Logout realizado com sucesso! 😄" });
    });
  } else {
    res.json({ mensagem: "Nenhuma sessão ativa" });
  }
});


app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "../frontend/login.html")
  );

});

app.listen(PORT, () => {

  console.log(`Servidor rodando em http://localhost:${PORT}`);

});