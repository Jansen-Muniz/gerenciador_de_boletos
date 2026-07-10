require("dotenv").config();
const PORT = process.env.PORT || 3000;
const express = require("express");
const app = express();
const db = require("./database");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const cron = require("node-cron"); // 👈 Adicionado para agendamento
const { Client, LocalAuth } = require("whatsapp-web.js"); // 👈 Adicionado para WhatsApp
const PgStore = require("connect-pg-simple")(session);

async function criarTabelas() {

  try {

    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        telefone VARCHAR(20)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS boletos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        valor NUMERIC(10,2) NOT NULL,
        vencimento DATE NOT NULL,
        pago INTEGER NOT NULL DEFAULT 0,
        usuario VARCHAR(100),
        notificacao_enviada INTEGER DEFAULT 0
      )
    `);

    // Índices para melhorar as consultas
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_boletos_usuario
      ON boletos(usuario)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_boletos_vencimento
      ON boletos(vencimento)
    `);

    console.log("✅ Tabelas e índices criados/verificados");

  } catch (erro) {

    console.error("❌ Erro ao criar tabelas:", erro);

  }

}

// ==========================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO WHATSAPP
// ==========================================

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "gerenciador-boletos"
  }),
  puppeteer: {
    headless: process.env.RENDER ? "new" : true,

    executablePath: process.env.RENDER
      ? "/usr/bin/google-chrome"
      : undefined,

    args: [

      "--no-sandbox",
      "--disable-setuid-sandbox",

      "--disable-dev-shm-usage",

      "--disable-gpu",

      "--disable-extensions",

      "--disable-sync",

      "--disable-background-networking",

      "--disable-default-apps",

      "--mute-audio",

      "--no-first-run",

      "--no-default-browser-check",

      "--disable-features=Translate",

      "--js-flags=--max-old-space-size=128"

    ]
  }
});

let whatsappReady = false;
let whatsappState = "STARTING";

// Variável global para guardar o último código gerado
let ultimoQrCode = null;

client.on("qr", (qr) => {

  ultimoQrCode = qr;

  whatsappState = "QR_CODE";

  console.log("👉 QR Code gerado.");

});

client.on("authenticated", () => {

  whatsappState = "AUTHENTICATED";

  console.log("🔐 WhatsApp autenticado");

});

client.on("ready", () => {

  whatsappReady = true;
  whatsappState = "CONNECTED";
  ultimoQrCode = null;

  console.log("✅ WhatsApp pronto!");

});

client.on("change_state", (state) => {

  whatsappState = state;

  console.log("🔄 Novo estado:", state);

});

client.on("disconnected", (reason) => {

  whatsappReady = false;
  whatsappState = "DISCONNECTED";

  console.log("🔌 WhatsApp desconectado");
  console.log(reason);

});

client.on("auth_failure", (msg) => {

  whatsappReady = false;
  whatsappState = "AUTH_FAILURE";

  console.log(msg);

});

/*
client.on("authenticated", async () => {
  console.log("🔐 WhatsApp autenticado");

  try {
    const state = await client.getState();
    console.log("📱 Estado após autenticação:", state);
  } catch (e) {
    console.log("❌ Erro ao obter estado:", e);
  }
});

client.on("ready", async () => {

  console.log("✅ Conexão com o WhatsApp estabelecida com sucesso!");

  try {

    const state = await client.getState();

    console.log("📱 Estado READY:", state);

  } catch (e) {

    console.log("❌ Erro ao obter estado:", e);

  }

});

client.on("change_state", (state) => {
  console.log("🔄 Novo estado:", state);
});

client.on("disconnected", (reason) => {
  console.log("🔌 WhatsApp desconectado:");
  console.log("🔌 Motivo:", reason);
});

client.on("auth_failure", (msg) => {
  console.log("❌ AUTH FAILURE:");
  console.log(msg);
});

client.on("loading_screen", (percent, message) => {
  console.log(`📱 Loading: ${percent}% - ${message}`);
});
*/

client.on("loading_screen", (percent, message) => {

  whatsappState = `LOADING ${percent}%`;

  if (percent === 100) {
    ultimoQrCode = null;
  }

  console.log(`📱 ${percent}% - ${message}`);

});

client.on("remote_session_saved", () => {

  whatsappState = "SESSION_SAVED";

  console.log("💾 Sessão salva");

});

function log(tipo, mensagem) {

  console.log(
    `[${new Date().toLocaleTimeString("pt-BR")}] ${tipo} ${mensagem}`
  );

}

log("INFO", "Servidor iniciado");

