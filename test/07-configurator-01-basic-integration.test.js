
import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema } from '../src/schema/schema.js';
import { ObjectSource, EnvironmentSource, CommandLineSource } from '../src/configuration-sources/index.js';

describe('Configurator - Basic Integration', function() {

  describe('Single source configuration', function() {

    it('should configure from defaults only', async function() {
      const schema = new Schema('object')
        .deep()
        .property('name', new Schema('string', { default: 'myapp' }))
        .property('port', new Schema('number', { default: 3000 }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'test',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.name, 'myapp');
      assert.strictEqual(config.port, 3000);
    });

    it('should configure from environment only', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_HOST': 'localhost',
          'APP_PORT': '8080'
        }
      });

      assert.strictEqual(config.host, 'localhost');
      assert.strictEqual(config.port, 8080);
    });

    it('should configure from command line only', async function() {
      const schema = new Schema('object')
        .property('debug', new Schema('boolean'))
        .property('verbose', new Schema('boolean'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--debug', '--verbose'],
        env: {}
      });

      assert.strictEqual(config.debug, true);
      assert.strictEqual(config.verbose, true);
    });
  });

  describe('Multiple source priority', function() {

    it('should prioritize command line over environment', async function() {
      const schema = new Schema('object')
        .property('port', new Schema('number'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--port', '9000'],
        env: {
          'APP_PORT': '8080'
        }
      });

      // CLI (600) should override env (400)
      assert.strictEqual(config.port, 9000);
    });

    it('should prioritize environment over defaults', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string', { default: 'localhost' }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_HOST': 'production.example.com'
        }
      });

      // Env (400) should override defaults (100)
      assert.strictEqual(config.host, 'production.example.com');
    });

    it('should prioritize command line over environment over defaults', async function() {
      const schema = new Schema('object')
        .property('timeout', new Schema('number', { default: 1000 }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--timeout', '5000'],
        env: {
          'APP_TIMEOUT': '3000'
        }
      });

      // CLI (600) > env (400) > defaults (100)
      assert.strictEqual(config.timeout, 5000);
    });

    it('should use defaults when no higher priority source provides value', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', { default: 'default-name' }))
        .property('port', new Schema('number', { default: 3000 }))
        .property('host', new Schema('string', { default: 'localhost' }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--port', '8080'],
        env: {
          'APP_HOST': 'example.com'
        }
      });

      assert.strictEqual(config.name, 'default-name');  // From defaults
      assert.strictEqual(config.host, 'example.com');   // From env
      assert.strictEqual(config.port, 8080);            // From CLI
    });
  });

  describe('Source sequence order', function() {

    it('should respect custom source sequences', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      // Create sources with explicit sequences
      const sources = [
        new ObjectSource({ contextName: 'data', sequence: 300 }),      // 300
        new EnvironmentSource({ sequence: 400 }),                      // 400
        new CommandLineSource({ sequence: 600 }),                      // 600
        new ObjectSource({ contextName: 'overrides', sequence: 1000 }) // 1000
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        data: { value: 'from-data' },
        env: { 'APP_VALUE': 'from-env' },
        argv: ['--value', 'from-cli'],
        overrides: { value: 'from-overrides' }
      });

      // Overrides (1000) should win
      assert.strictEqual(config.value, 'from-overrides');
    });

    it('should handle sources in correct sequence order', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('string'))
        .property('c', new Schema('string'))
        .property('d', new Schema('string'));

      const sources = [
        new ObjectSource({ contextName: 'low', sequence: 200 }),
        new ObjectSource({ contextName: 'medium', sequence: 500 }),
        new ObjectSource({ contextName: 'high', sequence: 800 })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        low: { a: 'low-a', b: 'low-b', c: 'low-c', d: 'low-d' },
        medium: { b: 'medium-b', c: 'medium-c', d: 'medium-d' },
        high: { c: 'high-c', d: 'high-d' },
        argv: [],
        env: {}
      });

      assert.strictEqual(config.a, 'low-a');       // Only in low
      assert.strictEqual(config.b, 'medium-b');    // medium overrides low
      assert.strictEqual(config.c, 'high-c');      // high overrides medium and low
      assert.strictEqual(config.d, 'high-d');      // high overrides medium and low
    });
  });

  describe('Nested properties', function() {

    it('should configure nested objects from multiple sources', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string', { default: 'localhost' }))
          .property('port', new Schema('number', { default: 5432 }))
          .property('name', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--database-name', 'production'],
        env: {
          'APP_DATABASE_PORT': '3306'
        }
      });

      assert.strictEqual(config.database.host, 'localhost');  // Default
      assert.strictEqual(config.database.port, 3306);         // Env
      assert.strictEqual(config.database.name, 'production'); // CLI
    });

    it('should handle deeply nested properties', async function() {
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('ssl', new Schema('object')
            .property('enabled', new Schema('boolean', { default: false }))
            .property('cert', new Schema('string'))
            .property('key', new Schema('string'))
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--server-ssl-enabled', '--server-ssl-cert', '/path/to/cert.pem'],
        env: {
          'APP_SERVER_SSL_KEY': '/path/to/key.pem'
        }
      });

      assert.strictEqual(config.server.ssl.enabled, true);
      assert.strictEqual(config.server.ssl.cert, '/path/to/cert.pem');
      assert.strictEqual(config.server.ssl.key, '/path/to/key.pem');
    });
  });

  describe('Arrays', function() {

    it('should configure arrays from multiple sources', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--tags', 'api', 'web', 'v2'],
        env: {}
      });

      assert.deepStrictEqual(config.tags, ['api', 'web', 'v2']);
    });

    it('should configure array of objects', async function() {
      const schema = new Schema('object')
        .property('servers', new Schema('array')
          .property('*', new Schema('object')
            .property('host', new Schema('string'))
            .property('port', new Schema('number'))
          )
        );

      const sources = [
        new ObjectSource({ contextName: 'data', sequence: 300 })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        data: {
          servers: [
            { host: 'server1.com', port: 80 },
            { host: 'server2.com', port: 443 }
          ]
        },
        argv: [],
        env: {}
      });

      assert.strictEqual(config.servers.length, 2);
      assert.strictEqual(config.servers[0].host, 'server1.com');
      assert.strictEqual(config.servers[0].port, 80);
      assert.strictEqual(config.servers[1].host, 'server2.com');
      assert.strictEqual(config.servers[1].port, 443);
    });

    it('should allow higher priority source to override array elements', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string'))
        );

      const sources = [
        new ObjectSource({ contextName: 'data', sequence: 300 }),
        new EnvironmentSource({ sequence: 400 })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        data: { items: ['a', 'b', 'c'] },
        env: {
          'APP_ITEMS_1': 'B'  // Override second element
        },
        argv: []
      });

      assert.deepStrictEqual(config.items, ['a', 'B', 'c']);
    });

    it('should prioritize aggregate assignment over individual assignments', async function() {
      // Higher-priority aggregate assignment (e.g., --foo=a,b) should take precedence
      // over lower-priority individual assignments (e.g., {foo: ["x", "y", "z", "w"]})
      // The shorter aggregate should win, preventing "leakage" of extra elements
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const sources = [
        new ObjectSource({ contextName: 'defaults', sequence: 100 }),
        new CommandLineSource({ sequence: 600 })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        defaults: { tags: ['x', 'y', 'z', 'w'] },  // 4 elements
        argv: ['--tags=a,b'],  // Only 2 elements
        env: {}
      });

      // CLI aggregate (600) should completely override defaults (100)
      // Result should be 2 elements, not 4 (no leakage from defaults)
      assert.deepStrictEqual(config.tags, ['a', 'b']);
    });
  });

  describe('Type coercion', function() {

    it('should coerce string values to numbers', async function() {
      const schema = new Schema('object')
        .property('port', new Schema('number'))
        .property('timeout', new Schema('number'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--port', '8080'],
        env: {
          'APP_TIMEOUT': '5000'
        }
      });

      assert.strictEqual(typeof config.port, 'number');
      assert.strictEqual(config.port, 8080);
      assert.strictEqual(typeof config.timeout, 'number');
      assert.strictEqual(config.timeout, 5000);
    });

    it('should coerce string values to booleans', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('disabled', new Schema('boolean'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_ENABLED': 'true',
          'APP_DISABLED': 'false'
        }
      });

      assert.strictEqual(typeof config.enabled, 'boolean');
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(typeof config.disabled, 'boolean');
      assert.strictEqual(config.disabled, false);
    });
  });

  describe('Mixed scenarios', function() {

    it('should handle complex configuration from multiple sources', async function() {
      const schema = new Schema('object')
        .property('myapp', new Schema('object')  // Matches appName for prefix trimming
          .property('name', new Schema('string', { default: 'myapp' }))
          .property('version', new Schema('string', { default: '1.0.0' }))
          .property('debug', new Schema('boolean', { default: false }))
        )
        .property('server', new Schema('object')
          .property('host', new Schema('string', { default: 'localhost' }))
          .property('port', new Schema('number', { default: 3000 }))
        )
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
          .property('name', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'myapp',
        argv: ['--debug', '--server-port', '8080'],  // --debug works without prefix
        env: {
          'MYAPP_DATABASE_HOST': 'db.example.com',
          'MYAPP_DATABASE_PORT': '5432',
          'MYAPP_DATABASE_NAME': 'production'
        }
      });

      // From defaults
      assert.strictEqual(config.myapp.name, 'myapp');
      assert.strictEqual(config.myapp.version, '1.0.0');
      assert.strictEqual(config.server.host, 'localhost');

      // From CLI
      assert.strictEqual(config.myapp.debug, true);
      assert.strictEqual(config.server.port, 8080);

      // From env
      assert.strictEqual(config.database.host, 'db.example.com');
      assert.strictEqual(config.database.port, 5432);
      assert.strictEqual(config.database.name, 'production');
    });

    it('should handle all default sources working together', async function() {
      const schema = new Schema('object')
        .property('setting1', new Schema('string', { default: 'default1' }))
        .property('setting2', new Schema('string'))
        .property('setting3', new Schema('string'))
        .property('setting4', new Schema('string'))
        .property('setting5', new Schema('string'));

      const sources = [
        new ObjectSource({ contextName: 'defaults', sequence: 300 }),       // 300
        new EnvironmentSource({ sequence: 400 }),                           // 400
        new CommandLineSource({ sequence: 600 }),                           // 600
        new ObjectSource({ contextName: 'overrides', sequence: 1000 })      // 1000
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        defaults: { setting2: 'from-defaults-source' },
        env: { 'APP_SETTING3': 'from-env' },
        argv: ['--setting4', 'from-cli'],
        overrides: { setting5: 'from-overrides' }
      });

      assert.strictEqual(config.setting1, 'default1');               // Schema default (100)
      assert.strictEqual(config.setting2, 'from-defaults-source');   // Defaults source (300)
      assert.strictEqual(config.setting3, 'from-env');               // Env (400)
      assert.strictEqual(config.setting4, 'from-cli');               // CLI (600)
      assert.strictEqual(config.setting5, 'from-overrides');         // Overrides (1000)
    });
  });

  describe('Edge cases', function() {

    it('should handle empty configuration', async function() {
      const schema = new Schema('object')
        .property('optional', new Schema('string'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      }) ?? {};

      assert.ok(config);
      assert.strictEqual(config.optional, undefined);
    });

    it('should handle configuration with no defaults', async function() {
      const schema = new Schema('object')
        .property('required', new Schema('string'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--required', 'value'],
        env: {}
      });

      assert.strictEqual(config.required, 'value');
    });
  });
});
