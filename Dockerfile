FROM node:20-alpine
WORKDIR /app
COPY server.js package.json ./
COPY index.html ./
COPY assets ./assets
COPY docs ./docs
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.js"]
