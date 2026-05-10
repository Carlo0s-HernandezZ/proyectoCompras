/* ═══════════════════════════════════════════════════════
   VentaXpress — app.js  (módulo principal)
═══════════════════════════════════════════════════════ */

const API = '/api';

/* ── Auth helpers ────────────────────────────────────── */
const Auth = {
  get token()   { return localStorage.getItem('vx_token'); },
  get usuario() {
    try { return JSON.parse(localStorage.getItem('vx_usuario')); }
    catch { return null; }
  },
  set(token, usuario) {
    localStorage.setItem('vx_token', token);
    localStorage.setItem('vx_usuario', JSON.stringify(usuario));
  },
  clear() {
    localStorage.removeItem('vx_token');
    localStorage.removeItem('vx_usuario');
  },
  get loggedIn() { return !!this.token; },
  get rol()      { return this.usuario?.rol || null; }
};

/* ── HTTP helpers ────────────────────────────────────── */
async function http(method, url, data = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers['Authorization'] = `Bearer ${Auth.token}`;

  const opts = { method, headers };
  if (data) opts.body = JSON.stringify(data);

  const res = await fetch(API + url, opts);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}
const get  = (url)       => http('GET',    url);
const post = (url, data) => http('POST',   url, data);
const put  = (url, data) => http('PUT',    url, data);
const del  = (url)       => http('DELETE', url);

/* ── Toast ───────────────────────────────────────────── */
function toast(msg, type = 'default', duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

/* ── Loader ──────────────────────────────────────────── */
function showLoader()  {
  let el = document.getElementById('loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loader';
    el.className = 'loader-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.add('active');
}
function hideLoader() {
  const el = document.getElementById('loader');
  if (el) el.classList.remove('active');
}

/* ══════════════════════════════════════════════════════
   CARRITO (en localStorage)
══════════════════════════════════════════════════════ */
const Cart = {
  _key: 'vx_cart',

  get items() {
    try { return JSON.parse(localStorage.getItem(this._key)) || []; }
    catch { return []; }
  },
  save(items) { localStorage.setItem(this._key, JSON.stringify(items)); },

  add(producto, cantidad = 1) {
    const items = this.items;
    const idx   = items.findIndex(i => i.id === producto.id);
    if (idx >= 0) {
      items[idx].cantidad = Math.min(items[idx].cantidad + cantidad, producto.stock);
    } else {
      items.push({
        id:       producto.id,
        nombre:   producto.nombre,
        precio:   producto.precio,
        imagen:   producto.imagen,
        stock:    producto.stock,
        cantidad
      });
    }
    this.save(items);
    this._updateBadge();
    toast(`✅ "${producto.nombre}" agregado al carrito`, 'success');
  },

  remove(id) {
    this.save(this.items.filter(i => i.id !== id));
    this._updateBadge();
  },

  updateQty(id, qty) {
    const items = this.items;
    const idx   = items.findIndex(i => i.id === id);
    if (idx < 0) return;
    if (qty <= 0) { this.remove(id); return; }
    items[idx].cantidad = Math.min(qty, items[idx].stock);
    this.save(items);
    this._updateBadge();
  },

  clear() { localStorage.removeItem(this._key); this._updateBadge(); },

  get total() {
    return this.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  },
  get count() {
    return this.items.reduce((s, i) => s + i.cantidad, 0);
  },

  _updateBadge() {
    const el = document.getElementById('cart-count');
    if (!el) return;
    const c = this.count;
    el.textContent = c;
    el.style.display = c > 0 ? 'flex' : 'none';
  }
};

/* ══════════════════════════════════════════════════════
   NAVBAR — renderizado dinámico según rol
══════════════════════════════════════════════════════ */
function renderNav() {
  const nav = document.getElementById('nav-links');
  if (!nav) return;

  Cart._updateBadge();

  if (!Auth.loggedIn) {
    nav.innerHTML = `
      <a href="/pages/login.html">🔐 Iniciar sesión</a>
      <a href="/pages/registro.html" class="btn-register">✏️ Registrarse</a>
      <a href="#" id="nav-cart-btn" class="cart-badge">
        🛒 <span class="cart-count" id="cart-count" style="display:none">0</span>
      </a>`;
  } else {
    const u = Auth.usuario;
    const inicial = (u?.nombre || 'U')[0].toUpperCase();
    let panelLink = '';
    if (u?.rol === 'admin')    panelLink = '<a href="/pages/admin.html">⚙️ Admin</a>';
    if (u?.rol === 'vendedor') panelLink = '<a href="/pages/vendedor.html">🏪 Mi Tienda</a>';

    nav.innerHTML = `
      <a href="#" id="nav-cart-btn" class="cart-badge">
        🛒 <span class="cart-count" id="cart-count">0</span>
      </a>
      <div class="user-menu-wrap">
        <div class="user-avatar" id="user-avatar-btn">${inicial}</div>
        <div class="user-dropdown" id="user-dropdown">
          <a href="/pages/perfil.html">👤 Mi perfil</a>
          <a href="/pages/pedidos.html">📦 Mis pedidos</a>
          ${panelLink}
          <a href="/pages/sesiones.html">🔁 Mis sesiones</a>
          <div class="sep"></div>
          <button id="btn-logout" class="danger">🚪 Cerrar sesión</button>
        </div>
      </div>`;
  }

  // Eventos
  document.getElementById('nav-cart-btn')?.addEventListener('click', e => {
    e.preventDefault(); toggleCartPanel();
  });
  document.getElementById('user-avatar-btn')?.addEventListener('click', () => {
    document.getElementById('user-dropdown')?.classList.toggle('active');
  });
  document.addEventListener('click', e => {
    const wrap = document.querySelector('.user-menu-wrap');
    if (wrap && !wrap.contains(e.target))
      document.getElementById('user-dropdown')?.classList.remove('active');
  });
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await post('/auth/logout'); } catch {}
    Auth.clear(); Cart.clear();
    toast('Sesión cerrada.'); setTimeout(() => location.href = '/', 800);
  });

  Cart._updateBadge();
}

