
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: length', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('String length validation', function() {
    it('should accept string within length range', async function() {
      const schema = new Schema('string').validator({$length: {min: 3, max: 10}});
      const compiled = await resolver.compile(schema);

      await compiled._validateValue('hello');
      await compiled._validateValue('abc'); // min boundary
      await compiled._validateValue('1234567890'); // max boundary
    });

    it('should reject string too short', async function() {
      const schema = new Schema('string').validator({$length: {min: 3, max: 10}});
      const compiled = await resolver.compile(schema);

      await assert.rejects(() => compiled._validateValue('ab'), ValidationError);
    });

    it('should reject string too long', async function() {
      const schema = new Schema('string').validator({$length: {min: 3, max: 10}});
      const compiled = await resolver.compile(schema);

      await assert.rejects(() => compiled._validateValue('12345678901'), ValidationError);
    });

    it('should validate exact length', async function() {
      const schema = new Schema('string').validator({$length: {exact: 5}});
      const compiled = await resolver.compile(schema);

      await compiled._validateValue('hello');
      await assert.rejects(() => compiled._validateValue('hi'), ValidationError);
      await assert.rejects(() => compiled._validateValue('toolong'), ValidationError);
    });

    it('should validate min length only', async function() {
      const schema = new Schema('string').validator({$length: {min: 3}});
      const compiled = await resolver.compile(schema);

      await compiled._validateValue('abc');
      await compiled._validateValue('verylongstring');
      await assert.rejects(() => compiled._validateValue('ab'), ValidationError);
    });

    it('should validate max length only', async function() {
      const schema = new Schema('string').validator({$length: {max: 5}});
      const compiled = await resolver.compile(schema);

      await compiled._validateValue('');
      await compiled._validateValue('hello');
      await assert.rejects(() => compiled._validateValue('toolong'), ValidationError);
    });
  });

  describe('Array length validation', function() {
    it('should accept array within length range', async function() {
      const schema = new Schema('array').validator({$length: {min: 2, max: 5}});
      const compiled = await resolver.compile(schema);

      await compiled._validateValue([1, 2, 3]);
      await compiled._validateValue([1, 2]); // min boundary
      await compiled._validateValue([1, 2, 3, 4, 5]); // max boundary
    });

    it('should reject array too short', async function() {
      const schema = new Schema('array').validator({$length: {min: 2, max: 5}});
      const compiled = await resolver.compile(schema);

      await assert.rejects(() => compiled._validateValue([1]), ValidationError);
    });

    it('should reject array too long', async function() {
      const schema = new Schema('array').validator({$length: {min: 2, max: 5}});
      const compiled = await resolver.compile(schema);

      await assert.rejects(() => compiled._validateValue([1, 2, 3, 4, 5, 6]), ValidationError);
    });

    it('should validate exact array length', async function() {
      const schema = new Schema('array').validator({$length: {exact: 3}});
      const compiled = await resolver.compile(schema);

      await compiled._validateValue([1, 2, 3]);
      await assert.rejects(() => compiled._validateValue([1, 2]), ValidationError);
    });
  });

  describe('Description generation', function() {
    it('should generate description for exact length', async function() {
      const schema = new Schema('string').validator({$length: {exact: 5}});
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[len=5]');
    });

    it('should generate description for range', async function() {
      const schema = new Schema('string').validator({$length: {min: 3, max: 10}});
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[len=3-10]');
    });

    it('should generate description for min only', async function() {
      const schema = new Schema('string').validator({$length: {min: 3}});
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[len≥3]');
    });

    it('should generate description for max only', async function() {
      const schema = new Schema('string').validator({$length: {max: 10}});
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[len≤10]');
    });
  });
});