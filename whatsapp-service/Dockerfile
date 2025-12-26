FROM node:20-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código
COPY . .

# Criar diretório de sessões
RUN mkdir -p auth_sessions

# Expor porta
EXPOSE 3002

# Comando de inicialização
CMD ["node", "index.js"]