'use strict'

const { keyToCid } = require('ipfs-repo/src/blockstore-utils')
const itToPull = require('async-iterator-to-pull-stream')

module.exports = function (self) {
  return () => {
    return itToPull((async function * () {
      for await (const { key: k } of self._repo.blocks.query({ keysOnly: true })) {
        try {
          yield { ref: keyToCid(k).toString() }
        } catch (err) {
          yield { err: `Could not convert block with key '${k.toString()}' to CID: ${err.message}` }
        }
      }
    })())
  }
}
