/* ルールページ固有の処理：操作方法のPC/スマホ切替、ミニ体験のタブ切替、ページ内リンクの現在地 */
(function () {
  "use strict";

  /* 操作方法（PC / スマホ） */
  var toggle = document.querySelector(".toggle");
  var mockSp = document.getElementById("ctl-mock-sp");
  var mockPc = document.getElementById("ctl-mock-pc");
  var sp = document.getElementById("ctl-sp");
  var pc = document.getElementById("ctl-pc");
  if (toggle && sp && pc) {
    toggle.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var isPc = b.getAttribute("data-device") === "pc";
        toggle.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        sp.hidden = isPc;
        pc.hidden = !isPc;
        if (mockSp) mockSp.hidden = isPc;
        if (mockPc) mockPc.hidden = !isPc;
      });
    });
  }

  /* ミニ体験のタブ */
  var tabs = document.querySelectorAll('.tabs [role="tab"]');
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      document.querySelectorAll(".mg").forEach(function (p) {
        p.classList.toggle("is-active", p.id === t.getAttribute("data-mg"));
      });
    });
  });

  /* ページ内リンクの現在地（スクロール位置で切替） */
  var links = document.querySelectorAll(".subnav a");
  var targets = [];
  links.forEach(function (a) {
    var el = document.querySelector(a.getAttribute("href"));
    if (el) targets.push({ a: a, el: el });
  });
  function update() {
    var y = window.scrollY + 120;
    var cur = targets[0];
    targets.forEach(function (t) { if (t.el.offsetTop <= y) cur = t; });
    links.forEach(function (a) { a.classList.toggle("is-active", cur && a === cur.a); });
  }
  if (targets.length) {
    window.addEventListener("scroll", update, { passive: true });
    update();
  }
})();
