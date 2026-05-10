const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../config/db');
const mailer   = require('../config/mailer');

// ── REGISTRO ─────────────────────────────────────────────────
async function registro(req, res) {
  const { nombre, apellido, correo, password, telefono } = req.body;

  if (!nombre || !apellido || !correo || !password)
    return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos.' });

  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  try {
    const [existe] = await db.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
    if (existe.length)
      return res.status(409).json({ error: 'El correo ya está registrado.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, apellido, correo, password_hash, telefono) VALUES (?,?,?,?,?)',
      [nombre, apellido, correo, hash, telefono || null]
    );

    const token = _generarToken({ id: result.insertId, nombre, rol: 'cliente' });
    res.status(201).json({ mensaje: 'Usuario registrado correctamente.', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ── LOGIN ────────────────────────────────────────────────────
async function login(req, res) {
  const { correo, password } = req.body;

  if (!correo || !password)
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.correo, u.password_hash,
              u.activo, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.correo = ?`,
      [correo]
    );

    if (!rows.length)
      return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const usuario = rows[0];

    if (!usuario.activo)
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' });

    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok)
      return res.status(401).json({ error: 'Credenciales incorrectas.' });

    // Guardar sesión en BD
    const token = _generarToken({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const ip = req.ip || req.socket?.remoteAddress;
    const dispositivo = req.headers['user-agent']?.substring(0, 200) || 'desconocido';

    await db.query(
      'INSERT INTO sesiones (usuario_id, token, dispositivo, ip, expira_en) VALUES (?,?,?,?,?)',
      [usuario.id, token, dispositivo, ip, expira]
    );

    res.json({
      token,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        correo:   usuario.correo,
        rol:      usuario.rol
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ── LOGOUT ───────────────────────────────────────────────────
async function logout(req, res) {
  const auth  = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (token)
    await db.query('UPDATE sesiones SET activa = 0 WHERE token = ?', [token]);
  res.json({ mensaje: 'Sesión cerrada.' });
}

// ── SESIONES ACTIVAS ─────────────────────────────────────────
async function sesionesActivas(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, dispositivo, ip, creado_en, expira_en
       FROM sesiones
       WHERE usuario_id = ? AND activa = 1 AND expira_en > NOW()
       ORDER BY creado_en DESC`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sesiones.' });
  }
}

// ── CERRAR SESIÓN ESPECÍFICA ─────────────────────────────────
async function cerrarSesion(req, res) {
  try {
    await db.query(
      'UPDATE sesiones SET activa = 0 WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensaje: 'Sesión cerrada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar sesión.' });
  }
}

// ── SOLICITAR RECUPERACIÓN DE PASSWORD ───────────────────────
async function solicitarRecuperacion(req, res) {
  const { correo } = req.body;
  if (!correo)
    return res.status(400).json({ error: 'El correo es requerido.' });

  try {
    const [rows] = await db.query('SELECT id, nombre FROM usuarios WHERE correo = ?', [correo]);
    // Siempre responder igual para no revelar si el correo existe
    if (!rows.length)
      return res.json({ mensaje: 'Si el correo existe, recibirás un enlace en breve.' });

    const usuario = rows[0];
    const token   = crypto.randomBytes(32).toString('hex');
    const expira  = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.query(
      'INSERT INTO recuperacion_password (usuario_id, token, expira_en) VALUES (?,?,?)',
      [usuario.id, token, expira]
    );

    const enlace = `${process.env.FRONTEND_URL}/pages/nueva-password.html?token=${token}`;
    await mailer.sendMail({
      to:      correo,
      subject: 'Recuperación de contraseña — VentaXpress',
      html:    `
        <h2>Hola ${usuario.nombre}</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${enlace}" style="background:#0D2B5E;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none">
          Restablecer contraseña
        </a></p>
        <p>Este enlace expira en 30 minutos.</p>
        <p>Si no solicitaste esto, ignora este correo.</p>
      `
    });

    res.json({ mensaje: 'Si el correo existe, recibirás un enlace en breve.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
}

// ── RESTABLECER PASSWORD ──────────────────────────────────────
async function restablecerPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: 'Token y nueva contraseña son requeridos.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  try {
    const [rows] = await db.query(
      `SELECT * FROM recuperacion_password
       WHERE token = ? AND usado = 0 AND expira_en > NOW()`,
      [token]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'Token inválido o expirado.' });

    const rec  = rows[0];
    const hash = await bcrypt.hash(password, 10);

    await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, rec.usuario_id]);
    await db.query('UPDATE recuperacion_password SET usado = 1 WHERE id = ?', [rec.id]);
    // Invalidar todas las sesiones activas del usuario
    await db.query('UPDATE sesiones SET activa = 0 WHERE usuario_id = ?', [rec.usuario_id]);

    res.json({ mensaje: 'Contraseña restablecida correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  }
}

// ── PERFIL ───────────────────────────────────────────────────
async function perfil(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.correo, u.telefono,
              u.foto_perfil, u.mfa_activo, u.creado_en, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ?`,
      [req.usuario.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil.' });
  }
}

// ── ACTUALIZAR PERFIL ─────────────────────────────────────────
async function actualizarPerfil(req, res) {
  const { nombre, apellido, telefono } = req.body;
  try {
    await db.query(
      'UPDATE usuarios SET nombre=?, apellido=?, telefono=? WHERE id=?',
      [nombre, apellido, telefono, req.usuario.id]
    );
    res.json({ mensaje: 'Perfil actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil.' });
  }
}

// ── CAMBIAR PASSWORD (autenticado) ────────────────────────────
async function cambiarPassword(req, res) {
  const { passwordActual, passwordNueva } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]
    );
    const ok = await bcrypt.compare(passwordActual, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta.' });

    const hash = await bcrypt.hash(passwordNueva, 10);
    await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, req.usuario.id]);
    res.json({ mensaje: 'Contraseña actualizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña.' });
  }
}

// ── Helper ────────────────────────────────────────────────────
function _generarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
}

module.exports = {
  registro, login, logout,
  sesionesActivas, cerrarSesion,
  solicitarRecuperacion, restablecerPassword,
  perfil, actualizarPerfil, cambiarPassword
};
