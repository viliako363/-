const $=s=>document.querySelector(s);
let data={phone:'',city:'',note:'',products:[]};
let dirty=false,uploads=0;
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
  const label=make('label',title);if(wide)label.className='wide';const input=document.createElement(key==='description'?'textarea':'input');input.value=p[key];input.placeholder=placeholder;input.maxLength=key==='description'?1200:key==='photo'?1500:200;input.addEventListener('input',()=>{p[key]=input.value;markDirty();});label.append(input);return label;
}
function renderProducts(){
  const container=$('#product-editors');container.replaceChildren();
  if(!data.products.length)container.append(make('div','Товаров пока нет. Добавьте первую карточку, когда будут реальные данные.','admin-empty'));
  data.products.forEach((p,index)=>{
    const block=make('div','','product-editor');const head=make('div','','product-editor-head');const remove=make('button','Удалить','remove-button');remove.addEventListener('click',()=>{if(confirm('Удалить эту карточку?')){data.products=data.products.filter(x=>x.id!==p.id);renderProducts();markDirty();}});head.append(make('strong','Товар '+(index+1)),remove);
    const fields=make('div','','admin-fields two-col');for(const args of [['name','Название','Название модели'],['price','Цена','Цена за штуку или комплект'],['dimensions','Размеры','Укажите после замера'],['quantity','Наличие','Фактическое количество'],['photo','Ссылка на фото','https://…',true],['description','Описание','Материал, состояние и другие сведения',true]])fields.append(productField(p,...args));
    const uploadLabel=make('label','Или загрузите фото с устройства','upload-field');const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';const uploadStatus=make('span','','upload-status');const preview=document.createElement('img');preview.className='admin-photo';preview.alt='Фото товара';if(p.photo)preview.src=p.photo;else preview.hidden=true;
    file.addEventListener('change',async()=>{const selected=file.files?.[0];if(!selected)return;if(selected.size>3*1024*1024){uploadStatus.textContent='Выберите фото до 3 МБ';return;}uploads++;file.disabled=true;uploadStatus.textContent='Загрузка…';try{const res=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:selected});const result=await res.json();if(!res.ok)throw new Error(result.error);p.photo=result.url;preview.src=result.url;preview.hidden=false;fields.querySelectorAll('input')[4].value=result.url;uploadStatus.textContent='Фото загружено. Сохраните изменения.';markDirty();}catch(e){uploadStatus.textContent=e.message;}finally{uploads--;file.disabled=false;}});
    uploadLabel.append(file,uploadStatus);const check=make('label','','check');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=p.published;checkbox.addEventListener('change',()=>{p.published=checkbox.checked;markDirty();});check.append(checkbox,document.createTextNode('Показывать на сайте'));block.append(head,fields,uploadLabel,preview,check);container.append(block);
  });
}
$('#login').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-status').textContent='Входим…';try{await request('login','POST',{password:$('#login-password').value});$('#login-password').value='';$('#login-status').textContent='';await showEditor();}catch(error){$('#login-status').textContent=error.message;}finally{button.disabled=false;}});
$('#logout').addEventListener('click',async()=>{if(dirty&&!confirm('Есть несохранённые изменения. Выйти?'))return;try{await request('logout','POST');showLogin();}catch(e){$('#save-status').textContent=e.message;}});
$('#add').addEventListener('click',()=>{if(data.products.length>=100)return;data.products.push({id:crypto.randomUUID(),name:'',price:'',description:'',dimensions:'',quantity:'',photo:'',published:false});renderProducts();markDirty();});
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
