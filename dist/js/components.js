(function () {
  const { escapeHtml, money, flames } = window.MahaDuckCore;

  function typeOptions({ orderTypes, activeType, stateLang, t, icons, isTableLocked }) {
    return orderTypes
      .map((type) => {
        const locked = isTableLocked(type);
        return `<button type="button" class="type-opt" role="radio" aria-checked="${activeType === type}" data-type="${type}" ${locked ? "disabled" : ""}>
          ${icons[type]}<strong>${t(type)}</strong><small>${t(type + "Sub")}</small>
        </button>`;
      })
      .join("");
  }

  function dishCard({ item, t, heat, priceText, onClickLabel }) {
    const hot = heat ? flames(heat) : "";
    return `<button type="button" class="dish-card" data-open-builder="${item.id}">
      <img src="${item.img}" alt="${escapeHtml(item.name)}" loading="lazy" width="190" height="190" />
      <div>
        <span class="kind">${escapeHtml(item.kind === "soup" ? t("soup") + " · " + item.styleCount + " " + t("broths") : t("dryPot"))}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <div class="th">${escapeHtml(item.th)} ${hot}</div>
        <div class="from">${t("per100")} <b>${money(priceText)}</b></div>
        <div><span class="go">${t("buildThis")} ${window.MahaDuckCore && window.MahaDuckCore.arrow ? window.MahaDuckCore.arrow : "→"}</span></div>
      </div>
    </button>`;
  }

  function cartLine({ line, optionLines, t, imgHtml }) {
    return `<div class="line">${imgHtml}
      <div>
        <h4>${escapeHtml(line.name)}</h4>
        <div class="opts">${optionLines.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
        <div class="lp-row">
          <span class="lp">${money(line.unitPrice * line.qty)}</span>
          <div class="stepper">
            <button type="button" data-q="${line.index}" data-d="-1" aria-label="${t("remove")}">${line.qty === 1 ? '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z"/></svg>' : "−"}</button>
            <output>${line.qty}</output>
            <button type="button" class="plus" data-q="${line.index}" data-d="1" aria-label="+">+</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  window.MahaDuckComponents = {
    typeOptions,
    dishCard,
    cartLine,
  };
})();
