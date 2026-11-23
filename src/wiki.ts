// Player wiki: site/wiki/*.html from the game's own text (ticket titles, briefs, bench specs, the parts tray, chapter blurbs).
// `WIKI_WRITE=1 npx vitest run src/wiki.test.ts` writes it; the test fails when the committed pages are stale.
import { t } from './i18n';
import { LEVEL_DEFS, type LevelDef } from './data/levels';
import { PARTS } from './data/parts';
import { REGIONS } from './regions';
import pkg from '../package.json';

const VERSION: string = (pkg as { version: string }).version;

const R = REGIONS.get('global').strings;
const vars = (def?: LevelDef) => ({ customer: def ? R[`customer.${def.customer}`] ?? '' : '', mentor: R.mentor, stall: R.stall, lane: R.lane });
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const partName = (id: string): string => { const d = PARTS.find((p) => p.id === id); return d ? t(d.nameKey) : id; };

/** What is on the bench when the case opens: the workbench's own open line (godot/look2/workbench.gd OPEN_LINE), without "Case open.". */
export const ARRIVES: Record<string, string> = {
  '1-1': "The LED sits straight across the 9 V clip with no resistor: fit one in series with it.",
  '1-2': "Three LEDs in series on one resistor. Measure the current before you change anything.",
  '1-3': "A link wire puts the full 12 V on the heater element. It needs 8 V.",
  '1-4': "The load resistor is burnt. Measure the pack before you choose a new one.",
  '1-5': "Predict first, then build and probe.",
  '2-1': "5.6 k over 3.3 k into the ADC. Measure OUT with the meter before you swap anything.",
  '2-2': "The cable reel is the loop X, the slide wire is the bridge. Wire them to the cell and the galvanometer, then slide the jockey until the needle sits on zero.",
  '2-3': "The sealed box sits at the lower left. Meter it: volts open, then amps short. Then set the supply: key 4 shows its VOLTAGE knob.",
  '2-4': "Predict first, then build the potentiometer and slide the jockey to the balance.",
  '3-1': "10 k and 22 uF make the timer. Watch OUT on the scope before you change anything.",
  '3-2': "The button and the pull-up are soldered on, with no filter between SW and OUT. Look at OUT on the scope first.",
  '3-3': "The relay coil is on the 24 V rail behind 560 ohm. Look at the coil current on the scope before you change anything.",
  '3-4': "Predict first, then build both cards and let the bench measure them.",
  '4-1': "The transformer is soldered in; its mains side sits in the red square. Build the bridge and the capacitor on the 12 V side.",
  '4-2': "IN to OUT is empty. A resistor from IN to OUT and a Zener from OUT to GND, banded end on OUT.",
  '4-3': "The regulator goes between IN and OUT. Switch on the thermal camera (T) and watch it heat before you choose a heatsink.",
  '4-4': "Your own board. An LM317, two resistors, and 3.30 V on OUT at every load.",
  '4-5': "Predict first, then build and probe.",
  '5-1': "Q1 is burnt, and nothing across the fan catches its turn-off kick.",
  '5-2': "The strip is soldered on. GATE comes from a 3.3 V pin: the FET has to switch fully on from that.",
  '5-3': "Empty board. Diodes, a transistor and resistors: make Y low only when A and B are both high.",
  '5-4': "IN from the synth, OUT to the amplifier. One transistor, gain about ten.",
  '5-5': "Predict first, then build and probe.",
  '6-1': "A TL072 on +-12 V. Look where the 470 k feedback resistor lands: pin 3 is the + input.",
  '6-2': "The probe feeds 10 k into pin 2, and the probe itself sits behind 100 k.",
  '6-3': "One LM358 stage at a gain of 100. The second op-amp in the chip (pins 5 to 7) is unused.",
  '6-4': "An LM741 drives the cleaner. Clip the scope on OUT and look at the shape.",
  '6-5': "The NTC probe sits on the 5 V pad. An LM393 compares it with half of 5 V, with nothing from OUT back to pin 3.",
  '6-6': "Your own generator. 11 k in, 22 nF from OUT to pin 2, and nothing else across the capacitor.",
  '6-7': "Predict first, then build and probe.",
};

/** Each job's still on the workbench (fixed and powered), shot from the game by the release's shot sweep. */
export const JOB_SHOT = (id: string): string => `assets/jobs/${id}.jpg`;
export const TESTBED_SHOT = (id: string): string => `assets/testbed/${id}.jpg`;
const TESTBED: [string, string, string][] = [
  ['torch', 'Pocket torch', 'A 9 V battery, a resistor and an LED. Breaks: a wire across the resistor, or 47 ohm in its place.'],
  ['station', 'Weather station input', 'A divider feeds the ADC. Breaks: the builder\'s divider, or the top resistor shorted.'],
  ['fan', 'Fan driver', 'A transistor switches a fan. Breaks: no flyback diode, or no base resistor.'],
  ['charger', 'Phone charger stage', 'A transformer, four diodes and a capacitor make smooth DC. Breaks: no smoothing capacitor, or one diode lost.'],
  ['dimmer', 'Lamp dimmer', 'A knob sets the current through an LED strip. Breaks: the emitter resistor shorted, or the wiper wire off.'],
  ['relay_timer', 'Relay timer', 'A capacitor charges, a transistor follows, and the relay clicks after about 2 s. Breaks: no capacitor, or 470 uF in place of 220 uF.'],
];

