# Diagram style

The README figures use one fixed style: **IBM Carbon** colours, the **Outline** treatment and **IBM Plex** type. New or changed figures follow it.

## Files

Each figure ships in four forms. The README and `docs/end-to-end.md` show them with a `<picture>` element, so GitHub picks the light or dark file from the reader's theme.

| File | Use |
| --- | --- |
| `<name>-light.svg`, `<name>-dark.svg` | README and docs. Colours are written in; no CSS variables |
| `<name>-light.png`, `<name>-dark.png` | Slides, wikis and anywhere SVG is not accepted. 2400 px wide, IBM Plex embedded in the pixels |
| `<name>.svg` | One file that follows the viewer's colour scheme through `prefers-color-scheme` |

Figures, numbered in README order: `deploy` (Fig 1), `layouts` (Fig 2), `architecture` (Fig 3), `transform` (Fig 4), `failover` (Fig 5). The number comes from the figure's position in `FIGS`, so a new figure goes where the README shows it.

## Change the wording

All the text in the figures lives in [`src/text.yaml`](src/text.yaml), grouped by figure: titles, box labels, lines, arrow labels, table rows and bullets. Layout and colour stay in `figures.js`, so a wording change never touches code.

Two ways to change it:

- **In the file.** Edit `src/text.yaml`, then run `npm run export` (below). The comments at the top of the file explain what can change: wording freely, and the length of some lists.
- **In the Db2u Diagram Styles artifact.** Turn on **Edit text**, click any label and type. The figure redraws as you type and says whether the text still fits. **Save** keeps the edit in the artifact; ask Claude to apply the saved edits, which copies them into `text.yaml` and re-exports.

Boxes don't grow to fit the text. `npm run export` measures every label with IBM Plex's real character widths and stops, writing nothing, if any text is missing or too long for its box. It names the key, the text and how much room there is, so you can shorten it or ask for the box to be widened.

## Change or regenerate a figure

Do not edit the SVGs by hand. They are built from [`src/`](src/):

| File | Role |
| --- | --- |
| [`src/text.yaml`](src/text.yaml) | Every word in the figures. Edit wording here |
| [`src/figures.js`](src/figures.js) | Layout, palettes, treatments and drawing code (`FIGS`). Edit here to move or resize boxes |
| [`src/preview.html`](src/preview.html) | Open in a browser to see every figure in light and dark, and to compare palettes and treatments |
| [`src/export.js`](src/export.js) | Checks the text fits, then writes all 25 files in this folder in the locked style |
| `src/text.js` | Written by the export from `text.yaml` so `preview.html` can show it. Don't edit |

Needs Node 18 or newer. From `docs/images/src`:

```bash
npm ci --ignore-scripts
```

```bash
npm run export
```

`--ignore-scripts` skips the IBM Plex packages' telemetry postinstall; the fonts don't need it. The exporter unpacks IBM Plex into `src/.fonts/` for the PNGs. That folder and `node_modules/` are git-ignored.

## Colour

Every value is a step on IBM's Carbon colour scale. Light follows Carbon's g10 theme, dark follows g100. A role means the same thing in every figure.

| Role | Means | Light: fill / stroke / text | Dark: fill / stroke / text |
| --- | --- | --- | --- |
| Primary | Fusion and recipe actions: parent recipe, helper-exec, Transform | `#EDF5FF` / `#0F62FE` / `#0043CE` | `#001141` / `#78A9FF` / `#A6C8FF` |
| Secondary | Db2 instance side: child recipe, instance namespace, manage_snapshots | `#D9FBFB` / `#007D79` / `#005D5D` | `#081A1C` / `#08BDBA` / `#3DDBD9` |
| Neutral | Context: operator, policy assignment, namespaceMapping | `#F4F4F4` / `#A8A8A8` / `#525252` | `#262626` / `#6F6F6F` / `#C6C6C6` |
| Caution | Quiesce: the database is suspended | `#FCF4D6` / `#B28600` / `#684E00` | `#1C1500` / `#D2A106` / `#FDDC69` |
| Danger | Failure and the undo path | `#FFF1F1` / `#A2191F` / `#750E13` | `#2D0709` / `#FA4D56` / `#FFB3B8` |

| Base | Light | Dark |
| --- | --- | --- |
| Canvas | `#F4F4F4` | `#161616` |
| Surface | `#FFFFFF` | `#262626` |
| Rule | `#E0E0E0` | `#393939` |
| Text | `#161616` | `#F4F4F4` |
| Secondary text | `#525252` | `#C6C6C6` |
| Labels | `#8D8D8D` | `#8D8D8D` |
| Grid dots | `#E8E8E8` | `#1F1F1F` |

Danger uses Red 70 in light mode rather than Carbon's usual error red (Red 60), which is too loud next to the greys.

## Outline treatment

- Canvas: the canvas colour with a 16 px dot grid; 10 px corner radius.
- Boxes: surface fill, 1 px stroke in the role colour, 4 px radius. A 7 px square in the role colour sits before the label.
- Groups (Fusion, the cluster, the restore table): 1 px dashed border (5 on, 4 off) in the label grey, 8 px radius.
- Arrows: 1.25 px, open chevron heads. Each arrow names the call it stands for (`helper-exec`, `PATCH maintenance-pause-reconcile`), set on a pill of the background colour.
- Colour sits on strokes, markers and labels. Fills stay neutral except the value pills in Fig 3.

## Type

| Use | Face | Size |
| --- | --- | --- |
| Figure title | IBM Plex Sans SemiBold | 20 px |
| Subtitle, body lines | IBM Plex Sans Regular | 13 px, 12.5 px |
| Box title | IBM Plex Sans SemiBold | 14 px |
| Box label (eyebrow) | IBM Plex Mono SemiBold, uppercase, 0.06 em tracking | 10.5 px |
| Names, paths, values | IBM Plex Mono Regular / Medium | 11 px / 12 px |
| Arrow labels | IBM Plex Mono Regular | 10.5 px |

GitHub shows README images without web fonts, so the SVGs fall back to the system stack (San Francisco, Segoe UI, Helvetica, Arial; Menlo or Consolas for mono). The PNGs always use IBM Plex.

## Layout

- Canvas 1200 px wide, 40 px outer margin, 8 px grid.
- Title baseline at 52, subtitle at 76, content from 104.
- Inside a box: label at +22, title at +46, lines from +68 every 19 px, 16 px side padding.
- `FIG n` in mono at the top right, numbered in README order.
