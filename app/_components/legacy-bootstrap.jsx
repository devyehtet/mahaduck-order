"use client";

import { useEffect } from "react";

const scripts = {
  customer: [
    "/api/runtime-config",
    "/legacy/settings/menu.js",
    "/legacy/js/api.js",
    "/legacy/js/i18n.js",
    "/legacy/js/core.js",
    "/legacy/js/components.js",
    "/legacy/vendor/qrcode.js",
    "/legacy/js/promptpay.js",
    "/legacy/js/app.js",
  ],
  admin: [
    "/api/runtime-config",
    "/legacy/settings/menu.js",
    "/legacy/js/api.js",
    "/legacy/js/i18n.js",
    "/legacy/vendor/qrcode.js",
    "/legacy/js/admin.js",
  ],
};

function isScriptReady(src) {
  if (src === "/api/runtime-config") return Boolean(window.MAHA_CONFIG);
  if (src === "/legacy/settings/menu.js") return Boolean(window.MAHA_MENU);
  if (src === "/legacy/js/api.js") return Boolean(window.MahaAPI);
  if (src === "/legacy/js/i18n.js") return Boolean(window.MAHA_I18N);
  if (src === "/legacy/js/core.js") return Boolean(window.MahaDuckCore);
  if (src === "/legacy/js/components.js") return Boolean(window.MahaDuckComponents);
  if (src === "/legacy/vendor/qrcode.js") return Boolean(window.qrcode);
  if (src === "/legacy/js/promptpay.js") return Boolean(window.PromptPay);
  return true;
}

export default function LegacyBootstrap({ page, children }) {
  useEffect(() => {
    document.body.classList.toggle("admin", page === "admin");
    window.__MAHA_LEGACY_SCRIPTS__ ||= new Set();
    let cancelled = false;

    async function loadScripts() {
      for (const src of scripts[page]) {
        if (cancelled) return;
        if (window.__MAHA_LEGACY_SCRIPTS__.has(src) && isScriptReady(src)) continue;
        window.__MAHA_LEGACY_SCRIPTS__.delete(src);
        await new Promise((resolve, reject) => {
          window.__MAHA_LEGACY_SCRIPTS__.add(src);
          const script = document.createElement("script");
          script.src = src;
          script.dataset.mahaLegacyScript = src;
          script.onload = () => {
            if (!isScriptReady(src)) {
              window.__MAHA_LEGACY_SCRIPTS__.delete(src);
              reject(new Error(`${src} loaded without initializing`));
              return;
            }
            resolve();
          };
          script.onerror = () => {
            window.__MAHA_LEGACY_SCRIPTS__.delete(src);
            reject(new Error(`Could not load ${src}`));
          };
          document.body.appendChild(script);
        });
      }
    }

    loadScripts().catch((error) => console.error(error));
    return () => { cancelled = true; };
  }, [page]);

  return children;
}
