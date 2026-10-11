# Game server for Fly.io: server.js = Next site + Socket.IO (online play for the app).
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
