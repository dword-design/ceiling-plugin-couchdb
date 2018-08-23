const PouchDB = require('pouchdb')
const notnull = require('not-null')
const _ = require('lodash')
const uuid = require('uuid')

PouchDB.plugin(require('pouchdb-erase'))

function _url(endpoint) {
  if (endpoint.inMemory) {
    return endpoint.database
  }
  var result = `http://${notnull(endpoint.user, 'root')}:${notnull(endpoint.password, 'root')}@${notnull(endpoint.host, 'localhost')}`
  if (notnull(endpoint.port, 5984) != 80) {
    result += `:${notnull(endpoint.port,  5984)}`;
  }
  result += `/${notnull(endpoint.database, 'project')}`
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
    console.log('Connecting to the databases ...')
    const fromDb = new PouchDB(fromUrl)
    const toDb = new PouchDB(toUrl)
    console.log('Cleaning databases ...')
    return toDb.erase()
      .then(() => console.log(`Importing collections from ${fromUrl} ...`))
      .then(() => fromDb.allDocs({ include_docs: true, attachments: true }))
      .then(docs => docs.rows.map(doc => _.omit(doc.doc, '_rev')))
      .then(docs => toDb.bulkDocs(docs))
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
    var result = `http://${notnull(endpoint.host, 'localhost') }`
    if (notnull(endpoint.port, 5984) != 80) {
      result += `:${notnull(endpoint.port, 5984)}`
    }
    result += `/${notnull(endpoint.database, 'project')}`
    return result
  }
}
