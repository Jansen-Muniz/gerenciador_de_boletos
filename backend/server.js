const express = require("express");

const app = express();

const PORT = 3000;

let boletos = [
  {
    id: 1,
    nome: "Internet",
    valor: 99.90,
    vencimento: "2026-05-22",
    pago: false
  }
];

app.get("/", (req, res) => {

  res.send("API funcionando 😄");

});

app.get("/boletos", (req, res) => {

  res.json(boletos);

});

app.listen(PORT, () => {

  console.log(`Servidor rodando em http://localhost:${PORT}`);

});