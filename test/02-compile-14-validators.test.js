
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';
import {
  ConstraintError,
  SchemaCompilationError,
  TransformError,
  ValidationError
} from '../src/schema/schema-errors.js';
import { ValueProcessor } from '../src/schema/value-processor/value-processor.js';
import { assertErrorMessageInCauseChain } from '../src/errors.js';

describe('Schema Compilation - Validator Registration and Resolution', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple validator registration', function() {

    it('should throw error when registering non-function validator', function() {
      assert.throws(
        () => resolver.registerValueProcessor('invalid', 'not-a-function')
      );
    });
  });

  describe('Validator resolution with $ prefix', function() {

    it('should throw error for unknown $keyword', async function() {
      const schema = new Schema('string')
        .validator('$nonExistent');

      await assert.rejects(
      async () => await resolver.compile(schema)
      );
    });

    it('should invoke simple validator correctly', async function() {
      let invokedWith = null;

      resolver.registerValueProcessor('capture', (value) => {
        invokedWith = value;
        return value;
      });

      const schema = new Schema('string')
        .validator('$capture');

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('test-value');

      assert.strictEqual(invokedWith, 'test-value');
    });

    it('should use description string for valueDescription', async function() {
      resolver.registerValueProcessor('described',
        (value) => value,
        'custom description text'
      );

      const schema = new Schema('string')
        .validator('$described');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[custom description text]');
    });

    it('should use keyword as description when describeFn not provided', async function() {
      resolver.registerValueProcessor('simpleKeyword', (value) => value);

      const schema = new Schema('string')
        .validator('$simpleKeyword');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[simpleKeyword]');
    });
  });

  describe('Parameterized validator resolution with object spec', function() {

    it('should invoke parameterized validator correctly', async function() {
      resolver.registerValueProcessorBuilder('min', (args) => {

        if (!Array.isArray(args) || args.length !== 1) throw new Error('args must be an array[1]');

        const argsExecutor = args[0];

        return {
          keyword: 'min',
          process: async (value) => {
            const a = await argsExecutor.execute(value);
            if (value < a) throw new ValidationError(`Below minimum ${a}`);
            return value;
          }
        };
      });

      const schema = new Schema('number')
        .validator({ $min: 10 });

      const compiled = await resolver.compile(schema);

      // Should pass
      await compiled.validateValue(15);

      // Should fail
      await assert.rejects(
        () => compiled.validateValue(5),
        ValidationError
      );
    });

    it('should throw error for unknown parameterized keyword', async function() {
      const schema = new Schema('string')
        .validator({ $unknownValidator: 42 });

      await assert.rejects(
      async () => await resolver.compile(schema)
      );
    });

    it('should throw error when simple validator used with parameters', async function() {
      resolver.registerValueProcessor('simple', (value) => value);

      const schema = new Schema('string')
        .validator({ $simple: { arg: 'value' } });

      await assert.rejects(
      async () => await resolver.compile(schema),
        error => assertErrorMessageInCauseChain(error, /Too many arguments/)
      );
    });

    it('should throw error for validator object with multiple keys', async function() {
      resolver.registerValueProcessorBuilder('validator1', (args) => ({
        process: (value) => value
      }));

      const schema = new Schema('string')
        .validator({ $validator1: 1, $validator2: 2 });

      await assert.rejects(
        async () => await resolver.compile(schema),
        error => assertErrorMessageInCauseChain(error, /Invalid value processor specification/)
      );
    });

    it('should set description from parameterized validator', async function() {
      resolver.registerValueProcessorBuilder('testrange', (args) => {
        const description = `between ${args.min.description} and ${args.max.description}`
        return {
          keyword: 'testrange',
          process: (value) => value,
          description
        };
      });

      const schema = new Schema('number')
        .validator({ $testrange: { min: 1, max: 10 } });

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[between 1 and 10]');
    });
  });

  describe('Inline function validators', function() {

    it('should invoke inline function validator', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          if (value !== 'correct') throw new ValidationError('Wrong value');
          return value;
        });

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('correct');

      await assert.rejects(
        () => compiled.validateValue('wrong'),
        ValidationError
      );
    });

    it('should wrap sync function to async', async function() {
      const schema = new Schema('string')
        .validator((value) => value.toUpperCase());

      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('test');
      assert.strictEqual(result, 'TEST');
    });

    it('should not set description for inline function', async function() {
      const schema = new Schema('string')
        .validator((value) => value);

      const compiled = await resolver.compile(schema);

      // Should not have description from function
      assert.strictEqual(compiled.metadata.valueDescription, '[string]');
    });
  });

  describe('RegExp validators', function() {

    it('should invoke RegExp validator correctly', async function() {
      const schema = new Schema('string')
        .validator(/^\d{3}-\d{4}$/);

      const compiled = await resolver.compile(schema);

      // Should pass
      await compiled.validateValue('123-4567');

      // Should fail
      await assert.rejects(
        () => compiled.validateValue('invalid'),
        ValidationError
      );
    });

    it('should set description from RegExp toString', async function() {
      const schema = new Schema('string')
        .validator(/^test$/i);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[/^test$/i]');
    });

    it('should convert value to string before testing', async function() {
      const schema = new Schema('string')
        .validator(/^123$/);

      const compiled = await resolver.compile(schema);

      // Number should be converted to string
      await compiled.validateValue('123');
    });
  });

  describe('String RegExp pattern validators', function() {

    it('should invoke string RegExp validator correctly', async function() {
      const schema = new Schema('string')
        .validator('/^\\d+$/');

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('12345');

      await assert.rejects(
        () => compiled.validateValue('abc'),
        ValidationError
      );
    });

    it('should handle regex with case-insensitive flag', async function() {
      const schema = new Schema('string')
        .validator('/^hello$/i');

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('HELLO');
      await compiled.validateValue('hello');
      await compiled.validateValue('HeLLo');
    });

    it('should throw error for invalid regex pattern', async function() {
      const schema = new Schema('string')
        .validator('/[invalid/');

      await assert.rejects(
      async () => await resolver.compile(schema)
      );
    });

    it('should set description from string pattern', async function() {
      const schema = new Schema('string')
        .validator('/^\\w+$/g');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[/^\\w+$/g]');
    });
  });

  describe('Literal string validators', function() {

    it('should validate exact string match', async function() {
      const schema = new Schema('string')
        .validator({$eq: 'required-value'});

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('required-value');

      await assert.rejects(
        () => compiled.validateValue('other-value'),
        ValidationError
      );
    });

    it('should convert value to string for comparison', async function() {
      const schema = new Schema('string')
        .validator({$eq: '123'});

      const compiled = await resolver.compile(schema);

      // String value should match
      await compiled.validateValue('123');

      // Should fail
      await assert.rejects(
        () => compiled.validateValue('124'),
        ValidationError
      );
    });

    it('should set description without quotes', async function() {
      const schema = new Schema('string')
        .validator('literal-value');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[literal-value]');
    });

    it('should distinguish $ prefix from literal string', async function() {
      // Literal string starting with $ requires regex to match
      const schema = new Schema('string')
        .validator('/^\\$price$/');

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('$price');
    });

    it('should not treat string without leading $ as keyword', async function() {
      const schema = new Schema('string')
        .validator('notAKeyword');

      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('something-else');
      assert.strictEqual(result, 'notAKeyword');  // validator is returning a constant string!

    });
  });

  describe('Validator precedence and inheritance', function() {

    it('should not override existing validator from base type', async function() {
      // String base has a validator
      const schema = new Schema('string');

      const compiled = await resolver.compile(schema);

      // Should have string validator from base
      const result = await compiled.validateValue('test');
      assert.strictEqual(result, 'test');
    });

    it('should override base validator with local validator', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          if (value !== 'custom') throw new ValidationError('Custom validation failed');
          return value;
        });

      const compiled = await resolver.compile(schema);

      // Custom validator should be used, not base string validator
      await compiled.validateValue('custom');

      await assert.rejects(
        () => compiled.validateValue('other'),
        ValidationError
      );
    });

    it('should use type fallback when replacing validator that had description', async function() {
      // Boolean base has {$in: [true, false]} validator generating 'true|false'
      // Appending with function validator (no description) maintains that description
      const schema = new Schema('boolean')
        .validator((value) => value);

      const compiled = await resolver.compile(schema);

      // Falls back to type-based description since new validator has no description
      assert.strictEqual(compiled.metadata.valueDescription, '[true|false]');
    });

    it('should append new validator description when adding a validator', async function() {
      resolver.registerValueProcessor('custom',
        (value) => value,
        'custom description'
      );

      // Boolean base has {$in: [true, false]} validator generating 'true|false'
      // Derived schema replaces it with $custom validator
      const schema = new Schema('boolean')
        .validator('$custom');

      const compiled = await resolver.compile(schema);

      // Derived validator description takes precedence (derived overrides base)
      assert.strictEqual(compiled.metadata.valueDescription, '[(true|false) >> custom description]');
    });

    it('should prefer explicit value description over that of validators', async function() {
      resolver.registerValueProcessor('custom',
        (value) => value,
        'custom description'
      );

      // Boolean base has {$in: [true, false]} validator generating 'true|false'
      // Derived schema replaces it with $custom validator
      const schema = new Schema('boolean')
        .validator('$custom')
        .meta('valueDescription', 'override')

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'override');
    });

    it('should set valueDescription when base has none', async function() {
      resolver.registerValueProcessor('withDesc',
        (value) => value,
        'validator description'
      );

      // String type has no valueDescription in base
      const schema = new Schema('string')
        .validator('$withDesc');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[validator description]');
    });
  });

  describe('Multiple validator types across properties', function() {

    it('should compile different validator types for different properties', async function() {
      resolver.registerValueProcessor('positive', (value) => {
        if (value <= 0) throw new Error('Must be positive');
        return value;
      });

      const schema = new Schema('object')
        .property('name', new Schema('string').validator(/^[A-Z]/))
        .property('age', new Schema('number').validator('$positive'))
        .property('status', new Schema('string').validator('active'))
        .property('email', new Schema('string').validator((v) => {
          if (!v.includes('@')) throw new Error('Invalid email');
          return v;
        }));

      const compiled = await resolver.compile(schema);

      await compiled.properties.name.validateValue('John');
      await compiled.properties.age.validateValue(25);
      await compiled.properties.status.validateValue('active');
      await compiled.properties.email.validateValue('test@example.com');
    });

    it('should invoke validators independently for each property', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string').validator(/^a/))
        .property('b', new Schema('string').validator(/^b/));

      const compiled = await resolver.compile(schema);

      // Each property's validator should work independently
      await compiled.properties.a.validateValue('apple');
      await compiled.properties.b.validateValue('banana');

      await assert.rejects(
        () => compiled.properties.a.validateValue('banana'),
        ValidationError
      );

      await assert.rejects(
        () => compiled.properties.b.validateValue('apple'),
        ValidationError
      );
    });
  });

  describe('Parameterized validator recursive compilation', function() {

    it('should invoke recursive validators correctly', async function() {
      resolver.registerValueProcessorBuilder('allOf', (args) => {
        return {
          keyword: 'allOf',
          process: async (value, config, location) => {
            for (const c of args) {
              await c.execute(value, config, location);
            }
            return value;
          }
        };
      });

      const schema = new Schema('string')
        .validator({
          $allOf: [
            /^test/,
            (v) => {
              if (v.length < 5) throw new Error('Too short');
              return v;
            }
          ]
        });

      const compiled = await resolver.compile(schema);

      // Should pass both validators
      await compiled.validateValue('testing');

      // Should fail first validator
      await assert.rejects(
        () => compiled.validateValue('hello'),
        ValidationError
      );

      // Should fail second validator
      await assert.rejects(
        () => compiled.validateValue('test'),
        ValidationError
      );
    });
  });

  describe('Edge cases and error handling', function() {


    it('should handle $null validator spec as pruning the value', async function() {
      const schema = new Schema('string')
        .validator('$null');

      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('anything');
      assert.strictEqual(result, null);
    });
    it('should handle null validator spec as pass-through', async function() {
      const schema = new Schema('string')
        .validator(null);

      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('anything');
      assert.strictEqual(result, 'anything');
    });

    it('should handle undefined validator spec as pass-through', async function() {
      const schema = new Schema('string')
        .validator(undefined);

      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('anything');
      assert.strictEqual(result, 'anything');
    });

    it('should handle $undefined validator spec as pass-through', async function() {
      const schema = new Schema('string')
        .validator('$undefined');

      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('anything');
      assert.strictEqual(result, 'anything');
    });


    it('should throw error for invalid validator spec type', async function() {
      const schema = new Schema('string')
        .validator({});

      await assert.rejects(
      async () => await resolver.compile(schema)
      );
    });

    it('should aggregate array of specs and individual specs', async function() {
      const schema = new Schema('string')
        .validator([(v) => v.toUpperCase(), (v) => v.trim()])
        .validator(v => { if (v === 'EVIL') { throw new Error('discovered EVIL')}});

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('   evil  '),
        (/** @type {ValidationError} */ error) => {
          assert.strictEqual(error?.cause?.message, 'discovered EVIL')
          return true;
        }
      );


    });
  });

  describe('Validator with values constraint', function() {

    it('should apply validator in addition to values constraint', async function() {
      resolver.registerValueProcessor('uppercase', (value) => {
        if (value !== value.toUpperCase()) {
          throw new Error('Must be uppercase');
        }
        return value;
      });

      const schema = new Schema('string')
        .values(['RED', 'GREEN', 'BLUE'])
        .validator('$uppercase');

      const compiled = await resolver.compile(schema);

      // Should pass both values check and validator
      await compiled.validateValue('RED');
    });

    it('should validate after values transformation', async function() {
      const schema = new Schema('string')
        .values(['a', 'b', 'c'])
        .validator((value) => {
          // Validator runs after value is checked against values list
          if (!['a', 'b', 'c'].includes(value)) {
            throw new Error('Not in list');
          }
          return value;
        });

      const compiled = await resolver.compile(schema);

      // Transform should reject before validator runs
      await assert.rejects(
        () => compiled.transformValue('invalid'),
        TransformError
      );
    });
  });
});
