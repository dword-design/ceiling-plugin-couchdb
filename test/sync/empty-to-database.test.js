import withLocalTmpDir from 'with-local-tmp-dir'
import outputFiles from 'output-files'
import { spawn } from 'child-process-promise'
import expect from 'expect'
import { endent, property, map, omit } from '@dword-design/functions'
import PouchDB from 'pouchdb'
import portfinder from 'portfinder'
import delay from 'delay'

export default () => withLocalTmpDir(__dirname, async () => {

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

  const childProcess = spawn('pouchdb-server', ['--port', port])
    .catch(error => {
      if (error.code !== null) {
        throw error
      }
    })
    .childProcess

  await delay(4000)
  const live = new PouchDB(`http://localhost:${port}/live`)
  const local = new PouchDB(`http://localhost:${port}/local`)

  await live.bulkDocs(tasks)
  await spawn('ceiling', ['pull', '-y'])

  const docs = local.allDocs({ include_docs: true })
    |> await
    |> property('rows')
    |> map('doc')
    |> map(omit('_rev'))

  expect(docs).toEqual(tasks)
  childProcess.kill()
})
