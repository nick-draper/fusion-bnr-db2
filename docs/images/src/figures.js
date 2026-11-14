// Source of the README figures in docs/images/.
// Draws each figure as SVG from a palette, a treatment and a type family.
// Used by preview.html (in a browser) and export.js (in Node).
// The locked README style is IBM Carbon + Outline + IBM Plex; see ../STYLE.md.
(function (root) {
  "use strict";

  /* ---------- Style definitions ---------- */

  const SANS_FB = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const MONO_FB = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const TYPE = {
    plex:  { name: "IBM Plex",  sans: "'IBM Plex Sans', " + SANS_FB, mono: "'IBM Plex Mono', " + MONO_FB },
    inter: { name: "Inter · JetBrains", sans: "'Inter', " + SANS_FB, mono: "'JetBrains Mono', " + MONO_FB },
    geist: { name: "Geist",     sans: "'Geist', " + SANS_FB, mono: "'Geist Mono', " + MONO_FB }
  };

  // Role meaning is fixed across palettes:
  // pri = Fusion and recipe actions (parent, helper-exec, Transform)
  // sec = the Db2 instance side (child, instance namespace, manage_snapshots)
  // neu = context and plumbing (operator, assignment, namespaceMapping)
  // cau = quiesce; dan = failure and undo
  const ROLES = [
    ["pri", "Primary", "Fusion and recipe actions: parent recipe, helper-exec hooks, Transform"],
    ["sec", "Secondary", "Db2 instance side: child recipe, instance namespace, manage_snapshots"],
    ["neu", "Neutral", "Context: operator, policy assignment, namespaceMapping"],
    ["cau", "Caution", "Quiesce: the database is suspended"],
    ["dan", "Danger", "Failure and the undo path"]
  ];
  const BASE = [["bg", "Canvas"], ["panel", "Surface"], ["line", "Rule"], ["ink", "Text"], ["muted", "Secondary text"], ["faint", "Labels"], ["grid", "Grid"]];

  const PALETTES = {
    carbon: {
      name: "IBM Carbon",
      note: "Steps from IBM's Carbon colour scale: neutral Gray, Blue 60 for the recipe path, Teal 60 for the database, Yellow and Red for quiesce and failure. Light follows Carbon's white theme and dark follows g100. Made for IBM Plex.",
      light: { bg:"#FFFFFF", panel:"#FFFFFF", line:"#E0E0E0", ink:"#161616", muted:"#525252", faint:"#8D8D8D", grid:"#E8E8E8",
        priF:"#EDF5FF", priL:"#0F62FE", priI:"#0043CE", secF:"#D9FBFB", secL:"#007D79", secI:"#005D5D",
        neuF:"#F4F4F4", neuL:"#A8A8A8", neuI:"#525252", cauF:"#FCF4D6", cauL:"#B28600", cauI:"#684E00",
        danF:"#FFF1F1", danL:"#A2191F", danI:"#750E13" },
      dark: { bg:"#161616", panel:"#262626", line:"#393939", ink:"#F4F4F4", muted:"#C6C6C6", faint:"#8D8D8D", grid:"#1F1F1F",
        priF:"#001141", priL:"#78A9FF", priI:"#A6C8FF", secF:"#081A1C", secL:"#08BDBA", secI:"#3DDBD9",
        neuF:"#262626", neuL:"#6F6F6F", neuI:"#C6C6C6", cauF:"#1C1500", cauL:"#D2A106", cauI:"#FDDC69",
        danF:"#2D0709", danL:"#FA4D56", danI:"#FFB3B8" }
    },
    slate: {
      name: "Slate & Cobalt",
      note: "Cool greys with a cobalt recipe path and teal for the database. The closest fit to IBM's own product palette.",
      light: { bg:"#F5F7FA", panel:"#FFFFFF", line:"#D5DBE3", ink:"#14181F", muted:"#56606E", faint:"#8A93A0", grid:"#E3E8EF",
        priF:"#EBF0FF", priL:"#2F5BEA", priI:"#1F45C4", secF:"#E5F4F2", secL:"#12857A", secI:"#0A675F",
        neuF:"#F0F2F5", neuL:"#9AA3AF", neuI:"#4A5361", cauF:"#F7F1E2", cauL:"#A9821A", cauI:"#6E5208",
        danF:"#F8ECEA", danL:"#B4432F", danI:"#8A2D1F" },
      dark: { bg:"#0E1116", panel:"#151A21", line:"#2A323D", ink:"#E6EAF0", muted:"#9AA4B2", faint:"#6B7584", grid:"#1A2028",
        priF:"#16213D", priL:"#6E8FFF", priI:"#AABDFF", secF:"#0F2A28", secL:"#3CBFB0", secI:"#8FE0D6",
        neuF:"#1B2129", neuL:"#5D6773", neuI:"#B4BCC8", cauF:"#252117", cauL:"#CFA647", cauI:"#E8CC88",
        danF:"#2A1A19", danL:"#DD6B5B", danI:"#EEA89D" }
    },
    graphite: {
      name: "Graphite & Teal",
      note: "Near-neutral greys. Teal carries the recipe path and graphite the instance, so the drawing stays mostly ink.",
      light: { bg:"#F3F4F4", panel:"#FFFFFF", line:"#D4D7D9", ink:"#121416", muted:"#575D62", faint:"#8C9297", grid:"#E3E5E6",
        priF:"#E2F2F0", priL:"#0E7C77", priI:"#065C58", secF:"#ECEEEF", secL:"#4B5257", secI:"#2B3034",
        neuF:"#F3F4F4", neuL:"#A3A9AE", neuI:"#555B60", cauF:"#F6F1E3", cauL:"#A8811C", cauI:"#6D5209",
        danF:"#F7ECE9", danL:"#B04431", danI:"#872E20" },
      dark: { bg:"#0F1112", panel:"#171A1C", line:"#2C3135", ink:"#E8EAEB", muted:"#9BA2A7", faint:"#6D747A", grid:"#1C2022",
        priF:"#0F2827", priL:"#2FB5AC", priI:"#86DCD5", secF:"#22272A", secL:"#8B949A", secI:"#CDD3D7",
        neuF:"#1D2123", neuL:"#5C646A", neuI:"#B3BABF", cauF:"#252218", cauL:"#CCA54A", cauI:"#E6CB8B",
        danF:"#281A18", danL:"#DA6D5D", danI:"#EDA99F" }
    },
    indigo: {
      name: "Indigo & Jade",
      note: "Blue-violet greys with a deep indigo recipe path and jade for the database. Richer, still restrained.",
      light: { bg:"#F5F5F9", panel:"#FFFFFF", line:"#D9DAE4", ink:"#16162A", muted:"#585970", faint:"#8E8FA5", grid:"#E6E6EF",
        priF:"#EDECFB", priL:"#4B47C9", priI:"#3430A6", secF:"#E3F3EE", secL:"#1F8A70", secI:"#11664F",
        neuF:"#F1F1F5", neuL:"#A0A1B4", neuI:"#50516A", cauF:"#F7F1E4", cauL:"#A6801F", cauI:"#6C510B",
        danF:"#F8ECEC", danL:"#B0443D", danI:"#882F29" },
      dark: { bg:"#0E0E18", panel:"#161624", line:"#2B2B41", ink:"#E8E8F2", muted:"#A0A0B8", faint:"#6E6E88", grid:"#1B1B2B",
        priF:"#1E1D45", priL:"#8A86FF", priI:"#C3C0FF", secF:"#10271F", secL:"#4CC3A0", secI:"#9BE0CA",
        neuF:"#1D1D2E", neuL:"#5E5F78", neuI:"#B7B8CC", cauF:"#24201A", cauL:"#CDA54C", cauI:"#E7CB8C",
        danF:"#2A1A1D", danL:"#DB6C66", danI:"#EEA8A4" }
    },
    mono: {
      name: "Mono Signal",
      note: "Black and white with one signal blue for the recipe path. Colour appears only where it carries meaning.",
      light: { bg:"#FFFFFF", panel:"#FFFFFF", line:"#D9D9D9", ink:"#111111", muted:"#5A5A5A", faint:"#929292", grid:"#EDEDED",
        priF:"#EEF3FF", priL:"#0050E6", priI:"#0040B8", secF:"#F4F4F4", secL:"#3A3A3A", secI:"#1E1E1E",
        neuF:"#FAFAFA", neuL:"#ABABAB", neuI:"#5A5A5A", cauF:"#F6F2E6", cauL:"#9E7B1F", cauI:"#66500F",
        danF:"#F7EDEB", danL:"#A8402F", danI:"#812C1F" },
      dark: { bg:"#0A0A0A", panel:"#121212", line:"#2E2E2E", ink:"#F2F2F2", muted:"#A6A6A6", faint:"#6F6F6F", grid:"#1A1A1A",
        priF:"#0E1A33", priL:"#4D8DFF", priI:"#A6C6FF", secF:"#1C1C1C", secL:"#C2C2C2", secI:"#EAEAEA",
        neuF:"#161616", neuL:"#5A5A5A", neuI:"#A6A6A6", cauF:"#221F18", cauL:"#C9A24C", cauI:"#E3C98E",
        danF:"#261A19", danL:"#D86C5C", danI:"#EBA99F" }
    },
    spruce: {
      name: "Spruce & Steel",
      note: "Green-grey neutrals with a spruce recipe path and steel blue for the database. Calm and slightly warmer.",
      light: { bg:"#F3F6F4", panel:"#FFFFFF", line:"#D3DCD7", ink:"#111A16", muted:"#526058", faint:"#87948D", grid:"#E1E8E4",
        priF:"#E2F0EA", priL:"#1F6F54", priI:"#13523E", secF:"#E8EEF5", secL:"#3E6A96", secI:"#2A4F75",
        neuF:"#EEF2F0", neuL:"#9AA8A1", neuI:"#4E5B55", cauF:"#FAF2DD", cauL:"#B4870F", cauI:"#765704",
        danF:"#FAEAE7", danL:"#BD3B2B", danI:"#92281C" },
      dark: { bg:"#0D1311", panel:"#141C19", line:"#2A3631", ink:"#E5ECE8", muted:"#9AA8A1", faint:"#6A7871", grid:"#19221F",
        priF:"#11281F", priL:"#45B58C", priI:"#93DABF", secF:"#15212D", secL:"#6E9CCB", secI:"#AFCBE8",
        neuF:"#19221F", neuL:"#5A6862", neuI:"#B1BDB7", cauF:"#29230F", cauL:"#D9AE3F", cauI:"#EED081",
        danF:"#2C1613", danL:"#E8695A", danI:"#F4A69C" }
    }
  };

  const TREATS = {
    panel:     { name: "Panel",     kind: "panel",     r: 10, gr: 14, frameR: 16, sw: 1.25, aw: 1.5,  open: false, eyeMono: false, header: false, pattern: null },
    outline:   { name: "Outline",   kind: "outline",   r: 4,  gr: 8,  frameR: 10, sw: 1,    aw: 1.25, open: true,  eyeMono: true,  header: false, pattern: "dots" },
    elevated:  { name: "Elevated",  kind: "elevated",  r: 10, gr: 16, frameR: 16, sw: 1,    aw: 1.5,  open: false, eyeMono: false, header: false, pattern: null, shadow: true },
    flat:      { name: "Flat",      kind: "flat",      r: 8,  gr: 12, frameR: 16, sw: 0,    aw: 1.5,  open: true,  eyeMono: true,  header: false, pattern: null }
  };
  const TREAT_NOTES = {
    panel: "Tinted containers and soft corners.",
    outline: "Hairlines and open arrowheads on a dot grid.",
    elevated: "Neutral cards with a soft shadow on recessed trays; colour only in markers and arrows.",
    flat: "No strokes. Tinted shapes on solid trays, separated by space alone."
  };

  const LOCKED = { pal: "carbon", treat: "outline", type: "plex" };

  /* ---------- Text ---------- */

  // Wording comes from text.yaml (via setText); layout stays in this file.
  let TEXT = {};
  function setText(t) { TEXT = t || {}; }

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[/^\d+$/.test(k) ? +k : k]; }, obj);
  }
  function textOf(figKey, path) {
    const v = getPath(TEXT[figKey], path);
    return v == null ? "" : String(v);
  }
  // Number of entries in a text list (lines, bullets, rows).
  function count(c, path) {
    const v = getPath(TEXT[c.figKey], path);
    return Array.isArray(v) ? v.length : v == null || v === "" ? 0 : 1;
  }

  // Font of each text class, for the fit check.
  function fontOf(cls, T) {
    const F = {
      ttl: [0, 20, 600, -0.01], sub: [0, 13, 400, 0], fig: [1, 11, 500, 0.08], h: [0, 14, 600, 0], hm: [1, 13, 600, 0],
      gh: [0, 13, 600, 0], b: [0, 12.5, 400, 0], m: [1, 11, 400, 0], mv: [1, 12, 500, 0], lab: [1, 10.5, 400, 0],
      labd: [1, 10.5, 500, 0], hd: [1, 10.5, 500, 0.08],
      eye: T && T.eyeMono ? [1, 10.5, 600, 0.06] : [0, 10.5, 600, 0.09]
    }[cls] || [0, 13, 400, 0];
    return { mono: !!F[0], size: F[1], weight: F[2], ls: F[3] };
  }

  // Width of a string in px. Node passes exact IBM Plex metrics and the browser
  // passes canvas measureText; the fallback is a conservative estimate.
  let MEASURE = null;
  function setMeasure(fn) { MEASURE = fn; }
  function widthOf(s, cls, T) {
    const f = fontOf(cls, T);
    let w = MEASURE ? MEASURE(s, f) : null;
    if (w == null) w = s.length * f.size * (f.mono ? 0.6 : 0.56);
    return w + s.length * f.ls * f.size;
  }

  /* ---------- SVG primitives ---------- */

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function txt(c, x, y, s, cls, extra) {
    c.g.push('<text x="' + x + '" y="' + y + '" class="' + cls + '"' + (extra || "") + ">" + esc(s) + "</text>");
  }

  // Draw the text at `key`, check it fits in `max` px, and tag it for the editor.
  function t(c, x, y, key, cls, max, extra, upper) {
    let s = textOf(c.figKey, key);
    if (!s) {
      c.warn.push({ key: c.figKey + "." + key, problem: "missing" });
      s = "[" + key + "]";
    }
    if (upper) s = s.toUpperCase();
    const w = widthOf(s, cls, c.T);
    if (max && w > max + 0.5) c.warn.push({ key: c.figKey + "." + key, problem: "too long", text: s, width: Math.round(w), max: Math.round(max) });
    txt(c, x, y, s, cls, ' data-k="' + c.figKey + "." + key + '"' + (extra || ""));
    return w;
  }

  function frame(c, W, H) {
    const T = c.T;
    c.g.push('<rect width="' + W + '" height="' + H + '" rx="' + T.frameR + '" style="fill:var(--bg)"/>');
    if (T.pattern) c.g.push('<rect width="' + W + '" height="' + H + '" rx="' + T.frameR + '" fill="url(#' + c.id + '-pat)"/>');
    t(c, 40, 52, "title", "ttl", W - 160);
    t(c, 40, 76, "subtitle", "sub", W - 80);
    // Figure numbers follow the order of FIGS, which is the order the README shows them in.
    txt(c, W - 40, 52, c.fig, "fig", ' text-anchor="end"');
  }

  function group(c, o) {
    const T = c.T, x = o.x, y = o.y, w = o.w, h = o.h;
    if (T.kind === "panel") {
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.gr + '" style="fill:var(--panel);stroke:var(--line)" stroke-width="1"/>');
    } else if (T.kind === "outline") {
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.gr + '" style="fill:none;stroke:var(--faint)" stroke-width="1" stroke-dasharray="5 4"/>');
    } else {
      // elevated and flat: a recessed solid tray, no border
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.gr + '" style="fill:var(--grid)"/>');
    }
    if (o.k) {
      // Heading on the left, meta on the right, sharing one row.
      const mw = widthOf(textOf(c.figKey, o.k + ".meta"), "m", T);
      t(c, x + 20, y + 30, o.k + ".heading", "gh", w - 56 - mw);
      t(c, x + w - 20, y + 30, o.k + ".meta", "m", w - 140, ' text-anchor="end"');
    }
  }

  // Offsets inside a node, shared by every figure so baselines line up.
  const O = { eye: 22, title: 46, first: 68, step: 19 };

  // A box. Its text lives under `n.k`: label, title, lines (sans), code (mono),
  // note (sans, after code) and aside (mono, right of the title).
  function node(c, n) {
    const T = c.T, r = n.role || "neu", x = n.x, y = n.y, w = n.w, h = n.h, k = n.k;
    const dash = n.dim ? ' stroke-dasharray="4 3"' : "";
    c.g.push("<g" + (n.dim ? ' opacity="0.55"' : "") + ">");
    if (T.kind === "panel") {
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.r + '" style="fill:var(--' + r + "F);stroke:var(--" + r + 'L)" stroke-width="' + T.sw + '"' + dash + "/>");
    } else if (T.kind === "outline") {
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.r + '" style="fill:var(--panel);stroke:var(--' + r + 'L)" stroke-width="' + T.sw + '"' + dash + "/>");
      c.g.push('<rect x="' + (x + 16) + '" y="' + (y + 15) + '" width="7" height="7" style="fill:var(--' + r + 'L)"/>');
    } else if (T.kind === "elevated") {
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.r + '" filter="url(#' + c.id + '-sh)" style="fill:var(--panel);stroke:var(--line)" stroke-width="1"' + dash + "/>");
      c.g.push('<circle cx="' + (x + 20) + '" cy="' + (y + 18.5) + '" r="3.5" style="fill:var(--' + r + 'L)"/>');
    } else {
      c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.r + '" style="fill:var(--' + r + 'F)' + (n.dim ? ";stroke:var(--" + r + 'L)" stroke-dasharray="4 3"' : '"') + "/>");
    }
    const ex = T.kind === "outline" || T.kind === "elevated" ? 30 : 16;
    if (count(c, k + ".label")) t(c, x + ex, y + O.eye, k + ".label", "eye", w - ex - 16, ' style="fill:var(--' + r + 'I)"', true);
    let asideW = 0;
    if (count(c, k + ".aside")) asideW = t(c, x + w - 16, y + O.title, k + ".aside", "m", w - 120, ' text-anchor="end"') + 16;
    t(c, x + 16, y + O.title, k + ".title", n.titleMono ? "hm" : "h", w - 32 - asideW);

    // Body rows in order: sans lines, then mono code, then a sans note.
    const rows = [];
    for (let i = 0; i < count(c, k + ".lines"); i++) rows.push([k + ".lines." + i, "b"]);
    const nc = count(c, k + ".code");
    const codeVal = getPath(TEXT[c.figKey], k + ".code");
    for (let i = 0; i < nc; i++) rows.push([k + ".code" + (Array.isArray(codeVal) ? "." + i : ""), "m"]);
    if (count(c, k + ".note")) rows.push([k + ".note", "b"]);
    rows.forEach(function (row, i) {
      const by = y + O.first + i * O.step;
      if (by > y + h - 12) c.warn.push({ key: c.figKey + "." + row[0], problem: "no room", text: textOf(c.figKey, row[0]), max: "box height " + h });
      t(c, x + 16, by, row[0], row[1], w - 32);
    });
    c.g.push("</g>");
  }

  // A small object inside a node (a CR or a pod): title and detail under `o.k`.
  function chipBox(c, o) {
    const T = c.T, r = o.role || "neu";
    const fill = T.kind === "elevated" ? "var(--bg)" : "var(--panel)";
    const stroke = T.kind === "panel" ? "var(--" + r + "L)" : T.kind === "outline" ? "var(--line)" : "none";
    c.g.push('<rect x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '" rx="' + Math.max(0, T.r - 4) + '" style="fill:' + fill + ";stroke:" + stroke + '" stroke-width="1"/>');
    t(c, o.x + 14, o.y + 27, o.k + ".title", "h", o.w - 28);
    if (count(c, o.k + ".detail")) t(c, o.x + 14, o.y + 46, o.k + ".detail", "m", o.w - 28);
  }

  // Background token under a label pill, chosen per treatment.
  function under(c, where) {
    if (where === "bg") return "var(--bg)";
    const k = c.T.kind;
    if (where === "group") return k === "outline" ? "var(--bg)" : k === "panel" ? "var(--panel)" : "var(--grid)";
    return k === "panel" || k === "flat" ? "var(--" + where + "F)" : "var(--panel)";
  }

  // An arrow label on a pill sized to the text.
  function label(c, key, x, y, anchor, where, cls, max) {
    cls = cls || "lab";
    const w = widthOf(textOf(c.figKey, key) || key, cls, c.T) + 12;
    const rx = anchor === "start" ? x - 6 : anchor === "end" ? x - w + 6 : x - w / 2;
    c.g.push('<rect x="' + rx.toFixed(1) + '" y="' + (y - 12) + '" width="' + w.toFixed(1) + '" height="17" rx="3" style="fill:' + under(c, where) + '"/>');
    t(c, x, y, key, cls, max, ' text-anchor="' + anchor + '"');
  }

  function arrow(c, a) {
    const r = a.role || "neu";
    const col = r === "neu" ? "var(--muted)" : "var(--" + r + "L)";
    c.g.push('<path d="' + a.d + '" fill="none" style="stroke:' + col + '" stroke-width="' + c.T.aw + '" stroke-linejoin="round"' +
      (a.dash ? ' stroke-dasharray="' + a.dash + '"' : "") + (a.noHead ? "" : ' marker-end="url(#' + c.id + "-m-" + r + ')"') + "/>");
    if (a.label) label(c, a.label, a.lx, a.ly, a.anchor || "middle", a.on || "bg", a.cls, a.max);
  }

  // Warn about list entries the layout has no box for.
  function extras(c, path, slots) {
    const n = count(c, path);
    for (let i = slots; i < n; i++) c.warn.push({ key: c.figKey + "." + path + "." + i, problem: "no box for this entry; ignored" });
  }

  function defs(c) {
    const T = c.T, out = [];
    ["neu", "pri", "sec", "cau", "dan"].forEach(function (r) {
      const col = r === "neu" ? "var(--muted)" : "var(--" + r + "L)";
      const shape = T.open
        ? '<path d="M1.5 1.5L9 5L1.5 8.5" fill="none" style="stroke:' + col + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M0 1L10 5L0 9Z" style="fill:' + col + '"/>';
      out.push('<marker id="' + c.id + "-m-" + r + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">' + shape + "</marker>");
    });
    if (T.pattern === "dots") out.push('<pattern id="' + c.id + '-pat" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" style="fill:var(--grid)"/></pattern>');
    if (T.shadow) out.push('<filter id="' + c.id + '-sh" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="1" style="flood-color:var(--ink)" flood-opacity="0.07"/><feDropShadow dx="0" dy="6" stdDeviation="9" style="flood-color:var(--ink)" flood-opacity="0.07"/></filter>');
    return "<defs>" + out.join("") + "</defs>";
  }

  /* ---------- Figures ---------- */

  // Each entry is layout only. Its wording is TEXT[key]; name, alt and cap read from there.
  function fig(o) {
    Object.defineProperty(o, "name", { get: function () { return textOf(o.key, "title"); } });
    Object.defineProperty(o, "alt", { get: function () { return textOf(o.key, "alt"); } });
    Object.defineProperty(o, "cap", { get: function () { return textOf(o.key, "caption"); } });
    return o;
  }

  const FIGS = [
    fig({
      key: "layouts", file: "docs/images/layouts.svg", W: 1200, H: 456,
      delta: "New figure. Each layout shows its backup scope, so the difference is what Fusion copies, not only where the boxes sit.",
      draw: function (c) {
        frame(c, 1200, 456);
        // IBM sample: one namespace holds the operator and the instance, and the backup takes both.
        group(c, { x: 40, y: 104, w: 540, h: 312, k: "sample" });
        node(c, { x: 64, y: 152, w: 492, h: 240, role: "cau", k: "sample.namespace" });
        chipBox(c, { x: 88, y: 216, w: 444, h: 64, k: "sample.operator" });
        chipBox(c, { x: 88, y: 312, w: 444, h: 64, k: "sample.instance" });
        arrow(c, { d: "M310 282V308", label: "sample.arrow", lx: 322, ly: 299, anchor: "start", on: "cau", max: 200 });

        // Production: the operator namespace is GitOps-managed and outside every backup.
        group(c, { x: 620, y: 104, w: 540, h: 312, k: "production" });
        node(c, { x: 644, y: 152, w: 492, h: 100, role: "neu", k: "production.operator" });
        node(c, { x: 644, y: 300, w: 236, h: 92, role: "sec", k: "production.instance_a" });
        node(c, { x: 900, y: 300, w: 236, h: 92, role: "sec", k: "production.instance_b" });
        arrow(c, { d: "M890 254V276H762V296", role: "neu" });
        arrow(c, { d: "M890 276H1018V296", role: "neu" });
        label(c, "production.arrow", 902, 270, "start", "group", null, 108);
      }
    }),
    fig({
      key: "deploy", file: "docs/images/deploy.svg", W: 1200, H: 304,
      delta: "Steps connect in order, file paths are set in mono, and each step says where its commands run.",
      draw: function (c) {
        frame(c, 1200, 304);
        const roles = ["neu", "sec", "pri", "pri", "neu"], y = 104, w = 212, h = 148;
        roles.forEach(function (role, i) {
          const x = 40 + i * 228;
          node(c, { x: x, y: y, w: w, h: h, role: role, k: "steps." + i });
          if (i < 4) arrow(c, { d: "M" + (x + w + 2) + " " + (y + 42) + "H" + (x + w + 14), role: "neu" });
          // Where each step's commands run.
          t(c, x + w / 2, y + h + 26, "steps." + i + ".runs_in", "m", 224, ' text-anchor="middle"');
        });
        extras(c, "steps", 5);
      }
    }),
    fig({
      key: "architecture", file: "docs/images/architecture.svg", W: 1200, H: 656,
      delta: "Arrows now name each call and land on the object they touch. The step lists moved out; the README already has them under How it works.",
      draw: function (c) {
        frame(c, 1200, 656);
        group(c, { x: 40, y: 104, w: 360, h: 512, k: "fusion" });
        group(c, { x: 500, y: 104, w: 660, h: 512, k: "cluster" });

        node(c, { x: 72, y: 152, w: 296, h: 100, role: "neu", k: "assignment" });
        node(c, { x: 72, y: 296, w: 296, h: 140, role: "pri", k: "parent" });
        node(c, { x: 72, y: 484, w: 296, h: 116, role: "sec", k: "child" });
        arrow(c, { d: "M220 254V292", label: "arrows.names", lx: 232, ly: 278, anchor: "start", on: "group", max: 150 });
        arrow(c, { d: "M220 438V480", label: "arrows.finds", lx: 232, ly: 464, anchor: "start", on: "group", max: 150 });

        node(c, { x: 532, y: 152, w: 596, h: 116, role: "pri", k: "helper" });
        node(c, { x: 532, y: 300, w: 596, h: 200, role: "sec", k: "instance" });
        chipBox(c, { x: 556, y: 372, w: 164, h: 64, role: "sec", k: "pod" });
        chipBox(c, { x: 748, y: 372, w: 164, h: 64, role: "sec", k: "cr" });
        chipBox(c, { x: 940, y: 372, w: 164, h: 64, role: "sec", k: "engine" });
        t(c, 846, 476, "instance.contents", "m", 258);
        node(c, { x: 532, y: 532, w: 596, h: 68, role: "neu", k: "operator" });

        arrow(c, { d: "M368 330H450V210H528", role: "pri", label: "arrows.helper_exec", lx: 409, ly: 322, on: "bg", max: 80 });
        arrow(c, { d: "M368 542H470V456H638V440", role: "sec", label: "arrows.snapshots", lx: 548, ly: 460, anchor: "start", on: "sec", max: 280 });
        arrow(c, { d: "M830 268V368", role: "pri" });
        arrow(c, { d: "M1022 268V368", role: "pri" });
        label(c, "arrows.patch", 818, 289, "end", "group", null, 280);
        arrow(c, { d: "M830 532V440", role: "neu", label: "arrows.reconciles", lx: 842, ly: 521, anchor: "start", on: "group", max: 270 });
      }
    }),
    fig({
      key: "workflow", file: "docs/images/workflow.svg", W: 1200, H: 922,
      delta: "New figure. Both workflows step by step, with the child's workflow boxed inside the parent's.",
      draw: function (c) {
        frame(c, 1200, 922);
        const T = c.T, P = 48, RH = 34;   // row pitch and row height

        const GW = 540, RX = 620;   // column width and the restore column's x

        // One step: number, op name, and a short note on the right.
        function row(x, y, w, role, k, n) {
          const fill = T.kind === "panel" || T.kind === "flat" ? "var(--" + role + "F)" : "var(--panel)";
          const stroke = T.kind === "flat" ? "none" : "var(--" + role + "L)";
          c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + RH + '" rx="' + Math.max(0, T.r - 2) + '" style="fill:' + fill + ";stroke:" + stroke + '" stroke-width="' + (T.sw || 1) + '"/>');
          txt(c, x + 14, y + 22, (n < 10 ? "0" : "") + n, "lab", ' style="fill:var(--' + role + 'I)"');
          const ow = t(c, x + 40, y + 22, k + ".op", "hm", w * 0.56);
          t(c, x + w - 14, y + 22, k + ".detail", "m", w - 70 - ow, ' text-anchor="end"');
        }

        // A dashed box naming the recipe a run of steps comes from.
        function source(x, y, w, h, role, key) {
          c.g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + T.r + '" style="fill:none;stroke:var(--' + role + 'L)" stroke-width="1" stroke-dasharray="4 3"/>');
          t(c, x + 16, y + 22, key, "eye", w - 32, ' style="fill:var(--' + role + 'I)"', true);
        }

        // Both columns share one grid: `LEAD` parent rows, then a child box with
        // `SLOTS` rows, then the trailing parent rows. A column with fewer steps
        // leaves the gap above the child box (lead) or inside it.
        const LEAD = 2, SLOTS = 6, TRAIL = 3, PTOP = 152, Y0 = PTOP + 34;
        const childTop = Y0 + LEAD * P, childBottom = childTop + 34 + (SLOTS - 1) * P + RH + 12;
        const parentBottom = childBottom + 14 + (TRAIL - 1) * P + RH + 12;
        function column(gx, base, roles, from, to) {
          const px = gx + 16, pw = GW - 32;            // parent box
          const x = px + 16, w = pw - 32, cx = gx + GW / 2;
          source(px, PTOP, pw, parentBottom - PTOP, "pri", base + ".parent");
          let prev = null, n = 0, first = null, last = null;
          function link(top) { if (prev != null) arrow(c, { d: "M" + cx + " " + prev + "V" + (top - 3) }); }
          roles.forEach(function (role, i) {
            let y;
            if (i < from) y = Y0 + i * P;   // lead rows start at the top
            else if (i < to) {
              if (i === from) {
                link(childTop);
                source(x, childTop, w, childBottom - childTop, "sec", base + ".child");
                prev = null;
              }
              y = childTop + 34 + (i - from) * P;
            } else {
              if (i === to) prev = childBottom;
              y = childBottom + 14 + (i - to) * P;
            }
            link(y);
            const inChild = i >= from && i < to;
            row(inChild ? x + 16 : x, y, inChild ? w - 32 : w, role, base + ".steps." + i, ++n);
            if (first == null) first = y;
            prev = last = y + RH;
          });
          extras(c, base + ".steps", roles.length);
          return { first: first, last: last };
        }

        // A note under each parent box: what happens on a failed backup, and what
        // rewrites the objects on a restore.
        const NH = 84, noteY = parentBottom + 16, GH = noteY + NH + 24 - 104;
        group(c, { x: 40, y: 104, w: GW, h: GH, k: "backup" });
        column(40, "backup", ["pri", "pri", "sec", "sec", "cau", "sec", "sec", "pri", "pri"], 2, 7);
        node(c, { x: 56, y: noteY, w: GW - 32, h: NH, role: "dan", k: "backup.failure" });

        group(c, { x: RX, y: 104, w: GW, h: GH, k: "restore" });
        column(RX, "restore", ["pri", "sec", "sec", "sec", "neu", "sec", "neu", "pri", "pri", "pri"], 1, 7);
        node(c, { x: RX + 16, y: noteY, w: GW - 32, h: NH, role: "cau", k: "restore.transform" });
      }
    }),
    fig({
      key: "transform", file: "docs/images/transform.svg", W: 1200, H: 580,
      delta: "Drawn as a field-by-field diff, so each before and after value sits beside the mechanism that changes it. Adds the PVC labels.",
      draw: function (c) {
        frame(c, 1200, 580);
        group(c, { x: 24, y: 96, w: 1152, h: 452 });
        const hy = 126;
        t(c, 48, hy, "headers.field", "hd", 280);
        t(c, 340, hy, "headers.source", "hd", 340);
        t(c, 700, hy, "headers.changed_by", "hd", 260, ' text-anchor="middle"');
        t(c, 860, hy, "headers.target", "hd", 292);
        c.g.push('<path d="M48 138H1152" style="stroke:var(--line)" stroke-width="1"/>');
        // Role per row: neutral for namespaceMapping, primary for Fusion actions. The last row is unchanged.
        const roles = ["neu", "pri", "pri", "pri", "pri", "pri", "neu"], same = 6, rh = 56;
        const unchangedW = widthOf(textOf(c.figKey, "unchanged"), "m", c.T);
        roles.forEach(function (role, i) {
          const y0 = 138 + i * rh, cy = y0 + 29, k = "rows." + i;
          t(c, 48, y0 + 25, k + ".object", "h", 280);
          t(c, 48, y0 + 44, k + ".field", "m", 280);
          t(c, 340, y0 + 33, k + ".source", "mv", 208, ' style="fill:var(--muted)"');
          const cw = widthOf(textOf(c.figKey, k + ".changed_by"), "lab", c.T) + 22, cl = 700 - cw / 2, cr = 700 + cw / 2;
          arrow(c, { d: "M560 " + cy + "H" + Math.max(560, cl - 6), role: role, noHead: true, dash: "2 3" });
          arrow(c, { d: "M" + Math.min(844, cr + 6) + " " + cy + "H850", role: role });
          c.g.push('<rect x="' + cl.toFixed(1) + '" y="' + (cy - 12) + '" width="' + cw.toFixed(1) + '" height="24" rx="12" style="fill:var(--' + role + "F);stroke:" + (c.T.kind === "flat" ? "none" : "var(--" + role + "L)") + '" stroke-width="1"/>');
          t(c, 700, cy + 4, k + ".changed_by", "lab", 250, ' text-anchor="middle" style="fill:var(--' + role + 'I)"');
          if (i === same) {
            t(c, 860, y0 + 33, k + ".target", "mv", 292 - unchangedW - 16, ' style="fill:var(--muted)"');
            t(c, 1152, y0 + 33, "unchanged", "m", 120, ' text-anchor="end"');
          } else {
            const tw = widthOf(textOf(c.figKey, k + ".target"), "mv", c.T) + 20;
            c.g.push('<rect x="856" y="' + (cy - 13) + '" width="' + tw.toFixed(1) + '" height="26" rx="5" style="fill:var(--' + role + 'F)"/>');
            t(c, 866, y0 + 33, k + ".target", "mv", 276, ' style="fill:var(--' + role + 'I)"');
          }
          if (i < roles.length - 1) c.g.push('<path d="M48 ' + (y0 + rh) + 'H1152" style="stroke:var(--line)" stroke-width="1" stroke-dasharray="1 3"/>');
        });
        extras(c, "rows", roles.length);
      }
    }),
    fig({
      key: "failover", file: "docs/images/failover.svg", W: 1200, H: 452,
      delta: "Each undo now sits under the step whose failure starts it, so every failure point drops straight into the undo chain.",
      draw: function (c) {
        frame(c, 1200, 452);
        const y = 112, w = 212, h = 104;
        ["pri", "pri", "cau", "neu", "sec"].forEach(function (role, i) {
          const x = 40 + i * 228;
          node(c, { x: x, y: y, w: w, h: h, role: role, k: "steps." + i });
          if (i < 4) arrow(c, { d: "M" + (x + w + 2) + " " + (y + 42) + "H" + (x + w + 14), role: "neu" });
        });
        extras(c, "steps", 5);
        // Undo k sits under the step whose failure starts it, so each failure drops straight down.
        const uy = 300, uh = 116;
        [268, 496, 724].forEach(function (x, i) {
          node(c, { x: x, y: uy, w: w, h: uh, role: "dan", k: "undo." + i });
          const cx = x + w / 2;
          arrow(c, { d: "M" + cx + " " + (y + h + 2) + "V" + (uy - 3), role: "dan", label: "fails", lx: cx, ly: 262, on: "bg", cls: "labd", max: 190 });
        });
        extras(c, "undo", 3);
        node(c, { x: 40, y: uy, w: w, h: uh, role: "sec", k: "result" });
        arrow(c, { d: "M722 " + (uy + 46) + "H710", role: "dan" });
        arrow(c, { d: "M494 " + (uy + 46) + "H482", role: "dan" });
        arrow(c, { d: "M266 " + (uy + 46) + "H254", role: "dan" });
      }
    })
  ];

  /* ---------- Assembly ---------- */

  function vars(t) { return Object.keys(t).map(function (k) { return "--" + k + ":" + t[k]; }).join(";"); }

  function styleBlock(id, s) {
    const P = PALETTES[s.pal], Ty = TYPE[s.type], T = TREATS[s.treat];
    const L = vars(P.light), D = vars(P.dark);
    let css = "#" + id + "{--sans:" + Ty.sans + ";--mono:" + Ty.mono + ";" + (s.mode === "dark" ? D : L) + "}";
    if (s.mode === "adaptive") css += "@media (prefers-color-scheme: dark){#" + id + "{" + D + "}}";
    if (s.mode === "page") css += '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) #' + id + "{" + D + '}}:root[data-theme="dark"] #' + id + "{" + D + "}";
    const p = "#" + id + " ";
    css += p + "text{font-family:var(--sans)}" +
      p + ".ttl{font-size:20px;font-weight:600;fill:var(--ink);letter-spacing:-0.01em}" +
      p + ".sub{font-size:13px;fill:var(--muted)}" +
      p + ".fig{font-family:var(--mono);font-size:11px;font-weight:500;fill:var(--faint);letter-spacing:0.08em}" +
      p + ".eye{font-size:10.5px;font-weight:600;letter-spacing:" + (T.eyeMono ? "0.06em;font-family:var(--mono)" : "0.09em") + "}" +
      p + ".h{font-size:14px;font-weight:600;fill:var(--ink)}" +
      p + ".hm{font-family:var(--mono);font-size:13px;font-weight:600;fill:var(--ink)}" +
      p + ".gh{font-size:13px;font-weight:600;fill:var(--ink)}" +
      p + ".b{font-size:12.5px;fill:var(--ink)}" +
      p + ".m{font-family:var(--mono);font-size:11px;fill:var(--muted)}" +
      p + ".mv{font-family:var(--mono);font-size:12px;font-weight:500;fill:var(--ink)}" +
      p + ".lab{font-family:var(--mono);font-size:10.5px;fill:var(--muted)}" +
      p + ".labd{font-family:var(--mono);font-size:10.5px;font-weight:500;fill:var(--danI)}" +
      p + ".hd{font-family:var(--mono);font-size:10.5px;font-weight:500;fill:var(--faint);letter-spacing:0.08em}";
    return css;
  }

  // Build one figure. `forExport` adds width and height and drops the editor tags.
  function render(fig, s, id, forExport) {
    const c = { T: TREATS[s.treat], id: id, g: [], warn: [], figKey: fig.key, fig: "FIG " + (FIGS.indexOf(fig) + 1) };
    fig.draw(c);
    let body = c.g.join("");
    if (forExport) body = body.replace(/ data-k="[^"]*"/g, "");
    const head = '<svg xmlns="http://www.w3.org/2000/svg" id="' + id + '" viewBox="0 0 ' + fig.W + " " + fig.H + '"' +
      (forExport ? ' width="' + fig.W + '" height="' + fig.H + '"' : "") +
      ' role="img" aria-labelledby="' + id + "-t " + id + '-d">';
    const svg = head + '<title id="' + id + '-t">' + esc(fig.name) + '</title><desc id="' + id + '-d">' + esc(fig.alt) + "</desc>" +
      "<style>" + styleBlock(id, s) + "</style>" + defs(c) + body + "</svg>";
    return { svg: svg, warnings: c.warn };
  }
  function buildSVG(fig, s, id, forExport) { return render(fig, s, id, forExport).svg; }
  // Text problems for one figure in the locked style: missing keys, text too long for its box.
  function check(fig) { return render(fig, Object.assign({ mode: "light" }, LOCKED), "chk", false).warnings; }

  const api = { TYPE, ROLES, BASE, PALETTES, TREATS, TREAT_NOTES, FIGS, buildSVG, render, check, setText, setMeasure, fontOf, esc, LOCKED };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Db2uFigures = api;
})(this);
