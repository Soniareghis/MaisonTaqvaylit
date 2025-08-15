// ---- State ----
const state = {
  products: [],
  filtered: [],
  cart: JSON.parse(localStorage.getItem('mt_cart') || '[]'),
  page: 1,
  perPage: 12,
  activeFilters: { category: new Set(), metal: new Set(), enamel_color: new Set(), minPrice: null, maxPrice: null },
  search: '',
  sort: 'featured'
};

function saveCart(){ localStorage.setItem('mt_cart', JSON.stringify(state.cart)); updateCartCount(); }
function updateCartCount(){ const c = state.cart.reduce((a,i)=>a+i.qty,0); document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=c); }

async function loadProducts(){
  const res = await fetch('data/products.json'); state.products = await res.json(); return state.products;
}

function formatPrice(p, currency='EUR'){
  try { return new Intl.NumberFormat('fr-FR', {style:'currency', currency}).format(p); }
  catch { return p.toFixed(2) + ' €'; }
}

// ---- Filters / Search / Sort ----
function applyFilters(){
  let items = [...state.products];

  // text search
  if(state.search.trim()){
    const q = state.search.toLowerCase();
    items = items.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description||'').toLowerCase().includes(q)
    );
  }

  // facets
  const f = state.activeFilters;
  const has = (set)=> set && set.size>0;

  if(has(f.category)) items = items.filter(p => f.category.has(p.category));
  if(has(f.metal)) items = items.filter(p => f.metal.has(p.metal));
  if(has(f.enamel_color)) items = items.filter(p => f.enamel_color.has(p.enamel_color));

  // price
  if(f.minPrice!=null) items = items.filter(p => p.price >= f.minPrice);
  if(f.maxPrice!=null) items = items.filter(p => p.price <= f.maxPrice);

  // sort
  switch(state.sort){
    case 'price-asc':  items.sort((a,b)=>a.price-b.price); break;
    case 'price-desc': items.sort((a,b)=>b.price-a.price); break;
    case 'name-asc':   items.sort((a,b)=>a.name.localeCompare(b.name,'fr')); break;
    case 'name-desc':  items.sort((a,b)=>b.name.localeCompare(a.name,'fr')); break;
    default: /* featured */ break;
  }

  state.filtered = items;
  state.page = 1;
  renderGrid();
  renderMeta();
}

function renderMeta(){
  const count = document.getElementById('resultCount');
  if(count) count.textContent = `${state.filtered.length} résultat${state.filtered.length>1?'s':''}`;

  // chips
  const chipsBox = document.getElementById('activeChips');
  if(!chipsBox) return;
  chipsBox.innerHTML = '';
  const addChip = (label, onRemove) => {
    const span = document.createElement('span');
    span.className = 'chip';
    span.innerHTML = `${label} <button aria-label="Supprimer">×</button>`;
    span.querySelector('button').addEventListener('click', onRemove);
    chipsBox.appendChild(span);
  };

  for(const v of state.activeFilters.category) addChip(v, ()=>{ state.activeFilters.category.delete(v); syncUIFromFilters(); applyFilters(); });
  for(const v of state.activeFilters.metal) addChip(v, ()=>{ state.activeFilters.metal.delete(v); syncUIFromFilters(); applyFilters(); });
  for(const v of state.activeFilters.enamel_color) addChip(v, ()=>{ state.activeFilters.enamel_color.delete(v); syncUIFromFilters(); applyFilters(); });
  if(state.activeFilters.minPrice!=null || state.activeFilters.maxPrice!=null){
    const min = state.activeFilters.minPrice??'0';
    const max = state.activeFilters.maxPrice??'∞';
    addChip(`Prix ${min}–${max}€`, ()=>{ state.activeFilters.minPrice=null; state.activeFilters.maxPrice=null; syncUIFromFilters(); applyFilters(); });
  }
}

function syncUIFromFilters(){
  // checkboxes
  document.querySelectorAll('[data-filter]').forEach(cb=>{
    const key = cb.getAttribute('data-filter');
    cb.checked = state.activeFilters[key]?.has(cb.value) || false;
  });
  // price inputs
  const minI = document.getElementById('minPrice'); const maxI = document.getElementById('maxPrice');
  if(minI) minI.value = state.activeFilters.minPrice ?? '';
  if(maxI) maxI.value = state.activeFilters.maxPrice ?? '';
}

// ---- Grid & Pagination ----
function renderGrid(){
  const grid = document.getElementById('grid'); if(!grid) return;
  const start = (state.page-1)*state.perPage;
  const pageItems = state.filtered.slice(start, start+state.perPage);

  grid.innerHTML = pageItems.map(p=>`
    <div class="card">
      <a href="product.html?id=${encodeURIComponent(p.id)}">
        <img src="${p.thumbnail}" alt="${p.name}">
      </a>
      <div class="info">
        <div class="muted">${p.category}</div>
        <div class="kufi">${p.name}</div>
        <div class="price">${formatPrice(p.price, p.currency)}</div>
      </div>
      <div class="quickbar">
        <button class="btn" data-quick-view data-id="${p.id}">Voir</button>
        <button class="btn primary" data-quick-add data-id="${p.id}">Ajouter</button>
      </div>
    </div>
  `).join('');

  // quick actions
  grid.querySelectorAll('[data-quick-add]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = state.products.find(x=>x.id===btn.dataset.id);
      const ex = state.cart.find(i=>i.id===p.id);
      if(ex) ex.qty += 1; else state.cart.push({id:p.id, name:p.name, price:p.price, currency:p.currency, thumbnail:p.thumbnail, qty:1});
      saveCart();
      btn.textContent = 'Ajouté ✓';
      setTimeout(()=>btn.textContent='Ajouter', 900);
    });
  });
  grid.querySelectorAll('[data-quick-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = `product.html?id=${encodeURIComponent(btn.dataset.id)}`; });
  });

  // pagination info
  const pageInfo = document.getElementById('pageInfo');
  if(pageInfo){
    const totalPages = Math.max(1, Math.ceil(state.filtered.length/state.perPage));
    pageInfo.textContent = `Page ${state.page} / ${totalPages}`;
    document.getElementById('prevPage').disabled = state.page<=1;
    document.getElementById('nextPage').disabled = state.page>=totalPages;
  }
}

