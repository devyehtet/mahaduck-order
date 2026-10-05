import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

function jsString(value) {
  return JSON.stringify(String(value || ""));
}

export async function GET() {
  const source = await readFile(join(process.cwd(), "dist", "settings", "config.js"), "utf8");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  const staffEmail = process.env.NEXT_PUBLIC_STAFF_EMAIL || process.env.STAFF_EMAIL || "";
  const override = `
;(() => {
  window.MAHA_CONFIG = window.MAHA_CONFIG || {};
  const env = {
    supabaseUrl: ${jsString(supabaseUrl)},
    supabaseAnonKey: ${jsString(supabaseAnonKey)},
    staffEmail: ${jsString(staffEmail)}
  };
  for (const [key, value] of Object.entries({ supabaseUrl: env.supabaseUrl, supabaseAnonKey: env.supabaseAnonKey })) {
    if (value) window.MAHA_CONFIG[key] = value;
  }
  if (env.staffEmail) {
    window.MAHA_CONFIG.staffLogin = { ...(window.MAHA_CONFIG.staffLogin || {}), email: env.staffEmail };
  }
})();
`;

  return new Response(source + override, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