/* ══════════════════════════════════════════════════════
   CARRITO PANEL
══════════════════════════════════════════════════════ */
function buildCartPanel() {
  if (document.getElementById('cart-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'cart-panel';
  panel.className = 'cart-panel';
  panel.innerHTML = `
    <div class="cart-panel-header">
      <h3>🛒 Tu carrito</h3>
      <button class="cart-panel-close" id="cart-close">✕</button>
    </div>
    <div class="cart-items" id="cart-items-list"></div>
    <div class="cart-footer">
      <div class="cart-total">
        <span>Total</span>
        <span id="cart-total-price">$0.00</span>
      </div>
      <button class="btn-checkout" id="btn-checkout">
        💳 Proceder al pago
      </button>
    </div>`;
  document.body.appendChild(panel);

  document.getElementById('cart-close').addEventListener('click', () =>
    panel.classList.remove('active')
  );
  document.getElementById('btn-checkout').addEventListener('click', checkout);
}

function toggleCartPanel() {
  const panel = document.getElementById('cart-panel');
  if (!panel) return;
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) renderCartItems();
}

function renderCartItems() {
  const list = document.getElementById('cart-items-list');
  const totalEl = document.getElementById('cart-total-price');
  if (!list) return;

  const items = Cart.items;
  if (!items.length) {
    list.innerHTML = `<div class="cart-empty"><div class="icon">🛒</div><p>Tu carrito está vacío</p></div>`;
    if (totalEl) totalEl.textContent = '$0.00';
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-img">
        ${item.imagen && item.imagen !== 'producto-default.png'
          ? `<img src="/img/productos/${item.imagen}" alt="${item.nombre}" onerror="this.parentElement.textContent='📦'">`
          : '📦'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        <div class="cart-item-price">
          $${Number(item.precio).toFixed(2)} × ${item.cantidad}
        </div>
        <div class="cart-item-subtotal">$${(item.precio * item.cantidad).toFixed(2)}</div>
      </div>
      <button class="cart-item-remove" data-id="${item.id}">🗑️</button>
    </div>`).join('');

  if (totalEl) totalEl.textContent = `$${Cart.total.toFixed(2)}`;

  list.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      Cart.remove(Number(btn.dataset.id));
      renderCartItems();
    });
  });
}

async function checkout() {
  if (!Auth.loggedIn) {
    toast('Debes iniciar sesión para comprar.', 'error');
    setTimeout(() => location.href = '/pages/login.html', 1000);
    return;
  }
  const items = Cart.items;
  if (!items.length) { toast('Tu carrito está vacío.', 'error'); return; }

  showLoader();
  try {
    const pedidoItems = items.map(i => ({ producto_id: i.id, cantidad: i.cantidad }));
    const res = await post('/pedidos', { items: pedidoItems, direccion: 'Por definir' });
    Cart.clear();
    renderCartItems();
    document.getElementById('cart-panel')?.classList.remove('active');
    toast(`🎉 Pedido #${res.id} creado. Total: $${res.total.toFixed(2)}`, 'success', 5000);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

/* ══════════════════════════════════════════════════════
   BÚSQUEDA desde el navbar
══════════════════════════════════════════════════════ */
function initSearch() {
  const form   = document.getElementById('search-form');
  const input  = document.getElementById('search-input');
  if (!form || !input) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) location.href = `/?q=${encodeURIComponent(q)}`;
  });
}

/* ══════════════════════════════════════════════════════
   MODAL DE PRODUCTO
══════════════════════════════════════════════════════ */
function buildProductModal() {
  if (document.getElementById('product-modal')) return;
  const el = document.createElement('div');
  el.id = 'product-modal';
  el.className = 'modal-overlay';
  el.innerHTML = `
    <div class="modal" id="modal-box">
      <div class="modal-header">
        <h3 id="modal-title">Detalle del producto</h3>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-product" id="modal-product-content"></div>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', e => { if (e.target === el) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
}

async function openProductModal(id) {
  buildProductModal();
  const overlay = document.getElementById('product-modal');
  const content = document.getElementById('modal-product-content');
  const title   = document.getElementById('modal-title');

  overlay.classList.add('active');
  content.innerHTML = '<div style="text-align:center;padding:2rem">⏳ Cargando...</div>';

  try {
    const p = await get(`/productos/${id}`);
    title.textContent = p.nombre;
    const imgHtml = p.imagen && p.imagen !== 'producto-default.png'
      ? `<img src="/img/productos/${p.imagen}" alt="${p.nombre}" onerror="this.parentElement.innerHTML='<div class=modal-product-placeholder>📦</div>'">`
      : `<div class="modal-product-placeholder">📦</div>`;

    content.innerHTML = `
      ${imgHtml}
      <div class="modal-product-info">
        <div class="product-category">${p.categoria}</div>
        <h2>${p.nombre}</h2>
        <div class="price">$${Number(p.precio).toFixed(2)}</div>
        <p class="desc">${p.descripcion || 'Sin descripción disponible.'}</p>
        <p class="product-stock ${p.stock < 5 ? 'low' : ''}">
          ${p.stock > 0 ? `📦 ${p.stock} disponibles` : '❌ Agotado'}
        </p>
        <div class="qty-control">
          <label>Cantidad:</label>
          <div class="qty-wrap">
            <button class="qty-btn" id="qty-minus">−</button>
            <span class="qty-num" id="qty-num">1</span>
            <button class="qty-btn" id="qty-plus">+</button>
          </div>
        </div>
        <button class="btn-add-cart" id="modal-add-cart" ${p.stock === 0 ? 'disabled' : ''}>
          🛒 Agregar al carrito
        </button>
      </div>`;

    let qty = 1;
    document.getElementById('qty-minus').addEventListener('click', () => {
      if (qty > 1) { qty--; document.getElementById('qty-num').textContent = qty; }
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
      if (qty < p.stock) { qty++; document.getElementById('qty-num').textContent = qty; }
    });
    document.getElementById('modal-add-cart').addEventListener('click', () => {
      Cart.add(p, qty);
      closeModal();
    });
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger);padding:1rem">${err.message}</p>`;
  }
}

function closeModal() {
  document.getElementById('product-modal')?.classList.remove('active');
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  buildCartPanel();
  initSearch();
  buildProductModal();
});

// Exportar para uso en otras páginas
window.VX = { Auth, Cart, get, post, put, del, toast, showLoader, hideLoader, openProductModal };
