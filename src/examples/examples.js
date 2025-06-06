import process from 'node:process';
import { Configurator } from '../configurator.js';

const configurator = new Configurator('myapp');

configurator.schema
            .field('debug', {type: 'boolean'})
            .field('cluster', {required: true})
            .field('etcd', {validator: '$url'})

configurator.schema.child('web')
            .field('hostname', {validator: {$and: ['$hostname', /.+example\.com$/]}})
            .field('port', {type: 'number', validator: '$port'})

configurator.schema.child('catalog')
            .field('path', {flagHint: 'P', validator: '$existingdir'})
            .field('rating', {type: 'number', validator: '$integer'})

configurator.schema.child('user-web-storage', {category: 'user-storage'})
            .field('url', {type: 'string', validator: '$url'})
            .field('username', {type: 'string', validator: '$alphanum'})
            .field('password', {type: 'string', validator: '$alphanum'})

configurator.schema.child('user-local-storage', {category: 'user-storage'})
            .field('path', {validator: '$existingdir'})
            .field('quota', {type: 'number', validator: '$integer'})


let contexts = [
  {
    argv: [
      '--cluster', 'live',
      '--etcd', 'http://192.168.1.1:2379/',
      '--web-hostname', 'www.example.com',
      '--wp', 3000,
      '-P', '/tmp'
    ]
  },
  {
    argv: [
      '--etcd', 'http://192.168.1.1:2379/',
      '--web-hostname', 'www.example.com',
      '--wp', 3000,
      '-P', '/tmp'
    ]
  },
  {
    sys: {
      'web': {
        'port': 4000
      },
      'catalog': {
        'rating': 3
      }
    },
    env: {
      'MYAPP_ETCD': 'http://192.168.1.1:2379/',
      'MYAPP_WEB_PORT': 3000,
      'MYAPP_PATH': '/fake'
    },
    argv: [
      '--cluster', 'live',
      '--web-hostname', 'www.example.com',
      '-P', '/tmp'
    ]
  },
  {
    sys: {
      userLocalStorage: { // none of these should exist in the output as settings in argv will override the exclusive category
        storagePath: '/tmp',
        quota: 10000
      }
    },
    env: {
      MYAPP_CLUSTER: 'live'
    },
    argv: [
      '--user-web-storage-url', 'http://192.168.1.1:2379/',
      '--user-web-storage-username', 'user123',
      '--user-web-storage-password', 'password123456'
    ]
  },
  {
    sys: {
      userLocalStorage: {
        storagePath: '/tmp/foo',
        quota: 5000
      }
    },
    env: {
      MYAPP_CLUSTER: 'live'
    },
    argv: [ // this should throw; multiple settings in same exclusive category within a single source
      '--user-local-storage-path', '/tmp',
      '--user-local-storage-quota', 10000,
      '--user-web-storage-url', 'http://192.168.1.1:2379/',
      '--user-web-storage-username', 'user123',
      '--user-web-storage-password', 'password123456'
    ]
  }


]


for (let context of contexts) {
  try {
    console.log(`testing argv: ${context.argv.join(' ')}`)
    let config = await configurator.configure(context)

    console.log(`configuration yielded\n${JSON.stringify(config, null, 2 )}`)
  }
  catch (err) {
    console.error(`configuration error: ${err.message}`, err)
  }
  console.log('----');
}


