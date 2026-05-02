const {
  STATUS,
  statusText
} = require('./common')

const {
  requestJson
} = require('./http')


class FutuOpenDManager {
  #url
  #terminateAfterIdle

  constructor(url, {
    terminateAfterIdle = false
  } = {}) {
    this.#url = url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')
    this.#terminateAfterIdle = terminateAfterIdle
  }

  #resetTimer () {
    if (!this.#terminateAfterIdle) {
      return
    }
  }

  async #request (method, path, body) {
    const {json, statusCode} = await requestJson(`${this.#url}${path}`, {
      method,
      body
    })

    if (statusCode >= 400) {
      const message = json && json.error
        ? json.error
        : `Request failed with status ${statusCode}`
      throw new Error(message)
    }

    this.#resetTimer()
    return json
  }

  async ready () {
    return this.status()
  }

  // Initialize FutuOpenD
  init () {
    return this.#request('POST', '/init')
  }

  // Send verification code to FutuOpenD
  sendCode (code) {
    return this.#request('POST', '/verification-code', {
      code
    })
  }

  // Get the status of FutuOpenD
  async status () {
    const data = await this.#request('GET', '/status')
    return data.status
  }

  terminate () {}
}


module.exports = {
  STATUS,
  statusText,
  FutuOpenDManager
}
