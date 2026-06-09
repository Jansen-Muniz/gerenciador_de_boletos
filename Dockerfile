FROM ghcr.io/puppeteer/puppeteer:22.10.0

WORKDIR /usr/src/app

USER root

COPY backend/package*.json ./backend/

WORKDIR /usr/src/app/backend

RUN npm install

WORKDIR /usr/src/app

COPY . .

EXPOSE 10000

CMD ["node", "backend/server.js"]