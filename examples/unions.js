import { Configurator, ConfiguratorError, Schema, SchemaResolver } from '../src/index.js';
import { toHeadline } from '../src/utils.js';

const appName = 'cheese';

const schema = new Schema();

// This example demonstrates a variety of ways you might use unions.

// Here's a database of cheese info we'll use for each example.

const cheeses = [
  { name: 'Camembert', milk: 'cow', texture: 'soft', aged: false, holes: false, blue: false, rind: 'bloomy', stinkLevel: 5 },
  { name: 'Brie', milk: 'cow', texture: 'soft', aged: false, holes: false, blue: false, rind: 'bloomy', stinkLevel: 4 },
  { name: 'Époisses', milk: 'cow', texture: 'soft', aged: false, holes: false, blue: false, rind: 'washed', stinkLevel: 9 },
  { name: 'Gouda', milk: 'cow', texture: 'semi-hard', aged: true, holes: false, blue: false, rind: 'natural', stinkLevel: 2 },
  { name: 'Cheddar', milk: 'cow', texture: 'hard', aged: true, holes: false, blue: false, rind: 'none', stinkLevel: 2 },
  { name: 'Gruyère', milk: 'cow', texture: 'hard', aged: true, holes: true, blue: false, rind: 'natural', stinkLevel: 3 },
  { name: 'Emmental', milk: 'cow', texture: 'hard', aged: true, holes: true, blue: false, rind: 'natural', stinkLevel: 2 },
  { name: 'Gorgonzola', milk: 'cow', texture: 'crumbly', aged: true, holes: false, blue: true, rind: 'none', stinkLevel: 6 },
  { name: 'Stilton', milk: 'cow', texture: 'crumbly', aged: true, holes: false, blue: true, rind: 'natural', stinkLevel: 6 },

  { name: 'Roquefort', milk: 'sheep', texture: 'crumbly', aged: true, holes: false, blue: true, rind: 'none', stinkLevel: 7 },
  { name: 'Feta', milk: 'sheep', texture: 'crumbly', aged: false, holes: false, blue: false, rind: 'none', stinkLevel: 3 },
  { name: 'Manchego', milk: 'sheep', texture: 'hard', aged: true, holes: false, blue: false, rind: 'natural', stinkLevel: 2 },

  { name: 'Mozzarella', milk: 'buffalo', texture: 'soft', aged: false, holes: false, blue: false, rind: 'none', stinkLevel: 1 },
  { name: 'Chèvre', milk: 'goat', texture: 'soft', aged: false, holes: false, blue: false, rind: 'none', stinkLevel: 4 },
];

/**
 * sanitize - lower case and remove accents
 * @param {string|undefined} s
 * @returns {string}
 */
function sanitize(s) {
  return s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '_invalid_';
}

// For comparison, let's make a property that only holds an object from the cheese database.
const schemaZero = new Schema('object')
  .meta('hidden', true)
  .meta('flagHint', 'Z')
  .values(Object.values(cheeses));

schema.property('test0', schemaZero.default(cheeses[4]));


// Approach #1 - Define a union discriminator function that checks a specified property for the unionSchema key.
// We'll look up a cheese by name, and then transform it into a particular cheese data entry.
//
// - Using a union is admittedly overkill for this example; when union elements all have the
//   same shape, it's a lot simpler to use a single schema.
// - We set the "lax" flag (an alias for strict = false) so that the transformed "cheese"
//   instance doesn't trigger validation errors due to the existence of unexpected
//   (non-schema-defined) cheese data fields.
// - We are normalizing the cheese name so that it can be specified without accents or capital letters.  Values are
//   always passed through "normalize".
// - Observe that we are using "constant" transformers that ignore their input and always just returns their definition.
//   This is a little funky, but we know it's safe because the transform only runs if the discriminator
//   successfully resolved the union to the matching schema.  This also allows us to ensure that the value of
//   "name" in the output is the original from the data, not the "sanitized" version.

const unionSchemaOne = new Schema('object')
  .property('name', new Schema('string')
    .normalizer(sanitize)
    .values(Object.values(cheeses).map(c => c.name))
  )
  .unionDiscriminator((value, _, schema) => schema.unionSchemas[sanitize(value.name)]);

for (const cheese of cheeses) {
  unionSchemaOne
    .lax()
    .unionSchema(sanitize(cheese.name),
      new Schema('object')
        .property('name', new Schema('string').transformer(cheese.name))
        .transformer(cheese)
        .serializer(cheese.name)
    );
}
schema.property('test1', unionSchemaOne);


