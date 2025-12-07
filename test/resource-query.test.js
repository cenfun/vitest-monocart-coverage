import { expect, test } from 'vitest';
import sumRaw from '../src/sum.js?raw';

test('can collect coverage from imports with resource-query', () => {
    expect(sumRaw).toContain('export function sum');
    expect(sumRaw).toContain('return a + b');
});

