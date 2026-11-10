// Player-facing strings of the simulator (src/sim): topology explanations, solver failures, rating/smoke explainers.
// Spread into locales/en.ts. src/sim returns keys + vars, never English text.
export const simEn: Record<string, string> = {
  'topo.island': 'Unpowered island: {nodes} is not connected to the ground reference, so nothing here is driven. Connect it to GND.',
  'topo.dcFloating': 'No DC path to ground at {nodes}: its voltage is decided by leakage, which a real circuit does not promise.',
  'topo.vloop': 'These sources fight each other: {elements} form a loop of ideal voltage sources and wires with no resistance, so the current would be infinite. Put a resistor in the loop.',
  'topo.shorted': '{element} has both ends on the same node {node}: an ideal source or meter shorted on itself. Move one end.',
  'topo.shortedReal': '{element} is shorted on itself at node {node}: a huge current flows through its internal resistance and it will heat up.',
  'topo.cutset': 'That current has nowhere to go: {elements} pushes current into {nodes}, which has no DC path to ground. Give it a way back.',
  'topo.unconnected': 'Pin of {element} at {node} is not connected to anything.',
  'solve.singular': 'The solver cannot find one answer for this circuit. Check {nodes} and {elements}: something is floating or two parts demand contradictory voltages.',
  'solve.badValue': 'A part value is not usable: {detail}.',
  'tran.noConverge': 'The simulation could not advance past t = {t} s even with the smallest step; the circuit changes too violently near {where}.',
  'solve.noConverge': "The solver couldn't settle this circuit; it was still moving at {node} (parts there: {elements}). Usually: a loop of diodes with no resistance, or a latch with two stable states and nothing to pick one. Try adding a resistor here.",
  'bench.level.fail': '{probe} measured {value} in the {cond} test, outside the allowed {lo} to {hi}.',
  'bench.metric.fail': '{metric} of {probe} measured {value} in the {cond} test, outside the allowed {lo} to {hi}.',
  'bench.metric.nan': '{metric} of {probe} could not be measured in the {cond} test (the signal never did what it needs to).',
  'bench.band.fail': '{probe} left the target band in the {cond} test: {count} samples outside, first at t = {t} s with {value}; the tolerance is {dv} up or down and {dt} s sideways.',
  'bench.mask.fail': 'Gain or phase at {f} Hz is {value} in the {cond} test, outside the allowed {lo} to {hi} for {f1} to {f2} Hz.',
  'bench.rating.violation': '{part} was over its {what} rating in the {cond} test: {value} against a limit of {limit}.',
  'bench.rating.smoked': '{part} smoked in the {cond} test.',
  'bench.safety.fail': 'Safety rule {rule} is not met ({detail}).',
  'bench.settle.fail': 'The circuit had not settled into a steady cycle after {periods} periods in the {cond} test.',
};
