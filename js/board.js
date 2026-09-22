/* 掲示板ページ
   -------------------------------------------------------------------------
   「連携」の仕組みについて(2026-09-22: 6桁コード方式に変更):
   以前はゲーム本体(houkago-inokori)と公式サイト(houkago-inokori-web)が
   GitHub Pagesの同一オリジンであることを利用し、ゲーム側が発行する
   hi_pid_v1をこのページのJSからlocalStorageで直接読む「自動連携」だった。
   ただしこの方式は同じブラウザでしか成立せず、①違う端末・違うブラウザ
   から連携できない、②「連携を解除する」を作ろうとしても、ゲームを
   一度でも開いたブラウザだと再度自動連携してしまい解除が意味をなさない、
   という制約があった。
   そこで「ゲームのタイトル画面でワンタイムの6桁コードを発行→この掲示板
   ページでそのコードを入力→サーバー(Worker)がコードをplayer_idに交換」
   という方式に一本化した。連携状態は、このページの専用キー
   (LINKED_PID_KEY)にサーバーから返ってきたplayer_idを保存することだけで
   判定する。「解除する」はこのキーを消すだけで、ゲーム側のhi_pid_v1には
   一切触れない(ゲームのプレイ自体・スコア等には影響しない)。
   ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var API = "https://houkago-inokori-relay.shunri-ai.workers.dev";
  var LINKED_PID_KEY = "hi_board_linked_pid_v1"; // この掲示板ページでの連携状態(サーバー発行のplayer_id)
  var PROFILE_KEY = "hi_profile_v1"; // 名前・アイコンはゲーム側と同じキーを共用(同じブラウザなら見た目も揃う。連携判定には使わない)
  var BOARD_WINDOW_MS = 60 * 60 * 1000;
  var COOLDOWN_MS = 3000;
  var ICONS = ["🦊", "🐱", "🐰", "🐼", "🐸", "🦉", "🐧", "🦁", "🐻", "🐨", "🐵", "🦔", "🐹", "🦄", "🐙", "🐢", "🦋", "🐝", "🌟", "🔥"];

  var esc = window.HI && window.HI.esc ? window.HI.esc : function (s) { return String(s == null ? "" : s); };

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
  var elBoardStatus = document.getElementById("boardStatus");
  var elLinkStartBtn = document.getElementById("linkStartBtn");
  var elLinkForm = document.getElementById("linkForm");
  var elLinkCodeInput = document.getElementById("linkCodeInput");
  var elLinkMsg = document.getElementById("linkMsg");
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
  var savedIdsBySource = {}; // sourcePostId -> saveId (このタブで取得済みの保存一覧から)
  var cooldownTimer = null;
  var listTimer = null;

  /* ---- 連携状態(このページ専用キー) ---- */
  function readLinkedPid() {
    try { return localStorage.getItem(LINKED_PID_KEY) || null; } catch (e) { return null; }
  }
  function writeLinkedPid(p) {
    try { localStorage.setItem(LINKED_PID_KEY, p); } catch (e) {}
  }
  function clearLinkedPid() {
    try { localStorage.removeItem(LINKED_PID_KEY); } catch (e) {}
  }

  /* ---- プロフィール(名前・アイコン、ゲーム側と共用キー): 連携判定には使わない、見た目の初期値だけ ---- */
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
  function timeLeftText(ts) {
    var remain = ts + BOARD_WINDOW_MS - Date.now();
    if (remain <= 0) return "まもなく消えます";
    var min = Math.ceil(remain / 60000);
    if (min <= 1) return "残り1分";
    return "残り" + min + "分";
  }

  /* ---- 連携中パネル・投稿フォームの表示切り替え ---- */
  function refreshLinkUI() {
    pid = readLinkedPid();
    profile = readProfile();
    if (pid) {
      elComposeCard.hidden = false;
      elLockedCard.hidden = true;
      elBoardStatus.hidden = false;
      elBoardStatus.innerHTML =
        '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' +
        '<span class="board-status__text">連携中｜あなたのID：<b>' + esc(pid) + "</b></span>" +
        '<button type="button" class="bd-unlink-btn" id="unlinkBtn">連携を解除</button>';
      var unlinkBtn = document.getElementById("unlinkBtn");
      if (unlinkBtn) unlinkBtn.addEventListener("click", handleUnlink);
      elComposeName.value = profile.name || "";
      elComposeIconView.textContent = profile.icon || ICONS[0];
      if (!profile.icon) { profile.icon = ICONS[0]; }
    } else {
      elComposeCard.hidden = true;
      elLockedCard.hidden = false;
      elBoardStatus.hidden = true;
      elBoardStatus.innerHTML = "";
      elLinkForm.hidden = true;
      elLinkCodeInput.value = "";
      elLinkMsg.hidden = true;
    }
  }

  function handleUnlink() {
    if (!window.confirm("連携を解除しますか？このブラウザでは投稿できなくなります(投稿・保存した内容は消えません)。")) return;
    clearLinkedPid();
    refreshLinkUI();
    fetchSaved();
    renderPosts(lastPosts);
  }

  /* ---- 連携フロー(6桁コード) ---- */
  elLinkStartBtn.addEventListener("click", function () {
    var open = elLinkForm.hidden;
    elLinkForm.hidden = !open;
    elLinkMsg.hidden = true;
    if (open) elLinkCodeInput.focus();
  });

  function setLinkMsg(text, kind) {
    elLinkMsg.hidden = false;
    elLinkMsg.textContent = text;
    elLinkMsg.className = "bd-linkform__msg" + (kind ? " " + kind : "");
  }

  elLinkForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = (elLinkCodeInput.value || "").trim();
    if (!/^[0-9]{6}$/.test(code)) {
      setLinkMsg("6桁の数字で入力してください。", "bad");
      return;
    }
    var submitBtn = document.getElementById("linkSubmitBtn");
    submitBtn.disabled = true;
    fetch(API + "/api/link/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        submitBtn.disabled = false;
        if (data && data.ok && data.playerId) {
          writeLinkedPid(data.playerId);
          setLinkMsg("連携しました。", "ok");
          refreshLinkUI();
          fetchList();
          fetchSaved();
        } else {
          setLinkMsg("コードが正しくないか、有効期限(10分)が切れています。", "bad");
        }
      })
      .catch(function (e) {
        submitBtn.disabled = false;
        setLinkMsg("通信エラーで連携できませんでした。", "bad");
        console.error("[board] link redeem failed", e);
      });
  });

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

  /* ---- プロフィール(名前・アイコン)の保存: サーバー(D1)＋ゲーム側と共用のlocalStorage両方に反映 ---- */
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
        '<span class="bd-post__time" title="' + esc(timeLeftText(p.createdAt)) + '">' + timeAgo(p.createdAt) + "</span>" +
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

  /* ---- 初期化 ---- */
  refreshLinkUI();
  buildIconGrid();
  updateComposeCount();
  fetchList();
  listTimer = setInterval(fetchList, 8000);
})();
