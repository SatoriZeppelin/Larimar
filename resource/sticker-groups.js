/**
 * 表情包组 · 天青 Plus
 * 对外：window.天青_sticker_groups
 */
(function () {
  var RECENT_KEY = 'tq_plus_sticker_recent';
  var RECENT_MAX = 36;

  /** @type {{ id: string, name: string, stickerKeys?: string[] }[]} */
  var GROUP_DEFS = [
    {
      id: 'tianqing',
      name: '天青',
    },
  ];

  function stickerMap() {
    return window.天青_stickers && typeof window.天青_stickers === 'object' ? window.天青_stickers : {};
  }

  function allStickerKeys() {
    return Object.keys(stickerMap()).filter(function (k) {
      return stickerMap()[k];
    });
  }

  function stickersOfGroup(def) {
    if (def.stickerKeys && def.stickerKeys.length) {
      return def.stickerKeys.filter(function (k) {
        return stickerMap()[k];
      });
    }
    return allStickerKeys();
  }

  function getGroups() {
    var map = stickerMap();
    return GROUP_DEFS.map(function (def) {
      var stickers = stickersOfGroup(def);
      return {
        id: def.id,
        name: def.name,
        stickers: stickers,
        cover: stickers.length ? String(map[stickers[0]] || '') : '',
      };
    });
  }

  function getGroupById(id) {
    var groups = getGroups();
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === id) return groups[i];
    }
    return null;
  }

  function getGroupName(stickerName) {
    var name = String(stickerName || '');
    var groups = getGroups();
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].stickers.indexOf(name) >= 0) return groups[i].name;
    }
    return '';
  }

  function getStickerUrl(name) {
    return stickerMap()[name] || '';
  }

  function loadRecent() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      var map = stickerMap();
      return list.filter(function (n) {
        return map[n];
      });
    } catch (e) {
      return [];
    }
  }

  function pushRecent(name) {
    if (!name || !getStickerUrl(name)) return;
    var list = loadRecent().filter(function (n) {
      return n !== name;
    });
    list.unshift(name);
    if (list.length > RECENT_MAX) list.length = RECENT_MAX;
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  window.天青_sticker_groups = {
    getGroups: getGroups,
    getGroupById: getGroupById,
    getGroupName: getGroupName,
    getStickerUrl: getStickerUrl,
    loadRecent: loadRecent,
    pushRecent: pushRecent,
  };
})();
