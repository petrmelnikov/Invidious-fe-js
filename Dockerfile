FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173

COPY package.json ./
COPY index.html ./
COPY scripts ./scripts
COPY src ./src

EXPOSE 5173

USER node

CMD ["npm", "run", "start"]
