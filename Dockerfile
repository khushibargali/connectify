# Production image: API + built client in one Node process. Expects MONGO_URI to be set.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json server/
COPY client/package.json client/package-lock.json client/
RUN npm ci --ignore-scripts && npm --prefix server ci && npm --prefix client ci
COPY . .
RUN npm --prefix client run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY server/package.json server/package-lock.json server/
RUN npm --prefix server ci --omit=dev
COPY server/src server/src
COPY server/scripts server/scripts
COPY --from=build /app/client/dist client/dist
EXPOSE 4000
CMD ["node", "server/src/index.js"]
