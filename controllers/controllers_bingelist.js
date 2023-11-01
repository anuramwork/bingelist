const express = require("express")

const axios = require("axios")

const { v4: uuidv4 } = require("uuid")

const pool = require("../database/db")

const constants = require("../constant")

const supportFunctions = require("../supporting_functions")

const jsonwebtoken = require("jsonwebtoken")
const { expressjwt: jwt } = require("express-jwt")
const jwksRsa = require("jwks-rsa")

//Global Variables
var moviePage = {}
var tvPage = {}

// SUPPORTING FUNCTIONS
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

const genLanguageOptions = async () => {
  const API_URL = "https://api.themoviedb.org/3/configuration/languages"
  const API_TOKEN = constants.API_TOKEN
  var languagesObject = await axios.get(API_URL, {
    headers: {
      accept: "application/json",
      Authorization: API_TOKEN,
    },
  })
  function sortList(a, b) {
    let nameA = a.iso_639_1.toLowerCase()
    let nameB = b.iso_639_1.toLowerCase()
    return nameA.localeCompare(nameB)
  }
  languagesObject.data = languagesObject.data.slice(1)
  languagesObject.data.sort(sortList)
  var ret = []
  ret.push({ name: "Any", value: "any" })
  for (var i = 0; i < languagesObject.data.length; i++) {
    ret.push({
      name: languagesObject.data[i].english_name,
      value: languagesObject.data[i].iso_639_1,
    })
  }
  return ret
}

const genRatingOptions = async () => {
  let ret = []
  for (var i = 0; i < 11; i++) {
    ret.push({ name: i, value: i })
  }
  return ret
}

const genYearOptions = async () => {
  let ret = []
  let currentDate = new Date()
  let currentYear = currentDate.getFullYear()
  for (var i = 1865; i < currentYear + 1; i++) {
    ret.push({ name: i, value: i })
  }
  ret.push({ name: "Any", value: "any" })
  return ret
}

const checkListExistence = async (userId, listId) => {
  const existQuery = "SELECT EXISTS (SELECT 1 FROM user_list WHERE user_id = $1 AND list_id = $2)";
  const existResult = await pool.query(existQuery, [userId, listId]);
  return existResult.rows[0].exists;
};

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
        duration: item?.runtime || item?.episode_run_time?.[0],
        added_at: item?.addedAt,
        popularity: item?.popularity
      }
    })
}

const getDetails = async (movieId, media_type) => {
  try{
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
  ret = transformDetailItems(movieDetails, media_type)
  return ret}
  catch(err) {
    console.error(err.message)
    res.sendStatus(404)
  }
}

const transformDetailItems = (item, media_type) => {
  try{
  const LANGUAGES_LIST = constants.LANGUAGES_LIST
  var language = {
    name: LANGUAGES_LIST[item?.original_language]?.name ?? null,
    iso_code: item?.original_language,
  }
  var country = item?.production_companies?.[0]?.origin_country
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
  // console.log("returned")
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
  }}
  catch(err)
  {
    console.error(err.message)
    res.sendStatus(404)
  }
}

const getWatchId = async (userId) => {
  try {
    var watchObject = await pool.query(
      "SELECT watch_lid FROM users WHERE user_id =$1",
      [userId]
    )
    var watchId = watchObject.rows[0].watch_lid
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
    var favId = favObject.rows[0].fav_lid
    return favId
  } catch (err) {
    console.error(err.message)
  }
}

