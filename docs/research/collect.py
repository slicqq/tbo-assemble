"""Collect candidate references, not an assertion of full-text review or geographic origin."""
import requests,csv,os,time
from datetime import date
root=os.path.dirname(__file__)
s=requests.Session();s.headers.update({'User-Agent':'TBO-inventory-research-catalog/1.0','Accept':'application/vnd.github+json'})
paper_queries=['hotel demand forecasting','hotel revenue management pricing','airline revenue management inventory control','tourism demand forecasting seasonality','inventory optimization stochastic demand','hotel booking cancellation prediction']
repo_queries=['hotel demand forecasting','hotel revenue management','inventory optimization demand forecasting','airline revenue management','hotel booking cancellation prediction','travel demand forecasting']
papers={}; repos={}
for q in paper_queries:
 try:
  r=s.get('https://api.openalex.org/works',params={'search':q,'per-page':40,'filter':'type:article','sort':'relevance_score:desc'},timeout=30);r.raise_for_status()
  for p in r.json()['results']:
   pid=p['id'];papers.setdefault(pid,{'title':p.get('display_name'),'year':p.get('publication_year'),'authors':'; '.join(a['author']['display_name'] for a in p.get('authorships',[])[:4]),'doi':p.get('doi') or '', 'source_url':p.get('doi') or pid,'openalex_url':pid,'search_query':q,'cited_by':p.get('cited_by_count',0)})
  print('papers',q,len(papers),flush=True)
 except Exception as e: print('paper query failed',q,e,flush=True)
for q in ([] if os.path.exists(os.path.join(root,'repositories.csv')) else repo_queries):
 try:
  r=s.get('https://api.github.com/search/repositories',params={'q':q,'per_page':40,'sort':'stars','order':'desc'},timeout=30);r.raise_for_status()
  for p in r.json()['items']:
   repos.setdefault(p['full_name'],{'repository':p['full_name'],'url':p['html_url'],'description':p.get('description') or '', 'stars':p['stargazers_count'],'license':(p.get('license') or {}).get('spdx_id') or 'not specified','updated_at':p.get('updated_at'),'search_query':q})
  print('repos',q,len(repos),flush=True)
 except Exception as e: print('repo query failed',q,e,flush=True)
 time.sleep(1)
for name,data in [('papers.csv',papers),('repositories.csv',repos)]:
 if data:
  with open(os.path.join(root,name),'w',newline='',encoding='utf-8') as f:
   w=csv.DictWriter(f,fieldnames=list(next(iter(data.values())).keys()));w.writeheader();w.writerows(data.values())
print('TOTAL',len(papers),len(repos))
