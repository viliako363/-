const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
async function loadProduct(){
  const status=document.querySelector('#detail-status');
  try{
    const id=new URLSearchParams(location.search).get('id');
    if(!id){status.textContent='Выберите товар в каталоге.';return;}
    const response=await fetch('/api/catalog');
    if(!response.ok)throw new Error();
    const data=await response.json();const p=data.products.find(item=>item.id===id);
    if(!p){status.textContent='Этот товар сейчас недоступен. Посмотрите другие варианты в каталоге.';return;}
    document.title=p.name+' — Ножки для стульев';
    document.querySelector('#detail-name').textContent=p.name;
    document.querySelector('#detail-price').textContent=p.price||'Цена уточняется';
    if(p.description){const description=document.querySelector('#detail-description');description.textContent=p.description;description.hidden=false;}
    const image=document.querySelector('#detail-image');
    if(p.photo){const a=node('a');a.href=p.photo;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label','Открыть фото крупнее');const img=document.createElement('img');img.src=p.photo;img.alt=p.name;img.addEventListener('error',()=>image.replaceChildren(node('span','Фото временно недоступно')));a.append(img);image.append(a);}else image.append(node('span','Фото скоро появится'));
    const specs=document.querySelector('#detail-specs');
    for(const [key,value]of [['Размеры',p.dimensions],['Наличие',p.quantity],['Город',data.city]])if(value){const row=node('div');row.append(node('dt',key),node('dd',value));specs.append(row);}
    const contact=document.querySelector('#detail-contact');
    if(data.phone){const a=node('a','Позвонить продавцу','primary-link');a.href='tel:'+data.phone.replace(/[^+\d]/g,'');contact.append(a,node('span',data.phone,'detail-phone'));}else{const a=node('a','Контакты продавца →','text-link');a.href='/#contact';contact.append(a);}
    if(data.note){const note=document.querySelector('#detail-note');note.textContent=data.note;note.hidden=false;}
    status.hidden=true;document.querySelector('#detail').hidden=false;
  }catch{status.textContent='Не удалось загрузить товар. Попробуйте обновить страницу.';}
}
loadProduct();
