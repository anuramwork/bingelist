// import the express module
const express = require("express")

// import the axios module for api calling
const axios = require("axios")

// uuid package to generate  universally unique identifiers (UUIDs)
const { v4: uuidv4 } = require("uuid")

// import postgre database
const pool = require("../database/db")

// importing constants
const constants = require("../constant")

// import supporting functions
const supportFunctions = require("../supporting_functions")

const jsonwebtoken = require("jsonwebtoken")
const { expressjwt: jwt } = require("express-jwt")
const jwksRsa = require("jwks-rsa")

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs", // Google's public key URL
    cache: true,
    rateLimit: true,
  }),
  audience:
    "524308456980-3d17hpn4h6qhdnn32oap5q52uta8gbsa.apps.googleusercontent.com", // Replace with your Google Client ID
  issuer: "https://accounts.google.com", // The issuer should be Google
  algorithms: ["RS256"], // Use the RS256 algorithm
})

const sign_in = async (req, res) => {
  try {
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const email = token.payload.email
    const name = token.payload.name
    const picture = token.payload.picture
    const checkUser = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM users WHERE user_id = $1)",
      [email]
    )
    if (checkUser.rows[0].exists == false) {
      const userId = email
      const fav_lid = uuidv4()
      const watch_lid = uuidv4()
      const newUser = await pool.query(
        "INSERT INTO users (user_id, name, picture) VALUES ($1, $2, $3)",
        [userId, name, picture]
      )
      const lists = await pool.query(
        "INSERT INTO lists (list_id, name, list_emoji, user_id) VALUES ($1, 'Watched', $2, $3), ($4, 'Favourites', $5, $6)",
        [
          watch_lid,
          constants.watch_emoji,
          userId,
          fav_lid,
          constants.fav_emoji,
          userId,
        ]
      )
      const newUserList = await pool.query(
        "INSERT INTO user_list (user_id, list_id) VALUES ($1, $2), ($3, $4)",
        [userId, watch_lid, userId, fav_lid]
      )
      const alterUserList = await pool.query(
        "UPDATE users SET watch_lid = $1, fav_lid = $2 WHERE user_id = $3",
        [watch_lid, fav_lid, userId]
      )
      const ret = {
        name: name,
        picture: picture,
        email: email,
        fav_lid: fav_lid,
        watch_lid: watch_lid,
      }
      console.log(ret)
      res.json(ret)
    } else {
      const userObj = await pool.query(
        "SELECT fav_lid, watch_lid FROM users WHERE user_id = $1",
        [email]
      )
      const fav_lid = userObj.rows[0].fav_lid
      const watch_lid = userObj.rows[0].watch_lid
      const ret = {
        name: name,
        picture: picture,
        email: email,
        fav_lid: fav_lid,
        watch_lid: watch_lid,
      }
      console.log(ret)
      res.json(ret)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
}

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

const transformItems = (items, type) => {
  return items
    .filter((item) => item.media_type != "person")
    .map((item) => {
      return {
        adult: item.adult,
        id: item.id,
        title: item.title || item.name,
        language: item.original_language,
        poster_path: constants.posterPath + item.poster_path,
        media_type: item.media_type || type,
        genre_ids: item.genre_ids,
        release_date: item.release_date || item.first_air_date,
        vote_average: item.vote_average,
        duration: item?.runtime,
      }
    })
}
const getDetails = async (movieId, media_type) => {
  // console.log(movieId, media_type)
  const API_URL =
    "https://api.themoviedb.org/3/" +
    media_type +
    "/" +
    movieId +
    "?language=en-US&append_to_response=videos,credits"
  const API_TOKEN = constants.API_TOKEN
  const detailObject = await axios.get(API_URL, {
    headers: {
      accept: "application/json",
      Authorization: API_TOKEN,
    },
  })
  const movieDetails = detailObject.data
  // console.log(movieDetails)
  ret = transformDetailItems(movieDetails, media_type)
  return ret
}