// Approach #2 - Basically the same as Approach #1, but uses a convenience capability of the unionDiscriminator
// setting that when provided the string name of a property, it will synthesize a discriminator function that is
// basically exactly like the one we wrote manually in Approach #1 (it normalizes the values of the unionSchema keys
// using the discriminator property normalizer).
//
// - Observe the use of Schema.literal().  This is just syntactic sugar for constructing a schema
//   with that always transforms to the original input and has a default that matches it.  We need to add
//   a normalizer in order to accept sanitized assignments.

const unionSchemaTwo = new Schema('object')
  .property('name', new Schema('string')
    .normalizer(sanitize)
    .values(Object.values(cheeses).map(c => c.name))
  )
  .unionDiscriminator('name')

for (const cheese of cheeses) {
  unionSchemaTwo
    .lax()
    .unionSchema(cheese.name,
      new Schema('object')
        .property('name', Schema.literal(cheese.name).normalizer(sanitize))
        .transformer(cheese)
        .serializer(cheese.name)
    )
}
schema.property('test2', unionSchemaTwo);

// Approach #3 - Even simpler!  The unionSchemas are inspected to see if they all 1) share a common property,
// and 2) the allowed values for this property in each schema are unique.  If so, the common property is "hoisted"
// to the union itself (and the union's property values are the union of all legal element values).
// A discriminator is synthesized that matches assignments to the common property to the schema with the matching value.

const unionSchemaThree = new Schema('object')

for (const cheese of cheeses) {
  unionSchemaThree
    .lax()
    .unionSchema(cheese.name,
      new Schema('object')
        .property('name', Schema.literal(cheese.name).normalizer(sanitize))
        .transformer(cheese)
        .serializer(cheese.name)
    )
}
schema.property('test3', unionSchemaThree);

// Approach #4 - Full auto mode.  Automatic discovery actually can handle any number of common properties, as long
// as there is some permutation of properties that uniquely identify it!
//
// We no longer need to set the "lax" flag because all cheese properties exist in the schema now.
//


const unionCheeseSchema = new Schema('object');
for (const cheese of cheeses) {
  unionCheeseSchema.unionSchema(cheese.name,
    new Schema('object')
      .property('name', Schema.literal(cheese.name).normalizer(sanitize))
      .property('milk', Schema.literal(cheese.milk))
      .property('texture', Schema.literal(cheese.texture))
      .property('aged', Schema.literal(cheese.aged))
      .property('holes', Schema.literal(cheese.holes))
      .property('blue', Schema.literal(cheese.blue))
      .property('rind', Schema.literal(cheese.rind))
      .property('stinkLevel', Schema.literal(cheese.stinkLevel))
  )
}
//unionCheeseSchema.values(cheeses);
schema.property('cheese', unionCheeseSchema);

// Command line is hard-coded below, edit/remove for experimentation.
//
// You can try the first three tests via the command-line with settings like:
// --test1-name brie or --t2n cheddar
//
// The final "fun" case is defined in the config as "cheese".  This property name
// matches the appName, so to be friendly, the command line moves these options to the top level.
//
// Some combinations to try:
// --name brie                     -> brie (obviously)
// --milk buffalo                  -> mozzarella
// --stink-level 1                 -> also mozzarella
// -s 9                            -> epoisses
// --milk buffalo --texture hard   -> conflict, can't resolve (nothing matches)
// --milk cow --texture hard       -> ambiguous, can't resolve (multiple matches)
// -b false -t crumbly             -> feta
// -m sheep -t crumbly -a          -> roquefort
// -b -r none -m cow               -> gorgonzola

import {stringify} from '../src/schema/helpers/stringify.js';
try {
  const configuration = await new Configurator({schema})
    .configure({
      appName,
//      overrides: {test0: cheeses[2]},
      argv: ['--t1n=brie', '--t2n', 'feta', '--test3-name=cheddar', '-t', 'crumbly', '-ab', '-r=natural']  // some defaults for package testing
    });
  //console.log(stringify(configuration, null, 2));
  console.log(stringify(configuration, {space: 2}));
}
catch (error) {
  if (error instanceof ConfiguratorError) {
    console.error(error?.cause ? `${error.message} (${error.cause.message})` : `${error.message}`)
  }
  else {
    console.error(error);
  }
  console.error(`Specify --help to see all options.`)
}

