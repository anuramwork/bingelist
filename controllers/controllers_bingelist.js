// import the express module
const express = require("express")

// import the axios module for api calling
const axios = require("axios")

// uuid package to generate  universally unique identifiers (UUIDs)
const { v4: uuidv4 } = require("uuid")

// import postgre database
const pool = require("../database/db")

// importing constants
const constants = require('../constant')

// SUPPORTING FUNCTIONS
const watched = async (movieId, userId, type) => {
  try {
    var watchId = await pool.query(
      "SELECT watch_lid FROM users WHERE user_id =$1",
      [userId]
    )
    watchId = watchId.rows[0].watch_lid
    const isWatched = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM list_movies WHERE movie_id = $1 AND list_id = $2 AND type = $3)",
      [movieId, watchId, type]
    )
    ret = isWatched.rows[0].exists
    return ret
  } catch (err) {
    console.error(err.message)
  }
}

const favourite = async (movieId, userId, type) => {
  try {
    var favId = await pool.query(
      "SELECT fav_lid FROM users WHERE user_id =$1",
      [userId]
    )
    favId = favId.rows[0].fav_lid
    const isFaved = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM list_movies WHERE movie_id = $1 AND list_id = $2 AND type = $3)",
      [movieId, favId, type]
    )
    ret = isFaved.rows[0].exists
    return ret
  } catch (err) {
    console.error(err.message)
  }
}

const transformItems = (items, type, poster_path) => {
  return items.map((item) => {
    return {
      adult: item.adult,
      id: item.id,
      title: item.title || item.name,
      language: item.original_language,
      poster_path: poster_path + item.poster_path,
      media_type: item.media_type || type,
      genre_ids: item.genre_ids,
      release_date: item.release_date || item.first_air_date,
      vote_average: item.vote_average,
    }
  })
}
const get_details = async (movieId, media_type) => {
  const API_URL =
    "https://api.themoviedb.org/3/" +
    media_type +
    "/" +
    movieId +
    "?language=en-US&append_to_response=videos,credits"
  const API_TOKEN =
    "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
  const detailObject = await axios.get(API_URL, {
    headers: {
      accept: "application/json",
      Authorization: API_TOKEN,
    },
  })
  const movieDetails = detailObject.data
  ret = transformDetailItems(movieDetails, media_type)
  return ret
}

const transformDetailItems = (item, media_type) => {
  const poster_path = "https://image.tmdb.org/t/p/w500/"
  var language = {
    name: item.spoken_languages[0].english_name,
    iso_code: item.spoken_languages[0].iso_639_1,
  }
  var country = item.production_companies[0].origin_country
  var credits = []
  var casts = []
  for (var i = 0; i < Math.min(item.credits.cast.length, 8); i++) {
    casts.push({
      name: item.credits.cast[i].name,
      role: item.credits.cast[i].character,
      img_url: poster_path + item.credits.cast[i].profile_path,
    })
  }
  for (var i = 0; i < item.credits.crew.length; i++) {
    if (item.credits.crew[i].job == "Director") {
      credits.push({ title: "Director", name: item.credits.crew[i].name })
    }
    if (item.credits.crew[i].job == "Director of Photography") {
      credits.push({
        title: "Cinematography",
        name: item.credits.crew[i].name,
      })
    }
  }
  for (var i = 0; i < item?.created_by?.length; i++) {
    credits.push({
      title: "Creator",
      name: item?.created_by[i].name,
    })
  }
  const trailer_path = "https://www.youtube.com/watch?v="
  for (var i = 0; i < item?.videos?.results?.length; i++) {
    if (
      item?.videos?.results[i]?.type == "Trailer" &&
      item?.videos?.results[i]?.site == "YouTube"
    ) {
      var trailer = trailer_path + item?.videos?.results[i]?.key
      break
    }
  }
  return {
    adult: item.adult,
    id: item.id,
    title: item.title || item.name,
    language: language,
    poster_path: poster_path + item.poster_path,
    media_type: media_type,
    genres: item.genres,
    release_date: item.release_date || item.first_air_date,
    vote_average: item.vote_average,
    duration: item?.runtime,
    seasons: item?.seasons?.length,
    last_air_date: item?.last_air_date,
    synopsis: item.overview,
    country: country,
    credits: credits,
    casts: casts,
    trailer_url: trailer,
  }
}

