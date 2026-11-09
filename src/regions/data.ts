// NODE regional parameters (DESIGN §12.2). Physics is region-independent: a pack may change prices, mains, names, currency and the
// exam-bridge set, never a law or a constant of nature. The one law field a pack keeps (`vtAt300K`) exists so that tests can prove
// no pack tampers with it; any field this interface does not list is rejected.
import { formatMoney, type MoneyOpts, type RegionPack } from '@core/regions';
import { LAWS } from '../sim/laws';

export interface MainsData {
  /** Nominal RMS voltage, V. */
  volts: number;
  /** Line frequency, Hz (50 or 60). */
  hz: number;
  /** Fractional tolerance of the voltage (0.1 = ±10 %): the low/nominal/high ticket conditions use it. */
  tolerance: number;
}

export interface NodeRegionData {
  /** Thermal voltage kT/q at 300 K, V. Must equal LAWS.vtAt300K in every pack. */
  vtAt300K: number;
  mains: MainsData;
  /** Price per `${partId}:${variantId}` in integer minor units of the pack currency (cents, paise). */
  prices: Record<string, number>;
  /** Where the prices come from (and, for derived packs, the conversion), shown in the Codex. */
  priceSource: string;
  /** Part ids missing from this pack's bins (a substitute must be electrically equivalent, DESIGN §12.2). */
  unavailable: string[];
  /** The exam-bridge ticket set this pack uses (§2.5). One card set per pack id. */
  examBridge: { set: string };
  /** Concept id -> syllabus label shown in the Codex. */
  syllabus: Record<string, string>;
}

const KEYS = ['vtAt300K', 'mains', 'prices', 'priceSource', 'unavailable', 'examBridge', 'syllabus'];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateNodeData(d: NodeRegionData): string[] {
  const e: string[] = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['must be an object'];
  for (const k of Object.keys(d)) if (!KEYS.includes(k)) e.push(`unknown field '${k}' (a pack carries scenario parameters only, never a law or constant of nature)`);
  if (d.vtAt300K !== LAWS.vtAt300K) e.push(`vtAt300K must be ${LAWS.vtAt300K} (physics does not depend on the region; got ${String(d.vtAt300K)})`);
  const m: any = d.mains;
  if (!m || typeof m !== 'object') e.push('mains must be an object { volts, hz, tolerance }');
  else {
    if (!isNum(m.volts) || m.volts <= 0) e.push(`mains.volts must be a positive number (got ${String(m.volts)})`);
    if (m.hz !== 50 && m.hz !== 60) e.push(`mains.hz must be 50 or 60 (got ${String(m.hz)})`);
    if (!isNum(m.tolerance) || m.tolerance < 0 || m.tolerance > 0.2) e.push(`mains.tolerance must be between 0 and 0.2 (got ${String(m.tolerance)})`);
  }
  if (!d.prices || typeof d.prices !== 'object' || Array.isArray(d.prices)) e.push('prices must be an object of integer minor units');
  else for (const [k, v] of Object.entries(d.prices)) if (!Number.isInteger(v) || v < 0) e.push(`prices['${k}'] must be a non-negative integer of minor units (got ${String(v)})`);
  if (typeof d.priceSource !== 'string' || d.priceSource.trim() === '') e.push('priceSource must be a non-empty string');
  if (!Array.isArray(d.unavailable) || d.unavailable.some((x) => typeof x !== 'string')) e.push('unavailable must be an array of part ids');
  if (!d.examBridge || typeof d.examBridge.set !== 'string' || d.examBridge.set === '') e.push('examBridge.set must be a non-empty string');
  if (!d.syllabus || typeof d.syllabus !== 'object' || Array.isArray(d.syllabus)) e.push('syllabus must be an object of strings');
  return e;
}

/** Multiply every price by an integer factor (e.g. cents -> paise at 84 per US$ is a factor of 84: 1 cent = 0.84 rupee = 84 paise). */
export function derivePrices(base: Readonly<Record<string, number>>, factor: number): Record<string, number> {
  if (!Number.isInteger(factor) || factor < 1) throw new Error(`price factor must be a positive integer (got ${String(factor)})`);
  const out: Record<string, number> = {};
  for (const k of Object.keys(base)) out[k] = base[k]! * factor;
  return out;
}

/** Format an amount in the pack currency's MINOR units (the wallet and all prices are integer minor units): 123456 -> "$1,234.56". */
export function formatMinor(minor: number, pack: Pick<RegionPack, 'numbers' | 'currency'>, o: MoneyOpts = {}): string {
  return formatMoney(minor / 100, pack, o);
}
