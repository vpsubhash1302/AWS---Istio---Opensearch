const API = {
  users: 'http://localhost:3001',
  products: 'http://localhost:3002',
  carts: 'http://localhost:3003',
  orders: 'http://localhost:3004',
};

const state = {
  userId: localStorage.getItem('userId') || null,
  token: localStorage.getItem('token') || null,
  products: [],
};

function decodeUserId(token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  return payload.sub;
}

function setSession(token) {
  state.token = token;
  state.userId = decodeUserId(token);
  localStorage.setItem('token', token);
  localStorage.setItem('userId', state.userId);
}

function clearSession() {
  state.token = null;
  state.userId = null;
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
}

function renderAuthStatus() {
  const el = document.getElementById('auth-status');
  el.innerHTML = state.userId
    ? `User #${state.userId} <button id="logout-btn">Logout</button>`
    : 'Not logged in';
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      renderAuthStatus();
      showView('auth');
    });
  }
}

function showView(name) {
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${name}`).classList.remove('hidden');
  if (name === 'products') loadProducts();
  if (name === 'cart') loadCart();
  if (name === 'orders') loadOrders();
}

document.querySelectorAll('nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!state.userId) {
      showView('auth');
      document.getElementById('auth-message').textContent = 'Please login first.';
      return;
    }
    showView(btn.dataset.view);
  });
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());
  const res = await fetch(`${API.users}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const messageEl = document.getElementById('auth-message');
  if (!res.ok) {
    messageEl.textContent = data.error || 'Registration failed';
    return;
  }
  messageEl.textContent = 'Registered! Now login.';
  e.target.reset();
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());
  const res = await fetch(`${API.users}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const messageEl = document.getElementById('auth-message');
  if (!res.ok) {
    messageEl.textContent = data.error || 'Login failed';
    return;
  }
  setSession(data.token);
  messageEl.textContent = '';
  renderAuthStatus();
  showView('products');
});

async function loadProducts() {
  const res = await fetch(`${API.products}/products`);
  state.products = await res.json();
  const list = document.getElementById('products-list');
  list.innerHTML = state.products
    .map(
      (p) => `
      <div class="card">
        <h3>${p.name}</h3>
        <p>${p.description || ''}</p>
        <p class="price">$${Number(p.price).toFixed(2)}</p>
        <p class="stock">${p.stock} in stock</p>
        <div class="add-row">
          <input type="number" min="1" value="1" data-qty="${p.id}" />
          <button data-add="${p.id}">Add to cart</button>
        </div>
      </div>`
    )
    .join('');

  list.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const productId = Number(btn.dataset.add);
      const qty = Number(list.querySelector(`[data-qty="${productId}"]`).value) || 1;
      await fetch(`${API.carts}/carts/${state.userId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: qty }),
      });
      btn.textContent = 'Added!';
      setTimeout(() => (btn.textContent = 'Add to cart'), 1000);
    });
  });
}

async function loadCart() {
  const res = await fetch(`${API.carts}/carts/${state.userId}`);
  const items = await res.json();
  const list = document.getElementById('cart-list');

  if (items.length === 0) {
    list.innerHTML = '<p>Your cart is empty.</p>';
    document.getElementById('cart-message').textContent = '';
    return;
  }

  if (state.products.length === 0) {
    const productsRes = await fetch(`${API.products}/products`);
    state.products = await productsRes.json();
  }

  list.innerHTML = items
    .map((item) => {
      const product = state.products.find((p) => p.id === item.product_id);
      return `
      <div class="cart-row">
        <span>${product ? product.name : `Product #${item.product_id}`} &times; ${item.quantity}</span>
        <button data-remove="${item.product_id}">Remove</button>
      </div>`;
    })
    .join('');

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`${API.carts}/carts/${state.userId}/items/${btn.dataset.remove}`, {
        method: 'DELETE',
      });
      loadCart();
    });
  });
}

document.getElementById('checkout-btn').addEventListener('click', async () => {
  const messageEl = document.getElementById('cart-message');
  messageEl.textContent = 'Processing...';
  const res = await fetch(`${API.orders}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: state.userId }),
  });
  const data = await res.json();
  if (!res.ok) {
    messageEl.textContent = data.error || 'Checkout failed';
    return;
  }
  messageEl.textContent = `Order #${data.id} placed successfully!`;
  loadCart();
});

async function loadOrders() {
  const res = await fetch(`${API.orders}/orders/${state.userId}`);
  const ordersList = await res.json();
  const list = document.getElementById('orders-list');

  if (ordersList.length === 0) {
    list.innerHTML = '<p>No orders yet.</p>';
    return;
  }

  const detailed = await Promise.all(
    ordersList.map((o) => fetch(`${API.orders}/orders/${state.userId}/${o.id}`).then((r) => r.json()))
  );

  list.innerHTML = detailed
    .map(
      (o) => `
      <div class="order-card">
        <div>Order #${o.id} &mdash; <span class="status-${o.status}">${o.status}</span> &mdash; $${Number(o.total).toFixed(2)}</div>
        <div class="items">${o.items.map((i) => `Product #${i.product_id} x${i.quantity}`).join(', ')}</div>
      </div>`
    )
    .join('');
}

renderAuthStatus();
showView(state.userId ? 'products' : 'auth');
