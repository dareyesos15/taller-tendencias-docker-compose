-- Script de inicialización. Se ejecuta automáticamente la primera vez que arranca
-- el contenedor (volumen vacío). La base de datos ya la crea PostgreSQL a partir
-- de POSTGRES_DB, por eso aquí no hay CREATE DATABASE.

CREATE TABLE categorias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE clientes (
    id         SERIAL PRIMARY KEY,
    nombre     VARCHAR(120) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    ciudad     VARCHAR(100),
    creado_en  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE productos (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(150) NOT NULL,
    precio       NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    categoria_id INTEGER NOT NULL REFERENCES categorias (id) ON DELETE RESTRICT
);

CREATE TABLE pedidos (
    id         SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
    fecha      TIMESTAMP NOT NULL DEFAULT NOW(),
    estado     VARCHAR(20) NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente', 'enviado', 'entregado', 'cancelado'))
);

CREATE TABLE detalle_pedido (
    id              SERIAL PRIMARY KEY,
    pedido_id       INTEGER NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
    producto_id     INTEGER NOT NULL REFERENCES productos (id) ON DELETE RESTRICT,
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0)
);

CREATE INDEX idx_productos_categoria ON productos (categoria_id);
CREATE INDEX idx_pedidos_cliente ON pedidos (cliente_id);
CREATE INDEX idx_detalle_pedido ON detalle_pedido (pedido_id);

-- Datos de ejemplo -----------------------------------------------------------

INSERT INTO categorias (nombre, descripcion) VALUES
    ('Electrónica', 'Dispositivos y accesorios electrónicos'),
    ('Hogar', 'Artículos para el hogar'),
    ('Libros', 'Libros impresos y digitales'),
    ('Deportes', 'Equipamiento deportivo'),
    ('Juguetes', 'Juguetes y juegos');

INSERT INTO clientes (nombre, email, ciudad) VALUES
    ('Ana Gómez', 'ana.gomez@example.com', 'Manizales'),
    ('Carlos Ruiz', 'carlos.ruiz@example.com', 'Bogotá'),
    ('Laura Pérez', 'laura.perez@example.com', 'Medellín'),
    ('Jorge Martínez', 'jorge.martinez@example.com', 'Cali'),
    ('Sofía Torres', 'sofia.torres@example.com', 'Pereira'),
    ('Miguel Ángel Díaz', 'miguel.diaz@example.com', 'Manizales');

INSERT INTO productos (nombre, precio, stock, categoria_id) VALUES
    ('Audífonos Bluetooth', 89900.00, 40, 1),
    ('Teclado mecánico', 159900.00, 25, 1),
    ('Lámpara de escritorio', 45000.00, 60, 2),
    ('Juego de sábanas', 120000.00, 30, 2),
    ('Cien años de soledad', 52000.00, 80, 3),
    ('Balón de fútbol', 75000.00, 50, 4),
    ('Rompecabezas 1000 piezas', 38000.00, 35, 5);

INSERT INTO pedidos (cliente_id, fecha, estado) VALUES
    (1, NOW() - INTERVAL '10 days', 'entregado'),
    (2, NOW() - INTERVAL '7 days', 'enviado'),
    (3, NOW() - INTERVAL '5 days', 'pendiente'),
    (4, NOW() - INTERVAL '3 days', 'cancelado'),
    (5, NOW() - INTERVAL '1 day', 'pendiente');

INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES
    (1, 1, 1, 89900.00),
    (1, 5, 2, 52000.00),
    (2, 2, 1, 159900.00),
    (3, 3, 2, 45000.00),
    (3, 4, 1, 120000.00),
    (4, 6, 1, 75000.00),
    (5, 7, 3, 38000.00),
    (5, 5, 1, 52000.00);
