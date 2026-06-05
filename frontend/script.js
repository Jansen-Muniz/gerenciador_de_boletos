async function verificarSessao() {
  try {
    console.log("verificando sessão...");
    const res = await fetch("/boletos", {
      credentials: "include"
    });

    console.log("status:", res.status);

    if (res.status === 401) {
      console.log("não autenticado");
      window.location.href = "login.html";
      return;
    }

    if (!res.ok) {
      console.error("Servidor retornou erro ao buscar boletos");
      boletos = [];
      return;
    }

    boletos = await res.json();
    console.log("sessão OK");

    renderizarBoletos();
    verificarVencimentos();

  } catch (err) {
    console.error("erro sessão:", err);
  }
}

const nomeInput = document.getElementById("nome");
const valorInput = document.getElementById("valor");
const vencimentoInput = document.getElementById("vencimento");
const botaoSalvar = document.getElementById("salvar");
const lista = document.getElementById("lista");

let filtroAtual = "todos";
valorInput.addEventListener("input", formatarMoeda);

/* =========================
   DADOS
========================= */
let boletos = [];
let editandoId = null; // 👈 Mudado de index para ID para evitar conflito com filtros

/* =========================
   HELPERS
========================= */
function getHojeFormatado() {
  // 🕒 Garante a data correta no padrão brasileiro sem desvios de fuso do UTC
  const fusoBrasil = { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" };
  const [dia, mes, ano] = new Date().toLocaleDateString("pt-BR", fusoBrasil).split("/");
  return `${ano}-${mes}-${dia}`;
}

/* =========================
   RENDER
========================= */
function renderizarBoletos() {
  lista.innerHTML = "";
  const hojeFormatado = getHojeFormatado();

  // Ordena o array global de forma estável
  boletos.sort((a, b) => {
    function prioridade(boleto) {

      if (boleto.pago) return 4;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const vencimento = new Date(boleto.vencimento);
      vencimento.setHours(0, 0, 0, 0);

      if (vencimento < hoje) return 1;
      if (vencimento.getTime() === hoje.getTime()) return 2;

      return 3;

    }

    const prioridadeA = prioridade(a);
    const prioridadeB = prioridade(b);

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    return new Date(a.vencimento) - new Date(b.vencimento);
  });

  // Filtra e renderiza
  boletos
    .filter((boleto) => {
      if (filtroAtual === "todos") return true;
      if (filtroAtual === "pagos") return boleto.pago;
      if (filtroAtual === "atrasados") return !boleto.pago && boleto.vencimento < hojeFormatado;
      if (filtroAtual === "hoje") return !boleto.pago && boleto.vencimento === hojeFormatado;
      if (filtroAtual === "pendentes") return !boleto.pago && boleto.vencimento > hojeFormatado;
    })
    .forEach((boleto) => { // 👈 Removido o 'index' daqui
      const div = document.createElement("div");
      div.classList.add("boleto");

      if (boleto.pago) {
        div.classList.add("pago");
      } else if (boleto.vencimento < hojeFormatado) {
        div.classList.add("atrasado");
      } else if (boleto.vencimento === hojeFormatado) {
        div.classList.add("hoje");
      }

      div.innerHTML = `
        <div class="info">
          <h3>${boleto.pago ? "✅" : "📄"} ${boleto.nome}</h3>
          <p>R$ ${Number(boleto.valor).toFixed(2)}</p>
          <span>Vence em: ${formatarData(boleto.vencimento)}</span>
          <br><br>
          <strong>
            ${boleto.pago ? "✅ Pago" : calcularDiasRestantes(boleto.vencimento)}
          </strong>
        </div>

        <div class="acoes">
          <button class="pago" onclick="marcarComoPago(${boleto.id})">
            ${boleto.pago ? "Desfazer" : "Pago"}
          </button>

          <button class="editar" onclick="editarBoleto(${boleto.id})"> <!-- 👈 Passa o ID único -->
            Editar
          </button>

          <button class="excluir" onclick="excluirBoleto(${boleto.id})">
            Excluir
          </button>
        </div>
      `;

      lista.appendChild(div);
    });
}

/* =========================
   SALVAR
========================= */
async function salvarBoleto() {
  const nome = nomeInput.value;

  const valor = valorInput.value
    .replace(/\./g, "")
    .replace(",", ".");

  const vencimento = vencimentoInput.value;
  const valorNumerico = Number(valor);

  if (!nome.trim() || !valor || valorNumerico <= 0 || !vencimento) {
    mostrarToast("Preencha todos os campos corretamente.", "erro");
    return;
  }

  const novoBoleto = {
    nome,
    valor,
    vencimento,
    pago: false
  };

  try {
    if (editandoId !== null) { // 👈 Alterado para usar o ID único de edição
      const boletoEditando = boletos.find(b => b.id === editandoId);

      await fetch(`/boletos/${editandoId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...novoBoleto,
          pago: boletoEditando.pago // Mantém o status de pago atual do boleto
        })
      });

      editandoId = null; // Reseta a variável de controle
      mostrarToast("Boleto atualizado com sucesso!", "sucesso");
    } else {
      await fetch("/boletos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(novoBoleto)
      });

      mostrarToast("Boleto salvo com sucesso!", "sucesso");
    }

    await carregarBoletos();
    limparCampos();

    // Altera o texto do botão de volta para Salvar caso estivesse em modo edição
    botaoSalvar.innerText = "Salvar boleto";
  } catch (erro) {
    console.error(erro);
    mostrarToast("Erro ao salvar boleto", "erro");
  }
}

/* =========================
   EXCLUIR
========================= */
async function excluirBoleto(id) {
  try {
    await fetch(`/boletos/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    await carregarBoletos();
    mostrarToast("Boleto excluído 😄", "sucesso");
  } catch (erro) {
    console.error(erro);
    mostrarToast("Erro ao excluir boleto", "erro");
  }
}

/* =========================
   PAGAR
========================= */
async function marcarComoPago(id) {
  const boleto = boletos.find(b => b.id === id);

  try {
    await fetch(`/boletos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        ...boleto,
        pago: !boleto.pago
      })
    });

    await carregarBoletos();
    mostrarToast("Boleto atualizado 😄", "sucesso");
  } catch (erro) {
    console.error(erro);
    mostrarToast("Erro ao atualizar boleto", "erro");
  }
}

/* =========================
   EDITAR
========================= */
function editarBoleto(id) { // 👈 Mudado de 'index' para 'id' único do banco
  const boleto = boletos.find(b => b.id === id); // Localiza o boleto real de forma segura

  if (!boleto) return;

  nomeInput.value = boleto.nome;

  valorInput.value = Number(boleto.valor)
    .toFixed(2)
    .replace(".", ",");

  valorInput.value = Number(boleto.valor)
    .toFixed(2)
    .replace(".", ",");

  vencimentoInput.value = boleto.vencimento.split("T")[0];

  editandoId = id; // 👈 Atualiza a variável de controle global com o ID correto
  botaoSalvar.innerText = "Atualizar boleto"; // Dá um feedback visual para o usuário

  mostrarToast("Editando boleto...", "info");
}

/* =========================
   UTIL
========================= */
function limparCampos() {
  nomeInput.value = "";
  valorInput.value = "";
  vencimentoInput.value = "";
  editandoId = null; // Garante que limpou o estado de edição
}

function formatarData(data) {

  const dataObj = new Date(data);

  return dataObj.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });

}

function formatarMoeda(e) {
  let valor = e.target.value;

  valor = valor.replace(/\D/g, "");
  valor = (Number(valor) / 100).toFixed(2);
  valor = valor.replace(".", ",");
  valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  e.target.value = valor;
}

function calcularDiasRestantes(vencimento) {

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataVencimento = new Date(vencimento);
  dataVencimento.setHours(0, 0, 0, 0);

  const dias = Math.round(
    (dataVencimento - hoje) / (1000 * 60 * 60 * 24)
  );

  if (dias < 0) return `❌ Atrasado há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "⚠️ Vence hoje";
  if (dias === 1) return "⏰ Vence amanhã";

  return `📅 Vence em ${dias} dias`;

}

function verificarVencimentos() {

  const alerta = document.getElementById("alerta");
  const hojeFormatado = getHojeFormatado();

  let vencendoHoje = 0;
  let atrasados = 0;
  let pendentes = 0;

  boletos.forEach((boleto) => {

    if (boleto.pago) return;

    pendentes++;

    if (boleto.vencimento === hojeFormatado) {
      vencendoHoje++;
    }

    if (boleto.vencimento < hojeFormatado) {
      atrasados++;
    }

  });

  let mensagem = "";

  if (atrasados > 0) {
    mensagem += `❌ ${atrasados} boleto(s) atrasado(s)<br>`;
  }

  if (vencendoHoje > 0) {
    mensagem += `⚠️ ${vencendoHoje} boleto(s) vencendo hoje<br>`;
  }

  const pendentesFuturos = pendentes - atrasados - vencendoHoje;

  if (pendentesFuturos > 0) {
    mensagem += `📄 ${pendentesFuturos} boleto(s) a vencer`;
  }

  /* =========================
     CORES DO ALERTA
  ========================= */

  if (pendentes === 0) {

    mensagem = "✅ Nenhum boleto pendente";

    alerta.style.background = "#4caf50";
    alerta.style.color = "#fff";

  }
  else if (atrasados > 0) {

    // vermelho tem prioridade máxima
    alerta.style.background = "#f44336";
    alerta.style.color = "#fff";

  }
  else if (vencendoHoje > 0) {

    // laranja para atenção
    alerta.style.background = "#ff9800";
    alerta.style.color = "#000";

  }
  else {

    // azul para boletos futuros
    alerta.style.background = "#2196f3";
    alerta.style.color = "#fff";

  }

  alerta.innerHTML = mensagem;
}

/* =========================
   TOAST
========================= */
let toastTimeout;

function mostrarToast(mensagem, tipo = "info") {
  const toast = document.getElementById("toast");

  clearTimeout(toastTimeout);
  toast.innerText = mensagem;

  if (tipo === "erro") toast.style.background = "#d32f2f";
  else if (tipo === "sucesso") toast.style.background = "#2e7d32";
  else toast.style.background = "#333";

  toast.classList.add("show");

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

/* =========================
   BACKEND
========================= */
async function carregarBoletos() {
  try {
    const resposta = await fetch("/boletos", { credentials: "include" });

    if (!resposta.ok) {
      boletos = [];
      return;
    }

    boletos = await resposta.json();

    renderizarBoletos(); // 📲 Renderiza a lista atualizada na tela

    verificarVencimentos();

  } catch (erro) {
    console.error("Erro ao carregar boletos:", erro);
    boletos = [];
  }
}

async function logout() {
  try {
    const res = await fetch("/logout", {
      method: "POST",
      credentials: "include"
    });

    if (res.ok) {
      window.location.href = "login.html";
    } else {
      mostrarToast("Erro ao fazer logout", "erro");
    }
  } catch (erro) {
    console.error("Erro no logout:", erro);
    mostrarToast("Erro ao conectar com o servidor", "erro");
  }
}

function enviarBoletosParaSegundoPlano() {
  if (navigator.serviceWorker && navigator.serviceWorker.controller && boletos.length > 0) {
    navigator.serviceWorker.controller.postMessage({
      action: 'agendarChecagem',
      boletos: boletos
    });
  }
}

/* =========================
   FILTROS (Adicionado para corrigir o HTML)
========================= */
function filtrarBoletos(status) {
  filtroAtual = status;
  renderizarBoletos(); // Atualiza a tela aplicando a regra do filtro
}

/* =========================
   EVENTOS
========================= */
botaoSalvar.addEventListener("click", salvarBoleto);

/* =========================
   INIT
========================= */
window.onload = () => {
  setTimeout(async () => {
    await verificarSessao();
  }, 300);
};
