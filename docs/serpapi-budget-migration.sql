-- No fare content or API keys are stored in these tables.
CREATE TABLE IF NOT EXISTS public.serpapi_search_budget_lock (id integer PRIMARY KEY CHECK (id = 1));
INSERT INTO public.serpapi_search_budget_lock (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.serpapi_search_budget_lock ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.serpapi_search_usage (usage_day date PRIMARY KEY, attempts integer NOT NULL CHECK (attempts >= 0));
ALTER TABLE public.serpapi_search_usage ENABLE ROW LEVEL SECURITY;
