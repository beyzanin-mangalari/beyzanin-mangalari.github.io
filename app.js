// Beyza'nın Mangaları: veri mangalar.json'da, kayıt GitHub Contents API ile repoya yazılır
const REPO = "beyzanin-mangalari/beyzanin-mangalari.github.io", DAL = "site";
const $ = s => document.querySelector(s);
let items = [], filter = "all", token = null, editing = null, delArmed = false;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const safeImg = u => /^(kapaklar\/[\w.-]+\.(jpe?g|png|webp)|data:image\/jpeg;base64,[A-Za-z0-9+/=]+)$/i.test(u || "") ? u : "";
function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,2600); }
const sirala = () => items.sort((a,b)=>String(a.ad).localeCompare(String(b.ad),"tr"));

// stok.json: saatlik GitHub Actions taramasının sonucu (tarayici/tara.mjs, main dalı)
let STOK = null;
const st = m => STOK?.mangalar?.[m.id];
const hedef = m => Math.max(+m.cikan||0, st(m)?.sonGorulen||0);
const eksikler = m => { const r=[]; for (let n=(+m.alinan||0)+1; n<=hedef(m); n++) r.push(n); return r; };
// ilan durumu: stok (satışta) / on (ön siparişte) / yok (satış sayfası var, stok yok)
const durumu = x => x.stok ? "stok" : x.on ? "on" : "yok";
const SIRA = {stok:0, on:1, yok:2}, DURUM_AD = {stok:"stokta", on:"ön sipariş", yok:"stok yok"};
const ilanlar = (m, n) => (st(m)?.ciltler?.[n] || []).filter(x => safeUrl(x.url))
  .sort((a,b)=>SIRA[durumu(a)]-SIRA[durumu(b)] || (a.fiyat??1e9)-(b.fiyat??1e9));
const stoklu = (m, n) => ilanlar(m, n).filter(x => x.stok);
const ciltDurum = (m, n) => { const l = ilanlar(m, n); return l.length ? durumu(l[0]) : null; };
// çıkmış sayılandan sonraki ciltler: satış sayfası açılmış ama stok yok, satışa açılabilir
const ileri = m => Object.keys(st(m)?.ciltler || {}).map(Number).filter(n => n > Math.max(hedef(m), +m.alinan||0) && ilanlar(m, n).length).sort((a,b)=>a-b);
const magazaAd = id => STOK?.magazalar?.[id] || id;
const para = f => f==null ? "" : f.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " TL";

