/* =========================================================================
   MAHA DUCK — staff order dashboard
   ========================================================================= */
(function () {
  const CFG = window.MAHA_CONFIG;
  const MENU = window.MAHA_MENU || {};
  const api = window.MahaAPI;
  const core = window.MahaDuckCore;
  const S = api.store;
  const DEFAULT_SET_STOCK = 20;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => core.money(n, CFG.currency);
  const staffLogin = CFG.staffLogin || {};
  const defaultStaffLogin = String(staffLogin.username || staffLogin.email || "info@yehtet.com").trim();
  function safeMapLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
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
      if (!ok || (host === "goo.gl" && !url.pathname.startsWith("/maps/"))) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  const initialParams = new URLSearchParams(location.search);
  const initialView = initialParams.get("view");
  const initialDate = core.isDayKey(initialParams.get("date")) && initialParams.get("date") <= core.shopDayKey() ? initialParams.get("date") : "";
  const initialRange = initialView === "kitchen" ? "today" : initialDate ? "custom" : ["yesterday", "7", "30"].includes(initialParams.get("range")) ? initialParams.get("range") : "today";
  const state = {
    lang: S.get("mahaduck-admin-lang", "my"),
    orders: [],
    filter: initialRange === "today" ? "active" : "all",
    source: "all",
    table: "all",
    range: initialRange,
    date: initialDate || core.shopDayKey(),
    customerPage: 1,
    loading: false,
    loadingKey: "",
    loadError: false,
    known: null,
    sound: S.get("mahaduck-admin-sound", true),
    autoPrint: S.get("mahaduck-admin-autoprint", false),
    payState: new Map(),
    settings: { accepting_orders: true, notice: "", inventory: {} },
    timer: null,
    busy: new Set(),
    view: ["customer", "counter", "kitchen", "inventory", "daily", "tables"].includes(initialView) ? initialView : "counter",
  };
  const t = window.makeT(() => state.lang);
  const ACTIVE = ["new", "preparing", "ready", "out_for_delivery"];
  const NEXT = { new: ["preparing", "a_accept"], preparing: ["ready", "a_ready"], ready: ["completed", "a_complete"], out_for_delivery: ["completed", "a_complete"] };
  const isOnlineOrder = (o) => (o.source || "online") === "online";
  const isTableOrder = (o) => isOnlineOrder(o) && o.order_type === "dinein";
  const isFacebookOrder = (o) => isOnlineOrder(o) && !isTableOrder(o);
  const tableLabel = (o) => `${t("table")} ${o.table_no || "-"}`;
  const facebookNameRe = /^(online customer|guest|facebook customer)$/i;
  const SET = MENU.malaSet || null;

  function allSetGroups() {
    return SET && Array.isArray(SET.groups) ? SET.groups : [];
  }
  function allSetRows() {
    return allSetGroups().flatMap((group) => (group.items || []).map((item) => ({ group, item })));
  }
  function menuName(o) {
    return state.lang === "th" && o.th ? o.th : state.lang === "my" && o.my ? o.my : o.name;
  }
  function normalizeInventory(raw) {
    const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const inv = {};
    allSetRows().forEach(({ item }) => {
      const n = Number(input[item.id]);
      inv[item.id] = Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_SET_STOCK;
    });
    return inv;
  }
  function normalizeSettings(settings) {
    const safe = settings || {};
    return {
      accepting_orders: safe.accepting_orders !== false,
      notice: String(safe.notice || ""),
      inventory: normalizeInventory(safe.inventory),
    };
  }
  function stockOf(id) {
    const n = Number((state.settings.inventory || {})[id]);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_SET_STOCK;
  }

  function updateDefaultLoginNote() {
    const emailInput = $("#loginForm input[name=email]");
    if (emailInput && defaultStaffLogin && !emailInput.value) emailInput.value = defaultStaffLogin;
    const note = $("#defaultLoginNote");
    if (!note) return;
    note.hidden = !defaultStaffLogin;
    note.textContent = defaultStaffLogin ? t("defaultLoginNote").replace("{login}", defaultStaffLogin) : "";
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- sound ----------
  let audio;
  function chime() {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      [880, 1175, 1568].forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.16);
        g.gain.exponentialRampToValueAtTime(0.35, now + i * 0.16 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.4);
        o.connect(g).connect(audio.destination);
        o.start(now + i * 0.16); o.stop(now + i * 0.16 + 0.45);
      });
    } catch {}
  }
  document.addEventListener("pointerdown", () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} }, { once: true });

  // ---------- time ----------
  function since(iso) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return t("justNow");
    if (m < 60) return `${m} ${t("min")} ${t("ago")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t("hr")} ${m % 60} ${t("min")} ${t("ago")}`;
    return new Date(iso).toLocaleDateString(undefined, { timeZone: core.shopTimeZone });
  }
  const clock = (iso) => new Date(iso).toLocaleTimeString([], { timeZone: core.shopTimeZone, hour: "2-digit", minute: "2-digit" });
  const selectedRange = () => core.orderDateRange(state.range, state.date);
  function renderHistoryControls() {
    const bounds = selectedRange();
    const day = $("#historyDate");
    $("#historyToolbar").hidden = !["customer", "counter", "daily"].includes(state.view);
    $("#historyToolbar").setAttribute("aria-label", t("dailyTitle"));
    $("#historyRangeSel").value = state.range;
    $("#historyDateControls").hidden = ["7", "30"].includes(state.range);
    if (document.activeElement !== day) day.value = bounds.endDay;
    day.max = core.shopDayKey();
    $("#historyNext").disabled = bounds.endDay >= day.max;
    [["historyPrev", "historyPrev"], ["historyNext", "historyNext"]].forEach(([id, key]) => {
      $("#" + id).title = t(key);
      $("#" + id).setAttribute("aria-label", t(key));
    });
    $("#historySummary").textContent = bounds.startDay === bounds.endDay ? dayLabel(bounds.endDay) : `${dayLabel(bounds.startDay)} - ${dayLabel(bounds.endDay)}`;
    $("#historyStatus").textContent = state.loadError ? t("historyError") : state.loading ? t("historyLoading") : "";
    $("#historyStatus").classList.toggle("error", state.loadError);
    $("#historyRetry").hidden = !state.loadError;
    $("#historyRetry").disabled = state.loading;
  }

  // ---------- i18n ----------
  function applyLang() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
    updateDefaultLoginNote();
    if (!api.live) { const b = $("#demoBanner"); b.hidden = false; b.textContent = t("demoNote"); }
    renderTop();
    render();
  }

  // ---------- data ----------
  let loadVersion = 0;
  async function load() {
    const bounds = selectedRange();
    const key = bounds.since + "|" + bounds.until;
    if (state.loading && state.loadingKey === key) return;
    const version = ++loadVersion;
    const liveToday = state.range === "today";
    state.loading = true;
    state.loadingKey = key;
    state.loadError = false;
    renderHistoryControls();
    try {
      const rows = (await api.listOrders(bounds.since, bounds.until)).filter(isOnlineOrder);
      if (version !== loadVersion) return;
      const fresh = rows.filter((o) => liveToday && o.status === "new" && state.known && !state.known.has(o.id));
      state.known = new Set(rows.map((o) => o.id));
      state.payState = new Map(rows.map((o) => [o.id, o.payment_status || "unpaid"]));
      state.orders = rows;
      if (fresh.length) {
        chime();
        toast(`${t("newOrderToast")} ${fresh.map((o) => isTableOrder(o) ? `${tableLabel(o)} · ${o.code}` : o.code).join(", ")}`);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      state.loading = false;
      render();
      if (fresh.length && state.autoPrint) fresh.forEach((o) => printOrder(o));
    } catch (e) {
      if (version !== loadVersion) return;
      state.loading = false;
      state.loadError = true;
      render();
      if (e.status === 401) { api.signOut(); return showLogin(); }
      console.error(e);
    }
  }
  function startPolling() {
    clearInterval(state.timer);
    load();
    state.timer = setInterval(load, Math.max(5, CFG.pollSeconds) * 1000);
  }

  // ---------- render ----------
  function renderTop() {
    const on = state.settings.accepting_orders;
    $("#acceptToggle").checked = on;
    $("#acceptLabel").textContent = on ? t("accepting") : t("paused");
    $(".switch").classList.toggle("off", !on);
    const pb = $("#printBtn");
    pb.setAttribute("aria-pressed", String(state.autoPrint));
    pb.title = t("autoPrint");
    pb.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3Zm-3 11H8v-5h8v5Zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-1-9H6v4h12V3Z"/></svg>' + (state.autoPrint ? '<span class="dot"></span>' : "");
    const sb = $("#soundBtn");
    sb.setAttribute("aria-pressed", String(state.sound));
    sb.title = t("sound");
    sb.innerHTML = state.sound
      ? '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16.5 12A4.5 4.5 0 0 0 14 8v2.2l2.45 2.45c.03-.2.05-.42.05-.65ZM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.8v2.1A7 7 0 0 1 19 12ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z"/></svg>';
  }

  function renderStats(targetId, list, titleKey) {
    const valid = list.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((n, o) => n + (o.total || 0), 0);
    const active = list.filter((o) => ACTIVE.includes(o.status)).length;
    const newCount = list.filter((o) => o.status === "new").length;
    const label = state.range === "today" ? t("ordersToday") : t("orders");
    const el = document.getElementById(targetId);
    if (!el) return;
    el.innerHTML = [
      [label, valid.length, ""],
      [t("revenue"), money(revenue), "gold"],
      [t("active"), active, active ? "red" : ""],
      [t("f_new"), newCount, newCount ? "warn" : ""],
    ].map(([l, v, c]) => `<div class="stat ${c}"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
    if (titleKey) document.title = (newCount ? `(${newCount}) ` : "") + `Maha Duck — ${titleKey}`;
  }

  function syncViewUI() {
    const valid = ["customer", "counter", "kitchen", "inventory", "daily", "tables"];
    if (!valid.includes(state.view)) state.view = "counter";
    const tabBar = document.querySelector(".admin-tabs");
    if (tabBar) tabBar.hidden = state.view === "kitchen";
    const selectedTab = document.querySelector(`.admin-tabs [data-view="${state.view}"]`);
    $$(".admin-tabs [data-view]").forEach((b) => b.setAttribute("aria-selected", String(b === selectedTab)));
    $("#customerView").hidden = state.view !== "customer";
    $("#counterView").hidden = state.view !== "counter";
    $("#kitchenView").hidden = state.view !== "kitchen";
    $("#inventoryView").hidden = state.view !== "inventory";
    $("#dailyView").hidden = state.view !== "daily";
    const legacyOrders = $("#ordersView");
    if (legacyOrders) legacyOrders.hidden = true;
    $("#tablesView").hidden = state.view !== "tables";
    const posView = $("#posView");
    if (posView) posView.hidden = true;
    document.body.classList.remove("pos-mode");
    document.body.classList.toggle("kitchen-mode", state.view === "kitchen");
    renderHistoryControls();
  }

  function renderCustomerView() {
    const list = [...state.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const ready = list.filter((o) => o.status === "ready");
    const stats = document.getElementById("customerStats");
    if (stats) {
      stats.innerHTML = [
        [t("orders"), list.length, ""],
        [t("f_ready"), ready.length, ready.length ? "green" : ""],
        [t("f_preparing"), list.filter((o) => o.status === "preparing").length, "red"],
      ].map(([l, v, c]) => `<div class="stat ${c}"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
    }

    const customerFilters = document.getElementById("customerFilters");
    if (customerFilters) {
      if (!(["all", "new", "preparing", "ready", "completed", "cancelled"].includes(state.filter))) state.filter = "all";
      customerFilters.innerHTML = ["all", "new", "preparing", "ready", "completed", "cancelled"].map((status) => {
        const count = status === "all" ? list.length : list.filter((o) => o.status === status).length;
        return `<button type="button" role="tab" aria-selected="${state.filter === status}" data-filter="${status}">${t("f_" + status)} <b>${count}</b></button>`;
      }).join("");
    }

    const board = document.getElementById("customerBoard");
    if (!board) return;
    const rows = state.filter === "all" || !state.filter ? list : list.filter((o) => o.status === state.filter);
    const pages = Math.max(1, Math.ceil(rows.length / 24));
    state.customerPage = Math.min(state.customerPage, pages);
    const pageRows = rows.slice((state.customerPage - 1) * 24, state.customerPage * 24);
    board.className = "board list";
    board.innerHTML = pageRows.length ? pageRows.map((o) => `<article class="order st-${o.status}">
      <header><div><strong class="code">${esc(o.code)}</strong> <span class="pill ${o.status}">${t("st_" + o.status)}</span></div><time datetime="${esc(o.created_at)}">${esc(dayLabel(dayKey(o.created_at)))} · ${clock(o.created_at)}</time></header>
      <div class="meta">${sourceChip(o)}${typeChip(o)}</div><div class="who"><strong>${esc(customerName(o))}</strong></div>
      ${(o.items || []).length ? `<ul class="history-items">${o.items.map((item) => `<li>${esc(item.qty)} × ${esc(item.name)}</li>`).join("")}</ul>` : ""}
      <div class="ototal"><span>${t("total")}</span><strong>${money(o.total)}</strong></div>
      <footer><button class="btn btn-line btn-sm" type="button" data-detail="${esc(o.id)}" aria-label="${esc(t("historyView") + " " + o.code)}">${t("historyView")}</button></footer>
    </article>`).join("") : `<div class="empty"><img src="images/mascot/duck-1.webp" alt="" /><p>${state.loading ? t("historyLoading") : state.loadError ? t("historyError") : t("noDaily")}</p></div>`;
    const pager = $("#customerPager");
    pager.hidden = pages <= 1;
    pager.innerHTML = `<button class="icon-btn history-step" type="button" data-history-page="-1" title="${esc(t("historyPrevPage"))}" aria-label="${esc(t("historyPrevPage"))}" ${state.customerPage <= 1 ? "disabled" : ""}>&#8592;</button><span>${state.customerPage} / ${pages} · ${rows.length} ${t("orders")}</span><button class="icon-btn history-step" type="button" data-history-page="1" title="${esc(t("historyNextPage"))}" aria-label="${esc(t("historyNextPage"))}" ${state.customerPage >= pages ? "disabled" : ""}>&#8594;</button>`;
  }

  let detailOrder = null;
  function openOrderDetails(id) {
    const order = state.orders.find((entry) => entry.id === id);
    if (!order) return;
    detailOrder = order;
    $("#orderDetailsTitle").textContent = `${t("orderCode")} ${order.code}`;
    $("#orderDetailsBody").innerHTML = `<div class="meta">${sourceChip(order)}${typeChip(order)}<span class="pill ${esc(order.status)}">${t("st_" + order.status)}</span></div>
      <time datetime="${esc(order.created_at)}">${esc(dayLabel(dayKey(order.created_at)))} · ${clock(order.created_at)}</time>
      <div class="history-details-who"><strong>${esc(customerName(order))}</strong>${order.phone ? `<span>${esc(order.phone)}</span>` : ""}${order.address ? `<span>${esc(order.address)}</span>` : ""}</div>
      ${(order.items || []).length ? `<ul class="items">${order.items.map((item) => `<li><b>${esc(item.qty)}×</b><div><span>${esc(item.name)}</span>${(Array.isArray(item.details) ? item.details : []).map((detail) => `<small>${esc(detail)}</small>`).join("")}</div><em>${money(item.line_total)}</em></li>`).join("")}</ul>` : `<p class="hint">${t("historyNoItems")}</p>`}
      ${order.note ? `<p class="onote">${esc(order.note)}</p>` : ""}
      <div class="totals"><div><span>${t("subtotal")}</span><span>${money(order.subtotal)}</span></div>
        ${order.vat_rate ? `<div><span>${t("vat")} ${order.vat_rate}%</span><span>${money(order.vat_amount)}</span></div>` : ""}
        ${order.order_type === "delivery" ? `<div><span>${t("deliveryFee")}</span><span>${order.delivery_fee == null ? t("byShop") : money(order.delivery_fee)}</span></div>` : ""}
        <div class="grand"><span>${t("total")}</span><b>${money(order.total)}</b></div></div>
      <p class="hint">${t("payment")}: ${esc(t(order.payment || "cash"))} · ${esc(t("pay_" + (order.payment_status || "unpaid")))}</p>`;
    $("#orderDetailsFoot").innerHTML = `<button class="btn btn-line" type="button" data-detail-close>${t("back")}</button><button class="btn btn-green btn-grow" type="button" data-print-detail>${t("printReceipt")}</button>`;
    $("#orderDetails").showModal();
  }

  function renderKitchenView() {
    const kitchenList = state.orders.filter((o) => ["new", "preparing", "ready"].includes(o.status));
    const board = document.getElementById("kitchenBoard");
    if (!board) return;
    const groups = [
      { key: "new", label: "New" },
      { key: "preparing", label: "Cooking" },
      { key: "ready", label: "Ready" },
    ];
    board.innerHTML = groups.map((group) => {
      const items = kitchenList.filter((o) => o.status === group.key).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return `<div class="col col-${group.key}"><h3>${group.label} <b>${items.length}</b></h3>${items.map((o) => `<article class="order st-${o.status}" data-id="${esc(o.id)}"><header><strong class="code">${esc(o.code)}</strong></header><div class="meta">${sourceChip(o)}${typeChip(o)}</div><ul class="items">${(o.items || []).map((i) => `<li><b>${i.qty}×</b><div><span>${esc(i.name)}</span>${(i.details || []).map((d) => `<small>${esc(d)}</small>`).join("")}</div></li>`).join("")}</ul><footer><button class="btn btn-sm ${o.status === "ready" ? "btn-line" : "btn-green"} grow" type="button" data-set="${o.status === "new" ? "preparing" : o.status === "preparing" ? "ready" : "completed"}" ${state.busy.has(o.id) ? "disabled" : ""}>${t(o.status === "new" ? "a_accept" : o.status === "preparing" ? "a_ready" : "a_complete")}</button></footer></article>`).join("") || `<p class="col-empty">—</p>`}</div>`;
    }).join("");
    const stats = document.getElementById("kitchenStats");
    if (stats) {
      stats.innerHTML = [
        ["Kitchen queue", kitchenList.length, ""],
        ["New", kitchenList.filter((o) => o.status === "new").length, ""],
        ["Ready", kitchenList.filter((o) => o.status === "ready").length, "green"],
      ].map(([l, v, c]) => `<div class="stat ${c}"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
    }
  }

  function renderInventoryView() {
    const rows = allSetRows();
    const out = rows.filter(({ item }) => stockOf(item.id) <= 0).length;
    const low = rows.filter(({ item }) => {
      const stock = stockOf(item.id);
      return stock > 0 && stock <= 3;
    }).length;
    const totalStock = rows.reduce((sum, { item }) => sum + stockOf(item.id), 0);
    const stats = document.getElementById("inventoryStats");
    if (stats) {
      stats.innerHTML = [
        [t("inventoryTotal"), rows.length, ""],
        [t("stock"), totalStock, "gold"],
        [t("inventoryLow"), low, low ? "warn" : ""],
        [t("inventoryOut"), out, out ? "red" : ""],
      ].map(([l, v, c]) => `<div class="stat ${c}"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
    }
    const board = document.getElementById("inventoryBoard");
    if (!board) return;
    board.innerHTML = allSetGroups().map((group) => {
      const groupName = menuName(group);
      const rowsHtml = (group.items || []).map((item) => {
        const stock = stockOf(item.id);
        const busy = state.busy.has("inv:" + item.id);
        const status = stock <= 0 ? `<span class="inv-status out">${t("soldOut")}</span>` : stock <= 3 ? `<span class="inv-status low">${t("inventoryLow")}</span>` : "";
        return `<div class="inv-row ${stock <= 0 ? "is-out" : ""}" data-id="${esc(item.id)}">
          <div class="inv-food">${item.img ? `<img src="${esc(item.img)}" alt="" />` : `<span class="inv-ph"><img src="images/brand/logo-mark.png?v=2026-10-06-logo" alt="" /></span>`}
            <div><strong>${esc(menuName(item))}</strong><small>${esc(item.th || "")}${typeof item.price === "number" ? ` · ${money(item.price)}` : ""}</small>${status}</div></div>
          <div class="inv-control" aria-label="${esc(t("stock"))}">
            <button type="button" class="inv-step" data-inv-id="${esc(item.id)}" data-inv-d="-1" ${busy || stock <= 0 ? "disabled" : ""}>−</button>
            <output>${stock}</output>
            <button type="button" class="inv-step plus" data-inv-id="${esc(item.id)}" data-inv-d="1" ${busy ? "disabled" : ""}>+</button>
          </div>
        </div>`;
      }).join("");
      return `<section class="inv-group"><h3>${esc(groupName)} <small>${esc(group.th || "")}</small></h3>${rowsHtml}</section>`;
    }).join("");
  }

  function dayKey(iso) {
    return core.shopDayKey(iso);
  }
  function dayLabel(key) {
    const locale = state.lang === "th" ? "th-TH" : state.lang === "my" ? "en-GB" : "en-US";
    return new Date(`${key}T12:00:00+07:00`).toLocaleDateString(locale, { timeZone: core.shopTimeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function renderDailyView() {
    const valid = state.orders.filter((o) => o.status !== "cancelled");
    const stats = document.getElementById("dailyStats");
    if (stats) {
      stats.innerHTML = [
        [t("dailyOrders"), state.orders.length, ""],
        [t("dailyNet"), money(valid.reduce((sum, o) => sum + (o.total || 0), 0)), "gold"],
        [t("dailyActive"), state.orders.filter((o) => ACTIVE.includes(o.status)).length, "red"],
        [t("dailyCancelled"), state.orders.filter((o) => o.status === "cancelled").length, ""],
      ].map(([l, v, c]) => `<div class="stat ${c}"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
    }
    const groups = new Map();
    state.orders.forEach((order) => {
      const key = dayKey(order.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(order);
    });
    const board = document.getElementById("dailyBoard");
    if (!board) return;
    const days = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    board.innerHTML = days.length ? days.map(([key, orders]) => {
      const good = orders.filter((o) => o.status !== "cancelled");
      const revenue = good.reduce((sum, o) => sum + (o.total || 0), 0);
      const rows = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((o) => `<li>
        <span><button class="daily-order-link" type="button" data-detail="${esc(o.id)}" aria-label="${esc(t("historyView") + " " + o.code)}"><b>${esc(o.code)}</b></button><small>${clock(o.created_at)} · ${esc(isTableOrder(o) ? tableLabel(o) : customerName(o))}</small></span>
        <em class="${o.status}">${t("st_" + o.status)}</em><strong>${money(o.total)}</strong>
      </li>`).join("");
      return `<article class="daily-card"><header><div><h3>${esc(dayLabel(key))}</h3><p>${orders.length} ${t("dailyOrders")} · ${t("dailyNet")} ${money(revenue)}</p></div><strong>${money(revenue)}</strong></header><ul>${rows}</ul></article>`;
    }).join("") : `<div class="empty"><img src="images/mascot/duck-1.webp" alt="" /><p>${t("noDaily")}</p></div>`;
  }

  function counterOrders() {
    return state.orders.filter((o) => {
      if (isTableOrder(o)) return state.source !== "online" && (state.table === "all" || o.table_no === state.table);
      return state.source !== "table" && isFacebookOrder(o);
    });
  }

  function renderSourceFilters() {
    $("#sourceFilters").innerHTML = [["all", t("bothQueues")], ["online", t("onlineOrders")], ["table", t("tableOrders")]]
      .map(([source, label]) => `<button type="button" role="tab" aria-selected="${state.source === source}" data-source="${source}">${esc(label)} <b>${state.orders.filter((o) => source === "all" || (source === "table" ? isTableOrder(o) : isFacebookOrder(o))).length}</b></button>`).join("");
    const tables = [...new Set(state.orders.filter(isTableOrder).map((o) => o.table_no).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!tables.includes(state.table)) state.table = "all";
    $("#tableFilterField").hidden = state.source === "online";
    $("#tableFilter").innerHTML = `<option value="all">${esc(t("allTables"))}</option>` + tables.map((n) => `<option value="${esc(n)}">${esc(t("table"))} ${esc(n)}</option>`).join("");
    $("#tableFilter").value = state.table;
  }

  function renderCounterBoard(orders) {
    const list = orders.filter((o) => state.filter === "all" || (state.filter === "active" ? ACTIVE.includes(o.status) : o.status === state.filter));
    const oldestFirst = (a, b) => a.created_at.localeCompare(b.created_at);
    const online = list.filter(isFacebookOrder).sort((a, b) => state.filter === "active"
      ? ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status) || oldestFirst(a, b)
      : oldestFirst(a, b));
    const tableOrders = list.filter(isTableOrder);
    const tables = [...new Set(tableOrders.map((o) => o.table_no || "-"))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const empty = `<p class="queue-empty">${esc(t("noActive"))}</p>`;
    const tableHtml = tables.map((table) => {
      const rows = tableOrders.filter((o) => (o.table_no || "-") === table).sort(oldestFirst);
      return `<section class="table-group"><h3>${esc(t("table"))} ${esc(table)} <span>${rows.length} ${esc(t("orders"))}</span></h3><div class="table-orders">${rows.map(card).join("")}</div></section>`;
    }).join("");
    const queues = [
      { id: "online", title: t("onlineOrders"), rows: online, html: `<div class="queue-list">${online.map(card).join("") || empty}</div>` },
      { id: "table", title: t("tableOrders"), rows: tableOrders, html: `<div class="table-board">${tableHtml || empty}</div>` },
    ].filter((queue) => state.source === "all" || state.source === queue.id);
    const board = $("#board");
    board.className = `board counter-queues${state.source === "all" ? "" : " queue-single"}`;
    board.innerHTML = queues.map((queue) => `<section class="counter-queue" data-counter-source="${queue.id}" aria-labelledby="queue-${queue.id}">
      <header class="queue-head"><h2 id="queue-${queue.id}">${esc(queue.title)}</h2><span>${queue.rows.length} ${esc(t("orders"))}</span></header>
      ${queue.html}</section>`).join("");
  }

  function render() {
    renderHistoryControls();
    renderSourceFilters();
    const orders = counterOrders();
    renderStats("stats", orders, "Orders");
    renderStats("customerStats", state.orders, "Customer");
    renderStats("kitchenStats", state.orders, "Kitchen");
    const valid = state.orders.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((n, o) => n + (o.total || 0), 0);
    const active = orders.filter((o) => ACTIVE.includes(o.status)).length;
    const newCount = state.orders.filter((o) => o.status === "new").length;
    document.title = (newCount ? `(${newCount}) ` : "") + "Maha Duck — Orders";
    const filters = ["active", "new", "preparing", "ready", "out_for_delivery", "completed", "cancelled", "all"];
    const count = (f) => f === "all" ? orders.length : f === "active" ? active : orders.filter((o) => o.status === f).length;
    $("#filters").innerHTML = filters.map((f) => `<button type="button" role="tab" aria-selected="${state.filter === f}" data-filter="${f}">${t("f_" + f)} <b>${count(f)}</b></button>`).join("");

    const board = $("#board");
    if (state.view !== "counter") {
      board.innerHTML = "";
      if (state.view === "customer") renderCustomerView();
      if (state.view === "kitchen") renderKitchenView();
      if (state.view === "inventory") renderInventoryView();
      if (state.view === "daily") renderDailyView();
      return;
    }

    renderCounterBoard(orders);
  }

  function typeChip(o) {
    if (o.order_type === "dinein") return `<span class="chip dinein table-number">${esc(tableLabel(o))}</span>`;
    if (o.order_type === "pickup" && o.source === "pos") return `<span class="chip pickup">${t("takeaway")}</span>`;
    if (o.order_type === "pickup") return `<span class="chip pickup">${t("pickup")}${o.pickup_time ? " · " + esc(o.pickup_time === "ASAP" ? t("asap") : o.pickup_time) : ""}</span>`;
    return `<span class="chip delivery">${t("delivery")}</span>`;
  }
  function sourceChip(o) {
    if (isTableOrder(o)) return `<span class="chip src-table">${t("sourceTable")}</span>`;
    return isFacebookOrder(o) ? `<span class="chip src-facebook">${t("sourceFacebook")}</span>` : `<span class="chip src-pos">${t("sourcePos")}</span>`;
  }
  function customerName(o) {
    const name = String(o.customer_name || "").trim();
    if (isTableOrder(o) && (!name || facebookNameRe.test(name) || name === `Table ${o.table_no}`)) return tableLabel(o);
    return !name || facebookNameRe.test(name) ? t("facebookCustomer") : name;
  }

  const CLIP = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5Z"/></svg>';

  // ---------- payment slip viewer ----------
  let slipOrderId = null;
  async function openSlip(id) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    slipOrderId = id;
    const dlg = $("#slipDialog");
    dlg.classList.remove("confirm-payment");
    $("#slipTitle").textContent = `${t("slipTitle")} · ${o.code}`;
    $("#slipBody").innerHTML = `<div class="slip-amount"><span>${t("total")}</span><strong>${money(o.total)}</strong></div>
      <p class="slip-who">${esc(customerName(o))} ${o.phone ? "· " + esc(o.phone) : ""} · ${clock(o.created_at)}</p>
      <div class="slip-img" id="slipImg"><p class="pos-empty">…</p></div>
      <p class="hint" style="margin-top:10px">${t("slipCheck")}</p>`;
    renderSlipFoot(o);
    if (!dlg.open) dlg.showModal();
    try {
      const img = await api.getSlip(o.code);
      if (slipOrderId !== id) return;
      $("#slipImg").innerHTML = img && /^data:image\//.test(img) ? `<img src="${img}" alt="Slip ${esc(o.code)}" />` : `<p class="pos-empty">${t("slipGone")}</p>`;
    } catch (e) {
      $("#slipImg").innerHTML = `<p class="pos-empty">${esc(e.message || "Error")}</p>`;
    }
  }
  function renderSlipFoot(o) {
    $("#slipFoot").innerHTML = `<button class="btn btn-line btn-grow" type="button" data-close>${t("back")}</button>${paymentConfirmButton(o)}`;
  }

  function paymentConfirmButton(o) {
    if (o.payment !== "promptpay" || o.payment_status === "paid" || o.status === "cancelled") return "";
    return `<button class="btn btn-sm btn-green" type="button" data-paid="${esc(o.id)}" ${state.busy.has(o.id) ? "disabled" : ""}>${t("markPaid")}</button>`;
  }

  function card(o) {
    const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    const late = ACTIVE.includes(o.status) && mins >= 20;
    const map = safeMapLink(o.map_link) || (o.address ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(o.address) : "");
    const dispatchReady = o.status === "ready" && o.order_type === "delivery";
    const next = dispatchReady ? null : NEXT[o.status];
    const busy = state.busy.has(o.id) ? "disabled" : "";
    return `<article class="order st-${o.status} ${late ? "late" : ""}" data-id="${o.id}">
      <header>
        <div><strong class="code">${esc(o.code)}</strong> <span class="pill ${o.status}">${t("st_" + o.status)}</span></div>
        <time title="${new Date(o.created_at).toLocaleString(undefined, { timeZone: core.shopTimeZone })}">${clock(o.created_at)} · ${since(o.created_at)}</time>
      </header>
      <div class="meta">${sourceChip(o)}${typeChip(o)}${o.payment === "promptpay" ? `<span class="chip pay ps-${esc(o.payment_status || "unpaid")}">QR · ${t("pay_" + (o.payment_status || "unpaid"))}</span>` : ""}</div>
      <div class="who">
        <strong>${esc(customerName(o))}</strong>
        ${o.phone ? `<a href="tel:${esc(o.phone.replace(/[^\d+]/g, ""))}" class="tel">${esc(o.phone)}</a>` : ""}
        ${o.address ? `<p class="addr">${esc(o.address)} ${map ? `<a href="${esc(map)}" target="_blank" rel="noopener">Map ↗</a>` : ""}</p>` : ""}
      </div>
      <ul class="items">${(o.items || []).map((i) => `<li><b>${i.qty}×</b><div><span>${esc(i.name)}</span>${(i.details || []).map((d) => `<small>${esc(d)}</small>`).join("")}</div><em>${money(i.line_total)}</em></li>`).join("")}</ul>
      ${o.note ? `<p class="onote">“${esc(o.note)}”</p>` : ""}
      ${o.status === "out_for_delivery" ? `<p class="delivery-progress"><strong>${esc(o.delivery_provider || t("deliveryProvider"))}</strong>${o.delivery_started_at ? `<small>${new Date(o.delivery_started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>` : ""}</p>` : ""}
      ${o.order_type === "delivery" && o.delivery_fee != null ? `<div class="ofee"><span>${t("subtotal")} ${money(o.subtotal)}</span><span>+ ${t("deliveryFee")} ${money(o.delivery_fee)}</span></div>` : ""}
      ${o.vat_rate ? `<div class="ofee"><span>${t("subtotal")} ${money(o.subtotal)}</span><span>+ ${t("vat")} ${o.vat_rate}% ${money(o.vat_amount)}</span></div>` : ""}
      <div class="ototal"><span>${t("total")}${o.order_type === "delivery" && o.delivery_fee == null ? ` <small>(+ ${t("deliveryFee")})</small>` : ""}</span><strong>${money(o.total)}</strong></div>
      <footer>
        ${o.has_slip ? `<button class="btn btn-sm btn-slip" type="button" data-slip="${esc(o.id)}">${t("viewSlip")}</button>` : ""}
        ${paymentConfirmButton(o)}
        ${dispatchReady ? `<label class="delivery-start"><span>${t("deliveryProvider")}</span><input type="text" maxlength="80" value="${esc(o.delivery_provider || "")}" placeholder="${esc(t("deliveryProviderPh"))}" data-delivery-provider /></label><button class="btn btn-sm btn-green grow" type="button" data-set="out_for_delivery" data-dispatch ${busy}>${t("a_startDelivery")}</button>` : ""}
        ${next ? `<button class="btn btn-sm ${o.status === "new" ? "btn-red" : "btn-green"} grow" type="button" data-set="${next[0]}" ${busy}>${t(next[1])}</button>` : ""}
        ${["completed", "cancelled"].includes(o.status) ? `<button class="btn btn-sm btn-line" type="button" data-set="preparing" ${busy}>${t("a_undo")}</button>` : ""}
        <button class="btn btn-sm btn-line" type="button" data-print="${o.id}">${t("a_print")}</button>
        ${["new", "preparing", "ready"].includes(o.status) ? `<button class="btn btn-sm btn-line danger" type="button" data-set="cancelled" ${busy}>${t("a_cancel")}</button>` : ""}
      </footer>
    </article>`;
  }

  async function setStatus(id, status, extra = {}) {
    if (status === "cancelled" && !confirm(t("confirmCancel"))) return;
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    if (status === "out_for_delivery" && !String(extra.delivery_provider || "").trim()) return toast(t("deliveryProviderRequired"));
    const prev = { status: o.status, delivery_provider: o.delivery_provider, delivery_started_at: o.delivery_started_at };
    Object.assign(o, extra, { status });
    state.busy.add(id);
    render();
    try {
      await api.updateOrder(id, { ...extra, status });
    } catch (e) {
      Object.assign(o, prev);
      toast(e.message);
    }
    state.busy.delete(id);
    render();
  }

  async function changeInventory(id, delta) {
    if (!id || state.busy.has("inv:" + id)) return;
    const prev = { ...(state.settings.inventory || {}) };
    const next = { ...prev, [id]: Math.max(0, stockOf(id) + delta) };
    state.settings.inventory = next;
    state.busy.add("inv:" + id);
    renderInventoryView();
    try {
      await api.saveSettings({ inventory: next });
      toast(t("inventorySaved"));
    } catch (e) {
      state.settings.inventory = prev;
      toast(e.message || t("errSend"));
    }
    state.busy.delete("inv:" + id);
    renderInventoryView();
  }

  function confirmPayment(id) {
    const order = state.orders.find((entry) => entry.id === id);
    if (!order || order.payment !== "promptpay" || order.payment_status === "paid" || order.status === "cancelled" || state.busy.has(id)) return;
    slipOrderId = id;
    const dialog = $("#slipDialog");
    dialog.classList.add("confirm-payment");
    $("#slipTitle").textContent = `${t("payment")} · ${order.code}`;
    $("#slipBody").innerHTML = `<div class="slip-amount"><span>${t("total")}</span><strong>${money(order.total)}</strong></div>
      ${CFG.promptpayName ? `<p class="slip-who">${t("payTo")}: <strong>${esc(CFG.promptpayName)}</strong></p>` : ""}
      <p class="hint" style="margin-top:14px">${t("slipCheck")}</p>`;
    $("#slipFoot").innerHTML = `<button class="btn btn-line btn-grow" type="button" data-close>${t("back")}</button><button class="btn btn-green" type="button" data-confirm-paid="${esc(id)}">${t("confirmReceived")}</button>`;
    if (!dialog.open) dialog.showModal();
  }

  async function savePayment(id) {
    const order = state.orders.find((entry) => entry.id === id);
    if (slipOrderId !== id || !order || order.payment !== "promptpay" || order.payment_status === "paid" || order.status === "cancelled" || state.busy.has(id)) return;
    state.busy.add(id);
    const confirmButton = $("#slipFoot [data-confirm-paid]");
    if (confirmButton) confirmButton.disabled = true;
    render();
    try {
      await api.updateOrder(id, { payment_status: "paid" });
      await load();
      if (slipOrderId === id) { slipOrderId = null; $("#slipDialog").close(); }
      toast(t("paidOk"));
    } catch (error) {
      toast(error.message || t("errSend"));
    } finally {
      state.busy.delete(id);
      if (confirmButton) confirmButton.disabled = false;
      render();
    }
  }

  function setRange(value, day = selectedRange().endDay) {
    if (!["today", "yesterday", "custom", "7", "30"].includes(value)) return;
    if (value === "custom" && (!core.isDayKey(day) || day > core.shopDayKey())) {
      toast(t("historyInvalidDate"));
      $("#historyDate").value = selectedRange().endDay;
      renderHistoryControls();
      return;
    }
    loadVersion += 1;
    state.range = value;
    state.date = day;
    state.customerPage = 1;
    state.orders = [];
    state.known = null;
    state.loading = false;
    state.loadError = false;
    if (value !== "today") state.filter = "all";
    const url = new URL(location.href);
    url.searchParams.delete("range");
    url.searchParams.delete("date");
    if (value === "custom") url.searchParams.set("date", day);
    else if (value !== "today") url.searchParams.set("range", value);
    history.replaceState({}, "", url);
    load();
    render();
  }

  function setPage(css) {
    let st = document.getElementById("pageStyle");
    if (!st) { st = document.createElement("style"); st.id = "pageStyle"; document.head.appendChild(st); }
    st.textContent = css;
  }

  function ticketHtml(o) {
    const typeLine = o.order_type === "dinein" ? "DINE-IN · TABLE " + esc(o.table_no || "-")
      : o.order_type === "pickup" ? (o.source === "pos" ? "TAKEAWAY" : "PICKUP · " + esc(o.pickup_time || "ASAP")) : "DELIVERY";
    return `<div class="ticket">
      <h2>MAHA DUCK</h2><p class="c">THE MASTER OF MALA<br/>${esc(CFG.location)}${CFG.phone ? "<br/>" + esc(CFG.phone) : ""}</p>
      <hr/>
      <p class="xl">${typeLine}</p>
      <p class="big">${esc(o.code)}${isTableOrder(o) ? " · TABLE QR" : isFacebookOrder(o) ? " · FACEBOOK" : o.source === "pos" ? " · POS" : ""}</p>
      <p>${new Date(o.created_at).toLocaleString(undefined, { timeZone: core.shopTimeZone })}</p>
      <p>${esc(customerName(o))} ${esc(o.phone || "")}</p>
      ${o.address ? `<p>${esc(o.address)}</p>` : ""}
      <hr/>
      ${(o.items || []).map((i) => `<div class="row item"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.line_total)}</span></div>${(i.details || []).map((d) => `<div class="det">${esc(d)}</div>`).join("")}`).join("")}
      <hr/>
      ${o.note ? `<p class="note">NOTE: ${esc(o.note)}</p><hr/>` : ""}
      <div class="row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${o.vat_rate ? `<div class="row"><span>VAT ${o.vat_rate}%</span><span>${money(o.vat_amount)}</span></div>` : ""}
      ${o.order_type === "delivery" ? `<div class="row"><span>Delivery</span><span>${o.delivery_fee == null ? "-" : money(o.delivery_fee)}</span></div>` : ""}
      <div class="row big"><span>TOTAL</span><span>${money(o.total)}</span></div>
      ${o.payment === "promptpay" ? `<p>PromptPay / QR · ${esc(t("pay_" + (o.payment_status || "unpaid")))}</p>` : ""}
      <hr/><p class="c">${esc(CFG.receiptFooter || "Thank you!")}</p>
    </div>`;
  }

  // Prints on an 80 mm receipt/kitchen printer (set it as the default printer).
  function printOrder(o) {
    const area = $("#printArea");
    setPage("@page { size: 80mm auto; margin: 2mm; }");
    area.innerHTML = ticketHtml(o);
    area.hidden = false;
    window.print();
    area.hidden = true;
  }
  function printTicket(id) {
    const o = state.orders.find((x) => x.id === id);
    if (o) printOrder(o);
  }

  // ---------- table QR ----------
  function menuUrl(n) {
    const raw = $("#tableMenuUrl").value.trim();
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error(t("errMenuUrl"));
    u.search = "";
    u.hash = "";
    u.searchParams.set("table", n);
    return u.toString();
  }
  function genQR() {
    if (!$("#tableMenuUrl").value) $("#tableMenuUrl").value = S.get("mahaduck-menu-url", new URL("index.html", location.href).toString());
    $("#tableQrError").textContent = "";
    try { menuUrl(1); } catch { $("#tableQrError").textContent = t("errMenuUrl"); return false; }
    S.set("mahaduck-menu-url", $("#tableMenuUrl").value.trim());
    const n = Math.max(1, Math.min(60, Math.floor(Number($("#tableCount").value) || 1)));
    const grid = $("#qrGrid");
    grid.innerHTML = "";
    if (!window.qrcode) { grid.textContent = "QR library could not load."; return false; }
    for (let i = 1; i <= n; i++) {
      const card = document.createElement("div");
      card.className = "qr-card";
      card.innerHTML = `<div class="qr-head"><img src="images/brand/logo-mark.png?v=2026-10-06-logo" alt="" /><strong>MAHA DUCK</strong></div><a class="qr" href="${esc(menuUrl(i))}" target="_blank" rel="noopener" aria-label="${esc(t("table"))} ${i}"></a><p class="qr-t">TABLE <b>${i}</b></p><p class="qr-s">Scan to order · สแกนเพื่อสั่ง · Scan ဖတ်ပြီးမှာပါ</p>`;
      grid.appendChild(card);
      const qr = window.qrcode(0, "M");
      qr.addData(menuUrl(i));
      qr.make();
      $(".qr", card).innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }).replace("<svg ", '<svg style="width:170px;height:170px" ').replace(/fill="black"/g, 'fill="#0c3a20"');
    }
  }
  function printQR() {
    if (genQR() === false) return;
    const area = $("#printArea");
    setPage("@page { size: A4; margin: 12mm; }");
    area.innerHTML = `<div class="qr-print">${$("#qrGrid").innerHTML}</div>`;
    area.hidden = false;
    setTimeout(() => { window.print(); area.hidden = true; }, 200);
  }

  // ---------- views ----------
  function showLogin(message) {
    clearInterval(state.timer);
    $("#dashView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginForm").hidden = false;
    $("#passwordSetupForm").hidden = true;
    $("#loginError").textContent = message || "";
    applyLang();
  }
  function showPasswordSetup(message) {
    clearInterval(state.timer);
    $("#dashView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginForm").hidden = true;
    $("#passwordSetupForm").hidden = false;
    $("#passwordSetupError").textContent = message || "";
    applyLang();
  }
  async function showDash() {
    $("#loginView").hidden = true;
    $("#dashView").hidden = false;
    $("#signOut").hidden = !api.live;
    const rawSettings = await api.getSettings();
    state.settings = normalizeSettings(rawSettings);
    const rawInventory = rawSettings && rawSettings.inventory && typeof rawSettings.inventory === "object" ? rawSettings.inventory : {};
    const hasAllInventory = allSetRows().every(({ item }) => Object.prototype.hasOwnProperty.call(rawInventory, item.id));
    if (!hasAllInventory && allSetRows().length) {
      api.saveSettings({ inventory: state.settings.inventory }).catch((error) => console.warn("Could not initialize inventory", error));
    }
    $("#noticeInput").value = state.settings.notice || "";
    applyLang();
    if (state.view === "tables") genQR();
    startPolling();
  }

  // ---------- events ----------
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    $("#loginError").textContent = "";
    try {
      await api.signIn(String(f.get("email")).trim(), String(f.get("password")));
      showDash();
    } catch (err) {
      $("#loginError").textContent = err.message || "Login failed";
    }
    btn.disabled = false;
  });
  $("#passwordSetupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const password = String(f.get("password"));
    const confirm = String(f.get("confirm"));
    const btn = $("button[type=submit]", e.target);
    $("#passwordSetupError").textContent = "";
    if (password.length < 8) {
      $("#passwordSetupError").textContent = t("passwordTooShort");
      return;
    }
    if (password !== confirm) {
      $("#passwordSetupError").textContent = t("passwordMismatch");
      return;
    }
    btn.disabled = true;
    try {
      await api.updatePassword(password);
      toast(t("passwordSaved"));
      showDash();
    } catch (err) {
      $("#passwordSetupError").textContent = err.message || "Could not set password";
    }
    btn.disabled = false;
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el) return;
    const d = el.dataset;
    if (d.lang) { state.lang = d.lang; S.set("mahaduck-admin-lang", d.lang); return applyLang(); }
    if (d.filter) { state.filter = d.filter; state.customerPage = 1; return render(); }
    if (d.detail) return openOrderDetails(d.detail);
    if ("detailClose" in d) { detailOrder = null; return $("#orderDetails").close(); }
    if ("printDetail" in d && detailOrder) return printOrder(detailOrder);
    if (d.historyPage) { state.customerPage = Math.max(1, state.customerPage + Number(d.historyPage)); renderCustomerView(); $("#customerView").scrollIntoView({ block: "start" }); return; }
    if (el.id === "historyPrev" || el.id === "historyNext") return setRange("custom", core.shiftDayKey(selectedRange().endDay, el.id === "historyPrev" ? -1 : 1));
    if (el.id === "historyRetry") return load();
    if (d.source) { state.source = d.source; state.table = "all"; return render(); }
    if (d.invId) return changeInventory(d.invId, Number(d.invD) || 0);
    if (d.set) {
      const orderEl = el.closest(".order");
      if (orderEl && orderEl.dataset.id) {
        if (d.dispatch) {
          const provider = orderEl.querySelector("[data-delivery-provider]")?.value.trim() || "";
          if (!provider) return toast(t("deliveryProviderRequired"));
          return setStatus(orderEl.dataset.id, d.set, { delivery_provider: provider, delivery_started_at: new Date().toISOString() });
        }
        return setStatus(orderEl.dataset.id, d.set);
      }
      return;
    }
    if (d.print) return printTicket(d.print);
    if (d.slip) return openSlip(d.slip);
    if (d.paid) return confirmPayment(d.paid);
    if (d.confirmPaid) return savePayment(d.confirmPaid);
    if (el.closest("#slipDialog")) {
      if ("close" in d) { slipOrderId = null; return $("#slipDialog").close(); }
    }
    if (d.view) {
      state.view = d.view;
      const url = new URL(location.href);
      url.searchParams.set("view", d.view);
      history.replaceState({}, "", url);
      syncViewUI();
      if (d.view === "kitchen" && state.range !== "today") return setRange("today");
      if (d.view === "tables" && !$("#qrGrid").children.length) genQR();
      return render();
    }
    if (el.id === "printBtn") { state.autoPrint = !state.autoPrint; S.set("mahaduck-admin-autoprint", state.autoPrint); renderTop(); toast(t("autoPrint") + (state.autoPrint ? " ✓" : " ✗")); return; }
    if (el.id === "soundBtn") { state.sound = !state.sound; S.set("mahaduck-admin-sound", state.sound); renderTop(); if (state.sound) chime(); return; }
    if (el.id === "signOut") { api.signOut(); return showLogin(); }
    if (el.id === "genQR") return genQR();
    if (el.id === "printQR") return printQR();
    if (el.id === "noticeSave") {
      const notice = $("#noticeInput").value.trim();
      api.saveSettings({ notice }).then(() => { state.settings.notice = notice; toast(t("saved")); }).catch((er) => toast(er.message));
    }
  });

  $("#slipDialog").addEventListener("click", (e) => { if (e.target.id === "slipDialog") { slipOrderId = null; e.currentTarget.close(); } });
  $("#orderDetails").addEventListener("click", (e) => { if (e.target.id === "orderDetails") { detailOrder = null; e.currentTarget.close(); } });
  $("#orderDetails").addEventListener("close", () => { detailOrder = null; });
  $("#acceptToggle").addEventListener("change", async (e) => {
    const on = e.target.checked;
    state.settings.accepting_orders = on;
    renderTop();
    try { await api.saveSettings({ accepting_orders: on }); toast(t("saved")); }
    catch (er) { state.settings.accepting_orders = !on; renderTop(); toast(er.message); }
  });
  $("#historyRangeSel").addEventListener("change", (e) => setRange(e.target.value));
  $("#historyDate").addEventListener("change", (e) => setRange("custom", e.target.value));
  $("#tableFilter").addEventListener("change", (e) => { state.table = e.target.value; render(); });
  window.addEventListener("resize", () => { clearTimeout(render.rt); render.rt = setTimeout(render, 150); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#dashView").hidden) load(); });
  window.addEventListener("storage", (e) => { if (!api.live && e.key === "mahaduck-demo-orders") load(); });
  setInterval(() => { if (!$("#dashView").hidden) render(); }, 60000); // refresh "x min ago"

  window.MahaAdmin = { t, toast, money, esc, printOrder, reload: load, lang: () => state.lang, autoPrint: () => state.autoPrint };

  // ---------- boot ----------
  (async () => {
    syncViewUI();
    const authRedirect = api.consumeAuthRedirect && api.consumeAuthRedirect();
    if (authRedirect && authRedirect.error) showLogin(authRedirect.error);
    else if (authRedirect && authRedirect.session) showPasswordSetup();
    else if (await api.isSignedIn()) showDash();
    else showLogin();
  })();
})();
