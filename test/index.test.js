const CouchdbSyncProvider = require('ceiling-couchdb')
const PouchDB = require('pouchdb')
const Ceiling = require('ceiling')
const stdout = require("test-console").stdout
const uuid = require('uuid')

describe('PouchdbSyncProvider', () => {

  describe('sync', () => {

    beforeEach(() => {
      this.live = new PouchDB('live')
      this.local = new PouchDB('local')

      this.liveTasks = [
        { _id: '1', title: 'task1', body: 'foo' },
        { _id: '2', title: 'task2', body: 'bar' },
      ]
    })

    afterEach(() => Promise.all([
        this.live.destroy(),
        this.local.destroy(),
    ]))

    it('empty to-database', async () => {
      const live = {
        inMemory: true,
        database: 'live',
      }
      const local = {
        inMemory: true,
        database: 'local',
      }
      const restore = stdout.ignore()
      await this.live.bulkDocs(this.liveTasks)
      await CouchdbSyncProvider.sync(live, local)
      restore()
      const result = await this.local.allDocs({ include_docs: true })
      let docs = result.rows.map(doc => doc.doc)
      docs = docs.map(doc => _.omit(doc, '_rev'))
      expect(docs).toEqual(this.liveTasks)
    })

    it('non-empty to-database', () => {
      const live = {
        inMemory: true,
        database: 'live',
      }
      const local = {
        inMemory: true,
        database: 'local',
      }
      const restore = stdout.ignore()
      return Promise.all([
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
    })

    it('pagination', () => {
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
      return this.live.bulkDocs(liveDocs)
        .then(() => CouchdbSyncProvider.sync(live, local))
        .then(restore)
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(doc => doc.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev')))
        .then(docs => expect(docs).toEqual(liveDocs))
    })
  })

  describe('migrate', () => {

    beforeEach(() => {
      this.local = new PouchDB('local')
      return this.local.bulkDocs([
        { _id: '1', title: 'task1', body: 'foo' },
        { _id: '2', title: 'task2', body: 'bar' },
      ])
    })

    afterEach(() => this.local.destroy())

    it('no existing migrations', () => {
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
      return ceiling.migrate('local')
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
    })

    it('existing migrations', () => {
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
      return this.local.put({ _id: uuid(), type: '_migration', name: '1' })
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
