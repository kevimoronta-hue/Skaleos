const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function verifyPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, 'sha256');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const COOKIE_NAME = 'sk_admin';

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

function setAuthCookie(res, token) {
  const maxAge = 8 * 60 * 60; // 8h
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`);
}

function requireAuth(req) {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function signToken(username) {
  return jwt.sign({ sub: username }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

// --- GitHub Contents API helpers ---
const GH_API = 'https://api.github.com';

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function ghGetFile(path) {
  const { GITHUB_REPO, GITHUB_BRANCH } = process.env;
  const url = `${GH_API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH || 'main'}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return { content: null, sha: null };
  if (!r.ok) throw new Error('GitHub read failed: ' + r.status);
  const j = await r.json();
  const content = Buffer.from(j.content, 'base64').toString('utf-8');
  return { content, sha: j.sha };
}

async function ghPutFile(path, contentStr, message, sha, isBase64) {
  const { GITHUB_REPO, GITHUB_BRANCH } = process.env;
  const url = `${GH_API}/repos/${GITHUB_REPO}/contents/${path}`;
  const body = {
    message,
    content: isBase64 ? contentStr : Buffer.from(contentStr, 'utf-8').toString('base64'),
    branch: GITHUB_BRANCH || 'main',
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('GitHub write failed: ' + r.status + ' ' + t);
  }
  return r.json();
}

module.exports = { requireAuth, signToken, setAuthCookie, clearAuthCookie, ghGetFile, ghPutFile, verifyPassword };
