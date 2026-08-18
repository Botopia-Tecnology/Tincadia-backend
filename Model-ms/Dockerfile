# Usamos una imagen base ligera de Python 3.10 para soportar LiveKit moderno
FROM python:3.10-slim

# Evita que Python genere archivos .pyc y habilita logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instalar dependencias del sistema necesarias para OpenCV, MediaPipe y LiveKit
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    python3-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar requirements primero para aprovechar caché de Docker
COPY requirements_lsc.txt .

# Instalar dependencias de Python
# Instalamos la versión CPU de Torch para ahorrar espacio.
# Usamos --extra-index-url (no --index-url) para que pip pueda resolver las
# dependencias de build (typing-extensions, flit_core) desde PyPI; con
# --index-url quedaba restringido al índice de PyTorch y el build fallaba.
RUN pip install --no-cache-dir torch==2.1.0+cpu --extra-index-url https://download.pytorch.org/whl/cpu

# Instalar el resto de las dependencias
RUN pip install --no-cache-dir -r requirements_lsc.txt

# Copiar el resto del código
COPY . .

# Exponer el puerto 8000
EXPOSE 8000

# Cambiar al directorio donde está el código fuente y los modelos
WORKDIR /app/app

# Comando para ejecutar la aplicación
CMD ["python", "main.py"]
