require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const helmet  = require('helmet');

const app = express();

// 1. Ocultamos la cabecera que divulga el uso de Express
app.disable('x-powered-by');

// 2. Configuración Helmet para inyectar CSP, Anti-Clickjacking y X-Content-Type-Options
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Permitimos 'unsafe-inline' para que corra el JS del HTML lineal
      scriptSrc:  ["'self'", "'unsafe-inline'"], 
      // Permitimos 'unsafe-inline' para los estilos lineales de CSS
      styleSrc:   ["'self'", "'unsafe-inline'"],
      // Permitimos imágenes o elementos incrustados con datos en Base64 (data:)
      mediaSrc:   ["'self'", "data:"],
      imgSrc:     ["'self'", "data:"]
    }
  }
}));

// 3. Configurar CORS de forma restrictiva con tu lista blanca
const listaBlanca = ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: function (origin, callback) {
    // Añadimos 'null' por si abres archivos HTML directos en el navegador
    if (!origin || origin === 'null' || listaBlanca.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por políticas de CORS'));
    }
  }
}));

// ── Middlewares de procesamiento de datos ─────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos (frontend) ─────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API ───────────────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ── Rutas del frontend (SPA-like) ─────────────────────────────
app.get('/pages/*', (req, res) => {
  const page = req.params[0];
  const safePage = path.basename(page); 
  res.sendFile(path.join(__dirname, '../frontend/pages', safePage));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Iniciar servidor ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 VentaXpress corriendo en http://localhost:${PORT}`);
  console.log(`📦 API disponible en http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend en http://localhost:${PORT}\n`);
});
