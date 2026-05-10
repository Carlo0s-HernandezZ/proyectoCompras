const db = require('../config/db');

// ── LISTAR USUARIOS ───────────────────────────────────────────
async function listarUsuarios(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.correo, u.telefono,
              u.activo, u.creado_en, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       ORDER BY u.creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
}

// ── ACTIVAR / DESACTIVAR USUARIO ──────────────────────────────
async function toggleUsuario(req, res) {
  try {
    await db.query(
      'UPDATE usuarios SET activo = NOT activo WHERE id = ?', [req.params.id]
    );
    const [[u]] = await db.query('SELECT activo FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ activo: u.activo, mensaje: u.activo ? 'Usuario activado.' : 'Usuario desactivado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
}

// ── CAMBIAR ROL ───────────────────────────────────────────────
async function cambiarRol(req, res) {
  const { rol } = req.body;
  const roles = { cliente: 1, vendedor: 2, admin: 3 };
  if (!roles[rol]) return res.status(400).json({ error: 'Rol inválido.' });

  try {
    await db.query('UPDATE usuarios SET rol_id = ? WHERE id = ?', [roles[rol], req.params.id]);
    res.json({ mensaje: 'Rol actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar rol.' });
  }
}

// ── ESTADÍSTICAS ──────────────────────────────────────────────
async function estadisticas(req, res) {
  try {
    const [[{ total_usuarios }]] = await db.query('SELECT COUNT(*) AS total_usuarios FROM usuarios WHERE activo=1');
    const [[{ total_productos }]] = await db.query('SELECT COUNT(*) AS total_productos FROM productos WHERE activo=1');
    const [[{ total_pedidos }]]  = await db.query('SELECT COUNT(*) AS total_pedidos FROM pedidos');
    const [[{ ingresos }]]       = await db.query(
      "SELECT COALESCE(SUM(total),0) AS ingresos FROM pedidos WHERE estado != 'cancelado'"
    );
    res.json({ total_usuarios, total_productos, total_pedidos, ingresos });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
}

module.exports = { listarUsuarios, toggleUsuario, cambiarRol, estadisticas };
