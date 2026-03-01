FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.29-alpine
WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/frontend/browser ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
