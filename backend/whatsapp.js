const makeWASocket = require("@whiskeysockets/baileys").default;

const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const path = require("path");

const AUTH_FOLDER = path.join(__dirname, "baileys_auth");

let sock = null;
let whatsappReady = false;
let whatsappState = "STARTING";
let ultimoQrCode = null;

function atualizarEstado(estado, pronto = false) {
  whatsappState = estado;
  whatsappReady = Boolean(pronto);
}

async function conectarWhatsApp() {

  const { state, saveCreds } =
    await useMultiFileAuthState(AUTH_FOLDER);

  console.log("\n====================================");
  console.log("🚀 INICIANDO BAILEYS");
  console.log("🟢 Node:", process.version);
  console.log("====================================\n");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,

    // Evita marcar o celular como online
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {

    const {
      connection,
      lastDisconnect,
      qr
    } = update;

    if (connection) {
      console.log("📡 Estado WhatsApp:", connection);
    }

    if (qr) {

      ultimoQrCode = qr;

      atualizarEstado("QR_CODE", false);

      console.log("\n📱 ESCANEIE ESTE QR CODE:\n");

      qrcode.generate(qr, {
        small: true
      });
    }

    if (connection === "open") {

      whatsappReady = true;
      whatsappState = "CONNECTED";
      ultimoQrCode = null;

      console.log("\n====================================");
      console.log("🟢 WHATSAPP CONECTADO!");
      console.log("====================================\n");
    }

    if (connection === "close") {

      whatsappReady = false;
      whatsappState = "DISCONNECTED";

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log("\n🔴 WhatsApp desconectado.");
      console.log("Código:", statusCode);

      if (statusCode !== DisconnectReason.loggedOut) {

        console.log("🔄 Tentando reconectar...\n");

        setTimeout(() => {
          conectarWhatsApp();
        }, 3000);

      } else {

        console.log(
          "🚪 Sessão encerrada. Será necessário escanear o QR novamente."
        );
      }
    }
  });

  sock.ev.on("messages.upsert", ({ messages }) => {

    for (const message of messages) {

      if (!message.message) continue;

      // Ignora mensagens próprias
      if (message.key.fromMe) continue;

      // Ignora eventos/protocolos internos
      if (message.message.protocolMessage) continue;

      console.log("\n📩 MENSAGEM RECEBIDA");

      console.log(
        "De:",
        message.key.remoteJid
      );
    }
  });
}

async function enviarMensagem(numero, mensagem) {

  if (!sock || !whatsappReady) {
    throw new Error("WhatsApp indisponível.");
  }

  let numeroLimpo = String(numero)
    .replace(/\D/g, "");

  if (!numeroLimpo.startsWith("55") &&
    numeroLimpo.length >= 10) {

    numeroLimpo = "55" + numeroLimpo;
  }

  const jid = `${numeroLimpo}@s.whatsapp.net`;

  console.log(
    `📤 Enviando WhatsApp para ${jid}`
  );

  const resultado = await sock.sendMessage(
    jid,
    {
      text: mensagem
    }
  );

  console.log(
    `✅ Mensagem enviada para ${jid}`
  );

  return resultado;
}

function obterStatus() {

  return {
    conectado: whatsappReady,
    estado: whatsappState,
    temQrCode: !!ultimoQrCode,
    qrCode: ultimoQrCode
  };
}

async function iniciarWhatsApp() {

  if (sock) {
    return;
  }

  await conectarWhatsApp();
}

module.exports = {
  iniciarWhatsApp,
  enviarMensagem,
  obterStatus
};