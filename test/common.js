const log = require('node:util').debuglog('futuopend')
const findFreePorts = require('find-free-ports')
const {setTimeout} = require('node:timers/promises')

const {
  STATUS
} = require('../src/common')

const {
  FutuOpenDManager
} = require('../src/manager')

const {
  startMockServer
} = require('../src/mock-server')

require('./shim')


class HttpTester extends FutuOpenDManager {
  constructor (n, {
    port,
    t,
    checkStatus = STATUS.ORIGIN,
    ...options
  }) {
    super(`http://localhost:${port}`, options)

    this._n = n
    this._t = t
    this._checkStatus = checkStatus
  }

  _log (...msg) {
    log(`[${this._n}]`, ...msg)
  }

  async waitForStatus (expected, {
    timeout = 5000,
    interval = 100
  } = {}) {
    const expectedList = Array.isArray(expected) ? expected : [expected]
    const started = Date.now()

    while (Date.now() - started < timeout) {
      const current = await this.status()

      if (expectedList.includes(current)) {
        return current
      }

      await setTimeout(interval)
    }

    throw new Error(
      `Timed out waiting for status ${expectedList.join(', ')}; last status = ${await this.status()}`
    )
  }

  async init () {
    if (typeof this._checkStatus === 'number') {
      this._t.is(await this.status(), this._checkStatus)
    }

    await super.init()
  }

  async test () {
    this._log('polling status ...')

    await this.waitForStatus([
      STATUS.INIT,
      STATUS.REQUESTING_VERIFICATION_CODE,
      STATUS.CONNECTED
    ])
  }
}


const startServer = async options => {
  const [port] = await findFreePorts(1)

  const kill = await startMockServer({
    port,
    ...options
  })

  return {
    port,
    kill
  }
}


module.exports = {
  HttpTester,
  startServer,
  log
}
