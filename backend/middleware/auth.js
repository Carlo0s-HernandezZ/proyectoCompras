const jwt = require('jsonwebtoken');

// ── Verificar token JWT ──────────────────────────────────────
function verificarToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];

  if (!token)
    return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;   // { id, nombre, rol }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

// ── Verificar rol específico ─────────────────────────────────
function soloRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol))
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}.`
      });
    next();
  };
}

const soloAdmin    = soloRol('admin');
const soloVendedor = soloRol('vendedor', 'admin');
const soloCliente  = soloRol('cliente', 'vendedor', 'admin');

module.exports = { verificarToken, soloRol, soloAdmin, soloVendedor, soloCliente };
