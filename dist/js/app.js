(function () {
  const CFG = window.MAHA_CONFIG;
  const MENU = window.MAHA_MENU;
  const api = window.MahaAPI;
  const core = window.MahaDuckCore || {};
  const esc = core.escapeHtml || ((v) => String(v ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const money = core.money || ((n) => CFG.currency + Number(n || 0).toLocaleString("en-US"));
  const flames = core.flames || ((n) => (n ? "🔥".repeat(n) : ""));
  const S = api.store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const params = new URLSearchParams(location.search);
  const tableParam = (params.get("table") || "").replace(/[^\w-]/g, "").slice(0, 8);
  const navLang = (navigator.language || "en").slice(0, 2);
  const state = {
    lang: S.get("mahaduck-lang", ["th", "my"].includes(navLang) ? navLang : "en"),
    type: tableParam ? "dinein" : S.get("mahaduck-type", CFG.orderTypes[0]),
    table: tableParam || "",
    cart: S.get("mahaduck-cart", []),
    myOrders: S.get("mahaduck-my-orders", []),
    customer: S.get("mahaduck-customer", { name: "", phone: "", address: "", map: "" }),
    dest: S.get("mahaduck-dest", null), // { lat, lng, label, src: "gps" | "area" }
    destOther: false,
    payment: (CFG.paymentMethods && CFG.paymentMethods[0]) || "cash",
    pickup: "asap",
    settings: { accepting_orders: true, notice: "" },
    cartView: "cart", // cart | checkout | success | orders
    lastOrder: null,
  };
  if (!CFG.orderTypes.includes(state.type)) state.type = CFG.orderTypes[0];
  const t = window.makeT(() => state.lang);

  const allItems = {};
  MENU.sections.forEach((s) => s.items.forEach((it) => (allItems[it.id] = { ...it, section: s.id })));
  const ingIndex = {};
  ["meat", "veg"].forEach((g) => MENU.bowl.ingredients[g].forEach((i) => (ingIndex[i.id] = { ...i, group: g })));
  const SET = MENU.malaSet || null;
  const BOWL_ON = Boolean(MENU.bowl && MENU.bowl.enabled !== false);
  const firstSec = () => (BOWL_ON ? "sec-bowl" : "sec-" + MENU.sections[0].id);
  const setItem = {};
  if (SET) SET.groups.forEach((g) => g.items.forEach((i) => (setItem[i.id] = i)));
  const sizeById = SET ? Object.fromEntries(SET.sizes.map((z) => [z.id, z])) : {};
  const sizeName = (z, kitchen) => (kitchen ? z.name : state.lang === "th" ? z.th : state.lang === "my" ? z.my : z.name);
  state.cart = state.cart.filter((l) => (l.kind === "bowl" ? BOWL_ON : Boolean(allItems[l.itemId])) && (!allItems[l.itemId] || !allItems[l.itemId].meats || (l.options && l.options.meat)));
  const styleById = Object.fromEntries(MENU.bowl.styles.map((s) => [s.id, s]));
  const dishById = Object.fromEntries(MENU.bowl.dishes.map((d) => [d.id, d]));

  const local = (o) => (state.lang === "th" && o.th ? o.th : state.lang === "my" && o.my ? o.my : o.name);
  const sub = (o) => (state.lang === "th" || (state.lang === "my" && o.my) ? o.name : o.th || "");
  const priceRange = (list) => { const p = list.map((x) => x.price); const lo = Math.min(...p), hi = Math.max(...p); return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`; };
  const tx = (obj) => (obj ? obj[state.lang] || obj.en : "");

  const ICON = {
    delivery: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19 7a2 2 0 0 0-2-2h-3v2h3v2.65L13.52 14H10V9H6a4 4 0 0 0-4 4v3h2a3 3 0 0 0 6 0h4.48L19 10.35V7ZM7 17a1 1 0 0 1-1-1h2a1 1 0 0 1-1 1Zm-1-9h4v2H6V8Zm13 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
    pickup: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M18 6h-2a4 4 0 0 0-8 0H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm-6-2a2 2 0 0 1 2 2h-4a2 2 0 0 1 2-2Zm6 16H6V8h2v2a1 1 0 0 0 2 0V8h4v2a1 1 0 0 0 2 0V8h2v12Z"/></svg>',
    dinein: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 9H9V2H7v7H5V2H3v7a4 4 0 0 0 3.75 3.97V22h2.5v-9.03A4 4 0 0 0 13 9V2h-2v7Zm5-3v8h2.5v8H21V2a5 5 0 0 0-5 4Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 2c1 3-1 4.5-1 6.5 0 1.4 1 2.5 2.3 2.5 1.7 0 1.7-2 1.3-3 2.2 1.6 3.4 4 3.4 6.4a6 6 0 0 1-12 0C6 9 12 7 12 2Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>',
  };

  const saveCart = () => S.set("mahaduck-cart", state.cart);
  const cartCount = () => state.cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = () => state.cart.reduce((n, l) => n + l.unitPrice * l.qty, 0);
  // ---------- delivery fee (distance-based, Grab-style rate card) ----------
  const DLV = CFG.delivery && typeof CFG.delivery.shopLat === "number" ? CFG.delivery : null;
  function roadKm(lat, lng) {
    const R = 6371, rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(lat - DLV.shopLat), dLng = rad(lng - DLV.shopLng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(DLV.shopLat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a)) * (DLV.roadFactor || 1.3);
  }
  function feeForKm(km) {
    let fee = DLV.baseFare || 0, from = 0;
    for (const tier of DLV.tiers || []) {
      if (km <= from) break;
      fee += (Math.min(km, tier.upToKm) - from) * tier.perKm;
      from = tier.upToKm;
    }
    fee += DLV.extra || 0;
    const r = DLV.roundTo || 1;
    return Math.ceil(fee / r - 1e-9) * r;
  }
  // → { known, fee, km, far }
  function quote() {
    if (state.type !== "delivery") return { known: true, fee: 0 };
    if (typeof CFG.deliveryFee === "number") return { known: true, fee: CFG.deliveryFee };
    if (DLV && state.dest) {
      const km = roadKm(state.dest.lat, state.dest.lng);
      if (km > (DLV.maxKm || 999)) return { known: false, km, far: true };
      return { known: true, fee: feeForKm(km), km };
    }
    return { known: false };
  }
  const deliveryFee = () => { const q = quote(); return q.known ? q.fee : 0; };
  const kmText = (km) => (km < 10 ? km.toFixed(1) : Math.round(km)) + " km";
  function cleanMapLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      const ok = url.protocol === "https:" && (
        host === "maps.app.goo.gl" ||
        host === "maps.google.com" ||
        host === "www.google.com" ||
        host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "goo.gl"
      );
      if (!ok || (host === "goo.gl" && !url.pathname.startsWith("/maps/"))) return null;
      return url.toString().slice(0, 300);
    } catch {
      return null;
    }
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function applyLang() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
    renderAll();
  }

  function typeOptions(container, cls) {
    if (window.MahaDuckComponents && window.MahaDuckComponents.typeOptions) {
      container.innerHTML = window.MahaDuckComponents.typeOptions({
        orderTypes: CFG.orderTypes,
        activeType: state.type,
        stateLang: state.lang,
        t,
        icons: ICON,
        isTableLocked: (ty) => Boolean(state.table && ty !== "dinein"),
      });
      return;
    }
    container.innerHTML = CFG.orderTypes
      .map((ty) => {
        const locked = state.table && ty !== "dinein";
        return `<button type="button" class="type-opt" role="radio" aria-checked="${state.type === ty}" data-type="${ty}" ${locked ? "disabled" : ""}>
          ${ICON[ty]}<strong>${t(ty)}</strong><small>${t(ty + "Sub")}</small></button>`;
      })
      .join("");
  }

  function renderHeader() {
    const n = cartCount();
    const c = $("#cartCount");
    c.textContent = n;
    c.dataset.zero = String(n === 0);
    const bar = $("#orderbar");
    bar.hidden = n === 0;
    $("#orderbarCount").textContent = n;
    $("#orderbarTotal").textContent = money(subtotal());
    typeOptions($("#typeSwitch"));

    const notice = $("#shopNotice");
    const s = state.settings;
    if (!s.accepting_orders) {
      notice.hidden = false; notice.className = "notice is-closed"; notice.textContent = s.notice || t("closed");
    } else if (s.notice) {
      notice.hidden = false; notice.className = "notice"; notice.textContent = s.notice;
    } else notice.hidden = true;

    const tb = $("#tableBanner");
    tb.hidden = !state.table;
    tb.textContent = `${t("tableBanner")} ${state.table}`;
  }

  function renderDishPick() {
    $("#sec-bowl").hidden = !BOWL_ON;
    if (!BOWL_ON) return;
    const min = MENU.bowl.pricePer100g.meat;
    $("#dishPick").innerHTML = MENU.bowl.dishes
      .map((d) => {
        const styles = MENU.bowl.styles.filter((s) => s.dish === d.id);
        const heat = Math.max(...styles.map((s) => s.heat));
        if (window.MahaDuckComponents && window.MahaDuckComponents.dishCard) {
          return window.MahaDuckComponents.dishCard({
            item: { ...d, styleCount: styles.length },
            t,
            heat,
            priceText: min,
            onClickLabel: t("buildThis"),
          });
        }
        return `<button type="button" class="dish-card" data-open-builder="${d.id}">
          <img src="${d.img}" alt="${esc(d.name)}" loading="lazy" width="190" height="190" />
          <div>
            <span class="kind">${d.kind === "soup" ? t("soup") + " · " + styles.length + " " + t("broths") : t("dryPot")}</span>
            <h3>${esc(d.name)}</h3>
            <div class="th">${esc(d.th)} ${flames(heat)}</div>
            <div class="from">${t("per100")} <b>${money(min)}</b></div>
            <div><span class="go">${t("buildThis")} ${ICON.arrow}</span></div>
          </div>
        </button>`;
      })
      .join("");
  }

  function cardMedia(it) {
    if (it.img) {
      const plate = /dish-|style-/.test(it.img);
      return `<div class="card-media ${plate ? "plate" : ""}"><img src="${it.img}" alt="${esc(it.name)}" loading="lazy" /></div>`;
    }
    const green = it.art === "rice";
    return `<div class="card-media art ${green ? "green" : ""}"><div><img src="images/brand/logo-mark.png" alt="" style="margin:0 auto" /><span>${esc(it.name)}</span></div></div>`;
  }

  function inCartQty(id) {
    return state.cart.filter((l) => l.itemId === id).reduce((n, l) => n + l.qty, 0);
  }

  function renderSections() {
    $("#sections").innerHTML = MENU.sections
      .map(
        (sec) => `<section class="section" id="sec-${sec.id}">
        <div class="section-head"><h2>${esc(tx(sec.title))}</h2>${sec.note ? `<p>${esc(tx(sec.note))}</p>` : ""}</div>
        <div class="grid ${sec.feature ? "feature" : sec.items.length === 1 ? "solo" : ""}">
          ${sec.items
            .map((it) => {
              const q = inCartQty(it.id);
              const soon = it.price == null;
              const badge = it.badge ? `<span class="badge ${it.badge === "signature" ? "red" : ""}">${t(it.badge)}</span>` : "";
              return `<article class="card">
                ${badge}${q ? `<span class="in-cart" aria-label="${q} in order">${q}</span>` : ""}
                ${cardMedia(it)}
                <div class="card-body">
                  <h3>${esc(local(it))}</h3>
                  <div class="th">${esc(sub(it))} ${it.spicy ? flames(1) : ""}</div>
                  ${it.desc ? `<p class="desc">${esc(tx(it.desc))}</p>` : ""}
                  ${it.meats ? `<div class="size-chips">${it.meats.map((m) => `<button type="button" data-add="${it.id}" data-meat="${m.id}"><b>${esc(local(m))}</b> ${money(m.price)}</button>`).join("")}</div>` : ""}
                  ${it.set && SET ? `<div class="size-chips">${SET.sizes.map((z) => `<button type="button" data-open-set="${z.id}"><b>${esc(sizeName(z))}</b> ${money(z.price)}<small>${t("pickN").replace("{n}", z.pick)}</small></button>`).join("")}</div>` : ""}
                  <div class="card-foot">
                    ${soon ? `<span class="price muted">${t("comingSoon")}</span>` : it.set && SET ? `<span class="price">${priceRange(SET.sizes)}</span>` : it.meats ? `<span class="price">${priceRange(it.meats)}</span>` : `<span class="price">${money(it.price)}</span>`}
                    <button class="add-btn" type="button" data-add="${it.id}" aria-label="${t("add")} ${esc(it.name)}" ${soon ? "disabled" : ""}>${ICON.plus}</button>
                  </div>
                </div>
              </article>`;
            })
            .join("")}
        </div></section>`
      )
      .join("");

    const nav = [...(BOWL_ON ? [{ id: "bowl", label: t("secBowl") }] : []), ...MENU.sections.map((s) => ({ id: s.id, label: tx(s.title) }))];
    $("#catnav").innerHTML = nav.map((n, i) => `<a href="#sec-${n.id}" class="${i === 0 ? "is-active" : ""}">${esc(n.label)}</a>`).join("");
    observeSections();
  }

  function renderSpicePoster() {
    $("#spiceRow").innerHTML = MENU.spicy
      .map(
        (s) => `<div class="spice-tile"><img src="${s.img}" alt="" loading="lazy" /><div><b>${s.level}</b><strong>${esc(spiceName(s))}</strong><small>${esc(s.sub)}</small></div></div>`
      )
      .join("");
  }
  const spiceName = (s) => (state.lang === "th" ? s.th : state.lang === "my" ? s.my : s.name);

  function renderFooter() {
    const parts = [`${CFG.shopName} · ${CFG.location}`];
    if (CFG.phone) parts.push(`<a href="tel:${esc(CFG.phone.replace(/\s/g, ""))}">${esc(CFG.phone)}</a>`);
    if (messengerUrl) parts.push(`<a href="${esc(messengerUrl)}" target="_blank" rel="noopener">Facebook Messenger</a>`);
    $("#footerInfo").innerHTML = parts.join(" · ");
  }

  // ---- category nav: highlight the section in view, and scroll to a section on tap ----
  const navOffset = () => $(".topbar").offsetHeight + $("#catnav").offsetHeight + 8;
  function setActiveNav(id) {
    const nav = $("#catnav");
    let act = null;
    $$("a", nav).forEach((a) => { const on = a.getAttribute("href") === "#" + id; a.classList.toggle("is-active", on); if (on) act = a; });
    // scroll only the pill row itself (never the page) so the active pill stays visible
    if (act) nav.scrollTo({ left: act.offsetLeft - (nav.clientWidth - act.offsetWidth) / 2, behavior: "smooth" });
  }
  let navLockUntil = 0, navTick = false, navCurrent = "";
  function syncNav() {
    navTick = false;
    if (Date.now() < navLockUntil) return;
    const line = navOffset() + 24;
    let cur = "";
    for (const sec of $$(".section[id^=sec-]")) if (sec.getBoundingClientRect().top <= line) cur = sec.id;
    if (!cur) cur = firstSec();
    if (cur !== navCurrent) { navCurrent = cur; setActiveNav(cur); }
  }
  window.addEventListener("scroll", () => { if (!navTick) { navTick = true; requestAnimationFrame(syncNav); } }, { passive: true });
  function goToSection(id) {
    const sec = document.getElementById(id);
    if (!sec) return;
    navCurrent = id; setActiveNav(id);
    navLockUntil = Date.now() + 900; // don't let scroll-spy fight the animated scroll
    setTimeout(syncNav, 950);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - navOffset(), behavior: reduce ? "auto" : "smooth" });
  }
  function observeSections() { navCurrent = ""; syncNav(); }

  function renderAll() {
    renderHeader();
    renderDishPick();
    renderSections();
    renderSpicePoster();
    renderFooter();
    if ($("#cart").open) renderCart();
    if ($("#builder").open) renderBuilder();
    if (SET && $("#setSheet").open) renderSet();
    if (SET && $("#heroSizes")) $("#heroSizes").textContent = SET.sizes.map((z) => money(z.price)).join(" · ");
  }

  function addLine(line) {
    const existing = state.cart.find((l) => l.key === line.key);
    if (existing) existing.qty += line.qty;
    else state.cart.push(line);
    saveCart();
    renderHeader();
    renderSections();
    toast(t("added"));
    const pill = $("#cartOpen");
    pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump");
  }

  function lineKey(id, opts) {
    return id + "|" + JSON.stringify(opts || {});
  }

  function quickAdd(id, meat) {
    const it = allItems[id];
    if (!it || it.price == null) return;
    if (it.set && SET) return openSet();
    if (it.meats || it.soups || it.spicy) return openItemSheet(it, null, meat);
    addLine({ key: lineKey(id), kind: "item", itemId: id, name: it.name, th: it.th, img: it.img || "", unitPrice: it.price, qty: 1, options: {} });
  }

  const setB = { step: 0, size: "S", picks: [], addons: [], taste: 1, spicy: 2, mala: 2, note: "", editKey: null };
  // Add-ons: once the set's picks are full, extra items can be added at their own menu price.
  const ADDONS_ON = Boolean(SET && SET.addOns !== false);
  const canAddOn = (id) => ADDONS_ON && setItem[id] && typeof setItem[id].price === "number";
  const addonTotal = (ids) => (ids || []).reduce((n, id) => n + (setItem[id] ? setItem[id].price || 0 : 0), 0);
  function normalizeSet() {
    const z = sizeById[setB.size];
    setB.addons = (setB.addons || []).filter((id) => canAddOn(id) && !setB.picks.includes(id));
    if (setB.picks.length > z.pick) setB.picks.length = z.pick;
    // never charge an add-on while a set slot is still free: move the priciest add-on into the set
    while (setB.picks.length < z.pick && setB.addons.length) {
      const best = setB.addons.reduce((a, b) => (setItem[b].price > setItem[a].price ? b : a));
      setB.addons.splice(setB.addons.indexOf(best), 1);
      setB.picks.push(best);
    }
  }
  function openSet(sizeId, fromLine) {
    if (fromLine) Object.assign(setB, JSON.parse(JSON.stringify(fromLine.options)), { step: 1, editKey: fromLine.key });
    else Object.assign(setB, { step: sizeId ? 1 : 0, size: sizeById[sizeId] ? sizeId : "S", picks: [], addons: [], taste: 1, spicy: 2, mala: 2, note: "", editKey: null });
    setB.picks = setB.picks.filter((id) => setItem[id]);
    if (fromLine && !fromLine.options.addons) setB.addons = [];
    renderSet();
    if (!$("#setSheet").open) $("#setSheet").showModal();
    $("#setBody").scrollTop = 0;
  }
  function renderSet() {
    const it = allItems[SET.itemId];
    const z = sizeById[setB.size];
    normalizeSet();
    const extra = addonTotal(setB.addons);
    const total = z.price + extra;
    $("#setTitle").textContent = local(it);
    const labels = [t("sStep1"), t("sStep2"), t("sStep3")];
    $("#setProgress").innerHTML = `<div class="progress">${labels.map((_, i) => `<span class="${i <= setB.step ? "done" : ""}"></span>`).join("")}</div>
      <div class="progress-labels">${labels.map((l, i) => `<span class="${i === setB.step ? "cur" : ""}">${i + 1}. ${esc(l)}</span>`).join("")}</div>`;
    const body = $("#setBody");
    const left = z.pick - setB.picks.length;
    if (setB.step === 0) {
      body.innerHTML = `<h3 class="step-title">${t("chooseSize")}</h3><div class="size-grid" role="radiogroup">${SET.sizes
        .map((x) => `<button type="button" class="size-card" role="radio" aria-checked="${setB.size === x.id}" data-ssize="${x.id}">
          <small>${esc(x.name.toUpperCase())}${state.lang !== "en" ? " · " + esc(sizeName(x)) : ""}</small><b>${money(x.price)}</b><span>${t("pickN").replace("{n}", x.pick)}</span></button>`)
        .join("")}</div><p class="hint" style="margin-top:14px">${t("sizeHint")}</p>`;
    }
    if (setB.step === 1) {
      const tile = (i) => {
        const on = setB.picks.includes(i.id), add = setB.addons.includes(i.id);
        const offer = !on && !add && !left && canAddOn(i.id); // set is full → this one would be an add-on
        const price = add || offer ? ` · <b class="plus">+${money(i.price)}</b>` : "";
        return `<button type="button" class="pick ${on ? "on" : ""} ${add ? "addon" : ""} ${offer ? "offer" : ""}" aria-pressed="${on || add}" data-spick="${i.id}" ${!on && !add && !left && !offer ? "disabled" : ""}>
          <strong>${esc(local(i))}</strong><small>${esc(sub(i))}${price}</small></button>`;
      };
      body.innerHTML = `<div class="pick-bar ${left ? "" : "full"}"><span>${esc(sizeName(z))} · ${money(z.price)}${setB.addons.length ? ` <em>+ ${t("addOn")} ${setB.addons.length} · ${money(extra)}</em>` : ""}</span><b>${setB.picks.length} / ${z.pick}</b></div>
        <p class="hint" style="margin-top:10px">${left || !ADDONS_ON ? t("pickHint").replace("{n}", z.pick) : t("addOnHint")}</p>
        ${SET.groups
          .map((g) => `<h3 class="grp-title">${esc(state.lang === "th" ? g.th : g.name)}${state.lang === "my" && g.my ? ` <small>${esc(g.my)}</small>` : state.lang === "en" ? ` <small>${esc(g.th)}</small>` : ""}</h3>
          <div class="pick-grid">${g.items.map(tile).join("")}</div>`)
          .join("")}`;
    }
    if (setB.step === 2) {
      body.innerHTML = `<h3 class="step-title">${t("chooseTaste")}</h3><div class="taste-list" role="radiogroup">${SET.tastes
        .map((x) => `<button type="button" class="taste" role="radio" aria-checked="${setB.taste === x.id}" data-staste="${x.id}"><i>${x.id}</i><span><strong>${esc(local(x))}</strong><small>${esc(sub(x))}</small></span></button>`)
        .join("")}</div>
        ${SET.askSpicy ? `<h3 class="step-title">${t("spicyLevel")}</h3>${spicePicker(setB.spicy, true)}` : ""}
        <h3 class="step-title">${t("noteLabel")}</h3>
        <label class="field"><span class="sr-only">${t("noteLabel")}</span><textarea id="sNote" rows="2" maxlength="200" placeholder="${esc(t("notePh"))}">${esc(setB.note)}</textarea></label>
        <div class="totals"><div><span>${esc(local(it))} · ${esc(sizeName(z))}</span></div>
          <div><small>${esc(setB.picks.map((id) => local(setItem[id])).join(", "))}</small><span>${money(z.price)}</span></div>
          ${setB.addons.map((id) => `<div><small>+ ${t("addOn")}: ${esc(local(setItem[id]))}</small><span>${money(setItem[id].price)}</span></div>`).join("")}
          <div class="grand"><span>${z.pick + setB.addons.length} ${t("itemsWord")}</span><b>${money(total)}</b></div></div>`;
    }
    $("#setBack").hidden = setB.step === 0;
    const next = $("#setNext");
    if (setB.step === 0) { next.textContent = `${t("next")} · ${money(z.price)}`; next.disabled = false; }
    if (setB.step === 1) { next.textContent = left ? t("pickMore").replace("{n}", left) : `${t("next")} · ${money(total)}`; next.disabled = left > 0; }
    if (setB.step === 2) { next.textContent = `${setB.editKey ? t("save") : t("addToOrder")} · ${money(total)}`; next.disabled = false; }
  }
  function commitSet() {
    const it = allItems[SET.itemId];
    const z = sizeById[setB.size];
    normalizeSet();
    const opts = { size: setB.size, picks: [...setB.picks], taste: setB.taste, note: setB.note.trim() };
    if (setB.addons.length) opts.addons = [...setB.addons];
    if (SET.askSpicy) opts.spicy = setB.spicy;
    const line = { key: lineKey("set", opts), kind: "set", itemId: it.id, name: `${it.name} · ${z.name}`, th: `${it.th} · ${z.th}`, my: it.my ? `${it.my} · ${z.my}` : "", img: it.img || "", unitPrice: z.price + addonTotal(opts.addons), qty: 1, options: opts };
    $("#setSheet").close();
    if (setB.editKey) {
      const old = state.cart.find((l) => l.key === setB.editKey);
      if (old) { line.qty = old.qty; state.cart = state.cart.filter((l) => l !== old); }
      state.cart.push(line);
      saveCart(); renderHeader(); renderSections();
      return openCart("cart");
    }
    addLine(line);
  }

  const builder = { step: 0, dish: "malatang", style: "S1", ing: {}, spicy: 2, mala: 2, note: "", editKey: null, tab: "meat" };

  function openBuilder(dishId, fromLine) {
    if (fromLine) {
      Object.assign(builder, JSON.parse(JSON.stringify(fromLine.options)), { step: 1, editKey: fromLine.key, tab: "meat" });
    } else {
      const d = dishId && dishById[dishId] ? dishId : builder.dish;
      Object.assign(builder, { step: 0, dish: d, style: MENU.bowl.styles.find((s) => s.dish === d).id, ing: {}, spicy: 2, mala: 2, note: "", editKey: null, tab: "meat" });
    }
    renderBuilder();
    $("#builder").showModal();
    $("#builderBody").scrollTop = 0;
  }

  function bowlPrice(ing) {
    return Object.entries(ing).reduce((n, [id, p]) => n + (ingIndex[id] ? MENU.bowl.pricePer100g[ingIndex[id].group] * p : 0), 0);
  }
  const portions = (ing) => Object.values(ing).reduce((a, b) => a + b, 0);

  function renderBuilder() {
    $("#builderTitle").textContent = t("secBowl");
    const labels = [t("bStep1"), t("bStep2"), t("bStep3")];
    $("#builderProgress").outerHTML = `<div id="builderProgress"><div class="progress">${labels.map((_, i) => `<span class="${i <= builder.step ? "done" : ""}"></span>`).join("")}</div>
      <div class="progress-labels">${labels.map((l, i) => `<span class="${i === builder.step ? "cur" : ""}">${i + 1}. ${esc(l)}</span>`).join("")}</div></div>`;
    const body = $("#builderBody");
    if (builder.step === 0) body.innerHTML = builderStyleStep();
    if (builder.step === 1) body.innerHTML = builderIngStep();
    if (builder.step === 2) body.innerHTML = builderHeatStep();

    $("#builderBack").hidden = builder.step === 0;
    const next = $("#builderNext");
    const price = bowlPrice(builder.ing);
    if (builder.step < 2) {
      next.innerHTML = `${t("next")} ${builder.step === 1 && price ? "· " + money(price) : ""}`;
      next.disabled = builder.step === 1 && !portions(builder.ing);
    } else {
      next.innerHTML = `${builder.editKey ? t("save") : t("addToOrder")} · ${money(price)}`;
      next.disabled = !portions(builder.ing);
    }
  }

  function builderStyleStep() {
    const dishes = MENU.bowl.dishes
      .map(
        (d) => `<button type="button" class="choice" role="radio" aria-checked="${builder.dish === d.id}" data-dish="${d.id}">
          <img src="${d.img}" alt="" /><strong>${esc(d.name)}</strong><small>${esc(d.th)} · ${d.kind === "soup" ? t("soup") : t("dryPot")}</small></button>`
      )
      .join("");
    const styles = MENU.bowl.styles
      .filter((s) => s.dish === builder.dish)
      .map(
        (s) => `<button type="button" class="choice" role="radio" aria-checked="${builder.style === s.id}" data-style="${s.id}">
          <span class="code">${s.id}</span><img src="${s.img}" alt="" /><strong>${esc(local(s))}</strong><small>${esc(sub(s))} ${flames(s.heat)}</small></button>`
      )
      .join("");
    return `<h3 class="step-title">${t("chooseDish")}</h3><div class="choice-grid" role="radiogroup">${dishes}</div>
      <h3 class="step-title">${t("chooseBroth")}</h3><div class="choice-grid styles" role="radiogroup">${styles}</div>`;
  }

  function builderIngStep() {
    const g = builder.tab;
    const countIn = (grp) => Object.entries(builder.ing).filter(([id, p]) => p && ingIndex[id].group === grp).length;
    const tabs = ["meat", "veg"]
      .map((grp) => {
        const n = countIn(grp);
        return `<button type="button" role="tab" aria-selected="${g === grp}" data-tab="${grp}">${t(grp)} <span class="n" ${n ? "" : "hidden"}>${n}</span></button>`;
      })
      .join("");
    const price = MENU.bowl.pricePer100g[g];
    const rows = MENU.bowl.ingredients[g]
      .map((i) => {
        const p = builder.ing[i.id] || 0;
        return `<div class="ing ${p ? "on" : ""}">
          <div class="nm"><strong>${esc(local(i))}</strong><small>${esc(sub(i))} · ${money(price)} / 100 g</small></div>
          <div class="stepper">
            <button type="button" class="minus" data-ing="${i.id}" data-d="-1" aria-label="−100 g">−</button>
            <output>${p * 100} g</output>
            <button type="button" class="plus" data-ing="${i.id}" data-d="1" aria-label="+100 g ${esc(i.name)}">+</button>
          </div></div>`;
      })
      .join("");
    const style = styleById[builder.style];
    return `<div class="bowl-sum" style="margin-bottom:10px"><span>${esc(dishById[builder.dish].name)} · <b>${style.id} ${esc(local(style))}</b></span>
      <span>${t("weight")}: <b>${portions(builder.ing) * 100} g</b></span></div>
      <p class="hint">${t("portionHint")}</p>
      <div class="ing-tabs" role="tablist">${tabs}</div>
      <div class="ing-list">${rows}</div>`;
  }

  function spicePicker(current, allowNone) {
    const none = allowNone
      ? `<button type="button" class="spice-opt none" role="radio" aria-checked="${current === 0}" data-spicy="0"><b>0</b>${t("noSpicy")}</button>`
      : "";
    return `<div class="spice-pick" role="radiogroup" style="${allowNone ? "grid-template-columns:repeat(6,1fr)" : ""}">${none}${MENU.spicy
      .map(
        (s) => `<button type="button" class="spice-opt" role="radio" aria-checked="${current === s.level}" data-spicy="${s.level}" aria-label="${s.level} ${esc(s.name)}">
          <img src="${s.img}" alt="" /><b>${s.level}</b>${esc(spiceName(s))}</button>`
      )
      .join("")}</div>`;
  }
  function malaPicker(current) {
    return `<p class="hint">${t("malaHint")}</p><div class="mala-pick" role="radiogroup">${[1, 2, 3, 4, 5]
      .map((n) => `<button type="button" role="radio" aria-checked="${current === n}" class="${n <= current ? "lit" : ""}" data-mala="${n}">${n}</button>`)
      .join("")}</div>`;
  }

  function builderHeatStep() {
    const chosen = Object.entries(builder.ing).filter(([, p]) => p).map(([id, p]) => `${local(ingIndex[id])} ${p * 100}g`).join(", ");
    return `<h3 class="step-title">${t("spicyLevel")}</h3>${spicePicker(builder.spicy)}
      <h3 class="step-title">${t("malaLevel")}</h3>${malaPicker(builder.mala)}
      <h3 class="step-title">${t("noteLabel")}</h3>
      <label class="field"><span class="sr-only">${t("noteLabel")}</span><textarea id="bNote" rows="2" maxlength="200" placeholder="${esc(t("notePh"))}">${esc(builder.note)}</textarea></label>
      <div class="totals"><div><span>${esc(dishById[builder.dish].name)} · ${builder.style} ${esc(local(styleById[builder.style]))}</span></div>
        <div><small>${esc(chosen)}</small></div>
        <div class="grand"><span>${portions(builder.ing) * 100} g</span><b>${money(bowlPrice(builder.ing))}</b></div></div>`;
  }

  function commitBowl() {
    const opts = { dish: builder.dish, style: builder.style, ing: Object.fromEntries(Object.entries(builder.ing).filter(([, p]) => p)), spicy: builder.spicy, mala: builder.mala, note: builder.note.trim() };
    const d = dishById[builder.dish];
    const line = { key: lineKey("bowl", opts), kind: "bowl", itemId: "bowl-" + d.id, name: d.name, th: d.th, img: styleById[builder.style].img, unitPrice: bowlPrice(opts.ing), qty: 1, options: opts };
    if (builder.editKey) {
      const old = state.cart.find((l) => l.key === builder.editKey);
      if (old) { line.qty = old.qty; state.cart = state.cart.filter((l) => l !== old); }
      state.cart.push(line);
      saveCart(); renderHeader(); renderSections();
      $("#builder").close();
      return openCart("cart");
    }
    addLine(line);
    $("#builder").close();
  }

  const itemState = { it: null, meat: "", soup: "", spicy: 2, note: "", qty: 1, editKey: null };
  const meatOf = (it, id) => (it.meats ? it.meats.find((m) => m.id === id) || it.meats[0] : null);
  const soupOf = (it, id) => (it.soups ? it.soups.find((x) => x.id === id) || it.soups[0] : null);
  function openItemSheet(it, fromLine, meatId) {
    Object.assign(itemState, { it, meat: it.meats ? meatOf(it, meatId).id : "", soup: it.soups ? it.soups[0].id : "", spicy: 2, note: "", qty: 1, editKey: null });
    if (fromLine) {
      const o = fromLine.options || {};
      Object.assign(itemState, { meat: it.meats ? meatOf(it, o.meat).id : "", soup: it.soups ? soupOf(it, o.soup).id : "", spicy: o.spicy != null ? o.spicy : 2, note: o.note || "", qty: fromLine.qty, editKey: fromLine.key });
    }
    renderItemSheet();
    if (!$("#itemSheet").open) $("#itemSheet").showModal();
    $("#itemBody").scrollTop = 0;
  }
  function renderItemSheet() {
    const { it } = itemState;
    const meat = meatOf(it, itemState.meat);
    const unit = meat ? meat.price : it.price;
    const plate = it.img && /dish-|style-/.test(it.img);
    $("#itemTitle").textContent = local(it);
    let html = `<div style="display:flex;gap:14px;align-items:center;margin-bottom:6px">
      ${it.img ? `<img src="${it.img}" alt="" style="width:84px;height:84px;object-fit:${plate ? "contain" : "cover"};border-radius:${plate ? "50%" : "14px"}" />` : ""}
      <div><strong style="font-size:17px">${esc(local(it))}</strong><div style="color:var(--muted);font-size:13px">${esc(sub(it))}</div><div class="price" style="margin-top:4px">${money(unit)}</div></div></div>`;
    if (it.desc) html += `<p class="hint" style="margin:6px 0 0">${esc(tx(it.desc))}</p>`;
    if (it.meats) {
      html += `<h3 class="step-title">${t("chooseMeat")}</h3><div class="opt-grid" role="radiogroup">${it.meats
        .map((m) => `<button type="button" class="opt" role="radio" aria-checked="${itemState.meat === m.id}" data-imeat="${m.id}"><strong>${esc(local(m))}</strong><small>${esc(sub(m))}</small><b>${money(m.price)}</b></button>`)
        .join("")}</div>`;
    }
    if (it.soups) {
      html += `<h3 class="step-title">${t("chooseSoup")}</h3><div class="choice-grid styles" role="radiogroup">${it.soups
        .map((x) => `<button type="button" class="choice" role="radio" aria-checked="${itemState.soup === x.id}" data-isoup="${x.id}">
          ${x.img ? `<img src="${x.img}" alt="" />` : ""}<strong>${esc(local(x))}</strong><small>${esc(sub(x))}</small></button>`)
        .join("")}</div>`;
    }
    if (it.spicy) html += `<h3 class="step-title">${t("spicyLevel")}</h3>${spicePicker(itemState.spicy, true)}`;
    html += `<h3 class="step-title">${t("noteLabel")}</h3><label class="field"><textarea id="iNote" rows="2" maxlength="200" placeholder="${esc(t("notePh"))}">${esc(itemState.note)}</textarea></label>`;
    $("#itemBody").innerHTML = html;
    $("#itemFoot").innerHTML = `<div class="stepper"><button type="button" data-iq="-1" ${itemState.qty <= 1 ? "disabled" : ""} aria-label="−">−</button><output>${itemState.qty}</output><button type="button" class="plus" data-iq="1" aria-label="+">+</button></div>
      <button type="button" class="btn btn-red btn-grow" id="itemAdd">${itemState.editKey ? t("save") : t("addToOrder")} · ${money(unit * itemState.qty)}</button>`;
  }
  function commitItem() {
    const { it } = itemState;
    const meat = meatOf(it, itemState.meat);
    const opts = { note: itemState.note.trim() };
    if (meat) opts.meat = meat.id;
    if (it.soups) opts.soup = soupOf(it, itemState.soup).id;
    if (it.spicy) opts.spicy = itemState.spicy;
    const line = {
      key: lineKey(it.id, opts), kind: "item", itemId: it.id,
      name: meat ? (it.base ? `${it.base} ${meat.name}` : `${it.name} · ${meat.name}`) : it.name,
      th: meat ? `${it.th} · ${meat.th}` : it.th,
      my: meat ? `${it.my || (it.base ? it.base : it.name)} · ${meat.my || meat.name}` : it.my || "",
      img: it.img || "", unitPrice: meat ? meat.price : it.price, qty: itemState.qty, options: opts,
    };
    if (itemState.editKey) {
      state.cart = state.cart.filter((l) => l.key !== itemState.editKey);
      state.cart.push(line); saveCart(); renderHeader(); renderSections();
      $("#itemSheet").close(); return openCart("cart");
    }
    addLine(line);
    $("#itemSheet").close();
  }

  function optionLines(l, forKitchen) {
    const o = l.options || {};
    const L = (x) => (forKitchen ? x.name : local(x));
    const out = [];
    if (l.kind === "set" && SET) {
      out.push((o.picks || []).map((id) => (setItem[id] ? L(setItem[id]) : id)).join(", "));
      if (o.addons && o.addons.length) out.push(`${forKitchen ? "Add-on" : t("addOn")}: ` + o.addons.map((id) => (setItem[id] ? `${L(setItem[id])}${forKitchen ? "" : " +" + money(setItem[id].price)}` : id)).join(", "));
      const ta = SET.tastes.find((x) => x.id === o.taste);
      if (ta) out.push(`${forKitchen ? "Taste" : t("taste")} ${ta.id}: ${L(ta)}`);
    }
    const item = allItems[l.itemId];
    if (o.soup && item && item.soups) { const x = item.soups.find((q) => q.id === o.soup); if (x) out.push(`${forKitchen ? "Soup" : t("soupWord")}: ${L(x)}`); }
    if (o.style && styleById[o.style]) out.push(`${o.style} ${L(styleById[o.style])}`);
    if (o.ing) out.push(Object.entries(o.ing).map(([id, p]) => `${L(ingIndex[id])} ${p * 100}g`).join(", "));
    if (o.spicy != null) {
      const sp = MENU.spicy.find((s) => s.level === o.spicy);
      out.push(`${forKitchen ? "Spicy" : t("spicyLevel")} ${o.spicy}${sp ? " (" + (forKitchen ? sp.name : spiceName(sp)) + ")" : forKitchen ? " (not spicy)" : " (" + t("noSpicy") + ")"}${o.mala ? ` · ${forKitchen ? "Mala" : "Mala"} ${o.mala}` : ""}`);
    }
    if (o.note) out.push(`“${o.note}”`);
    return out;
  }

  function lineImg(l) {
    if (!l.img) return `<img src="images/brand/icon-512.png" alt="" />`;
    const plate = /dish-|style-/.test(l.img);
    return `<img class="${plate ? "plate" : ""}" src="${l.img}" alt="" />`;
  }

  function openCart(view) {
    state.cartView = view || (state.cartView === "success" ? "success" : "cart");
    renderCart();
    if (!$("#cart").open) $("#cart").showModal();
    $("#cartBody").scrollTop = 0;
  }

  function renderCart() {
    const body = $("#cartBody");
    const foot = $("#cartFoot");
    const title = $("#cartTitle");
    clearInterval(renderCart.poll);

    if (state.cartView === "success") return renderSuccess(body, foot, title);
    if (state.cartView === "orders") return renderMyOrders(body, foot, title);

    title.textContent = state.cartView === "checkout" ? t("checkout") : t("yourOrder");
    if (!state.cart.length) {
      body.innerHTML = `<div class="empty"><img src="images/mascot/duck-welcome.webp" alt="" /><p>${t("emptyCart")}</p>
        ${BOWL_ON ? `<button class="btn btn-red" type="button" data-open-builder>${t("emptyCartCta")}</button>` : `<a class="btn btn-red" href="#sec-main">${t("startSet")}</a>`}</div>`;
      foot.innerHTML = "";
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    const sub = subtotal();
    const fee = deliveryFee();
    const q = quote();
    const feeLabel = state.type !== "delivery" ? null : q.known ? (q.fee ? money(q.fee) : t("free")) + (q.km != null ? ` <small>(~${kmText(q.km)})</small>` : "") : `<small>${t("byShop")}</small>`;
    const totalsHtml = `<div class="totals"><div><span>${t("subtotal")}</span><span>${money(sub)}</span></div>
      ${feeLabel ? `<div><span>${t("deliveryFee")}</span><span>${feeLabel}</span></div>` : ""}
      <div class="grand"><span>${t("total")}</span><b>${money(sub + fee)}</b></div></div>`;

    if (state.cartView === "cart") {
      body.innerHTML = state.cart
        .map(
          (l, i) => `<div class="line">${lineImg(l)}
          <div><h4>${esc(local(l))}</h4><div class="opts">${optionLines(l).map((x) => `<span>${esc(x)}</span>`).join("")}</div>
            ${l.kind === "bowl" || l.kind === "set" || Object.keys(l.options || {}).length ? `<button class="link-btn" type="button" data-edit="${i}">${t("edit")}</button>` : ""}
            <div class="lp-row"><span class="lp">${money(l.unitPrice * l.qty)}</span>
            <div class="stepper"><button type="button" data-q="${i}" data-d="-1" aria-label="${t("remove")}">${l.qty === 1 ? '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z"/></svg>' : "−"}</button><output>${l.qty}</output><button type="button" class="plus" data-q="${i}" data-d="1" aria-label="+">+</button></div></div></div>
        </div>`
        )
        .join("") + (BOWL_ON ? `<button class="btn btn-line" type="button" data-open-builder style="width:100%;margin-top:6px">+ ${t("secBowl")}</button>` : `<button class="btn btn-line" type="button" data-close-cart style="width:100%;margin-top:6px">+ ${t("addMore")}</button>`) + totalsHtml;
      const minOk = sub >= (CFG.minOrder || 0);
      foot.innerHTML = `<button class="btn btn-red btn-grow" type="button" id="toCheckout" ${minOk ? "" : "disabled"}>${minOk ? t("checkout") : `${t("minOrder")} ${money(CFG.minOrder)}`} · ${money(sub + fee)}</button>`;
      return;
    }

    // checkout
    const c = state.customer;
    const times = pickupTimes();
    let fields = `<h3 class="step-title" style="margin-top:0">${t("howGet")}</h3><div class="cart-type" role="radiogroup" id="cartType"></div>`;
    if (state.type === "dinein") {
      fields += `<label class="field" data-f="table"><span>${t("table")}</span><input id="fTable" inputmode="numeric" maxlength="8" value="${esc(state.table)}" placeholder="${esc(t("tablePh"))}" ${tableParam ? "readonly" : ""} /><small class="msg"></small></label>`;
      fields += `<label class="field" data-f="name"><span>${t("name")}</span><input id="fName" autocomplete="name" maxlength="60" value="${esc(c.name)}" /><small class="msg"></small></label>`;
    } else {
      fields += `<label class="field" data-f="name"><span>${t("name")}</span><input id="fName" autocomplete="name" maxlength="60" value="${esc(c.name)}" /><small class="msg"></small></label>
        <label class="field" data-f="phone"><span>${t("phone")}</span><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="08x xxx xxxx" value="${esc(c.phone)}" /><small class="msg"></small></label>`;
    }
    if (state.type === "delivery" && DLV && typeof CFG.deliveryFee !== "number") {
      const areas = DLV.areas.map((a, i) => ({ ...a, i, km: roadKm(a.lat, a.lng) })).sort((a, b) => a.km - b.km);
      const sel = state.destOther ? "other" : state.dest && state.dest.src === "area" ? String(state.dest.i) : "";
      const info = q.known && q.km != null
        ? `<div class="dest-info ok"><b>${state.dest.src === "gps" ? t("myLocation") : esc(state.dest.label)}</b> · ~${kmText(q.km)} · ${t("deliveryFee")} <b>${money(q.fee)}</b></div>`
        : q.far ? `<div class="dest-info warn">~${kmText(q.km)} — ${t("tooFar")}</div>`
        : state.destOther ? `<div class="dest-info warn">${t("byShop")}</div>` : "";
      fields += `<div class="field" data-f="area"><span>${t("deliveryArea")}</span>
        <button type="button" class="btn btn-line loc-btn ${state.dest && state.dest.src === "gps" ? "on" : ""}" id="useLoc">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2h-2.06ZM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"/></svg>
          ${t("useMyLocation")}</button>
        <select id="fArea" aria-label="${esc(t("chooseArea"))}">
          <option value="">${t("chooseArea")}</option>
          ${areas.map((a) => `<option value="${a.i}" ${sel === String(a.i) ? "selected" : ""}>${esc(state.lang === "th" ? a.th : a.name)} — ${a.km > (DLV.maxKm || 999) ? "?" : money(feeForKm(a.km))}</option>`).join("")}
          <option value="other" ${sel === "other" ? "selected" : ""}>${t("otherArea")}</option>
        </select>
        ${info}<small class="msg"></small><small class="rate-note">${t("grabRate")}</small></div>`;
    }
    if (state.type === "delivery") {
      fields += `<label class="field" data-f="address"><span>${t("address")}</span><textarea id="fAddress" rows="3" maxlength="300" autocomplete="street-address" placeholder="${esc(t("addressPh"))}">${esc(c.address)}</textarea><small class="msg"></small></label>
        <label class="field"><span>${t("mapLink")}</span><input id="fMap" type="url" inputmode="url" maxlength="300" placeholder="https://maps.app.goo.gl/…" value="${esc(c.map)}" /></label>`;
    }
    if (state.type === "pickup") {
      fields += `<div class="field"><span>${t("pickupTime")}</span><div class="time-opts" role="radiogroup">${times
        .map((x) => `<button type="button" role="radio" aria-checked="${state.pickup === x.v}" data-pick="${x.v}">${esc(x.l)}</button>`)
        .join("")}</div></div>`;
    }
    const paymentMethods = CFG.paymentMethods && CFG.paymentMethods.length ? CFG.paymentMethods : ["cash"];
    if (!paymentMethods.includes(state.payment)) state.payment = paymentMethods[0];
    if (paymentMethods.length > 1) {
      fields += `<div class="field"><span>${t("payment")}</span><div class="pay-opts" role="radiogroup">${paymentMethods
        .map((p) => `<button type="button" class="pay-opt" role="radio" aria-checked="${state.payment === p}" data-pay="${p}"><strong>${t(p)}</strong><small>${t(p + "Sub")}</small></button>`)
        .join("")}</div></div>`;
    }
    fields += `<label class="field"><span>${t("noteLabel")}</span><textarea id="fNote" rows="2" maxlength="300" placeholder="${esc(t("notePh"))}"></textarea></label>`;
    fields += totalsHtml;
    if (!api.live) fields += `<p class="demo-chip">${t("demoNote")}</p>`;
    fields += `<p class="form-error" id="formError" role="alert"></p>`;
    body.innerHTML = fields;
    typeOptions($("#cartType"));
    const closed = !state.settings.accepting_orders;
    foot.innerHTML = `<button class="btn btn-line" type="button" id="toCart">${t("back")}</button>
      <button class="btn btn-red btn-grow" type="button" id="placeOrder" ${closed ? "disabled" : ""}>${closed ? t("paused") : t("placeOrder") + " · " + money(sub + fee)}</button>`;
  }

  function pickupTimes() {
    const out = [{ v: "asap", l: t("asap") }];
    const now = new Date();
    const start = new Date(now.getTime() + 30 * 60000);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    for (let i = 0; i < 8; i++) {
      const d = new Date(start.getTime() + i * 15 * 60000);
      const v = d.toTimeString().slice(0, 5);
      out.push({ v, l: v });
    }
    return out;
  }

  function readCheckout() {
    const val = (id) => ($(id) ? $(id).value.trim() : "");
    const c = state.customer;
    c.name = val("#fName") || c.name;
    if ($("#fPhone")) c.phone = val("#fPhone");
    if ($("#fAddress")) c.address = val("#fAddress");
    if ($("#fMap")) c.map = val("#fMap");
    if ($("#fTable")) state.table = val("#fTable");
    S.set("mahaduck-customer", c);
  }

  function validate() {
    const errs = {};
    const c = state.customer;
    if (!c.name) errs.name = t("errName");
    if (state.type !== "dinein" && c.phone.replace(/\D/g, "").length < 9) errs.phone = t("errPhone");
    if (state.type === "delivery" && c.address.length < 6) errs.address = t("errAddress");
    if (state.type === "delivery" && DLV && typeof CFG.deliveryFee !== "number" && !state.dest && !state.destOther) errs.area = t("errArea");
    if (state.type === "dinein" && !state.table) errs.table = t("errTable");
    $$("#cartBody .field[data-f]").forEach((f) => {
      const e = errs[f.dataset.f];
      f.classList.toggle("err", Boolean(e));
      const m = $(".msg", f);
      if (m) m.textContent = e || "";
    });
    const first = Object.keys(errs)[0];
    if (first) { const el = $(`#cartBody .field[data-f="${first}"] input, #cartBody .field[data-f="${first}"] textarea`); el && el.focus(); }
    return !first;
  }

  async function placeOrder() {
    readCheckout();
    if (!validate()) return;
    const btn = $("#placeOrder");
    btn.disabled = true;
    btn.textContent = t("placing");
    $("#formError").textContent = "";
    const c = state.customer;
    const sub = subtotal();
    const q = quote();
    const fee = q.known ? q.fee : 0;
    const d = state.type === "delivery" ? state.dest : null;
    const where = d && !state.destOther ? ` [${d.src === "gps" ? "GPS" : d.label}${q.km != null ? " · ~" + kmText(q.km) : ""}]` : "";
    const order = {
      order_type: state.type,
      table_no: state.type === "dinein" ? state.table : null,
      customer_name: c.name,
      phone: state.type === "dinein" ? c.phone || null : c.phone,
      address: state.type === "delivery" ? (c.address.slice(0, 250) + where).slice(0, 300) : null,
      map_link: state.type === "delivery" ? cleanMapLink(c.map) || (d && d.src === "gps" ? `https://www.google.com/maps?q=${d.lat.toFixed(6)},${d.lng.toFixed(6)}` : null) : null,
      pickup_time: state.type === "pickup" ? (state.pickup === "asap" ? "ASAP" : state.pickup) : null,
      payment: state.payment,
      note: ($("#fNote") && $("#fNote").value.trim()) || null,
      items: state.cart.map((l) => ({
        name: l.name, th: l.th || "", qty: l.qty, unit_price: l.unitPrice, line_total: l.unitPrice * l.qty, details: optionLines(l, true),
      })),
      subtotal: sub,
      delivery_fee: state.type === "delivery" && q.known ? fee : null,
      total: sub + fee,
      lang: state.lang,
    };
    try {
      const saved = await api.createOrder(order);
      state.lastOrder = {
        code: saved.code, total: saved.total, created_at: saved.created_at, type: saved.order_type, order_type: saved.order_type, status: "new",
        payment: saved.payment, payment_status: "unpaid", feeUnknown: saved.order_type === "delivery" && saved.delivery_fee == null,
      };
      state.myOrders = [state.lastOrder, ...state.myOrders.filter((o) => o.code !== saved.code)].slice(0, 20);
      S.set("mahaduck-my-orders", state.myOrders);
      state.cart = [];
      saveCart();
      renderHeader();
      renderSections();
      state.cartView = "success";
      renderCart();
    } catch (e) {
      console.error(e);
      if (/accepting/i.test(e.message || "")) { state.settings.accepting_orders = false; renderHeader(); }
      $("#formError").textContent = /accepting/i.test(e.message || "") ? t("closed") : t("errSend");
      btn.disabled = false;
      btn.textContent = t("placeOrder");
    }
  }

  function trackerHtml(status, orderType, deliveryProvider, deliveryStartedAt) {
    if (status === "cancelled") return `<p class="status-text" style="color:var(--red)">${t("stDesc_cancelled")}</p>`;
    const flow = orderType === "delivery" ? ["new", "preparing", "ready", "out_for_delivery", "completed"] : ["new", "preparing", "ready", "completed"];
    const idx = flow.indexOf(status);
    const provider = status === "out_for_delivery" && deliveryProvider ? `<p class="delivery-info">${t("deliveryWith")}: <strong>${esc(deliveryProvider)}</strong>${deliveryStartedAt ? ` · ${new Date(deliveryStartedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</p>` : "";
    return `<ol class="tracker" style="--steps:${flow.length}">${flow.map((s, i) => `<li class="${i <= idx ? "done" : ""} ${i === idx && s !== "completed" ? "cur" : ""}"><i>${i < idx || status === "completed" ? "✓" : i + 1}</i>${t("st_" + s)}</li>`).join("")}</ol>
      <p class="status-text">${t("stDesc_" + status)}</p>${provider}`;
  }

  const slipPreview = {}; // code → data URL (this session only)
  const CLIP = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5Z"/></svg>';
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let max = 1280, q = 0.72, out = "";
          for (let i = 0; i < 5; i++) {
            const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.naturalWidth * r));
            c.height = Math.max(1, Math.round(img.naturalHeight * r));
            const ctx = c.getContext("2d");
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            out = c.toDataURL("image/jpeg", q);
            if (out.length <= 450000) break;
            max = Math.round(max * 0.78); q = Math.max(0.5, q - 0.07);
          }
          URL.revokeObjectURL(url);
          out.length <= 680000 ? resolve(out) : reject(new Error("Image too large"));
        } catch (err) { reject(err); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Not an image")); };
      img.src = url;
    });
  }
  // Facebook Messenger link from config (page username or full URL); "" if not set / not a Facebook link
  const messengerUrl = (() => {
    const m = String(CFG.messenger || "").trim();
    if (!m) return "";
    if (/^https:\/\/(m\.me|(www\.|m\.)?facebook\.com|(www\.)?messenger\.com)\//i.test(m)) return m;
    return /^[A-Za-z0-9.\-]+$/.test(m.replace(/^@/, "")) ? "https://m.me/" + m.replace(/^@/, "") : "";
  })();
  const MSG_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2C6.4 2 2 6.1 2 11.5c0 2.9 1.3 5.4 3.4 7.1V22l3.2-1.8c1 .3 2.2.5 3.4.5 5.6 0 10-4.1 10-9.2S17.6 2 12 2Zm1 12.4-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8Z"/></svg>';
  function slipHtml(o) {
    const prev = slipPreview[o.code];
    const claimed = o.payment_status === "claimed";
    return `<div class="slip-box">
      ${prev ? `<img class="slip-thumb" src="${prev}" alt="${esc(t("slipTitle"))}" />` : ""}
      ${o.slip ? `<span class="pay-claimed">✓ ${t("slipSent")}</span>` : claimed ? `<span class="pay-claimed">✓ ${t("paidClaimed")}</span>` : ""}
      <label class="btn ${o.slip ? "btn-line" : "btn-green"} btn-sm slip-btn"><input class="sr-only" type="file" accept="image/*" id="slipInput" />${CLIP} <span>${o.slip ? t("changeSlip") : t("attachSlip")}</span></label>
      ${!o.slip ? `<div class="slip-alt"><p>${t("slipMessenger")} <b>${esc(o.code)}</b></p>
        ${messengerUrl ? `<a class="btn btn-sm btn-messenger" href="${esc(messengerUrl)}" target="_blank" rel="noopener">${MSG_ICON} Messenger</a>` : ""}</div>` : ""}
      ${!o.slip && !claimed ? `<button class="link-btn" type="button" id="iPaid">${t("iPaidNoSlip")}</button>` : ""}
    </div>`;
  }

  function payHtml(o) {
    if (o.payment !== "promptpay") return "";
    if (o.payment_status === "paid") return `<div class="pay-card paid"><strong>✓ ${t("paidOk")}</strong></div>`;
    if (!CFG.promptpayId) return `<div class="pay-card"><strong>${t("payTitle")}</strong><p>${t("payLater")}</p>${slipHtml(o)}</div>`;
    const amount = o.feeUnknown ? undefined : o.total;
    const data = window.PromptPay.payload(CFG.promptpayId, amount);
    return `<div class="pay-card">
      <div class="pay-head"><span class="pp-badge">PromptPay</span><strong>${t("payTitle")}</strong></div>
      <div class="pay-qr" aria-label="PromptPay QR">${window.PromptPay.svg(data)}</div>
      ${amount ? `<div class="pay-amount">${money(amount)}</div>` : `<p class="pay-note">${t("payNoAmount")} (${money(o.total)} + ${t("deliveryFee")})</p>`}
      ${CFG.promptpayName ? `<p class="pay-name">${t("payTo")}: <b>${esc(CFG.promptpayName)}</b></p>` : ""}
      <p class="pay-note">${t("payScan")}</p>
      <button class="btn btn-line btn-sm" type="button" id="saveQr" data-qr="${esc(data)}">${t("saveQr")}</button>
      ${slipHtml(o)}
    </div>`;
  }

  function persistMine(o) {
    const m = state.myOrders.find((x) => x.code === o.code);
    if (m) { Object.assign(m, { status: o.status, payment_status: o.payment_status, slip: Boolean(o.slip), order_type: o.order_type, delivery_provider: o.delivery_provider, delivery_started_at: o.delivery_started_at }); S.set("mahaduck-my-orders", state.myOrders); }
  }

  function renderSuccess(body, foot, title) {
    const o = state.lastOrder;
    title.textContent = t("orderCode") + " " + o.code;
    foot.hidden = false;
    body.innerHTML = `<div class="success"><img src="images/mascot/duck-welcome.webp" alt="" />
      <h3>${t("thanks")}</h3><p style="color:var(--muted)">${t("thanksSub")}</p>
      <div class="code-box">${esc(o.code)}</div>
      <p><strong>${money(o.total)}</strong> · ${t(o.type)}</p>
      <div id="payBox" style="width:100%">${payHtml(o)}</div>
      <div id="trackerBox" style="width:100%">${trackerHtml(o.status, o.order_type || o.type, o.delivery_provider, o.delivery_started_at)}</div>
      ${!api.live ? `<p class="demo-chip">${t("demoNote")}</p>` : ""}</div>`;
    foot.innerHTML = `<button class="btn btn-line" type="button" data-view="orders">${t("myOrders")}</button><button class="btn btn-red btn-grow" type="button" data-close-cart>${t("orderMore")}</button>`;
    const refresh = async () => {
      try {
        const s = await api.orderStatus(o.code);
        if (s && (s.status !== o.status || s.delivery_provider !== o.delivery_provider || s.delivery_started_at !== o.delivery_started_at)) {
          Object.assign(o, { status: s.status, order_type: s.order_type || o.order_type || o.type, delivery_provider: s.delivery_provider, delivery_started_at: s.delivery_started_at });
          const box = $("#trackerBox");
          if (box) box.innerHTML = trackerHtml(o.status, o.order_type, o.delivery_provider, o.delivery_started_at);
        }
        if (s && s.payment_status && s.payment_status !== o.payment_status) { o.payment_status = s.payment_status; const pb = $("#payBox"); if (pb) pb.innerHTML = payHtml(o); }
        persistMine(o);
      } catch {}
    };
    refresh();
    renderCart.poll = setInterval(refresh, Math.max(5, CFG.pollSeconds) * 1000);
  }

  async function renderMyOrders(body, foot, title) {
    title.textContent = t("myOrders");
    foot.hidden = false;
    foot.innerHTML = `<button class="btn btn-red btn-grow" type="button" data-close-cart>${t("orderMore")}</button>`;
    if (!state.myOrders.length) { body.innerHTML = `<div class="empty"><img src="images/mascot/duck-welcome.webp" alt="" /><p>${t("noOrders")}</p></div>`; return; }
    const draw = () => {
      body.innerHTML = `<div class="my-orders">${state.myOrders
        .map((o) => `<button type="button" class="my-order" data-track="${esc(o.code)}" style="text-align:left;width:100%"><div><strong>${esc(o.code)}</strong><div style="font-size:12.5px;color:var(--muted)">${new Date(o.created_at).toLocaleString()} · ${money(o.total)}</div></div><span class="pill ${o.status || "new"}">${t("st_" + (o.status || "new"))}</span></button>`)
        .join("")}</div>`;
    };
    draw();
    await Promise.all(state.myOrders.slice(0, 8).map(async (o) => { try { const s = await api.orderStatus(o.code); if (s) Object.assign(o, { status: s.status, order_type: s.order_type || o.order_type, delivery_provider: s.delivery_provider, delivery_started_at: s.delivery_started_at }); } catch {} }));
    S.set("mahaduck-my-orders", state.myOrders);
    if (state.cartView === "orders") draw();
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, a");
    if (!el) return;
    const d = el.dataset;

    const href = el.getAttribute("href") || "";
    if (href.startsWith("#sec-") || href === "#menu") { e.preventDefault(); if ($("#cart").open) $("#cart").close(); return goToSection(href === "#menu" ? firstSec() : href.slice(1)); }
    if (d.lang) { state.lang = d.lang; S.set("mahaduck-lang", state.lang); applyLang(); return; }
    if (d.type && !el.disabled) {
      if (state.cartView === "checkout") readCheckout();
      state.type = d.type; S.set("mahaduck-type", d.type); renderHeader(); if ($("#cart").open) renderCart(); return;
    }
    if ("openSet" in d && SET) { e.preventDefault(); e.stopPropagation(); if ($("#cart").open) $("#cart").close(); openSet(d.openSet); return; }
    if (el.closest("#setSheet")) {
      const keep = () => { if ($("#sNote")) setB.note = $("#sNote").value; };
      const redraw = () => { const y = $("#setBody").scrollTop; renderSet(); $("#setBody").scrollTop = y; };
      if (d.ssize) { setB.size = d.ssize; return redraw(); }
      if (d.spick) {
        const i = setB.picks.indexOf(d.spick), j = setB.addons.indexOf(d.spick);
        if (i >= 0) setB.picks.splice(i, 1);
        else if (j >= 0) setB.addons.splice(j, 1);
        else if (setB.picks.length < sizeById[setB.size].pick) setB.picks.push(d.spick);
        else if (canAddOn(d.spick) && setB.addons.length < 12) setB.addons.push(d.spick);
        return redraw();
      }
      if (d.staste) { keep(); setB.taste = Number(d.staste); return redraw(); }
      if (d.spicy != null) { keep(); setB.spicy = Number(d.spicy); return redraw(); }
      if (d.mala) { keep(); setB.mala = Number(d.mala); return redraw(); }
      if (el.id === "setNext") {
        if (setB.step === 2) { keep(); return commitSet(); }
        setB.step++; renderSet(); $("#setBody").scrollTop = 0; return;
      }
      if (el.id === "setBack") { keep(); setB.step = Math.max(0, setB.step - 1); renderSet(); $("#setBody").scrollTop = 0; return; }
    }
    if ("openBuilder" in d) { e.preventDefault(); if ($("#cart").open) $("#cart").close(); openBuilder(d.openBuilder); return; }
    if (d.add) return quickAdd(d.add, d.meat);
    if ("close" in d) { el.closest("dialog").close(); return; }
    if (el.id === "cartOpen" || el.id === "orderbar") return openCart("cart");
    if (el.id === "myOrdersLink") { e.preventDefault(); return openCart("orders"); }

    // builder
    if (d.dish) { builder.dish = d.dish; builder.style = MENU.bowl.styles.find((s) => s.dish === d.dish).id; return renderBuilder(); }
    if (d.style) { builder.style = d.style; return renderBuilder(); }
    if (d.tab) { builder.tab = d.tab; return renderBuilder(); }
    if (d.ing) {
      const cur = builder.ing[d.ing] || 0;
      builder.ing[d.ing] = Math.max(0, Math.min(9, cur + Number(d.d)));
      const y = $("#builderBody").scrollTop; renderBuilder(); $("#builderBody").scrollTop = y; return;
    }
    if (d.spicy != null && el.closest("#builder")) { builder.spicy = Number(d.spicy); builder.note = $("#bNote")?.value || builder.note; const y = $("#builderBody").scrollTop; renderBuilder(); $("#builderBody").scrollTop = y; return; }
    if (d.mala && el.closest("#builder")) { builder.mala = Number(d.mala); builder.note = $("#bNote")?.value || builder.note; const y = $("#builderBody").scrollTop; renderBuilder(); $("#builderBody").scrollTop = y; return; }
    if (el.id === "builderNext") {
      if (builder.step === 2) { builder.note = $("#bNote")?.value || ""; return commitBowl(); }
      builder.step++; renderBuilder(); $("#builderBody").scrollTop = 0; return;
    }
    if (el.id === "builderBack") { if (builder.step === 2) builder.note = $("#bNote")?.value || ""; builder.step = Math.max(0, builder.step - 1); renderBuilder(); return; }

    // item sheet
    if (el.closest("#itemSheet")) {
      const keepNote = () => (itemState.note = $("#iNote")?.value || itemState.note);
      const y = $("#itemBody").scrollTop;
      if (d.imeat) { keepNote(); itemState.meat = d.imeat; renderItemSheet(); $("#itemBody").scrollTop = y; return; }
      if (d.isoup) { keepNote(); itemState.soup = d.isoup; renderItemSheet(); $("#itemBody").scrollTop = y; return; }
      if (d.spicy != null) { keepNote(); itemState.spicy = Number(d.spicy); renderItemSheet(); $("#itemBody").scrollTop = y; return; }
      if (d.iq) { keepNote(); itemState.qty = Math.max(1, Math.min(20, itemState.qty + Number(d.iq))); renderItemSheet(); $("#itemBody").scrollTop = y; return; }
      if (el.id === "itemAdd") { itemState.note = $("#iNote")?.value || ""; return commitItem(); }
    }

    // cart
    if (d.q != null) {
      const l = state.cart[Number(d.q)];
      if (!l) return;
      l.qty += Number(d.d);
      if (l.qty <= 0) state.cart.splice(Number(d.q), 1);
      saveCart(); renderHeader(); renderSections(); renderCart(); return;
    }
    if (d.edit != null) {
      const l = state.cart[Number(d.edit)];
      if (!l) return;
      $("#cart").close();
      if (l.kind === "set" && SET) openSet(null, l);
      else if (l.kind === "bowl") openBuilder(null, l);
      else openItemSheet(allItems[l.itemId], l);
      return;
    }
    if (el.id === "toCheckout") { state.cartView = "checkout"; renderCart(); $("#cartBody").scrollTop = 0; return; }
    if (el.id === "toCart") { readCheckout(); state.cartView = "cart"; renderCart(); return; }
    if (d.pay) { readCheckout(); state.payment = d.pay; renderCart(); return; }
    if (d.pick) { readCheckout(); state.pickup = d.pick; renderCart(); return; }
    if (el.id === "useLoc") {
      readCheckout();
      if (!navigator.geolocation) return toast(t("locFail"));
      el.disabled = true; el.lastChild.textContent = " " + t("locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.dest = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "GPS", src: "gps" };
          state.destOther = false; S.set("mahaduck-dest", state.dest);
          renderCart(); renderHeader();
        },
        () => { el.disabled = false; el.lastChild.textContent = " " + t("useMyLocation"); toast(t("locFail")); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
      return;
    }
    if (el.id === "placeOrder") return placeOrder();
    if (el.id === "saveQr") {
      window.PromptPay.png(d.qr).then((url) => {
        const a = document.createElement("a");
        a.href = url; a.download = `MahaDuck-${state.lastOrder.code}.png`;
        document.body.appendChild(a); a.click(); a.remove();
      });
      return;
    }
    if (el.id === "iPaid") {
      el.disabled = true;
      api.claimPaid(state.lastOrder.code).then(() => {
        state.lastOrder.payment_status = "claimed"; persistMine(state.lastOrder);
        $("#payBox").innerHTML = payHtml(state.lastOrder);
      }).catch(() => { el.disabled = false; toast(t("errSend")); });
      return;
    }
    if (d.view) { state.cartView = d.view; return renderCart(); }
    if (d.track) {
      const o = state.myOrders.find((x) => x.code === d.track);
      if (o) { state.lastOrder = { status: "new", type: "delivery", ...o }; state.cartView = "success"; renderCart(); }
      return;
    }
    if ("closeCart" in d) { state.cartView = "cart"; $("#cart").close(); return; }
  });

  document.addEventListener("change", async (e) => {
    if (e.target.id !== "slipInput") return;
    const file = e.target.files && e.target.files[0];
    const o = state.lastOrder;
    if (!file || !o) return;
    const label = e.target.closest("label");
    label.classList.add("busy");
    label.querySelector("span").textContent = t("slipSending");
    try {
      const image = await compressImage(file);
      const ok = await api.attachSlip(o.code, image);
      if (ok === false) throw new Error("Slip not accepted");
      slipPreview[o.code] = image;
      o.slip = true;
      if (o.payment_status !== "paid") o.payment_status = "claimed";
      persistMine(o);
      $("#payBox").innerHTML = payHtml(o);
      toast(t("slipSent"));
    } catch (err) {
      console.error(err);
      toast(t("slipFail"));
      const pb = $("#payBox");
      if (pb) pb.innerHTML = payHtml(o);
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id !== "fArea") return;
    readCheckout();
    const v = e.target.value;
    if (v === "other") { state.dest = null; state.destOther = true; }
    else if (v === "") { state.dest = null; state.destOther = false; }
    else { const a = DLV.areas[Number(v)]; state.dest = { lat: a.lat, lng: a.lng, label: a.name, src: "area", i: Number(v) }; state.destOther = false; }
    S.set("mahaduck-dest", state.dest);
    renderCart(); renderHeader();
  });

  // close dialogs on backdrop click
  $$("dialog.sheet").forEach((dlg) => {
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => {
      document.body.style.overflow = "";
      if (dlg.id === "cart") { clearInterval(renderCart.poll); if (state.cartView === "success" || state.cartView === "orders") state.cartView = "cart"; }
    });
  });
  const origShow = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { document.body.style.overflow = "hidden"; return origShow.call(this); };

  if (state.table) S.set("mahaduck-type", "dinein");
  applyLang();
  api.getSettings().then((s) => { state.settings = s; renderHeader(); });
})();
