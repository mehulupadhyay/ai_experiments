const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a cryptographically secure invite token.
 * Format: base64url(uuid + timestamp + random bytes) signed with HMAC
 */
function generateInviteToken() {
  const raw = `${uuidv4()}.${Date.now()}.${crypto.randomBytes(16).toString('hex')}`;
  const sig = crypto
    .createHmac('sha256', process.env.INVITE_SECRET || 'fallback-secret')
    .update(raw)
    .digest('base64url');
  return `${Buffer.from(raw).toString('base64url')}.${sig}`;
}

function verifyInviteToken(token) {
  try {
    const [rawB64, sig] = token.split('.');
    if (!rawB64 || !sig) return false;
    const raw = Buffer.from(rawB64, 'base64url').toString();
    const expected = crypto
      .createHmac('sha256', process.env.INVITE_SECRET || 'fallback-secret')
      .update(raw)
      .digest('base64url');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = { generateInviteToken, verifyInviteToken };
