import { endent, map, omit, property } from '@dword-design/functions'
import execa from 'execa'
import outputFiles from 'output-files'
import portReady from 'port-ready'
import portfinder from 'portfinder'
import PouchDB from 'pouchdb'
import kill from 'tree-kill-promise'
import { v4 as uuid } from 'uuid'
import withLocalTmpDir from 'with-local-tmp-dir'

export default {
  'existing migrations': () =>
    withLocalTmpDir(async () => {
      const port = portfinder.getPortPromise() |> await
      await outputFiles({
        'ceiling.config.js': endent`
        module.exports = {
          plugins: ['couchdb'],
          endpoints: {
            local: {
              couchdb: { database: 'local', port: ${port} },
            },
          },
        }
      `,
        'migrations/couchdb': {
          '1.js': endent`
          import { map, omit, property } from '@dword-design/functions'

          export default {
            up: async ({ db }) => db.allDocs({ include_docs: true })
              |> await
              |> property('rows')
              |> map('doc')
              |> map(doc => ({ ...doc, title2: doc.title }))
              |> map(omit('title'))
              |> db.bulkDocs,
          }
        `,
          '2.js': endent`
          import { map, omit, property } from '@dword-design/functions'

          export default {
            up: async ({ db }) => db.allDocs({ include_docs: true })
              |> await
              |> property('rows')
              |> map('doc')
              |> map(doc => ({ ...doc, body2: doc.body }))
              |> map(omit('body'))
              |> db.bulkDocs,
          }
        `,
        },
        'node_modules/ceiling-plugin-couchdb/index.js':
          "module.exports = require('../../../src')",
        'package.json': endent`
        {
          "devDependencies": {
            "ceiling-plugin-couchdb": "^1.0.0"
          }
        }
      `,
      })
      const childProcess = execa('pouchdb-server', ['--port', port])
      await portReady(port)
      const local = new PouchDB(`http://localhost:${port}/local`)
      await local.bulkDocs([
        { _id: '1', body: 'foo', title: 'task1' },
        { _id: '2', body: 'bar', title: 'task2' },
        { _id: uuid(), name: '1', type: '_migration' },
      ])
      await execa.command('ceiling migrate -y')
      const docs = new Set(
        local.allDocs({ include_docs: true })
          |> await
          |> property('rows')
          |> map('doc')
          |> map(omit(['_id', '_rev']))
      )
      expect(docs).toEqual(
        new Set([
          { body2: 'foo', title: 'task1' },
          { body2: 'bar', title: 'task2' },
          { name: '1', type: '_migration' },
          { name: '2', type: '_migration' },
        ])
      )
      await kill(childProcess.pid)
    }),
  'no existing migrations': () =>
    withLocalTmpDir(async () => {
      const port = portfinder.getPortPromise() |> await
      await outputFiles({
        'ceiling.config.js': endent`
        module.exports = {
          plugins: ['couchdb'],
          endpoints: {
            local: {
              couchdb: { database: 'local', port: ${port} },
            },
          },
        }
      `,
        'migrations/couchdb': {
          '1.js': endent`
          import { map, omit, property } from '@dword-design/functions'

          export default {
            up: async ({ db }) => db.allDocs({ include_docs: true })
              |> await
              |> property('rows')
              |> map('doc')
              |> map(doc => ({ ...doc, title2: doc.title }))
              |> map(omit('title'))
              |> db.bulkDocs,
          }
        `,
          '2.js': endent`
          import { map, omit, property } from '@dword-design/functions'

          export default {
            up: async ({ db }) => db.allDocs({ include_docs: true })
              |> await
              |> property('rows')
              |> map('doc')
              |> map(doc => ({ ...doc, body2: doc.body }))
              |> map(omit('body'))
              |> db.bulkDocs,
          }
        `,
        },
        'node_modules/ceiling-plugin-couchdb/index.js':
          "module.exports = require('../../../src')",
        'package.json': endent`
        {
          "devDependencies": {
            "ceiling-plugin-couchdb": "^1.0.0"
          }
        }
      `,
      })
      const childProcess = execa('pouchdb-server', ['--port', port])
      await portReady(port)
      const local = new PouchDB(`http://localhost:${port}/local`)
      await local.bulkDocs([
        { _id: '1', body: 'foo', title: 'task1' },
        { _id: '2', body: 'bar', title: 'task2' },
      ])
      await execa.command('ceiling migrate -y')
      const docs = new Set(
        local.allDocs({ include_docs: true })
          |> await
          |> property('rows')
          |> map('doc')
          |> map(omit(['_id', '_rev']))
      )
      expect(docs).toEqual(
        new Set([
          { body2: 'foo', title2: 'task1' },
          { body2: 'bar', title2: 'task2' },
          { name: '1', type: '_migration' },
          { name: '2', type: '_migration' },
        ])
      )
      await kill(childProcess.pid)
    }),
}
