import { productPhotos, MAX_PHOTOS } from './photo-list.js';
const $=s=>document.querySelector(s);
let data={phone:'',city:'',note:'',products:[]};
let dirty=false,uploads=0;
const expandedProducts=new Set();
const summaryUpdaters=new Map();
const make=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
async function request(path,method='GET',body){
  const res=await fetch('/api/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const result=await res.json();
  if(!res.ok){if(res.status===401&&path!=='login'&&path!=='password')showLogin();throw new Error(result.error||'Не удалось выполнить запрос');}return result;
}
function showLogin(){data={phone:'',city:'',note:'',products:[]};$('#product-editors').replaceChildren();$('#editor').hidden=true;$('#login').hidden=false;$('#loading').hidden=true;dirty=false;}
async function showEditor(){
  data=await request('admin');for(const key of ['phone','city','note'])$('#'+key).value=data[key]||'';
  renderProducts();$('#login').hidden=true;$('#editor').hidden=false;$('#loading').hidden=true;dirty=false;
}
function markDirty(){dirty=true;$('#save-status').textContent='Есть несохранённые изменения';}
function productField(p,key,title,placeholder,wide=false){
  const label=make('label',title);if(wide)label.className='wide';const input=document.createElement(key==='description'?'textarea':'input');input.value=p[key];input.placeholder=placeholder;input.maxLength=key==='description'?1200:key==='photo'?1500:200;input.addEventListener('input',()=>{p[key]=input.value;summaryUpdaters.get(p.id)?.();markDirty();});label.append(input);return label;
}
function renderProducts(){
  const container=$('#product-editors');container.replaceChildren();summaryUpdaters.clear();
  $('#product-count').textContent=`Всего: ${data.products.length}`;
  if(!data.products.length)container.append(make('div','Товаров пока нет. Добавьте первую карточку, когда будут реальные данные.','admin-empty'));
  data.products.forEach((p,index)=>{
    const block=make('details','','product-editor compact-product');block.open=expandedProducts.has(p.id);
    block.addEventListener('toggle',()=>{if(block.open)expandedProducts.add(p.id);else expandedProducts.delete(p.id);});
    const summary=make('summary','','product-summary');const arrow=make('span','›','item-arrow');const name=make('strong','','item-name');const price=make('span','','item-price');const status=make('span','','item-status');const hint=make('span','Редактировать','item-hint');
    const updateSummary=()=>{name.textContent=p.name.trim()||`Товар ${index+1} · без названия`;price.textContent=p.price||'Цена не указана';status.textContent=p.published&&p.name.trim()?'На сайте':'Скрыт';status.className='item-status '+(p.published&&p.name.trim()?'is-published':'is-hidden');};summaryUpdaters.set(p.id,updateSummary);updateSummary();summary.append(arrow,name,price,status,hint);
    const content=make('div','','product-editor-content');const head=make('div','','product-editor-head');const remove=make('button','Удалить товар','remove-button');remove.addEventListener('click',()=>{if(confirm('Удалить эту карточку?')){data.products=data.products.filter(x=>x.id!==p.id);expandedProducts.delete(p.id);renderProducts();markDirty();}});head.append(make('strong','Редактирование товара'),remove);
    const fields=make('div','','admin-fields two-col');for(const args of [['name','Название','Название модели'],['price','Цена','Цена за штуку или комплект'],['dimensions','Размеры','Укажите после замера'],['quantity','Наличие','Фактическое количество'],['description','Описание','Материал, состояние и другие сведения',true]])fields.append(productField(p,...args));
    p.photos=productPhotos(p);p.photo=p.photos[0]||'';
    const photosPanel=make('section','','photos-panel');const photosTitle=make('h3');const gallery=make('div','','admin-gallery');
    function renderGallery(){
      p.photo=p.photos[0]||'';photosTitle.textContent=`Фотографии · ${p.photos.length} из ${MAX_PHOTOS}`;gallery.replaceChildren();
      if(!p.photos.length)gallery.append(make('p','Добавьте фото. Первое будет обложкой в каталоге.','photo-help'));
      p.photos.forEach((url,photoIndex)=>{
        const tile=make('div','','photo-tile');const img=document.createElement('img');img.src=url;img.alt=`Фото товара ${photoIndex+1}`;const actions=make('div','','photo-actions');
        const cover=make('button',photoIndex===0?'Главное фото':'Сделать главным','photo-cover');cover.type='button';cover.disabled=photoIndex===0;cover.addEventListener('click',()=>{p.photos.splice(photoIndex,1);p.photos.unshift(url);renderGallery();markDirty();});
        const del=make('button','Убрать','remove-button');del.type='button';del.addEventListener('click',()=>{p.photos.splice(photoIndex,1);renderGallery();markDirty();});actions.append(cover,del);tile.append(img,actions);gallery.append(tile);
      });
    }
    renderGallery();
    const uploadLabel=make('label','Загрузить фотографии','upload-field');const file=document.createElement('input');file.type='file';file.multiple=true;file.accept='image/jpeg,image/png,image/webp';
    const uploadStatus=make('span','','upload-status');const help=make('p','Можно выбрать несколько файлов сразу. JPG, PNG или WebP, до 3 МБ каждый.','photo-help');
    file.addEventListener('change',async()=>{
      const selected=[...(file.files||[])];if(!selected.length)return;
      if(selected.length+p.photos.length>MAX_PHOTOS){uploadStatus.textContent=`Для товара доступно до ${MAX_PHOTOS} фото. Свободно: ${MAX_PHOTOS-p.photos.length}.`;file.value='';return;}
      uploads++;const controls=[...$('#editor').querySelectorAll('button,input[type=file]')];const previous=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
      let added=0;const errors=[];
      try{for(let i=0;i<selected.length;i++){
        const item=selected[i];uploadStatus.textContent=`Загружаем ${i+1} из ${selected.length}…`;
        if(item.size>3*1024*1024){errors.push(item.name+': больше 3 МБ');continue;}
        try{const res=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:item});const result=await res.json();if(!res.ok)throw new Error(result.error||'Ошибка загрузки');p.photos.push(result.url);added++;markDirty();}
        catch(e){errors.push(item.name+': '+e.message);}
      }}finally{uploads--;controls.forEach((control,i)=>control.disabled=previous[i]);file.value='';renderGallery();}
      uploadStatus.textContent=`Загружено: ${added}. ${added?'Нажмите «Сохранить изменения». ':''}`+errors.join('; ');
    });
    uploadLabel.append(file);const urlLabel=make('label','Или добавьте ссылку на фото','photo-url');const urlInput=document.createElement('input');urlInput.type='url';urlInput.placeholder='https://…';const urlButton=make('button','Добавить по ссылке','secondary-button');urlButton.type='button';urlButton.addEventListener('click',()=>{
      const url=urlInput.value.trim();const valid=productPhotos({photos:[url]});
      if(!valid.length){uploadStatus.textContent='Укажите прямую HTTPS-ссылку на изображение';return;}
      if(p.photos.length>=MAX_PHOTOS){uploadStatus.textContent=`Можно добавить до ${MAX_PHOTOS} фото`;return;}
      if(!p.photos.includes(url))p.photos.push(url);urlInput.value='';renderGallery();markDirty();
    });urlLabel.append(urlInput,urlButton);
    photosPanel.append(photosTitle,gallery,uploadLabel,help,urlLabel,uploadStatus);
    const check=make('label','','check');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=p.published;checkbox.addEventListener('change',()=>{p.published=checkbox.checked;updateSummary();markDirty();});check.append(checkbox,document.createTextNode('Показывать на сайте'));content.append(head,fields,photosPanel,check);block.append(summary,content);container.append(block);
  });
}
$('#login').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-status').textContent='Входим…';try{await request('login','POST',{password:$('#login-password').value});$('#login-password').value='';$('#login-status').textContent='';await showEditor();}catch(error){$('#login-status').textContent=error.message;}finally{button.disabled=false;}});
$('#logout').addEventListener('click',async()=>{if(dirty&&!confirm('Есть несохранённые изменения. Выйти?'))return;try{await request('logout','POST');showLogin();}catch(e){$('#save-status').textContent=e.message;}});
$('#add').addEventListener('click',()=>{if(data.products.length>=100)return;const id=crypto.randomUUID();expandedProducts.clear();expandedProducts.add(id);data.products.push({id,name:'',price:'',description:'',dimensions:'',quantity:'',photo:'',published:false});renderProducts();markDirty();$('#product-editors').querySelector('details[open]')?.scrollIntoView({block:'nearest',behavior:'smooth'});});
$('#collapse-all').addEventListener('click',()=>{expandedProducts.clear();$('#product-editors').querySelectorAll('details').forEach(item=>item.open=false);});
for(const key of ['phone','city','note'])$('#'+key).addEventListener('input',()=>{data[key]=$('#'+key).value;markDirty();});
$('#save').addEventListener('click',async()=>{
  if(uploads){$('#save-status').textContent='Дождитесь загрузки фотографии';return;}
  const unnamed=data.products.filter(p=>p.published&&!p.name.trim());
  if(unnamed.length){$('#save-status').textContent='Укажите название у каждого товара, который нужно показать на сайте.';return;}
  const controls=[...$('#editor').querySelectorAll('input,textarea,button')];
  controls.forEach(control=>control.disabled=true);
  $('#save-status').textContent='Сохраняем…';
  try{
    const result=await request('admin','PUT',data);
    data=result.data;
    renderProducts();
    dirty=false;
    const published=data.products.filter(p=>p.published&&p.name.trim()).length;
    const hidden=data.products.length-published;
    $('#save-status').textContent=`Сохранено. В каталоге: ${published}. Скрыто: ${hidden}.`+(hidden?' Чтобы показать скрытый товар, включите «Показывать на сайте» и сохраните изменения.':'');
  }catch(error){$('#save-status').textContent=error.message;}
  finally{controls.forEach(control=>control.disabled=false);}
});
$('#password-form').addEventListener('submit',async e=>{e.preventDefault();if($('#new-password').value!==$('#repeat-password').value){$('#password-status').textContent='Новые пароли не совпадают';return;}e.submitter.disabled=true;try{await request('password','POST',{current:$('#current-password').value,password:$('#new-password').value});e.target.reset();$('#password-status').textContent='Пароль изменён. Другие сеансы завершены.';}catch(error){$('#password-status').textContent=error.message;}finally{e.submitter.disabled=false;}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
(async()=>{try{const s=await request('session');if(s.authenticated)await showEditor();else showLogin();}catch(error){$('#loading').textContent=error.message;}})();
