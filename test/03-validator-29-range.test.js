
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: range', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value within range', async function() {
    const schema = new Schema('number').validator({range: {min: 1, max: 10}});
    const compiled = resolver.compile(schema);

    await compiled.validate(5, {}, '');
    await compiled.validate(1, {}, ''); // min boundary
    await compiled.validate(10, {}, ''); // max boundary
  });

  it('should reject value below min', async function() {
    const schema = new Schema('number').validator({range: {min: 1, max: 10}});
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate(0, {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate(-5, {}, ''), ValidationError);
  });

  it('should reject value above max', async function() {
    const schema = new Schema('number').validator({range: {min: 1, max: 10}});
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate(11, {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate(100, {}, ''), ValidationError);
  });

  it('should accept value with min only', async function() {
    const schema = new Schema('number').validator({range: {min: 5}});
    const compiled = resolver.compile(schema);

    await compiled.validate(5, {}, '');
    await compiled.validate(100, {}, '');
    await assert.rejects(() => compiled.validate(4, {}, ''), ValidationError);
  });

  it('should accept value with max only', async function() {
    const schema = new Schema('number').validator({range: {max: 10}});
    const compiled = resolver.compile(schema);

    await compiled.validate(10, {}, '');
    await compiled.validate(-100, {}, '');
    await assert.rejects(() => compiled.validate(11, {}, ''), ValidationError);
  });

  it('should reject non-numeric values', async function() {
    const schema = new Schema('string').validator({range: {min: 1, max: 10}});
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc', {}, ''), ValidationError);
  });

  it('should generate description for both bounds', function() {
    const schema = new Schema('number').validator({range: {min: 1, max: 10}});
    const compiled = resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '1-10');
  });

  it('should generate description for min only', function() {
    const schema = new Schema('number').validator({range: {min: 5}});
    const compiled = resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '≥5');
  });

  it('should generate description for max only', function() {
    const schema = new Schema('number').validator({range: {max: 10}});
    const compiled = resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '≤10');
  });
});
