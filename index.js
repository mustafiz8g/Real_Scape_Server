require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')

const port = process.env.PORT || 8100
const app = express()
// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nq2rk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {

    const db = client.db('property-session')
    const usersCollection = db.collection('users')
    const propertiesCollection = db.collection('properties')


      // save or update user in db
      app.post('/users/:email', async(req, res) => {
        const email = req.params.email;
        const query = { email }
        const user = req.body;
        // check if user exist in deb
        const isExist = await usersCollection.findOne(query)
        if(isExist){
          return res.send(isExist)
        }
  
        const result = await usersCollection.insertOne({
          ...user,
          role: 'customer',
          timestamp: Date.now(),
          })
        res.send(result)
      })


            app.patch('/users/:email',verifyToken, async(req, res) => { 
      const email = req.params.email;
      const query = { email }
      const user = await usersCollection.findOne(query)
      if(!user || user?.status === 'requested') return res.status(400 ).send({message: 'already requested wait some time'})
      // const {status} = req.body;
      const updateDoc = {
        $set: {
          status: 'requested',
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })


    app.patch('/users/:email',verifyToken, async(req, res) => { 
        const email = req.params.email;
        const query = { email }
        const user = await usersCollection.findOne(query)
        if(!user || user?.status === 'requested') return res.status(400 ).send({message: 'already requested wait some time'})
        // const {status} = req.body;
        const updateDoc = {
          $set: {
            status: 'requested',
          },
        }
        const result = await usersCollection.updateOne(query, updateDoc)
        res.send(result)
      })
  
          //get user role
    app.get('/users/role/:email',verifyToken, async(req, res) => {
        const email = req.params.email;
        const query = { email }
        const result = await usersCollection.findOne(query)
        res.send({role: result?.role})
      })
  

    // Generate jwt token
    app.post('/jwt',verifyToken, async (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })

       // save a property data in db
       app.post('/properties', async(req, res) =>{
        const property = req.body;
        const result = await propertiesCollection.insertOne(property)
        res.send(result)
      })
      app.get('/properties', async(req, res) =>{
        const properties = await propertiesCollection.find().toArray()
        res.send(properties)
      })


    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from plantNet Server..')
})

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`)
})