const transformDetailItems = (item, media_type) => {
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
      img_url: constants.posterPath + item.credits.cast[i].profile_path,
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
    poster_path: constants.posterPath + item.poster_path,
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
const getWatchId = async (userId) => {
  try {
    var watchObject = await pool.query(
      "SELECT watch_lid FROM users WHERE user_id =$1",
      [userId]
    )
    watchId = watchObject.rows[0].watch_lid
    return watchId
  } catch (err) {
    console.error(err.message)
  }
}
const getfavId = async (userId) => {
  try {
    var favObject = await pool.query(
      "SELECT fav_lid FROM users WHERE user_id =$1",
      [userId]
    )
    favId = favObject.rows[0].fav_lid
    return favId
  } catch (err) {
    console.error(err.message)
  }
}

// Controllers for the corresponding routes
const create_list = async (req, res) => {
  try {
    const list_id = uuidv4()
    const listName = req.query.listName
    // const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
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
    res.json(ret)
  } catch (err) {
    console.error(err.message)
  }
}
const add_movie_list = async (req, res) => {
  try {
    const allList = req.body
    // console.log(allList.length)
    const movieId = req.query.id
    //const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    const type = req.query.media_type
    const userObject = await pool.query(
      "SELECT fav_lid, watch_lid FROM users WHERE user_id=$1",
      [userId]
    )
    const favLId = userObject.rows[0].fav_lid
    const watchLId = userObject.rows[0].watch_lid
    for (key in allList) {
      var listId = key
      var status = allList[key]
      const existObject = await pool.query(
        "SELECT EXISTS( SELECT 1 FROM user_list WHERE user_id =$1 AND list_id =$2)",
        [userId, listId]
      )
      var exists = existObject.rows[0].exists
      if (exists == true && listId != favLId && listId != watchLId) {
        if (status == true) {
          const addMovie = await pool.query(
            "INSERT INTO list_movies (list_id,movie_id,type) VALUES ($1,$2,$3)",
            [listId, movieId, type]
          )
        } else {
          const deleteMovie = await pool.query(
            "DELETE FROM list_movies WHERE movie_id =$1 AND type = $2",
            [movieId, type]
          )
        }
      }
    }
    res.sendStatus(200)
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
const get_movie_lists = async (req, res) => {
  var allList = {}
  try {
    const movieId = req.query.id
    //const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    const type = req.query.media_type
    const watchId = await getWatchId(userId)
    const favId = await getfavId(userId)
    const listObject = await pool.query(
      "SELECT list_id FROM user_list WHERE user_id = $1 AND list_id != $2 AND list_id !=$3",
      [userId, watchId, favId]
    )
    for (var i = 0; i < listObject.rows.length; i++) {
      const isExistObject = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM list_movies WHERE list_id = $1 AND movie_id = $2 AND type=$3)",
        [listObject.rows[i].list_id, movieId, type]
      )
      isExits = isExistObject.rows[0].exists
      allList[listObject.rows[i].list_id] = isExits
    }
    res.json(allList)
  } catch (err) {
    res.json(allList)
    console.error(err.message)
  }
}

const quick_search = async (req, res) => {
  try {
    const type = "___"
    const searchQuery = req.query.query
    API_URL =
      "https://api.themoviedb.org/3/search/multi?query=" +
      searchQuery +
      "&include_adult=false&language=en-US&page=1"
    const API_TOKEN = constants.API_TOKEN
    const searchQueryObject = await axios.get(API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    // console.log(searchQueryObject.data.results)
    searchQueryObject.data.results = transformItems(
      searchQueryObject.data.results.slice(0, 10),
      type
    )
    const contentList = searchQueryObject.data.results
    // console.log(contentList)
    res.json(contentList)
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
    const API_TOKEN = constants.API_TOKEN
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
    var resultList = {}
    resultList["upcoming"] = {}
    resultList["popular"] = {}

    resultList["trending"] = transformItems(
      trendingObject.data.results,
      "movie"
    )
    resultList["upcoming"]["movies"] = transformItems(
      upcomingObjectMovie.data.results,
      "movie"
    )
    resultList["upcoming"]["tv"] = transformItems(
      upcomingObjectTV.data.results,
      "tv"
    )
    resultList["popular"]["movies"] = transformItems(
      popularObjectMovie.data.results,
      "movie"
    )
    resultList["popular"]["tv"] = transformItems(
      popularObjectTV.data.results,
      "tv"
    )

    res.send(resultList)
  } catch (err) {
    console.error(err.message)
  }
}
const random = async (req, res) => {
  try {
  } catch (err) {
    console.err(err.message)
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
    const API_TOKEN = constants.API_TOKEN
    const searchQueryObject = await axios.get(API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    console.log(searchQuery.data.results)
    searchQueryObject.data.results = transformItems(
      searchQueryObject.data.results,
      type
    )
    const contentList = searchQueryObject.data
    res.json(contentList)
  } catch (err) {
    console.error(err.message)
    res.send("request failed")
  }
}
const delete_list = async (req, res) => {
  try {
    const listId = req.query.listId
    //const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    var response = {}
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
      const removeLists = await pool.query(
        "DELETE FROM lists WHERE list_id = $1",
        [listId]
      )
      response["deleted"] = true
      res.json(response)
    } else {
      response["deleted"] = false
      res.json(response)
    }
  } catch (err) {
    console.error(err.message)
  }
}
const edit_list = async (req, res) => {
  try {
    const listId = req.query.listId
    //const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    const listName = req.query.listName
    const listEmoji = req.query.listEmoji
    var response = {}
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )

    if (existObject.rows[0].exists == true) {
      var updatedList = await pool.query(
        "UPDATE lists SET name = $1, list_emoji =$2 WHERE list_id =$3 RETURNING *",
        [listName, listEmoji, listId]
      )
      const count = await pool.query(
        "SELECT COUNT(movie_id) FROM list_movies WHERE list_id=$1",
        [listId]
      )
      response = {
        listId: listId,
        created: updatedList.rows[0].created_at,
        modified: updatedList.rows[0].updated_at,
        name: listName,
        count: parseInt(count.rows[0].count),
        emoji: listEmoji,
      }
      res.json(response)
    } else {
      res.sendStatus(500)
    }
  } catch (err) {
    console.error(err.message)
  }
}
// incomplete
const list_details = async (req, res) => {
  try {
    const listId = req.query.listId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    const existObject = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)",
      [userId, listId]
    )
    if (existObject.rows[0].exists == true) {
      const listObject = await pool.query(
        "SELECT * FROM lists WHERE list_id = $1",
        [listId]
      )
      var ret = {
        listId: listObject.rows[0].list_id,
        emoji: listObject.rows[0].list_emoji,
        name: listObject.rows[0].name,
        userId: listObject.rows[0].user_id,
        createdAt: listObject.rows[0].created_at,
        updatedAt: listObject.rows[0].updated_at,
      }
      ret["movies"] = []
      const viewList = await pool.query(
        "SELECT movie_id, type FROM list_movies WHERE list_id = $1",
        [listId]
      )
      var count = viewList.rows.length
      ret["count"] = count
      // console.log(count)
      var movieItems = []
      for (var i = 0; i < count; i++) {
        console.log(i, count)
        var media_type = viewList.rows[i].type
        var movie_id = viewList.rows[i].movie_id
        console.log(media_type, movie_id)
        const API_URL =
          "https://api.themoviedb.org/3/" +
          media_type +
          "/" +
          movie_id +
          "?language=en-US"
        const API_TOKEN = constants.API_TOKEN
        var detailObject = await axios.get(API_URL, {
          headers: {
            accept: "application/json",
            Authorization: API_TOKEN,
          },
        })
        var movieDetails = detailObject.data
        // console.log(movieDetails)
        movieDetails["genre_ids"] = []
        for (var j = 0; j < movieDetails.genres.length; j++) {
          movieDetails["genre_ids"].push(movieDetails.genres[j].id)
        }
        movieDetails["media_type"] = media_type
        // console.log(movieDetails)
        movieItems.push(movieDetails)
      }
      ret["movies"] = transformItems(movieItems, "__")
      res.json(ret)
    } else {
      res.sendStatus(404)
    }
  } catch (err) {
    console.error(err.message)
  }
}

