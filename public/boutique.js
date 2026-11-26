/* ==========================================================
   TAWALI SOUK — application client
   ========================================================== */
'use strict';
// ---------------- Outils ----------------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = n => Math.round(n || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' F';
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
const fdate = iso => { const d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
const fheure = iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fjour = ymd => { if (!ymd) return ''; const d = new Date(ymd + 'T12:00:00Z'); return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); };
const telLisible = t => String(t || '').replace(/^\+?225/, '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
const deco = t => esc(t).replace(/\*([^*]+)\*/g, '<i>$1</i>');

const I = (() => {
  const s = (p, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${p}</svg>`;
  return {
    search: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    bell: s('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    bag: s('<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
    home: s('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    grid: s('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
    box: s('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
    user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
    heart: s('<path d="M12 20.5s-7.5-4.7-9.8-9.1C.6 8 2 4.5 5.6 3.8c2.1-.4 4 .6 5 2.2 1-1.6 2.9-2.6 5-2.2 3.6.7 5 4.2 3.4 7.6C19.5 15.8 12 20.5 12 20.5z"/>'),
    plus: s('<path d="M12 5v14M5 12h14"/>'),
    truck: s('<rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l4 4v3h-8z"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/>'),
    shield: s('<path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><path d="M9 12l2 2 4-4"/>'),
    clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: s('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    phone: s('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
    sparkle: s('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
    chat: s('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
    send: s('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>'),
    copy: s('<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    gift: s('<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 9h18v4H3zM12 9v12M12 9c-1.5-4-6-4-6-1.5S9 9 12 9zM12 9c1.5-4 6-4 6-1.5S15 9 12 9z"/>'),
    receipt: s('<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    info: s('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    lock: s('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    star: s('<path d="M12 2l3 6.5 7 1-5 5 1.3 7L12 18l-6.3 3.5L7 14.5l-5-5 7-1z"/>'),
    leaf: s('<path d="M4 20c9 0 16-7 16-16-9 0-16 7-16 16z"/><path d="M4 20c2-6 6-10 12-13"/>'),
    drop: s('<path d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13z"/>'),
    target: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    crown: s('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
    store: s('<path d="M3 9l2-5h14l2 5"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/>'),
    download: s('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>'),
    share: s('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
    logout: s('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'),
    trash: s('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>'),
    cam: s('<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/>'),
    route: s('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>'),
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5L9.2 7c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>'
  };
})();
const OPS = { wave: 'Wave', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', moov_money: 'Moov Money', livraison: 'À la livraison' };
const OPS_COURT = { wave: 'W', orange_money: 'OM', mtn_momo: 'MTN', moov_money: 'Moov', livraison: 'F' };
const MODE_LIV = { livraison: 'Livraison', expedition: 'Expédition', retrait: 'Retrait en boutique' };
const ST = { recue: 'Reçue', confirmee: 'Confirmée', preparation: 'En préparation', en_route: 'En route', expediee: 'Expédiée', prete: 'Prête au retrait', livree: 'Livrée', annulee: 'Annulée' };
const PAY_ST = { en_attente: ['En attente de paiement', 'wait'], declare: ['Paiement en vérification', 'wait'], paye: ['Payé', 'ok'], refuse: ['Paiement non retrouvé', 'no'], a_la_livraison: ['À régler à la livraison', 'wait'] };

// ---------------- État ----------------
const S = {
  data: null, byId: {}, token: LS.get('ts_token', ''), client: null,
  cart: LS.get('ts_panier', []), favs: LS.get('ts_favs', []), vus: LS.get('ts_vus', []),
  vue: 'accueil', p: {}, commandes: [], notifs: [], devis: [], chat: [], ia: LS.get('ts_ia', []),
  co: LS.get('ts_co', {}), enLigne: false, installEvt: null, maps: {}, sel: {}, qte: 1, payMode: null, recuPublic: null, tri: 'pop'
};
const save = () => { LS.set('ts_panier', S.cart); LS.set('ts_favs', S.favs); LS.set('ts_co', Object.assign({}, S.co, { position: null })); LS.set('ts_vus', S.vus.slice(0, 20)); };

async function api(path, opts) {
  opts = opts || {};
  const h = { 'Content-Type': 'application/json' };
  if (S.token) h['X-Client-Token'] = S.token;
  let res, body;
  try { res = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined }); body = await res.json(); }
  catch (e) { throw new Error('Connexion impossible. Vérifiez votre connexion internet.'); }
  if (res.status === 401 && S.token && !opts.noLogout) { S.token = ''; S.client = null; LS.set('ts_token', ''); }
  if (!res.ok || body.ok === false) throw new Error(body.error || 'Erreur');
  return body;
}
let toastT;
function toast(t, b, err, onClick) {
  $('t-t').textContent = t; $('t-b').textContent = b || '';
  const el = $('toast'); el.classList.toggle('err', !!err); el.classList.add('on');
  el.onclick = () => { el.classList.remove('on'); if (onClick) onClick(); };
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), err ? 4500 : 5000);
}
function ding() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, .15, .3].forEach((t, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = [880, 1175, 1568][i]; g.gain.setValueAtTime(.12, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .5); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .5); });
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } catch (e) { }
}
function resizeImage(file, max) {
  max = max || 1400;
  return new Promise((ok, ko) => {
    const fr = new FileReader(); fr.onerror = () => ko(new Error('Lecture impossible'));
    fr.onload = () => { const img = new Image(); img.onerror = () => ko(new Error('Image illisible'));
      img.onload = () => { let w = img.width, h = img.height; const r = Math.min(1, max / Math.max(w, h)); w = Math.round(w * r); h = Math.round(h * r);
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); ok(c.toDataURL('image/jpeg', .85)); };
      img.src = fr.result; };
    fr.readAsDataURL(file);
  });
}

// ---------------- Produits ----------------
const B = () => S.data.boutique;
const P = id => S.byId[Number(id)];
const catOf = p => S.data.categories.find(c => c.id === p.categorieId) || {};
const promoOn = p => !!(p.promo && p.promo.prix && Date.parse(p.promo.fin) > Date.now());
const px = p => promoOn(p) ? p.promo.prix : p.prix;
const remisePct = p => promoOn(p) ? Math.round((1 - p.promo.prix / p.prix) * 100) : 0;
const avisDe = p => (S.data.avis || {})[p.id];
function imgOf(p, vid) { const v = vid && p.variantes.find(x => x.id === vid); return (v && v.image) || p.images[0] || '/img/logo.png'; }
function stars(n, nb) { const r = Math.round(n); return `<span class="stars">${'★'.repeat(r)}${'☆'.repeat(5 - r)}${nb ? `<small>(${nb})</small>` : ''}</span>`; }
function waLink(msg) { return `https://wa.me/${B().whatsapp}?text=${encodeURIComponent(msg)}`; }
function cdHTML(fin, compact) {
  return compact ? `<span class="cdm">${I.clock}<span data-fin="${esc(fin)}" data-fmt="c"></span></span>`
    : `<span class="cd" data-fin="${esc(fin)}" data-fmt="b"></span>`;
}
function priceHTML(p) {
  if (!(p.prix > 0)) return `<span class="price ask">Prix sur demande</span>`;
  return promoOn(p) ? `<span class="price">${F(p.promo.prix)}<s>${F(p.prix)}</s></span>` : `<span class="price">${F(p.prix)}</span>`;
}
function pcard(p) {
  const fav = S.favs.includes(p.id), a = avisDe(p), img2 = p.images[1];
  const tags = [];
  if (promoOn(p)) tags.push(`<span class="tag promo">-${remisePct(p)} %</span>`);
  if (!p.enStock) tags.push(`<span class="tag off">Épuisé</span>`);
  else if (p.badge) tags.push(`<span class="tag">${esc(p.badge)}</span>`);
  return `<article class="pc rv">
    <div class="im" onclick="go('produit',{id:${p.id}})">
      <img src="${esc(p.images[0] || '/img/logo.png')}" alt="${esc(p.nom)}" loading="lazy">
      ${img2 ? `<img class="img2" src="${esc(img2)}" alt="" loading="lazy">` : ''}
      <div class="bd">${tags.join('')}</div>
    </div>
    <button class="fav ${fav ? 'on' : ''}" onclick="toggleFav(${p.id},this)" aria-label="Favori">${I.heart}</button>
    <div class="ct">
      <div class="cat">${esc(catOf(p).nom || '')}</div>
      <h3 onclick="go('produit',{id:${p.id}})">${esc(p.nom)}</h3>
      ${a ? stars(a.moyenne, a.nombre) : ''}
      ${promoOn(p) ? cdHTML(p.promo.fin, true) : ''}
      ${p.variantes.length > 1 ? `<div class="swatches">${p.variantes.slice(0, 6).map(v => `<i style="background-image:url('${esc(v.image)}')"></i>`).join('')}${p.variantes.length > 6 ? `<small class="tiny muted">+${p.variantes.length - 6}</small>` : ''}</div>` : ''}
      <div class="ft">${priceHTML(p)}
        ${p.prix > 0 && p.enStock ? `<button class="add" onclick="quickAdd(${p.id})" aria-label="Ajouter au panier">${I.plus}</button>` : ''}
      </div>
    </div>
  </article>`;
}
function toggleFav(id, el) {
  const i = S.favs.indexOf(id);
  if (i >= 0) S.favs.splice(i, 1); else { S.favs.unshift(id); toast('Ajouté à vos favoris', 'Retrouvez-le dans votre compte.'); }
  if (el) el.classList.toggle('on', i < 0);
  save();
}
function quickAdd(id) {
  const p = P(id);
  if (p.variantes.length > 1) return go('produit', { id });
  addCart(id, p.variantes[0] ? p.variantes[0].id : '', 1);
}
function addCart(id, vid, q) {
  const p = P(id); if (!p) return;
  const k = id + ':' + (vid || '');
  const ex = S.cart.find(c => c.k === k);
  if (ex) ex.q = Math.min(99, ex.q + q); else S.cart.push({ k, id, v: vid || '', q });
  save(); badges();
  const v = vid && p.variantes.find(x => x.id === vid);
  toast('Ajouté au panier ✓', `${p.nom}${v ? ' — ' + v.nom : ''} × ${q}`, false, () => go('panier'));
  const b = document.querySelector('.ico.cart'); if (b) { b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
}
function cartLines() {
  return S.cart.map(c => { const p = P(c.id); if (!p) return null; const v = c.v && p.variantes.find(x => x.id === c.v); return { c, p, v, unit: px(p), total: px(p) * c.q }; }).filter(Boolean);
}
const cartTotal = () => cartLines().reduce((s, l) => s + l.total, 0);
const cartCount = () => S.cart.reduce((s, c) => s + c.q, 0);

// ---------------- Navigation ----------------
function go(vue, p, opts) {
  opts = opts || {};
  S.vue = vue; S.p = p || {};
  const q = new URLSearchParams();
  if (vue !== 'accueil') q.set('vue', vue);
  Object.keys(S.p).forEach(k => { if (S.p[k] !== undefined && S.p[k] !== '') q.set(k, S.p[k]); });
  const url = location.pathname + (q.toString() ? '?' + q : '');
  if (opts.replace) history.replaceState({ vue, p: S.p }, '', url); else if (!opts.noPush) history.pushState({ vue, p: S.p }, '', url);
  const doRender = () => { render(); if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' }); };
  if (document.startViewTransition && !opts.noAnim) document.startViewTransition(doRender); else doRender();
  if (vue === 'notifs' && S.client) setTimeout(() => api('/api/client/notifs/lu', { body: {} }).then(() => { S.notifs.forEach(n => n.lu = true); badges(); }).catch(() => { }), 1500);
}
window.addEventListener('popstate', e => {
  const st = e.state || parseUrl();
  S.vue = st.vue; S.p = st.p || {};
  render();
});
function parseUrl() {
  const q = new URLSearchParams(location.search), p = {};
  q.forEach((v, k) => { if (k !== 'vue') p[k] = /^\d+$/.test(v) ? Number(v) : v; });
  let vue = q.get('vue') || 'accueil';
  if (q.get('p')) { vue = 'produit'; p.id = Number(q.get('p')); delete p.p; }
  return { vue, p };
}
function render() {
  if (!S.data) return;
  const v = S.vue;
  const R = { accueil: vAccueil, boutique: vBoutique, produit: vProduit, panier: vPanier, commander: vCommander, payer: vPayer, recu: vRecu, commandes: vCommandes,
    commande: vCommande, compte: vCompte, chat: vChat, notifs: vNotifs, devis: vDevis, favoris: vFavoris, magasin: vMagasin };
  const html = (R[v] || vAccueil)();
  $('vue').innerHTML = `<div class="enter">${html}</div>`;
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v || (b.dataset.v === 'compte' && ['chat', 'notifs', 'devis', 'favoris', 'magasin'].includes(v)) || (b.dataset.v === 'commandes' && ['commande', 'recu', 'payer'].includes(v)) || (b.dataset.v === 'boutique' && v === 'produit')));
  document.querySelectorAll('.nav-d a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  $('fabs').classList.toggle('up', v === 'produit');
  $('fabs').classList.toggle('hide', ['payer', 'commander'].includes(v));
  badges(); after(v); tick();
}
function badges() {
  const n = cartCount();
  ['nb-panier', 'b-panier'].forEach(id => { const e = $(id); if (e) { e.textContent = n; e.classList.toggle('on', n > 0); } });
  const nn = S.notifs.filter(x => !x.lu).length; const b = $('b-notif'); if (b) { b.textContent = nn; b.classList.toggle('on', nn > 0); }
  const nc = S.commandes.filter(c => !['livree', 'annulee'].includes(c.statut)).length; const bc = $('nb-cmd'); if (bc) { bc.textContent = nc; bc.classList.toggle('on', nc > 0); }
}
function after(v) {
  reveal();
  if (v === 'accueil') { heroStart(); mapStore('map-home'); }
  if (v === 'magasin') mapStore('map-store');
  if (v === 'produit') afterProduit();
  if (v === 'commande') afterCommande();
  if (v === 'chat') { const e = $('chat-end'); if (e) e.scrollIntoView(); }
}
let revObs;
function reveal() {
  if (!('IntersectionObserver' in window)) { document.querySelectorAll('.rv').forEach(e => e.classList.add('vis')); return; }
  if (!revObs) revObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); revObs.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px', threshold: .05 });
  document.querySelectorAll('.rv:not(.vis)').forEach((e, i) => { e.style.transitionDelay = Math.min(i % 8, 7) * 45 + 'ms'; revObs.observe(e); });
}

// ---------------- Compte à rebours ----------------
function tick() {
  const now = Date.now(); let expired = false;
  document.querySelectorAll('[data-fin]').forEach(el => {
    let s = Math.max(0, Math.floor((Date.parse(el.dataset.fin) - now) / 1000));
    if (s === 0) expired = true;
    const j = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    const p2 = n => String(n).padStart(2, '0');
    if (el.dataset.fmt === 'c') el.textContent = (j ? j + ' j ' : '') + `${p2(h)}:${p2(m)}:${p2(s)}`;
    else el.innerHTML = (j ? `<span>${j}<small>jours</small></span>` : '') + `<span>${p2(h)}<small>h</small></span><span>${p2(m)}<small>min</small></span><span>${p2(s)}<small>sec</small></span>`;
  });
  if (expired && !tick.reloading) { tick.reloading = true; setTimeout(() => { tick.reloading = false; render(); }, 1200); }
}
setInterval(tick, 1000);

// ---------------- Héros ----------------
let heroT;
function heroStart() {
  clearInterval(heroT);
  const sl = document.querySelectorAll('.hero .sl'), dots = document.querySelectorAll('.hero .dots i');
  if (sl.length < 2) return;
  let i = 0;
  const show = n => { i = n; sl.forEach((s, k) => s.classList.toggle('on', k === i)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
  dots.forEach((d, k) => d.onclick = () => { show(k); clearInterval(heroT); heroT = setInterval(() => show((i + 1) % sl.length), 6500); });
  heroT = setInterval(() => { if (!document.querySelector('.hero')) return clearInterval(heroT); show((i + 1) % sl.length); }, 6500);
}
function bannerAction(lien) {
  if (!lien) return go('boutique');
  if (lien.startsWith('cat:')) { const c = S.data.categories.find(x => x.cle === lien.slice(4) || String(x.id) === lien.slice(4)); return go('boutique', { cat: c ? c.id : '' }); }
  if (lien.startsWith('p:')) return go('produit', { id: Number(lien.slice(2)) });
  if (/^https?:/.test(lien)) return window.open(lien, '_blank');
  go(lien);
}

// =====================================================================
// VUES
// =====================================================================
function vAccueil() {
  const D = S.data, prods = D.produits;
  const flash = prods.filter(promoOn).sort((a, b) => Date.parse(a.promo.fin) - Date.parse(b.promo.fin));
  const vedettes = prods.filter(p => p.vedette).slice(0, 8);
  const nouveaux = prods.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);
  const best = prods.slice().sort((a, b) => (b.ventes || 0) - (a.ventes || 0) || ((avisDe(b) || {}).nombre || 0) - ((avisDe(a) || {}).nombre || 0)).filter(p => p.badge === 'Best-seller' || p.ventes).slice(0, 4);
  const banners = D.banners.length ? D.banners : [{ titre: B().nom, texte: B().slogan, image: prods[0] && prods[0].images[0] }];
  const vus = S.vus.map(P).filter(Boolean).slice(0, 8);
  return `<div class="wrap">
    <section class="hero">
      ${banners.map((b, i) => `<div class="sl ${i ? '' : 'on'}" onclick="bannerAction('${esc(b.lien || '')}')"><img src="${esc(b.image || '/img/partage.jpg')}" alt="" ${i ? 'loading="lazy"' : ''}>
        <div class="txt"><div class="eyebrow">${esc(B().nom)} · Abidjan</div><h1 class="d">${deco(b.titre || '')}</h1><p>${esc(b.texte || '')}</p>
        <button class="btn">Découvrir ${I.sparkle}</button></div></div>`).join('')}
      ${banners.length > 1 ? `<div class="dots">${banners.map((b, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
    </section>
    <div class="atouts">
      <div class="atout"><div class="ic">${I.truck}</div><div><b>Livraison au créneau</b><span>Vous choisissez le jour et l’heure</span></div></div>
      <div class="atout"><div class="ic">${I.shield}</div><div><b>Paiement Mobile Money</b><span>Wave · Orange · MTN · Moov</span></div></div>
      <div class="atout"><div class="ic">${I.box}</div><div><b>Expédition partout</b><span>Côte d’Ivoire & international</span></div></div>
      <div class="atout"><div class="ic">${I.store}</div><div><b>Boutique physique</b><span>Faya Génie 2000</span></div></div>
    </div>

    <section class="sec">
      <div class="sec-h"><div><div class="eyebrow">Nos univers</div><h2 class="d">Tout pour une <i>cuisine d’exception</i></h2></div><a onclick="go('boutique')">Tout voir →</a></div>
      <div class="scroll-x"><div class="cats">${D.categories.map(c => { const ps = prods.filter(p => p.categorieId === c.id); const img = c.image || (ps.find(p => p.vedette) || ps[0] || {}).images?.[0]; return ps.length ? `<a class="catc rv" onclick="go('boutique',{cat:${c.id}})"><img src="${esc(img || '/img/partage.jpg')}" alt="" loading="lazy"><span class="n chip gris">${ps.length}</span><div class="t"><b>${esc(c.nom)}</b><span>${esc(c.sousTitre || '')}</span></div></a>` : ''; }).join('')}</div></div>
    </section>

    ${flash.length ? `<section class="sec flash rv">
      <div class="sec-h" style="flex-wrap:wrap"><div><div class="eyebrow">⏳ Ventes flash</div><h2 class="d">Les <i>prix cassés</i></h2><p class="muted small">Offres limitées dans le temps. Quand le compteur s’arrête, le prix remonte.</p></div>${cdHTML(flash[0].promo.fin)}</div>
      <div class="grid">${flash.slice(0, 8).map(pcard).join('')}</div></section>` : ''}

    ${vedettes.length ? `<section class="sec"><div class="sec-h"><div><div class="eyebrow">La sélection</div><h2 class="d">Nos <i>coups de cœur</i></h2></div><a onclick="go('boutique')">Tout voir →</a></div>
      <div class="grid">${vedettes.map(pcard).join('')}</div></section>` : ''}

    <section class="sec rv"><div class="card" style="display:grid;gap:16px;align-items:center;padding:24px;background:linear-gradient(135deg,rgba(242,140,40,.14),rgba(43,108,176,.12))">
      <div><div class="eyebrow">Assistante IA</div><h2 class="d" style="font-size:34px;margin:6px 0 8px">Une question ? <i>Awa</i> vous conseille</h2>
      <p class="muted">Quel set pour une famille de 6 ? Combien coûte la livraison à Yopougon ? Quel tapis pour une salle de bain glissante ? Réponse immédiate, jour et nuit.</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn or" onclick="openIA()">${I.sparkle} Demander à Awa</button><a class="btn wa" href="${waLink('Bonjour Tawali Souk, j’ai une question :')}" target="_blank" rel="noopener">${I.wa} WhatsApp</a></div>
    </div></section>

    ${best.length ? `<section class="sec"><div class="sec-h"><div><div class="eyebrow">Plébiscités</div><h2 class="d">Les <i>meilleures ventes</i></h2></div></div><div class="grid">${best.map(pcard).join('')}</div></section>` : ''}
    <section class="sec"><div class="sec-h"><div><div class="eyebrow">Arrivages</div><h2 class="d">Les <i>nouveautés</i></h2></div><a onclick="go('boutique',{tri:'new'})">Tout voir →</a></div><div class="grid">${nouveaux.map(pcard).join('')}</div></section>
    ${vus.length > 1 ? `<section class="sec"><div class="sec-h"><div><div class="eyebrow">Pour vous</div><h2 class="d">Vus <i>récemment</i></h2></div></div><div class="scroll-x">${vus.map(p => `<div style="width:200px">${pcard(p)}</div>`).join('')}</div></section>` : ''}

    <section class="sec"><div class="sec-h"><div><div class="eyebrow">Sur mesure</div><h2 class="d">Personnalisation & <i>commandes en gros</i></h2></div></div>
      <div class="card rv" style="display:grid;gap:14px"><p class="muted">Pantoufles brodées pour un mariage, tapis à votre logo pour un hôtel, lots de marmites pour une dot, prix revendeur… Décrivez votre projet, nous vous envoyons un devis.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" onclick="go('devis')">${I.gift} Demander un devis</button><button class="btn ghost" onclick="go('chat')">${I.chat} Discuter avec nous</button></div></div></section>

    ${storeCard('map-home')}
  </div>${footer()}`;
}
function storeCard(mapId) {
  const b = B();
  return `<section class="sec rv"><div class="store">
    <div class="mp" id="${mapId}"></div>
    <div class="bd2"><div class="eyebrow">La boutique</div><h2 class="d" style="font-size:34px;margin:6px 0">Venez <i>toucher</i> la qualité</h2>
      <p class="muted" style="display:flex;gap:8px;align-items:center;margin-bottom:4px">${I.pin.replace('<svg', '<svg style="width:17px;height:17px;flex-shrink:0;color:var(--or)"')} ${esc(b.adresse)}</p>
      <p class="muted small" style="margin-bottom:16px">${esc(b.horaires)}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn or sm" href="${yangoLink()}" target="_blank" rel="noopener">${I.route} Commander un Yango</a>
        <a class="btn ghost sm" href="https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}" target="_blank" rel="noopener">${I.pin} Itinéraire</a>
        <a class="btn ghost sm" href="tel:${esc(b.tel.replace(/\s/g, ''))}">${I.phone} Appeler</a>
      </div></div></div></section>`;
}
function yangoLink() { const b = B(); return (b.yango || '').replace('{lat}', b.lat).replace('{lng}', b.lng) || `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`; }
function footer() {
  const b = B();
  return `<footer class="foot"><div class="wrap"><div class="g">
    <div><img src="/img/logo-clair.png" alt="${esc(b.nom)}" style="height:46px;margin-bottom:12px"><p>${esc(b.slogan)}</p><p style="margin-top:8px">${esc(b.adresse)}</p></div>
    <div><h4>Boutique</h4>${S.data.categories.slice(0, 6).map(c => `<a onclick="go('boutique',{cat:${c.id}})">${esc(c.nom)}</a>`).join('')}</div>
    <div><h4>Aide</h4><a onclick="go('commandes')">Suivre ma commande</a><a onclick="openIA()">Assistante Awa</a><a onclick="go('devis')">Devis & personnalisation</a><a onclick="go('magasin')">Venir en boutique</a><a onclick="showTarifs()">Tarifs de livraison</a></div>
    <div><h4>Contact</h4><a href="tel:${esc(b.tel.replace(/\s/g, ''))}">${esc(b.tel)}</a><a href="${waLink('Bonjour Tawali Souk !')}" target="_blank" rel="noopener">WhatsApp</a>${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}
      ${b.facebook ? `<a href="${esc(b.facebook)}" target="_blank" rel="noopener">Facebook</a>` : ''}${b.instagram ? `<a href="${esc(b.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ''}${b.tiktok ? `<a href="${esc(b.tiktok)}" target="_blank" rel="noopener">TikTok</a>` : ''}</div>
  </div><p class="tiny" style="margin-top:28px;color:var(--txt3)">© ${new Date().getFullYear()} ${esc(b.nom)} — Abidjan, Côte d’Ivoire</p></div></footer>`;
}

// ---------------- Catalogue ----------------
function vBoutique() {
  const D = S.data; const cat = Number(S.p.cat) || 0; const q = String(S.p.q || '').toLowerCase().trim(); const tri = S.p.tri || S.tri;
  let list = D.produits.filter(p => !cat || p.categorieId === cat);
  if (q) { const mots = q.split(/\s+/); list = list.filter(p => { const t = (p.nom + ' ' + p.desc + ' ' + catOf(p).nom + ' ' + p.variantes.map(v => v.nom).join(' ') + ' ' + p.ref).toLowerCase(); return mots.every(w => t.includes(w)); }); }
  if (tri === 'pxa') list.sort((a, b) => (px(a) || 1e12) - (px(b) || 1e12));
  else if (tri === 'pxd') list.sort((a, b) => px(b) - px(a));
  else if (tri === 'new') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (tri === 'promo') list.sort((a, b) => remisePct(b) - remisePct(a));
  else list.sort((a, b) => (b.vedette - a.vedette) || ((b.ventes || 0) - (a.ventes || 0)));
  const c = cat && D.categories.find(x => x.id === cat);
  const groupes = !cat && !q ? D.categories.map(k => ({ k, ps: list.filter(p => p.categorieId === k.id) })).filter(g => g.ps.length) : null;
  return `<div class="wrap">
    <div class="page-h"><div class="eyebrow">${q ? 'Recherche' : 'La boutique'}</div><h1 class="d">${q ? `« ${esc(S.p.q)} »` : c ? esc(c.nom) : 'Toute la <i>collection</i>'}</h1>${c ? `<p class="muted">${esc(c.sousTitre || '')}</p>` : ''}</div>
    <div class="search" style="max-width:none;margin:12px 0 0"><span>${I.search}</span><input id="q2" placeholder="Rechercher : granité, inox, tapis bleu…" value="${esc(S.p.q || '')}" oninput="searchLive(this.value)"></div>
    <div class="scroll-x" style="margin-top:14px"><button class="pill ${!cat ? 'on' : ''}" onclick="go('boutique',{q:S.p.q||'',tri:S.p.tri||''},{replace:true,noAnim:true,keepScroll:true})">Tout</button>
      ${D.categories.map(k => `<button class="pill ${cat === k.id ? 'on' : ''}" onclick="go('boutique',{cat:${k.id},q:S.p.q||'',tri:S.p.tri||''},{replace:true,noAnim:true,keepScroll:true})">${esc(k.nom)}</button>`).join('')}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 14px;gap:10px"><span class="muted small">${list.length} article${list.length > 1 ? 's' : ''}</span>
      <select class="inp" style="width:auto;height:42px;font-size:13.5px" onchange="S.tri=this.value;go('boutique',Object.assign({},S.p,{tri:this.value}),{replace:true,noAnim:true,keepScroll:true})">
        ${[['pop', 'Populaires'], ['new', 'Nouveautés'], ['promo', 'Promotions'], ['pxa', 'Prix croissant'], ['pxd', 'Prix décroissant']].map(([k, l]) => `<option value="${k}" ${tri === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${!list.length ? `<div class="empty"><div class="big">🔍</div><div class="d">Aucun résultat</div><p>Essayez un autre mot, ou demandez à Awa.</p><button class="btn or" style="margin-top:16px" onclick="openIA(${JSON.stringify(S.p.q || '').replace(/"/g, '&quot;')})">${I.sparkle} Demander à Awa</button></div>`
      : groupes ? groupes.map(g => `<section class="sec" style="margin-top:30px"><div class="sec-h"><div><h2 class="d" style="font-size:30px">${esc(g.k.nom)}</h2><span class="muted small">${esc(g.k.sousTitre || '')}</span></div><a onclick="go('boutique',{cat:${g.k.id}})">Voir les ${g.ps.length} →</a></div><div class="grid">${g.ps.slice(0, 8).map(pcard).join('')}</div></section>`).join('')
      : `<div class="grid">${list.map(pcard).join('')}</div>`}
  </div>${footer()}`;
}
let searchT;
function searchLive(v) {
  clearTimeout(searchT);
  searchT = setTimeout(() => {
    const pos = document.activeElement && document.activeElement.id;
    go('boutique', Object.assign({}, S.p, { q: v }), { replace: true, noAnim: true, keepScroll: true });
    const el = $(pos === 'q1' ? 'q1' : 'q2'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 280);
}

// ---------------- Fiche produit ----------------
function vProduit() {
  const p = P(S.p.id);
  if (!p) return `<div class="wrap"><div class="empty"><div class="big">🛍️</div><div class="d">Article introuvable</div><p>Il n’est peut-être plus disponible.</p><button class="btn" style="margin-top:16px" onclick="go('boutique')">Voir la boutique</button></div></div>`;
  if (S.vus[0] !== p.id) { S.vus = [p.id].concat(S.vus.filter(x => x !== p.id)); save(); }
  if (!S.sel[p.id]) S.sel[p.id] = (p.variantes.find(v => v.dispo) || {}).id || '';
  const vid = S.sel[p.id], v = p.variantes.find(x => x.id === vid);
  const imgs = p.images.slice(); const startIdx = v ? Math.max(0, imgs.indexOf(v.image)) : 0;
  const a = avisDe(p), cat = catOf(p), fav = S.favs.includes(p.id);
  const sim = S.data.produits.filter(x => x.id !== p.id && x.categorieId === p.categorieId).slice(0, 4);
  const acc = (ic, t, body, open) => body ? `<details ${open ? 'open' : ''}><summary><span class="i">${ic}</span>${t}</summary><div class="ac">${body}</div></details>` : '';
  const ul = l => l && l.length ? `<ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const dispo = p.enStock && (!v || v.dispo);
  const wamsg = `Bonjour Tawali Souk, je souhaite commander :\n• ${p.nom}${v ? ' — ' + v.nom : ''} × ${S.qte}${p.prix ? ' (' + F(px(p) * S.qte) + ')' : ''}\nLien : ${location.origin}/?p=${p.id}`;
  return `<div class="wrap">
    <div style="padding-top:16px" class="small muted"><a onclick="go('boutique')">Boutique</a> › <a onclick="go('boutique',{cat:${cat.id}})">${esc(cat.nom || '')}</a></div>
    <div class="pp">
      <div class="gal">
        <div class="main"><div class="track" id="track">${imgs.map((im, i) => `<div class="slide"><div class="blur" style="background-image:url('${esc(im)}')"></div><img src="${esc(im)}" alt="${esc(p.nom)}" ${i ? 'loading="lazy"' : ''} onclick="zoomImg('${esc(im)}')"></div>`).join('')}</div>
          <span class="nb" id="gal-nb">${startIdx + 1} / ${imgs.length}</span>
          <button class="fav ${fav ? 'on' : ''}" style="top:14px;right:14px;width:44px;height:44px" onclick="toggleFav(${p.id},this)">${I.heart}</button>
          ${promoOn(p) ? `<div class="bd" style="position:absolute;top:14px;left:14px"><span class="tag promo">-${remisePct(p)} %</span></div>` : ''}
        </div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((im, i) => `<img src="${esc(im)}" data-i="${i}" class="${i === startIdx ? 'on' : ''}" onclick="galTo(${i})" alt="">`).join('')}</div>` : ''}
      </div>
      <div class="info">
        <div class="eyebrow">${esc(cat.nom || '')}${p.ref ? ' · Réf. ' + esc(p.ref) : ''}</div>
        <h1 class="d">${esc(p.nom)}</h1>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${a ? `${stars(a.moyenne)} <span class="small muted">${a.moyenne}/5 · ${a.nombre} avis</span>` : `<span class="chip gris">Soyez la première à donner votre avis</span>`}
          ${p.badge ? `<span class="chip or">${esc(p.badge)}</span>` : ''}${p.stockBas ? `<span class="chip rouge">Plus que ${p.stockBas} en stock</span>` : ''}</div>
        <div class="pr">${p.prix > 0 ? `<b>${F(px(p))}</b>${promoOn(p) ? `<s>${F(p.prix)}</s><span class="chip vert">Économisez ${F(p.prix - p.promo.prix)}</span>` : ''}` : `<b style="font-size:24px;color:var(--or2)">Prix sur demande</b>`}</div>
        ${promoOn(p) ? `<div class="promo-box"><b>⏳ Prix cassé — se termine dans</b>${cdHTML(p.promo.fin)}</div>` : ''}
        <p style="font-size:16px;color:var(--txt2)">${esc(p.desc)}</p>
        ${p.contenu ? `<p class="small" style="margin-top:10px"><span class="chip bleu">${I.box.replace('<svg', '<svg style="width:13px;height:13px"')} ${esc(p.contenu)}</span></p>` : ''}
        ${p.variantes.length ? `<div class="lbl">Modèle : <span style="color:var(--txt)">${esc(v ? v.nom : '')}</span></div><div class="vars">${p.variantes.map(x => `<button class="var ${x.id === vid ? 'on' : ''} ${x.dispo ? '' : 'off'}" onclick="selVar(${p.id},'${x.id}')"><img src="${esc(x.image || p.images[0])}" alt="">${esc(x.nom)}</button>`).join('')}</div>` : ''}
        <div class="buy" id="buy">
          ${p.prix > 0 && dispo ? `<div class="qty"><button onclick="setQ(-1)">−</button><span id="qte">${S.qte}</span><button onclick="setQ(1)">+</button></div>
          <button class="btn" onclick="addCart(${p.id},'${vid}',S.qte)">${I.bag} Ajouter au panier</button>` : p.prix > 0 ? `<button class="btn" disabled>Épuisé pour le moment</button>` : `<button class="btn" onclick="go('devis',{produit:${p.id}})">${I.gift} Demander le prix</button>`}
        </div>
        <div class="buy" style="margin-top:10px">
          <a class="btn wa" href="${waLink(wamsg)}" target="_blank" rel="noopener">${I.wa} Commander sur WhatsApp</a>
          <button class="btn ghost" onclick="go('devis',{produit:${p.id}})">${I.gift} Personnaliser / en gros</button>
        </div>
        <div class="atouts" style="grid-template-columns:1fr 1fr;margin-top:16px">
          <div class="atout"><div class="ic">${I.truck}</div><div><b>Abidjan dès ${F(Math.min(...S.data.livraison.zones.map(z => z.prix)))}</b><span>Le jour et l’heure de votre choix</span></div></div>
          <div class="atout"><div class="ic">${I.box}</div><div><b>Expédition ${p.expedition === 'tapis' ? 'dès ' + F(S.data.livraison.tapisPaliers[0]?.prix || 0) : 'dès ' + F(S.data.livraison.colisPaliers[0]?.prix || 0)}</b><span><a onclick="showTarifs()" style="text-decoration:underline">Voir les tarifs</a></span></div></div>
        </div>
        <div class="acc">
          ${acc(I.crown, 'Qualités', ul(p.points), true)}
          ${acc(I.leaf, 'Les bienfaits au quotidien', ul(p.bienfaits))}
          ${acc(I.target, 'Le problème qu’il règle', p.solution ? `<p>${esc(p.solution)}</p>` : '')}
          ${acc(I.sparkle, 'Pourquoi ne pas passer à côté', p.pourquoi ? `<p>${esc(p.pourquoi)}</p>` : '')}
          ${acc(I.drop, 'Entretien', p.entretien ? `<p>${esc(p.entretien)}</p>` : '')}
          ${acc(I.truck, 'Livraison, expédition & retrait', `<p>Abidjan : livraison au jour et au créneau de votre choix, paiement possible à la livraison. Expédition dans toute la Côte d’Ivoire (paiement avant envoi) et à l’international. Retrait gratuit à la boutique, ${esc(B().adresse)}.</p><button class="btn ghost xs" style="margin-top:10px" onclick="showTarifs()">Voir tous les tarifs</button>`)}
        </div>
        ${p.pourquoi ? `<div class="quote">« ${esc(p.pourquoi.split('. ')[0].replace(/\.$/, ''))}. »</div>` : ''}
      </div>
    </div>
    ${a && a.liste.length ? `<section class="sec"><div class="sec-h"><div><div class="eyebrow">Ils l’ont adopté</div><h2 class="d">Avis <i>clients</i></h2></div></div>${a.liste.map(r => `<div class="rev">${stars(r.note)} <b style="margin-left:6px">${esc(r.nom)}</b> ${r.recommande ? '<span class="chip vert" style="margin-left:6px">Recommande</span>' : ''}<p class="muted" style="margin-top:6px">${esc(r.texte)}</p></div>`).join('')}</section>` : ''}
    ${sim.length ? `<section class="sec"><div class="sec-h"><div><div class="eyebrow">Dans la même famille</div><h2 class="d">Vous aimerez <i>aussi</i></h2></div><a onclick="go('boutique',{cat:${cat.id}})">Tout voir →</a></div><div class="grid">${sim.map(pcard).join('')}</div></section>` : ''}
  </div>
  ${p.prix > 0 && dispo ? `<div class="sticky-buy" id="sticky"><div class="p"><b>${F(px(p))}</b><span>${esc(p.nom)}${v ? ' — ' + esc(v.nom) : ''}</span></div><button class="btn sm" onclick="addCart(${p.id},'${vid}',S.qte)">${I.bag} Ajouter</button></div>` : ''}
  ${footer()}`;
}
function selVar(pid, vid) {
  const p = P(pid), v = p.variantes.find(x => x.id === vid); if (!v) return;
  if (!v.dispo) return toast('Modèle épuisé', 'Choisissez un autre modèle ou écrivez-nous sur WhatsApp.', true);
  S.sel[pid] = vid; render();
  const i = p.images.indexOf(v.image); if (i >= 0) setTimeout(() => galTo(i, true), 30);
}
function setQ(d) { S.qte = Math.max(1, Math.min(99, S.qte + d)); const e = $('qte'); if (e) e.textContent = S.qte; }
function galTo(i, instant) { const t = $('track'); if (t) t.scrollTo({ left: t.clientWidth * i, behavior: instant ? 'instant' : 'smooth' }); }
function zoomImg(src) { $('zoom-img').src = src; $('zoom').classList.add('on'); }
let stickyObs;
function afterProduit() {
  const p = P(S.p.id); if (!p) return;
  const t = $('track');
  if (t) {
    const v = p.variantes.find(x => x.id === S.sel[p.id]); const i = v ? p.images.indexOf(v.image) : 0;
    if (i > 0) requestAnimationFrame(() => { t.scrollLeft = t.clientWidth * i; });
    t.onscroll = () => { const k = Math.round(t.scrollLeft / t.clientWidth); const nb = $('gal-nb'); if (nb) nb.textContent = (k + 1) + ' / ' + p.images.length; document.querySelectorAll('.thumbs img').forEach(im => im.classList.toggle('on', Number(im.dataset.i) === k)); };
  }
  if (stickyObs) stickyObs.disconnect();
  const buy = $('buy'), st = $('sticky');
  if (buy && st && 'IntersectionObserver' in window) { stickyObs = new IntersectionObserver(es => st.classList.toggle('on', !es[0].isIntersecting && es[0].boundingClientRect.top < 0)); stickyObs.observe(buy); }
}

// ---------------- Panier ----------------
function vPanier() {
  const L = cartLines();
  if (!L.length) return `<div class="wrap"><div class="empty"><div class="big">🛒</div><div class="d">Votre panier est vide</div><p>Nos plus belles pièces vous attendent.</p><button class="btn" style="margin-top:18px" onclick="go('boutique')">Découvrir la boutique</button></div></div>`;
  const tot = cartTotal();
  const wamsg = 'Bonjour Tawali Souk, je souhaite commander :\n' + L.map(l => `• ${l.p.nom}${l.v ? ' — ' + l.v.nom : ''} × ${l.c.q} = ${F(l.total)}`).join('\n') + `\nTotal articles : ${F(tot)}`;
  return `<div class="wrap"><div class="page-h"><div class="eyebrow">${cartCount()} article${cartCount() > 1 ? 's' : ''}</div><h1 class="d">Votre <i>panier</i></h1></div>
  <div class="cols"><div class="card">${L.map(l => `<div class="line"><img src="${esc(imgOf(l.p, l.c.v))}" alt="" onclick="go('produit',{id:${l.p.id}})" style="cursor:pointer">
      <div class="t"><b>${esc(l.p.nom)}</b><span>${l.v ? esc(l.v.nom) + ' · ' : ''}${F(l.unit)}${promoOn(l.p) ? ' <span class="chip promo" style="background:var(--grad);color:#1b0e02;padding:2px 7px">promo</span>' : ''}</span>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><div class="qty"><button onclick="cartQ('${l.c.k}',-1)">−</button><span>${l.c.q}</span><button onclick="cartQ('${l.c.k}',1)">+</button></div><button class="tiny muted" onclick="cartQ('${l.c.k}',-999)" style="text-decoration:underline">Retirer</button></div></div>
      <b style="white-space:nowrap">${F(l.total)}</b></div>`).join('')}</div>
    <div class="side"><div class="card"><h3>Récapitulatif</h3>
      <div class="tot"><span>Articles</span><span>${F(tot)}</span></div>
      <div class="tot"><span>Livraison / expédition</span><span>calculée à l’étape suivante</span></div>
      <div class="tot big"><span>Total</span><span>${F(tot)}</span></div>
      <button class="btn full" style="margin-top:16px" onclick="go('commander')">${I.lock} Commander</button>
      <a class="btn wa full" style="margin-top:10px" href="${waLink(wamsg)}" target="_blank" rel="noopener">${I.wa} Envoyer sur WhatsApp</a>
      <p class="secure">${I.shield} Paiement Mobile Money ou à la livraison</p>
    </div></div></div></div>`;
}
function cartQ(k, d) {
  const c = S.cart.find(x => x.k === k); if (!c) return;
  c.q += d; if (c.q <= 0) S.cart = S.cart.filter(x => x !== c);
  save(); render();
}

// ---------------- Commande (checkout) ----------------
function tzNow() {
  const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: B().fuseau || 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).forEach(x => p[x.type] = x.value);
  return { date: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
function joursDispo() {
  const L = S.data.livraison, now = tzNow(), out = [];
  const d0 = new Date(now.date + 'T12:00:00Z');
  for (let i = 0; i <= Math.min(L.joursMax || 14, 21); i++) {
    const d = new Date(d0); d.setUTCDate(d.getUTCDate() + i);
    const ymd = d.toISOString().slice(0, 10);
    if (!L.jours.includes(d.getUTCDay()) || (L.joursFermes || []).includes(ymd)) continue;
    const slots = L.creneaux.map(c => ({ c, ok: !(ymd === now.date && Number(c.slice(0, 2)) * 60 < now.min + (L.delaiHeures || 0) * 60) }));
    if (!slots.some(s => s.ok)) continue;
    out.push({ ymd, d, slots });
  }
  return out;
}
function fraisCalc() {
  const co = S.co, L = S.data.livraison, lines = cartLines();
  if (co.mode === 'retrait') return { frais: 0, note: 'Retrait gratuit' };
  if (co.mode === 'livraison') { const z = L.zones.find(x => x.id === co.zoneId); return z ? { frais: z.prix, note: z.nom } : { frais: null, note: 'Choisissez votre zone' }; }
  if (co.pays && co.pays !== 'Côte d’Ivoire') { const i = L.international.find(x => x.pays === co.pays); return i ? { frais: i.prix, note: i.note || 'Forfait ' + i.pays } : { frais: null }; }
  let km = 0; const v = L.villes.find(x => x.nom === co.ville);
  if (v) km = v.km; else if (co.ville === '__autre' && Number(co.km)) km = Number(co.km); else return { frais: null, note: 'Choisissez la ville' };
  const nbT = lines.filter(l => l.p.expedition === 'tapis').reduce((s, l) => s + l.c.q, 0), colis = lines.some(l => l.p.expedition !== 'tapis');
  let ft = 0; L.tapisPaliers.slice().sort((a, b) => a.min - b.min).forEach(x => { if (nbT >= x.min) ft = x.prix; });
  let fc = 0; if (colis) { const pal = L.colisPaliers.slice().sort((a, b) => a.jusqua - b.jusqua); fc = (pal.find(x => km <= x.jusqua) || pal[pal.length - 1] || {}).prix || 0; }
  return { frais: (nbT ? ft : 0) + fc, note: [nbT ? `${nbT} tapis/pantoufle${nbT > 1 ? 's' : ''} : ${F(ft)}` : '', colis ? `colis (~${km} km) : ${F(fc)}` : ''].filter(Boolean).join(' + ') };
}
function coSet(k, v, rerender) { S.co[k] = v; save(); if (rerender !== false) { const y = window.scrollY; render(); window.scrollTo(0, y); } }
function vCommander() {
  const L = cartLines(); if (!L.length) return vPanier();
  const D = S.data, co = S.co, Lv = D.livraison, c = S.client || {};
  if (co.nom === undefined) co.nom = c.nom || ''; if (co.tel === undefined) co.tel = c.tel || '';
  if (!co.mode) co.mode = 'livraison'; if (!co.zoneId && c.zoneId) co.zoneId = c.zoneId; if (co.adresse === undefined) co.adresse = c.adresse || '';
  if (!co.pays) co.pays = 'Côte d’Ivoire';
  if (co.mode === 'expedition' && co.paiement === 'livraison') co.paiement = '';
  const sous = cartTotal(), fr = fraisCalc();
  const jours = joursDispo();
  if (co.mode !== 'expedition' && (!co.date || !jours.some(j => j.ymd === co.date))) { co.date = jours[0] ? jours[0].ymd : ''; co.creneau = ''; }
  const jSel = jours.find(j => j.ymd === co.date);
  if (jSel && co.creneau && !jSel.slots.some(s => s.c === co.creneau && s.ok)) co.creneau = '';
  const modes = Object.keys(D.paiement.modes);
  const fid = D.fidelite, pts = (S.client && !S.client.invite) ? S.client.points || 0 : 0;
  const remise = co.points && pts >= fid.seuilPoints ? Math.min(pts, Math.floor(Math.floor(sous / 2) / fid.valeurPoint)) * fid.valeurPoint : 0;
  const total = sous + (fr.frais || 0) - remise;
  const dateBlock = co.mode !== 'expedition' ? `<div class="lbl">${co.mode === 'retrait' ? 'Quand passez-vous ?' : 'Date de livraison'}</div>
    <div class="days">${jours.map(j => `<button class="day ${co.date === j.ymd ? 'on' : ''}" onclick="coSet('date','${j.ymd}')"><small>${j.d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}</small><b>${j.d.getUTCDate()}</b><small>${j.d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}</small></button>`).join('')}</div>
    <div class="lbl">Créneau horaire</div><div class="slots">${(jSel ? jSel.slots : []).map(s => `<button class="slot ${co.creneau === s.c ? 'on' : ''} ${s.ok ? '' : 'dis'}" onclick="coSet('creneau','${s.c}')">${esc(s.c)}</button>`).join('')}</div>` : '';
  return `<div class="wrap"><div class="page-h"><div class="eyebrow">Paiement sécurisé</div><h1 class="d">Finaliser la <i>commande</i></h1></div>
  <div class="cols"><div>
    <div class="card"><h3><span class="n">1</span>Vos coordonnées</h3>
      <div class="row2"><div class="fld"><label>Nom complet</label><input class="inp" id="co-nom" value="${esc(co.nom)}" placeholder="Prénom et nom" oninput="S.co.nom=this.value;save()"></div>
      <div class="fld"><label>Téléphone (WhatsApp)</label><input class="inp" id="co-tel" type="tel" inputmode="tel" value="${esc(co.tel)}" placeholder="07 00 00 00 00" oninput="S.co.tel=this.value;save()"></div></div>
      ${!S.client || S.client.invite ? `<p class="tiny muted">Déjà client ? <a style="color:var(--or);text-decoration:underline" onclick="go('compte')">Connectez-vous</a> pour cumuler vos points fidélité.</p>` : ''}
    </div>
    <div class="card"><h3><span class="n">2</span>Réception</h3>
      <div class="opts">
        <button class="opt ${co.mode === 'livraison' ? 'on' : ''}" onclick="coSet('mode','livraison')"><span class="ic">${I.truck}</span><span><b>Livraison à Abidjan & environs</b><span>Le jour et l’heure de votre choix</span></span><span class="px">dès ${F(Math.min(...Lv.zones.map(z => z.prix)))}</span></button>
        <button class="opt ${co.mode === 'expedition' ? 'on' : ''}" onclick="coSet('mode','expedition')"><span class="ic">${I.box}</span><span><b>Expédition</b><span>Intérieur du pays & international · paiement avant envoi</span></span><span class="px">calculée</span></button>
        <button class="opt ${co.mode === 'retrait' ? 'on' : ''}" onclick="coSet('mode','retrait')"><span class="ic">${I.store}</span><span><b>Retrait en boutique</b><span>${esc(B().adresse)}</span></span><span class="px">Gratuit</span></button>
      </div>
      ${co.mode === 'livraison' ? `<div class="lbl">Votre zone</div><div class="opts">${Lv.zones.map(z => `<button class="opt ${co.zoneId === z.id ? 'on' : ''}" style="padding:11px 14px" onclick="coSet('zoneId','${z.id}')"><span><b>${esc(z.nom)}</b><span>${esc(z.exemples || '')}</span></span><span class="px">${F(z.prix)}</span></button>`).join('')}</div>
        <p class="tiny muted" style="margin-top:8px">Votre ville n’est pas dans la liste ? Choisissez « Expédition ».</p>
        <div class="fld" style="margin-top:14px"><label>Adresse de livraison</label><input class="inp" value="${esc(co.adresse || '')}" placeholder="Commune, quartier, rue…" oninput="S.co.adresse=this.value;save()"></div>
        <div class="fld"><label>Point de repère</label><input class="inp" value="${esc(co.repere || '')}" placeholder="Ex. après la pharmacie, portail bleu" oninput="S.co.repere=this.value;save()"></div>
        <button class="btn ghost sm" onclick="sharePos()">${I.pin} ${co.position ? 'Position partagée ✓' : 'Partager ma position (livraison plus rapide)'}</button>
        <p class="tiny muted" style="margin-top:6px">Avec votre position, vous êtes prévenu(e) automatiquement quand le livreur est à quelques pas.</p>` : ''}
      ${co.mode === 'expedition' ? `<div class="lbl">Destination</div>
        <div class="row2"><div class="fld"><label>Pays</label><select class="inp" onchange="coSet('pays',this.value)"><option ${co.pays === 'Côte d’Ivoire' ? 'selected' : ''}>Côte d’Ivoire</option>${Lv.international.map(i => `<option ${co.pays === i.pays ? 'selected' : ''}>${esc(i.pays)}</option>`).join('')}</select></div>
        ${co.pays === 'Côte d’Ivoire' ? `<div class="fld"><label>Ville</label><select class="inp" onchange="coSet('ville',this.value)"><option value="">Choisir…</option>${Lv.villes.map(v => `<option value="${esc(v.nom)}" ${co.ville === v.nom ? 'selected' : ''}>${esc(v.nom)} (~${v.km} km)</option>`).join('')}<option value="__autre" ${co.ville === '__autre' ? 'selected' : ''}>Autre ville…</option></select></div>` : '<div></div>'}</div>
        ${co.pays === 'Côte d’Ivoire' && co.ville === '__autre' ? `<div class="row2"><div class="fld"><label>Nom de la ville</label><input class="inp" value="${esc(co.villeAutre || '')}" oninput="S.co.villeAutre=this.value;save()"></div><div class="fld"><label>Distance d’Abidjan</label><select class="inp" onchange="coSet('km',this.value)"><option value="">Choisir…</option>${Lv.colisPaliers.map((p, i, a) => { const de = i ? a[i - 1].jusqua + 1 : 0; const lab = p.jusqua >= 99999 ? `plus de ${de - 1} km` : de === p.jusqua ? `environ ${p.jusqua} km` : `${de} à ${p.jusqua} km`; return `<option value="${p.jusqua >= 99999 ? de + 50 : p.jusqua}" ${Number(co.km) === (p.jusqua >= 99999 ? de + 50 : p.jusqua) ? 'selected' : ''}>${lab}</option>`; }).join('')}</select></div></div>` : ''}
        <div class="row2"><div class="fld"><label>Destinataire</label><input class="inp" value="${esc(co.destinataire || co.nom || '')}" placeholder="Nom de la personne qui récupère" oninput="S.co.destinataire=this.value;save()"></div>
        <div class="fld"><label>Gare / compagnie souhaitée</label><input class="inp" value="${esc(co.gare || '')}" placeholder="Ex. UTB, STIF… (facultatif)" oninput="S.co.gare=this.value;save()"></div></div>
        <div class="note or">${I.info}<span>Expédition : paiement Mobile Money obligatoire avant l’envoi, puis envoi du reçu sur WhatsApp. Délai : ${esc(Lv.delaiExpedition || '')}.${co.pays === 'France' ? ' Pour la France, les frais du transporteur sont à votre charge.' : ''}</span></div>` : ''}
      ${dateBlock}
    </div>
    <div class="card"><h3><span class="n">3</span>Paiement</h3>
      <div class="opts">${modes.map(m => `<button class="opt ${co.paiement === m ? 'on' : ''}" onclick="coSet('paiement','${m}')"><span class="op-logo op-${m}">${OPS_COURT[m]}</span><span><b>${OPS[m]}</b><span>Paiement direct et sécurisé, sans intermédiaire</span></span></button>`).join('')}
        ${D.paiement.livraisonCash ? `<button class="opt ${co.paiement === 'livraison' ? 'on' : ''} ${co.mode === 'expedition' ? 'dis' : ''}" onclick="coSet('paiement','livraison')"><span class="op-logo op-livraison">${I.truck.replace('<svg', '<svg style="width:20px;height:20px"')}</span><span><b>${co.mode === 'retrait' ? 'Payer en boutique' : 'Payer à la livraison'}</b><span>${co.mode === 'expedition' ? 'Indisponible pour une expédition' : 'Espèces ou Mobile Money au livreur'}</span></span></button>` : ''}
      </div>
      ${pts >= fid.seuilPoints && fid.actif ? `<button class="opt ${co.points ? 'on' : ''}" style="margin-top:10px" onclick="coSet('points',!S.co.points)"><span class="ic">${I.gift}</span><span><b>Utiliser mes ${pts} points</b><span>Jusqu’à ${F(Math.min(pts, Math.floor(Math.floor(sous / 2) / fid.valeurPoint)) * fid.valeurPoint)} de réduction</span></span></button>` : ''}
      <div class="fld" style="margin-top:14px"><label>Message (facultatif)</label><textarea class="inp" rows="2" placeholder="Une précision pour nous ?" oninput="S.co.note=this.value;save()">${esc(co.note || '')}</textarea></div>
    </div>
  </div>
  <div class="side"><div class="card"><h3>Votre commande</h3>
    ${L.map(l => `<div class="line" style="padding:8px 0"><img src="${esc(imgOf(l.p, l.c.v))}" alt="" style="width:50px;height:50px;border-radius:12px"><div class="t"><b style="font-size:13.5px">${esc(l.p.nom)}</b><span>${l.v ? esc(l.v.nom) + ' · ' : ''}× ${l.c.q}</span></div><span class="small" style="font-weight:700">${F(l.total)}</span></div>`).join('')}
    <div class="tot" style="margin-top:8px"><span>Articles</span><span>${F(sous)}</span></div>
    <div class="tot"><span>${co.mode === 'retrait' ? 'Retrait' : co.mode === 'expedition' ? 'Expédition' : 'Livraison'}</span><span>${fr.frais === null ? '—' : fr.frais === 0 && co.mode !== 'retrait' ? 'à votre charge' : F(fr.frais)}</span></div>
    ${fr.note && co.mode === 'expedition' ? `<p class="tiny muted" style="text-align:right">${esc(fr.note)}</p>` : ''}
    ${remise ? `<div class="tot"><span>Points fidélité</span><span>− ${F(remise)}</span></div>` : ''}
    <div class="tot big"><span>Total</span><span>${F(total)}</span></div>
    ${co.mode !== 'expedition' && co.date ? `<p class="small muted" style="margin-top:8px">${I.clock.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} ${esc(fjour(co.date))}${co.creneau ? ', ' + esc(co.creneau) : ''}</p>` : ''}
    <div class="err" id="co-err"></div>
    <button class="btn full" id="co-go" style="margin-top:14px" onclick="passerCommande()">${co.paiement && co.paiement !== 'livraison' ? I.lock + ' Payer ' + F(total) : I.check + ' Confirmer la commande'}</button>
    <p class="secure">${I.shield} Aucun intermédiaire : vous payez directement la boutique</p>
  </div></div></div></div>`;
}
function sharePos() {
  if (!navigator.geolocation) return toast('Position indisponible', 'Indiquez votre adresse et un repère.', true);
  toast('Localisation…', 'Autorisez l’accès à votre position.');
  navigator.geolocation.getCurrentPosition(p => { S.co.position = { lat: p.coords.latitude, lng: p.coords.longitude }; toast('Position enregistrée ✓', 'Le livreur trouvera facilement.'); const y = window.scrollY; render(); window.scrollTo(0, y); },
    () => toast('Position refusée', 'Indiquez votre adresse et un point de repère.', true), { enableHighAccuracy: true, timeout: 15000 });
}
async function ensureClient(nom, tel) {
  if (S.token && S.client) {
    if (S.client.invite) { const r = await api('/api/client/moi', { method: 'PUT', body: { nom, tel } }); S.client = r.client; }
    return;
  }
  const r = await api('/api/client/invite', { body: { nom, tel } });
  S.token = r.token; S.client = r.client; LS.set('ts_token', S.token); stream();
}
async function passerCommande() {
  const co = S.co, err = $('co-err'); err.textContent = '';
  const fail = m => { err.textContent = m; toast('Il manque une information', m, true); };
  co.nom = ($('co-nom') || {}).value || co.nom; co.tel = ($('co-tel') || {}).value || co.tel;
  if (!co.nom.trim()) return fail('Indiquez votre nom.');
  if (String(co.tel).replace(/\D/g, '').length < 8) return fail('Indiquez un numéro de téléphone valide.');
  if (co.mode === 'livraison') { if (!co.zoneId) return fail('Choisissez votre zone de livraison.'); if (!co.adresse && !co.position) return fail('Indiquez votre adresse ou partagez votre position.'); }
  if (co.mode !== 'expedition' && (!co.date || !co.creneau)) return fail('Choisissez la date et le créneau.');
  if (co.mode === 'expedition') { if (co.pays === 'Côte d’Ivoire' && !co.ville) return fail('Choisissez la ville de destination.'); if (co.ville === '__autre' && (!co.villeAutre || !co.km)) return fail('Indiquez la ville et sa distance d’Abidjan.'); }
  if (!co.paiement) return fail('Choisissez un moyen de paiement.');
  const btn = $('co-go'); btn.disabled = true; btn.innerHTML = 'Un instant…';
  try {
    await ensureClient(co.nom.trim(), co.tel);
    const body = {
      nom: co.nom, tel: co.tel, note: co.note || '', paiement: co.paiement, points: co.points ? (S.client.points || 0) : 0,
      items: S.cart.map(c => ({ produitId: c.id, varianteId: c.v, qte: c.q })),
      livraison: { mode: co.mode, zoneId: co.zoneId, adresse: co.adresse, repere: co.repere, position: co.position, date: co.date, creneau: co.creneau,
        pays: co.pays, ville: co.ville === '__autre' ? '' : co.ville, villeAutre: co.villeAutre, km: co.km, destinataire: co.destinataire || co.nom, gare: co.gare }
    };
    const r = await api('/api/commandes', { body });
    S.client = r.client; S.commandes.unshift(r.commande); S.cart = []; save(); badges(); ding();
    if (co.paiement === 'livraison') go('recu', { id: r.commande.id, ok: 1 }, { replace: true });
    else { S.payMode = co.paiement; go('payer', { id: r.commande.id }, { replace: true }); }
    if (co.paiement === 'livraison') setTimeout(() => askNotifs(), 2500);
  } catch (e) { fail(e.message); btn.disabled = false; btn.innerHTML = 'Réessayer'; }
}

// ---------------- Paiement Mobile Money ----------------
const cmd = id => S.commandes.find(c => c.id === Number(id));
function vPayer() {
  const c = cmd(S.p.id); if (!c) return vCommandes();
  if (c.paiement.statut === 'paye' || c.paiement.statut === 'declare') return vRecu();
  const modes = S.data.paiement.modes; const ks = Object.keys(modes);
  let m = S.payMode && modes[S.payMode] ? S.payMode : (modes[c.paiement.mode] ? c.paiement.mode : ks[0]); S.payMode = m;
  const M = modes[m]; if (!M) return `<div class="wrap"><div class="empty">Aucun moyen de paiement disponible. Écrivez-nous sur WhatsApp.</div></div>`;
  const lien = M.lien ? M.lien.replace(/\{montant\}/g, c.total).replace(/\{ref\}/g, c.numero) : '';
  const num = M.numero.replace(/\s/g, '');
  return `<div class="wrap" style="max-width:640px"><div class="page-h" style="text-align:center"><div class="eyebrow">Commande n°${c.numero}</div><h1 class="d">Réglez <i>en direct</i></h1><p class="muted small">Sans agrégateur : vous payez directement le compte de la boutique.</p></div>
    ${c.paiement.statut === 'refuse' ? `<div class="note rouge" style="margin-bottom:14px">${I.info}<span>Paiement précédent non retrouvé : ${esc(c.paiement.motifRefus || '')}. Vérifiez la référence et réessayez.</span></div>` : ''}
    <div class="scroll-x" style="justify-content:center">${ks.map(k => `<button class="pill ${k === m ? 'on' : ''}" onclick="S.payMode='${k}';render()"><span class="op-logo op-${k}" style="width:26px;height:26px;border-radius:9px;font-size:9px">${OPS_COURT[k]}</span>${OPS[k]}</button>`).join('')}</div>
    <div class="card" style="text-align:center;margin-top:14px;padding:26px 20px"><div class="eyebrow">Montant exact à envoyer</div><div class="amount" style="margin:10px 0">${F(c.total)}</div><span class="chip gris">${c.lignes.reduce((s, l) => s + l.qte, 0)} article(s) + ${c.livraison.mode === 'retrait' ? 'retrait' : 'frais ' + F(c.frais)}</span></div>
    <div class="card"><div class="op"><span class="op-logo op-${m}">${OPS_COURT[m]}</span><div><b>${esc(M.nom)}</b><div class="small muted">Bénéficiaire : ${esc(M.titulaire || B().nom)}</div></div></div>
      <div class="steps">
        <div class="step"><div style="flex:1"><b>Ouvrez ${esc(M.nom)}</b>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${lien ? `<a class="btn sm" href="${esc(lien)}" target="_blank" rel="noopener">Payer avec ${esc(M.nom)} →</a>` : ''}${M.ussd ? `<a class="btn ${lien ? 'ghost' : ''} sm" href="tel:${encodeURIComponent(M.ussd)}">Composer ${esc(M.ussd)}</a>` : ''}${!lien && !M.ussd ? `<span class="small muted">Ouvrez l’application ${esc(M.nom)} sur votre téléphone.</span>` : ''}</div></div></div>
        <div class="step"><div style="flex:1"><b>Envoyez ${F(c.total)} à ce numéro</b>
          <div class="copy"><span>${esc(M.numero)}</span><button class="btn xs ghost" onclick="copier('${esc(num)}')">${I.copy} Copier</button></div>
          <p class="tiny muted" style="margin-top:6px">Motif / commentaire si possible : <b style="color:var(--txt)">TS-${c.numero}</b></p></div></div>
        <div class="step"><div style="flex:1"><b>Saisissez la référence reçue par SMS</b>
          <div class="fld" style="margin-top:8px"><input class="inp" id="pay-ref" placeholder="ID / référence de transaction" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="fld"><input class="inp" id="pay-num" type="tel" inputmode="tel" placeholder="Numéro qui a payé" value="${esc(c.tel)}"></div>
          <label class="btn ghost sm" style="cursor:pointer">${I.cam} <span id="pay-cap-l">Joindre la capture du reçu (conseillé)</span><input type="file" accept="image/*" id="pay-cap" style="display:none" onchange="$('pay-cap-l').textContent=this.files[0]?'Capture jointe ✓':'Joindre la capture'"></label>
        </div></div>
      </div>
      <div class="err" id="pay-err"></div>
      <button class="btn full" id="pay-go" style="margin-top:16px" onclick="declarerPaiement(${c.id})">${I.check} J’ai payé — voir mon reçu</button>
      <div class="note" style="margin-top:14px">${I.lock}<span>Ne communiquez jamais votre code secret Mobile Money. ${esc(B().nom)} ne vous le demandera jamais, ni par téléphone ni sur WhatsApp.</span></div>
      <p class="secure">${I.shield} Chaque référence est vérifiée et ne peut servir qu’une seule fois</p>
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><a class="btn wa" style="flex:1" href="${waLink(`Bonjour, j’ai besoin d’aide pour payer la commande n°${c.numero} (${F(c.total)}).`)}" target="_blank" rel="noopener">${I.wa} Besoin d’aide ?</a>
      ${S.data.paiement.livraisonCash && c.livraison.mode !== 'expedition' ? `<button class="btn ghost" style="flex:1" onclick="go('recu',{id:${c.id}})">Payer plus tard</button>` : ''}</div>
  </div>`;
}
function copier(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copié ✓', t)).catch(() => toast('Numéro', t)); }
async function declarerPaiement(id) {
  const err = $('pay-err'); err.textContent = '';
  const ref = $('pay-ref').value.trim(), payeur = $('pay-num').value.trim(), f = $('pay-cap').files[0];
  if (ref.replace(/\s/g, '').length < 6) { err.textContent = 'Saisissez la référence (ID de transaction) reçue par SMS.'; return; }
  const btn = $('pay-go'); btn.disabled = true; btn.innerHTML = 'Envoi sécurisé…';
  try {
    const preuve = f ? await resizeImage(f, 1400) : '';
    const r = await api(`/api/commandes/${id}/paiement`, { body: { mode: S.payMode, reference: ref, payeur, preuve } });
    upsertCmd(r.commande); ding(); go('recu', { id, ok: 1 }, { replace: true });
    setTimeout(() => askNotifs(), 2500);
  } catch (e) { err.textContent = e.message; btn.disabled = false; btn.innerHTML = 'Réessayer'; }
}
function upsertCmd(c) { const i = S.commandes.findIndex(x => x.id === c.id); if (i >= 0) S.commandes[i] = c; else S.commandes.unshift(c); badges(); }

// ---------------- Reçu ----------------
function recuHTML(c, boutique) {
  const ps = PAY_ST[c.paiement.statut] || ['', 'wait'];
  const lv = c.livraison;
  return `<div class="recu" id="recu">
    <div class="hd"><div><img src="/img/logo.png" alt="${esc(boutique.nom)}"><div class="tiny" style="color:#8a8170;margin-top:6px">${esc(boutique.adresse)}<br>${esc(boutique.tel)}</div></div>
      <div style="text-align:right"><div class="k">Reçu</div><div class="v" style="font-size:20px">N° ${c.numero}</div><div class="tiny" style="color:#8a8170">${fdate(c.at)}</div></div></div>
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 0;border-bottom:1px dashed #cfc6b5">
      <div><div class="k">Client</div><div class="v">${esc(c.clientNom)}</div><div class="tiny">${esc(telLisible(c.tel))}</div></div>
      <div style="text-align:right"><div class="k">${esc(MODE_LIV[lv.mode] || '')}</div><div class="v" style="font-size:13.5px">${lv.mode === 'livraison' ? esc(lv.zone) : lv.mode === 'expedition' ? esc(lv.ville ? lv.ville + ', ' : '') + esc(lv.pays) : 'Boutique'}</div>
        <div class="tiny">${lv.date ? esc(fjour(lv.date)) + '<br>' + esc(lv.creneau) : ''}</div></div></div>
    <div style="padding:8px 0">${c.lignes.map(l => `<div class="ln"><span>${l.qte} × ${esc(l.nom)}${l.variante ? ' <span style="color:#8a8170">(' + esc(l.variante) + ')</span>' : ''}</span><b style="white-space:nowrap">${F(l.total)}</b></div>`).join('')}</div>
    <div class="sum"><span>Sous-total</span><span>${F(c.sousTotal)}</span></div>
    <div class="sum"><span>${lv.mode === 'retrait' ? 'Retrait' : lv.mode === 'expedition' ? 'Expédition' : 'Livraison'}</span><span>${F(c.frais)}</span></div>
    ${c.remise ? `<div class="sum"><span>Remise fidélité</span><span>− ${F(c.remise)}</span></div>` : ''}
    <div class="sum big"><span>Total</span><span>${F(c.total)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap">
      <span class="stamp ${ps[1]}">${ps[1] === 'ok' ? '✓ ' : ''}${ps[0]}</span>
      <span class="tiny" style="color:#5b5444">${esc(OPS[c.paiement.mode] || c.paiement.mode)}${c.paiement.reference ? '<br>Réf. ' + esc(c.paiement.reference) : ''}</span></div>
    <p class="tiny" style="color:#8a8170;margin-top:16px;text-align:center">Merci pour votre confiance · ${esc(boutique.nom)}</p>
  </div>`;
}
function recuLink(c) { return `${location.origin}/?recu=${c.id}&k=${c.recuKey}`; }
function vRecu() {
  const c = cmd(S.p.id); if (!c) return vCommandes();
  const st = c.paiement.statut, exp = c.livraison.mode === 'expedition';
  const head = st === 'paye' ? `<div class="check">${I.check}</div><h1 class="d" style="text-align:center">Paiement <i>confirmé</i></h1><p class="muted" style="text-align:center;margin:6px 0 20px">Merci ${esc(c.clientNom.split(' ')[0])} ! Votre commande est entre de bonnes mains.</p>`
    : st === 'declare' ? `<div class="check" style="background:var(--grad)"><svg viewBox="0 0 24 24" fill="none" stroke="#1b0e02" stroke-width="2.2" style="stroke-dasharray:none;stroke-dashoffset:0;animation:none"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h1 class="d" style="text-align:center">Paiement <i>reçu</i>, en vérification</h1><p class="muted" style="text-align:center;margin:6px 0 20px">Nous vérifions la référence auprès de ${esc(OPS[c.paiement.mode] || '')}. Vous recevrez une notification dès la confirmation, en général en quelques minutes.</p>`
    : st === 'a_la_livraison' ? `<div class="check">${I.check}</div><h1 class="d" style="text-align:center">Commande <i>enregistrée</i></h1><p class="muted" style="text-align:center;margin:6px 0 20px">Vous réglerez ${F(c.total)} ${c.livraison.mode === 'retrait' ? 'en boutique' : 'au livreur'}.</p>`
    : `<h1 class="d" style="text-align:center;margin-top:20px">Commande n°${c.numero}</h1><p class="muted" style="text-align:center;margin:6px 0 20px">${st === 'refuse' ? 'Le paiement n’a pas été retrouvé.' : 'En attente de votre paiement.'}</p>`;
  const msgRecu = `Bonjour ${B().nom}, voici le reçu de ma commande n°${c.numero} (${F(c.total)})${c.paiement.reference ? ', paiement ' + (OPS[c.paiement.mode] || '') + ' réf. ' + c.paiement.reference : ''} : ${recuLink(c)}`;
  return `<div class="wrap" style="max-width:640px;padding-top:24px">${head}
    ${exp && st !== 'paye' && st !== 'en_attente' && st !== 'refuse' ? `<div class="note or" style="margin-bottom:18px">${I.info}<span>Expédition : envoyez aussi la capture de votre reçu de paiement sur WhatsApp pour accélérer l’envoi.</span></div>` : ''}
    ${recuHTML(c, B())}
    <div class="noprint" style="display:grid;gap:10px;margin-top:26px">
      ${st === 'en_attente' || st === 'refuse' ? `<button class="btn full" onclick="S.payMode=null;go('payer',{id:${c.id}})">${I.lock} Payer ${F(c.total)} maintenant</button>` : ''}
      <a class="btn wa full" href="${waLink(msgRecu)}" target="_blank" rel="noopener">${I.wa} Envoyer le reçu sur WhatsApp</a>
      <div style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" onclick="partagerRecu(${c.id})">${I.share} Partager</button><button class="btn ghost" style="flex:1" onclick="window.print()">${I.download} PDF / imprimer</button></div>
      <button class="btn or full" onclick="go('commande',{id:${c.id}})">${I.truck} Suivre ma commande</button>
      ${notifBlock()}
    </div></div>`;
}
function partagerRecu(id) {
  const c = cmd(id), url = recuLink(c);
  if (navigator.share) navigator.share({ title: `Reçu ${B().nom} n°${c.numero}`, text: `Reçu de commande n°${c.numero} — ${F(c.total)}`, url }).catch(() => { });
  else copier(url);
}
function notifBlock() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return '';
  if (Notification.permission === 'granted' && S.client && S.client.notifs) return '';
  return `<div class="note" style="margin-top:6px">${I.bell}<span style="flex:1">Activez les notifications : vous serez prévenu(e) quand le livreur part, quand il est à quelques pas et à la livraison.<br><button class="btn xs" style="margin-top:8px" onclick="enableNotifs(true)">Activer les notifications</button></span></div>`;
}

// ---------------- Commandes & suivi ----------------
function vCommandes() {
  const L = S.commandes;
  return `<div class="wrap" style="max-width:760px"><div class="page-h"><div class="eyebrow">Suivi</div><h1 class="d">Mes <i>commandes</i></h1></div>
  ${!L.length ? `<div class="empty"><div class="big">📦</div><div class="d">Aucune commande pour l’instant</div><p>${S.client && !S.client.invite ? '' : 'Vous avez commandé sur un autre téléphone ? Connectez-vous dans « Compte ».'}</p><button class="btn" style="margin-top:16px" onclick="go('boutique')">Découvrir la boutique</button></div>`
    : L.map(c => { const ps = PAY_ST[c.paiement.statut] || []; return `<div class="ocard" onclick="go('commande',{id:${c.id}})"><div class="im">${c.lignes.slice(0, 3).map(l => `<img src="${esc(l.image)}" alt="">`).join('')}</div>
      <div style="flex:1;min-width:0"><b>N° ${c.numero}</b> <span class="chip ${c.statut === 'livree' ? 'vert' : c.statut === 'annulee' ? 'rouge' : 'or'}" style="margin-left:4px">${ST[c.statut]}</span>
      <div class="small muted">${fdate(c.at)} · ${MODE_LIV[c.livraison.mode]}</div><div class="small" style="margin-top:2px">${F(c.total)} · <span class="muted">${esc(ps[0] || '')}</span></div></div><span class="muted">›</span></div>`; }).join('')}
  </div>`;
}
function etapes(c) {
  const m = c.livraison.mode, H = st => (c.historique.find(h => h.statut === st) || {}).at;
  const paye = c.paiement.statut === 'paye';
  if (m === 'expedition') return [['recue', 'Commande reçue', H('recue')], ['paye', 'Paiement confirmé', paye ? c.paiement.at : null], ['preparation', 'Colis préparé', H('preparation')], ['expediee', 'Remis au transporteur', H('expediee')], ['livree', 'Colis récupéré', H('livree')]];
  if (m === 'retrait') return [['recue', 'Commande reçue', H('recue')], ['confirmee', 'Confirmée', H('confirmee')], ['preparation', 'En préparation', H('preparation')], ['prete', 'Prête en boutique', H('prete')], ['livree', 'Retirée', H('livree')]];
  return [['recue', 'Commande reçue', H('recue')], ['confirmee', 'Confirmée', H('confirmee')], ['preparation', 'En préparation', H('preparation')], ['en_route', 'En route', H('en_route')], ['proche', 'Le livreur est à quelques pas', c.proche && c.proche.at], ['livree', 'Livrée', H('livree')]];
}
function vCommande() {
  const c = cmd(S.p.id); if (!c) return vCommandes();
  const E = etapes(c); const lastDone = E.reduce((k, e, i) => e[2] ? i : k, -1);
  const ps = PAY_ST[c.paiement.statut] || ['', ''];
  const lv = c.livraison;
  const canPay = ['en_attente', 'refuse'].includes(c.paiement.statut) && c.statut !== 'annulee';
  return `<div class="wrap" style="max-width:760px">
    <div class="page-h"><div class="eyebrow">${fdate(c.at)}</div><h1 class="d">Commande <i>n°${c.numero}</i></h1>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><span class="chip ${c.statut === 'livree' ? 'vert' : c.statut === 'annulee' ? 'rouge' : 'or'}">${ST[c.statut]}</span><span class="chip ${ps[1] === 'ok' ? 'vert' : ps[1] === 'no' ? 'rouge' : 'gris'}">${esc(ps[0])}</span></div></div>
    ${c.statut === 'en_route' && c.proche ? `<div class="proche" style="margin-bottom:14px"><span class="e">🛵</span><div><b style="font-size:16px">Votre livreur est à quelques pas !</b><div class="small">Préparez-vous à le recevoir${c.paiement.statut === 'a_la_livraison' ? ' · ' + F(c.total) + ' à régler' : ''}.</div></div></div>` : ''}
    ${canPay ? `<div class="card" style="text-align:center"><p class="muted">${c.paiement.statut === 'refuse' ? 'Paiement non retrouvé : ' + esc(c.paiement.motifRefus || '') : 'Votre commande attend votre paiement.'}</p><button class="btn" style="margin-top:12px" onclick="S.payMode=null;go('payer',{id:${c.id}})">${I.lock} Payer ${F(c.total)}</button></div>` : ''}
    ${c.statut === 'en_route' ? `<div class="card"><h3>${I.truck.replace('<svg', '<svg style="width:22px;height:22px;color:var(--or)"')} En route</h3>
      ${c.livreur ? `<div style="display:flex;align-items:center;gap:12px"><div class="op-logo" style="background:var(--grad-or);color:#1b1205;border-radius:50%">${esc((c.livreur.nom || 'L')[0])}</div><div style="flex:1"><b>${esc(c.livreur.nom)}</b><div class="small muted">Votre livreur</div></div>${c.livreur.tel ? `<a class="btn xs ghost" href="tel:${esc(c.livreur.tel)}">${I.phone} Appeler</a>` : ''}</div>` : ''}
      <div class="map" id="map-suivi"><div class="empty small" style="padding:90px 10px">${c.livreurPos ? 'Chargement de la carte…' : 'La position du livreur s’affichera dès qu’il démarre.'}</div></div>
      <p class="small muted" id="dist" style="margin-top:8px"></p>
      <div class="lbl">Discuter avec le livreur</div>
      <div class="chat" id="chatl">${(c.chatLivreur || []).map(m => `<div class="msg ${m.de === 'client' ? 'me' : 'them'}">${esc(m.texte)}<small>${fheure(m.at)}</small></div>`).join('') || '<p class="small muted">Un repère, un portail, un étage ? Écrivez-lui ici.</p>'}</div>
      <div class="composer"><input class="inp" id="chatl-in" placeholder="Message au livreur…" onkeydown="if(event.key==='Enter')chatLivreur(${c.id})"><button class="send" onclick="chatLivreur(${c.id})">${I.send}</button></div>
    </div>` : ''}
    ${c.statut === 'expediee' && c.expedition ? `<div class="card"><h3>Colis expédié</h3><p class="muted">${[c.expedition.transporteur && 'Transporteur : <b>' + esc(c.expedition.transporteur) + '</b>', c.expedition.code && 'N° de colis : <b>' + esc(c.expedition.code) + '</b>', c.expedition.lieu && 'Retrait : <b>' + esc(c.expedition.lieu) + '</b>'].filter(Boolean).join('<br>')}</p></div>` : ''}
    ${c.statut === 'prete' ? `<div class="card"><h3>Votre commande vous attend</h3><p class="muted">${esc(B().adresse)} · ${esc(B().horaires)}</p><div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><a class="btn or sm" href="${yangoLink()}" target="_blank" rel="noopener">${I.route} Yango</a><a class="btn ghost sm" href="https://www.google.com/maps/dir/?api=1&destination=${B().lat},${B().lng}" target="_blank" rel="noopener">${I.pin} Itinéraire</a></div></div>` : ''}
    ${c.statut === 'livree' && !c.avis ? avisForm(c) : ''}
    ${c.avis ? `<div class="card"><h3>Votre avis</h3>${stars(c.avis.noteAchat)}${c.avis.commentaire ? `<p class="muted" style="margin-top:6px">${esc(c.avis.commentaire)}</p>` : ''}<p class="small" style="margin-top:6px;color:var(--vert)">Merci ! Votre avis aide toute la communauté.</p></div>` : ''}
    ${c.statut !== 'annulee' ? `<div class="card"><h3>Suivi</h3><div class="tl">${E.map((e, i) => `<div class="s ${i < lastDone || (i === lastDone && i === E.length - 1) ? 'done' : i === lastDone ? 'done cur' : ''}"><i>${i <= lastDone ? I.check : ''}</i><div><b>${e[1]}</b><span>${e[2] ? fdate(e[2]) : ''}</span></div></div>`).join('')}</div></div>` : ''}
    <div class="card"><h3>Détails</h3>
      ${c.lignes.map(l => `<div class="line"><img src="${esc(l.image)}" alt="" style="width:56px;height:56px"><div class="t"><b>${esc(l.nom)}</b><span>${l.variante ? esc(l.variante) + ' · ' : ''}× ${l.qte}</span></div><b class="small">${F(l.total)}</b></div>`).join('')}
      <div class="tot"><span>${MODE_LIV[lv.mode]}${lv.zone ? ' · ' + esc(lv.zone) : lv.ville ? ' · ' + esc(lv.ville) : lv.pays && lv.mode === 'expedition' ? ' · ' + esc(lv.pays) : ''}</span><span>${F(c.frais)}</span></div>
      ${lv.date ? `<div class="tot"><span>Date</span><span>${esc(fjour(lv.date))}, ${esc(lv.creneau)}</span></div>` : ''}
      <div class="tot big"><span>Total</span><span>${F(c.total)}</span></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn ghost sm" onclick="go('recu',{id:${c.id}})">${I.receipt} Reçu</button>
        <a class="btn wa sm" href="${waLink(`Bonjour, au sujet de ma commande n°${c.numero} :`)}" target="_blank" rel="noopener">${I.wa} Une question</a>
        ${c.statut === 'recue' && !['paye', 'declare'].includes(c.paiement.statut) ? `<button class="btn ghost sm" onclick="annuler(${c.id})">Annuler</button>` : ''}</div>
    </div>
    ${notifBlock()}
  </div>`;
}
function avisForm(c) {
  S.avis = S.avis || { noteAchat: 5, noteLivraison: 5, recommande: true };
  const rate = k => `<div class="rate">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= S.avis[k] ? 'on' : ''}" onclick="S.avis.${k}=${n};render()">★</button>`).join('')}</div>`;
  return `<div class="card" style="box-shadow:inset 0 0 0 1px rgba(231,183,95,.4)"><h3>Comment s’est passé votre achat ?</h3>
    <div class="lbl" style="margin-top:4px">Les articles</div>${rate('noteAchat')}
    ${c.livraison.mode !== 'retrait' ? `<div class="lbl">${c.livraison.mode === 'expedition' ? 'L’expédition' : 'La livraison'}</div>${rate('noteLivraison')}` : ''}
    <div class="lbl">Recommanderiez-vous ${esc(B().nom)} ?</div>
    <div style="display:flex;gap:8px"><button class="pill ${S.avis.recommande ? 'on' : ''}" onclick="S.avis.recommande=true;render()">👍 Oui</button><button class="pill ${!S.avis.recommande ? 'on' : ''}" onclick="S.avis.recommande=false;render()">👎 Pas encore</button></div>
    <div class="fld" style="margin-top:14px"><textarea class="inp" id="av-c" rows="3" placeholder="Votre avis (publié avec votre prénom)"></textarea></div>
    <div class="fld"><textarea class="inp" id="av-s" rows="2" placeholder="Une suggestion, un article que vous aimeriez trouver ? (privé)"></textarea></div>
    <button class="btn full" onclick="envoyerAvis(${c.id})">${I.star} Publier mon avis</button></div>`;
}
async function envoyerAvis(id) {
  try { const r = await api(`/api/commandes/${id}/avis`, { body: Object.assign({}, S.avis, { commentaire: $('av-c').value, suggestion: $('av-s').value }) }); upsertCmd(r.commande); S.avis = null; ding(); toast('Merci pour votre avis ✨', 'Il aide les autres clientes à choisir.'); render(); }
  catch (e) { toast('Oups', e.message, true); }
}
async function annuler(id) {
  if (!confirm('Annuler cette commande ?')) return;
  try { const r = await api(`/api/commandes/${id}/annuler`, { body: {} }); upsertCmd(r.commande); render(); toast('Commande annulée'); } catch (e) { toast('Impossible', e.message, true); }
}
async function chatLivreur(id) {
  const i = $('chatl-in'), t = i.value.trim(); if (!t) return; i.value = '';
  try { const r = await api(`/api/commandes/${id}/chat`, { body: { texte: t } }); const c = cmd(id); if (!c.chatLivreur.some(m => m.id === r.message.id)) c.chatLivreur.push(r.message); drawChatLivreur(c); } catch (e) { toast('Message non envoyé', e.message, true); }
}
function drawChatLivreur(c) {
  const el = $('chatl'); if (!el) return;
  el.innerHTML = c.chatLivreur.map(m => `<div class="msg ${m.de === 'client' ? 'me' : 'them'}">${esc(m.texte)}<small>${fheure(m.at)}</small></div>`).join('');
}
function afterCommande() {
  const c = cmd(S.p.id); if (!c || c.statut !== 'en_route' || !c.livreurPos) return;
  loadLeaflet().then(() => {
    const el = $('map-suivi'); if (!el) return; el.innerHTML = '';
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView([c.livreurPos.lat, c.livreurPos.lng], 15);
    tiles().addTo(m);
    const icon = (e, bg) => L.divIcon({ className: '', html: `<div style="width:40px;height:40px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 6px 18px rgba(0,0,0,.5);border:3px solid #fff">${e}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
    const mk = L.marker([c.livreurPos.lat, c.livreurPos.lng], { icon: icon('🛵', '#F28C28') }).addTo(m);
    if (c.livraison.position) { L.marker([c.livraison.position.lat, c.livraison.position.lng], { icon: icon('🏠', '#E7B75F') }).addTo(m); m.fitBounds([[c.livreurPos.lat, c.livreurPos.lng], [c.livraison.position.lat, c.livraison.position.lng]], { padding: [40, 40] }); }
    S.maps.suivi = { map: m, mk, id: c.id };
    majDistance(c);
  }).catch(() => { });
}
function majDistance(c) {
  const d = $('dist'); if (!d || !c.livreurPos) return;
  if (c.livraison.position) { const km = distKm(c.livreurPos, c.livraison.position); d.textContent = `Livreur à environ ${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'} · mis à jour à ${fheure(c.livreurPos.at)}`; }
  else d.textContent = 'Position mise à jour à ' + fheure(c.livreurPos.at);
}
function distKm(a, b) { const r = x => x * Math.PI / 180, R = 6371; const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

// ---------------- Carte ----------------
let leafletP;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletP) return leafletP;
  leafletP = new Promise((ok, ko) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/vendor/leaflet/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = '/vendor/leaflet/leaflet.js'; s.onload = ok; s.onerror = () => { leafletP = null; ko(); }; document.head.appendChild(s);
  });
  return leafletP;
}
const tiles = () => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' });
function mapStore(id) {
  const el = $(id); if (!el) return;
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return; io.disconnect();
    loadLeaflet().then(() => {
      if (!$(id)) return; const b = B();
      const m = L.map(el, { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile }).setView([b.lat, b.lng], 15);
      tiles().addTo(m);
      L.marker([b.lat, b.lng], { icon: L.divIcon({ className: '', html: `<div style="width:54px;height:54px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(242,140,40,.3),0 8px 20px rgba(0,0,0,.5)"><img src="/img/icon-192.png" style="width:44px;height:44px;border-radius:50%"></div>`, iconSize: [54, 54], iconAnchor: [27, 27] }) }).addTo(m);
    }).catch(() => { el.innerHTML = `<div class="empty small" style="padding:80px 10px">${esc(B().adresse)}</div>`; });
  });
  io.observe(el);
}

// ---------------- Compte ----------------
function vCompte() {
  const c = S.client, D = S.data, connecte = c && !c.invite;
  const notifOn = 'Notification' in window && Notification.permission === 'granted' && c && c.notifs;
  const tab = S.p.tab || 'cnx';
  const lien = (vue, ic, t, sub, extra) => `<a onclick="go('${vue}')"><span class="i">${ic}</span><span style="flex:1">${t}${sub ? `<br><span class="tiny muted" style="font-weight:500">${sub}</span>` : ''}</span>${extra || ''}<span class="chev">›</span></a>`;
  return `<div class="wrap" style="max-width:680px"><div class="page-h"><div class="eyebrow">Mon espace</div><h1 class="d">${connecte ? `Bonjour <i>${esc(c.nom.split(' ')[0])}</i>` : 'Mon <i>compte</i>'}</h1></div>
    ${connecte ? `<div class="card" style="display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(231,183,95,.16),rgba(242,140,40,.06))"><div class="op-logo" style="background:var(--grad-or);color:#1b1205;border-radius:50%;width:54px;height:54px;font-size:20px">${esc(c.nom[0] || '?')}</div>
      <div style="flex:1"><b>${esc(c.nom)}</b><div class="small muted">${esc(telLisible(c.tel))}</div></div>
      ${D.fidelite.actif ? `<div style="text-align:right"><div class="d" style="font-size:30px;color:var(--or)">${c.points || 0}</div><div class="tiny muted">points</div></div>` : ''}</div>
      ${D.fidelite.actif ? `<p class="small muted" style="margin:8px 4px 0">${D.fidelite.pointsParMille} point par tranche de 1 000 F d’achat. Dès ${D.fidelite.seuilPoints} points, chaque point vaut ${F(D.fidelite.valeurPoint)} de réduction.</p>` : ''}`
    : `<div class="card"><div style="display:flex;gap:8px;margin-bottom:14px"><button class="pill ${tab === 'cnx' ? 'on' : ''}" onclick="go('compte',{tab:'cnx'},{replace:true,noAnim:true})">Se connecter</button><button class="pill ${tab === 'ins' ? 'on' : ''}" onclick="go('compte',{tab:'ins'},{replace:true,noAnim:true})">Créer mon compte</button></div>
      ${tab === 'ins' ? `<div class="fld"><label>Nom complet</label><input class="inp" id="a-nom" value="${esc((c && c.nom) || S.co.nom || '')}"></div>` : ''}
      <div class="fld"><label>Téléphone</label><input class="inp" id="a-tel" type="tel" inputmode="tel" value="${esc((c && c.tel) || S.co.tel || '')}" placeholder="07 00 00 00 00"></div>
      <div class="fld"><label>Code secret (4 chiffres)</label><input class="inp" id="a-pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>
      <div class="err" id="a-err"></div><button class="btn full" onclick="auth('${tab}')">${tab === 'ins' ? 'Créer mon compte' : 'Me connecter'}</button>
      <p class="tiny muted" style="margin-top:10px">${tab === 'ins' ? 'Votre compte garde vos commandes sur tous vos téléphones et cumule des points fidélité. Vos commandes déjà passées sur ce téléphone y sont rattachées.' : 'Pas de compte ? Vous pouvez aussi commander sans compte.'}</p></div>`}
    <div class="card list" style="margin-top:14px">
      ${lien('commandes', I.box, 'Mes commandes', S.commandes.length ? S.commandes.length + ' commande(s)' : '')}
      ${lien('favoris', I.heart, 'Mes favoris', S.favs.length ? S.favs.length + ' article(s)' : '')}
      ${lien('notifs', I.bell, 'Notifications', '', `<span class="chip or ${S.notifs.some(n => !n.lu) ? '' : 'hide'}">${S.notifs.filter(n => !n.lu).length}</span>`)}
      ${lien('chat', I.chat, 'Discuter avec la boutique', S.enLigne ? '<span class="dot-on"></span> En ligne' : 'Réponse rapide')}
      <a onclick="openIA()"><span class="i">${I.sparkle}</span><span style="flex:1">Assistante Awa (IA)<br><span class="tiny muted" style="font-weight:500">Conseils et réponses immédiates</span></span><span class="chev">›</span></a>
      ${lien('devis', I.gift, 'Devis & personnalisation', S.devis.length ? S.devis.length + ' demande(s)' : '')}
      ${lien('magasin', I.store, 'Venir en boutique', esc(B().adresse))}
    </div>
    <div class="card list" style="margin-top:14px">
      ${'Notification' in window ? `<button onclick="${notifOn ? 'disableNotifs()' : 'enableNotifs(true)'}"><span class="i">${I.bell}</span><span style="flex:1">Notifications<br><span class="tiny muted" style="font-weight:500">Nouveautés, prix cassés, suivi de livraison</span></span><span class="switch ${notifOn ? 'on' : ''}"></span></button>` : ''}
      <button onclick="installer()"><span class="i">${I.download}</span><span style="flex:1">Installer l’application<br><span class="tiny muted" style="font-weight:500">Tawali Souk sur votre écran d’accueil</span></span><span class="chev">›</span></button>
      <button onclick="showTarifs()"><span class="i">${I.truck}</span><span style="flex:1">Tarifs de livraison & expédition</span><span class="chev">›</span></button>
      ${connecte ? `<button onclick="deconnexion()"><span class="i">${I.logout}</span><span style="flex:1">Se déconnecter</span></button><button onclick="supprimerCompte()" style="color:var(--rouge)"><span class="i">${I.trash}</span><span style="flex:1">Supprimer mon compte</span></button>` : ''}
    </div>
  </div>`;
}
async function auth(tab) {
  const err = $('a-err'); err.textContent = '';
  try {
    const body = { tel: $('a-tel').value, pin: $('a-pin').value };
    if (tab === 'ins') body.nom = $('a-nom').value;
    const r = await api(tab === 'ins' ? '/api/client/inscription' : '/api/client/connexion', { body, noLogout: true });
    S.token = r.token; S.client = r.client; LS.set('ts_token', S.token);
    await loadClient(); stream(); toast(tab === 'ins' ? 'Bienvenue ✨' : 'Bon retour !', 'Vous êtes connecté(e).'); render();
  } catch (e) { err.textContent = e.message; }
}
async function deconnexion() {
  let endpoint = ''; try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) endpoint = sub.endpoint; } catch (e) { }
  try { await api('/api/client/deconnexion', { body: { endpoint } }); } catch (e) { }
  S.token = ''; S.client = null; S.commandes = []; S.notifs = []; S.chat = []; S.devis = []; LS.set('ts_token', ''); stream(); render();
}
async function supprimerCompte() {
  const pin = prompt('Pour supprimer votre compte et vos échanges, saisissez votre code secret :'); if (!pin) return;
  try { await api('/api/client/supprimer', { body: { pin } }); S.token = ''; S.client = null; LS.set('ts_token', ''); S.commandes = []; toast('Compte supprimé'); go('accueil'); } catch (e) { toast('Impossible', e.message, true); }
}

// ---------------- Discussion boutique ----------------
function vChat() {
  return `<div class="wrap" style="max-width:680px"><div class="page-h"><div class="eyebrow">${S.enLigne ? '<span class="dot-on"></span>&nbsp; Une conseillère est en ligne' : '<span class="dot-off"></span>&nbsp; Nous vous répondons très vite'}</div><h1 class="d">Discuter avec <i>${esc(B().nom)}</i></h1></div>
    <div class="card"><div class="chat">${S.chat.length ? S.chat.map(m => `<div class="msg ${m.de === 'client' ? 'me' : 'them'}">${esc(m.texte)}<small>${fdate(m.at)}</small></div>`).join('') : `<div class="msg them">Bonjour 👋 Une question sur un article, une livraison, une personnalisation ? Écrivez-nous ici.</div>`}<div id="chat-end"></div></div>
      ${!S.client ? `<div class="fld" style="margin-top:12px"><input class="inp" id="ch-nom" placeholder="Votre prénom" value="${esc(S.co.nom || '')}"></div><div class="fld"><input class="inp" id="ch-tel" type="tel" placeholder="Votre téléphone" value="${esc(S.co.tel || '')}"></div>` : ''}
      <div class="composer"><input class="inp" id="ch-in" placeholder="Votre message…" onkeydown="if(event.key==='Enter')chatSend()"><button class="send" onclick="chatSend()">${I.send}</button></div></div>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><a class="btn wa" style="flex:1" href="${waLink('Bonjour Tawali Souk !')}" target="_blank" rel="noopener">${I.wa} WhatsApp</a><a class="btn ghost" style="flex:1" href="tel:${esc(B().tel.replace(/\s/g, ''))}">${I.phone} Appeler</a></div></div>`;
}
async function chatSend() {
  const i = $('ch-in'), t = i.value.trim(); if (!t) return;
  try {
    if (!S.client) { const n = ($('ch-nom') || {}).value, tel = ($('ch-tel') || {}).value; if (!n || String(tel).replace(/\D/g, '').length < 8) return toast('Votre prénom et votre téléphone', 'Pour que nous puissions vous répondre.', true); await ensureClient(n, tel); }
    i.value = '';
    const r = await api('/api/client/chat', { body: { texte: t } });
    if (!S.chat.some(m => m.id === r.message.id)) S.chat.push(r.message);
    if (!r.enLigne && S.chat.filter(m => m.de === 'client').length === 1) toast('Message envoyé ✓', 'Vous recevrez une notification dès notre réponse.');
    render();
  } catch (e) { toast('Message non envoyé', e.message, true); }
}

// ---------------- Notifications ----------------
function vNotifs() {
  return `<div class="wrap" style="max-width:680px"><div class="page-h"><div class="eyebrow">Actualités</div><h1 class="d">Vos <i>notifications</i></h1></div>
    ${notifBlock()}
    ${S.notifs.length ? S.notifs.map(n => `<div class="ocard" onclick="${n.type === 'commande' && n.ref ? `go('commande',{id:${n.ref}})` : n.url ? `openUrl('${esc(n.url)}')` : ''}" style="${n.lu ? '' : 'box-shadow:inset 0 0 0 1px rgba(231,183,95,.4)'}">
      ${n.image ? `<img src="${esc(n.image)}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover">` : `<div class="op-logo" style="background:rgba(231,183,95,.12);color:var(--or)">${n.type === 'commande' ? I.box.replace('<svg', '<svg style="width:20px;height:20px"') : I.sparkle.replace('<svg', '<svg style="width:20px;height:20px"')}</div>`}
      <div style="flex:1;min-width:0"><b>${esc(n.titre)}</b><div class="small muted">${esc(n.corps)}</div><div class="tiny" style="color:var(--txt3);margin-top:2px">${fdate(n.at)}</div></div></div>`).join('')
      : `<div class="empty"><div class="big">🔔</div><div class="d">Rien pour l’instant</div><p>Les nouveautés et le suivi de vos commandes apparaîtront ici.</p></div>`}</div>`;
}
function openUrl(u) { const q = new URL(u, location.origin); history.pushState({}, '', q.pathname + q.search); const st = parseUrl(); S.vue = st.vue; S.p = st.p; render(); window.scrollTo(0, 0); }

// ---------------- Devis ----------------
function vDevis() {
  const pr = S.p.produit ? P(S.p.produit) : null;
  return `<div class="wrap" style="max-width:720px"><div class="page-h"><div class="eyebrow">Sur mesure</div><h1 class="d">Devis & <i>personnalisation</i></h1><p class="muted">Commandes en gros, prix revendeur, pantoufles et tapis personnalisés (logo, prénoms, date), cadeaux de mariage, équipement d’hôtel ou de restaurant.</p></div>
    ${S.devis.length ? `<div class="card"><h3>Mes demandes</h3>${S.devis.map(d => `<div class="rev"><b>${esc(d.type)}</b> <span class="chip ${d.statut === 'propose' ? 'or' : d.statut === 'accepte' ? 'vert' : d.statut === 'refuse' ? 'rouge' : 'gris'}">${{ nouveau: 'Envoyée', propose: 'Proposition reçue', accepte: 'Acceptée', refuse: 'Refusée', termine: 'Terminée' }[d.statut]}</span>
      <p class="small muted" style="margin-top:4px">${esc(d.description)}</p>
      ${d.statut === 'propose' ? `<div class="note or" style="margin-top:10px"><span style="flex:1"><b style="font-size:18px">${F(d.montant)}</b><br>${esc(d.reponse)}<div style="display:flex;gap:8px;margin-top:10px"><button class="btn xs" onclick="decisionDevis(${d.id},true)">Accepter</button><button class="btn xs ghost" onclick="decisionDevis(${d.id},false)">Refuser</button></div></span></div>` : d.reponse ? `<p class="small" style="margin-top:6px;color:var(--or2)">${esc(d.reponse)}</p>` : ''}</div>`).join('')}</div>` : ''}
    <div class="card"><h3>Nouvelle demande</h3>
      <div class="fld"><label>Type de demande</label><select class="inp" id="dv-type">${['Personnalisation (pantoufles, tapis…)', 'Commande en gros / revendeur', 'Cadeau de mariage / dot', 'Équipement hôtel, spa ou restaurant', 'Autre demande'].map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="fld"><label>Article concerné</label><input class="inp" id="dv-prod" value="${esc(pr ? pr.nom : '')}" placeholder="Facultatif"></div>
      <div class="row2"><div class="fld"><label>Quantité</label><input class="inp" id="dv-q" type="number" min="1" value="${pr ? 10 : 1}"></div><div class="fld"><label>Pour le</label><input class="inp" id="dv-date" type="date"></div></div>
      <div class="fld"><label>Budget indicatif (F)</label><input class="inp" id="dv-bud" type="number" placeholder="Facultatif"></div>
      <div class="fld"><label>Votre projet</label><textarea class="inp" id="dv-desc" rows="4" placeholder="Couleurs, inscription souhaitée, nombre d’invités, délai…"></textarea></div>
      ${!S.client || S.client.invite ? `<div class="row2"><div class="fld"><label>Nom</label><input class="inp" id="dv-nom" value="${esc((S.client && S.client.nom) || S.co.nom || '')}"></div><div class="fld"><label>Téléphone</label><input class="inp" id="dv-tel" type="tel" value="${esc((S.client && S.client.tel) || S.co.tel || '')}"></div></div>` : ''}
      <label class="btn ghost sm" style="cursor:pointer;margin-bottom:12px">${I.cam} <span id="dv-img-l">Joindre une image (logo, modèle…)</span><input type="file" accept="image/*" id="dv-img" style="display:none" onchange="$('dv-img-l').textContent=this.files[0]?'Image jointe ✓':'Joindre une image'"></label>
      <div class="err" id="dv-err"></div><button class="btn full" onclick="envoyerDevis()">${I.send} Envoyer ma demande</button></div></div>`;
}
async function envoyerDevis() {
  const err = $('dv-err'); err.textContent = '';
  try {
    const nom = ($('dv-nom') || {}).value || (S.client && S.client.nom), tel = ($('dv-tel') || {}).value || (S.client && S.client.tel);
    if (!nom || String(tel || '').replace(/\D/g, '').length < 8) throw new Error('Indiquez votre nom et votre téléphone.');
    await ensureClient(nom, tel);
    const f = $('dv-img').files[0];
    const r = await api('/api/devis', { body: { type: $('dv-type').value, produit: $('dv-prod').value, quantite: $('dv-q').value, date: $('dv-date').value, budget: $('dv-bud').value, description: $('dv-desc').value, nom, tel, image: f ? await resizeImage(f, 1400) : '' } });
    S.devis.unshift(r.devis); ding(); toast('Demande envoyée ✓', 'Nous revenons vers vous très vite.'); render();
  } catch (e) { err.textContent = e.message; }
}
async function decisionDevis(id, ok) {
  try { const r = await api(`/api/devis/${id}/decision`, { body: { accepte: ok } }); const i = S.devis.findIndex(d => d.id === id); S.devis[i] = r.devis; render(); toast(ok ? 'Devis accepté ✓' : 'Devis refusé', ok ? 'Nous vous contactons pour la suite.' : ''); } catch (e) { toast('Oups', e.message, true); }
}

// ---------------- Favoris, magasin ----------------
function vFavoris() {
  const L = S.favs.map(P).filter(Boolean);
  return `<div class="wrap"><div class="page-h"><div class="eyebrow">Votre sélection</div><h1 class="d">Mes <i>favoris</i></h1></div>
    ${L.length ? `<div class="grid">${L.map(pcard).join('')}</div>` : `<div class="empty"><div class="big">♡</div><div class="d">Aucun favori</div><p>Touchez le cœur d’un article pour le retrouver ici.</p><button class="btn" style="margin-top:16px" onclick="go('boutique')">Explorer</button></div>`}</div>`;
}
function vMagasin() { return `<div class="wrap" style="max-width:820px"><div class="page-h"><div class="eyebrow">Showroom</div><h1 class="d">Venir en <i>boutique</i></h1><p class="muted">Touchez les matières, comparez les tailles, repartez avec vos articles.</p></div>${storeCard('map-store')}</div>`; }
function showTarifs() {
  const L = S.data.livraison;
  sheet(`<div class="eyebrow">Transparence</div><h2 class="d" style="font-size:32px;margin:6px 0 14px">Tarifs de <i>livraison</i></h2>
    <div class="lbl" style="margin-top:0">Livraison Abidjan & environs</div>${L.zones.map(z => `<div class="tot"><span>${esc(z.nom)}<br><span class="tiny">${esc(z.exemples || '')}</span></span><b style="color:var(--txt)">${F(z.prix)}</b></div>`).join('')}
    <div class="lbl">Expédition — tapis & pantoufles (selon la quantité)</div>${L.tapisPaliers.map((p, i, a) => `<div class="tot"><span>${a[i + 1] ? `${p.min}${a[i + 1].min - 1 > p.min ? ' à ' + (a[i + 1].min - 1) : ''}` : p.min + ' et plus'} article${p.min > 1 ? 's' : ''}</span><b style="color:var(--txt)">${F(p.prix)}</b></div>`).join('')}
    <div class="lbl">Expédition — casseroles & autres colis (selon la distance)</div>${L.colisPaliers.map((p, i, a) => { const de = i ? a[i - 1].jusqua + 1 : 0; return `<div class="tot"><span>${p.jusqua >= 99999 ? 'Plus de ' + (de - 1) + ' km' : de === p.jusqua ? 'Environ ' + p.jusqua + ' km' : (de ? de + ' à ' : 'Jusqu’à ') + p.jusqua + ' km'}</span><b style="color:var(--txt)">${F(p.prix)}</b></div>`; }).join('')}
    <div class="lbl">International (forfait)</div>${L.international.map(i => `<div class="tot"><span>${esc(i.pays)}${i.note ? '<br><span class="tiny">' + esc(i.note) + '</span>' : ''}</span><b style="color:var(--txt)">${i.prix ? F(i.prix) : 'À votre charge'}</b></div>`).join('')}
    <div class="note or" style="margin-top:14px">${I.info}<span>Expédition : paiement obligatoire avant l’envoi. Livraison à Abidjan : paiement possible à la livraison. Retrait en boutique gratuit.</span></div>`);
}

// ---------------- Feuille / modale ----------------
function sheet(html) { $('pn').innerHTML = `<button class="x" onclick="closeSheet()">×</button>${html}`; $('sheet').classList.add('on'); document.body.style.overflow = 'hidden'; }
function closeSheet() { $('sheet').classList.remove('on'); document.body.style.overflow = ''; }

// ---------------- Assistante IA ----------------
function openIA(q) {
  sheet(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><div class="op-logo" style="background:var(--grad-or);color:#1b1205;border-radius:50%">${I.sparkle.replace('<svg', '<svg style="width:22px;height:22px"')}</div><div><b style="font-size:17px">Awa</b><div class="tiny muted">Assistante ${esc(B().nom)} · ${S.data.ia.intelligent ? 'IA' : 'réponses rapides'}</div></div></div>
    <div class="chat" id="ia-chat" style="max-height:52vh;overflow:auto;padding-right:4px"></div>
    <div class="quick" id="ia-quick">${['Quel set pour une famille de 6 ?', 'Livraison à Yopougon ?', 'Comment payer ?', 'Un tapis qui ne glisse pas', 'Un cadeau de mariage'].map(t => `<button onclick="iaAsk(this.textContent)">${t}</button>`).join('')}</div>
    <div class="composer"><input class="inp" id="ia-in" placeholder="Posez votre question…" onkeydown="if(event.key==='Enter')iaAsk()"><button class="send" onclick="iaAsk()">${I.send}</button></div>
    <div style="display:flex;gap:8px;margin-top:12px"><a class="btn wa sm" style="flex:1" href="${waLink('Bonjour Tawali Souk, j’aimerais parler à une conseillère.')}" target="_blank" rel="noopener">${I.wa} Conseillère WhatsApp</a>${S.ia.length ? `<button class="btn ghost sm" onclick="S.ia=[];LS.set('ts_ia',[]);openIA()">Effacer</button>` : ''}</div>`);
  drawIA(); if (q) iaAsk(q);
  setTimeout(() => { const i = $('ia-in'); if (i && window.innerWidth > 700) i.focus(); }, 300);
}
function iaRich(t) {
  return esc(t).replace(/\[\[p:(\d+)\]\]/g, (m, id) => { const p = P(id); return p ? `<span class="mini" onclick="closeSheet();go('produit',{id:${p.id}})"><img src="${esc(p.images[0])}" alt=""><span><b>${esc(p.nom)}</b><span>${p.prix ? F(px(p)) : 'Prix sur demande'}</span></span></span>` : ''; })
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}
function drawIA(typing) {
  const el = $('ia-chat'); if (!el) return;
  el.innerHTML = (S.ia.length ? '' : `<div class="msg them">Bonjour ✨ Je suis Awa. Je vous aide à choisir la bonne marmite, le bon set ou le bon tapis, et je calcule vos frais de livraison. Que cherchez-vous ?</div>`)
    + S.ia.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'them'}">${m.role === 'user' ? esc(m.content) : iaRich(m.content)}</div>`).join('')
    + (typing ? '<div class="msg them typing"><i></i><i></i><i></i></div>' : '');
  el.scrollTop = el.scrollHeight;
  const q = $('ia-quick'); if (q) q.classList.toggle('hide', S.ia.length > 0);
}
async function iaAsk(q) {
  const i = $('ia-in'); q = q || (i && i.value.trim()); if (!q) return; if (i) i.value = '';
  S.ia.push({ role: 'user', content: q }); drawIA(true);
  try { const r = await api('/api/assistant', { body: { messages: S.ia.slice(-10) } }); S.ia.push({ role: 'assistant', content: r.texte }); }
  catch (e) { S.ia.push({ role: 'assistant', content: e.message + ' Vous pouvez aussi nous écrire sur WhatsApp.' }); }
  S.ia = S.ia.slice(-30); LS.set('ts_ia', S.ia); drawIA();
}

// ---------------- Notifications push ----------------
function urlB64ToUint8(b) { const p = '='.repeat((4 - b.length % 4) % 4); const r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); }
async function enableNotifs(ask) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (ask) toast('Notifications indisponibles', /iPhone|iPad/.test(navigator.userAgent) ? 'Sur iPhone : installez d’abord l’application (Partager › Sur l’écran d’accueil).' : 'Votre navigateur ne les prend pas en charge.', true);
    return;
  }
  if (!window.isSecureContext) { if (ask) toast('Notifications', 'Disponibles quand la boutique est en ligne (https).', true); return; }
  try {
    let perm = Notification.permission;
    if (perm === 'default' && ask) perm = await Notification.requestPermission();
    if (perm !== 'granted') { if (ask) toast('Notifications refusées', 'Vous pouvez les autoriser dans les réglages du navigateur.', true); return; }
    if (!S.token) { const r = await api('/api/client/visiteur', { body: {} }); S.token = r.token; S.client = r.client; LS.set('ts_token', S.token); stream(); }
    const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(S.data.vapidKey) });
    await api('/api/client/push', { body: { subscription: sub.toJSON() } });
    if (S.client) S.client.notifs = true;
    if (ask) { toast('Notifications activées ✓', 'Nouveautés, prix cassés et suivi de vos colis.'); render(); }
  } catch (e) { if (ask) toast('Activation impossible', e.message, true); }
}
async function disableNotifs() {
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { }
  if (S.client) S.client.notifs = false; toast('Notifications désactivées'); render();
}
function askNotifs() {
  if (!('Notification' in window) || Notification.permission !== 'default' || LS.get('ts_ask_notif', 0) > Date.now()) return;
  LS.set('ts_ask_notif', Date.now() + 3 * 86400000);
  sheet(`<div style="text-align:center"><div class="check" style="background:var(--grad)">${I.bell.replace('<svg', '<svg style="width:40px;height:40px;stroke-dasharray:none;stroke-dashoffset:0;animation:none;color:#1b0e02"')}</div><h2 class="d" style="font-size:30px">Ne ratez rien</h2><p class="muted" style="margin:8px 0 18px">Soyez prévenu(e) des nouveautés, des prix cassés, du départ du livreur et de son arrivée.</p>
    <button class="btn full" onclick="closeSheet();enableNotifs(true)">Activer les notifications</button><button class="btn ghost full" style="margin-top:10px" onclick="closeSheet()">Plus tard</button></div>`);
}

// ---------------- Installation de l'application ----------------
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; setTimeout(installBar, 25000); });
function installBar() {
  if (!S.installEvt || LS.get('ts_install_no', 0) > Date.now() || $('ibar')) return;
  const d = document.createElement('div'); d.className = 'install-bar'; d.id = 'ibar';
  d.innerHTML = `<img src="/img/icon-192.png" alt=""><div style="flex:1"><b style="font-size:14px">Installer Tawali Souk</b><div class="tiny muted">Accès direct, notifications, plus rapide</div></div><button class="btn xs" onclick="installer()">Installer</button><button class="muted" style="font-size:20px;padding:0 6px" onclick="this.parentNode.remove();LS.set('ts_install_no',Date.now()+7*86400000)">×</button>`;
  document.body.appendChild(d);
}
async function installer() {
  const b = $('ibar'); if (b) b.remove();
  if (S.installEvt) { S.installEvt.prompt(); const r = await S.installEvt.userChoice; S.installEvt = null; if (r.outcome === 'accepted') toast('Application installée ✨', 'Retrouvez Tawali Souk sur votre écran d’accueil.'); return; }
  if (window.matchMedia('(display-mode: standalone)').matches) return toast('Déjà installée ✓', 'Vous utilisez l’application.');
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  sheet(`<h2 class="d" style="font-size:30px;margin-bottom:12px">Installer <i>Tawali Souk</i></h2>
    ${ios ? `<div class="steps"><div class="step"><div>Touchez le bouton <b>Partager</b> (carré avec une flèche) en bas de Safari.</div></div><div class="step"><div>Choisissez <b>« Sur l’écran d’accueil »</b>.</div></div><div class="step"><div>Touchez <b>Ajouter</b>. L’icône Tawali Souk apparaît comme une vraie application.</div></div></div>`
    : `<div class="steps"><div class="step"><div>Ouvrez le menu du navigateur (⋮ en haut à droite).</div></div><div class="step"><div>Choisissez <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</div></div></div>`}
    <button class="btn full" style="margin-top:18px" onclick="closeSheet()">Compris</button>`);
}

// ---------------- Temps réel ----------------
let es;
function stream() {
  if (es) es.close();
  if (!window.EventSource) return;
  es = new EventSource(S.token ? '/api/stream/client?token=' + encodeURIComponent(S.token) : '/api/stream/public');
  es.addEventListener('catalogue', () => reloadCatalogue());
  es.addEventListener('presence', e => { S.enLigne = JSON.parse(e.data).enLigne; if (S.vue === 'chat') render(); });
  es.addEventListener('annonce', e => { const a = JSON.parse(e.data); S.notifs.unshift({ id: a.id, titre: a.titre, corps: a.corps, image: a.image, url: a.url, at: a.at, type: 'annonce', lu: false }); badges(); ding(); toast(a.titre, a.corps, false, () => a.url ? openUrl(a.url) : go('notifs')); });
  es.addEventListener('notif', e => { const n = JSON.parse(e.data); S.notifs.unshift(n); badges(); ding(); toast(n.titre, n.corps, false, () => n.type === 'commande' ? go('commande', { id: n.ref }) : go('notifs')); });
  es.addEventListener('commande', e => { const c = JSON.parse(e.data); upsertCmd(c); if (['commande', 'recu', 'payer', 'commandes'].includes(S.vue) && Number(S.p.id || 0) === c.id || S.vue === 'commandes') { const y = window.scrollY; render(); window.scrollTo(0, y); } });
  es.addEventListener('position', e => { const d = JSON.parse(e.data); const c = cmd(d.id); if (!c) return; c.livreurPos = d.pos; const M = S.maps.suivi; if (S.vue === 'commande' && M && M.id === d.id && $('map-suivi') && $('map-suivi').contains(M.map.getContainer())) { M.mk.setLatLng([d.pos.lat, d.pos.lng]); majDistance(c); } else if (S.vue === 'commande' && Number(S.p.id) === d.id) render(); });
  es.addEventListener('chatlivreur', e => { const d = JSON.parse(e.data); const c = cmd(d.id); if (!c) return; if (!c.chatLivreur.some(m => m.id === d.message.id)) c.chatLivreur.push(d.message); if (S.vue === 'commande' && Number(S.p.id) === d.id) drawChatLivreur(c); if (d.message.de === 'livreur') { ding(); toast('Message du livreur', d.message.texte, false, () => go('commande', { id: d.id })); } });
  es.addEventListener('chat', e => { const m = JSON.parse(e.data); if (!S.chat.some(x => x.id === m.id)) S.chat.push(m); if (m.de !== 'client') { ding(); if (S.vue !== 'chat') toast(B().nom, m.texte, false, () => go('chat')); } if (S.vue === 'chat') render(); });
  es.addEventListener('devis', e => { const d = JSON.parse(e.data); const i = S.devis.findIndex(x => x.id === d.id); if (i >= 0) S.devis[i] = d; else S.devis.unshift(d); if (S.vue === 'devis') render(); });
}
let reloadT;
function reloadCatalogue() { clearTimeout(reloadT); reloadT = setTimeout(async () => { try { await loadCatalogue(); if (!['commander', 'payer'].includes(S.vue)) { const y = window.scrollY; render(); window.scrollTo(0, y); } } catch (e) { } }, 400); }
async function loadCatalogue() {
  const d = await api('/api/public/boutique');
  S.data = d; S.byId = {}; d.produits.forEach(p => { S.byId[p.id] = p; });
  S.cart = S.cart.filter(c => S.byId[c.id]);
  document.title = d.boutique.nom + ' — ' + d.boutique.slogan;
  const bd = $('bandeau-t'); if (bd) bd.innerHTML = [d.boutique.bandeau, 'Paiement Wave · Orange Money · MTN MoMo · Moov Money', 'Boutique : ' + d.boutique.adresse, 'WhatsApp ' + d.boutique.tel].filter(Boolean).map(esc).join('<span>✦</span>');
  $('fab-wa').href = waLink('Bonjour Tawali Souk !');
}
async function loadClient() {
  if (!S.token) return;
  try { const d = await api('/api/client/donnees'); S.client = d.client; S.commandes = d.commandes; S.notifs = d.notifs; S.devis = d.devis; S.chat = d.chat; }
  catch (e) { }
}

// ---------------- Reçu public (lien partagé) ----------------
async function bootRecuPublic(id, k) {
  try {
    const r = await fetch(`/api/recu/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`).then(x => x.json());
    if (!r.ok) throw new Error(r.error);
    document.body.innerHTML = `<div class="wrap" style="max-width:620px;padding:40px 18px">${recuHTML(r.recu, r.boutique)}<div class="noprint" style="display:flex;gap:10px;margin-top:26px;flex-wrap:wrap"><button class="btn ghost" style="flex:1" onclick="window.print()">${I.download} PDF / imprimer</button><a class="btn" style="flex:1" href="/">Visiter la boutique</a></div></div>`;
  } catch (e) { document.body.innerHTML = `<div class="empty"><div class="d">Reçu introuvable</div><p>${esc(e.message || '')}</p><a class="btn" style="margin-top:16px" href="/">Visiter la boutique</a></div>`; }
}

// ---------------- Démarrage ----------------
async function boot() {
  const q = new URLSearchParams(location.search);
  if (q.get('recu') && q.get('k')) return bootRecuPublic(q.get('recu'), q.get('k'));
  try { await loadCatalogue(); }
  catch (e) { $('vue').innerHTML = `<div class="empty"><div class="d">Connexion impossible</div><p>${esc(e.message)}</p><button class="btn" style="margin-top:16px" onclick="location.reload()">Réessayer</button></div>`; return; }
  await loadClient();
  const st = parseUrl(); S.vue = st.vue; S.p = st.p;
  history.replaceState({ vue: S.vue, p: S.p }, '', location.href);
  render(); stream();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js').catch(() => { });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'open') openUrl(e.data.url); });
    if (S.client && Notification.permission === 'granted') enableNotifs(false);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadClient().then(() => { badges(); if (['commande', 'commandes', 'recu'].includes(S.vue)) render(); }); });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); $('zoom').classList.remove('on'); } });
boot();
