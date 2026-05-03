FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:5000/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