// Controllers for the corresponding routes
const create_list = async (req, res) => {
  try {
    const list_id = uuidv4()
    console.log(list_id)
    const listName = req.query.listName
    // const userId = req.query.userId
    const userId = 1
    const listEmoji = req.query.listEmoji

    const newList = await pool.query(
      "INSERT INTO lists (list_id, name, list_emoji, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [list_id, listName, listEmoji, userId]
    )
    const newUserList = await pool.query(
      "INSERT INTO user_list (user_id, list_id) VALUES ($1, $2)",
      [userId, newList.rows[0].list_id]
    )
    ret = {
      listId: newList.rows[0].list_id,
      created: newList.rows[0].created_at,
      modified: newList.rows[0].updated_at,
      name: listName,
      count: 0,
      emoji: listEmoji,
    }
    console.log(ret)
    res.json(ret)
  } catch (err) {
    console.error(err.message)
  }
}
// incomplete
const add_movie_list = async (req, res) => {
  try {
    const listId = req.query.listId
    const movieId = req.query.movieId
    const userId = req.query.userId
    const type = req.query.media_type
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )
    if (existObject.rows[0].exists == true) {
      const addMovie = await pool.query(
        "INSERT INTO list_movies (list_id, movie_id, type ) VALUES ($1, $2 $3)",
        [listId, movieId, type]
      )
      res.send("Movie added successfully")
    } else {
      res.send("Incorrect list id")
    }
  } catch (err) {
    console.error(err.message)
  }
}
// incomplete
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
    const trending_API_URL =
      "https://api.themoviedb.org/3/trending/all/week?language=en-US"
    const upcomingMovie_API_URL =
      "https://api.themoviedb.org/3/movie/upcoming?language=en-US&page=1"
    const popularMovie_API_URL =
      "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1"
    const upcomingTV_API_URL =
      "https://api.themoviedb.org/3/tv/on_the_air?language=en-US&page=1"
    const popularTV_API_URL =
      "https://api.themoviedb.org/3/tv/popular?language=en-US&page=1"
    const API_TOKEN =
      "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
    const trendingObject = await axios.get(trending_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const upcomingObjectMovie = await axios.get(upcomingMovie_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const popularObjectMovie = await axios.get(popularMovie_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const popularObjectTV = await axios.get(popularTV_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const upcomingObjectTV = await axios.get(upcomingTV_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const poster_path = "https://image.tmdb.org/t/p/w500/"
    var resultList = {}
    resultList["upcoming"] = {}
    resultList["popular"] = {}

    resultList["trending"] = transformItems(
      trendingObject.data.results,
      "movie",
      poster_path
    )
    resultList["upcoming"]["movies"] = transformItems(
      upcomingObjectMovie.data.results,
      "movie",
      poster_path
    )
    resultList["upcoming"]["tv"] = transformItems(
      upcomingObjectTV.data.results,
      "tv",
      poster_path
    )
    resultList["popular"]["movies"] = transformItems(
      popularObjectMovie.data.results,
      "movie",
      poster_path
    )
    resultList["popular"]["tv"] = transformItems(
      popularObjectTV.data.results,
      "tv",
      poster_path
    )

    res.send(resultList)
  } catch (err) {
    console.error(err.message)
  }
}

const search = async (req, res) => {
  try {
    const searchQuery = req.query.searchQuery
    const type = req.query.type
    var pageNo = req.query.pageNo
    if (pageNo == undefined) {
      pageNo = 1
    }
    var API_URL
    if (type == "all") {
      API_URL =
        "https://api.themoviedb.org/3/search/multi?query=" +
        searchQuery +
        "&include_adult=false&language=en-US&page=" +
        pageNo
    } else if (type == "movie") {
      API_URL =
        "https://api.themoviedb.org/3/search/movie?query=" +
        searchQuery +
        "&include_adult=false&language=en-US&page=" +
        pageNo
    } else if (type == "tv") {
      API_URL =
        "https://api.themoviedb.org/3/search/tv?query=" +
        searchQuery +
        "&include_adult=false&language=en-US&page=" +
        pageNo
    }
    const API_TOKEN =
      "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
    const searchQueryObject = await axios.get(API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    const poster_path = "https://image.tmdb.org/t/p/w500/"
    searchQueryObject.data.results = transformItems(
      searchQueryObject.data.results,
      type,
      poster_path
    )
    const contentList = searchQueryObject.data
    res.json(contentList)
  } catch (err) {
    console.error(err.message)
    res.send("request failed")
  }
}
// incomplete
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
// incomplete
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

const lists = async (req, res) => {
  try {
    // const userId = req.query.userId
    const userId = 1
    const fav_lid = "26653342-767f-11ee-b962-0242ac120002"
    const watch_lid = "129dc522-767f-11ee-b962-0242ac120002"
    const listMovies = await pool.query(
      "SELECT list_id, name, list_emoji, created_at, updated_at, user_id FROM lists WHERE user_id=$1",
      [userId]
    )
    // console.log(listMovies.rows)
    ret = []
    for (var i = 0; i < listMovies?.rows?.length; i++) {
      if (
        listMovies.rows[i].list_id != fav_lid &&
        listMovies.rows[i].list_id != watch_lid
      ) {
        const count = await pool.query(
          "SELECT COUNT(movie_id) FROM list_movies WHERE list_id=$1",
          [listMovies.rows[i].list_id]
        )
        ret.push({
          listId: listMovies.rows[i].list_id,
          created: listMovies.rows[i].created_at,
          modified: listMovies.rows[i].updated_at,
          name: listMovies.rows[i].name,
          count: parseInt(count.rows[0].count),
          emoji: listMovies.rows[i].list_emoji,
        })
      }
    }
    res.json(ret)
  } catch (err) {
    console.error(err.message)
  }
}

const similar_content = async (req, res) => {
  try {
    const contentId = req.query.movieId
    const type = req.query.media_type
    var response
    if (type == "movie") {
      // movies
      const API_URL =
        "https://api.themoviedb.org/3/movie/" +
        contentId +
        "/similar?language=en-US&page=1"
      const API_TOKEN =
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
      response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          Authorization: API_TOKEN,
        },
      })
    } //web series
    else {
      const API_URL =
        "https://api.themoviedb.org/3/tv/" +
        contentId +
        "/similar?language=en-US&page=1"
      const API_TOKEN =
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmMzOTA3Yzg2YjdmNTBkZjQxY2FlN2E4NjZjNzgzMCIsInN1YiI6IjY1M2JkOGU0NTkwN2RlMDBmZTFkZmUzNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4LxqLxytdxDhDCnbIr7YTwXnRUmXRzSpBkG42ERgxZs"
      response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          Authorization: API_TOKEN,
        },
      })
    }
    const poster_path = "https://image.tmdb.org/t/p/w500/"
    var similarContent = response.data.results
    similarContent = transformItems(similarContent, type, poster_path)
    res.json(similarContent)
  } catch (err) {
    console.error(err.message)
  }
}

