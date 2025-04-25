FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app

RUN mkdir -p /sp/secrets
RUN mkdir -p /sp/inputs

ENV DEBUG=*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000

ENTRYPOINT [ "node",  "dist/index.js" ] 