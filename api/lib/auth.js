// API key validation
function validateApiKey(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return { valid: false, error: 'Invalid Authorization header format' };
  }

  const expectedKey = process.env.API_KEY;
  if (!expectedKey) {
    return { valid: false, error: 'API_KEY not configured' };
  }

  if (token !== expectedKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}

function requireAuth(handler) {
  return async (req, res) => {
    const auth = validateApiKey(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    return handler(req, res);
  };
}

module.exports = { validateApiKey, requireAuth };
