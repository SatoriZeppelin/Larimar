/**
 * 解析并执行 AI 输出的 stat_data 变量命令：_.set / _.add / _.append
 * 对外：window.天青_variable_commands
 */
(function () {
  function normalizePath(path) {
    var p = String(path || '').trim();
    if (p.indexOf('stat_data.') === 0) p = p.slice('stat_data.'.length);
    return p;
  }

  function pathParts(path) {
    return normalizePath(path)
      .split('.')
      .filter(Boolean);
  }

  function clone(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      return v;
    }
  }

  function parseCommandValue(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {}
    if (
      (raw.charAt(0) === "'" && raw.charAt(raw.length - 1) === "'") ||
      (raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"')
    ) {
      return raw.slice(1, -1);
    }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
      var n = Number(raw);
      if (!isNaN(n)) return n;
    }
    return raw;
  }

  function splitTopLevelCommas(raw) {
    var out = [];
    var cur = '';
    var depth = 0;
    var quote = '';
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (quote) {
        cur += ch;
        if (ch === quote && raw[i - 1] !== '\\') quote = '';
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === '[' || ch === '(') {
        depth++;
        cur += ch;
        continue;
      }
      if (ch === ']' || ch === ')') {
        depth--;
        cur += ch;
        continue;
      }
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function parseStatement(stmt) {
    stmt = String(stmt || '').trim();
    if (!stmt) return null;
    if (!stmt.endsWith(')')) stmt += ')';
    var m = stmt.match(/^_\.(set|add|append)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]+)\)\s*;?\s*$/);
    if (!m) return null;
    var cmd = m[1];
    var path = m[2].trim();
    var valueRaw = m[3].trim();
    if (cmd === 'set') {
      var first = valueRaw.charAt(0);
      if (first !== '[' && first !== "'" && first !== '"') {
        var parts = splitTopLevelCommas(valueRaw);
        if (parts.length >= 2) valueRaw = parts[parts.length - 1].trim();
      }
    }
    return { cmd: cmd, path: path, value: parseCommandValue(valueRaw) };
  }

  function parseStatements(raw) {
    var out = [];
    String(raw || '')
      .trim()
      .split(/\r?\n/)
      .forEach(function (line) {
        var trimmed = line.trim();
        if (!trimmed) return;
        trimmed
          .split(/\)\s*;\s*/)
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
          .forEach(function (chunk) {
            var stmt = parseStatement(chunk.endsWith(')') ? chunk : chunk + ')');
            if (stmt) out.push(stmt);
          });
      });
    return out;
  }

  function digGet(root, parts) {
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function digSet(root, parts, value) {
    if (!parts.length) return root;
    var cur = root;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object' || Array.isArray(cur[k])) {
        cur[k] = {};
      }
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    return root;
  }

  function applyOne(data, stmt) {
    var parts = pathParts(stmt.path);
    if (!parts.length) return false;
    if (stmt.cmd === 'set') {
      digSet(data, parts, clone(stmt.value));
      return true;
    }
    if (stmt.cmd === 'add') {
      var cur = digGet(data, parts);
      var n = parseFloat(cur);
      var delta = parseFloat(stmt.value);
      if (isNaN(n)) n = 0;
      if (isNaN(delta)) return false;
      digSet(data, parts, n + delta);
      return true;
    }
    if (stmt.cmd === 'append') {
      var arr = digGet(data, parts);
      if (!Array.isArray(arr)) arr = [];
      arr = arr.slice();
      arr.push(clone(stmt.value));
      digSet(data, parts, arr);
      return true;
    }
    return false;
  }

  function applyRaw(raw) {
    var api = window.天青_settings_variable;
    if (!api || typeof api.get !== 'function' || typeof api.set !== 'function') {
      console.warn('[天青 变量命令] settings_variable 未就绪');
      return { ok: false, count: 0 };
    }
    var stmts = parseStatements(raw);
    if (!stmts.length) return { ok: true, count: 0 };
    var data = clone(api.get() || {});
    var n = 0;
    stmts.forEach(function (stmt) {
      if (applyOne(data, stmt)) n++;
    });
    if (n > 0) {
      api.set(data);
      console.info('[天青 变量命令] 已应用 ' + n + ' 条');
      if (window.天青_phone_agency && typeof window.天青_phone_agency.render === 'function') {
        window.天青_phone_agency.render();
      }
    }
    return { ok: true, count: n };
  }

  window.天青_variable_commands = {
    applyRaw: applyRaw,
    parseStatements: parseStatements,
  };
})();
