
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

    const result = await compiled.validateValue('8080');
    assert.strictEqual(result, 8080);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept port 1', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('1');
    assert.strictEqual(result, 1);
  });

  it('should accept port 65535', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('65535');
    assert.strictEqual(result, 65535);
  });

  it('should accept common ports', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('80'); // HTTP
    await compiled.validateValue('443'); // HTTPS
    await compiled.validateValue('22'); // SSH
    await compiled.validateValue('3306'); // MySQL
  });

  it('should reject port 0', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('0'), ValidationError);
  });

  it('should reject port above 65535', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('65536'), ValidationError);
  });

  it('should reject negative port', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('-1'), ValidationError);
  });

  it('should reject decimal port', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('80.5'), ValidationError);
  });

  it('should reject non-numeric port', async function() {
    const schema = new Schema('string').validator('$port');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('http'), ValidationError);
  });
});