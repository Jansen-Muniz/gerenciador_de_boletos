const cors = require("cors");
const express = require("express");
const app = express();
const db = require("./database");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const cron = require("node-cron"); // 👈 Adicionado para agendamento
const { Client, LocalAuth } = require("whatsapp-web.js"); // 👈 Adicionado para WhatsApp
const qrcode = require("qrcode-terminal"); // 👈 Adicionado para ver o QR Code
const SQLiteStore = require("connect-sqlite3")(session)


// ==========================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO WHATSAPP
// ==========================================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_CACHE_DIR ? '/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome' : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("👉 Escaneie o QR Code acima com o seu WhatsApp de testes.");
});

client.on("ready", () => {
  console.log("✅ Conexão com o WhatsApp estabelecida com sucesso!");
});

client.initialize();

function criarAdminSeNaoExistir() {
  const senhaHash = bcrypt.hashSync("123456", 10);

  // Como o SQLite não aceita INSERT OR IGNORE com colunas novas se a tabela falhar,
  // vamos verificar primeiro se o admin já existe
  db.get("SELECT * FROM usuarios WHERE usuario = ?", ["admin"], (err, row) => {
    if (!row) {
      db.run(`
        INSERT INTO usuarios (usuario, senha, telefone)
        VALUES (?, ?, ?)
      `, ["admin", senhaHash, "558988039351"]); // 👈 LEMBRE DE MANDAR SEU NÚMERO REAL AQUI
      console.log("👤 Usuário admin criado com sucesso.");
    }
  });
}

criarAdminSeNaoExistir();

// ==========================================
// 3. MIDDLEWARES E CONFIGURAÇÕES EXPRESS
// ==========================================
app.use(express.json());
app.use(cors());

app.use(session({
  store: new SQLiteStore({
    db: "database.db",
    dir: "./"
  }),
  secret: "segredo_super_seguro",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
}));


app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;

function verificarLogin(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }
  next();
}

// ==========================================
// 4. ROTAS DO SISTEMA
// ==========================================

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!user) return res.status(401).json({ erro: "Usuário não encontrado" });

    const senhaOk = bcrypt.compareSync(senha, user.senha);
    if (!senhaOk) return res.status(401).json({ erro: "Senha inválida" });

    req.session.usuario = user.usuario;

    res.json({ mensagem: "Login realizado 😄", usuario: user.usuario });
  });
});

app.post("/usuarios", (req, res) => {
  const { usuario, senha, telefone } = req.body; // 👈 Recebe o telefone no cadastro
  if (!usuario || !senha || usuario.trim() === "") {
    return res.status(400).json({ erro: "Preencha os campos corretamente." });
  }

  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (user) return res.status(400).json({ erro: "Este nome de usuário já está em uso." });

    const senhaHash = bcrypt.hashSync(senha, 10);
    db.run(
      "INSERT INTO usuarios (usuario, senha, telefone) VALUES (?, ?, ?)",
      [usuario, senhaHash, telefone || null],
      function (erroCadastro) {
        if (erroCadastro) return res.status(500).json({ erro: erroCadastro.message });
        return res.status(201).json({ mensagem: "Usuário criado com sucesso!" });
      }
    );
  });
});

// ==========================================
// 👑 ROTAS EXCLUSIVAS DE ADMINISTRAÇÃO
// ==========================================

// 1. Rota para o admin listar os usuários do sistema
app.get("/admin/usuarios", verificarLogin, (req, res) => {
  if (req.session.usuario !== "admin") {
    return res.status(403).json({ erro: "Acesso negado. Apenas para administradores." });
  }

  db.all("SELECT id, usuario, telefone FROM usuarios", [], (erro, rows) => {
    if (erro) return res.status(500).json({ erro: erro.message });
    res.json(rows);
  });
});

