const db = require('../config/db');

// ── CREAR PEDIDO ──────────────────────────────────────────────
async function crear(req, res) {
  const { items, direccion } = req.body;
  // items: [{ producto_id, cantidad }]
  if (!items || !items.length)
    return res.status(400).json({ error: 'El carrito está vacío.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    const detalles = [];

    for (const item of items) {
      const [[prod]] = await conn.query(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1',
        [item.producto_id]
      );
      if (!prod)
        throw new Error(`Producto ${item.producto_id} no encontrado.`);
      if (prod.stock < item.cantidad)
        throw new Error(`Stock insuficiente para "${prod.nombre}".`);

      total += prod.precio * item.cantidad;
      detalles.push({ ...item, precio_unit: prod.precio });
    }

    const [pedido] = await conn.query(
      'INSERT INTO pedidos (cliente_id, total, direccion) VALUES (?,?,?)',
      [req.usuario.id, total, direccion || '']
    );

    for (const d of detalles) {
      await conn.query(
        'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unit) VALUES (?,?,?,?)',
        [pedido.insertId, d.producto_id, d.cantidad, d.precio_unit]
      );
      await conn.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [d.cantidad, d.producto_id]
      );
    }

    await conn.commit();
    res.status(201).json({ mensaje: 'Pedido creado.', id: pedido.insertId, total });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ error: err.message || 'Error al crear pedido.' });
  } finally {
    conn.release();
  }
}

// ── MIS PEDIDOS (cliente) ─────────────────────────────────────
async function misPedidos(req, res) {
  try {
    const [pedidos] = await db.query(
      `SELECT p.id, p.total, p.estado, p.creado_en, p.direccion,
              COUNT(pi.id) AS num_items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       WHERE p.cliente_id = ?
       GROUP BY p.id
       ORDER BY p.creado_en DESC`,
      [req.usuario.id]
    );

    for (const ped of pedidos) {
      const [items] = await db.query(
        `SELECT pi.cantidad, pi.precio_unit,
                pr.nombre, pr.imagen
         FROM pedido_items pi
         JOIN productos pr ON pr.id = pi.producto_id
         WHERE pi.pedido_id = ?`,
        [ped.id]
      );
      ped.items = items;
    }

    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
}

// ── PEDIDOS DEL VENDEDOR ──────────────────────────────────────
async function pedidosVendedor(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT ped.id, ped.estado, ped.creado_en, ped.total,
              CONCAT(u.nombre,' ',u.apellido) AS cliente
       FROM pedidos ped
       JOIN pedido_items pi ON pi.pedido_id = ped.id
       JOIN productos pr    ON pr.id = pi.producto_id
       JOIN usuarios u      ON u.id  = ped.cliente_id
       WHERE pr.vendedor_id = ?
       ORDER BY ped.creado_en DESC`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
}

// ── TODOS LOS PEDIDOS (admin) ─────────────────────────────────
async function todos(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT ped.id, ped.total, ped.estado, ped.creado_en,
              CONCAT(u.nombre,' ',u.apellido) AS cliente,
              u.correo
       FROM pedidos ped
       JOIN usuarios u ON u.id = ped.cliente_id
       ORDER BY ped.creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
}

// ── ACTUALIZAR ESTADO (admin/vendedor) ────────────────────────
async function actualizarEstado(req, res) {
  const { estado } = req.body;
  const estados = ['pendiente','confirmado','enviado','entregado','cancelado'];
  if (!estados.includes(estado))
    return res.status(400).json({ error: 'Estado inválido.' });

  try {
    await db.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ mensaje: 'Estado actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
}

module.exports = { crear, misPedidos, pedidosVendedor, todos, actualizarEstado };
