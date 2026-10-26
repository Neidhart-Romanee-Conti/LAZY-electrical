// LAZY Logo engine: the example program passes its own tests, checks catch broken programs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLogo } from './load.mjs';
const LL = loadLogo();

test('logo: example program passes its behaviour tests', () => {
  const p = LL.example();
  assert.equal(LL.check(p).errors.length, 0, LL.check(p).errors.join(' | '));
  assert.ok(LL.runTests(p).every((r) => r.ok));
});
test('logo: check reports a doubly driven output and an unknown block', () => {
  const p = LL.normalize({ model: '0BA5', blocks: [{ id: 'B1', type: 'I', p: { n: 1 } }, { id: 'B2', type: 'Q', p: { n: 1 } }, { id: 'B3', type: 'Q', p: { n: 1 } }, { id: 'B4', type: 'FOO', p: {} }], wires: [{ from: 'B1', to: 'B2', pin: 0 }, { from: 'B1', to: 'B3', pin: 0 }] }).prog;
  const e = LL.check(p).errors.join(' | ');
  assert.match(e, /Q1/);
  assert.match(e, /FOO/);
});
test('logo: a wrong expectation fails with a readable message', () => {
  const p = LL.example();
  p.tests = [{ name: 'wrong', steps: [{ set: { I1: 1 }, t: 0.2, expect: { Q2: 1 } }] }];
  const r = LL.runTests(p)[0];
  assert.equal(r.ok, false);
  assert.match(r.log.join(' '), /Q2/);
});
