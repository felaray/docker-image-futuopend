const {createServer} = require('node:http')
const pty = require('node-pty')

const {
  STATUS,
  statusText,
  OutputManager
} = require('./common')


const createDeferred = () => {
  let resolve

  const promise = new Promise(r => {
    resolve = r
  })

  return {
    promise,
    resolve
  }
}

const readJsonBody = req => new Promise((resolve, reject) => {
  let raw = ''

  req.setEncoding('utf8')

  req.on('data', chunk => {
    raw += chunk
  })

  req.on('end', () => {
    if (!raw) {
      resolve(null)
      return
    }

    try {
      resolve(JSON.parse(raw))
    } catch (err) {
      reject(new Error(`Invalid JSON body: ${err.message}`))
    }
  })

  req.on('error', reject)
})

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload)

  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('content-length', Buffer.byteLength(body))
  res.end(body)
}


class FutuManager {
  #cmd
  #login_account
  #login_pwd_md5
  #lang
  #log_level
  #ip
  #api_port
  #status
  #supervise
  #retry
  #should_log
  #server
  #child
  #code
  #output
  #ready_to_receive_code
  #resolveReadyToReceiveCode

  constructor (cmd, {
    login_account,
    login_pwd_md5,
    lang,
    log_level,
    ip,
    api_port,
    server_port,

    // Whether to auto-init the FutuOpenD process
    auto_init = true,

    // Whether to supervise the FutuOpenD process, and restart it if it closes
    supervise = true
  }) {
    this.#cmd = cmd
    this.#ip = ip
    this.#login_account = login_account
    this.#login_pwd_md5 = login_pwd_md5
    this.#lang = lang
    this.#log_level = log_level
    this.#api_port = api_port
    this.#status = STATUS.ORIGIN
    this.#supervise = supervise
    this.#retry = parseInt(
      // For testing purposes
      process.env.FUTU_RETRY,
      10
    ) || 0

    this.#should_log = log_level !== 'no'

    this.#server = createServer((req, res) => {
      this.#handleRequest(req, res).catch(err => {
        this.#error('HTTP server error:', err)
        if (!res.writableEnded) {
          sendJson(res, 500, {
            error: 'Internal server error'
          })
        }
      })
    })

    this.#server.listen(server_port, () => {
      this.#log(`REST API server is listening on port ${server_port}`)
    })

    this.#reset_ready_to_receive_code()

    if (auto_init) {
      this.#init()
    }
  }

  #log(...msg) {
    if (this.#should_log) {
      console.log('[INFO]', ...msg)
    }
  }

  #error(...msg) {
    if (this.#should_log) {
      console.error('[ERROR]', ...msg)
    }
  }

  #reset_ready_to_receive_code() {
    const {promise, resolve} = createDeferred()
    this.#ready_to_receive_code = promise
    this.#resolveReadyToReceiveCode = resolve
  }

  async #handleRequest(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1')

    if (req.method === 'GET' && url.pathname === '/') {
      sendJson(res, 200, this.#statusResponse())
      return
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      sendJson(res, 200, this.#statusResponse())
      return
    }

    if (req.method === 'POST' && url.pathname === '/init') {
      this.#init()
      sendJson(res, 202, {
        ok: true,
        ...this.#statusResponse()
      })
      return
    }

    if (
      req.method === 'POST'
      && (url.pathname === '/verification-code' || url.pathname === '/verify-code')
    ) {
      let payload

      try {
        payload = await readJsonBody(req)
      } catch (err) {
        sendJson(res, 400, {
          error: err.message
        })
        return
      }

      const code = payload && payload.code

      if (typeof code !== 'string' || !code.trim()) {
        sendJson(res, 400, {
          error: 'Missing verification code'
        })
        return
      }

      this.verify_code(code)
      sendJson(res, 202, {
        ok: true,
        ...this.#statusResponse()
      })
      return
    }

    sendJson(res, 404, {
      error: 'Not found'
    })
  }

  #statusResponse() {
    return {
      status: this.#status,
      state: statusText(this.#status)
    }
  }

  #init() {
    if (this.#status >= STATUS.INIT) {
      // Already inited
      return
    }

    this.#status = STATUS.INIT

    this.#log('Initializing FutuOpenD with options ...', {
      ip: this.#ip,
      login_account: this.#login_account,
      login_pwd_md5: '<hidden>',
      lang: this.#lang,
      log_level: this.#log_level,
      api_port: this.#api_port
    })

    this.#child = pty.spawn(this.#cmd, [
      `-login_account=${this.#login_account}`,
      `-login_pwd_md5=${this.#login_pwd_md5}`,
      `-lang=${this.#lang}`,
      `-log_level=${this.#log_level}`,
      // Ref:
      // https://openapi.futunn.com/futu-api-doc/en/opend/opend-cmd.html#7191
      `-api_ip=${this.#ip}`,
      `-websocket_ip=${this.#ip}`,
      `-api_port=${this.#api_port}`
    ], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: {
        ...process.env,
        FUTU_RETRY: this.#retry
      }
    })

    this.#output = new OutputManager()

    this.#child.on('data', chunk => {
      process.stdout.write(chunk)
      this.#output.add(chunk)

      if (this.#output.includes('req_phone_verify_code')) {
        this.#status = STATUS.REQUESTING_VERIFICATION_CODE
        this.#resolveReadyToReceiveCode()

        if (this.#code) {
          this.#set_verify_code()
        }

        return
      }

      if (this.#output.includes('Login successful')) {
        this.#status = STATUS.CONNECTED
        this.#output.close()
      }
    })

    this.#child.on('error', err => {
      this.#error('FutuOpenD error:', err)
    })

    this.#child.on('exit', () => {
      this.#error('FutuOpenD exited')
    })

    this.#child.on('close', () => {
      this.#log('FutuOpenD closed')

      this.#status = STATUS.CLOSED
      this.#reset_ready_to_receive_code()

      if (this.#supervise) {
        this.#retry++
        this.#init()
      }
    })
  }

  verify_code(code) {
    this.#code = code

    if (this.#status === STATUS.REQUESTING_VERIFICATION_CODE) {
      this.#set_verify_code()
      return
    }

    if (this.#status === STATUS.CONNECTED) {
      // Already connected, no need to verify code
      return
    }

    this.#ready_to_receive_code.then(() => {
      this.#set_verify_code()
    })
  }

  #set_verify_code() {
    const code = this.#code
    this.#code = undefined

    // this.#ready.then might be called multiple times,
    //   so we need to test the current status again
    if (this.#status !== STATUS.REQUESTING_VERIFICATION_CODE) {
      return
    }

    this.#status = STATUS.VERIFIYING_CODE
    this.#child.write(`input_phone_verify_code -code=${code}\r`)
  }
}


module.exports = {
  STATUS,
  FutuManager
}
