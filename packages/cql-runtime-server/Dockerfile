FROM node:22-alpine

WORKDIR /app

COPY vendor/oqlts /app/vendor/oqlts
RUN npm ci --prefix /app/vendor/oqlts && npm run build --prefix /app/vendor/oqlts

COPY packages/cql-runtime/package.json ./packages/cql-runtime/
COPY packages/cql-runtime/src ./packages/cql-runtime/src/
COPY packages/cql-runtime-server/package.json ./packages/cql-runtime-server/
COPY packages/cql-runtime-server/src ./packages/cql-runtime-server/src/
COPY runtime ./runtime

WORKDIR /app/packages/cql-runtime-server
RUN npm install --omit=dev

ENV CQL_RUNTIME_HOST=0.0.0.0
ENV CQL_RUNTIME_PORT=8101
EXPOSE 8101

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8101/health || exit 1

CMD ["npm", "start"]
