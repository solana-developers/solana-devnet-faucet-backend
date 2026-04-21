FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server.js ./
COPY src ./src

EXPOSE 3000

CMD ["node", "server.js"]
