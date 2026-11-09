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
  'solve.noConverge': 'The solver could not settle this circuit.',
};
