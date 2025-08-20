import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ValidatorRegistry } from '../src/validator-registry.js';
import { TypeRegistry } from '../src/type-registry.js';
import { Configurator } from '../src/index.js';

describe('ConfigurationSchema - Type Conversion', function() {
  let schema;
  let configurator;

  beforeEach(function() {
    schema = new ConfigurationSchema();
    configurator = new Configurator({schema})
  });

  describe('String type', function() {
    beforeEach(function() {
      schema.field('stringField', { type: 'string' });
    });

    it('should keep string values as strings', async function() {
      const result = await configurator.validate({ stringField: 'test' });
      assert.equal(result.stringField, 'test');
    });

    it('should convert number to string', async function() {
      const result = await configurator.validate({ stringField: 42 });
      assert.equal(result.stringField, '42');
    });

    it('should convert boolean to string', async function() {
      const result = await configurator.validate({ stringField: true });
      assert.equal(result.stringField, 'true');
    });

    it('should convert null to string', async function() {
      const result = await configurator.validate({ stringField: null });
      assert.equal(result.stringField, 'null');
    });
  });

  describe('Number type', function() {
    beforeEach(function() {
      schema.field('numberField', { type: 'number' });
    });

    it('should keep number values as numbers', async function() {
      const result = await configurator.validate({ numberField: 42 });
      assert.equal(result.numberField, 42);
    });

    it('should convert string to number', async function() {
      const result = await configurator.validate({ numberField: '42' });
      assert.equal(result.numberField, 42);
    });

    it('should throw for invalid number string', async function() {
      await assert.rejects(async () => {
        await configurator.validate({ numberField: 'not-a-number' });
      }, /Invalid number/);
    });

    it('should convert boolean to number', async function() {
      const result = await configurator.validate({ numberField: true });
      assert.equal(result.numberField, 1);

      const result2 = await configurator.validate({ numberField: false });
      assert.equal(result2.numberField, 0);
    });
  });

  describe('Boolean type', function() {
    beforeEach(function() {
      schema.field('boolField', { type: 'boolean' });
    });

    it('should keep boolean values as booleans', async function() {
      const result = await configurator.validate({ boolField: true });
      assert.equal(result.boolField, true);

      const result2 = await configurator.validate({ boolField: false });
      assert.equal(result2.boolField, false);
    });

    it('should convert truthy string values to true', async function() {
      const result1 = await configurator.validate({ boolField: 'true' });
      assert.equal(result1.boolField, true);

      const result2 = await configurator.validate({ boolField: 'yes' });
      assert.equal(result2.boolField, true);

      const result3 = await configurator.validate({ boolField: '1' });
      assert.equal(result3.boolField, true);
    });

    it('should convert falsy string values to false', async function() {
      const result1 = await configurator.validate({ boolField: 'false' });
      assert.equal(result1.boolField, false);

      const result2 = await configurator.validate({ boolField: 'no' });
      assert.equal(result2.boolField, false);

      const result3 = await configurator.validate({ boolField: '0' });
      assert.equal(result3.boolField, false);
    });

    it('should convert non-boolean string values based on truthiness', async function() {
      const result = await configurator.validate({ boolField: 'something' });
      assert.equal(result.boolField, true);

      const result2 = await configurator.validate({ boolField: '' });
      assert.equal(result2.boolField, false);
    });

    it('should convert numbers to booleans', async function() {
      const result1 = await configurator.validate({ boolField: 1 });
      assert.equal(result1.boolField, true);

      const result2 = await configurator.validate({ boolField: 0 });
      assert.equal(result2.boolField, false);
    });
  });

  describe('Array type', function() {
    beforeEach(function() {
      schema.field('arrayField', { type: 'array' });
    });

    it('should keep array values as arrays', async function() {
      const value = [1, 2, 3];
      const result = await configurator.validate({ arrayField: value });
      assert.deepEqual(result.arrayField, value);
    });

    it('should convert comma-separated string to array', async function() {
      const result = await configurator.validate({ arrayField: 'one,two,three' });
      assert.deepEqual(result.arrayField, ['one', 'two', 'three']);
    });

    it('should trim whitespace in comma-separated values', async function() {
      const result = await configurator.validate({ arrayField: 'one, two, three' });
      assert.deepEqual(result.arrayField, ['one', 'two', 'three']);
    });

    it('should filter out empty values', async function() {
      const result = await configurator.validate({ arrayField: 'one,,three' });
      assert.deepEqual(result.arrayField, ['one', 'three']);
    });

    it('should convert single values to array', async function() {
      const result = await configurator.validate({ arrayField: 'single' });
      assert.deepEqual(result.arrayField, ['single']);

      const result2 = await configurator.validate({ arrayField: 42 });
      assert.deepEqual(result2.arrayField, [42]);
    });
  });

  describe('Typed Arrays', function() {
    beforeEach(function() {
      schema.field('typedArrayField', { type: '[number]' });
    });

    it('should keep array values as arrays', async function() {
      const value = [1, 2, 3];

      const result = await configurator.validate({ typedArrayField: value });
      assert.deepEqual(result.typedArrayField, value);
    })
    it('should convert single values to array', async function() {
      const result = await configurator.validate({ typedArrayField: 123 });
      assert.deepEqual(result.typedArrayField, [123]);
    });
  })

      describe('Date type', function() {
    beforeEach(function() {
      schema.field('dateField', { type: 'date' });
    });

    it('should convert ISO string to timestamp', async function() {
      const isoString = '2023-01-15T12:30:45.000Z';
      const expected = new Date(isoString).getTime();
      const result = await configurator.validate({ dateField: isoString });
      assert.equal(result.dateField, expected);
    });

    it('should convert numeric timestamp to timestamp', async function() {
      const timestamp = 1673789445000; // 2023-01-15T12:30:45.000Z
      const result = await configurator.validate({ dateField: timestamp });
      assert.equal(result.dateField, timestamp);
    });

    it('should convert "now" to current timestamp', async function() {
      const before = Date.now();
      const result = await configurator.validate({ dateField: 'now' });
      const after = Date.now();
      assert.ok(result.dateField >= before);
      assert.ok(result.dateField <= after);
    });

    it('should throw for invalid date string', async function() {
      await assert.rejects(async () => {
        await configurator.validate({ dateField: 'not-a-date' });
      }, /Invalid timestamp value/);
    });
      });

  describe('Unknown type', function() {
    beforeEach(function() {
      schema.field('unknownField', { type: 'unknown-type' });
    });

    it('should throw error for unknown type', async function() {
      await assert.rejects(async () => {
        await configurator.validate({unknownField: 'any-value'}, {strict: true});
      }, {
        message: /Unknown type/
      });
    });
  });

  describe('Buffer type', function() {
    beforeEach(function() {
      schema.field('bufferField', { type: 'buffer' });
    });

    it('should convert base64 string to Buffer', async function() {
      const base64 = 'SGVsbG8gV29ybGQ='; // 'Hello World'
      const expected = Buffer.from('Hello World');
      const result = await configurator.validate({ bufferField: base64 });
      assert.ok(Buffer.isBuffer(result.bufferField));
      assert.ok(result.bufferField.equals(expected));
    });

    it('should handle array input to Buffer', async function() {
      const input = [72, 101, 108, 108, 111]; // 'Hello'
      const expected = Buffer.from('Hello');
      const result = await configurator.validate({ bufferField: input });
      assert.ok(Buffer.isBuffer(result.bufferField));
      assert.ok(result.bufferField.equals(expected));
    });

    it('should format Buffer as base64 string', function() {
      const buffer = Buffer.from('Test Buffer');
      const types = new TypeRegistry();
      const formatted = types.formatTypeValue('buffer', buffer);
      assert.equal(formatted, 'VGVzdCBCdWZmZXI=');
    });

    it('should throw for invalid buffer input', async function() {
      await assert.rejects(async () => {
        // Using an object that can't be properly converted to buffer
        await configurator.validate({ bufferField: { invalid: 'object' } });
      }, /Invalid buffer value/);
    });
  });
});
