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
    origin: ['http://localhost:5173', 'http://localhost:5174','https://realscape-c226c.web.app','realscape-c226c.firebaseapp.com'],
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
        const reviewsCollection = db.collection('reviews')
        const propertiesCollection = db.collection('properties')
        const wishlistsCollection = db.collection('wishlists')
        const offersCollection = db.collection('offers')


        // save or update a user in db
        app.post('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email }
            const user = req.body
            // check if user exists in db
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                return res.send(isExist)
            }
            const result = await usersCollection.insertOne({
                ...user,
                role: 'customer',
                timestamp: Date.now(),
            })
            res.send(result)
        })

        // get users
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        // manage user status and role
        app.patch('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email }
            const user = await usersCollection.findOne(query)
            if (!user || user?.status === 'Requested')
                return res
                    .status(400)
                    .send('You have already requested, wait for some time.')

            const updateDoc = {
                $set: {
                    status: 'Requested',
                },
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            console.log(result)
            res.send(result)
        })

        // get user role
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send({ role: result?.role })
        })



        // Generate jwt token
        app.post('/jwt', verifyToken, async (req, res) => {
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
        app.post('/properties', async (req, res) => {
            const property = req.body;
            const result = await propertiesCollection.insertOne(property)
            res.send(result)
        })
        // get all property for advertise section
        app.get('/properties', async (req, res) => {
            const properties = await propertiesCollection.find().limit(6).toArray()
            res.send(properties)
        })
      


    
        // Route to fetch properties with search and sort functionality
app.get('/propertiess', async (req, res) => {
    try {
      const { location, sort } = req.query;
  
      const query = {};
      if (location) {
        query.location = { $regex: location, $options: 'i' }; // 
      }
  
      let sortQuery = {};
      if (sort === 'lowToHigh') {
        sortQuery.minPrice = 1; // Ascending order
      } else if (sort === 'highToLow') {
        sortQuery.minPrice = -1; // Descending order
      }
  
      const properties = await propertiesCollection.find(query).sort(sortQuery).toArray();
      res.send(properties);
    } catch (error) {
      console.error('Error fetching properties:', error);
      res.status(500).send({ error: 'Failed to fetch properties' });
    }
  });
  


    



        
        //get property by id
        app.get('/property/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await propertiesCollection.findOne(query)
            res.send(result)
        })
        app.get('/property/:email', async(req, res) => {
            const email = req.params.email;

        })

        // my added property delete 
        app.delete('/properties/:id', async (req, res) => {
            const { id } = req.params;
            const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });
        // update my added property 
     


// Update a property
app.put('/properties', async (req, res) => {
    const updatedProperty = req.body;
  
    // Ensure the property object contains an ID
    if (!updatedProperty._id) {
      return res.status(400).json({ message: 'Property ID is required.' });
    }
  
    try {
      const { _id, ...propertyData } = updatedProperty;
      const result = await propertiesCollection.updateOne(
        { _id: new ObjectId(_id) }, // Find the property by ID
        { $set: propertyData }      // Update the property with new data
      );
  
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Property not found.' });
      }
  
      res.status(200).json({ message: 'Property updated successfully.', result });
    } catch (err) {
      console.error('Error updating property:', err);
      res.status(500).json({ message: 'Failed to update property.', error: err.message });
    }
  });


   
        

        // review submit 
        app.post('/reviews', async (req, res) => {
            const reviews = req.body;
            const result = await reviewsCollection.insertOne(reviews)
            res.send(result)
        })
        // get review 
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewsCollection.find().toArray()
            res.send(reviews)
        })
        // get review by specific email
   
        
        // delet review 
        const { ObjectId } = require("mongodb");

app.delete('/reviews/:id', async (req, res) => {
    const reviewId = req.params.id; // Extract review ID from the request params

    try {
        // Validate if the ID is provided and is a valid MongoDB ObjectId
        if (!ObjectId.isValid(reviewId)) {
            return res.status(400).send({ message: "Invalid review ID provided." });
        }

        // Attempt to delete the review
        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(reviewId) });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Review not found or already deleted." });
        }

        res.send({ message: "Review deleted successfully." });
    } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).send({ message: "Internal server error." });
    }
});


        // add wishlists
        app.post('/wishlists', async (req, res) => {
            const wishlist = req.body;
            const result = await wishlistsCollection.insertOne(wishlist)
            res.send(result)
        })
        // get wishlist 
        app.get('/wishlists', async (req, res) => {
            const wishlists = await wishlistsCollection.find().toArray()
            res.send(wishlists)
        })
        // DELETE route to remove a wishlist item
        app.delete('/wishlists/:id', async (req, res) => {
            const { id } = req.params; // Get the ID from the URL parameter

            try {
                const result = await wishlistsCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'Wishlist item not found' });
                }
                res.status(200).json({ message: 'Wishlist item removed successfully' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Error deleting wishlist item' });
            }
        });

        // get offer data by id
        //get property by id
        app.get('/offer/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistsCollection.findOne(query)
            res.send(result)
        })

        //   save offers 
        app.post('/offers', async (req, res) => {
            const offers = req.body;
            const result = await offersCollection.insertOne(offers)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db('admin').command({ ping: 1 })
        // console.log(
        //     'Pinged your deployment. You successfully connected to MongoDB!'
        // )
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello from RealScape Server..')
})

app.listen(port, () => {
    console.log(`plantNet is running on port ${port}`)
})