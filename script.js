const nomeInput = document.getElementById("nome");
const valorInput = document.getElementById("valor");
const vencimentoInput = document.getElementById("vencimento");

const botaoSalvar = document.getElementById("salvar");
const lista = document.getElementById("lista");

// EVENTO MÁSCARA MOEDA
valorInput.addEventListener("input", formatarMoeda);

/* =========================
   PEGAR BOLETOS SALVOS
========================= */
let boletos = JSON.parse(localStorage.getItem("boletos")) || [];

/* =========================
   MOSTRAR BOLETOS
========================= */
function renderizarBoletos() {

  lista.innerHTML = "";

  boletos.sort((a, b) => {

    const hoje = new Date();

    const hojeFormatado = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    function prioridade(boleto) {

      if (boleto.pago) return 4;

      if (boleto.vencimento < hojeFormatado) return 1;

      if (boleto.vencimento === hojeFormatado) return 2;

      return 3;

    }

    const prioridadeA = prioridade(a);
    const prioridadeB = prioridade(b);

    // Primeiro: ordena por prioridade
    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    // Segundo: ordena por data (mais antigo primeiro)
    return a.vencimento.localeCompare(b.vencimento);

  });

  const hoje = new Date();

  const hojeFormatado = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  boletos.forEach((boleto, index) => {

    const div = document.createElement("div");
    div.classList.add("boleto");

    // STATUS VISUAL (cores do card)
    if (boleto.pago) {
      div.classList.add("pago");
    } else {

      if (boleto.vencimento < hojeFormatado) {
        div.classList.add("atrasado");
      }

      if (boleto.vencimento === hojeFormatado) {
        div.classList.add("hoje");
      }

    }

    div.innerHTML = `
      <div class="info">
        <h3>
          ${boleto.pago ? "✅" : "📄"} ${boleto.nome}
        </h3>

        <p>R$ ${Number(boleto.valor).toFixed(2)}</p>

        <span>
          Vence em: ${formatarData(boleto.vencimento)}
        </span>

        <br><br>

       <strong>
  ${boleto.pago
        ? "✅ Pago"
        : calcularDiasRestantes(boleto.vencimento)
      }
</strong>
      </div>

      <div class="acoes">

        <button
          class="pago"
          onclick="marcarComoPago(${index})"
        >
          ${boleto.pago ? "Desfazer" : "Pago"}
        </button>

        <button
          class="excluir"
          onclick="excluirBoleto(${index})"
        >
          Excluir
        </button>

      </div>
    `;

    lista.appendChild(div);

  });

}
/* =========================
   SALVAR BOLETO
========================= */
function salvarBoleto() {

  const nome = nomeInput.value;
  const valor = valorInput.value
    .replace(/\./g, "")
    .replace(",", ".");
  const vencimento = vencimentoInput.value;

  const valorNumerico = Number(
    valor
      .replace(/\./g, "")
      .replace(",", ".")
  );

  if (
    !nome.trim() ||
    !valor ||
    valorNumerico <= 0 ||
    !vencimento
  ) {
    mostrarToast("Preencha todos os campos corretamente.", "erro");
    return;
  }

  const novoBoleto = {
    nome,
    valor,
    vencimento,
    pago: false
  };

  boletos.push(novoBoleto);

  localStorage.setItem("boletos", JSON.stringify(boletos));

  limparCampos();

  renderizarBoletos();
  verificarVencimentos();

  mostrarToast("Boleto salvo com sucesso!", "sucesso");
}

/* =========================
   EXCLUIR BOLETO
========================= */
function excluirBoleto(index) {

  boletos.splice(index, 1);

  localStorage.setItem("boletos", JSON.stringify(boletos));

  renderizarBoletos();
  verificarVencimentos();
}

function marcarComoPago(index) {

  boletos[index].pago = !boletos[index].pago;

  localStorage.setItem("boletos", JSON.stringify(boletos));

  renderizarBoletos();

  verificarVencimentos();

}

/* =========================
   LIMPAR CAMPOS
========================= */
function limparCampos() {

  nomeInput.value = "";
  valorInput.value = "";
  vencimentoInput.value = "";

}

/* =========================
   FORMATAR DATA
========================= */
function formatarData(data) {

  const [ano, mes, dia] = data.split("-");

  return `${dia}/${mes}/${ano}`;

}

function formatarMoeda(e) {

  let valor = e.target.value;

  // Remove tudo que não for número
  valor = valor.replace(/\D/g, "");

  // Divide por 100
  valor = (Number(valor) / 100).toFixed(2);

  // Troca ponto por vírgula
  valor = valor.replace(".", ",");

  // Adiciona pontos de milhar
  valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  e.target.value = valor;

}

function calcularDiasRestantes(vencimento) {

  const hoje = new Date();

  // Remove horas
  hoje.setHours(0, 0, 0, 0);

  const dataVencimento = new Date(vencimento + "T00:00:00");

  const diferenca = dataVencimento - hoje;

  const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));

  if (dias < 0) {
    return `❌ Atrasado há ${Math.abs(dias)} dia(s)`;
  }

  if (dias === 0) {
    return "⚠️ Vence hoje";
  }

  if (dias === 1) {
    return "⏰ Vence amanhã";
  }

  return `📅 Vence em ${dias} dias`;

}

function verificarVencimentos() {

  const alerta = document.getElementById("alerta");

  const hoje = new Date();

  const hojeFormatado = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

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
  } else if (atrasados > 0) {
    alerta.style.background = "#f44336";
    alerta.style.color = "#fff";
  } else {
    alerta.style.background = "#ff9800";
    alerta.style.color = "#000";
  }

  alerta.innerHTML = mensagem;

}

function mostrarToast(mensagem, tipo = "info") {

  const toast = document.getElementById("toast");

  toast.innerText = mensagem;

  // cores mais modernas e diferentes do alerta
  if (tipo === "erro") {
    toast.style.background = "#d32f2f";
  } else if (tipo === "sucesso") {
    toast.style.background = "#2e7d32";
  } else {
    toast.style.background = "#333";
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);

}

/* =========================
   EVENTO BOTÃO
========================= */
botaoSalvar.addEventListener("click", salvarBoleto);

/* =========================
   INICIAR
========================= */
renderizarBoletos();
verificarVencimentos();