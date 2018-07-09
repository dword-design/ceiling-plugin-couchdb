const CouchdbSyncProvider = require('./index')
const PouchDB = require('pouchdb')
const consoleMock = require('console-mock2')
const _ = require('lodash')

describe('PouchdbSyncProvider', () => {

  describe('sync', () => {

    beforeEach(done => {
      this.live = new PouchDB('live')
      this.local = new PouchDB('local')

      this.liveTasks = [
        { _id: '1', title: 'task1', body: 'foo' },
        { _id: '2', title: 'task2', body: 'bar' },
      ]

      done()
    })

    afterEach(done => {
      Promise.all([
        this.live.destroy(),
        this.local.destroy(),
      ]).then(done)
    })

    it('empty to-database', done => {
      const live = {
        inMemory: true,
        database: 'live',
      }
      const local = {
        inMemory: true,
        database: 'local',
      }
      this.live.bulkDocs(this.liveTasks)
        .then(() => consoleMock(() => CouchdbSyncProvider.sync(live, local)))
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(docs => docs.rows.map(doc => _.omit(doc.doc, '_rev')))
        .then(docs => expect(docs).toEqual(this.liveTasks))
        .then(done)
    })

    it('non-empty to-database', done => {
      const live = {
        inMemory: true,
        database: 'live',
      }
      const local = {
        inMemory: true,
        database: 'local',
      }
      Promise.all([
        this.live.bulkDocs(this.liveTasks),
        this.local.put({ _id: '3', title: 'Old stuff', body: 'This is old stuff' })
      ])
        .then(() => consoleMock(() => CouchdbSyncProvider.sync(live, local)))
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(docs => docs.rows.map(doc => _.omit(doc.doc, '_rev')))
        .then(docs => expect(docs).toEqual(this.liveTasks))
        .then(done)
    })
  })

  describe('endpointToString', () => {

    it('works', () => {
      expect(CouchdbSyncProvider.endpointToString()).toEqual('http://localhost:5984/project')
      expect(CouchdbSyncProvider.endpointToString({ database: 'db' })).toEqual('http://localhost:5984/db')
      expect(CouchdbSyncProvider.endpointToString({ database: 'db', host: 'local.de' })).toEqual('http://local.de:5984/db')
      expect(CouchdbSyncProvider.endpointToString({ database: 'db', host: 'local.de', port: 4000 })).toEqual('http://local.de:4000/db')
      expect(CouchdbSyncProvider.endpointToString({ database: 'db', host: 'local.de', port: 80 })).toEqual('http://local.de/db')
      expect(CouchdbSyncProvider.endpointToString({ database: 'db', host: 'local.de', inMemory: true })).toEqual('db')
    })
  })
})
