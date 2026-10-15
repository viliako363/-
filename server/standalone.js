import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handler } from './index.js';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const actions=new Set(['catalog','admin','login','logout','session','password','photo','upload']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  for(const header of config.headers[0].headers)res.setHeader(header.key,header.value);
  res.status=code=>{res.statusCode=code;return res;};
  res.json=data=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));return res;};
  res.send=data=>{res.end(data);return res;};
  try{
    const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
    if(url.pathname.startsWith('/api/')){
      const action=url.pathname.slice(5);if(!actions.has(action))return res.status(404).json({error:'Не найдено'});
      if(!['GET','HEAD'].includes(req.method)){
        const chunks=[];let size=0;const max=action==='upload'?3*1024*1024:1024*1024;
        for await(const chunk of req){size+=chunk.length;if(size>max)return res.status(413).json({error:'Слишком большой запрос'});chunks.push(chunk);}
        const body=Buffer.concat(chunks);
        if(action==='upload')req.body=body;
        else{try{req.body=body.length?JSON.parse(body.toString('utf8')):{};}catch{return res.status(400).json({error:'Некорректные данные'});}}
      }
      return handler(req,res,action);
    }
    if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'Метод не поддерживается'});
    const aliases={'/':'/index.html','/admin':'/admin.html','/product':'/product.html'};
    const route=aliases[url.pathname]||url.pathname;
    const filename=path.resolve(root,'.'+decodeURIComponent(route));
    if(!filename.startsWith(root))return res.status(404).json({error:'Не найдено'});
    const body=await readFile(filename);
    res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-cache');
    res.end(req.method==='HEAD'?undefined:body);
  }catch(error){res.status(error.code==='ENOENT'?404:500).json({error:'Не удалось выполнить запрос'});}
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Website server is ready'));
