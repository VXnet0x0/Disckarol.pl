require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// ensure data dir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));

// ensure other data files exist with sensible defaults
const INFOS_FILE = path.join(DATA_DIR, 'informations.json');
const SUBS_FILE = path.join(DATA_DIR, 'subscribers.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
if (!fs.existsSync(INFOS_FILE)) fs.writeFileSync(INFOS_FILE, JSON.stringify({ informations: [] }, null, 2));
if (!fs.existsSync(SUBS_FILE)) fs.writeFileSync(SUBS_FILE, JSON.stringify({ subscribers: [] }, null, 2));
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify({ messages: [] }, null, 2));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const cors = require('cors');
app.use(cors({ origin: process.env.PUBLIC_URL || true, credentials: true }));
app.use(express.static('public'));

// file uploads (Per-user uploads stored under data/uploads/<username>)
const multer = require('multer');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
// serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.session && req.session.username;
    if (!username) return cb(new Error('login required'));
    const userDir = path.join(UPLOADS_DIR, username);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/ig, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage });

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  // require username, email and password
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email and password required' });
  // simple email validation
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
  if (password.length < 6) return res.status(400).json({ error: 'password too short (min 6)' });
  const store = readUsers();
  if (store.users.find(u => u.username === username)) return res.status(400).json({ error: 'username exists' });
  if (store.users.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase())) return res.status(400).json({ error: 'email exists' });
  const hash = await bcrypt.hash(password, 12);
  const user = { id: Date.now(), username, email, passwordHash: hash };
  store.users.push(user);
  writeUsers(store);
  req.session.username = user.username;
  res.json({ ok: true, username: user.username, profile: { email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  // accept username (or email) + password
  const { username, email, password } = req.body;
  const store = readUsers();
  let user = null;
  if (username) user = store.users.find(u => u.username === username);
  if (!user && email) user = store.users.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(400).json({ error: 'invalid username or email' });
  if (!user.passwordHash) return res.status(400).json({ error: 'account has no local password (use social login)' });
  const match = await bcrypt.compare(password || '', user.passwordHash);
  if (!match) return res.status(400).json({ error: 'invalid credentials' });
  req.session.username = user.username;
  res.json({ ok: true, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Google Sign-in token verification and login
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential required' });
  try {
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const resp = await fetch(verifyUrl);
    if (!resp.ok) return res.status(400).json({ error: 'invalid token' });
    const info = await resp.json();
    // Optionally verify audience
    if (process.env.GOOGLE_CLIENT_ID && info.aud && info.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: 'token audience mismatch' });
    }
    const email = info.email || (`google_${info.sub}`);
    const store = readUsers();
    let user = store.users.find(u => u.username === email);
    if (!user) {
      user = { id: Date.now(), username: email, passwordHash: null, google: true, displayName: info.name || '', email: info.email || '', picture: info.picture || '' };
      store.users.push(user);
    } else {
      // update profile data
      user.displayName = info.name || user.displayName || '';
      user.email = info.email || user.email || '';
      user.picture = info.picture || user.picture || '';
    }
    writeUsers(store);
    req.session.username = user.username;
    res.json({ ok: true, username: user.username, profile: { displayName: user.displayName, email: user.email, picture: user.picture } });
  } catch (err) {
    console.error('google signin', err);
    res.status(500).json({ error: 'verify failed' });
  }
});

// Expose public config (GOOGLE_CLIENT_ID, MS_CLIENT_ID)
app.get('/api/config', (req, res) => {
  res.json({ GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || null, MS_CLIENT_ID: process.env.MS_CLIENT_ID || null });
});

app.get('/api/me', (req, res) => {
  res.json({ username: req.session.username || null });
});

// Microsoft sign-in (accepts access_token returned by MSAL on client)
app.post('/api/auth/microsoft', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token required' });
  try {
    const meResp = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!meResp.ok) {
      const txt = await meResp.text();
      console.error('ms graph error', meResp.status, txt);
      return res.status(400).json({ error: 'invalid token' });
    }
    const info = await meResp.json();
    const email = info.mail || info.userPrincipalName || `ms_${info.id}`;
    const store = readUsers();
    let user = store.users.find(u => u.username === email);
    if (!user) {
      user = { id: Date.now(), username: email, passwordHash: null, microsoft: true, displayName: info.displayName || '', email };
      store.users.push(user);
    } else {
      user.displayName = user.displayName || info.displayName || '';
      user.email = user.email || email;
      user.microsoft = true;
    }
    writeUsers(store);
    req.session.username = user.username;
    res.json({ ok: true, username: user.username, profile: { displayName: user.displayName, email: user.email } });
  } catch (err) {
    console.error('microsoft signin', err);
    res.status(500).json({ error: 'verify failed' });
  }
});

