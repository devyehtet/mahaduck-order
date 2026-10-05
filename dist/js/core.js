(function () {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

  const money = (value, currency = "฿") => `${currency}${Number(value || 0).toLocaleString("en-US")}`;

  const flames = (level = 0, icon = "<svg viewBox='0 0 24 24' width='13' height='13' aria-hidden='true'><path fill='currentColor' d='M12 2c1 3-1 4.5-1 6.5 0 1.4 1 2.5 2.3 2.5 1.7 0 1.7-2 1.3-3 2.2 1.6 3.4 4 3.4 6.4a6 6 0 0 1-12 0C6 9 12 7 12 2Z'/></svg>") => {
    if (!level) return "";
    return `<span class="chili" aria-label="${level}/5 spicy">${Array.from({ length: level }, () => icon).join("")}</span>`;
  };

  const localizeText = (language, entry) => {
    if (!entry) return "";
    if (language === "th" && entry.th) return entry.th;
    if (language === "my" && entry.my) return entry.my;
    return entry.name || entry.en || "";
  };

  const merge = (base, patch) => ({ ...base, ...patch });

  window.MahaDuckCore = {
    escapeHtml,
    money,
    flames,
    localizeText,
    merge,
  };
})();
