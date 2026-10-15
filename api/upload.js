import { handler } from '../server/index.js';
export const config={api:{bodyParser:false}};
export default async function(req,res) {
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>3*1024*1024)return res.status(413).json({error:'Фото должно быть до 3 МБ'});parts.push(part);}
  req.body=Buffer.concat(parts);
  return handler(req,res,'upload');
}
