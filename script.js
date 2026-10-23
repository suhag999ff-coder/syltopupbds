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
const setText = (id, v) => { const el = $(id); if(el) el.textContent = v; };

let currentUser=null, userData={}, userBalance=0, totalSpend=0, weeklySpend=0;
let allGames=[], gamesCache={}, allCategories=[];
let currentGame=null, selectedProduct=null, selectedPayOpt='wallet';
let siteConfig={};
let paymentConfig={};
let ranksList=[];
let playerApiConfig = {};
let accountPricing = {};
let bannersList = [];
let bannerIndex = 0, bannerTimer = null;

let checkoutContext = 'addmoney';
let pendingOrder = null;
let depositAmount = 0;
let currentDepMethod = 'bkash';
const DEFAULT_LOGOS = {
  bkash: 'https://i.ibb.co.com/9kCCTNsx/1656227518bkash-logo-png.png',
  nagad: 'https://i.ibb.co.com/VcqJTvpn/Nagad-Logo-horizontally-og.png',
  rocket: 'https://i.ibb.co.com/wFZkNM48/rocket-color-logo-mobile-banking-icon-free-png.png'
};

function toast(msg, color='#0f172a'){ 
  const t=$('toast'); t.textContent=msg; t.style.background=color; t.classList.add('show'); 
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200); 
}
function lockBody(){ const y=window.scrollY; document.body.style.top=`-${y}px`; document.body.classList.add('modal-open'); }
function unlockBody(){ const y=document.body.style.top; document.body.classList.remove('modal-open'); document.body.style.top=''; if(y) window.scrollTo(0,parseInt(y||'0')*-1); }
function fmtDate(dv){ if(!dv) return 'N/A'; const d=dv.toDate?dv.toDate():new Date(dv); return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}); }

function toggleAuth(mode){
  if(mode==='login'){ $('loginForm').classList.remove('hidden'); $('registerForm').classList.add('hidden'); $('btnLogin').classList.add('on'); $('btnReg').classList.remove('on'); }
  else { $('loginForm').classList.add('hidden'); $('registerForm').classList.remove('hidden'); $('btnReg').classList.add('on'); $('btnLogin').classList.remove('on'); }
}
async function handleLogin(){
  const e=$('loginEmail').value.trim(), p=$('loginPass').value;
  if(!e||!p) return Swal.fire('Error','সব ফিল্ড পূরণ করুন','warning');
  Swal.showLoading();
  try { await auth.signInWithEmailAndPassword(e,p); }
  catch(err){ Swal.fire('Login Failed', err.message, 'error'); }
}
async function handleRegister(){
  const n=$('regName').value.trim(), e=$('regEmail').value.trim(), ph=$('regPhone').value.trim(), p=$('regPass').value;
  if(!n||!e||!ph||!p) return Swal.fire('Error','সব ফিল্ড পূরণ করুন','warning');
  if(p.length<6) return Swal.fire('Error','পাসওয়ার্ড কমপক্ষে ৬ অক্ষর','warning');
  Swal.showLoading();
  try {
    const c = await auth.createUserWithEmailAndPassword(e,p);
    await db.collection('users').doc(c.user.uid).set({
      name:n, email:e, phone:ph, balance:0, totalSpend:0, weeklySpend:0, totalOrders:0,
      supportPin: Math.floor(10000+Math.random()*90000),
      profilePic:'', bio:'', isVerified: false, isPremium: false, createdAt: new Date()
    });
    Swal.fire({icon:'success', title:'Account Created!', timer:1500, showConfirmButton:false});
  } catch(err){ Swal.fire('Error', err.message, 'error'); }
}
function doLogout(){
  Swal.fire({title:'Log Out?', icon:'question', showCancelButton:true, confirmButtonText:'Yes', confirmButtonColor:'#2563eb'}).then(r=>{
    if(r.isConfirmed) auth.signOut();
  });
}

auth.onAuthStateChanged(async user => {
  if(user){
    currentUser = user;
    $('authSec').classList.add('hidden');
    $('app').classList.remove('hidden');
    startListeners();
  } else {
    currentUser = null;
    $('authSec').classList.add('hidden'); 
    $('app').classList.add('hidden');
    $('authSec').classList.remove('hidden');
  }
});

