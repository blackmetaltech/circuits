// MNA element / device interface (DESIGN §3.1-§3.7, §3.10). READ THIS FIRST when adding a device.
//
// Pipeline:   Board ──expand (netlist.ts)──▶ Netlist ──compile (compile.ts)──▶ Circuit ──op/tran/ac──▶ x
//             cards ──parse (netlist.ts)───▲
//
// UNKNOWN VECTOR  x = [ v(1..n) | v(internal 1..k) | i(branch 1..m) ]          dim = n + k + m
//   n  node voltages, ground (netlist node 0) dropped: node id j ≥ 1 sits at matrix index j − 1.
//   k  internal nodes requested by devices (diode Rs node, macro nodes). Indices n .. n+k−1.
//   m  branch currents requested by devices (voltage sources, inductors, VCVS, ammeters, op-amp outputs...).
//      Indices n+k .. dim−1. A device asks for `branches(el)` of them; they are consecutive per element.
//   Every matrix index handed to a device is a plain number, `-1` meaning ground (stamping helpers skip −1).
//
// ELEMENT = JSON (`Element`): id, kind (device key), owner (placed-part uid, '' for cards), node ids, numeric params `p`, optional
//   model name. A Netlist is plain JSON, so it can be hashed (compile memo) and stored.
//
// DEVICE = a stateless module (`Device`) registered in devices/index.ts by kind. A *compiled* element (`CElem`) carries the
//   resolved matrix indices, so stamping never looks anything up. Devices write the system through the context
//   (`StampCtx`, stamp.ts): `c.m(i,j,v)` adds to A, `c.r(i,v)` adds to b, `c.g(a,b,g)` conductance, `c.i(a,b,I)` current a→b.
//
// SIGN CONVENTIONS (all SI). Terminal currents are "into the element at that terminal" (passive sign): for a two-terminal
//   element `terminalCurrents → [i, −i]` with i flowing a→b *through* the element, so power absorbed p = Σ_k v_k·i_k = (va−vb)·i.
//   A source delivering power has p < 0. Tellegen: Σ over all elements of p = 0 (plus gmin shunts, which the solver adds).
//
// ITERATION. Nonlinear devices stamp their linearised companion at ctx.x (current Newton iterate). `limit` lets a device clamp a
//   proposed iterate (pnjlim, fetlim). Linear devices ignore ctx.x. Independent sources scale their value by ctx.lambda
//   (source stepping). `ctx.gmin` is for junction shunts; the per-node gmin to ground is added by `assemble`, not by devices.
//
// TRANSIENT (§3.5). Device history lives in `ctx.state: number[]` (plain JSON, stored in the game state): element e owns
//   state[e.so .. e.so + stateSize(el) − 1]. `stampTran(e, c, method, h)` stamps the companion from that history; `update(e, x,
//   state, method, h)` is called once per ACCEPTED step to roll it forward. Devices without stampTran stamp stampDC in transient
//   (memoryless devices). `initState?(e, x, state)` seeds history from a DC OP / initial conditions.
//
// AC (§3.6). `stampAC(e, c, omega)` stamps the small-signal admittance into the complex system (AcCtx: re/im arrays), linearised
//   at c.x (the DC OP). Devices without stampAC use their (linear) stampDC conductance part with zero imaginary part.
//
// MACROS (§3.7). `internalNodes(el)` and `branches(el)` may be > 0 for any device, so a macro is one element with extra rows.
//
// TOPOLOGY (§3.10). `topo(el)` tells topology.ts how the terminals are tied at DC: see TopoInfo.

export type NodeId = number;                 // netlist node id; 0 is ground
export type Params = Record<string, number>;

export interface Element {
  id: string;
  kind: string;                              // 'R' | 'V' | 'I' | 'E' | 'G' | 'C' | 'L' | 'D' | 'BAT' | 'BENCH' | 'AM' | ...
  owner: string;                             // placed-part uid (power / ratings are attributed to it); '' if none
  nodes: NodeId[];                           // terminals, meaning per kind (see the device file)
  p: Params;
  model?: string;
}

