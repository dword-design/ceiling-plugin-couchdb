const PouchDB = require('pouchdb')
const uuid = require('uuid')

PouchDB.plugin(require('pouchdb-erase'))

const chunkSize = 100

function _url(endpoint) {
  if (endpoint.inMemory) {
    return endpoint.database
  }
  var result = `http://${endpoint.user || 'root'}:${endpoint.password || 'root'}@${endpoint.host || 'localhost'}`
  if ((endpoint.port || 5984) != 80) {
    result += `:${endpoint.port || 5984}`;
  }
  result += `/${endpoint.database || 'project'}`
  return result
}

function _db(endpoint) {
  return new PouchDB(_url(endpoint))
}

function getMigrationDocs(db) {
  return db.allDocs({ include_docs: true })
    .then(result => result.rows.map(doc => doc.doc))
    .then(docs => docs.filter(doc => doc.type == '_migration'))
}

module.exports = {

  sync(fromEndpoint, toEndpoint) {

    const fromUrl = _url(fromEndpoint)
    const toUrl = _url(toEndpoint)
    const fromDb = new PouchDB(fromUrl)
    const toDb = new PouchDB(toUrl)

    return toDb.erase()
      .then(() => fromDb.allDocs())
      .then(result => _.map(result.rows, 'id'))
      .then(ids => _.chunk(ids, chunkSize))
      .then(chunkedIds => Promise.all(_.map(
        chunkedIds,
        ids => Promise.resolve()
          .then(() => fromDb.allDocs({ include_docs: true, attachments: true, startkey: ids[0], endkey: ids[ids.length - 1] }))
          .then(result => result.rows.map(row => _.omit(row.doc, '_rev')))
          .then(docs => toDb.bulkDocs(docs))
      )))
  },

  getMigrationParams(endpoint) {
    return { db: _db(endpoint) }
  },

  getExecutedMigrations(endpoint) {
    return getMigrationDocs(_db(endpoint))
      .then(docs => docs.map(doc => doc.name))
  },

  setExecutedMigrations(endpoint, migrations) {
    const db = _db(endpoint)
    return getMigrationDocs(db)
      .then(docs => db.bulkDocs([
        ...docs.filter(doc => !migrations.includes(doc.name)).map(doc => ({ ...doc, _deleted: true })),
        ...migrations.filter(name => !docs.some(doc => doc.name == name)).map(name => ({ _id: uuid(), type: '_migration', name }) ),
      ]))
  },

  endpointToString(endpoint = {}) {
    if (endpoint.inMemory) {
      return endpoint.database
    }
    var result = `http://${endpoint.host || 'localhost'}`
    if ((endpoint.port || 5984) != 80) {
      result += `:${endpoint.port || 5984}`
    }
    result += `/${endpoint.database || 'project'}`
    return result
  }
}
