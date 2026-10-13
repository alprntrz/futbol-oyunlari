// Lets node scripts import the shared TypeScript in src/ that uses the "@/…"
// alias (tsconfig paths): `node --import ./scripts/lib/alias.mjs script.mts`.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
const ROOT = ${JSON.stringify(process.cwd() + "/src/")};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const base = ROOT + spec.slice(2);
    const file = [base + ".ts", base + ".tsx", base + "/index.ts", base].find((f) => existsSync(f));
    return next(pathToFileURL(file).href, ctx);
  }
  if (spec.startsWith(".") && !/\\.[cm]?[jt]sx?$/.test(spec) && ctx.parentURL?.includes("/src/")) {
    const url = new URL(spec, ctx.parentURL);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(url.pathname + ext)) return next(url.href + ext, ctx);
    }
  }
  return next(spec, ctx);
}`)
);
