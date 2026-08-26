/**
 * 本地 CORS 中转：浏览器 → 本服务 → 上游 API
 *
 * 用法：
 *   cd proxy
 *   npm start
 *
 * 设置里 URL 填（二选一）：
 *   1) 动态上游：http://127.0.0.1:8787/https://api.example.com/v1
 *   2) 固定上游：设环境变量 UPSTREAM=https://api.example.com/v1
 *               设置里填 http://127.0.0.1:8787/v1
 *
 * 密钥仍在网页设置里填写，会原样转发 Authorization。
 */
'use strict';

var http = require('http');
var https = require('https');
var { URL } = require('url');

var PORT = Number(process.env.PORT || 8787);
var HOST = process.env.HOST || '127.0.0.1';
var UPSTREAM = String(process.env.UPSTREAM || '')
  .trim()
  .replace(/\/+$/, '');

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization,Content-Type,Accept,X-Requested-With,X-Target-Base',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body, extraHeaders) {
  var headers = Object.assign(
    {
      'Content-Type': 'application/json; charset=utf-8',
    },
    CORS_HEADERS,
    extraHeaders || {},
  );
  res.writeHead(status, headers);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) {
      chunks.push(c);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/**
 * 从请求解析上游完整 URL
 * - /https://host/path... → https://host/path...
 * - /http://host/path...  → http://host/path...
 * - /v1/... + UPSTREAM    → UPSTREAM + /v1/...
 */
function resolveTarget(req) {
  var rawUrl = req.url || '/';
  var q = rawUrl.indexOf('?');
  var pathOnly = q >= 0 ? rawUrl.slice(0, q) : rawUrl;
  var search = q >= 0 ? rawUrl.slice(q) : '';
  var path = decodeURIComponent(pathOnly);

  if (path === '/' || path === '/health') {
    return { kind: 'health' };
  }

  var rest = path.replace(/^\/+/, '');
  if (/^https?:\/\//i.test(rest)) {
    return { kind: 'proxy', target: rest + search };
  }

  /* 兼容 /https:/host （偶发少一个斜杠） */
  if (/^https?:\//i.test(rest) && !/^https?:\/\//i.test(rest)) {
    return { kind: 'proxy', target: rest.replace(/^(https?:\/)/i, '$1/') + search };
  }

  if (UPSTREAM) {
    var suffix = path.charAt(0) === '/' ? path : '/' + path;
    return { kind: 'proxy', target: UPSTREAM + suffix + search };
  }

  return {
    kind: 'error',
    status: 400,
    body: {
      error:
        '无法解析上游地址。请使用 http://' +
        HOST +
        ':' +
        PORT +
        '/https://api.example.com/v1 ，或设置环境变量 UPSTREAM。',
    },
  };
}

function forward(req, res, targetUrl, bodyBuf) {
  var u;
  try {
    u = new URL(targetUrl);
  } catch (e) {
    send(res, 400, { error: '无效上游 URL: ' + targetUrl });
    return;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    send(res, 400, { error: '仅支持 http/https 上游' });
    return;
  }

  var lib = u.protocol === 'https:' ? https : http;
  var headers = {};
  Object.keys(req.headers || {}).forEach(function (k) {
    var lk = k.toLowerCase();
    if (lk === 'host' || lk === 'origin' || lk === 'referer' || lk === 'connection') return;
    if (lk === 'content-length') return;
    headers[k] = req.headers[k];
  });
  headers.host = u.host;
  if (bodyBuf && bodyBuf.length) {
    headers['content-length'] = String(bodyBuf.length);
  }

  var opts = {
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method: req.method,
    headers: headers,
  };

  var upstream = lib.request(opts, function (upRes) {
    var outHeaders = Object.assign({}, CORS_HEADERS);
    Object.keys(upRes.headers || {}).forEach(function (k) {
      var lk = k.toLowerCase();
      if (lk === 'access-control-allow-origin') return;
      if (lk === 'access-control-allow-headers') return;
      if (lk === 'access-control-allow-methods') return;
      if (lk === 'transfer-encoding') return;
      outHeaders[k] = upRes.headers[k];
    });
    res.writeHead(upRes.statusCode || 502, outHeaders);
    upRes.pipe(res);
  });

  upstream.on('error', function (err) {
    if (!res.headersSent) {
      send(res, 502, { error: '上游请求失败: ' + String((err && err.message) || err) });
    } else {
      res.destroy(err);
    }
  });

  if (bodyBuf && bodyBuf.length && req.method !== 'GET' && req.method !== 'HEAD') {
    upstream.write(bodyBuf);
  }
  upstream.end();
}

var server = http.createServer(async function (req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  var parsed = resolveTarget(req);
  if (parsed.kind === 'health') {
    send(res, 200, {
      ok: true,
      service: 'tq-local-proxy',
      host: HOST,
      port: PORT,
      upstream: UPSTREAM || null,
      usage: {
        dynamic: 'http://' + HOST + ':' + PORT + '/https://api.example.com/v1',
        fixed: UPSTREAM
          ? 'http://' + HOST + ':' + PORT + '/v1  （UPSTREAM=' + UPSTREAM + '）'
          : '设置 UPSTREAM 后使用 http://' + HOST + ':' + PORT + '/v1',
      },
    });
    return;
  }

  if (parsed.kind === 'error') {
    send(res, parsed.status || 400, parsed.body);
    return;
  }

  try {
    var bodyBuf = await readBody(req);
    console.log('[proxy]', req.method, '→', parsed.target);
    forward(req, res, parsed.target, bodyBuf);
  } catch (e) {
    send(res, 500, { error: String((e && e.message) || e) });
  }
});

server.listen(PORT, HOST, function () {
  console.log('[tq-local-proxy] http://' + HOST + ':' + PORT);
  if (UPSTREAM) {
    console.log('[tq-local-proxy] UPSTREAM =', UPSTREAM);
  } else {
    console.log(
      '[tq-local-proxy] 动态模式：网页 URL 填 http://' +
        HOST +
        ':' +
        PORT +
        '/https://你的API/v1',
    );
  }
});
