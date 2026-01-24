
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';

describe('Schema Compilation - Hierarchy', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Nested object properties', function() {

    it('should compile two-level nested objects', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string')));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties.user instanceof CompiledSchema);
      assert.ok(compiled.properties.user.properties.name instanceof CompiledSchema);
    });

    it('should compile three-level nested objects', async function() {
      const schema = new Schema('object')
        .property('company', new Schema('object')
          .property('department', new Schema('object')
            .property('manager', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const manager = compiled.properties.company.properties.department.properties.manager;
      assert.ok(manager instanceof CompiledSchema);
    });

    it('should compile deeply nested hierarchy', async function() {
      const schema = new Schema('object')
        .property('level1', new Schema('object')
          .property('level2', new Schema('object')
            .property('level3', new Schema('object')
              .property('level4', new Schema('object')
                .property('level5', new Schema('string'))))));

      const compiled = await resolver.compile(schema);

      const deep = compiled.properties.level1
        .properties.level2
        .properties.level3
        .properties.level4
        .properties.level5;

      assert.ok(deep instanceof CompiledSchema);
      assert.strictEqual(typeof deep.options.type, 'string');
    });
  });
// FIXME
  describe.skip('Path construction in hierarchy', function() {

    it('should build correct paths through hierarchy', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('profile', new Schema('object')
            .property('name', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.path, '');
      assert.strictEqual(compiled.properties.user.path, 'user');
      assert.strictEqual(compiled.properties.user.properties.profile.path, 'user.profile');
      assert.strictEqual(compiled.properties.user.properties.profile.properties.name.path, 'user.profile.name');
    });

    it('should build paths with array indices', async function() {
      const schema = new Schema('object')
        .property('users', new Schema('array')
          .property('0', new Schema('object')
            .property('name', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.users.path, 'users');
      assert.strictEqual(compiled.properties.users.properties['0'].path, 'users.0');
      assert.strictEqual(compiled.properties.users.properties['0'].properties.name.path, 'users.0.name');
    });
  });
// FIXME
  describe.skip('Parent chain traversal', function() {

    it('should maintain parent chain through nested objects', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const c = compiled.properties.a.properties.b.properties.c;

      assert.strictEqual(c.parent, compiled.properties.a.properties.b);
      assert.strictEqual(c.parent.parent, compiled.properties.a);
      assert.strictEqual(c.parent.parent.parent, compiled);
      assert.strictEqual(c.parent.parent.parent.parent, undefined);
    });

    it('should track names through parent chain', async function() {
      const schema = new Schema('object')
        .property('outer', new Schema('object')
          .property('middle', new Schema('object')
            .property('inner', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const inner = compiled.properties.outer.properties.middle.properties.inner;

      assert.strictEqual(inner.name, 'inner');
      assert.strictEqual(inner.parent.name, 'middle');
      assert.strictEqual(inner.parent.parent.name, 'outer');
      assert.strictEqual(inner.parent.parent.parent.name, undefined);
    });
  });

  describe('Arrays with element schemas', function() {

    it('should compile array with nested object elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('id', new Schema('number'))
          .property('name', new Schema('string')));

      const compiled = await resolver.compile(schema);

      const elementSchema = compiled.properties['*'];
      assert.ok(elementSchema.properties.id);
      assert.ok(elementSchema.properties.name);
    });

    it('should compile array with nested array elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('array')
          .property('*', new Schema('number')));

      const compiled = await resolver.compile(schema);

      const innerArray = compiled.properties['*'];
      const innerElement = innerArray.properties['*'];

      assert.ok(innerArray instanceof CompiledSchema);
      assert.ok(innerElement instanceof CompiledSchema);
    });

    it('should compile tuple with different nested structures', async function() {
      const schema = new Schema('array')
        .property('0', new Schema('object')
          .property('name', new Schema('string')))
        .property('1', new Schema('array')
          .property('*', new Schema('number')));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties['0'].properties.name);
      assert.ok(compiled.properties['1'].properties['*']);
    });
  });

  describe('Mixed object and array hierarchies', function() {

    it('should compile object containing array containing object', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('value', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const valueSchema = compiled.properties.items.properties['*'].properties.value;
      assert.ok(valueSchema instanceof CompiledSchema);
      //FIXME
      //assert.strictEqual(valueSchema.path, 'items.*.value');
    });

    it('should compile array containing object containing array', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('tags', new Schema('array')
            .property('*', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const tagSchema = compiled.properties['*'].properties.tags.properties['*'];
      assert.ok(tagSchema instanceof CompiledSchema);
    });

    it('should compile complex nested structure', async function() {
      const schema = new Schema('object')
        .property('users', new Schema('array')
          .property('*', new Schema('object')
            .property('name', new Schema('string'))
            .property('roles', new Schema('array')
              .property('*', new Schema('string')))
            .property('metadata', new Schema('object')
              .property('created', new Schema('date'))
              .property('tags', new Schema('array')
                .property('*', new Schema('string'))))));

      const compiled = await resolver.compile(schema);

      // Verify various parts of the structure
      assert.ok(compiled.properties.users);
      assert.ok(compiled.properties.users.properties['*'].properties.name);
      assert.ok(compiled.properties.users.properties['*'].properties.roles.properties['*']);
      assert.ok(compiled.properties.users.properties['*'].properties.metadata.properties.created);
      assert.ok(compiled.properties.users.properties['*'].properties.metadata.properties.tags.properties['*']);
    });
  });

  describe('Property resolution through hierarchy', function() {

    it('should resolve properties at each level', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('server', new Schema('object')
            .property('host', new Schema('string').default('localhost'))
            .property('port', new Schema('number').default(8080))));

      const compiled = await resolver.compile(schema);

      const host = compiled.properties.config.properties.server.properties.host;
      const port = compiled.properties.config.properties.server.properties.port;

      assert.strictEqual(host.default, 'localhost');
      assert.strictEqual(port.default, 8080);
    });

    it('should independently compile schemas at each level', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .property('value', new Schema('number').required(true))
          .property('nested', new Schema('object')
            .property('inner', new Schema('string').required(false))));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.data.properties.value.required, true);
      assert.strictEqual(compiled.properties.data.properties.nested.properties.inner.required, false);
    });
  });

  describe('Wildcard hierarchies', function() {

    it('should handle wildcards at multiple levels', async function() {
      const schema = new Schema('object')
        .property('*', new Schema('object')
          .property('*', new Schema('string')));

      const compiled = await resolver.compile(schema);

      const level1 = compiled.getPropertySchema('anyKey');
      const level2 = level1.getPropertySchema('anyNestedKey');

      assert.ok(level2 instanceof CompiledSchema);
    });

    it('should mix named and wildcard at different levels', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('*', new Schema('string')))
        .property('*', new Schema('number'));

      const compiled = await resolver.compile(schema);

      // config.* should be string
      const configValue = compiled.properties.config.getPropertySchema('anything');
      assert.strictEqual(typeof configValue._normalizeValue, 'function');

      // other.* should be number
      const otherValue = compiled.getPropertySchema('other');
      assert.ok(otherValue);
    });
  });

  describe('find() method for path resolution', function() {

    it('should find schema at simple path', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const found = compiled.find('name');
      assert.strictEqual(found, compiled.properties.name);
    });

    it('should find schema at nested path', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('profile', new Schema('object')
            .property('email', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const found = compiled.find('user.profile.email');
      assert.strictEqual(found, compiled.properties.user.properties.profile.properties.email);
    });

    it('should return self for empty path', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const found = compiled.find('');
      assert.strictEqual(found, compiled);
    });

    it('should return self for dot path', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const found = compiled.find('.');
      assert.strictEqual(found, compiled);
    });

    it('should return undefined for non-existent path', async function() {
      const schema = new Schema('object')
        .property('exists', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const found = compiled.find('doesNotExist');
      assert.strictEqual(found, undefined);
    });

    it('should find through array indices', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('0', new Schema('string')));

      const compiled = await resolver.compile(schema);

      const found = compiled.find('items.0');
      assert.strictEqual(found, compiled.properties.items.properties['0']);
    });
  });

  describe('Compilation with deep type variety', function() {

    it('should compile hierarchy with all base types', async function() {
      const schema = new Schema('object')
        .property('text', new Schema('string'))
        .property('count', new Schema('number'))
        .property('flag', new Schema('boolean'))
        .property('created', new Schema('date'))
        .property('data', new Schema('buffer'))
        .property('nested', new Schema('object')
          .property('items', new Schema('array')
            .property('*', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties.text);
      assert.ok(compiled.properties.count);
      assert.ok(compiled.properties.flag);
      assert.ok(compiled.properties.created);
      assert.ok(compiled.properties.data);
      assert.ok(compiled.properties.nested.properties.items.properties['*']);
    });

    it('should properly inherit base type behaviors at all levels', async function() {
      const schema = new Schema('object')
        .property('level1', new Schema('object')
          .property('stringVal', new Schema('string'))
          .property('level2', new Schema('object')
            .property('numberVal', new Schema('number'))
            .property('level3', new Schema('object')
              .property('boolVal', new Schema('boolean')))));

      const compiled = await resolver.compile(schema);

      const stringVal = compiled.properties.level1.properties.stringVal;
      const numberVal = compiled.properties.level1.properties.level2.properties.numberVal;
      const boolVal = compiled.properties.level1.properties.level2.properties.level3.properties.boolVal;

      // Each should have its base type's normalizer
      assert.strictEqual(await stringVal._normalizeValue(123), '123');
      assert.strictEqual(await numberVal._normalizeValue('456'), 456);
      assert.strictEqual(await boolVal._normalizeValue('yes'), true);
    });
  });

  describe('Hierarchy immutability', function() {

    it('should freeze all levels of hierarchy', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled));
      assert.ok(Object.isFrozen(compiled.properties.a));
      assert.ok(Object.isFrozen(compiled.properties.a.properties.b));
      assert.ok(Object.isFrozen(compiled.properties.a.properties.b.properties.c));
    });

    it('should freeze properties at all levels', async function() {
      const schema = new Schema('object')
        .property('outer', new Schema('object')
          .property('inner', new Schema('string')));

      const compiled = await resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.properties));
      assert.ok(Object.isFrozen(compiled.properties.outer.properties));
    });
  });

  describe('Real-world hierarchy examples', function() {

    it('should compile typical API response schema', async function() {
      const schema = new Schema('object')
        .property('status', new Schema('number'))
        .property('data', new Schema('object')
          .property('users', new Schema('array')
            .property('*', new Schema('object')
              .property('id', new Schema('number'))
              .property('name', new Schema('string'))
              .property('email', new Schema('string'))
              .property('roles', new Schema('array')
                .property('*', new Schema('string'))))))
        .property('meta', new Schema('object')
          .property('page', new Schema('number'))
          .property('total', new Schema('number')));

      const compiled = await resolver.compile(schema);

      // Verify key paths exist
      assert.ok(compiled.find('status'));
      assert.ok(compiled.find('data.users'));
      assert.ok(compiled.find('meta.page'));

      // Verify array element structure
      const userSchema = compiled.properties.data.properties.users.properties['*'];
      assert.ok(userSchema.properties.id);
      assert.ok(userSchema.properties.name);
      assert.ok(userSchema.properties.roles.properties['*']);
    });

    it('should compile configuration file schema', async function() {
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('string').default('localhost'))
          .property('port', new Schema('number').default(3000))
          .property('ssl', new Schema('object')
            .property('enabled', new Schema('boolean').default(false))
            .property('cert', new Schema('string'))
            .property('key', new Schema('string'))))
        .property('database', new Schema('object')
          .property('connection', new Schema('string').required(true))
          .property('pool', new Schema('object')
            .property('min', new Schema('number').default(2))
            .property('max', new Schema('number').default(10))))
        .property('logging', new Schema('object')
          .property('level', new Schema('string').values(['debug', 'info', 'warn', 'error']).default('info'))
          .property('outputs', new Schema('array')
            .property('*', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      // Verify structure and defaults
      assert.strictEqual(compiled.properties.server.properties.host.default, 'localhost');
      assert.strictEqual(compiled.properties.server.properties.port.default, 3000);
      assert.strictEqual(compiled.properties.database.properties.connection.required, true);
      assert.deepStrictEqual(compiled.properties.logging.properties.level.values,
        ['debug', 'info', 'warn', 'error']);
    });
  });
});
