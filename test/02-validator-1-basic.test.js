import { strict as assert } from 'assert';
import { Validator } from '../src/validator.js';

describe('Validator', function() {
  let validator;

  beforeEach(function() {
    validator = new Validator();
  });

  describe('#validate()', function() {
    // Test with function validator
    it('should pass with function validator that returns true', async function() {
      const validatorSpec = (value) => true;
      const result = await validator.validate('any value', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('any value', validatorSpec); });
    });

    it('should fail with a function validator that returns an Error', async function() {
      const validatorSpec = (value) => new Error('Always fails');

      await assert.rejects(async () => {
        await validator.validate('does not matter', validatorSpec);
      }, /Always fails/);
    });

    // Test with RegExp validator
    it('should pass with RegExp validator when value matches', async function() {
      const validatorSpec = /^\d+$/;
      const result = await validator.validate('12345', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('12345', validatorSpec); });
    });

    it('should fail with RegExp validator when value does not match', async function() {
      const validatorSpec = /^\d+$/;
      await assert.rejects(async () => {
        await validator.validate('abc123', validatorSpec);
      }, /Value does not match pattern/);
    });

    // Test with string pattern validator
    it('should pass with string pattern validator when value matches', async function() {
      const validatorSpec = '/^\\w+$/';
      const result = await validator.validate('abc123', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('abc123', validatorSpec); });
    });

    it('should fail with string pattern validator when value does not match', async function() {
      const validatorSpec = '/^\\w+$/';
      await assert.rejects(async () => {
        await validator.validate('abc 123', validatorSpec);
      }, /Value does not match pattern/);
    });

    // Test with string exact match validator
    it('should pass with string exact match validator when value matches', async function() {
      const validatorSpec = 'exact-match';
      const result = await validator.validate('exact-match', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('exact-match', validatorSpec); });
    });

    it('should fail with string exact match validator when value does not match', async function() {
      const validatorSpec = 'exact-match';
      await assert.rejects(async () => {
        await validator.validate('not-a-match', validatorSpec);
      }, /Value must be exactly/);
    });

    // Test with built-in validators
    it('should pass with built-in email validator for valid email', async function() {
      const validatorSpec = '$email';
      const result = await validator.validate('test@example.com', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('test@example.com', validatorSpec); });
    });

    it('should fail with built-in email validator for invalid email', async function() {
      const validatorSpec = '$email';
      await assert.rejects(async () => {
        await validator.validate('not-an-email', validatorSpec);
      }, /Invalid email format/);
    });

    it('should pass with built-in hostname validator for valid hostname', async function() {
      const validatorSpec = '$hostname';
      const result = await validator.validate('example.com', validatorSpec);
      assert.equal(result, 'example.com');
    });

    it('should fail with built-in hostname validator for invalid hostname', async function() {
      const validatorSpec = '$hostname';
      await assert.rejects(async () => {
        await validator.validate('invalid..hostname', validatorSpec);
      }, /Invalid hostname format/);
    });

    it('should pass with built-in url validator for valid URL', async function() {
      const validatorSpec = '$url';
      const result = await validator.validate('https://example.com', validatorSpec);

      // url validator normalizes result:
      assert.equal(result, 'https://example.com/');
    });

    it('should fail with built-in url validator for invalid URL', async function() {
      const validatorSpec = '$url';
      await assert.rejects(async () => {
        await validator.validate('not-a-url', validatorSpec);
      }, /Invalid URL format/);
    });

    // Test with object-based validators
    it('should pass with $length validator when length is within range', async function() {
      const validatorSpec = { $length: { min: 3, max: 10 } };
      const result = await validator.validate('test', validatorSpec);
      assert.equal(result, 'test');
    });

    it('should fail with $length validator when length is below minimum', async function() {
      const validatorSpec = { $length: { min: 5 } };
      await assert.rejects(async () => {
        await validator.validate('test', validatorSpec);
      }, /Length must be at least/);
    });

    it('should fail with $length validator when length exceeds maximum', async function() {
      const validatorSpec = { $length: { max: 3 } };
      await assert.rejects(async () => {
        await validator.validate('test123', validatorSpec);
      }, /Length must be at most/);
    });

    it('should pass with $length validator with exact match', async function() {
      const validatorSpec = { $length: { exact: 4 } };
      const result = await validator.validate('test', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('test', validatorSpec); });
    });

    it('should fail with $length validator when exact length does not match', async function() {
      const validatorSpec = { $length: { exact: 5 } };
      await assert.rejects(async () => {
        await validator.validate('test', validatorSpec);
      }, /Length must be exactly/);
    });

    // Test with $range validator
    it('should pass with $range validator when value is within range', async function() {
      const validatorSpec = { $range: { min: 5, max: 10 } };
      const result = await validator.validate(7, validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate(7, validatorSpec); });
    });

    it('should fail with $range validator when value is below minimum', async function() {
      const validatorSpec = { $range: { min: 5 } };
      await assert.rejects(async () => {
        await validator.validate(3, validatorSpec);
      }, /Value must be at least/);
    });

    it('should fail with $range validator when value exceeds maximum', async function() {
      const validatorSpec = { $range: { max: 10 } };
      await assert.rejects(async () => {
        await validator.validate(15, validatorSpec);
      }, /Value must be at most/);
    });

    // Test with $oneof validator
    it('should pass with $oneof validator when value is in the list', async function() {
      const validatorSpec = { $oneof: ['option1', 'option2', 'option3'] };
      const result = await validator.validate('option2', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('option2', validatorSpec); });
    });

    it('should fail with $oneof validator when value is not in the list', async function() {
      const validatorSpec = { $oneof: ['option1', 'option2', 'option3'] };
      await assert.rejects(async () => {
        await validator.validate('option4', validatorSpec);
      }, /Value must be one of/);
    });

    // Test with $and validator
    it('should pass with $and validator when all conditions pass', async function() {
      const validatorSpec = { $and: [/^\d+$/, { $length: { min: 3, max: 5 } }] };
      const result = await validator.validate('12345', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('12345', validatorSpec); });
    });

    it('should fail with $and validator when one condition fails', async function() {
      const validatorSpec = { $and: [/^\d+$/, { $length: { min: 3, max: 5 } }] };
      await assert.rejects(async () => {
        await validator.validate('123456', validatorSpec);
      }, /Length must be at most/);
    });

    // Test with $or validator
    it('should pass with $or validator when one condition passes', async function() {
      const validatorSpec = { $or: [/^\d+$/, /^[a-z]+$/] };
      const result = await validator.validate('12345', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('12345', validatorSpec); });
    });

    it('should fail with $or validator when all conditions fail', async function() {
      const validatorSpec = { $or: [/^\d+$/, /^[a-z]+$/] };
      await assert.rejects(async () => {
        await validator.validate('ABC123', validatorSpec);
      }, /None of the alternatives matched/);
    });

    // Test with $not validator
    it('should pass with $not validator when condition fails', async function() {
      const validatorSpec = { $not: /^\d+$/ };
      const result = await validator.validate('abc', validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate('abc', validatorSpec); });
    });

    it('should fail with $not validator when condition passes', async function() {
      const validatorSpec = { $not: /^\d+$/ };
      await assert.rejects(async () => {
        await validator.validate('12345', validatorSpec);
      }, /Value must not match/);
    });

    // Test with numeric validators
    it('should pass with positive validator for positive number', async function() {
      const validatorSpec = '$positive';
      const result = await validator.validate(42, validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate(42, validatorSpec); });
    });

    it('should fail with positive validator for negative number', async function() {
      const validatorSpec = '$positive';
      await assert.rejects(async () => {
        await validator.validate(-5, validatorSpec);
      }, /Must be a positive number/);
    });

    it('should pass with negative validator for negative number', async function() {
      const validatorSpec = '$negative';
      const result = await validator.validate(-10, validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate(-10, validatorSpec); });
    });

    it('should fail with negative validator for positive number', async function() {
      const validatorSpec = '$negative';
      await assert.rejects(async () => {
        await validator.validate(10, validatorSpec);
      }, /Must be a negative number/);
    });

    it('should pass with integer validator for integer', async function() {
      const validatorSpec = '$integer';
      const result = await validator.validate(42, validatorSpec);
      assert.notEqual(result, undefined);
      await assert.doesNotReject(async () => { await validator.validate(42, validatorSpec); });
    });

    it('should fail with integer validator for float', async function() {
      const validatorSpec = '$integer';
      await assert.rejects(async () => {
        await validator.validate(3.14, validatorSpec);
      }, /Must be an integer/);
    });

    // Test with no validator
    it('should pass when validatorSpec is undefined', async function() {
      const value = 'any value';
      const result = await validator.validate(value, undefined);
      assert.equal(result, value);
      await assert.doesNotReject(async () => { await validator.validate(value, undefined); });
    });

    it('should pass when validatorSpec is null', async function() {
      const value = 'any value';
      const result = await validator.validate(value, null);
      assert.equal(result, value);
      await assert.doesNotReject(async () => { await validator.validate(value, null); });
    });
  });
});
