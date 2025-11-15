
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: port', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept valid port numbers and return number', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('8080', {}, '');
    assert.strictEqual(result, 8080);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept port 1', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('1', {}, '');
    assert.strictEqual(result, 1);
  });

  it('should accept port 65535', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('65535', {}, '');
    assert.strictEqual(result, 65535);
  });

  it('should accept common ports', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await compiled.validate('80', {}, ''); // HTTP
    await compiled.validate('443', {}, ''); // HTTPS
    await compiled.validate('22', {}, ''); // SSH
    await compiled.validate('3306', {}, ''); // MySQL
  });

  it('should reject port 0', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('0', {}, ''), ValidationError);
  });

  it('should reject port above 65535', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('65536', {}, ''), ValidationError);
  });

  it('should reject negative port', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('-1', {}, ''), ValidationError);
  });

  it('should reject decimal port', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('80.5', {}, ''), ValidationError);
  });

  it('should reject non-numeric port', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('http', {}, ''), ValidationError);
  });
});