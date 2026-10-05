import { readFileSync } from "node:fs";
import { join } from "node:path";
import parseReact from "html-react-parser";
import { parse } from "node-html-parser";
import LegacyBootstrap from "./legacy-bootstrap";

export default function LegacyPage({ source, page }) {
  const file = join(process.cwd(), "dist", source);
  const document = parse(readFileSync(file, "utf8"));
  const body = document.querySelector("body");
  if (!body) throw new Error(`Missing body in ${source}`);

  body.querySelectorAll("script").forEach((script) => script.remove());
  body.querySelectorAll("[src]").forEach((element) => {
    const value = element.getAttribute("src");
    if (value && !/^(?:[a-z]+:|\/|#|data:)/i.test(value)) {
      element.setAttribute("src", `/legacy/${value.replace(/^\.\//, "")}`);
    }
  });
  body.querySelectorAll("a[href]").forEach((element) => {
    const value = element.getAttribute("href");
    if (value === "admin.html") element.setAttribute("href", "/admin");
    else if (value === "index.html") element.setAttribute("href", "/");
    else if (value?.startsWith("#")) element.setAttribute("href", `/${value}`);
  });

  return <LegacyBootstrap page={page}>{parseReact(body.innerHTML)}</LegacyBootstrap>;
}
