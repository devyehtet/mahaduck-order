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
    "/legacy/js/promptpay.js",
    "/legacy/js/admin.js",
    "/legacy/js/pos.js",
  ],
};

export default function LegacyBootstrap({ page, children }) {
  useEffect(() => {
    document.body.classList.toggle("admin", page === "admin");
    window.__MAHA_LEGACY_SCRIPTS__ ||= new Set();
    let cancelled = false;

    async function loadScripts() {
      for (const src of scripts[page]) {
        if (cancelled) return;
        if (window.__MAHA_LEGACY_SCRIPTS__.has(src)) continue;
        await new Promise((resolve, reject) => {
          window.__MAHA_LEGACY_SCRIPTS__.add(src);
          const script = document.createElement("script");
          script.src = src;
          script.dataset.mahaLegacyScript = src;
          script.onload = resolve;
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
