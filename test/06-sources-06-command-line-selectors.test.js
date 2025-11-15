
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CommandLineSource, CommandLineError } from '../src/configuration-sources/command-line-source.js';

describe('Sources - CommandLineSource - Selectors', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic selector functionality', function() {

    it('should parse a simple selector value', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          options: { selector: true }
        }))
        .property('dev', new Schema('object', {
          options: { selection: true }
        })
          .property('verbose', new Schema('boolean'))
        )
        .property('prod', new Schema('object', {
          options: { selection: true }
        })
          .property('optimize', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['dev']
      };

      const assignments = await source.load(compiled, context);

      // Only the selector assignment should be present from command line
      assert.strictEqual(assignments.get('mode'), 'dev');
      assert.strictEqual(assignments.size, 1);
    });

    it('should parse selector followed by selection-specific options', async function() {
      const schema = new Schema('object')
        .property('logger', new Schema('string', {
          options: { selector: true }
        }))
        .property('syslog', new Schema('object', {
          options: { selection: 'syslog' }
        })
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        )
        .property('file', new Schema('object', {
          options: { selection: 'file' }
        })
          .property('path', new Schema('string'))
          .property('append', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['syslog', '--host', 'log.example.com', '--port', '514']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('logger'), 'syslog');
      assert.strictEqual(assignments.get('syslog.host'), 'log.example.com');
      assert.strictEqual(assignments.get('syslog.port'), '514');
    });

    it('should use selection property name when selection is true', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', { selector: true }))
        .property('list', new Schema('object', { selection: true })
          .property('verbose', new Schema('boolean'))
        )
        .property('create', new Schema('object', { selection: true })
          .property('name', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['list', '--verbose']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'list');
      assert.strictEqual(assignments.get('list.verbose'), true);
    });
  });

  describe('Selector downscoping', function() {

    it('should scope options to current selection', async function() {
      const schema = new Schema('object')
        .property('service', new Schema('string', { selector: true }))
        .property('storage', new Schema('object', { selection: true })
          .property('bandwidth', new Schema('number'))
          .property('iops', new Schema('number'))
        )
        .property('compute', new Schema('object', { selection: true })
          .property('cpus', new Schema('number'))
          .property('memory', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['storage', '--bandwidth', '500', '--iops', '100']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('service'), 'storage');
      assert.strictEqual(assignments.get('storage.bandwidth'), '500');
      assert.strictEqual(assignments.get('storage.iops'), '100');
      // Should not have compute properties
      assert.ok(!assignments.has('compute.cpus'));
      assert.ok(!assignments.has('compute.memory'));
    });

    it('should not require selection prefix in option names', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('string', { selector: true }))
        .property('postgres', new Schema('object', { selection: true })
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        // Note: --host not --postgres-host
        argv: ['postgres', '--host', 'localhost', '--port', '5432']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('database'), 'postgres');
      assert.strictEqual(assignments.get('postgres.host'), 'localhost');
      assert.strictEqual(assignments.get('postgres.port'), '5432');
    });
  });

  describe('Nested selectors', function() {

    it('should handle two-level selector hierarchy', async function() {
      const schema = new Schema('object')
        .property('cloud', new Schema('object')
          .property('command', new Schema('string', { selector: true, required: true }))
          .property('storage', new Schema('object', { selection: true })
            .property('storageCommand', new Schema('string', { selector: true, required: true }))
            .property('list', new Schema('object', { selection: true })
              .property('bucket', new Schema('string'))
              .property('recursive', new Schema('boolean'))
            )
            .property('get', new Schema('object', { selection: true })
              .property('bucket', new Schema('string'))
              .property('key', new Schema('string'))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['storage', 'list', '--bucket', 'my-bucket', '--recursive']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('cloud.command'), 'storage');
      assert.strictEqual(assignments.get('cloud.storage.storageCommand'), 'list');
      assert.strictEqual(assignments.get('cloud.storage.list.bucket'), 'my-bucket');
      assert.strictEqual(assignments.get('cloud.storage.list.recursive'), true);
    });

    it('should handle three-level selector hierarchy', async function() {
      const schema = new Schema('object')
        .property('aws', new Schema('object')
          .property('service', new Schema('string', { selector: true }))
          .property('s3', new Schema('object', { selection: true })
            .property('operation', new Schema('string', { selector: true }))
            .property('ls', new Schema('object', { selection: true })
              .property('format', new Schema('string', { selector: true }))
              .property('json', new Schema('object', { selection: true })
                .property('pretty', new Schema('boolean'))
              )
              .property('text', new Schema('object', { selection: true })
                .property('compact', new Schema('boolean'))
              )
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['s3', 'ls', 'json', '--pretty']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('aws.service'), 's3');
      assert.strictEqual(assignments.get('aws.s3.operation'), 'ls');
      assert.strictEqual(assignments.get('aws.s3.ls.format'), 'json');
      assert.strictEqual(assignments.get('aws.s3.ls.json.pretty'), true);
    });
  });

  describe('Selectors with global options', function() {

    it('should allow global options before selector', async function() {
      const schema = new Schema('object')
        .property('debug', new Schema('boolean'))
        .property('command', new Schema('string', { selector: true }))
        .property('start', new Schema('object', { selection: true })
          .property('port', new Schema('number'))
        )
        .property('stop', new Schema('object', { selection: true })
          .property('force', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['--debug', 'start', '--port', '8080']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('debug'), true);
      assert.strictEqual(assignments.get('command'), 'start');
      assert.strictEqual(assignments.get('start.port'), '8080');
    });

    it('should allow selection-specific options to override global options', async function() {
      const schema = new Schema('object')
        .property('timeout', new Schema('number', { default: 5000 }))
        .property('command', new Schema('string', { selector: true }))
        .property('fast', new Schema('object', { selection: true })
          .property('timeout', new Schema('number', { default: 1000 }))
        )
        .property('slow', new Schema('object', { selection: true })
          .property('timeout', new Schema('number', { default: 10000 }))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['fast', '--timeout', '500']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'fast');
      assert.strictEqual(assignments.get('fast.timeout'), '500');
      // Global timeout should not be in assignments (wasn't specified)
      assert.ok(!assignments.has('timeout'));
    });
  });

  describe('Selectors with mixed options', function() {

    it('should handle app-level and selection-level options', async function() {
      const schema = new Schema('object')
        .property('region', new Schema('string', { default: 'us-west-1' }))
        .property('cloud', new Schema('object')
          .property('command', new Schema('string', { selector: true, required: true }))
          .property('storage', new Schema('object', { selection: true })
            .property('bandwidth', new Schema('number', { default: 500 }))
            .property('storageCommand', new Schema('string', { selector: true, required: true }))
            .property('list', new Schema('object', { selection: true })
              .property('bucket', new Schema('string', { required: true }))
              .property('recursive', new Schema('boolean', { default: false }))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'myapp',
        argv: ['--region', 'us-east-1', 'storage', '--bandwidth', '750', 'list', '--bucket', 'my-bucket', '--recursive']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('region'), 'us-east-1');
      assert.strictEqual(assignments.get('cloud.command'), 'storage');
      assert.strictEqual(assignments.get('cloud.storage.bandwidth'), '750');
      assert.strictEqual(assignments.get('cloud.storage.storageCommand'), 'list');
      assert.strictEqual(assignments.get('cloud.storage.list.bucket'), 'my-bucket');
      assert.strictEqual(assignments.get('cloud.storage.list.recursive'), true);
    });
  });

  describe('Selectors with general properties', function() {

    it('should handle general property in selection', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          options: { selector: true }
        }))
        .property('upload', new Schema('object', {
          options: { selection: true }
        })
          .property('bucket', new Schema('string'))
          .property('file', new Schema('string', {
            metadata: { general: true }
          }))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['upload', '--bucket', 'my-bucket', 'data.txt']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'upload');
      assert.strictEqual(assignments.get('upload.bucket'), 'my-bucket');
      assert.strictEqual(assignments.get('upload.file'), 'data.txt');
    });

    it('should handle general array property in selection', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          options: { selector: true }
        }))
        .property('delete', new Schema('object', {
          options: { selection: true }
        })
          .property('force', new Schema('boolean'))
          .property('files', new Schema('array', {
            metadata: { general: true }
          })
            .property('*', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['delete', '--force', 'file1.txt', 'file2.txt', 'file3.txt']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'delete');
      assert.strictEqual(assignments.get('delete.force'), true);
      assert.deepStrictEqual(assignments.get('delete.files'), ['file1.txt', 'file2.txt', 'file3.txt']);
    });
  });

  describe('Selector kebab-case conversion', function() {

    it('should convert selector values to kebab-case', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', { selector: true }))
        .property('showStatus', new Schema('object', { selection: 'show-status' })
          .property('detailed', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['show-status', '--detailed']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'show-status');
      assert.strictEqual(assignments.get('showStatus.detailed'), true);
    });
  });

  describe('Context escalation', function() {

    it('should escalate to parent context for global options after selector', async function() {
      const schema = new Schema('object')
        .property('debug', new Schema('boolean'))
        .property('verbose', new Schema('boolean'))
        .property('command', new Schema('string', { selector: true }))
        .property('start', new Schema('object', { selection: true })
          .property('port', new Schema('number'))
        )
        .property('stop', new Schema('object', { selection: true })
          .property('force', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        // Global --debug option comes after the selection and its options
        argv: ['start', '--port', '8080', '--debug', '--verbose']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'start');
      assert.strictEqual(assignments.get('start.port'), '8080');
      assert.strictEqual(assignments.get('debug'), true);
      assert.strictEqual(assignments.get('verbose'), true);
    });

    it('should escalate through nested selectors to find matching option', async function() {
      const schema = new Schema('object')
        .property('region', new Schema('string'))
        .property('cloud', new Schema('object')
          .property('command', new Schema('string', { selector: true }))
          .property('storage', new Schema('object', { selection: true })
            .property('storageCommand', new Schema('string', { selector: true }))
            .property('list', new Schema('object', { selection: true })
              .property('bucket', new Schema('string'))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        // --region comes after nested selections
        argv: ['storage', 'list', '--bucket', 'my-bucket', '--region', 'us-west-1']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('cloud.command'), 'storage');
      assert.strictEqual(assignments.get('cloud.storage.storageCommand'), 'list');
      assert.strictEqual(assignments.get('cloud.storage.list.bucket'), 'my-bucket');
      assert.strictEqual(assignments.get('region'), 'us-west-1');
    });

    it('should handle escalation but not return to child context', async function() {
      const schema = new Schema('object')
        .property('debug', new Schema('boolean'))
        .property('timeout', new Schema('number'))
        .property('service', new Schema('string', { selector: true }))
        .property('database', new Schema('object', { selection: true })
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        // Put all database options together, then global options
        argv: ['--debug', 'database', '--host', 'localhost', '--port', '5432', '--timeout', '5000']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('debug'), true);
      assert.strictEqual(assignments.get('service'), 'database');
      assert.strictEqual(assignments.get('database.host'), 'localhost');
      assert.strictEqual(assignments.get('database.port'), '5432');
      // --timeout escalates to parent and stays there
      assert.strictEqual(assignments.get('timeout'), '5000');
    });

    it('should prioritize current context over parent when option exists in both', async function() {
      const schema = new Schema('object')
        .property('timeout', new Schema('number', { default: 5000 }))
        .property('command', new Schema('string', { selector: true }))
        .property('fast', new Schema('object', { selection: true })
          .property('timeout', new Schema('number'))
          .property('cache', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['fast', '--timeout', '1000', '--cache']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('command'), 'fast');
      // timeout should be assigned to fast.timeout, not global timeout
      assert.strictEqual(assignments.get('fast.timeout'), '1000');
      assert.strictEqual(assignments.get('fast.cache'), true);
      assert.ok(!assignments.has('timeout'));
    });
  });

  describe('Selector error handling', function() {

    it('should throw on unknown selector value in strict mode', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', { selector: true }))
        .property('start', new Schema('object', { selection: true }))
        .property('stop', new Schema('object', { selection: true }));

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['restart']  // Not a valid selection
      };

      await assert.rejects(
        () => source.load(compiled, context, { strict: true }),
        {
          name: 'CommandLineError',
          message: /Unknown selector.*restart/
        }
      );
    });

    it('should throw on unexpected selector value', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', { selector: true }))
        .property('dev', new Schema('object', { selection: true })
          .property('debug', new Schema('boolean'))
        )
        .property('prod', new Schema('object', { selection: true })
          .property('optimize', new Schema('boolean'))
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'app',
        argv: ['staging']  // Not defined as a selection
      };

      await assert.rejects(
        () => source.load(compiled, context),
        {
          name: 'CommandLineError',
          message: /selector.*staging/
        }
      );
    });
  });

  describe('Real-world selector scenarios', function() {

    it('should mimic AWS CLI-style command structure', async function() {
      // Simulating: aws s3 ls --recursive s3://my-bucket
      const schema = new Schema('object')
        .property('debug', new Schema('boolean'))
        .property('aws', new Schema('object')
          .property('service', new Schema('string', {
            options: { selector: true, required: true }
          }))
          .property('s3', new Schema('object', {
            options: { selection: true }
          })
            .property('operation', new Schema('string', {
              options: { selector: true, required: true }
            }))
            .property('ls', new Schema('object', {
              options: { selection: true }
            })
              .property('recursive', new Schema('boolean', {
                options: { default: false }
              }))
              .property('humanReadable', new Schema('boolean', {
                options: { default: false }
              }))
              .property('path', new Schema('string', {
                metadata: { general: true }
              }))
            )
            .property('cp', new Schema('object', {
              options: { selection: true }
            })
              .property('recursive', new Schema('boolean'))
              .property('source', new Schema('string', {
                metadata: { general: true }
              }))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'aws',
        argv: ['s3', 'ls', '--recursive', '--human-readable', 's3://my-bucket']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('aws.service'), 's3');
      assert.strictEqual(assignments.get('aws.s3.operation'), 'ls');
      assert.strictEqual(assignments.get('aws.s3.ls.recursive'), true);
      assert.strictEqual(assignments.get('aws.s3.ls.humanReadable'), true);
      assert.strictEqual(assignments.get('aws.s3.ls.path'), 's3://my-bucket');
    });

    it('should handle docker-style command with subcommands', async function() {
      // Simulating: docker container run --name myapp --port 8080:80 -- nginx
      const schema = new Schema('object')
        .property('docker', new Schema('object')
          .property('resource', new Schema('string', {
            options: { selector: true }
          }))
          .property('container', new Schema('object', {
            options: { selection: true }
          })
            .property('action', new Schema('string', {
              options: { selector: true }
            }))
            .property('run', new Schema('object', {
              options: { selection: true }
            })
              .property('name', new Schema('string'))
              .property('port', new Schema('array')
                .property('*', new Schema('string'))
              )
              .property('image', new Schema('string', {
                metadata: { general: true }
              }))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new CommandLineSource();

      const context = {
        appName: 'docker',
        argv: ['container', 'run', '--name', 'myapp', '--port', '8080:80', '--', 'nginx']
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('docker.resource'), 'container');
      assert.strictEqual(assignments.get('docker.container.action'), 'run');
      assert.strictEqual(assignments.get('docker.container.run.name'), 'myapp');
      assert.deepStrictEqual(assignments.get('docker.container.run.port'), ['8080:80']);
      assert.strictEqual(assignments.get('docker.container.run.image'), 'nginx');
    });
  });
});
