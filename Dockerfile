FROM node:20-alpine
WORKDIR /app
COPY package.json LICENSE ./
COPY sdk ./sdk
COPY server ./server
ENV PORT=8787 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "server/server.mjs"]
