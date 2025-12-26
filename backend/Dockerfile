FROM python:3.11-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Criar diretório de uploads
RUN mkdir -p uploads

# Expor porta
EXPOSE 8001

# Comando de inicialização
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]