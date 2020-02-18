import withLocalTmpDir from 'with-local-tmp-dir'
import outputFiles from 'output-files'
import execa from 'execa'
import { endent, property, map, omit, range } from '@dword-design/functions'
import PouchDB from 'pouchdb'
import portfinder from 'portfinder'
import portReady from 'port-ready'
import kill from 'tree-kill'

export default {
  chunking: () => withLocalTmpDir(async () => {

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
      'package.json': endent`
        {
          "devDependencies": {
            "ceiling-plugin-couchdb": "^1.0.0"
          }
        }
      `,
    })

    const tasks = range(250) |> map(index => ({ _id: index.toString().padStart(3, '0') }))

    const childProcess = execa('pouchdb-server', ['--port', port])

    await portReady(port)
    const live = new PouchDB(`http://localhost:${port}/live`)
    const local = new PouchDB(`http://localhost:${port}/local`)

    await live.bulkDocs(tasks)
    await execa.command('ceiling pull -y')

    const docs = local.allDocs({ include_docs: true })
      |> await
      |> property('rows')
      |> map('doc')
      |> map(omit('_rev'))

    expect(docs).toEqual(tasks)
    kill(childProcess.pid)
  }),
  'empty to-database': () => withLocalTmpDir(async () => {

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
      'package.json': endent`
        {
          "devDependencies": {
            "ceiling-plugin-couchdb": "^1.0.0"
          }
        }
      `,
    })

    const tasks = [
      { _id: '1', title: 'task1', body: 'foo' },
      { _id: '2', title: 'task2', body: 'bar' },
    ]

    const childProcess = execa('pouchdb-server', ['--port', port])

    await portReady(port)
    const live = new PouchDB(`http://localhost:${port}/live`)
    const local = new PouchDB(`http://localhost:${port}/local`)

    await live.bulkDocs(tasks)
    await execa.command('ceiling pull -y')

    const docs = local.allDocs({ include_docs: true })
      |> await
      |> property('rows')
      |> map('doc')
      |> map(omit('_rev'))

    expect(docs).toEqual(tasks)
    kill(childProcess.pid)
  }),
  'non-empty to-database': () => withLocalTmpDir(__dirname, async () => {

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
      'package.json': endent`
        {
          "devDependencies": {
            "ceiling-plugin-couchdb": "^1.0.0"
          }
        }
      `,
    })

    const tasks = [
      { _id: '1', title: 'task1', body: 'foo' },
      { _id: '2', title: 'task2', body: 'bar' },
    ]

    const childProcess = execa('pouchdb-server', ['--port', port])

    await portReady(port)
    const live = new PouchDB(`http://localhost:${port}/live`)
    const local = new PouchDB(`http://localhost:${port}/local`)

    await Promise.all([
      live.bulkDocs(tasks),
      local.bulkDocs([
        { _id: '1', title: 'Old stuff', body: 'This is old stuff' },
        { _id: '2', type: '_migration', name: 'mig1' },
        { _id: '3', type: '_migration', name: 'mig2' },
      ]),
    ])

    await execa.command('ceiling pull -y')

    const docs = local.allDocs({ include_docs: true })
      |> await
      |> property('rows')
      |> map('doc')
      |> map(omit('_rev'))

    expect(docs).toEqual(tasks)
    kill(childProcess.pid)
  }),
}
