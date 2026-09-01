const { signToken, setAuthCookie, ghGetFile, verifyPassword } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { username, password } = body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiants manquants' });

  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = validUser && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH || '');
  if (!validUser || !validPass) return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = signToken(username);
  setAuthCookie(res, token);

  try {
    const { content } = await ghGetFile(process.env.CONTENT_PATH || 'content.json');
    return res.status(200).json({ ok: true, content: content ? JSON.parse(content) : null });
  } catch (e) {
    return res.status(200).json({ ok: true, content: null, warning: 'content.json introuvable sur GitHub' });
  }
};
