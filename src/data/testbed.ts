// 0.6 testbed devices that are not a ticket's own repair (D-testbed-06): a board loaded on a host ticket's bench in the sandbox. The host
// gives the supply and its fixed parts (1-3's 12 V supply and the aquarium heater; 5-2's 12 V rail and the LED strip). The Godot testbed
// reads these through the `testbedBoard` query, so the engine test and the game load the same board. Numbers in the comments are the
// engine's own (src/engine/testbed06.test.ts).
import type { Pad } from '../sim/board/types';

export interface TestbedPart { partId: string; value: number | null; variant: string; x: number; y: number; rot: 0 | 1 | 2 | 3; flip: boolean }
export interface TestbedBoard { host: string; parts: TestbedPart[]; wires: { path: Pad[] }[]; pots?: { partId: string; alpha: number }[] }

const P = (partId: string, value: number | null, variant: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): TestbedPart => ({ partId, value, variant, x, y, rot, flip: false });
const W = (...paths: Pad[][]) => paths.map((path) => ({ path }));

export const TESTBED_BOARDS: Record<string, TestbedBoard> = {
  // Relay timer: 4.7 k charges 220 uF (tau about 1 s); a TIP120 Darlington follows the capacitor and drives the relay coil; at 40 mA
  // (1.86 s) the relay pulls in and its contacts switch the 12 V heater on. A 1N4007 across the coil. 470 uF in place: 3.98 s (the time
  // scales with C). 47 k in place of 4.7 k never pulls in (the coil stalls near 6.6 mA): not used as a break, because that outcome hangs on
  // the TIP120's gain at 40 mA, where the datasheet gives no minimum. Since 0.7 the model meets hFE 1000 at 0.5 A and 3 A (TIP120/D); at
  // 40 mA its internal 120 ohm shunt pulls the composite down to about 180, well under the typical curve (see D-conditions-06).
  relay_timer: {
    host: '1-3',
    parts: [P('res-cf', 4700, '0.25W', 2, 4), P('cap-el', 220e-6, '25V', 6, 6, 1), P('tip120', null, 'TO220', 8, 4), P('relay-12v', null, '5A', 17, 9), P('1n4007', null, 'DO41', 16, 13, 3)],
    wires: W([[2, 2], [2, 4]], [[6, 4], [6, 6]], [[6, 4], [8, 4]], [[6, 8], [6, 12], [13, 12], [13, 8], [14, 8]], [[10, 4], [10, 2], [2, 2]], [[12, 4], [12, 6], [16, 6], [16, 9]], [[16, 13], [16, 15], [14, 15], [14, 8]], [[16, 9], [17, 9]], [[16, 13], [17, 13]], [[21, 9], [23, 9], [23, 0], [0, 0], [0, 2], [2, 2]], [[21, 11], [22, 11], [22, 3], [15, 3], [15, 2], [14, 2]]),
  },
  // Lamp dimmer: a 10 k panel pot sets a voltage; a TIP120 with a 10 ohm emitter resistor turns it into a current for the 12 V LED
  // strip (about 1.4 V of base drop before anything flows). Strip current against the wiper position: 0.13 mA at 0.95, 0.10 A at 0.75
  // (the default), 0.22 A at 0.6, 0.225 A from about 0.5 to the 12 V end. Emitter resistor shorted: the TIP120 saturates, 0.28 A at 0.75.
  dimmer: {
    host: '5-2',
    parts: [P('pot-panel', 10000, '0.25W', 4, 6), P('res-cf', 1000, '0.25W', 10, 8), P('tip120', null, 'TO220', 14, 10), P('res-ww5', 10, '5W', 18, 12)],
    wires: W([[4, 6], [4, 4], [2, 4], [2, 2]], [[8, 6], [8, 14], [22, 14]], [[6, 6], [6, 8], [10, 8]], [[14, 8], [14, 10]], [[16, 10], [16, 6], [22, 6], [22, 4]], [[18, 10], [18, 12]], [[22, 12], [22, 14]]),
    pots: [{ partId: 'pot-panel', alpha: 0.75 }],
  },
};
