import PouchDB from 'pouchdb'

import endpointToString from './endpoint-to-string'

export default endpoint => new PouchDB(endpoint |> endpointToString)
