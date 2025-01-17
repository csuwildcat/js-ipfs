/* eslint max-nested-callbacks: ["error", 7] */
/* eslint-env mocha */
'use strict'

const { expect } = require('interface-ipfs-core/src/utils/mocha')
const path = require('path')
const ipfsExec = require('../utils/ipfs-exec')

const DaemonFactory = require('ipfsd-ctl')
const df = DaemonFactory.create({
  type: 'js',
  IpfsClient: require('ipfs-http-client')
})

const spawnDaemon = () => df.spawn({
  exec: path.resolve(`${__dirname}/../../src/cli/bin.js`),
  args: ['--enable-namesys-pubsub'],
  initOptions: { bits: 512 },
  config: {
    Bootstrap: [],
    Discovery: {
      MDNS: {
        Enabled: false
      },
      webRTCStar: {
        Enabled: false
      }
    }
  }
})

describe('name-pubsub', () => {
  describe('enabled', () => {
    let ipfsA
    let ipfsB
    let nodeAId
    let nodeBId
    let bMultiaddr
    const nodes = []

    // Spawn daemons
    before(async function () {
      // CI takes longer to instantiate the daemon, so we need to increase the
      // timeout for the before step
      this.timeout(80 * 1000)

      const nodeA = await spawnDaemon()
      ipfsA = ipfsExec(nodeA.repoPath)
      nodes.push(nodeA)

      const nodeB = await spawnDaemon()
      ipfsB = ipfsExec(nodeB.repoPath)
      nodes.push(nodeB)
    })

    // Get node ids
    before(async function () {
      const res = await Promise.all([
        ipfsA('id'),
        ipfsB('id')
      ])

      nodeAId = JSON.parse(res[0])
      nodeBId = JSON.parse(res[1])
      bMultiaddr = nodeBId.addresses[0]
    })

    // Connect
    before(async function () {
      const out = await ipfsA('swarm', 'connect', bMultiaddr)
      expect(out).to.eql(`connect ${bMultiaddr} success\n`)
    })

    after(() => Promise.all(nodes.map((node) => node.stop())))

    describe('pubsub commands', () => {
      it('should get enabled state of pubsub', async function () {
        const res = await ipfsA('name pubsub state')
        expect(res).to.have.string('enabled') // enabled
      })

      it('should subscribe on name resolve', async function () {
        this.timeout(80 * 1000)

        const err = await ipfsB.fail(`name resolve ${nodeAId.id}`)
        expect(err.all).to.include('was not found')

        const ls = await ipfsB('pubsub ls')
        expect(ls).to.have.string('/record/') // have a record ipns subscribtion

        const subs = await ipfsB('name pubsub subs')
        expect(subs).to.have.string(`/ipns/${nodeAId.id}`) // have subscription
      })

      it('should be able to cancel subscriptions', async function () {
        this.timeout(80 * 1000)

        const res = await ipfsA(`name pubsub cancel /ipns/${nodeBId.id}`)
        expect(res).to.have.string('no subscription') // tried to cancel a not yet subscribed id

        const err = await ipfsA.fail(`name resolve ${nodeBId.id}`)
        expect(err).to.exist() // Not available (subscribed now)

        const cancel = await ipfsA(`name pubsub cancel /ipns/${nodeBId.id}`)
        expect(cancel).to.have.string('canceled') // canceled now

        const ls = await ipfsA('pubsub ls')
        expect(ls).to.not.have.string('/ipns/') // ipns subscribtion not available

        const subs = await ipfsA('name pubsub subs')
        expect(subs).to.not.have.string(`/ipns/${nodeBId.id}`) // ipns subscribtion not available
      })
    })
  })

  describe('disabled', () => {
    let ipfsA
    let node

    // Spawn daemons
    before(async function () {
      // CI takes longer to instantiate the daemon, so we need to increase the
      // timeout for the before step
      this.timeout(80 * 1000)

      node = await df.spawn({
        exec: path.resolve(`${__dirname}/../../src/cli/bin.js`),
        config: {},
        initOptions: { bits: 512 }
      })
      ipfsA = ipfsExec(node.repoPath)
    })

    after(() => {
      if (node) {
        return node.stop()
      }
    })

    it('should get disabled state of pubsub', async function () {
      const res = await ipfsA('name pubsub state')
      expect(res).to.have.string('disabled')
    })

    it('should get error getting the available subscriptions', async function () {
      const err = await ipfsA.fail('name pubsub subs')
      expect(err.stdout).to.have.string('IPNS pubsub subsystem is not enabled')
    })

    it('should get error canceling a subscription', async function () {
      const err = await ipfsA.fail('name pubsub cancel /ipns/QmSWxaPcGgf4TDnFEBDWz2JnbHywF14phmY9hNcAeBEK5v')
      expect(err.stdout).to.have.string('IPNS pubsub subsystem is not enabled')
    })
  })
})
