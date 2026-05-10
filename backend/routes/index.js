const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');

const auth     = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const prodCtrl = require('../controllers/productosController');
const pedCtrl  = require('../controllers/pedidosController');
const admCtrl  = require('../controllers/adminController');

// ── Multer (imágenes de productos) ───────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname,'../../frontend/img/productos')),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `prod_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo imágenes.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ════════════════════════════════════════
// RUTAS DE AUTENTICACIÓN
// ════════════════════════════════════════
router.post('/auth/registro',            authCtrl.registro);
router.post('/auth/login',               authCtrl.login);
router.post('/auth/logout',              auth.verificarToken, authCtrl.logout);
router.get ('/auth/perfil',              auth.verificarToken, authCtrl.perfil);
router.put ('/auth/perfil',              auth.verificarToken, authCtrl.actualizarPerfil);
router.put ('/auth/cambiar-password',    auth.verificarToken, authCtrl.cambiarPassword);
router.get ('/auth/sesiones',            auth.verificarToken, authCtrl.sesionesActivas);
router.delete('/auth/sesiones/:id',      auth.verificarToken, authCtrl.cerrarSesion);
router.post('/auth/recuperar',           authCtrl.solicitarRecuperacion);
router.post('/auth/restablecer',         authCtrl.restablecerPassword);

// ════════════════════════════════════════
// RUTAS DE PRODUCTOS (públicas)
// ════════════════════════════════════════
router.get('/productos',                 prodCtrl.listar);
router.get('/productos/destacados',      prodCtrl.destacados);
router.get('/productos/categorias',      prodCtrl.categorias);
router.get('/productos/:id',             prodCtrl.detalle);

// ════════════════════════════════════════
// RUTAS DE PRODUCTOS (vendedor/admin)
// ════════════════════════════════════════
router.get ('/vendedor/productos',       auth.verificarToken, auth.soloVendedor, prodCtrl.misProductos);
router.post('/vendedor/productos',       auth.verificarToken, auth.soloVendedor, upload.single('imagen'), prodCtrl.crear);
router.put ('/vendedor/productos/:id',   auth.verificarToken, auth.soloVendedor, prodCtrl.actualizar);

// ════════════════════════════════════════
// RUTAS DE PEDIDOS
// ════════════════════════════════════════
router.post('/pedidos',                  auth.verificarToken, auth.soloCliente, pedCtrl.crear);
router.get ('/pedidos/mis-pedidos',      auth.verificarToken, auth.soloCliente, pedCtrl.misPedidos);
router.get ('/pedidos/vendedor',         auth.verificarToken, auth.soloVendedor, pedCtrl.pedidosVendedor);
router.put ('/pedidos/:id/estado',       auth.verificarToken, auth.soloVendedor, pedCtrl.actualizarEstado);

// ════════════════════════════════════════
// RUTAS DE ADMINISTRACIÓN
// ════════════════════════════════════════
router.get ('/admin/usuarios',           auth.verificarToken, auth.soloAdmin, admCtrl.listarUsuarios);
router.put ('/admin/usuarios/:id/toggle',auth.verificarToken, auth.soloAdmin, admCtrl.toggleUsuario);
router.put ('/admin/usuarios/:id/rol',   auth.verificarToken, auth.soloAdmin, admCtrl.cambiarRol);
router.get ('/admin/estadisticas',       auth.verificarToken, auth.soloAdmin, admCtrl.estadisticas);
router.get ('/admin/pedidos',            auth.verificarToken, auth.soloAdmin, pedCtrl.todos);
router.get ('/admin/productos',          auth.verificarToken, auth.soloAdmin, prodCtrl.todos);

module.exports = router;
