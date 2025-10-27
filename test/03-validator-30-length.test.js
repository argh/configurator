
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
      const schema = new Schema('string').validator({length: {min: 3, max: 10}});
      const compiled = resolver.compile(schema);

      await compiled.validate('hello', {}, '');
      await compiled.validate('abc', {}, ''); // min boundary
      await compiled.validate('1234567890', {}, ''); // max boundary
    });

    it('should reject string too short', async function() {
      const schema = new Schema('string').validator({length: {min: 3, max: 10}});
      const compiled = resolver.compile(schema);

      await assert.rejects(() => compiled.validate('ab', {}, ''), ValidationError);
    });

    it('should reject string too long', async function() {
      const schema = new Schema('string').validator({length: {min: 3, max: 10}});
      const compiled = resolver.compile(schema);

      await assert.rejects(() => compiled.validate('12345678901', {}, ''), ValidationError);
    });

    it('should validate exact length', async function() {
      const schema = new Schema('string').validator({length: {exact: 5}});
      const compiled = resolver.compile(schema);

      await compiled.validate('hello', {}, '');
      await assert.rejects(() => compiled.validate('hi', {}, ''), ValidationError);
      await assert.rejects(() => compiled.validate('toolong', {}, ''), ValidationError);
    });

    it('should validate min length only', async function() {
      const schema = new Schema('string').validator({length: {min: 3}});
      const compiled = resolver.compile(schema);

      await compiled.validate('abc', {}, '');
      await compiled.validate('verylongstring', {}, '');
      await assert.rejects(() => compiled.validate('ab', {}, ''), ValidationError);
    });

    it('should validate max length only', async function() {
      const schema = new Schema('string').validator({length: {max: 5}});
      const compiled = resolver.compile(schema);

      await compiled.validate('', {}, '');
      await compiled.validate('hello', {}, '');
      await assert.rejects(() => compiled.validate('toolong', {}, ''), ValidationError);
    });
  });

  describe('Array length validation', function() {
    it('should accept array within length range', async function() {
      const schema = new Schema('array').validator({length: {min: 2, max: 5}});
      const compiled = resolver.compile(schema);

      await compiled.validate([1, 2, 3], {}, '');
      await compiled.validate([1, 2], {}, ''); // min boundary
      await compiled.validate([1, 2, 3, 4, 5], {}, ''); // max boundary
    });

    it('should reject array too short', async function() {
      const schema = new Schema('array').validator({length: {min: 2, max: 5}});
      const compiled = resolver.compile(schema);

      await assert.rejects(() => compiled.validate([1], {}, ''), ValidationError);
    });

    it('should reject array too long', async function() {
      const schema = new Schema('array').validator({length: {min: 2, max: 5}});
      const compiled = resolver.compile(schema);

      await assert.rejects(() => compiled.validate([1, 2, 3, 4, 5, 6], {}, ''), ValidationError);
    });

    it('should validate exact array length', async function() {
      const schema = new Schema('array').validator({length: {exact: 3}});
      const compiled = resolver.compile(schema);

      await compiled.validate([1, 2, 3], {}, '');
      await assert.rejects(() => compiled.validate([1, 2], {}, ''), ValidationError);
    });
  });

  describe('Description generation', function() {
    it('should generate description for exact length', function() {
      const schema = new Schema('string').validator({length: {exact: 5}});
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'len=5');
    });

    it('should generate description for range', function() {
      const schema = new Schema('string').validator({length: {min: 3, max: 10}});
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'len=3-10');
    });

    it('should generate description for min only', function() {
      const schema = new Schema('string').validator({length: {min: 3}});
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'len≥3');
    });

    it('should generate description for max only', function() {
      const schema = new Schema('string').validator({length: {max: 10}});
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'len≤10');
    });
  });
});