/* ==========================================================
   TAWALI SOUK — espace gestion
   ========================================================== */
'use strict';
const D = { settings: null, categories: [], produits: [], banners: [], livreurs: [], commandes: [], clients: [], annonces: [], programmes: [], devis: [], chats: [], smsLog: [], avis: {}, abonnes: 0 };
let TAB = (location.hash || '#tableau').slice(1), FILTRE = 'traiter', PFILTRE = { q: '', cat: 0 }, CHAT_SEL = null, CMD_Q = '';
const ST = { recue: 'Nouvelle', confirmee: 'Confirmée', preparation: 'En préparation', en_route: 'En route', expediee: 'Expédiée', prete: 'Prête au retrait', livree: 'Livrée', annulee: 'Annulée' };
const PST = { en_attente: ['Paiement attendu', 'jaune'], declare: ['À VÉRIFIER', 'orange'], paye: ['Payé', 'vert'], refuse: ['Refusé', 'rouge'], a_la_livraison: ['À la livraison', 'bleu'] };
const MODE = { livraison: 'Livraison', expedition: 'Expédition', retrait: 'Retrait' };
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const TABS = [['tableau', 'Tableau de bord'], ['commandes', 'Commandes'], ['produits', 'Produits'], ['categories', 'Catégories'], ['bannieres', 'Bannières'],
  ['livraison', 'Livraison & tarifs'], ['paiements', 'Paiements'], ['livreurs', 'Livreurs'], ['discussions', 'Discussions'], ['devis', 'Devis'], ['avis', 'Avis'],
  ['clients', 'Clients'], ['messages', 'Notifications'], ['reglages', 'Réglages']];
const wa = (tel, msg) => `https://wa.me/${String(tel || '').replace(/\D/g, '').replace(/^0/, '2250').replace(/^(?!225)(\d{10})$/, '225$1')}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
const catNom = id => (D.categories.find(c => c.id === id) || {}).nom || '—';
const prod = id => D.produits.find(p => p.id === Number(id));
const promoOn = p => !!(p.promo && p.promo.prix && Date.parse(p.promo.fin) > Date.now());
const localDT = iso => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function ding(fort) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    (fort ? [0, .18, .36, .7, .88, 1.06] : [0, .16]).forEach((t, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = i % 2 ? 1175 : 880; g.gain.setValueAtTime(.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .4); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .4); });
  } catch (e) { }
}

// ---------------- Démarrage ----------------
adminBoot(async () => {
  await reload();
  adminStream({
    commande: c => { upsert(D.commandes, c); refreshIf(['tableau', 'commandes', 'paiements']); refreshOpenOrder(c); },
    nouvelle: n => { ding(true); toast(`Nouvelle commande n°${n.numero}`, `${n.client} · ${F(n.total)}`); },
    paiement: n => { ding(true); toast(`Paiement à vérifier — n°${n.numero}`, `${PAY_LABEL[n.mode] || ''} · ${F(n.total)}`); },
    alerte: a => { ding(); toast(a.titre, a.corps); },
    position: () => { },
    client: c => { upsert(D.clients, c); },
    chat: m => { const x = Object.assign({}, m); delete x.clientNom; delete x.clientTel; upsert(D.chats, x); if (!D.clients.some(c => c.id === m.clientId)) D.clients.push({ id: m.clientId, nom: m.clientNom, tel: m.clientTel }); if (m.de === 'client') { ding(); toast('Message de ' + m.clientNom, m.texte); } nav(); if (TAB === 'discussions') render(); },
    devis: d => { upsert(D.devis, d); nav(); if (TAB === 'devis') render(); toast('Demande de devis', d.nom + ' · ' + d.type); },
    sms: s => { D.smsLog.unshift(s); if (TAB === 'paiements') render(); }
  }, on => { const l = $('live'); l.classList.toggle('on', on); l.querySelector('span').textContent = on ? 'En direct' : 'Reconnexion…'; });
  window.addEventListener('hashchange', () => { TAB = location.hash.slice(1) || 'tableau'; render(); });
  setInterval(() => { if (TAB === 'commandes' || TAB === 'tableau') render(true); }, 60000);
});
async function reload() {
  const r = await api('/api/admin/bootstrap');
  Object.assign(D, r);
  nav(); render(); ouvertBtn();
}
const upsert = (arr, o) => { const i = arr.findIndex(x => x.id === o.id); if (i >= 0) arr[i] = o; else arr.push(o); };
function refreshIf(tabs) { nav(); if (tabs.includes(TAB)) render(true); }
function nav() {
  const aVerif = D.commandes.filter(c => c.paiement.statut === 'declare' && c.statut !== 'annulee').length;
  const aTraiter = D.commandes.filter(c => ['recue', 'confirmee', 'preparation'].includes(c.statut)).length;
  const nonLus = new Set(D.chats.filter(m => m.de === 'client' && !m.lu).map(m => m.clientId)).size;
  const devis = D.devis.filter(d => d.statut === 'nouveau').length;
  const cnt = { commandes: aTraiter, paiements: aVerif, discussions: nonLus, devis };
  $('nav').innerHTML = TABS.map(([k, l]) => `<a class="nb ${TAB === k ? 'on' : ''}" href="#${k}">${l}<span class="cnt">${cnt[k] || ''}</span></a>`).join('');
  document.title = (aVerif + aTraiter ? `(${aVerif + aTraiter}) ` : '') + 'Gestion — Tawali Souk';
}
function render(keepScroll) {
  const y = window.scrollY;
  const R = { tableau: pTableau, commandes: pCommandes, produits: pProduits, categories: pCategories, bannieres: pBannieres, livraison: pLivraison, paiements: pPaiements,
    livreurs: pLivreurs, discussions: pDiscussions, devis: pDevis, avis: pAvis, clients: pClients, messages: pMessages, reglages: pReglages };
  $('main').innerHTML = `<div class="panel on">${(R[TAB] || pTableau)()}</div>`;
  nav();
  if (TAB === 'discussions') { const m = $('msgs'); if (m) m.scrollTop = m.scrollHeight; }
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}
function ouvertBtn() { const o = D.settings.boutique.ouvert, b = $('openbtn'); b.className = 'openbtn ' + (o ? 'on' : 'off'); b.querySelector('span').textContent = o ? 'Boutique ouverte' : 'Commandes fermées'; }
async function toggleOuvert() {
  const o = !D.settings.boutique.ouvert;
  if (!o && !confirm('Fermer la prise de commande en ligne ? Les clients pourront toujours vous écrire sur WhatsApp.')) return;
  const r = await api('/api/admin/boutique', { method: 'PUT', body: { ouvert: o } }); D.settings = r.settings; ouvertBtn();
}

// =====================================================================
// TABLEAU DE BORD
// =====================================================================
function pTableau() {
  const now = new Date(), jour = now.toISOString().slice(0, 10), mois = jour.slice(0, 7);
  const valides = D.commandes.filter(c => c.statut !== 'annulee');
  const caj = valides.filter(c => c.at.slice(0, 10) === jour).reduce((s, c) => s + c.total, 0);
  const cam = valides.filter(c => c.at.slice(0, 7) === mois).reduce((s, c) => s + c.total, 0);
  const encaisse = valides.filter(c => c.at.slice(0, 7) === mois && c.paiement.statut === 'paye').reduce((s, c) => s + c.total, 0);
  const aVerif = D.commandes.filter(c => c.paiement.statut === 'declare' && c.statut !== 'annulee');
  const aTraiter = D.commandes.filter(c => ['recue', 'confirmee', 'preparation'].includes(c.statut));
  const sansPrix = D.produits.filter(p => !(p.prix > 0));
  const stockBas = D.produits.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 3);
  const ventes = {}; valides.forEach(c => c.lignes.forEach(l => { ventes[l.produitId] = (ventes[l.produitId] || 0) + l.qte; }));
  const top = Object.keys(ventes).map(id => ({ p: prod(id), n: ventes[id] })).filter(x => x.p).sort((a, b) => b.n - a.n).slice(0, 6);
  const promos = D.produits.filter(promoOn);
  return `<div class="ph-t"><div><div class="h">Bonjour 👋</div><p>${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
    <div class="row"><button class="btn line" onclick="alertesAppareil()">🔔 Alertes sur cet appareil</button><button class="btn" onclick="editProduit()">+ Nouveau produit</button></div></div>
  ${sansPrix.length ? `<div class="alertbar">⚠️ ${sansPrix.length} produit(s) affichent « Prix sur demande » : ils ne peuvent pas être commandés en ligne.<button class="btn sm" onclick="prixRapides()">Saisir les prix en 2 minutes</button></div>` : ''}
  ${aVerif.length ? `<div class="alertbar" style="background:#FFE7CC">💳 ${aVerif.length} paiement(s) Mobile Money à vérifier.<button class="btn sm" onclick="FILTRE='verif';location.hash='#commandes'">Vérifier maintenant</button></div>` : ''}
  <div class="kpis">
    <div class="kpi nuit"><div class="l">Ventes du jour</div><div class="v">${F(caj)}</div><div class="s">${valides.filter(c => c.at.slice(0, 10) === jour).length} commande(s)</div></div>
    <div class="kpi"><div class="l">Ventes du mois</div><div class="v">${F(cam)}</div><div class="s">Encaissé : ${F(encaisse)}</div></div>
    <div class="kpi ${aTraiter.length ? 'alert' : ''}"><div class="l">À préparer</div><div class="v">${aTraiter.length}</div><div class="s">commande(s) en cours</div></div>
    <div class="kpi ${aVerif.length ? 'alert' : ''}"><div class="l">Paiements à vérifier</div><div class="v">${aVerif.length}</div><div class="s">Wave · OM · MTN · Moov</div></div>
    <div class="kpi"><div class="l">Abonnés notifications</div><div class="v">${D.abonnes || 0}</div><div class="s">${D.clients.length} client(s)</div></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="card-t">Dernières commandes <a class="btn sm ghost" href="#commandes">Tout voir</a></div>
      ${D.commandes.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>N°</th><th>Client</th><th>Mode</th><th>Paiement</th><th class="num">Total</th></tr>${D.commandes.slice(-8).reverse().map(c => `<tr style="cursor:pointer" onclick="ouvrirCommande(${c.id})"><td><b>${c.numero}</b><div class="hint">${fdt(c.at)}</div></td><td>${esc(c.clientNom)}</td><td>${MODE[c.livraison.mode]}</td><td><span class="badge ${PST[c.paiement.statut][1]}">${PST[c.paiement.statut][0]}</span></td><td class="num"><b>${F(c.total)}</b></td></tr>`).join('')}</table></div>` : `<div class="empty">Les commandes apparaîtront ici en temps réel, avec une sonnerie.</div>`}</div>
    <div>
      <div class="card"><div class="card-t">Meilleures ventes</div>${top.length ? top.map(x => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0"><div class="thumb"><img src="${esc(x.p.images[0] || '')}" alt=""></div><div style="flex:1">${esc(x.p.nom)}</div><b>${x.n}</b></div>`).join('') : '<p class="hint">Pas encore de ventes.</p>'}</div>
      <div class="card"><div class="card-t">Prix cassés en cours</div>${promos.length ? promos.map(p => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0"><span>${esc(p.nom)}</span><span class="badge orange">jusqu’au ${fdt(p.promo.fin)}</span></div>`).join('') : '<p class="hint">Aucune promotion. Ouvrez un produit › « Prix cassé » pour lancer un compte à rebours.</p>'}</div>
      ${stockBas.length ? `<div class="card"><div class="card-t">Stock bas</div>${stockBas.map(p => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc(p.nom)}</span><span class="badge ${p.stock ? 'jaune' : 'rouge'}">${p.stock ? p.stock + ' restant(s)' : 'Rupture'}</span></div>`).join('')}</div>` : ''}
      <div class="card"><div class="card-t">Partager la boutique</div><div style="display:flex;gap:14px;align-items:center">${qrSvg(location.origin)}<div><p class="hint">À imprimer sur vos flyers, sacs, factures et en boutique.</p><p style="font-weight:700;margin-top:6px">${esc(location.origin)}</p><button class="btn sm ghost" style="margin-top:8px" onclick="window.print()">Imprimer</button></div></div></div>
    </div>
  </div>`;
}
function qrSvg(url) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return `<div style="width:120px;flex-shrink:0">${q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div>`; } catch (e) { return ''; } }
async function alertesAppareil() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !window.isSecureContext) { toast('Alertes', 'Gardez cette page ouverte : une sonnerie retentit à chaque commande. Les alertes sur téléphone verrouillé fonctionnent une fois la boutique en ligne (https).'); ding(true); return; }
    const perm = await Notification.requestPermission(); if (perm !== 'granted') return toast('Alertes refusées', 'Autorisez les notifications dans le navigateur.', true);
    const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    const k = D.settings.vapidKey, pad = '='.repeat((4 - k.length % 4) % 4), raw = atob((k + pad).replace(/-/g, '+').replace(/_/g, '/'));
    let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from([...raw].map(c => c.charCodeAt(0))) });
    await api('/api/admin/push', { body: { subscription: sub.toJSON() } }); ding(); toast('Alertes activées ✓', 'Vous serez prévenu(e) des commandes et paiements, même téléphone verrouillé.');
  } catch (e) { toast('Erreur', e.message, true); }
}

