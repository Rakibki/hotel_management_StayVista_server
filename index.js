const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 4000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);


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

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  const database = client.db("stayVista_DB");
  const usersCollection = database.collection("usersCollection");
  const roomsCollection = database.collection("roomsCollection");
  const bookingsCollection = database.collection("bookingsCollection");
  try {
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
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
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }

      const isExist = await usersCollection.findOne(query)
      if (isExist) return res.send(isExist)
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      )
      res.send(result)
    })

    // get All Rooms
    app.get("/rooms", async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.send(result)
    })

    // get single room
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await roomsCollection.findOne(query);
      res.send(result)
    })

    // added room
    app.post("/rooms", async(req, res) => {
      const room = req.body;
      const result = await roomsCollection.insertOne(room)
      res.send(result)
    })

    // get Room for admin
    app.get("/rooms/:email", async (req, res) => {
      const email = req.params.email;
      const filter = {'host.email': email}
      const result = await roomsCollection.find(filter).toArray();
      res.send(result)
    })

    // get user role
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      console.log("fiitr");
      console.log(email);
      const filter = {email: email}
      const result = await usersCollection.findOne(filter) 
      console.log(result);
      res.send(result)
    })

    // payment
    app.post("/carete-payment-intent", async (req, res) => {
      const {price} = req.body;
      const ammout = parseInt(price * 100);
      // if(price > 0 || ammout) return;
      console.log(ammout)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: ammout,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

  // bookigs
    app.post("/bookings", async (req, res) => {
      const bookData = req.body;
      const result = await bookingsCollection.insertOne(bookData)
      res.send(result)
    })

    // update room
    app.patch("/room-status/:id", async(req, res) => {
      const id = req.params.id;
      console.log(id);
      const {status} = req.body;
      const query = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          booked: status
        }
      }
      const result = await roomsCollection.updateOne(query, updatedDoc)
      res.send(result)
    })

    // getMyBookings
     app.get("/my-bookings/:email", async(req, res) => {
      const email = req.params.email;
      const filter = {'guest.email': email}
      const result = await bookingsCollection.find(filter).toArray();
      res.send(result);
     })

     app.get("/managege-booking/:email", async (req, res) => {
      const email = req.params.email;
      const filter = {host: email};
      const result = await bookingsCollection.find(filter).toArray();
      res.send(result)
     })

     app.get("/users", async(req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
     })

     app.put("/user/update-Role/:role", async(req, res) => {
      const email = req.params.id;
      const user = req.body;
      const filter = { email: email };

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now()
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.send(result)
     })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})