// 2. Rota para o admin ver todos os boletos de todos os usuários
app.get("/admin/dashboard", verificarLogin, (req, res) => {
  if (req.session.usuario !== "admin") {
    return res.status(403).json({ erro: "Acesso negado. Apenas para administradores." });
  }

  const sql = `
    SELECT boletos.*, usuarios.telefone 
    FROM boletos 
    INNER JOIN usuarios ON boletos.usuario = usuarios.usuario
  `;

  db.all(sql, [], (erro, rows) => {
    if (erro) return res.status(500).json({ erro: erro.message });
    res.json(rows);
  });
});

app.get("/boletos", verificarLogin, (req, res) => {
  const usuarioLogado = req.session.usuario;
  db.all("SELECT * FROM boletos WHERE usuario = ?", [usuarioLogado], (erro, rows) => {
    if (erro) return res.status(500).json({ erro: erro.message });
    res.json(rows);
  });
});

app.post("/boletos", verificarLogin, (req, res) => {
  const { nome, valor, vencimento, pago } = req.body;
  const usuarioLogado = req.session.usuario;

  const sql = `
    INSERT INTO boletos (nome, valor, vencimento, pago, usuario, notificacao_enviada)
    VALUES (?, ?, ?, ?, ?, 0)
  `;

  db.run(sql, [nome, valor, vencimento, pago ? 1 : 0, usuarioLogado], function (erro) {
    if (erro) return res.status(500).json({ erro: erro.message });
    res.status(201).json({ id: this.lastID, nome, valor, vencimento, pago });
  });
});

app.put("/boletos/:id", verificarLogin, (req, res) => {
  const { id } = req.params;
  const { nome, valor, vencimento, pago } = req.body;
  const usuarioLogado = req.session.usuario;

  // Se o boleto foi marcado como PAGO (1), não precisa mais notificar.
  // Se foi marcado como NÃO PAGO (0), resetamos para 0 para permitir novos avisos caso mude de ideia.
  const notificacaoStatus = pago ? 1 : 0;

  db.run(
    `UPDATE boletos 
     SET nome = ?, valor = ?, vencimento = ?, pago = ?, notificacao_enviada = ? 
     WHERE id = ? AND usuario = ?`,
    [
      nome,
      valor,
      vencimento,
      pago ? 1 : 0,
      notificacaoStatus,
      id,
      usuarioLogado
    ],
    function (erro) {
      if (erro) {
        return res.status(500).json({ erro: erro.message });
      }
      res.json({ mensagem: "Atualizado com sucesso 😄" });
    }
  );
});


app.delete("/boletos/:id", verificarLogin, (req, res) => {
  const { id } = req.params;
  const usuarioLogado = req.session.usuario;

  db.run("DELETE FROM boletos WHERE id = ? AND usuario = ?", [id, usuarioLogado], function (erro) {
    if (erro) return res.status(500).json({ erro: erro.message });
    res.json({ mensagem: "Boleto excluído 😄" });
  });
});

