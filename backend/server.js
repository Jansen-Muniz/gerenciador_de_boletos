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

app.post("/usuarios", (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha || usuario.trim() === "" || senha.trim() === "") {
    return res.status(400).json({ erro: "Preencha todos os campos corretamente." });
  }

  // 1. Verifica se o usuário já existe
  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }

    if (user) {
      return res.status(400).json({ erro: "Este nome de usuário já está em uso." });
    }

    // 2. Criptografa a senha
    const senhaHash = bcrypt.hashSync(senha, 10);

    // 3. Insere no banco (Corrigido aqui!)
    db.run(
      "INSERT INTO usuarios (usuario, senha) VALUES (?, ?)",
      [usuario, senhaHash],
      function (erroCadastro) {
        if (erroCadastro) {
          return res.status(500).json({ erro: erroCadastro.message });
        }

        return res.status(201).json({ mensagem: "Usuário criado com sucesso!" });
      }
    );
  });
});

app.get("/boletos", verificarLogin, (req, res) => {
  const usuarioLogado = req.session.usuario; // 👈 Identifica quem está logado

  // 👇 Busca APENAS os boletos do usuário da sessão
  db.all("SELECT * FROM boletos WHERE usuario = ?", [usuarioLogado], (erro, rows) => {
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
  const usuarioLogado = req.session.usuario; // 👈 Pega o nome do dono do boleto

  // 👇 Incluímos o campo 'usuario' no comando SQL
  const sql = `
    INSERT INTO boletos
    (nome, valor, vencimento, pago, usuario)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [nome, valor, vencimento, pago ? 1 : 0, usuarioLogado], // 👈 Grava o usuário correspondente
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
  const usuarioLogado = req.session.usuario; // 👈 Segurança extra

  // 👇 Atualiza o boleto apenas se ele pertencer ao usuário logado (evita que um altere o do outro via ID)
  db.run(
    `
    UPDATE boletos
    SET nome = ?, valor = ?, vencimento = ?, pago = ?
    WHERE id = ? AND usuario = ?
    `,
    [
      nome,
      valor,
      vencimento,
      pago ? 1 : 0,
      id,
      usuarioLogado
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
  const usuarioLogado = req.session.usuario; // 👈 Segurança extra

  // 👇 Deleta o boleto apenas se ele pertencer ao usuário logado
  db.run(
    "DELETE FROM boletos WHERE id = ? AND usuario = ?",
    [id, usuarioLogado],
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