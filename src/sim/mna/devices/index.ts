// Device registry: kind → Device. To add a device (C, L, D, BJT, ...): write devices/<name>.ts and add ONE line here.
// The registry is a frozen constant (no mutable module state); compile() takes an optional registry for tests.
import type { Device } from '../types';
import { R } from './r';
import { V } from './vsrc';
import { I } from './isrc';
import { BAT } from './battery';
import { BENCH } from './bench';
import { AM } from './meter';
import { E } from './vcvs';
import { G } from './vccs';
import { C } from './c';
import { L } from './l';
import { D } from './diode';
import { Q, DAR } from './bjt';
import { M } from './mosfet';
import { T } from './xfmr';
import { OA } from './opamp';
import { CMP } from './comparator';
import { TMR } from './timer';
import { REG } from './regulator';
import { LOGIC } from './logic';
import { RLY } from './relay';
import { FUSE } from './fuse';

export const DEVICES: Readonly<Record<string, Device>> = Object.freeze({ R, V, I, BAT, BENCH, AM, E, G, C, L, D, Q, DAR, M, T, OA, CMP, TMR, REG, LOGIC, RLY, FUSE });
