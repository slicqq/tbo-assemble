-- Server-only market-data table. No customer or booking information.
CREATE TABLE IF NOT EXISTS public.market_fare_observations (
  collection_day date NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  departure_date date NOT NULL,
  observed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','empty','error')),
  price_inr numeric(12,2),
  airline text,
  stops integer,
  provider_found_at timestamptz,
  provider_expires_at timestamptz,
  error text,
  PRIMARY KEY (collection_day, origin, destination, departure_date)
);
ALTER TABLE public.market_fare_observations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS market_fare_observations_route_idx ON public.market_fare_observations (origin, destination, observed_at DESC);