function startListeners(){
  db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
    if(!doc.exists) return;
    userData = doc.data();
    userBalance = parseInt(userData.balance||0);
    totalSpend = parseInt(userData.totalSpend||0);
    weeklySpend = parseInt(userData.weeklySpend||0);
    
    const initial = (userData.name||'U').charAt(0).toUpperCase();
    setText('hdrBalance', userBalance);
    setText('pBal', userBalance);
    setText('accBal', userBalance+'৳');
    setText('accOrders', userData.totalOrders||0);
    setText('accSpend', totalSpend.toLocaleString()+'৳');
    setText('accWeekly', weeklySpend.toLocaleString()+'৳');
    
    let badgesHtml = '';
    if(userData.isVerified) badgesHtml += '<i class="fas fa-check-circle" style="color:#3b82f6" title="Verified"></i>';
    if(userData.isPremium) badgesHtml += '<i class="fas fa-crown" style="color:#fbbf24" title="Premium"></i>';
    
    $('accNameBox').innerHTML = `<span id="accNameTxt">${userData.name||'User'}</span> ${badgesHtml}`;
    $('accNmName').innerHTML = `Hi, ${userData.name||'User'} ${badgesHtml}`;
    setText('accNmMail', userData.email||'-');
    setText('accEmailTxt', userData.email||'-');

    updateAvatar('avTxt', userData.profilePic, initial);
    
    const accAvBox = $('accAvatarBox');
    if(userData.profilePic && userData.profilePic.trim()){
      accAvBox.innerHTML = `<img src="${userData.profilePic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      accAvBox.innerHTML = `<span id="accAvatarTxt">${initial}</span>`;
    }
    
    const accAv = $('accAv');
    if(userData.profilePic && userData.profilePic.trim()){
      accAv.innerHTML = `<img src="${userData.profilePic}" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`;
    } else {
      accAv.innerHTML = `<svg class="i"><use href="#user"/></svg>`;
    }
    computeRank();
  });

  db.collection('settings').doc('general').onSnapshot(doc => {
    siteConfig = doc.exists ? doc.data() : {};
    const siteName = siteConfig.siteName || 'SYL TOPUP BD';
    document.title = siteName;
    setText('authBrand', siteName);
    setText('fSiteName', siteName);
    if(siteConfig.userLogoUrl || siteConfig.logoUrl){
      $('siteLogo').src = siteConfig.userLogoUrl || siteConfig.logoUrl;
    }
    if(siteConfig.userLoginUrl || siteConfig.logoUrl){
      $('loginLogo').innerHTML = '<img src="'+(siteConfig.userLoginUrl || siteConfig.logoUrl)+'">';
    }
    if(siteConfig.walletLogo && siteConfig.walletLogo.trim()){
      $('walletLogoBox').innerHTML = '<img src="'+siteConfig.walletLogo+'">';
    }
    if(siteConfig.instantLogo && siteConfig.instantLogo.trim()){
      $('instantLogoBox').innerHTML = '<img src="'+siteConfig.instantLogo+'">';
    }
    renderQuickLinks();
  });

  db.collection('admin').doc('payment').onSnapshot(doc => {
    paymentConfig = doc.exists ? doc.data() : {};
    updatePaymentLogos();
  });

  db.collection('settings').doc('ranks').onSnapshot(doc => {
    ranksList = (doc.exists && Array.isArray(doc.data().ranks)) ? doc.data().ranks : DEFAULT_RANKS;
    computeRank();
  });

  db.collection('banners').onSnapshot(snap => {
    bannersList = [];
    snap.forEach(d => bannersList.push(Object.assign({id:d.id}, d.data())));
    renderSlider();
  });

  db.collection('categories').orderBy('order','asc').onSnapshot(snap => {
    allCategories = [];
    snap.forEach(d => allCategories.push(Object.assign({id:d.id}, d.data())));
    renderHomeProducts();
  });

  db.collection('services').onSnapshot(snap => {
    allGames = []; gamesCache = {};
    snap.forEach(d => {
      const g = Object.assign({id:d.id}, d.data());
      allGames.push(g); gamesCache[d.id] = g;
    });
    renderHomeProducts();
  });

  db.collection('settings').doc('playerApi').onSnapshot(doc => {
    playerApiConfig = doc.exists ? doc.data() : {};
  });
  db.collection('settings').doc('accountPricing').onSnapshot(doc => {
    accountPricing = doc.exists ? doc.data() : {basePrice:100, levelPrice:2, likePrice:0.5, diamondPrice:0.8};
  });
}

function updateAvatar(elId, picUrl, letter){
  const el = $(elId); if(!el) return;
  if(picUrl && picUrl.trim()){
    el.innerHTML = '<img src="'+picUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    el.style.background = 'transparent'; el.style.color = '';
  } else {
    el.textContent = letter; el.style.background = ''; el.style.color = '';
  }
}

function renderQuickLinks() {
  const container = $('quickLinksContainer'); if(!container) return;
  const links = [
    { key: 'telegram-channel', label: 'Support', icon: 'tg', bg: 'var(--v2)' },
    { key: 'telegram-group', label: 'Join Group', icon: 'grp', bg: '#0ea5e9' },
    { key: 'youtube-channel', label: 'YouTube', icon: 'yt', bg: '#e53935' }
  ];
  container.innerHTML = links.map(l => `
    <a class="q" href="#" data-link="${l.key}">
      <span class="ic" style="background:${l.bg}"><svg class="f"><use href="#${l.icon}"/></svg></span>
      <span>${l.label}</span>
    </a>
  `).join('');
  const siteLinks = { 'telegram-channel': siteConfig.telegram, 'telegram-group': siteConfig.groupLink, 'youtube-channel': siteConfig.youtube };
  Object.keys(siteLinks).forEach(k => {
    document.querySelectorAll(`[data-link="${k}"]`).forEach(a => {
      if(siteLinks[k]) { a.href = siteLinks[k]; a.target = '_blank'; a.rel = 'noopener'; }
      else { a.href = '#'; a.onclick = e => e.preventDefault(); }
    });
  });
}

function renderSlider() {
  const track = $('track'), dots = $('dots');
  if(!track || !dots) return;
  if(bannersList.length === 0){
    track.innerHTML = '<div class="slide"><img src="https://placehold.co/800x400/1e293b/ffffff?text=No+Banner" alt="No Banner"></div>';
    dots.innerHTML = '';
    return;
  }
  let html = '';
  let dotHtml = '';
  bannersList.forEach((b, i) => {
    const img = b.image || 'https://placehold.co/800x400/1e293b/ffffff?text=Banner';
    const link = b.link || '#';
    html += `<div class="slide"><a href="${link}" ${link !== '#' ? 'target="_blank"' : 'onclick="event.preventDefault()"'}}><img src="${img}" alt="Banner"></a></div>`;
    dotHtml += `<i class="${i===0?'on':''}" onclick="goSlide(${i})"></i>`;
  });
  track.innerHTML = html;
  dots.innerHTML = dotHtml;
  bannerIndex = 0;
  updateSlidePosition();
  resetSliderTimer();
}

function updateSlidePosition() {
  const track = $('track');
  if(!track) return;
  track.style.transform = `translateX(-${bannerIndex * 100}%)`;
  const dots = document.querySelectorAll('#dots i');
  dots.forEach((d, i) => d.classList.toggle('on', i === bannerIndex));
}
function goSlide(i) { bannerIndex = i; updateSlidePosition(); resetSliderTimer(); }
function resetSliderTimer() {
  clearInterval(bannerTimer);
  if(bannersList.length <= 1) return;
  bannerTimer = setInterval(() => {
    bannerIndex = (bannerIndex + 1) % bannersList.length;
    updateSlidePosition();
  }, 4000);
}

let touchStartX = 0;
$('track')?.addEventListener('touchstart', e => touchStartX = e.touches[0].clientX, {passive:true});
$('track')?.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if(Math.abs(dx) > 40) {
    if(dx > 0) bannerIndex = (bannerIndex - 1 + bannersList.length) % bannersList.length;
    else bannerIndex = (bannerIndex + 1) % bannersList.length;
    updateSlidePosition();
    resetSliderTimer();
  }
}, {passive:true});

const DEFAULT_RANKS = [
  {name:'Bronze', min:0, max:100, tagline:'Start your journey', color:'#b45309', icon:'fa-medal'},
  {name:'Silver', min:101, max:1000, tagline:'Keep grinding', color:'#64748b', icon:'fa-medal'},
  {name:'Gold', min:1001, max:5000, tagline:'Shine brighter', color:'#f59e0b', icon:'fa-crown'},
  {name:'Platinum', min:5001, max:10000, tagline:'Elite status', color:'#0891b2', icon:'fa-gem'},
  {name:'Diamond', min:10001, max:25000, tagline:'Premium glow', color:'#a855f7', icon:'fa-gem'},
  {name:'Heroic', min:25001, max:50000, tagline:'Legendary', color:'#ef4444', icon:'fa-dragon'},
  {name:'Master', min:50001, max:100000, tagline:'Top tier', color:'#8b5cf6', icon:'fa-crown'},
  {name:'Grand Master', min:100001, max:999999999, tagline:'Ultimate', color:'#eab308', icon:'fa-crown'}
];

function computeRank() {
  if(!ranksList || ranksList.length===0){ ranksList = DEFAULT_RANKS; }
  let cur = ranksList[0], nxt = null;
  for(let i=0; i<ranksList.length; i++) {
    if(totalSpend >= (ranksList[i].min||0) && totalSpend <= (ranksList[i].max||999999999)) {
      cur = ranksList[i]; nxt = ranksList[i+1] || null; break;
    }
  }
  setText('rankName', cur.name);
  setText('rankTagline', cur.tagline || '');
  const faIcon = $('rankFaIcon'), imgIcon = $('rankImg');
  if(cur.png && cur.png.trim()) {
    imgIcon.src = cur.png; imgIcon.style.display = 'block'; faIcon.style.display = 'none';
  } else {
    faIcon.className = 'fas ' + (cur.icon || 'fa-medal');
    faIcon.style.color = cur.color || '#fbbf24';
    faIcon.style.display = 'block'; imgIcon.style.display = 'none';
  }
  const mn = cur.min || 0, mx = cur.max || 100;
  const pct = Math.min(100, Math.max(0, Math.round(((totalSpend - mn) / Math.max(1, mx - mn)) * 100)));
  $('rankProgress').style.width = pct + '%';
  setText('rankMin', mn.toLocaleString()+'৳');
  setText('rankMax', mx.toLocaleString()+'৳');
  if(nxt) {
    const need = Math.max(0, nxt.min - totalSpend);
    setText('rankNeed', 'Need ' + need.toLocaleString() + '৳ more');
  } else {
    setText('rankNeed', 'Max Rank Reached!');
    $('rankProgress').style.width = '100%';
  }
}

function renderHomeProducts(){
  const container = $('dynamicCategories'); if(!container) return;
  if(allGames.length===0){ 
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#9ca3af;font-size:12px;font-weight:600"><i class="fas fa-gamepad" style="font-size:36px;opacity:.25;margin-bottom:10px;display:block"></i>কোনো প্রোডাক্ট নেই</div>'; 
    return; 
  }
  const grouped = {};
  allGames.forEach(g => { 
    const cn=(g.category||'Other').trim(); 
    if(!grouped[cn]) grouped[cn]=[]; 
    grouped[cn].push(g); 
  });
  let html = '';
  allCategories.forEach(cat => {
    if(grouped[cat.name]) {
      html += `<div class="sec"><h2><em>${cat.name.toUpperCase()}</em></h2></div><div class="grid">`;
      grouped[cat.name].forEach(g => {
        html += `<div class="card" onclick="openGame('${g.id}')">
          <div class="thumb"><img src="${g.image||'https://placehold.co/220/1d4ed8/ffffff?text=Game'}" onerror="this.src='https://placehold.co/220/1d4ed8/ffffff?text=Game'" loading="lazy"></div>
          <p>${g.name||'Game'}</p>
        </div>`;
      });
      html += '</div>';
      delete grouped[cat.name];
    }
  });
  Object.keys(grouped).forEach(catName => {
    html += `<div class="sec"><h2><em>${catName.toUpperCase()}</em></h2></div><div class="grid">`;
    grouped[catName].forEach(g => {
      html += `<div class="card" onclick="openGame('${g.id}')">
        <div class="thumb"><img src="${g.image||'https://placehold.co/220/1d4ed8/ffffff?text=Game'}" onerror="this.src='https://placehold.co/220/1d4ed8/ffffff?text=Game'" loading="lazy"></div>
        <p>${g.name||'Game'}</p>
      </div>`;
    });
    html += '</div>';
  });
  container.innerHTML = html;
}

function openGame(gid){
  const g = gamesCache[gid]; if(!g) return;
  currentGame = g;
  selectedProduct = null;
  selectedPayOpt = 'wallet';
  $('homeView').classList.add('hidden');
  $('siteFooter').classList.add('hidden');
  $('productView').classList.remove('hidden');
  $('pvImg').src = g.image || '';
  setText('pvTitle', g.name || 'Game');
  setText('inpLabel', g.inputLabel || 'প্লেয়ার আইডি বসান');
  $('uidInp').value = '';
  $('uidInp').placeholder = g.inputPlaceholder || 'প্লেয়ার আইডি বসান';
  $('pname').className = 'pname';
  $('pname').innerHTML = '';
  $('buyBtn').innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now';
  setText('pNeed', '0');
  setText('pBal', userBalance);
  document.querySelectorAll('.po').forEach((p,i)=>p.classList.toggle('on', i===0));
  if(g.rules && g.rules.trim()){
    $('rulesBox').style.display = 'block';
    $('rulesList').innerHTML = g.rules.split('\n').map(x=>x.trim()).filter(Boolean).map(l=>'<li>'+l+'</li>').join('');
  } else {
    $('rulesBox').style.display = 'none';
  }
  const grid = $('pkGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#2563eb"></i></div>';
  db.collection('services').doc(gid).collection('products').orderBy('price','asc').get()
    .then(snap => {
      if(snap.empty){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#9ca3af;font-size:12px;font-weight:600">No packages available</div>'; return; }
      let html = '';
      snap.forEach(d => {
        const p = d.data();
        const inStock = p.stock !== false && p.stock !== 'out';
        const price = parseInt(p.price||0);
        const name = (p.name||'-').replace(/'/g,'&#39;');
        html += `<button type="button" class="pk ${inStock?'':'out'}" data-id="${d.id}" data-name="${name}" data-price="${price}" ${inStock?'':'disabled'} onclick="pickPkg(this)"><span>${name}</span><b>BDT ${price}</b></button>`;
      });
      grid.innerHTML = html;
    })
    .catch(e => { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#ef4444;font-size:12px">'+e.message+'</div>'; });
  window.scrollTo({top:0, behavior:'smooth'});
}

function pickPkg(btn){
  if(btn.classList.contains('out')) return;
  document.querySelectorAll('#pkGrid .pk').forEach(x => x.classList.remove('on'));
  btn.classList.add('on');
  selectedProduct = { id: btn.dataset.id, name: btn.dataset.name, price: parseInt(btn.dataset.price) };
  setText('pNeed', selectedProduct.price);
}

function selectPay(type){
  document.querySelectorAll('.po').forEach(x => x.classList.remove('on'));
  $('pay-opt-' + type).classList.add('on');
  selectedPayOpt = type;
}

async function checkName(){
  const uid = $('uidInp').value.trim().replace(/\D/g,'');
  const box = $('pname');
  if(uid.length < 5){ box.className = 'pname err'; box.innerHTML = '<svg class="i"><use href="#warn"/></svg>সঠিক প্লেয়ার আইডি দিন (কমপক্ষে ৫ সংখ্যা)'; return; }
  try {
    if(!playerApiConfig.url || !playerApiConfig.url.trim()){
      box.className = 'pname ok'; box.innerHTML = '<svg class="i"><use href="#chk"/></svg>আইডি: '+uid;
      return;
    }
    box.className = 'pname'; box.innerHTML = '<div style="text-align:center;padding:6px"><i class="fas fa-spinner fa-spin"></i> Checking...</div>';
    const built = buildApiUrl(playerApiConfig.url, uid);
    if(!built) throw new Error('Invalid API');
    const res = await fetch(built);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const namePath = playerApiConfig.namePath || 'player.name';
    const name = getNestedVal(data, namePath);
    if(name && typeof name === 'string' && name.trim()){
      box.className = 'pname ok';
      box.innerHTML = '<svg class="i"><use href="#chk"/></svg>'+name;
    } else {
      box.className = 'pname err';
      box.innerHTML = '<svg class="i"><use href="#warn"/></svg>প্লেয়ার পাওয়া যায়নি';
    }
  } catch(e){
    box.className = 'pname err';
    box.innerHTML = '<svg class="i"><use href="#warn"/></svg>'+(e.message||'Check failed');
  }
}
function buildApiUrl(url, uid){
  try {
    if(url.includes('{uid}')) return url.replace('{uid}', encodeURIComponent(uid));
    const u = new URL(url);
    if(!u.searchParams.get('uid')) u.searchParams.set('uid', uid);
    return u.toString();
  } catch(e){ return null; }
}
function getNestedVal(obj, path){
  if(!obj || !path) return undefined;
  return path.split('.').reduce((c, p) => c && c[p] !== undefined ? c[p] : undefined, obj);
}

function buyNow(){
  const uid = $('uidInp').value.trim().replace(/\D/g,'');
  if(!selectedProduct) return toast('আগে একটি প্যাকেজ সিলেক্ট করুন', '#f59e0b');
  if(uid.length < 5) return toast('সঠিক প্লেয়ার আইডি দিন', '#ef4444');
  if(selectedPayOpt === 'wallet'){
    if(userBalance < selectedProduct.price){
      return Swal.fire({
        icon: 'error', title: 'Insufficient Balance',
        html: 'ব্যালেন্স: <b>৳'+userBalance+'</b><br>প্রয়োজন: <b>৳'+selectedProduct.price+'</b>',
        showCancelButton: true, confirmButtonText: 'Add Money', cancelButtonText: 'Cancel', confirmButtonColor: '#2563eb'
      }).then(r => { if(r.isConfirmed) showSec('addmoney'); });
    }
    confirmWalletOrder(uid);
  } else {
    checkoutContext = 'order';
    pendingOrder = {
      gameId: currentGame.id, gameName: currentGame.name, playerId: uid,
      productId: selectedProduct.id, productName: selectedProduct.name, price: selectedProduct.price
    };
    depositAmount = selectedProduct.price;
    $('payViewTitle').textContent = "COMPLETE ORDER PAYMENT";
    $('depAmount').value = selectedProduct.price;
    showSec('payment');
    updatePaymentLogos();
    selectDepMethod('bkash');
  }
}

async function confirmWalletOrder(uid){
  const confirm = await Swal.fire({
    title: 'Confirm Order?',
    html: `<div style="text-align:left;font-size:13px;line-height:1.9;padding:6px 0">
      <b>Game:</b> ${currentGame.name}<br>
      <b>ID:</b> ${uid}<br>
      <b>Package:</b> ${selectedProduct.name}<br>
      <b>Price:</b> ৳${selectedProduct.price}<br>
      <b>Payment:</b> Wallet</div>`,
    icon: 'question', showCancelButton: true, confirmButtonColor: '#2563eb', confirmButtonText: 'Confirm'
  });
  if(!confirm.isConfirmed) return;
  Swal.showLoading();
  try {
    const orderData = {
      userId: currentUser.uid, userName: userData.name || currentUser.email, userEmail: currentUser.email,
      gameId: currentGame.id, gameName: currentGame.name, playerId: uid,
      productId: selectedProduct.id, productName: selectedProduct.name, price: selectedProduct.price,
      status: 'pending', paymentType: 'wallet', paymentMethod: 'wallet', trxId: '', date: new Date()
    };
    const batch = db.batch();
    batch.update(db.collection('users').doc(currentUser.uid), {
      balance: firebase.firestore.FieldValue.increment(-selectedProduct.price),
      totalSpend: firebase.firestore.FieldValue.increment(selectedProduct.price),
      weeklySpend: firebase.firestore.FieldValue.increment(selectedProduct.price),
      totalOrders: firebase.firestore.FieldValue.increment(1)
    });
    batch.set(db.collection('orders').doc(), orderData);
    await batch.commit();
    Swal.fire({icon:'success', title:'Order Placed!', text:'Admin verify করবে ২-৫ মিনিটে', timer:2200, showConfirmButton:false});
    goHome();
  } catch(e){ Swal.fire('Error', e.message, 'error'); }
}

function quickAmt(a){ const inp = $('depAmount'); inp.value = (parseInt(inp.value)||0) + a; }

function goToPayMethod(){
  const amt = parseInt($('depAmount').value);
  if(!amt || amt < 10) return toast('সর্বনিম্ন ১০ টাকা দিন', '#ef4444');
  checkoutContext = 'addmoney';
  depositAmount = amt;
  pendingOrder = null;
  $('payViewTitle').textContent = "ADD MONEY";
  showSec('payment');
  updatePaymentLogos();
  selectDepMethod('bkash');
}

function backFromPayment() {
  if(checkoutContext === 'order') {
    showSec('product');
    checkoutContext = 'addmoney';
    pendingOrder = null;
  } else {
    showSec('addmoney');
  }
}

function updatePaymentLogos() {
  ['bkash','nagad','rocket'].forEach(key => {
    const logoKey = 'logo' + key.charAt(0).toUpperCase() + key.slice(1);
    const el = $('logo-' + key);
    if(el) {
      if(paymentConfig[logoKey]) {
        el.innerHTML = `<img src="${paymentConfig[logoKey]}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="fallback-text" style="display:none;color:${key==='bkash'?'#e2136e':key==='nagad'?'#ec1c24':'#6638e8'}">${key}</div>`;
      } else {
        el.innerHTML = `<img src="${DEFAULT_LOGOS[key]}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="fallback-text" style="display:none;color:${key==='bkash'?'#e2136e':key==='nagad'?'#ec1c24':'#6638e8'}">${key}</div>`;
      }
    }
  });
}

