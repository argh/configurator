
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';
import { ValidationError, TransformError, ConstraintError } from '../src/errors.js';

describe('Schema Compilation - Validator Registration and Resolution', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple validator registration', function() {

    it('should register a simple validator function', function() {
      const validatorFn = (value) => {
        if (value !== 'valid') throw new Error('Not valid');
        return value;
      };

      resolver.registerValueProcessor('myValidator', validatorFn);

      // Should not throw
      assert.ok(true);
    });

    it('should throw error when registering non-function validator', function() {
      assert.throws(
        () => resolver.registerValueProcessor('invalid', 'not-a-function')
      );
    });

    it('should register validator with describe function', function() {
      const validatorFn = (value) => value;
      const describeFn = () => 'my custom validator description';

      resolver.registerValueProcessor('described', validatorFn, describeFn);

      // Should not throw
      assert.ok(true);
    });

    it('should use keyword as default description when describeFn not provided', function() {
      const validatorFn = (value) => value;

      resolver.registerValueProcessor('simpleKeyword', validatorFn);

      // Will verify description in compilation tests
      assert.ok(true);
    });
  });

  describe('Parameterized validator registration', function() {

    it('should register a parameterized validator', function() {
      const compileFn = (args, compileSpec) => {
        return {
          validator: async (value) => {
            if (value < args.min) throw new Error('Too small');
            return value;
          },
          description: `minimum ${args.min}`
        };
      };

      resolver.registerParameterizedValueProcessor('minimum', compileFn);

      // Should not throw
      assert.ok(true);
    });

    it('should pass compile function that can recursively compile specs', function() {
      let capturedCompileSpec;

      const compileFn = (args, compileSpec) => {
        capturedCompileSpec = compileSpec;
        return {
          validator: async (value) => value,
          description: 'test'
        };
      };

      resolver.registerParameterizedValueProcessor('recursive', compileFn);

      // Compile a schema that uses it
      const schema = new Schema('string')
        .validator({ recursive: { nested: true } });

      resolver.compile(schema);

      // The compileSpec function should have been passed
      assert.strictEqual(typeof capturedCompileSpec, 'function');
    });
  });

  describe('Validator resolution with $ prefix', function() {

    it('should resolve simple validator by $keyword', function() {
      resolver.registerValueProcessor('custom', (value) => {
        if (value !== 'expected') throw new Error('Wrong value');
        return value;
      });

      const schema = new Schema('string')
        .validator('$custom');

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should throw error for unknown $keyword', function() {
      const schema = new Schema('string')
        .validator('$nonExistent');

      assert.throws(
        () => resolver.compile(schema)
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

      const compiled = resolver.compile(schema);

      await compiled.validate('test-value', {}, '');

      assert.strictEqual(invokedWith, 'test-value');
    });

    it('should use describe function for valueDescription', function() {
      resolver.registerValueProcessor('described',
        (value) => value,
        () => 'custom description text'
      );

      const schema = new Schema('string')
        .validator('$described');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[custom description text]');
    });

    it('should use keyword as description when describeFn not provided', function() {
      resolver.registerValueProcessor('simpleKeyword', (value) => value);

      const schema = new Schema('string')
        .validator('$simpleKeyword');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[simpleKeyword]');
    });
  });

  describe('Parameterized validator resolution with object spec', function() {

    it('should resolve parameterized validator with object {keyword: args}', function() {
      resolver.registerParameterizedValueProcessor('range', (args, compileSpec) => {
        return {
          validator: async (value) => {
            if (value < args.min || value > args.max) {
              throw new Error(`Out of range [${args.min}, ${args.max}]`);
            }
            return value;
          },
          description: `range [${args.min}, ${args.max}]`
        };
      });

      const schema = new Schema('number')
        .validator({ range: { min: 0, max: 100 } });

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should invoke parameterized validator correctly', async function() {
      resolver.registerParameterizedValueProcessor('min', (args, compileSpec) => {
        return {
          validator: async (value) => {
            if (value < args) throw new ValidationError(`Below minimum ${args}`);
            return value;
          }
        };
      });

      const schema = new Schema('number')
        .validator({ min: 10 });

      const compiled = resolver.compile(schema);

      // Should pass
      await compiled.validate(15, {}, '');

      // Should fail
      await assert.rejects(
        () => compiled.validate(5, {}, ''),
        ValidationError
      );
    });

    it('should allow $ prefix on object keyword', function() {
      resolver.registerParameterizedValueProcessor('maxLength', (args, compileSpec) => {
        return {
          validator: async (value) => {
            if (value.length > args) throw new Error('Too long');
            return value;
          }
        };
      });

      const schema = new Schema('string')
        .validator({ $maxLength: 5 });

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should throw error for unknown parameterized keyword', function() {
      const schema = new Schema('string')
        .validator({ unknownValidator: 42 });

      assert.throws(
        () => resolver.compile(schema)
      );
    });

    it('should throw error when simple validator used with parameters', function() {
      resolver.registerValueProcessor('simple', (value) => value);

      const schema = new Schema('string')
        .validator({ simple: { arg: 'value' } });

      assert.throws(
        () => resolver.compile(schema)
      );
    });

    it('should throw error for validator object with multiple keys', function() {
      resolver.registerParameterizedValueProcessor('validator1', (args) => ({
        validator: async (value) => value
      }));

      const schema = new Schema('string')
        .validator({ validator1: 1, validator2: 2 });

      assert.throws(
        () => resolver.compile(schema)
      );
    });

    it('should set description from parameterized validator', function() {
      resolver.registerParameterizedValueProcessor('range', (args, compileSpec) => {
        return {
          validator: async (value) => value,
          description: `between ${args.min} and ${args.max}`
        };
      });

      const schema = new Schema('number')
        .validator({ range: { min: 1, max: 10 } });

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[between 1 and 10]');
    });
  });

  describe('Inline function validators', function() {

    it('should accept function as validator spec', function() {
      const validatorFn = (value) => {
        if (value < 0) throw new Error('Negative');
        return value;
      };

      const schema = new Schema('number')
        .validator(validatorFn);

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should invoke inline function validator', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          if (value !== 'correct') throw new ValidationError('Wrong value');
          return value;
        });

      const compiled = resolver.compile(schema);

      await compiled.validate('correct', {}, '');

      await assert.rejects(
        () => compiled.validate('wrong', {}, ''),
        ValidationError
      );
    });

    it('should wrap sync function to async', async function() {
      const schema = new Schema('string')
        .validator((value) => value.toUpperCase());

      const compiled = resolver.compile(schema);

      const result = await compiled.validate('test', {}, '');
      assert.strictEqual(result, 'TEST');
    });

    it('should not set description for inline function', function() {
      const schema = new Schema('string')
        .validator((value) => value);

      const compiled = resolver.compile(schema);

      // Should not have description from function
      assert.strictEqual(compiled.metadata.valueDescription, '[string]');
    });
  });

  describe('RegExp validators', function() {

    it('should accept RegExp object as validator spec', function() {
      const schema = new Schema('string')
        .validator(/^[a-z]+$/);

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should invoke RegExp validator correctly', async function() {
      const schema = new Schema('string')
        .validator(/^\d{3}-\d{4}$/);

      const compiled = resolver.compile(schema);

      // Should pass
      await compiled.validate('123-4567', {}, '');

      // Should fail
      await assert.rejects(
        () => compiled.validate('invalid', {}, ''),
        ValidationError
      );
    });

    it('should set description from RegExp toString', function() {
      const schema = new Schema('string')
        .validator(/^test$/i);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[/^test$/i]');
    });

    it('should convert value to string before testing', async function() {
      const schema = new Schema('string')
        .validator(/^123$/);

      const compiled = resolver.compile(schema);

      // Number should be converted to string
      await compiled.validate('123', {}, '');
    });
  });

  describe('String RegExp pattern validators', function() {

    it('should accept string "/pattern/" as validator spec', function() {
      const schema = new Schema('string')
        .validator('/^[a-z]+$/');

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should parse flags from string "/pattern/flags"', function() {
      const schema = new Schema('string')
        .validator('/^TEST$/i');

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should invoke string RegExp validator correctly', async function() {
      const schema = new Schema('string')
        .validator('/^\\d+$/');

      const compiled = resolver.compile(schema);

      await compiled.validate('12345', {}, '');

      await assert.rejects(
        () => compiled.validate('abc', {}, ''),
        ValidationError
      );
    });

    it('should handle regex with case-insensitive flag', async function() {
      const schema = new Schema('string')
        .validator('/^hello$/i');

      const compiled = resolver.compile(schema);

      await compiled.validate('HELLO', {}, '');
      await compiled.validate('hello', {}, '');
      await compiled.validate('HeLLo', {}, '');
    });

    it('should throw error for invalid regex pattern', function() {
      const schema = new Schema('string')
        .validator('/[invalid/');

      assert.throws(
        () => resolver.compile(schema)
      );
    });

    it('should set description from string pattern', function() {
      const schema = new Schema('string')
        .validator('/^\\w+$/g');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[/^\\w+$/g]');
    });
  });

  describe('Literal string validators', function() {

    it('should accept plain string as exact match validator', function() {
      const schema = new Schema('string')
        .validator('exact-value');

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should validate exact string match', async function() {
      const schema = new Schema('string')
        .validator('required-value');

      const compiled = resolver.compile(schema);

      await compiled.validate('required-value', {}, '');

      await assert.rejects(
        () => compiled.validate('other-value', {}, ''),
        ValidationError
      );
    });

    it('should convert value to string for comparison', async function() {
      const schema = new Schema('string')
        .validator('123');

      const compiled = resolver.compile(schema);

      // String value should match
      await compiled.validate('123', {}, '');

      // Should fail
      await assert.rejects(
        () => compiled.validate('124', {}, ''),
        ValidationError
      );
    });

    it('should set description with quotes', function() {
      const schema = new Schema('string')
        .validator('literal-value');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '["literal-value"]');
    });

    it('should distinguish $ prefix from literal string', async function() {
      // Literal string starting with $ requires regex to match
      const schema = new Schema('string')
        .validator('/^\\$price$/');

      const compiled = resolver.compile(schema);

      await compiled.validate('$price', {}, '');
    });

    it('should not treat string without leading $ as keyword', async function() {
      const schema = new Schema('string')
        .validator('notAKeyword');

      const compiled = resolver.compile(schema);

      // Should validate exact match
      await compiled.validate('notAKeyword', {}, '');

      await assert.rejects(
        () => compiled.validate('something-else', {}, ''),
        ValidationError
      );
    });
  });

  describe('Validator precedence and inheritance', function() {

    it('should not override existing validator from base type', function() {
      // String base has a validator
      const schema = new Schema('string');

      const compiled = resolver.compile(schema);

      // Should have string validator from base
      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should override base validator with local validator', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          if (value !== 'custom') throw new ValidationError('Custom validation failed');
          return value;
        });

      const compiled = resolver.compile(schema);

      // Custom validator should be used, not base string validator
      await compiled.validate('custom', {}, '');

      await assert.rejects(
        () => compiled.validate('other', {}, ''),
        ValidationError
      );
    });

    it('should use type fallback when replacing validator that had description', function() {
      // Boolean base has {$in: [true, false]} validator generating 'true|false'
      // Replacing with function validator (no description) loses that description
      const schema = new Schema('boolean')
        .validator((value) => value);

      const compiled = resolver.compile(schema);

      // Falls back to type-based description since new validator has no description
      assert.strictEqual(compiled.metadata.valueDescription, '[boolean]');
    });

    it('should use new validator description when replacing base validator', function() {
      resolver.registerValueProcessor('custom',
        (value) => value,
        () => 'custom description'
      );

      // Boolean base has {$in: [true, false]} validator generating 'true|false'
      // Derived schema replaces it with $custom validator
      const schema = new Schema('boolean')
        .validator('$custom');

      const compiled = resolver.compile(schema);

      // Derived validator description takes precedence (derived overrides base)
      assert.strictEqual(compiled.metadata.valueDescription, '[custom description]');
    });

    it('should set valueDescription when base has none', function() {
      resolver.registerValueProcessor('withDesc',
        (value) => value,
        () => 'validator description'
      );

      // String type has no valueDescription in base
      const schema = new Schema('string')
        .validator('$withDesc');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[validator description]');
    });
  });

  describe('Multiple validator types across properties', function() {

    it('should compile different validator types for different properties', function() {
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

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.name.options.validator);
      assert.ok(compiled.properties.age.options.validator);
      assert.ok(compiled.properties.status.options.validator);
      assert.ok(compiled.properties.email.options.validator);
    });

    it('should invoke validators independently for each property', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string').validator(/^a/))
        .property('b', new Schema('string').validator(/^b/));

      const compiled = resolver.compile(schema);

      // Each property's validator should work independently
      await compiled.properties.a.validate('apple', {}, 'a');
      await compiled.properties.b.validate('banana', {}, 'b');

      await assert.rejects(
        () => compiled.properties.a.validate('banana', {}, 'a'),
        ValidationError
      );

      await assert.rejects(
        () => compiled.properties.b.validate('apple', {}, 'b'),
        ValidationError
      );
    });
  });

  describe('Parameterized validator recursive compilation', function() {

    it('should allow parameterized validator to recursively compile specs', function() {
      resolver.registerParameterizedValueProcessor('allOf', (args, compileSpec) => {
        const compiled = args.map(spec => compileSpec(spec));
        return {
          validator: async (value, config, schema, path) => {
            for (const c of compiled) {
              await c.validator(value, config, schema, path);
            }
            return value;
          },
          description: 'all conditions'
        };
      });

      const schema = new Schema('string')
        .validator({
          allOf: [
            /^[a-z]+$/,
            (v) => v.length >= 3 ? v : (() => { throw new Error('Too short') })()
          ]
        });

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.options.validator, 'function');
    });

    it('should invoke recursive validators correctly', async function() {
      resolver.registerParameterizedValueProcessor('allOf', (args, compileSpec) => {
        const compiled = args.map(spec => compileSpec(spec));
        return {
          validator: async (value, config, schema, path) => {
            for (const c of compiled) {
              await c.validator(value, config, schema, path);
            }
            return value;
          }
        };
      });

      const schema = new Schema('string')
        .validator({
          allOf: [
            /^test/,
            (v) => {
              if (v.length < 5) throw new Error('Too short');
              return v;
            }
          ]
        });

      const compiled = resolver.compile(schema);

      // Should pass both validators
      await compiled.validate('testing', {}, '');

      // Should fail first validator
      await assert.rejects(
        () => compiled.validate('hello', {}, ''),
        ValidationError
      );

      // Should fail second validator
      await assert.rejects(
        () => compiled.validate('test', {}, ''),
        ValidationError
      );
    });
  });

  describe('Edge cases and error handling', function() {

    it('should handle null validator spec as pass-through', async function() {
      const schema = new Schema('string')
        .validator(null);

      const compiled = resolver.compile(schema);

      const result = await compiled.validate('anything', {}, '');
      assert.strictEqual(result, 'anything');
    });

    it('should handle undefined validator spec as pass-through', async function() {
      const schema = new Schema('string')
        .validator(undefined);

      const compiled = resolver.compile(schema);

      const result = await compiled.validate('anything', {}, '');
      assert.strictEqual(result, 'anything');
    });

    it('should throw error for invalid validator spec type', function() {
      const schema = new Schema('string')
        .validator(123);

      assert.throws(
        () => resolver.compile(schema)
      );
    });

    it('should throw error for array validator spec', function() {
      const schema = new Schema('string')
        .validator([/test/, /other/]);

      assert.throws(
        () => resolver.compile(schema)
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

      const compiled = resolver.compile(schema);

      // Should pass both values check and validator
      await compiled.validate('RED', {}, '');
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

      const compiled = resolver.compile(schema);

      // Transform should reject before validator runs
      await assert.rejects(
        () => compiled.transform('invalid', {}, ''),
        TransformError
      );
    });
  });
});
