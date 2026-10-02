FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates chromium libreoffice-writer libreoffice-calc libreoffice-impress fonts-thai-tlwg fonts-croscore && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.32.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter api build
RUN install -D -m 644 /app/apps/api/assets/Sarabun-Regular.ttf /usr/local/share/fonts/ats/Sarabun-Regular.ttf && fc-cache -f
ENV NODE_ENV=production
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
USER node
EXPOSE 4000
CMD ["sh", "-c", "attempt=1; until pnpm --filter api db:migrate; do if [ \"$attempt\" -ge 5 ]; then echo 'Migration failed after 5 attempts'; exit 1; fi; echo \"Migration attempt $attempt failed; retrying in 15 seconds\"; attempt=$((attempt + 1)); sleep 15; done; exec pnpm --filter api start:prod"]
