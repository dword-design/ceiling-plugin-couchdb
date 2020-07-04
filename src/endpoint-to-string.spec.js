import { mapValues } from '@dword-design/functions'

import self from './endpoint-to-string'

const runTest = config => () =>
  expect(config.endpoint |> self).toEqual(config.result)

export default {
  db: {
    endpoint: { database: 'db' },
    result: 'http://localhost:5984/db',
  },
  'db, host, port': {
    endpoint: { database: 'db', host: 'local.de', port: 4000 },
    result: 'http://local.de:4000/db',
  },
  'db, host, port 80': {
    endpoint: { database: 'db', host: 'local.de', port: 80 },
    result: 'http://local.de/db',
  },
  'db, user': {
    endpoint: { database: 'db', user: 'admin' },
    result: 'http://admin@localhost:5984/db',
  },
  empty: {
    endpoint: {},
    result: 'http://localhost:5984/project',
  },
  password: {
    endpoint: { database: 'db', password: 'root', user: 'admin' },
    result: 'http://admin:root@localhost:5984/db',
  },
  'password without user': {
    endpoint: { database: 'db', password: 'root' },
    result: 'http://localhost:5984/db',
  },
  port: {
    endpoint: { port: 3000 },
    result: 'http://localhost:3000/project',
  },
} |> mapValues(runTest)
