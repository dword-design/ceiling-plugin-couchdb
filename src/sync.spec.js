import { endent, map, omit, property, range } from '@dword-design/functions'
import execa from 'execa'
import outputFiles from 'output-files'
import portReady from 'port-ready'
import portfinder from 'portfinder'
import PouchDB from 'pouchdb'
import kill from 'tree-kill-promise'
import withLocalTmpDir from 'with-local-tmp-dir'

export default {
  chunking: () =>
    withLocalTmpDir(async () => {
      const port = portfinder.getPortPromise() |> await
      await outputFiles({
        'ceiling.config.js': endent`
        module.exports = {
          plugins: ['couchdb'],
          endpoints: {
            live: {
              couchdb: { database: 'live', port: ${port} },
            },
            local: {
              couchdb: { database: 'local', port: ${port} },
            },
          },
        }
      `,
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

      const tasks =
        range(250) |> map(index => ({ _id: index.toString().padStart(3, '0') }))

      const childProcess = execa('pouchdb-server', ['--port', port])
      await portReady(port)

      const live = new PouchDB(`http://localhost:${port}/live`)

      const local = new PouchDB(`http://localhost:${port}/local`)
      await live.bulkDocs(tasks)
      await execa.command('ceiling pull -y')

      const docs =
        local.allDocs({ include_docs: true })
        |> await
        |> property('rows')
        |> map('doc')
        |> map(omit('_rev'))
      expect(docs).toEqual(tasks)
      await kill(childProcess.pid)
    }),
  'empty to-database': () =>
    withLocalTmpDir(async () => {
      const port = portfinder.getPortPromise() |> await
      await outputFiles({
        'ceiling.config.js': endent`
        module.exports = {
          plugins: ['couchdb'],
          endpoints: {
            live: {
              couchdb: { database: 'live', port: ${port} },
            },
            local: {
              couchdb: { database: 'local', port: ${port} },
            },
          },
        }
      `,
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

      const tasks = [
        { _id: '1', body: 'foo', title: 'task1' },
        { _id: '2', body: 'bar', title: 'task2' },
      ]

      const childProcess = execa('pouchdb-server', ['--port', port])
      await portReady(port)

      const live = new PouchDB(`http://localhost:${port}/live`)

      const local = new PouchDB(`http://localhost:${port}/local`)
      await live.bulkDocs(tasks)
      await execa.command('ceiling pull -y')

      const docs =
        local.allDocs({ include_docs: true })
        |> await
        |> property('rows')
        |> map('doc')
        |> map(omit('_rev'))
      expect(docs).toEqual(tasks)
      await kill(childProcess.pid)
    }),
  'non-empty to-database': () =>
    withLocalTmpDir(async () => {
      const port = portfinder.getPortPromise() |> await
      await outputFiles({
        'ceiling.config.js': endent`
        module.exports = {
          plugins: ['couchdb'],
          endpoints: {
            live: {
              couchdb: { database: 'live', port: ${port} },
            },
            local: {
              couchdb: { database: 'local', port: ${port} },
            },
          },
        }
      `,
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

      const tasks = [
        { _id: '1', body: 'foo', title: 'task1' },
        { _id: '2', body: 'bar', title: 'task2' },
      ]

      const childProcess = execa('pouchdb-server', ['--port', port])
      await portReady(port)

      const live = new PouchDB(`http://localhost:${port}/live`)

      const local = new PouchDB(`http://localhost:${port}/local`)
      await Promise.all([
        live.bulkDocs(tasks),
        local.bulkDocs([
          { _id: '1', body: 'This is old stuff', title: 'Old stuff' },
          { _id: '2', name: 'mig1', type: '_migration' },
          { _id: '3', name: 'mig2', type: '_migration' },
        ]),
      ])
      await execa.command('ceiling pull -y')

      const docs =
        local.allDocs({ include_docs: true })
        |> await
        |> property('rows')
        |> map('doc')
        |> map(omit('_rev'))
      expect(docs).toEqual(tasks)
      await kill(childProcess.pid)
    }),
}
