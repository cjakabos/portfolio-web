CREATE TABLE IF NOT EXISTS test (
    id serial PRIMARY KEY,
    gender text,
    age integer,
    annual_income integer,
    spending_score integer,
    segment integer
);

CREATE TABLE IF NOT EXISTS mlinfo (
    id serial PRIMARY KEY,
    image2 bytea,
    image3 bytea,
    image4 bytea
);