// ---- Cart page (unchanged) ----
async function renderCart(){
  await loadProducts();
  const container = document.querySelector('[data-cart]');
  const totalEl = document.querySelector('[data-total]');
  if(!container) return;
  container.innerHTML = '';
  let total = 0;
  state.cart.forEach((item, idx)=>{
    const line = item.price * item.qty; total += line;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${item.thumbnail}" alt="${item.name}">
      <div>
        <div class="kufi">${item.name}</div>
        <div class="muted">${formatPrice(item.price,item.currency)} × 
          <input type="number" min="1" value="${item.qty}" style="width:64px" data-qty-input>
        </div>
      </div>
      <div>
        <div>${formatPrice(line,item.currency)}</div>
        <button class="btn" data-remove>&times;</button>
      </div>`;
    row.querySelector('[data-qty-input]').addEventListener('change', e=>{
      const v = Math.max(1, parseInt(e.target.value||'1',10));
      state.cart[idx].qty = v; saveCart(); renderCart();
    });
    row.querySelector('[data-remove]').addEventListener('click', ()=>{ state.cart.splice(idx,1); saveCart(); renderCart(); });
    container.appendChild(row);
  });
  totalEl.textContent = formatPrice(total);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async ()=>{
  updateCartCount();

  if(document.body.dataset.page === 'shop'){
    await loadProducts();
    // UI bindings
    document.getElementById('sort').addEventListener('change', e=>{ state.sort = e.target.value; applyFilters(); });
    document.getElementById('search').addEventListener('input', e=>{ state.search = e.target.value; applyFilters(); });

    document.querySelectorAll('[data-filter]').forEach(cb=>{
      cb.addEventListener('change', e=>{
        const key = e.target.getAttribute('data-filter');
        const set = state.activeFilters[key];
        if(e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
        applyFilters();
      });
    });

    document.getElementById('applyPrice').addEventListener('click', ()=>{
      const min = document.getElementById('minPrice').value;
      const max = document.getElementById('maxPrice').value;
      state.activeFilters.minPrice = min? Number(min) : null;
      state.activeFilters.maxPrice = max? Number(max) : null;
      applyFilters();
    });

    document.getElementById('clearFilters').addEventListener('click', ()=>{
      state.activeFilters = { category:new Set(), metal:new Set(), enamel_color:new Set(), minPrice:null, maxPrice:null };
      state.search = ''; state.sort = 'featured';
      document.getElementById('search').value = '';
      document.getElementById('sort').value = 'featured';
      syncUIFromFilters(); applyFilters();
    });

    document.getElementById('prevPage').addEventListener('click', ()=>{ if(state.page>1){ state.page--; renderGrid(); renderMeta(); } });
    document.getElementById('nextPage').addEventListener('click', ()=>{
      const totalPages = Math.max(1, Math.ceil(state.filtered.length/state.perPage));
      if(state.page<totalPages){ state.page++; renderGrid(); renderMeta(); }
    });

    // first render
    applyFilters();
  }

  if(document.body.dataset.page === 'home') {
    await loadProducts();
    // Home grid (nouveautés)
    const grid = document.getElementById('homeGrid');
    if(grid){
      const items = state.products.slice(0, 8);
      grid.innerHTML = items.map(p=>`
        <a class="card" href="product.html?id=${encodeURIComponent(p.id)}">
          <img src="${p.thumbnail}" alt="${p.name}">
          <div class="info">
            <div class="muted">${p.category}</div>
            <div class="kufi">${p.name}</div>
            <div class="price">${formatPrice(p.price,p.currency)}</div>
          </div>
        </a>`).join('');
    }
  }

  if(document.body.dataset.page === 'pdp') {
    await loadProducts();
    // PDP code était déjà en place dans ton starter
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const p = state.products.find(x=>x.id===id);
    if(!p) return;
    document.querySelector('[data-breadcrumb-name]').textContent = p.name;
    document.querySelector('[data-name]').textContent = p.name;
    document.querySelector('[data-price]').textContent = formatPrice(p.price, p.currency);
    document.querySelector('[data-desc]').textContent = p.description;
    document.querySelector('[data-meta]').innerHTML = `
      <tr><th>Catégorie</th><td>${p.category}</td></tr>
      <tr><th>Métal</th><td>${p.metal}</td></tr>
      <tr><th>Émail</th><td>${p.enamel_color}</td></tr>
      <tr><th>Stock</th><td>${p.stock}</td></tr>`;
    document.querySelector('[data-gallery]').innerHTML = p.images.map(src=>`<img src="${src}" alt="${p.name}">`).join('');
    document.querySelector('[data-add]').addEventListener('click', ()=>{
      const qty = Math.max(1, parseInt(document.querySelector('[data-qty]').value || '1', 10));
      const ex = state.cart.find(i=>i.id===p.id);
      if(ex) ex.qty += qty; else state.cart.push({id:p.id, name:p.name, price:p.price, currency:p.currency, thumbnail:p.thumbnail, qty});
      saveCart();
    });
  }

  if(document.body.dataset.page === 'cart') renderCart();
});
