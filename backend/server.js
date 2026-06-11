require("dotenv").config();
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

    console.log("✅ Tabelas criadas/verificadas");

  } catch (erro) {

    console.error("Erro ao criar tabelas:", erro);

  }

}

// ==========================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO WHATSAPP
// ==========================================

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.RENDER ? '/usr/bin/google-chrome' : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
});

// Variável global para guardar o último código gerado
let ultimoQrCode = null;

client.on("qr", (qr) => {
  ultimoQrCode = qr; // Salva o texto do QR Code aqui para a rota usar
  qrcode.generate(qr, { small: true });
  console.log("👉 QR Code gerado no terminal.");
});

client.on("ready", () => {
  ultimoQrCode = null; // Limpa o código quando conectar

  console.log("✅ Conexão com o WhatsApp estabelecida com sucesso!");
  console.log("🎉 READY DISPAROU!");
});

client.on("authenticated", () => {
  console.log("🔐 WhatsApp autenticado");
});

client.on("auth_failure", (msg) => {
  console.log("❌ Falha na autenticação:", msg);
});

client.on("disconnected", (reason) => {
  console.log("🔌 WhatsApp desconectado:", reason);
});

client.on("loading_screen", (percent, message) => {
  console.log(`📱 Loading: ${percent}% - ${message}`);
});

client.on("change_state", (state) => {
  console.log(`🔄 Estado: ${state}`);
});

console.log("🚀 Inicializando cliente WhatsApp");

client.initialize();

/*
setInterval(async () => {
  try {
    const state = await client.getState();
    console.log("📱 Estado atual:", state);
  } catch (err) {
    console.log("❌ Erro ao obter estado:", err.message);
  }
}, 15000);

setTimeout(() => {
  console.log("🧪 Executando teste manual...");
  verificarEEnviarNotificacoes();
}, 10000);
*/


console.log("✅ Cliente WhatsApp criado");

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

(async () => {

  await criarTabelas();

  await criarAdminSeNaoExistir();

})();

// ==========================================
// 3. MIDDLEWARES E CONFIGURAÇÕES EXPRESS
// ==========================================
app.use(express.json());
app.use(cors());

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

            await client.sendMessage(
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log("⏳ Aguardando 5 segundos para rodar um teste automático de notificações...");

  // 🔄 Executa a checagem automaticamente 5 segundos após o servidor ligar
  /*
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
*/
});
