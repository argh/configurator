
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/errors.js';

describe('Assignments - Unions', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Union discriminator - explicit function', function() {

    it('should resolve union based on discriminator function', async function() {
      const schema = new Schema('object')
        .property('shape', new Schema('object')
          .property('type', new Schema('string'))
          .unionDiscriminator((value, _, unionSchema) => {
            if (value.type === 'circle') return unionSchema.unionSchemas.circle;
            if (value.type === 'rectangle') return unionSchema.unionSchemas.rectangle;
            return undefined;
          })
          .unionSchema('circle', new Schema('object')
            .property('type', Schema.literal('circle'))
            .property('radius', new Schema('number'))
          )
          .unionSchema('rectangle', new Schema('object')
            .property('type', Schema.literal('rectangle'))
            .property('width', new Schema('number'))
            .property('height', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['shape.type', 'circle'],
        ['shape.radius', '10']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        shape: {
          type: 'circle',
          radius: 10
        }
      });
    });

    it('should resolve different union member based on discriminator value', async function() {
      const schema = new Schema('object')
        .property('shape', new Schema('object')
          .property('type', new Schema('string'))
          .unionDiscriminator((value, _, unionSchema) => {
            if (value.type === 'circle') return unionSchema.unionSchemas.circle;
            if (value.type === 'rectangle') return unionSchema.unionSchemas.rectangle;
            return undefined;
          })
          .unionSchema('circle', new Schema('object')
            .property('type', Schema.literal('circle'))
            .property('radius', new Schema('number'))
          )
          .unionSchema('rectangle', new Schema('object')
            .property('type', Schema.literal('rectangle'))
            .property('width', new Schema('number'))
            .property('height', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['shape.type', 'rectangle'],
        ['shape.width', '20'],
        ['shape.height', '30']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        shape: {
          type: 'rectangle',
          width: 20,
          height: 30
        }
      });
    });
  });

  describe('Union discriminator - property name shorthand', function() {

    it('should resolve union using property name as discriminator', async function() {
      const schema = new Schema('object')
        .property('animal', new Schema('object')
          .property('type', new Schema('string'))
          .unionDiscriminator('type')
          .unionSchema('cat', new Schema('object')
            .property('type', Schema.literal('cat'))
            .property('meow', new Schema('boolean'))
          )
          .unionSchema('dog', new Schema('object')
            .property('type', Schema.literal('dog'))
            .property('bark', new Schema('boolean'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['animal.type', 'cat'],
        ['animal.meow', 'true']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        animal: {
          type: 'cat',
          meow: true
        }
      });
    });
  });

  describe('Union auto-discovery - hoisted common property', function() {

    it('should auto-discover discriminator from common property', async function() {
      const schema = new Schema('object')
        .property('vehicle', new Schema('object')
          .unionSchema('car', new Schema('object')
            .property('type', Schema.literal('car'))
            .property('doors', new Schema('number'))
          )
          .unionSchema('bike', new Schema('object')
            .property('type', Schema.literal('bike'))
            .property('gears', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['vehicle.type', 'car'],
        ['vehicle.doors', '4']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        vehicle: {
          type: 'car',
          doors: 4
        }
      });
    });

    it('should handle multiple common properties for auto-discovery', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .unionSchema('option1', new Schema('object')
            .property('mode', Schema.literal('dev'))
            .property('level', Schema.literal(1))
            .property('debug', new Schema('boolean'))
          )
          .unionSchema('option2', new Schema('object')
            .property('mode', Schema.literal('dev'))
            .property('level', Schema.literal(2))
            .property('trace', new Schema('boolean'))
          )
          .unionSchema('option3', new Schema('object')
            .property('mode', Schema.literal('prod'))
            .property('level', Schema.literal(1))
            .property('optimize', new Schema('boolean'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['config.mode', 'dev'],
        ['config.level', '2'],
        ['config.trace', 'true']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        config: {
          mode: 'dev',
          level: 2,
          trace: true
        }
      });
    });
  });

  describe('Union resolution scenarios', function() {

    it('should resolve union with single matching member', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .unionSchema('typeA', new Schema('object')
            .property('kind', Schema.literal('A'))
            .property('valueA', new Schema('string'))
          )
          .unionSchema('typeB', new Schema('object')
            .property('kind', Schema.literal('B'))
            .property('valueB', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['data.kind', 'A'],
        ['data.valueA', 'test']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        data: {
          kind: 'A',
          valueA: 'test'
        }
      });
    });

    it('should reject assignments to non-selected union member', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .unionSchema('typeA', new Schema('object')
            .property('kind', Schema.literal('A'))
            .property('valueA', new Schema('string'))
          )
          .unionSchema('typeB', new Schema('object')
            .property('kind', Schema.literal('B'))
            .property('valueB', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['data.kind', 'A'],
        ['data.valueA', 'test'],
        ['data.valueB', '42']  // Wrong member
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof Error);
          return err.name === 'SchemaError';
        }
      );
    });

    it('should fail to compile ambiguous union definition (identical schemas)', function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .unionSchema('option1', new Schema('object')
            .property('enabled', Schema.literal(true))
            .property('value', new Schema('string'))
          )
          .unionSchema('option2', new Schema('object')
            .property('enabled', Schema.literal(true))
            .property('value', new Schema('string'))
          )
        );

      assert.throws(
        () => resolver.compile(schema),
        /ambiguous|cannot.*discriminate|indistinguishable/i
      );
    });

    it('should handle conflicting union resolution (no matches)', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .unionSchema('typeA', new Schema('object')
            .property('kind', Schema.literal('A'))
            .property('valueA', new Schema('string'))
          )
          .unionSchema('typeB', new Schema('object')
            .property('kind', Schema.literal('B'))
            .property('valueB', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['data.kind', 'C']  // No matching union member
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        }
      );
    });

    it('should throw error when union cannot be uniquely resolved', async function() {
      // Create a union where we assign a property but don't provide discriminator
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .unionSchema('database', new Schema('object')
            .property('type', Schema.literal('database'))
            .property('host', new Schema('string'))
            .property('port', new Schema('number'))
          )
          .unionSchema('cache', new Schema('object')
            .property('type', Schema.literal('cache'))
            .property('host', new Schema('string'))
            .property('ttl', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

     // Assign a property that exists in both union members but don't specify which type
      const assignments = new Map([
        ['config.host', 'localhost']  // Ambiguous - both database and cache have 'host'
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof SchemaError);
          assert.match(err.message, /config\.host/);
          assert.match(err.cause.message, /union resolution ambiguity/i);
          assert.match(err.cause.message, /database\|cache/);
          return true;
        }
      );
    });

    it('should throw error when union property assignment fails without discriminator', async function() {
      // Test with a union-specific property that doesn't exist in all members
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .unionSchema('http', new Schema('object')
            .property('protocol', Schema.literal('http'))
            .property('port', new Schema('number'))
          )
          .unionSchema('https', new Schema('object')
            .property('protocol', Schema.literal('https'))
            .property('port', new Schema('number'))
            .property('cert', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      // Try to assign https-specific property without specifying protocol
      const assignments = new Map([
        ['server.cert', '/path/to/cert.pem']  // Only in https, but no discriminator
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof SchemaError);
          assert.match(err.message, /server\.cert/);
          assert.match(err.cause.message, /union resolution ambiguity/i);
          assert.match(err.cause.message, /http\|https/);
          return true;
        }
      );
    });
  });

  describe('Union with normalization', function() {

    it('should normalize discriminator values for matching', async function() {
      const normalizer = (v) => v.toLowerCase();

      const schema = new Schema('object')
        .property('item', new Schema('object')
          .unionSchema('apple', new Schema('object')
            .property('name', Schema.literal('apple').normalizer(normalizer))
            .property('color', new Schema('string'))
          )
          .unionSchema('banana', new Schema('object')
            .property('name', Schema.literal('banana').normalizer(normalizer))
            .property('length', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['item.name', 'APPLE'],  // Will be normalized to 'apple'
        ['item.color', 'red']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.item.name, 'apple');
      assert.strictEqual(result.item.color, 'red');
    });
  });

  describe('Union with transformers', function() {

    it('should apply union member transformer after resolution', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('object')
          .lax()
          .unionSchema('stringType', new Schema('object')
            .lax()
            .property('type', Schema.literal('string-type'))
            .property('data', new Schema('string'))
            .property('transformed', new Schema('boolean').default(true))
          )
          .unionSchema('numberType', new Schema('object')
            .lax()
            .property('type', Schema.literal('number-type'))
            .property('data', new Schema('number'))
            .property('doubled', new Schema('number')
              .transformer((value, config, schema, path) => {
                // Get the data value from the parent object
                const parentPath = path.substring(0, path.lastIndexOf('.'));
                const dataPath = `${parentPath}.data`;
                const dataValue = config.value?.data;
                return dataValue * 2;
              })
            )
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['value.type', 'number-type'],
        ['value.data', '21'],
        ['value.doubled', ''] // Trigger the transformer
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.value.type, 'number-type');
      assert.strictEqual(result.value.data, 21);
      assert.strictEqual(result.value.doubled, 42);
    });
  });

  describe('Union with required properties', function() {

    it('should enforce required properties of resolved union member', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .unionSchema('database', new Schema('object')
            .property('type', Schema.literal('database'))
            .property('connection', new Schema('string', {
              required: true
            }))
          )
          .unionSchema('cache', new Schema('object')
            .property('type', Schema.literal('cache'))
            .property('ttl', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['config.type', 'database']
        // Missing required 'connection'
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        /required/i
      );
    });

    it('should not enforce required of non-resolved union member', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .unionSchema('database', new Schema('object')
            .property('type', Schema.literal('database'))
            .property('connection', new Schema('string', {
              required: true
            }))
          )
          .unionSchema('cache', new Schema('object')
            .property('type', Schema.literal('cache'))
            .property('ttl', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['config.type', 'cache'],
        ['config.ttl', '3600']
        // database.connection is required but database not selected
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        config: {
          type: 'cache',
          ttl: 3600
        }
      });
    });
  });

  describe('Union with defaults', function() {

    it('should apply defaults of resolved union member', async function() {
      // TODO: Defaults handled by SchemaDefaultsSource with union keys
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .unionSchema('http', new Schema('object')
            .property('protocol', Schema.literal('http'))
            .property('port', new Schema('number', {
              default: 80
            }))
          )
          .unionSchema('https', new Schema('object')
            .property('protocol', Schema.literal('https'))
            .property('port', new Schema('number', {
              default: 443
            }))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['server.protocol', 'https']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        server: {
          protocol: 'https',
          port: 443
        }
      });
    });
  });

  describe('Union key assignments (colon-separated paths)', function() {

    it('should handle union key assignments for defaults', async function() {
      // Testing that processAssignments can handle them
      const schema = new Schema('object')
        .property('pet', new Schema('object')
          .unionSchema('cat', new Schema('object')
            .property('type', Schema.literal('cat'))
            .property('name', new Schema('string'))
          )
          .unionSchema('dog', new Schema('object')
            .property('type', Schema.literal('dog'))
            .property('name', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      // Simulate SchemaDefaultsSource synthesized assignment with union key
      const assignments = new Map([
        ['pet.type', 'cat'],
        ['pet:cat.name', 'Whiskers']  // Union key syntax
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        pet: {
          type: 'cat',
          name: 'Whiskers'
        }
      });
    });
  });

  describe('Nested unions', function() {

    it('should handle unions within unions', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .unionSchema('wrapper', new Schema('object')
            .property('outer', Schema.literal('wrapper'))
            .property('inner', new Schema('object')
              .unionSchema('option1', new Schema('object')
                .property('type', Schema.literal('A'))
                .property('value', new Schema('string'))
              )
              .unionSchema('option2', new Schema('object')
                .property('type', Schema.literal('B'))
                .property('count', new Schema('number'))
              )
            )
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['data.outer', 'wrapper'],
        ['data.inner.type', 'A'],
        ['data.inner.value', 'test']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        data: {
          outer: 'wrapper',
          inner: {
            type: 'A',
            value: 'test'
          }
        }
      });
    });

    it('should handle union with non-discriminator property that is also a union', async function() {
      // Test a union where one of the properties (not the discriminator) is itself a union
      const schema = new Schema('object')
        .property('connection', new Schema('object')
          .unionSchema('database', new Schema('object')
            .property('type', Schema.literal('database'))
            .property('config', new Schema('object')
              .unionSchema('postgres', new Schema('object')
                .property('driver', Schema.literal('postgres'))
                .property('port', new Schema('number'))
              )
              .unionSchema('mysql', new Schema('object')
                .property('driver', Schema.literal('mysql'))
                .property('socket', new Schema('string'))
              )
            )
          )
          .unionSchema('cache', new Schema('object')
            .property('type', Schema.literal('cache'))
            .property('config', new Schema('object')
              .unionSchema('redis', new Schema('object')
                .property('driver', Schema.literal('redis'))
                .property('db', new Schema('number'))
              )
              .unionSchema('memcached', new Schema('object')
                .property('driver', Schema.literal('memcached'))
                .property('prefix', new Schema('string'))
              )
            )
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['connection.type', 'database'],
        ['connection.config.driver', 'postgres'],
        ['connection.config.port', '5432']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        connection: {
          type: 'database',
          config: {
            driver: 'postgres',
            port: 5432
          }
        }
      });
    });
  });

  describe('Union partial resolution', function() {

    it('should handle partial assignments waiting for union resolution', async function() {
      // TODO: Test multi-pass resolution where union can't be resolved initially
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .unionSchema('typeA', new Schema('object')
            .property('kind', Schema.literal('A'))
            .property('host', new Schema('string'))
            .property('port', new Schema('number'))
          )
          .unionSchema('typeB', new Schema('object')
            .property('kind', Schema.literal('B'))
            .property('url', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      // Assignments might arrive in any order - implementation should handle this
      const assignments = new Map([
        ['config.host', 'localhost'],  // Arrives before discriminator
        ['config.port', '8080'],
        ['config.kind', 'A']  // Discriminator arrives last
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        config: {
          kind: 'A',
          host: 'localhost',
          port: 8080
        }
      });
    });
  });
});
