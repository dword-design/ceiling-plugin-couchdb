import withLocalTmpDir from 'with-local-tmp-dir'
import outputFiles from 'output-files'
import execa from 'execa'
import { endent, property, map, omit } from '@dword-design/functions'
import PouchDB from 'pouchdb'
import portfinder from 'portfinder'
import uuid from 'uuid'
import kill from 'tree-kill'
import portReady from 'port-ready'

export default {
  'existing migrations': () => withLocalTmpDir(async () => {

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
      { _id: '1', title: 'task1', body: 'foo' },
      { _id: '2', title: 'task2', body: 'bar' },
      { _id: uuid(), type: '_migration', name: '1' },
    ])
    await execa.command('ceiling migrate -y')

    const docs = new Set(
      local.allDocs({ include_docs: true })
        |> await
        |> property('rows')
        |> map('doc')
        |> map(omit(['_id', '_rev'])),
    )

    expect(docs).toEqual(new Set([
      { title: 'task1', body2: 'foo' },
      { title: 'task2', body2: 'bar' },
      { type: '_migration', name: '1' },
      { type: '_migration', name: '2' },
    ]))

    kill(childProcess.pid)
  }),
  'no existing migrations': () => withLocalTmpDir(async () => {

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
      { _id: '1', title: 'task1', body: 'foo' },
      { _id: '2', title: 'task2', body: 'bar' },
    ])
    await execa.command('ceiling migrate -y')

    const docs = new Set(
      local.allDocs({ include_docs: true })
        |> await
        |> property('rows')
        |> map('doc')
        |> map(omit(['_id', '_rev'])),
    )

    expect(docs).toEqual(new Set([
      { title2: 'task1', body2: 'foo' },
      { title2: 'task2', body2: 'bar' },
      { type: '_migration', name: '1' },
      { type: '_migration', name: '2' },
    ]))
    kill(childProcess.pid)
  }),
}
