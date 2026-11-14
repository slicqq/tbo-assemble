#!/usr/bin/env python3
"""Generate retrospective, anonymised booking/stay-window counts. See research note."""
import calendar, collections, csv, datetime as dt, hashlib, json, pathlib, urllib.request
URL='https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv'
SHA='7c2ae42a7353905ea136e5c2287f17c92c5435826598bfbb8491c6f0c7b1fc06'
D=dt.timedelta(days=1)

def build(raw):
    digest=hashlib.sha256(raw).hexdigest()
    if digest != SHA: raise ValueError('Source checksum differs')
    counts=collections.Counter(); valid=0
    for r in csv.DictReader(raw.decode('utf-8-sig').splitlines()):
        try:
            hotel=r['hotel']; month=list(calendar.month_name).index(r['arrival_date_month'])
            arrival=dt.date(int(r['arrival_date_year']),month,int(r['arrival_date_day_of_month']))
            lead=int(r['lead_time']); booking=arrival-dt.timedelta(days=lead)
            if hotel not in ('City Hotel','Resort Hotel') or lead<0: raise ValueError()
        except (KeyError,ValueError,OverflowError): continue
        counts[(hotel,arrival,booking)]+=1; valid+=1
    rows=[]
    for hotel in ('City Hotel','Resort Hotel'):
        asof=dt.date(2016,3,1)
        while asof<=dt.date(2016,9,30):
            # Fixed stay window as-of +30 through +59; historical booking windows
            # and target refer to exactly that same set of arrival dates.
            def total(bstart,bend):
                return sum(counts[(hotel,asof+dt.timedelta(days=a),asof+dt.timedelta(days=b))] for a in range(30,60) for b in range(bstart,bend+1))
            rows.append({'date':asof.isoformat(),'hotel':hotel,'previous7':total(-7,-1),'previous21':total(-28,-8),'next7':total(0,6)})
            asof+=D
    return {'sourceUrl':URL,'sourceSha256':digest,'validSourceRecords':valid,'description':'Gross inferred booking records for stays arriving 30–59 days after each as-of date; historical retrospective research only.','rows':rows}

def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'TBO-Research-Prototype/1.0'})
    with urllib.request.urlopen(req,timeout=90) as r: data=build(r.read())
    dest=pathlib.Path(__file__).resolve().parents[1]/'src/data/public-hotel-cohorts.json'
    dest.write_text(json.dumps(data,separators=(',',':'))+'\n')
    print('Saved',len(data['rows']),'cohort examples from',data['validSourceRecords'],'source records')
if __name__=='__main__':main()
