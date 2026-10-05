/* =========================================================================
   MAHA DUCK — staff order dashboard
   ========================================================================= */
(function () {
  const CFG = window.MAHA_CONFIG;
  const api = window.MahaAPI;
  const S = api.store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => CFG.currency + Number(n || 0).toLocaleString("en-US");
  const defaultStaffEmail = String((CFG.staffLogin && CFG.staffLogin.email) || "info@yehtet.com").trim();
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

  const initialView = new URLSearchParams(location.search).get("view");
  const state = {
    lang: S.get("mahaduck-admin-lang", "my"),
    orders: [],
    filter: "active",
    range: "today",
    known: null,
    sound: S.get("mahaduck-admin-sound", true),
    autoPrint: S.get("mahaduck-admin-autoprint", false),
    payState: new Map(),
    settings: { accepting_orders: true, notice: "" },
    timer: null,
    busy: new Set(),
    view: ["customer", "counter", "kitchen", "tables"].includes(initialView) ? initialView : "counter",
  };
  const t = window.makeT(() => state.lang);
  const ACTIVE = ["new", "preparing", "ready", "out_for_delivery"];
  const NEXT = { new: ["preparing", "a_accept"], preparing: ["ready", "a_ready"], ready: ["completed", "a_complete"], out_for_delivery: ["completed", "a_complete"] };

  function updateDefaultLoginNote() {
    const emailInput = $("#loginForm input[name=email]");
    if (emailInput && defaultStaffEmail && !emailInput.value) emailInput.value = defaultStaffEmail;
    const note = $("#defaultLoginNote");
    if (!note) return;
    note.hidden = !defaultStaffEmail;
    note.textContent = defaultStaffEmail ? t("defaultLoginNote").replace("{email}", defaultStaffEmail) : "";
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
    return new Date(iso).toLocaleDateString();
  }
  const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function rangeStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (state.range !== "today") d.setDate(d.getDate() - (Number(state.range) - 1));
    return d.toISOString();
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
  async function load() {
    try {
      const rows = (await api.listOrders(rangeStart())).filter((o) => (o.source || "online") === "online");
      const fresh = rows.filter((o) => o.status === "new" && state.known && !state.known.has(o.id));
      state.known = new Set(rows.map((o) => o.id));
      state.payState = new Map(rows.map((o) => [o.id, o.payment_status || "unpaid"]));
      state.orders = rows;
      if (fresh.length) {
        chime();
        toast(`${t("newOrderToast")} ${fresh.map((o) => o.code).join(", ")}`);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      state.orders = rows;
      render();
      if (fresh.length && state.autoPrint) fresh.forEach((o) => printOrder(o));
    } catch (e) {
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
    const valid = ["customer", "counter", "kitchen", "tables"];
    if (!valid.includes(state.view)) state.view = "counter";
    const tabBar = document.querySelector(".admin-tabs");
    if (tabBar) tabBar.hidden = state.view === "kitchen";
    const selectedTab = document.querySelector(`.admin-tabs [data-view="${state.view}"]`);
    $$(".admin-tabs [data-view]").forEach((b) => b.setAttribute("aria-selected", String(b === selectedTab)));
    $("#customerView").hidden = state.view !== "customer";
    $("#counterView").hidden = state.view !== "counter";
    $("#kitchenView").hidden = state.view !== "kitchen";
    const legacyOrders = $("#ordersView");
    if (legacyOrders) legacyOrders.hidden = true;
    $("#tablesView").hidden = state.view !== "tables";
    const posView = $("#posView");
    if (posView) posView.hidden = true;
    document.body.classList.remove("pos-mode");
    document.body.classList.toggle("kitchen-mode", state.view === "kitchen");
  }

  function renderCustomerView() {
    const list = [...state.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12);
    const ready = list.filter((o) => o.status === "ready");
    const readyText = ready.length ? `${ready.length} orders ready for pickup` : "No order ready yet";
    const stats = document.getElementById("customerStats");
    if (stats) {
      stats.innerHTML = [
        ["Customer view", list.length, ""],
        ["Ready", ready.length, ready.length ? "green" : ""],
        ["Preparing", list.filter((o) => o.status === "preparing").length, "red"],
      ].map(([l, v, c]) => `<div class="stat ${c}"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
    }

    const customerFilters = document.getElementById("customerFilters");
    if (customerFilters) {
      if (!(["all", "new", "preparing", "ready", "completed"].includes(state.filter))) state.filter = "all";
      customerFilters.innerHTML = ["all", "new", "preparing", "ready", "completed"].map((status) => {
        const count = status === "all" ? list.length : list.filter((o) => o.status === status).length;
        return `<button type="button" role="tab" aria-selected="${state.filter === status}" data-filter="${status}">${status === "all" ? "All" : t("f_" + status)} <b>${count}</b></button>`;
      }).join("");
    }

    const board = document.getElementById("customerBoard");
    if (!board) return;
    const rows = state.filter === "all" || !state.filter ? list : list.filter((o) => o.status === state.filter);
    board.className = "board list";
    board.innerHTML = rows.length ? rows.map((o) => `<article class="order st-${o.status} ${o.status === "ready" ? "late" : ""}"><header><div><strong class="code">${esc(o.code)}</strong> <span class="pill ${o.status}">${t("st_" + o.status)}</span></div><time>${clock(o.created_at)}</time></header><div class="who"><strong>${esc(o.customer_name || "Guest")}</strong>${o.table_no ? `<span>Table ${esc(o.table_no)}</span>` : ""}</div><div class="ototal"><span>${t("total")}</span><strong>${money(o.total)}</strong></div>${o.status === "ready" ? `<p class="onote">✅ Ready for pickup / delivery</p>` : ""}</article>`).join("") : `<div class="empty"><img src="images/mascot/duck-1.webp" alt="" /><p>${readyText}</p></div>`;
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
      return `<div class="col col-${group.key}"><h3>${group.label} <b>${items.length}</b></h3>${items.map((o) => `<article class="order st-${o.status}" data-id="${esc(o.id)}"><header><strong class="code">${esc(o.code)}</strong></header><ul class="items">${(o.items || []).map((i) => `<li><b>${i.qty}×</b><div><span>${esc(i.name)}</span>${(i.details || []).slice(0, 2).map((d) => `<small>${esc(d)}</small>`).join("")}</div></li>`).join("")}</ul><footer><button class="btn btn-sm ${o.status === "ready" ? "btn-line" : "btn-green"} grow" type="button" data-set="${o.status === "new" ? "preparing" : o.status === "preparing" ? "ready" : "completed"}" ${state.busy.has(o.id) ? "disabled" : ""}>${t(o.status === "new" ? "a_accept" : o.status === "preparing" ? "a_ready" : "a_complete")}</button></footer></article>`).join("") || `<p class="col-empty">—</p>`}</div>`;
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

  function render() {
    renderStats("stats", state.orders, "Orders");
    renderStats("customerStats", state.orders, "Customer");
    renderStats("kitchenStats", state.orders, "Kitchen");

    const valid = state.orders.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((n, o) => n + (o.total || 0), 0);
    const active = state.orders.filter((o) => ACTIVE.includes(o.status)).length;
    const newCount = state.orders.filter((o) => o.status === "new").length;
    document.title = (newCount ? `(${newCount}) ` : "") + "Maha Duck — Orders";
    const filters = ["active", "new", "preparing", "ready", "out_for_delivery", "completed", "cancelled", "all"];
    const count = (f) => f === "all" ? state.orders.length : f === "active" ? active : state.orders.filter((o) => o.status === f).length;
    $("#filters").innerHTML = filters.map((f) => `<button type="button" role="tab" aria-selected="${state.filter === f}" data-filter="${f}">${t("f_" + f)} <b>${count(f)}</b></button>`).join("");

    const board = $("#board");
    if (state.view !== "counter") {
      board.innerHTML = "";
      if (state.view === "customer") renderCustomerView();
      if (state.view === "kitchen") renderKitchenView();
      return;
    }

    if (state.filter === "active" && window.matchMedia("(min-width: 960px)").matches) {
      board.className = "board kanban";
      board.innerHTML = ACTIVE.map((st) => {
        const list = state.orders.filter((o) => o.status === st).sort((a, b) => a.created_at.localeCompare(b.created_at));
        return `<div class="col col-${st}"><h3>${t("f_" + st)} <b>${list.length}</b></h3>${list.map(card).join("") || `<p class="col-empty">—</p>`}</div>`;
      }).join("");
      return;
    }
    board.className = "board list";
    let list = state.filter === "all" ? state.orders : state.filter === "active" ? state.orders.filter((o) => ACTIVE.includes(o.status)) : state.orders.filter((o) => o.status === state.filter);
    if (state.filter === "active") list = [...list].sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status) || a.created_at.localeCompare(b.created_at));
    board.innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><img src="images/mascot/duck-1.webp" alt="" /><p>${t("noActive")}</p></div>`;
  }

  function typeChip(o) {
    if (o.order_type === "dinein") return `<span class="chip dinein">${t("dinein")}${o.table_no ? " · " + esc(o.table_no) : ""}</span>`;
    if (o.order_type === "pickup" && o.source === "pos") return `<span class="chip pickup">${t("takeaway")}</span>`;
    if (o.order_type === "pickup") return `<span class="chip pickup">${t("pickup")}${o.pickup_time ? " · " + esc(o.pickup_time === "ASAP" ? t("asap") : o.pickup_time) : ""}</span>`;
    return `<span class="chip delivery">${t("delivery")}</span>`;
  }

  const CLIP = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5Z"/></svg>';

  // ---------- payment slip viewer ----------
  let slipOrderId = null;
  async function openSlip(id) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    slipOrderId = id;
    const dlg = $("#slipDialog");
    $("#slipTitle").textContent = `${t("slipTitle")} · ${o.code}`;
    $("#slipBody").innerHTML = `<div class="slip-amount"><span>${t("total")}</span><strong>${money(o.total)}</strong></div>
      <p class="slip-who">${esc(o.customer_name || "")} ${o.phone ? "· " + esc(o.phone) : ""} · ${clock(o.created_at)}</p>
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
    $("#slipFoot").innerHTML = `<button class="btn btn-line btn-grow" type="button" data-close>${t("back")}</button>`;
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
        <time title="${new Date(o.created_at).toLocaleString()}">${clock(o.created_at)} · ${since(o.created_at)}</time>
      </header>
      <div class="meta">${typeChip(o)}</div>
      <div class="who">
        <strong>${esc(o.customer_name)}</strong>
        ${o.phone ? `<a href="tel:${esc(o.phone.replace(/[^\d+]/g, ""))}" class="tel">${esc(o.phone)}</a>` : ""}
        ${o.address ? `<p class="addr">${esc(o.address)} ${map ? `<a href="${esc(map)}" target="_blank" rel="noopener">Map ↗</a>` : ""}</p>` : ""}
      </div>
      <ul class="items">${(o.items || []).map((i) => `<li><b>${i.qty}×</b><div><span>${esc(i.name)}</span>${(i.details || []).map((d) => `<small>${esc(d)}</small>`).join("")}</div><em>${money(i.line_total)}</em></li>`).join("")}</ul>
      ${o.note ? `<p class="onote">“${esc(o.note)}”</p>` : ""}
      ${o.status === "out_for_delivery" ? `<p class="delivery-progress"><strong>${esc(o.delivery_provider || t("deliveryProvider"))}</strong>${o.delivery_started_at ? `<small>${new Date(o.delivery_started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>` : ""}</p>` : ""}
      ${o.order_type === "delivery" && o.delivery_fee != null ? `<div class="ofee"><span>${t("subtotal")} ${money(o.subtotal)}</span><span>+ ${t("deliveryFee")} ${money(o.delivery_fee)}</span></div>` : ""}
      <div class="ototal"><span>${t("total")}${o.order_type === "delivery" && o.delivery_fee == null ? ` <small>(+ ${t("deliveryFee")})</small>` : ""}</span><strong>${money(o.total)}</strong></div>
      <footer>
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
      <p class="big">${esc(o.code)}${o.source === "pos" ? " · POS" : ""}</p>
      <p>${new Date(o.created_at).toLocaleString()}</p>
      ${o.customer_name ? `<p>${esc(o.customer_name)} ${esc(o.phone || "")}</p>` : ""}
      ${o.address ? `<p>${esc(o.address)}</p>` : ""}
      <hr/>
      ${(o.items || []).map((i) => `<div class="row item"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.line_total)}</span></div>${(i.details || []).map((d) => `<div class="det">${esc(d)}</div>`).join("")}`).join("")}
      <hr/>
      ${o.note ? `<p class="note">NOTE: ${esc(o.note)}</p><hr/>` : ""}
      <div class="row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${o.order_type === "delivery" ? `<div class="row"><span>Delivery</span><span>${o.delivery_fee == null ? "-" : money(o.delivery_fee)}</span></div>` : ""}
      <div class="row big"><span>TOTAL</span><span>${money(o.total)}</span></div>
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
    const u = new URL("index.html", location.href);
    u.searchParams.set("table", n);
    return u.toString();
  }
  function genQR() {
    const n = Math.max(1, Math.min(60, Number($("#tableCount").value) || 1));
    const grid = $("#qrGrid");
    grid.innerHTML = "";
    if (!window.qrcode) { grid.textContent = "QR library could not load."; return; }
    for (let i = 1; i <= n; i++) {
      const card = document.createElement("div");
      card.className = "qr-card";
      card.innerHTML = `<div class="qr-head"><img src="images/brand/logo-mark.png" alt="" /><strong>MAHA DUCK</strong></div><div class="qr"></div><p class="qr-t">TABLE <b>${i}</b></p><p class="qr-s">Scan to order · สแกนเพื่อสั่ง · Scan ဖတ်ပြီးမှာပါ</p>`;
      grid.appendChild(card);
      const qr = window.qrcode(0, "M");
      qr.addData(menuUrl(i));
      qr.make();
      $(".qr", card).innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }).replace("<svg ", '<svg style="width:170px;height:170px" ').replace(/fill="black"/g, 'fill="#0c3a20"');
    }
  }
  function printQR() {
    if (!$("#qrGrid").children.length) genQR();
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
    state.settings = await api.getSettings();
    $("#noticeInput").value = state.settings.notice || "";
    applyLang();
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
    if (d.filter) { state.filter = d.filter; return render(); }
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
    if (el.closest("#slipDialog")) {
      if ("close" in d) { slipOrderId = null; return $("#slipDialog").close(); }
    }
    if (d.view) {
      state.view = d.view;
      const url = new URL(location.href);
      url.searchParams.set("view", d.view);
      history.replaceState({}, "", url);
      syncViewUI();
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
  $("#acceptToggle").addEventListener("change", async (e) => {
    const on = e.target.checked;
    state.settings.accepting_orders = on;
    renderTop();
    try { await api.saveSettings({ accepting_orders: on }); toast(t("saved")); }
    catch (er) { state.settings.accepting_orders = !on; renderTop(); toast(er.message); }
  });
  $("#rangeSel").addEventListener("change", (e) => { state.range = e.target.value; state.known = null; load(); });
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
