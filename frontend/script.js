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
      boletos = []; // Evita o erro de boletos.sort() deixando a lista vazia
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
let editandoIndex = null;

/* =========================
   HELPERS
========================= */
function getHojeFormatado() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;
}

/* =========================
   RENDER
========================= */
function renderizarBoletos() {
  lista.innerHTML = "";

  const hojeFormatado = getHojeFormatado();

  boletos.sort((a, b) => {
    function prioridade(boleto) {
      if (boleto.pago) return 4;
      if (boleto.vencimento < hojeFormatado) return 1;
      if (boleto.vencimento === hojeFormatado) return 2;
      return 3;
    }

    const prioridadeA = prioridade(a);
    const prioridadeB = prioridade(b);

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    return a.vencimento.localeCompare(b.vencimento);
  });

  boletos
    .filter((boleto) => {
      if (filtroAtual === "todos") return true;
      if (filtroAtual === "pagos") return boleto.pago;
      if (filtroAtual === "atrasados") return !boleto.pago && boleto.vencimento < hojeFormatado;
      if (filtroAtual === "hoje") return !boleto.pago && boleto.vencimento === hojeFormatado;
      if (filtroAtual === "pendentes") return !boleto.pago && boleto.vencimento > hojeFormatado;
    })
    .forEach((boleto, index) => {
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

          <button class="editar" onclick="editarBoleto(${index})">
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
    if (editandoIndex !== null) {
      const boletoEditando = boletos[editandoIndex];

      await fetch(`/boletos/${boletoEditando.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...novoBoleto,
          pago: boletoEditando.pago
        })
      });

      editandoIndex = null;

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

    mostrarToast(
      "Erro ao atualizar boleto",
      "erro"
    );

  }

}

/* =========================
   EDITAR
========================= */
function editarBoleto(index) {
  const boleto = boletos[index];

  nomeInput.value = boleto.nome;

  valorInput.value = Number(boleto.valor)
    .toFixed(2)
    .replace(".", ",");

  vencimentoInput.value = boleto.vencimento;

  editandoIndex = index;

  mostrarToast("Editando boleto...", "info");
}

/* =========================
   UTIL
========================= */
function limparCampos() {
  nomeInput.value = "";
  valorInput.value = "";
  vencimentoInput.value = "";
}

function formatarData(data) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
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

  const dataVencimento = new Date(vencimento + "T00:00:00");

  const dias = Math.floor(
    (dataVencimento - hoje) / (1000 * 60 * 60 * 24)
  );

  if (dias < 0) return `❌ Atrasado há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "⚠️ Vence hoje";
  if (dias === 1) return "⏰ Vence amanhã";

  return `📅 Vence em ${dias} dias`;
}

function verificarVencimentos() {

  const alerta = document.getElementById("alerta");

  const hoje = new Date();

  const hojeFormatado =
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  let vencendoHoje = 0;
  let atrasados = 0;

  boletos.forEach((boleto) => {

    if (boleto.pago) return;

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
    mensagem += `⚠️ ${vencendoHoje} boleto(s) vencendo hoje`;
  }

  if (mensagem === "") {
    mensagem = "✅ Nenhum boleto pendente";
    alerta.style.background = "#4caf50";
    alerta.style.color = "#fff";
  }
  else if (atrasados > 0) {
    alerta.style.background = "#f44336";
    alerta.style.color = "#fff";
  }
  else {
    alerta.style.background = "#ff9800";
    alerta.style.color = "#000";
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
    boletos = await resposta.json();

    renderizarBoletos();
  } catch (erro) {
    console.error("Erro ao carregar boletos:", erro);
  }
}

async function logout() {
  try {
    const res = await fetch("/logout", {
      method: "POST",
      credentials: "include" // Garante o envio do cookie para ser destruído
    });

    if (res.ok) {
      // Redireciona imediatamente para a tela de login
      window.location.href = "login.html";
    } else {
      mostrarToast("Erro ao fazer logout", "erro");
    }
  } catch (erro) {
    console.error("Erro no logout:", erro);
    mostrarToast("Erro ao conectar com o servidor", "erro");
  }
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