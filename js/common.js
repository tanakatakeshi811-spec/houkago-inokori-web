/* 「放課後の居残り」公式サイト 共通処理
   -------------------------------------------------------------------------
   全ページで使う軽い処理だけをここに置く。フレームワーク不使用。
   1. アイコン(SVGスプライト)の注入   … <svg class="ic"><use href="#i-play"/></svg> で使う
   2. ヘッダーのドロワー開閉
   3. スクロールで出現する演出(.reveal)
   4. 現在ページのナビ強調(aria-current)
   5. トップページ「最新のアップデート」に HISTORY の直近3件を流し込む
   6. フッターの年号
   ------------------------------------------------------------------------- */
(function () {
  "use strict";

  /* ---- 1. アイコン。増やしたいときはここに <symbol> を足す(24x24・線画) ---- */
  var ICONS =
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' +
    '<symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/></symbol>' +
    '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>' +
    '<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>' +
    '<symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>' +
    '<symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>' +
    '<symbol id="i-chevron-up" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></symbol>' +
    '<symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>' +
    '<symbol id="i-external" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></symbol>' +
    '<symbol id="i-cloud" viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.5 4.5 4.5 0 0 0 7 18z"/></symbol>' +
    '<symbol id="i-phone" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/></symbol>' +
    '<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6.5 6.5 0 0 1 3.5 6.5"/></symbol>' +
    '<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>' +
    '<symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4M8.5 21.5h7"/></symbol>' +
    '<symbol id="i-shirt" viewBox="0 0 24 24"><path d="M8.5 3.5 3 6.5l2 4 2.5-1V21h9V9.5l2.5 1 2-4-5.5-3a3.5 3.5 0 0 1-7 0z"/></symbol>' +
    '<symbol id="i-music" viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></symbol>' +
    '<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5M9 12h6M9 16h6"/></symbol>' +
    '<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></symbol>' +
    '<symbol id="i-github" viewBox="0 0 24 24"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></symbol>' +
    '<symbol id="i-cube" viewBox="0 0 24 24"><path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7M12 11.5v10"/></symbol>' +
    '<symbol id="i-network" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 10.8l9.4-4.6M7.3 13.2l9.4 4.6"/></symbol>' +
    '<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 3.5h8v5a4 4 0 0 1-8 0zM8 5H4.5v2A3.5 3.5 0 0 0 8 10.5M16 5h3.5v2A3.5 3.5 0 0 1 16 10.5M12 12.5V17M8 20.5h8M9 17h6v3.5H9z"/></symbol>' +
    '<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>' +
    '<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/></symbol>' +
    '<symbol id="i-alert-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></symbol>' +
    '<symbol id="i-skull" viewBox="0 0 24 24"><path d="M12 2.5a8 8 0 0 0-8 8c0 2.6 1.3 4.6 3 5.9V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19v-2.6c1.7-1.3 3-3.3 3-5.9a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 17v3.5M14 17v3.5"/></symbol>' +
    '<symbol id="i-chair" viewBox="0 0 24 24"><path d="M6 3.5h12v9H6zM5 12.5h14v4H5zM6 16.5V21M18 16.5V21"/></symbol>' +
    '<symbol id="i-pulse" viewBox="0 0 24 24"><path d="M2.5 12h4l2.5-6 4 12 2.5-6h6"/></symbol>' +
    '<symbol id="i-clipboard" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17.5" rx="2"/><path d="M9 2.5h6v3H9zM9 11h6M9 15h6"/></symbol>' +
    '<symbol id="i-run" viewBox="0 0 24 24"><circle cx="15" cy="4.5" r="2"/><path d="M13 8.5 8.5 10l-1 4M13 8.5l2 4 4 1.5M13 8.5l-2 5 3 3-1 5M11 13.5 7 16l-2 5"/></symbol>' +
    '<symbol id="i-locker" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M7 8h2M15 8h2M7 12h2M15 12h2"/></symbol>' +
    '<symbol id="i-backpack" viewBox="0 0 24 24"><path d="M6 9.5a6 6 0 0 1 12 0V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20z"/><path d="M9 3.5h6M6 15h12M9 15v6.5M15 15v6.5"/></symbol>' +
    '<symbol id="i-cards" viewBox="0 0 24 24"><rect x="4" y="6" width="11" height="15" rx="1.5" transform="rotate(-8 9.5 13.5)"/><rect x="9" y="3.5" width="11" height="15" rx="1.5" transform="rotate(8 14.5 11)"/></symbol>' +
    '<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></symbol>' +
    '<symbol id="i-tap" viewBox="0 0 24 24"><path d="M9 11.5V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v2M17 12a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6h-2.5a6 6 0 0 1-4.6-2.2L4.4 14.4a1.8 1.8 0 0 1 2.8-2.3L9 14.5"/></symbol>' +
    '<symbol id="i-crown" viewBox="0 0 24 24"><path d="M3.5 17.5 2.5 7l5 4 4.5-6.5L16.5 11l5-4-1 10.5z"/><path d="M4 20.5h16"/></symbol>' +
    '<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></symbol>' +
    '<symbol id="i-gamepad" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 10.5v4M5 12.5h4M16 11h.01M18.5 13.5h.01"/></symbol>' +
    '<symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1 1 21 12z"/></symbol>' +
    '<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.5s7-6.5 7-11.5a7 7 0 0 0-14 0c0 5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5"/></symbol>' +
    '<symbol id="i-hand" viewBox="0 0 24 24"><path d="M6 12.5V6a1.5 1.5 0 0 1 3 0v6M9 6a1.5 1.5 0 0 1 3 0v6M12 7a1.5 1.5 0 0 1 3 0v5M15 9a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7L3 14.4a1.5 1.5 0 0 1 2.5-1.6L6 13"/></symbol>' +
    '<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>' +
    '<symbol id="i-door" viewBox="0 0 24 24"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01"/></symbol>' +
    '<symbol id="i-disc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 6a6 6 0 0 1 6 6" opacity=".5"/></symbol>' +
    '<symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/></symbol>' +
    '<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></symbol>' +
    '<symbol id="i-window" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M12 3.5v17M3.5 12h17"/></symbol>' +
    '<symbol id="i-flashlight" viewBox="0 0 24 24"><path d="M6 3.5h12v4l-2 3v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-10l-2-3z"/><path d="M6 7.5h12M12 12v3"/></symbol>' +
    '<symbol id="i-ofuda" viewBox="0 0 24 24"><path d="M7 2.5h10v18l-5-2.5L7 20.5z"/><path d="M12 6v6"/></symbol>' +
    '<symbol id="i-monitor" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></symbol>' +
    '<symbol id="i-swipe" viewBox="0 0 24 24"><path d="M4 8h16M16 4l4 4-4 4"/><path d="M11 14.5v-3a1.5 1.5 0 0 1 3 0v4l2 1.5a4 4 0 0 1 1.5 3.5v1"/><path d="M11 14.5 9 16.5"/></symbol>' +
    '<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>' +
    '<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></symbol>' +
    "</svg>";

  function injectIcons() {
    if (document.getElementById("i-play")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = ICONS;
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  /* ---- 2. ドロワー ---- */
  function setupDrawer() {
    var toggle = document.querySelector(".nav-toggle");
    var drawer = document.querySelector(".drawer");
    if (!toggle || !drawer) return;
    var closeBtn = drawer.querySelector(".drawer__close");
    var backdrop = drawer.querySelector(".drawer__backdrop");
    function open() {
      drawer.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      drawer.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      toggle.focus();
    }
    toggle.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    drawer.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
    });
  }

  /* ---- 3. スクロール出現（.reveal / 見出し / 数字 / タイムライン）---- */
  function setupReveal() {
    /* 兄弟が並ぶ場所は順番に少しずつ遅らせる */
    document.querySelectorAll("[data-stagger]").forEach(function (host) {
      var i = 0;
      Array.prototype.forEach.call(host.children, function (child) {
        if (!child.classList.contains("reveal")) child.classList.add("reveal");
        child.style.setProperty("--d", (i++ * 0.09).toFixed(2) + "s");
      });
    });
    var els = document.querySelectorAll(".reveal, .h-chalk, .stat, .step, .tl");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      document.documentElement.classList.add("no-io");
      els.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          if (entry.target.classList.contains("stat")) countUp(entry.target.querySelector("[data-count]"));
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
    els.forEach(function (el) { io.observe(el); });
    window.HI.observe = function (el) { io.observe(el); };
  }

  /* 数字のカウントアップ */
  function countUp(el) {
    if (!el) return;
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (!isFinite(target)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = target; return; }
    var start = null, dur = 1100;
    el.textContent = "0";
    function step(t) {
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- 3b. ヒーローのチョーク粉 ---- */
  function setupDust() {
    var host = document.querySelector(".dust");
    if (!host) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var n = window.innerWidth < 640 ? 14 : 28;
    for (var i = 0; i < n; i++) {
      var d = document.createElement("span");
      var size = 2 + Math.random() * 3;
      d.style.width = d.style.height = size.toFixed(1) + "px";
      d.style.left = (Math.random() * 100).toFixed(1) + "%";
      d.style.setProperty("--dx", ((Math.random() - 0.5) * 120).toFixed(0) + "px");
      d.style.animationDuration = (9 + Math.random() * 12).toFixed(1) + "s";
      d.style.animationDelay = (-Math.random() * 20).toFixed(1) + "s";
      host.appendChild(d);
    }
  }

  /* ---- 3c. ヘッダー：スクロールしたら濃くする ---- */
  function setupHeaderScroll() {
    var h = document.querySelector(".site-header");
    if (!h) return;
    function onScroll() { h.classList.toggle("is-scrolled", window.scrollY > 24); }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- 4. 現在ページのナビ強調 ---- */
  function markCurrent() {
    var here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-desktop a, .drawer nav a").forEach(function (a) {
      var target = (a.getAttribute("href") || "").split("/").pop();
      if (target === here) a.setAttribute("aria-current", "page");
    });
  }

  /* ---- 5. 最新のアップデート(トップ) ---- */
  function renderLatestUpdates() {
    var host = document.getElementById("latest-updates");
    if (!host || typeof HISTORY === "undefined") return;
    var items = HISTORY.slice(-3).reverse();
    host.innerHTML = items.map(function (h) {
      return (
        '<div class="update">' +
        '<div class="update__date">' + esc(h.date) + "</div>" +
        '<div><div class="update__title"><span class="update__tag" style="color:' + esc(h.tagColor || "#5fb2ee") + '">' + esc(h.tag) + "</span>" + esc(h.title) + "</div>" +
        '<div class="update__body">' + esc(h.body) + "</div></div></div>"
      );
    }).join("");
  }

  /* ---- 6. 年号 ---- */
  function setupYear() {
    var y = document.querySelector("[data-year]");
    if (y) y.textContent = new Date().getFullYear();
  }

  window.HI = window.HI || {};
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  window.HI.esc = esc;

  document.addEventListener("DOMContentLoaded", function () {
    injectIcons();
    setupDrawer();
    setupReveal();
    setupDust();
    setupHeaderScroll();
    markCurrent();
    renderLatestUpdates();
    setupYear();
  });
})();
