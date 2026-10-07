# Servicio B: API Flask.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3000

# Python atiende SIGINT (no SIGTERM) para cerrar el servidor de Flask; así
# "docker-compose down" detiene el contenedor al instante en vez de esperar 10 s.
STOPSIGNAL SIGINT

# app.py escucha en 0.0.0.0:3000
CMD ["python", "app.py"]
