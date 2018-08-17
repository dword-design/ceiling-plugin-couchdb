const CouchdbSyncProvider = require('./index')
const PouchDB = require('pouchdb')
const consoleMock = require('console-mock2')
const _ = require('lodash')
const Ceiling = require('ceiling')
const stdout = require("test-console").stdout

describe('PouchdbSyncProvider', () => {

  describe('sync', () => {

    /*beforeEach(done => {
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
    })*/
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
        migrations: {
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
      const inspect = stdout.inspect()
      ceiling.migrate('local')
        .then(() => inspect.restore())
        .then(() => Promise.all([
          this.local.allDocs({ include_docs: true })
            .then(result => result.rows.map(row => row.doc))
            .then(docs => docs.map(doc => _.omit(doc, '_rev')))
            .then(docs => expect(docs).toEqual([
              { _id: '1', title2: 'task1', body2: 'foo' },
              { _id: '2', title2: 'task2', body2: 'bar' }
            ])),
          this.local.get('_local/migrations')
            .then(doc => expect(doc.migrations).toEqual(['1', '2']))
        ]))
        .then(done)
    })

    it('existing migrations', done => {
      const ceiling = new Ceiling({
        migrations: {
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
      const inspect = stdout.inspect()
      this.local.put({ _id: '_local/migrations', migrations: ['1'] })
        .then(() => ceiling.migrate('local'))
        .then(() => inspect.restore())
        .then(() => this.local.allDocs({ include_docs: true }))
        .then(result => result.rows.map(row => row.doc))
        .then(docs => docs.map(doc => _.omit(doc, '_rev')))
        .then(docs => expect(docs).toEqual([
          { _id: '1', title: 'task1', body2: 'foo' },
          { _id: '2', title: 'task2', body2: 'bar' }
        ]))
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