function page(title: string, desc: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#120f0c">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;600&display=swap">
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
    const arrives = ARRIVES[d.id] ? `<p class="arrives"><b>On the bench:</b> ${esc(ARRIVES[d.id]!)}</p>` : '';
    return `<section class="ticket" id="t${d.id}">
<h2>${d.id} · ${esc(t(d.titleKey))} ${d.eb ? '<span class="tag">exam</span>' : ''}</h2>
<figure class="shot"><img src="${JOB_SHOT(d.id)}" alt="${esc(`${d.id} ${t(d.titleKey)} on the workbench, fixed and powered`)}" width="960" height="540" loading="lazy"></figure>
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

/** Chapters 6 to 8 are designed (docs/DESIGN.md §2.7) and not built. */
const PLANNED: [string, string][] = [
  ['Chapter 7 · Tone & Resonance', 'Reactance, RMS, RC filters and Bode plots, series LCR resonance and Q, active filters.'],
  ['Chapter 8 · Oscillate', 'The 555 astable, the phase-shift oscillator, a buck converter, a synth voice.'],
];

function indexPage(chapters: number[]): string {
  const jobs = LEVEL_DEFS.filter((d) => d.chapter > 0).length;
  const list = chapters.map((ch) => {
    const defs = LEVEL_DEFS.filter((d) => d.chapter === ch);
    const names = defs.map((d) => esc(t(d.titleKey))).join(' · ');
    const first = defs[0]!;
    return `<li><a href="chapter-${ch}.html"><img src="${JOB_SHOT(first.id)}" alt="${esc(`${first.id} ${t(first.titleKey)} on the workbench`)}" width="960" height="540" loading="lazy"><b>Chapter ${ch} · ${esc(t(`chapter.${ch}.title`))}</b><span>${names}</span></a></li>`;
  }).join('');
  return page('CIRCUITS wiki', 'Player guide to CIRCUITS: every repair ticket, what the bench checks, and the controls.',
    `<p class="crumbs">Wiki</p>
<h1>CIRCUITS wiki</h1>
<p class="lede">Every job in the game, what the bench checks before it pays, and the parts you get.</p>
<h2>How a job works</h2>
<ol class="how">
<li><b>Take the ticket.</b> The customer's words, the specs the fix must meet, the pay.</li>
<li><b>Open the case.</b> A repair comes with the customer's own faulty board. Probe it with the meter or the scope before you change it.</li>
<li><b>Fix it.</b> Remove the bad work, place parts from the tray, wire them pad to pad.</li>
<li><b>Power and test.</b> The bench test checks every spec in every condition with the power on. A part you burn comes out of the pay. A customer who waits tips 40 % of the fee on a first-test pass; each failed test takes a quarter of it.</li>
<li><b>Hand it back.</b> The lid goes on and the customer takes the device home.</li>
</ol>
<h2>What is in the game now</h2>
<p class="status">Version ${esc(VERSION)}: ${chapters.length} chapters and ${jobs} jobs, all on the 3D workbench. A testbed of ${TESTBED.length} devices. A free bench. Mouse and gamepad.</p>
<h2>The chapters</h2>
<ul class="chapters">${list}</ul>
<p>The classic 2D stall is an option under Settings on the title.</p>
<h2>Planned, not built yet</h2>
<ul class="planned">${PLANNED.map(([n, what]) => `<li><b>${esc(n)}</b><span>${esc(what)}</span></li>`).join('')}</ul>
<h2>Money</h2>
<ul>
<li>Each job pays its fee, plus a bonus for each new star.</li>
<li>A customer who waits tips 40 % of the fee for a pass on the first bench test. Each failed test takes a quarter of the tip. On 1-1 a failed test costs nothing.</li>
<li>A part you burn is a rush order: the part plus a courier fee, out of your pay.</li>
<li>The condition dial costs $15.00. With it, the live bench runs any of the ticket's test conditions, such as a tired battery, so you can check before you test. It is free on the testbed and the free bench.</li>
</ul>
<h2>Testbed</h2>
<p>Known devices with their working boards. Probe one live, break it on purpose, then pause (K) and step (L) time to watch what happens.</p>
<div class="rigs">${TESTBED.map(([id, n, what]) => `<figure><img src="${TESTBED_SHOT(id)}" alt="${esc(`${n} on the testbed`)}" width="960" height="540" loading="lazy"><figcaption><b>${esc(n)}.</b> ${esc(what)}</figcaption></figure>`).join('')}</div>
<h2>Free bench</h2>
<p>Any part, the bench supply, the scope and the meter, with three save slots. On the title.</p>`);
}

function controlsPage(): string {
  const rows: [string, string][] = [
    ['Left click a tray tile, then a pad', 'Place the part'], ['R', 'Turn the part before you place it'], ['W, then two pads', 'Run a wire'],
    ['Right click a part or a wire', 'Remove it (a burnt part: fit a fresh one, wires kept)'], ['Space', 'Power on or off'], ['Enter', 'Bench test'], ['M', 'Meter leads (red, then black)'],
    ['P', 'Scope probe'], ['Tab', 'Schematic'], ['Ctrl+Z', 'Undo'], ['1 to 5', 'Camera views (5 looks straight down on the board)'],
    ['Right drag / middle drag / wheel', 'Orbit / pan / zoom'], ['Esc', 'Select tool'],
    ['Rest on a part, then wheel', 'Change its value in place (the wires stay); on a knob, turn it'], ['T', 'Thermal camera (chapter 4)'], ['Wheel over the sorting box', 'Pick another value of that part'],
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
