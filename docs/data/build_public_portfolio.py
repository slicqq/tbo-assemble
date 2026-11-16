#!/usr/bin/env python3
"""Builds src/data/public-portfolio.json (run from anywhere: python3 docs/data/build_public_portfolio.py): real monthly demand histories for the public-data portfolio.

Sources
- DGCA domestic city-pair traffic (monthly passengers), as aggregated by github.com/Vonter/india-aviation-traffic
  (aggregated/domestic/city.csv). Used for (a) flight routes and (b) air arrivals into leisure cities, a public
  proxy for hotel demand there.
- Singapore Tourism Board / SingStat occupied hotel room nights (already snapshotted in src/data/singapore-gross-lettings.json).

City names in the DGCA file change over time (e.g. Goa split into Dabolim and Mopa from 2023, "MUMBAI (MUMBAI)",
trailing spaces, "COCHIN"); they are normalised to one city before summing. A month with no record for a series is
written as missing (not zero) so the planner only learns from the latest unbroken run of months.
"""
import csv, collections, hashlib, json, os, sys, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.environ.get('PUBLIC_DATA_CACHE', os.path.join(ROOT, '.data-cache'))
DGCA_URL = 'https://raw.githubusercontent.com/Vonter/india-aviation-traffic/main/aggregated/domestic/city.csv'

def norm(city: str) -> str:
    c = ' '.join(city.strip().upper().split())
    if c.startswith('GOA') or c == 'DABOLIM' or c.startswith('MOPA'): return 'GOA'
    if c.startswith('MUMBAI'): return 'MUMBAI'
    if c in ('COCHIN', 'KOCHI'): return 'KOCHI'
    if c in ('BANGALORE', 'BENGALURU'): return 'BENGALURU'
    return c

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()

def main():
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, 'dgca_city.csv')
    if not os.path.exists(path):
        import urllib.request
        print('downloading', DGCA_URL, file=sys.stderr)
        urllib.request.urlretrieve(DGCA_URL, path)
    rows = list(csv.DictReader(open(path)))
    present = set()
    arrivals = collections.defaultdict(lambda: collections.Counter())
    routes = collections.defaultdict(lambda: collections.Counter())
    for r in rows:
        month = f"{int(r['Year']):04d}-{int(r['Month']):02d}"
        present.add(month)
        a, b = norm(r['City1']), norm(r['City2'])
        to_b, from_b = float(r['PaxToCity2'] or 0), float(r['PaxFromCity2'] or 0)
        arrivals[b][month] += to_b
        arrivals[a][month] += from_b
        routes[(a, b)][month] += to_b
        routes[(b, a)][month] += from_b
    months = sorted(present)
    def idx(m): y, mm = map(int, m.split('-')); return y * 12 + mm - 1
    def name(i): return f"{i // 12:04d}-{i % 12 + 1:02d}"
    def series(counter):
        # Every month from the series' first to the file's last month: a month present in the file but without a
        # record for this series is a true zero (no flights); a month missing from the whole file is imputed as
        # last year's value x the mean year-on-year ratio of the neighbouring months, and flagged.
        start, end = min(idx(m) for m in counter), idx(months[-1])
        out = []
        for i in range(start, end + 1):
            m = name(i)
            if m in present: out.append({'month': m, 'value': round(counter.get(m, 0.0), 1)}); continue
            prev, nxt, ly = name(i - 1), name(i + 1), name(i - 12)
            ratios = [counter[x] / counter[name(idx(x) - 12)] for x in (prev, nxt) if counter.get(x, 0) > 0 and counter.get(name(idx(x) - 12), 0) > 0]
            if counter.get(ly, 0) > 0 and ratios: v = counter[ly] * sum(ratios) / len(ratios)
            else: v = (counter.get(prev, 0) + counter.get(nxt, 0)) / 2
            out.append({'month': m, 'value': round(v, 1), 'imputed': True})
        return out
    wanted_arrivals = ['GOA', 'JAIPUR', 'KOCHI', 'SRINAGAR', 'UDAIPUR', 'PORT BLAIR']
    wanted_routes = [('DELHI', 'MUMBAI'), ('BENGALURU', 'DELHI'), ('DELHI', 'GOA'), ('MUMBAI', 'GOA'), ('DELHI', 'SRINAGAR'), ('MUMBAI', 'KOCHI')]
    out_series = {}
    for c in wanted_arrivals: out_series[f'arrivals:{c}'] = series(arrivals[c])
    for a, b in wanted_routes: out_series[f'route:{a}>{b}'] = series(routes[(a, b)])
    sg = json.load(open(os.path.join(ROOT, 'src/data/singapore-gross-lettings.json')))
    out_series['stb:SINGAPORE'] = [{'month': r['month'], 'value': r['occupiedRoomNights']} for r in sg['rows']]
    for k, v in out_series.items():
        gaps = 0
        for i in range(1, len(v)):
            y0, m0 = map(int, v[i - 1]['month'].split('-')); y1, m1 = map(int, v[i]['month'].split('-'))
            if (y1 * 12 + m1) - (y0 * 12 + m0) != 1: gaps += 1
        imputed = [x['month'] for x in v if x.get('imputed')]
        zeros = [x['month'] for x in v if x['value'] == 0]
        print(f"{k:28s} {v[0]['month']}..{v[-1]['month']} n={len(v)} gaps={gaps} imputed={imputed} zeros={zeros[:4]} last={v[-1]['value']}", file=sys.stderr)
    doc = {
        'schema': 'public-portfolio-v1',
        'builtAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'sources': [
            {'id': 'dgca', 'name': 'DGCA domestic city-pair traffic (monthly passengers), aggregated by Vonter/india-aviation-traffic',
             'url': DGCA_URL, 'sha256': sha256(path), 'rows': len(rows), 'months': [months[0], months[-1]],
             'note': 'Directional passengers City1→City2; city arrivals sum all routes into the city. City names normalised (Goa = Dabolim + Mopa; Mumbai incl. Navi Mumbai). The source file has no rows for 2021-05 and 2024-05: those months are imputed (last year x neighbouring year-on-year ratios) and flagged imputed=true.'},
            {'id': 'stb', 'name': sg['source'], 'url': sg['sourceUrl'], 'licenseUrl': sg['licenseUrl'], 'sha256': sg['snapshotSha256'],
             'note': 'Occupied hotel room nights, all of Singapore (snapshot in src/data/singapore-gross-lettings.json).'},
        ],
        # Shock periods left out of model fitting and validation (the months stay in the series, flagged by the app).
        'anomalies': [
            {'source': 'dgca', 'from': '2020-03', 'to': '2022-02',
             'reason': 'COVID-19: national lockdown from 25 Mar 2020, domestic flights resumed 25 May 2020 under capacity caps (lifted 18 Oct 2021), Omicron wave Jan-Feb 2022.'},
            {'source': 'stb', 'from': '2020-02', 'to': '2022-03',
             'reason': 'COVID-19: border closures and quarantine-hotel use until Singapore reopened to vaccinated travellers on 1 Apr 2022.'},
        ],
        'seriesSource': {k: ('stb' if k.startswith('stb:') else 'dgca') for k in out_series},
        'series': out_series,
    }
    with open(os.path.join(ROOT, 'src/data/public-portfolio.json'), 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    print('wrote', os.path.getsize(os.path.join(ROOT, 'src/data/public-portfolio.json')), 'bytes', file=sys.stderr)

if __name__ == '__main__':
    main()
