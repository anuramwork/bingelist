// import the express module
const express = require("express")

// importing the controllers
const {
  create_list,
  add_movie_list,
  remove_movie_list,
  discover,
  search,
  delete_list,
  view_list,
  similar_content,
  watched_or_faved,
  add_to_watchlist,
  add_to_favlist,
  lists,
  movie_details
} = require("../controllers/controllers_bingelist")


// creating the router object
const router = express.Router()

// all routes
router.route("/create_list").post(create_list)
router.route("/add_movie_list").post(add_movie_list)
router.route("/remove_movie_list").post(remove_movie_list)
router.route("/discover").get(discover)
router.route("/search").get(search)
router.route("/delete_list").post(delete_list)
router.route("/view_list").get(view_list)
router.route("/similar_content").get(similar_content)
router.route("/watched_or_faved").post(watched_or_faved)
router.route("/add_to_watchlist").post(add_to_watchlist)
router.route("/add_to_favlist").post(add_to_favlist)
router.route("/lists").get(lists)
router.route("/movie_details").get(movie_details)
module.exports = router
