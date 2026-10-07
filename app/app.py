"""Servicio B: API REST en Flask con operaciones CRUD sobre PostgreSQL.

Las credenciales se leen únicamente de variables de entorno (definidas en .env y
pasadas por docker-compose). No hay esperas activas por la base de datos: el
servicio arranca cuando el healthcheck de "db" ya está en estado healthy y abre
una conexión nueva en cada petición.
"""
import os
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal

import psycopg2
from flask import Flask, jsonify, request
from flask_cors import CORS
from psycopg2 import errors, sql
from psycopg2.extras import RealDictCursor
from werkzeug.exceptions import HTTPException

DB_CONFIG = {
    "host": os.environ["DB_HOST"],
    "port": os.environ["DB_PORT"],
    "dbname": os.environ["DB_NAME"],
    "user": os.environ["DB_USER"],
    "password": os.environ["DB_PASSWORD"],
    "connect_timeout": 5,
}

# Entidades expuestas por la API: columnas editables y obligatorias al crear.
# Coinciden con las tablas de app/init-db/01-init.sql.
RESOURCES = {
    "categorias": {
        "columns": ["nombre", "descripcion"],
        "required": ["nombre"],
    },
    "clientes": {
        "columns": ["nombre", "email", "ciudad"],
        "required": ["nombre", "email"],
    },
    "productos": {
        "columns": ["nombre", "precio", "stock", "categoria_id"],
        "required": ["nombre", "precio", "categoria_id"],
    },
    "pedidos": {
        "columns": ["cliente_id", "estado"],
        "required": ["cliente_id"],
    },
    "detalle_pedido": {
        "columns": ["pedido_id", "producto_id", "cantidad", "precio_unitario"],
        "required": ["pedido_id", "producto_id", "cantidad", "precio_unitario"],
    },
}

app = Flask(__name__, static_folder=None)
app.json.ensure_ascii = False  # tildes y eñes legibles en las respuestas
app.json.sort_keys = False
CORS(app)

# Se llena al registrar las rutas y se muestra en GET /
ENDPOINTS = []


@contextmanager
def get_cursor():
    """Abre una conexión por petición; hace commit al salir o rollback si hay error."""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
    finally:
        conn.close()


def serialize(row):
    """Convierte tipos de PostgreSQL que JSON no maneja directamente."""
    result = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            value = float(value)
        elif isinstance(value, (datetime, date)):
            value = value.isoformat()
        result[key] = value
    return result


def error(message, status, detail=None):
    body = {"error": message}
    if detail:
        body["detalle"] = detail
    return jsonify(body), status


