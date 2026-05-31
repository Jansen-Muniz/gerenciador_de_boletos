async function login(e) {
  if (e) {
    e.preventDefault();
  } else if (window.event) {
    window.event.preventDefault();
  }

  const usuario = document.getElementById("usuario").value;
  const senha = document.getElementById("senha").value;
  const erro = document.getElementById("erro");

  try {
    console.log("Tentando login...");

    const res = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ usuario, senha })
    });

    console.log("STATUS:", res.status);
    const data = await res.json();
    console.log("RESPOSTA:", data);

    if (!res.ok) {
      erro.innerText = data.erro;
      console.log("ERRO LOGIN");
      return;
    }

    console.log("LOGIN OK");

    // 👑 REDIRECIONAMENTO INTELIGENTE DO ADMIN
    setTimeout(() => {
      if (data.usuario === "admin") {
        window.location.href = "/admin.html"; // Vai para a tela de monitoramento do Admin
      } else {
        window.location.href = "/index.html"; // Usuário comum vai para o gerenciador normal
      }
    }, 200);

  } catch (err) {
    console.error(err);
    erro.innerText = "Erro ao conectar com servidor";
  }
}

// Função para alternar a exibição entre Login e Cadastro
function alternarTelas() {
  const formLogin = document.getElementById("form-login");
  const formCadastro = document.getElementById("form-cadastro");
  const erro = document.getElementById("erro");
  const cadMsg = document.getElementById("cad-msg");

  // Limpa mensagens antigas
  erro.innerText = "";
  cadMsg.innerText = "";

  if (formLogin.style.display === "none") {
    formLogin.style.display = "block";
    formCadastro.style.display = "none";
  } else {
    formLogin.style.display = "none";
    formCadastro.style.display = "block";
  }
}

// Função para enviar os dados de cadastro para o backend
async function cadastrar(e) {
  e.preventDefault();

  // 📥 Captura todos os 3 campos do HTML corretamente
  const usuario = document.getElementById("cad-usuario").value;
  const senha = document.getElementById("cad-senha").value;
  const telefone = document.getElementById("cad-telefone").value; // ✨ Captura o telefone do HTML
  const msg = document.getElementById("cad-msg");

  try {
    msg.innerText = "Cadastrando...";
    msg.style.color = "#333";

    const res = await fetch("/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 📦 Envia o telefone junto no pacote para o servidor salvar no SQLite
      body: JSON.stringify({ usuario, senha, telefone })
    });

    const data = await res.json();

    if (!res.ok) {
      msg.innerText = data.erro || "Erro ao cadastrar usuário.";
      msg.style.color = "#d32f2f";
      return;
    }

    msg.innerText = "Cadastro realizado com sucesso! 🎉";
    msg.style.color = "#2e7d32";

    setTimeout(() => {
      document.getElementById("cad-usuario").value = "";
      document.getElementById("cad-senha").value = "";
      document.getElementById("cad-telefone").value = ""; // Limpa o campo do telefone
      alternarTelas();
    }, 1500);

  } catch (err) {
    console.error(err);
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "#d32f2f";
  }
}

