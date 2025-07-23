import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { Validators } from '../src/validators.js';

describe('ConfigurationSchema - Processing and Validation', function() {
  let schema;

  beforeEach(function() {
    schema = new ConfigurationSchema();
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
    });

    it('should use default values when fields are not provided', async function() {
      const result = await schema.validate({
        requiredField: 'value1'
      }, {populateDefaults: true});

      assert.equal(result.requiredField, 'value1');
      assert.equal(result.optionalField, undefined);
      assert.equal(result.defaultField, 'default-value');
    });

    it('should throw error when required field is missing', async function() {
      await assert.rejects(async () => {
        await schema.validate({
          optionalField: 'value2'
        });
      }, /Required field "requiredField" is missing/);
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
        { validatedField: 'valid' }
      );

      assert.equal(result.validatedField, 'valid');
    });

    it('should throw when validation fails', async function() {
      await assert.rejects(async () => {
        await schema.validate(
          { validatedField: '123' }
        );
      }, /Bad value for field/);
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
});
