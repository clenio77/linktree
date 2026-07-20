(function () {
  "use strict";

  var STORAGE_KEY = "digital-card-lang";
  var SUPPORTED = ["pt", "en"];
  var cache = {};
  var currentLang = "pt";

  var socialList = document.getElementById("social-list");
  var linksList = document.getElementById("links-list");
  var trustList = document.getElementById("trust-list");
  var qrImage = document.getElementById("qr-image");
  var langButtons = document.querySelectorAll(".lang-btn");

  function getByPath(obj, path) {
    return path.split(".").reduce(function (acc, key) {
      return acc && acc[key] !== undefined ? acc[key] : undefined;
    }, obj);
  }

  function detectLanguage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) {
      /* ignore */
    }

    var nav = (navigator.language || navigator.userLanguage || "pt").toLowerCase();
    if (nav.indexOf("en") === 0) return "en";
    return "pt";
  }

  function persistLanguage(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }

  function loadMessages(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);

    return fetch("i18n/" + lang + ".json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + lang);
        return res.json();
      })
      .then(function (data) {
        cache[lang] = data;
        return data;
      });
  }

  function trackLanguage(lang) {
    if (typeof gtag === "function") {
      gtag("event", "language_switch", {
        event_category: "engagement",
        event_label: lang
      });
    }
  }

  function trackOutbound(label) {
    if (typeof gtag === "function") {
      gtag("event", "click", {
        event_category: "outbound",
        event_label: label
      });
    }
  }

  function renderSocial(items) {
    if (!socialList) return;
    socialList.innerHTML = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", item.label);
      a.addEventListener("click", function () {
        trackOutbound("social:" + item.id);
      });

      var img = document.createElement("img");
      img.src = item.icon;
      img.alt = "";
      img.width = 24;
      img.height = 24;
      img.decoding = "async";

      a.appendChild(img);
      li.appendChild(a);
      socialList.appendChild(li);
    });
  }

  function renderTrust(items) {
    if (!trustList) return;
    trustList.innerHTML = "";
    (items || []).forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item.label;
      trustList.appendChild(li);
    });
  }

  function renderLinkItems(target, items, options) {
    if (!target) return;
    target.innerHTML = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      if (options && options.featuredClass && item.featured) {
        a.className = "featured";
      }
      a.textContent = item.title;

      var span = document.createElement("span");
      span.textContent = item.description;
      a.appendChild(span);

      a.addEventListener("click", function () {
        trackOutbound((options && options.prefix ? options.prefix : "link") + ":" + (item.id || item.title));
      });

      li.appendChild(a);
      target.appendChild(li);
    });
  }

  function updateStaticCopy(messages) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var value = getByPath(messages, key);
      if (typeof value === "string") el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-href]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-href");
      var value = getByPath(messages, key);
      if (typeof value === "string") el.setAttribute("href", value);
    });

    if (messages.meta) {
      if (messages.meta.title) document.title = messages.meta.title;

      var desc = document.querySelector('meta[name="description"]');
      if (desc && messages.meta.description) {
        desc.setAttribute("content", messages.meta.description);
      }

      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && messages.meta.title) {
        ogTitle.setAttribute("content", messages.meta.title);
      }

      var ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && messages.meta.description) {
        ogDesc.setAttribute("content", messages.meta.description);
      }

      var twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle && messages.meta.title) {
        twTitle.setAttribute("content", messages.meta.title);
      }

      var twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc && messages.meta.description) {
        twDesc.setAttribute("content", messages.meta.description);
      }
    }
  }

  function updateLangButtons(lang) {
    langButtons.forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function updateQr() {
    if (!qrImage) return;
    var pageUrl = window.location.href.split("#")[0];
    var qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=148x148&margin=8&data=" +
      encodeURIComponent(pageUrl);
    qrImage.src = qrUrl;
    qrImage.alt =
      currentLang === "en"
        ? "QR Code linking to this corporate card"
        : "QR Code que abre este cartão corporativo";
  }

  function applyLanguage(lang, options) {
    var silent = options && options.silent;
    return loadMessages(lang)
      .then(function (messages) {
        currentLang = lang;
        document.documentElement.lang = lang;
        document.documentElement.setAttribute("data-lang", lang);
        persistLanguage(lang);
        updateLangButtons(lang);
        updateStaticCopy(messages);
        renderTrust(messages.trust || []);
        renderSocial(messages.social || []);
        renderLinkItems(linksList, messages.links || [], {
          featuredClass: true,
          prefix: "link"
        });
        updateQr();
        if (!silent) trackLanguage(lang);
      })
      .catch(function (err) {
        console.error(err);
        if (lang !== "pt") return applyLanguage("pt", { silent: true });
      });
  }

  function onLangClick(event) {
    var btn = event.currentTarget;
    var lang = btn.getAttribute("data-lang");
    if (!lang || lang === currentLang) return;
    applyLanguage(lang);
  }

  function init() {
    document.body.classList.add("is-loading");
    langButtons.forEach(function (btn) {
      btn.addEventListener("click", onLangClick);
    });

    var primaryCta = document.querySelector(".primary-cta");
    if (primaryCta) {
      primaryCta.addEventListener("click", function () {
        trackOutbound("cta:linkedin");
      });
    }

    var secondaryCta = document.querySelector(".secondary-cta");
    if (secondaryCta) {
      secondaryCta.addEventListener("click", function () {
        trackOutbound("cta:email");
      });
    }

    var tertiaryCta = document.querySelector(".tertiary-cta");
    if (tertiaryCta) {
      tertiaryCta.addEventListener("click", function () {
        trackOutbound("cta:whatsapp-secondary");
      });
    }

    applyLanguage(detectLanguage(), { silent: true }).finally(function () {
      document.body.classList.remove("is-loading");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