/*
process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:");
  console.error(err);
});

process.on("unhandledRejection", (err) => {
  console.error("💥 UNHANDLED REJECTION:");
  console.error(err);
});

const START = Date.now();

console.log(`🚀 Processo iniciado: ${START}`);

setInterval(async () => {

  console.log("\n========== MONITOR ==========");

  const mem = process.memoryUsage();

  console.log(`🧠 RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`);
  console.log(`🧠 HeapUsed: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
  console.log(`🆔 Processo: ${START}`);

  try {

    const state = await client.getState();

    console.log(`📡 Estado: ${state}`);

  } catch (e) {

    console.log("📡 Estado: indisponível");

  }

  console.log("=============================\n");

}, 60000);

*/

async function criarAdminSeNaoExistir() {

  try {

    const senhaHash = bcrypt.hashSync("123456", 10);

    const resultado = await db.query(
      "SELECT * FROM usuarios WHERE usuario = $1",
      ["admin"]
    );

    if (resultado.rows.length === 0) {

      await db.query(
        `
        INSERT INTO usuarios (usuario, senha, telefone)
        VALUES ($1, $2, $3)
        `,
        ["admin", senhaHash, "558988039351"]
      );

      console.log("👤 Usuário admin criado com sucesso.");

    }

  } catch (erro) {

    console.error("Erro ao criar admin:", erro);

  }

}

async function iniciarSistema() {

  await criarTabelas();

  await criarAdminSeNaoExistir();

  app.listen(PORT, async () => {

    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);

    console.log("⏳ Inicializando WhatsApp...");

    try {

      await client.initialize();

      console.log("✅ Cliente WhatsApp inicializado");

    } catch (erro) {

      console.error("❌ Erro ao inicializar o WhatsApp:");
      console.error(erro);

    }

  });

}
const START = Date.now();

