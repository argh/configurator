
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Assignments - Selectors', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic selector behavior', function() {

    it('should enable child schema when selector matches selection', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('dev', new Schema('object', {
          selection: 'dev'
        })
          .property('debugPort', new Schema('number'))
        )
        .property('prod', new Schema('object', {
          selection: 'prod'
        })
          .property('workers', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['mode', 'dev'],
        ['dev.debugPort', '9229']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        mode: 'dev',
        dev: {
          debugPort: 9229
        }
      });
    });

    it('should suppress child schema when selector does not match', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('dev', new Schema('object', {
          selection: 'dev'
        })
          .property('debugPort', new Schema('number'))
        )
        .property('prod', new Schema('object', {
          selection: 'prod'
        })
          .property('workers', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['mode', 'dev'],
        ['dev.debugPort', '9229'],
        ['prod.workers', '4']  // Should be suppressed
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        mode: 'dev',
        dev: {
          debugPort: 9229
        }
        // prod should not appear
      });
    });

    it('should use property name as selection when selection: true', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('start', new Schema('object', {
          selection: true  // Uses 'start' as selection value
        })
          .property('port', new Schema('number'))
        )
        .property('stop', new Schema('object', {
          selection: true  // Uses 'stop' as selection value
        })
          .property('graceful', new Schema('boolean'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['command', 'start'],
        ['start.port', '8080']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        command: 'start',
        start: {
          port: 8080
        }
      });
    });
  });

  describe('Hierarchical selectors', function() {

    it('should handle nested selectors', async function() {
      const schema = new Schema('object')
        .property('service', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: 'storage'
        })
          .property('provider', new Schema('string', {
            selector: true
          }))
          .property('s3', new Schema('object', {
            selection: 's3'
          })
            .property('bucket', new Schema('string'))
          )
          .property('gcs', new Schema('object', {
            selection: 'gcs'
          })
            .property('project', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['service', 'storage'],
        ['storage.provider', 's3'],
        ['storage.s3.bucket', 'my-bucket']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        service: 'storage',
        storage: {
          provider: 's3',
          s3: {
            bucket: 'my-bucket'
          }
        }
      });
    });

    it('should suppress nested selections when parent selector does not match', async function() {
      const schema = new Schema('object')
        .property('service', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: 'storage'
        })
          .property('provider', new Schema('string', {
            selector: true
          }))
          .property('s3', new Schema('object', {
            selection: 's3'
          })
            .property('bucket', new Schema('string'))
          )
        )
        .property('compute', new Schema('object', {
          selection: 'compute'
        })
          .property('instances', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['service', 'compute'],
        ['storage.provider', 's3'],  // Should be suppressed
        ['storage.s3.bucket', 'my-bucket'],  // Should be suppressed
        ['compute.instances', '5']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        service: 'compute',
        compute: {
          instances: 5
        }
        // storage should not appear
      });
    });

    it('should suppress nested selection when intermediate selector does not match', async function() {
      const schema = new Schema('object')
        .property('service', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: 'storage'
        })
          .property('operation', new Schema('string', {
            selector: true
          }))
          .property('list', new Schema('object', {
            selection: 'list'
          })
            .property('recursive', new Schema('boolean'))
          )
          .property('get', new Schema('object', {
            selection: 'get'
          })
            .property('key', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['service', 'storage'],
        ['storage.operation', 'list'],
        ['storage.list.recursive', 'true'],
        ['storage.get.key', 'my-key']  // Should be suppressed
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        service: 'storage',
        storage: {
          operation: 'list',
          list: {
            recursive: true
          }
          // get should not appear
        }
      });
    });
  });

  describe('Selector with shared properties', function() {

    it('should allow properties shared across selections', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('config', new Schema('object')
          .property('verbose', new Schema('boolean'))
        )
        .property('start', new Schema('object', {
          selection: 'start'
        })
          .property('port', new Schema('number'))
        )
        .property('stop', new Schema('object', {
          selection: 'stop'
        })
          .property('graceful', new Schema('boolean'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['command', 'start'],
        ['config.verbose', 'true'],
        ['start.port', '8080']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        command: 'start',
        config: {
          verbose: true
        },
        start: {
          port: 8080
        }
      });
    });
  });

  describe('Selector with defaults', function() {

    it('should apply defaults to selected schema', async function() {
      const schema = new Schema('object')
        .property('env', new Schema('string', {
          selector: true
        }))
        .property('development', new Schema('object', {
          selection: 'development'
        })
          .property('debugLevel', new Schema('string', {
            default: 'verbose'
          }))
        )
        .property('production', new Schema('object', {
          selection: 'production'
        })
          .property('debugLevel', new Schema('string', {
            default: 'error'
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['env', 'development']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        env: 'development',
        development: {
          debugLevel: 'verbose'
        }
      });
    });

    it('should not apply defaults to non-selected schema', async function() {
      const schema = new Schema('object')
        .property('env', new Schema('string', {
          selector: true
        }))
        .property('development', new Schema('object', {
          selection: 'development'
        })
          .property('debugLevel', new Schema('string', {
            default: 'verbose'
          }))
        )
        .property('production', new Schema('object', {
          selection: 'production'
        })
          .property('debugLevel', new Schema('string', {
            default: 'error'
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['env', 'production']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        env: 'production',
        production: {
          debugLevel: 'error'
        }
        // development should not appear (and neither should its defaults)
      });
    });
  });

  describe('Selector with required properties', function() {

    it('should enforce required in selected schema even without other assignments', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('deploy', new Schema('object', {
          selection: 'deploy'
        })
          .property('target', new Schema('string', {
            required: true
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['command', 'deploy']
        // Missing required 'target' - should throw even without other deploy assignments
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        /required/i
      );
    });

    it('should enforce required in selected schema when accessing selected properties', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('deploy', new Schema('object', {
          selection: 'deploy'
        })
          .property('region', new Schema('string'))
          .property('target', new Schema('string', {
            required: true
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['command', 'deploy'],
        ['deploy.region', 'us-west']
        // Missing required 'target'
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        /required/i
      );
    });

    it('should not enforce required in non-selected schema', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('deploy', new Schema('object', {
          selection: 'deploy'
        })
          .property('target', new Schema('string', {
            required: true
          }))
        )
        .property('test', new Schema('object', {
          selection: 'test'
        })
          .property('suite', new Schema('string'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['command', 'test'],
        ['test.suite', 'unit']
        // deploy.target is required but deploy is not selected
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        command: 'test',
        test: {
          suite: 'unit'
        }
      });
    });

    it('should allow selection without required if defaults satisfy requirements', async function() {
      // TODO: Implementation gap - selecting a schema should apply defaults from backup strategy
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('deploy', new Schema('object', {
          selection: 'deploy'
        })
          .property('target', new Schema('string', {
            required: true,
            default: 'production'
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['command', 'deploy']
        // target is required but has default, should succeed
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        command: 'deploy',
        deploy: {
          target: 'production'
        }
      });
    });
  });

  describe('Multiple selections sharing selector', function() {

    it('should handle multiple children with same selector property', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('dev', new Schema('object', {
          selection: 'dev'
        })
          .property('hot', new Schema('boolean'))
        )
        .property('staging', new Schema('object', {
          selection: 'staging'
        })
          .property('canary', new Schema('boolean'))
        )
        .property('prod', new Schema('object', {
          selection: 'prod'
        })
          .property('replicas', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['mode', 'staging'],
        ['staging.canary', 'false']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        mode: 'staging',
        staging: {
          canary: false
        }
      });
    });

    it('should apply defaults when selection has no required properties', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('staging', new Schema('object', {
          selection: 'staging'
        })
          .property('canary', new Schema('boolean', {
            default: false
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['mode', 'staging']
        // No other assignments, but default should be applied
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        mode: 'staging',
        staging: {
          canary: false
        }
      });
    });
  });
});
