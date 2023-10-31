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
  return items.map((item) => {
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
    }
  })
}
const getDetails = async (movieId, media_type) => {
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

module.exports = {
  watched,
  favourite,
  transformItems,
  getDetails,
  transformDetailItems,
}
