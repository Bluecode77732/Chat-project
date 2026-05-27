# ----- Builder stage -----
# Using alpine, the linux's latest version As development environment
FROM node:22-alpine AS builder

# Install Pnpm globally (pinned to match pnpm-lock.yaml lockfileVersion)
RUN npm install -g pnpm@10.33.0

# Set the working directory inside the container
WORKDIR /app

# Copy workspace-level files first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source files
COPY backend/ backend/

# Build the application
RUN pnpm --filter backend build


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
