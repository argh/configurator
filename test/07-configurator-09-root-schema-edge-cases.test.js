
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { Configurator } from '../src/configurator.js';
import { ObjectSource, SchemaDefaultsSource } from '../src/configuration-sources/index.js';

describe('Configurator - Root Schema Edge Cases', function() {

  describe('Primitive root schemas', function() {

    it('should configure with string root schema', async function() {
      const schema = new Schema('string');

      const context = {
        overrides: 'hello-world'
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, 'hello-world');
    });

    it('should configure with number root schema', async function() {
      const schema = new Schema('number');

      const context = {
        overrides: 42
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, 42);
    });

    it('should configure with boolean root schema', async function() {
      const schema = new Schema('boolean');

      const context = {
        overrides: true
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, true);
    });

    it('should normalize primitive values at root', async function() {
      const schema = new Schema('number');

      const context = {
        overrides: '123'
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, 123);
    });

    it('should apply default for primitive root schema', async function() {
      // TODO: Default values not applied for primitive root schemas (returns null)
      const schema = new Schema('string').default('default-value');

      const context = {};

      const config = await new Configurator({
        schema,
        sources: [
          new SchemaDefaultsSource(),
          new ObjectSource({ contextName: 'overrides', sequence: 1000 })
        ],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, 'default-value');
    });

  });

  describe('Array root schemas', function() {

    it('should configure with array root schema', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const context = {
        overrides: ['foo', 'bar', 'baz']
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.deepStrictEqual(config, ['foo', 'bar', 'baz']);
    });

    it('should configure array with object elements at root', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('name', new Schema('string'))
          .property('value', new Schema('number'))
        );

      const context = {
        overrides: [
          { name: 'first', value: 1 },
          { name: 'second', value: 2 }
        ]
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.deepStrictEqual(config, [
        { name: 'first', value: 1 },
        { name: 'second', value: 2 }
      ]);
    });

    it('should configure array with union elements at root', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('any')
          .unionDiscriminator((value) => typeof value === 'string' ? 'simple' : 'complex')
          .unionSchema('simple', new Schema('string'))
          .unionSchema('complex', new Schema('object')
            .property('name', new Schema('string'))
            .property('count', new Schema('number'))
          )
        );

      const context = {
        overrides: [
          'simple-string',
          { name: 'complex', count: 42 },
          'another-string'
        ]
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config[0], 'simple-string');
      assert.deepStrictEqual(config[1], { name: 'complex', count: 42 });
      assert.strictEqual(config[2], 'another-string');
    });

    it('should apply defaults in array root schema', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('name', new Schema('string'))
          .property('enabled', new Schema('boolean').default(true))
        );

      const context = {
        overrides: [
          { name: 'first' },
          { name: 'second', enabled: false }
        ]
      };

      const config = await new Configurator({
        schema,
        sources: [
          new SchemaDefaultsSource(),
          new ObjectSource({ contextName: 'overrides', sequence: 1000 })
        ],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.deepStrictEqual(config, [
        { name: 'first', enabled: true },
        { name: 'second', enabled: false }
      ]);
    });

  });

  describe('Union root schemas', function() {

    it('should configure with union root schema', async function() {
      // that don't work at root level. Need special handling for root union resolution.
      const schema = new Schema('any')
        .unionDiscriminator((value) => typeof value === 'string' ? 'simple' : 'complex')
        .unionSchema('simple', new Schema('string'))
        .unionSchema('complex', new Schema('object')
          .property('name', new Schema('string'))
          .property('value', new Schema('number'))
        );

      const context = {
        overrides: { name: 'test', value: 123 }
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.deepStrictEqual(config, { name: 'test', value: 123 });
    });

    it('should discriminate string vs object at root level', async function() {
      const schema = new Schema('any')
        .unionDiscriminator((value) => typeof value === 'string' ? 'simple' : 'complex')
        .unionSchema('simple', new Schema('string'))
        .unionSchema('complex', new Schema('object')
          .property('data', new Schema('string'))
        );

      const contextString = {
        overrides: 'just-a-string'
      };

      const configString = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(contextString);

      assert.strictEqual(configString, 'just-a-string');

      const contextObject = {
        overrides: { data: 'object-value' }
      };

      const configObject = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(contextObject);

      assert.deepStrictEqual(configObject, { data: 'object-value' });
    });

    it('should handle union with property-based discriminator at root', async function() {
      // TODO: Property-based union discriminator at root - fails with "Unknown property 'path'"
      const schema = new Schema('object')
        .property('type', new Schema('string'))
        .unionDiscriminator('type')
        .unionSchema('config', new Schema('object')
          .property('type', Schema.literal('config'))
          .property('path', new Schema('string'))
        )
        .unionSchema('inline', new Schema('object')
          .property('type', Schema.literal('inline'))
          .property('value', new Schema('string'))
        );

      const context = {
        overrides: { type: 'config', path: '/etc/app.conf' }
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.deepStrictEqual(config, { type: 'config', path: '/etc/app.conf' });
    });

  });

  describe('Root transformers and normalizers', function() {

    it('should call root transformer on primitive schema', async function() {
      const transformCalls = [];

      const schema = new Schema('string')
        .transformer((value) => {
          transformCalls.push(value);
          return value.toUpperCase();
        });

      const context = {
        overrides: 'hello'
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, 'HELLO');
      assert.strictEqual(transformCalls.length, 1);
      assert.strictEqual(transformCalls[0], 'hello');
    });

    it('should call root transformer on object schema with incremental=true', async function() {
      // With allowIncremental=true (default), transformer called early with empty object
      // to create wrapper/container that properties will be assigned to incrementally
      const transformCalls = [];

      const schema = new Schema('object')
        .transformer((value) => {
          transformCalls.push(JSON.parse(JSON.stringify(value)));
          return value;
        })
        .property('name', new Schema('string'))
        .property('value', new Schema('number'));

      const context = {
        overrides: { name: 'test', value: 42 }
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.deepStrictEqual(config, { name: 'test', value: 42 });
      assert.strictEqual(transformCalls.length, 1);
      assert.deepStrictEqual(transformCalls[0], {}); // Called with empty object
    });

    it('should call root normalizer before transformer', async function() {
      const calls = [];

      const schema = new Schema('string')
        .normalizer((value) => {
          calls.push(['normalize', value]);
          return String(value);
        })
        .transformer((value) => {
          calls.push(['transform', value]);
          return value.toUpperCase();
        });

      const context = {
        overrides: 123
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, '123');
      // Normalizer should be called before transformer
      assert.strictEqual(calls[0][0], 'normalize');
      assert.strictEqual(calls[1][0], 'transform');
    });

    it('should transform root array schema with incremental=false', async function() {
      // TODO: Transformer is called correctly with complete array, but added properties
      // don't persist through validation - validation recreates array without extra properties
      const schema = new Schema('array')
        .option('allowIncremental', false)
        .transformer((value) => {
          // Add a computed property to the array after all elements present
          value.push(`${value.length}`);
          return value;
        })
        .property('*', new Schema('string'));

      const context = {
        overrides: ['a', 'b', 'c']
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config.length, 4);
      assert.deepStrictEqual(config, ['a', 'b', 'c', '3']);
    });

  });

  describe('Add-on property interaction', function() {

    it('should add help/config/dump to object schemas when enabled', async function() {
      const schema = new Schema('object')
        .property('myProp', new Schema('string'));

      const configurator = new Configurator({
        schema,
        helpEnabled: true,
        configEnabled: true,
        dumpEnabled: true,
        setPropertyValueEnabled: true
      });

      // Schema should have these properties added
      assert.ok(configurator.schema._properties.help);
      assert.ok(configurator.schema._properties.config);
      assert.ok(configurator.schema._properties.dump);
      assert.ok(configurator.schema._properties.setPropertyValue);
    });

    it('should work with explicit disable flags for primitives', async function() {
      const schema = new Schema('number');

      const context = {
        overrides: 42
      };

      const config = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(context);

      assert.strictEqual(config, 42);
    });

  });

  describe('Complex edge cases', function() {

    it('should handle union of primitive types at root', async function() {
      const schema = new Schema('any')
        .unionDiscriminator((value) => {
          if (typeof value === 'string') return 'string-type';
          if (typeof value === 'number') return 'number-type';
          return 'boolean-type';
        })
        .unionSchema('string-type', new Schema('string'))
        .unionSchema('number-type', new Schema('number'))
        .unionSchema('boolean-type', new Schema('boolean'));

      const contextString = { overrides: 'hello' };
      const configString = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(contextString);
      assert.strictEqual(configString, 'hello');

      const contextNumber = { overrides: 42 };
      const configNumber = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(contextNumber);
      assert.strictEqual(configNumber, 42);
    });

    it('should validate primitive root schema', async function() {
      const schema = new Schema('number')
        .validator((value) => {
          if (value < 0 || value > 100) {
            throw new Error('Value must be between 0 and 100');
          }
          return value;
        });

      const contextValid = { overrides: 50 };
      const configValid = await new Configurator({
        schema,
        sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
        configEnabled: false,
        dumpEnabled: false,
        helpEnabled: false,
        setPropertyValueEnabled: false
      }).configure(contextValid);
      assert.strictEqual(configValid, 50);

      const contextInvalid = { overrides: 150 };
      await assert.rejects(
        async () => await new Configurator({
          schema,
          sources: [new ObjectSource({ contextName: 'overrides', sequence: 1000 })],
          configEnabled: false,
          dumpEnabled: false,
          helpEnabled: false,
          setPropertyValueEnabled: false
        }).configure(contextInvalid),
        (err) => {
          let current = err;
          while (current) {
            if (current.message && current.message.includes('Value must be between 0 and 100')) {
              return true;
            }
            current = current.cause;
          }
          return false;
        }
      );
    });

  });

});
