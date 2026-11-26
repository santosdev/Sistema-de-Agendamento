/*!
 * Agenda Tech Resolute: embed (RN-74, RN-75). No dependencies, about 3 KB.
 *
 * Button with popup:
 *   <script src="https://APP/embed.js" data-url="https://APP/usuario/evento" data-label="Agendar conversa" async></script>
 *
 * Any element opens the popup:
 *   <a href="https://APP/usuario/evento" data-techresolute-open>Agendar</a>
 *
 * Inline:
 *   <div data-techresolute-inline="https://APP/usuario/evento"></div>
 *   <script src="https://APP/embed.js" async></script>
 *
 * When a booking is confirmed, window receives the "techresolute:booking-confirmed" event
 * (detail: { startAt }).
 */
(function () {
  "use strict";
  if (window.TechResoluteBooking) return;

  var script = document.currentScript;
  var appOrigin = script ? new URL(script.src, location.href).origin : location.origin;
  var BRAND = "#5B02FD";
  var overlay = null;
  var lastFocus = null;

  function embedUrl(url) {
    var u = new URL(url, appOrigin);
    u.searchParams.set("embed", "1");
    return u.toString();
  }

  function iframe(url, title) {
    var frame = document.createElement("iframe");
    frame.src = embedUrl(url);
    frame.title = title || "Agendamento";
    frame.loading = "lazy";
    frame.setAttribute("allow", "clipboard-write");
    frame.style.cssText = "border:0;width:100%;display:block;background:#F7F5FC;";
    return frame;
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(event) {
    if (event.key === "Escape") close();
    if (event.key === "Tab" && overlay) {
      // Keep focus inside the popup: only the close button and the iframe are focusable.
      var closeBtn = overlay.querySelector("button");
      var frame = overlay.querySelector("iframe");
      if (event.shiftKey && document.activeElement === closeBtn) {
        event.preventDefault();
        frame.focus();
      } else if (!event.shiftKey && document.activeElement === frame) {
        event.preventDefault();
        closeBtn.focus();
      }
    }
  }

  function open(url, label) {
    if (overlay) close();
    lastFocus = document.activeElement;
    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", label || "Agendamento");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;background:rgba(22,19,31,.5);display:flex;align-items:center;justify-content:center;padding:16px;";
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });

    var box = document.createElement("div");
    box.style.cssText =
      "position:relative;width:min(1080px,100%);height:min(760px,100%);border-radius:20px;overflow:hidden;background:#F7F5FC;box-shadow:0 16px 40px -16px rgba(22,19,31,.4);";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Fechar agendamento");
    closeBtn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    closeBtn.style.cssText =
      "position:absolute;top:8px;left:8px;width:44px;height:44px;border:0;border-radius:12px;background:#fff;color:#16131F;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1;box-shadow:0 1px 2px rgba(22,19,31,.1);";
    closeBtn.addEventListener("click", close);

    var frame = iframe(url, label);
    frame.loading = "eager";
    frame.style.height = "100%";

    box.appendChild(closeBtn);
    box.appendChild(frame);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKey, true);
    closeBtn.focus();
  }

  function button(url, label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label || "Agendar conversa";
    btn.style.cssText =
      "font:600 14px/1 Inter,Segoe UI,Helvetica,Arial,sans-serif;background:" +
      BRAND +
      ";color:#fff;border:0;border-radius:12px;padding:0 20px;height:48px;cursor:pointer;";
    btn.addEventListener("click", function () {
      open(url, label);
    });
    return btn;
  }

  function mountInline(el) {
    if (el.getAttribute("data-techresolute-mounted")) return;
    el.setAttribute("data-techresolute-mounted", "1");
    var frame = iframe(el.getAttribute("data-techresolute-inline"), el.getAttribute("data-title"));
    frame.style.height = (el.getAttribute("data-height") || "760") + "px";
    frame.style.borderRadius = "20px";
    el.appendChild(frame);
  }

  function scan() {
    var inline = document.querySelectorAll("[data-techresolute-inline]");
    for (var i = 0; i < inline.length; i++) mountInline(inline[i]);

    var openers = document.querySelectorAll("[data-techresolute-open]:not([data-techresolute-mounted])");
    for (var j = 0; j < openers.length; j++) {
      (function (el) {
        el.setAttribute("data-techresolute-mounted", "1");
        el.addEventListener("click", function (event) {
          event.preventDefault();
          open(el.getAttribute("data-techresolute-open") || el.getAttribute("href"), el.textContent.trim());
        });
      })(openers[j]);
    }
  }

  // Messages from the booking page: only from our own origin.
  window.addEventListener("message", function (event) {
    if (event.origin !== appOrigin || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "techresolute:resize") {
      var frames = document.querySelectorAll("[data-techresolute-inline] iframe");
      for (var i = 0; i < frames.length; i++) {
        if (frames[i].contentWindow === event.source) frames[i].style.height = Math.ceil(event.data.height) + "px";
      }
    }
    if (event.data.type === "techresolute:booking-confirmed") {
      window.dispatchEvent(new CustomEvent("techresolute:booking-confirmed", { detail: { startAt: event.data.startAt } }));
    }
  });

  window.TechResoluteBooking = { open: open, close: close, scan: scan };

  if (script && script.getAttribute("data-url")) {
    script.insertAdjacentElement("afterend", button(script.getAttribute("data-url"), script.getAttribute("data-label")));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
