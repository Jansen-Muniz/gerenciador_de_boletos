async function login(e) {
  if (e) e.preventDefault();

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

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 200);

  } catch (err) {

    console.error(err);

    erro.innerText = "Erro ao conectar com servidor";

  }

}