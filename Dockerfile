FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY Backend/package.json Backend/package.json
COPY Frontend/my_app/package.json Frontend/my_app/package.json
RUN npm ci --no-fund --no-audit
COPY Frontend/my_app Frontend/my_app
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY Backend/package.json Backend/package.json
COPY Frontend/my_app/package.json Frontend/my_app/package.json
RUN npm ci --omit=dev --no-fund --no-audit && npm cache clean --force
COPY --chown=node:node Backend Backend
COPY --from=build --chown=node:node /app/Frontend/my_app/dist Frontend/my_app/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node Backend/scripts/migrate.js && exec node Backend/server.js"]
