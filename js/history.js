/* 歴史ページ：js/history-data.js の HISTORY をタイムラインとして描画する。
   データを増やすときは history-data.js に1件足すだけでよい（date / tag / tagColor / title / body）。 */
(function () {
  "use strict";
  var host = document.getElementById("timeline");
  if (!host || typeof HISTORY === "undefined") return;
  var esc = window.HI && window.HI.esc ? window.HI.esc : function (s) { return String(s); };

  host.innerHTML = HISTORY.map(function (h) {
    var color = esc(h.tagColor || "#5fb2ee");
    return (
      '<article class="tl reveal" style="--tl-color:' + color + '">' +
      '<div class="tl__date">' + esc(h.date) + "</div>" +
      '<div class="tl__rail"><div class="tl__dot"></div></div>' +
      '<div class="card tl__card">' +
      '<span class="tl__tag">' + esc(h.tag) + "</span>" +
      '<h2 class="tl__title">' + esc(h.title) + "</h2>" +
      '<p class="tl__body">' + esc(h.body) + "</p>" +
      "</div></article>"
    );
  }).join("");

  /* common.js の出現演出は DOMContentLoaded 時に要素を拾うので、後から足した分をここで監視する */
  function watch() {
    if (window.HI && window.HI.observe) {
      host.querySelectorAll(".tl").forEach(function (el) { window.HI.observe(el); });
    } else {
      host.querySelectorAll(".tl").forEach(function (el) { el.classList.add("in-view"); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
})();