const lists = async (req, res) => {
  try {
    // const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    console.log(userId)
    const userObject = await pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [userId]
    )
    const fav_lid = userObject.rows[0].fav_lid
    const watch_lid = userObject.rows[0].watch_lid
    const listMovies = await pool.query(
      "SELECT list_id, name, list_emoji, created_at, updated_at, user_id FROM lists WHERE user_id=$1",
      [userId]
    )
    ret = {}
    ret["yourLists"] = []
    for (var i = 0; i < listMovies?.rows?.length; i++) {
      const count = await pool.query(
        "SELECT COUNT(movie_id) FROM list_movies WHERE list_id=$1",
        [listMovies.rows[i].list_id]
      )
      if (
        listMovies.rows[i].list_id != fav_lid &&
        listMovies.rows[i].list_id != watch_lid
      ) {
        ret["yourLists"].push({
          listId: listMovies.rows[i].list_id,
          created: listMovies.rows[i].created_at,
          modified: listMovies.rows[i].updated_at,
          name: listMovies.rows[i].name,
          count: parseInt(count.rows[0].count),
          emoji: listMovies.rows[i].list_emoji,
        })
      } else if (listMovies.rows[i].list_id == fav_lid) {
        ret["favourites"] = {
          listId: listMovies.rows[i].list_id,
          created: listMovies.rows[i].created_at,
          modified: listMovies.rows[i].updated_at,
          name: listMovies.rows[i].name,
          count: parseInt(count.rows[0].count),
          emoji: listMovies.rows[i].list_emoji,
        }
      } else {
        ret["watched"] = {
          listId: listMovies.rows[i].list_id,
          created: listMovies.rows[i].created_at,
          modified: listMovies.rows[i].updated_at,
          name: listMovies.rows[i].name,
          count: parseInt(count.rows[0].count),
          emoji: listMovies.rows[i].list_emoji,
        }
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
      const API_TOKEN = constants.API_TOKEN
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
      const API_TOKEN = constants.API_TOKEN
      response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          Authorization: API_TOKEN,
        },
      })
    }
    var similarContent = response.data.results
    similarContent = transformItems(similarContent, type)
    res.json(similarContent)
  } catch (err) {
    console.error(err.message)
  }
}

const add_to_watchlist = async (req, res) => {
  try {
    const movieId = req.query.id
    //const userId = req.query.userId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
    const type = req.query.media_type
    var isWatched = await watched(movieId, userId, type)
    const watchObject = await pool.query(
      "SELECT watch_lid FROM users WHERE user_id = $1",
      [userId]
    )
    const watchId = watchObject.rows[0].watch_lid
    //Insert into list_movies
    // console.log(isWatched)
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
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
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
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    // console.log(req.headers)
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    // console.log(token.payload)
    const userId = token.payload.email
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
    console.log(movieId, media_type)
    ret = await getDetails(movieId, media_type)
    // console.log(ret)
    res.json(ret)
  } catch (err) {
    console.error(err.message)
  }
}
module.exports = {
  create_list,
  add_movie_list,
  remove_movie_list,
  get_movie_lists,
  list_details,
  discover,
  search,
  delete_list,
  similar_content,
  watched_or_faved,
  add_to_watchlist,
  add_to_favlist,
  lists,
  movie_details,
  edit_list,
  checkJwt,
  sign_in,
  quick_search,
}
