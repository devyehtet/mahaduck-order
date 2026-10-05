/* Maha Duck — data layer. Uses Supabase when configured, otherwise browser-only demo mode. */
(function () {
  const cfg = window.MAHA_CONFIG || {};
  const base = (cfg.supabaseUrl || "").replace(/\/+$/, "");
  const key = cfg.supabaseAnonKey || "";
  const live = Boolean(base && key);
  const authParams = location.hash && new URLSearchParams(location.hash.slice(1));
  if (live && authParams && !location.pathname.startsWith("/admin") && (authParams.has("access_token") || authParams.has("error"))) {
    location.replace("/admin" + location.search + location.hash);
    return;
  }
  const DEMO_ORDERS = "mahaduck-demo-orders";
  const DEMO_SETTINGS = "mahaduck-demo-settings";
  const DEMO_SLIPS = "mahaduck-demo-slips";
  const SESSION = "mahaduck-staff-session";
  let serverDemo = null;

  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  function makeCode() {
    const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    const r = crypto.getRandomValues(new Uint8Array(5));
    r.forEach((n) => (s += abc[n % abc.length]));
    return "MD-" + s;
  }

  async function rest(path, { method = "GET", body, token, prefer } = {}) {
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error_description || data.msg)) || `HTTP ${res.status}`);
      err.status = res.status; err.code = data && data.code;
      throw err;
    }
    return data;
  }

  async function demoRest(path, { method = "GET", body } = {}) {
    const res = await fetch("/api/demo" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function demo(path, options, localFallback) {
    if (serverDemo === false || location.protocol === "file:") return localFallback();
    try {
      const data = await demoRest(path, options);
      serverDemo = true;
      return data;
    } catch (error) {
      const canFallback = serverDemo !== true && (error.status === 404 || error.status === 405 || error.name === "TypeError");
      if (!canFallback) throw error;
      serverDemo = false;
      return localFallback();
    }
  }

  function localCreateOrder(order, staff = false) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = staff
        ? { status: "preparing", payment_status: "unpaid", ...order, source: "pos", code: makeCode() }
        : { ...order, source: "online", payment_status: "unpaid", code: makeCode(), status: "new" };
      row.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      row.created_at = new Date().toISOString();
      const all = store.get(DEMO_ORDERS, []);
      if (all.some((x) => x.code === row.code)) continue;
      all.unshift(row);
      store.set(DEMO_ORDERS, all.slice(0, 300));
      return row;
    }
    throw new Error("Could not create order");
  }

  function localOrderStatus(code) {
    const o = store.get(DEMO_ORDERS, []).find((x) => x.code === code);
    return o ? { status: o.status, total: o.total, created_at: o.created_at, payment_status: o.payment_status || "unpaid", order_type: o.order_type, delivery_provider: o.delivery_provider || null, delivery_started_at: o.delivery_started_at || null } : null;
  }

  function localClaimPaid(code) {
    const all = store.get(DEMO_ORDERS, []);
    const o = all.find((x) => x.code === code);
    if (o && o.payment_status !== "paid") o.payment_status = "claimed";
    store.set(DEMO_ORDERS, all);
    return true;
  }

  function localAttachSlip(code, image) {
    const all = store.get(DEMO_ORDERS, []);
    const o = all.find((x) => x.code === code);
    if (!o || o.payment_status === "paid") return false;
    const slips = store.get(DEMO_SLIPS, {});
    slips[code] = image;
    const keep = Object.keys(slips).slice(-12);
    localStorage.setItem(DEMO_SLIPS, JSON.stringify(Object.fromEntries(keep.map((k) => [k, slips[k]]))));
    o.has_slip = true; o.payment_status = "claimed";
    store.set(DEMO_ORDERS, all);
    return true;
  }

  function localUpdateOrder(id, patch) {
    const all = store.get(DEMO_ORDERS, []);
    const o = all.find((x) => x.id === id);
    if (o) Object.assign(o, patch, { updated_at: new Date().toISOString() });
    store.set(DEMO_ORDERS, all);
  }

  // ---------- staff session ----------
  async function session() {
    const s = store.get(SESSION, null);
    if (!s) return null;
    if (Date.now() / 1000 < s.expires_at - 60) return s;
    try {
      const fresh = await rest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } });
      fresh.expires_at = Math.floor(Date.now() / 1000) + fresh.expires_in;
      store.set(SESSION, fresh);
      return fresh;
    } catch { store.del(SESSION); return null; }
  }
  async function token() {
    const s = await session();
    if (!s) { const e = new Error("Not signed in"); e.status = 401; throw e; }
    return s.access_token;
  }
  function decodeJwtPayload(jwt) {
    try {
      const part = String(jwt || "").split(".")[1];
      if (!part) return {};
      const text = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
      return JSON.parse(decodeURIComponent(escape(text)));
    } catch {
      return {};
    }
  }
  function persistSession(s) {
    const payload = decodeJwtPayload(s.access_token);
    s.expires_at = s.expires_at || Math.floor(Date.now() / 1000) + Number(s.expires_in || 3600);
    s.user = s.user || { email: payload.email || "" };
    store.set(SESSION, s);
    return s;
  }

  const api = {
    live,

    // Customer (online) order. Staff POS orders use createStaffOrder.
    async createOrder(order, staff = false) {
      if (!live) {
        return demo("/orders", { method: "POST", body: { order, staff } }, () => localCreateOrder(order, staff));
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        const row = staff
          ? { status: "preparing", payment_status: "unpaid", ...order, source: "pos", code: makeCode() }
          : { ...order, source: "online", payment_status: "unpaid", code: makeCode(), status: "new" };
        try {
          await rest("/rest/v1/orders", { method: "POST", body: row, prefer: "return=minimal", token: staff ? await token() : undefined });
          row.created_at = new Date().toISOString();
          return row;
        } catch (e) {
          if (e.code === "23505") continue; // duplicate code — try another
          throw e;
        }
      }
      throw new Error("Could not create order");
    },

    async orderStatus(code) {
      if (!live) {
        return demo(`/order-status?code=${encodeURIComponent(code)}`, {}, () => localOrderStatus(code));
      }
      const rows = await rest("/rest/v1/rpc/order_status", { method: "POST", body: { p_code: code } });
      return rows && rows[0] ? rows[0] : null;
    },

    async claimPaid(code) {
      if (!live) {
        return demo("/claim-paid", { method: "POST", body: { code } }, () => localClaimPaid(code));
      }
      return rest("/rest/v1/rpc/claim_paid", { method: "POST", body: { p_code: code } });
    },

    // Customer attaches a transfer slip (compressed JPEG data URL) → order becomes "claimed"
    async attachSlip(code, image) {
      if (!live) {
        return demo("/slips", { method: "POST", body: { code, image } }, () => localAttachSlip(code, image));
      }
      return rest("/rest/v1/rpc/attach_slip", { method: "POST", body: { p_code: code, p_image: image } });
    },

    // Staff: load the slip image for one order (null if none / expired)
    async getSlip(code) {
      if (!live) return demo(`/slips/${encodeURIComponent(code)}`, {}, () => store.get(DEMO_SLIPS, {})[code] || null);
      const rows = await rest(`/rest/v1/order_slips?code=eq.${encodeURIComponent(code)}&select=image`, { token: await token() });
      return rows && rows[0] ? rows[0].image : null;
    },

    async createStaffOrder(order) {
      return api.createOrder(order, true);
    },

    async getSettings() {
      if (!live) return demo("/settings", {}, () => store.get(DEMO_SETTINGS, { accepting_orders: true, notice: "" }));
      try {
        const rows = await rest("/rest/v1/settings?id=eq.1&select=accepting_orders,notice");
        return rows[0] || { accepting_orders: true, notice: "" };
      } catch { return { accepting_orders: true, notice: "" }; }
    },

    // ---------- staff ----------
    consumeAuthRedirect() {
      if (!live || !location.hash || location.hash.length < 2) return null;
      const params = new URLSearchParams(location.hash.slice(1));
      const cleanUrl = location.pathname + location.search;
      if (params.has("error")) {
        history.replaceState({}, "", cleanUrl);
        return {
          error: params.get("error_description") || params.get("error") || "Email link is invalid or has expired",
        };
      }
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return null;
      const s = persistSession({
        access_token,
        refresh_token,
        expires_in: Number(params.get("expires_in") || 3600),
        token_type: params.get("token_type") || "bearer",
      });
      history.replaceState({}, "", cleanUrl);
      return { type: params.get("type") || "", session: s };
    },
    async signIn(email, password) {
      const s = await rest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
      return persistSession(s);
    },
    async updatePassword(password) {
      await rest("/auth/v1/user", { method: "PUT", token: await token(), body: { password } });
    },
    signOut() { store.del(SESSION); },
    async isSignedIn() { return !live || Boolean(await session()); },
    async staffEmail() { const s = await session(); return s && s.user ? s.user.email : ""; },

    async listOrders(sinceISO) {
      if (!live) {
        const path = "/orders" + (sinceISO ? `?since=${encodeURIComponent(sinceISO)}` : "");
        return demo(path, {}, () => store.get(DEMO_ORDERS, []).filter((o) => !sinceISO || o.created_at >= sinceISO));
      }
      const q = `/rest/v1/orders?select=*&order=created_at.desc&limit=500` + (sinceISO ? `&created_at=gte.${encodeURIComponent(sinceISO)}` : "");
      return rest(q, { token: await token() });
    },

    async updateOrder(id, patch) {
      if (!live) {
        return demo(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }, () => localUpdateOrder(id, patch));
      }
      await rest(`/rest/v1/orders?id=eq.${id}`, { method: "PATCH", body: { ...patch, updated_at: new Date().toISOString() }, token: await token(), prefer: "return=minimal" });
    },

    async saveSettings(patch) {
      if (!live) {
        return demo("/settings", { method: "PATCH", body: patch }, () => {
          store.set(DEMO_SETTINGS, { ...store.get(DEMO_SETTINGS, { accepting_orders: true, notice: "" }), ...patch });
        });
      }
      await rest(`/rest/v1/settings?id=eq.1`, { method: "PATCH", body: patch, token: await token(), prefer: "return=minimal" });
    },

    store,
  };

  window.MahaAPI = api;
})();
