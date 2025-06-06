import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { Validator } from '../src/validator.js';

describe('ConfigurationSchema - Basic', function() {
  let schema;
  let validator;

  beforeEach(function() {
    schema = new ConfigurationSchema();
    validator = new Validator();
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
  });

  describe('#getMainField()', function() {
    it('should return null when no main field exists', function() {
      schema.field('field1').field('field2');
      assert.equal(schema.getMainField(), null);
    });

    it('should return the main field when one exists', function() {
      schema
        .field('field1')
        .field('mainField', { main: true })
        .field('field2');

      const mainField = schema.getMainField();
      assert.equal(mainField.name, 'mainField');
      assert.equal(mainField.options.main, true);
    });
  });

  describe('#hasAdvancedFields()', function() {
    it('should return false when no advanced fields exist', function() {
      schema.field('field1').field('field2');
      assert.equal(schema.hasAdvancedFields(), false);
    });

    it('should return true when advanced fields exist', function() {
      schema.field('field1', { advanced: true });
      assert.equal(schema.hasAdvancedFields(), true);
    });

    it('should return true when child schema has advanced fields', function() {
      schema.child('section').field('field1', { advanced: true });
      assert.equal(schema.hasAdvancedFields(), true);
    });

    it('should not count hidden advanced fields', function() {
      schema.field('field1', { advanced: true, hidden: true });
      assert.equal(schema.hasAdvancedFields(), false);
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
