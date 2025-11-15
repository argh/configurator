
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CommandLineSource, CommandLineError } from '../src/configuration-sources/command-line-source.js';

describe('Sources - CommandLineSource', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic command line parsing', function() {

    it('should parse simple long options', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('port', new Schema('number'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'myapp',
        argv: ['--name', 'testapp', '--port', '3000']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('name'), 'testapp');
      assert.strictEqual(assignments.get('port'), '3000');
    });

    it('should parse long options with inline values', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--host=localhost', '--port=8080']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('host'), 'localhost');
      assert.strictEqual(assignments.get('port'), '8080');
    });

    it('should parse nested properties with kebab-case', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--database-host', 'localhost', '--database-port', '5432']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('database.host'), 'localhost');
      assert.strictEqual(assignments.get('database.port'), '5432');
    });

    it('should handle camelCase to kebab-case conversion', async function() {
      const schema = new Schema('object')
        .property('maxRetries', new Schema('number'))
        .property('isEnabled', new Schema('boolean'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'test',
        argv: ['--max-retries', '5', '--is-enabled']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('maxRetries'), '5');
      assert.strictEqual(assignments.get('isEnabled'), true);
    });
  });

  describe('Boolean options', function() {

    it('should treat standalone flags as true', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean'))
        .property('debug', new Schema('boolean'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--verbose', '--debug']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true);
      assert.strictEqual(assignments.get('debug'), true);
    });

    it('should parse explicit boolean values', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('disabled', new Schema('boolean'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--enabled', 'true', '--disabled', 'false']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('enabled'), 'true');
      assert.strictEqual(assignments.get('disabled'), 'false');
    });

    it('should handle inline boolean values', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--enabled=false']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('enabled'), 'false');
    });
  });

  describe('Array options', function() {

    it('should collect multiple values for array options', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--tags', 'one', 'two', 'three']
      };

      const assignments = await source.load(compiled, context);

      assert.deepStrictEqual(assignments.get('tags'), ['one', 'two', 'three']);
    });

    it('should parse comma-separated inline array values', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--items=one,two,three']
      };

      const assignments = await source.load(compiled, context);

      assert.deepStrictEqual(assignments.get('items'), ['one', 'two', 'three']);
    });

    it('should stop collecting array values at next option', async function() {
      const schema = new Schema('object')
        .property('files', new Schema('array')
          .property('*', new Schema('string'))
        )
        .property('output', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--files', 'a.txt', 'b.txt', '--output', 'out.txt']
      };

      const assignments = await source.load(compiled, context);

      assert.deepStrictEqual(assignments.get('files'), ['a.txt', 'b.txt']);
      assert.strictEqual(assignments.get('output'), 'out.txt');
    });
  });

  describe('Short flags', function() {

    it('should parse single short flags', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-v']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true);
    });

    it('should parse combined short flags', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean'))
        .property('debug', new Schema('boolean'))
        .property('quiet', new Schema('boolean'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-vdq']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true);
      assert.strictEqual(assignments.get('debug'), true);
      assert.strictEqual(assignments.get('quiet'), true);
    });

    it('should handle short flag with inline value', async function() {
      const schema = new Schema('object')
        .property('output', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-o=output.txt']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('output'), 'output.txt');
    });
  });

  describe('flagHint metadata', function() {

    it('should honor flagHint for custom short flags', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean', {
          metadata: { flagHint: 'v' }
        }))
        .property('help', new Schema('boolean', {
          metadata: { flagHint: 'h' }
        }))
        .property('quiet', new Schema('boolean', {
          metadata: { flagHint: 'q' }
        }));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-v', '-h', '-q']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true);
      assert.strictEqual(assignments.get('help'), true);
      assert.strictEqual(assignments.get('quiet'), true);
    });

    it('should combine flagHint short flags', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean', {
          metadata: { flagHint: 'v' }
        }))
        .property('interactive', new Schema('boolean', {
          metadata: { flagHint: 'i' }
        }))
        .property('force', new Schema('boolean', {
          metadata: { flagHint: 'f' }
        }));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-vif']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true);
      assert.strictEqual(assignments.get('interactive'), true);
      assert.strictEqual(assignments.get('force'), true);
    });

    it('should handle flagHint with value arguments', async function() {
      const schema = new Schema('object')
        .property('output', new Schema('string', {
          metadata: { flagHint: 'o' }
        }))
        .property('format', new Schema('string', {
          metadata: { flagHint: 'f' }
        }));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-o', 'file.txt', '-f', 'json']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('output'), 'file.txt');
      assert.strictEqual(assignments.get('format'), 'json');
    });

    it('should prevent flagHint conflicts by using first registration', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean', {
          metadata: { flagHint: 'v' }
        }))
        .property('version', new Schema('boolean', {
          metadata: { flagHint: 'v' }
        })); // Conflict

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-v']
      };

      const assignments = await source.load(compiled, context);

      // First property with flagHint 'v' wins
      assert.strictEqual(assignments.get('verbose'), true);
      assert.strictEqual(assignments.get('version'), undefined);
    });

    it('should give flagHint precedence over auto-allocated flags', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean')) // Would get auto-allocated -v
        .property('value', new Schema('string', {
          metadata: { flagHint: 'v' }
        })); // Explicit -v

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-v', 'myvalue']
      };

      const assignments = await source.load(compiled, context);

      // flagHint takes precedence
      assert.strictEqual(assignments.get('value'), 'myvalue');
      assert.strictEqual(assignments.get('verbose'), undefined);
    });
  });

  describe('Auto-generated aliases', function() {

    it('should generate alias from first letters of kebab-case words for nested properties', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('databaseHost', new Schema('string'))  // config-database-host -> --cdh
          .property('maxRetries', new Schema('number'))    // config-max-retries -> --cmr
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--cdh', 'localhost', '--cmr', '5']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('config.databaseHost'), 'localhost');
      assert.strictEqual(assignments.get('config.maxRetries'), '5');
    });

    it('should include numbers in alias generation for nested properties', async function() {
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('test0Name', new Schema('string'))   // server-test0-name -> --st0n
          .property('config2Port', new Schema('number')) // server-config2-port -> --sc2p
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--st0n', 'mytest', '--sc2p', '8080']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('server.test0Name'), 'mytest');
      assert.strictEqual(assignments.get('server.config2Port'), '8080');
    });

    it('should auto-allocate single-letter flags for top-level properties', async function() {
      const schema = new Schema('object')
        .property('github', new Schema('string'))  // Top-level -> -g
        .property('port', new Schema('number'));   // Top-level -> -p

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-g', 'myrepo', '-p', '3000']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('github'), 'myrepo');
      assert.strictEqual(assignments.get('port'), '3000');
    });

    it('should handle nested property aliases', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('hostName', new Schema('string'))
          .property('portNumber', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--dhn', 'db.example.com', '--dpn', '5432']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('database.hostName'), 'db.example.com');
      assert.strictEqual(assignments.get('database.portNumber'), '5432');
    });

    it('should prevent alias conflicts by not registering duplicates', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('databaseHost', new Schema('string')) // config-database-host -> --cdh
          .property('debugHelper', new Schema('boolean')) // config-debug-helper -> --cdh (conflict!)
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--cdh', 'localhost']
      };

      const assignments = await source.load(compiled, context);

      // First property with alias --cdh wins
      assert.strictEqual(assignments.get('config.databaseHost'), 'localhost');
      assert.strictEqual(assignments.get('config.debugHelper'), undefined);
    });

    it('should work with mix of flagHint, auto-flag, and alias', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean', {
          metadata: { flagHint: 'v' }
        }))  // flagHint: -v
        .property('debug', new Schema('boolean'))  // Top-level auto: -d
        .property('database', new Schema('object')
          .property('host', new Schema('string'))  // Nested alias: database-host -> --dh
        )
        .property('output', new Schema('string')); // Top-level auto: -o

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['-v', '-d', '--dh', 'localhost', '-o', 'result.txt']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true); // via flagHint -v
      assert.strictEqual(assignments.get('debug'), true); // via auto-flag -d
      assert.strictEqual(assignments.get('database.host'), 'localhost'); // via alias --dh
      assert.strictEqual(assignments.get('output'), 'result.txt'); // via auto-flag -o
    });
  });

  describe('App name prefix handling', function() {

    it('should strip redundant app name prefix from options', async function() {
      const schema = new Schema('object')
        .property('globalDebug', new Schema('boolean'))
        .property('frob', new Schema('object')
          .property('foo', new Schema('string'))
          .property('bar', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'frob',
        argv: ['--global-debug', '--foo', 'value1', '--bar', '42']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('globalDebug'), true);
      assert.strictEqual(assignments.get('frob.foo'), 'value1');
      assert.strictEqual(assignments.get('frob.bar'), '42');
    });
  });

  describe('Context name configuration', function() {

    it('should use default context name "argv"', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'test',
        argv: ['--value', 'from-argv']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'from-argv');
    });

    it('should use custom context name', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource({ contextName: 'customArgv' });

      const context = {
        appName: 'test',
        customArgv: ['--value', 'custom']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'custom');
    });

    it('should fall back to process.argv when context key missing', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'test'
        // No argv key - will use process.argv
      };

      const assignments = await source.load(compiled, context);

      // Should return empty map if no matching options in process.argv
      assert.ok(assignments instanceof Map);
    });

    it('should skip node and script name from process.argv format', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'test',
        argv: ['node', 'script.js', '--value', 'test']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'test');
    });
  });

  describe('Sequence priority', function() {

    it('should have default sequence of ARGUMENTS', function() {
      const source = new CommandLineSource();
      assert.strictEqual(source.sequence, 600);
    });

    it('should allow custom sequence override', function() {
      const source = new CommandLineSource({ sequence: 700 });
      assert.strictEqual(source.sequence, 700);
    });
  });

  describe('Strict mode', function() {

    it('should ignore unknown options in non-strict mode', async function() {
      const schema = new Schema('object')
        .property('known', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--known', 'value', '--unknown', 'ignored']
      };

      const assignments = await source.load(compiled, context, { strict: false });

      assert.strictEqual(assignments.get('known'), 'value');
      assert.strictEqual(assignments.size, 1);
    });

    it('should throw on unknown options in strict mode', async function() {
      const schema = new Schema('object')
        .property('known', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--known', 'value', '--unknown', 'error']
      };

      await assert.rejects(
        () => source.load(compiled, context, { strict: true }),
        {
          name: 'CommandLineError',
          message: /Unknown option.*unknown/
        }
      );
    });
  });

  describe('Special arguments', function() {

    it('should handle double dash separator', async function() {
      const schema = new Schema('object')
        .property('files', new Schema('array', {
          metadata: { general: true }
        })
          .property('*', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--', 'file1.txt', 'file2.txt']
      };

      const assignments = await source.load(compiled, context);

      assert.deepStrictEqual(assignments.get('files'), ['file1.txt', 'file2.txt']);
    });

    it('should handle dash as stdin indicator', async function() {
      const schema = new Schema('object')
        .property('input', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--input', '-']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('input'), '-');
    });
  });

  describe('Help option', function() {

    it('should handle --help flag and exit', async function() {
      const schema = new Schema('object')
        .property('help', new Schema('boolean', {
          metadata: { configuratorSchema: 'help' }
        }))
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'testapp',
        argv: ['--help']
      };

      // Mock console.log and process.exit
      const originalLog = console.log;
      const originalExit = process.exit;
      let exitCode = null;
      let helpOutput = '';

      console.log = (msg) => { helpOutput = msg; };
      process.exit = (code) => {
        exitCode = code;
        throw new Error('process.exit called');  // Prevent actual exit
      };

      try {
        await source.load(compiled, context);
      } catch (err) {
        // Expected - process.exit throws
      } finally {
        console.log = originalLog;
        process.exit = originalExit;
      }

      // Verify help was displayed and exit was called
      assert.ok(helpOutput.includes('Usage: testapp'), 'Help output should contain usage line');
      assert.strictEqual(exitCode, 0);
    });
  });

  describe('Edge cases', function() {

    it('should handle empty argv', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'test',
        argv: []
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });

    it('should handle options with equals in value', async function() {
      const schema = new Schema('object')
        .property('expr', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--expr=a=b=c']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('expr'), 'a=b=c');
    });

    it('should handle deeply nested paths', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('object')
              .property('d', new Schema('string'))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--a-b-c-d', 'deep']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('a.b.c.d'), 'deep');
    });

    it('should handle numeric values', async function() {
      const schema = new Schema('object')
        .property('count', new Schema('number'));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--count', '123']
      };

      const assignments = await source.load(compiled, context);

      // Source returns string; normalization happens in processAssignments
      assert.strictEqual(assignments.get('count'), '123');
    });
  });

  describe('Real-world scenarios', function() {

    it('should handle typical application arguments', async function() {
      const schema = new Schema('object')
        .property('verbose', new Schema('boolean'))
        .property('config', new Schema('string'))
        .property('port', new Schema('number'))
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('name', new Schema('string'))
        )
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'myapp',
        argv: [
          '-v',
          '--config', 'app.json',
          '--port', '8080',
          '--database-host', 'db.example.com',
          '--database-name', 'production',
          '--tags', 'web', 'api', 'v2'
        ]
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('verbose'), true);
      assert.strictEqual(assignments.get('config'), 'app.json');
      assert.strictEqual(assignments.get('port'), '8080');
      assert.strictEqual(assignments.get('database.host'), 'db.example.com');
      assert.strictEqual(assignments.get('database.name'), 'production');
      assert.deepStrictEqual(assignments.get('tags'), ['web', 'api', 'v2']);
    });
  });
});
