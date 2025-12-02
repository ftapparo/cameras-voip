const crypto = require('crypto');
const http = require('http');

// Função para calcular digest authentication response
function calculateDigestResponse(username, password, realm, method, uri, nonce, qop, nc, cnonce) {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  
  let response;
  if (qop) {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
  } else {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  }
  
  return response;
}

// Middleware para autenticação digest
function digestAuthProxy(targetUrl, username, password) {
  return (req, res) => {
    const target = new URL(targetUrl);
    
    const options = {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + (req.url.startsWith('/') ? req.url.substring(1) : req.url),
      method: req.method,
      headers: {
        ...req.headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        host: target.hostname
      }
    };

    delete options.headers.host;
    delete options.headers.referer;
    delete options.headers.origin;

    const proxyReq = http.request(options, (proxyRes) => {
      if (proxyRes.statusCode === 401 && proxyRes.headers['www-authenticate']) {
        const authHeader = proxyRes.headers['www-authenticate'];
        
        if (authHeader.includes('Digest')) {
          const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
          const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
          const qop = authHeader.match(/qop="?([^",]+)"?/)?.[1];
          
          if (realm && nonce) {
            const nc = '00000001';
            const cnonce = crypto.randomBytes(16).toString('hex');
            const uri = options.path;
            
            const response = calculateDigestResponse(
              username, password, realm, req.method, uri, nonce, qop, nc, cnonce
            );
            
            let authValue = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
            
            if (qop) {
              authValue += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
            }
            
            // Fazer nova requisição com autenticação
            const authOptions = {
              ...options,
              headers: {
                ...options.headers,
                'Authorization': authValue
              }
            };
            
            const authReq = http.request(authOptions, (authRes) => {
              res.writeHead(authRes.statusCode, authRes.headers);
              authRes.pipe(res);
            });
            
            if (req.body) {
              authReq.write(req.body);
            }
            authReq.end();
            return;
          }
        }
      }
      
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.statusCode = 500;
      res.end('Proxy error');
    });
    
    if (req.body) {
      proxyReq.write(req.body);
    }
    proxyReq.end();
  };
}

module.exports = { digestAuthProxy };