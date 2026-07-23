FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/types/ packages/types/
COPY packages/ui/ packages/ui/
COPY apps/tabulator/ apps/tabulator/
RUN npm install --workspaces --include-workspace-root
RUN npm install lightningcss-linux-x64-musl
RUN npm run build -w apps/tabulator

FROM nginx:alpine
COPY --from=builder /app/apps/tabulator/dist /usr/share/nginx/html/tabulator
COPY apps/tabulator/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
