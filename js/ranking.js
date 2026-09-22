/* ランキングページ
   Cloudflare Worker(houkago-inokori-relay)の /api/leaderboard を叩いて、上位3人の表彰台と順位一覧を描く。
   ※ドメイン確定後、Worker側のCORS許可(worker/src/index.js の CORS 定数)が '*' 以外なら本番ドメインを追加すること。
   デザイン確認用: URLに ?sample=1 を付けるとサンプルデータで表示する。 */
(function () {
  "use strict";
  var API = "https://houkago-inokori-relay.shunri-ai.workers.dev/api/leaderboard?limit=50";
  var esc = window.HI && window.HI.esc ? window.HI.esc : function (s) { return String(s); };

  var podium = document.getElementById("podium");
  var list = document.getElementById("rank-list");
  var statusEl = document.getElementById("rank-status");
  var sampleNotice = document.getElementById("rank-sample");
  if (!list) return;

  var SAMPLE = [
    { name: "プレイヤーA", points: 128, matches: 160, wins: 128, teacherWins: 48, teacherMatches: 60, studentEscapes: 80, studentMatches: 100 },
    { name: "プレイヤーB", points: 112, matches: 140, wins: 112, teacherWins: 40, teacherMatches: 50, studentEscapes: 72, studentMatches: 90 },
    { name: "プレイヤーC", points: 96, matches: 120, wins: 96, teacherWins: 36, teacherMatches: 45, studentEscapes: 60, studentMatches: 75 },
    { name: "プレイヤーD", points: 84, matches: 120, wins: 84, teacherWins: 30, teacherMatches: 40, studentEscapes: 54, studentMatches: 80 },
    { name: "プレイヤーE", points: 72, matches: 120, wins: 72, teacherWins: 24, teacherMatches: 40, studentEscapes: 48, studentMatches: 80 },
    { name: "プレイヤーF", points: 60, matches: 100, wins: 60, teacherWins: 20, teacherMatches: 35, studentEscapes: 40, studentMatches: 65 }
  ];

  function pct(a, b) { return b ? Math.round((a / b) * 100) + "%" : "-"; }
  function num(v) { return Number(v) || 0; }
  function icon(p) { return esc(p.icon || "") || '<svg class="ic" aria-hidden="true"><use href="#i-user"/></svg>'; }
  function name(p) { return esc(p.name || "名無し"); }

  function renderPodium(players) {
    if (players.length < 3) { podium.hidden = true; return; }
    var order = [players[1], players[0], players[2]];
    var ranks = [2, 1, 3];
    podium.innerHTML = order.map(function (p, i) {
      var r = ranks[i];
      return (
        '<div class="podium__item podium__item--' + r + '">' +
        '<div class="podium__rank"><svg class="ic" aria-hidden="true"><use href="#i-crown"/></svg><span>' + r + "位</span></div>" +
        '<div class="avatar">' + icon(p) + "</div>" +
        '<div class="podium__name">' + name(p) + "</div>" +
        '<div class="podium__pt">' + num(p.points) + "<small>pt</small></div>" +
        "</div>"
      );
    }).join("");
    podium.hidden = false;
  }

  function renderList(players) {
    list.innerHTML = players.map(function (p, i) {
      var r = i + 1;
      var wins = p.wins != null ? num(p.wins) : num(p.teacherWins) + num(p.studentEscapes);
      var matches = num(p.matches);
      return (
        '<div class="rank-row' + (r <= 3 ? " rank-row--" + r : "") + '">' +
        '<button type="button" class="rank-row__main" aria-expanded="false">' +
        '<span class="rank-row__rank">' + r + "</span>" +
        '<span class="rank-row__player"><span class="avatar">' + icon(p) + '</span><span class="rank-row__name">' + name(p) + "</span></span>" +
        '<span class="rank-row__num rank-row__pt">' + num(p.points) + "</span>" +
        '<span class="rank-row__num">' + matches + "</span>" +
        '<span class="rank-row__num">' + pct(wins, matches) + "</span>" +
        '<svg class="ic rank-row__chev" aria-hidden="true"><use href="#i-chevron-down"/></svg>' +
        "</button>" +
        '<div class="rank-row__detail">' +
        '<div class="t-small t-dim" style="margin-bottom:8px">' + name(p) + "の記録</div>" +
        '<div class="rank-detail">' +
        '<div class="rank-detail__side rank-detail__side--blue"><div class="rank-detail__label"><svg class="ic" aria-hidden="true"><use href="#i-user"/></svg>生徒</div><div class="rank-detail__val"><b>' + num(p.studentEscapes) + "</b>脱出 / " + num(p.studentMatches) + "試合</div></div>" +
        '<div class="rank-detail__total"><small>合計</small><b>' + num(p.points) + " pt</b><small>" + matches + "試合</small></div>" +
        '<div class="rank-detail__side rank-detail__side--red"><div class="rank-detail__label"><svg class="ic" aria-hidden="true"><use href="#i-user"/></svg>先生</div><div class="rank-detail__val"><b>' + num(p.teacherWins) + "</b>勝 / " + num(p.teacherMatches) + "試合</div></div>" +
        "</div></div></div>"
      );
    }).join("");
    list.querySelectorAll(".rank-row").forEach(function (row, i) { row.style.setProperty("--i", i); });
    list.querySelectorAll(".rank-row__main").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.parentElement;
        var open = row.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function show(players) {
    if (!players.length) {
      statusEl.textContent = "まだ誰もランキングに載っていません。最初のひとりになろう。";
      return;
    }
    statusEl.hidden = true;
    renderPodium(players);
    renderList(players);
    var first = list.querySelector(".rank-row");
    if (first) { first.classList.add("is-open"); first.querySelector(".rank-row__main").setAttribute("aria-expanded", "true"); }
  }

  if (/[?&]sample=1/.test(location.search)) {
    sampleNotice.hidden = false;
    show(SAMPLE);
    return;
  }

  fetch(API)
    .then(function (r) { return r.json(); })
    .then(function (data) { show((data && data.players) || []); })
    .catch(function (err) {
      statusEl.textContent = "ランキングを取得できませんでした。時間を置いてもう一度開いてみてください。";
      statusEl.className = "rank-status bad";
      console.error("[ranking] fetch failed", err);
    });
})();
