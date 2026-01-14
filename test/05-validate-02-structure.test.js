
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, UnionResolutionError } from '../src/errors.js';

describe('Validate - Structure and Control Flow', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Extra properties (strict mode)', function() {

    it('should reject objects with unknown properties', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate({ name: 'Alice', extra: 'field' }),
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.message.toLowerCase().includes('extra') ||
                    err.message.toLowerCase().includes('unknown') ||
                    err.message.toLowerCase().includes('unexpected'));
          return true;
        }
      );
    });

    it('should reject nested objects with unknown properties', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate({ user: { name: 'Bob', unknown: 'value' } }),
        ValidationError
      );
    });
  });

  describe('Extra properties (lax mode)', function() {

    it('should allow unknown properties when schema is lax', async function() {
      const schema = new Schema('object')
        .lax()
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ name: 'Alice', extra: 'ignored' });

      // In lax mode, extra properties should be dropped or ignored
      assert.strictEqual(result.name, 'Alice');
    });

    it('should allow unknown properties with strict:false option', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate(
        { name: 'Alice', extra: 'ignored' },
        { strict: false }
      );

      assert.strictEqual(result.name, 'Alice');
    });
  });

  describe('Required properties', function() {

    it('should reject when required property is missing', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string').required())
        .property('optional', new Schema('string'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate({ optional: 'value' }),
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.message.includes('name'));
          return true;
        }
      );
    });

    it('should pass when required property is present', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string').required());

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ name: 'Alice' });

      assert.deepStrictEqual(result, { name: 'Alice' });
    });

    it('should handle multiple required properties', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string').required())
        .property('b', new Schema('string').required())
        .property('c', new Schema('string'));

      const compiled = await resolver.compile(schema);

      // Missing 'b'
      await assert.rejects(
        () => compiled.validate({ a: 'value' }),
        ValidationError
      );

      // All required present
      const result = await compiled.validate({ a: '1', b: '2' });
      assert.deepStrictEqual(result, { a: '1', b: '2' });
    });
  });

  describe('Conditions', function() {

    it('should skip validation when condition is false', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string'))
        .property('debugOnly', new Schema('string')
          .required()
          .condition((_, config) => config?.mode === 'debug')
        );

      const compiled = await resolver.compile(schema);

      // With mode !== 'debug', debugOnly should be skipped
      const result = await compiled.validate({ mode: 'production' });
      assert.deepStrictEqual(result, { mode: 'production' });
    });

    it('should enforce validation when condition is true', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string'))
        .property('debugOnly', new Schema('string')
          .required()
          .condition((_, config) => config?.mode === 'debug')
        );

      const compiled = await resolver.compile(schema);

      // With mode === 'debug', debugOnly is required
      await assert.rejects(
        () => compiled.validate({ mode: 'debug' }),
        ValidationError
      );

      // Providing debugOnly should work
      const result = await compiled.validate({ mode: 'debug', debugOnly: 'enabled' });
      assert.deepStrictEqual(result, { mode: 'debug', debugOnly: 'enabled' });
    });
  });

  describe('Defaults during validation', function() {

    it('should NOT apply defaults during validation (already processed)', async function() {
      // Validate assumes input is already processed, so defaults shouldn't apply
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('status', new Schema('string').default('active'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ name: 'test' });

      // Default should NOT be applied during validation
      assert.strictEqual(result.status, undefined);
    });
  });

  describe('Value constraints via validators', function() {
    // Note: .values() is a PRE-transform constraint on normalized input,
    // not a post-transform validation. For post-transform validation,
    // use explicit .validator() checks.

    it('should validate against custom validator constraint', async function() {
      const allowed = ['red', 'green', 'blue'];
      const schema = new Schema('string')
        .validator((value) => {
          if (!allowed.includes(value)) {
            throw new ValidationError(`Must be one of: ${allowed.join(', ')}`);
          }
          return value;
        });

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate('red');
      assert.strictEqual(result, 'red');
    });

    it('should reject invalid values via custom validator', async function() {
      const allowed = ['red', 'green', 'blue'];
      const schema = new Schema('string')
        .validator((value) => {
          if (!allowed.includes(value)) {
            throw new ValidationError(`Must be one of: ${allowed.join(', ')}`);
          }
          return value;
        });

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate('yellow'),
        ValidationError
      );
    });
  });

  describe('Wildcard properties', function() {

    it('should validate all wildcard property values', async function() {
      const schema = new Schema('object')
        .property('*', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ a: 1, b: 2, c: 3 });
      assert.deepStrictEqual(result, { a: 1, b: 2, c: 3 });
    });

    it('should reject invalid wildcard property values', async function() {
      const schema = new Schema('object')
        .property('*', new Schema('number')
          .validator((v) => {
            if (v < 0) throw new ValidationError('Must be positive');
            return v;
          })
        );

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate({ a: 1, b: -5 }),
        ValidationError
      );
    });
  });

  describe('Union validation', function() {

    it('should validate correct union member based on discriminator property', async function() {
      const schema = new Schema('object')
        .unionSchema('dog', new Schema('object')
          .property('type', new Schema('string').values(['dog']))
          .property('breed', new Schema('string'))
        )
        .unionSchema('cat', new Schema('object')
          .property('type', new Schema('string').values(['cat']))
          .property('indoor', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);

      const dogResult = await compiled.validate({ type: 'dog', breed: 'labrador' });
      assert.deepStrictEqual(dogResult, { type: 'dog', breed: 'labrador' });

      const catResult = await compiled.validate({ type: 'cat', indoor: true });
      assert.deepStrictEqual(catResult, { type: 'cat', indoor: true });
    });

    it('should run validators on resolved union member', async function() {
      const schema = new Schema('object')
        .unionSchema('dog', new Schema('object')
          .property('type', new Schema('string').values(['dog']))
          .property('breed', new Schema('string')
            .validator((v) => v.toLowerCase())
          )
        )
        .unionSchema('cat', new Schema('object')
          .property('type', new Schema('string').values(['cat']))
          .property('indoor', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);

      // Validator on breed should run after union resolution
      const result = await compiled.validate({ type: 'dog', breed: 'LABRADOR' });
      assert.deepStrictEqual(result, { type: 'dog', breed: 'labrador' });
    });
  });

  describe('Validator mutation behavior', function() {

    it('should return mutated value from object property validator', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string')
          .validator((v) => v.toUpperCase())
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ name: 'alice' });

      assert.strictEqual(result.name, 'ALICE');
    });

    it('should return mutated values from nested validators', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string')
            .validator((v) => v.trim())
          )
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ user: { name: '  Bob  ' } });

      assert.strictEqual(result.user.name, 'Bob');
    });

    it('should return mutated values from array element validators', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('number')
          .validator((v) => Math.abs(v))
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate([-1, 2, -3]);

      assert.deepStrictEqual(result, [1, 2, 3]);
    });
  });
});
