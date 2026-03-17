
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: ipv4', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Valid IPv4 addresses', function() {
    it('should accept standard IPv4', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('192.168.1.1');
      assert.strictEqual(result, '192.168.1.1');
    });

    it('should accept all zeros', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('0.0.0.0');
      assert.strictEqual(result, '0.0.0.0');
    });

    it('should accept broadcast address', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('255.255.255.255');
      assert.strictEqual(result, '255.255.255.255');
    });

    it('should accept localhost', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('127.0.0.1');
      assert.strictEqual(result, '127.0.0.1');
    });

    it('should accept private network addresses', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await compiled.validateValue('10.0.0.1');
      await compiled.validateValue('172.16.0.1');
      await compiled.validateValue('192.168.0.1');
    });
  });

  describe('Invalid IPv4 addresses', function() {
    it('should reject octet over 255', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('256.1.1.1'),
        ValidationError
      );
    });

    it('should reject negative octet', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('-1.1.1.1'),
        ValidationError
      );
    });

    it('should reject too few octets', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('192.168.1'),
        ValidationError
      );
    });

    it('should reject too many octets', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('192.168.1.1.1'),
        ValidationError
      );
    });

    it('should reject letters', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('192.168.a.1'),
        ValidationError
      );
    });

    it('should reject empty string', async function() {
      const schema = new Schema('string').validator('$ipv4');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue(''),
        ValidationError
      );
    });
  });
});