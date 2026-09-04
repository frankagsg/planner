import config from '../config.js';

// Only allow requests from private/loopback ranges (LAN) OR a valid admin token.
// This keeps reboot/shutdown/restore off the public internet even if the port
// were somehow exposed.

function isPrivateIp(ip) {
  if (!ip) return false;
  const v = ip.replace('::ffff:', '');
  if (v === '127.0.0.1' || v === '::1' || v === 'localhost') return true;
  if (v.startsWith('10.')) return true;
  if (v.startsWith('192.168.')) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = v.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  // fc00::/7 unique local
  if (/^f[cd]/i.test(v)) return true;
  return false;
}

export function adminAuth(req, res, next) {
  const provided = req.get('x-admin-token') || req.query.adminToken;
  if (config.adminToken) {
    if (provided && provided === config.adminToken) return next();
    // Token configured but not provided → reject unless clearly local.
  }
  const ip = req.ip || req.socket?.remoteAddress;
  if (isPrivateIp(ip)) return next();

  return res.status(403).json({
    error: 'Admin action not permitted from this network. Provide a valid admin token.',
  });
}

export { isPrivateIp };
