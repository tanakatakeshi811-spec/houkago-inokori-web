/* 掲示板ページ
   -------------------------------------------------------------------------
   「連携」の仕組みについて: ゲーム本体(houkago-inokori)とこの公式サイト
   (houkago-inokori-web)はどちらもGitHub Pagesのユーザーサイト
   (tanakatakeshi811-spec.github.io)配下のプロジェクトページで、パスが
   違うだけで同一オリジン。localStorageは「オリジン単位」で共有されるので、
   ゲーム側が起動時に発行するhi_pid_v1・プロフィール(hi_profile_v1)は、
   このページのJSからもそのまま localStorage.getItem() で読める。
   よってURLに?pid=...を付けて受け渡す方式は不要（不要な情報をURLに
   載せない分、こちらのほうが安全）。「ゲームを一度でも開けばこのサイト
   でも自動的に連携済みになる」という体験になる。
   別タブでゲームを開いて連携した場合にも気づけるよう、storageイベント
   (同一オリジンの他タブでの変更を検知できる)も監視している。
   ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var API = "https://houkago-inokori-relay.shunri-ai.workers.dev";
  var PID_KEY = "hi_pid_v1";
  var PROFILE_KEY = "hi_profile_v1";
  var BOARD_WINDOW_MS = 60 * 60 * 1000;
  var COOLDOWN_MS = 3000;
  var ICONS = ["🦊", "🐱", "🐰", "🐼", "🐸", "🦉", "🐧", "🦁", "🐻", "🐨", "🐵", "🦔", "🐹", "🦄", "🐙", "🐢", "🦋", "🐝", "🌟", "🔥"];

  var esc = window.HI && window.HI.esc ? window.HI.esc : function (s) { return String(s == null ? "" : s); };

  var elStatus = document.getElementById("boardStatus");
  var elComposeCard = document.getElementById("composeCard");
  var elLockedCard = document.getElementById("lockedCard");
  var elComposeName = document.getElementById("composeName");
  var elComposeText = document.getElementById("composeText");
  var elComposeCount = document.getElementById("composeCount");
  var elComposeSend = document.getElementById("composeSend");
  var elComposeIconBtn = document.getElementById("composeIconBtn");
  var elComposeIconView = document.getElementById("composeIconView");
  var elComposeIconGrid = document.getElementById("composeIconGrid");
  var elComposeCooldown = document.getElementById("composeCooldown");
  var elRecheckBtn = document.getElementById("recheckLinkBtn");
  var elBdList = document.getElementById("bdList");
  var elBdStatus = document.getElementById("bdStatus");
  var elSavedList = document.getElementById("savedList");
  var elSavedStatus = document.getElementById("savedStatus");
  var elTabPost = document.getElementById("tabPost");
  var elTabSaved = document.getElementById("tabSaved");
  var elPanelPost = document.getElementById("panelPost");
  var elPanelSaved = document.getElementById("panelSaved");

  if (!elBdList) return; // board.html以外では何もしない

  var pid = null;
  var profile = { name: "", icon: "" };
  var lastLocalPostAt = 0;
  var savedIdsBySource = {}; // sourcePostId -> saveId (このタブで取得済みの保存一覧から)
  var cooldownTimer = null;
  var listTimer = null;

  /* ---- localStorage(ゲーム本体と共有) ---- */
  function readPid() {
    try { return localStorage.getItem(PID_KEY) || null; } catch (e) { return null; }
  }
  function readProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") return { name: String(o.name || "").slice(0, 20), icon: String(o.icon || "") };
      }
    } catch (e) {}
    return { name: "", icon: "" };
  }
  function writeProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: p.name, icon: p.icon })); } catch (e) {}
  }

  /* ---- 時刻表示 ---- */
  function timeAgo(ts) {
    var diff = Math.max(0, Date.now() - ts);
    var min = Math.floor(diff / 60000);
    if (min < 1) return "たった今";
    if (min < 60) return min + "分前";
    var h = Math.floor(min / 60);
    return h + "時間前";
  }
  function timeLeft(ts) {
    var remain = ts + BOARD_WINDOW_MS - Date.now();
    if (remain <= 0) return "まもなく消えます";
    var min = Math.ceil(remain / 60000);
    if (min <= 1) return "残り1分";
    return "残り" + min + "分";
  }

  /* ---- 連携状態のチェック・UI反映 ---- */
  function checkLink(silent) {
    var newPid = readPid();
    var changed = newPid !== pid;
    pid = newPid;
    profile = readProfile();
    if (pid) {
      elComposeCard.hidden = false;
      elLockedCard.hidden = true;
      elStatus.hidden = false;
      elStatus.innerHTML =
        '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' +
        "<span>連携中｜あなたのID：<b>" + esc(pid) + "</b>（このIDはサイト側からは変更できません）</span>";
      elComposeName.value = profile.name || "";
      elComposeIconView.textContent = profile.icon || ICONS[0];
      if (!profile.icon) { profile.icon = ICONS[0]; }
    } else {
      elComposeCard.hidden = true;
      elLockedCard.hidden = false;
      elStatus.hidden = true;
    }
    if (changed && !silent) {
      fetchSaved();
    }
    return pid;
  }

  /* ---- アイコン選択グリッド ---- */
  function buildIconGrid() {
    elComposeIconGrid.innerHTML = ICONS.map(function (ic) { return '<div data-ic="' + ic + '">' + ic + "</div>"; }).join("");
    Array.prototype.forEach.call(elComposeIconGrid.children, function (el) {
      if (el.dataset.ic === profile.icon) el.classList.add("sel");
      el.addEventListener("click", function () {
        Array.prototype.forEach.call(elComposeIconGrid.children, function (x) { x.classList.remove("sel"); });
        el.classList.add("sel");
        profile.icon = el.dataset.ic;
        elComposeIconView.textContent = profile.icon;
        elComposeIconGrid.hidden = true;
        elComposeIconBtn.setAttribute("aria-expanded", "false");
        syncProfile();
      });
    });
  }
  elComposeIconBtn.addEventListener("click", function () {
    var open = elComposeIconGrid.hidden;
    elComposeIconGrid.hidden = !open;
    elComposeIconBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ---- プロフィール(名前・アイコン)の保存: サーバー(D1)＋ゲーム側localStorage両方に反映 ---- */
  var profileSaveTimer = null;
  function syncProfile() {
    if (!pid) return;
    profile.name = (elComposeName.value || "").trim().slice(0, 20);
    writeProfile(profile);
    clearTimeout(profileSaveTimer);
    profileSaveTimer = setTimeout(function () {
      fetch(API + "/api/profile/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: pid, name: profile.name, icon: profile.icon }),
      }).catch(function (e) { console.error("[board] profile update failed", e); });
    }, 500);
  }
  elComposeName.addEventListener("input", syncProfile);

  /* ---- 投稿一覧の描画 ---- */
  function renderPosts(posts) {
    if (!posts.length) {
      elBdStatus.hidden = false;
      elBdStatus.textContent = "まだ投稿がありません。最初の一言を書いてみよう。";
      elBdList.innerHTML = "";
      return;
    }
    elBdStatus.hidden = true;
    elBdList.innerHTML = posts.map(function (p) {
      var isSaved = !!savedIdsBySource[p.id];
      var actionsHtml = pid
        ? '<div class="bd-post__actions"><button type="button" class="bd-save-btn' + (isSaved ? " is-saved" : "") + '" data-id="' + p.id + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-clipboard"/></svg>' + (isSaved ? "保存済み" : "保存") + "</button></div>"
        : "";
      return (
        '<div class="bd-post" data-post-id="' + p.id + '">' +
        '<div class="bd-post__head"><span class="avatar">' + esc(p.icon || "👤") + '</span>' +
        '<span class="bd-post__name">' + esc(p.name || "名無し") + "</span>" +
        '<span class="bd-post__time">' + timeAgo(p.createdAt) + '<span class="bd-post__left">' + timeLeft(p.createdAt) + "</span></span>" +
        "</div>" +
        '<div class="bd-post__text">' + esc(p.text) + "</div>" +
        actionsHtml +
        "</div>"
      );
    }).join("");

    elBdList.querySelectorAll(".bd-save-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var postEl = btn.closest(".bd-post");
        var id = parseInt(postEl.dataset.postId, 10);
        var p = lastPosts.find(function (x) { return x.id === id; });
        if (p) savePost(p, btn);
      });
    });
  }

  var lastPosts = [];
  function fetchList() {
    fetch(API + "/api/board/list")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        lastPosts = (data && data.posts) || [];
        renderPosts(lastPosts);
      })
      .catch(function (e) {
        elBdStatus.hidden = false;
        elBdStatus.className = "bd-status bad";
        elBdStatus.textContent = "掲示板を取得できませんでした。時間を置いてもう一度開いてみてください。";
        console.error("[board] list fetch failed", e);
      });
  }

  /* ---- 投稿 ---- */
  function updateComposeCount() {
    elComposeCount.textContent = String(elComposeText.value.length);
  }
  elComposeText.addEventListener("input", updateComposeCount);

  function startCooldownUI(ms) {
    elComposeSend.disabled = true;
    var end = Date.now() + ms;
    clearInterval(cooldownTimer);
    function tick() {
      var remain = end - Date.now();
      if (remain <= 0) {
        clearInterval(cooldownTimer);
        elComposeSend.disabled = false;
        elComposeCooldown.hidden = true;
        return;
      }
      elComposeCooldown.hidden = false;
      elComposeCooldown.textContent = "連投防止：あと" + Math.ceil(remain / 1000) + "秒お待ちください";
    }
    tick();
    cooldownTimer = setInterval(tick, 250);
  }

  function sendPost() {
    if (!pid) return;
    var text = (elComposeText.value || "").trim();
    if (!text) return;
    profile.name = (elComposeName.value || "").trim().slice(0, 20);
    writeProfile(profile);
    elComposeSend.disabled = true;
    fetch(API + "/api/board/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: pid, text: text, name: profile.name, icon: profile.icon }),
    })
      .then(function (r) { return r.json().then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (res) {
        if (res.data && res.data.ok) {
          elComposeText.value = "";
          updateComposeCount();
          lastLocalPostAt = Date.now();
          startCooldownUI(COOLDOWN_MS);
          fetchList();
        } else if (res.status === 429) {
          startCooldownUI((res.data && res.data.waitMs) || COOLDOWN_MS);
        } else {
          elComposeSend.disabled = false;
          elComposeCooldown.hidden = false;
          elComposeCooldown.textContent = "投稿できませんでした。少し時間を置いて試してください。";
        }
      })
      .catch(function (e) {
        elComposeSend.disabled = false;
        elComposeCooldown.hidden = false;
        elComposeCooldown.textContent = "通信エラーで投稿できませんでした。";
        console.error("[board] post failed", e);
      });
  }
  elComposeSend.addEventListener("click", sendPost);
  elComposeText.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendPost();
  });

  /* ---- 保存 ---- */
  function savePost(p, btnEl) {
    if (!pid) return;
    if (btnEl) btnEl.disabled = true;
    fetch(API + "/api/board/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: pid, sourcePostId: p.id, name: p.name, icon: p.icon, text: p.text, postedAt: p.createdAt }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          savedIdsBySource[p.id] = data.id;
          if (btnEl) { btnEl.classList.add("is-saved"); btnEl.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-clipboard"/></svg>保存済み'; }
          fetchSaved();
        } else if (btnEl) {
          btnEl.disabled = false;
        }
      })
      .catch(function (e) {
        if (btnEl) btnEl.disabled = false;
        console.error("[board] save failed", e);
      });
  }

  /* ---- 保存した投稿一覧 ---- */
  function renderSaved(saves) {
    savedIdsBySource = {};
    saves.forEach(function (s) { if (s.sourcePostId) savedIdsBySource[s.sourcePostId] = s.id; });
    if (!saves.length) {
      elSavedStatus.hidden = false;
      elSavedStatus.textContent = pid ? "まだ保存した投稿がありません。気に入った投稿の「保存」を押してみよう。" : "連携すると保存した投稿が表示されます";
      elSavedList.innerHTML = "";
      return;
    }
    elSavedStatus.hidden = true;
    elSavedList.innerHTML = saves.map(function (s) {
      return (
        '<div class="bd-post" data-save-id="' + s.id + '">' +
        '<div class="bd-post__head"><span class="avatar">' + esc(s.icon || "👤") + '</span>' +
        '<span class="bd-post__name">' + esc(s.name || "名無し") + "</span>" +
        '<span class="bd-post__time">投稿:' + timeAgo(s.postedAt) + "</span></div>" +
        '<div class="bd-post__text">' + esc(s.text) + "</div>" +
        '<div class="bd-post__actions"><button type="button" class="bd-del-btn" data-save-id="' + s.id + '">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>削除</button></div>' +
        "</div>"
      );
    }).join("");
    elSavedList.querySelectorAll(".bd-del-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = parseInt(btn.closest("[data-save-id]").dataset.saveId, 10);
        unsavePost(id, btn);
      });
    });
  }

  function fetchSaved() {
    if (!pid) { renderSaved([]); return; }
    fetch(API + "/api/board/saved?playerId=" + encodeURIComponent(pid))
      .then(function (r) { return r.json(); })
      .then(function (data) { renderSaved((data && data.saves) || []); })
      .catch(function (e) {
        elSavedStatus.hidden = false;
        elSavedStatus.className = "bd-status bad";
        elSavedStatus.textContent = "保存した投稿を取得できませんでした。";
        console.error("[board] saved fetch failed", e);
      });
  }

  function unsavePost(saveId, btnEl) {
    if (!pid) return;
    if (btnEl) btnEl.disabled = true;
    fetch(API + "/api/board/unsave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: pid, saveId: saveId }),
    })
      .then(function (r) { return r.json(); })
      .then(function () { fetchSaved(); renderPosts(lastPosts); })
      .catch(function (e) {
        if (btnEl) btnEl.disabled = false;
        console.error("[board] unsave failed", e);
      });
  }

  /* ---- タブ切り替え ---- */
  function selectTab(name) {
    var isPost = name === "post";
    elTabPost.setAttribute("aria-selected", isPost ? "true" : "false");
    elTabSaved.setAttribute("aria-selected", isPost ? "false" : "true");
    elPanelPost.hidden = !isPost;
    elPanelSaved.hidden = isPost;
    if (!isPost) fetchSaved();
  }
  elTabPost.addEventListener("click", function () { selectTab("post"); });
  elTabSaved.addEventListener("click", function () { selectTab("saved"); });

  /* ---- 連携の再確認(別タブでゲームを開いて連携した場合など) ---- */
  elRecheckBtn.addEventListener("click", function () { checkLink(); fetchList(); });
  window.addEventListener("storage", function (e) {
    if (e.key === PID_KEY || e.key === PROFILE_KEY) checkLink();
  });
  window.addEventListener("focus", function () { checkLink(true); });

  /* ---- 初期化 ---- */
  checkLink(true);
  buildIconGrid();
  updateComposeCount();
  fetchList();
  listTimer = setInterval(fetchList, 8000);
})();
