// importing the express module
const express = require("express")

// importing dotenv module
const dotenv = require("dotenv").config()

// instance of the main express application or object
const app = express()

// retreive port value from environmental variables
const port = process.env.PORT

app.use(require("./routes/route_binglelist"))

// listen for incoming requests
app.listen(port, () => {
  console.log("Server running successfully on port", port)
})
