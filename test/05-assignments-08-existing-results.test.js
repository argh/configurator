
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Assignments - Existing Results (current parameter)', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Iterative processAssignments calls', function() {

    it('should allow chained calls with object schema', async function() {
      const transformCalls = [];

      const schema = new Schema('object')
        .transformer((value) => {
          transformCalls.push(JSON.parse(JSON.stringify(value)));
          return value;
        })
        .property('x', new Schema('number'))
        .property('y', new Schema('number'))
        .property('z', new Schema('number'));

      const compiled = resolver.compile(schema);

      // First batch
      const result1 = await compiled.processAssignments(new Map([['x', 10]]));
      assert.deepStrictEqual(result1, { x: 10 });

      // Second batch - pass result1 as current
      const result2 = await compiled.processAssignments(new Map([['y', 20]]), result1);
      assert.deepStrictEqual(result2, { x: 10, y: 20 });

      // Third batch
      const result3 = await compiled.processAssignments(new Map([['z', 30]]), result2);
      assert.deepStrictEqual(result3, { x: 10, y: 20, z: 30 });

      // Transformer only called on first call (when no current provided)
      assert.strictEqual(transformCalls.length, 1);
      assert.deepStrictEqual(transformCalls[0], {});
    });

    it('should allow chained calls with primitive schema', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      const result1 = await compiled.processAssignments(new Map([['', 'first']]));
      assert.strictEqual(result1, 'first');

      // Update primitive value - should work (not throw "lost our result")
      const result2 = await compiled.processAssignments(new Map([['', 'second']]), result1);
      assert.strictEqual(result2, 'second');

      // Another update
      const result3 = await compiled.processAssignments(new Map([['', 'third']]), result2);
      assert.strictEqual(result3, 'third');
    });

    it('should preserve values not in assignments', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('string'))
        .property('c', new Schema('string'));

      const compiled = resolver.compile(schema);

      const current = { a: 'keep-a', b: 'keep-b', c: 'keep-c' };
      const assignments = new Map([['b', 'new-b']]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { a: 'keep-a', b: 'new-b', c: 'keep-c' });
    });

  });

  describe('Empty assignments with current', function() {

    it('should return current object when no assignments', async function() {
      const schema = new Schema('object')
        .property('x', new Schema('number'))
        .property('y', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { x: 5, y: 10 };
      const assignments = new Map();

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { x: 5, y: 10 });
    });

    it('should return current primitive when no assignments', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      const current = 'unchanged';
      const assignments = new Map();

      const result = await compiled.processAssignments(assignments, current);

      assert.strictEqual(result, 'unchanged');
    });

    it('should validate current even with empty assignments', async function() {
      const schema = new Schema('object')
        .property('x', new Schema('number'))
        .property('y', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { x: 5, y: 10, extraProp: 'not allowed' };
      const assignments = new Map();

      await assert.rejects(
        async () => await compiled.processAssignments(assignments, current),
        (err) => {
          let current = err;
          while (current) {
            if (current.message && current.message.includes('Unexpected value')) {
              return true;
            }
            current = current.cause;
          }
          return false;
        }
      );
    });

  });

  describe('Lax mode with current', function() {

    it('should preserve extra properties with lax mode', async function() {
      const schema = new Schema('object')
        .lax()
        .property('x', new Schema('number'))
        .property('y', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { x: 5, y: 10, extraProp: 'extra' };
      const assignments = new Map([['y', 20]]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { x: 5, y: 20, extraProp: 'extra' });
    });

    it('should preserve extra properties with lax and empty assignments', async function() {
      const schema = new Schema('object')
        .lax()
        .property('x', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { x: 5, extraProp: 'kept' };
      const assignments = new Map();

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { x: 5, extraProp: 'kept' });
    });

    it('should reject extra properties without lax mode', async function() {
      const schema = new Schema('object')
        .property('x', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { x: 5, extraProp: 'not allowed' };
      const assignments = new Map([['x', 10]]);

      await assert.rejects(
        async () => await compiled.processAssignments(assignments, current),
        /Unexpected value/
      );
    });

  });

  describe('Nested objects with current', function() {

    it('should update nested properties', async function() {
      const schema = new Schema('object')
        .property('nested', new Schema('object')
          .property('a', new Schema('string'))
          .property('b', new Schema('string'))
        );

      const compiled = resolver.compile(schema);

      const current = { nested: { a: 'old-a', b: 'old-b' } };
      const assignments = new Map([['nested.b', 'new-b']]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { nested: { a: 'old-a', b: 'new-b' } });
    });

    it('should preserve root level properties when updating nested', async function() {
      const schema = new Schema('object')
        .property('rootProp', new Schema('string'))
        .property('nested', new Schema('object')
          .property('childProp', new Schema('string'))
        );

      const compiled = resolver.compile(schema);

      const current = { rootProp: 'root-value', nested: { childProp: 'old-child' } };
      const assignments = new Map([['nested.childProp', 'new-child']]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, {
        rootProp: 'root-value',
        nested: { childProp: 'new-child' }
      });
    });

  });

  describe('Arrays with current', function() {

    it('should update array elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = resolver.compile(schema);

      const current = ['a', 'b', 'c'];
      const assignments = new Map([['1', 'new-b']]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, ['a', 'new-b', 'c']);
    });

    it('should preserve existing array elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = [10, 20, 30, 40];
      const assignments = new Map([['0', 100]]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, [100, 20, 30, 40]);
    });

  });

  describe('Validation with current', function() {

    it('should validate assignments against schema', async function() {
      const schema = new Schema('object')
        .property('num', new Schema('number')
          .validator((value) => {
            if (value < 0 || value > 100) {
              throw new Error('Must be 0-100');
            }
            return value;
          })
        );

      const compiled = resolver.compile(schema);

      const current = { num: 50 };
      const assignments = new Map([['num', 150]]);

      await assert.rejects(
        async () => await compiled.processAssignments(assignments, current),
        (err) => {
          let current = err;
          while (current) {
            if (current.message && current.message.includes('Must be 0-100')) {
              return true;
            }
            current = current.cause;
          }
          return false;
        }
      );
    });

    it('should normalize values in assignments', async function() {
      const schema = new Schema('object')
        .property('num', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { num: 5 };
      const assignments = new Map([['num', '123']]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { num: 123 });
      assert.strictEqual(typeof result.num, 'number');
    });

  });

  describe('Complete replacement vs partial update', function() {

    it('should allow complete replacement when all properties assigned', async function() {
      const schema = new Schema('object')
        .property('x', new Schema('number'))
        .property('y', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = { x: 5, y: 10 };
      const assignments = new Map([
        ['x', 100],
        ['y', 200]
      ]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { x: 100, y: 200 });
    });

    it('should handle partial updates', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('string'))
        .property('c', new Schema('string'))
        .property('d', new Schema('string'));

      const compiled = resolver.compile(schema);

      const current = { a: 'a1', b: 'b1', c: 'c1', d: 'd1' };
      const assignments = new Map([
        ['b', 'b2'],
        ['d', 'd2']
      ]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { a: 'a1', b: 'b2', c: 'c1', d: 'd2' });
    });

  });

  describe('Edge cases', function() {

    it('should handle empty current object', async function() {
      const schema = new Schema('object')
        .property('x', new Schema('number'))
        .property('y', new Schema('number'));

      const compiled = resolver.compile(schema);

      const current = {};
      const assignments = new Map([['x', 10]]);

      const result = await compiled.processAssignments(assignments, current);

      assert.deepStrictEqual(result, { x: 10 });
    });

    it('should handle number primitive updates', async function() {
      const schema = new Schema('number');
      const compiled = resolver.compile(schema);

      const result1 = await compiled.processAssignments(new Map([['', 42]]));
      assert.strictEqual(result1, 42);

      const result2 = await compiled.processAssignments(new Map([['', 100]]), result1);
      assert.strictEqual(result2, 100);
    });

    it('should handle boolean primitive updates', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      const result1 = await compiled.processAssignments(new Map([['', true]]));
      assert.strictEqual(result1, true);

      const result2 = await compiled.processAssignments(new Map([['', false]]), result1);
      assert.strictEqual(result2, false);
    });

  });

});
