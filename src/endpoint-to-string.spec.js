import { endpointToString } from '.'

export default {
  valid: () => {
    expect(endpointToString()).toEqual('http://localhost:5984/project')
    expect(endpointToString({ database: 'db' })).toEqual('http://localhost:5984/db')
    expect(endpointToString({ port: 3000 })).toEqual('http://localhost:3000/project')
    expect(endpointToString({ database: 'db', host: 'local.de', port: 80 })).toEqual('http://local.de/db')
    expect(endpointToString({ database: 'db', host: 'local.de', port: 4000 })).toEqual('http://local.de:4000/db')
    expect(endpointToString({ database: 'db', user: 'admin' })).toEqual('http://admin@localhost:5984/db')
    expect(endpointToString({ database: 'db', user: 'admin', password: 'root' })).toEqual('http://admin:root@localhost:5984/db')
    expect(endpointToString({ database: 'db', password: 'root' })).toEqual('http://localhost:5984/db')
  },
}
