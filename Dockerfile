FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY app.js ./
COPY src ./src

EXPOSE 3000

CMD ["node", "app.js"]
