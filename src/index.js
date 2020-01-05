import PouchDB from 'pouchdb'
import uuid from 'uuid'
import PouchDBErase from 'pouchdb-erase'
import { map, omit, unary, promiseAll, chunk, property, filter, first, last, invokeArgs } from '@dword-design/functions'

PouchDB.plugin(PouchDBErase)

const chunkSize = 100

export const endpointToString = ({
  database = 'project',
  user = '',
  password = '',
  host = 'localhost',
  port = 5984,
} = {}) => {
  const credentials = user !== '' ? `${user}${password !== '' ? `:${password}` : ''}@` : ''
  return `http://${credentials}${host}${port !== 80 ? `:${port}` : ''}/${database}`
}

const getDatabase = endpoint => new PouchDB(endpoint |> endpointToString)

export const sync = async (from, to) => {

  const fromDb = new PouchDB(from |> endpointToString)
  const toDb = new PouchDB(to |> endpointToString)

  const [, chunksToWrite] = [
    toDb.erase(),
    fromDb.allDocs()
      |> await
      |> property('rows')
      |> map('id')
      |> chunk(chunkSize)
      |> map(async chunkIds =>
        fromDb.allDocs({
          include_docs: true,
          attachments: true,
          startkey: chunkIds |> first,
          endkey: chunkIds |> last,
        })
          |> await
          |> property('rows')
          |> map('doc')
          |> map(omit('_rev')),
      )
      |> promiseAll,
  ]
    |> promiseAll
    |> await
  return chunksToWrite |> map(unary(toDb.bulkDocs)) |> promiseAll
}

export const getMigrationParams = endpoint => ({ db: endpoint |> getDatabase })

export const getExecutedMigrations = async endpoint => endpoint
  |> getDatabase
  |> invokeArgs('allDocs', [{ include_docs: true }])
  |> await
  |> property('rows')
  |> map('doc')
  |> filter({ type: '_migration' })
  |> map('name')

export const addExecutedMigrations = async (endpoint, migrations) => {
  const db = endpoint |> getDatabase
  return migrations
    |> map(name => ({ _id: uuid(), type: '_migration', name }))
    |> db.bulkDocs
}
