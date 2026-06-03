FROM ghcr.io/puppeteer/puppeteer:22.10.0

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências (compilando o sqlite3 automaticamente)
USER root
RUN npm install && npm rebuild sqlite3 --build-from-source

# Copia o restante do código do backend
COPY . .

# Expõe a porta que o Render vai usar
EXPOSE 10000

# Comando para iniciar o servidor
CMD ["node", "server.js"]
