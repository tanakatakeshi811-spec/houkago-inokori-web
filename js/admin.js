/* 管理者用パネル(admin.html)
   -------------------------------------------------------------------------
   このページ自体は「見た目」を出し分けているだけで、実際にBAN・削除を
   実行するかどうかはすべてWorker側(x-admin-tokenのサーバー側検証)が
   決める。このJSがパスワード入力欄を出す/隠すのを間違えても、
   トークンが正しくなければWorkerが401で拒否する二重構え。
   パスワードはlocalStorage(ADMIN_TOKEN_KEY)に保存し次回訪問時に
   自動入力するが、これは利便性のためだけで、保護そのものはサーバー側。
   ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var API = "https://houkago-inokori-relay.shunri-ai.workers.dev";
  var ADMIN_TOKEN_KEY = "hi_admin_token_v1";

  var esc = window.HI && window.HI.esc ? window.HI.esc : function (s) { return String(s == null ? "" : s); };

  var elGate = document.getElementById("adminGate");
  var elPanel = document.getElementById("adminPanel");
  var elPassInput = document.getElementById("adminPassInput");
  var elLoginBtn = document.getElementById("adminLoginBtn");
  var elGateMsg = document.getElementById("adminGateMsg");
  var elLogoutBtn = document.getElementById("adminLogoutBtn");

  var elPostList = document.getElementById("adminPostList");
  var elPostStatus = document.getElementById("adminPostStatus");

  var elBanForm = document.getElementById("banForm");
  var elBanPlayerId = document.getElementById("banPlayerId");
  var elBanMinutes = document.getElementById("banMinutes");
  var elBanPermanent = document.getElementById("banPermanent");
  var elBanReason = document.getElementById("banReason");
  var elBanMsg = document.getElementById("banMsg");

  var elBanIpForm = document.getElementById("banIpForm");
  var elBanIp = document.getElementById("banIp");
  var elBanIpMinutes = document.getElementById("banIpMinutes");
  var elBanIpPermanent = document.getElementById("banIpPermanent");
  var elBanIpReason = document.getElementById("banIpReason");
  var elBanIpMsg = document.getElementById("banIpMsg");

  var elRefreshBansBtn = document.getElementById("refreshBansBtn");
  var elBanList = document.getElementById("adminBanList");
  var elBanStatus = document.getElementById("adminBanStatus");

  var elDeleteAccountForm = document.getElementById("deleteAccountForm");
  var elDeleteAccountId = document.getElementById("deleteAccountId");
  var elDeleteAccountMsg = document.getElementById("deleteAccountMsg");

  if (!elGate) return; // admin.html以外では何もしない

  var token = "";

  function readToken() {
    try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function writeToken(t) {
    try { localStorage.setItem(ADMIN_TOKEN_KEY, t); } catch (e) {}
  }
  function clearToken() {
    try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch (e) {}
  }

  function setMsg(el, text, kind) {
    el.hidden = false;
    el.textContent = text;
    el.className = el.className.replace(/\s*(ok|bad)\b/g, "") + (kind ? " " + kind : "");
  }

  function adminFetch(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["x-admin-token"] = token;
    if (opts.body) headers["content-type"] = "application/json";
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (data) { return { status: r.status, data: data }; });
    });
  }

  /* ---- 認証ゲート ---- */
  function showPanel() {
    elGate.hidden = true;
    elPanel.hidden = false;
    loadPosts();
    loadBans();
  }
  function showGate() {
    elGate.hidden = false;
    elPanel.hidden = true;
  }

  function tryLogin(silent) {
    var candidate = (elPassInput.value || "").trim();
    if (!candidate) {
      if (!silent) setMsg(elGateMsg, "パスワードを入力してください。", "bad");
      return;
    }
    elLoginBtn.disabled = true;
    var prevToken = token;
    token = candidate;
    adminFetch("/api/admin/board/bans")
      .then(function (res) {
        elLoginBtn.disabled = false;
        if (res.status === 200 && res.data && res.data.ok) {
          writeToken(candidate);
          setMsg(elGateMsg, "認証しました。", "ok");
          showPanel();
        } else {
          token = prevToken;
          setMsg(elGateMsg, "パスワードが正しくありません。", "bad");
        }
      })
      .catch(function (e) {
        elLoginBtn.disabled = false;
        token = prevToken;
        setMsg(elGateMsg, "通信エラーです。時間を置いて試してください。", "bad");
        console.error("[admin] login failed", e);
      });
  }
  elLoginBtn.addEventListener("click", function () { tryLogin(false); });
  elPassInput.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(false); });
  elLogoutBtn.addEventListener("click", function () {
    clearToken();
    token = "";
    elPassInput.value = "";
    showGate();
  });

  /* ---- 投稿一覧(投稿削除・投稿者BAN・IP BAN) ----
     一般公開の/api/board/listではなく、x-admin-tokenで保護された
     /api/admin/board/postsを使う(こちらだけIPを含む)。過去(ipカラム追加より
     前)の投稿はip=nullのまま返ってくるので「IP不明」表示にし、BANボタンも
     押せないようにする(BANしようがないため)。 */
  function loadPosts() {
    elPostStatus.hidden = false;
    elPostStatus.textContent = "読み込み中…";
    adminFetch("/api/admin/board/posts")
      .then(function (res) {
        var data = res.data;
        if (!(data && data.ok)) {
          elPostStatus.hidden = false;
          elPostStatus.className = "bd-status bad";
          elPostStatus.textContent = "投稿一覧を取得できませんでした。";
          return;
        }
        var posts = data.posts || [];
        if (!posts.length) {
          elPostStatus.hidden = false;
          elPostStatus.className = "bd-status";
          elPostStatus.textContent = "直近1時間の投稿はありません。";
          elPostList.innerHTML = "";
          return;
        }
        elPostStatus.hidden = true;
        elPostList.innerHTML = posts.map(function (p) {
          var hasIp = !!p.ip;
          var ipLabel = hasIp ? esc(p.ip) : "IP不明（この投稿より前のデータ）";
          return (
            '<div class="bd-post" data-post-id="' + p.id + '" data-player-id="' + esc(p.playerId) + '">' +
            '<div class="bd-post__head"><span class="avatar">' + esc(p.icon || "👤") + '</span>' +
            '<span class="bd-post__name">' + esc(p.name || "名無し") + '</span>' +
            '<span class="bd-post__id">ID:' + esc(p.playerId) + '</span>' +
            '<span class="bd-post__id" title="接続元IP">IP: ' + ipLabel + '</span>' +
            '</div>' +
            '<div class="bd-post__text">' + esc(p.text) + '</div>' +
            '<div class="bd-post__actions">' +
            '<button type="button" class="admin-ban-here-btn" data-player-id="' + esc(p.playerId) + '"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>この人をBAN</button>' +
            (hasIp
              ? '<button type="button" class="admin-ban-ip-here-btn" data-ip="' + esc(p.ip) + '"><svg class="ic" aria-hidden="true"><use href="#i-network"/></svg>このIPをBAN</button>'
              : '<button type="button" disabled title="この投稿にはIPが記録されていません">このIPをBAN</button>') +
            '<button type="button" class="bd-del-btn" data-post-id="' + p.id + '"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>削除</button>' +
            '</div>' +
            '</div>'
          );
        }).join("");

        elPostList.querySelectorAll(".bd-del-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = parseInt(btn.dataset.postId, 10);
            if (!window.confirm("この投稿を削除します。よろしいですか？")) return;
            btn.disabled = true;
            adminFetch("/api/admin/board/delete-post", { method: "POST", body: { id: id } })
              .then(function (res2) {
                if (res2.data && res2.data.ok) loadPosts();
                else { btn.disabled = false; window.alert("削除に失敗しました。"); }
              })
              .catch(function () { btn.disabled = false; window.alert("通信エラーで削除できませんでした。"); });
          });
        });
        elPostList.querySelectorAll(".admin-ban-here-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            elBanPlayerId.value = btn.dataset.playerId;
            elBanPlayerId.scrollIntoView({ behavior: "smooth", block: "center" });
            elBanPlayerId.focus();
          });
        });
        /* このIPをBAN: IPを手入力させずワンクリックで即BANする主動線。
           期間はIPBANフォームの既定値(60分)と揃える。永久BANや期間変更を
           したい場合は下のIPBANフォームを使ってもらう(elBanIpに自動入力)。 */
        elPostList.querySelectorAll(".admin-ban-ip-here-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var ip = btn.dataset.ip;
            elBanIp.value = ip;
            if (!window.confirm("IP: " + ip + " を60分間BANします。よろしいですか？\n(永久BANや時間変更をしたい場合はキャンセルしてIP BANフォームを使ってください)")) return;
            btn.disabled = true;
            adminFetch("/api/admin/board/ban-ip", { method: "POST", body: { ip: ip, minutes: 60, reason: "掲示板投稿一覧からのワンクリックBAN" } })
              .then(function (res2) {
                btn.disabled = false;
                if (res2.data && res2.data.ok) {
                  setMsg(elBanIpMsg, "IPをBANしました。", "ok");
                  loadBans();
                } else {
                  window.alert("IP BANに失敗しました。");
                }
              })
              .catch(function () { btn.disabled = false; window.alert("通信エラーでBANできませんでした。"); });
          });
        });
      })
      .catch(function (e) {
        elPostStatus.hidden = false;
        elPostStatus.className = "bd-status bad";
        elPostStatus.textContent = "投稿一覧を取得できませんでした。";
        console.error("[admin] post list failed", e);
      });
  }

  /* ---- 投稿BAN(player_id) ---- */
  elBanForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var playerId = (elBanPlayerId.value || "").trim();
    if (!/^[0-9]{4,32}$/.test(playerId)) { setMsg(elBanMsg, "player_idの形式が正しくありません。", "bad"); return; }
    var permanent = elBanPermanent.checked;
    var minutes = parseInt(elBanMinutes.value, 10) || 60;
    var label = permanent ? "永久BAN" : minutes + "分間のBAN";
    if (!window.confirm("player_id: " + playerId + " を" + label + "にします。よろしいですか？")) return;
    var body = { playerId: playerId, reason: (elBanReason.value || "").trim() };
    if (permanent) body.permanent = true; else body.minutes = minutes;
    adminFetch("/api/admin/board/ban", { method: "POST", body: body })
      .then(function (res) {
        if (res.data && res.data.ok) {
          setMsg(elBanMsg, "BANしました。", "ok");
          elBanForm.reset();
          loadBans();
          loadPosts();
        } else {
          setMsg(elBanMsg, "BANに失敗しました。", "bad");
        }
      })
      .catch(function () { setMsg(elBanMsg, "通信エラーでBANできませんでした。", "bad"); });
  });

  /* ---- IP BAN ---- */
  elBanIpForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var ip = (elBanIp.value || "").trim();
    if (!ip) { setMsg(elBanIpMsg, "IPアドレスを入力してください。", "bad"); return; }
    var permanent = elBanIpPermanent.checked;
    var minutes = parseInt(elBanIpMinutes.value, 10) || 60;
    var label = permanent ? "永久BAN" : minutes + "分間のBAN";
    if (!window.confirm("IP: " + ip + " を" + label + "にします。よろしいですか？")) return;
    var body = { ip: ip, reason: (elBanIpReason.value || "").trim() };
    if (permanent) body.permanent = true; else body.minutes = minutes;
    adminFetch("/api/admin/board/ban-ip", { method: "POST", body: body })
      .then(function (res) {
        if (res.data && res.data.ok) {
          setMsg(elBanIpMsg, "IPをBANしました。", "ok");
          elBanIpForm.reset();
          loadBans();
        } else {
          setMsg(elBanIpMsg, "IP BANに失敗しました。", "bad");
        }
      })
      .catch(function () { setMsg(elBanIpMsg, "通信エラーでBANできませんでした。", "bad"); });
  });

  /* ---- 現在のBAN一覧・解除 ---- */
  function fmtUntil(b) {
    if (b.permanent) return "永久";
    var remain = b.until - Date.now();
    if (remain <= 0) return "まもなく解除";
    var min = Math.ceil(remain / 60000);
    if (min < 60) return "あと" + min + "分";
    return "あと" + Math.ceil(min / 60) + "時間";
  }

  function loadBans() {
    elBanStatus.hidden = false;
    elBanStatus.textContent = "読み込み中…";
    adminFetch("/api/admin/board/bans")
      .then(function (res) {
        if (!(res.data && res.data.ok)) {
          elBanStatus.hidden = false;
          elBanStatus.className = "bd-status bad";
          elBanStatus.textContent = "BAN一覧を取得できませんでした。";
          return;
        }
        var playerBans = res.data.playerBans || [];
        var ipBans = res.data.ipBans || [];
        if (!playerBans.length && !ipBans.length) {
          elBanStatus.hidden = false;
          elBanStatus.textContent = "現在有効なBANはありません。";
          elBanList.innerHTML = "";
          return;
        }
        elBanStatus.hidden = true;
        var rows = [];
        playerBans.forEach(function (b) {
          rows.push(
            '<div class="admin-ban-row">' +
            '<div class="admin-ban-row__main">' +
            '<span class="admin-ban-row__tag">player_id</span><span class="admin-ban-row__id">' + esc(b.playerId) + '</span>' +
            '<div class="admin-ban-row__meta">' + fmtUntil(b) + (b.reason ? "・理由: " + esc(b.reason) : "") + '</div>' +
            '</div>' +
            '<button type="button" class="admin-unban-btn" data-type="player" data-value="' + esc(b.playerId) + '">解除</button>' +
            '</div>'
          );
        });
        ipBans.forEach(function (b) {
          rows.push(
            '<div class="admin-ban-row">' +
            '<div class="admin-ban-row__main">' +
            '<span class="admin-ban-row__tag">IP</span><span class="admin-ban-row__id">' + esc(b.ip) + '</span>' +
            '<div class="admin-ban-row__meta">' + fmtUntil(b) + (b.reason ? "・理由: " + esc(b.reason) : "") + '</div>' +
            '</div>' +
            '<button type="button" class="admin-unban-btn" data-type="ip" data-value="' + esc(b.ip) + '">解除</button>' +
            '</div>'
          );
        });
        elBanList.innerHTML = rows.join("");
        elBanList.querySelectorAll(".admin-unban-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var type = btn.dataset.type;
            var value = btn.dataset.value;
            if (!window.confirm((type === "ip" ? "IP: " : "player_id: ") + value + " のBANを解除します。よろしいですか？")) return;
            btn.disabled = true;
            var body = type === "ip" ? { ip: value } : { playerId: value };
            adminFetch("/api/admin/board/unban", { method: "POST", body: body })
              .then(function (res2) {
                if (res2.data && res2.data.ok) loadBans();
                else { btn.disabled = false; window.alert("解除に失敗しました。"); }
              })
              .catch(function () { btn.disabled = false; window.alert("通信エラーで解除できませんでした。"); });
          });
        });
      })
      .catch(function (e) {
        elBanStatus.hidden = false;
        elBanStatus.className = "bd-status bad";
        elBanStatus.textContent = "BAN一覧を取得できませんでした。";
        console.error("[admin] ban list failed", e);
      });
  }
  elRefreshBansBtn.addEventListener("click", loadBans);

  /* ---- アカウント削除 ---- */
  elDeleteAccountForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var playerId = (elDeleteAccountId.value || "").trim();
    if (!/^[0-9]{4,32}$/.test(playerId)) { setMsg(elDeleteAccountMsg, "player_idの形式が正しくありません。", "bad"); return; }
    if (!window.confirm("player_id: " + playerId + " のアカウントを削除します。ランキング登録・保存投稿が消え、掲示板の投稿は「削除されました」表記になります。この操作は取り消せません。本当によろしいですか？")) return;
    if (!window.confirm("最終確認：本当に削除しますか？")) return;
    adminFetch("/api/admin/account/delete", { method: "POST", body: { playerId: playerId } })
      .then(function (res) {
        if (res.data && res.data.ok) {
          setMsg(elDeleteAccountMsg, "アカウントを削除しました。", "ok");
          elDeleteAccountForm.reset();
          loadPosts();
        } else {
          setMsg(elDeleteAccountMsg, "削除に失敗しました。", "bad");
        }
      })
      .catch(function () { setMsg(elDeleteAccountMsg, "通信エラーで削除できませんでした。", "bad"); });
  });

  /* ---- 初期化: 保存済みトークンがあれば自動で認証を試みる ---- */
  var saved = readToken();
  if (saved) {
    elPassInput.value = saved;
    tryLogin(true);
  }
})();
