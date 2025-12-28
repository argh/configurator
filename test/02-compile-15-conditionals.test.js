
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/errors.js';

describe('Schema Compilation - Conditionals', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Default condition behavior', function() {

    it('should have condition function after compilation', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.checkCondition('test', {}, 'path');
      assert.strictEqual(typeof result, 'boolean');
    });

    it('should default to always true when no condition specified', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.checkCondition('test', {}, 'path');
      assert.strictEqual(result, true);
    });

    it('should have condition on all property schemas', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const resultA = await compiled.properties.a.checkCondition('test', {}, 'a');
      const resultB = await compiled.properties.b.checkCondition(42, {}, 'b');
      assert.strictEqual(typeof resultA, 'boolean');
      assert.strictEqual(typeof resultB, 'boolean');
    });

    it('should default to true for nested properties', async function() {
      const schema = new Schema('object')
        .property('nested', new Schema('object')
          .property('value', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.properties.nested.properties.value.checkCondition('test', {}, 'nested.value');
      assert.strictEqual(result, true);
    });
  });

  describe('Custom condition functions', function() {

    it('should accept function as condition', async function() {
      const schema = new Schema('string').condition(() => true)

      const compiled = await resolver.compile(schema);

      const result = await compiled.checkCondition('test', {}, 'path');
      assert.strictEqual(result, true);
    });

    it('should invoke custom condition function', async function() {
      let invoked = false;
      const schema = new Schema('string')
        .condition(() => {
          invoked = true;
          return true;
        });

      const compiled = await resolver.compile(schema);
      await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(invoked, true);
    });

    it('should pass value to condition function', async function() {
      let capturedValue;
      const schema = new Schema('string')
        .condition((value) => {
          capturedValue = value;
          return true;
        });

      const compiled = await resolver.compile(schema);
      await compiled.checkCondition('test-value', {}, 'path');

      assert.strictEqual(capturedValue, 'test-value');
    });

    it('should pass configuration to condition function', async function() {
      let capturedConfig;
      const schema = new Schema('string')
        .condition((value, configuration) => {
          capturedConfig = configuration;
          return true;
        });

      const compiled = await resolver.compile(schema);
      const config = { setting: 'value' };
      await compiled.checkCondition('test', config, 'path');

      assert.deepStrictEqual(capturedConfig, { setting: 'value' });
    });

    it('should pass schema to condition function', async function() {
      let capturedSchema;
      const schema = new Schema('string')
        .condition((value, configuration, schema) => {
          capturedSchema = schema;
          return true;
        });

      const compiled = await resolver.compile(schema);
      await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(capturedSchema, compiled);
    });

    it('should pass path to condition function', async function() {
      let capturedPath;
      const schema = new Schema('string')
        .condition((value, configuration, schema, path) => {
          capturedPath = path;
          return true;
        });

      const compiled = await resolver.compile(schema);
      await compiled.checkCondition('test', {}, 'some.nested.path');

      assert.strictEqual(capturedPath, 'some.nested.path');
    });

    it('should return true when condition passes', async function() {
      const schema = new Schema('string').condition(() => true);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, true);
    });

    it('should return false when condition fails', async function() {
      const schema = new Schema('string').condition(() => false);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should handle async condition functions', async function() {
      const schema = new Schema('string')
        .condition( async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return true;
        });


      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, true);
    });

    it('should wrap sync condition functions', async function() {
      const schema = new Schema('string')
        .condition((value) => value === 'expected');

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('expected', {}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition('other', {}, 'path');
      assert.strictEqual(resultFalse, false);
    });
  });

  describe('Value-based conditionals', function() {

    it('should allow condition based on value content', async function() {
      const schema = new Schema('string')
        .condition((value) => value && value.length > 0);

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('non-empty', {}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition('', {}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should allow condition based on value type', async function() {
      const schema = new Schema('any')
        .condition((value) => typeof value === 'string');

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('text', {}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition(123, {}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should allow condition based on numeric value', async function() {
      const schema = new Schema('number')
        .condition((value) => value > 0);


      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition(5, {}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition(-1, {}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should allow condition based on boolean value', async function() {
      const schema = new Schema('boolean')
        .condition((value) => value === true)

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition(true, {}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition(false, {}, 'path');
      assert.strictEqual(resultFalse, false);
    });
  });

  describe('Configuration-based conditionals', function() {

    it('should allow condition based on configuration state', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => configuration.enabled === true)

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('test', {enabled: true}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition('test', {enabled: false}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should allow condition based on other configuration properties', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => configuration.mode === 'advanced');

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('test', {mode: 'advanced'}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition('test', {mode: 'basic'}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should allow condition based on nested configuration', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => configuration.settings?.debug === true);

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('test', {settings: {debug: true}}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition('test', {settings: {debug: false}}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should handle missing configuration properties', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => configuration.optional?.setting ?? false);

      const compiled = await resolver.compile(schema);

      const result = await compiled.checkCondition('test', {}, 'path');
      assert.strictEqual(result, false);
    });
  });

  describe('Complex conditional logic', function() {

    it('should support AND conditions', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => value && value.length > 0 && configuration.enabled === true);


      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('text', {enabled: true}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse1 = await compiled.checkCondition('', {enabled: true}, 'path');
      assert.strictEqual(resultFalse1, false);

      const resultFalse2 = await compiled.checkCondition('text', {enabled: false}, 'path');
      assert.strictEqual(resultFalse2, false);
    });

    it('should support OR conditions', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => (configuration.mode === 'debug' || configuration.mode === 'development'));

      const compiled = await resolver.compile(schema);

      const resultTrue1 = await compiled.checkCondition('test', {mode: 'debug'}, 'path');
      assert.strictEqual(resultTrue1, true);

      const resultTrue2 = await compiled.checkCondition('test', {mode: 'development'}, 'path');
      assert.strictEqual(resultTrue2, true);

      const resultFalse = await compiled.checkCondition('test', {mode: 'production'}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should support NOT conditions', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => configuration.disabled !== true);

      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.checkCondition('test', {disabled: false}, 'path');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.checkCondition('test', {disabled: true}, 'path');
      assert.strictEqual(resultFalse, false);
    });

    it('should support nested logical expressions', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) =>
          (configuration.env === 'production' && configuration.logging === 'verbose') ||
          (configuration.env === 'development'));

      const compiled = await resolver.compile(schema);

      const resultTrue1 = await compiled.checkCondition('test', {env: 'production', logging: 'verbose'}, 'path');
      assert.strictEqual(resultTrue1, true);

      const resultTrue2 = await compiled.checkCondition('test', {env: 'development'}, 'path');
      assert.strictEqual(resultTrue2, true);

      const resultFalse = await compiled.checkCondition('test', {env: 'production', logging: 'normal'}, 'path');
      assert.strictEqual(resultFalse, false);
    });
  });

  describe('Conditions on properties', function() {

    it('should apply conditions to individual properties', async function() {
      const schema = new Schema('object')
        .property('always', new Schema('string'))
        .property('conditional', new Schema('string')
          .condition((value, configuration) => configuration.showConditional === true)
        );

      const compiled = await resolver.compile(schema);

      const alwaysResult = await compiled.properties.always.checkCondition('test', {}, 'always');
      assert.strictEqual(alwaysResult, true);

      const conditionalTrue = await compiled.properties.conditional.checkCondition('test', {showConditional: true},
        'conditional');
      assert.strictEqual(conditionalTrue, true);

      const conditionalFalse = await compiled.properties.conditional.checkCondition('test', {showConditional: false},
        'conditional');
      assert.strictEqual(conditionalFalse, false);
    });

    it('should support different conditions on different properties', async function() {
      const schema = new Schema('object')
        .property('debug', new Schema('string')
          .condition((value, configuration) => configuration.debug === true)
        )
        .property('verbose', new Schema('string')
          .condition((value, configuration) => configuration.verbose === true)
        )

      const compiled = await resolver.compile(schema);

      const debugResult = await compiled.properties.debug.checkCondition('test', {debug: true, verbose: false},
        'debug');
      assert.strictEqual(debugResult, true);

      const verboseResult = await compiled.properties.verbose.checkCondition('test', {debug: true, verbose: false},
        'verbose');
      assert.strictEqual(verboseResult, false);
    });

    it('should support conditions on nested properties', async function() {
      const schema = new Schema('object')
        .property('outer', new Schema('object')
          .property('inner', new Schema('string')
            .condition((value, configuration) => configuration.enableInner === true)
          )
        );


      const compiled = await resolver.compile(schema);

      const resultTrue = await compiled.properties.outer.properties.inner.checkCondition('test', {enableInner: true},
        'outer.inner');
      assert.strictEqual(resultTrue, true);

      const resultFalse = await compiled.properties.outer.properties.inner.checkCondition('test',
        {enableInner: false}, 'outer.inner');
      assert.strictEqual(resultFalse, false);
    });
  });

  describe('Condition precedence and inheritance', function() {

    it('should not override explicit condition with base type default', async function() {
      const schema = new Schema('string')
        .condition(() => false);

      const compiled = await resolver.compile(schema);

      // Should not use base string's condition
      const result = await compiled.checkCondition('test', {}, 'path');
      assert.strictEqual(result, false);
    });

    it('should use local condition over base schema condition', async function() {
      const baseSchema = new Schema('string').condition(() => false);

      resolver.registerSchema('falseBase', baseSchema);

      const derivedSchema = new Schema('falseBase').condition(() => true);

      const compiled = await resolver.compile(derivedSchema);
      const result = await compiled.checkCondition('test', {}, 'path');

      // Should use derived condition (true), not base condition (false)
      assert.strictEqual(result, true);
    });
  });

  describe('Edge cases', function() {

    it('should handle condition with undefined value parameter', async function() {
      const schema = new Schema('string')
        .condition((value) => value !== undefined)

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition(undefined, {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should handle condition with empty configuration', async function() {
      const schema = new Schema('string')
        .condition((value, configuration) => Object.keys(configuration).length > 0);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });
  });

  describe('Condition type coercion', function() {

    it('should coerce truthy non-boolean values to true', async function() {
      const schema = new Schema('string')
        // @ts-ignore
        .condition(() => 'truthy string');

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, true);
    });

    it('should coerce falsy non-boolean values to false', async function() {
      const schema = new Schema('string')
        // @ts-ignore
        .condition(() => 0);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should coerce undefined to false', async function() {
      const schema = new Schema('string')
        // @ts-ignore
        .condition(() => undefined);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should coerce null to false', async function() {
      const schema = new Schema('string')
        // @ts-ignore
        .condition(() => null);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should coerce empty string to false', async function() {
      const schema = new Schema('string')
        // @ts-ignore
        .condition(() => '');

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should coerce 0 to false', async function() {
      const schema = new Schema('string')
        // @ts-ignore
        .condition(() => 0)

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });

    it('should preserve true as true', async function() {
      const schema = new Schema('string').condition(() => true);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, true);
    });

    it('should preserve false as false', async function() {
      const schema = new Schema('string').condition(() => false);

      const compiled = await resolver.compile(schema);
      const result = await compiled.checkCondition('test', {}, 'path');

      assert.strictEqual(result, false);
    });
  });

  describe('Conditions with other schema features', function() {

    it('should work with validators', async function() {
      const schema = new Schema('string')
        .validator(/^\d+$/)
        .condition((value) => value && value.length > 0);

      const compiled = await resolver.compile(schema);

      await compiled.validateValue('123');
      const condResult = await compiled.checkCondition('123', {}, 'path');
      assert.strictEqual(condResult, true);
    });

    it('should work with transformers', async function() {
      const schema = new Schema('string')
        .transformer((value) => value.toUpperCase())
        .condition((value) => value && value.length > 0)

      const compiled = await resolver.compile(schema);

      const transformed = await compiled.transformValue('test');
      assert.strictEqual(transformed, 'TEST');
      const condResult = await compiled.checkCondition('test', {}, 'path');
      assert.strictEqual(condResult, true);
    });

    it('should work with values constraint', async function() {
      const schema = new Schema('string')
        .values(['a', 'b', 'c'])
        .condition((value) => value !== 'a');

      const compiled = await resolver.compile(schema);

      const resultB = await compiled.checkCondition('b');
      assert.strictEqual(resultB, true);

      const resultA = await compiled.checkCondition('a');
      assert.strictEqual(resultA, false);
    });

    it('should work with default values', async function() {
      const schema = new Schema('string')
        .default('default-value')
        .condition((value, configuration) => configuration.useDefault === true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.options.default, 'default-value');
      const condResult = await compiled.checkCondition('test', {useDefault: true}, 'path');
      assert.strictEqual(condResult, true);
    });

    it('should work with required flag', async function() {
      const schema = new Schema('string')
        .required()
        .condition((value, configuration) => configuration.required === true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.options.required, true);
      const condResult = await compiled.checkCondition('test', {required: true}, 'path');
      assert.strictEqual(condResult, true);
    });
  });
});
