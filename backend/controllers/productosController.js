const db = require('../config/db');

// ── LISTAR PRODUCTOS (con filtros y búsqueda) ────────────────
async function listar(req, res) {
  const { q, categoria, minPrecio, maxPrecio, pagina = 1, limite = 12 } = req.query;
  const offset = (pagina - 1) * limite;
  const params = [];
  let where = 'WHERE p.activo = 1';

  if (q) {
    where += ' AND MATCH(p.nombre, p.descripcion) AGAINST(? IN BOOLEAN MODE)';
    params.push(q + '*');
  }
  if (categoria) {
    where += ' AND c.slug = ?';
    params.push(categoria);
  }
  if (minPrecio) { where += ' AND p.precio >= ?'; params.push(minPrecio); }
  if (maxPrecio) { where += ' AND p.precio <= ?'; params.push(maxPrecio); }

  try {
    const [productos] = await db.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.imagen,
              p.destacado, p.creado_en,
              c.nombre AS categoria, c.slug AS categoria_slug,
              CONCAT(u.nombre,' ',u.apellido) AS vendedor
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
       JOIN usuarios   u ON u.id = p.vendedor_id
       ${where}
       ORDER BY p.destacado DESC, p.creado_en DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limite), Number(offset)]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM productos p
       JOIN categorias c ON c.id = p.categoria_id ${where}`,
      params
    );

    res.json({ productos, total, pagina: Number(pagina), limite: Number(limite) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
}

// ── DESTACADOS (para carrusel portada) ───────────────────────
async function destacados(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.nombre, p.precio, p.imagen,
              c.nombre AS categoria
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
       WHERE p.activo = 1 AND p.destacado = 1
       ORDER BY p.creado_en DESC LIMIT 5`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener destacados.' });
  }
}

// ── DETALLE DE PRODUCTO ───────────────────────────────────────
async function detalle(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.nombre AS categoria, c.slug AS categoria_slug,
              CONCAT(u.nombre,' ',u.apellido) AS vendedor
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
       JOIN usuarios   u ON u.id = p.vendedor_id
       WHERE p.id = ? AND p.activo = 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto.' });
  }
}

// ── CATEGORÍAS ────────────────────────────────────────────────
async function categorias(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías.' });
  }
}

// ── CREAR PRODUCTO (vendedor/admin) ───────────────────────────
async function crear(req, res) {
  const { nombre, descripcion, precio, stock, categoria_id, destacado } = req.body;
  if (!nombre || !precio || !categoria_id)
    return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios.' });

  try {
    const imagen = req.file ? req.file.filename : 'producto-default.png';
    const [result] = await db.query(
      `INSERT INTO productos (vendedor_id, categoria_id, nombre, descripcion,
                              precio, stock, imagen, destacado)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.usuario.id, categoria_id, nombre, descripcion, precio,
       stock || 0, imagen, destacado ? 1 : 0]
    );
    res.status(201).json({ mensaje: 'Producto creado.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto.' });
  }
}

// ── ACTUALIZAR PRODUCTO ───────────────────────────────────────
async function actualizar(req, res) {
  const { nombre, descripcion, precio, stock, categoria_id, destacado, activo } = req.body;
  const esAdmin = req.usuario.rol === 'admin';

  try {
    // Verificar que el producto pertenece al vendedor (o es admin)
    const [rows] = await db.query('SELECT vendedor_id FROM productos WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    if (!esAdmin && rows[0].vendedor_id !== req.usuario.id)
      return res.status(403).json({ error: 'No tienes permiso para editar este producto.' });

    await db.query(
      `UPDATE productos SET nombre=?, descripcion=?, precio=?, stock=?,
                           categoria_id=?, destacado=?, activo=?
       WHERE id=?`,
      [nombre, descripcion, precio, stock, categoria_id,
       destacado ? 1 : 0, activo !== undefined ? activo : 1, req.params.id]
    );
    res.json({ mensaje: 'Producto actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar producto.' });
  }
}

// ── MIS PRODUCTOS (vendedor) ──────────────────────────────────
async function misProductos(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.nombre AS categoria
       FROM productos p JOIN categorias c ON c.id = p.categoria_id
       WHERE p.vendedor_id = ?
       ORDER BY p.creado_en DESC`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
}

// ── TODOS LOS PRODUCTOS (admin) ───────────────────────────────
async function todos(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.nombre AS categoria,
              CONCAT(u.nombre,' ',u.apellido) AS vendedor
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
       JOIN usuarios   u ON u.id = p.vendedor_id
       ORDER BY p.creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
}

module.exports = { listar, destacados, detalle, categorias, crear, actualizar, misProductos, todos };
