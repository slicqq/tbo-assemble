'use client';
import { useRef, useState } from 'react';
import { Database, Download, Upload } from 'lucide-react';
import {csvTemplate,readInventoryCSV} from '@/lib/inventory-csv';
import type {Opportunity} from '@/lib/procurement';
export default function InventoryImport({onImport,onReset,usingReal}:{onImport:(items:Opportunity[],name:string)=>void;onReset:()=>void;usingReal:boolean}){
 const [error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 function download(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csvTemplate],{type:'text/csv;charset=utf-8'}));a.download='inventory-input-template.csv';a.click();URL.revokeObjectURL(a.href)}
 async function handle(file:File|undefined){if(!file)return;try{if(file.size>500000)throw new Error('File must be smaller than 500 KB.');const data=readInventoryCSV(await file.text());onImport(data,file.name);setError('')}catch(e){setError(e instanceof Error?e.message:'Could not read the CSV file.')}finally{if(input.current)input.current.value=''}}
 return <section className="panel import-panel"><div className="import-copy"><div className="control-icon"><Database size={18}/></div><div><h2>Plan with your own inventory</h2><p>Upload hotel or flight data as CSV. It replaces the demo inputs in this browser. Inputs stay in this browser unless you run the planning API or save a plan to your account.</p><p>Use the template: conversion, cancellations and volatility are fractions (0–1); soldOut is a percentage (0–100). <a href="/research/inventory-input.md" target="_blank">Field guide</a></p></div></div><div className="import-actions"><button className="outline-button" onClick={download}><Download size={15}/> Template</button><button className="import-button" onClick={()=>input.current?.click()}><Upload size={15}/> Upload CSV</button><input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e=>handle(e.target.files?.[0])}/>{usingReal&&<button className="reset-button" onClick={()=>{onReset();setError('')}}>Restore demo</button>}</div>{error&&<p className="import-error" role="alert">{error} No changes were made.</p>}</section>
}