// GitHub OAuth redirect
app.get('/auth/github', (req, res) => {
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const state = Math.random().toString(36).slice(2);
  req.session._oauth_state = state;
  const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID || '', redirect_uri: `${base}/auth/github/callback`, scope: 'read:user user:email', state });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session._oauth_state) return res.status(400).send('invalid state');
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${base}/auth/github/callback`, state })
    });
    const tokenJson = await tokenResp.json();
    const access_token = tokenJson.access_token;
    if (!access_token) return res.status(400).send('token failed');
    const userResp = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${access_token}`, 'User-Agent': 'dsn-service' } });
    const user = await userResp.json();
    let email = user.email;
    if (!email) {
      const emailsResp = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `token ${access_token}`, 'User-Agent': 'dsn-service' } });
      const emails = await emailsResp.json();
      const primary = (emails && emails.find && emails.find(e => e.primary)) || (emails && emails[0]);
      email = primary && primary.email;
    }
    const username = email || `gh_${user.id}`;
    const store = readUsers();
    let u = store.users.find(x => x.username === username);
    if (!u) {
      u = { id: Date.now(), username, passwordHash: null, github: true, displayName: user.name || user.login, email, picture: user.avatar_url || null };
      store.users.push(u);
    } else {
      u.github = true; u.displayName = u.displayName || user.name || user.login; u.email = u.email || email; u.picture = u.picture || user.avatar_url;
    }
    writeUsers(store);
    req.session.username = u.username;
    res.redirect(process.env.PUBLIC_URL || '/');
  } catch (err) {
    console.error('github oauth', err);
    res.status(500).send('github auth failed');
  }
});

// File upload endpoints
app.post('/api/files/upload', upload.array('files', 10), (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const files = (req.files || []).map(f => ({ filename: path.basename(f.path), url: `/uploads/${req.session.username}/${path.basename(f.path)}`, size: f.size }));
  res.json({ ok: true, files });
});

app.get('/api/files', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const userDir = path.join(UPLOADS_DIR, req.session.username);
  if (!fs.existsSync(userDir)) return res.json([]);
  const list = fs.readdirSync(userDir).map(name => {
    const full = path.join(userDir, name); const st = fs.statSync(full);
    return { filename: name, url: `/uploads/${req.session.username}/${name}`, size: st.size, mtime: st.mtime };
  });
  res.json(list);
});

app.delete('/api/files/:name', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const name = req.params.name;
  const full = path.join(UPLOADS_DIR, req.session.username, name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'not found' });
  try { fs.unlinkSync(full); return res.json({ ok: true }); } catch (err) { console.error('del file', err); return res.status(500).json({ error: 'delete failed' }); }
});

// DisckVirtual page routes
app.get('/DisckVirtual.pl', (req, res) => res.sendFile(path.join(__dirname, 'public', 'DisckVirtual.html')));
app.get('/DisckVisrtual.pl', (req, res) => res.sendFile(path.join(__dirname, 'public', 'DisckVirtual.html')));