// her mağaza için: eksik ciltlerden hangileri orada stokta; en çok eksiği karşılayan mağaza önce
function sepetHesapla(){
  const eksik = items.flatMap(m => eksikler(m).map(n => ({m, n})));
  const magazalar = {};
  for (const e of eksik) for (const x of stoklu(e.m, e.n)) (magazalar[x.magaza] ||= []).push({...e, x});
  const liste = Object.entries(magazalar).map(([id, ur]) => ({id, ur, toplam: ur.reduce((a,u)=>a+(u.x.fiyat||0),0)}))
    .sort((a,b)=>b.ur.length-a.ur.length || a.toplam-b.toplam);
  const hicYok = eksik.filter(e => !stoklu(e.m, e.n).length);
  return {eksik, liste, hicYok};
}
function renderSepet(){
  const el = $("#sepet"), {eksik, liste, hicYok} = sepetHesapla();
  el.hidden = !eksik.length;
  if (!eksik.length) return;
  const zaman = STOK?.guncel ? new Date(STOK.guncel).toLocaleString("tr-TR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : null;
  // her eksik cildin en ucuz fiyatı (stoklu fiyata göre sıralı döner)
  const enUcuz = {}; for (const e of eksik){ const s = stoklu(e.m, e.n)[0]; if (s?.fiyat!=null) enUcuz[e.m.id+"/"+e.n] = s.fiyat; }
  el.innerHTML = `<div class="shead"><h2>Eksikleri tamamla<em>!!</em></h2>
    <div class="sozet"><span>${eksik.length} eksik cilt</span><span>${liste.length} mağazada stokta</span>${zaman?`<span>Tarama ${zaman}</span>`:""}</div></div>
    <p class="alt">${zaman ? "Mağazalar her saat yeniden taranıyor." : "Mağaza taraması henüz çalışmadı."}
    ${liste.length>1 ? "Tek seferde en çok eksiği en ucuza alabileceğin mağaza en üstte." : ""}</p>
    ${liste.length ? `<div class="stores">${liste.map((s,i)=>{ const hepsi = s.ur.length===eksik.length;
      return `<article class="store${i===0?" best":""}${hepsi?" all":""}">
      <header><h3>${esc(magazaAd(s.id))}</h3><span class="cnt">${s.ur.length}/${eksik.length} eksik</span></header>
      ${(i===0||hepsi)?`<div class="tags">${i===0?`<span class="tag hot">En iyi seçenek</span>`:""}${hepsi?`<span class="tag">Eksiklerin hepsi burada</span>`:""}</div>`:""}
      <ul>${s.ur.map(u=>`<li><a href="${esc(u.x.url)}" target="_blank" rel="noopener">${esc(u.m.ad)} ${u.n}. cilt</a><b${u.x.fiyat!=null&&u.x.fiyat===enUcuz[u.m.id+"/"+u.n]?` class="ucuz" title="Bu cildin en ucuz fiyatı"`:""}>${para(u.x.fiyat)}</b></li>`).join("")}</ul>
      ${s.toplam?`<div class="top"><span>Toplam</span><b>${para(s.toplam)}</b></div>`:""}
    </article>`; }).join("")}</div>` : ""}
    ${hicYok.length ? `<p class="yok">Şu an hiçbir mağazada stokta değil: ${hicYok.map(e=>`${esc(e.m.ad)} ${e.n}. cilt${ciltDurum(e.m,e.n)==="on"?" (ön siparişte)":""}`).join(", ")}</p>` : ""}`;
}
const b64 = bytes => { let s=""; for (let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// yetki.json: repoya yazma anahtarı, yönetim şifresiyle AES-GCM ile şifreli (PBKDF2-SHA256)
async function anahtarAc(sifre){
  const r = await fetch("yetki.json?t=" + Date.now(), {cache:"no-store"});
  if (!r.ok) throw new Error("Kaydetme henüz kurulmadı.");
  const e = await r.json();
  const ham = await crypto.subtle.importKey("raw", new TextEncoder().encode(sifre), "PBKDF2", false, ["deriveKey"]);
  const k = await crypto.subtle.deriveKey({name:"PBKDF2", salt:unb64(e.s), iterations:e.n, hash:"SHA-256"}, ham, {name:"AES-GCM", length:256}, false, ["decrypt"]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv:unb64(e.iv)}, k, unb64(e.c)));
}

async function gh(path, opts={}, accept="application/vnd.github+json"){
  // no-store: tarayıcı GET'i önbellekten verirse eski sha ile yazılır → 409
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    cache:"no-store", ...opts, headers:{Authorization:`Bearer ${token}`, Accept:accept, ...(opts.body?{"Content-Type":"application/json"}:{})}});
  if (!r.ok){ const e = new Error(r.status===401||r.status===403 ? "Yazma anahtarı geçersiz ya da süresi dolmuş." : r.status===409||r.status===422 ? "Aynı anda başka bir kayıt yapıldı, sayfayı yenileyip tekrar dene." : `GitHub hatası (${r.status}).`); e.status = r.status; throw e; }
  return r.json();
}
// son yazılan dosyanın sha'sı: her kayıtta yeniden sormaya gerek yok; çakışmada (409) bir kez taze sha ile tekrar dener
const SHA = {};
async function dosyaYaz(path, bytes, mesaj){
  for (let deneme = 0; ; deneme++){
    if (!SHA[path]) try { SHA[path] = (await gh(`${path}?ref=${DAL}`)).sha; } catch (e) {}
    try {
      const r = await gh(path, {method:"PUT", body:JSON.stringify({message:mesaj, content:b64(bytes), branch:DAL, ...(SHA[path]?{sha:SHA[path]}:{})})});
      SHA[path] = r.content?.sha; return;
    } catch (e) {
      delete SHA[path];
      if (deneme || (e.status !== 409 && e.status !== 422)) throw e;
    }
  }
}

