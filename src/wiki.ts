// Player wiki: site/wiki/*.html from the game's own text (ticket titles, briefs, bench specs, the parts tray, chapter blurbs).
// `WIKI_WRITE=1 npx vitest run src/wiki.test.ts` writes it; the test fails when the committed pages are stale.
import { t } from './i18n';
import { LEVEL_DEFS, type LevelDef } from './data/levels';
import { PARTS } from './data/parts';
import { REGIONS } from './regions';

const R = REGIONS.get('global').strings;
const vars = (def?: LevelDef) => ({ customer: def ? R[`customer.${def.customer}`] ?? '' : '', mentor: R.mentor, stall: R.stall, lane: R.lane });
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const partName = (id: string): string => { const d = PARTS.find((p) => p.id === id); return d ? t(d.nameKey) : id; };

/** What a repair arrives with (decision 10b). Same words as the case-open line on the workbench (godot/look2/workbench.gd OPEN_LINE). */
export const ARRIVES: Record<string, string> = {
  '1-1': 'The LED sits straight across the 9 V clip, no resistor. It is dark now.',
  '1-2': 'Three LEDs in series on one resistor, too dim to be seen.',
  '1-3': 'A link wire puts the full 12 V on the heater element. It needs 8 V.',
  '1-4': 'The load resistor is burnt.',
  '2-1': 'A divider sized without the ADC on it: 5.6 kilohm over 3.3 kilohm reads 2.76 V, not 3.3 V.',
  '2-3': 'A sealed module nobody makes any more. Measure it, then build its twin.',
  '5-1': 'Q1 is burnt, and nothing across the fan catches its turn-off kick.',
};
const NEW_LOOK = new Set(['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-3', '5-1']);