function selectDepMethod(method) {
  currentDepMethod = method;
  document.querySelectorAll('.pay-method-circle').forEach(el => el.classList.remove('active'));
  $('pm-' + method).classList.add('active');
  const colors = { 
    bkash: { bg: 'linear-gradient(135deg,#e2136e,#ff4b8b)', name: 'bKash' },
    nagad: { bg: 'linear-gradient(135deg,#ec1c24,#ff5a5a)', name: 'Nagad' },
    rocket: { bg: 'linear-gradient(135deg,#6638e8,#8b6df0)', name: 'Rocket' }
  };
  const theme = colors[method];
  $('brandBanner').style.background = theme.bg;
  const logoKey = 'logo' + method.charAt(0).toUpperCase() + method.slice(1);
  const logoUrl = paymentConfig[logoKey] || DEFAULT_LOGOS[method];
  $('selectedBrandLogo').innerHTML = `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:contain">`;
  $('selectedBrandName').textContent = theme.name;
  const num = paymentConfig[method] || '01XXXXXXXXX';
  $('receiverNumber').textContent = num;
  const qrKey = method + 'Qr';
  if(paymentConfig[qrKey]) {
    $('qrBox').classList.remove('hidden');
    $('qrImage').src = paymentConfig[qrKey];
  } else {
    $('qrBox').classList.add('hidden');
  }
  const instKey = 'instruction' + method.charAt(0).toUpperCase() + method.slice(1);
  let insts = [];
  if(paymentConfig[instKey]) {
    insts = paymentConfig[instKey].split('\n').filter(x=>x.trim());
  } else {
    insts = [
      `উপরের নম্বরে <b>${theme.name}</b> অ্যাপ থেকে Send Money করুন।`,
      `পেমেন্টের পরিমাণ: <b>৳ ${depositAmount}</b>`,
      `পেমেন্ট সম্পন্ন হলে নিচে আপনার Sender Number দিন।`,
      `পেমেন্টের Transaction ID (TrxID) কপি করে নিচে দিন।`,
      `Verify & Submit বাটনে ক্লিক করুন। অ্যাডমিন ৫-১০ মিনিটে ভেরিফাই করবে।`
    ];
  }
  $('instList').innerHTML = insts.map(i => `<li>${i}</li>`).join('');
  $('senderNumber').value = '';
  $('trxId').value = '';
}

