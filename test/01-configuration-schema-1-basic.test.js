import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ValidatorRegistry } from '../src/validator-registry.js';

describe('ConfigurationSchema - Basic', function() {
  let schema;
  let validator;

  beforeEach(function() {
    schema = new ConfigurationSchema();
    validator = new ValidatorRegistry();
  });

  describe('#field()', function() {
    it('should add a field with default options', function() {
      schema.field('testField');
      const fields = schema.getFields();
      assert.equal(fields.has('testField'), true);

      const fieldOptions = fields.get('testField');
      assert.equal(fieldOptions.type, 'string');
      assert.equal(fieldOptions.required, false);
      assert.equal(fieldOptions.default, undefined);
    });

    it('should add a field with custom options', function() {
      schema.field('testField', {
        type: 'number',
        default: 42,
        required: true,
        description: 'Test description',
        flagHint: 'T',
        advanced: true
      });

      const fields = schema.getFields();
      const fieldOptions = fields.get('testField');

      assert.equal(fieldOptions.type, 'number');
      assert.equal(fieldOptions.default, 42);
      assert.equal(fieldOptions.required, true);
      assert.equal(fieldOptions.description, 'Test description');
      assert.equal(fieldOptions.flagHint, 'T');
      assert.equal(fieldOptions.advanced, true);
    });

    it('should support chaining field definitions', function() {
      schema
        .field('field1')
        .field('field2')
        .field('field3');

      const fields = schema.getFields();
      assert.equal(fields.has('field1'), true);
      assert.equal(fields.has('field2'), true);
      assert.equal(fields.has('field3'), true);
    });
  });

  describe('#child()', function() {
    it('should create a child schema', function() {
      const childSchema = schema.child('childSection');

      assert.ok(childSchema instanceof ConfigurationSchema);
      assert.equal(schema.getChildren().has('childSection'), true);
      assert.strictEqual(schema.getChildren().get('childSection'), childSchema);
    });

    it('should support chaining on child schemas', function() {
      schema.child('section')
        .field('field1')
        .field('field2');

      const childSchema = schema.getChildren().get('section');
      const fields = childSchema.getFields();

      assert.equal(fields.has('field1'), true);
      assert.equal(fields.has('field2'), true);
    });

    it('should support cloning schemas that have children', function() {
      schema.child('section')
            .field('field1')
            .field('field2');

      let clone = schema.copy();

      const fields = clone.getChildren().get('section').getFields();

      assert.equal(fields.has('field1'), true);
      assert.equal(fields.has('field2'), true);
    });
  });

  describe('#getGeneralField()', function() {
    it('should return undefined when no general field exists', function() {
      schema.field('field1').field('field2');
      assert.equal(schema.getTaggedField('general'), undefined);
    });

    it('should return the general field when one exists', function() {
      schema
        .field('field1')
        .field('mainField', { general: true })
        .field('field2');

      const mainField = schema.getTaggedField('general');
      assert.equal(mainField.name, 'mainField');
      assert.equal(mainField.general, true);
    });
  });

  describe('#getAllFieldPaths()', function() {
    it('should return paths for root level fields', function() {
      schema.field('field1').field('field2');

      const paths = schema.getAllFieldPaths();
      assert.equal(paths.has('field1'), true);
      assert.equal(paths.has('field2'), true);
      assert.equal(paths.size, 2);
    });

    it('should return paths for nested fields', function() {
      schema
        .field('rootField')
        .child('section')
        .field('nestedField');

      const paths = schema.getAllFieldPaths();
      assert.equal(paths.has('rootField'), true);
      assert.equal(paths.has('section.nestedField'), true);
      assert.equal(paths.size, 2);

      const nestedPath = paths.get('section.nestedField');
      assert.equal(nestedPath.path, 'section.nestedField');
    });
  });
});
