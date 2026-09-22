/* キャラ図鑑：js/characters-data.js の CHARACTERS を、先生/生徒タブ・名前検索・ページ送り・詳細パネルで表示する。
   キャラを増やすときは characters-data.js に1件足すだけでよい。 */
(function () {
  "use strict";
  if (typeof CHARACTERS === "undefined") return;
  var esc = window.HI && window.HI.esc ? window.HI.esc : function (s) { return String(s); };

  var PER_PAGE = 12;
  var grid = document.getElementById("char-grid");
  var empty = document.getElementById("char-empty");
  var pager = document.getElementById("pager");
  var detail = document.getElementById("char-detail");
  var search = document.getElementById("char-search");
  var tabs = document.querySelectorAll(".side-tab");
  var cta = document.getElementById("char-cta");
  var ctaTitle = document.getElementById("char-cta-title");
  var ctaText = document.getElementById("char-cta-text");

  var state = { side: "teacher", q: "", page: 1, selected: null };

  /* 件数をデータから数えて表示（HTML側の数字はフォールバック） */
  var counts = { teacher: 0, student: 0 };
  CHARACTERS.forEach(function (c) { counts[c.side] = (counts[c.side] || 0) + 1; });
  document.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = counts[el.getAttribute("data-count")] || 0; });

  function sideLabel(side) { return side === "teacher" ? "先生" : "生徒"; }

  function filtered() {
    var q = state.q.toLowerCase();
    return CHARACTERS.filter(function (c) {
      if (c.side !== state.side) return false;
      if (!q) return true;
      var hay = (c.name + " " + (c.kana || "") + " " + (c.tagline || "")).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function card(c) {
    var bg = "linear-gradient(160deg," + esc(c.color) + " 0%, rgba(13,21,23,0.92) 100%)";
    return (
      '<button type="button" class="char-card char-card--' + esc(c.side) + (state.selected === c.id ? " is-selected" : "") + '" data-id="' + esc(c.id) + '" style="background:' + bg + '" aria-label="' + esc(c.name) + 'の固有能力を見る">' +
      '<span class="char-card__glyph" aria-hidden="true">' + esc(c.name.charAt(0)) + "</span>" +
      '<span class="char-card__side">' + sideLabel(c.side) + "</span>" +
      '<span class="char-card__name">' + esc(c.name) + "</span>" +
      '<span class="char-card__tag"><span>' + esc(c.tagline || "") + '</span><svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></span>' +
      "</button>"
    );
  }

  function render() {
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PER_PAGE;
    var slice = list.slice(start, start + PER_PAGE);

    grid.innerHTML = slice.map(card).join("");
    grid.querySelectorAll(".char-card").forEach(function (b, i) { b.style.setProperty("--i", i); });
    empty.hidden = list.length !== 0;
    renderPager(list.length, pages);

    grid.querySelectorAll(".char-card").forEach(function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-id")); });
    });

    /* 反対側への誘導カード */
    var other = state.side === "teacher" ? "student" : "teacher";
    cta.className = "card char-cta " + (other === "teacher" ? "char-cta--red" : "char-cta--blue");
    ctaTitle.textContent = sideLabel(other) + counts[other] + "種もチェック";
    ctaText.textContent = other === "teacher" ? "固有能力で追い詰めろ。" : "逃げて、協力して、脱出を目指そう。";
  }

  function renderPager(total, pages) {
    if (pages <= 1) { pager.innerHTML = ""; return; }
    var html = '<span class="pager__label">' + total + "体の" + sideLabel(state.side) + "</span>";
    html += '<button type="button" data-page="' + (state.page - 1) + '" aria-label="前のページ"' + (state.page === 1 ? " disabled" : "") + '><svg class="ic" aria-hidden="true"><use href="#i-chevron-right" transform="rotate(180 12 12)"/></svg></button>';
    var shown = [];
    for (var p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - state.page) <= 1) shown.push(p);
    }
    var last = 0;
    shown.forEach(function (p) {
      if (p - last > 1) html += '<span class="pager__dots">…</span>';
      html += '<button type="button" data-page="' + p + '"' + (p === state.page ? ' aria-current="page"' : "") + ">" + p + "</button>";
      last = p;
    });
    html += '<button type="button" data-page="' + (state.page + 1) + '" aria-label="次のページ"' + (state.page === pages ? " disabled" : "") + '><svg class="ic" aria-hidden="true"><use href="#i-chevron-right"/></svg></button>';
    pager.innerHTML = html;
    pager.querySelectorAll("button[data-page]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.page = parseInt(b.getAttribute("data-page"), 10);
        render();
        grid.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function select(id) {
    var c = null;
    for (var i = 0; i < CHARACTERS.length; i++) if (CHARACTERS[i].id === id) { c = CHARACTERS[i]; break; }
    if (!c) return;
    state.selected = id;
    grid.querySelectorAll(".char-card").forEach(function (b) { b.classList.toggle("is-selected", b.getAttribute("data-id") === id); });

    var html = '<span class="char-detail__bg" aria-hidden="true">' + esc(c.name.charAt(0)) + "</span>";
    html += '<button type="button" class="char-detail__close" id="char-detail-close" aria-label="閉じる"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>';
    html += '<div class="char-detail__head"><div class="char-detail__side ' + (c.side === "teacher" ? "t-red" : "t-blue") + '">' + sideLabel(c.side) + "</div>";
    html += '<h2 class="char-detail__name">' + esc(c.name) + "</h2>";
    if (c.tagline) html += '<div class="char-detail__tag">' + esc(c.tagline) + "</div>";
    html += "</div>";
    if (c.intro) html += '<p class="char-detail__intro">' + esc(c.intro) + "</p>";
    html += '<div class="abilities">';
    (c.abilities || []).forEach(function (a) {
      var meta = "";
      if (a.kind === "passive") meta = '<span class="ability__meta">常時発動</span>';
      else if (a.cd) meta = '<span class="ability__meta">CT ' + esc(a.cd) + "秒" + (a.uses ? "・" + esc(a.uses) + "回まで" : "") + "</span>";
      html += '<div class="ability ability--' + esc(c.side) + '"><div class="ability__label">' + esc(a.label || "特徴") + meta + '</div><div class="ability__text">' + esc(a.text) + "</div></div>";
    });
    if (c.side === "teacher" && c.cd) {
      html += '<div class="ability ability--teacher"><div class="ability__label">クールタイムの目安</div><div class="ability__text">能力の再使用まで、約' + esc(c.cd) + "秒。</div></div>";
    }
    html += "</div>";
    detail.innerHTML = html;
    detail.hidden = false;
    document.getElementById("char-detail-close").addEventListener("click", closeDetail);
    detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    detail.focus({ preventScroll: true });
  }

  function closeDetail() {
    detail.hidden = true;
    state.selected = null;
    grid.querySelectorAll(".char-card").forEach(function (b) { b.classList.remove("is-selected"); });
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      state.side = t.getAttribute("data-side");
      state.page = 1;
      state.q = "";
      if (search) search.value = "";
      closeDetail();
      render();
    });
  });
  cta.addEventListener("click", function (e) {
    e.preventDefault();
    var other = state.side === "teacher" ? "student" : "teacher";
    tabs.forEach(function (t) { if (t.getAttribute("data-side") === other) t.click(); });
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  if (search) {
    search.addEventListener("input", function () {
      state.q = search.value.trim();
      state.page = 1;
      render();
    });
  }

  render();
})();