const add_to_watchlist = async (req, res) => {
  try {
    const movieId = req.query.id
    //const userId = req.query.userId
    const userId = 1
    const type = req.query.media_type
    var isWatched = await watched(movieId, userId, type)
    const watchObject = await pool.query(
      "SELECT watch_lid FROM users WHERE user_id = $1",
      [userId]
    )
    const watchId = watchObject.rows[0].watch_lid
    //Insert into list_movies
    console.log(isWatched)
    if (isWatched == false) {
      const insertMovie = await pool.query(
        "INSERT INTO list_movies (list_id, movie_id, type) VALUES ($1, $2, $3)",
        [watchId, movieId, type]
      )
    } else {
      const insertMovie = await pool.query(
        "DELETE FROM list_movies WHERE list_id = $1 AND movie_id=$2 AND type=$3",
        [watchId, movieId, type]
      )
    }
    var isFaved = await favourite(movieId, userId, type)
    var watch_fav_list = {}
    var key = type + "_" + movieId
    watch_fav_list[key] = {
      id: movieId,
      media_type: type,
      faved: isFaved,
      watched: !isWatched,
    }
    res.json(watch_fav_list)
  } catch (err) {
    console.error(err.message)
  }
}

const add_to_favlist = async (req, res) => {
  try {
    const movieId = req.query.id
    //const userId = req.query.userId
    const userId = 1
    const type = req.query.media_type
    var isFaved = await favourite(movieId, userId, type)
    const favObject = await pool.query(
      "SELECT fav_lid FROM users WHERE user_id = $1",
      [userId]
    )
    const favId = favObject.rows[0].fav_lid
    //Insert into list_movies
    if (isFaved == false) {
      const insertMovie = await pool.query(
        "INSERT INTO list_movies (list_id, movie_id, type) VALUES ($1, $2, $3)",
        [favId, movieId, type]
      )
    } else {
      const insertMovie = await pool.query(
        "DELETE FROM list_movies WHERE list_id = $1 AND movie_id=$2 AND type=$3",
        [favId, movieId, type]
      )
    }
    var isWatched = await watched(movieId, userId, type)
    var watch_fav_list = {}
    var key = type + "_" + movieId
    watch_fav_list[key] = {
      id: movieId,
      media_type: type,
      faved: !isFaved,
      watched: isWatched,
    }
    res.json(watch_fav_list)
  } catch (err) {
    console.error(err.message)
  }
}

const watched_or_faved = async (req, res) => {
  try {
    const movieList = req.body.movieList
    const userId = 1
    var watch_fav_list = {}
    for (let i = 0; i < movieList.length; i++) {
      var isWatched = await watched(
        movieList[i].id,
        userId,
        movieList[i].media_type
      )
      var isFaved = await favourite(
        movieList[i].id,
        userId,
        movieList[i].media_type
      )
      var key = movieList[i].media_type + "_" + movieList[i].id
      watch_fav_list[key] = {
        id: movieList[i].id,
        media_type: movieList[i].media_type,
        faved: isFaved,
        watched: isWatched,
      }
    }
    res.json(watch_fav_list)
  } catch (err) {
    console.error(err.message)
  }
}

const movie_details = async (req, res) => {
  try {
    const movieId = req.query.id
    const media_type = req.query.media_type
    ret = await get_details(movieId, media_type)
    console.log(ret)
    res.json(ret)
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
  search,
  delete_list,
  similar_content,
  watched_or_faved,
  add_to_watchlist,
  add_to_favlist,
  lists,
  movie_details,
}
