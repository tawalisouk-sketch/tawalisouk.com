FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 DATA_FILE=/data/data.json NODE_ENV=production
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
