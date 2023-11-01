CREATE DATABASE bingelist;

CREATE TABLE users(
    user_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100),
    picture VARCHAR(255)
);

CREATE TABLE lists(
    list_id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    list_emoji VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(100) REFERENCES users(user_id)
);
CREATE TABLE user_list(
    user_id VARCHAR(100) REFERENCES users(user_id),
    list_id UUID REFERENCES lists(list_id)
);

ALTER TABLE users ADD watch_lid UUID REFERENCES lists(list_id);
ALTER TABLE users ADD fav_lid UUID REFERENCES lists(list_id);

CREATE TABLE list_movies(
    list_id UUID REFERENCES lists(list_id),
    movie_id INT,
    type VARCHAR(10)
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CREATE TABLE movies(
--     movie_id INT PRIMARY KEY,
--     type BOOLEAN,
--     title VARCHAR(255),
--     description VARCHAR(255),
--     image_url VARCHAR(255),
--     duration INTEGER,
--     language VARCHAR(255),
--     trailer_url VARCHAR(255),
--     imdb_rating DECIMAL,
--     director VARCHAR(255),
--     casts JSON,
--     cast_img JSON,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );



-- CREATE TABLE movies_genre(
--     movie_id INT,
--     genre_id INTEGER REFERENCES genres(genres_id)
-- );

-- CREATE TABLE genres(
--     genres_id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL
-- );