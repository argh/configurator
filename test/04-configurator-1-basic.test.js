import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ObjectSource } from '../src/configuration-sources/object-source.js';

describe('Configurator - Basic', function() {
  let configurator;

  beforeEach(function() {
    configurator = new Configurator('TestApp');
  });

  describe('#constructor', function() {
    it('should create a configurator with default options', function() {
      assert.equal(configurator.appName, 'TEST_APP');
      assert.ok(configurator.schema instanceof ConfigurationSchema);
      assert.equal(configurator.sources.length, 3); // Default sources
    });

    it('should create a configurator with custom options', function() {
      const schema = new ConfigurationSchema();
      const sources = [new ObjectSource()];
      const customConfigurator = new Configurator('CustomApp', {
        schema,
        sources
      });

      assert.equal(customConfigurator.appName, 'CustomApp');
      assert.strictEqual(customConfigurator.schema, schema);
      assert.strictEqual(customConfigurator.sources, sources);
    });
  });

  describe('#registerConfigurationSource', function() {
    it('should add a configuration source', function() {
      const initialLength = configurator.sources.length;
      const newSource = new ObjectSource();

      configurator.registerConfigurationSource(newSource);

      assert.equal(configurator.sources.length, initialLength + 1);
      assert.strictEqual(configurator.sources[configurator.sources.length - 1], newSource);
    });
  });
});
