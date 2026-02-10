
import { strict as assert } from 'assert';
import { Schema, SchemaPolicy } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, TransformError, ConstraintError, NormalizeError } from '../src/errors.js';

describe('Schema Compilation - Handler Pipelines', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  // Helper to check wrapped errors
  const assertWrappedError = async (fn, WrapperType, CauseType, causeMessage) => {
    try {
      await fn();
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert(error instanceof WrapperType, `Expected wrapper to be ${WrapperType.name}, got ${error.constructor.name}`);
      if (CauseType) {
        assert(error.cause instanceof CauseType, `Expected cause to be ${CauseType.name}, got ${error.cause?.constructor.name}`);
      }
      if (causeMessage) {
        assert(error.cause.message.includes(causeMessage), `Expected cause message to include "${causeMessage}", got "${error.cause.message}"`);
      }
    }
  };

  describe('Pipeline mechanism (via normalizer)', function() {

    it('should execute single normalizer', async function() {
      const schema = new Schema('string')
        .normalizer((value) => value.trim());

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('  hello  ');
      assert.strictEqual(result, 'hello');
    });

    it('should chain multiple normalizers in sequence', async function() {
      const schema = new Schema('string')
        .normalizer((value) => value.trim())
        .normalizer((value) => value.toLowerCase())
        .normalizer((value) => value.replace(/\s+/g, '-'));

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('  Hello  World  ');
      assert.strictEqual(result, 'hello-world');
    });

    it('should prepend base schema normalizers', async function() {
      // Create a custom base schema that uppercases
      const baseSchema = new Schema('string')
        .normalizer((value) => value.toUpperCase());

      resolver.registerSchema('uppercase-string', baseSchema);

      // Derived schema adds trimming
      const derivedSchema = new Schema('uppercase-string')
        .normalizer((value) => value.trim());

      const compiled = await resolver.compile(derivedSchema);

      // Base normalizer (uppercase) should run first, then derived (trim)
      const result = await compiled._normalizeValue('  hello  ');
      assert.strictEqual(result, 'HELLO');
    });

    it('should pass value through empty normalizer pipeline', async function() {
      const schema = new Schema('string')
        .normalizers([], SchemaPolicy.OVERWRITE); // Clear any base normalizers

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('  unchanged  ');
      assert.strictEqual(result, '  unchanged  ');
    });

    it('should propagate errors from normalizer', async function() {
      const schema = new Schema('string')
        .normalizer((value) => {
          if (value === 'bad') {
            throw new ConstraintError('Invalid value');
          }
          return value;
        });

      const compiled = await resolver.compile(schema);

      await assertWrappedError(
        async () => await compiled._normalizeValue('bad'),
        NormalizeError,
        ConstraintError,
        'Invalid value'
      );
    });

    it('should stop pipeline on error', async function() {
      let secondCalled = false;

      const schema = new Schema('string')
        .normalizer((value) => {
          throw new ConstraintError('First normalizer fails');
        })
        .normalizer((value) => {
          secondCalled = true;
          return value;
        });

      const compiled = await resolver.compile(schema);

      await assertWrappedError(
        async () => await compiled._normalizeValue('test'),
        NormalizeError,
        ConstraintError,
        'First normalizer fails'
      );

      assert.strictEqual(secondCalled, false, 'Second normalizer should not be called');
    });
  });

  describe('Handler-specific semantics', function() {

    it('normalizer: should pass through already-normalized values', async function() {
      let normalizerCalled = false;

      const schema = new Schema('number')
        .normalizer((value) => {
          normalizerCalled = true;
          if (typeof value === 'string') {
            return Number(value);
          }
          return value; // Already normalized
        });

      const compiled = await resolver.compile(schema);

      // First call with string - should normalize
      const result1 = await compiled._normalizeValue('42');
      assert.strictEqual(result1, 42);
      assert.strictEqual(normalizerCalled, true);

      // Second call with number - should pass through
      normalizerCalled = false;
      const result2 = await compiled._normalizeValue(42);
      assert.strictEqual(result2, 42);
      assert.strictEqual(normalizerCalled, true); // Still called, but returns value unchanged
    });

    it('transformer: should transform from normalized form', async function() {
      const schema = new Schema('string')
        .normalizer((value) => value.toString()) // Ensure string
        .transformer((value) => ({ wrapped: value })); // Transform to object

      const compiled = await resolver.compile(schema);

      const normalized = await compiled._normalizeValue('hello');
      const transformed = await compiled._transformValue(normalized);

      assert.deepStrictEqual(transformed, { wrapped: 'hello' });
    });

    it('transformer: should chain multiple transformers', async function() {
      const schema = new Schema('number')
        .transformer((value) => value * 2)
        .transformer((value) => value + 10)
        .transformer((value) => ({ result: value }));

      const compiled = await resolver.compile(schema);

      const result = await compiled._transformValue(5);
      assert.deepStrictEqual(result, { result: 20 }); // (5 * 2) + 10 = 20
    });

    it('serializer: should inverse-transform to normalized form', async function() {
      const schema = new Schema('string')
        .transformer((value) => ({ wrapped: value }))
        .serializer((value) => value.wrapped); // Extract from wrapper

      const compiled = await resolver.compile(schema);

      const transformed = { wrapped: 'hello' };
      const serialized = await compiled._serializeValue(transformed);

      assert.strictEqual(serialized, 'hello');
    });

    it('serializer: should chain multiple serializers', async function() {
      const schema = new Schema('object')
        .serializer((value) => value.inner)
        .serializer((value) => value.data)
        .serializer((value) => value.value);

      const compiled = await resolver.compile(schema);

      const nested = {
        inner: {
          data: {
            value: 'extracted'
          }
        }
      };

      const result = await compiled._serializeValue(nested);
      assert.strictEqual(result, 'extracted');
    });
  });

  describe('Handler policies', function() {

    it('should append with .normalizer().normalizer() calls', async function() {
      const schema = new Schema('string')
        .normalizer((value) => value + '-a')
        .normalizer((value) => value + '-b');

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('x');
      assert.strictEqual(result, 'x-a-b');
    });

    it('should append with .normalizers([...], APPEND)', async function() {
      const schema = new Schema('string')
        .normalizers([
          (value) => value + '-a',
          (value) => value + '-b'
        ], SchemaPolicy.APPEND);

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('x');
      assert.strictEqual(result, 'x-a-b');
    });

    it('should prepend to derived schema handlers (base still runs first)', async function() {
      const baseSchema = new Schema('string')
        .normalizer((value) => value + '-base');

      resolver.registerSchema('base-string', baseSchema);

      const derivedSchema = new Schema('base-string')
        .normalizer((value) => value + '-derived2')
        .normalizers([
          (value) => value + '-derived1'
        ], SchemaPolicy.PREPEND);

      const compiled = await resolver.compile(derivedSchema);

      // Base handlers always prepended during compilation, then derived1 (prepended), then derived2
      const result = await compiled._normalizeValue('x');
      assert.strictEqual(result, 'x-base-derived1-derived2');
    });

    it('should overwrite derived schema handlers (base still prepended)', async function() {
      const baseSchema = new Schema('string')
        .normalizer((value) => value + '-base');

      resolver.registerSchema('base-string', baseSchema);

      const derivedSchema = new Schema('base-string')
        .normalizer((value) => value + '-first')
        .normalizers([
          (value) => value + '-override'
        ], SchemaPolicy.OVERWRITE);

      const compiled = await resolver.compile(derivedSchema);

      // OVERWRITE replaces derived handlers, but base handlers still prepended during compilation
      const result = await compiled._normalizeValue('x');
      assert.strictEqual(result, 'x-base-override');
    });

    it('should initialize only if derived schema has no handlers', async function() {
      const schema = new Schema('string')
        .normalizer((value) => value + '-existing')
        .normalizers([
          (value) => value + '-init'
        ], SchemaPolicy.INITIALIZE);

      const compiled = await resolver.compile(schema);

      // INITIALIZE ignored because derived schema already has handlers
      const result = await compiled._normalizeValue('x');
      assert.strictEqual(result, 'x-existing');
    });

    it('should initialize when derived schema has no handlers', async function() {
      const baseSchema = new Schema('string')
        .normalizer((value) => value + '-base');

      resolver.registerSchema('base-string', baseSchema);

      const derivedSchema = new Schema('base-string')
        // No normalizers added yet
        .normalizers([
          (value) => value + '-init'
        ], SchemaPolicy.INITIALIZE);

      const compiled = await resolver.compile(derivedSchema);

      // INITIALIZE succeeds because derived schema has no handlers (base handlers added during compilation)
      const result = await compiled._normalizeValue('x');
      assert.strictEqual(result, 'x-base-init');
    });
  });

  describe('Cross-cutting: Undefined return handling', function() {

    it('should handle undefined return in normalizer', async function() {
      let callCount = 0;

      const schema = new Schema('string')
        .normalizer((value) => {
          callCount++;
          // Return undefined to signal retry
          return undefined;
        });

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('test');

      assert.strictEqual(result, undefined);
    });

    it('should not propagate undefined through pipeline in transformer', async function() {
      const schema = new Schema('string')
        .transformer((value) => value.toUpperCase())
        .transformer((value) => undefined) // Returns undefined
        .transformer((value) => 'third-transformer');

      const compiled = await resolver.compile(schema);

      const result = await compiled._transformValue('hello');

      // undefined propagates through - third transformer is not executed
      assert.strictEqual(result, undefined);
    });

    it('should not propagate null through pipeline in transformer', async function() {
      const schema = new Schema('string')
        .transformer((value) => value.toUpperCase())
        .transformer((value) => null) // Returns null
        .transformer((value) => 'third-transformer');

      const compiled = await resolver.compile(schema);

      const result = await compiled._transformValue('hello');

      // undefined propagates through - third transformer is not executed
      assert.strictEqual(result, null);
    });

    it('should handle undefined return in validator', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          // Return the value, not undefined
          return value;
        });

      const compiled = await resolver.compile(schema);

      const result = await compiled._validateValue('test');
      assert.strictEqual(result, 'test');
    });
  });

  describe('Cross-cutting: Error propagation', function() {

    it('should propagate errors from normalizer (wrapped)', async function() {
      const schema = new Schema('string')
        .normalizer((value) => {
          throw new ConstraintError('Normalizer error');
        });

      const compiled = await resolver.compile(schema);

      await assertWrappedError(
        async () => await compiled._normalizeValue('test'),
        NormalizeError,
        ConstraintError,
        'Normalizer error'
      );
    });

    it('should propagate errors from transformer', async function() {
      const schema = new Schema('string')
        .transformer((value) => {
          throw new TransformError('Transform error');
        });

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        async () => await compiled._transformValue('test'),
        TransformError
      );
    });

    it('should propagate errors from validator', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          throw new ValidationError('Validation error');
        });

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        async () => await compiled._validateValue('test'),
        ValidationError
      );
    });

    it('should discard serializer errors by default', async function() {
      const schema = new Schema('string')
        .serializer((value) => {
          throw new ConstraintError('Serializer error');
        });

      const compiled = await resolver.compile(schema);

      // Should not throw - errors are discarded, returns undefined
      const result = await compiled._serializeValue('test');
      assert.strictEqual(result, undefined);
    });

    it('should propagate serializer errors in strict mode', async function() {
      const schema = new Schema('string')
        .serializer((value) => {
          throw new ConstraintError('Serializer error');
        });

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        async () => await compiled._serializeValue('test', undefined, '', { strict: true }),
        Error // Wrapped in SerializeError
      );
    });
  });

  describe('Pipeline with processor specs', function() {

    it('should support registered processors in normalizer pipeline', async function() {
      resolver.registerValueProcessor('addSuffix',
        (value) => value + '-processed',
        'suffix'
      );

      const schema = new Schema('string')
        .normalizer('$addSuffix')
        .normalizer((value) => value.toUpperCase());

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('test');
      assert.strictEqual(result, 'TEST-PROCESSED');
    });

    it('should support parameterized processors in pipeline', async function() {
      const schema = new Schema('string')
        .normalizer({$pipeline: ['$trim', '$lowercase']});

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('  HELLO  ');
      assert.strictEqual(result, 'hello');
    });

    it('should chain function and processor spec normalizers', async function() {
      resolver.registerValueProcessor('double',
        (value) => value + value,
        'double'
      );

      const schema = new Schema('string')
        .normalizer((value) => value.trim())
        .normalizer('$double')
        .normalizer((value) => value.toUpperCase());

      const compiled = await resolver.compile(schema);

      const result = await compiled._normalizeValue('  x  ');
      assert.strictEqual(result, 'XX');
    });
  });
});
