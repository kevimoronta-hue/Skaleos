const { requireAuth, ghGetFile, ghPutFile } = require('./_lib');

const CONTENT_PATH = () => process.env.CONTENT_PATH || 'content.json';

function extFromDataUrl(durl) {
  const m = /^data:image\/(\w+);base64,/.exec(durl);
  return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'png';
}

async function uploadImagesInPlace(data) {
  // Walks caseStudies logoSrc/avatarSrc and any *Src fields that are data: URLs,
  // uploads each to assets/uploads/, and rewrites the field to the committed path.
  const jobs = [];
  (data.caseStudies || []).forEach((cs, i) => {
    ['logoSrc', 'avatarSrc'].forEach((field) => {
      const val = cs[field];
      if (val && val.startsWith('data:image')) {
        const ext = extFromDataUrl(val);
        const path = `assets/uploads/${cs.key || 'case' + i}-${field}.${ext}`;
        const base64 = val.split(',')[1];
        jobs.push(
          ghPutFile(path, base64, `admin: update ${field} for ${cs.key || i}`, null, true).then(() => {
            cs[field] = path;
          })
        );
      }
    });
  });
  await Promise.all(jobs);
  return data;
}

module.exports = async (req, res) => {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  if (req.method === 'GET') {
    try {
      const { content } = await ghGetFile(CONTENT_PATH());
      return res.status(200).json(content ? JSON.parse(content) : {});
    } catch (e) {
      return res.status(500).json({ error: 'Lecture impossible' });
    }
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    try {
      await uploadImagesInPlace(body);
      const { sha } = await ghGetFile(CONTENT_PATH());
      await ghPutFile(CONTENT_PATH(), JSON.stringify(body, null, 2), 'admin: update content.json', sha, false);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Écriture impossible: ' + e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
