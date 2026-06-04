FROM ghcr.io/puppeteer/puppeteer:22.10.0

# Define a raiz da aplicação no container
WORKDIR /usr/src/app

# Define permissão de root para instalar dependências
USER root

# Copia os arquivos de dependência do backend para a pasta interna
COPY backend/package*.json ./backend/

# Entra na pasta do backend para instalar e buildar o SQLite
WORKDIR /usr/src/app/backend
RUN npm install && npm rebuild sqlite3 --build-from-source

# Volta para a raiz e copia TODO o projeto (frontend e backend)
WORKDIR /usr/src/app
COPY . .

# Expõe a porta e define o comando de inicialização
EXPOSE 10000
CMD ["node", "backend/server.js"]
