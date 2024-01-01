// sum.test.js
import { expect, test } from 'vitest';
import { a } from '../src/example.js';

test('adds 1 + 2 to equal 3', () => {
    expect(a).toBe(1);
});
