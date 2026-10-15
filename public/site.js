const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
async function load(){
  try{
    const response=await fetch('/api/catalog');
    if(!response.ok)throw new Error();
    const data=await response.json();
    const grid=document.querySelector('#products');
    document.querySelector('#catalog-empty').hidden=data.products.length>0;
    for(const p of data.products){
      const card=node('article','','product-card');const href='/product?id='+encodeURIComponent(p.id);const image=node('a','','product-image');image.href=href;image.setAttribute('aria-label','Открыть товар: '+p.name);
      if(p.photo){const img=document.createElement('img');img.src=p.photo;img.alt=p.name;img.loading='lazy';img.addEventListener('error',()=>image.replaceChildren(node('span','Фото временно недоступно')));image.append(img);}else image.append(node('span','Фото скоро появится'));
      const body=node('div','','product-body');const title=node('div','','product-title');const heading=node('h3');const titleLink=node('a',p.name);titleLink.href=href;heading.append(titleLink);title.append(heading);if(p.price)title.append(node('strong',window.ShopCart.price(p.price)===null?p.price:window.ShopCart.money(window.ShopCart.price(p.price))+' / комплект'));body.append(title);
      if(p.description)body.append(node('p',p.description));
      if(p.dimensions||p.quantity){const dl=node('dl');for(const [k,v]of [['Размеры',p.dimensions],['Наличие',p.quantity]])if(v){const row=node('div');row.append(node('dt',k),node('dd',v));dl.append(row);}body.append(dl);}
      const more=node('a','Подробнее о товаре →','card-more');more.href=href;body.append(more,window.ShopCart.controls(p));card.append(image,body);grid.append(card);
    }
    const contact=document.querySelector('#contact-details');
    if(data.phone||data.city||data.note){contact.replaceChildren();if(data.phone){const a=node('a',data.phone);a.href='tel:'+data.phone.replace(/[^+\d]/g,'');contact.append(node('span','Телефон'),a);}if(data.city)contact.append(node('p','Город: '+data.city));if(data.note)contact.append(node('p',data.note));}
  }catch{document.querySelector('#catalog-status').textContent='Не удалось загрузить каталог. Обновите страницу чуть позже.';}
}
load();