setInterval(() => {

  console.log("\n================ MONITOR ================");

  const mem = process.memoryUsage();

  console.log(`🆔 PID............. ${process.pid}`);

  console.log(`⏱ Uptime......... ${Math.floor(process.uptime())} s`);

  console.log(`🧠 RSS............ ${Math.round(mem.rss / 1024 / 1024)} MB`);

  console.log(`🧠 Heap........... ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);

  console.log(`📱 WhatsApp....... ${whatsappState}`);

  console.log(`✅ Ready.......... ${whatsappReady}`);

  console.log("=========================================\n");

}, 60000);

async function enviarMensagem(numero, mensagem) {

  if (!whatsappReady) {
    throw new Error("WhatsApp indisponível.");
  }

  return await client.sendMessage(numero, mensagem);

}

iniciarSistema();

// ==========================================
// 3. MIDDLEWARES E CONFIGURAÇÕES EXPRESS
// ==========================================
app.use(express.json());

app.use(session({
  store: new PgStore({
    pool: db,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
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

function verificarLogin(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }
  next();
}

// ==========================================
// 4. ROTAS DO SISTEMA
// ==========================================

app.post("/login", async (req, res) => {

  try {

    const { usuario, senha } = req.body;

    const resultado = await db.query(
      "SELECT * FROM usuarios WHERE usuario = $1",
      [usuario]
    );

    if (resultado.rows.length === 0) {

      return res.status(401).json({
        erro: "Usuário não encontrado"
      });

    }

    const user = resultado.rows[0];

    const senhaOk = bcrypt.compareSync(
      senha,
      user.senha
    );

    if (!senhaOk) {

      return res.status(401).json({
        erro: "Senha inválida"
      });

    }

    req.session.usuario = user.usuario;

    res.json({
      mensagem: "Login realizado 😄",
      usuario: user.usuario
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.post("/usuarios", async (req, res) => {

  try {

    const { usuario, senha, telefone } = req.body;

    if (!usuario || !senha || usuario.trim() === "") {
      return res.status(400).json({
        erro: "Preencha os campos corretamente."
      });
    }

    const usuarioExistente = await db.query(
      "SELECT * FROM usuarios WHERE usuario = $1",
      [usuario]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({
        erro: "Este nome de usuário já está em uso."
      });
    }

    const senhaHash = bcrypt.hashSync(senha, 10);

    await db.query(
      `
      INSERT INTO usuarios
      (usuario, senha, telefone)
      VALUES ($1, $2, $3)
      `,
      [
        usuario,
        senhaHash,
        telefone || null
      ]
    );

    res.status(201).json({
      mensagem: "Usuário criado com sucesso!"
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================================
// 👑 ROTAS EXCLUSIVAS DE ADMINISTRAÇÃO
// ==========================================

// 1. Rota para o admin listar os usuários do sistema
app.get("/admin/usuarios", verificarLogin, async (req, res) => {

  try {

    if (req.session.usuario !== "admin") {
      return res.status(403).json({
        erro: "Acesso negado. Apenas para administradores."
      });
    }

    const resultado = await db.query(
      "SELECT id, usuario, telefone FROM usuarios ORDER BY id"
    );

    res.json(resultado.rows);

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});
// 2. Rota para o admin ver todos os boletos de todos os usuários
app.get("/admin/dashboard", verificarLogin, async (req, res) => {

  try {

    if (req.session.usuario !== "admin") {
      return res.status(403).json({
        erro: "Acesso negado. Apenas para administradores."
      });
    }

    const resultado = await db.query(`
      SELECT boletos.*, usuarios.telefone
      FROM boletos
      INNER JOIN usuarios
      ON boletos.usuario = usuarios.usuario
    `);

    res.json(resultado.rows);

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ROTA PARA EXIBIR O QR CODE NA TELA DO NAVEGADOR
const QRCodeDisplay = require("qrcode");
app.get("/admin/qrcode", verificarLogin, (req, res) => {
  if (req.session.usuario !== "admin") {
    return res.status(403).send("Acesso negado.");
  }

  if (!ultimoQrCode) {
    return res.send("<h1>🎉 WhatsApp já está conectado ou o código ainda não foi gerado!</h1>");
  }

  QRCodeDisplay.toDataURL(ultimoQrCode, (err, url) => {
    if (err) return res.status(500).send("Erro ao gerar imagem do QR Code");
    res.send(`
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2>📲 Escaneie o QR Code para ativar o Gerenciador de Boletos</h2>
        <img src="${url}" style="width: 300px; border: 1px solid #ccc; padding: 10px; border-radius: 8px;" />
        <p>Após escanear, atualize esta página para ver o status.</p>
      </div>
    `);
  });
});

app.get("/admin/whatsapp-status", async (req, res) => {

  res.json({

    conectado: whatsappReady,

    estado: whatsappState,

    temQrCode: !!ultimoQrCode

  });

  /*
  try {
 
    const state = await client.getState();
 
    console.log("📊 STATUS CONSULTADO:", state);
 
    res.json({
      conectado: state === "CONNECTED",
      estado: state,
      temQrCode: !!ultimoQrCode
    });
 
  } catch (err) {
 
    console.log("❌ Erro getState:", err);
 
    res.json({
      conectado: false,
      estado: "ERRO",
      temQrCode: !!ultimoQrCode
    });
 
  }
  */

});

app.get("/boletos", verificarLogin, async (req, res) => {

  try {

    const resultado = await db.query(
      "SELECT * FROM boletos ORDER BY vencimento ASC"
    );

    res.json(resultado.rows);

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

//rota temporária de teste

app.get("/teste-whatsapp", async (req, res) => {

  try {

    if (!whatsappReady) {
      return res.send("WhatsApp ainda não está pronto.");
    }

    const numero = "558988039351@c.us";

    await enviarMensagem(
      numero,
      "🚀 Teste do Gerenciador de Boletos"
    );

    res.send("Mensagem enviada!");

  } catch (erro) {

    console.error(erro);

    res.status(500).send(erro.message);

  }

});

app.post("/boletos", verificarLogin, async (req, res) => {

  try {

    const { nome, valor, vencimento, pago } = req.body;
    const usuarioLogado = req.session.usuario;

    const resultado = await db.query(
      `
      INSERT INTO boletos
      (nome, valor, vencimento, pago, usuario, notificacao_enviada)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING *
      `,
      [
        nome,
        valor,
        vencimento,
        pago ? 1 : 0,
        usuarioLogado
      ]
    );

    res.status(201).json(resultado.rows[0]);

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.put("/boletos/:id", verificarLogin, async (req, res) => {

  try {

    const { id } = req.params;
    const { nome, valor, vencimento, pago } = req.body;

    const usuarioLogado = req.session.usuario;

    const notificacaoStatus = pago ? 1 : 0;

    await db.query(
      `
      UPDATE boletos
      SET
        nome = $1,
        valor = $2,
        vencimento = $3,
        pago = $4,
        notificacao_enviada = $5
      WHERE id = $6
      AND usuario = $7
      `,
      [
        nome,
        valor,
        vencimento,
        pago ? 1 : 0,
        notificacaoStatus,
        id,
        usuarioLogado
      ]
    );

    res.json({
      mensagem: "Atualizado com sucesso 😄"
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.delete("/boletos/:id", verificarLogin, async (req, res) => {

  try {

    const { id } = req.params;
    const usuarioLogado = req.session.usuario;

    await db.query(
      `
      DELETE FROM boletos
      WHERE id = $1
      AND usuario = $2
      `,
      [id, usuarioLogado]
    );

    res.json({
      mensagem: "Boleto excluído 😄"
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

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
async function verificarEEnviarNotificacoes() {
  console.log("⏰ Iniciando checagem diária de boletos para o WhatsApp...");

  if (!whatsappReady) {

    console.log("⚠️ WhatsApp indisponível.");

    return;

  }

  /*
  try {
    const estado = await client.getState();

    if (estado !== "CONNECTED") {
      console.log(
        `⚠️ WhatsApp não está conectado. Estado atual: ${estado}`
      );
      return;
    }
  } catch (erroEstado) {
    console.log(
      `⚠️ Não foi possível verificar o estado do WhatsApp: ${erroEstado.message}`
    );
    return;
  }
  */

  const query = `
    SELECT boletos.id, boletos.nome, boletos.valor, boletos.vencimento, usuarios.telefone 
    FROM boletos 
    INNER JOIN usuarios ON boletos.usuario = usuarios.usuario
    WHERE boletos.pago = 0 AND boletos.notificacao_enviada = 0 AND usuarios.telefone IS NOT NULL
  `;

  try {

    const resultado = await db.query(query);
    const rows = resultado.rows;

    console.log(`📊 O banco retornou ${rows.length} boleto(s) pendente(s) com telefone cadastrado.`);

    // 🕒 FORMATO UNIVERSAL SEGURO (Garante YYYY-MM-DD puro baseado no fuso do Brasil)
    const agoraBR = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo"
      })
    );

    const hoje = agoraBR.toISOString().split("T")[0];

    const amanhaBR = new Date(agoraBR);
    amanhaBR.setDate(amanhaBR.getDate() + 1);

    const amanha = amanhaBR.toISOString().split("T")[0];

    console.log(`📅 Datas de checagem -> Hoje: "${hoje}" | Amanhã: "${amanha}"`);

    for (const boleto of rows) {

      // PostgreSQL retorna timestamp/date em formato diferente
      const vencimentoBoleto = new Date(boleto.vencimento)
        .toISOString()
        .split("T")[0];

      console.log(
        `🔹 Comparando boleto: "${boleto.nome}" | Vencimento no Banco: "${vencimentoBoleto}"`
      );

      if (vencimentoBoleto === hoje || vencimentoBoleto === amanha) {

        const momento =
          vencimentoBoleto === hoje
            ? "VENCE HOJE"
            : "VENCE AMANHÃ";

        const valorFormatado = Number(
          boleto.valor
        ).toLocaleString("pt-BR", {
          minimumFractionDigits: 2
        });

        const dataFormatada = vencimentoBoleto
          .split("-")
          .reverse()
          .join("/");

        const mensagem =
          `⚠️ *Lembrete de Boleto* ⚠️\n\n` +
          `Olá! O boleto *${boleto.nome}* no valor de *R$ ${valorFormatado}* ${momento} (${dataFormatada}).\n\n` +
          `Por favor, efetue o pagamento para evitar juros!`;

        try {

          if (!boleto.telefone) {
            console.log(`⚠️ Usuário sem telefone cadastrado.`);
            continue;
          }

          let numeroLimpo = boleto.telefone.replace(/\D/g, "");

          if (
            !numeroLimpo.startsWith("55") &&
            numeroLimpo.length >= 10
          ) {
            numeroLimpo = "55" + numeroLimpo;
          }

          console.log(
            `🔍 Pesquisando número no WhatsApp: ${numeroLimpo}`
          );

          console.log("📱 Tentando validar número no WhatsApp...");

          let idCadastrado =
            await client.getNumberId(numeroLimpo);

          console.log("📱 Resultado:", idCadastrado);

          if (
            !idCadastrado &&
            numeroLimpo.length === 13
          ) {

            const ddiEDdd = numeroLimpo.substring(0, 4);
            const restoDoNumero = numeroLimpo.substring(5);

            const numeroSemNono =
              ddiEDdd + restoDoNumero;

            console.log(
              `⚠️ Falhou com o 9. Tentando sem o 9º dígito: ${numeroSemNono}`
            );

            idCadastrado =
              await client.getNumberId(numeroSemNono);
          }

          if (idCadastrado) {

            await enviarMensagem(
              idCadastrado._serialized,
              mensagem
            );

            await db.query(
              `
            UPDATE boletos
            SET notificacao_enviada = 1
            WHERE id = $1
            `,
              [boleto.id]
            );

            console.log(
              `📨 ✅ Notificação enviada com sucesso para ${boleto.telefone}`
            );

          } else {

            console.error(
              `❌ O número ${boleto.telefone} não pôde ser validado no WhatsApp.`
            );

          }

        } catch (whatsappError) {

          console.error(
            `❌ Erro interno ao processar o envio para ${boleto.telefone}:`,
            whatsappError
          );

        }

      } else {

        console.log(
          `⏭️ Boleto "${boleto.nome}" pulado porque a data "${vencimentoBoleto}" não é igual a hoje ou amanhã.`
        );

      }

    }

    console.log("🏁 Fim da rotina de checagem.");

  } catch (erro) {

    console.error(
      "❌ Erro ao buscar boletos para notificação:",
      erro.message
    );

  }
}