function page(title: string, desc: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="stylesheet" href="../style.css">
</head>
<body class="wiki">
<header class="nav"><a class="logo" href="../">CIRCUITS</a><nav><a href="./">Wiki</a><a href="controls.html">Controls</a><a href="../#download" class="btn mini">Download</a></nav></header>
<main class="wrap">
${body}
</main>
<footer class="foot wrap"><p>Generated from the game's own text by <code>src/wiki.ts</code>. People and places are made up; the circuits are not. <a href="https://github.com/blackmetaltech/circuits">Source</a></p></footer>
</body>
</html>
`;
}

function chapterPage(ch: number, defs: LevelDef[]): string {
  const tickets = defs.map((d) => {
    const specs = d.bench.specs.filter((x) => d.bench.names[x.id]).map((x) => `<li>${esc(t(d.bench.names[x.id]!))}</li>`).join('');
    const parts = [...new Set(d.bin.map((b) => partName(b.partId)))].map(esc).join(', ');
    const arrives = ARRIVES[d.id] ? `<p class="arrives"><b>Arrives:</b> ${esc(ARRIVES[d.id]!)}</p>` : '';
    const look = NEW_LOOK.has(d.id) ? '<span class="tag">new look</span>' : '<span class="tag dim">classic look</span>';
    return `<section class="ticket" id="t${d.id}">
<h2>${d.id} · ${esc(t(d.titleKey))} ${d.eb ? '<span class="tag">exam</span>' : ''}${look}</h2>
<p>${esc(t(d.briefKey, vars(d)))}</p>
${arrives}<h3>The bench checks</h3>
<ul>${specs}</ul>
<p class="parts"><b>Parts tray:</b> ${parts}</p>
</section>`;
  }).join('\n');
  const title = t(`chapter.${ch}.title`);
  return page(`Chapter ${ch} · ${title} · CIRCUITS wiki`, `CIRCUITS chapter ${ch}: every ticket, what the bench checks and the parts you get.`,
    `<p class="crumbs"><a href="./">Wiki</a> / Chapter ${ch}</p>
<h1>Chapter ${ch} · ${esc(title)}</h1>
<p class="lede">${esc(t(`chapter.${ch}.blurb`, vars()))}</p>
${tickets}`);
}

function indexPage(chapters: number[]): string {
  const list = chapters.map((ch) => {
    const names = LEVEL_DEFS.filter((d) => d.chapter === ch).map((d) => esc(t(d.titleKey))).join(' · ');
    return `<li><a href="chapter-${ch}.html"><b>Chapter ${ch} · ${esc(t(`chapter.${ch}.title`))}</b></a><span>${names}</span></li>`;
  }).join('');
  return page('CIRCUITS wiki', 'Player guide to CIRCUITS: every repair ticket, what the bench checks, and the controls.',
    `<p class="crumbs">Wiki</p>
<h1>CIRCUITS wiki</h1>
<p class="lede">Every ticket in the game, what the bench checks before it pays, and the parts you get.</p>
<h2>How a job works</h2>
<ol class="how">
<li><b>Take the ticket.</b> The customer's words, the specs the fix must meet, the pay.</li>
<li><b>Open the case.</b> A repair comes with the customer's own faulty board. Probe it with the meter or the scope before you change it.</li>
<li><b>Fix it.</b> Remove the bad work, place parts from the tray, wire them pad to pad.</li>
<li><b>Power and test.</b> The bench test checks every spec in every condition with the power on. A part you burn comes out of the pay.</li>
<li><b>Hand it back.</b> The lid goes on and the customer takes the device home.</li>
</ol>
<h2>The chapters</h2>
<ul class="chapters">${list}</ul>
<p>Chapter 1 and ticket 5-1 play on the new 3D workbench. The rest play in the classic 2D stall; the switch is on both title screens.</p>
<h2>Free bench</h2>
<p>Any part, the bench supply, the scope and the meter, with three save slots. On the workbench title.</p>
<h2>Testbed</h2>
<p>Load a pocket torch, a weather station input or a fan driver with its working board. Probe it, break it on purpose, then pause and step time to watch what happens.</p>`);
}

function controlsPage(): string {
  const rows: [string, string][] = [
    ['Left click a tray tile, then a pad', 'Place the part'], ['R', 'Turn the part before you place it'], ['W, then two pads', 'Run a wire'],
    ['Right click a part or a wire', 'Remove it'], ['Space', 'Power on or off'], ['Enter', 'Bench test'], ['M', 'Meter leads (red, then black)'],
    ['P', 'Scope probe'], ['Tab', 'Schematic'], ['Ctrl+Z', 'Undo'], ['1 to 5', 'Camera views (5 looks straight down on the board)'],
    ['Right drag / middle drag / wheel', 'Orbit / pan / zoom'], ['Esc', 'Select tool'],
    ['Wheel over a part on the board', 'Change its value in place (the wires stay)'], ['Wheel over the sorting box', 'Pick another value of that part'],
    ['Wheel over the VOLTAGE knob', 'Set the bench supply'], ['Left and Right, or the wheel over the slide wire', 'Move the jockey (J changes the step)'],
    ['K', 'Testbed: pause or run the simulation'], ['L', 'Testbed: one frame forward while paused'],
  ];
  const pad: [string, string][] = [
    ['Left stick', 'Move the cursor ring (it slows over anything it can act on)'], ['A / B', 'Click / right click at the ring'],
    ['LB / RB', 'Wheel down / up at the ring'], ['X', 'Power'], ['Y', 'Bench test'], ['D-pad up / down', 'Wire tool / meter leads'],
    ['D-pad left / right', 'Camera views'], ['Back', 'Schematic'], ['Start', 'Select tool / menu'], ['Right stick', 'Orbit the view'],
    ['Left stick press', 'Testbed: pause or run'], ['Right stick press', 'Testbed: step; on a job: the jockey step size'],
  ];
  return page('Controls · CIRCUITS wiki', 'Keys and mouse for the CIRCUITS workbench.',
    `<p class="crumbs"><a href="./">Wiki</a> / Controls</p>
<h1>Controls (workbench)</h1>
<table class="keys"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<h2>Gamepad</h2>
<table class="keys"><tbody>${pad.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<p>The pad rumbles on power, on a pass and on a burn. The classic stall has its own controls on its help page.</p>`);
}

/** Every page: file name to HTML. */
export function wikiPages(): Record<string, string> {
  const chapters = [...new Set(LEVEL_DEFS.map((d) => d.chapter))].filter((c) => c > 0).sort((a, b) => a - b);
  const out: Record<string, string> = { 'index.html': indexPage(chapters), 'controls.html': controlsPage() };
  for (const ch of chapters) out[`chapter-${ch}.html`] = chapterPage(ch, LEVEL_DEFS.filter((d) => d.chapter === ch));
  return out;
}
