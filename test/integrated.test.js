const test = require('ava')
const {join} = require('node:path')
const {setTimeout} = require('node:timers/promises')

const {
  HttpTester,
  startServer,
  log
} = require('./common')

const {
  STATUS
} = require('..')

require('./shim')


test.serial('start integrated test', async t => {
  const {
    port,
    kill
  } = await startServer()

  log('start integrated test', port)

  const tester1 = new HttpTester(1, {
    port,
    t
  })

  await tester1.ready()
  await tester1.init()

  await tester1.waitForStatus(STATUS.REQUESTING_VERIFICATION_CODE)

  const tester2 = new HttpTester(2, {
    port,
    t,
    checkStatus: false
  })

  await tester2.ready()
  t.is(await tester2.status(), STATUS.REQUESTING_VERIFICATION_CODE)

  await tester1.sendCode('12345')
  await tester1.waitForStatus(STATUS.CONNECTED)

  const tester3 = new HttpTester(3, {
    port,
    t,
    checkStatus: false
  })

  await tester3.ready()
  t.is(await tester3.status(), STATUS.CONNECTED)

  kill()
})


test.serial('send verify code before init', async t => {
  const {
    port,
    kill
  } = await startServer({
    initRetry: 2
  })

  const tester = new HttpTester(1, {
    port,
    t,
  })

  await tester.ready()

  await tester.sendCode('12345')

  await tester.init()

  await tester.waitForStatus(STATUS.CONNECTED)

  kill()
})


test.serial('auto init', async t => {
  const {
    port,
    kill
  } = await startServer({
    initRetry: 2,
    env: {
      FUTU_INIT_ON_START: 'yes'
    }
  })

  const tester = new HttpTester(1, {
    port,
    t,
  })

  await tester.ready()
  await tester.waitForStatus([
    STATUS.INIT,
    STATUS.REQUESTING_VERIFICATION_CODE
  ])

  await setTimeout(1500)
  await tester.ready()
  t.true([
    STATUS.INIT,
    STATUS.REQUESTING_VERIFICATION_CODE,
    STATUS.CONNECTED
  ].includes(await tester.status()))

  kill()
})


test.serial('spawn failed', async t => {
  const {
    port,
    kill
  } = await startServer({
    env: {
      FUTU_CMD: join(__dirname, 'common.js'),
      FUTU_INIT_ON_START: 'no',
      FUTU_SUPERVISE_PROCESS: 'no'
    }
  })

  const tester = new HttpTester(1, {
    port,
    t
  })

  await tester.ready()
  await tester.init()

  await tester.waitForStatus(STATUS.CLOSED)

  kill()
})
