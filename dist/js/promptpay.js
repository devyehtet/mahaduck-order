/* PromptPay (Thai QR Payment / EMVCo) payload generator — works with every Thai banking app. */
(function (root) {
  const f = (id, value) => id + String(value.length).padStart(2, "0") + value;

  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  /** id: mobile (08x…), 13-digit national/tax ID, or 15-digit e-wallet ID. amount optional. */
  function payload(id, amount) {
    const digits = String(id || "").replace(/\D/g, "");
    if (!digits) return "";
    let target;
    if (digits.length >= 15) target = f("03", digits);
    else if (digits.length >= 13) target = f("02", digits);
    else target = f("01", ("0000000000000" + digits.replace(/^0/, "66")).slice(-13));
    const hasAmount = typeof amount === "number" && amount > 0;
    const data = [
      f("00", "01"),
      f("01", hasAmount ? "12" : "11"),
      f("29", f("00", "A000000677010111") + target),
      f("53", "764"),
      hasAmount ? f("54", amount.toFixed(2)) : "",
      f("58", "TH"),
    ].join("") + "6304";
    return data + crc16(data);
  }

  /** Returns an SVG string (needs vendor/qrcode.js loaded). */
  function svg(text, color) {
    if (!root.qrcode || !text) return "";
    const qr = root.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true }).replace(/fill="black"/g, `fill="${color || "#0b2a4a"}"`);
  }

  /** PNG data URL (for "Save QR"). */
  function png(text, size = 600) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(c.toDataURL("image/png"));
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(text, "#000"));
    });
  }

  root.PromptPay = { payload, svg, png };
  if (typeof module !== "undefined") module.exports = { payload };
})(typeof window !== "undefined" ? window : globalThis);
