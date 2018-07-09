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
      expect(CouchdbSyncProvider.endpointToString({ database: 'project', host: 'local.de' })).toEqual('couchdb://local.de/project')
      expect(CouchdbSyncProvider.endpointToString({ database: 'project', host: 'local.de', port: 4000 })).toEqual('couchdb://local.de:4000/project')
      expect(CouchdbSyncProvider.endpointToString({ database: 'project', host: 'local.de', inMemory: true })).toEqual('project')
    })
  })
})
