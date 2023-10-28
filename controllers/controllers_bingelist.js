// import the express module
const express = require("express")

// import the axios module for api calling
const axios = require("axios")

// import postgre database
const pool = require("../database/db")

const app = express()

// supporting functions
const watched = async (movieId, userId) => {
  try {
    var watchId = await pool.query(
      "SELECT watch_lid FROM users WHERE user_id =$1",
      [userId]
    )
    watchId = watchId.rows[0].watch_lid
    // console.log(watchId)
    const isWatched = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM list_movies WHERE movie_id = $1 AND list_id = $2)",
      [movieId, watchId]
    )
    // console.log(isWatched)
    ret = isWatched.rows[0].exists

    return ret
  } catch (err) {
    console.error(err.message)
  }
}

const favourite = async (movieId, userId) => {
  try {
    var favId = await pool.query(
      "SELECT fav_lid FROM users WHERE user_id =$1",
      [userId]
    )
    favId = favId.rows[0].fav_lid
    //   console.log(favId)
    const isFaved = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM list_movies WHERE movie_id = $1 AND list_id = $2)",
      [movieId, favId]
    )
    ret = isFaved.rows[0].exists
    //   console.log(ret)
    return ret
  } catch (err) {
    console.error(err.message)
  }
}

// Controllers for the corresponding routes
const create_list = async (req, res) => {
  try {
    const listName = req.query.listName
    const userId = req.query.userId
    const listEmoji = req.query.listEmoji
    const newList = await pool.query(
      "INSERT INTO lists (name, list_emoji, user_id) VALUES ($1, $2, $3) RETURNING *",
      [listName, listEmoji, userId]
    )
    // console.log()
    const newUserList = await pool.query(
      "INSERT INTO user_list (user_id, list_id) VALUES ($1, $2)",
      [userId, newList.rows[0].id]
    )
    res.send("List created successfully")
  } catch (err) {
    console.error(err.message)
  }
}

const add_movie_list = async (req, res) => {
  try {
    const listId = req.query.listId
    const movieId = req.query.movieId
    const userId = req.query.userId
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )
    // console.log(existObject.rows[0].exists)
    if (existObject.rows[0].exists == true) {
      const addMovie = await pool.query(
        "INSERT INTO list_movies (list_id, movie_id) VALUES ($1, $2)",
        [listId, movieId]
      )
      res.send("Movie added successfully")
    } else {
      res.send("Incorrect list id")
    }
  } catch (err) {
    console.error(err.message)
  }
}

const remove_movie_list = async (req, res) => {
  try {
    const listId = req.query.listId
    const movieId = req.query.movieId
    const userId = req.query.userId
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )
    if (existObject.rows[0].exists == true) {
      const removeMovie = await pool.query(
        "DELETE FROM list_movies WHERE movie_id = $1 AND list_id = $2",
        [movieId, listId]
      )
      res.send("movie removed from list sucessfully")
    } else {
      res.send("list doesn't exist")
    }
  } catch (err) {
    console.error(err.message)
  }
}

const discover = async (req, res) => {
  try {
    const userId = req.query.userId
    const trending_API_URL =
      "https://api.themoviedb.org/3/trending/all/week?language=en-US"
    const upcoming_API_URL =
      "https://api.themoviedb.org/3/movie/upcoming?language=en-US&page=1"
    const popular_API_URL =
      "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1"
    const API_TOKEN =
      "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
    const trendingObject = await axios.get(trending_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const upcomingObject = await axios.get(upcoming_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const popularObject = await axios.get(popular_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    var resultList = {}
    var movie = {
    }
    resultList["trending"] = trendingObject.data.results.map(item=>{
        return {
            adult:item.adult,
            id:item.id,
            title:title.id,
            language:item.original_language,
            poster_path:item.psoter_path,
            media_type:item.media_type,
            genre_ids:item.genre_ids,
            release_date:item.release_date,
            vote_average:item.vote_average,
            watched:item.watched,
            fav:item.fav
        }
    })
    resultList["popular"] = popularObject.data.results
    resultList["upcoming"] = upcomingObject.data.results
    for (let i = 0; i < resultList["trending"].length; i++) {
      var watch = await watched(resultList["trending"][i]["id"], userId)
      resultList["trending"][i]["watched"] = watch
      var fav = await favourite(resultList["trending"][i]["id"], userId)
      resultList["trending"][i]["fav"] = fav
    }
    for (let i = 0; i < resultList["popular"].length; i++) {
      var watch = await watched(resultList["popular"][i]["id"], userId)
      resultList["popular"][i]["watched"] = watch
      var fav = await favourite(resultList["popular"][i]["id"], userId)
      resultList["popular"][i]["fav"] = fav
    }
    for (let i = 0; i < resultList["upcoming"].length; i++) {
      var watch = await watched(resultList["upcoming"][i]["id"], userId)
      resultList["upcoming"][i]["watched"] = watch
      var fav = await favourite(resultList["upcoming"][i]["id"], userId)
      resultList["upcoming"][i]["fav"] = fav
    }
    res.send(resultList)
  } catch (err) {
    console.error(err.message)
  }
}

const search_movie = async (req, res) => {
  try {
    const movieName = req.query.movieName
    console.log(movieName)
    const API_URL =
      "https://api.themoviedb.org/3/search/multi?query=" +
      movieName +
      "&include_adult=false&language=en-US&page=1"
    const API_TOKEN =
      "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
    const movieObject = await axios.get(API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const movieList = movieObject.data.results
    console.log(movieList)
    res.json(movieList)
  } catch (err) {
    console.error(err.message)
  }
}

const delete_list = async (req, res) => {
  try {
    const listId = req.query.listId
    const userId = req.query.userId
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )
    if (existObject.rows[0].exists == true) {
      const removeListmovies = await pool.query(
        "DELETE FROM list_movies WHERE list_id = $1",
        [listId]
      )
      const removeUserlist = await pool.query(
        "DELETE FROM user_list WHERE list_id = $1",
        [listId]
      )
      const removeLists = await pool.query("DELETE FROM lists WHERE id = $1", [
        listId,
      ])
      res.send("list removed sucessfully")
    } else {
      res.send("list doesn't exist")
    }
  } catch (err) {
    console.error(err.message)
  }
}

const view_list = async (req, res) => {
  try {
    const listId = req.query.listId
    const userId = req.query.userId
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )
    if (existObject.rows[0].exists == true) {
      const viewList = await pool.query(
        "SELECT movie_id FROM list_movies WHERE list_id = $1",
        [listId]
      )
      res.json(viewList.rows)
    } else {
      res.send("list doesn't exist")
    }
  } catch (err) {
    console.error(err.message)
  }
}

const similar_content = async (req, res) => {
  try {
    const movieId = req.query.movieId
    const type = req.query.type
    if (type == 0) {
      // movies
      const API_URL =
        "https://api.themoviedb.org/3/movie/278/similar?language=en-US&page=1"
      const API_TOKEN =
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
      const response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          Authorization: API_TOKEN,
        },
      })
      const data = response.data
      res.json(data)
    } //web series
    else {
      const API_URL =
        "https://api.themoviedb.org/3/tv/series_id/similar?language=en-US&page=1"
      const API_TOKEN =
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
      const response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          Authorization: API_TOKEN,
        },
      })
      const data = response.data
      res.json(data)
    }
  } catch (err) {
    console.error(err.message)
  }
}

module.exports = {
  create_list,
  add_movie_list,
  remove_movie_list,
  view_list,
  discover,
  search_movie,
  delete_list,
  similar_content,
}
