require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Middlewares ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos (frontend) ─────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API ───────────────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ── Rutas del frontend (SPA-like) ─────────────────────────────
app.get('/pages/*', (req, res) => {
  const page = req.params[0];
  res.sendFile(path.join(__dirname, '../frontend/pages', page));
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
