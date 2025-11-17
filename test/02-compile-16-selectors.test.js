
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/errors.js';

describe('Schema Compilation - Selectors and Selections', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Selector flag', function() {

    it('should mark schema as selector when selector option is true', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string').selector())
        .property('option', new Schema('object').selection())

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.command.isSelector, true);
    });

    it('should not mark schema as selector when selector option is false', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string').option('selector', false));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.command.isSelector, false);
    });

    it('should not mark schema as selector by default', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.command.isSelector, false);
    });

    it('should mark schema as selector when selector option is truthy', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string')
          // @ts-ignore
          .option('selector', 'any-truthy-value')
        )
        .property('option', new Schema('object')
          .selection()
        );

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.command.isSelector, true);
    });
  });

  describe('Selection flag', function() {

    it('should mark schema as selection when selection is true', async function() {
      const schema = new Schema('object').selection();

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isSelection, true);
    });

    it('should mark schema as selection when selection is a string', async function() {
      const schema = new Schema('object').selection('custom-value');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isSelection, true);
    });

    it.skip('should mark schema as selection even when selection is false', async function() {
      // isSelection checks for !== undefined, so false is truthy for this purpose - todo - this seems weird, think about it
      const schema = new Schema('object').selection(false);

      const compiled = await resolver.compile(schema);

      // false is not undefined, so it's still considered a selection marker
      assert.strictEqual(compiled.isSelection, true);
    });

    it('should not mark schema as selection when selection is undefined', async function() {
      const schema = new Schema('object');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isSelection, false);
    });
  });

  describe('Selection value', function() {

    it('should use property name as selection value when selection is true', async function() {
      const schema = new Schema('object')
        .property('myProperty', new Schema('object').selection());

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.myProperty.selection, 'myProperty');
    });

    it('should use string value as selection value when selection is a string', async function() {
      const schema = new Schema('object')
        .property('propertyName', new Schema('object').selection('custom-selection-value'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.propertyName.selection, 'custom-selection-value');
    });

    it('should return undefined for selection value when not a selection', async function() {
      const schema = new Schema('object');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.selection, undefined);
    });
  });

  describe('Selector value synthesis', function() {

    it('should synthesize values from selection siblings when selector is true', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string').selector())
        .property('option1', new Schema('object').selection())
        .property('option2', new Schema('object').selection())

      const compiled = await resolver.compile(schema);

      assert.ok(Array.isArray(compiled.properties.command.options.values));
      assert.strictEqual(compiled.properties.command.options.values.length, 2);
      assert.ok(compiled.properties.command.options.values.includes('option1'));
      assert.ok(compiled.properties.command.options.values.includes('option2'));
    });

    it('should use custom selection values when specified', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string').selector())
        .property('debug', new Schema('object').selection('debug-mode'))
        .property('production', new Schema('object').selection('prod-mode'))

      const compiled = await resolver.compile(schema);

      assert.ok(Array.isArray(compiled.properties.mode.options.values));
      assert.strictEqual(compiled.properties.mode.options.values.length, 2);
      assert.ok(compiled.properties.mode.options.values.includes('debug-mode'));
      assert.ok(compiled.properties.mode.options.values.includes('prod-mode'));
    });

    it('should handle mix of implicit and explicit selection values', async function() {
      const schema = new Schema('object')
        .property('selector', new Schema('string').selector())
        .property('alpha', new Schema('object').selection())
        .property('beta', new Schema('object').selection('custom-beta'));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties.selector.options.values.includes('alpha'));
      assert.ok(compiled.properties.selector.options.values.includes('custom-beta'));
    });

    it('should not synthesize values when selector has explicit values', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string')
          .selector()
          .values(['explicit1', 'explicit2'])
        )
        .property('option1', new Schema('object')
          .selection()
        );

      const compiled = await resolver.compile(schema);

      // Explicit values take precedence
      assert.strictEqual(compiled.properties.command.options.values.length, 2);
      assert.ok(compiled.properties.command.options.values.includes('explicit1'));
      assert.ok(compiled.properties.command.options.values.includes('explicit2'));
    });

    it('should normalize selection values when synthesizing', async function() {
      const normalizer = (v) => v.toLowerCase();

      const schema = new Schema('object')
        .property('command', new Schema('string')
          .selector()
          .normalizer(normalizer)
        )
        .property('Option1', new Schema('object')
          .selection('OPTION1')
        )
        .property('Option2', new Schema('object')
          .selection(true)
        );

      const compiled = await resolver.compile(schema);

      // Values should be normalized
      assert.ok(compiled.properties.command.options.values.includes('option1'));
      assert.ok(compiled.properties.command.options.values.includes('option2'));
    });

    it('should throw error when selector has no parent', async function() {
      const schema = new Schema('string')
        .selector()

      await assert.rejects(
      async () => await resolver.compile(schema),
        SchemaError
      );
    });
  });

  describe('Selection conditions', function() {

    it('should auto-generate condition for selection properties', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('option1', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      // Selection should have a condition function
      assert.strictEqual(typeof compiled.properties.option1.options.condition, 'function');
    });

    it('should condition return true when selector matches implicit selection', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      const config = { command: 'storage' };
      const result = await compiled.properties.storage.checkCondition(
        {},
        config,
        compiled.properties.storage,
        'storage'
      );

      assert.strictEqual(result, true);
    });

    it('should condition return false when selector does not match implicit selection', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: true
        }))
        .property('compute', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      const config = { command: 'compute' };
      const result = await compiled.properties.storage.checkCondition(
        {},
        config,
        compiled.properties.storage,
        'storage'
      );

      assert.strictEqual(result, false);
    });

    it('should condition return true when selector matches explicit selection', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('debug', new Schema('object', {
          selection: 'debug-mode'
        }));

      const compiled = await resolver.compile(schema);

      const config = { mode: 'debug-mode' };
      const result = await compiled.properties.debug.checkCondition(
        {},
        config,
        compiled.properties.debug,
        'debug'
      );

      assert.strictEqual(result, true);
    });

    it('should condition return false when selector does not match explicit selection', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('debug', new Schema('object', {
          selection: 'debug-mode'
        }));

      const compiled = await resolver.compile(schema);

      const config = { mode: 'production' };
      const result = await compiled.properties.debug.checkCondition(
        {},
        config,
        compiled.properties.debug,
        'debug'
      );

      assert.strictEqual(result, false);
    });

    it('should condition return false when selector is not set', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('option', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      const config = {};
      const result = await compiled.properties.option.checkCondition(
        {},
        config,
        compiled.properties.option,
        'option'
      );

      assert.strictEqual(result, false);
    });

    it('should normalize selector value when checking condition', async function() {
      const normalizer = (v) => v.toLowerCase();

      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true,
          normalizer
        }))
        .property('Storage', new Schema('object', {
          selection: 'STORAGE'
        }));

      const compiled = await resolver.compile(schema);

      // Different casing should still match after normalization
      const config = { command: 'Storage' };
      const result = await compiled.properties.Storage.checkCondition(
        {},
        config,
        compiled.properties.Storage,
        'Storage'
      );

      assert.strictEqual(result, true);
    });

    it('should not override explicit condition with selection condition', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('option', new Schema('object', {
          selection: true,
          condition: () => false  // Explicit condition
        }));

      const compiled = await resolver.compile(schema);

      const config = { command: 'option' };
      const result = await compiled.properties.option.checkCondition(
        {},
        config,
        compiled.properties.option,
        'option'
      );

      // Explicit condition takes precedence
      assert.strictEqual(result, false);
    });
  });

  describe('Nested selectors', function() {

    it('should support selector within selection', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: true
        })
          .property('storageCommand', new Schema('string', {
            selector: true
          }))
          .property('list', new Schema('object', {
            selection: true
          }))
          .property('get', new Schema('object', {
            selection: true
          }))
        );

      const compiled = await resolver.compile(schema);

      // Parent selector should have storage in values
      assert.ok(compiled.properties.command.options.values.includes('storage'));

      // Nested selector should have list and get in values
      assert.ok(compiled.properties.storage.properties.storageCommand.options.values.includes('list'));
      assert.ok(compiled.properties.storage.properties.storageCommand.options.values.includes('get'));
    });

    it('should check nested selection condition correctly', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('storage', new Schema('object', {
          selection: true
        })
          .property('action', new Schema('string', {
            selector: true
          }))
          .property('upload', new Schema('object', {
            selection: true
          }))
        );

      const compiled = await resolver.compile(schema);

      // Outer selection should be conditional on command
      const storageConfig = { command: 'storage' };
      const storageResult = await compiled.properties.storage.checkCondition(
        {},
        storageConfig,
        compiled.properties.storage,
        'storage'
      );
      assert.strictEqual(storageResult, true);

      // Inner selection should be conditional on storage.action
      const uploadConfig = { command: 'storage', storage: { action: 'upload' } };
      const uploadResult = await compiled.properties.storage.properties.upload.checkCondition(
        {},
        uploadConfig,
        compiled.properties.storage.properties.upload,
        'storage.upload'
      );
      assert.strictEqual(uploadResult, true);
    });
  });

  describe('Multiple selections with same value', function() {

    it('should allow multiple properties with same selection value', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('config1', new Schema('object', {
          selection: 'shared'
        }))
        .property('config2', new Schema('object', {
          selection: 'shared'
        }));

      const compiled = await resolver.compile(schema);

      // Both should be selections
      assert.strictEqual(compiled.properties.config1.isSelection, true);
      assert.strictEqual(compiled.properties.config2.isSelection, true);

      // Both should have same selection value
      assert.strictEqual(compiled.properties.config1.selection, 'shared');
      assert.strictEqual(compiled.properties.config2.selection, 'shared');
    });

    it('should include shared selection value only once in selector values', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('option1', new Schema('object', {
          selection: 'shared'
        }))
        .property('option2', new Schema('object', {
          selection: 'shared'
        }))
        .property('option3', new Schema('object', {
          selection: 'other'
        }));

      const compiled = await resolver.compile(schema);

      // Should have 2 unique values: 'shared' and 'other'
      const values = compiled.properties.mode.options.values;
      assert.strictEqual(values.length, 2);
      assert.ok(values.includes('shared'));
      assert.ok(values.includes('other'));
    });

    it('should enable all selections with same value when selector matches', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true
        }))
        .property('feature1', new Schema('object', {
          selection: 'advanced'
        }))
        .property('feature2', new Schema('object', {
          selection: 'advanced'
        }));

      const compiled = await resolver.compile(schema);

      const config = { mode: 'advanced' };

      const result1 = await compiled.properties.feature1.checkCondition(
        {},
        config,
        compiled.properties.feature1,
        'feature1'
      );
      assert.strictEqual(result1, true);

      const result2 = await compiled.properties.feature2.checkCondition(
        {},
        config,
        compiled.properties.feature2,
        'feature2'
      );
      assert.strictEqual(result2, true);
    });
  });

  describe('Selector without selections', function() {

    it('should synthesize empty array when no selections exist', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true
        }))
        .property('normalProperty', new Schema('string'));

      const compiled = await resolver.compile(schema);

      // No selections, so empty array is synthesized
      assert.ok(Array.isArray(compiled.properties.command.options.values));
      assert.strictEqual(compiled.properties.command.options.values.length, 0);
    });

    it('should allow selector with only explicit values', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true,
          values: ['explicit1', 'explicit2']
        }));

      const compiled = await resolver.compile(schema);

      assert.ok(Array.isArray(compiled.properties.command.options.values));
      assert.strictEqual(compiled.properties.command.options.values.length, 2);
    });
  });

  describe('Selection without selector', function() {

    it('should mark property as selection even without selector', async function() {
      const schema = new Schema('object')
        .property('option', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.option.isSelection, true);
    });

    it('should have condition that always returns false when no selector exists', async function() {
      const schema = new Schema('object')
        .property('option', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      const result = await compiled.properties.option.checkCondition(
        {},
        {},
        compiled.properties.option,
        'option'
      );

      // No selector to match, so condition fails
      assert.strictEqual(result, false);
    });
  });

  describe('Selector and selection on same property', function() {

    it('should allow property to be both selector and selection', async function() {
      const schema = new Schema('object')
        .property('nested', new Schema('object', {
          selection: true
        })
          .property('command', new Schema('string', {
            selector: true
          }))
        );

      const compiled = await resolver.compile(schema);

      // nested is a selection
      assert.strictEqual(compiled.properties.nested.isSelection, true);

      // nested.command is a selector
      assert.strictEqual(compiled.properties.nested.properties.command.isSelector, true);
    });
  });

  describe('Edge cases', function() {

    it('should handle selector with boolean type', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean', {
          selector: true
        }))
        .property('trueOption', new Schema('object', {
          selection: 'true'
        }))
        .property('falseOption', new Schema('object', {
          selection: 'false'
        }));

      const compiled = await resolver.compile(schema);

      // Boolean normalizer converts 'true'/'false' strings to boolean values
      assert.ok(compiled.properties.enabled.options.values.includes(true));
      assert.ok(compiled.properties.enabled.options.values.includes(false));
    });

    it('should handle selector with number type', async function() {
      const schema = new Schema('object')
        .property('level', new Schema('number', {
          selector: true
        }))
        .property('level1', new Schema('object', {
          selection: '1'
        }))
        .property('level2', new Schema('object', {
          selection: '2'
        }));

      const compiled = await resolver.compile(schema);

      // Number normalizer should convert strings to numbers
      const values = compiled.properties.level.options.values;
      assert.strictEqual(values.length, 2);
    });

    it('should handle empty selection value string', async function() {
      const schema = new Schema('object')
        .property('selector', new Schema('string', {
          selector: true
        }))
        .property('empty', new Schema('object', {
          selection: ''
        }));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.empty.selection, '');
      assert.ok(compiled.properties.selector.options.values.includes(''));
    });
  });

  describe('Integration with other features', function() {

    it('should work with required flag', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true,
          required: true
        }))
        .property('option', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.command.options.required, true);
      assert.strictEqual(compiled.properties.command.isSelector, true);
    });

    it('should work with default values', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', {
          selector: true,
          default: 'standard'
        }))
        .property('standard', new Schema('object', {
          selection: true
        }))
        .property('advanced', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.mode.options.default, 'standard');
      assert.ok(compiled.properties.mode.options.values.includes('standard'));
    });

    it('should work with validators', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true,
          validator: /^[a-z]+$/
        }))
        .property('option', new Schema('object', {
          selection: true
        }));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.command.options.validator, 'function');
      assert.strictEqual(compiled.properties.command.isSelector, true);
    });

    it('should work with metadata', async function() {
      const schema = new Schema('object')
        .property('command', new Schema('string', {
          selector: true,
          _description: 'Select a command'
        }))
        .property('option', new Schema('object', {
          selection: true,
          _description: 'Command option'
        }));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.properties.command.metadata.description, 'Select a command');
      assert.strictEqual(compiled.properties.option.metadata.description, 'Command option');
    });
  });
});
