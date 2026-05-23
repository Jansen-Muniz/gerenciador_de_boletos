const cors = require("cors");
const express = require("express");
const app = express();
const db = require("./database");

app.use(cors());
app.use(express.json());

const PORT = 3000;

let boletos = [

];

app.get("/", (req, res) => {

  res.send("API funcionando 😄");

});

app.get("/boletos", (req, res) => {

  db.all("SELECT * FROM boletos", [], (erro, rows) => {

    if (erro) {
      return res.status(500).json({
        erro: erro.message
      });
    }

    res.json(rows);

  });

});

app.post("/boletos", (req, res) => {

  const { nome, valor, vencimento, pago } = req.body;

  const sql = `
    INSERT INTO boletos
    (nome, valor, vencimento, pago)
    VALUES (?, ?, ?, ?)
  `;

  db.run(
    sql,
    [nome, valor, vencimento, pago ? 1 : 0],
    function (erro) {

      if (erro) {
        return res.status(500).json({
          erro: erro.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        nome,
        valor,
        vencimento,
        pago
      });

    }
  );

});

app.put("/boletos/:id", (req, res) => {

  const { id } = req.params;
  const { pago } = req.body;

  db.run(
    "UPDATE boletos SET pago = ? WHERE id = ?",
    [pago ? 1 : 0, id],
    function (erro) {

      if (erro) {
        return res.status(500).json({ erro: erro.message });
      }

      res.json({ mensagem: "Atualizado com sucesso 😄" });

    }
  );

});

app.delete("/boletos/:id", (req, res) => {

  const { id } = req.params;

  db.run(
    "DELETE FROM boletos WHERE id = ?",
    [id],
    function (erro) {

      if (erro) {
        return res.status(500).json({
          erro: erro.message
        });
      }

      res.json({
        mensagem: "Boleto excluído 😄"
      });

    }
  );

});

app.listen(PORT, () => {

  console.log(`Servidor rodando em http://localhost:${PORT}`);

});