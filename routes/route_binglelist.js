// import the express module
const express = require("express")

// importing the controllers
const {
  create_list,
  add_movie_list,
  get_movie_lists,
  discover,
  delete_list,
  list_details,
  similar,
  watched_or_faved,
  add_to_watchlist,
  add_to_favlist,
  lists,
  movie_details,
  edit_list,
  checkJwt,
  sign_in,
  quick_search,
  random,
  filter_settings,
  add_one_movie_to_list,
  browse,
} = require("../controllers/controllers_bingelist")

// creating the router object
const router = express.Router()

// all routes
router.route("/create_list").post(checkJwt, create_list)
router.route("/add_movie_list").post(checkJwt, add_movie_list)
router.route("/discover").get(discover)
router.route("/delete_list").post(checkJwt, delete_list)
router.route("/list_details").get(checkJwt, list_details)
router.route("/similar").get(similar)
router.route("/watched_or_faved").post(checkJwt, watched_or_faved)
router.route("/add_to_watchlist").post(checkJwt, add_to_watchlist)
router.route("/add_to_favlist").post(checkJwt, add_to_favlist)
router.route("/lists").get(checkJwt, lists)
router.route("/movie_details").get(movie_details)
router.route("/edit_list").post(checkJwt, edit_list)
router.route("/get_movie_lists").get(checkJwt, get_movie_lists)
router.route("/quick_search").get(quick_search)
router.route("/random").post(random)
router.route("/filter_settings").get(filter_settings)
router.route("/browse").post(browse)
router.route("/add_one_movie_to_list").get(checkJwt, add_one_movie_to_list)
router.route("/sign_in").post(checkJwt, sign_in)
module.exports = router
