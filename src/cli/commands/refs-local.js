'use strict'

module.exports = {
  command: 'refs-local',

  describe: 'List all local references.',

  builder (yargs) {
    return yargs.epilog('CIDs are reconstructed therefore they might differ from those under which the blocks were originally stored.')
  },

  handler ({ getIpfs, print, resolve }) {
    resolve((async () => {
      const ipfs = await getIpfs()

      return new Promise((resolve, reject) => {
        const stream = ipfs.refs.localReadableStream()

        stream.on('error', reject)
        stream.on('end', resolve)

        stream.on('data', (ref) => {
          if (ref.err) {
            print(ref.err, true, true)
          } else {
            print(ref.ref)
          }
        })
      })
    })())
  }
}
