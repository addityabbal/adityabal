// adityabal.com first-party analytics tracker (~2 KB minified). Cookieless: no cookies, no
// visitor storage, no IP, no form text. Events go in small batches to /api/e on adityabal.com.
// Loaded by BaseLayout.astro, the demo pages, and the demo subdomains:
//   <script defer src="https://adityabal.com/a.js"></script>
// Public hook for demo apps: window.abTrack(name, { target, zone, detail, value }).
// Your own devices: open any page with ?notrack=1 once (?notrack=0 undoes it).
(function () {
  "use strict";
  var w = window, d = document, nav = navigator, loc = location;
  var noop = function () {};
  w.abTrack = noop;

  // ── Opt-outs ────────────────────────────────────────────────────────────────
  try {
    var q = new URLSearchParams(loc.search).get("notrack");
    if (q === "1") localStorage.setItem("ab_notrack", "1");
    if (q === "0") localStorage.removeItem("ab_notrack");
    if (localStorage.getItem("ab_notrack") === "1") return;
  } catch (e) {}
  if (nav.webdriver || nav.globalPrivacyControl) return;
  if (!nav.sendBeacon || !w.Blob) return;

  var script = d.currentScript;
  var base = script && script.src ? new URL(script.src).origin : loc.origin;
  var endpoint = base + "/api/e";
  var start = performance.now();
  var since = function () { return Math.round(performance.now() - start); };
  var pid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  var path = loc.pathname.replace(/\.html$/, "").replace(/(.)\/$/, "$1");
  var subdemo = (loc.hostname.match(/^(scorecard|solar)\.adityabal\.com$/) || [])[1];
  var onMain = !subdemo;
  var project = (path.match(/^\/projects\/([^/]+)/) || [])[1] || "";
  var demoPage = subdemo || (path.match(/^\/demos\/([^/]+)/) || [])[1] || "";
  var pageType =
    (d.body && d.body.getAttribute("data-ab-page")) ||
    (demoPage ? "demo" : path === "/" ? "home" : project ? "project" : path.split("/")[1] || "home");

  var params = new URLSearchParams(loc.search);
  var utm = {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
  };
  var ref = "";
  try {
    var rh = d.referrer ? new URL(d.referrer).hostname.replace(/^www\./, "") : "";
    if (rh && !/(^|\.)adityabal\.com$/.test(rh)) ref = rh;
  } catch (e) {}

  // ── Queue and send ──────────────────────────────────────────────────────────
  var queue = [];
  function theme() {
    var t = d.documentElement.dataset.theme;
    return t || (w.matchMedia && w.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function flush() {
    while (queue.length) {
      var batch = queue.splice(0, 50);
      var body = JSON.stringify({ v: 1, pid: pid, path: path, project: project || demoPage, ref: ref, utm: utm, theme: theme(), events: batch });
      while (body.length > 8000 && batch.length > 1) {
        queue.unshift(batch.pop());
        body = JSON.stringify({ v: 1, pid: pid, path: path, project: project || demoPage, ref: ref, utm: utm, theme: theme(), events: batch });
      }
      try { nav.sendBeacon(endpoint, new Blob([body], { type: "text/plain" })); } catch (e) {}
    }
  }
  function track(name, props, now) {
    props = props || {};
    queue.push({ e: name, t: props.target, z: props.zone, d: props.detail, n: props.value });
    if (now) flush();
  }
  w.abTrack = function (name, props) { try { track(String(name), props, true); } catch (e) {} };
  setInterval(function () { if (queue.length) flush(); }, 10000);

  // The page view goes out at once, so a quick bounce is still counted.
  if (pageType === "404") track("not_found", { detail: pageType });
  track("page_view", { detail: pageType, target: project || demoPage }, true);

  // ── Clicks: one delegated listener for every link and button ───────────────
  function slug(text) {
    return (text || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  }
  function zoneOf(el) {
    var z = el.closest("[data-zone]");
    if (z) return z.getAttribute("data-zone");
    if (el.closest("header.nav, nav[aria-label='Main']")) return "nav";
    if (el.closest("footer")) return "footer";
    var s = el.closest("[data-track-section], section[aria-labelledby]");
    if (s) return s.getAttribute("data-track-section") || s.getAttribute("aria-labelledby");
    var n = el.closest("nav[aria-label]");
    if (n) return slug(n.getAttribute("aria-label"));
    return pageType;
  }
  var DEMO_PATH = /^\/demos\/([^/?#]+)/;
  var DEMO_HOST = /^(scorecard|solar)\.adityabal\.com$/;

  d.addEventListener("click", function (ev) {
    try {
      var el = ev.target && ev.target.closest ? ev.target.closest("a[href], button") : null;
      if (!el || el.hasAttribute("data-no-track")) return;
      var zone = zoneOf(el);
      var text = (el.getAttribute("aria-label") || el.textContent || "").trim();
      var id = el.getAttribute("data-cta") || zone + "." + slug(text);
      var p = { target: id, zone: zone, value: since() };

      if (el.tagName === "BUTTON") {
        if (el.hasAttribute("data-filter")) { p.detail = el.getAttribute("data-filter"); return track("filter_use", p); }
        if (el.hasAttribute("data-theme-toggle")) {
          return setTimeout(function () { p.detail = theme(); track("theme_toggle", p); }, 0);
        }
        if (el.hasAttribute("data-copy-link")) { p.detail = project; return track("copy_link", p); }
        p.detail = "button";
        return track("cta_click", p);
      }

      var url = new URL(el.getAttribute("href"), loc.href);
      var proto = url.protocol;
      if (proto === "mailto:") { p.detail = "email"; return track("contact_click", p, true); }
      if (proto === "tel:") { p.detail = "phone"; return track("contact_click", p, true); }
      var host = url.hostname.replace(/^www\./, "");
      if (/(^|\.)linkedin\.com$/.test(host) && /\/in\/addityabbal/i.test(url.pathname)) {
        p.detail = "linkedin"; return track("contact_click", p, true);
      }
      var demo = DEMO_HOST.test(url.hostname) ? url.hostname.split(".")[0] : url.origin === loc.origin && onMain ? (url.pathname.match(DEMO_PATH) || [])[1] : null;
      if (demo) { p.detail = demo; return track("demo_open", p, true); }
      if (onMain && url.origin === loc.origin && url.pathname.replace(/\/$/, "") === "/contact") {
        p.detail = "page"; return track("contact_click", p, true);
      }
      if (url.origin !== loc.origin && !/(^|\.)adityabal\.com$/.test(url.hostname) && /^https?:$/.test(proto)) {
        p.detail = host; return track("outbound_click", p, true);
      }
      p.detail = url.origin === loc.origin && url.pathname === loc.pathname && url.hash ? "hash" : "internal";
      track("cta_click", p);
    } catch (e) {}
  }, true);

  // ── Sections: seen (>= 50% of it, or half the screen, for 1 s) and seconds in view ──
  var sections = [];
  function sectionId(el) {
    return el.getAttribute("data-track-section") || el.getAttribute("aria-labelledby") || el.id;
  }
  if ("IntersectionObserver" in w) {
    var seen = {};
    var els = d.querySelectorAll("[data-track-section], section[aria-labelledby], .prose h2[id]");
    var thresholds = [];
    for (var i = 0; i <= 20; i++) thresholds.push(i / 20);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var s = en.target.__ab;
        var vh = w.innerHeight || 1;
        var h = en.boundingClientRect.height || 1;
        var visible = en.isIntersecting && (en.intersectionRatio >= 0.5 || en.intersectionRect.height >= vh * 0.5 || (h < 60 && en.intersectionRatio > 0.9));
        if (visible && !s.inView) {
          s.inView = true; s.since = performance.now();
          s.timer = setTimeout(function () {
            if (seen[s.id]) return;
            seen[s.id] = 1;
            track("section_view", { target: s.id, zone: String(s.pos), value: since() });
          }, 1000);
        } else if (!visible && s.inView) {
          s.inView = false; clearTimeout(s.timer);
          s.ms += performance.now() - s.since;
        }
      });
    }, { threshold: thresholds });
    for (var j = 0; j < els.length; j++) {
      var id = sectionId(els[j]);
      if (!id || els[j].__ab) continue;
      els[j].__ab = { id: id, pos: j, ms: 0, inView: false, since: 0, timer: 0 };
      sections.push(els[j].__ab);
      io.observe(els[j]);
    }
  }

  // ── Scroll depth ────────────────────────────────────────────────────────────
  var maxDepth = 0, ticking = false, marks = [25, 50, 75, 100];
  function measure() {
    ticking = false;
    var de = d.documentElement;
    var total = Math.max(de.scrollHeight - w.innerHeight, 1);
    var pct = Math.min(100, Math.round(((w.scrollY || de.scrollTop) / total) * 100));
    if (de.scrollHeight <= w.innerHeight + 4) pct = 100;
    while (marks.length && pct >= marks[0]) {
      var m = marks.shift();
      track("scroll_depth", { target: String(m), value: m });
    }
    if (pct > maxDepth) maxDepth = pct;
  }
  w.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }, { passive: true });
  setTimeout(measure, 1500);

  // ── Engaged time and section time, sent when the page is hidden or left ─────
  var engagedMs = 0, visibleSince = d.visibilityState === "visible" ? performance.now() : 0, reported = 0;
  function onHide() {
    var now = performance.now();
    if (visibleSince) { engagedMs += now - visibleSince; visibleSince = 0; }
    sections.forEach(function (s) {
      if (s.inView) { s.ms += now - s.since; s.since = now; }
      var secs = Math.round(s.ms / 100) / 10;
      if (secs >= 0.5) track("section_time", { target: s.id, value: secs });
      s.ms = 0;
    });
    var engaged = Math.round(engagedMs / 1000);
    if (engaged > reported) {
      reported = engaged;
      track("page_engaged", { value: engaged, detail: String(maxDepth) });
    }
    flush();
  }
  d.addEventListener("visibilitychange", function () {
    if (d.visibilityState === "hidden") onHide();
    else {
      visibleSince = performance.now();
      sections.forEach(function (s) { if (s.inView) s.since = visibleSince; });
    }
  });
  w.addEventListener("pagehide", function () { if (visibleSince) onHide(); });
})();
