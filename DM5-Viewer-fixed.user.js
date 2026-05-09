// ==UserScript==
// @name         DM5 Viewer Fixed
// @namespace    https://github.com/valkytie/dm5-viewer-fixed
// @version      2026.05.09.2
// @description  Continuous reader for current DM5 chapter pages.
// @author       Emma (original), valkytie/Codex (modifications)
// @license      MIT
// @match        *://www.dm5.com/m*
// @match        *://www.dm5.cn/m*
// @include      /^https?:\/\/www\.dm5\.(com|cn)\/m\d+/
// @exclude      *://www.dm5.com/manhua-*
// @exclude      *://www.dm5.cn/manhua-*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var ID = 'dm5-viewer-fixed';
  var state = {
    loading: false,
    nextChapterUrl: '',
    nextChapterTitle: '',
    autoNext: false,
    lightMode: false,
    loadingNext: false,
    loadedChapterUrls: {},
  };

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function onReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function setBootStatus(text, type) {
    type = type || 'info';
    var box = document.getElementById(ID + '-boot');
    if (!box) {
      box = document.createElement('div');
      box.id = ID + '-boot';
      box.style.cssText = [
        'position:fixed',
        'right:12px',
        'bottom:12px',
        'z-index:2147483647',
        'max-width:360px',
        'padding:10px 12px',
        'border-radius:4px',
        'background:#161616',
        'color:#f2f2f2',
        'font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        'box-shadow:0 6px 24px rgba(0,0,0,.35)',
        'border:1px solid rgba(255,255,255,.22)',
      ].join(';');
      (document.body || document.documentElement).appendChild(box);
    }
    box.style.borderColor = type === 'error' ? '#ff6b6b' : type === 'ok' ? '#58d68d' : 'rgba(255,255,255,.22)';
    box.textContent = 'DM5 Viewer Fixed: ' + text;
    if (type === 'ok') {
      setTimeout(function () {
        if (box && box.parentNode) box.parentNode.removeChild(box);
      }, 2400);
    }
  }

  function pageVar(name, doc) {
    doc = doc || document;
    if (doc === document && typeof window[name] !== 'undefined') return window[name];
    var scripts = Array.prototype.map.call(doc.scripts, function (script) {
      return script.textContent || '';
    }).join('\n');
    var re = new RegExp('var\\s+' + name + '\\s*=\\s*(?:"([^"]*)"|\\\'([^\\\']*)\\\'|([^;]+))');
    var match = scripts.match(re);
    if (!match) return undefined;
    var raw = typeof match[1] !== 'undefined' ? match[1] : typeof match[2] !== 'undefined' ? match[2] : match[3];
    var trimmed = String(raw).trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }

  function getChapterInfo(doc, url) {
    doc = doc || document;
    var scripts = Array.prototype.map.call(doc.scripts, function (script) {
      return script.textContent || '';
    }).join('\n');
    var hasNativeReader =
      !!doc.querySelector('#showimage') ||
      !!doc.querySelector('#cp_img') ||
      typeof window.chapterload2 === 'function' ||
      /chapterload2\s*\(/.test(scripts);

    return {
      cid: pageVar('DM5_CID', doc),
      mid: pageVar('DM5_MID', doc),
      count: pageVar('DM5_IMAGE_COUNT', doc),
      sign: pageVar('DM5_VIEWSIGN', doc),
      signDate: pageVar('DM5_VIEWSIGN_DT', doc),
      title: pageVar('DM5_CTITLE', doc) || doc.title,
      hasNativeReader: hasNativeReader,
      url: url || window.location.href,
    };
  }

  async function waitForChapterInfo() {
    for (var i = 0; i < 100; i++) {
      var info = getChapterInfo();
      if (info.cid && info.mid && info.count && info.sign && info.signDate) return info;
      setBootStatus('waiting for page variables (' + (i + 1) + '/100)');
      await sleep(100);
    }
    throw new Error('DM5 chapter variables were not found.');
  }

  function findChapterLink(keyword, doc, baseUrl) {
    doc = doc || document;
    baseUrl = baseUrl || window.location.href;
    var links = Array.prototype.slice.call(doc.querySelectorAll('a'));
    for (var i = 0; i < links.length; i++) {
      var text = (links[i].textContent || '').replace(/\s+/g, '');
      if (text.indexOf(keyword) >= 0 && links[i].href && links[i].href.indexOf('/m') >= 0) {
        return {
          href: new URL(links[i].getAttribute('href'), baseUrl).href,
          title: links[i].getAttribute('title') || links[i].textContent || 'Next chapter',
        };
      }
    }
    return null;
  }

  function captureNativeActions() {
    var next = findChapterLink(String.fromCharCode(19979, 19968, 31456));
    if (next) {
      state.nextChapterUrl = next.href;
      state.nextChapterTitle = next.title;
    }
  }

  function decodeChapterScript(code) {
    var result = Function(
      'var d,d_c,hd_c,isrevtt;' +
        code +
        ';return { d: d, d_c: d_c, hd_c: hd_c, isrevtt: isrevtt };'
    )();

    var urls =
      Array.isArray(result.hd_c) && result.hd_c.length && typeof result.isrevtt !== 'undefined'
        ? result.hd_c
        : result.d;
    if (!Array.isArray(urls) || !urls.length) throw new Error('DM5 returned no image URLs.');
    if (urls.every(function (url) { return /\/images\/war\.jpg/i.test(String(url)); })) {
      throw new Error('DM5 returned its anti-hotlink placeholder. Reload the chapter page once and try again.');
    }
    return urls;
  }

  function getPageKey() {
    var keyInput = $('#dm5_key');
    return keyInput ? keyInput.value : '';
  }

  async function fetchPageImages(page, info) {
    var params = new URLSearchParams({
      cid: String(info.cid),
      page: String(page),
      key: getPageKey(),
      language: '1',
      gtk: '6',
      _cid: String(info.cid),
      _mid: String(info.mid),
      _dt: String(info.signDate),
      _sign: String(info.sign),
    });

    var endpoint = new URL('chapterfun.ashx', info.url || window.location.href).href;
    var res = await fetch(endpoint + '?' + params.toString(), {
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!res.ok) throw new Error('DM5 image request failed: HTTP ' + res.status);

    return decodeChapterScript(await res.text());
  }

  async function fetchChapter(url) {
    var res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Next chapter request failed: HTTP ' + res.status);
    var html = await res.text();
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var info = getChapterInfo(doc, url);
    var next = findChapterLink(String.fromCharCode(19979, 19968, 31456), doc, url);
    if (next) {
      info.nextChapterUrl = next.href;
      info.nextChapterTitle = next.title;
    }
    return info;
  }

  function imagePageNumber(url, fallback) {
    var match = String(url).match(/\/(\d+)_/);
    return match ? Number(match[1]) : fallback;
  }

  function injectStyle() {
    if ($('#' + ID + '-style')) return;
    var style = document.createElement('style');
    style.id = ID + '-style';
    style.textContent = [
      '.view-header-2,.view-paging,.view-comment,.sub-manga,.view-ad,.rightToolBar,.footer,#cp_image,#cp_image2{display:none!important}',
      'body{background:#111!important}',
      'body.dm5vf-light{background:#f1f1f1!important}',
      '#dm5-viewer-fixed{min-height:100vh;padding:0 0 40px;background:#111;color:#eee}',
      'body.dm5vf-light #dm5-viewer-fixed{background:#f1f1f1;color:#111}',
      '#dm5-viewer-fixed .dm5vf-toolbar{position:fixed;right:12px;bottom:12px;z-index:2147483646;display:flex;align-items:center;justify-content:center;gap:8px;min-height:0;padding:6px 8px;background:rgba(17,17,17,.74);border:1px solid rgba(255,255,255,.18);border-radius:4px;font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:.45;transition:opacity .15s ease}',
      'body.dm5vf-light #dm5-viewer-fixed .dm5vf-toolbar{background:rgba(255,255,255,.82);border-color:rgba(0,0,0,.18);color:#111}',
      '#dm5-viewer-fixed .dm5vf-toolbar:hover{opacity:1}',
      '#dm5-viewer-fixed .dm5vf-status{min-width:0;text-align:center;white-space:nowrap}',
      '#dm5-viewer-fixed .dm5vf-toggle{border:1px solid rgba(255,255,255,.24);border-radius:4px;padding:4px 7px;background:#252525;color:#fff;cursor:pointer;font:inherit}',
      'body.dm5vf-light #dm5-viewer-fixed .dm5vf-toggle{border-color:rgba(0,0,0,.24);background:#fff;color:#111}',
      '#dm5-viewer-fixed .dm5vf-toggle.is-on{border-color:#58d68d;color:#58d68d}',
      '#dm5-viewer-fixed .dm5vf-images{display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:0}',
      '#dm5-viewer-fixed.dm5vf-fit-width .dm5vf-images img{width:min(100vw,1200px)}',
      '#dm5-viewer-fixed:not(.dm5vf-fit-width) .dm5vf-images img{max-width:100%}',
      '#dm5-viewer-fixed .dm5vf-images img{height:auto;display:block;background:#222}',
      '#dm5-viewer-fixed .dm5vf-imgwrap{position:relative;display:flex;justify-content:center;width:100%}',
      '#dm5-viewer-fixed .dm5vf-imgwrap.is-failed img{opacity:.2;min-height:220px}',
      '#dm5-viewer-fixed .dm5vf-retry{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;align-items:center;gap:8px;padding:10px 12px;border:1px solid rgba(255,255,255,.28);border-radius:4px;background:rgba(17,17,17,.9);color:#fff;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '#dm5-viewer-fixed .dm5vf-imgwrap.is-failed .dm5vf-retry{display:flex}',
      '#dm5-viewer-fixed .dm5vf-retry button{border:1px solid rgba(255,255,255,.28);border-radius:4px;background:#252525;color:#fff;padding:5px 8px;cursor:pointer;font:inherit}',
      '#dm5-viewer-fixed .dm5vf-error{max-width:760px;margin:40px auto;padding:16px;border:1px solid #8a3c3c;background:#2a1515;color:#ffd7d7;line-height:1.6}',
      '#dm5-viewer-fixed .dm5vf-end{height:52vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#aaa;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '#dm5-viewer-fixed .dm5vf-end a{color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:4px;padding:8px 12px;text-decoration:none;background:#252525}',
      'body.dm5vf-light #dm5-viewer-fixed .dm5vf-end{color:#555}',
      'body.dm5vf-light #dm5-viewer-fixed .dm5vf-end a{color:#111;background:#fff;border-color:rgba(0,0,0,.22)}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function buildReader(info) {
    injectStyle();

    var old = $('#' + ID);
    if (old) old.remove();

    var root = document.createElement('main');
    root.id = ID;
    root.className = 'dm5vf-fit-width';
    root.innerHTML =
      '<div class="dm5vf-toolbar">' +
      '<button class="dm5vf-toggle" type="button">Toggle width</button>' +
      '<button class="dm5vf-light" type="button">Light</button>' +
      '<button class="dm5vf-next" type="button">Next chapter</button>' +
      '<button class="dm5vf-autonext" type="button">Auto next: Off</button>' +
      '<span class="dm5vf-status">Ready 0/' + info.count + '</span>' +
      '</div>' +
      '<div class="dm5vf-images" aria-label="DM5 continuous reader"></div>';

    var anchor = $('.view-paging') || $('.view-header-2') || document.body.firstElementChild;
    anchor.insertAdjacentElement(anchor.classList && anchor.classList.contains('view-header-2') ? 'afterend' : 'beforebegin', root);

    root.querySelector('.dm5vf-toggle').addEventListener('click', function () {
      root.classList.toggle('dm5vf-fit-width');
    });
    root.querySelector('.dm5vf-light').addEventListener('click', function () {
      state.lightMode = !state.lightMode;
      document.body.classList.toggle('dm5vf-light', state.lightMode);
      this.textContent = state.lightMode ? 'Dark' : 'Light';
    });
    root.querySelector('.dm5vf-next').addEventListener('click', function () {
      goNextChapter();
    });
    root.querySelector('.dm5vf-autonext').addEventListener('click', function () {
      state.autoNext = !state.autoNext;
      this.textContent = state.autoNext ? 'Auto next: On' : 'Auto next: Off';
      this.classList.toggle('is-on', state.autoNext);
      if (state.autoNext) appendNextChapter(getUi(root));
    });
    if (!state.nextChapterUrl) {
      root.querySelector('.dm5vf-next').disabled = true;
      root.querySelector('.dm5vf-next').style.opacity = '.45';
    }

    return {
      root: root,
      list: root.querySelector('.dm5vf-images'),
      status: root.querySelector('.dm5vf-status'),
    };
  }

  function getUi(root) {
    return {
      root: root,
      list: root.querySelector('.dm5vf-images'),
      status: root.querySelector('.dm5vf-status'),
    };
  }

  function addImage(list, url, page) {
    var wrap = document.createElement('div');
    var retry = document.createElement('div');
    var retryButton = document.createElement('button');
    var retryText = document.createElement('span');
    var img = document.createElement('img');
    var timeout = null;
    var attempts = 0;

    wrap.className = 'dm5vf-imgwrap';
    retry.className = 'dm5vf-retry';
    retryText.textContent = 'Image failed or timed out.';
    retryButton.type = 'button';
    retryButton.textContent = 'Retry';
    retry.appendChild(retryText);
    retry.appendChild(retryButton);

    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer-when-downgrade';
    img.dataset.page = String(page);
    img.alt = 'Page ' + page;

    function markFailed() {
      if (timeout) clearTimeout(timeout);
      wrap.classList.add('is-failed');
    }

    function markLoaded() {
      if (timeout) clearTimeout(timeout);
      wrap.classList.remove('is-failed');
    }

    function setImageSrc() {
      attempts++;
      wrap.classList.remove('is-failed');
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(function () {
        if (!img.complete || !img.naturalWidth) markFailed();
      }, 20000);
      img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'dm5vf_retry=' + attempts + '_' + Date.now();
    }

    img.addEventListener('load', markLoaded);
    img.addEventListener('error', markFailed);
    retryButton.addEventListener('click', setImageSrc);

    wrap.appendChild(img);
    wrap.appendChild(retry);
    list.appendChild(wrap);
    setImageSrc();
  }

  function showError(ui, err) {
    var box = document.createElement('div');
    box.className = 'dm5vf-error';
    box.textContent = 'DM5 Viewer Fixed failed: ' + (err.message || err);
    ui.list.appendChild(box);
    ui.status.textContent = 'Failed';
    console.error('[DM5 Viewer Fixed]', err);
  }

  function goNextChapter() {
    if (!state.nextChapterUrl) return;
    window.location.href = state.nextChapterUrl;
  }

  async function loadChapter(ui, info, label) {
    var seen = {};
    if (label) {
      var title = document.createElement('div');
      title.className = 'dm5vf-end';
      title.style.height = '18vh';
      title.textContent = label;
      ui.list.appendChild(title);
    }

    for (var page = 1; page <= Number(info.count); page++) {
      ui.status.textContent = 'Loading ' + page + '/' + info.count;
      setBootStatus('loading ' + page + '/' + info.count);
      var urls = await fetchPageImages(page, info);

      urls.forEach(function (url, index) {
        if (seen[url]) return;
        seen[url] = true;
        addImage(ui.list, url, imagePageNumber(url, page + index));
      });

      await sleep(40);
    }
    return Object.keys(seen).length;
  }

  async function appendNextChapter(ui) {
    if (!state.autoNext || !state.nextChapterUrl || state.loadingNext) return;
    if (state.loadedChapterUrls[state.nextChapterUrl]) return;
    state.loadingNext = true;
    try {
      var url = state.nextChapterUrl;
      state.loadedChapterUrls[url] = true;
      ui.status.textContent = 'Loading next chapter';
      setBootStatus('loading next chapter');
      var info = await fetchChapter(url);
      var loaded = await loadChapter(ui, info, info.title || 'Next chapter');
      state.nextChapterUrl = info.nextChapterUrl || '';
      state.nextChapterTitle = info.nextChapterTitle || '';
      ui.status.textContent = 'Done +' + loaded;
      setBootStatus('next chapter appended', 'ok');
      addEndGap(ui);
      if (state.autoNext) appendNextChapter(ui);
    } catch (err) {
      setBootStatus(err.message || String(err), 'error');
      showError(ui, err);
    } finally {
      state.loadingNext = false;
    }
  }

  function addEndGap(ui) {
    var end = document.createElement('div');
    end.className = 'dm5vf-end';
    if (state.nextChapterUrl) {
      end.innerHTML =
        '<div>End of chapter.</div>' +
        '<a href="' + state.nextChapterUrl + '">Next chapter</a>';
    } else {
      end.textContent = 'End of chapter.';
    }
    ui.list.appendChild(end);

  }

  async function start() {
    if (state.loading || $('#' + ID)) return;
    state.loading = true;
    setBootStatus('script injected, starting');
    captureNativeActions();

    var info = await waitForChapterInfo();
    setBootStatus('found chapter ' + info.cid + ', pages ' + info.count, 'ok');
    var ui = buildReader(info);

    try {
      state.loadedChapterUrls[info.url] = true;
      var loaded = await loadChapter(ui, info);
      ui.status.textContent = 'Done ' + loaded + '/' + info.count;
      setBootStatus('done ' + loaded + '/' + info.count, 'ok');
      addEndGap(ui);
      if (state.autoNext) appendNextChapter(ui);
      document.title = info.title + ' - DM5 Viewer Fixed';
    } catch (err) {
      setBootStatus(err.message || String(err), 'error');
      showError(ui, err);
    }
  }

  onReady(function () {
    start().catch(function (err) {
      setBootStatus(err.message || String(err), 'error');
      console.error('[DM5 Viewer Fixed]', err);
    });
  });
})();
