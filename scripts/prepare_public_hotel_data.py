#!/usr/bin/env python3
"""Rebuild the daily historical research aggregate from the public hotel bookings CSV.
Only hotel labels, arrival date, and reported lead time are retained.
"""
import calendar, collections, csv, datetime as dt, hashlib, json, pathlib, urllib.request

URL = 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv'
EXPECTED_SHA256 = '7c2ae42a7353905ea136e5c2287f17c92c5435826598bfbb8491c6f0c7b1fc06'
START = dt.date(2016,1,1)
END = dt.date(2016,6,30)
ROOT = pathlib.Path(__file__).resolve().parents[1]

def build(raw: bytes):
    digest = hashlib.sha256(raw).hexdigest()
    if digest != EXPECTED_SHA256: raise ValueError('Source checksum differs; inspect changes before regenerating.')
    counts = collections.Counter(); total = invalid = selected = 0; groups = collections.Counter()
    for r in csv.DictReader(raw.decode('utf-8-sig').splitlines()):
        total += 1
        try:
            month = list(calendar.month_name).index(r['arrival_date_month'])
            arrival = dt.date(int(r['arrival_date_year']), month, int(r['arrival_date_day_of_month']))
            lead = int(r['lead_time'])
            if lead < 0 or r['hotel'] not in ('City Hotel','Resort Hotel'): raise ValueError()
            inferred = arrival - dt.timedelta(days=lead)
        except (ValueError, KeyError, OverflowError): invalid += 1; continue
        groups[r['hotel']] += 1
        if START <= inferred <= END:
            counts[(r['hotel'],inferred)] += 1; selected += 1
    data = []
    for hotel in ('City Hotel','Resort Hotel'):
        date=START
        while date<=END:
            data.append({'date':date.isoformat(),'hotel':hotel,'requests':counts[(hotel,date)]});date+=dt.timedelta(days=1)
    return {'sourceUrl':URL,'sourceSha256':digest,'sourceRecords':total,'invalidRecords':invalid,'recordsInWindow':selected,'sourceByHotel':dict(groups),'start':START.isoformat(),'end':END.isoformat(),'rows':data}

def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'TBO-Research-Prototype/1.0'})
    with urllib.request.urlopen(req,timeout=60) as resp: data=build(resp.read())
    dest=ROOT/'src/data/public-hotel-booking-daily.json';dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(data,separators=(',',':'))+'\n')
    print(json.dumps({k:v for k,v in data.items() if k!='rows'},indent=2));print('Daily aggregate rows:',len(data['rows']))
if __name__=='__main__': main()