// DriveYT page
app.get('/DriveYT.pl', (req, res) => res.sendFile(path.join(__dirname, 'public', 'DriveYT.html')));
app.get('/DriveYT', (req, res) => res.sendFile(path.join(__dirname, 'public', 'DriveYT.html')));

// Public profile page
app.get('/profile/:username', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));

// User profile endpoint — returns profile for logged-in user
app.get('/api/user', (req, res) => {
  if (!req.session.username) return res.json({});
  const store = readUsers();
  const user = store.users.find(u => u.username === req.session.username);
  if (!user) return res.json({});
  res.json({ username: user.username, displayName: user.displayName || null, email: user.email || null, picture: user.picture || null, google: !!user.google });
});

// health check
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Public info endpoint — returns public URL if set in env
app.get('/api/info', (req, res) => {
  const publicUrl = process.env.PUBLIC_URL || null;
  // If not set, try to infer when behind proxy/azure
  const inferred = (req.headers && req.headers.host) ? `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers.host}` : null;
  res.json({ publicUrl: publicUrl || inferred });
});

// Search endpoint: queries multiple sources (Wikipedia, Bing/MSN, DuckDuckGo)
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  const region = req.query.region || 'en'; // locale for wiki (en, pl, etc.)
  const sourcesParam = (req.query.sources || 'wikipedia,bing,duck').toLowerCase();
  const sources = sourcesParam.split(',').map(s => s.trim());
  if (!q) return res.status(400).json({ error: 'q required' });

  try {
    const result = {};

    // Wikipedia
    if (sources.includes('wikipedia') || sources.includes('wiki')) {
      const wikiUrl = `https://${region}.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5`;
      const wikiResp = await fetch(wikiUrl, { headers: { 'User-Agent': 'dsn-service-demo/1.0' } });
      const wikiJson = await wikiResp.json();
      const wikiResults = (wikiJson.query && wikiJson.query.search) ? wikiJson.query.search.map(s => ({
        title: s.title,
        snippet: s.snippet.replace(/<.*?>/g, ''),
        source: 'wikipedia',
        link: `https://${region}.wikipedia.org/wiki/${encodeURIComponent(s.title)}`
      })) : [];
      result.wikipedia = wikiResults;
    }

    // Bing / MSN (Bing Web Search API)
    if (sources.includes('bing') || sources.includes('msn')) {
      const bingKey = process.env.BING_API_KEY;
      let bingResults = [];
      if (bingKey) {
        const bingUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(q)}&count=5`;
        const bingResp = await fetch(bingUrl, { headers: { 'Ocp-Apim-Subscription-Key': bingKey } });
        if (bingResp.ok) {
          const bingJson = await bingResp.json();
          const webPages = (bingJson.webPages && bingJson.webPages.value) || [];
          bingResults = webPages.map(w => ({ title: w.name, snippet: w.snippet, source: 'bing', link: w.url }));
        }
      }
      result.bing = bingResults;
    }

    // DuckDuckGo Instant Answer API (no key required)
    if (sources.includes('duck') || sources.includes('duckduckgo')) {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
      const ddgResp = await fetch(ddgUrl, { headers: { 'User-Agent': 'dsn-service-demo/1.0' } });
      const ddgJson = await ddgResp.json();
      const ddgResults = [];
      if (ddgJson && ddgJson.AbstractText) {
        ddgResults.push({ title: ddgJson.Heading || q, snippet: ddgJson.AbstractText, source: 'duckduckgo', link: ddgJson.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}` });
      }
      if (ddgJson && ddgJson.RelatedTopics && ddgJson.RelatedTopics.length) {
        ddgJson.RelatedTopics.slice(0, 5).forEach(rt => {
          if (rt.Text) ddgResults.push({ title: (rt.Text||'').split(' - ')[0], snippet: rt.Text, source: 'duckduckgo', link: rt.FirstURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}` });
          else if (rt.Topics) rt.Topics.slice(0,3).forEach(t => ddgResults.push({ title: t.Text, snippet: t.Text, source:'duckduckgo', link: t.FirstURL }));
        });
      }
      result.duck = ddgResults;
    }

    res.json({ q, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'search failed' });
  }
});

// Basic catch-all front-end
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve additional pages
app.get('/service', (req, res) => res.sendFile(path.join(__dirname, 'public', 'service.html')));
app.get('/service.pl', (req, res) => res.sendFile(path.join(__dirname, 'public', 'service.html'))); // alias path per request
app.get('/menu', (req, res) => res.sendFile(path.join(__dirname, 'public', 'menu.html')));
app.get('/informations', (req, res) => res.sendFile(path.join(__dirname, 'public', 'informations.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));

// Informations & Subscribers storage (files ensured above)
function readInfos() { return JSON.parse(fs.readFileSync(INFOS_FILE)); }
function writeInfos(d) { fs.writeFileSync(INFOS_FILE, JSON.stringify(d, null, 2)); }
function readSubs() { return JSON.parse(fs.readFileSync(SUBS_FILE)); }
function writeSubs(d) { fs.writeFileSync(SUBS_FILE, JSON.stringify(d, null, 2)); }
function readMessages() { return JSON.parse(fs.readFileSync(MESSAGES_FILE)); }
function writeMessages(d) { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(d, null, 2)); }

// List informations (adds `liked` flag per current user and authorLink)
app.get('/api/informations', (req, res) => {
  const store = readInfos();
  const username = req.session.username;
  const out = (store.informations || []).map(i => ({ id: i.id, title: i.title, content: i.content, author: i.author, authorLink: `/profile/${encodeURIComponent(i.author)}`, likes: i.likes || 0, liked: (i.likedBy||[]).includes(username) }));
  res.json(out);
});

// Current user's informations
app.get('/api/my-informations', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const store = readInfos();
  const mine = (store.informations || []).filter(i => i.author === req.session.username).map(i => ({ id: i.id, title: i.title, content: i.content, author: i.author, likes: i.likes || 0 }));
  res.json(mine);
});

// Get informations by author (public)
app.get('/api/author/:username', (req, res) => {
  const username = req.params.username;
  const store = readInfos();
  const storeUsers = readUsers();
  const infos = (store.informations || []).filter(i => i.author === username).map(i => ({ id: i.id, title: i.title, content: i.content, likes: i.likes || 0 }));
  const user = (storeUsers.users || []).find(u => u.username === username);
  res.json({ profile: { username, displayName: user ? user.displayName || username : username, picture: user ? user.picture || null : null }, informations: infos });
});

// Get single information
app.get('/api/informations/:id', (req, res) => {
  const id = Number(req.params.id);
  const store = readInfos();
  const item = (store.informations || []).find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

// Create
app.post('/api/informations', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  const store = readInfos();
  const info = { id: Date.now(), title, content, author: req.session.username, likes: 0, likedBy: [] };
  store.informations.unshift(info);
  writeInfos(store);
  res.json(info);
});

// Edit
app.put('/api/informations/:id', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const id = Number(req.params.id);
  const { title, content } = req.body;
  const store = readInfos();
  const item = store.informations.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  if (item.author !== req.session.username) return res.status(403).json({ error: 'forbidden' });
  if (title) item.title = title; if (content) item.content = content;
  writeInfos(store);
  res.json({ ok: true, item });
});

// Delete
app.delete('/api/informations/:id', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const id = Number(req.params.id);
  const store = readInfos();
  const idx = store.informations.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const item = store.informations[idx];
  if (item.author !== req.session.username) return res.status(403).json({ error: 'forbidden' });
  store.informations.splice(idx, 1);
  writeInfos(store);
  res.json({ ok: true });
});

// Like/unlike (toggle)
app.post('/api/informations/:id/like', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const id = Number(req.params.id);
  const store = readInfos();
  const item = store.informations.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  item.likedBy = item.likedBy || [];
  const idx = item.likedBy.indexOf(req.session.username);
  if (idx === -1) { item.likedBy.push(req.session.username); item.likes = (item.likes||0)+1; }
  else { item.likedBy.splice(idx,1); item.likes = Math.max(0, (item.likes||0)-1); }
  writeInfos(store);
  res.json({ ok: true, likes: item.likes, liked: (item.likedBy||[]).includes(req.session.username) });
});

// Subscribe
app.post('/api/subscribe', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const subs = readSubs();
  if (!subs.subscribers) subs.subscribers = [];
  // prevent duplicates by username or phone
  if (subs.subscribers.find(s => s.username === req.session.username || s.phone === phone)) return res.json({ ok: true, note: 'already' });
  subs.subscribers.push({ username: req.session.username, phone, id: Date.now() });
  writeSubs(subs);
  res.json({ ok: true });
});

// List subscribers (requires login for demo)
app.get('/api/subscribers', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const subs = readSubs();
  res.json(subs.subscribers || []);
});

// Send SMS to all subscribers (requires TWILIO env)
async function sendSms(to, text) {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log('SMS mock ->', to, text);
    return { ok: 'mock' };
  }
  const twilio = require('twilio')(sid, token);
  return twilio.messages.create({ body: text, from, to });
}

app.post('/api/sms/send', async (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const subs = readSubs();
  const recipients = subs.subscribers || [];
  const results = [];
  for (const s of recipients) {
    try {
      const r = await sendSms(s.phone, message);
      results.push({ phone: s.phone, status: 'sent' });
    } catch (err) {
      console.error('sms error', err);
      results.push({ phone: s.phone, status: 'error' });
    }
  }
  res.json({ ok: true, count: results.length, results });
});

// Archive.org search endpoint
app.get('/api/archive', async (req, res) => {
  const q = req.query.q;
  const mediatype = req.query.mediatype || 'all';
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    let url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}`;
    if (mediatype && mediatype !== 'all') {
      url += `+AND+mediatype:${encodeURIComponent(mediatype)}`;
    }
    url += '&fl[]=identifier&fl[]=title&fl[]=description&fl[]=mediatype&fl[]=downloads&output=json&rows=20';
    
    const r = await fetch(url, { headers: { 'User-Agent': 'dsn-service-demo/1.0' } });
    if (!r.ok) return res.status(500).json({ error: 'archive.org search failed' });
    const j = await r.json();
    const docs = (j.response && j.response.docs) || [];
    const items = docs.map(doc => ({
      identifier: doc.identifier,
      title: doc.title || doc.identifier,
      description: (doc.description || '').slice(0, 200),
      mediatype: doc.mediatype,
      downloads: doc.downloads || 0,
      link: `https://archive.org/details/${doc.identifier}`,
      downloadLink: `https://archive.org/download/${doc.identifier}`
    }));
    res.json({ items });
  } catch (err) {
    console.error('archive.org', err);
    res.status(500).json({ error: 'archive.org error' });
  }
});

// List all users (for messaging)
app.get('/api/users', (req, res) => {
  const store = readUsers();
  const users = (store.users || []).map(u => ({
    username: u.username,
    displayName: u.displayName || u.username,
    picture: u.picture || null
  }));
  res.json(users);
});

// Messaging endpoints
app.get('/api/messages/conversations', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const store = readMessages();
  const messages = store.messages || [];
  const username = req.session.username;
  
  // Get unique conversations
  const convMap = {};
  messages.forEach(m => {
    if (m.from === username || m.to === username) {
      const other = m.from === username ? m.to : m.from;
      if (!convMap[other] || convMap[other].timestamp < m.timestamp) {
        convMap[other] = {
          withUser: other,
          lastMessage: m.text.slice(0, 50),
          timestamp: m.timestamp,
          unread: m.to === username && !m.read
        };
      }
    }
  });
  
  const conversations = Object.values(convMap).sort((a, b) => b.timestamp - a.timestamp);
  res.json(conversations);
});