function copyNum(id) {
  const el = $(id); if(!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => { toast('Number Copied ✓', '#10b981'); });
}

async function submitPayment() {
  const sender = $('senderNumber').value.trim();
  const trx = $('trxId').value.trim().toUpperCase();
  if(!/^01\d{9}$/.test(sender)) return toast('সঠিক ১১ ডিজিটের Sender Number দিন', '#ef4444');
  if(!trx || trx.length < 4) return toast('সঠিক Transaction ID দিন', '#ef4444');
  const btn = $('submitPayBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
  btn.disabled = true;
  try {
    const duplicateCheck = await db.collection('deposits').where('trxId', '==', trx).get();
    if(!duplicateCheck.empty) { throw new Error('এই Transaction ID আগে ব্যবহার করা হয়েছে!'); }
    if (checkoutContext === 'order' && pendingOrder) {
       await db.collection('orders').add({
         userId: currentUser.uid, userName: userData.name || currentUser.email, userEmail: currentUser.email,
         gameId: pendingOrder.gameId, gameName: pendingOrder.gameName, playerId: pendingOrder.playerId,
         productId: pendingOrder.productId, productName: pendingOrder.productName, price: pendingOrder.price,
         status: 'pending', paymentType: 'direct', paymentMethod: currentDepMethod, 
         trxId: trx, senderNumber: sender, date: new Date()
       });
       Swal.fire({icon:'success', title:'Order Submitted!', text:'Admin verify করবে ৫-১০ মিনিটে', timer:2200, showConfirmButton:false});
    } else {
       await db.collection('deposits').add({
         userId: currentUser.uid, userEmail: currentUser.email, amount: depositAmount,
         method: currentDepMethod, senderNumber: sender, trxId: trx, status: 'pending', date: new Date()
       });
       Swal.fire({icon:'success', title:'Payment Submitted!', html:`৳${depositAmount} add হবে ৫-১০ মিনিটে`, timer:2400, showConfirmButton:false});
    }
    $('depAmount').value = '';
    checkoutContext = 'addmoney';
    pendingOrder = null;
    goHome();
  } catch(e) {
    Swal.fire('Error', e.message, 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-shield-alt"></i> Verify & Submit';
    btn.disabled = false;
  }
}

async function loadOrders(){
  const list = $('ordersList'); if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#2563eb"></i></div>';
  try {
    const snap = await db.collection('orders').where('userId','==',currentUser.uid).get();
    let arr = [];
    snap.forEach(d => arr.push(Object.assign({id:d.id}, d.data())));
    arr.sort((a,b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date||0);
      const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date||0);
      return db2 - da;
    });
    if(arr.length === 0){ list.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-bag"></i>No orders yet</div>'; return; }
    list.innerHTML = arr.map(o => {
      const st = (o.status||'pending').toLowerCase();
      let badge = '';
      if(['success','complete','completed'].includes(st)) badge = '<span class="bdg-done"><i class="fas fa-check"></i> Done</span>';
      else if(['cancel','canceled','rejected','refunded'].includes(st)) badge = '<span class="bdg-cancel"><i class="fas fa-xmark"></i> '+st+'</span>';
      else badge = '<span class="bdg-pend"><i class="fas fa-clock"></i> Pending</span>';
      return `<div class="od-card">
        <div class="od-head"><b style="font-size:13px;color:#0f172a">${o.gameName||'-'}</b>${badge}</div>
        <div class="od-row"><span class="lbl"><i class="fas fa-box"></i> Package</span><span class="val">${o.productName||'-'}</span></div>
        <div class="od-row"><span class="lbl"><i class="fas fa-user"></i> Player ID</span><span class="val" style="font-family:monospace">${o.playerId||'-'}</span></div>
        <div class="od-row"><span class="lbl"><i class="fas fa-money-bill"></i> Price</span><span class="val" style="color:#2563eb">৳${o.price||0}</span></div>
        <div class="od-row"><span class="lbl"><i class="fas fa-calendar"></i> Date</span><span class="val" style="font-size:10.5px">${fmtDate(o.date)}</span></div>
      </div>`;
    }).join('');
  } catch(e){ list.innerHTML = '<div class="empty-state">'+e.message+'</div>'; }
}

async function loadCodes(){
  const list = $('codesList'); if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#2563eb"></i></div>';
  try {
    const snap = await db.collection('codes').where('usedBy','==',currentUser.uid).get();
    if(snap.empty){ list.innerHTML = '<div class="empty-state"><i class="fas fa-ticket"></i>No codes yet<br><br><small style="color:#666b85">Redeem করে কোড যোগ করুন</small></div>'; return; }
    let html = '';
    snap.forEach(d => {
      const c = d.data();
      html += `<div class="od-card" style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;color:#92400e;font-size:18px;flex-shrink:0"><i class="fas fa-ticket"></i></div>
        <div style="flex:1;min-width:0"><p style="font-family:monospace;font-weight:900;font-size:13px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.code||'-'}</p><p style="font-size:11px;color:#666b85;margin-top:3px;font-weight:600">Amount: ৳${c.amount||0}</p></div>
        <span class="bdg-done">Used</span>
      </div>`;
    });
    list.innerHTML = html;
  } catch(e){ list.innerHTML = '<div class="empty-state">'+e.message+'</div>'; }
}

function openRedeem(){ $('redeemModal').classList.remove('hidden'); $('redeemCode').value=''; lockBody(); }
function closeRedeem(){ $('redeemModal').classList.add('hidden'); unlockBody(); }
async function submitRedeem(){
  const code = $('redeemCode').value.trim().toUpperCase();
  if(!code) return toast('Code দিন', '#ef4444');
  Swal.showLoading();
  try {
    const snap = await db.collection('codes').where('code','==',code).limit(1).get();
    if(snap.empty) throw new Error('Code not found');
    const doc = snap.docs[0];
    const d = doc.data();
    if(d.used) throw new Error('Code already used');
    const amt = parseInt(d.amount||0);
    if(amt <= 0) throw new Error('Invalid amount');
    const batch = db.batch();
    batch.update(db.collection('users').doc(currentUser.uid), { balance: firebase.firestore.FieldValue.increment(amt) });
    batch.update(doc.ref, { used: true, usedBy: currentUser.uid, usedAt: new Date() });
    await batch.commit();
    Swal.fire({icon:'success', title:'Success!', text:'৳'+amt+' added', timer:1800, showConfirmButton:false});
    closeRedeem();
    loadCodes();
  } catch(e){ Swal.fire('Error', e.message, 'error'); }
}

function showSec(id){
  const views = ['homeView', 'productView', 'ordersView', 'addmoneyView', 'paymentView', 'codesView', 'accountView'];
  views.forEach(v => { const el = $(v); if(el) el.classList.add('hidden'); });
  let targetId = id + 'View';
  if(id === 'product') targetId = 'productView';
  if(id === 'payment') targetId = 'paymentView';
  const target = $(targetId);
  if(target) target.classList.remove('hidden');
  $('siteFooter').classList.toggle('hidden', id !== 'home');
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('on'));
  const nav = $('nav-'+id); if(nav) nav.classList.add('on');
  window.scrollTo({top:0, behavior:'smooth'});
  if(id === 'orders') loadOrders();
  if(id === 'codes') loadCodes();
  if(id === 'account') setText('accBal', userBalance+'৳');
}
function goHome(){ showSec('home'); }

