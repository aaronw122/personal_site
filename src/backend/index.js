require('dotenv').config()
const express = require('express')
const app = express()
const Message = require('./models/message')


app.use(express.json())

app.get('/api/wall', (req, res) => {
  Message.find({}).then(messages => {
    res.json(messages)
  })
})

app.post('/api/wall', (request, response, next) => {
    const {name, content} = request.body

    const message = new Message({
        name: name,
        content: content,
    })

    message.save()
        .then(savedMessage => {
          response.json(savedMessage)
        })
        .catch(error => next(error))
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`)
})
