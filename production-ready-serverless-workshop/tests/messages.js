const SQS = require('aws-sdk/clients/sqs')
const { ReplaySubject } = require("rxjs")

const messages = new ReplaySubject(100)
const messageIds = new Set()
let pollingLoop

const startListening = () => {
  if (pollingLoop) {
    return
  }

  const sqs = new SQS()
  const queueUrl = process.env.E_2_E_TEST_QUEUE_URL
  const loop = async () => {
    const resp = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20
    }).promise()

    if (!resp.Messages) {
      return await loop()
    }

    resp.Messages.forEach(msg => {
      if (messageIds.has(msg.MessageId)) {
        // seen this message already, ignore
        return
      }
    
      messageIds.add(msg.MessageId)
    
      const body = JSON.parse(msg.Body)
      if (body.TopicArn) {
        messages.next({
          sourceType: 'sns',
          source: body.TopicArn,
          message: body.Message
        })
      } else if (body.eventBusName) {
        messages.next({
          sourceType: 'eventbridge',
          source: body.eventBusName,
          message: JSON.stringify(body.event)
        })
      }
    })

    await loop()
  }

  pollingLoop = loop()
}

const waitForMessage = (sourceType, source, message) => {
  //console.info('waiting for', {sourceType, source, message})
  let subscription
  return new Promise((resolve) => {
    subscription = messages.subscribe(incomingMessage => {
      //console.info('has', incomingMessage)
      if (incomingMessage.sourceType === sourceType &&
          incomingMessage.source === source &&
          incomingMessage.message === message) {
        resolve()
      }
    })
  }).then(() => subscription.unsubscribe())
}

module.exports = {
  startListening,
  waitForMessage
}