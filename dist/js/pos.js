/* =========================================================================
   MAHA DUCK — in-shop POS (walk-in orders, weighed bowls, cash / PromptPay)
   ========================================================================= */
(function () {
  const CFG = window.MAHA_CONFIG;
  const MENU = window.MAHA_MENU;
  const api = window.MahaAPI;
  const A = window.MahaAdmin;
  const { t, toast, money, esc } = A;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const styles = MENU.bowl.styles;
  const styleById = Object.fromEntries(styles.map((s) => [s.id, s]));
  const items = {};
  MENU.sections.forEach((sec) => sec.items.forEach((it) => (items[it.id] = it)));
  const rate = MENU.bowl.pricePer100g;

  const SET = MENU.malaSet || null;
  const BOWL_ON = Boolean(MENU.bowl && MENU.bowl.enabled !== false);
  const setItem = {};
  const setItemGroup = {};
  if (SET) SET.groups.forEach((g) => g.items.forEach((i) => { setItem[i.id] = i; setItemGroup[i.id] = g.id; }));
  const setPickKind = (id) => (["veg", "tofu"].includes(setItemGroup[id]) ? "veg" : "meat");
  const setQuota = (z, kind) => z[`${kind}Pick`] || z.pick;

  const sale = { lines: [], type: "dinein", table: "", name: "", cat: BOWL_ON ? "bowl" : MENU.sections[0].id };
  let dlg = null; // current dialog state

  // ---------- menu ----------
  function cats() {
    return [...(BOWL_ON ? [{ id: "bowl", label: t("secBowl") }] : []), ...MENU.sections.map((s) => ({ id: s.id, label: s.title[A.lang()] || s.title.en }))];
  }
  function renderMenu() {
    $("#posCats").innerHTML = cats().map((c) => `<button type="button" role="tab" aria-selected="${sale.cat === c.id}" data-pcat="${c.id}">${esc(c.label)}</button>`).join("");
    let tiles;
    if (sale.cat === "bowl") {
      tiles = MENU.bowl.dishes.map((d) => `<button type="button" class="pos-tile big" data-pbowl="${d.id}">
        <img src="${d.img}" alt="" /><strong>${esc(d.name)}</strong><small>${t("weighBowl")} · ${money(rate.meat)}/100g</small></button>`);
    } else {
      const sec = MENU.sections.find((s) => s.id === sale.cat);
      tiles = sec.items.map((it) => `<button type="button" class="pos-tile" data-pitem="${it.id}" ${it.price == null ? "disabled" : ""}>
        ${it.img ? `<img src="${it.img}" alt="" />` : `<span class="pos-ph"><img src="images/brand/logo-mark.png?v=2026-10-06-logo" alt="" /></span>`}
        <strong>${esc(it.name)}</strong><small>${esc(it.th || "")}</small><b>${it.price == null ? "—" : it.set && SET ? SET.sizes.map((z) => `${z.id} ${money(z.price)}`).join(" · ") : it.meats ? [...new Set(it.meats.map((m) => m.price))].map(money).join(" / ") : money(it.price)}</b></button>`);
    }
    $("#posGrid").innerHTML = tiles.join("");
  }

  // ---------- ticket ----------
  const total = () => sale.lines.reduce((n, l) => n + l.unit * l.qty, 0);
  function renderTicket() {
    $("#posType").innerHTML = [["dinein", t("dinein")], ["pickup", t("takeaway")]]
      .map(([v, l]) => `<button type="button" role="radio" aria-checked="${sale.type === v}" data-ptype="${v}">${esc(l)}</button>`).join("");
    const tb = $("#posTable");
    tb.hidden = sale.type !== "dinein";
    tb.placeholder = t("table");
    $("#posName").placeholder = t("customerOpt");
    $("#posLines").innerHTML = sale.lines.length
      ? sale.lines.map((l, i) => `<div class="pos-line">
          <div><strong>${esc(l.name)}</strong>${l.details.map((d) => `<small>${esc(d)}</small>`).join("")}</div>
          <div class="pos-qty"><button type="button" data-pq="${i}" data-d="-1" aria-label="−">−</button><span>${l.qty}</span><button type="button" data-pq="${i}" data-d="1" aria-label="+">+</button></div>
          <b>${money(l.unit * l.qty)}</b></div>`).join("")
      : `<p class="pos-empty">${t("posEmpty")}</p>`;
    $("#posTotal").textContent = money(total());
    const empty = !sale.lines.length;
    ["#posCash", "#posPP", "#posLater"].forEach((id) => ($(id).disabled = empty));
    $("#posCash").textContent = `${t("cash")} · ${money(total())}`;
  }

  function addLine(line) {
    const same = sale.lines.find((l) => l.key === line.key);
    if (same) same.qty += line.qty; else sale.lines.push(line);
    renderTicket();
  }

  // ---------- dialog helpers ----------
  function openDlg(title, body, foot) {
    $("#posDlgTitle").textContent = title;
    $("#posDlgBody").innerHTML = body;
    $("#posDlgFoot").innerHTML = foot;
    const d = $("#posDialog");
    if (!d.open) d.showModal();
  }
  const closeDlg = () => { dlg = null; $("#posDialog").close(); };
  const chips = (name, list, cur) => `<div class="pos-chips" role="radiogroup">${list.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(cur) === String(v)}" data-${name}="${v}">${esc(l)}</button>`).join("")}</div>`;
  const spiceList = (withNone) => [...(withNone ? [[0, "0 Not spicy"]] : []), ...MENU.spicy.map((s) => [s.level, `${s.level} ${s.name}`])];

  // Weighed bowl
  function bowlDialog() {
    const st = styles.filter((s) => s.dish === dlg.dish);
    const price = Math.round(((dlg.meat || 0) * rate.meat + (dlg.veg || 0) * rate.veg) / 100);
    openDlg(MENU.bowl.dishes.find((d) => d.id === dlg.dish).name + " · " + t("weighBowl"), `
      <h3 class="step-title" style="margin-top:0">${t("chooseBroth")}</h3>
      ${chips("dstyle", st.map((s) => [s.id, `${s.id} ${s.name}`]), dlg.style)}
      <div class="pos-weights">
        <label class="field"><span>${t("meatG")}</span><input id="wMeat" type="number" inputmode="numeric" min="0" step="10" value="${dlg.meat || ""}" placeholder="0" /></label>
        <label class="field"><span>${t("vegG")}</span><input id="wVeg" type="number" inputmode="numeric" min="0" step="10" value="${dlg.veg || ""}" placeholder="0" /></label>
      </div>
      <h3 class="step-title">${t("spicyLevel")}</h3>${chips("dspicy", spiceList(false), dlg.spicy)}
      <h3 class="step-title">${t("malaLevel")}</h3>${chips("dmala", [1, 2, 3, 4, 5].map((n) => [n, n]), dlg.mala)}
      <label class="field" style="margin-top:14px"><span>${t("noteLabel")}</span><input id="dNote" maxlength="120" value="${esc(dlg.note || "")}" /></label>`,
      `<div class="pos-dlg-price" id="bowlPrice">${money(price)}</div><button type="button" class="btn btn-red btn-grow" id="dlgAdd" ${price ? "" : "disabled"}>${t("addToOrder")}</button>`);
    const upd = () => {
      dlg.meat = Number($("#wMeat").value) || 0; dlg.veg = Number($("#wVeg").value) || 0;
      const p = Math.round((dlg.meat * rate.meat + dlg.veg * rate.veg) / 100);
      $("#bowlPrice").textContent = money(p); $("#dlgAdd").disabled = !p;
    };
    $("#wMeat").addEventListener("input", upd); $("#wVeg").addEventListener("input", upd);
  }
  function commitBowl() {
    const d = MENU.bowl.dishes.find((x) => x.id === dlg.dish);
    const st = styleById[dlg.style];
    const price = Math.round((dlg.meat * rate.meat + dlg.veg * rate.veg) / 100);
    const sp = MENU.spicy.find((s) => s.level === dlg.spicy);
    const details = [`${st.id} ${st.name}`, `Meat ${dlg.meat}g · Veg ${dlg.veg}g`, `Spicy ${dlg.spicy} (${sp ? sp.name : "-"}) · Mala ${dlg.mala}`];
    if (dlg.note) details.push(`“${dlg.note}”`);
    addLine({ key: "bowl" + Date.now(), name: d.name, unit: price, qty: 1, details });
    closeDlg();
  }

  // Maha Mala Duck set (Small / Medium / Big)
  const ADDONS_ON = Boolean(SET && SET.addOns !== false);
  const canAddOn = (id) => ADDONS_ON && setItem[id] && typeof setItem[id].price === "number";
  const addonTotal = () => (dlg.addons || []).reduce((n, id) => n + (setItem[id].price || 0), 0);
  const setPickTotal = () => (dlg.meatPicks || []).length + (dlg.vegPicks || []).length;
  const setLeft = (z) => Math.max(0, setQuota(z, "meat") - dlg.meatPicks.length) + Math.max(0, setQuota(z, "veg") - dlg.vegPicks.length);
  function syncSetBuckets() {
    const seen = new Set();
    const meat = [];
    const veg = [];
    [...(dlg.meatPicks || []), ...(dlg.vegPicks || []), ...(dlg.picks || [])].forEach((id) => {
      if (!setItem[id] || seen.has(id)) return;
      seen.add(id);
      (setPickKind(id) === "veg" ? veg : meat).push(id);
    });
    dlg.meatPicks = meat;
    dlg.vegPicks = veg;
    dlg.picks = [...meat, ...veg];
  }
  function normalizeSet(z) {
    syncSetBuckets();
    const meatQuota = setQuota(z, "meat");
    const vegQuota = setQuota(z, "veg");
    if (dlg.meatPicks.length > meatQuota) dlg.meatPicks.length = meatQuota;
    if (dlg.vegPicks.length > vegQuota) dlg.vegPicks.length = vegQuota;
    const picked = new Set([...dlg.meatPicks, ...dlg.vegPicks]);
    dlg.addons = (dlg.addons || []).filter((id) => canAddOn(id) && !picked.has(id));
    const fillFreeSlots = (kind, bucket, quota) => {
      while (bucket.length < quota) {
        const candidates = dlg.addons.filter((id) => setPickKind(id) === kind);
        if (!candidates.length) break;
        const best = candidates.reduce((x, y) => (setItem[y].price > setItem[x].price ? y : x));
        dlg.addons.splice(dlg.addons.indexOf(best), 1);
        bucket.push(best);
      }
    };
    fillFreeSlots("meat", dlg.meatPicks, meatQuota);
    fillFreeSlots("veg", dlg.vegPicks, vegQuota);
    dlg.picks = [...dlg.meatPicks, ...dlg.vegPicks];
  }
  function setDialog() {
    const z = SET.sizes.find((x) => x.id === dlg.size);
    normalizeSet(z);
    const meatQuota = setQuota(z, "meat");
    const vegQuota = setQuota(z, "veg");
    const meatLeft = meatQuota - dlg.meatPicks.length;
    const vegLeft = vegQuota - dlg.vegPicks.length;
    const left = setLeft(z);
    const total = z.price + addonTotal();
    const chip = (i) => {
      const kind = setPickKind(i.id);
      const bucket = kind === "veg" ? dlg.vegPicks : dlg.meatPicks;
      const kindLeft = kind === "veg" ? vegLeft : meatLeft;
      const on = bucket.includes(i.id), add = dlg.addons.includes(i.id);
      const offer = !on && !add && !left && canAddOn(i.id);
      const photo = i.img ? `<img src="${i.img}" alt="" />` : "";
      return `<button type="button" class="${i.img ? "has-img" : ""} ${add ? "addon" : offer ? "offer" : ""}" aria-checked="${on}" data-dpick="${i.id}" ${!on && !add && kindLeft <= 0 && !offer ? "disabled" : ""}>${photo}<span>${esc(i.name)}${add || offer ? ` <small>+${money(i.price)}</small>` : ""}</span></button>`;
    };
    openDlg(`${items[SET.itemId].name} · ${setPickTotal()}/${z.pick * 2}${dlg.addons.length ? ` + ${t("addOn")} ${dlg.addons.length}` : ""}`, `
      ${chips("dsize", SET.sizes.map((x) => [x.id, `${x.name} ${money(x.price)} · ${x.pick}+${x.pick}`]), dlg.size)}
      <p class="hint" style="margin:12px 0 0"><b>${t("meatShort")} ${dlg.meatPicks.length}/${meatQuota} · ${t("vegShort")} ${dlg.vegPicks.length}/${vegQuota}</b></p>
      ${!left && ADDONS_ON ? `<p class="hint" style="margin:12px 0 0">${t("addOnHint")}</p>` : ""}
      ${SET.groups.map((g) => `<h3 class="step-title pos-grp">${esc(g.name)} <small>${esc(g.th)}</small></h3>
        <div class="pos-chips">${g.items.map(chip).join("")}</div>`).join("")}
      <h3 class="step-title">${t("chooseTaste")}</h3>${chips("dtaste", SET.tastes.map((x) => [x.id, `${x.id} ${x.name}`]), dlg.taste)}
      ${SET.askSpicy ? `<h3 class="step-title">${t("spicyLevel")}</h3>${chips("dspicy", spiceList(true), dlg.spicy)}<h3 class="step-title">${t("malaLevel")}</h3>${chips("dmala", [1, 2, 3, 4, 5].map((n) => [n, n]), dlg.mala)}` : ""}
      <label class="field" style="margin-top:14px"><span>${t("noteLabel")}</span><input id="dNote" maxlength="120" value="${esc(dlg.note || "")}" /></label>`,
      `<div class="pos-dlg-price">${money(total)}</div><button type="button" class="btn btn-red btn-grow" id="dlgAdd" ${left ? "disabled" : ""}>${left ? t("pickMore").replace("{n}", left) : t("addToOrder")}</button>`);
  }
  function commitSet() {
    const it = items[SET.itemId];
    const z = SET.sizes.find((x) => x.id === dlg.size);
    const ta = SET.tastes.find((x) => x.id === dlg.taste);
    const sp = MENU.spicy.find((s) => s.level === dlg.spicy);
    const details = [`Meat: ${dlg.meatPicks.map((id) => setItem[id].name).join(", ")}`, `Vegetables: ${dlg.vegPicks.map((id) => setItem[id].name).join(", ")}`];
    if (dlg.addons.length) details.push("Add-on: " + dlg.addons.map((id) => setItem[id].name).join(", "));
    details.push(`Taste ${ta.id}: ${ta.name}`);
    if (SET.askSpicy) details.push(`Spicy ${dlg.spicy} (${sp ? sp.name : "not spicy"}) · Mala ${dlg.mala}`);
    if (dlg.note) details.push(`“${dlg.note}”`);
    addLine({ key: "set|" + z.id + "|" + details.join("|"), name: `${it.name} · ${z.name}`, unit: z.price + addonTotal(), qty: 1, details, inventoryIds: [...dlg.meatPicks, ...dlg.vegPicks, ...dlg.addons] });
    closeDlg();
  }

  // Item with options (meat / soup / spicy and mala level)
  const meatOf = (it) => (it.meats ? it.meats.find((m) => m.id === dlg.meat) || it.meats[0] : null);
  function itemDialog() {
    const it = items[dlg.id];
    const meat = meatOf(it);
    const unit = meat ? meat.price : it.price;
    const parts = [];
    if (it.meats) parts.push(`<h3 class="step-title">${t("chooseMeat")}</h3>${chips("dmeat", it.meats.map((m) => [m.id, `${m.name} ${money(m.price)}`]), meat.id)}`);
    if (it.soups) parts.push(`<h3 class="step-title">${t("chooseSoup")}</h3>${chips("dsoup", it.soups.map((x) => [x.id, x.name]), dlg.soup)}`);
    if (it.spicy) parts.push(`<h3 class="step-title">${t("spicyLevel")}</h3>${chips("dspicy", spiceList(true), dlg.spicy)}<h3 class="step-title">${t("malaLevel")}</h3>${chips("dmala", [1, 2, 3, 4, 5].map((n) => [n, n]), dlg.mala)}`);
    openDlg(it.name, parts.join("").replace('class="step-title"', 'class="step-title" style="margin-top:0"') +
      `<label class="field" style="margin-top:14px"><span>${t("noteLabel")}</span><input id="dNote" maxlength="120" value="${esc(dlg.note || "")}" /></label>`,
      `<div class="pos-dlg-price">${money(unit)}</div><button type="button" class="btn btn-red btn-grow" id="dlgAdd">${t("addToOrder")}</button>`);
  }
  function commitItem() {
    const it = items[dlg.id];
    const meat = meatOf(it);
    const sp = MENU.spicy.find((s) => s.level === dlg.spicy);
    const details = [];
    if (it.soups) details.push(`Soup: ${(it.soups.find((x) => x.id === dlg.soup) || it.soups[0]).name}`);
    if (it.spicy) details.push(`Spicy ${dlg.spicy}${sp ? " (" + sp.name + ")" : " (not spicy)"} · Mala ${dlg.mala}`);
    if (dlg.note) details.push(`“${dlg.note}”`);
    const name = meat ? (it.base ? `${it.base} ${meat.name}` : `${it.name} · ${meat.name}`) : it.name;
    addLine({ key: it.id + "|" + name + "|" + details.join("|"), name, unit: meat ? meat.price : it.price, qty: 1, details });
    closeDlg();
  }

  // ---------- payment ----------
  function payDialog(method) {
    const tot = total();
    if (method === "cash") {
      const quick = [...new Set([tot, Math.ceil(tot / 100) * 100, Math.ceil(tot / 500) * 500, 1000].filter((v) => v >= tot))].slice(0, 4);
      openDlg(`${t("cash")} · ${money(tot)}`, `
        <div class="pos-due">${money(tot)}</div>
        <label class="field"><span>${t("cashReceived")}</span><input id="cashIn" type="number" inputmode="numeric" min="0" value="${tot}" /></label>
        <div class="pos-chips">${quick.map((v) => `<button type="button" data-cashq="${v}">${v === tot ? t("exact") : money(v)}</button>`).join("")}</div>
        <div class="pos-change"><span>${t("change")}</span><strong id="cashChange">${money(0)}</strong></div>`,
        `<button type="button" class="btn btn-green btn-grow btn-lg" id="payConfirm">${t("charge")} · ${money(tot)}</button>`);
      const upd = () => {
        const v = Number($("#cashIn").value) || 0;
        const ch = v - tot;
        $("#cashChange").textContent = ch >= 0 ? money(ch) : t("notEnough");
        $("#cashChange").classList.toggle("neg", ch < 0);
        $("#payConfirm").disabled = ch < 0;
      };
      $("#cashIn").addEventListener("input", upd);
      upd();
      dlg = { kind: "pay", method };
      return;
    }
    // PromptPay
    const data = CFG.promptpayId ? window.PromptPay.payload(CFG.promptpayId, tot) : "";
    openDlg(`PromptPay · ${money(tot)}`, data
      ? `<div class="pos-qr-wrap"><p>${t("scanToPay")}</p><div class="pay-qr big">${window.PromptPay.svg(data)}</div><div class="pay-amount">${money(tot)}</div>${CFG.promptpayName ? `<p>${esc(CFG.promptpayName)}</p>` : ""}</div>`
      : `<p class="pos-empty">${t("noPromptpay")}</p>`,
      `<button type="button" class="btn btn-green btn-grow btn-lg" id="payConfirm">✓ ${t("confirmReceived")}</button>`);
    dlg = { kind: "pay", method };
  }

  async function finish(method, paid) {
    const tot = total();
    const cash = method === "cash" && paid ? Number($("#cashIn").value) || tot : null;
    const order = {
      order_type: sale.type,
      table_no: sale.type === "dinein" ? ($("#posTable").value.trim() || null) : null,
      customer_name: $("#posName").value.trim() || t("walkIn"),
      payment: method,
      payment_status: paid ? "paid" : "unpaid",
      cash_received: cash,
      items: sale.lines.map((l) => ({ name: l.name, qty: l.qty, unit_price: l.unit, line_total: l.unit * l.qty, details: l.details, inventory_ids: l.inventoryIds || [] })),
      subtotal: tot, delivery_fee: null, total: tot, status: "preparing", lang: A.lang(),
    };
    const btn = $("#payConfirm") || $("#posLater");
    if (btn) btn.disabled = true;
    try {
      const saved = await api.createStaffOrder(order);
      const full = { ...order, ...saved, source: "pos" };
      sale.lines = []; $("#posName").value = ""; $("#posTable").value = "";
      renderTicket();
      A.reload();
      if (A.autoPrint()) A.printOrder(full);
      dlg = { kind: "done", order: full };
      openDlg(t("saleDone"), `<div class="success"><img src="images/mascot/duck-3.webp" alt="" />
          <div class="code-box">${esc(full.code)}</div>
          <p><strong>${money(full.total)}</strong> · ${esc(t(method))} · ${paid ? t("pay_paid") : t("pay_unpaid")}</p>
          ${cash != null ? `<div class="pos-change"><span>${t("change")}</span><strong>${money(cash - full.total)}</strong></div>` : ""}</div>`,
        `<button type="button" class="btn btn-line" id="donePrint">${t("printReceipt")}</button><button type="button" class="btn btn-red btn-grow" data-close>${t("posNew")}</button>`);
    } catch (e) {
      toast(e.message || t("errSend"));
      if (btn) btn.disabled = false;
    }
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el || !el.closest("#posView, #posDialog")) return;
    const d = el.dataset;
    if (d.pcat) { sale.cat = d.pcat; return renderMenu(); }
    if (d.pbowl) { dlg = { kind: "bowl", dish: d.pbowl, style: styles.find((s) => s.dish === d.pbowl).id, meat: 0, veg: 0, spicy: 2, mala: 2, note: "" }; return bowlDialog(); }
    if (d.pitem) {
      const it = items[d.pitem];
      if (it.set && SET) { dlg = { kind: "set", size: "S", meatPicks: [], vegPicks: [], picks: [], addons: [], taste: 1, spicy: 2, mala: 2, note: "" }; return setDialog(); }
      if (it.meats || it.soups || it.spicy) { dlg = { kind: "item", id: it.id, meat: it.meats ? it.meats[0].id : "", soup: it.soups ? it.soups[0].id : "", spicy: 2, mala: 2, note: "" }; return itemDialog(); }
      return addLine({ key: it.id, name: it.name, unit: it.price, qty: 1, details: [] });
    }
    if (d.ptype) { sale.type = d.ptype; return renderTicket(); }
    if (d.pq != null) {
      const l = sale.lines[Number(d.pq)];
      l.qty += Number(d.d);
      if (l.qty <= 0) sale.lines.splice(Number(d.pq), 1);
      return renderTicket();
    }
    if (el.id === "posClear") { sale.lines = []; return renderTicket(); }
    if (el.id === "posCash") return payDialog("cash");
    if (el.id === "posPP") return payDialog("promptpay");
    if (el.id === "posLater") return finish("cash", false);

    // dialog
    if ("close" in d && el.closest("#posDialog")) return closeDlg();
    const keep = () => { if (dlg && $("#dNote")) dlg.note = $("#dNote").value; if (dlg && $("#wMeat")) { dlg.meat = Number($("#wMeat").value) || 0; dlg.veg = Number($("#wVeg").value) || 0; } };
    const redraw = () => {
      const y = $("#posDlgBody").scrollTop;
      if (dlg.kind === "set") setDialog(); else if (dlg.kind === "bowl") bowlDialog(); else itemDialog();
      $("#posDlgBody").scrollTop = y;
    };
    if (d.dsize) { keep(); dlg.size = d.dsize; return redraw(); }
    if (d.dpick) {
      keep();
      const z = SET.sizes.find((x) => x.id === dlg.size);
      normalizeSet(z);
      const kind = setPickKind(d.dpick);
      const bucket = kind === "veg" ? dlg.vegPicks : dlg.meatPicks;
      const i = bucket.indexOf(d.dpick), j = dlg.addons.indexOf(d.dpick);
      if (i >= 0) bucket.splice(i, 1);
      else if (j >= 0) dlg.addons.splice(j, 1);
      else if (bucket.length < setQuota(z, kind)) bucket.push(d.dpick);
      else if (!setLeft(z) && canAddOn(d.dpick)) dlg.addons.push(d.dpick);
      return redraw();
    }
    if (d.dmeat) { keep(); dlg.meat = d.dmeat; return redraw(); }
    if (d.dsoup) { keep(); dlg.soup = d.dsoup; return redraw(); }
    if (d.dtaste) { keep(); dlg.taste = Number(d.dtaste); return redraw(); }
    if (d.dstyle) { keep(); dlg.style = d.dstyle; return redraw(); }
    if (d.dspicy != null) { keep(); dlg.spicy = Number(d.dspicy); return redraw(); }
    if (d.dmala) { keep(); dlg.mala = Number(d.dmala); return redraw(); }
    if (el.id === "dlgAdd") { keep(); return dlg.kind === "set" ? commitSet() : dlg.kind === "bowl" ? commitBowl() : commitItem(); }
    if (d.cashq) { $("#cashIn").value = d.cashq; $("#cashIn").dispatchEvent(new Event("input")); return; }
    if (el.id === "payConfirm") return finish(dlg.method, true);
    if (el.id === "donePrint") return A.printOrder(dlg.order);
  });
  $("#posDialog").addEventListener("click", (e) => { if (e.target.id === "posDialog") closeDlg(); });

  window.MahaPOS = {
    open() { renderMenu(); renderTicket(); },
  };
})();
