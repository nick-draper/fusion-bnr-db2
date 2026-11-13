// Write the README figures to docs/images/ in the locked style (IBM Carbon, Outline, IBM Plex):
//   <name>-light.svg, <name>-dark.svg   colours written in, no CSS variables
//   <name>-light.png, <name>-dark.png   2x raster with IBM Plex drawn in
//   <name>.svg                          follows the viewer's colour scheme
//
// Usage, from docs/images/src:
//   npm ci --ignore-scripts
//   npm run export
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { Resvg } = require("@resvg/resvg-js");
const { FIGS, PALETTES, TYPE, buildSVG, LOCKED } = require("./figures.js");

const OUT = path.resolve(__dirname, "..");
const FONT_DIR = path.join(__dirname, ".fonts");

// resvg reads TTF/OTF only, and the IBM Plex npm packages ship WOFF. WOFF 1.0 is
// zlib-compressed sfnt tables, so unpack each file into a plain TTF.
function woffToTtf(src, dst) {
  const b = fs.readFileSync(src);
  if (b.toString("ascii", 0, 4) !== "wOFF") throw new Error("not a WOFF 1.0 file: " + src);
  const flavor = b.readUInt32BE(4), n = b.readUInt16BE(12), tables = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const off = b.readUInt32BE(o + 4), comp = b.readUInt32BE(o + 8), orig = b.readUInt32BE(o + 12);
    const raw = b.subarray(off, off + comp);
    tables.push({ tag: b.readUInt32BE(o), sum: b.readUInt32BE(o + 16), data: comp < orig ? zlib.inflateSync(raw) : raw });
  }
  let es = 0;
  while ((1 << (es + 1)) <= n) es++;
  const range = (1 << es) * 16;
  const head = Buffer.alloc(12 + 16 * n);
  head.writeUInt32BE(flavor, 0); head.writeUInt16BE(n, 4); head.writeUInt16BE(range, 6);
  head.writeUInt16BE(es, 8); head.writeUInt16BE(n * 16 - range, 10);
  const parts = [head];
  let at = head.length;
  tables.forEach((t, i) => {
    const r = 12 + i * 16, pad = (4 - (t.data.length % 4)) % 4;
    head.writeUInt32BE(t.tag, r); head.writeUInt32BE(t.sum, r + 4);
    head.writeUInt32BE(at, r + 8); head.writeUInt32BE(t.data.length, r + 12);
    parts.push(t.data, Buffer.alloc(pad));
    at += t.data.length + pad;
  });
  fs.writeFileSync(dst, Buffer.concat(parts));
}

function plexFonts() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  const files = [];
  for (const fam of ["Sans", "Mono"]) {
    for (const weight of ["Regular", "Medium", "SemiBold"]) {
      const name = "IBMPlex" + fam + "-" + weight;
      const dst = path.join(FONT_DIR, name + ".ttf");
      if (!fs.existsSync(dst)) {
        const pkg = path.dirname(require.resolve("@ibm/plex-" + fam.toLowerCase() + "/package.json"));
        woffToTtf(path.join(pkg, "fonts", "complete", "woff", name + ".woff"), dst);
      }
      files.push(dst);
    }
  }
  return files;
}

// Replace every var(--token) with its value so the file needs no CSS variables.
function flatten(svg, id, mode) {
  const vals = Object.assign({ sans: TYPE[LOCKED.type].sans, mono: TYPE[LOCKED.type].mono }, PALETTES[LOCKED.pal][mode]);
  return svg
    .replace(new RegExp("#" + id + "\\{--sans:[^}]*\\}"), "")
    .replace(/var\(--([A-Za-z]+)\)/g, (m, k) => {
      if (!(k in vals)) throw new Error("unknown token --" + k);
      return vals[k];
    });
}

// resvg and some viewers lack auto-start-reverse; every marker here is an end marker, so auto is the same.
const plainOrient = (svg) => svg.replace(/orient="auto-start-reverse"/g, 'orient="auto"');

const fontFiles = plexFonts();
for (const f of FIGS) {
  const adaptive = plainOrient(buildSVG(f, Object.assign({ mode: "adaptive" }, LOCKED), "db2u-" + f.key, true));
  fs.writeFileSync(path.join(OUT, f.key + ".svg"), adaptive + "\n");

  for (const mode of ["light", "dark"]) {
    const id = "db2u-" + f.key + "-" + mode;
    const svg = plainOrient(flatten(buildSVG(f, Object.assign({ mode }, LOCKED), id, true), id, mode));
    fs.writeFileSync(path.join(OUT, f.key + "-" + mode + ".svg"), svg + "\n");

    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: f.W * 2 },
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "IBM Plex Sans", monospaceFamily: "IBM Plex Mono" }
    }).render().asPng();
    fs.writeFileSync(path.join(OUT, f.key + "-" + mode + ".png"), png);
    console.log("wrote " + f.key + "-" + mode + ".svg and .png");
  }
}
