const CouchdbSyncProvider = require('./index')
const PouchDB = require('pouchdb')
const _ = require('lodash')
const Ceiling = require('ceiling')
const stdout = require("test-console").stdout
const uuid = require('uuid')

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
      const restore = stdout.ignore()
      this.live.bulkDocs(this.liveTasks)
        .then(() => CouchdbSyncProvider.sync(live, local))
        .then(restore)
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(doc => doc.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev')))
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
      const restore = stdout.ignore()
      Promise.all([
        this.live.bulkDocs(this.liveTasks),
        this.local.bulkDocs([
          { _id: '1', title: 'Old stuff', body: 'This is old stuff' },
          { _id: '2', type: '_migration', name: 'mig1' },
          { _id: '3', type: '_migration', name: 'mig2' },
        ])
      ])
        .then(() => CouchdbSyncProvider.sync(live, local))
        .then(restore)
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(doc => doc.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev')))
        .then(docs => expect(docs).toEqual(this.liveTasks))
        .then(done)
    })

    it('pagination', done => {
      const live = {
        inMemory: true,
        database: 'live',
      }
      const local = {
        inMemory: true,
        database: 'local',
      }
      const liveDocs = _.range(250).map(index => ({ _id: index.toString().padStart(3, '0') }))
      const restore = stdout.ignore()
      this.live.bulkDocs(liveDocs)
        .then(() => CouchdbSyncProvider.sync(live, local))
        .then(restore)
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(doc => doc.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev')))
        .then(docs => expect(docs).toEqual(liveDocs))
        .then(done)
        .catch(err => console.log(err))
    })
  })

  describe('migrate', () => {

    beforeEach(done => {
      this.local = new PouchDB('local')
      this.local.bulkDocs([
        { _id: '1', title: 'task1', body: 'foo' },
        { _id: '2', title: 'task2', body: 'bar' },
      ])
        .then(done)
    })

    afterEach(done => {
      this.local.destroy().then(done)
    })

    it('no existing migrations', done => {
      const ceiling = new Ceiling({
        inlineMigrations: {
          couchdb: {
            1: {
              up({ db }) {
                return db.allDocs({ include_docs: true })
                  .then(result => result.rows.map(row => row.doc))
                  .then(docs => db.bulkDocs(docs.map(doc => ({
                    ..._.omit(doc, 'title'),
                    title2: doc.title,
                  }))))
              }
            },
            2: {
              up({ db }) {
                return db.allDocs({ include_docs: true })
                  .then(result => result.rows.map(row => row.doc))
                  .then(docs => db.bulkDocs(docs.map(doc => ({
                    ..._.omit(doc, 'body'),
                    body2: doc.body,
                  }))))
              }
            },
          }
        },
        syncProviders: {
          couchdb: CouchdbSyncProvider,
        },
        endpoints: {
          local: {
            couchdb: {
              inMemory: true,
              database: 'local',
            }
          }
        }
      })
      const restore = stdout.ignore()
      ceiling.migrate('local')
        .then(restore)
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(row => row.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev', '_id' )))
        .then(docs => expect(new Set(docs)).toEqual(new Set([
          { title2: 'task1', body2: 'foo' },
          { title2: 'task2', body2: 'bar' },
          { type: '_migration', name: '1' },
          { type: '_migration', name: '2' },
        ])))
        .then(done)
    })

    it('existing migrations', done => {
      const ceiling = new Ceiling({
        inlineMigrations: {
          couchdb: {
            1: {
              up({ db }) {
                return db.allDocs({ include_docs: true })
                  .then(result => result.rows.map(row => row.doc))
                  .then(docs => db.bulkDocs(docs.map(doc => ({
                    ..._.omit(doc, 'title'),
                    title2: doc.title,
                  }))))
              }
            },
            2: {
              up({ db }) {
                return db.allDocs({ include_docs: true })
                  .then(result => result.rows.map(row => row.doc))
                  .then(docs => db.bulkDocs(docs.map(doc => ({
                    ..._.omit(doc, 'body'),
                    body2: doc.body,
                  }))))
              }
            },
          }
        },
        syncProviders: {
          couchdb: CouchdbSyncProvider,
        },
        endpoints: {
          local: {
            couchdb: {
              inMemory: true,
              database: 'local',
            }
          }
        }
      })
      const restore = stdout.ignore()
      this.local.put({ _id: uuid(), type: '_migration', name: '1' })
        .then(() => ceiling.migrate('local'))
        .then(restore)
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(row => row.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev', '_id')))
        .then(docs => expect(new Set(docs)).toEqual(new Set([
          { title: 'task1', body2: 'foo' },
          { title: 'task2', body2: 'bar' },
          { type: '_migration', name: '1' },
          { type: '_migration', name: '2' },
        ])))
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
