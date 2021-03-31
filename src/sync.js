import {
  chunk,
  first,
  last,
  map,
  omit,
  promiseAll,
  property,
  unary,
} from '@dword-design/functions'
import PouchDB from 'pouchdb'

import endpointToString from './endpoint-to-string'

const chunkSize = 100

export default async (from, to) => {
  const fromDb = new PouchDB(from |> endpointToString)

  const toDb = new PouchDB(to |> endpointToString)
  await toDb.erase()

  const chunksToWrite =
    fromDb.allDocs()
    |> await
    |> property('rows')
    |> map('id')
    |> chunk(chunkSize)
    |> map(
      async chunkIds =>
        fromDb.allDocs({
          attachments: true,
          endkey: chunkIds |> last,
          include_docs: true,
          startkey: chunkIds |> first,
        })
        |> await
        |> property('rows')
        |> map('doc')
        |> map(omit('_rev'))
    )
    |> promiseAll
    |> await

  return chunksToWrite |> map(unary(toDb.bulkDocs)) |> promiseAll
}