export interface Netlist {
  /** nodeNames[id]; [0] is the ground name '0'. */
  nodeNames: string[];
  elements: Element[];
  /** `.model` cards: name → { type?, params } flattened as numbers (type is kept in `modelTypes`). */
  models: Record<string, Params>;
  modelTypes: Record<string, string>;
}

/** Compiled element: indices into x (−1 = ground). */
export interface CElem {
  el: Element;
  dev: Device;
  nodes: number[];                           // one per terminal
  internal: number[];                        // matrix indices of internal nodes
  branch: number[];                          // matrix indices of branch-current unknowns
  so: number;                                // offset into the state array
  ns: number;                                // state length
}

export type Pair = readonly [number, number];   // indices into el.nodes (terminals), not node ids

/** How a device ties its terminals at DC, for the topology checks. */
export interface TopoInfo {
  /** terminal pairs with a DC conductive path (resistor, source, closed switch, inductor). Capacitors and MOS gates: none. */
  dc: Pair[];
  /** terminal pairs held at a fixed voltage difference by zero impedance (ideal V source, ideal ammeter, inductor at DC, E output). */
  ideal: Pair[];
  /** terminal pairs through which a current is forced (ideal I source, G output). */
  forced: Pair[];
  /** The terminal pair of a voltage source (ideal or with a series r): both terminals on one node is a "shorted source". */
  source?: Pair;
}

export type TranMethod = 'BE' | 'TRAP';

export interface Device {
  kind: string;
  /** Number of terminals (el.nodes.length). */
  terminals: number;
  /** false → needs the Newton loop. */
  isLinear: boolean;
  branches(el: Element): number;
  internalNodes(el: Element): number;
  stateSize?(el: Element): number;
  /** Parameter sanity: return an error text (developer-facing) or null. Called by compile. */
  validate?(el: Element): string | null;
  /** Stamp the DC (or memoryless transient) system. Capacitors: open. Inductors: 0 V branch. */
  stampDC(e: CElem, c: import('./stamp').StampCtx): void;
  stampTran?(e: CElem, c: import('./stamp').StampCtx, method: TranMethod, h: number): void;
  stampAC?(e: CElem, c: import('./stamp').AcCtx, omega: number): void;
  /** Clamp the proposed iterate in place (pnjlim, fetlim…); return true when it was changed. */
  limit?(e: CElem, xNew: Float64Array, xOld: Float64Array): boolean;
  /** Roll the history forward after an accepted step. */
  update?(e: CElem, x: Float64Array, state: number[], method: TranMethod, h: number): void;
  initState?(e: CElem, x: Float64Array, state: number[]): void;
  /** Current INTO the element at each terminal, A (passive sign), at solution x. */
  terminalCurrents(e: CElem, x: Float64Array, state: number[]): number[];
  topo(el: Element): TopoInfo;
}

/** Everything the solvers need, immutable and shareable (it is memoised): no scratch buffers in here. */
export interface Circuit {
  netlist: Netlist;
  n: number;                                 // node unknowns
  nInternal: number;
  m: number;                                 // branch unknowns
  dim: number;
  elements: CElem[];
  stateSize: number;
  /** All devices linear. */
  linear: boolean;
  /** Names of every unknown: 'v(a)', 'v(D1#1)', 'i(V1)'. */
  unknownNames: string[];
  nodeIndex: Record<string, number>;         // node name → netlist id
  elementIndex: Record<string, number>;      // element id → position in `elements`
  /** Topology findings (pre-solve), computed once at compile time. */
  issues: TopoIssue[];
}

export type TopoCode = 'island' | 'dcFloating' | 'vloop' | 'shorted' | 'cutset' | 'unconnected' | 'singular';
export type Severity = 'block' | 'warn' | 'info';
export interface TopoIssue {
  code: TopoCode;
  severity: Severity;
  nodes: string[];                           // node names involved
  elements: string[];                        // element ids involved
  key: string;                               // i18n key in locales/sim.en.ts
  vars: Record<string, string | number>;
}
