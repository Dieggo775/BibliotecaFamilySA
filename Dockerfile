FROM node:20-slim

WORKDIR /app

# Instala as dependências dentro do container (o node_modules do Windows não serve no Linux)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js usuarios.js schema.json ./
COPY public ./public

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
