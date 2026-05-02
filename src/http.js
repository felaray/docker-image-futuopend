const {request: httpRequest} = require('node:http')
const {request: httpsRequest} = require('node:https')
const {URL} = require('node:url')

const requestJson = (url, {
  method = 'GET',
  headers = {},
  body
} = {}) => new Promise((resolve, reject) => {
  const target = new URL(url)
  const requestImpl = target.protocol === 'https:'
    ? httpsRequest
    : httpRequest

  let payload
  const requestHeaders = {
    ...headers
  }

  if (body !== undefined) {
    payload = typeof body === 'string'
      ? body
      : JSON.stringify(body)

    if (!requestHeaders['content-type']) {
      requestHeaders['content-type'] = 'application/json'
    }

    requestHeaders['content-length'] = Buffer.byteLength(payload)
  }

  const req = requestImpl(target, {
    method,
    headers: requestHeaders
  }, res => {
    let raw = ''

    res.setEncoding('utf8')

    res.on('data', chunk => {
      raw += chunk
    })

    res.on('end', () => {
      if (!raw) {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: '',
          json: null
        })
        return
      }

      let json = null

      try {
        json = JSON.parse(raw)
      } catch (err) {
        reject(new Error(`Invalid JSON response from ${url}: ${err.message}`))
        return
      }

      resolve({
        statusCode: res.statusCode || 0,
        headers: res.headers,
        body: raw,
        json
      })
    })
  })

  req.on('error', reject)

  if (payload !== undefined) {
    req.write(payload)
  }

  req.end()
})

module.exports = {
  requestJson
}