// =====================================================================
// COMMANDES
// =====================================================================
function filtreCmd(c) {
  if (CMD_Q) { const q = CMD_Q.toLowerCase(); if (!(String(c.numero).includes(q) || (c.clientNom || '').toLowerCase().includes(q) || (c.tel || '').includes(q) || (c.paiement.reference || '').toLowerCase().includes(q))) return false; }
  switch (FILTRE) {
    case 'traiter': return ['recue', 'confirmee', 'preparation'].includes(c.statut);
    case 'verif': return c.paiement.statut === 'declare' && c.statut !== 'annulee';
    case 'attente': return c.paiement.statut === 'en_attente' && c.statut !== 'annulee';
    case 'route': return ['en_route', 'prete'].includes(c.statut);
    case 'exp': return c.livraison.mode === 'expedition' && !['livree', 'annulee'].includes(c.statut);
    case 'fini': return ['livree', 'annulee'].includes(c.statut);
    default: return true;
  }
}
function pCommandes() {
  const n = f => { const s = FILTRE; FILTRE = f; const k = D.commandes.filter(filtreCmd).length; FILTRE = s; return k; };
  const L = D.commandes.filter(filtreCmd).slice().reverse();
  const F2 = [['traiter', 'À préparer'], ['verif', 'Paiements à vérifier'], ['attente', 'Paiement attendu'], ['route', 'En route / à retirer'], ['exp', 'Expéditions'], ['fini', 'Terminées'], ['tout', 'Toutes']];
  return `<div class="ph-t"><div><div class="h">Commandes</div><p>Cliquez une commande pour la traiter. Sonnerie à chaque nouvelle commande ou paiement.</p></div>
    <div class="row"><input class="in" style="width:220px" placeholder="N°, nom, tél., référence…" value="${esc(CMD_Q)}" oninput="CMD_Q=this.value;clearTimeout(window._cq);window._cq=setTimeout(()=>{render(true);const i=document.querySelector('.ph-t input');i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)">
    <a class="btn line" href="/api/admin/export.csv">Export Excel</a><button class="btn" onclick="nouvelleCommande()">+ Commande WhatsApp / téléphone</button></div></div>
  <div class="filters">${F2.map(([k, l]) => `<button class="fb ${FILTRE === k ? 'on' : ''}" onclick="FILTRE='${k}';render(true)">${l}<span class="cnt" style="${FILTRE === k ? 'background:#fff;color:var(--nuit)' : ''}">${k === 'tout' || k === 'fini' ? '' : n(k) || ''}</span></button>`).join('')}</div>
  ${L.length ? `<div class="ocs">${L.map(ocard).join('')}</div>` : `<div class="card empty">Aucune commande dans cette liste.</div>`}`;
}
function ocard(c) {
  const ps = PST[c.paiement.statut], lv = c.livraison;
  const age = Math.round((Date.now() - Date.parse(c.at)) / 60000);
  return `<div class="oc ${c.paiement.statut === 'declare' ? 'pay' : c.statut === 'recue' && age < 10 ? 'new' : c.paiement.statut === 'paye' ? 'ok' : ''}" onclick="ouvrirCommande(${c.id})">
    <div class="oc-h"><b>N° ${c.numero}</b><span class="badge ${c.statut === 'livree' ? 'vert' : c.statut === 'annulee' ? 'rouge' : c.statut === 'recue' ? 'noir' : ''}">${ST[c.statut]}</span></div>
    <div class="imgs">${c.lignes.slice(0, 5).map(l => `<img src="${esc(l.image)}" alt="">`).join('')}</div>
    <div class="m"><b style="color:var(--noir)">${esc(c.clientNom)}</b> · ${esc(c.tel)}<br>${MODE[lv.mode]} · ${esc(lv.zone || (lv.ville ? lv.ville + ', ' : '') + (lv.mode === 'expedition' ? lv.pays : '') || 'Boutique')}${lv.date ? `<br>📅 ${dmy(lv.date)} · ${esc(lv.creneau)}` : ''}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span class="badge ${ps[1]}">${ps[0]}${c.paiement.mode !== 'livraison' ? ' · ' + (PAY_LABEL[c.paiement.mode] || '') : ''}</span><b style="font-size:16px">${F(c.total)}</b></div>
    <div class="hint" style="margin-top:6px">${age < 60 ? 'il y a ' + age + ' min' : fdt(c.at)}</div></div>`;
}
let OPEN_CMD = null;
function refreshOpenOrder(c) { if (OPEN_CMD === c.id && $('modal') && $('modal').classList.contains('on')) ouvrirCommande(c.id, true); }
function ouvrirCommande(id, refresh) {
  const c = D.commandes.find(x => x.id === id); if (!c) return; OPEN_CMD = id;
  const lv = c.livraison, p = c.paiement, ps = PST[p.statut];
  const steps = { livraison: ['confirmee', 'preparation'], retrait: ['confirmee', 'preparation', 'prete'], expedition: ['confirmee', 'preparation'] }[lv.mode];
  const fini = ['livree', 'annulee'].includes(c.statut);
  const msgClient = `Bonjour ${c.clientNom.split(' ')[0]}, c’est ${D.settings.boutique.nom} au sujet de votre commande n°${c.numero} (${F(c.total)}).`;
  const html = `<div class="mt h">Commande n°${c.numero}</div>
    <div class="row" style="margin:-6px 0 12px"><span class="badge ${c.statut === 'livree' ? 'vert' : c.statut === 'annulee' ? 'rouge' : 'noir'}">${ST[c.statut]}</span><span class="badge ${ps[1]}">${ps[0]}</span><span class="hint">${fdt(c.at)}${c.source ? ' · saisie ' + esc(c.source) : ''}</span></div>
    ${p.statut === 'declare' ? `<div class="card" style="box-shadow:0 0 0 2px var(--orange);margin-bottom:14px"><div class="card-t">💳 Paiement à vérifier</div>
      <div class="grid2"><div><p><b>${esc(PAY_LABEL[p.mode])}</b> · montant attendu <b>${F(c.total)}</b></p><p>Référence : <b style="font-size:17px;letter-spacing:.04em">${esc(p.reference)}</b></p><p>Numéro payeur : <b>${esc(p.payeur)}</b></p><p class="hint">Déclaré ${fdt(p.declareAt)}</p>
        <p class="hint" style="margin-top:8px">Vérifiez dans votre application ${esc(PAY_LABEL[p.mode])} (ou vos SMS) qu’un paiement de <b>${F(c.total)}</b> avec cette référence est bien arrivé sur votre compte.</p></div>
        <div>${p.aPreuve || p.preuve ? `<img class="proof" src="/api/admin/preuve/${c.id}" alt="Capture du reçu">` : '<p class="hint">Pas de capture jointe.</p>'}</div></div>
      <div class="mfoot" style="justify-content:flex-start"><button class="btn vert" onclick="paiement(${c.id},'valider')">✓ Paiement reçu — valider</button><button class="btn rouge" onclick="refuserPaiement(${c.id})">Introuvable — refuser</button></div></div>` : ''}
    <div class="grid2">
      <div><div class="sec-t" style="margin-top:0">Client</div><p><b>${esc(c.clientNom)}</b><br>${esc(c.tel)}</p>
        <div class="row" style="margin-top:8px"><a class="btn wa sm" href="${wa(c.tel, msgClient)}" target="_blank">WhatsApp</a><a class="btn line sm" href="tel:${esc(c.tel)}">Appeler</a></div>
        <div class="sec-t">${MODE[lv.mode]}</div>
        <p>${lv.mode === 'livraison' ? `<b>${esc(lv.zone)}</b><br>${esc(lv.adresse || '')}${lv.repere ? '<br>Repère : ' + esc(lv.repere) : ''}${lv.position ? `<br><a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${lv.position.lat},${lv.position.lng}">📍 Position GPS du client</a>` : ''}`
          : lv.mode === 'expedition' ? `<b>${esc(lv.ville ? lv.ville + ', ' : '')}${esc(lv.pays)}</b>${lv.km ? ' (~' + lv.km + ' km)' : ''}<br>Destinataire : ${esc(lv.destinataire)}${lv.gare ? '<br>Gare / compagnie : ' + esc(lv.gare) : ''}${lv.fraisNote ? '<br><span class="hint">' + esc(lv.fraisNote) + '</span>' : ''}`
          : `Retrait à la boutique`}
        ${lv.date ? `<br>📅 <b>${dmy(lv.date)}</b> · ${esc(lv.creneau)}` : ''}</p>
        ${c.note ? `<div class="alertbar" style="margin-top:10px;background:var(--jaunep)">💬 ${esc(c.note)}</div>` : ''}
      </div>
      <div><div class="sec-t" style="margin-top:0">Articles</div>
        ${c.lignes.map(l => `<div style="display:flex;gap:10px;align-items:center;padding:5px 0"><div class="thumb" style="width:44px;height:44px"><img src="${esc(l.image)}" alt=""></div><div style="flex:1"><b>${l.qte} ×</b> ${esc(l.nom)}${l.variante ? `<br><span class="hint">${esc(l.variante)}</span>` : ''}</div><span>${F(l.total)}</span></div>`).join('')}
        <table class="tbl" style="margin-top:6px"><tr><td>Sous-total</td><td class="num">${F(c.sousTotal)}</td></tr><tr><td>${MODE[lv.mode]}</td><td class="num">${F(c.frais)}</td></tr>${c.remise ? `<tr><td>Remise fidélité</td><td class="num">− ${F(c.remise)}</td></tr>` : ''}<tr><td><b>Total</b></td><td class="num"><b style="font-size:17px">${F(c.total)}</b></td></tr></table>
        <p class="hint" style="margin-top:6px">${esc(PAY_LABEL[p.mode] || p.mode)}${p.reference ? ' · réf. ' + esc(p.reference) : ''}${p.par === 'sms' ? ' · validé automatiquement (SMS)' : ''}</p>
      </div>
    </div>
    ${!fini ? `<div class="sec-t">Faire avancer la commande</div><div class="steps-s">
      ${steps.map(s => `<button class="btn ${c.statut === s ? 'nuit' : 'line'} sm" ${c.statut === s ? 'disabled' : ''} onclick="statut(${c.id},'${s}')">${ST[s]}</button>`).join('')}
      ${lv.mode === 'livraison' ? `<button class="btn sm" onclick="assignerLivreur(${c.id})">🛵 ${c.livreur ? 'Changer de livreur' : 'Confier à un livreur'}</button>` : ''}
      ${lv.mode === 'expedition' ? `<button class="btn sm" onclick="expedier(${c.id})">📦 Expédier</button>` : ''}
      <button class="btn vert sm" onclick="statut(${c.id},'livree')">✓ ${lv.mode === 'retrait' ? 'Retirée' : 'Livrée'}</button>
      ${['en_attente', 'refuse', 'a_la_livraison'].includes(p.statut) ? `<button class="btn line sm" onclick="paiement(${c.id},'especes')">Marquer payé</button>` : ''}
      <button class="btn line sm" style="color:var(--rouge)" onclick="if(confirm('Annuler la commande n°${c.numero} ? Le stock est remis en vente.'))statut(${c.id},'annulee')">Annuler</button></div>` : ''}
    ${c.livreur ? `<div class="card" style="margin-top:12px;background:var(--fond)"><div class="card-t">🛵 ${esc(c.livreur.nom)} ${c.livreur.tel ? '· ' + esc(c.livreur.tel) : ''} ${c.proche ? '<span class="badge orange">à quelques pas</span>' : ''}</div>
      <div class="row"><button class="btn sm line" onclick="copierLienLivreur(${c.id})">Copier le lien livreur</button>${c.livreur.tel ? `<a class="btn wa sm" target="_blank" href="${wa(c.livreur.tel, lienLivreurMsg(c))}">Envoyer au livreur</a>` : ''}</div>
      ${(c.chatLivreur || []).length ? `<div class="msgs" style="margin-top:10px;max-height:180px">${c.chatLivreur.map(m => `<div class="msg ${m.de === 'livreur' ? 'me' : 'them'}"><b>${m.de === 'livreur' ? 'Livreur' : 'Client'}</b> : ${esc(m.texte)}<small>${fheure(m.at)}</small></div>`).join('')}</div>` : ''}</div>` : ''}
    ${c.avis ? `<div class="card" style="margin-top:12px;background:var(--fond)"><div class="card-t">Avis client ${'★'.repeat(c.avis.noteAchat)}${c.avis.noteLivraison ? ' · livraison ' + '★'.repeat(c.avis.noteLivraison) : ''}</div><p>${esc(c.avis.commentaire || '')}</p>${c.avis.suggestion ? `<p class="hint">Suggestion : ${esc(c.avis.suggestion)}</p>` : ''}</div>` : ''}
    <div class="fld" style="margin-top:14px"><label>Note interne (invisible pour le client)</label><textarea id="note-int" rows="2" onblur="api('/api/admin/commandes/${c.id}/note',{body:{note:this.value}}).catch(()=>{})">${esc(c.noteInterne || '')}</textarea></div>
    <div class="mfoot"><a class="btn line" target="_blank" href="/?recu=${c.id}&k=${c.recuKey}">Reçu ↗</a><a class="btn wa" target="_blank" href="${wa(c.tel, msgClient + ' Votre reçu : ' + location.origin + '/?recu=' + c.id + '&k=' + c.recuKey)}">Envoyer le reçu</a><button class="btn ghost" onclick="closeModal()">Fermer</button></div>`;
  openModal(html, true);
}
async function statut(id, s, extra) {
  try { const r = await api(`/api/admin/commandes/${id}/statut`, { body: Object.assign({ statut: s }, extra || {}) }); upsert(D.commandes, r.commande); toast('Commande mise à jour', ST[s] + ' — le client est prévenu.'); ouvrirCommande(id); render(true); }
  catch (e) { toast('Impossible', e.message, true); }
}
async function paiement(id, action, motif) {
  try { const r = await api(`/api/admin/commandes/${id}/paiement`, { body: { action, motif } }); upsert(D.commandes, r.commande); toast(action === 'refuser' ? 'Paiement refusé' : 'Paiement validé ✓', 'Le client a reçu une notification.'); ouvrirCommande(id); render(true); }
  catch (e) { toast('Impossible', e.message, true); }
}
function refuserPaiement(id) { const m = prompt('Motif (envoyé au client) :', 'Paiement introuvable avec cette référence'); if (m !== null) paiement(id, 'refuser', m); }
const lienLivreur = c => `${location.origin}/livreur.html?c=${c.id}&k=${c.livreurKey}`;
const lienLivreurMsg = c => `Course Tawali Souk n°${c.numero} — ${c.clientNom}, ${c.livraison.zone}. Ouvre ce lien et appuie sur « Démarrer » : ${lienLivreur(c)}`;
function copierLienLivreur(id) { const c = D.commandes.find(x => x.id === id); navigator.clipboard.writeText(lienLivreur(c)).then(() => toast('Lien copié', 'Envoyez-le au livreur.')); }
function assignerLivreur(id) {
  openModal(`<div class="mt h">Confier à un livreur</div>
    ${D.livreurs.length ? `<div class="fld"><label>Livreur</label><select id="lv-sel">${D.livreurs.map(l => `<option value="${l.id}">${esc(l.nom)} ${l.tel ? '· ' + esc(l.tel) : ''}</option>`).join('')}<option value="">+ Nouveau livreur…</option></select></div>` : ''}
    <div id="lv-new" style="${D.livreurs.length ? 'display:none' : ''}"><div class="row"><div class="fld"><label>Nom</label><input id="lv-nom"></div><div class="fld"><label>Téléphone</label><input id="lv-tel" type="tel"></div></div></div>
    <p class="hint">Le client est prévenu que sa commande est en route, avec le nom du livreur. Vous envoyez ensuite au livreur son lien : il partage sa position, discute avec le client et valide la livraison.</p>
    <div class="err" id="lv-err"></div><div class="mfoot"><button class="btn ghost" onclick="ouvrirCommande(${id})">Retour</button><button class="btn" onclick="validerLivreur(${id})">Confirmer le départ</button></div>`);
  const s = $('lv-sel'); if (s) s.onchange = () => { $('lv-new').style.display = s.value ? 'none' : ''; };
}
async function validerLivreur(id) {
  const s = $('lv-sel'); const body = s && s.value ? { livreurId: s.value } : { nom: $('lv-nom').value, tel: $('lv-tel').value };
  try {
    const r = await api(`/api/admin/commandes/${id}/livreur`, { body }); upsert(D.commandes, r.commande);
    if (!body.livreurId) D.livreurs = (await api('/api/admin/bootstrap')).livreurs;
    const c = r.commande;
    openModal(`<div class="mt h">C’est parti 🛵</div><p>Le client est prévenu. Envoyez maintenant le lien de course à <b>${esc(c.livreur.nom)}</b> :</p>
      <div class="fld" style="margin-top:10px"><input value="${esc(lienLivreur(c))}" readonly onclick="this.select()"></div>
      <div class="mfoot">${c.livreur.tel ? `<a class="btn wa" target="_blank" href="${wa(c.livreur.tel, lienLivreurMsg(c))}">Envoyer par WhatsApp</a>` : ''}<button class="btn line" onclick="copierLienLivreur(${c.id})">Copier</button><button class="btn ghost" onclick="ouvrirCommande(${c.id})">Voir la commande</button></div>`);
    render(true);
  } catch (e) { $('lv-err').textContent = e.message; }
}
function expedier(id) {
  const c = D.commandes.find(x => x.id === id);
  openModal(`<div class="mt h">Expédier la commande n°${c.numero}</div>
    ${c.paiement.statut !== 'paye' ? `<div class="alertbar">⚠️ Paiement non confirmé : validez d’abord le paiement (expédition = paiement obligatoire).</div>` : ''}
    <div class="row"><div class="fld"><label>Transporteur / compagnie</label><input id="ex-t" value="${esc(c.livraison.gare || '')}" placeholder="UTB, STIF, DHL…"></div><div class="fld"><label>N° de colis / bordereau</label><input id="ex-c"></div></div>
    <div class="fld"><label>Lieu de retrait pour le client</label><input id="ex-l" placeholder="Ex. gare UTB de Bouaké"></div>
    <div class="mfoot"><button class="btn ghost" onclick="ouvrirCommande(${id})">Retour</button><button class="btn" onclick="statut(${id},'expediee',{transporteur:$('ex-t').value,code:$('ex-c').value,lieu:$('ex-l').value})">Confirmer l’expédition</button></div>`);
}

