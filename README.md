# 📑 Gerenciador de Boletos com Notificação via WhatsApp

Sistema completo para cadastro, controle e exclusão de boletos bancários com rotina automatizada de checagem de vencimentos e alertas automáticos via WhatsApp.

---

## 🚀 Funcionalidades

- **Autenticação de Usuários**: Tela de login para acesso seguro ao painel.
- **Gestão de Boletos**: Cadastro detalhado e exclusão de títulos pendentes.
- **Banco de Dados Local**: Persistência ágil de dados utilizando SQLite.
- **Disparos Automáticos**: Integração com WhatsApp Web para avisar sobre vencimentos (hoje/amanhã).
- **Execução em Segundo Plano**: Configurado para rodar via PM2 como serviço do sistema.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **Banco de Dados**: SQLite3
- **Automação de Mensagens**: `whatsapp-web.js`
- **Gerenciador de Processos**: PM2

---

## 📦 Como Rodar o Projeto Localmente

### 1. Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org) (Versão 20 ou superior)
- Git

### 2. Instalação das Dependências
Abra o terminal, navegue até a pasta do backend e instale os pacotes necessários:
```bash
cd backend
npm install
```

### 3. Rodar em Modo de Desenvolvimento
Para testar o projeto com recarregamento automático (nodemon):
```bash
npm run dev
```
Acesse no navegador: `http://localhost:3000`

---

## 🖥️ Configuração em Segundo Plano (Produção Local com PM2)

Para fechar o terminal/VSCode e manter o sistema rodando direto no Windows:

1. Instale o PM2 globalmente e o assistente de inicialização:
```bash
npm install pm2 pm2-windows-startup -g
pm2-startup install
```

2. Inicie o servidor configurando o filtro para o banco SQLite não derrubar a sessão:
```bash
cd backend
pm2 start server.js --name "backend-boletos" --watch --ignore-watch="*.db *.db-journal *.sqlite node_modules .wwebjs_auth .wwebjs_cache"
```

3. Salve o estado para iniciar automaticamente com o Windows:
```bash
pm2 save
```

---

## ⚙️ Comandos Úteis do PM2

- **Ver status do servidor**: `pm2 list`
- **Monitorar logs e QR Code do WhatsApp**: `pm2 logs backend-boletos`
- **Reiniciar o serviço**: `pm2 restart backend-boletos`
- **Parar o serviço**: `pm2 stop backend-boletos`

---
Desenvolvido por [Jansen Muniz](https://github.com) 🚀
