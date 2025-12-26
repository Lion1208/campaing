FROM node:20-slim as builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código
COPY . .

# Build
RUN npm run build

# Stage 2: Serve com nginx
FROM nginx:alpine

# Copiar build
COPY --from=builder /app/build /usr/share/nginx/html

# Copiar configuração nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]