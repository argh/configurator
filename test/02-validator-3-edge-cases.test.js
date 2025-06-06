import { strict as assert } from 'assert';
import { Validator } from '../src/validator.js';

describe('Validator - Edge Cases', function() {
  let validator;

  beforeEach(function() {
    validator = new Validator();
  });

  describe('#validate() error handling', function() {
    it('should throw error for invalid regex pattern string', async function() {
      // Invalid regex pattern
      const invalidRegex = '/[/';
      await assert.rejects(async () => {
        await validator.validate('anything', invalidRegex);
      }, /Invalid regex pattern/);
    });

    it('should throw error for unknown validator keyword', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', '$nonexistent');
      }, /Unknown validator keyword/);
    });

    it('should throw error for invalid validator object with multiple keys', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', { $email: true, $url: true });
      }, /Validator object must have exactly one key/);
    });

    it('should throw error for invalid validator specification type', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', 123); // Numbers are not valid validator specs
      }, /Invalid validator specification/);
    });

    it('should throw error for $and without array', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', { $and: 'not-an-array' });
      }, /\$and validator requires an array/);
    });

    it('should throw error for $or without array', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', { $or: 'not-an-array' });
      }, /\$or validator requires an array/);
    });

    it('should throw error for $length without object', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', { $length: 'not-an-object' });
      }, /\$length validator requires an object/);
    });

    it('should throw error for $range without object', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', { $range: 'not-an-object' });
      }, /\$range validator requires an object/);
    });

    it('should throw error for $oneof without array', async function() {
      await assert.rejects(async () => {
        await validator.validate('anything', { $oneof: 'not-an-array' });
      }, /\$oneof validator requires an array/);
    });


  });

  describe('#register() error handling', function() {
    it('should throw error when registering non-function validator', function() {
      assert.throws(() => {
        validator.register('test', 'not-a-function');
      }, /must be a function/);
    });
  });

  describe('#validate() with empty and null values', function() {
    it('should handle empty string', async function() {
      // With nonempty validator
      await assert.rejects(async () => {
        await validator.validate('', '$nonempty');
      }, /Value cannot be empty/);

      // With length validator
      await assert.rejects(async () => {
        await validator.validate('', { $length: { min: 1 } });
      }, /Length must be at least/);
    });

    it('should handle null value', async function() {
      // Test with a validator that handles null
      const customValidator = (value) => {
        if (value === null) throw new Error('Value cannot be null');
        return value;
      };
      await assert.rejects(async () => {
        await validator.validate(null, customValidator);
      }, /Value cannot be null/);
    });

    it('should handle undefined value', async function() {
      // Test with a validator that handles undefined
      const customValidator = (value) => {
        if (value === undefined) throw new Error('Value cannot be undefined');
        return value;
      };
      await assert.rejects(async () => {
        await validator.validate(undefined, customValidator);
      }, /Value cannot be undefined/);
    });
  });

  describe('#validate() with special values', function() {
    it('should handle boolean values', async function() {
      // Test with boolean true
      const result1 = await validator.validate(true, (value) => value === true? true : new Error('Must be true'));
      assert.notEqual(result1, undefined);
      await assert.doesNotReject(async () => { await validator.validate(true, (value) => value === true || 'Must be true'); });

      // Test with boolean false
      await assert.rejects(async () => {
        await validator.validate(false, (value) => value === true || new Error('Must be true'));
      }, /Must be true/);
    });

    it('should handle number zero', async function() {
      // Test with positive validator
      await assert.rejects(async () => {
        await validator.validate(0, '$positive');
      }, /Must be a positive number/);

      // Test with custom validator for zero
      await assert.rejects(async () => {
        await validator.validate(0, (value) => value !== 0 || new Error('Cannot be zero'));
      }, /Cannot be zero/);
    });

    it('should handle arrays', async function() {
      // Custom validator for array length
      const arrayValidator = (value) => {
        if (!Array.isArray(value)) throw new Error('Must be an array');
        if (value.length === 0) throw new Error('Array cannot be empty');
        return value;
      };

      // Test with empty array
      await assert.rejects(async () => {
        await validator.validate([], arrayValidator);
      }, /Array cannot be empty/);

      // Test with non-empty array
      const result2 = await validator.validate([1, 2, 3], arrayValidator);
      assert.notEqual(result2, undefined);
      assert.deepEqual(result2, [1, 2, 3]);
    });

    it('should handle objects', async function() {
      // Custom validator for object properties
      const objectValidator = (value) => {
        if (typeof value !== 'object' || value === null) throw new Error('Must be an object');
        if (Object.keys(value).length === 0) throw new Error('Object cannot be empty');
        if (!value.hasOwnProperty('required')) throw new Error('Object must have "required" property');
        return value;
      };

      // Test with empty object
      await assert.rejects(async () => {
        await validator.validate({}, objectValidator);
      }, /Object cannot be empty/);

      // Test with invalid object
      await assert.rejects(async () => {
        await validator.validate({ optional: true }, objectValidator);
      }, /Object must have "required" property/);

      // Test with valid object
      const validObj = { required: true };
      const result3 = await validator.validate(validObj, objectValidator);
      assert.notEqual(result3, undefined);
      assert.deepEqual(result3, validObj);
    });
  });
});
