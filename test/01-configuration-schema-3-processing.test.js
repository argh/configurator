import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { Validator } from '../src/validator.js';

describe('ConfigurationSchema - Processing and Validation', function() {
  let schema;
  let validator;

  beforeEach(function() {
    schema = new ConfigurationSchema();
    validator = new Validator();
  });

  describe('#process() basic functionality', function() {
    beforeEach(function() {
      schema
        .field('requiredField', { required: true })
        .field('optionalField')
        .field('defaultField', { default: 'default-value' });
    });

    it('should process valid input configuration', async function() {
      const result = await schema.validate({
        requiredField: 'value1',
        optionalField: 'value2'
      });

      assert.equal(result.requiredField, 'value1');
      assert.equal(result.optionalField, 'value2');
      assert.equal(result.defaultField, 'default-value');
    });

    it('should use default values when fields are not provided', async function() {
      const result = await schema.validate({
        requiredField: 'value1'
      });

      assert.equal(result.requiredField, 'value1');
      assert.equal(result.optionalField, undefined);
      assert.equal(result.defaultField, 'default-value');
    });

    it('should throw error when required field is missing', async function() {
      await assert.rejects(async () => {
        await schema.validate({
          optionalField: 'value2'
        });
      }, /Required field 'requiredField' is missing/);
    });
  });

  describe('#process() with simple validator', function() {
    beforeEach(function() {
      schema.field('validatedField', {
        validator: /^[a-z]+$/
      });
    });

    it('should validate fields with validator when validator is provided', async function() {
      const result = await schema.validate(
        { validatedField: 'valid' },
        { validator }
      );

      assert.equal(result.validatedField, 'valid');
    });

    it('should throw when validation fails', async function() {
      await assert.rejects(async () => {
        await schema.validate(
          { validatedField: '123' },
          { validator }
        );
      }, /Bad value for field/);
    });

    it('should not validate when no validator is provided', async function() {
      // This should pass even though validation would fail
      const result = await schema.validate({ validatedField: '123' });
      assert.equal(result.validatedField, '123');
    });
  });

  describe('#process() in strict mode', function() {
    beforeEach(function() {
      schema.field('knownField');
    });

    it('should allow known fields in non-strict mode', async function() {
      const result = await schema.validate({
        knownField: 'value',
        unknownField: 'value'
      });

      assert.equal(result.knownField, 'value');
      assert.equal(result.unknownField, undefined);
    });

    it('should throw on unknown fields in strict mode', async function() {
      await assert.rejects(async () => {
        await schema.validate(
          {
            knownField: 'value',
            unknownField: 'value'
          },
          { strict: true }
        );
      }, /Field 'unknownField' is unknown/);
    });
  });

  describe('#process() with inheritance', function() {
    beforeEach(function() {
      schema
        .field('parentField')
        .field('inheritedField', { inherit: true })
        .field('overriddenField', { inherit: true });
    });

    it('should inherit values from parent config', async function() {
      const parentConfig = {
        parentField: 'parent-value',
        inheritedField: 'inherited-value',
        overriddenField: 'parent-override-value'
      };

      const result = await schema.validate(
        {
          // Only override one of the inheritable fields
          overriddenField: 'child-override-value'
        },
        { parentConfig }
      );

      // Parent's field should not be inherited (not marked as inheritable)
      assert.equal(result.parentField, undefined);
      // Inheritable field should be inherited
      assert.equal(result.inheritedField, 'inherited-value');
      // Overridden inheritable field should use child's value
      assert.equal(result.overriddenField, 'child-override-value');
    });
  });
});
