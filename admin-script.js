/* ═══════════════ FIREBASE ═══════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyAA6lc6-CFTn56ApNnnATiMUheDpqCaSkQ",
  authDomain: "sm-topup-f5ae0.firebaseapp.com",
  projectId: "sm-topup-f5ae0",
  storageBucket: "sm-topup-f5ae0.firebasestorage.app",
  messagingSenderId: "27891330556",
  appId: "1:27891330556:web:844ca508cdc734caacd679"
};
let db, auth;
try { if(!firebase.apps.length) firebase.initializeApp(firebaseConfig); db=firebase.firestore(); auth=firebase.auth(); } catch(e){ console.error(e); }

const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
const fmtDate = (dv) => { if(!dv) return 'N/A'; const d=dv.toDate?dv.toDate():new Date(dv); return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}); };
const esc = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function floatToast(msg, color='#0f172a'){
  const el=document.createElement('div');
  el.className='toast-float'; el.style.background=color; el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>el.remove(),400); }, 1500);
}
function shortId(id, prefix='ORD'){
  if(!id) return '#'+prefix+'-0000';
  const clean=String(id).replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
  return '#'+prefix+'-'+clean.slice(-4).padStart(4,'0');
}
function copyText(txt){ navigator.clipboard.writeText(txt).then(()=>floatToast('Copied ✓','#10b981')).catch(()=>{}); }

/* ═══════════════ STATE ═══════════════ */
let allUsers=[], allCategories=[], allProducts=[], allBanners=[], allCodes=[], allRanks=[];
let allDeposits=[], allOrders=[];
let paymentConfig={}, settingsData={};
let currentUserView=null, currentEditingProduct=null;
let cpSelectedCategory='';
let depositFilter='pending', orderFilter='pending';
let listenersStarted=false, confirmCallback=null;
let productsCache={}, currentPackagesUnsub=null, currentUserTab='actions';
let newItemIds=new Set();
let siteName='SYL TOPUP BD';
let playerApiConfig={url:'',namePath:'player.name',levelPath:'',likesPath:'',diamondsPath:'',expPath:'',method:'GET'};
let accountPricing={basePrice:100,levelPrice:2,likePrice:0.5,diamondPrice:0.8};
let ranksList=[];

// Rank helpers (matching user panel defaults)
const DEFAULT_RANKS=[
  {name:'Bronze',min:0,max:100,tagline:'Start',color:'#b45309',icon:'fa-medal'},
  {name:'Silver',min:101,max:1000,tagline:'Keep grinding',color:'#64748b',icon:'fa-medal'},
  {name:'Gold',min:1001,max:5000,tagline:'Shine brighter',color:'#f59e0b',icon:'fa-crown'},
  {name:'Platinum',min:5001,max:10000,tagline:'Elite status',color:'#0891b2',icon:'fa-gem'},
  {name:'Diamond',min:10001,max:25000,tagline:'Premium glow',color:'#a855f7',icon:'fa-gem'},
  {name:'Heroic',min:25001,max:50000,tagline:'Legendary',color:'#ef4444',icon:'fa-dragon'},
  {name:'Master',min:50001,max:100000,tagline:'Top tier',color:'#8b5cf6',icon:'fa-crown'},
  {name:'Grand Master',min:100001,max:999999999,tagline:'Ultimate',color:'#eab308',icon:'fa-crown'}
];
function getUserRank(spend){
  const list = ranksList.length > 0 ? ranksList : DEFAULT_RANKS;
  for(let i=0; i<list.length; i++) {
    if(spend >= (list[i].min||0) && spend <= (list[i].max||999999999)) return list[i];
  }
  return list[0];
}
function normalizeStatus(s){
  s = (s||'pending').toLowerCase();
  if(['success','complete','completed'].includes(s)) return 'success';
  if(['cancel','canceled','cancelled'].includes(s)) return 'cancelled';
  if(['refund','refunded'].includes(s)) return 'refunded';
  if(['reject','rejected'].includes(s)) return 'rejected';
  return 'pending';
}

function markNew(id){ newItemIds.add(id); setTimeout(()=>newItemIds.delete(id),2600); }
function lockBodyScroll(){ const y=window.scrollY; document.body.style.top=`-${y}px`; document.body.classList.add('modal-open'); }
function unlockBodyScroll(){ const y=document.body.style.top; document.body.classList.remove('modal-open'); document.body.style.top=''; if(y) window.scrollTo(0,parseInt(y||'0')*-1); }

/* ═══════════════ AUTH ═══════════════ */
function adminLogin(){
  const e=$('admin-email').value.trim(), p=$('admin-pass').value;
  if(!e||!p) return Swal.fire('Error','Fill all fields','warning');
  Swal.showLoading();
  auth.signInWithEmailAndPassword(e,p)
    .then(()=>Swal.close())
    .catch(err=>Swal.fire('Login Failed',err.message,'error'));
}
function togglePass(id,btn){
  const inp=$(id), i=btn.querySelector('i');
  if(inp.type==='password'){inp.type='text';i.classList.replace('fa-eye','fa-eye-slash');}
  else{inp.type='password';i.classList.replace('fa-eye-slash','fa-eye');}
}
function adminLogout(){ Swal.fire({title:'Log Out?',icon:'question',showCancelButton:true,confirmButtonText:'Yes',confirmButtonColor:'#2563eb'}).then(r=>{if(r.isConfirmed)auth.signOut().then(()=>location.reload());}); }

