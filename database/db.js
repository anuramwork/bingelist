const Pool = require("pg").Pool

const pool = new Pool({
  user: "postgres",
  password: "2709",
  host: "localhost",
  port: 5432,
  database: "bingelists",
})

module.exports = pool
