import { get, put } from '@vercel/blob';
import { createHmac, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { productPhotos } from '../public/photo-list.js';

const empty = {phone:'',city:'',note:'',products:[]};
const attempts = new Map();
export const cookieName = 'chair_admin';

async function read(path, fallback) {
  const result = await get(path, {access:'private',useCache:false});
  if (!result) return fallback;
  if (result.statusCode !== 200) throw new Error('Storage read failed');
  return JSON.parse(await new Response(result.stream).text());
}
async function write(path, value) {
  return put(path, JSON.stringify(value), {access:'private',allowOverwrite:true,addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:0});
}
async function authData() { return read('settings/admin.json', {hash:process.env.ADMIN_PASSWORD_HASH,version:'initial'}); }
function safeEqual(a,b) {
  const x=Buffer.from(a||''); const y=Buffer.from(b||'');
  return x.length===y.length && timingSafeEqual(x,y);
}
function verify(password, encoded) {
  if(typeof password!=='string'||password.length>128||!encoded) return false;
  const [salt,hash]=encoded.split(':');
  if(!salt||!hash) return false;
  return safeEqual(scryptSync(password,salt,64).toString('hex'),hash);
}
function sign(body) {
  if(!process.env.SESSION_SECRET) throw new Error('Session configuration missing');
  return createHmac('sha256',process.env.SESSION_SECRET).update(body).digest('base64url');
}
export async function authorized(req) {
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!cookie) return false;
  const [body,signature]=cookie.split('.');
  if(!body||!signature||!safeEqual(sign(body),signature)) return false;
  try {
    const session=JSON.parse(Buffer.from(body,'base64url').toString());
    if(session.exp<=Date.now()) return false;
    return session.version===(await authData()).version;
  } catch { return false; }
}
function sessionCookie(version) {
  const body=Buffer.from(JSON.stringify({exp:Date.now()+7*86400000,version})).toString('base64url');
  return `${cookieName}=${body}.${sign(body)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}
function reply(res,status,data) { res.status(status).json(data); }
function text(value,max) { return typeof value==='string'?value.trim().slice(0,max):''; }
function normalize(raw) {
  if(!raw||!Array.isArray(raw.products)||raw.products.length>100) return null;
  const products=raw.products.map(p=>{
    const photos=productPhotos(p);
    return {id:text(p.id,80)||randomUUID(),name:text(p.name,120),price:text(p.price,80),description:text(p.description,1200),dimensions:text(p.dimensions,200),quantity:text(p.quantity,120),photo:photos[0]||'',photos,published:p.published===true};
  });
  if(new Set(products.map(p=>p.id)).size!==products.length) return null;
  return {phone:text(raw.phone,80),city:text(raw.city,100),note:text(raw.note,500),products};
}
function sameOrigin(req) {
  try { return new URL(req.headers.origin).host===req.headers.host; } catch { return false; }
}
function allowAttempt(req) {
  const now=Date.now();
  const key=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
  const item=attempts.get(key);
  if(item&&item.until>now&&item.count>=10) return false;
  if(!item||item.until<=now) attempts.set(key,{count:1,until:now+600000});
  else item.count++;
  if(attempts.size>2000) for(const [k,v] of attempts) if(v.until<=now) attempts.delete(k);
  return true;
}

export async function handler(req,res,action) {
  res.setHeader('Cache-Control','no-store');
  try {
    if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req)) return reply(res,403,{error:'Запрос отклонён. Обновите страницу.'});
    if(action==='catalog'&&req.method==='GET') {
      const data=await read('catalog.json',empty);
      return reply(res,200,{...data,products:data.products.filter(p=>p.published&&p.name)});
    }
    if(action==='session'&&req.method==='GET') return reply(res,200,{authenticated:await authorized(req)});
    if(action==='login'&&req.method==='POST') {
      if(!allowAttempt(req)) return reply(res,429,{error:'Слишком много попыток. Подождите 10 минут.'});
      const auth=await authData();
      if(!verify(req.body?.password,auth.hash)) return reply(res,401,{error:'Неверный пароль'});
      res.setHeader('Set-Cookie',sessionCookie(auth.version));
      return reply(res,200,{ok:true});
    }
    if(action==='logout'&&req.method==='POST') {
      res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return reply(res,200,{ok:true});
    }
    if(action==='photo'&&req.method==='GET') {
      const id=String(req.query.id||'');
      if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(id)) return reply(res,404,{error:'Фото не найдено'});
      const data=await read('catalog.json',empty);
      if(!data.products.some(p=>p.published&&productPhotos(p).includes(`/api/photo?id=${id}`))&&!(await authorized(req))) return reply(res,404,{error:'Фото не найдено'});
      const result=await get(`photos/${id}`,{access:'private'});
      if(!result||result.statusCode!==200) return reply(res,404,{error:'Фото не найдено'});
      res.setHeader('Content-Type',id.endsWith('.png')?'image/png':id.endsWith('.webp')?'image/webp':'image/jpeg');
      res.setHeader('Cache-Control','private, max-age=300');
      return res.status(200).send(Buffer.from(await new Response(result.stream).arrayBuffer()));
    }
    if(!(await authorized(req))) return reply(res,401,{error:'Войдите в админку'});
    if(action==='admin'&&req.method==='GET') return reply(res,200,await read('catalog.json',empty));
    if(action==='admin'&&req.method==='PUT') {
      const data=normalize(req.body);
      if(!data) return reply(res,400,{error:'Проверьте заполненные поля'});
      await write('catalog.json',data);
      return reply(res,200,{ok:true,data});
    }
    if(action==='password'&&req.method==='POST') {
      const auth=await authData();
      if(!verify(req.body?.current,auth.hash)) return reply(res,401,{error:'Текущий пароль неверный'});
      const password=req.body?.password;
      if(typeof password!=='string'||password.length<5||password.length>128) return reply(res,400,{error:'Новый пароль должен содержать от 5 до 128 символов'});
      const salt=randomBytes(16).toString('hex');
      const next={hash:salt+':'+scryptSync(password,salt,64).toString('hex'),version:randomUUID()};
      await write('settings/admin.json',next);
      res.setHeader('Set-Cookie',sessionCookie(next.version));
      return reply(res,200,{ok:true});
    }
    if(action==='upload'&&req.method==='POST') {
      const body=req.body;
      if(!Buffer.isBuffer(body)||body.length>3*1024*1024) return reply(res,400,{error:'Выберите фото до 3 МБ'});
      let ext='';
      if(body.subarray(0,3).equals(Buffer.from([255,216,255]))) ext='jpg';
      else if(body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext='png';
      else if(body.subarray(0,4).toString()==='RIFF'&&body.subarray(8,12).toString()==='WEBP') ext='webp';
      if(!ext) return reply(res,400,{error:'Поддерживаются JPG, PNG и WebP'});
      const id=randomUUID()+'.'+ext;
      await put(`photos/${id}`,body,{access:'private',addRandomSuffix:false,contentType:ext==='jpg'?'image/jpeg':`image/${ext}`});
      return reply(res,200,{url:`/api/photo?id=${id}`});
    }
    return reply(res,405,{error:'Метод не поддерживается'});
  } catch(error) {
    console.error('Request failed:',action,error.name,error.message);
    return reply(res,503,{error:'Не удалось выполнить запрос. Попробуйте ещё раз.'});
  }
}
