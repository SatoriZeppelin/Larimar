/**
 * SummerNight Plus 入口
 */
(function () {
  var busy = false;

  function setBusy(v) {
    busy = v;
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

  function openingRaw() {
    return (window.天青_opening && String(window.天青_opening)) || '';
  }

  function loadDemo() {
    var demo = openingRaw();
    if (!demo) {
      console.warn('[SummerNight Plus] 开局剧情未加载');
      return;
    }
    var data = window.天青_parse.parseGal(demo);
    if (window.天青_save && window.天青_save.setLastRaw) {
      window.天青_save.setLastRaw(demo);
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
          window.天青_stage.loadGal(data, {
            onChoice: function (c) {
              runGenerate(c);
            },
          });
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

  function startNewGame() {
    if (window.天青_save) window.天青_save.clear();
    loadDemo();
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
        nextMsgs = [];
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
    });

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

  function boot() {
    window.天青_stage.init();
    window.天青_settings_boot();
    if (window.天青_toolbar && window.天青_toolbar.bind) window.天青_toolbar.bind();
    if (window.天青_title && window.天青_title.bind) window.天青_title.bind();

    /* 不再自动写入默认 systemPrompt / 格式说明；提示词只来自设置里你自己配置的内容 */

    window.天青_app = {
      generate: runGenerate,
      loadDemo: loadDemo,
      startNewGame: startNewGame,
      enterFromSave: enterFromSave,
      rewindPrevRound: rewindPrevRound,
      isBusy: function () {
        return busy;
      },
    };

    if (window.天青_title) window.天青_title.show();
    console.info('[SummerNight Plus] 就绪');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
