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
      note: "Steps from IBM's Carbon colour scale: neutral Gray, Blue 60 for the recipe path, Teal 60 for the database, Yellow and Red for quiesce and failure. Light follows Carbon's g10 theme and dark follows g100. Made for IBM Plex.",
      light: { bg:"#F4F4F4", panel:"#FFFFFF", line:"#E0E0E0", ink:"#161616", muted:"#525252", faint:"#8D8D8D", grid:"#E8E8E8",
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

  /* ---------- SVG primitives ---------- */

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const MW = 6.4; // mono label advance at 10.5px

  function txt(c, x, y, s, cls, extra) {
    c.g.push('<text x="' + x + '" y="' + y + '" class="' + cls + '"' + (extra || "") + ">" + esc(s) + "</text>");
  }

  function frame(c, W, H, title, sub, fig) {
    const T = c.T;
    c.g.push('<rect width="' + W + '" height="' + H + '" rx="' + T.frameR + '" style="fill:var(--bg)"/>');
    if (T.pattern) c.g.push('<rect width="' + W + '" height="' + H + '" rx="' + T.frameR + '" fill="url(#' + c.id + '-pat)"/>');
    txt(c, 40, 52, title, "ttl");
    txt(c, 40, 76, sub, "sub");
    // Figure numbers follow the order of FIGS, which is the order the README shows them in.
    txt(c, W - 40, 52, c.fig || fig, "fig", ' text-anchor="end"');
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
    if (o.title) txt(c, x + 20, y + 30, o.title, "gh");
    if (o.meta) txt(c, x + w - 20, y + 30, o.meta, "m", ' text-anchor="end"');
  }

  // Offsets inside a node, shared by every figure so baselines line up.
  function off(c) { return c.T.header ? { eye: 20, title: 54, first: 76 } : { eye: 22, title: 46, first: 68 }; }

  function node(c, n) {
    const T = c.T, r = n.role || "neu", x = n.x, y = n.y, w = n.w, h = n.h, O = off(c);
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
    const ex = T.kind === "outline" ? 30 : T.kind === "elevated" ? 30 : 16;
    if (n.eye) txt(c, x + ex, y + O.eye, n.eye.toUpperCase(), "eye", ' style="fill:var(--' + r + 'I)"');
    if (n.title) txt(c, x + 16, y + O.title, n.title, n.titleMono ? "hm" : "h");
    (n.lines || []).forEach(function (l, i) { txt(c, x + 16, y + O.first + i * 19, l[1], l[0]); });
    if (n.aside) txt(c, x + w - 16, y + O.title, n.aside, "m", ' text-anchor="end"');
    if (n.fail) {
      const cx = x + w - 22, cy = y + (T.header ? 15 : 22);
      c.g.push('<circle cx="' + cx + '" cy="' + cy + '" r="9" style="fill:var(--danF);stroke:var(--danL)" stroke-width="1.25"/>');
      c.g.push('<path d="M' + (cx - 3.5) + " " + (cy - 3.5) + "L" + (cx + 3.5) + " " + (cy + 3.5) + "M" + (cx + 3.5) + " " + (cy - 3.5) + "L" + (cx - 3.5) + " " + (cy + 3.5) + '" style="stroke:var(--danI)" stroke-width="1.6" stroke-linecap="round"/>');
    }
    c.g.push("</g>");
  }

  // A small object inside a node (a CR or a pod).
  function chipBox(c, o) {
    const T = c.T, r = o.role || "neu";
    const fill = T.kind === "elevated" ? "var(--bg)" : "var(--panel)";
    const stroke = T.kind === "panel" ? "var(--" + r + "L)" : T.kind === "outline" ? "var(--line)" : "none";
    c.g.push('<rect x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '" rx="' + Math.max(0, T.r - 4) + '" style="fill:' + fill + ";stroke:" + stroke + '" stroke-width="1"/>');
    txt(c, o.x + 14, o.y + 27, o.title, "h");
    if (o.sub) txt(c, o.x + 14, o.y + 46, o.sub, "m");
  }

  // Background token under a label pill, chosen per treatment.
  function under(c, where) {
    if (where === "bg") return "var(--bg)";
    const k = c.T.kind;
    if (where === "group") return k === "outline" ? "var(--bg)" : k === "panel" ? "var(--panel)" : "var(--grid)";
    return k === "panel" || k === "flat" ? "var(--" + where + "F)" : "var(--panel)";
  }

  function label(c, s, x, y, anchor, where, cls) {
    const w = s.length * MW + 12;
    const rx = anchor === "start" ? x - 6 : anchor === "end" ? x - w + 6 : x - w / 2;
    c.g.push('<rect x="' + rx.toFixed(1) + '" y="' + (y - 12) + '" width="' + w.toFixed(1) + '" height="17" rx="3" style="fill:' + under(c, where) + '"/>');
    txt(c, x, y, s, cls || "lab", ' text-anchor="' + anchor + '"');
  }

  function arrow(c, a) {
    const r = a.role || "neu";
    const col = r === "neu" ? "var(--muted)" : "var(--" + r + "L)";
    c.g.push('<path d="' + a.d + '" fill="none" style="stroke:' + col + '" stroke-width="' + c.T.aw + '" stroke-linejoin="round"' +
      (a.dash ? ' stroke-dasharray="' + a.dash + '"' : "") + (a.noHead ? "" : ' marker-end="url(#' + c.id + "-m-" + r + ')"') + "/>");
    if (a.label) label(c, a.label, a.lx, a.ly, a.anchor || "middle", a.on || "bg", a.cls);
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

  const FIGS = [
    {
      key: "deploy", file: "docs/images/deploy.svg", name: "Deploy order", W: 1200, H: 304,
      alt: "Deploy order: object storage, Db2 operator and instance, Fusion Backup and Restore, recipe helper, then back up and restore. Each step lists where it runs.",
      cap: "Five steps, in order. docs/end-to-end.md gives the commands and a check for each one.",
      delta: "Steps connect in order, file paths are set in mono, and each step says where its commands run.",
      draw: function (c) {
        frame(c, 1200, 304, "Deploy order", "Five steps, in order. docs/end-to-end.md has the commands and a check for each.", "FIG 1");
        const cards = [
          { role: "neu", eye: "01 · Storage", title: "Object storage", lines: [["b", "Bucket, policy, user"], ["b", "Access key, endpoint CA"], ["m", "object-storage-setup.md"]] },
          { role: "sec", eye: "02 · Db2", title: "Operator and instance", lines: [["b", "OperatorGroup targets"], ["b", "namespace-scope ConfigMap"], ["b", "Node environment labels"], ["m", "db2u-instance/"]] },
          { role: "pri", eye: "03 · Fusion", title: "Backup & Restore", lines: [["b", "Velero plugin on the DPA"], ["b", "Location, policy, recipes"], ["b", "Transform, assignment"], ["m", "ibm-backup-restore/"]] },
          { role: "pri", eye: "04 · Helper", title: "Recipe helper", lines: [["b", "Project, service account"], ["b", "ClusterRole and binding"], ["b", "UBI deployment with curl"], ["m", "recipe-helper/"]] },
          { role: "neu", eye: "05 · Operations", title: "Back up and restore", lines: [["b", "Backup from UI or CR"], ["b", "Restore maps helper ns"], ["b", "Check enterprise license"], ["m", "operations/*.yaml"]] }
        ];
        const y = 104, w = 212, h = 148;
        cards.forEach(function (k, i) {
          const x = 40 + i * 228;
          node(c, Object.assign({ x: x, y: y, w: w, h: h }, k));
          if (i < 4) arrow(c, { d: "M" + (x + w + 2) + " " + (y + 42) + "H" + (x + w + 14), role: "neu" });
        });
        // Where each step's commands run.
        ["storage console", "oc · cluster-admin", "oc · ibm-spectrum-fusion-ns", "oc · every cluster", "Fusion UI or oc"].forEach(function (s, i) {
          txt(c, 40 + i * 228 + w / 2, y + h + 26, s, "m", ' text-anchor="middle"');
        });
      }
    },
    {
      key: "layouts", file: "docs/images/layouts.svg", name: "Namespace layouts", W: 1200, H: 612,
      alt: "Namespace layouts: IBM's sample puts the Db2u operator and the instance in one namespace, so a backup carries both. The production layout gives the operator its own GitOps-managed namespace and each instance its own namespace and backup scope.",
      cap: "IBM's sample backs up the operator with the database. In production, GitOps owns the operator and Fusion protects each instance namespace on its own.",
      delta: "New figure. Each layout shows its backup scope, so the difference is what Fusion copies, not only where the boxes sit.",
      draw: function (c) {
        frame(c, 1200, 612, "Namespace layouts", "IBM's sample keeps the operator with the instance. Production clusters give the operator its own namespace.", "");
        function bullets(x, y, role, title, items) {
          txt(c, x, y, title, "gh");
          items.forEach(function (s, i) {
            const by = y + 30 + i * 26;
            c.g.push('<rect x="' + x + '" y="' + (by - 8) + '" width="6" height="6" style="fill:var(--' + role + 'L)"/>');
            txt(c, x + 16, by, s, "b");
          });
        }

        // IBM sample: one namespace holds the operator and the instance, and the backup takes both.
        group(c, { x: 40, y: 104, w: 540, h: 468, title: "IBM sample layout", meta: "one namespace" });
        node(c, { x: 64, y: 152, w: 492, h: 240, role: "cau", eye: "Namespace · backup scope", title: "Shared namespace" });
        chipBox(c, { x: 88, y: 216, w: 444, h: 64, title: "Db2u operator", sub: "Subscription · OperatorGroup · CSV · manager pod" });
        chipBox(c, { x: 88, y: 312, w: 444, h: 64, title: "Db2uInstance", sub: "volumes · configmaps · secrets" });
        arrow(c, { d: "M310 282V308", label: "reconciles", lx: 322, ly: 299, anchor: "start", on: "cau" });
        bullets(64, 428, "cau", "Trade-offs of sharing a namespace", [
          "Project access spans the operator and the database",
          "Backups carry operator and OLM objects",
          "Deleting the project removes both",
          "Restores only into the same namespace"
        ]);

        // Production: the operator namespace is GitOps-managed and outside every backup.
        group(c, { x: 620, y: 104, w: 540, h: 468, title: "Production layout", meta: "namespace per instance" });
        node(c, { x: 644, y: 152, w: 492, h: 100, role: "neu", eye: "Namespace · not backed up", title: "db2-operator", lines: [["m", "Db2u operator · managed by GitOps"]] });
        node(c, { x: 644, y: 300, w: 236, h: 92, role: "sec", eye: "Namespace · backup scope", title: "Instance A", lines: [["m", "Db2uInstance + volumes"]] });
        node(c, { x: 900, y: 300, w: 236, h: 92, role: "sec", eye: "Namespace · backup scope", title: "Instance B", lines: [["m", "Db2uInstance + volumes"]] });
        arrow(c, { d: "M890 254V276H762V296", role: "neu" });
        arrow(c, { d: "M890 276H1018V296", role: "neu" });
        label(c, "reconciles", 902, 270, "start", "group");
        bullets(644, 428, "sec", "Benefits of separate namespaces", [
          "Access scoped to each instance",
          "Operator rebuilt from GitOps, not restored",
          "Fusion backs up only the database",
          "Restore into another namespace"
        ]);
      }
    },
    {
      key: "architecture", file: "docs/images/architecture.svg", name: "Recipe topology", W: 1200, H: 656,
      alt: "Recipe topology: the policy assignment names the parent recipe, which finds the child by label. The parent runs helper-exec in the helper pod, which patches the Db2uInstance and Db2uEngine. The child runs manage_snapshots in dashmpp-head-0. The operator reconciles but runs no hooks. Only db2u-instance is backed up.",
      cap: "The parent pauses the instance through API calls from the helper pod, the child execs into dashmpp-head-0, and only db2u-instance is backed up.",
      delta: "Arrows now name each call and land on the object they touch. The step lists moved out; the README already has them under How it works.",
      draw: function (c) {
        frame(c, 1200, 656, "Recipe topology", "The parent pauses the instance from the helper pod. The child snapshots it. Nothing runs in db2-operator.", "FIG 2");
        group(c, { x: 40, y: 104, w: 360, h: 512, title: "IBM Fusion", meta: "ibm-spectrum-fusion-ns" });
        group(c, { x: 500, y: 104, w: 660, h: 512, title: "OpenShift cluster", meta: "workload namespaces" });

        node(c, { x: 72, y: 152, w: 296, h: 100, role: "neu", eye: "Assignment", title: "Policy assignment", lines: [["m", "recipe: db2u-instance-helper-parent"]] });
        node(c, { x: 72, y: 296, w: 296, h: 140, role: "pri", eye: "Parent recipe", title: "db2u-instance-helper-parent", lines: [["b", "Pause and unpause the instance"], ["b", "Set the target display name"], ["m", "hooks run in the helper pod"]] });
        node(c, { x: 72, y: 484, w: 296, h: 116, role: "sec", eye: "Child recipe", title: "db2u-instance-helper-child", lines: [["b", "instance-backup, instance-restore"], ["m", "found by parent-recipe label"]] });
        arrow(c, { d: "M220 254V292", label: "names", lx: 232, ly: 278, anchor: "start", on: "group" });
        arrow(c, { d: "M220 438V480", label: "finds by label", lx: 232, ly: 464, anchor: "start", on: "group" });

        node(c, { x: 532, y: 152, w: 596, h: 116, role: "pri", eye: "Namespace", title: "db2u-bnr-recipe-helper", lines: [["b", "Helper pod: curl and its own service account"], ["m", "not backed up · every Restore maps it to itself"]] });
        node(c, { x: 532, y: 300, w: 596, h: 200, role: "sec", eye: "Namespace · backup scope", title: "db2u-instance" });
        chipBox(c, { x: 556, y: 372, w: 164, h: 64, role: "sec", title: "dashmpp-head-0", sub: "container db2u" });
        chipBox(c, { x: 748, y: 372, w: 164, h: 64, role: "sec", title: "Db2uInstance", sub: "dwdb" });
        chipBox(c, { x: 940, y: 372, w: 164, h: 64, role: "sec", title: "Db2uEngine", sub: "db2wh engine" });
        txt(c, 846, 476, "configmaps · secrets · PVCs", "m");
        node(c, { x: 532, y: 532, w: 596, h: 68, role: "neu", eye: "Namespace", title: "db2-operator", aside: "not backed up · no recipe hooks" });

        arrow(c, { d: "M368 330H450V210H528", role: "pri", label: "helper-exec", lx: 409, ly: 322, on: "bg" });
        arrow(c, { d: "M368 542H470V456H638V440", role: "sec", label: "exec manage_snapshots", lx: 548, ly: 460, anchor: "start", on: "sec" });
        arrow(c, { d: "M830 268V368", role: "pri" });
        arrow(c, { d: "M1022 268V368", role: "pri" });
        label(c, "PATCH maintenance-pause-reconcile", 818, 289, "end", "group");
        arrow(c, { d: "M830 532V440", role: "neu", label: "reconciles", lx: 842, ly: 521, anchor: "start", on: "group" });
      }
    },
    {
      key: "transform", file: "docs/images/transform.svg", name: "Cross-namespace restore", W: 1200, H: 580,
      alt: "Cross-namespace restore: namespaceMapping moves objects from db2u-instance to db2u-instance-dev, the Transform rewrites affinity and environment labels from prod to dev and adds backup=restored on the instance and PVCs, and helper-exec sets the Project display name. The helper namespace maps to itself.",
      cap: "On a restore into db2u-instance-dev, namespaceMapping moves the objects, the Transform rewrites the environment fields, and the helper renames the Project.",
      delta: "Drawn as a field-by-field diff, so each before and after value sits beside the mechanism that changes it. Adds the PVC labels.",
      draw: function (c) {
        frame(c, 1200, 580, "Cross-namespace restore", "What each field on the restored objects becomes, and what changes it.", "FIG 3");
        group(c, { x: 24, y: 96, w: 1152, h: 452 });
        const hy = 126;
        txt(c, 48, hy, "FIELD", "hd");
        txt(c, 340, hy, "SOURCE · db2u-instance", "hd");
        txt(c, 700, hy, "CHANGED BY", "hd", ' text-anchor="middle"');
        txt(c, 860, hy, "TARGET · db2u-instance-dev", "hd");
        c.g.push('<path d="M48 138H1152" style="stroke:var(--line)" stroke-width="1"/>');
        const rows = [
          ["Namespace", "metadata.namespace", "db2u-instance", "namespaceMapping", "neu", "db2u-instance-dev"],
          ["Db2uInstance", "affinity … values[0]", "prod", "Transform · replace", "pri", "dev"],
          ["Db2uInstance", "label my.cluster/environment", "prod", "Transform · replace", "pri", "dev"],
          ["Db2uInstance", "label backup", "(none)", "Transform · add", "pri", "restored"],
          ["PVCs", "labels environment, backup", "prod, (none)", "Transform · add", "pri", "dev, restored"],
          ["Project", "openshift.io/display-name", "DB2U Instance (PROD)", "helper-exec · set-display-name", "pri", "DB2U Instance (Restored)"],
          ["Helper namespace", "fixed in the parent recipe", "db2u-bnr-recipe-helper", "namespaceMapping", "neu", "db2u-bnr-recipe-helper", true]
        ];
        const rh = 56;
        rows.forEach(function (r, i) {
          const y0 = 138 + i * rh, cy = y0 + 29, role = r[4], same = r[6];
          txt(c, 48, y0 + 25, r[0], "h");
          txt(c, 48, y0 + 44, r[1], "m");
          txt(c, 340, y0 + 33, r[2], "mv", ' style="fill:var(--muted)"');
          const cw = r[3].length * MW + 22, cl = 700 - cw / 2, cr = 700 + cw / 2;
          arrow(c, { d: "M560 " + cy + "H" + (cl - 6), role: role, noHead: true, dash: "2 3" });
          arrow(c, { d: "M" + (cr + 6) + " " + cy + "H850", role: role });
          const T = c.T;
          c.g.push('<rect x="' + cl.toFixed(1) + '" y="' + (cy - 12) + '" width="' + cw.toFixed(1) + '" height="24" rx="12" style="fill:var(--' + role + "F);stroke:" + (T.kind === "flat" ? "none" : "var(--" + role + "L)") + '" stroke-width="1"/>');
          txt(c, 700, cy + 4, r[3], "lab", ' text-anchor="middle" style="fill:var(--' + role + 'I)"');
          if (same) {
            txt(c, 860, y0 + 33, r[5], "mv", ' style="fill:var(--muted)"');
            txt(c, 1152, y0 + 33, "unchanged", "m", ' text-anchor="end"');
          } else {
            const tw = r[5].length * 7.2 + 20;
            c.g.push('<rect x="856" y="' + (cy - 13) + '" width="' + tw.toFixed(1) + '" height="26" rx="5" style="fill:var(--' + role + 'F)"/>');
            txt(c, 866, y0 + 33, r[5], "mv", ' style="fill:var(--' + role + 'I)"');
          }
          if (i < rows.length - 1) c.g.push('<path d="M48 ' + (y0 + rh) + 'H1152" style="stroke:var(--line)" stroke-width="1" stroke-dasharray="1 3"/>');
        });
      }
    },
    {
      key: "failover", file: "docs/images/failover.svg", name: "Backup failure undo", W: 1200, H: 452,
      alt: "Backup failure undo: the backup pauses the instance, pauses the engine, suspends writes and snapshots the volumes. A failure at any of the later steps runs the inverseOp of every step already completed, newest first: resume writes, unpause the engine, unpause the instance.",
      cap: "A failure at any step runs the inverseOp of every step already completed, newest first. A failed suspend unpauses the engine and then the instance; a failed snapshot also resumes writes first.",
      delta: "Each undo now sits under the step whose failure starts it, so every failure point drops straight into the undo chain.",
      draw: function (c) {
        frame(c, 1200, 452, "Backup failure undo", "Each quiesce step names an inverseOp. A failure at any later step runs the completed steps' inverseOps, newest first.", "FIG 4");
        const y = 112, w = 212, h = 104;
        const fwd = [
          { role: "pri", eye: "1 · Pause", title: "Db2uInstance", lines: [["m", "maintenance-mode-on"]] },
          { role: "pri", eye: "2 · Pause", title: "Db2uEngine", lines: [["m", "engine-maintenance-mode-on"]] },
          { role: "cau", eye: "3 · Quiesce", title: "suspend", lines: [["m", "manage_snapshots"]] },
          { role: "neu", eye: "4 · Snapshot", title: "db2u-volumes", lines: [["m", "volume group"]] },
          { role: "sec", eye: "5 · Resume", title: "resume", lines: [["m", "normal path"]] }
        ];
        fwd.forEach(function (k, i) {
          const x = 40 + i * 228;
          node(c, Object.assign({ x: x, y: y, w: w, h: h }, k));
          if (i < 4) arrow(c, { d: "M" + (x + w + 2) + " " + (y + 42) + "H" + (x + w + 14), role: "neu" });
        });
        // Undo k sits under the step whose failure starts it, so each failure drops straight down.
        const uy = 300, uh = 116;
        const undo = [
          { x: 268, eye: "Undo · inverseOp", title: "Unpause instance", lines: [["m", "maintenance-mode-off"], ["b", "Reverses step 1"]] },
          { x: 496, eye: "Undo · inverseOp", title: "Unpause engine", lines: [["m", "engine-maintenance-mode-off"], ["b", "Reverses step 2"]] },
          { x: 724, eye: "Undo · inverseOp", title: "Resume writes", lines: [["m", "manage_snapshots resume"], ["b", "Reverses step 3"]] }
        ];
        undo.forEach(function (u) {
          node(c, Object.assign({ y: uy, w: w, h: uh, role: "dan" }, u));
          const cx = u.x + w / 2;
          arrow(c, { d: "M" + cx + " " + (y + h + 2) + "V" + (uy - 3), role: "dan", label: "fails", lx: cx, ly: 262, on: "bg", cls: "labd" });
        });
        node(c, { x: 40, y: uy, w: w, h: uh, role: "sec", eye: "Result", title: "Source in service", lines: [["m", "writable, reconciling"], ["b", "Not a failover"]] });
        arrow(c, { d: "M722 " + (uy + 46) + "H710", role: "dan" });
        arrow(c, { d: "M494 " + (uy + 46) + "H482", role: "dan" });
        arrow(c, { d: "M266 " + (uy + 46) + "H254", role: "dan" });
      }
    }
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

  function buildSVG(fig, s, id, forExport) {
    const c = { T: TREATS[s.treat], id: id, g: [], fig: "FIG " + (FIGS.indexOf(fig) + 1) };
    fig.draw(c);
    const head = '<svg xmlns="http://www.w3.org/2000/svg" id="' + id + '" viewBox="0 0 ' + fig.W + " " + fig.H + '"' +
      (forExport ? ' width="' + fig.W + '" height="' + fig.H + '"' : "") +
      ' role="img" aria-labelledby="' + id + "-t " + id + '-d">';
    return head + '<title id="' + id + '-t">' + esc(fig.name) + '</title><desc id="' + id + '-d">' + esc(fig.alt) + "</desc>" +
      "<style>" + styleBlock(id, s) + "</style>" + defs(c) + c.g.join("") + "</svg>";
  }


  const api = { TYPE, ROLES, BASE, PALETTES, TREATS, TREAT_NOTES, FIGS, buildSVG, esc, LOCKED: { pal: "carbon", treat: "outline", type: "plex" } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Db2uFigures = api;
})(this);
