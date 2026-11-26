/**
 * TAWALI SOUK — serveur de la boutique en ligne
 * -----------------------------------------------------------
 * Aucune dépendance externe : uniquement les modules intégrés à Node.js
 * (même architecture que la plateforme restaurant et Coach AMAVIE).
 *
 *  /               -> BOUTIQUE (application client installable)
 *  /gestion.html   -> ESPACE GESTION (produits, prix, promos, commandes,
 *                     vérification des paiements, livraisons, IA…)
 *  /livreur.html   -> page du LIVREUR (GPS, « j'arrive », discussion, livré)
 *
 * Temps réel : Server-Sent Events + notifications Web Push (VAPID / RFC 8291,
 * faits avec le module crypto). IA : API Claude d'Anthropic (clé optionnelle).
 *
 * Variables d'environnement (optionnelles) :
 *   PORT, DATA_FILE (ex. /data/data.json), ANTHROPIC_API_KEY
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { URLSearchParams } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data.json');
const DATA_DIR = path.dirname(DATA_FILE);
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PROOF_DIR = path.join(DATA_DIR, 'preuves'); // captures de paiement : visibles seulement par la gestion
const BACKUP_DIR = path.join(DATA_DIR, 'sauvegardes');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

// ============================================================
// OUTILS
// ============================================================
const makeSalt = () => crypto.randomBytes(16).toString('hex');
const hashSecret = (v, salt) => crypto.scryptSync(String(v), salt, 64).toString('hex');
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function randomCode(len, chars) {
  chars = chars || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < len; i++) s += chars[crypto.randomInt(chars.length)]; return s;
}
const uid = () => crypto.randomBytes(5).toString('hex');
const num = (v, d) => { const n = Number(v); return isFinite(n) ? n : (d || 0); };
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 500);
const nowIso = () => new Date().toISOString();
const F = n => Math.round(n || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' F';
const normTel = t => String(t || '').replace(/[^\d+]/g, '');

function localParts(tz) {
  const d = new Date(); const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(d).forEach(x => { p[x.type] = x.value; });
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, weekday: wd };
}
const today = () => localParts(DB && DB.settings.boutique.fuseau).date;
function distanceM(a, b) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ============================================================
// BASE DE DONNÉES (en mémoire + fichier JSON)
// ============================================================
let DB = null;

function seedCatalogue(ids) {
  let seed = { categories: [], produits: [], textes: {} };
  try { seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed-catalogue.json'), 'utf8')); } catch (e) { }
  const categories = seed.categories.map(c => ({ id: ids.c++, cle: c.cle, nom: c.nom, sousTitre: c.sousTitre, couleur: c.couleur, image: '', ordre: c.ordre, actif: true }));
  const byKey = {}; categories.forEach(c => { byKey[c.cle] = c; });
  const t0 = Date.now();
  const produits = seed.produits.map((p, i) => {
    const t = seed.textes[p.cat] || {};
    return {
      id: ids.c++, ref: p.ref, nom: p.nom, categorieId: (byKey[p.cat] || categories[0] || {}).id, prix: p.prix || 0, promo: null,
      images: p.images, variantes: (p.variantes || []).map(v => ({ id: uid(), nom: v.nom, image: v.image, dispo: true })),
      stock: null, expedition: p.expedition, badge: p.badge || '', vedette: !!p.vedette, actif: true,
      desc: p.desc, points: p.points || [], bienfaits: (t.bienfaits || []).slice(), solution: t.solution || '', pourquoi: t.pourquoi || '',
      entretien: t.entretien || '', contenu: p.contenu || '', createdAt: new Date(t0 - i * 60000).toISOString(), ventes: 0
    };
  });
  return { categories, produits };
}

function defaultData() {
  const ids = { c: 1 };
  const cat = seedCatalogue(ids);
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  return {
    nextId: ids.c + 10, nextNumero: 1001,
    settings: {
      setupDone: false, adminUser: '', pwSalt: '', pwHash: '', delSalt: '', delHash: '',
      vapid: { publicKey: pub.toString('base64url'), privateJwk: jwk },
      adminPush: [],
      boutique: {
        nom: 'Tawali Souk', slogan: 'L’élégance au cœur de votre cuisine',
        tel: '07 11 61 54 39', whatsapp: '2250711615439', email: 'infos@acdees.com',
        adresse: 'Faya Génie 2000, Cocody — Abidjan', horaires: 'Lundi – samedi · 8 h – 19 h',
        lat: 5.3850, lng: -3.9280, ouvert: true, fuseau: 'Africa/Abidjan',
        yango: 'https://3.redirect.appmetrica.yandex.com/route?end-lat={lat}&end-lon={lng}&ref=tawalisouk&appmetrica_tracking_id=25395763362139037&lang=fr',
        bandeau: 'Livraison partout à Abidjan · Expédition dans toute la Côte d’Ivoire et à l’international',
        facebook: '', instagram: '', tiktok: ''
      },
      paiement: {
        livraisonCash: true,
        modes: {
          wave: { actif: true, nom: 'Wave', numero: '07 11 61 54 39', titulaire: 'Tawali Souk', lien: '', ussd: '' },
          orange_money: { actif: true, nom: 'Orange Money', numero: '07 11 61 54 39', titulaire: 'Tawali Souk', lien: '', ussd: '#144#' },
          mtn_momo: { actif: false, nom: 'MTN MoMo', numero: '', titulaire: 'Tawali Souk', lien: '', ussd: '*133#' },
          moov_money: { actif: false, nom: 'Moov Money', numero: '', titulaire: 'Tawali Souk', lien: '', ussd: '*155#' }
        },
        consignes: 'Envoyez exactement le montant indiqué, puis saisissez la référence (ID de transaction) reçue par SMS. Votre commande est confirmée dès que nous voyons le paiement.',
        smsCle: randomCode(24, 'abcdefghijkmnpqrstuvwxyz23456789'), smsAuto: true
      },
      livraison: {
        zones: [
          { id: 'cocody', nom: 'Cocody', exemples: 'Riviera, Angré, Faya, II Plateaux, Palmeraie, M’Badon…', prix: 1500 },
          { id: 'bingerville', nom: 'Bingerville', exemples: 'Bingerville et environs', prix: 1500 },
          { id: 'abidjan', nom: 'Autres communes d’Abidjan', exemples: 'Plateau, Marcory, Koumassi, Treichville, Yopougon, Abobo, Adjamé, Port-Bouët, Attécoubé…', prix: 2000 },
          { id: 'peripherie', nom: 'Hors Abidjan (proche)', exemples: 'Grand-Bassam, Anyama, Songon, Brofodoumé…', prix: 3000 },
          { id: 'loin', nom: 'Au-delà de Bassam', exemples: 'Assinie, Jacqueville, Bonoua…', prix: 5000 }
        ],
        villes: [
          ['Agboville', 80], ['Adzopé', 105], ['Aboisso', 120], ['Tiassalé', 120], ['Grand-Lahou', 140], ['Divo', 190], ['Bongouanou', 200], ['Toumodi', 200],
          ['Abengourou', 210], ['Yamoussoukro', 240], ['Dimbokro', 240], ['Agnibilékrou', 250], ['Daoukro', 260], ['Gagnoa', 270], ['Sassandra', 290],
          ['Sinfra', 300], ['Bouaflé', 300], ['San-Pédro', 340], ['Zuénoula', 340], ['Bouaké', 350], ['Issia', 360], ['Daloa', 380], ['Béoumi', 380], ['Tanda', 380],
          ['Katiola', 400], ['Soubré', 410], ['Bondoukou', 420], ['Tabou', 430], ['Mankono', 470], ['Duékoué', 500], ['Séguéla', 540], ['Guiglo', 540],
          ['Man', 580], ['Korhogo', 600], ['Ferkessédougou', 640], ['Boundiali', 700], ['Touba', 720], ['Odienné', 860]
        ].map(([nom, km]) => ({ nom, km })),
        tapisPaliers: [{ min: 1, prix: 1000 }, { min: 3, prix: 1500 }, { min: 5, prix: 2000 }, { min: 10, prix: 3000 }, { min: 15, prix: 3500 }, { min: 30, prix: 5000 }],
        colisPaliers: [{ jusqua: 299, prix: 2500 }, { jusqua: 300, prix: 3000 }, { jusqua: 500, prix: 3500 }, { jusqua: 100000, prix: 4000 }],
        international: [
          { pays: 'Burkina Faso', prix: 12000, note: '' }, { pays: 'Togo', prix: 15000, note: '' }, { pays: 'Mali', prix: 15000, note: '' },
          { pays: 'Sénégal', prix: 15000, note: '' }, { pays: 'France', prix: 0, note: 'Frais d’expédition à votre charge : nous remettons le colis au transporteur de votre choix.' }
        ],
        creneaux: ['08:00 – 10:00', '10:00 – 12:00', '12:00 – 14:00', '14:00 – 16:00', '16:00 – 18:00', '18:00 – 20:00'],
        jours: [1, 2, 3, 4, 5, 6], delaiHeures: 2, joursMax: 21, joursFermes: [],
        delaiExpedition: '24 à 72 h après confirmation du paiement'
      },
      ia: { cle: '', modele: 'claude-sonnet-5-5', assistant: true },
      fidelite: { actif: true, pointsParMille: 1, valeurPoint: 25, seuilPoints: 40 }
    },
    categories: cat.categories, produits: cat.produits,
    banners: [
      { id: ids.c++, image: '/catalogue/fff93202.jpg', titre: 'La collection *Royal Dessini*', texte: 'Granit moucheté, couvercles verre & inox. Le rouge, le prune et le bleu roi qui illuminent une cuisine.', lien: 'cat:granite', actif: true, ordre: 1 },
      { id: ids.c++, image: '/catalogue/7e665f48.jpg', titre: 'Émaillé *prestige*', texte: 'Motifs peints et finitions dorées : on cuisine, on sert, on reçoit.', lien: 'cat:emaille', actif: true, ordre: 2 },
      { id: ids.c++, image: '/catalogue/b21e5994.jpg', titre: 'Tapis qui *boivent l’eau*', texte: 'Absorbants et antidérapants. Expédition dès 1 000 F.', lien: 'cat:tapis', actif: true, ordre: 3 }
    ],
    commandes: [], clients: [], notifs: [], annonces: [], devis: [], chats: [], smsLog: [],
    livreurs: [], programmes: [
      { id: ids.c++, titre: 'Les prix cassés du jour', corps: 'Bonjour ! Découvrez les offres du moment chez {boutique} : {promos}.', heure: '10:00', jours: [6], actif: false, dernierEnvoi: '' }
    ]
  };
}

function loadDB() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }
  try { DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { DB = defaultData(); saveDB(); return; }
  const def = defaultData();
  for (const k of Object.keys(def)) if (DB[k] === undefined) DB[k] = def[k];
  for (const k of Object.keys(def.settings)) if (DB.settings[k] === undefined) DB.settings[k] = def.settings[k];
  ['boutique', 'paiement', 'livraison', 'ia', 'fidelite'].forEach(k => { DB.settings[k] = Object.assign({}, def.settings[k], DB.settings[k] || {}); });
  saveDB();
}
let saveTimer = null;
function saveDB() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(DB));
  fs.renameSync(tmp, DATA_FILE);
}
const nextId = () => DB.nextId++;
function backupIfNeeded() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const dest = path.join(BACKUP_DIR, `data-${new Date().toISOString().slice(0, 10)}.json`);
    if (!fs.existsSync(dest)) fs.copyFileSync(DATA_FILE, dest);
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('data-')).sort();
    while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  } catch (e) { console.error('Sauvegarde impossible :', e.message); }
}

// ============================================================
// SESSIONS + ANTI BRUTE-FORCE
// ============================================================
const sessions = new Map();
const SESSION_TTL = 12 * 3600 * 1000;
function parseCookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }); return out;
}
function getSession(req) {
  const sid = parseCookies(req).sid; const s = sid && sessions.get(sid);
  if (!s) return null;
  if (Date.now() > s.expires) { sessions.delete(sid); return null; }
  return s;
}
function setSessionCookie(req, res, sid, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
const attempts = new Map();
function rateOk(key, max, windowMs) {
  const now = Date.now(); const r = attempts.get(key);
  if (!r || now > r.resetAt) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  return ++r.count <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (now > s.expires) sessions.delete(k);
  for (const [k, r] of attempts) if (now > r.resetAt) attempts.delete(k);
}, 3600 * 1000);

// ============================================================
// TEMPS RÉEL (Server-Sent Events)
// ============================================================
const adminStreams = new Set();
const clientStreams = new Map();
const publicStreams = new Set();
function sseOpen(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
}
function sseSend(res, ev, data) { try { res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { } }
const toAdmin = (ev, d) => { for (const r of adminStreams) sseSend(r, ev, d); };
const toClient = (cid, ev, d) => { const s = clientStreams.get(cid); if (s) for (const r of s) sseSend(r, ev, d); };
const toAllClients = (ev, d) => { for (const s of clientStreams.values()) for (const r of s) sseSend(r, ev, d); for (const r of publicStreams) sseSend(r, ev, d); };
setInterval(() => {
  const ping = r => { try { r.write(': ping\n\n'); } catch (e) { } };
  adminStreams.forEach(ping); publicStreams.forEach(ping); for (const s of clientStreams.values()) s.forEach(ping);
}, 25000);

// ============================================================
// WEB PUSH (VAPID + aes128gcm)
// ============================================================
function vapidAuthHeader(endpoint) {
  const v = DB.settings.vapid; const aud = new URL(endpoint).origin;
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sub = 'mailto:' + (DB.settings.boutique.email || 'infos@acdees.com');
  const unsigned = b64({ typ: 'JWT', alg: 'ES256' }) + '.' + b64({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub });
  const key = crypto.createPrivateKey({ key: v.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `vapid t=${unsigned}.${sig}, k=${v.publicKey}`;
}
function encryptPush(sub, payload) {
  const uaPublic = Buffer.from(sub.keys.p256dh, 'base64url'), authSecret = Buffer.from(sub.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(), shared = ecdh.computeSecret(uaPublic);
  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const salt = crypto.randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header[20] = 65;
  return Buffer.concat([header, asPublic, ct]);
}
// holder : objet qui possède un tableau "push" (client ou réglages admin)
function sendPush(holder, payloadObj, key) {
  key = key || 'push';
  if (!holder || !holder[key] || !holder[key].length) return;
  const payload = JSON.stringify(payloadObj);
  holder[key].slice().forEach(sub => {
    let body, auth;
    try { body = encryptPush(sub, payload); auth = vapidAuthHeader(sub.endpoint); } catch (e) { return; }
    const u = new URL(sub.endpoint);
    const req = https.request({ method: 'POST', hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search,
      headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'Content-Length': body.length, TTL: '86400', Urgency: 'high', Authorization: auth } }, r => {
      r.resume();
      if (r.statusCode === 404 || r.statusCode === 410) { holder[key] = holder[key].filter(s => s.endpoint !== sub.endpoint); saveDB(); }
    });
    req.on('error', () => { }); req.setTimeout(10000, () => req.destroy()); req.end(body);
  });
}
const pushAdmin = (title, body, url) => sendPush(DB.settings, { title, body, tag: 'admin-' + Date.now(), url: url || '/gestion.html' }, 'adminPush');

function notifyClient(clientId, titre, corps, extra) {
  const client = DB.clients.find(c => c.id === clientId); if (!client) return;
  extra = extra || {};
  const n = { id: nextId(), clientId, titre, corps, at: nowIso(), lu: false, type: extra.type || 'info', ref: extra.ref || null };
  DB.notifs.push(n);
  if (DB.notifs.length > 8000) DB.notifs = DB.notifs.slice(-6000);
  toClient(clientId, 'notif', n);
  const url = extra.url || (n.type === 'commande' ? '/?vue=commande&id=' + n.ref : n.type === 'chat' ? '/?vue=chat' : '/?vue=notifs');
  sendPush(client, { title: titre, body: corps, tag: n.type + '-' + (n.ref || n.id), url });
}
function broadcast(titre, corps, image, url) {
  const a = { id: nextId(), titre, corps, image: image || '', url: url || '', at: nowIso() };
  DB.annonces.push(a);
  if (DB.annonces.length > 500) DB.annonces = DB.annonces.slice(-400);
  saveDB();
  toAllClients('annonce', a);
  let n = 0;
  DB.clients.forEach(c => { if (c.push && c.push.length) { n++; sendPush(c, { title: titre, body: corps, image: image || undefined, tag: 'annonce-' + a.id, url: url || '/?vue=notifs' }); } });
  return { annonce: a, pushes: n };
}
function fillTemplate(t) {
  const promos = DB.produits.filter(p => p.actif && promoActive(p)).slice(0, 4).map(p => p.nom);
  return String(t || '').replace(/\{boutique\}/g, DB.settings.boutique.nom).replace(/\{promos\}/g, promos.length ? promos.join(', ') : 'nos nouveautés');
}
setInterval(() => {
  if (!DB) return;
  const lp = localParts(DB.settings.boutique.fuseau);
  DB.programmes.forEach(p => {
    if (!p.actif || p.dernierEnvoi === lp.date || !(p.jours || []).includes(lp.weekday) || lp.time < p.heure) return;
    const [h, m] = p.heure.split(':').map(Number), [h2, m2] = lp.time.split(':').map(Number);
    p.dernierEnvoi = lp.date;
    if ((h2 * 60 + m2) - (h * 60 + m) > 120) { saveDB(); return; }
    broadcast(fillTemplate(p.titre), fillTemplate(p.corps));
  });
}, 30000);

// ============================================================
// MÉTIER : prix, livraison, commandes
// ============================================================
function promoActive(p, at) {
  const t = at || Date.now();
  return !!(p.promo && p.promo.prix > 0 && p.promo.prix < p.prix && new Date(p.promo.fin).getTime() > t && (!p.promo.debut || new Date(p.promo.debut).getTime() <= t));
}
const prixDe = p => promoActive(p) ? p.promo.prix : p.prix;

function tapisFrais(n) {
  const pal = DB.settings.livraison.tapisPaliers.slice().sort((a, b) => a.min - b.min);
  let prix = 0; pal.forEach(x => { if (n >= x.min) prix = x.prix; }); return prix;
}
function colisFrais(km) {
  const pal = DB.settings.livraison.colisPaliers.slice().sort((a, b) => a.jusqua - b.jusqua);
  for (const x of pal) if (km <= x.jusqua) return x.prix;
  return pal.length ? pal[pal.length - 1].prix : 0;
}

function validerCreneau(date, creneau, retrait) {
  const L = DB.settings.livraison;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Choisissez une date ' + (retrait ? 'de retrait.' : 'de livraison.'));
  if (!L.creneaux.includes(creneau)) throw new Error('Choisissez un créneau horaire.');
  const lp = localParts(DB.settings.boutique.fuseau);
  if (date < lp.date) throw new Error('Cette date est déjà passée.');
  const d = new Date(date + 'T12:00:00Z');
  if (!L.jours.includes(d.getUTCDay())) throw new Error('Nous ne livrons pas ce jour-là. Choisissez un autre jour.');
  if ((L.joursFermes || []).includes(date)) throw new Error('La boutique est fermée ce jour-là.');
  const max = new Date(lp.date + 'T12:00:00Z'); max.setUTCDate(max.getUTCDate() + (L.joursMax || 21));
  if (d > max) throw new Error('Date trop lointaine.');
  if (date === lp.date) {
    const [h0] = creneau.split(/[^\d]/).filter(Boolean).map(Number);
    const [hn, mn] = lp.time.split(':').map(Number);
    if (h0 * 60 < hn * 60 + mn + (L.delaiHeures || 0) * 60) throw new Error('Ce créneau n’est plus disponible aujourd’hui. Choisissez-en un plus tard.');
  }
}

function computeOrder(body, client) {
  const items = Array.isArray(body.items) ? body.items.slice(0, 80) : [];
  if (!items.length) throw new Error('Votre panier est vide.');
  const lignes = []; let sousTotal = 0, nbTapis = 0, colis = false;
  for (const it of items) {
    const p = DB.produits.find(x => x.id === Number(it.produitId));
    if (!p || !p.actif) throw new Error(`« ${p ? p.nom : 'Un article'} » n’est plus disponible.`);
    const cat = DB.categories.find(c => c.id === p.categorieId);
    if (cat && !cat.actif) throw new Error(`« ${p.nom} » n’est plus disponible.`);
    if (!(p.prix > 0)) throw new Error(`Le prix de « ${p.nom} » est sur demande : contactez-nous sur WhatsApp.`);
    let variante = null;
    if (p.variantes && p.variantes.length) {
      variante = p.variantes.find(v => v.id === it.varianteId);
      if (!variante) throw new Error(`Choisissez un modèle pour « ${p.nom} ».`);
      if (!variante.dispo) throw new Error(`Le modèle « ${variante.nom} » de « ${p.nom} » est épuisé.`);
    }
    const qte = Math.max(1, Math.min(99, Math.round(num(it.qte, 1))));
    const unit = prixDe(p);
    lignes.push({ produitId: p.id, nom: p.nom, variante: variante ? variante.nom : '', varianteId: variante ? variante.id : '', image: (variante && variante.image) || p.images[0] || '', prixUnit: unit, prixNormal: p.prix, qte, total: unit * qte, expedition: p.expedition });
    sousTotal += unit * qte;
    if (p.expedition === 'tapis') nbTapis += qte; else colis = true;
  }
  // stock
  const parProduit = {};
  lignes.forEach(l => { parProduit[l.produitId] = (parProduit[l.produitId] || 0) + l.qte; });
  for (const id in parProduit) {
    const p = DB.produits.find(x => x.id === Number(id));
    if (p.stock !== null && p.stock !== undefined && p.stock < parProduit[id]) throw new Error(p.stock > 0 ? `Il ne reste que ${p.stock} « ${p.nom} ».` : `« ${p.nom} » est en rupture de stock.`);
  }
  // livraison
  const L = DB.settings.livraison, b = body.livraison || {};
  const mode = ['livraison', 'expedition', 'retrait'].includes(b.mode) ? b.mode : 'livraison';
  const liv = { mode, zoneId: '', zone: '', adresse: str(b.adresse, 250), repere: str(b.repere, 200), position: null, date: '', creneau: '', pays: '', ville: '', km: 0, fraisNote: '', destinataire: str(b.destinataire, 80), gare: str(b.gare, 120) };
  let frais = 0;
  if (b.position && isFinite(b.position.lat) && isFinite(b.position.lng)) liv.position = { lat: Number(b.position.lat), lng: Number(b.position.lng) };
  if (mode === 'livraison') {
    const z = L.zones.find(x => x.id === b.zoneId); if (!z) throw new Error('Choisissez votre zone de livraison.');
    if (!liv.adresse && !liv.position) throw new Error('Indiquez votre adresse (quartier, repère) ou partagez votre position.');
    validerCreneau(b.date, b.creneau, false);
    liv.zoneId = z.id; liv.zone = z.nom; liv.date = b.date; liv.creneau = b.creneau; frais = num(z.prix);
  } else if (mode === 'retrait') {
    validerCreneau(b.date, b.creneau, true);
    liv.date = b.date; liv.creneau = b.creneau;
  } else {
    liv.pays = str(b.pays, 60) || 'Côte d’Ivoire';
    if (liv.pays === 'Côte d’Ivoire') {
      let km = 0;
      const v = L.villes.find(x => x.nom === b.ville);
      if (v) { liv.ville = v.nom; km = v.km; }
      else {
        liv.ville = str(b.villeAutre || b.ville, 60);
        if (!liv.ville) throw new Error('Indiquez la ville de destination.');
        km = Math.max(1, Math.min(2000, Math.round(num(b.km, 0))));
        if (!num(b.km)) throw new Error('Indiquez la distance approximative de votre ville.');
      }
      liv.km = km;
      frais = (nbTapis ? tapisFrais(nbTapis) : 0) + (colis ? colisFrais(km) : 0);
      liv.fraisNote = [nbTapis ? `${nbTapis} tapis/pantoufle(s)` : '', colis ? `colis ~${km} km` : ''].filter(Boolean).join(' + ');
    } else {
      const i = L.international.find(x => x.pays === liv.pays);
      if (!i) throw new Error('Pays non desservi pour le moment. Contactez-nous sur WhatsApp.');
      frais = num(i.prix); liv.fraisNote = i.note || 'Forfait international';
    }
    if (!liv.destinataire) throw new Error('Indiquez le nom du destinataire du colis.');
  }
  // fidélité
  const fid = DB.settings.fidelite;
  let points = Math.max(0, Math.floor(num(body.points))), remise = 0;
  if (points && fid.actif) {
    if (!client || client.invite || (client.points || 0) < points) throw new Error('Points de fidélité insuffisants.');
    if (points < fid.seuilPoints) throw new Error(`Il faut au moins ${fid.seuilPoints} points pour les utiliser.`);
    points = Math.min(points, Math.floor(Math.floor(sousTotal / 2) / fid.valeurPoint));
    remise = points * fid.valeurPoint;
  } else points = 0;
  return { lignes, sousTotal, frais, remise, points, total: sousTotal + frais - remise, livraison: liv, nbTapis, colis };
}

const STATUTS = ['recue', 'confirmee', 'preparation', 'en_route', 'expediee', 'prete', 'livree', 'annulee'];
const STATUT_MSG = {
  confirmee: ['Commande confirmée', 'Votre commande n°{n} est confirmée. Nous la préparons avec soin.'],
  preparation: ['En préparation', 'Votre commande n°{n} est en cours d’emballage.'],
  en_route: ['Votre colis est en route', 'Le livreur est parti avec votre commande n°{n}. Suivez-le en direct.'],
  expediee: ['Colis expédié', 'Votre commande n°{n} a été remise au transporteur.'],
  prete: ['Prête au retrait', 'Votre commande n°{n} vous attend à la boutique, Faya Génie 2000.'],
  livree: ['Livrée !', 'Commande n°{n} livrée. Merci ! Donnez-nous votre avis en 10 secondes.'],
  annulee: ['Commande annulée', 'La commande n°{n} a été annulée.']
};
function setStatut(c, statut, extraMsg) {
  if (!STATUTS.includes(statut)) throw new Error('Statut inconnu');
  if (c.statut === 'livree' || c.statut === 'annulee') throw new Error('Cette commande est déjà clôturée.');
  if (statut === 'expediee' && c.paiement.statut !== 'paye') throw new Error('Une expédition doit être payée avant l’envoi. Validez d’abord le paiement.');
  c.statut = statut; c.historique.push({ statut, at: nowIso() });
  if (statut === 'en_route' && !c.livreurKey) c.livreurKey = randomCode(12);
  if (statut === 'annulee') restituer(c);
  if (statut === 'livree') cloturer(c);
  const m = STATUT_MSG[statut];
  if (m) {
    let corps = m[1].replace('{n}', c.numero);
    if (statut === 'prete') corps = corps.replace('Faya Génie 2000', DB.settings.boutique.adresse);
    if (extraMsg) corps += ' ' + extraMsg;
    notifyClient(c.clientId, m[0], corps, { type: 'commande', ref: c.id });
  }
  saveDB(); diffuserCommande(c);
}
function restituer(c) {
  if (c.stockRendu) return; c.stockRendu = true;
  c.lignes.forEach(l => { const p = DB.produits.find(x => x.id === l.produitId); if (p && p.stock !== null && p.stock !== undefined) p.stock += l.qte; });
  if (c.pointsUtilises) { const cl = DB.clients.find(x => x.id === c.clientId); if (cl) cl.points = (cl.points || 0) + c.pointsUtilises; }
}
function cloturer(c) {
  if (c.paiement.statut === 'a_la_livraison') { c.paiement.statut = 'paye'; c.paiement.at = nowIso(); c.paiement.par = 'livreur'; }
  c.livreeAt = nowIso();
  c.lignes.forEach(l => { const p = DB.produits.find(x => x.id === l.produitId); if (p) p.ventes = (p.ventes || 0) + l.qte; });
  const cl = DB.clients.find(x => x.id === c.clientId), fid = DB.settings.fidelite;
  if (cl && !cl.invite && fid.actif && !c.pointsGagnes) { const g = Math.floor(c.sousTotal / 1000) * num(fid.pointsParMille, 1); cl.points = (cl.points || 0) + g; c.pointsGagnes = g; }
}
function clientOrderView(c) {
  const o = Object.assign({}, c); delete o.livreurKey;
  o.paiement = Object.assign({}, c.paiement); delete o.paiement.preuve; o.paiement.aPreuve = !!c.paiement.preuve;
  return o;
}
function diffuserCommande(c) { toClient(c.clientId, 'commande', clientOrderView(c)); toAdmin('commande', c); }
const clientPublic = c => ({ id: c.id, nom: c.nom, tel: c.tel, adresse: c.adresse || '', zoneId: c.zoneId || '', points: c.points || 0, invite: !!c.invite, notifs: !!(c.push && c.push.length) });
const adminClientView = c => ({ id: c.id, nom: c.nom, tel: c.tel, adresse: c.adresse || '', points: c.points || 0, invite: !!c.invite, createdAt: c.createdAt, push: !!(c.push && c.push.length) });

function avisProduits() {
  const acc = {};
  DB.commandes.forEach(c => {
    if (!c.avis || c.avis.masque) return;
    const vus = new Set();
    c.lignes.forEach(l => {
      if (vus.has(l.produitId)) return; vus.add(l.produitId);
      const a = acc[l.produitId] || (acc[l.produitId] = { s: 0, n: 0, liste: [] });
      a.s += c.avis.noteAchat; a.n++;
      if (c.avis.commentaire) a.liste.push({ nom: String(c.clientNom || '').split(' ')[0], note: c.avis.noteAchat, texte: c.avis.commentaire, recommande: c.avis.recommande, at: c.avis.at });
    });
  });
  const out = {}; for (const k in acc) out[k] = { moyenne: Math.round(acc[k].s / acc[k].n * 10) / 10, nombre: acc[k].n, liste: acc[k].liste.slice(-12).reverse() };
  return out;
}

// ============================================================
// IA (API Claude d'Anthropic)
// ============================================================
function iaCle() { return process.env.ANTHROPIC_API_KEY || DB.settings.ia.cle || ''; }
function callClaude(opts) {
  return new Promise((resolve, reject) => {
    const key = iaCle(); if (!key) return reject(new Error('Clé IA non configurée'));
    const body = JSON.stringify({ model: DB.settings.ia.modele || 'claude-sonnet-5-5', max_tokens: opts.maxTokens || 1200, system: opts.system, messages: opts.messages });
    const req = https.request({ method: 'POST', hostname: 'api.anthropic.com', path: '/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-length': Buffer.byteLength(body) } }, r => {
      const chunks = []; r.on('data', c => chunks.push(c));
      r.on('end', () => {
        let j; try { j = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return reject(new Error('Réponse IA illisible')); }
        if (r.statusCode >= 400) return reject(new Error('IA : ' + ((j.error && j.error.message) || r.statusCode)));
        resolve((j.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim());
      });
    });
    req.on('error', e => reject(new Error('IA injoignable : ' + e.message)));
    req.setTimeout(60000, () => req.destroy(new Error('délai dépassé')));
    req.end(body);
  });
}
function imageToBlock(url) {
  let file = null;
  if (url.startsWith('/uploads/')) file = path.join(UPLOAD_DIR, path.basename(url));
  else if (url.startsWith('/catalogue/')) file = path.join(PUBLIC_DIR, 'catalogue', path.basename(url));
  if (!file || !fs.existsSync(file)) return null;
  const ext = path.extname(file).toLowerCase();
  const media = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type: media, data: fs.readFileSync(file).toString('base64') } };
}
function livraisonResume() {
  const L = DB.settings.livraison;
  return [
    'Livraison Abidjan : ' + L.zones.map(z => `${z.nom} ${F(z.prix)}`).join(' ; '),
    'Expédition Côte d’Ivoire (paiement obligatoire avant envoi) — tapis/pantoufles : ' + L.tapisPaliers.map(p => `${p.min}+ = ${F(p.prix)}`).join(', ') + ' ; casseroles et autres colis selon distance : ' + L.colisPaliers.map(p => `≤${p.jusqua} km ${F(p.prix)}`).join(', '),
    'International : ' + L.international.map(i => `${i.pays} ${i.prix ? F(i.prix) : '(à la charge du client)'}`).join(' ; '),
    'Retrait gratuit en boutique : ' + DB.settings.boutique.adresse + ' (' + DB.settings.boutique.horaires + ')'
  ].join('\n');
}
function catalogueResume() {
  return DB.produits.filter(p => p.actif).map(p => {
    const c = DB.categories.find(x => x.id === p.categorieId) || {};
    const pr = p.prix > 0 ? (promoActive(p) ? `${F(p.promo.prix)} au lieu de ${F(p.prix)} (promo)` : F(p.prix)) : 'prix sur demande';
    return `[[p:${p.id}]] ${p.nom} — ${c.nom || ''} — ${pr}${p.variantes.length ? ' — modèles : ' + p.variantes.map(v => v.nom).join(', ') : ''}${p.stock === 0 ? ' — RUPTURE' : ''}`;
  }).join('\n');
}
function assistantSecours(question) {
  const q = String(question || '').toLowerCase();
  const B = DB.settings.boutique;
  const L = DB.settings.livraison;
  const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const zone = L.zones.find(z => norm(z.nom + ' ' + z.exemples).split(/[^a-z0-9]+/).some(w => w.length > 3 && norm(q).includes(w)));
  if (zone) return `Livraison ${zone.nom} : **${F(zone.prix)}**. Vous choisissez le jour et le créneau horaire au moment de commander, et vous pouvez payer à la livraison.`;
  const ville = L.villes.find(v => norm(q).includes(norm(v.nom)));
  if (ville) return `Expédition vers ${ville.nom} (~${ville.km} km) : **${F(colisFrais(ville.km))}** pour les casseroles et colis, et à partir de **${F(tapisFrais(1))}** pour les tapis (selon la quantité). Le paiement se fait avant l’envoi.`;
  const pays = L.international.find(i => norm(q).includes(norm(i.pays)));
  if (pays) return pays.prix ? `Expédition vers ${pays.pays} : forfait **${F(pays.prix)}**, paiement avant l’envoi.` : `Pour ${pays.pays} : ${pays.note}`;
  if (/livr|exp[ée]d|frais|combien.*(envoi|livr)|transport/.test(q)) return 'Livraison à Abidjan :\n' + L.zones.map(z => `• ${z.nom} : ${F(z.prix)}`).join('\n') + `\n\nExpédition dans tout le pays dès ${F(tapisFrais(1))} (tapis) et ${F(colisFrais(0))} (casseroles). Dites-moi votre commune ou votre ville, je vous donne le tarif exact.`;
  if (/pai|wave|orange|mtn|moov|momo|payer/.test(q)) return 'Vous pouvez payer par Wave, Orange Money, MTN MoMo ou Moov Money directement depuis la boutique, ou à la livraison à Abidjan. Pour une expédition, le paiement se fait avant l’envoi.';
  if (/o[uù]|adresse|boutique|magasin|venir|yango/.test(q)) return `Notre boutique : ${B.adresse}. ${B.horaires}. Le bouton « Y aller » de l’onglet Boutique ouvre l’itinéraire et Yango.`;
  const mots = q.split(/[^a-zàâçéèêëîïôûùüÿœ0-9]+/).filter(w => w.length > 3);
  const res = DB.produits.filter(p => p.actif).map(p => {
    const t = (p.nom + ' ' + p.desc + ' ' + p.variantes.map(v => v.nom).join(' ') + ' ' + ((DB.categories.find(c => c.id === p.categorieId) || {}).nom || '')).toLowerCase();
    const n = p.nom.toLowerCase();
    return { p, s: mots.reduce((s, w) => s + (n.includes(w) ? 3 : t.includes(w) ? 1 : 0), 0), tous: mots.every(w => t.includes(w)) };
  }).filter(x => x.s).sort((a, b) => b.tous - a.tous).sort((a, b) => b.s - a.s).slice(0, 4);
  if (res.length) return 'Voici ce que je vous propose :\n' + res.map(x => `[[p:${x.p.id}]]`).join('\n') + '\n\nVous voulez que je vous mette en relation avec une conseillère sur WhatsApp ?';
  return `Je peux vous aider à choisir une marmite, un set, un tapis ou à calculer vos frais de livraison. Dites-moi ce que vous cherchez (ex. « set granité 5 marmites », « tapis bleu »), ou écrivez-nous sur WhatsApp au ${B.tel}.`;
}

// ============================================================
// HTTP
// ============================================================
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)' };
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' }, SEC_HEADERS));
  res.end(body);
}
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

function readBody(req, maxBytes) {
  maxBytes = maxBytes || 12 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > maxBytes) { reject(new HttpError(413, 'Fichier trop volumineux')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8'); if (!raw) return resolve({});
      if (/application\/x-www-form-urlencoded/.test(req.headers['content-type'] || '')) { const o = {}; new URLSearchParams(raw).forEach((v, k) => { o[k] = v; }); return resolve(o); }
      try { resolve(JSON.parse(raw)); } catch (e) { if (/text\/plain/.test(req.headers['content-type'] || '')) return resolve({ texte: raw }); reject(new HttpError(400, 'Données invalides')); }
    });
    req.on('error', reject);
  });
}
function saveImage(dataUrl, dir, prefix) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) fail(400, 'Image invalide (PNG, JPG ou WEBP).');
  dir = dir || UPLOAD_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = (prefix || '') + Date.now().toString(36) + '-' + crypto.randomBytes(8).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(dir, name), Buffer.from(m[2], 'base64'));
  return name;
}
function removeImage(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const used = DB.produits.some(p => p.images.includes(url) || p.variantes.some(v => v.image === url)) || DB.banners.some(b => b.image === url) || DB.categories.some(c => c.image === url);
  if (!used) fs.unlink(path.join(UPLOAD_DIR, path.basename(url)), () => { });
}
function serveFile(res, filePath, cache) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
    const ext = path.extname(filePath).toLowerCase();
    const h = Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache ? 'public, max-age=604800' : 'no-cache' }, SEC_HEADERS);
    if (path.basename(filePath) === 'sw.js') h['Service-Worker-Allowed'] = '/';
    res.writeHead(200, h); res.end(data);
  });
}

const routes = [];
function route(method, pattern, auth, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, auth, handler });
}
function getClient(req, query) {
  const token = req.headers['x-client-token'] || (query && query.get('token'));
  if (!token) return null;
  return DB.clients.find(c => c.tokens && c.tokens.some(t => safeEqual(t, token))) || null;
}
const findOr404 = (arr, id, what) => arr.find(x => x.id === Number(id)) || fail(404, (what || 'Élément') + ' introuvable');
function checkDeleteCode(ctx) {
  if (!rateOk('del:' + ctx.ip, 5, 60000)) fail(429, 'Trop de tentatives. Patientez une minute.');
  if (!safeEqual(hashSecret(ctx.body.code || '', DB.settings.delSalt), DB.settings.delHash)) fail(403, 'Code de suppression incorrect');
}
function issueToken(client) {
  const t = crypto.randomBytes(24).toString('hex');
  client.tokens = (client.tokens || []).slice(-4); client.tokens.push(t); return t;
}

// ============================================================
// ROUTES — PUBLIC
// ============================================================
function publicProduit(p) {
  const o = Object.assign({}, p);
  o.promoActive = promoActive(p); o.prixActuel = prixDe(p);
  if (!o.promoActive) o.promo = null;
  o.enStock = p.stock === null || p.stock === undefined ? true : p.stock > 0;
  o.stockBas = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 3 ? p.stock : 0;
  delete o.stock;
  return o;
}
route('GET', '/api/public/boutique', null, () => {
  const s = DB.settings, P = s.paiement;
  const modes = {}; Object.keys(P.modes).forEach(k => { const m = P.modes[k]; if (m.actif && m.numero) modes[k] = { nom: m.nom, numero: m.numero, titulaire: m.titulaire, lien: m.lien, ussd: m.ussd }; });
  const L = s.livraison;
  return {
    ok: true, boutique: s.boutique, vapidKey: s.vapid.publicKey, now: nowIso(), local: localParts(s.boutique.fuseau),
    paiement: { modes, livraisonCash: P.livraisonCash, consignes: P.consignes },
    livraison: { zones: L.zones, villes: L.villes, tapisPaliers: L.tapisPaliers, colisPaliers: L.colisPaliers, international: L.international, creneaux: L.creneaux, jours: L.jours, delaiHeures: L.delaiHeures, joursMax: L.joursMax, joursFermes: L.joursFermes, delaiExpedition: L.delaiExpedition },
    fidelite: s.fidelite, ia: { assistant: !!s.ia.assistant, intelligent: !!iaCle() },
    categories: DB.categories.filter(c => c.actif).sort((a, b) => a.ordre - b.ordre),
    produits: DB.produits.filter(p => p.actif && (DB.categories.find(c => c.id === p.categorieId) || {}).actif !== false).map(publicProduit),
    banners: DB.banners.filter(b => b.actif).sort((a, b) => a.ordre - b.ordre),
    avis: avisProduits()
  };
});
route('GET', '/api/stream/public', null, (ctx) => {
  sseOpen(ctx.req, ctx.res); publicStreams.add(ctx.res);
  ctx.req.on('close', () => publicStreams.delete(ctx.res));
  return 'STREAM';
});
// Reçu partageable (lien secret)
route('GET', '/api/recu/:id', null, (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Reçu');
  if (!c.recuKey || !safeEqual(ctx.query.get('k') || '', c.recuKey)) fail(403, 'Lien de reçu invalide');
  return { ok: true, recu: recuView(c), boutique: DB.settings.boutique };
});
function recuView(c) {
  return { id: c.id, numero: c.numero, at: c.at, clientNom: c.clientNom, tel: c.tel, lignes: c.lignes, sousTotal: c.sousTotal, frais: c.frais, remise: c.remise, total: c.total,
    livraison: c.livraison, statut: c.statut, paiement: { mode: c.paiement.mode, statut: c.paiement.statut, reference: c.paiement.reference, at: c.paiement.at } };
}

// Assistant IA (client)
route('POST', '/api/assistant', null, async (ctx) => {
  if (!DB.settings.ia.assistant) fail(403, 'Assistant désactivé');
  if (!rateOk('ia:' + ctx.ip, 25, 10 * 60000)) fail(429, 'Vous posez beaucoup de questions ! Patientez quelques minutes ou écrivez-nous sur WhatsApp.');
  const msgs = (Array.isArray(ctx.body.messages) ? ctx.body.messages : []).slice(-10)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: str(m.content, 1500) })).filter(m => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') fail(400, 'Message vide');
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const B = DB.settings.boutique;
  if (!iaCle()) return { ok: true, texte: assistantSecours(msgs[msgs.length - 1].content), mode: 'simple' };
  const system = `Tu es « Awa », l’assistante de la boutique en ligne ${B.nom} (Abidjan, Côte d’Ivoire), experte en ustensiles de cuisine (marmites granité, inox, aluminium, émaillé, plats isothermes), tapis de salle de bain et pantoufles.
Ton style : chaleureux, élégant, phrases courtes, en français simple de Côte d’Ivoire, tutoiement interdit (vouvoiement). 2 à 6 phrases maximum.
Objectif : aider à choisir et à commander. Recommande 1 à 3 produits du catalogue en écrivant leur code EXACT [[p:ID]] (seul sur sa ligne), il sera affiché comme une carte avec photo et bouton.
N’invente jamais un produit, un prix, une caractéristique technique ou un délai qui n’est pas ci-dessous. Si une information manque (dimensions exactes, compatibilité induction…), dis-le honnêtement et propose WhatsApp (${B.tel}).
Pour commander : ajouter au panier, choisir livraison (date et créneau) / expédition / retrait, puis payer par Wave, Orange Money, MTN MoMo, Moov Money ou à la livraison (Abidjan uniquement).
Boutique : ${B.adresse}. ${B.horaires}.
TARIFS :
${livraisonResume()}
CATALOGUE :
${catalogueResume()}`;
  try {
    const texte = await callClaude({ system, messages: msgs, maxTokens: 600 });
    return { ok: true, texte, mode: 'ia' };
  } catch (e) {
    console.error(e.message);
    return { ok: true, texte: assistantSecours(msgs[msgs.length - 1].content), mode: 'simple' };
  }
});

// ============================================================
// ROUTES — CLIENT
// ============================================================
route('POST', '/api/client/invite', null, (ctx) => {
  if (!rateOk('inv:' + ctx.ip, 30, 15 * 60000)) fail(429, 'Trop de tentatives.');
  const nom = str(ctx.body.nom, 60), tel = normTel(ctx.body.tel);
  if (!nom || tel.length < 8) fail(400, 'Nom et numéro de téléphone valides requis.');
  const c = { id: nextId(), nom, tel, invite: true, points: 0, push: [], tokens: [], createdAt: nowIso() };
  const token = issueToken(c); DB.clients.push(c); saveDB();
  toAdmin('client', adminClientView(c));
  return { ok: true, token, client: clientPublic(c) };
});
// Visiteur anonyme : sert à recevoir les notifications (nouveautés, prix cassés) sans compte
route('POST', '/api/client/visiteur', null, (ctx) => {
  if (!rateOk('vis:' + ctx.ip, 10, 60 * 60000)) fail(429, 'Trop de tentatives.');
  const c = { id: nextId(), nom: '', tel: '', invite: true, visiteur: true, points: 0, push: [], tokens: [], createdAt: nowIso() };
  const token = issueToken(c); DB.clients.push(c); saveDB();
  return { ok: true, token, client: clientPublic(c) };
});
route('POST', '/api/client/inscription', null, (ctx) => {
  if (!rateOk('insc:' + ctx.ip, 10, 15 * 60000)) fail(429, 'Trop de tentatives, réessayez plus tard.');
  const nom = str(ctx.body.nom, 60), tel = normTel(ctx.body.tel), pin = String(ctx.body.pin || '');
  if (!nom || tel.length < 8) fail(400, 'Nom et numéro de téléphone valides requis.');
  if (!/^\d{4}$/.test(pin)) fail(400, 'Le code secret doit faire 4 chiffres.');
  if (DB.clients.some(c => c.tel === tel && !c.invite)) fail(409, 'Ce numéro a déjà un compte. Connectez-vous.');
  const prev = getClient(ctx.req);
  let c;
  if (prev && prev.invite) { c = prev; c.invite = false; c.nom = nom; c.tel = tel; }
  else { c = { id: nextId(), nom, tel, points: 0, push: [], tokens: [], createdAt: nowIso() }; DB.clients.push(c); }
  c.pinSalt = makeSalt(); c.pinHash = hashSecret(pin, c.pinSalt);
  const token = issueToken(c); saveDB();
  toAdmin('client', adminClientView(c));
  return { ok: true, token, client: clientPublic(c) };
});
route('POST', '/api/client/connexion', null, (ctx) => {
  if (!rateOk('cnx:' + ctx.ip, 10, 15 * 60000)) fail(429, 'Trop de tentatives, réessayez dans 15 minutes.');
  const tel = normTel(ctx.body.tel);
  const c = DB.clients.find(x => x.tel === tel && !x.invite);
  if (!c || !safeEqual(hashSecret(String(ctx.body.pin || ''), c.pinSalt), c.pinHash)) fail(401, 'Numéro ou code secret incorrect.');
  const prev = getClient(ctx.req);
  if (prev && prev.invite && prev.id !== c.id) { DB.commandes.forEach(o => { if (o.clientId === prev.id) o.clientId = c.id; }); }
  const token = issueToken(c); saveDB();
  return { ok: true, token, client: clientPublic(c) };
});
route('GET', '/api/client/moi', 'client', (ctx) => ({ ok: true, client: clientPublic(ctx.client) }));
route('PUT', '/api/client/moi', 'client', (ctx) => {
  const c = ctx.client, b = ctx.body;
  if (b.nom) c.nom = str(b.nom, 60);
  if (b.adresse !== undefined) c.adresse = str(b.adresse, 250);
  if (b.zoneId !== undefined) c.zoneId = str(b.zoneId, 30);
  if (b.tel && c.invite) { c.tel = normTel(b.tel); c.visiteur = false; }
  saveDB(); return { ok: true, client: clientPublic(c) };
});
route('POST', '/api/client/deconnexion', 'client', (ctx) => {
  const t = ctx.req.headers['x-client-token'];
  ctx.client.tokens = (ctx.client.tokens || []).filter(x => x !== t);
  if (ctx.body.endpoint) ctx.client.push = (ctx.client.push || []).filter(s => s.endpoint !== ctx.body.endpoint);
  saveDB(); return { ok: true };
});
route('POST', '/api/client/supprimer', 'client', (ctx) => {
  const c = ctx.client;
  if (!c.invite && !safeEqual(hashSecret(String(ctx.body.pin || ''), c.pinSalt), c.pinHash)) fail(401, 'Code secret incorrect.');
  DB.chats = DB.chats.filter(m => m.clientId !== c.id); DB.notifs = DB.notifs.filter(n => n.clientId !== c.id);
  c.nom = 'Client supprimé'; c.tel = ''; c.adresse = ''; c.tokens = []; c.push = []; c.invite = true; c.supprime = true;
  saveDB(); return { ok: true };
});
route('POST', '/api/client/push', 'client', (ctx) => {
  const s = ctx.body.subscription;
  if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) fail(400, 'Abonnement invalide');
  DB.clients.forEach(c => { if (c.push) c.push = c.push.filter(x => x.endpoint !== s.endpoint); });
  ctx.client.push = (ctx.client.push || []).concat([{ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }]).slice(-5);
  saveDB(); return { ok: true };
});
route('GET', '/api/client/donnees', 'client', (ctx) => {
  const id = ctx.client.id, lus = new Set(ctx.client.annoncesLues || []);
  const since = ctx.client.createdAt ? new Date(new Date(ctx.client.createdAt).getTime() - 14 * 86400000).toISOString() : '';
  return {
    ok: true, client: clientPublic(ctx.client),
    commandes: DB.commandes.filter(c => c.clientId === id).slice(-40).reverse().map(clientOrderView),
    notifs: DB.notifs.filter(n => n.clientId === id).slice(-60)
      .concat(DB.annonces.filter(a => a.at >= since).slice(-30).map(a => ({ id: a.id, titre: a.titre, corps: a.corps, image: a.image, url: a.url, at: a.at, type: 'annonce', lu: lus.has(a.id) })))
      .sort((a, b) => b.at.localeCompare(a.at)),
    devis: DB.devis.filter(d => d.clientId === id).slice(-20).reverse(),
    chat: DB.chats.filter(m => m.clientId === id).slice(-200)
  };
});
route('POST', '/api/client/notifs/lu', 'client', (ctx) => {
  DB.notifs.forEach(n => { if (n.clientId === ctx.client.id) n.lu = true; });
  ctx.client.annoncesLues = DB.annonces.slice(-60).map(a => a.id);
  saveDB(); return { ok: true };
});

// ---------- Commandes ----------
route('POST', '/api/devis-livraison', null, (ctx) => {
  // simulation de frais (sans créneau)
  const b = Object.assign({}, ctx.body);
  try {
    const liv = Object.assign({}, b.livraison || {});
    if (liv.mode === 'livraison' || liv.mode === 'retrait') { const z = DB.settings.livraison.zones.find(x => x.id === liv.zoneId); return { ok: true, frais: liv.mode === 'retrait' ? 0 : (z ? z.prix : null) }; }
    liv.destinataire = liv.destinataire || 'x';
    const r = computeOrder(Object.assign(b, { livraison: liv }), null);
    return { ok: true, frais: r.frais, note: r.livraison.fraisNote };
  } catch (e) { return { ok: false, error: e.message }; }
});
route('POST', '/api/commandes', 'client', (ctx) => {
  if (!rateOk('cmd:' + ctx.ip, 15, 10 * 60000)) fail(429, 'Trop de commandes en peu de temps. Patientez un instant.');
  const B = DB.settings.boutique, P = DB.settings.paiement, b = ctx.body, client = ctx.client;
  if (!B.ouvert) fail(409, 'La boutique ne prend pas de commande pour le moment. Écrivez-nous sur WhatsApp.');
  let calc; try { calc = computeOrder(b, client); } catch (e) { fail(400, e.message); }
  const nom = str(b.nom, 60) || client.nom, tel = normTel(b.tel) || client.tel;
  if (!nom || tel.length < 8) fail(400, 'Votre nom et un numéro de téléphone joignable sont nécessaires.');
  const mode = String(b.paiement || '');
  const modesActifs = Object.keys(P.modes).filter(k => P.modes[k].actif && P.modes[k].numero);
  if (mode === 'livraison') {
    if (calc.livraison.mode === 'expedition') fail(400, 'Pour une expédition, le paiement Mobile Money est obligatoire avant l’envoi.');
    if (!P.livraisonCash) fail(400, 'Le paiement à la livraison n’est pas disponible. Choisissez un paiement Mobile Money.');
  } else if (!modesActifs.includes(mode)) fail(400, 'Choisissez un moyen de paiement.');
  if (calc.points) client.points -= calc.points;
  calc.lignes.forEach(l => { const p = DB.produits.find(x => x.id === l.produitId); if (p.stock !== null && p.stock !== undefined) p.stock -= l.qte; });
  const c = {
    id: nextId(), numero: DB.nextNumero++, at: nowIso(), clientId: client.id, clientNom: nom, tel,
    lignes: calc.lignes, sousTotal: calc.sousTotal, frais: calc.frais, remise: calc.remise, pointsUtilises: calc.points, total: calc.total,
    livraison: calc.livraison, note: str(b.note, 400),
    paiement: { mode, statut: mode === 'livraison' ? 'a_la_livraison' : 'en_attente', montant: calc.total, reference: '', payeur: '', preuve: '', at: '' },
    statut: 'recue', historique: [{ statut: 'recue', at: nowIso() }], recuKey: randomCode(16), livreur: null, livreurPos: null, chatLivreur: [], proche: null
  };
  if (!client.nom || client.invite) client.nom = nom;
  if (calc.livraison.mode === 'livraison') { client.adresse = calc.livraison.adresse || client.adresse; client.zoneId = calc.livraison.zoneId; }
  DB.commandes.push(c); saveDB();
  toAdmin('commande', c); toAdmin('nouvelle', { numero: c.numero, total: c.total, client: c.clientNom });
  pushAdmin(`Nouvelle commande n°${c.numero}`, `${c.clientNom} · ${F(c.total)} · ${{ livraison: 'Livraison', expedition: 'Expédition', retrait: 'Retrait' }[c.livraison.mode]}`);
  return { ok: true, commande: clientOrderView(c), client: clientPublic(client) };
});
route('POST', '/api/commandes/:id/paiement', 'client', (ctx) => {
  if (!rateOk('pay:' + ctx.ip, 12, 10 * 60000)) fail(429, 'Trop de tentatives. Patientez quelques minutes ou écrivez-nous sur WhatsApp.');
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  if (c.clientId !== ctx.client.id) fail(403, 'Accès refusé');
  if (c.statut === 'annulee') fail(409, 'Cette commande est annulée.');
  if (c.paiement.statut === 'paye') fail(409, 'Cette commande est déjà payée.');
  const P = DB.settings.paiement, b = ctx.body;
  const mode = String(b.mode || c.paiement.mode);
  if (!(P.modes[mode] && P.modes[mode].actif && P.modes[mode].numero)) fail(400, 'Moyen de paiement indisponible.');
  const ref = str(b.reference, 40).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9.\-_]{6,40}$/.test(ref)) fail(400, 'Saisissez la référence (ID de transaction) reçue par SMS : 6 caractères minimum, lettres et chiffres.');
  if (DB.commandes.some(o => o.id !== c.id && o.paiement && o.paiement.reference === ref)) fail(409, 'Cette référence de transaction a déjà été utilisée pour une autre commande.');
  const payeur = normTel(b.payeur);
  if (payeur.length < 8) fail(400, 'Indiquez le numéro qui a envoyé le paiement.');
  let preuve = c.paiement.preuve;
  if (b.preuve) preuve = saveImage(b.preuve, PROOF_DIR, 'p' + c.numero + '-');
  Object.assign(c.paiement, { mode, statut: 'declare', reference: ref, payeur, preuve, declareAt: nowIso(), motifRefus: '' });
  c.historique.push({ statut: 'paiement_declare', at: nowIso() });
  // Rapprochement automatique avec un SMS déjà reçu (passerelle SMS)
  const sms = DB.smsLog.slice(-300).find(s => !s.commandeId && s.texte.toUpperCase().replace(/\s+/g, '').includes(ref));
  if (sms && P.smsAuto && sms.montant >= c.total) validerPaiement(c, 'sms', sms);
  saveDB(); diffuserCommande(c);
  if (c.paiement.statut === 'declare') {
    toAdmin('paiement', { numero: c.numero, total: c.total, mode });
    pushAdmin(`Paiement à vérifier — n°${c.numero}`, `${P.modes[mode].nom} · ${F(c.total)} · réf. ${ref}`, '/gestion.html#paiements');
  }
  return { ok: true, commande: clientOrderView(c) };
});
function validerPaiement(c, par, sms) {
  c.paiement.statut = 'paye'; c.paiement.at = nowIso(); c.paiement.par = par;
  if (sms) { sms.commandeId = c.id; c.paiement.sms = sms.texte.slice(0, 300); }
  c.historique.push({ statut: 'paiement_valide', at: nowIso() });
  if (c.statut === 'recue') { c.statut = 'confirmee'; c.historique.push({ statut: 'confirmee', at: nowIso() }); }
  notifyClient(c.clientId, 'Paiement reçu ✓', `Merci ! Le paiement de ${F(c.total)} pour la commande n°${c.numero} est confirmé. Votre reçu est disponible.`, { type: 'commande', ref: c.id });
  toAdmin('alerte', { titre: `Paiement validé${par === 'sms' ? ' automatiquement' : ''}`, corps: `Commande n°${c.numero} · ${F(c.total)}` });
}
route('POST', '/api/commandes/:id/annuler', 'client', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  if (c.clientId !== ctx.client.id) fail(403, 'Accès refusé');
  if (c.statut !== 'recue' || c.paiement.statut === 'paye' || c.paiement.statut === 'declare') fail(409, 'Cette commande est déjà en traitement. Écrivez-nous pour l’annuler.');
  setStatut(c, 'annulee');
  return { ok: true, commande: clientOrderView(c) };
});
route('POST', '/api/commandes/:id/avis', 'client', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  if (c.clientId !== ctx.client.id) fail(403, 'Accès refusé');
  if (c.statut !== 'livree') fail(409, 'Vous pourrez noter votre achat une fois livré.');
  const b = ctx.body, n = v => Math.max(1, Math.min(5, Math.round(num(v, 5))));
  c.avis = { noteAchat: n(b.noteAchat), noteLivraison: c.livraison.mode === 'retrait' ? 0 : n(b.noteLivraison), commentaire: str(b.commentaire, 600), recommande: b.recommande !== false, suggestion: str(b.suggestion, 600), at: nowIso(), masque: false };
  saveDB(); toAdmin('commande', c); toAdmin('alerte', { titre: `Nouvel avis ${'★'.repeat(c.avis.noteAchat)}`, corps: `${c.clientNom} — commande n°${c.numero}` });
  return { ok: true, commande: clientOrderView(c) };
});
route('POST', '/api/commandes/:id/chat', 'client', (ctx) => {
  if (!rateOk('chl:' + ctx.ip, 40, 60000)) fail(429, 'Doucement, patientez quelques secondes.');
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  if (c.clientId !== ctx.client.id) fail(403, 'Accès refusé');
  if (!c.livreur || c.statut !== 'en_route') fail(409, 'La discussion avec le livreur s’ouvre quand votre colis est en route.');
  const texte = str(ctx.body.texte, 500); if (!texte) fail(400, 'Message vide');
  const m = { id: uid(), de: 'client', texte, at: nowIso() };
  c.chatLivreur.push(m); saveDB();
  toClient(c.clientId, 'chatlivreur', { id: c.id, message: m }); toAdmin('commande', c);
  return { ok: true, message: m };
});

// ---------- Devis & discussion ----------
route('POST', '/api/devis', 'client', (ctx) => {
  if (!rateOk('dev:' + ctx.ip, 10, 30 * 60000)) fail(429, 'Trop de demandes, réessayez plus tard.');
  const b = ctx.body;
  const d = { id: nextId(), at: nowIso(), clientId: ctx.client.id, nom: str(b.nom, 60) || ctx.client.nom, tel: normTel(b.tel) || ctx.client.tel,
    type: str(b.type, 60), produit: str(b.produit, 120), quantite: Math.max(1, Math.round(num(b.quantite, 1))), date: str(b.date, 10), budget: num(b.budget),
    description: str(b.description, 1500), image: '', statut: 'nouveau', montant: 0, reponse: '' };
  if (!d.type || !d.description) fail(400, 'Indiquez le type de demande et décrivez votre besoin.');
  if (!d.tel) fail(400, 'Un numéro de téléphone est nécessaire.');
  if (b.image) d.image = '/uploads/' + saveImage(b.image);
  DB.devis.push(d); saveDB(); toAdmin('devis', d);
  pushAdmin('Nouvelle demande de devis', `${d.nom} · ${d.type}`, '/gestion.html#devis');
  return { ok: true, devis: d };
});
route('POST', '/api/devis/:id/decision', 'client', (ctx) => {
  const d = findOr404(DB.devis, ctx.params.id, 'Devis');
  if (d.clientId !== ctx.client.id) fail(403, 'Accès refusé');
  if (d.statut !== 'propose') fail(409, 'Aucune proposition en attente.');
  d.statut = ctx.body.accepte ? 'accepte' : 'refuse'; saveDB(); toAdmin('devis', d);
  if (d.statut === 'accepte') pushAdmin('Devis accepté', `${d.nom} · ${F(d.montant)}`, '/gestion.html#devis');
  return { ok: true, devis: d };
});
route('POST', '/api/client/chat', 'client', (ctx) => {
  if (!rateOk('chat:' + ctx.ip, 40, 60000)) fail(429, 'Doucement, patientez quelques secondes.');
  const texte = str(ctx.body.texte, 1000); if (!texte) fail(400, 'Message vide');
  const m = { id: nextId(), clientId: ctx.client.id, de: 'client', texte, at: nowIso(), lu: false };
  DB.chats.push(m); saveDB();
  toAdmin('chat', Object.assign({ clientNom: ctx.client.nom, clientTel: ctx.client.tel }, m));
  toClient(ctx.client.id, 'chat', m);
  if (!adminStreams.size) pushAdmin('Message de ' + ctx.client.nom, texte, '/gestion.html#discussions');
  return { ok: true, message: m, enLigne: adminStreams.size > 0 };
});
route('GET', '/api/stream/client', 'stream-client', (ctx) => {
  const { req, res, client } = ctx;
  sseOpen(req, res);
  if (!clientStreams.has(client.id)) clientStreams.set(client.id, new Set());
  clientStreams.get(client.id).add(res);
  sseSend(res, 'presence', { enLigne: adminStreams.size > 0 });
  req.on('close', () => { const s = clientStreams.get(client.id); if (s) { s.delete(res); if (!s.size) clientStreams.delete(client.id); } });
  return 'STREAM';
});

// ============================================================
// PASSERELLE SMS (optionnelle) : un téléphone Android avec une appli
// « transfert de SMS vers URL » envoie ici les SMS de paiement reçus.
// ============================================================
function parseMontant(t) {
  const m = String(t).match(/(\d{1,3}(?:[ .  ]?\d{3})+|\d+)(?:[,.]\d{1,2})?\s*(?:F\b|FCFA|F CFA|XOF|CFA)/i);
  return m ? Number(m[1].replace(/[^\d]/g, '')) : 0;
}
route('POST', '/api/sms', null, (ctx) => {
  const P = DB.settings.paiement;
  const cle = ctx.query.get('cle') || ctx.body.cle || '';
  if (!P.smsCle || !safeEqual(cle, P.smsCle)) fail(403, 'Clé invalide');
  if (!rateOk('sms:' + ctx.ip, 120, 60000)) fail(429, 'Trop de SMS');
  const b = ctx.body;
  const texte = str(b.texte || b.message || b.msg || b.body || b.text || b.content, 1000);
  if (!texte) fail(400, 'SMS vide');
  const s = { id: nextId(), at: nowIso(), de: str(b.de || b.from || b.sender || b.expediteur, 40), texte, montant: parseMontant(texte), commandeId: null };
  DB.smsLog.push(s); if (DB.smsLog.length > 1500) DB.smsLog = DB.smsLog.slice(-1200);
  let match = null;
  if (P.smsAuto) {
    const T = texte.toUpperCase().replace(/\s+/g, '');
    match = DB.commandes.find(c => c.paiement && c.paiement.statut === 'declare' && c.paiement.reference && T.includes(c.paiement.reference));
    if (match && s.montant >= match.total) { validerPaiement(match, 'sms', s); diffuserCommande(match); }
    else match = null;
  }
  saveDB(); toAdmin('sms', s);
  return { ok: true, rapproche: match ? match.numero : null };
});

// ============================================================
// ROUTES — LIVREUR (lien secret par commande)
// ============================================================
function livreurOrder(ctx) {
  const c = findOr404(DB.commandes, ctx.query.get('c') || ctx.body.c, 'Commande');
  const k = ctx.query.get('k') || ctx.body.k || '';
  if (!c.livreurKey || !safeEqual(k, c.livreurKey)) fail(403, 'Lien de livraison invalide');
  return c;
}
function signalerProche(c, auto) {
  if (c.proche) return;
  c.proche = { at: nowIso(), auto: !!auto };
  notifyClient(c.clientId, 'Votre livreur est à quelques pas 🛵', `${c.livreur ? c.livreur.nom : 'Le livreur'} arrive avec votre commande n°${c.numero}. Préparez-vous à le recevoir${c.paiement.statut === 'a_la_livraison' ? ' (' + F(c.total) + ' à régler)' : ''}.`, { type: 'commande', ref: c.id });
  diffuserCommande(c);
}
route('GET', '/api/livreur/commande', null, (ctx) => {
  const c = livreurOrder(ctx);
  return { ok: true, commande: { id: c.id, numero: c.numero, clientNom: c.clientNom, tel: c.tel, livraison: c.livraison, total: c.total, paiement: { mode: c.paiement.mode, statut: c.paiement.statut }, lignes: c.lignes, statut: c.statut, note: c.note, proche: c.proche, chat: c.chatLivreur, livreur: c.livreur },
    boutique: { nom: DB.settings.boutique.nom, lat: DB.settings.boutique.lat, lng: DB.settings.boutique.lng, tel: DB.settings.boutique.tel } };
});
route('POST', '/api/livreur/position', null, (ctx) => {
  const c = livreurOrder(ctx);
  if (c.statut !== 'en_route') fail(409, 'La course est terminée.');
  const lat = Number(ctx.body.lat), lng = Number(ctx.body.lng);
  if (!isFinite(lat) || !isFinite(lng)) fail(400, 'Position invalide');
  c.livreurPos = { lat, lng, at: nowIso() };
  let dist = null;
  if (c.livraison.position) { dist = Math.round(distanceM(c.livreurPos, c.livraison.position)); if (dist < 350) signalerProche(c, true); }
  saveDB();
  toClient(c.clientId, 'position', { id: c.id, pos: c.livreurPos, distance: dist });
  toAdmin('position', { id: c.id, pos: c.livreurPos });
  return { ok: true, distance: dist };
});
route('POST', '/api/livreur/proche', null, (ctx) => {
  const c = livreurOrder(ctx);
  if (c.statut !== 'en_route') fail(409, 'La course est terminée.');
  signalerProche(c, false); saveDB(); return { ok: true };
});
route('POST', '/api/livreur/chat', null, (ctx) => {
  const c = livreurOrder(ctx);
  if (!rateOk('lch:' + ctx.ip, 40, 60000)) fail(429, 'Doucement.');
  const texte = str(ctx.body.texte, 500); if (!texte) fail(400, 'Message vide');
  const m = { id: uid(), de: 'livreur', texte, at: nowIso() };
  c.chatLivreur.push(m); saveDB();
  toClient(c.clientId, 'chatlivreur', { id: c.id, message: m }); toAdmin('commande', c);
  const cl = DB.clients.find(x => x.id === c.clientId);
  sendPush(cl, { title: 'Message du livreur', body: texte, tag: 'livreur-' + c.id, url: '/?vue=commande&id=' + c.id });
  return { ok: true, message: m };
});
route('POST', '/api/livreur/livree', null, (ctx) => {
  const c = livreurOrder(ctx);
  if (c.statut !== 'en_route') fail(409, 'La course est déjà clôturée.');
  if (c.paiement.statut === 'a_la_livraison' && !ctx.body.encaisse) fail(400, 'Confirmez que vous avez encaissé le montant.');
  if (c.paiement.statut !== 'paye' && c.paiement.statut !== 'a_la_livraison') fail(409, 'Paiement non confirmé : appelez la boutique avant de remettre le colis.');
  setStatut(c, 'livree');
  return { ok: true };
});

// ============================================================
// ROUTES — GESTION
// ============================================================
route('GET', '/api/session', null, (ctx) => {
  const s = getSession(ctx.req);
  return { loggedIn: !!s, username: s ? s.username : null, setupDone: DB.settings.setupDone, boutique: DB.settings.boutique.nom };
});
route('POST', '/api/setup', null, (ctx) => {
  if (DB.settings.setupDone) fail(403, 'La configuration a déjà été effectuée.');
  const u = str(ctx.body.username, 40), p = String(ctx.body.password || ''), d = String(ctx.body.deleteCode || '').trim();
  if (!u || p.length < 6 || d.length < 4) fail(400, 'Identifiant, mot de passe (6 caractères min.) et code de suppression (4 min.) requis.');
  const s = DB.settings;
  s.adminUser = u; s.pwSalt = makeSalt(); s.pwHash = hashSecret(p, s.pwSalt);
  s.delSalt = makeSalt(); s.delHash = hashSecret(d, s.delSalt); s.setupDone = true;
  saveDB();
  const sid = crypto.randomBytes(24).toString('hex'); sessions.set(sid, { username: u, expires: Date.now() + SESSION_TTL });
  setSessionCookie(ctx.req, ctx.res, sid, SESSION_TTL / 1000);
  return { ok: true, username: u };
});
route('POST', '/api/login', null, (ctx) => {
  if (!rateOk('login:' + ctx.ip, 8, 15 * 60000)) fail(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  const s = DB.settings;
  const okU = s.adminUser && safeEqual(str(ctx.body.username, 40), s.adminUser);
  const okP = safeEqual(hashSecret(ctx.body.password || '', s.pwSalt || 'x'), s.pwHash || '');
  if (!okU || !okP) fail(401, 'Identifiant ou mot de passe incorrect');
  const sid = crypto.randomBytes(24).toString('hex'); sessions.set(sid, { username: s.adminUser, expires: Date.now() + SESSION_TTL });
  setSessionCookie(ctx.req, ctx.res, sid, SESSION_TTL / 1000);
  return { ok: true, username: s.adminUser };
});
route('POST', '/api/logout', null, (ctx) => {
  const sid = parseCookies(ctx.req).sid; if (sid) sessions.delete(sid);
  ctx.res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0'); return { ok: true };
});
function adminSettings() {
  const s = DB.settings;
  const ia = Object.assign({}, s.ia, { cle: '', cleDefinie: !!iaCle(), cleEnv: !!process.env.ANTHROPIC_API_KEY });
  return { boutique: s.boutique, paiement: s.paiement, livraison: s.livraison, ia, fidelite: s.fidelite, adminUser: s.adminUser, vapidKey: s.vapid.publicKey };
}
route('GET', '/api/admin/bootstrap', 'admin', () => ({
  ok: true, settings: adminSettings(),
  categories: DB.categories, produits: DB.produits, banners: DB.banners, livreurs: DB.livreurs,
  commandes: DB.commandes.slice(-1500), clients: DB.clients.filter(c => !c.supprime && !c.visiteur).map(adminClientView),
  abonnes: DB.clients.filter(c => c.push && c.push.length).length, annonces: DB.annonces.slice(-60).reverse(),
  programmes: DB.programmes, devis: DB.devis.slice(-400), chats: DB.chats.slice(-4000), smsLog: DB.smsLog.slice(-200).reverse(),
  avis: avisProduits(), now: localParts(DB.settings.boutique.fuseau)
}));
route('GET', '/api/stream/admin', 'admin', (ctx) => {
  sseOpen(ctx.req, ctx.res); adminStreams.add(ctx.res);
  if (adminStreams.size === 1) toAllClients('presence', { enLigne: true });
  ctx.req.on('close', () => { adminStreams.delete(ctx.res); if (!adminStreams.size) toAllClients('presence', { enLigne: false }); });
  return 'STREAM';
});
route('POST', '/api/admin/push', 'admin', (ctx) => {
  const s = ctx.body.subscription;
  if (!s || !s.endpoint || !s.keys) fail(400, 'Abonnement invalide');
  DB.settings.adminPush = (DB.settings.adminPush || []).filter(x => x.endpoint !== s.endpoint).concat([{ endpoint: s.endpoint, keys: s.keys }]).slice(-10);
  saveDB(); return { ok: true };
});
route('GET', '/api/admin/preuve/:id', 'admin', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  if (!c.paiement.preuve) fail(404, 'Pas de capture');
  serveFile(ctx.res, path.join(PROOF_DIR, path.basename(c.paiement.preuve)), false);
  return 'STREAM';
});

// ---------- Réglages ----------
route('PUT', '/api/admin/boutique', 'admin', (ctx) => {
  const r = DB.settings.boutique, b = ctx.body;
  ['nom', 'slogan', 'tel', 'email', 'adresse', 'horaires', 'fuseau', 'yango', 'bandeau', 'facebook', 'instagram', 'tiktok'].forEach(k => { if (b[k] !== undefined) r[k] = str(b[k], 400); });
  if (b.whatsapp !== undefined) r.whatsapp = normTel(b.whatsapp).replace(/^\+/, '');
  ['lat', 'lng'].forEach(k => { if (b[k] !== undefined) r[k] = num(b[k]); });
  if (b.ouvert !== undefined) r.ouvert = !!b.ouvert;
  try { new Intl.DateTimeFormat('fr', { timeZone: r.fuseau }); } catch (e) { r.fuseau = 'Africa/Abidjan'; }
  saveDB(); toAllClients('catalogue', {}); return { ok: true, settings: adminSettings() };
});
route('PUT', '/api/admin/paiement', 'admin', (ctx) => {
  const P = DB.settings.paiement, b = ctx.body;
  if (b.modes) Object.keys(P.modes).forEach(k => {
    const m = b.modes[k]; if (!m) return;
    P.modes[k].actif = !!m.actif; ['numero', 'titulaire', 'lien', 'ussd'].forEach(f => { if (m[f] !== undefined) P.modes[k][f] = str(m[f], 300); });
    if (P.modes[k].lien && !/^https:\/\//.test(P.modes[k].lien)) P.modes[k].lien = '';
  });
  if (b.livraisonCash !== undefined) P.livraisonCash = !!b.livraisonCash;
  if (b.consignes !== undefined) P.consignes = str(b.consignes, 600);
  if (b.smsAuto !== undefined) P.smsAuto = !!b.smsAuto;
  if (b.nouvelleCleSms) P.smsCle = randomCode(24, 'abcdefghijkmnpqrstuvwxyz23456789');
  saveDB(); toAllClients('catalogue', {}); return { ok: true, settings: adminSettings() };
});
route('PUT', '/api/admin/livraison', 'admin', (ctx) => {
  const L = DB.settings.livraison, b = ctx.body;
  if (Array.isArray(b.zones)) L.zones = b.zones.slice(0, 30).map(z => ({ id: str(z.id, 30) || uid(), nom: str(z.nom, 80), exemples: str(z.exemples, 200), prix: Math.max(0, num(z.prix)) })).filter(z => z.nom);
  if (Array.isArray(b.villes)) L.villes = b.villes.slice(0, 200).map(v => ({ nom: str(v.nom, 60), km: Math.max(0, Math.round(num(v.km))) })).filter(v => v.nom).sort((a, b2) => a.km - b2.km);
  if (Array.isArray(b.tapisPaliers)) L.tapisPaliers = b.tapisPaliers.map(p => ({ min: Math.max(1, Math.round(num(p.min))), prix: Math.max(0, num(p.prix)) })).sort((a, c) => a.min - c.min);
  if (Array.isArray(b.colisPaliers)) L.colisPaliers = b.colisPaliers.map(p => ({ jusqua: Math.max(1, Math.round(num(p.jusqua))), prix: Math.max(0, num(p.prix)) })).sort((a, c) => a.jusqua - c.jusqua);
  if (Array.isArray(b.international)) L.international = b.international.slice(0, 40).map(i => ({ pays: str(i.pays, 60), prix: Math.max(0, num(i.prix)), note: str(i.note, 200) })).filter(i => i.pays);
  if (Array.isArray(b.creneaux)) L.creneaux = b.creneaux.map(c => str(c, 30)).filter(c => /^\d{2}:\d{2}/.test(c)).slice(0, 12);
  if (Array.isArray(b.jours)) L.jours = b.jours.map(Number).filter(d => d >= 0 && d <= 6);
  if (Array.isArray(b.joursFermes)) L.joursFermes = b.joursFermes.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 60);
  ['delaiHeures', 'joursMax'].forEach(k => { if (b[k] !== undefined) L[k] = Math.max(0, Math.round(num(b[k]))); });
  if (b.delaiExpedition !== undefined) L.delaiExpedition = str(b.delaiExpedition, 120);
  saveDB(); toAllClients('catalogue', {}); return { ok: true, settings: adminSettings() };
});
route('PUT', '/api/admin/ia', 'admin', (ctx) => {
  const I = DB.settings.ia, b = ctx.body;
  if (b.cle !== undefined && b.cle !== '') I.cle = str(b.cle, 300);
  if (b.effacerCle) I.cle = '';
  if (b.modele) I.modele = str(b.modele, 80);
  if (b.assistant !== undefined) I.assistant = !!b.assistant;
  saveDB(); toAllClients('catalogue', {}); return { ok: true, settings: adminSettings() };
});
route('PUT', '/api/admin/fidelite', 'admin', (ctx) => {
  const f = DB.settings.fidelite, b = ctx.body;
  if (b.actif !== undefined) f.actif = !!b.actif;
  ['pointsParMille', 'valeurPoint', 'seuilPoints'].forEach(k => { if (b[k] !== undefined) f[k] = Math.max(0, num(b[k])); });
  saveDB(); toAllClients('catalogue', {}); return { ok: true, settings: adminSettings() };
});
route('POST', '/api/admin/securite', 'admin', (ctx) => {
  const s = DB.settings, b = ctx.body;
  if (!safeEqual(hashSecret(b.currentPassword || '', s.pwSalt), s.pwHash)) fail(401, 'Mot de passe actuel incorrect');
  if (b.newUsername) s.adminUser = str(b.newUsername, 40);
  if (b.newPassword) { if (String(b.newPassword).length < 6) fail(400, 'Mot de passe trop court (6 min.)'); s.pwSalt = makeSalt(); s.pwHash = hashSecret(b.newPassword, s.pwSalt); }
  if (b.newDeleteCode) { if (String(b.newDeleteCode).length < 4) fail(400, 'Code trop court'); s.delSalt = makeSalt(); s.delHash = hashSecret(b.newDeleteCode, s.delSalt); }
  saveDB(); return { ok: true, username: s.adminUser };
});
route('POST', '/api/admin/upload', 'admin', (ctx) => ({ ok: true, url: '/uploads/' + saveImage(ctx.body.dataUrl) }));

// ---------- IA : fiche produit depuis une photo ----------
route('POST', '/api/admin/ia/fiche', 'admin', async (ctx) => {
  if (!iaCle()) fail(400, 'Ajoutez d’abord votre clé IA dans Réglages › Intelligence artificielle.');
  if (!rateOk('iafiche', 40, 10 * 60000)) fail(429, 'Patientez quelques minutes.');
  const imgs = (Array.isArray(ctx.body.images) ? ctx.body.images : []).slice(0, 4).map(imageToBlock).filter(Boolean);
  if (!imgs.length) fail(400, 'Ajoutez au moins une photo au produit.');
  const cats = DB.categories.map(c => `${c.cle || c.id} = ${c.nom}`).join(' ; ');
  const system = `Tu es un expert reconnu des ustensiles de cuisine (casseroles, marmites, revêtements granit/pierre, antiadhésif, inox, aluminium, émail, plats isothermes, porcelaine), du linge de maison et du marketing e-commerce en Côte d’Ivoire. Tu rédiges les fiches produits de la boutique de luxe ${DB.settings.boutique.nom} (Abidjan).
Règles strictes :
- Écris en français élégant, chaleureux, persuasif, adapté aux familles ivoiriennes (cuisine du quotidien, sauces, riz, attiéké, fêtes, mariages, dot).
- Base-toi UNIQUEMENT sur ce qui est visible sur les photos (matière apparente, nombre de pièces, couleurs, textes lisibles sur les boîtes). N’invente JAMAIS de certification, de garantie, de dimensions ou de compatibilité (induction, four, lave-vaisselle) qui ne sont pas lisibles. Si un texte de la boîte l’indique, précise « indiqué sur la boîte ».
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.`;
  const prompt = `Analyse ces photos et rédige la fiche produit. ${ctx.body.indications ? 'Indications du vendeur : ' + str(ctx.body.indications, 500) + '.' : ''}
Catégories possibles (clé = nom) : ${cats}.
JSON attendu :
{"nom": "nom commercial court et vendeur (max 60 caractères)",
 "categorie": "clé de la catégorie la plus adaptée",
 "contenu": "ce que contient le lot, ex. 5 marmites avec couvercles",
 "desc": "accroche de 2 phrases qui donne envie",
 "points": ["4 qualités concrètes visibles"],
 "bienfaits": ["4 bienfaits au quotidien pour la cliente"],
 "solution": "1 à 2 phrases : quel problème du quotidien ce produit règle",
 "pourquoi": "1 à 2 phrases : pourquoi passer à côté serait une vraie perte (sans mentir ni exagérer)",
 "entretien": "conseils d’entretien en 1 à 2 phrases",
 "variantes": ["coloris ou motifs visibles s’il y en a plusieurs, sinon liste vide"],
 "expedition": "tapis si c’est un tapis ou des pantoufles, sinon colis",
 "whatsapp": "message court et accrocheur pour un statut WhatsApp, avec 2 émojis maximum"}`;
  let txt;
  try { txt = await callClaude({ system, maxTokens: 1500, messages: [{ role: 'user', content: imgs.concat([{ type: 'text', text: prompt }]) }] }); }
  catch (e) { fail(502, e.message); }
  const m = txt.match(/\{[\s\S]*\}/);
  let fiche; try { fiche = JSON.parse(m ? m[0] : txt); } catch (e) { fail(502, 'L’IA a répondu dans un format inattendu. Réessayez.'); }
  const cat = DB.categories.find(c => c.cle === fiche.categorie || String(c.id) === String(fiche.categorie) || c.nom === fiche.categorie);
  fiche.categorieId = cat ? cat.id : null;
  return { ok: true, fiche };
});

// ---------- Catégories ----------
route('POST', '/api/admin/categories', 'admin', (ctx) => {
  const nom = str(ctx.body.nom, 60); if (!nom) fail(400, 'Nom requis');
  const c = { id: nextId(), cle: 'c' + uid(), nom, sousTitre: str(ctx.body.sousTitre, 80), couleur: str(ctx.body.couleur, 20) || '#C2410C', image: str(ctx.body.image, 200), actif: ctx.body.actif !== false, ordre: DB.categories.length + 1 };
  DB.categories.push(c); saveDB(); toAllClients('catalogue', {}); return { ok: true, categorie: c };
});
route('PUT', '/api/admin/categories/:id', 'admin', (ctx) => {
  const c = findOr404(DB.categories, ctx.params.id, 'Catégorie'), b = ctx.body;
  if (b.nom !== undefined) c.nom = str(b.nom, 60) || c.nom;
  if (b.sousTitre !== undefined) c.sousTitre = str(b.sousTitre, 80);
  if (b.couleur !== undefined) c.couleur = str(b.couleur, 20);
  if (b.image !== undefined) { const old = c.image; c.image = str(b.image, 200); if (old !== c.image) removeImage(old); }
  if (b.actif !== undefined) c.actif = !!b.actif;
  if (b.ordre !== undefined) c.ordre = num(b.ordre);
  saveDB(); toAllClients('catalogue', {}); return { ok: true, categorie: c };
});
route('POST', '/api/admin/categories/:id/delete', 'admin', (ctx) => {
  const c = findOr404(DB.categories, ctx.params.id, 'Catégorie');
  if (DB.produits.some(p => p.categorieId === c.id)) fail(409, 'Déplacez ou supprimez d’abord les produits de cette catégorie.');
  DB.categories = DB.categories.filter(x => x !== c); removeImage(c.image); saveDB(); toAllClients('catalogue', {});
  return { ok: true };
});

// ---------- Produits ----------
const arr = (v, max, len) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => str(x, len || 200)).filter(Boolean).slice(0, max || 10);
function applyProduit(p, b) {
  ['nom', 'ref', 'badge'].forEach(k => { if (b[k] !== undefined) p[k] = str(b[k], k === 'nom' ? 90 : 30); });
  ['desc', 'solution', 'pourquoi', 'entretien', 'contenu'].forEach(k => { if (b[k] !== undefined) p[k] = str(b[k], 900); });
  ['points', 'bienfaits'].forEach(k => { if (b[k] !== undefined) p[k] = arr(b[k], 8, 220); });
  if (b.prix !== undefined) p.prix = Math.max(0, Math.round(num(b.prix)));
  if (b.categorieId !== undefined) p.categorieId = Number(b.categorieId);
  if (b.expedition !== undefined) p.expedition = b.expedition === 'tapis' ? 'tapis' : 'colis';
  if (b.actif !== undefined) p.actif = !!b.actif;
  if (b.vedette !== undefined) p.vedette = !!b.vedette;
  if (b.stock !== undefined) p.stock = b.stock === null || b.stock === '' ? null : Math.max(0, Math.round(num(b.stock)));
  if (b.images !== undefined) {
    const old = p.images || [];
    p.images = (Array.isArray(b.images) ? b.images : []).map(x => str(x, 200)).filter(x => /^\/(uploads|catalogue)\//.test(x)).slice(0, 12);
    old.filter(u => !p.images.includes(u)).forEach(u => setTimeout(() => removeImage(u), 0));
  }
  if (b.variantes !== undefined) p.variantes = (Array.isArray(b.variantes) ? b.variantes : []).slice(0, 30).map(v => ({ id: str(v.id, 20) || uid(), nom: str(v.nom, 60), image: /^\/(uploads|catalogue)\//.test(v.image || '') ? str(v.image, 200) : '', dispo: v.dispo !== false })).filter(v => v.nom);
  if (b.promo !== undefined) {
    if (!b.promo || !num(b.promo.prix)) p.promo = null;
    else {
      const fin = new Date(b.promo.fin), debut = b.promo.debut ? new Date(b.promo.debut) : null;
      if (isNaN(fin)) fail(400, 'Date de fin de promo invalide');
      p.promo = { prix: Math.round(num(b.promo.prix)), fin: fin.toISOString(), debut: debut && !isNaN(debut) ? debut.toISOString() : null };
      if (p.promo.prix >= p.prix) fail(400, 'Le prix promo doit être inférieur au prix normal.');
    }
  }
}
route('POST', '/api/admin/produits', 'admin', (ctx) => {
  const p = { id: nextId(), ref: '', nom: '', categorieId: 0, prix: 0, promo: null, images: [], variantes: [], stock: null, expedition: 'colis', badge: 'Nouveau', vedette: false, actif: true,
    desc: '', points: [], bienfaits: [], solution: '', pourquoi: '', entretien: '', contenu: '', createdAt: nowIso(), ventes: 0 };
  applyProduit(p, ctx.body);
  if (!p.nom) fail(400, 'Nom requis');
  if (!DB.categories.some(c => c.id === p.categorieId)) fail(400, 'Choisissez une catégorie');
  DB.produits.unshift(p); saveDB(); toAllClients('catalogue', {});
  let pushes = 0;
  if (ctx.body.notifier && p.actif) pushes = broadcast(`Nouveau chez ${DB.settings.boutique.nom} ✨`, `${p.nom}${p.prix ? ' — ' + F(prixDe(p)) : ''}. Découvrez-le avant tout le monde !`, p.images[0], '/?p=' + p.id).pushes;
  return { ok: true, produit: p, pushes };
});
route('PUT', '/api/admin/produits/:id', 'admin', (ctx) => {
  const p = findOr404(DB.produits, ctx.params.id, 'Produit');
  const avant = promoActive(p) ? p.promo.prix : null;
  applyProduit(p, ctx.body);
  saveDB(); toAllClients('catalogue', {});
  let pushes = 0;
  if (ctx.body.notifier && p.actif) {
    if (promoActive(p) && avant !== p.promo.prix) pushes = broadcast('Prix cassé ⏳', `${p.nom} : ${F(p.promo.prix)} au lieu de ${F(p.prix)} — jusqu’au ${new Date(p.promo.fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: DB.settings.boutique.fuseau })}.`, p.images[0], '/?p=' + p.id).pushes;
    else pushes = broadcast(`${DB.settings.boutique.nom} ✨`, `${p.nom}${p.prix ? ' — ' + F(prixDe(p)) : ''}. À découvrir maintenant.`, p.images[0], '/?p=' + p.id).pushes;
  }
  return { ok: true, produit: p, pushes };
});
route('POST', '/api/admin/produits/prix', 'admin', (ctx) => {
  // modification rapide de plusieurs prix
  const l = Array.isArray(ctx.body.liste) ? ctx.body.liste : [];
  l.forEach(x => { const p = DB.produits.find(y => y.id === Number(x.id)); if (p) { if (x.prix !== undefined) p.prix = Math.max(0, Math.round(num(x.prix))); if (x.stock !== undefined) p.stock = x.stock === '' || x.stock === null ? null : Math.max(0, Math.round(num(x.stock))); } });
  saveDB(); toAllClients('catalogue', {}); return { ok: true };
});
route('POST', '/api/admin/produits/:id/delete', 'admin', (ctx) => {
  const p = findOr404(DB.produits, ctx.params.id, 'Produit');
  DB.produits = DB.produits.filter(x => x !== p);
  p.images.concat(p.variantes.map(v => v.image)).forEach(u => removeImage(u));
  saveDB(); toAllClients('catalogue', {}); return { ok: true };
});

// ---------- Bannières ----------
route('POST', '/api/admin/banners', 'admin', (ctx) => {
  const b = ctx.body;
  const ban = { id: nextId(), image: str(b.image, 200), titre: str(b.titre, 80), texte: str(b.texte, 200), lien: str(b.lien, 40), actif: b.actif !== false, ordre: DB.banners.length + 1 };
  if (!ban.image && !ban.titre) fail(400, 'Ajoutez une image ou un titre');
  DB.banners.push(ban); saveDB(); toAllClients('catalogue', {}); return { ok: true, banner: ban };
});
route('PUT', '/api/admin/banners/:id', 'admin', (ctx) => {
  const ban = findOr404(DB.banners, ctx.params.id, 'Bannière'), b = ctx.body;
  ['titre', 'texte', 'lien'].forEach(k => { if (b[k] !== undefined) ban[k] = str(b[k], 200); });
  if (b.image !== undefined) { const old = ban.image; ban.image = str(b.image, 200); if (old !== ban.image) removeImage(old); }
  if (b.actif !== undefined) ban.actif = !!b.actif;
  if (b.ordre !== undefined) ban.ordre = num(b.ordre);
  saveDB(); toAllClients('catalogue', {}); return { ok: true, banner: ban };
});
route('POST', '/api/admin/banners/:id/delete', 'admin', (ctx) => {
  const ban = findOr404(DB.banners, ctx.params.id, 'Bannière');
  DB.banners = DB.banners.filter(x => x !== ban); removeImage(ban.image); saveDB(); toAllClients('catalogue', {}); return { ok: true };
});

// ---------- Commandes ----------
route('POST', '/api/admin/commandes/:id/statut', 'admin', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande'), b = ctx.body;
  if (b.statut === 'expediee') {
    c.expedition = { transporteur: str(b.transporteur, 80), code: str(b.code, 60), lieu: str(b.lieu, 160), at: nowIso() };
  }
  const extra = b.statut === 'expediee' && c.expedition ? [c.expedition.transporteur && 'Transporteur : ' + c.expedition.transporteur, c.expedition.code && 'N° de colis : ' + c.expedition.code, c.expedition.lieu && 'Retrait : ' + c.expedition.lieu].filter(Boolean).join(' · ') : str(b.message, 300);
  try { setStatut(c, b.statut, extra); } catch (e) { fail(409, e.message); }
  return { ok: true, commande: c };
});
route('POST', '/api/admin/commandes/:id/paiement', 'admin', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande'), b = ctx.body;
  if (c.statut === 'annulee') fail(409, 'Commande annulée');
  if (b.action === 'valider') { if (c.paiement.statut === 'paye') fail(409, 'Déjà payé'); validerPaiement(c, 'gestion'); }
  else if (b.action === 'refuser') {
    c.paiement.statut = 'refuse'; c.paiement.motifRefus = str(b.motif, 300) || 'Paiement introuvable';
    c.historique.push({ statut: 'paiement_refuse', at: nowIso() });
    notifyClient(c.clientId, 'Paiement non retrouvé', `Commande n°${c.numero} : ${c.paiement.motifRefus}. Vérifiez la référence ou écrivez-nous sur WhatsApp.`, { type: 'commande', ref: c.id });
  } else if (b.action === 'especes') { validerPaiement(c, 'gestion'); c.paiement.mode = str(b.mode, 20) || c.paiement.mode; }
  else fail(400, 'Action inconnue');
  saveDB(); diffuserCommande(c);
  return { ok: true, commande: c };
});
route('POST', '/api/admin/commandes/:id/livreur', 'admin', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande'), b = ctx.body;
  if (c.livraison.mode !== 'livraison') fail(409, 'Cette commande n’est pas une livraison.');
  let l = b.livreurId ? DB.livreurs.find(x => x.id === Number(b.livreurId)) : null;
  if (!l && b.nom) { l = { id: nextId(), nom: str(b.nom, 60), tel: normTel(b.tel), actif: true }; DB.livreurs.push(l); }
  if (!l) fail(400, 'Choisissez un livreur');
  c.livreur = { id: l.id, nom: l.nom, tel: l.tel };
  if (!c.livreurKey) c.livreurKey = randomCode(12);
  if (c.statut !== 'en_route') { try { setStatut(c, 'en_route', `Livreur : ${l.nom}${l.tel ? ' (' + l.tel + ')' : ''}.`); } catch (e) { fail(409, e.message); } }
  else { saveDB(); diffuserCommande(c); }
  return { ok: true, commande: c, lien: `/livreur.html?c=${c.id}&k=${c.livreurKey}` };
});
route('POST', '/api/admin/commandes/:id/note', 'admin', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  c.noteInterne = str(ctx.body.note, 600); saveDB(); toAdmin('commande', c); return { ok: true };
});
route('POST', '/api/admin/commandes/:id/avis', 'admin', (ctx) => {
  const c = findOr404(DB.commandes, ctx.params.id, 'Commande');
  if (!c.avis) fail(404, 'Pas d’avis'); c.avis.masque = !!ctx.body.masque; saveDB(); toAllClients('catalogue', {}); return { ok: true, commande: c };
});
route('POST', '/api/admin/commandes', 'admin', (ctx) => {
  // commande prise par téléphone / WhatsApp
  const b = ctx.body;
  let calc; try { calc = computeOrder(b, null); } catch (e) { fail(400, e.message); }
  const tel = normTel(b.tel);
  let cl = tel ? DB.clients.find(x => x.tel === tel && !x.supprime) : null;
  if (!cl) { cl = { id: nextId(), nom: str(b.clientNom, 60) || 'Client', tel, invite: true, points: 0, push: [], tokens: [], createdAt: nowIso() }; DB.clients.push(cl); }
  calc.lignes.forEach(l => { const p = DB.produits.find(x => x.id === l.produitId); if (p.stock !== null && p.stock !== undefined) p.stock -= l.qte; });
  const mode = String(b.paiement || 'livraison');
  const c = { id: nextId(), numero: DB.nextNumero++, at: nowIso(), clientId: cl.id, clientNom: str(b.clientNom, 60) || cl.nom, tel,
    lignes: calc.lignes, sousTotal: calc.sousTotal, frais: calc.frais, remise: 0, pointsUtilises: 0, total: calc.sousTotal + calc.frais,
    livraison: calc.livraison, note: str(b.note, 400), paiement: { mode, statut: mode === 'livraison' ? 'a_la_livraison' : (b.paye ? 'paye' : 'en_attente'), montant: calc.sousTotal + calc.frais, reference: str(b.reference, 40), payeur: '', preuve: '', at: b.paye ? nowIso() : '' },
    statut: 'confirmee', historique: [{ statut: 'recue', at: nowIso() }, { statut: 'confirmee', at: nowIso() }], recuKey: randomCode(16), livreur: null, livreurPos: null, chatLivreur: [], proche: null, source: str(b.source, 20) || 'whatsapp' };
  DB.commandes.push(c); saveDB(); toAdmin('commande', c);
  return { ok: true, commande: c };
});
route('GET', '/api/admin/export.csv', 'admin', (ctx) => {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Numéro', 'Date', 'Client', 'Téléphone', 'Articles', 'Sous-total', 'Frais', 'Remise', 'Total', 'Mode', 'Zone/Ville', 'Paiement', 'Statut paiement', 'Référence', 'Statut'].join(';')];
  DB.commandes.forEach(c => rows.push([c.numero, new Date(c.at).toLocaleString('fr-FR'), c.clientNom, c.tel, c.lignes.map(l => `${l.qte}x ${l.nom}${l.variante ? ' (' + l.variante + ')' : ''}`).join(' | '), c.sousTotal, c.frais, c.remise, c.total, c.livraison.mode, c.livraison.zone || c.livraison.ville || c.livraison.pays, c.paiement.mode, c.paiement.statut, c.paiement.reference, c.statut].map(q).join(';')));
  const body = '﻿' + rows.join('\r\n');
  ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="commandes-tawali-souk.csv"' });
  ctx.res.end(body); return 'STREAM';
});

// ---------- Livreurs ----------
route('POST', '/api/admin/livreurs', 'admin', (ctx) => {
  const nom = str(ctx.body.nom, 60); if (!nom) fail(400, 'Nom requis');
  const l = { id: nextId(), nom, tel: normTel(ctx.body.tel), actif: true }; DB.livreurs.push(l); saveDB(); return { ok: true, livreur: l };
});
route('POST', '/api/admin/livreurs/:id/delete', 'admin', (ctx) => {
  DB.livreurs = DB.livreurs.filter(l => l.id !== Number(ctx.params.id)); saveDB(); return { ok: true };
});

// ---------- Messages aux clients ----------
route('POST', '/api/admin/annonces', 'admin', (ctx) => {
  const titre = str(ctx.body.titre, 80), corps = str(ctx.body.corps, 500);
  if (!titre || !corps) fail(400, 'Titre et message requis');
  const r = broadcast(fillTemplate(titre), fillTemplate(corps), str(ctx.body.image, 200), str(ctx.body.url, 100));
  return { ok: true, annonce: r.annonce, pushes: r.pushes, enLigne: clientStreams.size + publicStreams.size };
});
function applyProg(p, b) {
  if (b.titre !== undefined) p.titre = str(b.titre, 80);
  if (b.corps !== undefined) p.corps = str(b.corps, 500);
  if (b.heure !== undefined) { if (!/^\d{2}:\d{2}$/.test(b.heure)) fail(400, 'Heure invalide'); p.heure = b.heure; }
  if (b.jours !== undefined) p.jours = (Array.isArray(b.jours) ? b.jours : []).map(Number).filter(d => d >= 0 && d <= 6);
  if (b.actif !== undefined) p.actif = !!b.actif;
}
route('POST', '/api/admin/programmes', 'admin', (ctx) => {
  const p = { id: nextId(), titre: '', corps: '', heure: '10:00', jours: [0, 1, 2, 3, 4, 5, 6], actif: true, dernierEnvoi: '' };
  applyProg(p, ctx.body); if (!p.titre || !p.corps) fail(400, 'Titre et message requis');
  const lp = localParts(DB.settings.boutique.fuseau); if (lp.time > p.heure) p.dernierEnvoi = lp.date;
  DB.programmes.push(p); saveDB(); return { ok: true, programme: p };
});
route('PUT', '/api/admin/programmes/:id', 'admin', (ctx) => {
  const p = findOr404(DB.programmes, ctx.params.id, 'Message'); const wasOff = !p.actif; applyProg(p, ctx.body);
  const lp = localParts(DB.settings.boutique.fuseau);
  if ((ctx.body.heure !== undefined || (wasOff && p.actif)) && lp.time > p.heure) p.dernierEnvoi = lp.date;
  saveDB(); return { ok: true, programme: p };
});
route('POST', '/api/admin/programmes/:id/delete', 'admin', (ctx) => { DB.programmes = DB.programmes.filter(p => p.id !== Number(ctx.params.id)); saveDB(); return { ok: true }; });
route('POST', '/api/admin/programmes/:id/envoyer', 'admin', (ctx) => {
  const p = findOr404(DB.programmes, ctx.params.id, 'Message'); return { ok: true, pushes: broadcast(fillTemplate(p.titre), fillTemplate(p.corps)).pushes };
});

// ---------- Devis ----------
route('POST', '/api/admin/devis/:id', 'admin', (ctx) => {
  const d = findOr404(DB.devis, ctx.params.id, 'Devis'), st = ctx.body.statut;
  if (!['propose', 'refuse', 'termine'].includes(st)) fail(400, 'Statut invalide');
  d.statut = st; if (ctx.body.montant !== undefined) d.montant = num(ctx.body.montant); if (ctx.body.reponse !== undefined) d.reponse = str(ctx.body.reponse, 1500);
  saveDB();
  if (st === 'propose') notifyClient(d.clientId, 'Votre devis est prêt', `${d.type} : ${F(d.montant)}. Ouvrez l’application pour l’accepter.`, { type: 'devis', ref: d.id, url: '/?vue=devis' });
  if (st === 'refuse') notifyClient(d.clientId, 'Réponse à votre demande', d.reponse || 'Nous ne pouvons pas donner suite à cette demande.', { type: 'devis', ref: d.id, url: '/?vue=devis' });
  toClient(d.clientId, 'devis', d); toAdmin('devis', d); return { ok: true, devis: d };
});

// ---------- Discussion ----------
route('POST', '/api/admin/chat/:clientId', 'admin', (ctx) => {
  const cl = findOr404(DB.clients, ctx.params.clientId, 'Client');
  const texte = str(ctx.body.texte, 1000); if (!texte) fail(400, 'Message vide');
  const m = { id: nextId(), clientId: cl.id, de: 'boutique', texte, at: nowIso(), lu: false };
  DB.chats.push(m); DB.chats.forEach(x => { if (x.clientId === cl.id && x.de === 'client') x.lu = true; });
  saveDB();
  toClient(cl.id, 'chat', m); toAdmin('chat', Object.assign({ clientNom: cl.nom, clientTel: cl.tel }, m));
  sendPush(cl, { title: DB.settings.boutique.nom, body: texte, tag: 'chat', url: '/?vue=chat' });
  return { ok: true, message: m };
});
route('POST', '/api/admin/chat/:clientId/lu', 'admin', (ctx) => {
  DB.chats.forEach(x => { if (x.clientId === Number(ctx.params.clientId) && x.de === 'client') x.lu = true; }); saveDB(); return { ok: true };
});
route('POST', '/api/admin/sms/:id/associer', 'admin', (ctx) => {
  const s = findOr404(DB.smsLog, ctx.params.id, 'SMS'), c = findOr404(DB.commandes, ctx.body.commandeId, 'Commande');
  if (c.paiement.statut === 'paye') fail(409, 'Déjà payé');
  validerPaiement(c, 'gestion', s); saveDB(); diffuserCommande(c); return { ok: true };
});

// ============================================================
// SERVEUR
// ============================================================
const server = http.createServer(async (req, res) => {
  let parsed;
  try { parsed = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
  let urlPath; try { urlPath = decodeURIComponent(parsed.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  try {
    if (urlPath.startsWith('/api/')) {
      const r = routes.find(x => x.method === req.method && x.re.test(urlPath));
      if (!r) return sendJSON(res, 404, { ok: false, error: 'Route inconnue' });
      const m = r.re.exec(urlPath); const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const ctx = { req, res, params, query: parsed.searchParams, ip, body: {} };
      if (r.auth === 'admin') {
        if (!getSession(req)) return sendJSON(res, 401, { ok: false, error: 'Non authentifié' });
        // protection CSRF : les requêtes d'écriture de la gestion doivent venir du même site
        if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return sendJSON(res, 403, { ok: false, error: 'Origine refusée' });
      }
      if (r.auth === 'client' || r.auth === 'stream-client') {
        ctx.client = getClient(req, r.auth === 'stream-client' ? parsed.searchParams : null);
        if (!ctx.client) return sendJSON(res, 401, { ok: false, error: 'Session expirée, reconnectez-vous.' });
      }
      if (req.method === 'POST' || req.method === 'PUT') ctx.body = await readBody(req);
      const out = await r.handler(ctx);
      if (out === 'STREAM') return;
      return sendJSON(res, 200, out);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (urlPath.startsWith('/uploads/')) return serveFile(res, path.join(UPLOAD_DIR, path.basename(urlPath)), true);
    const safe = urlPath === '/' ? '/index.html' : urlPath;
    const fp = path.normalize(path.join(PUBLIC_DIR, safe));
    if (!fp.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    return serveFile(res, fp, /^\/(vendor|fonts|catalogue|img)\//.test(safe));
  } catch (e) {
    if (e instanceof HttpError) return sendJSON(res, e.status, { ok: false, error: e.message });
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { ok: false, error: 'Erreur serveur' });
  }
});

loadDB();
backupIfNeeded();
setInterval(backupIfNeeded, 6 * 3600 * 1000);

server.listen(PORT, () => {
  const ips = [];
  Object.values(os.networkInterfaces()).forEach(l => (l || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); }));
  console.log('\n==========================================================');
  console.log('   ' + DB.settings.boutique.nom + ' — serveur démarré (port ' + PORT + ')');
  console.log('   Boutique  : http://localhost:' + PORT);
  console.log('   Gestion   : http://localhost:' + PORT + '/gestion.html');
  ips.forEach(ip => console.log('   Sur le Wi-Fi : http://' + ip + ':' + PORT));
  console.log('==========================================================');
  if (!DB.settings.setupDone) console.log('   Première utilisation : ouvrez /gestion.html pour créer votre accès.');
  console.log('');
});
