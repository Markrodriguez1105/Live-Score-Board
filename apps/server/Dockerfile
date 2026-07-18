FROM node:20-alpine

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy shared packages
COPY packages/types/ packages/types/
COPY packages/database/ packages/database/

# Copy server app
COPY apps/server/ apps/server/

# Create uploads directory
RUN mkdir -p uploads

# Install all dependencies
RUN npm install --workspaces --include-workspace-root

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "run", "start", "-w", "apps/server"]
