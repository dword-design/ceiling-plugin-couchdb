import { filter, invokeArgs, map, property } from '@dword-design/functions'
import PouchDB from 'pouchdb'
import PouchDBErase from 'pouchdb-erase'
import { v4 as uuid } from 'uuid'

import endpointToString from './endpoint-to-string'
import getDatabase from './get-database'
import sync from './sync'

PouchDB.plugin(PouchDBErase)

export default {
  addExecutedMigrations: (endpoint, migrations) => {
    const db = endpoint |> getDatabase
    return (
      migrations
      |> map(name => ({ _id: uuid(), name, type: '_migration' }))
      |> db.bulkDocs
    )
  },
  endpointToString,
  getExecutedMigrations: async endpoint =>
    endpoint
    |> getDatabase
    |> invokeArgs('allDocs', [{ include_docs: true }])
    |> await
    |> property('rows')
    |> map('doc')
    |> filter({ type: '_migration' })
    |> map('name'),
  getMigrationParams: endpoint => ({ db: endpoint |> getDatabase }),
  sync,
}
