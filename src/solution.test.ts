// Solution codes: a run of the sample ticket 0-0 becomes a code; the verifier replays it and gives a clean verdict (never a throw).
// An idle run cannot win, so it verifies as a clean "not ok"; the expert's replay of the ref verifies ok with the in-game metrics.
import { describe, expect, it } from 'vitest';
import { Engine, Env, decodeSolution, encodeSolution } from '@core/kit';
import { GAME } from './game';
import { verify } from './verify';
import { refActions } from './engine/replay';
import { LEVEL_DEFS } from './data/levels';

function idleRun(region?: string, level = '0-0'): Engine<any> {
  const env = new Env(GAME); env.reset({ seed: 1, level, region });
  for (let i = 0; i < 20 && env.state.status === 'playing'; i++) env.step({ name: 'tick' });
  return env.engine;
}

describe('solution codes of NODE (sample ticket 0-0)', () => {
  it('free play has no code', () => expect(new Engine(GAME).q('solutionCode')).toBeNull());
  it('the idle run produces a code that verifies as a clean not-ok (an idle player cannot win), the same every time', () => {
    const code = idleRun().q('solutionCode') as string; expect(code).toMatch(/^CB1\./);
    const r = verify('0-0', code);
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/not won/); expect(r.ruleset).toBe('node-circuits:global@1.1');
    expect(r.metrics).toEqual({});   // a code that is not won reports no metrics
    expect(verify('0-0', code)).toEqual(r);
    expect(idleRun().q('solutionCode')).toBe(code);
  });
  it('the expert\'s code verifies ok with exactly the in-game metrics, deterministically', () => {
    const env = new Env(GAME); env.reset({ seed: 1, level: '0-0' });
    for (const a of refActions(LEVEL_DEFS[0]!)) env.step(a);
    expect(env.state.status).toBe('won');
    const code = env.engine.q('solutionCode') as string, inGame = env.engine.q('metrics');
    const r = verify('0-0', code); expect(r.ok).toBe(true); expect(r.metrics).toEqual(inGame); expect(verify('0-0', code)).toEqual(r);
  });
  it('a tampered code fails the checksum', () => {
    const parts = (idleRun().q('solutionCode') as string).split('.'); parts[1] = parts[1]!.slice(0, 10) + (parts[1]![10] === 'A' ? 'B' : 'A') + parts[1]!.slice(11);
    const r = verify('0-0', parts.join('.')); expect(r.ok).toBe(false); expect(r.reason).toMatch(/checksum/);
  });
  it('a code from a different region (ruleset) is a clean not-ok on the global board', () => {
    const code = idleRun('in').q('solutionCode') as string;
    expect((decodeSolution(code) as any).ruleset).toBe('node-circuits:in@1.1');
    const global = verify('0-0', code, { region: 'global' }); expect(global.ok).toBe(false); expect(global.reason).toMatch(/Region mismatch/);
  });
  it('a code from another ruleset version is a clean not-ok', () => {
    const d = decodeSolution(idleRun().q('solutionCode') as string) as any;
    for (const old of ['node-circuits:global@1.0', 'node-circuits:global@2.1', 'node-circuits:global@1']) {
      const r = verify('0-0', encodeSolution({ ...d, ruleset: old })); expect(r.ok, old).toBe(false); expect(r.reason, old).toMatch(/Ruleset mismatch/);
    }
  });
  it('wrong level / junk input never throw', () => {
    const code = idleRun().q('solutionCode') as string;
    expect(verify('nope', code).ok).toBe(false);
    for (const junk of ['', 'x', 'CB1.a.b', code.slice(0, 20), '{}']) expect(verify('0-0', junk).ok).toBe(false);
  });
});
