// import the express module
const express = require("express")

// importing the controllers
const {
  create_list,
  add_movie_list,
  remove_movie_list,
  discover,
  search_movie,
  delete_list,
  view_list,
  similar_content,
} = require("../controllers/controllers_bingelist")

// creating the router object
const router = express.Router()

// all routes
router.route("/create_list").post(create_list)
router.route("/add_movie_list").post(add_movie_list)
router.route("/remove_movie_list").post(remove_movie_list)
router.route("/discover").get(discover)
router.route("/search_movie").get(search_movie)
router.route("/delete_list").post(delete_list)
router.route("/view_list").get(view_list)
router.route("/similar_content").post(similar_content)
module.exports = router
