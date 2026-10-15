FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY api ./api
COPY public ./public
COPY server ./server
COPY vercel.json ./vercel.json
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["npm", "start"]