function openAcc(){ $('accPanel').classList.add('show'); lockBody(); }
function closeAcc(){ $('accPanel').classList.remove('show'); unlockBody(); }
function openAccNav(tab){ closeAcc(); setTimeout(()=>showSec(tab), 250); }
function openAccLogout(){ closeAcc(); setTimeout(()=>doLogout(), 250); }
function handleAccOverlayClick(event) { if(event.target.id === 'accPanel') closeAcc(); }

function openEditProfile(){
  $('editPic').value = userData.profilePic || '';
  $('editName').value = userData.name || '';
  $('editPhone').value = userData.phone || '';
  $('editProfModal').classList.remove('hidden');
  lockBody();
}
function closeEditProfile(){ $('editProfModal').classList.add('hidden'); unlockBody(); }
async function saveProfile(){
  const pic = $('editPic').value.trim();
  const name = $('editName').value.trim();
  const phone = $('editPhone').value.trim();
  if(!name) return toast('Name required', '#ef4444');
  if(phone && !/^01\d{9}$/.test(phone)) return toast('সঠিক ১১ ডিজিটের ফোন দিন', '#ef4444');
  Swal.showLoading();
  try {
    await db.collection('users').doc(currentUser.uid).update({ profilePic: pic, name, phone });
    Swal.fire({icon:'success', title:'Saved!', timer:1400, showConfirmButton:false});
    closeEditProfile();
  } catch(e){ Swal.fire('Error', e.message, 'error'); }
}

