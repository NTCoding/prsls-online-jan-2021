const when = require('../steps/when')
const given = require('../steps/given')
const tearDown = require('../steps/tearDown')
const { init } = require('../steps/init')
const messages = require('../messages')
console.log = jest.fn()

describe('Given an authenticated user', () => {
  let user

  beforeAll(async () => {
    await init()
    user = await given.an_authenticated_user()
  })

  afterAll(async () => {
    await tearDown.an_authenticated_user(user)
  })

  describe(`When we invoke the POST /orders endpoint`, () => {
    let resp

    beforeAll(async () => {
      messages.startListening()
      resp = await when.we_invoke_place_order(user, 'Fangtasia')
    })

    it(`Should return 200`, async () => {
      expect(resp.statusCode).toEqual(200)
    })

    it(`Should publish a message to EventBridge bus`, async () => {
      const { orderId } = resp.body

      await messages.waitForMessage(
        'eventbridge',
        process.env.EVENT_BUS_NAME,
        JSON.stringify({
          source: 'big-mouth',
          'detail-type': 'order_placed',
          detail: {
            orderId,
            restaurantName: 'Fangtasia'
          }
        })
      )
    }, 10000)
  })
})