// Kayıt kuyruğu: ekran hemen güncellenir, kayıtlar arka planda sırayla gider.
// Bekleyenler tek kayıtta birleşir (dosyanın tamamı yazıldığı için son durum hepsini içerir).
// Hata olursa son başarılı kayda dönülür, bekleyen işlemler de geri alınır.
let kayitli = "[]", kuyruk = [], isliyor = false;
function kaydet(mesaj){
  if (!token) return Promise.reject(new Error("Önce yönetime giriş yap."));
  return new Promise((ok, no) => { kuyruk.push({mesaj, ok, no}); isle(); });
}
async function isle(){
  if (isliyor) return;
  isliyor = true;
  while (kuyruk.length){
    const parti = kuyruk.splice(0), mesaj = parti.map(x => x.mesaj).join(", ");
    const durum = JSON.stringify(items);
    try {
      const temiz = items.map(({_yeni, ...m}) => m);
      await dosyaYaz("mangalar.json", new TextEncoder().encode(JSON.stringify(temiz, null, 1)), mesaj);
      kayitli = durum;
      if (!kuyruk.length) toast(mesaj + " · kaydedildi");
      parti.forEach(x => x.ok());
    } catch (err) {
      const hepsi = parti.concat(kuyruk.splice(0));
      items = JSON.parse(kayitli); render();
      hepsi.forEach(x => x.no(err));
      toast("Kaydedilemedi, geri alındı: " + err.message);
    }
  }
  isliyor = false;
}

