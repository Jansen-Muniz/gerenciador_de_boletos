// Executa assim que a página carrega
window.onload = async () => {
  await carregarDadosAdmin();
};

async function carregarDadosAdmin() {
  try {
    console.log("Buscando dados de administração...");

    // 1. Busca os Usuários do Sistema
    const resUsuarios = await fetch("/admin/usuarios", {
      credentials: "include"
    });

    if (resUsuarios.status === 401 || resUsuarios.status === 403) {
      window.location.href = "login.html";
      return;
    }

    const usuarios = await resUsuarios.json();
    renderizarUsuarios(usuarios);

    // 2. Busca Todos os Boletos do Sistema
    const resBoletos = await fetch("/admin/dashboard", {
      credentials: "include"
    });

    const boletos = await resBoletos.json();
    renderizarBoletosAdmin(boletos);

    // ==========================
    // STATUS DO WHATSAPP
    // ==========================
    const resWhatsapp = await fetch(
      "/admin/whatsapp-status",
      {
        credentials: "include"
      }
    );

    const whatsapp = await resWhatsapp.json();

    const statusWhatsapp =
      document.getElementById("status-whatsapp");

    if (whatsapp.conectado) {

      statusWhatsapp.innerHTML =
        "🟢 WhatsApp conectado";

    } else {

      statusWhatsapp.innerHTML =
        `🔴 WhatsApp desconectado (${whatsapp.estado})`;

    }

  } catch (erro) {
    console.error(
      "Erro ao carregar dados do painel admin:",
      erro
    );
  }
}

// Preenche a tabela de usuários
function renderizarUsuarios(usuarios) {
  const tabela = document.getElementById("tabela-usuarios");
  tabela.innerHTML = "";

  usuarios.forEach(user => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${user.id}</strong></td>
      <td>${user.usuario}</td>
      <td>${user.telefone ? user.telefone : "❌ Não cadastrado"}</td>
    `;
    tabela.appendChild(tr);
  });
}

// Preenche a tabela global de boletos
function renderizarBoletosAdmin(boletos) {
  const tabela = document.getElementById("tabela-boletos");
  tabela.innerHTML = "";

  boletos.forEach(boleto => {
    const tr = document.createElement("tr");

    // Formata a exibição de data e moeda para ficar amigável
    const dataFormatada = boleto.vencimento.split("-").reverse().join("/");
    const valorFormatado = Number(boleto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    tr.innerHTML = `
      <td><mark>@${boleto.usuario}</mark></td>
      <td>${boleto.nome}</td>
      <td>R$ ${valorFormatado}</td>
      <td>${dataFormatada}</td>
      <td>
        <span class="badge ${boleto.pago ? 'badge-pago' : 'badge-pendente'}">
          ${boleto.pago ? '✅ Pago' : '⏳ Pendente'}
        </span>
      </td>
      <td>
        ${boleto.notificacao_enviada ? '🟢 Sim (Enviada)' : '⚪ Não / Aguardando Cron'}
      </td>
    `;
    tabela.appendChild(tr);
  });
}

// Função de logout simples para o admin sair do sistema
async function logoutAdmin() {
  try {
    const res = await fetch("/logout", { method: "POST", credentials: "include" });
    if (res.ok) {
      window.location.href = "login.html";
    }
  } catch (erro) {
    console.error("Erro ao deslogar admin:", erro);
  }
}
