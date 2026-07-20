/**
 * SummerNight Plus · system 资源（全部走 Hugging Face 在线链接，不读本地图）
 *
 * 来源仓库：https://huggingface.co/think-denim-frisk/Larimar
 * - 滚动条：https://huggingface.co/think-denim-frisk/Larimar/blob/main/system/滚动条.png
 * - 图标：  https://huggingface.co/think-denim-frisk/Larimar/blob/main/system/icon.png
 * - 主界面：https://huggingface.co/think-denim-frisk/Larimar/blob/main/system/主页面.png
 * - 主界面视频：https://huggingface.co/think-denim-frisk/Larimar/blob/main/system/主页面视频.mp4
 *
 * 对外：window.天青_system
 */
(function () {
  var HF_BASE = 'https://huggingface.co/think-denim-frisk/Larimar/resolve/main/system/';
  var SCROLLBAR_THUMB = HF_BASE + encodeURIComponent('滚动条.png');
  var ICON = HF_BASE + 'icon.png';
  var TITLE_BG = HF_BASE + encodeURIComponent('主页面.png');
  var TITLE_VIDEO = HF_BASE + encodeURIComponent('主页面视频.mp4');

  function applyScrollbarThumb() {
    document.documentElement.style.setProperty(
      '--scrollbar-thumb-image',
      'url("' + SCROLLBAR_THUMB + '")',
    );
  }

  function applyTitleBackground() {
    document.documentElement.style.setProperty(
      '--title-screen-bg-image',
      'url("' + TITLE_BG + '")',
    );
  }

  function isTitleVideoDisabled() {
    if (window.天青_settings && window.天青_settings.isTitleVideoDisabled) {
      return !!window.天青_settings.isTitleVideoDisabled();
    }
    try {
      var raw = JSON.parse(localStorage.getItem('tq_plus_ui') || '{}') || {};
      return !!raw.disableTitleVideo;
    } catch (e) {
      return false;
    }
  }

  function applyTitleVideo() {
    var el = document.getElementById('title-screen-video');
    if (!el) return;
    if (isTitleVideoDisabled()) {
      document.documentElement.classList.add('title-video-off');
      try {
        el.pause();
      } catch (e) {}
      return;
    }
    document.documentElement.classList.remove('title-video-off');
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    if (el.getAttribute('src') !== TITLE_VIDEO) {
      el.src = TITLE_VIDEO;
    }
    var play = function () {
      var p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          /* 自动播放被拦时保留静音循环源，等用户交互后再播 */
        });
      }
    };
    if (el.readyState >= 2) play();
    else el.addEventListener('canplay', play, { once: true });
  }

  function ensureIconLink() {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      document.head.appendChild(link);
    }
    return link;
  }

  /** 画到正方形画布上，等比 contain，避免被浏览器强行拉扁/拉宽 */
  function paintContainedIcon(img, size) {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    if (!ctx || !img.width || !img.height) return '';
    var scale = Math.min(size / img.width, size / img.height);
    var w = img.width * scale;
    var h = img.height * scale;
    var x = (size - w) / 2;
    var y = (size - h) / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, x, y, w, h);
    return canvas.toDataURL('image/png');
  }

  function applyFavicon() {
    var link = ensureIconLink();
    link.href = ICON;

    var img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var dataUrl = paintContainedIcon(img, 64);
        if (dataUrl) link.href = dataUrl;
      } catch (e) {
        /* 跨域污染画布时退回原链接 */
        link.href = ICON;
      }
    };
    img.onerror = function () {
      link.href = ICON;
    };
    img.src = ICON;
  }

  window.天青_system = {
    scrollbarThumb: SCROLLBAR_THUMB,
    icon: ICON,
    titleBackground: TITLE_BG,
    titleVideo: TITLE_VIDEO,
    applyScrollbarThumb: applyScrollbarThumb,
    applyTitleBackground: applyTitleBackground,
    applyTitleVideo: applyTitleVideo,
    applyFavicon: applyFavicon,
  };

  applyScrollbarThumb();
  applyTitleBackground();
  applyTitleVideo();
  applyFavicon();

  document.addEventListener(
    'pointerdown',
    function oncePlay() {
      applyTitleVideo();
    },
    { once: true, passive: true },
  );
})();