app.get('/api/messages/:username', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const otherUser = req.params.username;
  const store = readMessages();
  const messages = (store.messages || []).filter(m =>
    (m.from === req.session.username && m.to === otherUser) ||
    (m.from === otherUser && m.to === req.session.username)
  ).sort((a, b) => a.timestamp - b.timestamp);
  
  // Mark as read
  let changed = false;
  messages.forEach(m => {
    if (m.to === req.session.username && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) writeMessages(store);
  
  res.json(messages);
});

app.post('/api/messages/send', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'to and text required' });
  
  const store = readMessages();
  if (!store.messages) store.messages = [];
  
  const message = {
    id: Date.now(),
    from: req.session.username,
    to,
    text,
    timestamp: Date.now(),
    read: false
  };
  store.messages.push(message);
  writeMessages(store);
  res.json({ ok: true, message });
});

// Add reply to information/post
app.post('/api/informations/:id/reply', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const id = Number(req.params.id);
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  
  const store = readInfos();
  const item = store.informations.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  
  if (!item.replies) item.replies = [];
  item.replies.push({
    id: Date.now(),
    author: req.session.username,
    text,
    timestamp: Date.now()
  });
  writeInfos(store);
  res.json({ ok: true });
});

// YouTube search endpoint — requires YOUTUBE_API_KEY env
app.get('/api/youtube', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'q required' });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(400).json({ error: 'YOUTUBE_API_KEY not configured' });
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${key}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'dsn-service-demo/1.0' } });
    if (!r.ok) return res.status(500).json({ error: 'youtube search failed' });
    const j = await r.json();
    const items = (j.items || []).map(it => ({ title: it.snippet.title, description: it.snippet.description, videoId: it.id.videoId, channelTitle: it.snippet.channelTitle, channelId: it.snippet.channelId, link: `https://www.youtube.com/watch?v=${it.id.videoId}`, channelLink: `https://www.youtube.com/channel/${it.snippet.channelId}` }));
    res.json({ items });
  } catch (err) { console.error('youtube', err); res.status(500).json({ error: 'youtube error' }); }
});

