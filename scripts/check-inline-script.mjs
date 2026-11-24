import fs from "node:fs";
import { spawnSync } from "node:child_process";

const html = fs.readFileSync("index.html", "utf8");
const openTag = '<script type="module">';
const start = html.indexOf(openTag);
const end = html.lastIndexOf("</script>");

if (start < 0 || end <= start) {
  throw new Error("Could not locate the inline module script in index.html.");
}

const source = html.slice(start + openTag.length, end);
const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {
  input: source,
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "Inline module syntax check failed.\n");
  process.exit(result.status || 1);
}

console.log("Inline browser module syntax OK.");
