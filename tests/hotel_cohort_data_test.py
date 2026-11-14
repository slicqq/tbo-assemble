import csv, datetime as dt, hashlib, importlib.util, io, pathlib
path=pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare_hotel_cohort_data.py'
spec=importlib.util.spec_from_file_location('cohort',path); module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
base=dt.date(2016,3,1); data=io.StringIO(); w=csv.writer(data); w.writerow(['hotel','arrival_date_year','arrival_date_month','arrival_date_day_of_month','lead_time'])
def row(hotel, arrival_offset, booking_offset):
 arrival=base+dt.timedelta(days=arrival_offset); booking=base+dt.timedelta(days=booking_offset)
 w.writerow([hotel,arrival.year,arrival.strftime('%B'),arrival.day,(arrival-booking).days])
row('City Hotel',30,-7);row('City Hotel',59,-1);row('City Hotel',30,-28);row('City Hotel',59,-8)
row('City Hotel',30,0);row('City Hotel',59,6);row('City Hotel',29,0);row('City Hotel',60,0);row('City Hotel',30,7)
row('Resort Hotel',30,0)
raw=data.getvalue().encode();module.SHA=hashlib.sha256(raw).hexdigest()
r=next(r for r in module.build(raw)['rows'] if r['date']=='2016-03-01' and r['hotel']=='City Hotel')
assert (r['previous7'],r['previous21'],r['next7'])==(2,2,2),r
print('Cohort fixed arrival window, date boundaries and hotel isolation passed')
