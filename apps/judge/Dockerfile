FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/types/ packages/types/
COPY packages/ui/ packages/ui/
COPY apps/judge/ apps/judge/
RUN npm install --workspaces --include-workspace-root
RUN npm install lightningcss-linux-x64-musl
RUN npm run build -w apps/judge

FROM nginx:alpine
COPY --from=builder /app/apps/judge/dist /usr/share/nginx/html/judge
COPY apps/judge/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