// AI search — simple summarization using YouTube results or fallback to Wikipedia snippets; requires login
app.post('/api/ai/search', async (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'login required' });
  const q = req.body.q;
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
      // fetch top youtube results and build a short summary
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(q)}&key=${key}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'dsn-service-demo/1.0' } });
      const j = await r.json();
      const items = (j.items || []).map(it => ({ title: it.snippet.title, description: it.snippet.description, link: `https://www.youtube.com/watch?v=${it.id.videoId}`, channelTitle: it.snippet.channelTitle, channelLink: `https://www.youtube.com/channel/${it.snippet.channelId}` }));
      // simple summary: concatenate top titles and short descriptions
      const summary = items.map((it, idx) => `${idx+1}. ${it.title} — ${ (it.description||'').split('\n')[0].slice(0,140) }`).join('\n');
      return res.json({ summary, videos: items });
    }
    // fallback: use wikipedia search snippets and combine
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5`;
    const w = await fetch(wikiUrl, { headers: { 'User-Agent': 'dsn-service-demo/1.0' } }); const wj = await w.json();
    const snippets = (wj.query && wj.query.search || []).map(s => `${s.title}: ${s.snippet.replace(/<.*?>/g,'').slice(0,120)}`);
    const summary = snippets.join('\n');
    res.json({ summary, snippets });
  } catch (err) { console.error('ai search', err); res.status(500).json({ error: 'ai failed' }); }
});

// 404 page route
app.get('/404', (req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

// catch-all: serve 404 page for unknown routes (keep above app.listen)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => console.log(`DSN demo running on http://localhost:${PORT} (map dsn.com to localhost to use dsn.com)`));
