const { clearAuthCookie } = require('./_lib');

module.exports = async (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
};
