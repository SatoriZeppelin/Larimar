/**
 * 可选本地代理 —— 解决浏览器直连 AI API 的 CORS 问题
 *
 * 用法：
 *   cd src/天青/proxy
 *   npm install
 *   npm start
 *
 * 网页设置里只需填 API/反向代理的 URL。直连失败时会自动经本机
 * http://127.0.0.1:8787 转发（请求头带 X-TQ-Upstream）。
 *
 * 这不是必须的：若你的 API 允许浏览器跨域，可不启动本代理。
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8787);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TQ-Upstream, X-TQ-Api-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, name: 'SummerNight Plus proxy', port: PORT }));
    return;
  }

  if (req.method === 'GET' && /\/v1\/models\/?$/.test(req.url || '')) {
    try {
      const upstreamBase = (req.headers['x-tq-upstream'] || '').toString().replace(/\/+$/, '');
      const apiKey = (req.headers['x-tq-api-key'] || '').toString();
      if (!upstreamBase) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('缺少 X-TQ-Upstream（API Base URL）');
        return;
      }
      let target = upstreamBase;
      if (!/\/models$/i.test(target)) {
        target = /\/v1$/i.test(target) ? target + '/models' : target + '/v1/models';
      }

      const u = new URL(target);
      const lib = u.protocol === 'http:' ? http : https;
      const headers = {};
      if (apiKey) headers.Authorization = 'Bearer ' + apiKey;

      const preq = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === 'http:' ? 80 : 443),
          path: u.pathname + u.search,
          method: 'GET',
          headers,
        },
        (pres) => {
          const chunks = [];
          pres.on('data', (c) => chunks.push(c));
          pres.on('end', () => {
            const buf = Buffer.concat(chunks);
            res.writeHead(pres.statusCode || 502, {
              'Content-Type': pres.headers['content-type'] || 'application/json',
            });
            res.end(buf);
          });
        },
      );
      preq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('上游请求失败: ' + err.message);
      });
      preq.end();
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(e && e.message ? e.message : e));
    }
    return;
  }

  if (req.method === 'POST' && /\/v1\/chat\/completions\/?$/.test(req.url || '')) {
    try {
      const upstreamBase = (req.headers['x-tq-upstream'] || '').toString().replace(/\/+$/, '');
      const apiKey = (req.headers['x-tq-api-key'] || '').toString();
      if (!upstreamBase) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('缺少 X-TQ-Upstream（API Base URL）');
        return;
      }
      let target = upstreamBase;
      if (!/\/chat\/completions$/i.test(target)) {
        target = /\/v1$/i.test(target) ? target + '/chat/completions' : target + '/v1/chat/completions';
      }

      const body = await readBody(req);
      const u = new URL(target);
      const lib = u.protocol === 'http:' ? http : https;
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      };
      if (apiKey) headers.Authorization = 'Bearer ' + apiKey;

      const preq = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === 'http:' ? 80 : 443),
          path: u.pathname + u.search,
          method: 'POST',
          headers,
        },
        (pres) => {
          const chunks = [];
          pres.on('data', (c) => chunks.push(c));
          pres.on('end', () => {
            const buf = Buffer.concat(chunks);
            res.writeHead(pres.statusCode || 502, {
              'Content-Type': pres.headers['content-type'] || 'application/json',
            });
            res.end(buf);
          });
        },
      );
      preq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('上游请求失败: ' + err.message);
      });
      preq.write(body);
      preq.end();
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(e && e.message ? e.message : e));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[SummerNight Plus proxy] http://127.0.0.1:' + PORT);
  console.log('在网页设置里填写代理地址即可；关掉本窗口即停止代理。');
});