function openAVC() {
  $('avcModal').classList.add('show');
  $('avcUid').value = '';
  $('avcResult').style.display = 'none';
  lockBody();
}
function closeAVC() {
  $('avcModal').classList.remove('show');
  unlockBody();
}

async function checkAVC() {
  const uid = $('avcUid').value.trim().replace(/\D/g,'');
  if(uid.length < 5) return Swal.fire('Error', 'সঠিক UID দিন (কমপক্ষে ৫ সংখ্যা)', 'warning');
  if(!playerApiConfig.url || !playerApiConfig.url.trim()) return Swal.fire('Error', 'Admin এখনো API সেট করেনি', 'info');
  const btn = $('avcCheckBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
  btn.disabled = true;
  try {
    const built = buildApiUrl(playerApiConfig.url, uid);
    if(!built) throw new Error('Invalid API URL');
    const res = await fetch(built);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const name = getNestedVal(data, playerApiConfig.namePath || 'player.name') || 'Unknown';
    const level = getNestedVal(data, playerApiConfig.levelPath || 'player.level') || 0;
    const likes = getNestedVal(data, playerApiConfig.likesPath || 'player.likes') || 0;
    const diamonds = getNestedVal(data, playerApiConfig.diamondsPath || 'player.diamonds') || 0;
    const exp = getNestedVal(data, 'player.exp') || 0;
    const base = accountPricing.basePrice || 0;
    const lvlPrice = accountPricing.levelPrice || 0;
    const likePrice = accountPricing.likePrice || 0;
    const diaPrice = accountPricing.diamondPrice || 0;
    const totalValue = base + (level * lvlPrice) + (likes * likePrice) + (diamonds * diaPrice);
    $('avcName').textContent = name;
    $('avcOutUid').textContent = uid;
    $('avcLevel').textContent = level;
    $('avcLikes').textContent = likes;
    $('avcDiamonds').textContent = diamonds;
    $('avcExp').textContent = Number(exp).toLocaleString();
    $('avcValue').textContent = '৳ ' + Math.round(totalValue).toLocaleString();
    $('avcResult').style.display = 'block';
  } catch(e) {
    Swal.fire('Error', 'Failed to fetch data: ' + e.message, 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-search"></i> Check Now';
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('siteLogo').src = 'Main-logo.jpg';
  $('fb')?.addEventListener('click', () => $('fab').classList.toggle('open'));
});