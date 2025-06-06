import { strict as assert } from 'assert';
import { Validator } from '../src/validator.js';

describe('Validator - Complex Scenarios', function() {
  let validator;

  beforeEach(function() {
    validator = new Validator();
  });

  describe('#validate() with custom validators', function() {
    it('should register and use custom validator', async function() {
      // Register a custom validator
      validator.register('customFormat', (value) => {
        if (!value.match(/^[A-Z]-\d{3}$/)) {
          throw new Error('Must be in format X-000');
        }
        return value;
      });

      // Test it passes with valid format
      await assert.doesNotReject(async () => { await validator.validate('A-123', '$customFormat'); });

      // Test it fails with invalid format
      await assert.rejects(async () => {
        await validator.validate('invalid', '$customFormat');
      }, /Must be in format X-000/);
    });

    it('should handle custom validators with complex logic', async function() {
      // Register a custom validator with more complex logic
      validator.register('passwordStrength', (value) => {
        if (value.length < 8) throw new Error('Password must be at least 8 characters');
        if (!/[A-Z]/.test(value)) throw new Error('Password must contain uppercase letters');
        if (!/[a-z]/.test(value)) throw new Error('Password must contain lowercase letters');
        if (!/[0-9]/.test(value)) throw new Error('Password must contain numbers');
        if (!/[^A-Za-z0-9]/.test(value)) throw new Error('Password must contain special characters');
        return value;
      });

      // Test it passes with strong password
      const result1 = await validator.validate('P@ssw0rd123', '$passwordStrength');
      assert.notEqual(result1, undefined);
      await assert.doesNotReject(async () => { await validator.validate('P@ssw0rd123', '$passwordStrength'); });

      // Test it fails with weak password
      await assert.rejects(async () => {
        await validator.validate('password', '$passwordStrength');
      }, /Password must contain uppercase letters/);
    });
  });

  describe('#validate() with combined validators', function() {
    it('should validate with complex AND conditions', async function() {
      const complexSpec = {
        $and: [
          '$alphanum',
          { $length: { min: 5, max: 10 } },
          (value) => {
            if (value.includes('123')) throw new Error('Must not contain 123');
            return value;
          }
        ]
      };

      // Test it passes
      const result1 = await validator.validate('abc456', complexSpec);
      assert.notEqual(result1, undefined);
      await assert.doesNotReject(async () => { await validator.validate('abc456', complexSpec); });

      // Test it fails length check
      await assert.rejects(async () => {
        await validator.validate('abc', complexSpec);
      }, /Length must be at least/);

      // Test it fails alphanum check
      await assert.rejects(async () => {
        await validator.validate('abc_def', complexSpec);
      }, /Must contain only alphanumeric characters/);

      // Test it fails custom condition
      await assert.rejects(async () => {
        await validator.validate('abc123', complexSpec);
      }, /Must not contain 123/);
    });

    it('should validate with complex OR conditions', async function() {
      const complexSpec = {
        $or: [
          '$email',
          '$url',
          { $length: { exact: 10 } }
        ]
      };

      // Test it passes email
      const result1 = await validator.validate('test@example.com', complexSpec);
      assert.notEqual(result1, undefined);
      await assert.doesNotReject(async () => { await validator.validate('test@example.com', complexSpec); });

      // Test it passes URL
      const result2 = await validator.validate('https://example.com', complexSpec);
      assert.notEqual(result2, undefined);
      await assert.doesNotReject(async () => { await validator.validate('https://example.com', complexSpec); });

      // Test it passes exact length
      const result3 = await validator.validate('1234567890', complexSpec);
      assert.notEqual(result3, undefined);
      await assert.doesNotReject(async () => { await validator.validate('1234567890', complexSpec); });

      // Test it fails all conditions
      await assert.rejects(async () => {
        await validator.validate('invalid', complexSpec);
      }, /None of the alternatives matched/);
    });

    it('should validate with nested AND/OR conditions', async function() {
      const nestedSpec = {
        $and: [
          { $length: { min: 4 } },
          {
            $or: [
              '$email',
              '$url',
              /^[A-Z]{3}\d{3}$/
            ]
          }
        ]
      };

      // Test it passes email
      const result1 = await validator.validate('test@example.com', nestedSpec);
      assert.notEqual(result1, undefined);
      await assert.doesNotReject(async () => { await validator.validate('test@example.com', nestedSpec); });

      // Test it passes URL
      const result2 = await validator.validate('https://example.com', nestedSpec);
      assert.notEqual(result2, undefined);
      await assert.doesNotReject(async () => { await validator.validate('https://example.com', nestedSpec); });

      // Test it passes regex
      const result3 = await validator.validate('ABC123', nestedSpec);
      assert.notEqual(result3, undefined);
      await assert.doesNotReject(async () => { await validator.validate('ABC123', nestedSpec); });

      // Test it fails length but would pass OR
      await assert.rejects(async () => {
        await validator.validate('a@b', nestedSpec);
      }, /Length must be at least/);

      // Test it passes length but fails OR
      await assert.rejects(async () => {
        await validator.validate('invalid', nestedSpec);
      }, /None of the alternatives matched/);
    });
  });

  describe('#validate() with child validators', function() {
    it('should use validators from parent in child validator', async function() {
      // Create a child validator
      const childValidator = validator.createChild();

      // Register a new validator in the child
      childValidator.register('childOnly', (value) => {
        if (!value.startsWith('child-')) throw new Error('Must start with "child-"');
        return value;
      });

      // Test built-in validator works in child
      const result1 = await childValidator.validate('test@example.com', '$email');
      assert.notEqual(result1, undefined);
      await assert.doesNotReject(async () => { await childValidator.validate('test@example.com', '$email'); });

      // Test child-specific validator works
      const result2 = await childValidator.validate('child-123', '$childOnly');
      assert.notEqual(result2, undefined);
      await assert.doesNotReject(async () => { await childValidator.validate('child-123', '$childOnly'); });

      // Test child-specific validator fails
      await assert.rejects(async () => {
        await childValidator.validate('parent-123', '$childOnly');
      }, /Must start with "child-"/);

      // Verify parent doesn't have child's validator
      await assert.rejects(async () => {
        await validator.validate('anything', '$childOnly');
      }, /Unknown validator keyword/);
    });
  });
});
