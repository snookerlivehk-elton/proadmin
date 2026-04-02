FROM node:18-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
