-- ============================================================
--  VentaXpress — Base de Datos
--  MySQL 8.0+
--  Ejecutar con: mysql -u root -p < ventaxpress.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS ventaxpress
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ventaxpress;

-- ─────────────────────────────────────────
-- TABLA: roles
-- ─────────────────────────────────────────
CREATE TABLE roles (
  id        TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (nombre) VALUES ('cliente'), ('vendedor'), ('admin');

-- ─────────────────────────────────────────
-- TABLA: usuarios
-- ─────────────────────────────────────────
CREATE TABLE usuarios (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100) NOT NULL,
  correo          VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  rol_id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  telefono        VARCHAR(20),
  foto_perfil     VARCHAR(255) DEFAULT 'default.png',
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  mfa_activo      TINYINT(1) NOT NULL DEFAULT 0,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- TABLA: sesiones
-- ─────────────────────────────────────────
CREATE TABLE sesiones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED NOT NULL,
  token           VARCHAR(500) NOT NULL,
  dispositivo     VARCHAR(200),
  ip              VARCHAR(45),
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en       DATETIME NOT NULL,
  activa          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- TABLA: recuperacion_password
-- ─────────────────────────────────────────
CREATE TABLE recuperacion_password (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED NOT NULL,
  token       VARCHAR(100) NOT NULL UNIQUE,
  expira_en   DATETIME NOT NULL,
  usado       TINYINT(1) NOT NULL DEFAULT 0,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- TABLA: categorias
-- ─────────────────────────────────────────
CREATE TABLE categorias (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(80) NOT NULL UNIQUE,
  slug      VARCHAR(80) NOT NULL UNIQUE,
  icono     VARCHAR(10) DEFAULT '📦'
) ENGINE=InnoDB;

INSERT INTO categorias (nombre, slug, icono) VALUES
  ('Electrónica',   'electronica',  '💻'),
  ('Ropa',          'ropa',         '👕'),
  ('Hogar',         'hogar',        '🏠'),
  ('Deportes',      'deportes',     '⚽'),
  ('Juguetes',      'juguetes',     '🧸'),
  ('Libros',        'libros',       '📚');

-- ─────────────────────────────────────────
-- TABLA: productos
-- ─────────────────────────────────────────
CREATE TABLE productos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendedor_id     INT UNSIGNED NOT NULL,
  categoria_id    INT UNSIGNED NOT NULL,
  nombre          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  precio          DECIMAL(10,2) NOT NULL,
  stock           INT UNSIGNED NOT NULL DEFAULT 0,
  imagen          VARCHAR(255) DEFAULT 'producto-default.png',
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  destacado       TINYINT(1) NOT NULL DEFAULT 0,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendedor_id)  REFERENCES usuarios(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  FULLTEXT KEY ft_productos (nombre, descripcion)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- TABLA: pedidos
-- ─────────────────────────────────────────
CREATE TABLE pedidos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id      INT UNSIGNED NOT NULL,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado          ENUM('pendiente','confirmado','enviado','entregado','cancelado')
                  NOT NULL DEFAULT 'pendiente',
  direccion       TEXT,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- TABLA: pedido_items
-- ─────────────────────────────────────────
CREATE TABLE pedido_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id     INT UNSIGNED NOT NULL,
  producto_id   INT UNSIGNED NOT NULL,
  cantidad      INT UNSIGNED NOT NULL,
  precio_unit   DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- DATOS DE PRUEBA
-- ─────────────────────────────────────────
-- Contraseñas hasheadas con bcrypt (todas son "Password123!")
-- Hash generado con bcrypt rounds=10

INSERT INTO usuarios (nombre, apellido, correo, password_hash, rol_id, telefono) VALUES
('Admin',    'Sistema',   'admin@ventaxpress.com',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, '555-0001'),
('María',    'González',  'vendedor@ventaxpress.com',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 2, '555-0002'),
('Carlos',   'Ramírez',   'cliente@ventaxpress.com',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, '555-0003');

INSERT INTO productos (vendedor_id, categoria_id, nombre, descripcion, precio, stock, destacado) VALUES
(2, 1, 'Laptop Gaming X1',      'Procesador i7, 16GB RAM, SSD 512GB, pantalla 15.6" FHD',   15999.00, 10, 1),
(2, 1, 'Smartphone Pro Max',    'Pantalla AMOLED 6.7", cámara 108MP, batería 5000mAh',        8499.00,  25, 1),
(2, 1, 'Auriculares Bluetooth', 'Cancelación de ruido activa, 30h batería, plegables',         1299.00,  50, 0),
(2, 1, 'Monitor 4K 27"',        'Panel IPS, HDR400, 144Hz, compatible con USB-C',              5499.00,  15, 1),
(2, 2, 'Playera Deportiva',     '100% poliéster reciclado, secado rápido, tallas S-XXL',        399.00, 100, 0),
(2, 2, 'Sudadera Premium',      'Algodón orgánico, interior afelpado, bolsa canguro',            899.00,  60, 0),
(2, 3, 'Lámpara LED Inteligente','Control por app, 16M colores, compatible Alexa y Google',      799.00,  40, 0),
(2, 3, 'Robot Aspirador',       'Mapeo láser, vaciado automático, 180min autonomía',            4999.00,   8, 1),
(2, 4, 'Bicicleta Montaña 29"', '21 velocidades, frenos hidráulicos, cuadro aluminio',         5999.00,   5, 0),
(2, 5, 'LEGO Technic',          'Set 1200 piezas, incluye motor, para mayores de 10 años',     1899.00,  20, 0),
(2, 6, 'Clean Code',            'Robert C. Martin — Guía para escribir código profesional',     549.00,  30, 0),
(2, 6, 'JavaScript: The Good Parts','Douglas Crockford — Referencia clásica de JS',            399.00,  30, 0);
