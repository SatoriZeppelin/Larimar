/**
 * SummerNight Plus 入口
 */
(function () {
  var busy = false;
  var appBusy = false;
  var appLabel = '';
  var genEl = null;

  function genRoot() {
    if (!genEl) genEl = document.getElementById('gal-generating');
    return genEl;
  }

  function refreshGeneratingUi() {
    var el = genRoot();
    if (!el) return;
    var labelEl = el.querySelector('.gal-gen-label');
    var on = !!(busy || appBusy);
    var text = busy ? '正在生成正文' : appBusy ? appLabel || '正在生成' : '正在生成正文';
    if (labelEl) labelEl.textContent = text;
    if (on) {
      el.removeAttribute('hidden');
      el.classList.add('is-on');
    } else {
      el.classList.remove('is-on');
      el.setAttribute('hidden', '');
    }
  }

  function setBusy(v) {
    busy = !!v;
    refreshGeneratingUi();
  }

  /**
   * 手机 APP 次生生成进度（主线结束后显示）
   * @param {{ active?: boolean, index?: number, total?: number, appName?: string }|null} opts
   */
  function setAppGenerating(opts) {
    if (!opts || !opts.active) {
      appBusy = false;
      appLabel = '';
      refreshGeneratingUi();
      return;
    }
    var total = Math.max(1, parseInt(opts.total, 10) || 1);
    var index = Math.max(1, parseInt(opts.index, 10) || 1);
    var name = String(opts.appName || 'APP').trim() || 'APP';
    appBusy = true;
    appLabel = '正在生成' + name + index + '/' + total;
    refreshGeneratingUi();
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  /** 生成失败时：恢复上一轮剧本，并停在该轮最后一句/选项 */
  function restorePrevRoundEnd() {
    if (!window.天青_parse || !window.天青_stage) return false;
    var raw = '';
    if (window.天青_save && window.天青_save.load) {
      var d = window.天青_save.load();
      raw = d && d.lastRaw ? String(d.lastRaw) : '';
    }
    if (!String(raw).trim()) raw = openingRaw();
    if (!String(raw).trim()) return false;

    var data;
    try {
      data = window.天青_parse.parseGal(raw);
    } catch (e) {
      console.warn('[SummerNight Plus] 失败回退解析失败', e);
      return false;
    }

    var choiceCb = function (c) {
      runGenerate(c);
    };
    if (window.天青_stage.abortStreamRound) {
      window.天青_stage.abortStreamRound();
    }
    window.天青_stage.loadGal(data, { onChoice: choiceCb });
    /* 停在上一轮末尾：有选项则出选项，否则最后一句 */
    if (window.天青_stage.skipToChoices) {
      window.天青_stage.skipToChoices();
    }
    return true;
  }

  async function runGenerate(userText) {
    if (busy) return;
    setBusy(true);
    var emitted = 0;
    var choiceCb = function (c) {
      runGenerate(c);
    };
    var apiCfg =
      window.天青_api && window.天青_api.loadConfig
        ? window.天青_api.loadConfig()
        : {};
    var liveStage = !!(apiCfg.stream && apiCfg.streamDisplay !== false);
    try {
      if (liveStage && window.天青_stage && window.天青_stage.beginStreamRound) {
        window.天青_stage.beginStreamRound({ onChoice: choiceCb });
      }
      var result = await window.天青_chat.generate(userText, {
        onDelta: liveStage
          ? function (full) {
              if (!window.天青_parse || !window.天青_parse.parseSummerNightPartial) return;
              if (!window.天青_stage || !window.天青_stage.appendStreamModules) return;
              var partial = window.天青_parse.parseSummerNightPartial(full);
              var mods = (partial && partial.modules) || [];
              if (mods.length > emitted) {
                window.天青_stage.appendStreamModules(mods.slice(emitted));
                emitted = mods.length;
              }
            }
          : undefined,
      });
      if (liveStage && window.天青_stage && window.天青_stage.finalizeStreamRound) {
        window.天青_stage.finalizeStreamRound(result.data, { onChoice: choiceCb });
      } else {
        if (window.天青_stage && window.天青_stage.abortStreamRound) {
          window.天青_stage.abortStreamRound();
        }
        window.天青_stage.loadGal(result.data, { onChoice: choiceCb });
      }
      if (window.天青_save && window.天青_save.autoSave) {
        window.天青_save.autoSave();
      }
      if (window.天青_title && window.天青_title.refreshContinueBtn) {
        window.天青_title.refreshContinueBtn();
      }
      if (window.天青_title && window.天青_title.refreshSaves) {
        window.天青_title.refreshSaves();
      }
      toast('生成完成');
    } catch (e) {
      restorePrevRoundEnd();
      console.error('[SummerNight Plus] AI 生成失败', e);
      if (window.天青_settings && window.天青_settings.showError) {
        window.天青_settings.showError(e);
      } else {
        toast(String(e.message || e));
      }
    } finally {
      setBusy(false);
    }
  }

  function openingRaw(openingId) {
    if (window.天青_opening_api && window.天青_opening_api.getRaw) {
      return window.天青_opening_api.getRaw(openingId);
    }
    return (window.天青_opening && String(window.天青_opening)) || '';
  }

  function loadDemo(openingId) {
    var demo = openingRaw(openingId);
    if (!demo) {
      console.warn('[SummerNight Plus] 开局剧情未加载');
      return;
    }
    var picked =
      window.天青_opening_api && window.天青_opening_api.get
        ? window.天青_opening_api.get(openingId)
        : null;
    if (picked && picked.raw) window.天青_opening = picked.raw;
    var data = window.天青_parse.parseGal(demo);
    if (window.天青_save && window.天青_save.save) {
      window.天青_save.save({
        messages: [{ role: 'assistant', content: demo, at: Date.now() }],
        lastRaw: demo,
        updatedAt: Date.now(),
        galIdx: 0,
        openingId: (picked && picked.id) || '',
      });
    }
    console.info(
      '[SummerNight Plus] 载入开局剧情',
      'lines=' + ((data && data.modules && data.modules.length) || 0),
      'choices=' + ((data && data.choices && data.choices.length) || 0),
    );
    window.天青_stage.loadGal(data, {
      onChoice: function (c) {
        runGenerate(c);
      },
    });
  }

  function resumeFromLastRaw() {
    var d = window.天青_save.load();
    var raw = d && d.lastRaw ? String(d.lastRaw) : '';
    if (raw && window.天青_parse) {
      try {
        var data = window.天青_parse.parseGal(raw);
        var hasLine =
          data &&
          Array.isArray(data.modules) &&
          data.modules.some(function (m) {
            return m && (m.type === 'line' || m.type === 'cg');
          });
        if (hasLine) {
          var startIndex = d && typeof d.galIdx === 'number' ? d.galIdx : 0;
          window.天青_stage.loadGal(data, {
            onChoice: function (c) {
              runGenerate(c);
            },
            startIndex: startIndex,
            instant: true,
          });
          if (window.天青_phone && typeof window.天青_phone.syncPhoneToMainMsgIndex === 'function') {
            window.天青_phone.syncPhoneToMainMsgIndex();
          }
          return true;
        }
        console.warn('[SummerNight Plus] 存档无可演出剧本，改用开局剧情');
      } catch (e) {
        console.warn('[SummerNight Plus] 恢复剧情失败', e);
      }
    }
    loadDemo();
    return false;
  }

  function startNewGame(openingId) {
    if (window.天青_save) window.天青_save.clear();
    if (window.天青_phone_line && window.天青_phone_line.resetToInitial) {
      window.天青_phone_line.resetToInitial();
    }
    if (window.天青_phone_twitter && window.天青_phone_twitter.resetToInitial) {
      window.天青_phone_twitter.resetToInitial();
    }
    if (window.天青_phone_twitch && window.天青_phone_twitch.resetToInitial) {
      window.天青_phone_twitch.resetToInitial();
    }
    loadDemo(openingId);
    if (window.天青_save && window.天青_save.autoSave) {
      window.天青_save.autoSave();
    }
  }

  function enterFromSave() {
    resumeFromLastRaw();
    toast('已继续游戏');
  }

  /** 回到上一轮对话开头（上一次选项后生成的那一段） */
  function rewindPrevRound() {
    if (busy) {
      toast('正在生成中…');
      return false;
    }
    if (!window.天青_save || !window.天青_parse) {
      toast('存档模块未就绪');
      return false;
    }
    var d = window.天青_save.load();
    var msgs = (d && d.messages) || [];
    var asstIdx = [];
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i] && msgs[i].role === 'assistant') asstIdx.push(i);
    }

    var raw = '';
    var nextMsgs = msgs;

    if (asstIdx.length >= 2) {
      var keepUntil = asstIdx[asstIdx.length - 2];
      raw = String(msgs[keepUntil].content || '');
      nextMsgs = msgs.slice(0, keepUntil + 1);
    } else {
      var opening = openingRaw();
      var cur = d && d.lastRaw ? String(d.lastRaw) : '';
      if (opening && cur && opening !== cur) {
        raw = opening;
        nextMsgs = [{ role: 'assistant', content: opening, at: Date.now() }];
      } else {
        toast('已经是最早一轮');
        return false;
      }
    }

    if (!String(raw).trim()) {
      toast('上一轮内容为空');
      return false;
    }

    var data;
    try {
      data = window.天青_parse.parseGal(raw);
    } catch (e) {
      console.warn('[SummerNight Plus] 解析上一轮失败', e);
      toast('无法解析上一轮');
      return false;
    }

    window.天青_save.save({
      messages: nextMsgs,
      lastRaw: raw,
      updatedAt: Date.now(),
      galIdx: 0,
    });

    if (window.天青_phone && typeof window.天青_phone.trimPhoneToMainMsgIndex === 'function') {
      var keepAsst = -1;
      for (var j = nextMsgs.length - 1; j >= 0; j--) {
        if (nextMsgs[j] && nextMsgs[j].role === 'assistant') {
          keepAsst = j;
          break;
        }
      }
      window.天青_phone.trimPhoneToMainMsgIndex(keepAsst);
    }

    window.天青_stage.loadGal(data, {
      onChoice: function (c) {
        runGenerate(c);
      },
    });
    if (window.天青_title && window.天青_title.refreshSaves) {
      window.天青_title.refreshSaves();
    }
    toast('已回到上一轮开头');
    return true;
  }

  async function boot() {
    /* 先检查 / 补齐本地缓存资源，避免进游戏后立绘切换卡顿 */
    if (window.天青_asset_preload && window.天青_asset_preload.runBootPreload) {
      try {
        await window.天青_asset_preload.runBootPreload();
      } catch (e) {
        console.warn('[SummerNight Plus] 启动预加载异常', e);
      }
    }

    window.天青_stage.init();
    window.天青_settings_boot();
    if (window.天青_phone && window.天青_phone.bind) window.天青_phone.bind();
    if (window.天青_toolbar && window.天青_toolbar.bind) window.天青_toolbar.bind();
    if (window.天青_title && window.天青_title.bind) window.天青_title.bind();

    /* 不再自动写入默认 systemPrompt / 格式说明；提示词只来自设置里你自己配置的内容 */

    window.天青_app = {
      generate: runGenerate,
      loadDemo: loadDemo,
      startNewGame: startNewGame,
      enterFromSave: enterFromSave,
      rewindPrevRound: rewindPrevRound,
      setAppGenerating: setAppGenerating,
      isBusy: function () {
        return busy;
      },
      isAppGenerating: function () {
        return appBusy;
      },
    };

    if (window.天青_title) window.天青_title.show();
    console.info('[SummerNight Plus] 就绪');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
    });
  } else {
    boot();
  }
})();
