
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: ipv6', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept full IPv6 address', async function() {
    const schema = new Schema('string').validator('$ipv6');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('2001:0db8:0000:0000:0000:ff00:0042:8329', {}, '');
    assert.strictEqual(result, '2001:0db8:0000:0000:0000:ff00:0042:8329');
  });

  it('should accept compressed IPv6', async function() {
    const schema = new Schema('string').validator('$ipv6');
    const compiled = await resolver.compile(schema);

    await compiled.validate('2001:db8::ff00:42:8329', {}, '');
    await compiled.validate('::1', {}, ''); // localhost
    await compiled.validate('::', {}, ''); // all zeros
  });

  it('should accept IPv6 with IPv4 suffix', async function() {
    const schema = new Schema('string').validator('$ipv6');
    const compiled = await resolver.compile(schema);

    await compiled.validate('::ffff:192.0.2.1', {}, '');
  });

  it('should reject invalid IPv6', async function() {
    const schema = new Schema('string').validator('$ipv6');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('gggg::1', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('12345::1', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('', {}, ''), ValidationError);
  });
});