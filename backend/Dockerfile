# ----- Builder stage -----
# Using alpine, the linux's latest version As development environment
FROM node:22-alpine AS builder

# Install Pnpm globally (pinned to match pnpm-lock.yaml lockfileVersion)
# @nestjs/cli is installed globally so `nest build` is available regardless of
# how pnpm links devDependencies inside the workspace on Alpine Linux
RUN npm install -g pnpm@10.33.0 @nestjs/cli

# Set the working directory inside the container
WORKDIR /app

# Copy workspace-level files first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/

# Install all workspace dependencies
# --shamefully-hoist: puts all packages at root node_modules/ so TypeScript
# can find them via directory walk-up from backend/ (Alpine doesn't symlink
# individual package deps into each workspace package's node_modules/)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copy backend source files
COPY backend/ backend/

# Build the application
# Run nest directly (not via pnpm script) so the global @nestjs/cli is used
# instead of the broken local .bin/nest wrapper that pnpm creates on Alpine
RUN cd backend && nest build


# ----- Production stage -----

FROM node:22-alpine AS production

RUN npm install -g pnpm@10.33.0

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/

# `--prod` installs only necessities, excludes devDependencies, installs dependencies only
RUN pnpm install --frozen-lockfile --prod --filter backend...

COPY --from=builder /app/backend/dist ./backend/dist

# Expose the application port
EXPOSE 3000

# Command to run the application
# CMD ["node", "backend/dist/main"]
