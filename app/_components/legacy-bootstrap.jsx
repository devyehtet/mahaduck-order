"use client";

import { useEffect } from "react";

const scripts = {
  customer: [
    "/legacy/settings/config.js",
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
    "/legacy/settings/config.js",
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
    let cancelled = false;

    async function loadScripts() {
      for (const src of scripts[page]) {
        if (cancelled) return;
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`Could not load ${src}`));
          document.body.appendChild(script);
        });
      }
    }

    loadScripts().catch((error) => console.error(error));
    return () => { cancelled = true; };
  }, [page]);

  return children;
}
