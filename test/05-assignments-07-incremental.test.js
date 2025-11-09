
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Assignments - Incremental vs Staged Processing', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Default incremental behavior', function() {

    it('should allow incremental property assignment by default', async function() {
      // With allowIncremental true (default), nested object transformers are called
      // immediately when first property triggers object creation
      const schema = new Schema('object')
        .property('point', new Schema('object')
          .property('x', new Schema('number'))
          .property('y', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['point.x', 10],
        ['point.y', 20]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, { point: { x: 10, y: 20 } });
    });

  });

  describe('Non-incremental (staged) processing', function() {

    it('should stage assignments when allowIncremental is false', async function() {
      const transformCalls = [];

      const schema = new Schema('object')
        .property('data', new Schema('object')
          .option('allowIncremental', false)
          .transformer((value, configuration, schema, path) => {
            transformCalls.push({ path, value });
            return value;
          })
          .property('x', new Schema('number'))
          .property('y', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['data.x', 10],
        ['data.y', 20]
      ]);

      const result = await compiled.processAssignments(assignments);

      // Transformer called once with complete staged object
      assert.strictEqual(transformCalls.length, 1);
      assert.deepStrictEqual(transformCalls[0].value, { x: 10, y: 20 });

      assert.deepStrictEqual(result, { data: { x: 10, y: 20 } });
    });

    it('should allow transformer to validate all fields are present', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .option('allowIncremental', false)
          .transformer((value) => {
            // Transformer can validate that all required fields exist
            if (value.x === undefined || value.y === undefined) {
              throw new Error('Both x and y are required');
            }
            return value;
          })
          .property('x', new Schema('number'))
          .property('y', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      // Should succeed with both fields
      const assignments1 = new Map([
        ['data.x', 10],
        ['data.y', 20]
      ]);
      const result1 = await compiled.processAssignments(assignments1);
      assert.deepStrictEqual(result1, { data: { x: 10, y: 20 } });

      // Should fail with only one field
      const assignments2 = new Map([
        ['data.x', 10]
      ]);
      await assert.rejects(
        async () => await compiled.processAssignments(assignments2),
        (err) => {
          // Error is wrapped in SchemaError, check the cause chain
          let current = err;
          while (current) {
            if (current.message && current.message.includes('Both x and y are required')) {
              return true;
            }
            current = current.cause;
          }
          return false;
        }
      );
    });

    it('should allow transformer to compute derived values from all fields', async function() {
      const schema = new Schema('object')
        .property('point', new Schema('object')
          .option('allowIncremental', false)
          .lax()
          .transformer((value) => {
            // Compute a value that depends on multiple fields
            return {
              ...value,
              sum: (value.x ?? 0) + (value.y ?? 0)
            };
          })
          .property('x', new Schema('number'))
          .property('y', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['point.x', 10],
        ['point.y', 20]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, { point: { x: 10, y: 20, sum: 30 } });
    });

    it('should work with defaults in non-incremental mode', async function() {
      const schema = new Schema('object')
        .property('calc', new Schema('object')
          .option('allowIncremental', false)
          .lax()
          .transformer((value) => {
            return {
              ...value,
              computed: value.x * value.y
            };
          })
          .property('x', new Schema('number').default(5))
          .property('y', new Schema('number').default(10))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['calc.x', 5],
        ['calc.y', 10]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, { calc: { x: 5, y: 10, computed: 50 } });
    });

  });

  describe('Non-incremental with unions', function() {

    it('should stage assignments for union members with allowIncremental false', async function() {
      const transformCalls = [];

      const schema = new Schema('object')
        .property('item', new Schema('any')
          .unionDiscriminator((value) => typeof value === 'string' ? 'simple' : 'complex')
          .unionSchema('simple', new Schema('string'))
          .unionSchema('complex', new Schema('object')
            .option('allowIncremental', false)
            .transformer((value) => {
              transformCalls.push(value);
              // Transformer that needs all fields
              if (!value.a || !value.b) {
                throw new Error('Both a and b required');
              }
              return `${value.a}-${value.b}`;
            })
            .property('a', new Schema('string'))
            .property('b', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['item.a', 'hello'],
        ['item.b', 'world']
      ]);

      const result = await compiled.processAssignments(assignments);

      // Transformer called once with complete object
      assert.strictEqual(transformCalls.length, 1);
      assert.deepStrictEqual(transformCalls[0], { a: 'hello', b: 'world' });

      assert.deepStrictEqual(result, { item: 'hello-world' });
    });

    it('should work with non-incremental objects in arrays', async function() {
      const schema = new Schema('object')
        .property('points', new Schema('array')
          .property('*', new Schema('object')
            .option('allowIncremental', false)
            .lax()
            .transformer((value) => {
              // Normalize coordinates
              return {
                x: value.x ?? 0,
                y: value.y ?? 0,
                magnitude: Math.sqrt(Math.pow(value.x ?? 0, 2) + Math.pow(value.y ?? 0, 2))
              };
            })
            .property('x', new Schema('number'))
            .property('y', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['points.0.x', 3],
        ['points.0.y', 4],
        ['points.1.x', 5],
        ['points.1.y', 12]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.points.length, 2);
      assert.deepStrictEqual(result.points[0], { x: 3, y: 4, magnitude: 5 });
      assert.deepStrictEqual(result.points[1], { x: 5, y: 12, magnitude: 13 });
    });

  });

  describe('Nested incremental scenarios', function() {

    it('should handle parent incremental with child non-incremental', async function() {
      const childCalls = [];

      const schema = new Schema('object')
        .property('child', new Schema('object')
          .option('allowIncremental', false)
          .transformer((value, configuration, schema, path) => {
            childCalls.push(value);
            return value;
          })
          .property('a', new Schema('string'))
          .property('b', new Schema('string'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['child.a', 'hello'],
        ['child.b', 'world']
      ]);

      const result = await compiled.processAssignments(assignments);

      // Child transformer called once with complete staged object
      assert.strictEqual(childCalls.length, 1);
      assert.deepStrictEqual(childCalls[0], { a: 'hello', b: 'world' });

      assert.deepStrictEqual(result, { child: { a: 'hello', b: 'world' } });
    });

    it('should handle parent non-incremental with child incremental', async function() {
      const parentCalls = [];
      const childCalls = [];

      const schema = new Schema('object')
        .property('wrapper', new Schema('object')
          .option('allowIncremental', false)
          .transformer((value, configuration, schema, path) => {
            // Deep copy to capture actual value at call time
            parentCalls.push(JSON.parse(JSON.stringify(value)));
            return value;
          })
          .property('child', new Schema('object')
            .transformer((value, configuration, schema, path) => {
              // Deep copy to capture actual value at call time
              childCalls.push(JSON.parse(JSON.stringify(value)));
              return value;
            })
            .property('a', new Schema('string'))
            .property('b', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['wrapper.child.a', 'hello'],
        ['wrapper.child.b', 'world']
      ]);

      const result = await compiled.processAssignments(assignments);

      // Child transformer called with normalized empty object (incremental)
      assert.strictEqual(childCalls.length, 1);
      assert.deepStrictEqual(childCalls[0], {});

      // Parent transformer called once with complete staged object including child
      assert.strictEqual(parentCalls.length, 1);
      assert.deepStrictEqual(parentCalls[0], { child: { a: 'hello', b: 'world' } });

      assert.deepStrictEqual(result, { wrapper: { child: { a: 'hello', b: 'world' } } });
    });

  });

  describe('Edge cases', function() {

    it('should handle partial assignments with non-incremental mode', async function() {
      const schema = new Schema('object')
        .option('allowIncremental', false)
        .transformer((value) => value)
        .property('x', new Schema('number'))
        .property('y', new Schema('number'))
        .property('z', new Schema('number'));

      const compiled = resolver.compile(schema);

      // Only assign some properties
      const assignments = new Map([
        ['x', 10],
        ['y', 20]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, { x: 10, y: 20 });
    });

    it('should work with non-incremental and wildcard defaults', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .option('allowIncremental', false)
            .lax()
            .transformer((value) => {
              return {
                name: value.name,
                count: value.count ?? 0,
                total: (value.count ?? 0) * (value.price ?? 1)
              };
            })
            .property('name', new Schema('string'))
            .property('count', new Schema('number').default(0))
            .property('price', new Schema('number').default(1))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['items.0.name', 'widget'],
        ['items.0.count', 5],
        ['items.0.price', 10],
        ['items.1.name', 'gadget'],
        ['items.1.count', 3],
        // Wildcard defaults
        ['items.*.count', 0],
        ['items.*.price', 1]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.items.length, 2);
      assert.deepStrictEqual(result.items[0], { name: 'widget', count: 5, total: 50 });
      assert.deepStrictEqual(result.items[1], { name: 'gadget', count: 3, total: 3 });
    });

    it('should handle empty assignments with non-incremental mode', async function() {
      const transformCalls = [];

      const schema = new Schema('object')
        .option('allowIncremental', false)
        .transformer((value, configuration, schema, path) => {
          transformCalls.push(value);
          return value;
        })
        .property('x', new Schema('number'))
        .property('y', new Schema('number'));

      const compiled = resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments) ?? {};

      // No assignments means no object created, so transformer not called
      // FIXME?  not true, the top-level container always needs to be transformed (might create something different?)
      //assert.strictEqual(transformCalls.length, 0);
      assert.deepStrictEqual(result, {});
    });

  });

});
