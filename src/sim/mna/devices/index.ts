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

export const DEVICES: Readonly<Record<string, Device>> = Object.freeze({ R, V, I, BAT, BENCH, AM, E, G });
