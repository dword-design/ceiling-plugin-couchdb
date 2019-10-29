import PouchDB from 'pouchdb'
import uuid from 'uuid'
import PouchDBErase from 'pouchdb-erase'
import { map, omit, promiseAll, chunk } from '@functions'

PouchDB.plugin(PouchDBErase)

const chunkSize = 100

const _url = endpoint => {
  if (endpoint.inMemory) {
    return endpoint.database
  }
  let result = `http://${endpoint.user ?? 'root'}:${endpoint.password || 'root'}@${endpoint.host ?? 'localhost'}`
  if ((endpoint.port || 5984) != 80) {
    result += `:${endpoint.port ?? 5984}`
  }
  result += `/${endpoint.database ?? 'project'}`
  return result
}

const _db = endpoint => new PouchDB(_url(endpoint))

const getMigrationDocs = db => db.allDocs({ include_docs: true })
  .then(result => result.rows.map(doc => doc.doc))
  .then(docs => docs.filter(doc => doc.type == '_migration'))

export const sync = async (fromEndpoint, toEndpoint) => {

  const fromUrl = _url(fromEndpoint)
  const toUrl = _url(toEndpoint)
  const fromDb = new PouchDB(fromUrl)
  const toDb = new PouchDB(toUrl)

  await toDb.erase()
  const result = await fromDb.allDocs()
  const ids = result.rows |> map('id') |> await
  const chunkedIds = ids |> chunk(chunkSize) |> await
  await (chunkedIds
    |> map(ids => Promise.resolve()
      .then(() => fromDb.allDocs({ include_docs: true, attachments: true, startkey: ids[0], endkey: ids[ids.length - 1] }))
      .then(result => result.rows.map(row => row.doc |> omit('_rev')))
      .then(docs => toDb.bulkDocs(docs))
    )
    |> promiseAll
  )
}

export const getMigrationParams = endpoint => ({ db: _db(endpoint) })

export const getExecutedMigrations = endpoint => getMigrationDocs(_db(endpoint)).then(docs => docs.map(doc => doc.name))

export const setExecutedMigrations = (endpoint, migrations) => {
  const db = _db(endpoint)
  return getMigrationDocs(db)
    .then(docs => db.bulkDocs([
      ...docs.filter(doc => !migrations.includes(doc.name)).map(doc => ({ ...doc, _deleted: true })),
      ...migrations.filter(name => !docs.some(doc => doc.name == name)).map(name => ({ _id: uuid(), type: '_migration', name }) ),
    ]))
}

export const endpointToString = (endpoint = {}) => {
  if (endpoint.inMemory) {
    return endpoint.database
  }
  let result = `http://${endpoint.host ?? 'localhost'}`
  if ((endpoint.port ?? 5984) !== 80) {
    result += `:${endpoint.port ?? 5984}`
  }
  result += `/${endpoint.database ?? 'project'}`
  return result
}
