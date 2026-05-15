# ----- Builder stage -----
# Using alpine, the linux's latest version As development environment
FROM node:22-alpine AS builder

# Install Pnpm globally (pinned to match pnpm-lock.yaml lockfileVersion)
RUN npm install -g pnpm@10.33.0

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json pnpm-lock.yaml ./

# Install the application dependencies
# Freeze the unmatched version of package
RUN pnpm install --frozen-lockfile

# Copy the rest of the application files/folders
COPY . .

# Build the application
RUN pnpm build


# ----- Production stage -----

FROM node:22-alpine AS production

RUN npm install -g pnpm@10.33.0

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# `--prod` installs only necessities, excludes devDependencies, installs dependencies only
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 3000

# Command to run the application
# CMD ["node", "dist/main"]
