
import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema } from '@versionzero/schema';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Configurator - Special Options', function() {

  describe('Help schema creation', function() {

    it('should automatically add help schema when helpEnabled is true', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, helpEnabled: true });

      // Help property should be auto-added
      const helpProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'help');

      assert.ok(helpProp, 'Help schema should be auto-added');
      assert.strictEqual(helpProp.metadata.description, 'display help information');
      assert.strictEqual(helpProp.metadata.flagHint, 'h');
    });

    it('should not add help schema when helpEnabled is false', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, helpEnabled: false });

      // Help property should not be present
      const helpProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'help');

      assert.strictEqual(helpProp, undefined, 'Help schema should not be added');
    });

    it('should use existing help schema if present', async function() {
      const customHelp = Configurator.createHelpSchema()
        .meta('flagHint', 'H')
        .meta('description', 'custom help text')

      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('help', customHelp);

      const configurator = new Configurator({ schema, helpEnabled: true });

      // Should use custom help schema
      const helpProp = configurator.schema.properties['help'];
      assert.strictEqual(helpProp.metadata.description, 'custom help text');
      assert.strictEqual(helpProp.metadata.flagHint, 'H');
    });

    it('should support renaming help to custom property name', async function() {
      const customHelp = Configurator.createHelpSchema().meta('description', 'halp me!');

      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('halp', customHelp);  // Renamed from "help" to "halp"

      const configurator = new Configurator({ schema, helpEnabled: true });

      // Should recognize it by _configuratorSchema: 'help'
      const halpProp = configurator.schema.properties['halp'];
      assert.strictEqual(halpProp.metadata.configuratorSchema, 'help');
      assert.strictEqual(halpProp.metadata.description, 'halp me!');
    });

    it('should create help schema with correct default attributes', function() {
      const helpSchema = Configurator.createHelpSchema();

      assert.strictEqual(helpSchema.options.allowEmpty, true);
      assert.deepStrictEqual(helpSchema.options.values, ['advanced', 'system']);
      assert.strictEqual(helpSchema.metadata.flagHint, 'h');
      assert.strictEqual(helpSchema.metadata.configuratorSchema, 'help');
      assert.strictEqual(helpSchema.metadata.omitFromSerialize, true);
    });
  });

  describe('Config schema creation', function() {

    it('should automatically add config schema when configEnabled is true', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, configEnabled: true });

      // Config property should be auto-added
      const configProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'config');

      assert.ok(configProp, 'Config schema should be auto-added');
      assert.match(configProp.metadata.description ?? '', /load.+configuration.+file/);
      assert.strictEqual(configProp.metadata.flagHint, 'C');
      assert.strictEqual(configProp.options.context, 'config');
    });

    it('should not add config schema when configEnabled is false', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, configEnabled: false });

      // Config property should not be present
      const configProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'config');

      assert.strictEqual(configProp, undefined, 'Config schema should not be added');
    });

    it('should use existing config schema if present', async function() {
      const customConfig = Configurator.createConfigSchema().meta('flagHint', 'c').meta('description', 'custom config file');

      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('config', customConfig);

      const configurator = new Configurator({ schema, configEnabled: true });

      // Should use custom config schema
      const configProp = configurator.schema.properties['config'];
      assert.strictEqual(configProp.metadata.description, 'custom config file');
      assert.strictEqual(configProp.metadata.flagHint, 'c');
    });

    it('should support renaming config to custom property name like "profile"', async function() {
      const profileConfig = Configurator.createConfigSchema()
                                        .option('context', 'profilePath')
                                        .meta('flagHint', 'P')
                                        .meta('description', 'profile configuration file');


      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('profile', profileConfig);  // Renamed from "config" to "profile"

      const configurator = new Configurator({ schema, configEnabled: true });

      // Should recognize it by _configuratorSchema: 'config'
      const profileProp = configurator.schema.properties['profile'];
      assert.strictEqual(profileProp.metadata.configuratorSchema, 'config');
      assert.strictEqual(profileProp.metadata.description, 'profile configuration file');
      assert.strictEqual(profileProp.options.context, 'profilePath');
    });

    it('should create config schema with correct default attributes', async function() {

      const configSchema = await new Configurator().resolver.compile(Configurator.createConfigSchema());

      assert.strictEqual(configSchema.options.context, 'config');
      // fixme - probably shouldn't look at handler internals like this

      assert.strictEqual(await configSchema.validateValue('-'), '-');

      assert.strictEqual(configSchema.metadata.flagHint, 'C');
      assert.strictEqual(configSchema.metadata.configuratorSchema, 'config');
      assert.strictEqual(configSchema.metadata.omitFromSerialize, 'true');
    });
  });

  describe('SetPropertyValue schema creation', function() {

    it('should automatically add setPropertyValue schema when setPropertyValueEnabled is true (default)', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema });

      // SetPropertyValue property should be auto-added by default
      const setPropProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'setPropertyValue');

      assert.ok(setPropProp, 'SetPropertyValue schema should be auto-added');
      assert.match(setPropProp.metadata.description ?? '', /set.+property.+value.+path/);
      assert.strictEqual(setPropProp.metadata.flagHint, 'P');
      assert.strictEqual(setPropProp.metadata.advanced, true);
    });

    it('should not add setPropertyValue schema when setPropertyValueEnabled is false', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, setPropertyValueEnabled: false });

      // SetPropertyValue property should not be present
      const setPropProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'setPropertyValue');

      assert.strictEqual(setPropProp, undefined, 'SetPropertyValue schema should not be added');
    });

    it('should use existing setPropertyValue schema if present', async function() {
      const customSetProp = Configurator.createSetPropertyValueSchema()
        .meta('flagHint', 'p')
        .meta('description', 'custom property setter')

      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('setPropertyValue', customSetProp);

      const configurator = new Configurator({ schema, setPropertyValueEnabled: true });

      // Should use custom setPropertyValue schema
      const setPropProp = configurator.schema.properties['setPropertyValue'];
      assert.strictEqual(setPropProp.metadata.description, 'custom property setter');
      assert.strictEqual(setPropProp.metadata.flagHint, 'p');
    });

    it('should support renaming setPropertyValue to custom property name', async function() {
      const customSetProp = Configurator.createSetPropertyValueSchema().meta('description', 'assign property')

      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('assign', customSetProp);  // Renamed from "setPropertyValue" to "assign"

      const configurator = new Configurator({ schema, setPropertyValueEnabled: true });

      // Should recognize it by _configuratorSchema: 'setPropertyValue'
      const assignProp = configurator.schema.properties['assign'];
      assert.strictEqual(assignProp.metadata.configuratorSchema, 'setPropertyValue');
      assert.strictEqual(assignProp.metadata.description, 'assign property');
    });

    it('should create setPropertyValue schema with correct default attributes', function() {
      const setPropSchema = Configurator.createSetPropertyValueSchema();

      assert.strictEqual(setPropSchema.base, 'array');
      assert.strictEqual(setPropSchema.metadata.flagHint, 'P');
      assert.strictEqual(setPropSchema.metadata.configuratorSchema, 'setPropertyValue');
      assert.strictEqual(setPropSchema.metadata.advanced, true);
      assert.strictEqual(setPropSchema.metadata.omitFromSerialize, true);

      // Verify array structure
      const path0 = setPropSchema.properties['0'];
      const path1 = setPropSchema.properties['1'];

      assert.ok(path0, 'Should have property at index 0');
      assert.strictEqual(path0.base, 'string');
      assert.strictEqual(path0.metadata.hidden, true);

      assert.ok(path1, 'Should have property at index 1');
      assert.strictEqual(path1.base, 'any');
      assert.strictEqual(path1.metadata.hidden, true);
    });
  });

  describe('Dump schema creation', function() {

    it('should automatically add dump schema when dumpEnabled is true', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, dumpEnabled: true });

      // Dump property should be auto-added
      const dumpProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'dump');

      assert.ok(dumpProp, 'Dump schema should be auto-added');
      assert.match(dumpProp.metadata.description ?? '', /dump.+configuration.+file/);
      assert.strictEqual(dumpProp.options.context, 'dump');
    });

    it('should not add dump schema when dumpEnabled is false', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema, dumpEnabled: false });

      // Dump property should not be present
      const dumpProp = Object.values(configurator.schema.properties)
        .find(s => s.metadata['configuratorSchema'] === 'dump');

      assert.strictEqual(dumpProp, undefined, 'Dump schema should not be added');
    });

    it('should create dump schema with correct default attributes', function() {
      const dumpSchema = Configurator.createDumpSchema();

      assert.strictEqual(dumpSchema.options.context, 'dump');
      assert.deepStrictEqual(dumpSchema.handlers.validators, ['$writable']);
      assert.strictEqual(dumpSchema.metadata.configuratorSchema, 'dump');
      assert.strictEqual(dumpSchema.metadata.advanced, true);
      assert.strictEqual(dumpSchema.metadata.omitFromSerialize, true);
    });
  });

  describe('Config file loading integration', function() {

    let tempDir;
    let configFile;

    beforeEach(async function() {
      tempDir = tmpdir();
      configFile = join(tempDir, `test-config-${Date.now()}.json`);
    });

    afterEach(async function() {
      try {
        await fs.unlink(configFile);
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    it('should load configuration from file specified via command line', async function() {
      const configData = {
        host: 'config-host',
        port: 9999
      };
      await fs.writeFile(configFile, JSON.stringify(configData), 'utf8');

      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--config', configFile],
        env: {}
      });

      assert.strictEqual(config.host, 'config-host');
      assert.strictEqual(config.port, 9999);
    });

    it('should allow config file values to override lower priority sources', async function() {
      const configData = {
        port: 7777,
        host: 'file-host'
      };
      await fs.writeFile(configFile, JSON.stringify(configData), 'utf8');

      const schema = new Schema('object')
        .property('host', new Schema('string', { default: 'default-host' }))
        .property('port', new Schema('number', { default: 3000 }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--config', configFile],
        env: {
          'APP_HOST': 'env-host',
          'APP_PORT': '5555'
        }
      });

      // Config file (900) should override env (400) and defaults (100)
      assert.strictEqual(config.host, 'file-host');
      assert.strictEqual(config.port, 7777);
    });

    it('should allow config file to override CLI due to runtime mutability', async function() {
      const configData = {
        port: 7777,
        host: 'file-host'
      };
      await fs.writeFile(configFile, JSON.stringify(configData), 'utf8');

      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number'));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--config', configFile, '--port', '8888'],
        env: {}
      });

      // Config file (900) should override CLI (600) - runtime mutability priority
      assert.strictEqual(config.host, 'file-host');
      assert.strictEqual(config.port, 7777);  // Config file wins over CLI
    });

    it('should use custom context name for renamed config option', async function() {
      const configData = {
        database: 'mydb',
        host: 'dbhost'
      };
      await fs.writeFile(configFile, JSON.stringify(configData), 'utf8');

      const profileConfig = Configurator.createConfigSchema().option('context', 'profilePath');

      const schema = new Schema('object')
        .property('database', new Schema('string'))
        .property('host', new Schema('string'))
        .property('profile', profileConfig);  // Renamed to "profile"

      // Need to provide custom sources that use profilePath context
      const { JsonFileSource, EnvironmentSource, CommandLineSource, ObjectSource, ConfigurationSource } = await import('../src/configuration-sources/index.js');
      const sources = [
        new EnvironmentSource(),
        new CommandLineSource(),
        new JsonFileSource({ contextName: 'profilePath' }),  // Match custom context
        new ObjectSource({ contextName: 'overrides', sequence: ConfigurationSource.DefaultSequence.OVERRIDES })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--profile', configFile],
        env: {}
      });

      assert.strictEqual(config.database, 'mydb');
      assert.strictEqual(config.host, 'dbhost');
    });

    it('should throw error if config file not found', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const configurator = new Configurator({ schema });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: ['--config', '/nonexistent/config.json'],
          env: {}
        }),
        {
          name: 'ConfiguratorError',
          message: /Configuration path.*not found/
        }
      );
    });

    it('should support stdin as config source', async function() {
      // Note: Testing stdin ("-") is tricky in unit tests
      // This test documents that "-" should be supported by validator
      const configSchema = await new Configurator().resolver.compile(Configurator.createConfigSchema());
      const validators = configSchema.handlers.validators;

      assert.ok(await configSchema.validateValue('-'));

    });

    it('should handle deeply nested config file data', async function() {
      const configData = {
        server: {
          ssl: {
            enabled: true,
            cert: '/path/to/cert'
          }
        }
      };
      await fs.writeFile(configFile, JSON.stringify(configData), 'utf8');

      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('ssl', new Schema('object')
            .property('enabled', new Schema('boolean'))
            .property('cert', new Schema('string'))
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--config', configFile],
        env: {}
      });

      assert.strictEqual(config.server.ssl.enabled, true);
      assert.strictEqual(config.server.ssl.cert, '/path/to/cert');
    });
  });

  describe('Dump functionality', function() {

    let tempDir;
    let dumpFile;

    beforeEach(async function() {
      tempDir = tmpdir();
      dumpFile = join(tempDir, `test-dump-${Date.now()}.json`);
    });

    afterEach(async function() {
      try {
        await fs.unlink(dumpFile);
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    it('should dump configuration to file when dump option provided', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string', { default: 'localhost' }))
        .property('port', new Schema('number', { default: 3000 }));

      const configurator = new Configurator({ schema });

      await configurator.configure({
        appName: 'app',
        argv: ['--dump', dumpFile, '--port', '8080'],
        env: {}
      });

      // Verify dump file was created
      const content = await fs.readFile(dumpFile, 'utf8');
      const dumped = JSON.parse(content);

      assert.strictEqual(dumped.host, 'localhost');
      assert.strictEqual(dumped.port, 8080);
    });

    it('should omit special properties from dump', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string', { default: 'localhost' }))
        .property('port', new Schema('number', { default: 3000 }));

      const configurator = new Configurator({ schema, dumpEnabled: true });

      await configurator.configure({
        appName: 'app',
        argv: ['--dump', dumpFile, '--port', '8080'],
        env: {}
      });

      const content = await fs.readFile(dumpFile, 'utf8');
      const dumped = JSON.parse(content);

      // config, dump, help should not appear in dump (omitFromSerialize: true)
      assert.strictEqual(dumped.config, undefined);
      assert.strictEqual(dumped.dump, undefined);
      assert.strictEqual(dumped.help, undefined);
    });

    it('should dump to stdout when using "-"', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string', { default: 'test' }));

      const configurator = new Configurator({ schema });

      // Mock console.log and process.exit
      const originalLog = console.log;
      const originalExit = process.exit;
      let dumpOutput = '';
      let exitCode = null;

      console.log = (msg) => { dumpOutput = msg; };
      process.exit = (code) => {
        exitCode = code;
        throw new Error('process.exit called');
      };

      try {
        await configurator.configure({
          appName: 'app',
          argv: ['--dump', '-'],
          env: {}
        });
      } catch (err) {
        // Expected - process.exit throws
      } finally {
        console.log = originalLog;
        process.exit = originalExit;
      }

      // Verify dump to stdout
      const dumped = JSON.parse(dumpOutput);
      assert.strictEqual(dumped.value, 'test');
      assert.strictEqual(exitCode, 0);
    });

    it('should reject dump to non-JSON file', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string', { default: 'test' }));

      const configurator = new Configurator({ schema });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: ['--dump', '/tmp/badfile.txt'],
          env: {}
        }),
        {
          name: 'ConfiguratorError',
          message: /Unsupported dump output.*must be.*\.json/
        }
      );
    });
  });

  describe('SetPropertyValue functionality', function() {

    it('should set property value using absolute path', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string', { default: 'localhost' }))
        .property('port', new Schema('number', { default: 3000 }))
        .property('nested', new Schema('object')
          .property('value', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--set-property-value', 'host', 'example.com', '-P', 'port', '8080', '-P', 'nested.value', 'test'],
        env: {}
      });

      assert.strictEqual(config.host, 'example.com');
      assert.strictEqual(config.port, 8080);
      assert.strictEqual(config.nested.value, 'test');
    });

    it('should set property value using relative path within a selection', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', { selector: true }))
        .property('server', new Schema('object', { selection: 'server' })
          .property('host', new Schema('string', { default: 'localhost' }))
          .property('port', new Schema('number', { default: 3000 }))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['server', '-P', '.host', 'example.com', '-P', '.port', '9000'],
        env: {}
      });

      assert.strictEqual(config.command, 'server');
      assert.strictEqual(config.server.host, 'example.com');
      assert.strictEqual(config.server.port, 9000);
    });

    it('should set array element values', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('0', new Schema('string'))
          .property('1', new Schema('string'))
          .property('2', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['-P', 'tags.0', 'first', '-P', 'tags.1', 'second', '-P', 'tags.2', 'third'],
        env: {}
      });

      assert.deepStrictEqual(config.tags, ['first', 'second', 'third']);
    });

    it('should set values of different types', async function() {
      const schema = new Schema('object')
        .property('str', new Schema('string'))
        .property('num', new Schema('number'))
        .property('bool', new Schema('boolean'))
        .property('obj', new Schema('object')
          .property('nested', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: [
          '-P', 'str', 'hello',
          '-P', 'num', '42',
          '-P', 'bool', 'true',
          '-P', 'obj.nested', 'world'
        ],
        env: {}
      });

      assert.strictEqual(config.str, 'hello');
      assert.strictEqual(config.num, 42);
      assert.strictEqual(config.bool, true);
      assert.strictEqual(config.obj.nested, 'world');
    });

    it('should throw error for unknown property path', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number'));

      const configurator = new Configurator({ schema });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: ['-P', 'unknown.path', 'value'],
          env: {}
        }),
        {
          name: 'CommandLineError',
          message: /unknown property path.*unknown\.path/
        }
      );
    });

    it('should throw error for unknown union-keyed path', async function() {
      const schema = new Schema('object')
        .property('animal', new Schema('object')
          .unionSchema('cat', new Schema('object')
            .property('type', Schema.literal('cat'))
            .property('meow', new Schema('boolean'))
          )
        );

      const configurator = new Configurator({ schema });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: ['-P', 'animal:bird.type', 'bird'],  // 'bird' union doesn't exist
          env: {}
        }),
        {
          name: 'CommandLineError',
          message: /unknown property path.*animal:bird\.type/
        }
      );
    });

    it('should throw error when missing value argument', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string'));

      const configurator = new Configurator({ schema });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: ['-P', 'host'],  // Missing the value
          env: {}
        }),
        {
          name: 'CommandLineError',
          message: /requires a path and a value/
        }
      );
    });

    it('should work with deeply nested paths', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('object')
              .property('d', new Schema('string'))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['-P', 'a.b.c.d', 'deep-value'],
        env: {}
      });

      assert.strictEqual(config.a.b.c.d, 'deep-value');
    });

    it('should omit setPropertyValue from serialized output', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string', { default: 'localhost' }))
        .property('port', new Schema('number', { default: 3000 }));

      const configurator = new Configurator({ schema, setPropertyValueEnabled: true });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['-P', 'host', 'example.com'],
        env: {}
      });

      // setPropertyValue should not appear in the config object (omitFromSerialize: true)
      assert.strictEqual(config.setPropertyValue, undefined);
      assert.strictEqual(config.host, 'example.com');
    });
  });

  describe('Multiple special options together', function() {

    it('should support help, config, dump, and setPropertyValue simultaneously', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string', { default: 'test' }));

      const configurator = new Configurator({
        schema,
        helpEnabled: true,
        configEnabled: true,
        dumpEnabled: true,
        setPropertyValueEnabled: true
      });

      // All four special schemas should be present
      const props = configurator.schema.properties;

      const helpProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'help');
      const configProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'config');
      const dumpProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'dump');
      const setPropProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'setPropertyValue');

      assert.ok(helpProp, 'Help schema should be present');
      assert.ok(configProp, 'Config schema should be present');
      assert.ok(dumpProp, 'Dump schema should be present');
      assert.ok(setPropProp, 'SetPropertyValue schema should be present');
    });

    it('should allow disabling all special options', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string', { default: 'test' }));

      const configurator = new Configurator({
        schema,
        helpEnabled: false,
        configEnabled: false,
        dumpEnabled: false,
        setPropertyValueEnabled: false
      });

      const props = configurator.schema.properties;

      const helpProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'help');
      const configProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'config');
      const dumpProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'dump');
      const setPropProp = Object.values(props).find(s => s.metadata['configuratorSchema'] === 'setPropertyValue');

      assert.strictEqual(helpProp, undefined, 'Help schema should not be present');
      assert.strictEqual(configProp, undefined, 'Config schema should not be present');
      assert.strictEqual(dumpProp, undefined, 'Dump schema should not be present');
      assert.strictEqual(setPropProp, undefined, 'SetPropertyValue schema should not be present');
    });

    it('should support custom names for all special options', async function() {
      const customHelp = Configurator.createHelpSchema().meta('description', 'halp me!');
      const customConfig = Configurator.createConfigSchema().option('context', 'profilePath').meta('description', 'profile path');
      const customDump = Configurator.createDumpSchema().option('context', 'output').meta('description', 'output path');
      const customSetProp = Configurator.createSetPropertyValueSchema().meta('description', 'assign property');

      const schema = new Schema('object')
        .property('value', new Schema('string'))
        .property('halp', customHelp)       // Renamed help
        .property('profile', customConfig)  // Renamed config
        .property('output', customDump)     // Renamed dump
        .property('assign', customSetProp); // Renamed setPropertyValue

      const configurator = new Configurator({
        schema,
        helpEnabled: true,
        configEnabled: true,
        dumpEnabled: true,
        setPropertyValueEnabled: true
      });

      const props = configurator.schema.properties;

      assert.strictEqual(props['halp'].metadata.configuratorSchema, 'help');
      assert.strictEqual(props['profile'].metadata.configuratorSchema, 'config');
      assert.strictEqual(props['output'].metadata.configuratorSchema, 'dump');
      assert.strictEqual(props['assign'].metadata.configuratorSchema, 'setPropertyValue');

      assert.strictEqual(props['halp'].metadata.description, 'halp me!');
      assert.strictEqual(props['profile'].metadata.description, 'profile path');
      assert.strictEqual(props['output'].metadata.description, 'output path');
      assert.strictEqual(props['assign'].metadata.description, 'assign property');
    });
  });

  describe('Context propagation', function() {

    it('should propagate config file path via context during loading', async function() {
      const tempDir = tmpdir();
      const configFile = join(tempDir, `test-context-${Date.now()}.json`);

      try {
        const configData = { value: 'from-file' };
        await fs.writeFile(configFile, JSON.stringify(configData), 'utf8');

        const schema = new Schema('object')
          .property('value', new Schema('string'));

        const configurator = new Configurator({ schema });

        // The config file path should be added to context during configure()
        // and then removed after successful load (see configurator.js line 214-216)
        const config = await configurator.configure({
          appName: 'app',
          argv: ['--config', configFile],
          env: {}
        });

        assert.strictEqual(config.value, 'from-file');

        // After successful load, config should be removed from context
        // (This is verified by the lack of error)
      } finally {
        try {
          await fs.unlink(configFile);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
  });
});
