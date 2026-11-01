// CORS helper — allows the report (any origin, including localhost) to call the API

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

function handleCors(handler) {
  return async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    return handler(req, res);
  };
}

module.exports = { handleCors };