// ---- Commande saisie par la gestion (WhatsApp / téléphone) ----
let NC = null;
function nouvelleCommande() {
  NC = NC || { items: [], mode: 'livraison', zoneId: '', date: '', creneau: '', paiement: 'livraison' };
  const L = D.settings.livraison;
  const dispo = D.produits.filter(p => p.actif && p.prix > 0);
  const tot = NC.items.reduce((s, it) => { const p = prod(it.produitId); return s + (p ? (promoOn(p) ? p.promo.prix : p.prix) * it.qte : 0); }, 0);
  openModal(`<div class="mt h">Commande WhatsApp / téléphone</div>
    <div class="row"><div class="fld"><label>Client</label><input id="nc-nom" value="${esc(NC.nom || '')}" oninput="NC.nom=this.value"></div><div class="fld"><label>Téléphone</label><input id="nc-tel" value="${esc(NC.tel || '')}" oninput="NC.tel=this.value"></div></div>
    <div class="sec-t">Articles</div>
    ${NC.items.map((it, i) => { const p = prod(it.produitId); return `<div class="row" style="align-items:center;margin-bottom:6px"><span style="flex:1"><b>${it.qte} ×</b> ${esc(p ? p.nom : '?')}${it.varianteId ? ' — ' + esc((p.variantes.find(v => v.id === it.varianteId) || {}).nom || '') : ''}</span><button class="btn sm ghost" onclick="NC.items.splice(${i},1);nouvelleCommande()">Retirer</button></div>`; }).join('') || '<p class="hint">Aucun article.</p>'}
    <div class="row"><div class="fld" style="flex:3"><select id="nc-p" onchange="ncVar()"><option value="">Choisir un article…</option>${dispo.map(p => `<option value="${p.id}">${esc(p.nom)} — ${F(promoOn(p) ? p.promo.prix : p.prix)}</option>`).join('')}</select></div><div class="fld" id="nc-vw" style="display:none"><select id="nc-v"></select></div><div class="fld" style="max-width:90px"><input id="nc-q" type="number" min="1" value="1"></div><button class="btn line" style="margin-bottom:12px" onclick="ncAdd()">Ajouter</button></div>
    <div class="sec-t">Réception</div>
    <div class="row"><div class="fld"><label>Mode</label><select onchange="NC.mode=this.value;nouvelleCommande()"><option value="livraison" ${NC.mode === 'livraison' ? 'selected' : ''}>Livraison</option><option value="retrait" ${NC.mode === 'retrait' ? 'selected' : ''}>Retrait boutique</option><option value="expedition" ${NC.mode === 'expedition' ? 'selected' : ''}>Expédition</option></select></div>
      ${NC.mode === 'livraison' ? `<div class="fld"><label>Zone</label><select onchange="NC.zoneId=this.value"><option value="">—</option>${L.zones.map(z => `<option value="${z.id}" ${NC.zoneId === z.id ? 'selected' : ''}>${esc(z.nom)} (${F(z.prix)})</option>`).join('')}</select></div>` : ''}
      ${NC.mode === 'expedition' ? `<div class="fld"><label>Ville</label><select onchange="NC.ville=this.value"><option value="">—</option>${L.villes.map(v => `<option ${NC.ville === v.nom ? 'selected' : ''}>${esc(v.nom)}</option>`).join('')}</select></div>` : ''}</div>
    ${NC.mode === 'livraison' ? `<div class="fld"><label>Adresse</label><input value="${esc(NC.adresse || '')}" oninput="NC.adresse=this.value"></div>` : ''}
    ${NC.mode !== 'expedition' ? `<div class="row"><div class="fld"><label>Date</label><input type="date" value="${esc(NC.date)}" onchange="NC.date=this.value"></div><div class="fld"><label>Créneau</label><select onchange="NC.creneau=this.value"><option value="">—</option>${L.creneaux.map(c => `<option ${NC.creneau === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>` : ''}
    <div class="row"><div class="fld"><label>Paiement</label><select onchange="NC.paiement=this.value"><option value="livraison" ${NC.paiement === 'livraison' ? 'selected' : ''}>À la livraison / en boutique</option>${Object.keys(D.settings.paiement.modes).map(k => `<option value="${k}" ${NC.paiement === k ? 'selected' : ''}>${PAY_LABEL[k]}</option>`).join('')}</select></div>
      <label class="swl" style="margin-bottom:14px"><span class="sw ${NC.paye ? 'on' : ''}" onclick="NC.paye=!NC.paye;this.classList.toggle('on')"></span>Déjà payé</label></div>
    <p><b>Articles : ${F(tot)}</b> <span class="hint">+ frais calculés automatiquement</span></p>
    <div class="err" id="nc-err"></div><div class="mfoot"><button class="btn ghost" onclick="NC=null;closeModal()">Annuler</button><button class="btn" onclick="ncSave()">Enregistrer la commande</button></div>`, true);
}
function ncVar() { const p = prod($('nc-p').value); const w = $('nc-vw'); if (p && p.variantes.length) { w.style.display = ''; $('nc-v').innerHTML = p.variantes.map(v => `<option value="${v.id}">${esc(v.nom)}</option>`).join(''); } else w.style.display = 'none'; }
function ncAdd() { const id = Number($('nc-p').value); if (!id) return; const p = prod(id); NC.items.push({ produitId: id, varianteId: p.variantes.length ? $('nc-v').value : '', qte: Math.max(1, Number($('nc-q').value) || 1) }); nouvelleCommande(); }
async function ncSave() {
  try {
    const r = await api('/api/admin/commandes', { body: { clientNom: NC.nom, tel: NC.tel, items: NC.items, paiement: NC.paiement, paye: NC.paye, source: 'whatsapp',
      livraison: { mode: NC.mode, zoneId: NC.zoneId, adresse: NC.adresse || 'À préciser', date: NC.date, creneau: NC.creneau, ville: NC.ville, pays: 'Côte d’Ivoire', destinataire: NC.nom } } });
    upsert(D.commandes, r.commande); NC = null; closeModal(); toast('Commande enregistrée', 'N°' + r.commande.numero); render(true);
  } catch (e) { $('nc-err').textContent = e.message; }
}

// =====================================================================
// PRODUITS
// =====================================================================
function pProduits() {
  const q = PFILTRE.q.toLowerCase();
  const L = D.produits.filter(p => (!PFILTRE.cat || p.categorieId === PFILTRE.cat) && (!q || (p.nom + ' ' + p.ref).toLowerCase().includes(q)));
  return `<div class="ph-t"><div><div class="h">Produits</div><p>${D.produits.length} produits · ${D.produits.filter(p => p.actif).length} en ligne. Les modifications apparaissent instantanément chez les clients.</p></div>
    <div class="row"><button class="btn line" onclick="prixRapides()">Prix & stocks rapides</button><button class="btn" onclick="editProduit()">+ Nouveau produit</button></div></div>
  <div class="filters"><input class="in" style="width:240px" placeholder="Rechercher…" value="${esc(PFILTRE.q)}" oninput="PFILTRE.q=this.value;clearTimeout(window._pq);window._pq=setTimeout(()=>{render(true);const i=document.querySelector('.filters input');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)">
    <button class="fb ${!PFILTRE.cat ? 'on' : ''}" onclick="PFILTRE.cat=0;render(true)">Toutes</button>${D.categories.map(c => `<button class="fb ${PFILTRE.cat === c.id ? 'on' : ''}" onclick="PFILTRE.cat=${c.id};render(true)">${esc(c.nom)}</button>`).join('')}</div>
  <div class="pgrid">${L.map(p => `<div class="pcd ${p.actif ? '' : 'off'}">
    <div class="im" style="background-image:url('${esc(p.images[0] || '')}')" onclick="editProduit(${p.id})"><div class="b">${promoOn(p) ? '<span class="badge orange">Prix cassé</span>' : ''}${p.vedette ? '<span class="badge noir">Vedette</span>' : ''}${!p.actif ? '<span class="badge">Masqué</span>' : ''}</div></div>
    <div class="bd"><b>${esc(p.nom)}</b><span class="hint">${esc(catNom(p.categorieId))}${p.variantes.length ? ' · ' + p.variantes.length + ' modèles' : ''}${p.stock !== null && p.stock !== undefined ? ' · stock ' + p.stock : ''}</span>
      <div class="ft"><span>${p.prix > 0 ? (promoOn(p) ? `<b>${F(p.promo.prix)}</b> <s class="hint">${F(p.prix)}</s>` : `<b>${F(p.prix)}</b>`) : '<span class="badge jaune">Prix à saisir</span>'}</span>
        <span class="sw ${p.actif ? 'on' : ''}" title="En ligne / masqué" onclick="majProduit(${p.id},{actif:${!p.actif}})"></span></div>
      <button class="btn sm line" onclick="editProduit(${p.id})">Modifier</button></div></div>`).join('')}</div>`;
}
async function majProduit(id, body) {
  try { const r = await api('/api/admin/produits/' + id, { method: 'PUT', body }); upsert(D.produits, r.produit); render(true); toast('Enregistré ✓'); } catch (e) { toast('Erreur', e.message, true); }
}
function prixRapides() {
  openModal(`<div class="mt h">Prix & stocks rapides</div><p class="hint" style="margin-bottom:10px">Saisissez les prix en F CFA. Stock : laissez vide si vous ne suivez pas le stock de l’article.</p>
    <div class="tbl-wrap" style="max-height:60vh;overflow:auto"><table class="tbl"><tr><th></th><th>Produit</th><th>Prix (F)</th><th>Stock</th></tr>
    ${D.produits.map(p => `<tr><td><div class="thumb" style="width:40px;height:40px"><img src="${esc(p.images[0] || '')}" alt=""></div></td><td>${esc(p.nom)}<div class="hint">${esc(catNom(p.categorieId))}</div></td>
      <td><input class="in" style="width:120px" type="number" min="0" step="100" data-pid="${p.id}" data-k="prix" value="${p.prix || ''}" placeholder="Prix"></td>
      <td><input class="in" style="width:90px" type="number" min="0" data-pid="${p.id}" data-k="stock" value="${p.stock === null || p.stock === undefined ? '' : p.stock}" placeholder="—"></td></tr>`).join('')}</table></div>
    <div class="mfoot"><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="savePrixRapides()">Enregistrer tout</button></div>`, true);
}
async function savePrixRapides() {
  const m = {}; document.querySelectorAll('[data-pid]').forEach(i => { const id = i.dataset.pid; m[id] = m[id] || { id }; m[id][i.dataset.k] = i.value === '' ? (i.dataset.k === 'stock' ? null : 0) : Number(i.value); });
  try { await api('/api/admin/produits/prix', { body: { liste: Object.values(m) } }); await reload(); closeModal(); toast('Prix enregistrés ✓', 'La boutique est à jour.'); } catch (e) { toast('Erreur', e.message, true); }
}

let EP = null; // produit en cours d'édition
function editProduit(id) {
  const p = id ? JSON.parse(JSON.stringify(prod(id))) : { nom: '', ref: '', categorieId: (D.categories[0] || {}).id, prix: 0, promo: null, images: [], variantes: [], stock: null, expedition: 'colis', badge: 'Nouveau', vedette: false, actif: true, desc: '', points: [], bienfaits: [], solution: '', pourquoi: '', entretien: '', contenu: '' };
  EP = p; EP._promoOn = promoOn(p); EP._notifier = !id;
  drawEditeur();
}
function drawEditeur() {
  const p = EP, nouveau = !p.id;
  const lines = a => esc((a || []).join('\n'));
  openModal(`<div class="mt h">${nouveau ? 'Nouveau produit' : esc(p.nom)}</div>
    <div class="sec-t" style="margin-top:0">Photos <span class="hint" style="text-transform:none;letter-spacing:0">— la première est la photo principale</span></div>
    <div class="photos">${p.images.map((im, i) => `<div class="ph ${i ? '' : 'cover'}" style="background-image:url('${esc(im)}')"><div class="a">${i ? `<button title="Mettre en premier" onclick="EP.images.unshift(EP.images.splice(${i},1)[0]);drawEditeur()">★</button><button title="Reculer" onclick="mvImg(${i},-1)">‹</button>` : ''}${i < p.images.length - 1 ? `<button title="Avancer" onclick="mvImg(${i},1)">›</button>` : ''}<button title="Supprimer" onclick="EP.images.splice(${i},1);drawEditeur()" style="background:var(--rouge)">×</button></div></div>`).join('')}
      <label class="ph add"><span>+</span>Ajouter<input type="file" accept="image/*" multiple style="display:none" onchange="ajoutPhotos(this.files)"></label></div>
    <div class="ia-box"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>✨ Fiche rédigée par l’IA</b><div style="font-size:12.5px;opacity:.75">L’IA regarde vos photos et rédige : nom, qualités, bienfaits, problème résolu, pourquoi ne pas passer à côté, entretien, message WhatsApp.</div></div>
      <button class="btn or" id="ia-btn" onclick="genererIA()" ${p.images.length ? '' : 'disabled'}>Générer avec l’IA</button></div>
      <input class="in" id="ia-ind" style="margin-top:10px" placeholder="Indications facultatives (ex. 5 marmites, aluminium, idéal pour la dot)"><div id="ia-wa"></div></div>
    <div class="row"><div class="fld" style="flex:3"><label>Nom</label><input id="e-nom" value="${esc(p.nom)}"></div><div class="fld"><label>Référence</label><input id="e-ref" value="${esc(p.ref || '')}"></div></div>
    <div class="row"><div class="fld"><label>Catégorie</label><select id="e-cat">${D.categories.map(c => `<option value="${c.id}" ${p.categorieId === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></div>
      <div class="fld"><label>Prix (F CFA)</label><input id="e-prix" type="number" min="0" step="100" value="${p.prix || ''}" placeholder="0 = prix sur demande"></div>
      <div class="fld"><label>Stock</label><input id="e-stock" type="number" min="0" value="${p.stock === null || p.stock === undefined ? '' : p.stock}" placeholder="vide = non suivi"></div></div>
    <div class="row"><div class="fld"><label>Badge</label><input id="e-badge" value="${esc(p.badge || '')}" list="badges" placeholder="Nouveau, Best-seller…"><datalist id="badges"><option>Nouveau</option><option>Best-seller</option><option>Coup de cœur</option><option>Haut de gamme</option><option>Prestige</option><option>Édition limitée</option></datalist></div>
      <div class="fld"><label>Type d’expédition</label><select id="e-exp"><option value="colis" ${p.expedition !== 'tapis' ? 'selected' : ''}>Colis (casseroles, ustensiles…) — tarif par distance</option><option value="tapis" ${p.expedition === 'tapis' ? 'selected' : ''}>Tapis / pantoufles — tarif par quantité</option></select></div></div>
    <div class="row" style="gap:22px"><label class="swl"><span class="sw ${p.actif ? 'on' : ''}" onclick="EP.actif=!EP.actif;this.classList.toggle('on')"></span>En ligne</label><label class="swl"><span class="sw ${p.vedette ? 'on' : ''}" onclick="EP.vedette=!EP.vedette;this.classList.toggle('on')"></span>Coup de cœur (accueil)</label></div>

    <div class="card" style="background:linear-gradient(135deg,#FFF6EA,#fff);margin-top:10px;box-shadow:0 0 0 1.5px ${EP._promoOn ? 'var(--orange)' : 'var(--g1)'}"><div class="card-t">⏳ Prix cassé avec compte à rebours <span class="sw ${EP._promoOn ? 'on' : ''}" onclick="EP._promoOn=!EP._promoOn;if(EP._promoOn&&!EP.promo)EP.promo={prix:'',fin:new Date(Date.now()+3*864e5).toISOString()};drawEditeur()"></span></div>
      ${EP._promoOn ? `<div class="row"><div class="fld"><label>Prix promo (F)</label><input id="e-pp" type="number" min="0" step="100" value="${esc(p.promo && p.promo.prix || '')}"></div><div class="fld"><label>Début (facultatif)</label><input id="e-pd" type="datetime-local" value="${localDT(p.promo && p.promo.debut)}"></div><div class="fld"><label>Fin</label><input id="e-pf" type="datetime-local" value="${localDT(p.promo && p.promo.fin)}"></div></div>
        <div class="row">${[['24 h', 1], ['3 jours', 3], ['7 jours', 7]].map(([l, j]) => `<button class="btn sm line" onclick="$('e-pf').value=localDT(new Date(Date.now()+${j}*864e5).toISOString())">${l}</button>`).join('')}<button class="btn sm line" onclick="const d=new Date();$('e-pf').value=localDT(new Date(d.getFullYear(),d.getMonth()+1,0,23,59).toISOString())">Fin du mois</button></div>
        <p class="hint" style="margin-top:8px">Le prix barré, le pourcentage et le compte à rebours s’affichent partout. À la fin du compteur, le prix normal revient tout seul.</p>` : '<p class="hint">Activez pour lancer une vente flash sur ce produit.</p>'}</div>

    <div class="sec-t">Modèles / coloris <span class="hint" style="text-transform:none;letter-spacing:0">— regroupe les articles qui se ressemblent dans une seule fiche</span></div>
    <div id="vars">${p.variantes.map((v, i) => `<div class="vrow"><div class="vim" style="background-image:url('${esc(v.image || '')}')" title="Choisir la photo" onclick="choisirImgVar(${i})"></div><input class="in" value="${esc(v.nom)}" oninput="EP.variantes[${i}].nom=this.value" placeholder="Nom du modèle"><label class="swl" title="Disponible"><span class="sw ${v.dispo !== false ? 'on' : ''}" onclick="EP.variantes[${i}].dispo=!(EP.variantes[${i}].dispo!==false);this.classList.toggle('on')"></span></label><button class="btn sm ghost" onclick="EP.variantes.splice(${i},1);drawEditeur()">×</button></div>`).join('')}</div>
    <button class="btn sm line" onclick="EP.variantes.push({nom:'',image:EP.images[EP.variantes.length]||EP.images[0]||'',dispo:true});drawEditeur()">+ Ajouter un modèle</button>

    <div class="sec-t">Textes de la fiche</div>
    <div class="fld"><label>Accroche</label><textarea id="e-desc" rows="2">${esc(p.desc)}</textarea></div>
    <div class="fld"><label>Contenu du lot</label><input id="e-contenu" value="${esc(p.contenu || '')}" placeholder="Ex. 5 marmites avec couvercles"></div>
    <div class="grid2"><div class="fld"><label>Qualités (une par ligne)</label><textarea id="e-points" rows="4">${lines(p.points)}</textarea></div><div class="fld"><label>Bienfaits (un par ligne)</label><textarea id="e-bienfaits" rows="4">${lines(p.bienfaits)}</textarea></div></div>
    <div class="fld"><label>Le problème qu’il règle</label><textarea id="e-solution" rows="2">${esc(p.solution)}</textarea></div>
    <div class="fld"><label>Pourquoi ne pas passer à côté</label><textarea id="e-pourquoi" rows="2">${esc(p.pourquoi)}</textarea></div>
    <div class="fld"><label>Entretien</label><textarea id="e-entretien" rows="2">${esc(p.entretien)}</textarea></div>
    <label class="swl" style="margin-top:6px"><span class="sw ${EP._notifier ? 'on' : ''}" onclick="EP._notifier=!EP._notifier;this.classList.toggle('on')"></span>${nouveau ? 'Prévenir tous les clients de cette nouveauté (notification)' : 'Envoyer une notification à tous les clients (nouveauté / prix cassé)'}</label>
    <div class="err" id="e-err"></div>
    <div class="mfoot">${!nouveau ? `<button class="btn line" style="color:var(--rouge);margin-right:auto" onclick="supprimerProduit(${p.id})">Supprimer</button><a class="btn line" target="_blank" href="/?p=${p.id}">Voir ↗</a>` : ''}<button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="sauverProduit()">${nouveau ? 'Publier le produit' : 'Enregistrer'}</button></div>`, true);
}
function mvImg(i, d) { const a = EP.images, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; captureEditeur(); drawEditeur(); }
function captureEditeur() {
  const v = id => ($(id) || {}).value;
  if (!$('e-nom')) return;
  Object.assign(EP, { nom: v('e-nom'), ref: v('e-ref'), categorieId: Number(v('e-cat')), prix: Number(v('e-prix')) || 0, stock: v('e-stock') === '' ? null : Number(v('e-stock')), badge: v('e-badge'), expedition: v('e-exp'),
    desc: v('e-desc'), contenu: v('e-contenu'), points: v('e-points').split('\n').filter(Boolean), bienfaits: v('e-bienfaits').split('\n').filter(Boolean), solution: v('e-solution'), pourquoi: v('e-pourquoi'), entretien: v('e-entretien') });
  if (EP._promoOn && $('e-pp')) EP.promo = { prix: Number(v('e-pp')) || 0, debut: v('e-pd') ? new Date(v('e-pd')).toISOString() : null, fin: v('e-pf') ? new Date(v('e-pf')).toISOString() : '' };
}
async function ajoutPhotos(files) {
  captureEditeur();
  toast('Envoi des photos…', files.length + ' photo(s)');
  for (const f of files) { try { EP.images.push(await uploadImage(f, 1400)); } catch (e) { toast('Photo refusée', e.message, true); } }
  drawEditeur();
}
function choisirImgVar(i) {
  captureEditeur();
  openModal(`<div class="mt h">Photo du modèle</div><div class="photos">${EP.images.map(im => `<div class="ph" style="background-image:url('${esc(im)}');cursor:pointer" onclick="EP.variantes[${i}].image='${esc(im)}';drawEditeur()"></div>`).join('')}</div><p class="hint" style="margin-top:10px">Ajoutez d’abord la photo dans la galerie du produit si elle n’y est pas.</p><div class="mfoot"><button class="btn ghost" onclick="drawEditeur()">Retour</button></div>`, true);
}
async function genererIA() {
  captureEditeur();
  const b = $('ia-btn'); b.disabled = true; b.textContent = 'L’IA analyse vos photos…';
  try {
    const r = await api('/api/admin/ia/fiche', { body: { images: EP.images.slice(0, 4), indications: $('ia-ind').value } });
    const f = r.fiche;
    Object.assign(EP, { nom: f.nom || EP.nom, desc: f.desc || EP.desc, contenu: f.contenu || EP.contenu, points: f.points || EP.points, bienfaits: f.bienfaits || EP.bienfaits, solution: f.solution || EP.solution, pourquoi: f.pourquoi || EP.pourquoi, entretien: f.entretien || EP.entretien });
    if (f.categorieId) EP.categorieId = f.categorieId;
    if (f.expedition) EP.expedition = f.expedition === 'tapis' ? 'tapis' : 'colis';
    if (Array.isArray(f.variantes) && f.variantes.length > 1 && !EP.variantes.length) EP.variantes = f.variantes.map((n, i) => ({ nom: n, image: EP.images[i] || EP.images[0], dispo: true }));
    drawEditeur();
    if (f.whatsapp) $('ia-wa').innerHTML = `<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.08);font-size:13px"><b>Statut WhatsApp proposé :</b><br>${esc(f.whatsapp)} <button class="btn sm or" style="margin-top:6px" onclick="navigator.clipboard.writeText(${JSON.stringify(f.whatsapp).replace(/"/g, '&quot;')}).then(()=>toast('Copié'))">Copier</button></div>`;
    toast('Fiche générée ✨', 'Relisez, ajustez le prix, puis publiez.');
  } catch (e) { toast('IA', e.message, true); b.disabled = false; b.textContent = 'Générer avec l’IA'; }
}
async function sauverProduit() {
  captureEditeur();
  const p = EP, err = $('e-err'); err.textContent = '';
  if (!p.nom) return err.textContent = 'Le nom est obligatoire.';
  if (EP._promoOn && (!p.promo || !p.promo.prix || !p.promo.fin)) return err.textContent = 'Indiquez le prix promo et la date de fin.';
  const body = { nom: p.nom, ref: p.ref, categorieId: p.categorieId, prix: p.prix, stock: p.stock, badge: p.badge, expedition: p.expedition, actif: p.actif, vedette: p.vedette, images: p.images,
    variantes: p.variantes.filter(v => v.nom), desc: p.desc, contenu: p.contenu, points: p.points, bienfaits: p.bienfaits, solution: p.solution, pourquoi: p.pourquoi, entretien: p.entretien,
    promo: EP._promoOn ? p.promo : null, notifier: EP._notifier };
  try {
    const r = p.id ? await api('/api/admin/produits/' + p.id, { method: 'PUT', body }) : await api('/api/admin/produits', { body });
    upsert(D.produits, r.produit); if (!p.id) { D.produits = [r.produit].concat(D.produits.filter(x => x.id !== r.produit.id)); }
    closeModal(); render(true); toast(p.id ? 'Produit enregistré ✓' : 'Produit publié ✨', r.pushes ? `${r.pushes} client(s) notifié(s).` : 'Visible immédiatement dans la boutique.');
  } catch (e) { err.textContent = e.message; }
}
async function supprimerProduit(id) {
  if (!confirm('Supprimer définitivement ce produit ? (Pour le cacher temporairement, désactivez « En ligne ».)')) return;
  try { await api(`/api/admin/produits/${id}/delete`, { body: {} }); D.produits = D.produits.filter(p => p.id !== id); closeModal(); render(true); toast('Produit supprimé'); } catch (e) { toast('Erreur', e.message, true); }
}

// =====================================================================
// CATÉGORIES & BANNIÈRES
// =====================================================================
function pCategories() {
  return `<div class="ph-t"><div><div class="h">Catégories</div><p>Les familles qui regroupent vos articles dans la boutique.</p></div><button class="btn" onclick="editCat()">+ Catégorie</button></div>
  <div class="card"><table class="tbl"><tr><th></th><th>Nom</th><th>Sous-titre</th><th>Produits</th><th>Ordre</th><th>Visible</th><th></th></tr>
  ${D.categories.slice().sort((a, b) => a.ordre - b.ordre).map(c => `<tr><td><div class="thumb"><img src="${esc(c.image || (D.produits.find(p => p.categorieId === c.id) || { images: [''] }).images[0])}" alt=""></div></td><td><b>${esc(c.nom)}</b></td><td class="hint">${esc(c.sousTitre || '')}</td><td>${D.produits.filter(p => p.categorieId === c.id).length}</td><td>${c.ordre}</td>
    <td><span class="sw ${c.actif ? 'on' : ''}" onclick="majCat(${c.id},{actif:${!c.actif}})"></span></td><td><button class="btn sm line" onclick="editCat(${c.id})">Modifier</button></td></tr>`).join('')}</table></div>`;
}
async function majCat(id, body) { try { const r = await api('/api/admin/categories/' + id, { method: 'PUT', body }); upsert(D.categories, r.categorie); render(true); } catch (e) { toast('Erreur', e.message, true); } }
function editCat(id) {
  const c = id ? D.categories.find(x => x.id === id) : { nom: '', sousTitre: '', image: '', ordre: D.categories.length + 1 };
  window._catImg = c.image || '';
  openModal(`<div class="mt h">${id ? 'Modifier' : 'Nouvelle'} catégorie</div>
    <div class="fld"><label>Nom</label><input id="c-nom" value="${esc(c.nom)}"></div><div class="fld"><label>Sous-titre</label><input id="c-sous" value="${esc(c.sousTitre || '')}"></div>
    <div class="row"><div class="fld"><label>Ordre</label><input id="c-ord" type="number" value="${c.ordre}"></div><div class="fld"><label>Image (facultatif)</label><input type="file" accept="image/*" onchange="uploadImage(this.files[0],1200).then(u=>{window._catImg=u;toast('Image prête')})"></div></div>
    <div class="err" id="c-err"></div><div class="mfoot">${id ? `<button class="btn line" style="color:var(--rouge);margin-right:auto" onclick="delCat(${id})">Supprimer</button>` : ''}<button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="saveCat(${id || 0})">Enregistrer</button></div>`);
}
async function saveCat(id) {
  const body = { nom: $('c-nom').value, sousTitre: $('c-sous').value, ordre: Number($('c-ord').value), image: window._catImg };
  try { const r = id ? await api('/api/admin/categories/' + id, { method: 'PUT', body }) : await api('/api/admin/categories', { body }); upsert(D.categories, r.categorie); closeModal(); render(true); } catch (e) { $('c-err').textContent = e.message; }
}
async function delCat(id) { try { await api(`/api/admin/categories/${id}/delete`, { body: {} }); D.categories = D.categories.filter(c => c.id !== id); closeModal(); render(true); } catch (e) { $('c-err').textContent = e.message; } }

function pBannieres() {
  return `<div class="ph-t"><div><div class="h">Bannières</div><p>Les grandes images qui défilent en haut de l’accueil. Astuce : *un mot entre astérisques* s’affiche en italique doré.</p></div><button class="btn" onclick="editBan()">+ Bannière</button></div>
  <div class="pgrid">${D.banners.slice().sort((a, b) => a.ordre - b.ordre).map(b => `<div class="pcd ${b.actif ? '' : 'off'}"><div class="im" style="background-image:url('${esc(b.image)}')" onclick="editBan(${b.id})"></div><div class="bd"><b>${esc(b.titre.replace(/\*/g, ''))}</b><span class="hint">${esc(b.texte)}</span><div class="ft"><span class="hint">Lien : ${esc(b.lien || '—')}</span><span class="sw ${b.actif ? 'on' : ''}" onclick="majBan(${b.id},{actif:${!b.actif}})"></span></div></div></div>`).join('')}</div>`;
}
async function majBan(id, body) { const r = await api('/api/admin/banners/' + id, { method: 'PUT', body }); upsert(D.banners, r.banner); render(true); }
function editBan(id) {
  const b = id ? D.banners.find(x => x.id === id) : { titre: '', texte: '', lien: '', image: '', ordre: D.banners.length + 1 };
  window._banImg = b.image;
  openModal(`<div class="mt h">${id ? 'Modifier la' : 'Nouvelle'} bannière</div>
    <div class="fld"><label>Image (horizontale, ~1600 × 900)</label><input type="file" accept="image/*" onchange="uploadImage(this.files[0],1800).then(u=>{window._banImg=u;$('b-prev').style.backgroundImage='url('+u+')'})"></div>
    <div id="b-prev" style="height:140px;border-radius:14px;background:var(--g1) center/cover;background-image:url('${esc(b.image)}');margin-bottom:12px"></div>
    <div class="fld"><label>Titre</label><input id="b-t" value="${esc(b.titre)}"></div><div class="fld"><label>Texte</label><input id="b-x" value="${esc(b.texte)}"></div>
    <div class="row"><div class="fld"><label>Lien au clic</label><select id="b-l"><option value="">Boutique</option>${D.categories.map(c => `<option value="cat:${c.cle || c.id}" ${b.lien === 'cat:' + (c.cle || c.id) ? 'selected' : ''}>Catégorie : ${esc(c.nom)}</option>`).join('')}${D.produits.map(p => `<option value="p:${p.id}" ${b.lien === 'p:' + p.id ? 'selected' : ''}>Produit : ${esc(p.nom)}</option>`).join('')}<option value="devis" ${b.lien === 'devis' ? 'selected' : ''}>Devis / personnalisation</option></select></div><div class="fld" style="max-width:100px"><label>Ordre</label><input id="b-o" type="number" value="${b.ordre}"></div></div>
    <div class="mfoot">${id ? `<button class="btn line" style="color:var(--rouge);margin-right:auto" onclick="api('/api/admin/banners/${id}/delete',{body:{}}).then(()=>{D.banners=D.banners.filter(x=>x.id!==${id});closeModal();render(true)})">Supprimer</button>` : ''}<button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="saveBan(${id || 0})">Enregistrer</button></div>`);
}
async function saveBan(id) {
  const body = { image: window._banImg, titre: $('b-t').value, texte: $('b-x').value, lien: $('b-l').value, ordre: Number($('b-o').value) };
  try { const r = id ? await api('/api/admin/banners/' + id, { method: 'PUT', body }) : await api('/api/admin/banners', { body }); upsert(D.banners, r.banner); closeModal(); render(true); } catch (e) { toast('Erreur', e.message, true); }
}

// =====================================================================
// LIVRAISON & TARIFS
// =====================================================================
function pLivraison() {
  const L = D.settings.livraison;
  return `<div class="ph-t"><div><div class="h">Livraison & tarifs</div><p>Tout est calculé automatiquement chez le client à partir de ces tableaux.</p></div><button class="btn" onclick="saveLivraison()">Enregistrer</button></div>
  <div class="grid2">
    <div class="card"><div class="card-t">Zones de livraison (Abidjan & environs)</div>
      <div id="zones">${L.zones.map(z => zoneRow(z)).join('')}</div><button class="btn sm line" onclick="$('zones').insertAdjacentHTML('beforeend',zoneRow({id:'',nom:'',exemples:'',prix:0}))">+ Zone</button></div>
    <div class="card"><div class="card-t">Créneaux & jours</div>
      <div class="fld"><label>Créneaux horaires (un par ligne)</label><textarea id="l-cr" rows="6">${esc(L.creneaux.join('\n'))}</textarea></div>
      <div class="fld"><label>Jours de livraison</label><div class="row">${JOURS.map((j, i) => `<label class="swl" style="margin:0"><input type="checkbox" class="l-j" value="${i}" ${L.jours.includes(i) ? 'checked' : ''}> ${j}</label>`).join('')}</div></div>
      <div class="row"><div class="fld"><label>Délai minimum (heures)</label><input id="l-dh" type="number" min="0" value="${L.delaiHeures}"></div><div class="fld"><label>Réservable jusqu’à (jours)</label><input id="l-jm" type="number" min="1" value="${L.joursMax}"></div></div>
      <div class="fld"><label>Jours fermés (AAAA-MM-JJ, un par ligne)</label><textarea id="l-jf" rows="2" placeholder="2026-12-25">${esc((L.joursFermes || []).join('\n'))}</textarea></div>
      <div class="fld"><label>Délai d’expédition affiché</label><input id="l-de" value="${esc(L.delaiExpedition || '')}"></div></div>
    <div class="card"><div class="card-t">Expédition — tapis & pantoufles (par quantité)</div><p class="hint" style="margin-bottom:8px">« À partir de N articles → prix ». Ex. 1 → 1 000 F, 3 → 1 500 F…</p>
      <div id="tp">${L.tapisPaliers.map(p => palRow('tp', p.min, p.prix, 'À partir de', 'article(s)')).join('')}</div><button class="btn sm line" onclick="$('tp').insertAdjacentHTML('beforeend',palRow('tp','','','À partir de','article(s)'))">+ Palier</button></div>
    <div class="card"><div class="card-t">Expédition — casseroles & colis (par distance)</div><p class="hint" style="margin-bottom:8px">« Jusqu’à N km → prix ». Le dernier palier couvre tout le reste (mettez 100000).</p>
      <div id="cp">${L.colisPaliers.map(p => palRow('cp', p.jusqua, p.prix, 'Jusqu’à', 'km')).join('')}</div><button class="btn sm line" onclick="$('cp').insertAdjacentHTML('beforeend',palRow('cp','','','Jusqu’à','km'))">+ Palier</button></div>
    <div class="card"><div class="card-t">Villes (distance approximative depuis Abidjan)</div><p class="hint" style="margin-bottom:8px">Une ville par ligne : <b>Nom ; km</b>. Les distances fournies sont approximatives : ajustez-les.</p>
      <textarea id="l-v" class="in" rows="12">${esc(L.villes.map(v => v.nom + ' ; ' + v.km).join('\n'))}</textarea></div>
    <div class="card"><div class="card-t">International (forfait)</div><p class="hint" style="margin-bottom:8px">Prix 0 = frais à la charge du client (affiche la note).</p>
      <div id="intl">${L.international.map(i => intlRow(i)).join('')}</div><button class="btn sm line" onclick="$('intl').insertAdjacentHTML('beforeend',intlRow({pays:'',prix:0,note:''}))">+ Pays</button></div>
  </div><div class="mfoot"><button class="btn big" onclick="saveLivraison()">Enregistrer les tarifs</button></div>`;
}
const zoneRow = z => `<div class="row zr" style="align-items:center;margin-bottom:8px"><input type="hidden" class="z-id" value="${esc(z.id)}"><div class="fld" style="flex:2;margin:0"><input class="z-nom" value="${esc(z.nom)}" placeholder="Nom"><input class="z-ex" value="${esc(z.exemples || '')}" placeholder="Exemples de quartiers" style="margin-top:4px;font-size:12.5px"></div><div class="fld" style="max-width:120px;margin:0"><input class="z-px" type="number" value="${z.prix}" placeholder="Prix"></div><button class="btn sm ghost" onclick="this.parentNode.remove()">×</button></div>`;
const palRow = (k, a, p, l1, l2) => `<div class="row ${k}" style="align-items:center;margin-bottom:6px"><span class="hint">${l1}</span><input class="in a" style="width:100px" type="number" value="${a}"><span class="hint">${l2} →</span><input class="in p" style="width:110px" type="number" value="${p}"><span class="hint">F</span><button class="btn sm ghost" onclick="this.parentNode.remove()">×</button></div>`;
const intlRow = i => `<div class="row ir" style="align-items:center;margin-bottom:6px"><input class="in pa" style="flex:1" value="${esc(i.pays)}" placeholder="Pays"><input class="in px" style="width:110px" type="number" value="${i.prix}"><input class="in no" style="flex:2" value="${esc(i.note || '')}" placeholder="Note affichée"><button class="btn sm ghost" onclick="this.parentNode.remove()">×</button></div>`;
async function saveLivraison() {
  const q = s => [...document.querySelectorAll(s)];
  const body = {
    zones: q('.zr').map(r => ({ id: r.querySelector('.z-id').value || r.querySelector('.z-nom').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20), nom: r.querySelector('.z-nom').value, exemples: r.querySelector('.z-ex').value, prix: Number(r.querySelector('.z-px').value) })),
    tapisPaliers: q('.tp').map(r => ({ min: Number(r.querySelector('.a').value), prix: Number(r.querySelector('.p').value) })).filter(x => x.min),
    colisPaliers: q('.cp').map(r => ({ jusqua: Number(r.querySelector('.a').value), prix: Number(r.querySelector('.p').value) })).filter(x => x.jusqua),
    international: q('.ir').map(r => ({ pays: r.querySelector('.pa').value, prix: Number(r.querySelector('.px').value), note: r.querySelector('.no').value })),
    villes: $('l-v').value.split('\n').map(l => { const [n, k] = l.split(';'); return { nom: (n || '').trim(), km: Number(k) }; }).filter(v => v.nom),
    creneaux: $('l-cr').value.split('\n').map(s => s.trim()).filter(Boolean), jours: q('.l-j').filter(c => c.checked).map(c => Number(c.value)),
    delaiHeures: Number($('l-dh').value), joursMax: Number($('l-jm').value), joursFermes: $('l-jf').value.split('\n').map(s => s.trim()).filter(Boolean), delaiExpedition: $('l-de').value
  };
  try { const r = await api('/api/admin/livraison', { method: 'PUT', body }); D.settings = r.settings; render(true); toast('Tarifs enregistrés ✓', 'La boutique calcule déjà avec les nouveaux tarifs.'); } catch (e) { toast('Erreur', e.message, true); }
}

// =====================================================================
// PAIEMENTS
// =====================================================================
function pPaiements() {
  const P = D.settings.paiement, aV = D.commandes.filter(c => c.paiement.statut === 'declare' && c.statut !== 'annulee');
  const url = `${location.origin}/api/sms?cle=${P.smsCle}`;
  return `<div class="ph-t"><div><div class="h">Paiements</div><p>Mobile Money en direct, sans agrégateur : le client envoie l’argent sur VOS numéros, saisit la référence, vous validez (ou la passerelle SMS valide pour vous).</p></div><button class="btn" onclick="savePaiement()">Enregistrer</button></div>
  ${aV.length ? `<div class="card" style="box-shadow:0 0 0 2px var(--orange)"><div class="card-t">À vérifier maintenant (${aV.length})</div><div class="ocs">${aV.map(ocard).join('')}</div></div>` : ''}
  <div class="grid2" style="margin-top:14px">
    <div class="card"><div class="card-t">Vos comptes de réception</div>
      ${Object.keys(P.modes).map(k => { const m = P.modes[k]; return `<div class="card" style="background:var(--fond);margin-bottom:10px" data-m="${k}"><div class="card-t" style="margin-bottom:8px">${esc(m.nom)}<span class="sw ${m.actif ? 'on' : ''}" onclick="this.classList.toggle('on')"></span></div>
        <div class="row"><div class="fld"><label>Numéro</label><input class="m-num" value="${esc(m.numero)}" placeholder="07 00 00 00 00"></div><div class="fld"><label>Titulaire affiché</label><input class="m-tit" value="${esc(m.titulaire)}"></div></div>
        <div class="row"><div class="fld"><label>Code USSD</label><input class="m-ussd" value="${esc(m.ussd)}" placeholder="facultatif"></div><div class="fld" style="flex:2"><label>Lien de paiement marchand (facultatif)</label><input class="m-lien" value="${esc(m.lien)}" placeholder="https://…{montant}"></div></div></div>`; }).join('')}
      <p class="hint">Lien marchand : si votre opérateur vous fournit un lien de paiement (ex. Wave Business), collez-le ; <b>{montant}</b> est remplacé par le total. Vérifiez les codes USSD avec votre opérateur.</p>
      <label class="swl" style="margin-top:12px"><span class="sw ${P.livraisonCash ? 'on' : ''}" id="p-cash" onclick="this.classList.toggle('on')"></span>Autoriser le paiement à la livraison / en boutique (jamais pour l’expédition)</label>
      <div class="fld" style="margin-top:10px"><label>Consignes affichées au client</label><textarea id="p-cons" rows="3">${esc(P.consignes)}</textarea></div></div>
    <div><div class="card"><div class="card-t">🔒 Sécurité des paiements</div>
      <ul class="hint" style="padding-left:18px;display:grid;gap:6px"><li>Le site ne touche jamais l’argent : il va directement sur vos comptes. Aucun code secret n’est demandé au client.</li><li>Le montant est recalculé par le serveur (impossible de modifier un prix depuis le téléphone).</li><li>Chaque référence de transaction ne peut servir qu’une fois.</li><li>Les captures de reçu ne sont visibles que dans cet espace gestion.</li><li>Une commande « Expédition » ne peut pas passer en « Expédiée » sans paiement validé.</li><li>Ne validez qu’après avoir vu l’argent sur votre compte ou le SMS de l’opérateur.</li></ul></div>
    <div class="card"><div class="card-t">⚡ Passerelle SMS (validation automatique)</div>
      <p class="hint">Facultatif. Installez sur le téléphone qui reçoit les SMS de paiement une application Android de transfert de SMS vers une adresse web (ex. « SMS Forwarder »), et indiquez cette adresse (méthode POST, champ du texte : <b>texte</b>, <b>message</b> ou <b>body</b>) :</p>
      <div class="fld" style="margin-top:8px"><input value="${esc(url)}" readonly onclick="this.select()"></div>
      <div class="row"><button class="btn sm line" onclick="navigator.clipboard.writeText('${esc(url)}').then(()=>toast('Adresse copiée'))">Copier</button><button class="btn sm line" onclick="if(confirm('Générer une nouvelle clé ? L’ancienne adresse ne fonctionnera plus.'))api('/api/admin/paiement',{method:'PUT',body:{nouvelleCleSms:true}}).then(r=>{D.settings=r.settings;render(true)})">Nouvelle clé</button>
        <label class="swl"><span class="sw ${P.smsAuto ? 'on' : ''}" id="p-auto" onclick="this.classList.toggle('on')"></span>Valider automatiquement</label></div>
      <p class="hint" style="margin-top:6px">Quand un SMS contient la référence déclarée par le client et un montant suffisant, la commande passe « Payé » toute seule. Gardez l’adresse secrète.</p>
      <div class="sec-t">Derniers SMS reçus</div>
      ${D.smsLog.length ? D.smsLog.slice(0, 15).map(s => `<div style="padding:8px 0;border-bottom:1px solid var(--fond);font-size:13px"><b>${esc(s.de || 'SMS')}</b> · ${fdt(s.at)} ${s.montant ? '· <b>' + F(s.montant) + '</b>' : ''} ${s.commandeId ? `<span class="badge vert">commande ${(D.commandes.find(c => c.id === s.commandeId) || {}).numero || ''}</span>` : `<button class="btn sm line" onclick="associerSms(${s.id})">Associer</button>`}<div class="hint">${esc(s.texte)}</div></div>`).join('') : '<p class="hint">Aucun SMS reçu pour l’instant.</p>'}</div></div>
  </div>`;
}
async function savePaiement() {
  const modes = {}; document.querySelectorAll('[data-m]').forEach(c => { modes[c.dataset.m] = { actif: c.querySelector('.sw').classList.contains('on'), numero: c.querySelector('.m-num').value, titulaire: c.querySelector('.m-tit').value, ussd: c.querySelector('.m-ussd').value, lien: c.querySelector('.m-lien').value }; });
  try { const r = await api('/api/admin/paiement', { method: 'PUT', body: { modes, livraisonCash: $('p-cash').classList.contains('on'), consignes: $('p-cons').value, smsAuto: $('p-auto').classList.contains('on') } }); D.settings = r.settings; render(true); toast('Paiements enregistrés ✓'); }
  catch (e) { toast('Erreur', e.message, true); }
}
function associerSms(id) {
  const L = D.commandes.filter(c => ['declare', 'en_attente'].includes(c.paiement.statut) && c.statut !== 'annulee');
  if (!L.length) return toast('Aucune commande en attente de paiement');
  openModal(`<div class="mt h">Associer ce SMS à une commande</div><div class="fld"><select id="as-c">${L.map(c => `<option value="${c.id}">N°${c.numero} — ${esc(c.clientNom)} — ${F(c.total)}${c.paiement.reference ? ' — réf. ' + esc(c.paiement.reference) : ''}</option>`).join('')}</select></div>
    <div class="mfoot"><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn vert" onclick="api('/api/admin/sms/${id}/associer',{body:{commandeId:$('as-c').value}}).then(()=>reload()).then(()=>{closeModal();toast('Paiement validé ✓')}).catch(e=>toast('Erreur',e.message,true))">Valider le paiement</button></div>`);
}

// =====================================================================
// LIVREURS, DISCUSSIONS, DEVIS, AVIS, CLIENTS
// =====================================================================
function pLivreurs() {
  return `<div class="ph-t"><div><div class="h">Livreurs</div><p>Chaque course a son propre lien sécurisé : le livreur n’a pas besoin de compte.</p></div></div>
  <div class="grid2"><div class="card"><div class="card-t">Équipe</div>${D.livreurs.length ? D.livreurs.map(l => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--fond)"><b style="flex:1">${esc(l.nom)}</b><span>${esc(l.tel)}</span>${l.tel ? `<a class="btn sm wa" target="_blank" href="${wa(l.tel)}">WhatsApp</a>` : ''}<button class="btn sm ghost" onclick="api('/api/admin/livreurs/${l.id}/delete',{body:{}}).then(()=>{D.livreurs=D.livreurs.filter(x=>x.id!==${l.id});render(true)})">×</button></div>`).join('') : '<p class="hint">Aucun livreur.</p>'}</div>
  <div class="card"><div class="card-t">Ajouter un livreur</div><div class="fld"><label>Nom</label><input id="lv-n"></div><div class="fld"><label>Téléphone</label><input id="lv-t" type="tel"></div><button class="btn" onclick="api('/api/admin/livreurs',{body:{nom:$('lv-n').value,tel:$('lv-t').value}}).then(r=>{D.livreurs.push(r.livreur);render(true)}).catch(e=>toast('Erreur',e.message,true))">Ajouter</button>
    <p class="hint" style="margin-top:12px">Pendant la course, le livreur : partage sa position (le client le voit sur la carte), signale « j’arrive » (le client est averti qu’il est à quelques pas — c’est aussi automatique à 350 m si le client a partagé sa position), discute avec le client, puis valide « livré ».</p></div></div>`;
}
function pDiscussions() {
  const ids = [...new Set(D.chats.map(m => m.clientId))];
  const convs = ids.map(id => { const ms = D.chats.filter(m => m.clientId === id); return { id, c: D.clients.find(x => x.id === id) || { nom: 'Client', tel: '' }, last: ms[ms.length - 1], nl: ms.filter(m => m.de === 'client' && !m.lu).length }; }).sort((a, b) => b.last.at.localeCompare(a.last.at));
  if (!CHAT_SEL && convs[0]) CHAT_SEL = convs[0].id;
  const sel = convs.find(x => x.id === CHAT_SEL);
  if (sel && sel.nl) { api(`/api/admin/chat/${sel.id}/lu`, { body: {} }).catch(() => { }); D.chats.forEach(m => { if (m.clientId === sel.id) m.lu = true; }); }
  return `<div class="ph-t"><div><div class="h">Discussions</div><p>Les clients voient « en ligne » quand cette page est ouverte.</p></div></div>
  ${convs.length ? `<div class="chatlist"><div class="card" style="padding:8px">${convs.map(x => `<div class="cl-item ${x.id === CHAT_SEL ? 'on' : ''}" onclick="CHAT_SEL=${x.id};render(true)"><div class="thumb" style="border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:800;background:var(--orangep)">${esc((x.c.nom || '?')[0])}</div><div style="flex:1;min-width:0"><b>${esc(x.c.nom || 'Client')}</b><div class="hint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.last.texte)}</div></div>${x.nl ? `<span class="cnt">${x.nl}</span>` : ''}</div>`).join('')}</div>
    <div class="card">${sel ? `<div class="card-t">${esc(sel.c.nom)} <span class="row">${sel.c.tel ? `<a class="btn sm wa" target="_blank" href="${wa(sel.c.tel)}">WhatsApp</a>` : ''}</span></div>
      <div class="msgs" id="msgs">${D.chats.filter(m => m.clientId === sel.id).map(m => `<div class="msg ${m.de === 'client' ? 'them' : 'me'}">${esc(m.texte)}<small>${fdt(m.at)}</small></div>`).join('')}</div>
      <div class="row" style="margin-top:10px">${['Bonjour ! Oui, il est disponible.', 'Nous livrons aujourd’hui.', 'Je vous envoie les photos sur WhatsApp.', 'Merci pour votre commande !'].map(t => `<button class="btn sm ghost" onclick="$('rep').value='${t.replace(/'/g, '’')}'">${t}</button>`).join('')}</div>
      <div class="row" style="margin-top:8px"><input class="in" id="rep" style="flex:1" placeholder="Votre réponse…" onkeydown="if(event.key==='Enter')repondre(${sel.id})"><button class="btn" onclick="repondre(${sel.id})">Envoyer</button></div>` : ''}</div></div>`
    : `<div class="card empty">Aucune discussion pour l’instant.</div>`}`;
}
async function repondre(id) { const t = $('rep').value.trim(); if (!t) return; try { const r = await api('/api/admin/chat/' + id, { body: { texte: t } }); upsert(D.chats, r.message); render(true); } catch (e) { toast('Erreur', e.message, true); } }
function pDevis() {
  const L = D.devis.slice().reverse();
  const S = { nouveau: ['Nouvelle', 'orange'], propose: ['Proposition envoyée', 'bleu'], accepte: ['Acceptée', 'vert'], refuse: ['Refusée', 'rouge'], termine: ['Terminée', ''] };
  return `<div class="ph-t"><div><div class="h">Devis & personnalisation</div><p>Le client reçoit votre proposition par notification et l’accepte depuis l’application.</p></div></div>
  ${L.length ? L.map(d => `<div class="card"><div class="card-t">${esc(d.type)} — ${esc(d.nom)} <span class="badge ${S[d.statut][1]}">${S[d.statut][0]}</span></div>
    <div class="grid2"><div><p>${esc(d.description)}</p><p class="hint" style="margin-top:6px">${d.produit ? 'Article : ' + esc(d.produit) + ' · ' : ''}Quantité : ${d.quantite}${d.date ? ' · pour le ' + dmy(d.date) : ''}${d.budget ? ' · budget ' + F(d.budget) : ''} · ${fdt(d.at)}</p>
      <div class="row" style="margin-top:8px"><a class="btn sm wa" target="_blank" href="${wa(d.tel, 'Bonjour ' + d.nom.split(' ')[0] + ', c’est Tawali Souk au sujet de votre demande : ' + d.type)}">WhatsApp ${esc(d.tel)}</a></div>
      ${d.image ? `<img src="${esc(d.image)}" style="max-width:200px;border-radius:12px;margin-top:10px">` : ''}</div>
    <div>${['nouveau', 'propose'].includes(d.statut) ? `<div class="fld"><label>Montant proposé (F)</label><input id="dv-m-${d.id}" type="number" value="${d.montant || ''}"></div><div class="fld"><label>Message</label><textarea id="dv-r-${d.id}" rows="3">${esc(d.reponse || '')}</textarea></div>
      <div class="row"><button class="btn" onclick="repDevis(${d.id},'propose')">Envoyer la proposition</button><button class="btn line" onclick="repDevis(${d.id},'refuse')">Décliner</button></div>` : `<p><b>${F(d.montant)}</b></p><p class="hint">${esc(d.reponse)}</p>${d.statut === 'accepte' ? `<button class="btn sm line" style="margin-top:8px" onclick="repDevis(${d.id},'termine')">Marquer terminé</button>` : ''}`}</div></div></div>`).join('') : `<div class="card empty">Aucune demande de devis.</div>`}`;
}
async function repDevis(id, statut) {
  const body = { statut }; const m = $('dv-m-' + id), r = $('dv-r-' + id); if (m) body.montant = Number(m.value); if (r) body.reponse = r.value;
  if (statut === 'propose' && !body.montant) return toast('Indiquez un montant', '', true);
  try { const x = await api('/api/admin/devis/' + id, { body }); upsert(D.devis, x.devis); render(true); toast('Envoyé ✓', 'Le client est notifié.'); } catch (e) { toast('Erreur', e.message, true); }
}
function pAvis() {
  const L = D.commandes.filter(c => c.avis).slice().reverse();
  const moy = L.length ? (L.reduce((s, c) => s + c.avis.noteAchat, 0) / L.length).toFixed(1) : '—';
  const reco = L.length ? Math.round(L.filter(c => c.avis.recommande).length / L.length * 100) : 0;
  return `<div class="ph-t"><div><div class="h">Avis clients</div><p>Les avis sont publiés sur les fiches produits avec le prénom du client. Les suggestions restent privées.</p></div></div>
  <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi nuit"><div class="l">Note moyenne</div><div class="v">${moy} ★</div></div><div class="kpi"><div class="l">Recommandent</div><div class="v">${reco} %</div></div><div class="kpi"><div class="l">Avis</div><div class="v">${L.length}</div></div></div>
  ${L.length ? `<div class="card"><table class="tbl"><tr><th>Client</th><th>Achat</th><th>Livraison</th><th>Avis</th><th>Suggestion (privée)</th><th>Publié</th></tr>${L.map(c => `<tr><td><b>${esc(c.clientNom)}</b><div class="hint">n°${c.numero} · ${fdt(c.avis.at)}</div></td><td>${'★'.repeat(c.avis.noteAchat)}</td><td>${c.avis.noteLivraison ? '★'.repeat(c.avis.noteLivraison) : '—'}</td><td>${esc(c.avis.commentaire)}${c.avis.recommande ? ' <span class="badge vert">recommande</span>' : ''}</td><td class="hint">${esc(c.avis.suggestion || '')}</td>
    <td><span class="sw ${c.avis.masque ? '' : 'on'}" onclick="api('/api/admin/commandes/${c.id}/avis',{body:{masque:${!c.avis.masque}}}).then(r=>{upsert(D.commandes,r.commande);render(true)})"></span></td></tr>`).join('')}</table></div>` : `<div class="card empty">Les avis arrivent après chaque livraison.</div>`}`;
}
function pClients() {
  const L = D.clients.slice().reverse();
  const stats = id => { const cs = D.commandes.filter(c => c.clientId === id && c.statut !== 'annulee'); return { n: cs.length, t: cs.reduce((s, c) => s + c.total, 0) }; };
  return `<div class="ph-t"><div><div class="h">Clients</div><p>${L.length} client(s) · ${D.abonnes || 0} appareil(s) abonné(s) aux notifications.</p></div></div>
  <div class="card tbl-wrap"><table class="tbl"><tr><th>Client</th><th>Téléphone</th><th>Commandes</th><th class="num">Total</th><th>Points</th><th>Compte</th><th></th></tr>
  ${L.map(c => { const s = stats(c.id); return `<tr><td><b>${esc(c.nom || '—')}</b><div class="hint">depuis ${fdate(c.createdAt)}</div></td><td>${esc(c.tel)}</td><td>${s.n}</td><td class="num">${F(s.t)}</td><td>${c.points || 0}</td><td>${c.invite ? '<span class="badge">Sans compte</span>' : '<span class="badge vert">Compte</span>'} ${c.push ? '<span class="badge bleu">🔔</span>' : ''}</td><td>${c.tel ? `<a class="btn sm wa" target="_blank" href="${wa(c.tel)}">WhatsApp</a>` : ''}</td></tr>`; }).join('')}</table></div>`;
}

// =====================================================================
// NOTIFICATIONS
// =====================================================================
function pMessages() {
  return `<div class="ph-t"><div><div class="h">Notifications aux clients</div><p>${D.abonnes || 0} appareil(s) abonné(s). Les nouveautés et prix cassés peuvent aussi être notifiés depuis la fiche produit.</p></div></div>
  <div class="grid2"><div class="card"><div class="card-t">Envoyer maintenant</div>
    <div class="fld"><label>Titre</label><input id="an-t" placeholder="Arrivage du jour ✨"></div><div class="fld"><label>Message</label><textarea id="an-c" rows="3" placeholder="Les nouveaux sets granité sont arrivés…"></textarea></div>
    <div class="row"><div class="fld"><label>Ouvrir au clic</label><select id="an-u"><option value="">Accueil</option>${D.produits.map(p => `<option value="/?p=${p.id}">${esc(p.nom)}</option>`).join('')}</select></div><div class="fld"><label>Image</label><input type="file" accept="image/*" onchange="uploadImage(this.files[0],1200).then(u=>{window._anImg=u;toast('Image prête')})"></div></div>
    <p class="hint" style="margin-bottom:10px">Variables : {boutique}, {promos}</p><button class="btn" onclick="envoyerAnnonce()">Envoyer à tous</button></div>
  <div class="card"><div class="card-t">Messages programmés <button class="btn sm line" onclick="editProg()">+ Programmer</button></div>
    ${D.programmes.map(p => `<div style="padding:10px 0;border-bottom:1px solid var(--fond);display:flex;gap:10px;align-items:center"><span class="sw ${p.actif ? 'on' : ''}" onclick="api('/api/admin/programmes/${p.id}',{method:'PUT',body:{actif:${!p.actif}}}).then(r=>{upsert(D.programmes,r.programme);render(true)})"></span><div style="flex:1"><b>${esc(p.titre)}</b><div class="hint">${p.heure} · ${p.jours.map(j => JOURS[j]).join(', ')}</div></div><button class="btn sm ghost" onclick="api('/api/admin/programmes/${p.id}/envoyer',{body:{}}).then(r=>toast('Envoyé',r.pushes+' appareil(s)'))">Envoyer</button><button class="btn sm ghost" onclick="editProg(${p.id})">Modifier</button></div>`).join('') || '<p class="hint">Aucun.</p>'}</div></div>
  <div class="card"><div class="card-t">Historique</div>${D.annonces.map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--fond)"><b>${esc(a.titre)}</b> <span class="hint">${fdt(a.at)}</span><div class="hint">${esc(a.corps)}</div></div>`).join('') || '<p class="hint">Rien d’envoyé pour l’instant.</p>'}</div>`;
}
async function envoyerAnnonce() {
  try { const r = await api('/api/admin/annonces', { body: { titre: $('an-t').value, corps: $('an-c').value, url: $('an-u').value, image: window._anImg || '' } }); D.annonces.unshift(r.annonce); window._anImg = ''; render(true); toast('Envoyé ✓', `${r.pushes} appareil(s) notifié(s), ${r.enLigne} connecté(s).`); } catch (e) { toast('Erreur', e.message, true); }
}
function editProg(id) {
  const p = id ? D.programmes.find(x => x.id === id) : { titre: '', corps: '', heure: '10:00', jours: [1, 2, 3, 4, 5, 6] };
  openModal(`<div class="mt h">Message programmé</div><div class="fld"><label>Titre</label><input id="pg-t" value="${esc(p.titre)}"></div><div class="fld"><label>Message</label><textarea id="pg-c">${esc(p.corps)}</textarea></div>
    <div class="row"><div class="fld"><label>Heure</label><input id="pg-h" type="time" value="${p.heure}"></div><div class="fld"><label>Jours</label><div class="row">${JOURS.map((j, i) => `<label><input type="checkbox" class="pg-j" value="${i}" ${p.jours.includes(i) ? 'checked' : ''}> ${j}</label>`).join(' ')}</div></div></div>
    <div class="mfoot">${id ? `<button class="btn line" style="color:var(--rouge);margin-right:auto" onclick="api('/api/admin/programmes/${id}/delete',{body:{}}).then(()=>{D.programmes=D.programmes.filter(x=>x.id!==${id});closeModal();render(true)})">Supprimer</button>` : ''}<button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="saveProg(${id || 0})">Enregistrer</button></div>`);
}
async function saveProg(id) {
  const body = { titre: $('pg-t').value, corps: $('pg-c').value, heure: $('pg-h').value, jours: [...document.querySelectorAll('.pg-j')].filter(c => c.checked).map(c => Number(c.value)), actif: true };
  try { const r = id ? await api('/api/admin/programmes/' + id, { method: 'PUT', body }) : await api('/api/admin/programmes', { body }); upsert(D.programmes, r.programme); closeModal(); render(true); } catch (e) { toast('Erreur', e.message, true); }
}

// =====================================================================
// RÉGLAGES
// =====================================================================
function pReglages() {
  const b = D.settings.boutique, ia = D.settings.ia, f = D.settings.fidelite;
  const fld = (k, l, ph) => `<div class="fld"><label>${l}</label><input id="b-${k}" value="${esc(b[k] || '')}" placeholder="${esc(ph || '')}"></div>`;
  return `<div class="ph-t"><div><div class="h">Réglages</div></div></div>
  <div class="grid2">
    <div class="card"><div class="card-t">La boutique</div>
      <div class="row">${fld('nom', 'Nom')}${fld('tel', 'Téléphone affiché')}</div>${fld('slogan', 'Slogan')}
      <div class="row">${fld('whatsapp', 'WhatsApp (avec indicatif)', '2250711615439')}${fld('email', 'E-mail')}</div>
      ${fld('adresse', 'Adresse de la boutique')}${fld('horaires', 'Horaires')}${fld('bandeau', 'Bandeau défilant (haut de page)')}
      <div class="row"><div class="fld"><label>Latitude</label><input id="b-lat" value="${b.lat}"></div><div class="fld"><label>Longitude</label><input id="b-lng" value="${b.lng}"></div><button class="btn line" style="margin-bottom:12px" onclick="maPosition()">📍 Ma position</button></div>
      <p class="hint" style="margin:-4px 0 10px">Depuis la boutique, touchez « Ma position » pour placer exactement le point sur la carte des clients.</p>
      ${fld('yango', 'Lien Yango ({lat} et {lng} sont remplacés)')}
      <p class="hint" style="margin:-4px 0 10px">Testez le bouton « Commander un Yango » sur un téléphone où Yango est installé ; si besoin, collez ici le lien de partage de votre position depuis l’application Yango.</p>
      <div class="row">${fld('facebook', 'Facebook')}${fld('instagram', 'Instagram')}${fld('tiktok', 'TikTok')}</div>
      <button class="btn" onclick="saveBoutique()">Enregistrer</button></div>
    <div>
      <div class="card"><div class="card-t">✨ Intelligence artificielle</div>
        <p class="hint" style="margin-bottom:10px">L’IA (Claude, d’Anthropic) rédige les fiches produits à partir de vos photos et anime l’assistante « Awa » côté clients. Sans clé, Awa répond quand même aux questions simples (tarifs, paiement, recherche d’articles).</p>
        <div class="fld"><label>Clé API Anthropic ${ia.cleDefinie ? '<span class="badge vert">configurée</span>' : '<span class="badge jaune">non configurée</span>'}</label><input id="ia-cle" type="password" placeholder="${ia.cleEnv ? 'Définie sur le serveur (ANTHROPIC_API_KEY)' : 'sk-ant-…'}" autocomplete="off"></div>
        <div class="fld"><label>Modèle</label><input id="ia-mod" value="${esc(ia.modele)}"></div>
        <label class="swl"><span class="sw ${ia.assistant ? 'on' : ''}" id="ia-as" onclick="this.classList.toggle('on')"></span>Assistante Awa visible pour les clients</label>
        <p class="hint" style="margin-top:8px">Clé à créer sur console.anthropic.com (paiement à l’usage, quelques francs par fiche). Elle reste sur le serveur et n’est jamais envoyée aux clients.</p>
        <div class="row" style="margin-top:10px"><button class="btn" onclick="saveIA()">Enregistrer</button>${ia.cleDefinie && !ia.cleEnv ? `<button class="btn line" onclick="api('/api/admin/ia',{method:'PUT',body:{effacerCle:true}}).then(r=>{D.settings=r.settings;render(true)})">Effacer la clé</button>` : ''}</div></div>
      <div class="card"><div class="card-t">Fidélité <span class="sw ${f.actif ? 'on' : ''}" id="f-a" onclick="this.classList.toggle('on')"></span></div>
        <div class="row"><div class="fld"><label>Points par 1 000 F</label><input id="f-p" type="number" value="${f.pointsParMille}"></div><div class="fld"><label>Valeur d’un point (F)</label><input id="f-v" type="number" value="${f.valeurPoint}"></div><div class="fld"><label>Seuil d’utilisation</label><input id="f-s" type="number" value="${f.seuilPoints}"></div></div>
        <button class="btn" onclick="api('/api/admin/fidelite',{method:'PUT',body:{actif:$('f-a').classList.contains('on'),pointsParMille:$('f-p').value,valeurPoint:$('f-v').value,seuilPoints:$('f-s').value}}).then(r=>{D.settings=r.settings;toast('Enregistré ✓')})">Enregistrer</button></div>
      <div class="card"><div class="card-t">Sécurité</div>
        <div class="fld"><label>Mot de passe actuel</label><input id="s-cur" type="password"></div>
        <div class="row"><div class="fld"><label>Nouvel identifiant</label><input id="s-u" value="${esc(D.settings.adminUser)}"></div><div class="fld"><label>Nouveau mot de passe</label><input id="s-p" type="password"></div></div>
        <div class="fld"><label>Nouveau code de suppression</label><input id="s-d" type="password"></div>
        <button class="btn nuit" onclick="api('/api/admin/securite',{body:{currentPassword:$('s-cur').value,newUsername:$('s-u').value,newPassword:$('s-p').value,newDeleteCode:$('s-d').value}}).then(()=>toast('Sécurité mise à jour ✓')).catch(e=>toast('Erreur',e.message,true))">Mettre à jour</button></div>
    </div></div>`;
}
function maPosition() { navigator.geolocation.getCurrentPosition(p => { $('b-lat').value = p.coords.latitude.toFixed(6); $('b-lng').value = p.coords.longitude.toFixed(6); toast('Position récupérée', 'Pensez à enregistrer.'); }, () => toast('Position refusée', '', true), { enableHighAccuracy: true }); }
async function saveBoutique() {
  const body = {}; ['nom', 'tel', 'slogan', 'whatsapp', 'email', 'adresse', 'horaires', 'bandeau', 'lat', 'lng', 'yango', 'facebook', 'instagram', 'tiktok'].forEach(k => body[k] = $('b-' + k).value);
  try { const r = await api('/api/admin/boutique', { method: 'PUT', body }); D.settings = r.settings; toast('Boutique enregistrée ✓'); } catch (e) { toast('Erreur', e.message, true); }
}
async function saveIA() {
  try { const r = await api('/api/admin/ia', { method: 'PUT', body: { cle: $('ia-cle').value, modele: $('ia-mod').value, assistant: $('ia-as').classList.contains('on') } }); D.settings = r.settings; render(true); toast('IA enregistrée ✓'); } catch (e) { toast('Erreur', e.message, true); }
}