function sendAdminNotification(){
  const title=$('notify-title').value.trim(), body=$('notify-message').value.trim();
  const target=$('notify-target').value, targetUid=target==='user'?$('notify-user').value:'';
  if(!title||!body) return Swal.fire('Missing information','Enter a title and message first.','warning');
  if(target==='user'&&!targetUid) return Swal.fire('Select user','Choose the recipient user.','warning');
  Swal.fire({title:'Send notification?',text:target==='all'?'This message will appear for all users.':'This message will appear for the selected user.',icon:'question',showCancelButton:true,confirmButtonText:'Send',confirmButtonColor:'#4f46e5'}).then(async result=>{
    if(!result.isConfirmed) return;
    try{
      await db.collection('notifications').add({
        title,body,audience:target==='all'?'all':'user',
        targetUid:target==='user'?targetUid:null,
        createdBy:auth.currentUser?auth.currentUser.uid:null,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      $('notify-title').value=''; $('notify-message').value='';
      Swal.fire({icon:'success',title:'Notification sent',text:'It is now available in the user panel inbox.',timer:1800,showConfirmButton:false});
    }catch(err){Swal.fire('Send failed',err.message,'error');}
  });
}
$('notify-target')?.addEventListener('change',()=>{$('notify-user-wrap').classList.toggle('hidden',$('notify-target').value!=='user');});

auth.onAuthStateChanged(user=>{
  if(Swal.isVisible()) Swal.close();
  if(user){
    $('login-sec').classList.add('hidden');
    $('admin-app').classList.remove('hidden');
    document.body.classList.remove('modal-open');
    document.body.style.top='';
    if(!listenersStarted) startAllListeners();
    updateDashDate(); updateGreeting();
  } else {
    $('login-sec').classList.remove('hidden');
    $('admin-app').classList.add('hidden');
  }
});

function updateDashDate(){
  const d=new Date();
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  setText('dash-date',`${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`);
}
function updateGreeting(){
  const h=new Date().getHours();
  let g='Good Morning';
  if(h>=12 && h<17) g='Good Afternoon';
  else if(h>=17 && h<21) g='Good Evening';
  else if(h>=21 || h<5) g='Good Night';
  setText('welcome-greeting', g);
}

/* ═══════════════ NAVIGATION ═══════════════ */
function navTo(tab){
  document.querySelectorAll('main > section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.nvi').forEach(n=>n.classList.remove('on'));
  const v=$('view-'+tab); if(v) v.classList.remove('hidden');
  const b=$('nav-'+tab); if(b) b.classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
  if(tab==='deposits') renderDeposits();
  if(tab==='orders') renderOrders();
}
function openSettingPage(name){
  document.querySelectorAll('main > section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.nvi').forEach(n=>n.classList.remove('on'));
  const v=$('view-settings-'+name); if(v) v.classList.remove('hidden');
  if($('nav-dashboard')) $('nav-dashboard').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
}
function showConfirm(t,m,cb){
  setText('confirm-title',t); setText('confirm-msg',m||'');
  confirmCallback=cb;
  $('confirm-modal').classList.remove('hidden'); lockBodyScroll();
}
function closeConfirm(){ $('confirm-modal').classList.add('hidden'); confirmCallback=null; unlockBodyScroll(); }

/* ═══════════════ LISTENERS ═══════════════ */
function startAllListeners(){
  listenersStarted=true;

  db.collection('users').onSnapshot(snap=>{
    allUsers=[];
    snap.forEach(doc=>allUsers.push(Object.assign({id:doc.id},doc.data())));
    allUsers.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const recipient=$('notify-user');
    if(recipient){
      const selected=recipient.value;
      recipient.innerHTML='<option value="">Choose user...</option>'+allUsers.map(u=>'<option value="'+esc(u.id)+'">'+esc(u.name||u.email||u.id)+' — '+esc(u.email||u.id)+'</option>').join('');
      recipient.value=selected;
    }
    setText('dash-users',allUsers.length);
    renderUsers(allUsers);
    if(currentUserView) refreshCurrentUserView();
  });

  db.collection('deposits').onSnapshot(snap=>{
    allDeposits=[];
    snap.forEach(doc=>allDeposits.push(Object.assign({id:doc.id},doc.data())));
    setText('dash-pending-dep',allDeposits.filter(d=>d.status==='pending').length);
    const ap=allDeposits.filter(d=>d.status==='approved').reduce((s,d)=>s+parseInt(d.amount||0),0);
    setText('dash-total-dep','৳ '+ap.toLocaleString());
    renderDeposits();
  });

  db.collection('orders').onSnapshot(snap=>{
    allOrders=[];
    snap.forEach(doc=>allOrders.push(Object.assign({id:doc.id},doc.data())));
    setText('dash-orders',allOrders.length);
    setText('dash-pending-ord',allOrders.filter(o=>normalizeStatus(o.status)==='pending').length);
    let revenue=0, todayCount=0;
    const today=new Date(); today.setHours(0,0,0,0);
    allOrders.forEach(o=>{
      if(normalizeStatus(o.status)==='success') revenue+=parseInt(o.price||0);
      if(o.date){const d=o.date.toDate?o.date.toDate():new Date(o.date); if(d>=today) todayCount++;}
    });
    setText('dash-revenue','৳ '+revenue.toLocaleString());
    setText('dash-today-orders',todayCount);
    renderOrders();
    renderRecentActivity();
  });

  db.collection('categories').orderBy('order','asc').onSnapshot(snap=>{
    allCategories=[];
    snap.forEach(doc=>allCategories.push(Object.assign({id:doc.id},doc.data())));
    setText('kpi-categories',allCategories.length);
    setText('cat-count',allCategories.length);
    renderCategories();
    renderCategorySelector();
  });

  db.collection('services').onSnapshot(snap=>{
    allProducts=[]; productsCache={};
    snap.forEach(doc=>{ const d=Object.assign({id:doc.id},doc.data()); allProducts.push(d); productsCache[doc.id]=d; });
    setText('kpi-products',allProducts.length);
    renderProducts();
    if(currentEditingProduct) setText('pm-game-title',(productsCache[currentEditingProduct]||{}).name||'Game');
  });

  db.collection('banners').onSnapshot(snap=>{
    allBanners=[];
    snap.forEach(doc=>allBanners.push(Object.assign({id:doc.id},doc.data())));
    setText('kpi-banners',allBanners.length);
    renderBanners();
  });

  db.collection('codes').onSnapshot(snap=>{
    allCodes=[];
    snap.forEach(doc=>allCodes.push(Object.assign({id:doc.id},doc.data())));
    setText('kpi-codes',allCodes.filter(c=>!c.used).length);
    renderCodes();
  });

  db.collection('notifications').orderBy('createdAt','desc').limit(30).onSnapshot(snap=>{
    const box=$('admin-notifications-list'); if(!box) return;
    if(snap.empty){box.innerHTML='<div class="text-xs p-3" style="color:var(--muted)">No notifications sent yet.</div>';return;}
    box.innerHTML='';
    snap.forEach(doc=>{
      const n=doc.data();
      const item=document.createElement('div'); item.className='card mb-2';
      item.innerHTML='<div class="font-bold text-sm">'+esc(n.title||'Notification')+'</div><p class="text-xs mt-1" style="color:var(--muted)">'+esc(n.body||'')+'</p><div class="text-[10px] mt-2" style="color:var(--muted)">'+(n.audience==='all'?'All users':'Specific user')+' · '+esc(fmtDate(n.createdAt))+'</div>';
      box.appendChild(item);
    });
  },err=>{const box=$('admin-notifications-list');if(box)box.textContent='Unable to load notifications: '+err.message;});

  db.collection('settings').doc('general').onSnapshot(doc=>{
    settingsData=doc.exists?doc.data():{};
    siteName=settingsData.siteName||'SYL TOPUP BD';
    setText('dash-welcome',siteName);
    setText('header-sitename',siteName+' Control');
    setText('loginSiteName',siteName);
    document.title=siteName+' ADMIN';
    loadSettingsUI(settingsData);
  });

  db.collection('settings').doc('ranks').onSnapshot(doc=>{
    ranksList=(doc.exists&&Array.isArray(doc.data().ranks))?doc.data().ranks:DEFAULT_RANKS;
    renderRanks();
  });

  db.collection('admin').doc('payment').onSnapshot(doc=>{
    paymentConfig=doc.exists?doc.data():{};
    ['bkash','nagad','rocket'].forEach(k=>{
      if($('set-'+k)) $('set-'+k).value=paymentConfig[k]||'';
      if($('set-'+k+'-qr')) $('set-'+k+'-qr').value=paymentConfig[k+'Qr']||'';
      if($('set-'+k+'-inst')) $('set-'+k+'-inst').value=paymentConfig['instruction'+k.charAt(0).toUpperCase()+k.slice(1)]||'';
      if($('set-logo-'+k)) $('set-logo-'+k).value=paymentConfig['logo'+k.charAt(0).toUpperCase()+k.slice(1)]||'';
      updatePreview('preview-'+k+'-qr',paymentConfig[k+'Qr']);
      updatePreview('preview-logo-'+k,paymentConfig['logo'+k.charAt(0).toUpperCase()+k.slice(1)]);
    });
  });

  db.collection('settings').doc('playerApi').onSnapshot(doc=>{
    playerApiConfig=doc.exists?doc.data():{url:'',namePath:'player.name',method:'GET'};
    ['url','method','name-path','level-path','likes-path','diamonds-path','exp-path'].forEach(k=>{
      const id='set-api-'+k;
      const fieldName=k.replace(/-([a-z])/g, (g)=>g[1].toUpperCase());
      if($(id)) $(id).value=playerApiConfig[fieldName]||'';
    });
  });

  db.collection('settings').doc('accountPricing').onSnapshot(doc=>{
    accountPricing=doc.exists?doc.data():{basePrice:100,levelPrice:2,likePrice:0.5,diamondPrice:0.8};
    ['base','level-price','like-price','diamond-price'].forEach(k=>{
      const id='set-acc-'+k;
      const fieldName=k.replace(/-([a-z])/g, (g)=>g[1].toUpperCase());
      if($(id)) $(id).value=accountPricing[fieldName]??'';
    });
  });
}

/* ═══════════════ USERS ═══════════════ */
function renderUsers(arr){
  const l=$('users-list'); if(!l) return;
  if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-users"></i><p>No users</p></div>'; return; }
  const f=document.createDocumentFragment();
  arr.slice(0,100).forEach(u=>{
    const d=document.createElement('div');
    d.className='user-row';
    const initial=(u.name||u.email||'U').charAt(0).toUpperCase();
    const rank=getUserRank(parseInt(u.totalSpend||0));
    let badgeHtml='';
    if(u.isVerified) badgeHtml+='<i class="fas fa-check-circle text-blue-500" style="font-size:10px" title="Verified"></i>';
    if(u.isPremium) badgeHtml+='<i class="fas fa-crown text-yellow-500" style="font-size:10px" title="Premium"></i>';
    const picHtml = (u.profilePic && u.profilePic.trim())
      ? '<div class="user-av"><img src="'+esc(u.profilePic)+'" onerror="this.parentNode.textContent=\''+initial+'\'"></div>'
      : '<div class="user-av">'+initial+'</div>';
    d.innerHTML=picHtml+
      '<div class="flex-1 min-w-0"><p class="font-extrabold text-[13px] text-[var(--ink)] truncate">'+esc(u.name||'User')+' '+badgeHtml+'</p>'+
      '<p class="text-[10px] text-[var(--muted)] truncate">'+esc(u.email||u.id)+'</p>'+
      '<div class="flex items-center gap-2 mt-0.5"><p class="text-[11px] text-[var(--brand)] font-black mono">৳'+(u.balance||0)+'</p><span class="text-[9px] font-bold" style="color:'+rank.color+'"><i class="fas '+rank.icon+'"></i> '+rank.name+'</span></div></div>'+
      '<button type="button" class="btn btn-subtle btn-xs" onclick="viewUser(\''+u.id+'\')">View</button>';
    f.appendChild(d);
  });
  l.innerHTML=''; l.appendChild(f);
}
function searchUser(){
  const q=($('user-search').value||'').toLowerCase();
  renderUsers(allUsers.filter(u=>
    (u.email||'').toLowerCase().includes(q) ||
    (u.name||'').toLowerCase().includes(q) ||
    (u.id||'').toLowerCase().includes(q) ||
    (u.phone||'').toLowerCase().includes(q)
  ));
}
function viewUser(uid){
  currentUserView=allUsers.find(u=>u.id===uid);
  if(!currentUserView) return;
  currentUserTab='actions';
  switchUserTab('actions');
  refreshCurrentUserView();
  $('user-modal').classList.remove('hidden');
  lockBodyScroll();
}
function refreshCurrentUserView(){
  const u=allUsers.find(x=>x.id===currentUserView.id);
  if(!u) return;
  currentUserView=u;
  const initial=(u.name||'U').charAt(0).toUpperCase();
  const wrap=$('m-avatar-wrap');
  if(u.profilePic && u.profilePic.trim()){
    wrap.innerHTML='<img src="'+esc(u.profilePic)+'" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML=\'<span>'+initial+'</span>\'">';
  } else { wrap.innerHTML='<span>'+initial+'</span>'; }
  setText('m-name',u.name||'User');
  setText('m-email',u.email||'-');
  setText('m-phone',u.phone||'');
  setText('m-uid',shortId(u.id,'USR'));
  setText('m-pin',u.supportPin||'-');
  const rank=getUserRank(parseInt(u.totalSpend||0));
  setText('m-rank',rank.name);
  setText('m-balance',u.balance||0);
  setText('m-orders',u.totalOrders||0);
  setText('m-spent',u.totalSpend||0);
  setText('m-weekly',u.weeklySpend||0);
  $('m-verified-toggle').checked=!!u.isVerified;
  $('m-premium-toggle').checked=!!u.isPremium;
  $('m-badge-verified').classList.toggle('hidden', !u.isVerified);
  $('m-badge-premium').classList.toggle('hidden', !u.isPremium);
  $('edit-user-pic').value=u.profilePic||'';
  $('edit-user-name').value=u.name||'';
  $('edit-user-phone').value=u.phone||'';
  $('bal-amount').value='';
  $('bal-reason').value='';
  // Load user's orders and deposits
  renderUserOrders(u.id);
  renderUserDeposits(u.id);
}
function switchUserTab(tab){
  currentUserTab=tab;
  ['actions','orders','deposits'].forEach(t=>{
    $('utab-'+t).classList.toggle('on', t===tab);
    $('utab-content-'+t).classList.toggle('hidden', t!==tab);
  });
}
function renderUserOrders(uid){
  const l=$('user-orders-list'); if(!l) return;
  const arr=allOrders.filter(o=>o.userId===uid).sort((a,b)=>{
    const da=a.date?.toDate?a.date.toDate():new Date(a.date||0);
    const db2=b.date?.toDate?b.date.toDate():new Date(b.date||0);
    return db2-da;
  });
  if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>No orders yet</p></div>'; return; }
  l.innerHTML=arr.slice(0,20).map(o=>{
    const st=normalizeStatus(o.status);
    let badgeCls='badge-warn', badgeTxt='Pending', icon='clock';
    if(st==='success'){ badgeCls='badge-success'; badgeTxt='Success'; icon='check'; }
    else if(st==='cancelled'){ badgeCls='badge-danger'; badgeTxt='Cancelled'; icon='ban'; }
    else if(st==='refunded'){ badgeCls='badge-info'; badgeTxt='Refunded'; icon='rotate-left'; }
    return '<div class="order-card" style="padding:10px">'+
      '<div class="flex justify-between items-center mb-1"><b class="text-[11px]">'+esc(o.gameName||'-')+'</b><span class="badge '+badgeCls+'"><i class="fas fa-'+icon+'"></i> '+badgeTxt+'</span></div>'+
      '<p class="text-[10px] text-[var(--muted)]">'+esc(o.productName||'-')+' · ৳'+o.price+'</p>'+
      '<p class="text-[9px] text-[var(--muted2)] mt-1">'+fmtDate(o.date)+'</p></div>';
  }).join('');
}
function renderUserDeposits(uid){
  const l=$('user-deposits-list'); if(!l) return;
  const arr=allDeposits.filter(d=>d.userId===uid).sort((a,b)=>{
    const da=a.date?.toDate?a.date.toDate():new Date(a.date||0);
    const db2=b.date?.toDate?b.date.toDate():new Date(b.date||0);
    return db2-da;
  });
  if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-wallet"></i><p>No deposits yet</p></div>'; return; }
  l.innerHTML=arr.slice(0,20).map(d=>{
    let badgeCls='badge-warn', badgeTxt='Pending';
    if(d.status==='approved'){ badgeCls='badge-success'; badgeTxt='Approved'; }
    else if(d.status==='rejected'){ badgeCls='badge-danger'; badgeTxt='Rejected'; }
    return '<div class="order-card" style="padding:10px">'+
      '<div class="flex justify-between items-center mb-1"><b class="text-[11px]">৳'+d.amount+' · '+(d.method||'').toUpperCase()+'</b><span class="badge '+badgeCls+'">'+badgeTxt+'</span></div>'+
      '<p class="text-[9px] text-[var(--muted2)]">TrxID: <span class="mono">'+esc(d.trxId||'-')+'</span></p>'+
      '<p class="text-[9px] text-[var(--muted2)] mt-0.5">'+fmtDate(d.date)+'</p></div>';
  }).join('');
}
function closeUserModal(){ $('user-modal').classList.add('hidden'); currentUserView=null; unlockBodyScroll(); }

async function updateBalance(s){
  if(!currentUserView) return;
  const a=parseInt($('bal-amount').value);
  if(!a||a<=0) return floatToast('Enter valid amount','#dc2626');
  const reason=$('bal-reason').value.trim()||(s>0?'Admin credit':'Admin debit');
  const f=s*a;
  Swal.showLoading();
  try {
    const r=db.collection('users').doc(currentUserView.id);
    let nb;
    await db.runTransaction(async t=>{
      const d=await t.get(r);
      const c=d.exists?(d.data().balance||0):0;
      nb=c+f;
      t.update(r,{balance:nb});
    });
    // Log transaction
    await db.collection('transactions').add({
      userId:currentUserView.id, type:s>0?'admin_credit':'admin_debit',
      amount:f, reason, balanceAfter:nb, date:new Date(), by:'admin'
    });
    setText('m-balance',nb);
    $('bal-amount').value=''; $('bal-reason').value='';
    Swal.fire({icon:'success',title:'Updated!',text:(f>0?'+':'')+'৳'+f+' → ৳'+nb,timer:1500,showConfirmButton:false});
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
async function regeneratePin(){
  if(!currentUserView) return;
  const ok=await Swal.fire({title:'Regenerate PIN?',text:'New 5-digit pin will be set',icon:'question',showCancelButton:true,confirmButtonColor:'#2563eb'});
  if(!ok.isConfirmed) return;
  const newPin=Math.floor(10000+Math.random()*90000);
  try {
    await db.collection('users').doc(currentUserView.id).update({supportPin:newPin});
    setText('m-pin',newPin);
    floatToast('New PIN: '+newPin,'#10b981');
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
async function saveUserInfo(){
  if(!currentUserView) return;
  const n=$('edit-user-name').value.trim();
  const p=$('edit-user-phone').value.trim();
  const pic=$('edit-user-pic').value.trim();
  const verified=$('m-verified-toggle').checked;
  const premium=$('m-premium-toggle').checked;
  if(!n) return floatToast('Name required','#dc2626');
  try {
    await db.collection('users').doc(currentUserView.id).update({name:n,phone:p,profilePic:pic,isVerified:verified,isPremium:premium});
    floatToast('Saved ✓','#10b981');
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
async function resetUserPassword(){
  if(!currentUserView) return;
  const ok=await Swal.fire({
    title:'Send Reset Email?',
    html:'Password reset link will be sent to:<br><b>'+esc(currentUserView.email)+'</b>',
    icon:'question',showCancelButton:true,confirmButtonColor:'#2563eb'
  });
  if(!ok.isConfirmed) return;
  try {
    await auth.sendPasswordResetEmail(currentUserView.email);
    Swal.fire('Sent!','Check user inbox','success');
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
async function resetWeeklySpend(){
  if(!currentUserView) return;
  const ok=await Swal.fire({title:'Reset Weekly Spend?',text:'Set to 0 for this user',icon:'question',showCancelButton:true,confirmButtonColor:'#2563eb'});
  if(!ok.isConfirmed) return;
  try {
    await db.collection('users').doc(currentUserView.id).update({weeklySpend:0});
    floatToast('Weekly reset to 0','#10b981');
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
function deleteUser(){
  if(!currentUserView) return;
  showConfirm('Delete User + Data?','Orders, deposits, codes will also be deleted.',async()=>{
    try {
      const uid=currentUserView.id;
      // Cascade delete
      const [ords, deps, cds] = await Promise.all([
        db.collection('orders').where('userId','==',uid).get(),
        db.collection('deposits').where('userId','==',uid).get(),
        db.collection('codes').where('usedBy','==',uid).get()
      ]);
      const batch=db.batch();
      ords.forEach(d=>batch.delete(d.ref));
      deps.forEach(d=>batch.delete(d.ref));
      cds.forEach(d=>batch.delete(d.ref));
      batch.delete(db.collection('users').doc(uid));
      await batch.commit();
      closeUserModal();
      floatToast('User + Data deleted','#dc2626');
    } catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function openCreateUser(){
  ['new-user-name','new-user-email','new-user-phone','new-user-pass'].forEach(id=>{ if($(id)) $(id).value=''; });
  $('new-user-balance').value='0';
  $('create-user-modal').classList.remove('hidden'); lockBodyScroll();
}
function closeCreateUser(){ $('create-user-modal').classList.add('hidden'); unlockBodyScroll(); }
async function createUser(){
  const n=$('new-user-name').value.trim();
  const e=$('new-user-email').value.trim();
  const p=$('new-user-phone').value.trim();
  const pw=$('new-user-pass').value;
  const b=parseInt($('new-user-balance').value)||0;
  if(!n||!e||!p||!pw) return floatToast('All fields required','#dc2626');
  if(pw.length<6) return floatToast('Password 6+ chars','#dc2626');
  Swal.showLoading();
  try {
    const sa=firebase.apps.find(a=>a.name==='secondary')||firebase.initializeApp(firebaseConfig,'secondary');
    const sc=firebase.auth(sa);
    const cr=await sc.createUserWithEmailAndPassword(e,pw);
    await db.collection('users').doc(cr.user.uid).set({
      name:n, email:e, phone:p, profilePic:'', bio:'',
      balance:b, totalSpend:0, weeklySpend:0, totalOrders:0,
      supportPin:Math.floor(10000+Math.random()*90000),
      isVerified:false, isPremium:false, createdAt:new Date()
    });
    await sc.signOut();
    Swal.fire({icon:'success',title:'User Created!',text:n,timer:1600,showConfirmButton:false});
    closeCreateUser();
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}

/* ═══════════════ DEPOSITS ═══════════════ */
function filterDeposits(f){
  depositFilter=f;
  ['pending','approved','rejected','all'].forEach(k=>{ const b=$('dep-tab-'+k); if(b) b.classList.remove('on'); });
  const btn=$('dep-tab-'+f); if(btn) btn.classList.add('on');
  renderDeposits();
}
function renderDeposits(){
  const l=$('deposits-list'); if(!l) return;
  const q=($('dep-search')?.value||'').toLowerCase();
  let arr=allDeposits.filter(d=>depositFilter==='all' || d.status===depositFilter);
  if(q) arr=arr.filter(d=>
    (d.trxId||'').toLowerCase().includes(q) ||
    (d.userEmail||'').toLowerCase().includes(q) ||
    (d.senderNumber||'').toLowerCase().includes(q) ||
    String(d.amount||'').includes(q)
  );
  arr.sort((a,b)=>{
    const da=a.date?.toDate?a.date.toDate():new Date(a.date||0);
    const db2=b.date?.toDate?b.date.toDate():new Date(b.date||0);
    return db2-da;
  });
  if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>No '+(depositFilter==='all'?'':' '+depositFilter)+' deposits</p></div>'; return; }
  const f=document.createDocumentFragment();
  arr.forEach(d=>{
    const c=document.createElement('div');
    c.className='card';
    const depRef=shortId(d.id,'DEP');
    c.innerHTML='<div class="flex justify-between items-start mb-2"><div><p class="text-[9.5px] font-extrabold text-[var(--muted)] uppercase tracking-widest">'+esc((d.method||'Bank').toUpperCase())+'</p><p class="text-xl font-black text-[var(--ink)] mt-0.5 mono">৳ '+d.amount+'</p></div><span class="id-badge dep" onclick="copyText(\''+depRef+'\')"><i class="fas fa-hashtag" style="font-size:8px"></i> '+depRef.replace('#DEP-','')+'</span></div>'+
      '<div class="bg-[#f8fafc] rounded-xl p-2.5 mb-2.5 space-y-1">'+
        '<p class="text-[10px] text-[var(--muted)]"><i class="fas fa-user w-3"></i> '+esc(d.userEmail||d.userId)+'</p>'+
        (d.senderNumber?'<p class="text-[10px] text-[var(--muted)]"><i class="fas fa-phone w-3"></i> '+esc(d.senderNumber)+'</p>':'')+
        (d.trxId?'<p class="text-[10px] text-[var(--muted)]"><i class="fas fa-receipt w-3"></i> TrxID: <span class="mono text-[var(--ink)]">'+esc(d.trxId)+'</span></p>':'')+
        '<p class="text-[10px] text-[var(--muted)]"><i class="far fa-clock w-3"></i> '+fmtDate(d.date)+'</p>'+
      '</div>'+
      (d.status==='pending'
        ? '<div class="grid grid-cols-2 gap-2"><button type="button" class="btn btn-danger btn-sm" onclick="rejectDeposit(\''+d.id+'\')"><i class="fas fa-times"></i> Reject</button><button type="button" class="btn btn-success btn-sm" onclick="approveDeposit(\''+d.id+'\',\''+d.userId+'\','+d.amount+')"><i class="fas fa-check"></i> Approve</button></div>'
        : '<div class="flex items-center justify-center gap-1.5 '+(d.status==='approved'?'badge badge-success':'badge badge-danger')+' w-full py-2" style="font-size:11px"><i class="fas fa-'+(d.status==='approved'?'check-circle':'times-circle')+'"></i> '+d.status.toUpperCase()+'</div>');
    f.appendChild(c);
  });
  l.innerHTML=''; l.appendChild(f);
}
async function approveDeposit(docId,userId,amount){
  Swal.fire({title:'Approve Deposit?',html:'Add <b>৳'+amount+'</b> to user wallet?',icon:'warning',showCancelButton:true,confirmButtonColor:'#10b981',confirmButtonText:'Yes'}).then(async r=>{
    if(!r.isConfirmed) return;
    Swal.showLoading();
    try {
      const ur=db.collection('users').doc(userId);
      await db.runTransaction(async t=>{
        const ud=await t.get(ur);
        const c=ud.exists?(ud.data().balance||0):0;
        if(ud.exists) t.update(ur,{balance:c+parseInt(amount)});
        else t.set(ur,{balance:parseInt(amount)});
        t.update(db.collection('deposits').doc(docId),{status:'approved',approvedAt:new Date()});
      });
      Swal.fire('Approved','৳'+amount+' added','success');
    } catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function rejectDeposit(docId){
  showConfirm('Reject Deposit?','User will not receive money.',async()=>{
    try { await db.collection('deposits').doc(docId).update({status:'rejected',rejectedAt:new Date()}); floatToast('Rejected','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}

/* ═══════════════ ORDERS ═══════════════ */
function filterOrders(f){
  orderFilter=f;
  ['pending','success','cancelled','refunded','all'].forEach(k=>{ const b=$('ord-tab-'+k); if(b) b.classList.remove('on'); });
  const btn=$('ord-tab-'+f); if(btn) btn.classList.add('on');
  renderOrders();
}
function renderOrders(){
  const l=$('orders-list'); if(!l) return;
  const q=($('ord-search')?.value||'').toLowerCase();
  let arr=allOrders.slice();
  if(orderFilter!=='all') arr=arr.filter(o=>normalizeStatus(o.status)===orderFilter);
  if(q) arr=arr.filter(o=>
    (o.playerId||'').toLowerCase().includes(q) ||
    (o.trxId||'').toLowerCase().includes(q) ||
    (o.userEmail||'').toLowerCase().includes(q) ||
    (o.gameName||'').toLowerCase().includes(q)
  );
  arr.sort((a,b)=>{
    const da=a.date?.toDate?a.date.toDate():new Date(a.date||0);
    const db2=b.date?.toDate?b.date.toDate():new Date(b.date||0);
    return db2-da;
  });
  if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>No '+orderFilter+' orders</p></div>'; return; }
  const f=document.createDocumentFragment();
  arr.slice(0,100).forEach(o=>{
    const st=normalizeStatus(o.status);
    let cls='order-card';
    if(st==='success') cls+=' done';
    else if(st==='cancelled'||st==='rejected') cls+=' cancel';
    let sh='';
    if(st==='success') sh='<span class="badge badge-success"><i class="fas fa-check-circle"></i> Success</span>';
    else if(st==='cancelled') sh='<span class="badge badge-danger"><i class="fas fa-ban"></i> Cancelled</span>';
    else if(st==='refunded') sh='<span class="badge badge-info"><i class="fas fa-rotate-left"></i> Refunded</span>';
    else sh='<span class="badge badge-warn"><i class="fas fa-clock"></i> Pending</span>';
    const ordRef=shortId(o.id,'ORD');
    const c=document.createElement('div');
    c.className=cls;
    c.innerHTML='<div class="flex items-start justify-between mb-1.5"><div class="min-w-0 flex-1"><h4 class="font-extrabold text-[13px] text-[var(--ink)] truncate"><i class="fas fa-gamepad text-[var(--brand)] text-[10px] mr-1"></i>'+esc(o.gameName||'-')+'</h4><div class="flex gap-1 mt-1 flex-wrap"><span class="id-badge ord" onclick="copyText(\''+ordRef+'\')"><i class="fas fa-hashtag" style="font-size:8px"></i> '+ordRef.replace('#ORD-','')+'</span><span class="text-[9px] text-[var(--muted)] mt-0.5">'+fmtDate(o.date)+'</span></div></div><span class="font-black text-[var(--brand)] text-base ml-2 whitespace-nowrap mono">৳'+o.price+'</span></div>'+
      '<div class="flex flex-wrap gap-1 mb-1.5">'+sh+'<span class="badge badge-info">'+(o.paymentType==='direct'?(o.paymentMethod||'Direct').toUpperCase():'WALLET')+'</span>'+(o.trxId?'<span class="badge badge-info mono">'+esc(o.trxId)+'</span>':'')+'</div>'+
      '<div class="order-info"><p class="k">Package</p><p class="v">'+esc(o.productName||'-')+'</p><p class="k mt-1.5">Player ID</p><p class="v mono">'+esc(o.playerId||'-')+'</p><p class="k mt-1.5">User</p><p class="v text-[10.5px] truncate">'+esc(o.userEmail||o.userName||'-')+'</p>'+(o.senderNumber?'<p class="k mt-1.5">Sender</p><p class="v mono text-[10.5px]">'+esc(o.senderNumber)+'</p>':'')+'</div>'+
      (st==='pending'
        ? '<div class="grid grid-cols-3 gap-1.5"><button type="button" class="btn btn-danger btn-xs" onclick="cancelOrder(\''+o.id+'\')"><i class="fas fa-ban"></i> Cancel</button><button type="button" class="btn btn-warn btn-xs" onclick="refundOrder(\''+o.id+'\',\''+o.userId+'\','+o.price+')"><i class="fas fa-undo"></i> Refund</button><button type="button" class="btn btn-success btn-xs" onclick="completeOrder(\''+o.id+'\',\''+o.userId+'\','+o.price+',\''+(o.paymentType||'wallet')+'\')"><i class="fas fa-check"></i> Done</button></div>'
        : '<button type="button" class="btn btn-subtle btn-sm btn-full" onclick="deleteOrder(\''+o.id+'\')"><i class="fas fa-trash"></i> Delete</button>');
    f.appendChild(c);
  });
  l.innerHTML=''; l.appendChild(f);
}
async function completeOrder(id,uid,price,payType){
  const needStatsUpdate = payType === 'direct';
  let html = 'Mark this order as <b>Success</b>?';
  if(needStatsUpdate) html += '<br><br><small style="color:#f59e0b"><i class="fas fa-info-circle"></i> Stats will be updated (instant pay order)</small>';
  const ok=await Swal.fire({title:'Complete Order?',html,icon:'question',showCancelButton:true,confirmButtonColor:'#10b981'});
  if(!ok.isConfirmed) return;
  Swal.showLoading();
  try {
    const batch=db.batch();
    batch.update(db.collection('orders').doc(id),{status:'success',completedAt:new Date()});
    // BUG FIX: For instant pay orders, user stats are never updated by user panel
    // So admin must add them on approval
    if(needStatsUpdate && uid){
      batch.update(db.collection('users').doc(uid),{
        totalSpend:firebase.firestore.FieldValue.increment(parseInt(price)),
        weeklySpend:firebase.firestore.FieldValue.increment(parseInt(price)),
        totalOrders:firebase.firestore.FieldValue.increment(1)
      });
    }
    await batch.commit();
    Swal.fire('Completed','Order marked as success','success');
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
function cancelOrder(id){
  showConfirm('Cancel Order?','User will see this as cancelled.',async()=>{
    try { await db.collection('orders').doc(id).update({status:'cancelled',cancelledAt:new Date()}); floatToast('Cancelled','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function refundOrder(id,uid,amt){
  showConfirm('Refund Order?','Return ৳'+amt+' to user wallet?',async()=>{
    Swal.showLoading();
    try {
      const ur=db.collection('users').doc(uid);
      await db.runTransaction(async t=>{
        const ud=await t.get(ur);
        const c=ud.exists?(ud.data().balance||0):0;
        if(ud.exists) t.update(ur,{balance:c+parseInt(amt)});
        t.update(db.collection('orders').doc(id),{status:'refunded',refundedAt:new Date()});
      });
      Swal.fire('Refunded','৳'+amt+' returned','success');
    } catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function deleteOrder(id){
  showConfirm('Delete Order?','Cannot be undone.',async()=>{
    try { await db.collection('orders').doc(id).delete(); floatToast('Deleted','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function renderRecentActivity(){
  const el=$('dash-recent'); if(!el) return;
  const arr=allOrders.slice().sort((a,b)=>{
    const da=a.date?.toDate?a.date.toDate():new Date(a.date||0);
    const db2=b.date?.toDate?b.date.toDate():new Date(b.date||0);
    return db2-da;
  }).slice(0,5);
  if(arr.length===0){ el.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>No recent activity</p></div>'; return; }
  const f=document.createDocumentFragment();
  arr.forEach(o=>{
    const st=normalizeStatus(o.status);
    let badgeCls='badge-warn';
    if(st==='success') badgeCls='badge-success';
    else if(st==='cancelled'||st==='refunded') badgeCls='badge-danger';
    const d=document.createElement('div');
    d.className='user-row';
    const initial=(o.userName||'U').charAt(0).toUpperCase();
    d.innerHTML='<div class="user-av">'+initial+'</div>'+
      '<div class="flex-1 min-w-0"><p class="text-[12px] font-bold truncate">'+esc(o.productName||'-')+'</p><p class="text-[10px] text-[var(--muted)] truncate">'+esc(o.userEmail||'-')+'</p></div>'+
      '<div class="text-right"><p class="text-[12px] font-black text-[var(--brand)] mono">৳'+o.price+'</p><span class="badge '+badgeCls+' mt-0.5" style="font-size:8px">'+st+'</span></div>';
    f.appendChild(d);
  });
  el.innerHTML=''; el.appendChild(f);
}

/* ═══════════════ CATEGORIES ═══════════════ */
function addCategory(){
  const n=$('cat-name').value.trim();
  if(!n) return floatToast('Name required','#dc2626');
  const o=allCategories.length>0 ? Math.max(...allCategories.map(c=>parseInt(c.order)||0))+1 : 1;
  db.collection('categories').add({name:n,order:o,createdAt:new Date()})
    .then(()=>{ $('cat-name').value=''; floatToast('Added ✓','#10b981'); })
    .catch(e=>Swal.fire('Error',e.message,'error'));
}
function renderCategories(){
  const l=$('categories-list'); if(!l) return;
  if(allCategories.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-layer-group"></i><p>No categories</p></div>'; return; }
  const f=document.createDocumentFragment();
  allCategories.forEach((c,i)=>{
    const d=document.createElement('div');
    d.className='reorder-item';
    const initials=(c.name||'?').charAt(0).toUpperCase();
    d.innerHTML='<div class="reorder-ic">'+initials+'</div><div class="reorder-info"><div class="reorder-title">'+esc(c.name)+'</div><div class="reorder-sub"><span class="reorder-index">#'+(i+1)+'</span></div></div>'+
      '<div class="reorder-actions">'+
        '<button type="button" class="reorder-btn" onclick="moveCategory(\''+c.id+'\',-1)" '+(i===0?'disabled':'')+'><i class="fas fa-arrow-up"></i></button>'+
        '<button type="button" class="reorder-btn" onclick="moveCategory(\''+c.id+'\',1)" '+(i===allCategories.length-1?'disabled':'')+'><i class="fas fa-arrow-down"></i></button>'+
        '<button type="button" class="reorder-btn danger" onclick="deleteCategory(\''+c.id+'\')"><i class="fas fa-trash"></i></button>'+
      '</div>';
    f.appendChild(d);
  });
  l.innerHTML=''; l.appendChild(f);
}
function moveCategory(id,dir){
  const idx=allCategories.findIndex(c=>c.id===id);
  if(idx<0) return;
  const newIdx=idx+dir;
  if(newIdx<0||newIdx>=allCategories.length) return;
  [allCategories[idx],allCategories[newIdx]]=[allCategories[newIdx],allCategories[idx]];
  allCategories.forEach((c,i)=>{ c.order=i+1; });
  renderCategories();
  const batch=db.batch();
  allCategories.forEach(c=>{ batch.update(db.collection('categories').doc(c.id),{order:c.order}); });
  batch.commit().then(()=>floatToast('Order saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error'));
}
function deleteCategory(id){
  showConfirm('Delete Category?','Products remain but category disappears.',async()=>{
    try { await db.collection('categories').doc(id).delete(); floatToast('Deleted','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function renderCategorySelector(){
  const b=$('cp-cat-selector'); if(!b) return;
  b.innerHTML='';
  if(allCategories.length===0){ b.innerHTML='<p class="text-[11px] text-[var(--muted)] py-1">No categories</p>'; return; }
  allCategories.forEach(c=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='cat-selector-btn'+(cpSelectedCategory===c.name?' on':'');
    btn.innerHTML='<i class="fas fa-folder text-[9px]"></i> '+esc(c.name);
    btn.onclick=()=>{ cpSelectedCategory=c.name; renderCategorySelector(); };
    b.appendChild(btn);
  });
}

/* ═══════════════ PRODUCTS ═══════════════ */
function openCreateProduct(){
  ['cp-name','cp-image','cp-input-label','cp-input-placeholder','cp-rules'].forEach(id=>{ if($(id)) $(id).value=''; });
  cpSelectedCategory='';
  renderCategorySelector();
  $('create-product-modal').classList.remove('hidden'); lockBodyScroll();
}
function closeCreateProduct(){ $('create-product-modal').classList.add('hidden'); unlockBodyScroll(); }
async function submitCreateProduct(){
  const n=$('cp-name').value.trim();
  const i=$('cp-image').value.trim();
  if(!n) return floatToast('Name required','#dc2626');
  if(!i) return floatToast('Image required','#dc2626');
  if(!cpSelectedCategory) return floatToast('Select category','#dc2626');
  const btn=$('cp-submit-btn');
  btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent"></div>';
  btn.disabled=true;
  const payload={
    name:n, image:i, category:cpSelectedCategory,
    inputLabel:$('cp-input-label').value.trim()||'প্লেয়ার আইডি বসান',
    inputPlaceholder:$('cp-input-placeholder').value.trim()||'প্লেয়ার আইডি বসান',
    rules:$('cp-rules').value.trim(), createdAt:new Date()
  };
  try {
    await db.collection('services').add(payload);
    floatToast('Created ✓','#10b981');
    closeCreateProduct();
  } catch(e){ Swal.fire('Error',e.message,'error'); }
  finally { btn.innerHTML='<i class="fas fa-check"></i> Create'; btn.disabled=false; }
}
function openEditProduct(id){
  const p=productsCache[id]; if(!p) return;
  $('ep-id').value=id;
  $('ep-name').value=p.name||'';
  $('ep-image').value=p.image||'';
  $('ep-input-label').value=p.inputLabel||'';
  $('ep-input-placeholder').value=p.inputPlaceholder||'';
  $('ep-rules').value=p.rules||'';
  $('edit-product-modal').classList.remove('hidden'); lockBodyScroll();
}
function closeEditProduct(){ $('edit-product-modal').classList.add('hidden'); unlockBodyScroll(); }
async function saveEditProduct(){
  const id=$('ep-id').value; if(!id) return;
  Swal.showLoading();
  try {
    await db.collection('services').doc(id).update({
      name:$('ep-name').value.trim(), image:$('ep-image').value.trim(),
      inputLabel:$('ep-input-label').value.trim(), inputPlaceholder:$('ep-input-placeholder').value.trim(),
      rules:$('ep-rules').value.trim()
    });
    floatToast('Saved ✓','#10b981');
    closeEditProduct();
  } catch(e){ Swal.fire('Error',e.message,'error'); }
}
function renderProducts(){
  const l=$('products-grid-list'); if(!l) return;
  if(allProducts.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-gamepad"></i><p>No products</p></div>'; return; }
  const grouped={};
  allProducts.forEach(p=>{ const cn=p.category||'Uncategorized'; if(!grouped[cn]) grouped[cn]=[]; grouped[cn].push(p); });
  const ordered=[];
  allCategories.forEach(c=>{ if(grouped[c.name]){ ordered.push({name:c.name,items:grouped[c.name]}); delete grouped[c.name]; } });
  Object.keys(grouped).forEach(k=>ordered.push({name:k,items:grouped[k]}));
  let h='';
  ordered.forEach(cat=>{
    h+='<div style="margin-bottom:16px"><div class="section-header" style="margin:0 0 10px 0"><div class="section-header-left"><div class="section-header-bar"></div><span class="section-header-txt">'+esc(cat.name)+'</span></div><span class="section-header-cnt">'+cat.items.length+'</span></div>';
    cat.items.forEach(p=>{
      h+='<div class="bg-white rounded-xl p-2.5 border border-[var(--line)] shadow-sm flex items-center gap-2.5 mb-2">'+
        '<img src="'+esc(p.image)+'" class="w-12 h-12 rounded-xl object-cover bg-[#f1f5f9] border border-[var(--line)] flex-shrink-0" onerror="this.src=\'https://placehold.co/60?text=Game\'">'+
        '<div class="flex-1 min-w-0"><p class="font-extrabold text-[12.5px] text-[var(--ink)] truncate">'+esc(p.name)+'</p><p class="text-[10px] text-[var(--muted)] mt-0.5 truncate mono">'+shortId(p.id,'GME')+'</p></div>'+
        '<div class="flex flex-col gap-1 flex-shrink-0">'+
          '<button type="button" class="btn btn-xs" style="background:#eff6ff;color:var(--brand)" onclick="openEditProduct(\''+p.id+'\')"><i class="fas fa-pen"></i></button>'+
          '<button type="button" class="btn btn-xs" style="background:#f5f3ff;color:#7c3aed" onclick="openPackages(\''+p.id+'\')"><i class="fas fa-boxes"></i></button>'+
          '<button type="button" class="btn btn-xs" style="background:#fef2f2;color:#ef4444" onclick="deleteProduct(\''+p.id+'\')"><i class="fas fa-trash"></i></button>'+
        '</div></div>';
    });
    h+='</div>';
  });
  l.innerHTML=h;
}
function deleteProduct(id){
  showConfirm('Delete Product?','Packages will also be removed.',async()=>{
    try {
      const p=await db.collection('services').doc(id).collection('products').get();
      await Promise.all(p.docs.map(d=>d.ref.delete()));
      await db.collection('services').doc(id).delete();
      floatToast('Deleted','#dc2626');
    } catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function openPackages(pid){
  currentEditingProduct=pid;
  const p=productsCache[pid]; if(!p) return;
  setText('pm-game-title',p.name);
  $('products-main-view').classList.add('hidden');
  $('packages-manager-view').classList.remove('hidden');
  renderPackages(pid);
  window.scrollTo({top:0,behavior:'smooth'});
}
function closePackagesView(){
  if(currentPackagesUnsub){ currentPackagesUnsub(); currentPackagesUnsub=null; }
  currentEditingProduct=null;
  $('packages-manager-view').classList.add('hidden');
  $('products-main-view').classList.remove('hidden');
}
function renderPackages(pid){
  const l=$('packages-list'); if(!l) return;
  if(currentPackagesUnsub){ currentPackagesUnsub(); currentPackagesUnsub=null; }
  l.innerHTML='<div class="text-center py-6"><div class="spinner"></div></div>';
  currentPackagesUnsub=db.collection('services').doc(pid).collection('products').orderBy('price','asc').onSnapshot(snap=>{
    if(snap.empty){ l.innerHTML='<div class="empty-state"><i class="fas fa-cube"></i><p>No packages</p></div>'; setText('pkg-count','0'); return; }
    setText('pkg-count',snap.size);
    const f=document.createDocumentFragment();
    snap.forEach(doc=>{
      const p=doc.data(), pkgId=doc.id, inSt=p.stock!==false&&p.stock!=='out';
      const auto=getPkgIcon(p.name);
      let ih = (p.icon&&p.icon.trim())
        ? '<div class="pkg-manage-icon"><img src="'+esc(p.icon)+'" onerror="this.parentNode.innerHTML=\'<i class=&quot;fas '+auto.icon+'&quot; style=&quot;color:'+auto.color+'&quot;></i>\'"></div>'
        : '<div class="pkg-manage-icon"><i class="fas '+auto.icon+'" style="color:'+auto.color+'"></i></div>';
      const c=document.createElement('div');
      c.className='pkg-manage-card';
      c.innerHTML='<div class="pkg-manage-head">'+ih+'<div class="flex-1 min-w-0"><p class="font-extrabold text-[13px] text-[var(--ink)] truncate">'+esc(p.name||'-')+'</p><p class="text-base font-black text-[var(--brand)] mt-0.5 mono">৳ '+p.price+'</p></div><span class="stock-toggle '+(inSt?'in':'out')+'" onclick="toggleStock(\''+pid+'\',\''+pkgId+'\','+inSt+')"><i class="fas fa-'+(inSt?'check-circle':'times-circle')+'"></i> '+(inSt?'IN':'OUT')+'</span></div>'+
        '<div class="flex gap-2"><button type="button" class="btn btn-icon-sm" style="background:#fee2e2;color:#ef4444" onclick="deletePackage(\''+pid+'\',\''+pkgId+'\')"><i class="fas fa-trash"></i></button></div>';
      f.appendChild(c);
    });
    l.innerHTML=''; l.appendChild(f);
  }, err=>{ l.innerHTML='<div class="empty-state"><i class="fas fa-circle-exclamation"></i><p>'+esc(err.message)+'</p></div>'; });
}
function getPkgIcon(n){
  if(!n) return {icon:'fa-gem',color:'#2563eb'};
  const l=n.toLowerCase();
  if(l.includes('diamond')||l.includes('dia')||l.includes('gem')) return {icon:'fa-gem',color:'#2563eb'};
  if(l.includes('uc')) return {icon:'fa-star',color:'#f59e0b'};
  if(l.includes('coin')||l.includes('gold')) return {icon:'fa-coins',color:'#f59e0b'};
  if(l.includes('week')) return {icon:'fa-calendar-week',color:'#8b5cf6'};
  if(l.includes('pass')) return {icon:'fa-ticket',color:'#10b981'};
  if(l.includes('vip')) return {icon:'fa-crown',color:'#eab308'};
  return {icon:'fa-gem',color:'#2563eb'};
}
async function addPackage(){
  if(!currentEditingProduct) return;
  const n=$('pkg-name').value.trim();
  const p=parseInt($('pkg-price').value);
  const i=$('pkg-icon').value.trim();
  if(!n) return floatToast('Name required','#dc2626');
  if(!p||p<=0) return floatToast('Valid price required','#dc2626');
  const btn=$('pkg-add-btn');
  btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent"></div>';
  btn.disabled=true;
  try {
    await db.collection('services').doc(currentEditingProduct).collection('products').add({name:n,price:p,icon:i,stock:true,createdAt:new Date()});
    $('pkg-name').value=''; $('pkg-price').value=''; $('pkg-icon').value='';
    floatToast('Added ✓','#10b981');
  } catch(e){ Swal.fire('Error',e.message,'error'); }
  finally { btn.innerHTML='<i class="fas fa-plus"></i> Add'; btn.disabled=false; }
}
function toggleStock(pid,pkgId,curr){
  const ns=!curr;
  db.collection('services').doc(pid).collection('products').doc(pkgId).update({stock:ns})
    .then(()=>floatToast(ns?'In Stock ✓':'Out',ns?'#10b981':'#dc2626')).catch(e=>Swal.fire('Error',e.message,'error'));
}
function deletePackage(pid,pkgId){
  showConfirm('Delete Package?','',async()=>{
    try { await db.collection('services').doc(pid).collection('products').doc(pkgId).delete(); floatToast('Deleted','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}

/* ═══════════════ BANNERS ═══════════════ */
function addBanner(){
  const u=$('banner-url').value.trim();
  const link=$('banner-link').value.trim();
  if(!u) return floatToast('Image URL required','#dc2626');
  db.collection('banners').add({image:u,link:link,createdAt:new Date()})
    .then(()=>{ $('banner-url').value=''; $('banner-link').value=''; floatToast('Added ✓','#10b981'); })
    .catch(e=>Swal.fire('Error',e.message,'error'));
}
function renderBanners(){
  const l=$('banners-list'); if(!l) return;
  if(allBanners.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-image"></i><p>No banners</p></div>'; return; }
  const f=document.createDocumentFragment();
  allBanners.forEach(b=>{
    const d=document.createElement('div');
    d.className='relative rounded-2xl overflow-hidden bg-[#f1f5f9] border border-[var(--line)] shadow-sm mb-3';
    d.innerHTML='<div style="aspect-ratio:16/9"><img src="'+esc(b.image)+'" class="w-full h-full object-cover" onerror="this.src=\'https://placehold.co/600x300?text=Banner\'"></div>'+
      (b.link?'<div class="absolute bottom-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-bold"><i class="fas fa-link" style="font-size:8px"></i> Link</div>':'')+
      '<button type="button" class="absolute top-2 right-2 btn btn-icon-sm" style="background:rgba(220,38,38,.9);color:#fff;width:32px;height:32px" onclick="deleteBanner(\''+b.id+'\')"><i class="fas fa-xmark"></i></button>';
    f.appendChild(d);
  });
  l.innerHTML=''; l.appendChild(f);
}
function deleteBanner(id){
  showConfirm('Delete Banner?','',async()=>{
    try { await db.collection('banners').doc(id).delete(); floatToast('Deleted','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}

/* ═══════════════ RANKS ═══════════════ */
function addRank(){
  const n=$('rk-name').value.trim();
  if(!n) return floatToast('Name required','#dc2626');
  const mn=parseInt($('rk-min').value)||0;
  const mx=parseInt($('rk-max').value)||0;
  if(mx<=mn) return floatToast('Max must be > Min','#dc2626');
  const nr=ranksList.concat([{
    name:n, icon:$('rk-icon').value.trim()||'fa-medal',
    min:mn, max:mx, tagline:$('rk-tagline').value.trim(),
    color:$('rk-color').value.trim()||'#f59e0b',
    png:$('rk-png').value.trim()
  }]);
  nr.sort((a,b)=>a.min-b.min);
  db.collection('settings').doc('ranks').set({ranks:nr},{merge:true})
    .then(()=>{
      ['rk-name','rk-icon','rk-min','rk-max','rk-tagline','rk-png'].forEach(id=>{ if($(id)) $(id).value=''; });
      $('rk-color').value='#f59e0b';
      floatToast('Added ✓','#10b981');
    }).catch(e=>Swal.fire('Error',e.message,'error'));
}
function renderRanks(){
  const l=$('ranks-list'); if(!l) return;
  setText('ranks-count', ranksList.length);
  if(ranksList.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-medal"></i><p>No custom ranks</p></div>'; return; }
  const f=document.createDocumentFragment();
  ranksList.forEach((r,i)=>{
    const d=document.createElement('div');
    d.className='reorder-item';
    let iconHtml = (r.png&&r.png.trim())
      ?'<div class="reorder-ic" style="background:'+r.color+'25"><img src="'+esc(r.png)+'" onerror="this.parentNode.innerHTML=\'<i class=&quot;fas '+(r.icon||'fa-medal')+'&quot; style=&quot;color:'+r.color+'&quot;></i>\'"></div>'
      :'<div class="reorder-ic" style="background:'+r.color+'25;color:'+r.color+'"><i class="fas '+(r.icon||'fa-medal')+'"></i></div>';
    d.innerHTML=iconHtml+'<div class="reorder-info"><div class="reorder-title">'+esc(r.name)+'</div><div class="reorder-sub">'+r.min+' - '+r.max+' ৳</div></div><div class="reorder-actions"><button type="button" class="reorder-btn danger" onclick="deleteRank('+i+')"><i class="fas fa-trash"></i></button></div>';
    f.appendChild(d);
  });
  l.innerHTML=''; l.appendChild(f);
}
function deleteRank(i){
  showConfirm('Delete Rank?','',()=>{
    const a=ranksList.slice(); a.splice(i,1);
    db.collection('settings').doc('ranks').set({ranks:a},{merge:true}).then(()=>floatToast('Deleted','#dc2626'));
  });
}

/* ═══════════════ CODES ═══════════════ */
function addRedeemCode(){
  const c=$('code-value').value.trim().toUpperCase();
  const a=parseInt($('code-amount').value);
  if(!c) return floatToast('Code required','#dc2626');
  if(!a) return floatToast('Amount required','#dc2626');
  db.collection('codes').where('code','==',c).limit(1).get().then(snap=>{
    if(!snap.empty) return floatToast('Code exists','#f59e0b');
    return db.collection('codes').add({code:c,amount:a,used:false,usedBy:null,createdAt:new Date()}).then(()=>{
      $('code-value').value=''; $('code-amount').value='';
      floatToast('Code created ✓','#10b981');
    });
  }).catch(e=>Swal.fire('Error',e.message,'error'));
}
function renderCodes(){
  const l=$('codes-list'); if(!l) return;
  if(allCodes.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>No codes</p></div>'; return; }
  const sorted=allCodes.slice().sort((a,b)=>{
    const da=a.createdAt?.toDate?a.createdAt.toDate():new Date(a.createdAt||0);
    const db2=b.createdAt?.toDate?b.createdAt.toDate():new Date(b.createdAt||0);
    return db2-da;
  });
  const f=document.createDocumentFragment();
  sorted.forEach(c=>{
    const d=document.createElement('div');
    d.className='user-row';
    let usedByHtml='';
    if(c.used && c.usedBy){
      const usedUser=allUsers.find(u=>u.id===c.usedBy);
      usedByHtml='<p class="text-[9px] text-red-600 font-bold mt-0.5 truncate"><i class="fas fa-user" style="font-size:8px"></i> '+esc(usedUser?(usedUser.email||usedUser.name):shortId(c.usedBy,'USR'))+'</p>';
    }
    d.innerHTML='<div class="w-10 h-10 rounded-xl '+(c.used?'bg-red-50 text-red-500':'bg-emerald-50 text-emerald-600')+' flex items-center justify-center text-sm flex-shrink-0"><i class="fas fa-ticket-alt"></i></div><div class="flex-1 min-w-0"><p class="font-extrabold text-[12.5px] text-[var(--ink)] mono truncate">'+esc(c.code)+'</p><p class="text-[10px] text-[var(--muted)] mono">৳'+c.amount+' · '+(c.used?'Used':'Available')+'</p>'+usedByHtml+'</div><button type="button" class="btn btn-icon-sm" style="background:#fee2e2;color:#ef4444" onclick="deleteCode(\''+c.id+'\')"><i class="fas fa-trash"></i></button>';
    f.appendChild(d);
  });
  l.innerHTML=''; l.appendChild(f);
}
function deleteCode(id){
  showConfirm('Delete Code?','',async()=>{
    try { await db.collection('codes').doc(id).delete(); floatToast('Deleted','#dc2626'); }
    catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}

/* ═══════════════ SETTINGS ═══════════════ */
function loadSettingsUI(d){
  const map={
    'set-site-name':'siteName','set-tagline':'tagline','set-email':'email',
    'set-user-login-url':'userLoginUrl','set-user-logo-url':'userLogoUrl',
    'set-wallet-logo':'walletLogo','set-instant-logo':'instantLogo',
    'set-telegram':'telegram','set-group-link':'groupLink','set-yt':'youtube'
  };
  Object.keys(map).forEach(id=>{ const el=$(id); if(el) el.value=d[map[id]]||''; });
  updatePreview('preview-wallet-logo',d.walletLogo);
  updatePreview('preview-instant-logo',d.instantLogo);
  updatePreview('preview-login-img',d.userLoginUrl||d.logoUrl);
  updatePreview('preview-home-img',d.userLogoUrl||d.logoUrl);
}
function updatePreview(boxId,url){
  const b=$(boxId); if(!b) return;
  if(url&&url.trim()){
    b.classList.add('has-img');
    b.innerHTML='<img src="'+esc(url)+'" onerror="this.parentNode.innerHTML=\'<span class=&quot;img-hint&quot;>⚠ Error</span>\'">';
  } else {
    b.classList.remove('has-img');
    b.innerHTML='<span class="img-hint">No image</span>';
  }
}

document.addEventListener('input',(e)=>{
  const t=e.target;
  if(t.id==='set-user-login-url') updatePreview('preview-login-img',t.value.trim());
  else if(t.id==='set-user-logo-url') updatePreview('preview-home-img',t.value.trim());
  else if(t.id==='set-wallet-logo') updatePreview('preview-wallet-logo',t.value.trim());
  else if(t.id==='set-instant-logo') updatePreview('preview-instant-logo',t.value.trim());
  else if(t.id==='set-bkash-qr') updatePreview('preview-bkash-qr',t.value.trim());
  else if(t.id==='set-nagad-qr') updatePreview('preview-nagad-qr',t.value.trim());
  else if(t.id==='set-rocket-qr') updatePreview('preview-rocket-qr',t.value.trim());
  else if(t.id==='set-logo-bkash') updatePreview('preview-logo-bkash',t.value.trim());
  else if(t.id==='set-logo-nagad') updatePreview('preview-logo-nagad',t.value.trim());
  else if(t.id==='set-logo-rocket') updatePreview('preview-logo-rocket',t.value.trim());
});

function switchPayTab(k){
  ['bkash','nagad','rocket'].forEach(x=>{
    const tab=$('ptab-'+x); if(tab) tab.classList.toggle('on',x===k);
    const panel=$('pay-panel-'+x); if(panel) panel.classList.toggle('hidden',x!==k);
  });
}
function saveSiteInfo(){
  db.collection('settings').doc('general').set({
    siteName:$('set-site-name').value.trim(),
    tagline:$('set-tagline').value.trim(),
    email:$('set-email').value.trim()
  },{merge:true}).then(()=>floatToast('Saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error'));
}
function saveBranding(){
  const lu=$('set-user-login-url').value.trim();
  const hu=$('set-user-logo-url').value.trim();
  const wl=$('set-wallet-logo').value.trim();
  const il=$('set-instant-logo').value.trim();
  const lb=$('set-logo-bkash').value.trim();
  const ln=$('set-logo-nagad').value.trim();
  const lr=$('set-logo-rocket').value.trim();
  Promise.all([
    db.collection('settings').doc('general').set({
      userLoginUrl:lu, userLogoUrl:hu, logoUrl:hu,
      walletLogo:wl, instantLogo:il
    },{merge:true}),
    db.collection('admin').doc('payment').set({
      logoBkash:lb, logoNagad:ln, logoRocket:lr
    },{merge:true})
  ]).then(()=>floatToast('All saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error'));
}
function savePayment(){
  const data={
    bkash:$('set-bkash').value.trim(),
    nagad:$('set-nagad').value.trim(),
    rocket:$('set-rocket').value.trim(),
    bkashQr:$('set-bkash-qr').value.trim(),
    nagadQr:$('set-nagad-qr').value.trim(),
    rocketQr:$('set-rocket-qr').value.trim(),
    instructionBkash:$('set-bkash-inst').value.trim(),
    instructionNagad:$('set-nagad-inst').value.trim(),
    instructionRocket:$('set-rocket-inst').value.trim()
  };
  db.collection('admin').doc('payment').set(data,{merge:true}).then(()=>floatToast('Payment saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error'));
}
function saveSocial(){
  db.collection('settings').doc('general').set({
    telegram:$('set-telegram').value.trim(),
    groupLink:$('set-group-link').value.trim(),
    youtube:$('set-yt').value.trim()
  },{merge:true}).then(()=>floatToast('Saved ✓','#10b981'));
}
function savePlayerApi(){
  const data={
    url:$('set-api-url').value.trim(),
    method:$('set-api-method').value||'GET',
    namePath:$('set-api-name-path').value.trim()||'player.name',
    levelPath:$('set-api-level-path').value.trim(),
    likesPath:$('set-api-likes-path').value.trim(),
    diamondsPath:$('set-api-diamonds-path').value.trim(),
    expPath:$('set-api-exp-path').value.trim()
  };
  db.collection('settings').doc('playerApi').set(data,{merge:true})
    .then(()=>floatToast('API saved ✓','#10b981'))
    .catch(e=>Swal.fire('Error',e.message,'error'));
}
function saveAccountVal(){
  const data={
    basePrice:parseFloat($('set-acc-base').value)||0,
    levelPrice:parseFloat($('set-acc-level-price').value)||0,
    likePrice:parseFloat($('set-acc-like-price').value)||0,
    diamondPrice:parseFloat($('set-acc-diamond-price').value)||0
  };
  db.collection('settings').doc('accountPricing').set(data,{merge:true})
    .then(()=>floatToast('Pricing saved ✓','#10b981'))
    .catch(e=>Swal.fire('Error',e.message,'error'));
}

/* ═══════════════ PLAYER API TEST ═══════════════ */
function getNested(obj,path){
  if(!obj||!path) return undefined;
  return path.split('.').reduce((c,p)=>c&&c[p]!==undefined?c[p]:undefined,obj);
}
function buildTestUrl(rawUrl,uid){
  if(!rawUrl||!rawUrl.trim()) return {ok:false,error:'URL empty'};
  const cleanUid=String(uid).replace(/\D/g,'');
  try{
    if(rawUrl.indexOf('{uid}')!==-1){ const u=rawUrl.split('{uid}').join(encodeURIComponent(cleanUid)); new URL(u); return {ok:true,url:u}; }
    const parsed=new URL(rawUrl);
    if(!parsed.searchParams.get('uid')) parsed.searchParams.set('uid',cleanUid);
    return {ok:true,url:parsed.toString()};
  }catch(e){ return {ok:false,error:e.message}; }
}
function redact(data){
  if(!data||typeof data!=='object') return data;
  const sensitive=['token','secret','api_key','apikey','password','auth','access_token'];
  const clone=JSON.parse(JSON.stringify(data));
  (function scan(obj){
    if(!obj||typeof obj!=='object') return;
    for(const k of Object.keys(obj)){
      if(sensitive.some(sk=>k.toLowerCase().includes(sk))) obj[k]='***';
      else if(typeof obj[k]==='object') scan(obj[k]);
    }
  })(clone);
  return clone;
}
async function testPlayerApi(){
  const box=$('api-test-result'); if(!box) return;
  const uid=($('api-test-uid').value.trim()||'').replace(/\D/g,'');
  const rawUrl=$('set-api-url').value.trim();
  const method=$('set-api-method').value||'GET';
  const namePath=$('set-api-name-path').value.trim()||'player.name';
  if(!rawUrl) return box.className='api-test-result error',box.innerHTML='<div>❌ Enter API URL</div>',box.classList.remove('hidden');
  if(!uid||uid.length<5) return box.className='api-test-result error',box.innerHTML='<div>❌ Valid UID required (5+)</div>',box.classList.remove('hidden');
  const built=buildTestUrl(rawUrl,uid);
  if(!built.ok) return box.className='api-test-result error',box.innerHTML='<div>❌ '+built.error+'</div>',box.classList.remove('hidden');
  box.className='api-test-result';
  box.innerHTML='<p style="font-weight:700;color:#334155">⏳ Testing UID: '+uid+'</p><p style="font-size:9.5px;color:#64748b;margin-top:4px;word-break:break-all">'+built.url+'</p><div style="margin-top:12px;text-align:center"><div class="spinner"></div></div>';
  box.classList.remove('hidden');
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),20000);
  const opts={method,headers:{Accept:'application/json'},signal:ctrl.signal};
  if(method==='POST'){ opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify({uid}); }
  try{
    const res=await fetch(built.url,opts); clearTimeout(timer);
    const steps=[];
    steps.push({s:res.ok?'ok':'fail',m:'<b>Step 1:</b> HTTP '+res.status});
    if(!res.ok){ steps.push({s:'fail',m:'HTTP '+res.status}); box.className='api-test-result error'; box.innerHTML='<ul class="api-step-list">'+steps.map(x=>'<li><span class="'+x.s+'">●</span><span class="msg">'+x.m+'</span></li>').join('')+'</ul>'; return; }
    let data;
    try { const ct=res.headers.get('content-type')||''; data=ct.includes('json')?await res.json():JSON.parse(await res.text()); steps.push({s:'ok',m:'<b>Step 2:</b> JSON parsed ✓'}); }
    catch(e){ steps.push({s:'fail',m:'Invalid JSON'}); box.className='api-test-result error'; box.innerHTML='<ul class="api-step-list">'+steps.map(x=>'<li><span class="'+x.s+'">●</span><span class="msg">'+x.m+'</span></li>').join('')+'</ul>'; return; }
    const name=getNested(data,namePath);
    if(name&&typeof name==='string'&&name.trim()){ steps.push({s:'ok',m:'<b>Name:</b> <b style="color:#065f46">'+name+'</b>'}); }
    else { steps.push({s:'fail',m:'<b>Name NOT found at</b> <code>'+namePath+'</code>'}); }
    const anyFail=steps.some(x=>x.s==='fail');
    box.className=anyFail?'api-test-result warn':'api-test-result success';
    box.innerHTML='<ul class="api-step-list">'+steps.map(x=>'<li><span class="'+x.s+'">'+(x.s==='ok'?'✓':'✕')+'</span><span class="msg">'+x.m+'</span></li>').join('')+'</ul><details style="margin-top:12px"><summary style="cursor:pointer;color:#1d4ed8;font-weight:800;font-size:11px">View Response</summary><pre style="margin-top:8px;font-size:9.5px;background:#fff;padding:10px;border-radius:8px;max-height:200px;overflow:auto;border:1px solid #e5e9f2">'+esc(JSON.stringify(redact(data),null,2).slice(0,1500))+'</pre></details>';
  } catch(err){
    clearTimeout(timer);
    const msg=err.name==='AbortError'?'⏱ Timeout':err.message.includes('CORS')?'🌐 CORS error':err.message||'Unknown';
    box.className='api-test-result error';
    box.innerHTML='<ul class="api-step-list"><li><span class="fail">✕</span><span class="msg"><b>Failed:</b> '+esc(msg)+'</span></li></ul>';
  }
}

/* ═══════════════ INIT ═══════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  document.addEventListener('click',(e)=>{
    if(e.target&&e.target.id==='confirm-yes'){
      if(typeof confirmCallback==='function') confirmCallback();
      closeConfirm();
    }
  });
  updateDashDate(); updateGreeting();
});
