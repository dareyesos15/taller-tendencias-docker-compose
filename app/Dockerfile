# Servicio B: API Flask.
# TODO: el código (app.py) aún no existe; esta imagen base es un valor por defecto.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3000

# TODO: requiere app/app.py (debe escuchar en 0.0.0.0:3000)
CMD ["python", "app.py"]
