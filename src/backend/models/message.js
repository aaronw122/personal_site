const mongoose = require('mongoose')

mongoose.set('strictQuery', false)

const url = process.env.MONGODB_URI
console.log('connecting to', url)

mongoose.connect(url, { family: 4 })
  .then(result => {
    console.log('connected to mongoDB')
  } )
  .catch(error => {
    console.log('error connecting to MongoDB:', error.message)
  })

const messageSchema = new mongoose.Schema({
  name: {
    type: String,
    minLength: 3,
    required: true,
    unique: true,
  },
  content: {
    type: String,
    minLength: 2,
    required: true,
  }
})

messageSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Message', messageSchema)