function render(){
  const q = $("#q").value.trim().toLocaleLowerCase("tr");
  const toplamCilt = items.reduce((a,m)=>a+(+m.alinan||0),0);
  const eksik = items.filter(m=>hedef(m)>(+m.alinan||0));
  renderSepet();
  $("#stats").innerHTML = items.length
    ? `<span><b>${items.length}</b> seri</span><span><b>${toplamCilt}</b> cilt rafta</span><span><b>${eksik.length}</b> seride eksik var</span>`
    : `<span>Henüz seri yok</span>`;
  $("#adminbar").hidden = !token;
  $("#adminBtn").hidden = !!token;

  const shown = items.filter(m=>{
    const miss = hedef(m) > (+m.alinan||0);
    if (filter==="miss" && !miss) return false;
    if (filter==="ok" && miss) return false;
    return !q || String(m.ad).toLocaleLowerCase("tr").includes(q);
  });
  if (!items.length){ $("#list").innerHTML = `<div class="empty"><strong>Raf boş</strong>Yönetim'e girip ilk mangayı ekle.</div>`; return; }
  if (!shown.length){ $("#list").innerHTML = `<div class="empty"><strong>Sonuç yok</strong>Aramayı ya da filtreyi değiştir.</div>`; return; }

  $("#list").innerHTML = `<div class="grid">${shown.map(m=>{
    const c=hedef(m), a=+m.alinan||0, fark=c-a, n=Math.max(c,a,1), yeniCilt=c>(+m.cikan||0);
    const cells = Array.from({length:n},(_,i)=>`<i class="${i<a?"on":i<c?"miss":""}"></i>`).join("");
    const link = safeUrl(m.link), img = safeImg(m._yeni || m.kapak), sonOn = yeniCilt && ciltDurum(m, c) === "on", gelecek = STOK ? ileri(m) : [];
    // bir cildin mağaza düğmeleri: satışta / ön sipariş / stok yok (en fazla 4)
    const dukkanlar = k => { const l = ilanlar(m, k);
      return l.length ? l.slice(0,4).map(x=>{ const d = durumu(x);
        return `<a class="shop ${d}" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(magazaAd(x.magaza))}${d==="stok" ? (x.fiyat!=null?` · ${Math.round(x.fiyat)} TL`:"") : ` · ${DURUM_AD[d]}`}</a>`; }).join("")
        : `<span class="shop none">hiçbir mağazada sayfası yok</span>`; };
    return `<article class="m${fark>0?" eksik":""}">
      <div class="cover">
        ${img?`<img src="${img}" alt="${esc(m.ad)} kapağı" loading="lazy">`:`<div class="ph">${esc(m.ad)}</div>`}
        ${fark>0?`<span class="stamp">${fark} cilt eksik</span>`:`<span class="stamp ok">Güncel</span>`}
        ${yeniCilt?`<span class="stamp new${sonOn?" on":""}">${sonOn?"Ön sipariş":"Yeni"}: ${c}. cilt</span>`:""}
      </div>
      <h3>${esc(m.ad)}</h3>
      <div class="meta"><div class="vols"><span>Elimde <b>${a}</b></span><span>Çıkan <b>${c}</b></span></div>
      <div class="track" aria-hidden="true">${cells}</div></div>
      ${fark>0&&STOK?`<div class="buy">${eksikler(m).map(k=>{ const d=ciltDurum(m,k);
        return `<div class="v"><span>${k}. cilt</span>${d?`<em class="${d}">${DURUM_AD[d]}</em>`:""}${dukkanlar(k)}</div>`; }).join("")}</div>`:""}
      ${gelecek.length?`<div class="yakin">${gelecek.map(k=>`<div class="v"><span>${k}. cilt satışa açılabilir</span>${dukkanlar(k)}</div>`).join("")}</div>`:""}
      ${(link||token)?`<div class="acts">
        ${link?`<a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">Link ↗</a>`:""}
        ${token?`<button class="btn sm" type="button" data-inc="${esc(m.id)}" title="Bir cilt daha aldım">+1 aldım</button><button class="btn sm" type="button" data-edit="${esc(m.id)}">Düzenle</button>`:""}
      </div>`:""}
    </article>`; }).join("")}</div>`;
}

document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{
  filter=b.dataset.f; document.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b)); render();
});
$("#q").oninput = render;

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{ $("#pwBox").hidden=true; $("#edBox").hidden=true; $("#taraBox").hidden=true; });
$("#adminBtn").onclick=()=>{ $("#pw").value=""; $("#pwErr").textContent=""; $("#pwBox").hidden=false; $("#pw").focus(); };
$("#pwForm").onsubmit=async e=>{
  e.preventDefault();
  try { token = await anahtarAc($("#pw").value); }
  catch (err) { $("#pwErr").textContent = err.name==="OperationError" ? "Şifre yanlış, tekrar dene." : err.message; return; }
  try { sessionStorage.setItem("bm_t", token); } catch (e) {}
  $("#pwBox").hidden=true; render(); toast("Yönetim modu açıldı");
};
$("#logoutBtn").onclick=()=>{ token=null; try{sessionStorage.removeItem("bm_t");}catch(e){} render(); };

function openEditor(m){
  editing = m || null; delArmed=false;
  $("#edTitle").textContent = m ? "Mangayı düzenle" : "Manga ekle";
  $("#f_ad").value = m?.ad || ""; $("#f_cikan").value = m?.cikan ?? 1; $("#f_alinan").value = m?.alinan ?? 1;
  $("#f_link").value = m?.link || ""; $("#f_ara").value = m?.ara || ""; $("#f_kapak").value = ""; $("#edErr").textContent="";
  $("#delBtn").hidden = !m; $("#delBtn").textContent="Sil";
  $("#edBox").hidden=false; $("#f_ad").focus();
}
$("#addBtn").onclick=()=>openEditor();
$("#list").onclick=async e=>{
  const ed=e.target.closest("[data-edit]"), inc=e.target.closest("[data-inc]");
  if (ed) openEditor(items.find(m=>m.id===ed.dataset.edit));
  if (inc){
    const m=items.find(x=>x.id===inc.dataset.inc); if(!m) return;
    m.alinan=(+m.alinan||0)+1; m.cikan=Math.max(+m.cikan||0,m.alinan); render();
    kaydet(`${m.ad}: ${m.alinan}. cilt alındı`).catch(()=>{}); // hata olursa isle() geri alır ve bildirir
  }
};

// kapak fotoğrafını 360px genişliğe küçültüp JPEG'e çevir
function kucult(file){
  return new Promise((ok,no)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{ const w=Math.min(360,img.naturalWidth), h=Math.round(img.naturalHeight*w/img.naturalWidth);
      const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg",0.82)); };
    img.onerror=()=>{ URL.revokeObjectURL(url); no(new Error("Fotoğraf okunamadı, başka bir dosya dene.")); };
    img.src=url;
  });
}

$("#edForm").onsubmit=async e=>{
  e.preventDefault();
  const data={ ad:$("#f_ad").value.trim(), cikan:+$("#f_cikan").value, alinan:+$("#f_alinan").value, link:$("#f_link").value.trim(), ara:$("#f_ara").value.trim() };
  if (!data.ad){ $("#edErr").textContent="Seri adını yaz."; return; }
  $("#saveBtn").disabled=true; $("#edErr").textContent="";
  try{
    const id = editing?.id || "m" + Date.now().toString(36);
    const file=$("#f_kapak").files[0];
    if (file){
      const durl = await kucult(file), yol = `kapaklar/${id}-${Date.now().toString(36)}.jpg`;
      await dosyaYaz(yol, unb64(durl.split(",")[1]), `${data.ad} kapağı`);
      data.kapak = yol; data._yeni = durl; // Pages yayınlanana kadar yerel önizleme
    }
    if (editing) Object.assign(items.find(m=>m.id===id), data);
    else items.push({ id, kapak:"", ...data });
    sirala(); render();
    await kaydet(editing ? `${data.ad} güncellendi` : `${data.ad} eklendi`);
    $("#edBox").hidden=true;
  }catch(err){ $("#edErr").textContent=err.message; } // listeyi isle() geri alır
  finally{ $("#saveBtn").disabled=false; }
};
$("#delBtn").onclick=async()=>{
  if (!delArmed){ delArmed=true; $("#delBtn").textContent="Emin misin? Tekrar bas"; return; }
  items = items.filter(m=>m.id!==editing.id); render();
  try{ await kaydet(`${editing.ad} silindi`); $("#edBox").hidden=true; }
  catch(err){ $("#edErr").textContent=err.message; }
};

// ---------- tarama paneli ----------
// "Taramayı başlat" site dalına tara-istek.json yazar, .github/workflows/tara-istek.yml asıl taramayı başlatır.
// Tarama (tarayici/tara.mjs) canlı durumu `ilerleme` dalındaki ilerleme.json'a ~3 sn'de bir yazar; panel onu okur.
const RAW = "application/vnd.github.raw+json";
let taraT = 0, taraIstek = 0, taraYuklenen = null;
const ilerlemeOku = () => gh(`ilerleme.json?ref=ilerleme`, {}, RAW).catch(() => null);
const saat = t => new Date(t).toLocaleTimeString("tr-TR", {hour:"2-digit", minute:"2-digit"});
const sayilar = l => l?.length ? l.join(", ") : "";
function magazaSatiri(s){
  if (s.d === "bekliyor") return ["", 0, "bekliyor"];
  if (s.d === "araniyor") return ["araniyor", 45, "aranıyor…"];
  if (s.d === "dogrulaniyor") return [s.hata ? "hata" : "dogrulaniyor", 80, s.hata ? "engellendi, önceki sonuç kullanılacak" : "ürün sayfaları kontrol ediliyor…"];
  const p = [s.stok?.length && `stokta: ${sayilar(s.stok)}`, s.on?.length && `ön sipariş: ${sayilar(s.on)}`, s.yok?.length && `stok yok: ${sayilar(s.yok)}`].filter(Boolean);
  const cls = s.stok?.length ? "stok" : s.on?.length ? "on" : s.hata ? "hata" : s.yok?.length ? "yok" : "";
  return [cls, 100, (s.hata ? "engellendi (önceki sonuç) · " : "") + (p.join(" · ") || "yeni cilt yok")];
}
function taraCiz(il){
  const yeni = il && (!taraIstek || Date.parse(il.baslangic) >= taraIstek - 60_000);
  const bayat = il?.durum === "suruyor" && Date.now() - Date.parse(il.baslangic) > 40 * 60_000;
  const suruyor = il?.durum === "suruyor" && !bayat;
  const bekleniyor = !!taraIstek && !yeni && Date.now() - taraIstek < 5 * 60_000;
  $("#taraBaslat").disabled = suruyor || bekleniyor;
  $("#taraBtn").classList.toggle("calisiyor", suruyor || bekleniyor);
  $("#taraDurum").textContent = bekleniyor ? "Tarama başlatılıyor. GitHub'ın işi açması 20-60 saniye sürebilir…"
    : !il ? "Henüz canlı ilerleme kaydı yok. Taramayı başlatınca burada görünecek."
    : suruyor ? `Taranıyor (başlangıç ${saat(il.baslangic)}). Tamamı 6-8 dakika sürer.`
    : bayat ? `${saat(il.baslangic)} taraması yarıda kalmış. Yeniden başlatabilirsin.`
    : `Son tarama ${saat(il.bitis || il.baslangic)} itibarıyla bitti.${taraYuklenen === il.baslangic ? " Sonuçlar sayfada." : " Sonuçlar yükleniyor…"}`;
  if (!il){ $("#taraListe").innerHTML = ""; $("#taraSay").textContent = ""; return; }
  const ids = Object.keys(il.magazalar), toplam = il.mangalar.length * ids.length;
  const biten = il.mangalar.reduce((a,m)=>a+ids.filter(id=>m.m[id]?.d==="bitti").length, 0), yuzde = Math.round(biten / toplam * 100);
  $("#taraGenel i").style.width = yuzde + "%"; $("#taraGenel").setAttribute("aria-valuenow", yuzde);
  $("#taraSay").textContent = `${biten}/${toplam}`;
  $("#taraListe").innerHTML = il.mangalar.map(m=>{
    const n = ids.filter(id=>m.m[id]?.d==="bitti").length, simdi = suruyor && n < ids.length && ids.some(id=>m.m[id]?.d!=="bekliyor");
    return `<section class="tm${simdi?" simdi":""}"><h3>${esc(m.ad)}<span>${n}/${ids.length}</span></h3><ul>${ids.map(id=>{
      const [cls, w, t] = magazaSatiri(m.m[id] || {d:"bekliyor"});
      return `<li class="ts ${cls}"><span>${esc(il.magazalar[id])}</span><span class="pb"><i style="width:${w}%"></i></span><span class="tr">${esc(t)}</span></li>`; }).join("")}</ul></section>`;
  }).join("");
}
async function taraYokla(){
  clearTimeout(taraT);
  const il = await ilerlemeOku();
  // bitince yeni stok.json'u doğrudan site dalından al (Pages yayınını beklemeden); workflow onu birkaç sn sonra yazıyor
  if (il?.durum === "bitti" && taraYuklenen !== il.baslangic){
    const s = await gh(`stok.json?ref=${DAL}`, {}, RAW).catch(() => null);
    if (s && Date.parse(s.guncel) >= Date.parse(il.baslangic) - 60_000){ STOK = s; taraYuklenen = il.baslangic; render(); }
  }
  if (!$("#taraBox").hidden) taraCiz(il);
  const devam = il?.durum === "suruyor" || (taraIstek && Date.now() - taraIstek < 5 * 60_000) || (il?.durum === "bitti" && taraYuklenen !== il.baslangic);
  if (devam || !$("#taraBox").hidden) taraT = setTimeout(taraYokla, devam ? 3000 : 15000);
}
$("#taraBtn").onclick = () => {
  if (!token){ $("#adminBtn").click(); toast("Tarama için önce yönetime giriş yap"); return; }
  $("#taraBox").hidden = false; taraYokla();
};
$("#taraBaslat").onclick = async () => {
  $("#taraBaslat").disabled = true;
  try {
    await dosyaYaz("tara-istek.json", new TextEncoder().encode(JSON.stringify({istek: new Date().toISOString()})), "Tarama isteği");
    taraIstek = Date.now(); taraYokla();
  } catch (err) { $("#taraDurum").textContent = "Başlatılamadı: " + err.message; $("#taraBaslat").disabled = false; }
};

try { token = sessionStorage.getItem("bm_t"); } catch (e) {}
// yönetimdeyken doğrudan repodan oku: Pages yayını ~1 dk gecikir, yenileyince son kayıt görünmeyebilir
(token ? gh(`mangalar.json?ref=${DAL}`, {}, "application/vnd.github.raw+json").catch(() => null) : Promise.resolve(null))
  .then(d => d || fetch("mangalar.json?t=" + Date.now(), {cache:"no-store"}).then(r => r.ok ? r.json() : Promise.reject()))
  .then(d => { items = d; kayitli = JSON.stringify(items); sirala(); render(); })
  .catch(() => { $("#list").innerHTML = `<div class="empty"><strong>Raf yüklenemedi</strong>Sayfayı yenile.</div>`; });

fetch("stok.json?t=" + Date.now(), {cache:"no-store"})
  .then(r => r.ok ? r.json() : null).then(d => { if (d) { STOK = d; render(); } }).catch(() => {});