def read_body(columns):
    """Devuelve solo los campos permitidos del cuerpo JSON, o None si no es un objeto."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return {key: value for key, value in data.items() if key in columns}


def register_crud(table, columns, required):
    """Registra GET (lista y detalle), POST, PUT/PATCH y DELETE para una tabla."""
    table_sql = sql.Identifier(table)

    def list_items():
        with get_cursor() as cur:
            cur.execute(sql.SQL("SELECT * FROM {} ORDER BY id").format(table_sql))
            return jsonify([serialize(row) for row in cur.fetchall()])

    def get_item(item_id):
        with get_cursor() as cur:
            cur.execute(sql.SQL("SELECT * FROM {} WHERE id = %s").format(table_sql), (item_id,))
            row = cur.fetchone()
        if row is None:
            return error(f"No existe el registro {item_id} en {table}", 404)
        return jsonify(serialize(row))

    def create_item():
        data = read_body(columns)
        if data is None:
            return error("El cuerpo debe ser un objeto JSON", 400)
        missing = [col for col in required if data.get(col) in (None, "")]
        if missing:
            return error("Faltan campos obligatorios", 400, missing)

        fields = list(data)
        query = sql.SQL("INSERT INTO {} ({}) VALUES ({}) RETURNING *").format(
            table_sql,
            sql.SQL(", ").join(map(sql.Identifier, fields)),
            sql.SQL(", ").join(sql.Placeholder() * len(fields)),
        )
        with get_cursor() as cur:
            cur.execute(query, [data[field] for field in fields])
            return jsonify(serialize(cur.fetchone())), 201

    def update_item(item_id):
        data = read_body(columns)
        if data is None:
            return error("El cuerpo debe ser un objeto JSON", 400)
        if not data:
            return error("No se envió ningún campo para actualizar", 400, columns)

        fields = list(data)
        query = sql.SQL("UPDATE {} SET {} WHERE id = %s RETURNING *").format(
            table_sql,
            sql.SQL(", ").join(
                sql.SQL("{} = %s").format(sql.Identifier(field)) for field in fields
            ),
        )
        with get_cursor() as cur:
            cur.execute(query, [data[field] for field in fields] + [item_id])
            row = cur.fetchone()
        if row is None:
            return error(f"No existe el registro {item_id} en {table}", 404)
        return jsonify(serialize(row))

    def delete_item(item_id):
        with get_cursor() as cur:
            cur.execute(
                sql.SQL("DELETE FROM {} WHERE id = %s RETURNING id").format(table_sql),
                (item_id,),
            )
            row = cur.fetchone()
        if row is None:
            return error(f"No existe el registro {item_id} en {table}", 404)
        return jsonify({"mensaje": f"Registro {item_id} eliminado de {table}", "id": item_id})

    collection = f"/{table}"
    item = f"/{table}/<int:item_id>"
    app.add_url_rule(collection, f"{table}_list", list_items, methods=["GET"])
    app.add_url_rule(collection, f"{table}_create", create_item, methods=["POST"])
    app.add_url_rule(item, f"{table}_get", get_item, methods=["GET"])
    app.add_url_rule(item, f"{table}_update", update_item, methods=["PUT", "PATCH"])
    app.add_url_rule(item, f"{table}_delete", delete_item, methods=["DELETE"])

    ENDPOINTS.extend([
        {"metodo": "GET", "ruta": collection, "descripcion": f"Lista todos los registros de {table}"},
        {"metodo": "POST", "ruta": collection, "descripcion": f"Crea un registro en {table}",
         "campos": columns, "obligatorios": required},
        {"metodo": "GET", "ruta": f"/{table}/<id>", "descripcion": f"Obtiene un registro de {table} por id"},
        {"metodo": "PUT | PATCH", "ruta": f"/{table}/<id>", "descripcion": f"Actualiza los campos enviados de un registro de {table}",
         "campos": columns},
        {"metodo": "DELETE", "ruta": f"/{table}/<id>", "descripcion": f"Elimina un registro de {table}"},
    ])


for name, config in RESOURCES.items():
    register_crud(name, config["columns"], config["required"])


@app.get("/")
def index():
    return jsonify({
        "servicio": "API REST - Taller Tendencias (Docker Compose)",
        "endpoints": [
            {"metodo": "GET", "ruta": "/", "descripcion": "Lista los endpoints disponibles"},
            {"metodo": "GET", "ruta": "/health", "descripcion": "Verifica la conexión con la base de datos"},
            *ENDPOINTS,
        ],
    })


@app.get("/health")
def health():
    with get_cursor() as cur:
        cur.execute("SELECT 1")
    return jsonify({"estado": "ok", "base_de_datos": "conectada"})


# --- Manejo de errores: siempre se responde en JSON -------------------------

@app.errorhandler(HTTPException)
def http_error(exc):
    return error(exc.description, exc.code)


@app.errorhandler(errors.UniqueViolation)
def unique_violation(exc):
    return error("Ya existe un registro con ese valor único", 409, exc.diag.message_detail)


@app.errorhandler(errors.ForeignKeyViolation)
def foreign_key_violation(exc):
    return error(
        "La operación viola una relación entre tablas: el registro referenciado "
        "no existe o el registro está siendo usado por otra tabla",
        409,
        exc.diag.message_detail,
    )


@app.errorhandler(errors.DataError)
@app.errorhandler(errors.IntegrityError)
def invalid_data(exc):
    return error("Datos inválidos", 400, exc.diag.message_primary)


@app.errorhandler(psycopg2.OperationalError)
def database_unavailable(exc):
    return error("No se pudo conectar con la base de datos", 503)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)