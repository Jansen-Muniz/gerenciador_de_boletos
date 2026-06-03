FROM ghcr.io/puppeteer/puppeteer:22.10.0

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependências do backend
COPY backend/package*.json ./backend/

# Entra na pasta backend para instalar as dependências
WORKDIR /usr/src/app/backend
USER root
RUN npm install && npm rebuild sqlite3 --build-from-source

# Volta para a raiz e copia TODO o projeto (incluindo o frontend)
WORKDIR /usr/src/app
COPY . .

# Expõe a porta que o Render vai usar
EXPOSE 10000

# Comando para iniciar o servidor a partir da pasta correta
WORKDIR /usr/src/app/backend
CMD ["node", "server.js"]