// Controllers for the corresponding routes
const sign_in = async (req, res) => {
  try {
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
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
      res.json(ret)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
}

const create_list = async (req, res) => {
  try {
    const list_id = uuidv4()
    const listName = req.query.listName
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
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

const browse = async (req, res) => {
  try {
    const defFilters = {
      sort: "popularity.desc",
      type: "movie",
      genres: [],
      yearFrom: "any",
      yearTo: "any",
      minRating: 0,
      language: "en",
      duration: JSON.stringify({ min: "any", max: "any" }),
      adult: true,
    }
    var filterSettings = req.body.filters
    if (filterSettings == undefined) {
      filterSettings = defFilters
    }
    const pageNo = req.query.pageNo
    const sort = filterSettings.sort
    const type = filterSettings.type
    const genres = filterSettings.genres
    const yearFrom = filterSettings.yearFrom
    const yearTo = filterSettings.yearTo
    const minRating = filterSettings.minRating
    const language = filterSettings.language
    let duration = filterSettings.duration
    duration = JSON.parse(duration)
    const adult = filterSettings.adult
    var yearRange = ""
    var orginalLanguage = ""
    var runTime = ""
    var genreIds = ""
    if (yearFrom != "any" && type == "movie") {
      yearRange = yearRange + "&primary_release_date.gte=" + yearFrom + "-01-01"
    } else if (yearFrom != "any" && type == "tv") {
      yearRange = yearRange + "&first_air_date.gte=" + yearFrom + "-01-01"
    }
    if (yearTo != "any" && type == "movie") {
      yearRange = yearRange + "&primary_release_date.lte=" + yearTo + "-12-31"
    } else if (yearTo != "any" && type == "tv") {
      yearRange = yearRange + "&first_air_date.lte=" + yearTo + "-12-31"
    }
    if (language != "any") {
      orginalLanguage = orginalLanguage + "&with_original_language=" + language
    }
    if (duration.min != "any") {
      runTime = runTime + "&with_runtime.gte=" + duration.min
    }
    if (duration.max != "any") {
      runTime = runTime + "&with_runtime.lte=" + duration.max
    }
    var i = 0
    if (genres.length > 0) {
      genreIds += "&with_genres="
    }
    for (; i < genres.length; i++) {
      if (genres[i] == 28 && type == "tv") {
        genreIds = genreIds + 10759 + "%2C"
      } else if (genres[i] == 12 && type == "tv") {
        genreIds = genreIds + 10759 + "%2C"
      } else if (genres[i] == 14 && type == "tv") {
        genreIds = genreIds + 10765 + "%2C"
      } else if (genres[i] == 878 && type == "tv") {
        genreIds = genreIds + 10765 + "%2C"
      } else {
        genreIds = genreIds + genres[i] + "%2C"
      }
    }
    genreIds = genreIds.slice(0, -3)
    var API_URL =
      "https://api.themoviedb.org/3/discover/" +
      type +
      "?include_adult=" +
      adult +
      "&page=" +
      pageNo +
      yearRange +
      "&sort_by=" +
      sort +
      "&vote_average.gte=" +
      minRating +
      genreIds +
      orginalLanguage +
      runTime
    const API_TOKEN = constants.API_TOKEN
    const randomObject = await axios.get(API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    response = {}
    response["movies"] = transformItems(randomObject.data.results, type)
    response["currPage"] = randomObject.data.page
    response["totalPages"] = randomObject.data.total_pages
    res.json(response)
  } catch (err) {
    console.error(err.message)
    res.sendStatus(404)
  }
}

//INCOMPLETE
const random = async (req, res) => {
  try {
    const defFilters = {
      type: "all",
      genres: [],
      yearFrom: "any",
      yearTo: "any",
      minRating: 0,
      language: "en",
      duration: JSON.stringify({ min: "any", max: "any" }),
      adult: true,
    }
    var filterSettings = req.body.filters
    if (filterSettings == undefined) {
      filterSettings = defFilters
    }
    var pageNo
    var type = filterSettings.type
    const genres = filterSettings.genres
    const yearFrom = filterSettings.yearFrom
    const yearTo = filterSettings.yearTo
    const minRating = filterSettings.minRating
    const language = filterSettings.language
    let duration = filterSettings.duration
    const adult = filterSettings.adult
    
    duration = JSON.parse(duration)

    if (type == "all") {
      type = Math.random() < 0.5 ? "movie" : "tv"
    }
    const key = JSON.stringify(filterSettings)
    if (type == "movie") {
      if (moviePage[key] == undefined) {
        moviePage[key] = 1
      }
      pageNo = Math.floor(Math.random() * moviePage[key]) + 1
    } else if (type == "tv") {
      if (tvPage[key] == undefined) {
        tvPage[key] = 1
      }
      pageNo = Math.floor(Math.random() * tvPage[key]) + 1
    }
    var yearRange = ""
    var orginalLanguage = ""
    var runTime = ""
    var genreIds = ""
    if (yearFrom != "any" && type == "movie") {
      yearRange = yearRange + "&primary_release_date.gte=" + yearFrom + "-01-01"
    } else if (yearFrom != "any" && type == "tv") {
      yearRange = yearRange + "&first_air_date.gte=" + yearFrom + "-01-01"
    }
    if (yearTo != "any" && type == "movie") {
      yearRange = yearRange + "&primary_release_date.lte=" + yearTo + "-12-31"
    } else if (yearTo != "any" && type == "tv") {
      yearRange = yearRange + "&first_air_date.lte=" + yearTo + "-12-31"
    }
    if (language != "any") {
      orginalLanguage = orginalLanguage + "&with_original_language=" + language
    }
    if (duration.min != "any") {
      runTime = runTime + "&with_runtime.gte=" + duration.min
    }
    if (duration.max != "any") {
      runTime = runTime + "&with_runtime.lte=" + duration.max
    }
    var i = 0
    if (genres.length > 0) {
      genreIds += "&with_genres="
    }
    for (; i < genres.length; i++) {
      if (genres[i] == 28 && type == "tv") {
        genreIds = genreIds + 10759 + "%2C"
      } else if (genres[i] == 12 && type == "tv") {
        genreIds = genreIds + 10759 + "%2C"
      } else if (genres[i] == 14 && type == "tv") {
        genreIds = genreIds + 10765 + "%2C"
      } else if (genres[i] == 878 && type == "tv") {
        genreIds = genreIds + 10765 + "%2C"
      } else {
        genreIds = genreIds + genres[i] + "%2C"
      }
    }
    genreIds = genreIds.slice(0, -3)
    var API_URL =
      "https://api.themoviedb.org/3/discover/" +
      type +
      "?include_adult=" +
      adult +
      "&page=" +
      pageNo +
      yearRange +
      "&vote_average.gte=" +
      minRating +
      genreIds +
      orginalLanguage +
      runTime
    const API_TOKEN = constants.API_TOKEN
    const randomObject = await axios.get(API_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_TOKEN,
      },
    })
    response = {}
    var random = Math.floor(Math.random() * randomObject.data.results.length)
    const movieId = randomObject.data.results[random].id
    if (type == "movie") {
      moviePage[key] = Math.min(randomObject.data.total_pages,500)
    } else if (type == "tv") {
      tvPage[key] = Math.min(randomObject.data.total_pages,500)
    }
    ret = await getDetails(movieId, type)
    res.json(ret)
  } catch (err) {
    console.error(err.message)
    res.sendStatus(404)
  }
}

const add_movie_list = async (req, res) => {
  try {
    const allList = req.body
    const movieId = req.query.id
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const type = req.query.media_type
    const favLId = await getfavId(userId)
    const watchLId = await getWatchId(userId)
    for (let key in allList) {
      var listId = key
      var status = allList[key]
      const exists =await checkListExistence(userId, listId)
      if (exists == true && listId != favLId && listId != watchLId) {
        if (status === true) {
          const addMovie = await pool.query(
            "INSERT INTO list_movies (list_id, movie_id, type) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM list_movies WHERE list_id = $4 AND movie_id = $5 AND type = $6)",
            [listId, movieId, type, listId, movieId, type]
          )
        } else if (status === false) {
          const deleteMovie = await pool.query(
            "DELETE FROM list_movies WHERE movie_id =$1 AND type = $2 AND list_id=$3",
            [movieId, type, listId]
          )
        }
        const updateTimestamp = await pool.query(
          "UPDATE lists SET updated_at = NOW() WHERE list_id = $1",
          [listId]
        )
      }
    }
    res.sendStatus(200)
  } catch (err) {
    console.error(err.message)
  }
}

const add_one_movie_to_list = async (req, res) => {
  try {
    const movieId = req.query.id
    const listId = req.query.listId
    const type = req.query.media_type
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const exists =await checkListExistence(userId, listId)
    if (exists == true) {
      const addMovie = await pool.query(
        "INSERT INTO list_movies (list_id, movie_id, type) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM list_movies WHERE list_id = $4 AND movie_id = $5 AND type = $6)",
        [listId, movieId, type, listId, movieId, type]
      )
      const updateTimestamp = await pool.query(
        "UPDATE lists SET updated_at = NOW() WHERE list_id = $1",
        [listId]
      )
    }
    res.sendStatus(200)
  } catch (err) {
    console.error(err.message)
  }
}

const get_movie_lists = async (req, res) => {
  try {
    const movieId = req.query.id
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const type = req.query.media_type

    const watchId = await getWatchId(userId)
    const favId = await getfavId(userId)

    var allList = {}
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
    searchQueryObject.data.results = transformItems(
      searchQueryObject.data.results.slice(0, 10),
      type
    )
    const contentList = searchQueryObject.data.results
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
    const [trendingObject, upcomingObjectMovie, popularObjectMovie, popularObjectTV, upcomingObjectTV] = await Promise.all([
      axios.get(trending_API_URL, { headers: { accept: "application/json", Authorization: API_TOKEN } }),
      axios.get(upcomingMovie_API_URL, { headers: { accept: "application/json", Authorization: API_TOKEN } }),
      axios.get(popularMovie_API_URL, { headers: { accept: "application/json", Authorization: API_TOKEN } }),
      axios.get(popularTV_API_URL, { headers: { accept: "application.json", Authorization: API_TOKEN } }),
      axios.get(upcomingTV_API_URL, { headers: { accept: "application/json", Authorization: API_TOKEN } }),
    ]);
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


const delete_list = async (req, res) => {
  try {
    const listId = req.query.listId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    var response = {}
    const exists = await checkListExistence(userId, listId)
    if (exists == true) {
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
    console.log("hi")
    const listId = req.query.listId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const listName = req.query.listName
    const listEmoji = req.query.listEmoji
    var response = {}
    const exists =await checkListExistence(userId, listId)
    if (exists == true) {
      var updatedList = await pool.query(
        "UPDATE lists SET name = $1, list_emoji =$2, updated_at = NOW() WHERE list_id =$3 RETURNING *",
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

const list_details = async (req, res) => {
  try {
    // console.log("hello")
    const listId = req.query.listId
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const exists =await checkListExistence(userId, listId)
    // console.log(exists)
    if (exists == true) {
      // console.log("details")
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
        "SELECT movie_id, type, added_at FROM list_movies WHERE list_id = $1",
        [listId]
      )
      var count = viewList.rows.length
      ret["count"] = count
      var movieItems = []
      const batchSize = 20
      for (let i = 0; i < count; i += batchSize) {
        const batchPromises = [];
      
        for (let j = i; j < Math.min(i + batchSize, count); j++) {
          const media_type = viewList.rows[j].type;
          const movie_id = viewList.rows[j].movie_id;
          const added_at = viewList.rows[j].added_at;
      
          const API_URL = `https://api.themoviedb.org/3/${media_type}/${movie_id}?language=en-US`;
          const API_TOKEN = constants.API_TOKEN;
      
          const detailPromise = axios.get(API_URL, {
            headers: {
              accept: "application/json",
              Authorization: API_TOKEN,
            },
          })
            .then((detailObject) => {
              const movieDetails = detailObject.data;
              movieDetails.genre_ids = movieDetails.genres.map((genre) => genre.id);
              movieDetails.media_type = media_type;
              movieDetails.addedAt = added_at;
              return movieDetails;
            });
      
          batchPromises.push(detailPromise);
        }
      
        const batchResults = await Promise.all(batchPromises);
        movieItems.push(...batchResults);
      }
      // console.log(movieItems)
      ret["movies"] = transformItems(movieItems, "__")
      console.log(ret)
      res.json(ret)
    } else {
      res.sendStatus(404)
    }
  } catch (err) {
    console.error(err.message)
  }
}

const filter_settings = async (req, res) => {
  try {
    const yearOptions = await genYearOptions()
    const ratingOptions = await genRatingOptions()
    const languageOptions = await genLanguageOptions()
    var ret = {}
    for (let category of ["browse", "random", "list"]) {
      ret[category] = {}
      ret[category]["filtersSettings"] = {}
      if (category === "browse") {
        ret[category]["filtersSettings"]["sortOptions"] = [
          { value: "popularity.desc", name: "Popularity" },
          { value: "primary_release_date.desc", name: "Latest" },
        ];
        ret[category]["filtersSettings"].type  = constants.type.slice(1);
      }
      if (category === "random") {
        ret[category]["filtersSettings"].type = constants.type;
      }
      if (category === "list") {
        ret[category]["filtersSettings"]["sortOptions"] = [
          { value: "popularity.desc", name: "Popularity" },
          { value: "primary_release_date.desc", name: "Latest" },
          { value: "last-added", name: "Last added"}
        ];
        ret[category]["filtersSettings"].type = constants.type;
      }
      ret[category]["filtersSettings"].genres = constants.genres;
      ret[category]["filtersSettings"].yearOptions = yearOptions;
      ret[category]["filtersSettings"].ratingOptions = ratingOptions;
      ret[category]["filtersSettings"].languageOptions = languageOptions;
      ret[category]["filtersSettings"].durationOptions = constants.durationOptions;
      ret[category]["filtersSettings"].adult = true;
      ret[category]["defaultFilters"] = constants.defaultFilters[category];
    }
    res.json(ret)
  } catch (err) {
    console.error(err.message)
  }
}

const lists = async (req, res) => {
  try {
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email

    const fav_lid = await getfavId(userId)
    const watch_lid = await getWatchId(userId)
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
    console.error(err.message, "lists")
  }
}

const similar = async (req, res) => {
  try {
    const contentId = req.query.id
    const type = req.query.media_type
    var response
    if (type == "movie") {
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
    } 
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
    res.sendStatus(404)
  }
}

const add_to_watchlist = async (req, res) => {
  try {
    const movieId = req.query.id
    const tokenId = req.headers.authorization.split("Bearer ")[1]
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const type = req.query.media_type
    var isWatched = await watched(movieId, userId, type)
    const watchId = await getWatchId(userId)
    
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
    const updateTimestamp = await pool.query(
      "UPDATE lists SET updated_at = NOW() WHERE list_id = $1",
      [watchId]
    )
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
    const token = jsonwebtoken.decode(tokenId, { complete: true })
    const userId = token.payload.email
    const type = req.query.media_type
    var isFaved = await favourite(movieId, userId, type)

    const favId = await getfavId(userId)
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
    const updateTimestamp = await pool.query(
      "UPDATE lists SET updated_at = NOW() WHERE list_id = $1",
      [favId]
    )
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
    const token = jsonwebtoken.decode(tokenId, { complete: true })
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
    ret = await getDetails(movieId, media_type)
    res.json(ret)
  } catch (err) {
    console.error(err.message)
    res.sendStatus(404)
  }
}

module.exports = {
  create_list,
  add_movie_list,
  get_movie_lists,
  list_details,
  discover,
  delete_list,
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
}
