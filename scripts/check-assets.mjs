import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

if (html.includes("/src/assets/images/")) {
  throw new Error("Found stale Vite asset paths (/src/assets/images/).");
}

const refs = [...html.matchAll(/["'`](\.\/images\/[^"'`]+)["'`]/g)]
  .map((match) => match[1])
  .filter((ref) => /\.(?:jpe?g|png|webp|svg|glb|gltf)$/i.test(ref));
const missing = [...new Set(refs)].filter((ref) => !fs.existsSync(path.join(root, ref)));

if (missing.length) {
  throw new Error("Missing referenced assets:\n" + missing.join("\n"));
}

for (const file of ["package.json", "metadata.json"]) {
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

console.log(`Asset check passed: ${new Set(refs).size} referenced files exist.`);
