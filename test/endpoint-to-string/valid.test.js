import { endpointToString } from 'ceiling-plugin-couchdb'
import expect from 'expect'

export default () => {
  expect(endpointToString()).toEqual('http://localhost/project')
  expect(endpointToString({ database: 'db' })).toEqual('http://localhost/db')
  expect(endpointToString({ port: 3000 })).toEqual('http://localhost:3000/project')
  expect(endpointToString({ database: 'db', host: 'local.de' })).toEqual('http://local.de/db')
  expect(endpointToString({ database: 'db', host: 'local.de', port: 4000 })).toEqual('http://local.de:4000/db')
  expect(endpointToString({ database: 'db', user: 'admin' })).toEqual('http://admin@localhost/db')
  expect(endpointToString({ database: 'db', user: 'admin', password: 'root' })).toEqual('http://admin:root@localhost/db')
  expect(endpointToString({ database: 'db', password: 'root' })).toEqual('http://localhost/db')
}