app.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((erro) => {
      if (erro) return res.status(500).json({ erro: "Erro ao encerrar a sessão" });
      res.clearCookie("connect.sid", { path: "/" });
      return res.json({ mensagem: "Logout realizado com sucesso! 😄" });
    });
  } else {
    res.json({ mensagem: "Nenhuma sessão ativa" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// ==========================================
// 5. AUTOMAÇÃO DE ENVIO (CRON JOB)
// ==========================================
// Executa todos os dias às 08:00 da manhã (Garante fuso local se o servidor estiver em UTC)
cron.schedule("0 8 * * *", () => {
  verificarEEnviarNotificacoes();
});

// Função que faz a busca de datas e dispara as mensagens
function verificarEEnviarNotificacoes() {
  console.log("⏰ Iniciando checagem diária de boletos para o WhatsApp...");

  const query = `
    SELECT boletos.id, boletos.nome, boletos.valor, boletos.vencimento, usuarios.telefone 
    FROM boletos 
    INNER JOIN usuarios ON boletos.usuario = usuarios.usuario
    WHERE boletos.pago = 0 AND boletos.notificacao_enviada = 0 AND usuarios.telefone IS NOT NULL
  `;

  db.all(query, [], async (erro, rows) => {
    if (erro) {
      console.error("❌ Erro ao buscar boletos para notificação:", erro.message);
      return;
    }

    console.log(`📊 O banco retornou ${rows.length} boleto(s) pendente(s) com telefone cadastrado.`);

    // 🕒 FORMATO UNIVERSAL SEGURO (Garante YYYY-MM-DD puro baseado no fuso do Brasil)
    const agoraBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

    const hoje = agoraBR.toISOString().split('T')[0];

    const amanhaBR = new Date(agoraBR);
    amanhaBR.setDate(amanhaBR.getDate() + 1);
    const amanha = amanhaBR.toISOString().split('T')[0];

    console.log(`📅 Datas de checagem -> Hoje: "${hoje}" | Amanhã: "${amanha}"`);

    for (const boleto of rows) {
      // Remove espaços extras invisíveis das strings para evitar erros de comparação
      const vencimentoBoleto = boleto.vencimento.trim();

      console.log(`🔹 Comparando boleto: "${boleto.nome}" | Vencimento no Banco: "${vencimentoBoleto}"`);

      if (vencimentoBoleto === hoje || vencimentoBoleto === amanha) {
        const momento = vencimentoBoleto === hoje ? "VENCE HOJE" : "VENCE AMANHÃ";

        const valorFormatado = Number(boleto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const dataFormatada = vencimentoBoleto.split("-").reverse().join("/");

        const mensagem = `⚠️ *Lembrete de Boleto* ⚠️\n\nOlá! O boleto *${boleto.nome}* no valor de *R$ ${valorFormatado}* ${momento} (${dataFormatada}).\n\nPor favor, efetue o pagamento para evitar juros!`;

        try {
          let numeroLimpo = boleto.telefone.replace(/\D/g, "");

          if (!numeroLimpo.startsWith("55") && numeroLimpo.length >= 10) {
            numeroLimpo = "55" + numeroLimpo;
          }

          console.log(`🔍 Pesquisando número no WhatsApp: ${numeroLimpo}`);
          let idCadastrado = await client.getNumberId(numeroLimpo);

          if (!idCadastrado && numeroLimpo.length === 13) {
            const ddiEDdd = numeroLimpo.substring(0, 4);
            const restoDoNumero = numeroLimpo.substring(5);
            const numeroSemNono = ddiEDdd + restoDoNumero;

            console.log(`⚠️ Falhou com o 9. Tentando sem o 9º dígito: ${numeroSemNono}`);
            idCadastrado = await client.getNumberId(numeroSemNono);
          }

          if (idCadastrado) {
            await client.sendMessage(idCadastrado._serialized, mensagem);

            db.run("UPDATE boletos SET notificacao_enviada = 1 WHERE id = ?", [boleto.id]);
            console.log(`📨 ✅ Notificação enviada com sucesso para ${boleto.telefone}`);
          } else {
            console.error(`❌ O número ${boleto.telefone} não pôde ser validado no WhatsApp.`);
          }
        } catch (whatsappError) {
          console.error(`❌ Erro interno ao processar o envio para ${boleto.telefone}:`, whatsappError);
        }
      } else {
        console.log(`⏭️ Boleto "${boleto.nome}" pulado porque a data "${vencimentoBoleto}" não é igual a hoje ou amanhã.`);
      }
    }
    console.log("🏁 Fim da rotina de checagem.");
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log("⏳ Aguardando 5 segundos para rodar um teste automático de notificações...");

  // 🔄 Executa a checagem automaticamente 5 segundos após o servidor ligar
  setTimeout(() => {
    if (client.info) {
      console.log("🎯 WhatsApp está pronto! Iniciando varredura de teste...");
      verificarEEnviarNotificacoes();
    } else {
      console.log("⚠️ WhatsApp ainda não conectou. O teste automático rodará assim que o QR Code for escaneado.");

      // Fallback: Se o WhatsApp demorar a conectar, espera o evento 'ready'
      client.once("ready", () => {
        console.log("🎯 Conectado agora! Iniciando varredura de teste atrasada...");
        verificarEEnviarNotificacoes();
      });
    }
  }, 5000);
});
