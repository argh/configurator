// example for docs

import { Schema, SchemaResolver } from '../src/index.js';

class Thing {
  stuff = new Map()
}

const srcSchema = new Schema('object')
  .transformer((_) => new Thing())
  .property('stuff',
    new Schema('object')
      .opaque()
      .transformer(items => {
        return new Map(Object.entries(items));
      })
      .property('*', new Schema())
  );

const resolver = new SchemaResolver();
const compiledSchema = await resolver.compile(srcSchema);

const input = {stuff: {a: 1, b: 2}};
const result = await compiledSchema.process(input);

if (result?.stuff?.get('a') === input.stuff.a && result?.stuff?.get('b') === input.stuff.b) {
  console.log('ok!');
}
else {
  console.error('oops!');
  throw new Error('something went wrong!')
}
