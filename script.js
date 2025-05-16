(function() {
  "use strict";

  // Helpers
  function el(id) { return document.getElementById(id); }
  function qs(selector, scope = document) { return scope.querySelector(selector); }
  function qsa(selector, scope = document) { return Array.from(scope.querySelectorAll(selector)); }
  function show(elem) { elem.style.display = ''; }
  function hide(elem) { elem.style.display = 'none'; }
  function setText(elem, text) { elem.textContent = text; }

  // Data Model in localStorage
  // Structure:
  // owners: { username, password, storeName, products: [ {id, name, price} ], approved: boolean }
  // requests: pending owner registration requests: owner usernames waiting for approval
  // orders: [ {id, studentName, studentNumber, section, cartItems: [{productId, qty, name, price, ownerUsername}], total, referenceNum, status('pending'|'done')} ]
  // queueOrderIds in order of arrival

  // Current session storage
  let currentUser = null; // { type:'student'|'owner'|'admin', name: string, ownerUsername?:string }
  let cart = []; // for student only

  // DOM Elements
  const startScreen = el('start-screen');
  const studentPanel = el('student-panel');
  const ownerPanel = el('owner-panel');
  const adminPanel = el('admin-panel');
  const logoutBtn = el('logout-btn');
  const startError = el('start-error');
  const nameInput = el('name-input');
  const startSubmit = el('start-submit');
  const studentStoreEl = el('student-store');
  const cartItemsEl = el('cart-items');
  const checkoutBtn = el('checkout-btn');
  const checkoutPopup = el('checkout-popup');
  const receiptPopup = el('receipt-popup');
  const receiptMessage = el('receipt-message');
  const receiptProducts = el('receipt-products');
  const receiptTotal = el('receipt-total');
  const queueCountEl = el('queue-count');
  const referenceNumEl = el('reference-num');
  const receiptCloseBtn = el('receipt-close-btn');
  const checkoutFormEl = el('student-info-form');
  const closeCheckoutPopupBtn = el('close-popup');
  const notificationBar = el('notification-bar');

  // Owner elements
  const loginTabBtn = el('login-tab');
  const registerTabBtn = el('register-tab');
  const loginForm = el('login-form');
  const registerForm = el('register-form');
  const ownerAuthError = el('owner-auth-error');
  const ownerRegisterError = el('owner-register-error');
  const ownerMain = el('owner-main');
  const ownerStoreNameInput = el('owner-store-name');
  const storeNameForm = el('store-name-form');
  const ownerProductsList = el('owner-products-list');
  const addProductForm = el('add-product-form');
  const newProductNameInput = el('new-product-name');
  const newProductPriceInput = el('new-product-price');
  const orderRequestsList = el('order-requests');
  const ownerStatusNote = el('owner-status-note');

  // Admin panel elements
  const adminPanelEl = el('admin-panel');
  const adminPendingList = el('admin-pending-list');
  const adminStoresList = el('admin-stores-list');

  // STORAGE KEYS
  const STORAGE_KEYS = {
    owners: 'os_owners',
    requests: 'os_requests',
    orders: 'os_orders',
    queue: 'os_queue',
  };

  // UTILITIES

  // Save data helpers
  function saveOwners(owners) {
    localStorage.setItem(STORAGE_KEYS.owners, JSON.stringify(owners));
  }
  function getOwners() {
    const data = localStorage.getItem(STORAGE_KEYS.owners);
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
  }

  function saveRequests(requests) {
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
  }
  function getRequests() {
    const data = localStorage.getItem(STORAGE_KEYS.requests);
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
  }

  function saveOrders(orders) {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
  }
  function getOrders() {
    const data = localStorage.getItem(STORAGE_KEYS.orders);
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
  }

  function saveQueue(queue) {
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue));
  }
  function getQueue() {
    const data = localStorage.getItem(STORAGE_KEYS.queue);
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
  }

  // Generate unique ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2,4);
  }

  // Generate reference number for order (6 uppercase alphanumeric chars)
  function generateReference() {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let ref = '';
    for (let i=0; i<6; i++) {
      ref += charset.charAt(Math.floor(Math.random()*charset.length));
    }
    return ref;
  }

  // Show notification
  let notifTimeout = null;
  function notify(msg) {
    if (!msg) return;
    notificationBar.textContent = msg;
    notificationBar.classList.add('show');
    clearTimeout(notifTimeout);
    notifTimeout = setTimeout(() => {
      notificationBar.classList.remove('show');
    }, 4000);
  }

  // Hardcoded default products for student store when no approved owners
  const defaultProducts = [
    { id: 'p1', name: 'Classic Sandwich', price: 60 },
    { id: 'p2', name: 'Coffee', price: 45 },
    { id: 'p3', name: 'Bottled Water', price: 25 },
    { id: 'p4', name: 'Fruit Juice', price: 50 },
    { id: 'p5', name: 'Chocolate Cake', price: 75 },
  ];

  /////////////////////////////
  // Start Screen Logic
  /////////////////////////////

  // Show/hide panels
  function showPanel(panel) {
    startScreen.style.display = 'none';
    studentPanel.style.display = 'none';
    ownerPanel.style.display = 'none';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';

    switch(panel) {
      case 'student': studentPanel.style.display = ''; logoutBtn.style.display = ''; break;
      case 'owner-auth': 
        ownerPanel.style.display = ''; 
        el('owner-auth').style.display = ''; 
        ownerMain.style.display = 'none';
        logoutBtn.style.display = ''; 
        break;
      case 'owner-main': 
        ownerPanel.style.display = ''; 
        el('owner-auth').style.display = 'none'; 
        ownerMain.style.display = '';
        logoutBtn.style.display = ''; 
        break;
      case 'admin': adminPanel.style.display = ''; logoutBtn.style.display = ''; break;
      case 'start': startScreen.style.display = ''; break;
    }
  }

  function resetOwnerAuthForms() {
    loginForm.reset();
    registerForm.reset();
    ownerAuthError.textContent = '';
    ownerRegisterError.textContent = '';
  }

  function resetStudentCart() {
    cart = [];
    renderCart();
  }

  // Start user flow
  startSubmit.addEventListener('click', () => {
    const enteredName = nameInput.value.trim().toLowerCase();
    if (!enteredName) {
      startError.textContent = 'Please enter your name or role.';
      return;
    }
    startError.textContent = '';

    if (enteredName === 'owner') {
      // go to owner auth screen
      currentUser = null;
      resetOwnerAuthForms();
      showPanel('owner-auth');
    } else if (enteredName === 'admin109845') {
      // go to admin panel
      currentUser = {type: 'admin', name: 'admin'};
      renderAdminPanel();
      showPanel('admin');
    } else {
      // Assume student name
      currentUser = {type: 'student', name: nameInput.value.trim()};
      resetStudentCart();
      renderStoresForStudent();
      showPanel('student');
    }
    nameInput.value = '';
  });

  // Press enter triggers startSubmit
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      startSubmit.click();
    }
  });

  /////////////////////////////
  // Student Panel Logic with store cards
  /////////////////////////////

  // Getting approved owners
  function getApprovedOwners() {
    const owners = getOwners();
    return owners.filter(o => o.approved);
  }

  // Render stores and their products as cards
  function renderStoresForStudent() {
    const approvedOwners = getApprovedOwners();
    studentStoreEl.innerHTML = '<h2>Stores</h2>';
    if (approvedOwners.length === 0) {
      // Show default fallback store with default products
      const storeCard = createStoreCard('Campus Store', 'campus', defaultProducts);
      studentStoreEl.appendChild(storeCard);
      return;
    }
    approvedOwners.forEach(owner => {
      const storeCard = createStoreCard(owner.storeName, owner.username, owner.products);
      studentStoreEl.appendChild(storeCard);
    });
  }

  // Create a store card element
  function createStoreCard(storeName, ownerUsername, products) {
    const card = document.createElement('div');
    card.className = 'store-card';

    const header = document.createElement('div');
    header.className = 'store-card-header';
    header.textContent = storeName;
    card.appendChild(header);

    const productsContainer = document.createElement('div');
    productsContainer.className = 'store-products';

    if (!products || products.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.color = '#aaa';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.gridColumn = '1/-1';
      emptyMsg.textContent = 'No products available.';
      productsContainer.appendChild(emptyMsg);
    } else {
      products.forEach(prod => {
        const prodCard = document.createElement('div');
        prodCard.className = 'product-card';
        const prodUniqueId = prod.id + '-' + ownerUsername;
        prodCard.innerHTML = `
          <div class="product-name">${prod.name}</div>
          <div class="product-price">₱${prod.price.toFixed(2)}</div>
          <div class="product-actions"><button aria-label="Add ${prod.name} to cart" class="add-btn">Add</button></div>
        `;
        const btn = prodCard.querySelector('button');
        btn.addEventListener('click', () => {
          if(currentUser && currentUser.type === 'student') {
            addToCart({ 
              id: prodUniqueId, 
              name: prod.name, 
              price: prod.price, 
              ownerUsername: ownerUsername 
            });
          }
        });
        productsContainer.appendChild(prodCard);
      });
    }
    card.appendChild(productsContainer);
    return card;
  }

  // Cart logic (unchanged)
  function addToCart(product) {
    let found = cart.find(c => c.id === product.id);
    if (found) {
      found.qty++;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    renderCart();
  }

  function renderCart() {
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<p style="color:#aaa; text-align:center;">Your cart is empty.</p>';
      checkoutBtn.disabled = true;
      return;
    }
    cart.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.setAttribute('data-id', item.id);
      div.innerHTML = `
        <div class="cart-item-name" title="${item.name}">${item.name}</div>
        <div class="cart-item-qty" aria-label="${item.name} quantity">
          <button class="qty-btn" aria-label="Decrease quantity">-</button>
          <div class="qty-display">${item.qty}</div>
          <button class="qty-btn" aria-label="Increase quantity">+</button>
        </div>
        <button aria-label="Remove ${item.name} from cart" class="remove-cart-btn">&times;</button>
      `;

      const btns = div.querySelectorAll('.qty-btn');
      btns[0].addEventListener('click', () => changeQty(item.id, -1));
      btns[1].addEventListener('click', () => changeQty(item.id, +1));
      div.querySelector('.remove-cart-btn').addEventListener('click', () => removeCartItem(item.id));

      cartItemsEl.appendChild(div);
    });
    updateCheckoutState();
  }

  function changeQty(id, delta) {
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty < 1) {
      cart.splice(idx, 1);
    }
    renderCart();
  }
  function removeCartItem(id) {
    cart = cart.filter(i => i.id !== id);
    renderCart();
  }
  function updateCheckoutState() {
    checkoutBtn.disabled = cart.length === 0;
  }

  // Checkout popup (unchanged)
  checkoutBtn.addEventListener('click', () => {
    checkoutPopup.classList.add('active');
    checkoutPopup.setAttribute('aria-hidden', 'false');
    el('student-number').focus();
  });
  closeCheckoutPopupBtn.addEventListener('click', closeCheckoutPopup);
  checkoutPopup.addEventListener('click', e => {
    if (e.target === checkoutPopup) closeCheckoutPopup();
  });
  function closeCheckoutPopup() {
    checkoutPopup.classList.remove('active');
    checkoutPopup.setAttribute('aria-hidden', 'true');
    checkoutFormEl.reset();
  }

  // Compute total
  function computeTotal() {
    return cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  }

  // Queue count - how many orders pending
  function getQueueCount() {
    const orders = getOrders();
    return orders.filter(o => o.status === 'pending').length;
  }

  // STUDENT INFO FORM SUBMISSION (unchanged)

  checkoutFormEl.addEventListener('submit', e => {
    e.preventDefault();
    const studentNumber = el('student-number').value.trim();
    const section = el('student-section').value.trim();

    if (!studentNumber || !section) {
      alert('Please fill all required fields.');
      return;
    }

    // Prepare order object
    const orderId = generateId();
    const referenceNumber = generateReference();

    const order = {
      id: orderId,
      studentName: currentUser.name,
      studentNumber,
      section,
      cartItems: [...cart],
      total: computeTotal(),
      referenceNum: referenceNumber,
      status: 'pending',
      datetime: new Date().toISOString(),
    };

    // Save orders under localStorage
    const orders = getOrders();
    orders.push(order);
    saveOrders(orders);

    // Notify owners for their requested orders.
    notifyOwnersOfOrder(cart, order);

    // Show receipt popup
    showReceipt(order);

    // Clear cart and close checkout
    cart = [];
    renderCart();
    closeCheckoutPopup();
  });

  // Receipt display (unchanged)
  function showReceipt(order) {
    receiptMessage.textContent = `Thank you, ${order.studentName}! Your order has been placed.`;
    receiptProducts.innerHTML = '';
    order.cartItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.name} - Qty: ${item.qty} - ₱${(item.price * item.qty).toFixed(2)}`;
      receiptProducts.appendChild(li);
    });
    receiptTotal.textContent = order.total.toFixed(2);
    queueCountEl.textContent = getQueueCount();
    referenceNumEl.textContent = order.referenceNum;
    receiptPopup.classList.add('active');
    receiptPopup.setAttribute('aria-hidden', 'false');
    receiptCloseBtn.focus();
  }
  receiptCloseBtn.addEventListener('click', () => {
    receiptPopup.classList.remove('active');
    receiptPopup.setAttribute('aria-hidden', 'true');
  });
  receiptPopup.addEventListener('click', e => {
    if (e.target === receiptPopup) {
      receiptPopup.classList.remove('active');
      receiptPopup.setAttribute('aria-hidden', 'true');
    }
  });

  // Notify owners of new order items (unchanged)
  function notifyOwnersOfOrder(cartItems, order) {
    const notificationsMap = {};
    cartItems.forEach(item => {
      if (!notificationsMap[item.ownerUsername]) {
        notificationsMap[item.ownerUsername] = [];
      }
      notificationsMap[item.ownerUsername].push(item);
    });

    Object.entries(notificationsMap).forEach(([ownerUsername, items]) => {
      if (ownerUsername === 'campus') return;
      if (currentUser.type === 'student' && currentUser.name !== 'owner') {
        notify(`Owner ${ownerUsername}: New order received with ${items.length} item(s).`);
      }
    });
  }

  /////////////////////////////
  // Logout handler (unchanged)
  /////////////////////////////
  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    cart = [];
    showPanel('start');
  });

  /////////////////////////////
  // Owner Panel Logic (unchanged except some fixes)
  /////////////////////////////

  // Tab switching
  loginTabBtn.addEventListener('click', () => switchOwnerTab('login'));
  registerTabBtn.addEventListener('click', () => switchOwnerTab('register'));

  function switchOwnerTab(tab) {
    ownerAuthError.textContent = '';
    ownerRegisterError.textContent = '';
    if (tab === 'login') {
      loginTabBtn.classList.add('active');
      loginTabBtn.setAttribute('aria-selected', 'true');
      loginTabBtn.tabIndex = 0;
      registerTabBtn.classList.remove('active');
      registerTabBtn.setAttribute('aria-selected', 'false');
      registerTabBtn.tabIndex = -1;

      loginForm.style.display = '';
      registerForm.style.display = 'none';
    } else {
      registerTabBtn.classList.add('active');
      registerTabBtn.setAttribute('aria-selected', 'true');
      registerTabBtn.tabIndex = 0;
      loginTabBtn.classList.remove('active');
      loginTabBtn.setAttribute('aria-selected', 'false');
      loginTabBtn.tabIndex = -1;

      registerForm.style.display = '';
      loginForm.style.display = 'none';
    }
  }

  // Owner login
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    ownerAuthError.textContent = '';
    const username = el('login-username').value.trim().toLowerCase();
    const password = el('login-password').value;

    if (!username || !password) {
      ownerAuthError.textContent = 'Fill both username and password.';
      return;
    }
    const owners = getOwners();
    const owner = owners.find(o => o.username === username);
    if (!owner) {
      ownerAuthError.textContent = 'User not found.';
      return;
    }
    if (owner.password !== password) {
      ownerAuthError.textContent = 'Incorrect password.';
      return;
    }
    if (!owner.approved) {
      ownerAuthError.textContent = 'Your request is not approved yet. Please wait for admin approval.';
      return;
    }
    // success login
    currentUser = {type: 'owner', name: username, ownerUsername: username};
    enterOwnerMainPanel(owner);
  });

  // Owner registration
  registerForm.addEventListener('submit', e => {
    e.preventDefault();
    ownerRegisterError.textContent = '';
    const username = el('register-username').value.trim().toLowerCase();
    const password = el('register-password').value;
    const storeName = el('store-name-register').value.trim();

    if (!username || !password || !storeName) {
      ownerRegisterError.textContent = 'Fill all fields.';
      return;
    }
    const owners = getOwners();
    if (owners.some(o => o.username === username)) {
      ownerRegisterError.textContent = 'Username already exists.';
      return;
    }
    // add new owner with approved false
    owners.push({
      username,
      password,
      storeName,
      products: [],
      approved: false
    });
    saveOwners(owners);
    // add to requests
    const requests = getRequests();
    if (!requests.includes(username)) {
      requests.push(username);
      saveRequests(requests);
    }
    notify('Registration sent for admin approval.');
    resetOwnerAuthForms();
    switchOwnerTab('login');
  });

  function enterOwnerMainPanel(ownerData) {
    showPanel('owner-main');
    el('owner-auth').style.display = 'none';
    ownerMain.style.display = '';
    ownerStatusNote.textContent = ownerData.approved ? '' : 'Your store request is pending approval.';
    ownerStoreNameInput.value = ownerData.storeName || '';
    ownerProductsList.innerHTML = '';
    orderRequestsList.innerHTML = '';
    renderOwnerProducts(ownerData.products);
    renderOrderRequests(ownerData.username);
  }

  storeNameForm.addEventListener('submit', e => {
    e.preventDefault();
    const newName = ownerStoreNameInput.value.trim();
    if (!newName) return;
    const owners = getOwners();
    const owner = owners.find(o => o.username === currentUser.ownerUsername);
    if (!owner) return;
    owner.storeName = newName;
    saveOwners(owners);
    notify('Store name updated.');
    renderStoresForStudent();
    renderOwnerProducts(owner.products);
  });

  // Owner products display & editing
  function renderOwnerProducts(products) {
    ownerProductsList.innerHTML = '';
    if (!products || products.length === 0) {
      ownerProductsList.innerHTML = '<p style="color:#aaa;">No products added yet.</p>';
      return;
    }
    products.forEach(prod => {
      const div = document.createElement('div');
      div.className = 'product-item';
      div.setAttribute('data-prod-id', prod.id);
      div.innerHTML = `
        <div class="owner-product-info">
          <span class="prod-name">${prod.name}</span>
          <input type="number" class="edit-price-input" min="1" value="${prod.price}" aria-label="Edit price for ${prod.name}" />
        </div>
        <div class="owner-product-actions">
          <button class="owner-small-btn remove-btn" title="Remove product ${prod.name}">&times;</button>
        </div>
      `;
      // Remove product
      div.querySelector('.remove-btn').addEventListener('click', () => {
        removeOwnerProduct(prod.id);
      });
      // Edit price live editing
      const priceInput = div.querySelector('.edit-price-input');
      priceInput.addEventListener('change', () => {
        const newPrice = parseFloat(priceInput.value);
        if (isNaN(newPrice) || newPrice <= 0) {
          priceInput.value = prod.price;
          notify("Price must be a positive number.");
          return;
        }
        updateOwnerProductPrice(prod.id, newPrice);
      });
      ownerProductsList.appendChild(div);
    });
  }

  function removeOwnerProduct(prodId) {
    const owners = getOwners();
    const owner = owners.find(o => o.username === currentUser.ownerUsername);
    if (!owner) return;
    owner.products = owner.products.filter(p => p.id !== prodId);
    saveOwners(owners);
    notify('Product removed.');
    renderOwnerProducts(owner.products);
    renderStoresForStudent();
  }

  function updateOwnerProductPrice(prodId, newPrice) {
    const owners = getOwners();
    const owner = owners.find(o => o.username === currentUser.ownerUsername);
    if (!owner) return;
    const prod = owner.products.find(p => p.id === prodId);
    if (!prod) return;
    prod.price = newPrice;
    saveOwners(owners);
    notify('Product price updated.');
    renderStoresForStudent();
  }

  addProductForm.addEventListener('submit', e => {
    e.preventDefault();
    const newName = newProductNameInput.value.trim();
    const newPrice = parseFloat(newProductPriceInput.value);
    if (!newName || isNaN(newPrice) || newPrice <= 0) {
      notify('Please enter valid product name and price.');
      return;
    }
    const owners = getOwners();
    const owner = owners.find(o => o.username === currentUser.ownerUsername);
    if (!owner) return;
    const newProd = {
      id: generateId(),
      name: newName,
      price: newPrice,
    };
    owner.products.push(newProd);
    saveOwners(owners);
    notify('Product added.');
    newProductNameInput.value = '';
    newProductPriceInput.value = '';
    renderOwnerProducts(owner.products);
    renderStoresForStudent();
  });

  // Fetch and render orders for this owner
  function renderOrderRequests(ownerUsername) {
    const allOrders = getOrders();
    orderRequestsList.innerHTML = '';
    const filtered = allOrders.filter(o => {
      // Only pending orders with any product for this owner
      return o.status === 'pending' && o.cartItems.some(ci => ci.ownerUsername === ownerUsername);
    });
    if (filtered.length === 0) {
      orderRequestsList.innerHTML = '<p style="color:#aaa;">No pending orders.</p>';
      return;
    }
    filtered.forEach(order => {
      // Filter only products for this owner
      const ownerProductsList = order.cartItems.filter(ci => ci.ownerUsername === ownerUsername);
      const div = document.createElement('div');
      div.className = 'order-request';
      const liItems = ownerProductsList.map(i =>
        `<li>${i.name} - Qty: ${i.qty} - ₱${(i.price * i.qty).toFixed(2)}</li>`
      ).join('');
      div.innerHTML = `
        <div class="order-request-header">Order from: ${order.studentName}</div>
        <small>Student No: ${order.studentNumber} | Section: ${order.section}</small>
        <ul class="order-items-list">${liItems}</ul>
        <button class="done-btn" aria-label="Mark order ${order.referenceNum} as done">Done</button>
      `;
      div.querySelector('.done-btn').addEventListener('click', () => {
        markOrderDone(order.id);
      });
      orderRequestsList.appendChild(div);
    });
  }

  // Mark order as done - mark whole order as done
  function markOrderDone(orderId) {
    const orders = getOrders();
    let updated = false;
    const queue = getQueue();
    for (let i=0;i<orders.length;i++) {
      if (orders[i].id === orderId && orders[i].status === 'pending') {
        orders[i].status = 'done';
        updated = true;
        break;
      }
    }
    if (updated) {
      saveOrders(orders);
      // Remove from queue
      const qi = queue.indexOf(orderId);
      if (qi !== -1) {
        queue.splice(qi, 1);
        saveQueue(queue);
      }
      notify('Order marked as done.');
      renderOrderRequests(currentUser.ownerUsername);
      renderStoresForStudent();
    }
  }

  /////////////////////////////
  // Admin Panel Logic (unchanged)
  /////////////////////////////

  // Render admin pending requests
  function renderAdminPanel() {
    const requests = getRequests();
    adminPendingList.innerHTML = '';
    if (requests.length === 0) {
      adminPendingList.innerHTML = '<p style="color:#aaa; text-align:center;">No pending owner requests.</p>';
    } else {
      const owners = getOwners();
      requests.forEach(username => {
        const owner = owners.find(o => o.username === username);
        if (!owner) return;
        const div = document.createElement('div');
        div.className = 'admin-request';
        div.innerHTML = `
          <div class="admin-request-header">Owner Request: ${username}</div>
          <p><strong>Store Name:</strong> ${owner.storeName}</p>
          <div class="admin-btns">
            <button class="admin-btn accept-btn" aria-label="Accept request from ${username}">Accept</button>
            <button class="admin-btn reject admin-btn reject" aria-label="Reject request from ${username}">Reject</button>
          </div>
        `;
        div.querySelector('.accept-btn').addEventListener('click', () => {
          acceptOwnerRequest(username);
        });
        div.querySelector('.reject').addEventListener('click', () => {
          rejectOwnerRequest(username);
        });
        adminPendingList.appendChild(div);
      });
    }
    renderAdminStores();
  }

  function acceptOwnerRequest(username) {
    const owners = getOwners();
    const owner = owners.find(o => o.username === username);
    if (!owner) return;
    owner.approved = true;
    saveOwners(owners);
    // Remove from requests
    let requests = getRequests();
    requests = requests.filter(r => r !== username);
    saveRequests(requests);
    notify(`Owner ${username}'s request accepted.`);
    renderAdminPanel();
  }
  function rejectOwnerRequest(username) {
    // Remove owner completely
    let owners = getOwners();
    owners = owners.filter(o => o.username !== username);
    saveOwners(owners);
    // Remove from requests
    let requests = getRequests();
    requests = requests.filter(r => r !== username);
    saveRequests(requests);
    notify(`Owner ${username}'s request rejected and removed.`);
    renderAdminPanel();
  }

  function renderAdminStores() {
    const owners = getOwners().filter(o => o.approved);
    adminStoresList.innerHTML = '';
    if (owners.length === 0) {
      adminStoresList.innerHTML = '<p style="color:#aaa; text-align:center;">No approved stores found.</p>';
      return;
    }
    owners.forEach(owner => {
      const div = document.createElement('div');
      div.className = 'admin-store';
      div.innerHTML = `
        <p><strong>${owner.storeName}</strong> (Owner: ${owner.username})</p>
        <div class="admin-btns">
          <button class="admin-btn remove-store-btn" aria-label="Remove store ${owner.storeName}">Remove</button>
        </div>
      `;
      div.querySelector('.remove-store-btn').addEventListener('click', () => removeStore(owner.username));
      adminStoresList.appendChild(div);
    });
  }

  function removeStore(username) {
    // Remove owner and their data entirely
    let owners = getOwners();
    owners = owners.filter(o => o.username !== username);
    saveOwners(owners);

    // Also remove orders related to this owner
    let orders = getOrders();
    orders = orders.filter(o => !o.cartItems.some(i => i.ownerUsername === username));
    saveOrders(orders);

    notify(`Store of owner ${username} removed.`);
    renderAdminPanel();
    renderStoresForStudent();
  }

  /////////////////////
  // Initialization on page load
  /////////////////////

  // Start in start screen
  showPanel('start');

})();