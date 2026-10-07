// Beyza'nın Mangaları: veri mangalar.json'da, kayıt GitHub Contents API ile repoya yazılır
const REPO = "beyzanin-mangalari/beyzanin-mangalari.github.io", DAL = "site";
const $ = s => document.querySelector(s);
let items = [], filter = "all", token = null, editing = null, delArmed = false, busy = false;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const safeImg = u => /^(kapaklar\/[\w.-]+\.(jpe?g|png|webp)|data:image\/jpeg;base64,[A-Za-z0-9+/=]+)$/i.test(u || "") ? u : "";
function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,2600); }
const sirala = () => items.sort((a,b)=>String(a.ad).localeCompare(String(b.ad),"tr"));
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

async function gh(path, opts={}){
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...opts, headers:{Authorization:`Bearer ${token}`, Accept:"application/vnd.github+json", ...(opts.body?{"Content-Type":"application/json"}:{})}});
  if (!r.ok) throw new Error(r.status===401||r.status===403 ? "Yazma anahtarı geçersiz ya da süresi dolmuş." : r.status===409 ? "Aynı anda başka bir kayıt yapıldı, sayfayı yenileyip tekrar dene." : `GitHub hatası (${r.status}).`);
  return r.json();
}
async function dosyaYaz(path, bytes, mesaj){
  let sha; try { sha = (await gh(`${path}?ref=${DAL}`)).sha; } catch (e) {}
  await gh(path, {method:"PUT", body:JSON.stringify({message:mesaj, content:b64(bytes), branch:DAL, ...(sha?{sha}:{})})});
}
async function kaydet(mesaj){
  if (!token) throw new Error("Önce yönetime giriş yap.");
  busy = true;
  try {
    const temiz = items.map(({_yeni, ...m}) => m);
    await dosyaYaz("mangalar.json", new TextEncoder().encode(JSON.stringify(temiz, null, 1)), mesaj);
    toast(mesaj + " · sitede 1 dakika içinde görünür");
  } finally { busy = false; }
}

function render(){
  const q = $("#q").value.trim().toLocaleLowerCase("tr");
  const toplamCilt = items.reduce((a,m)=>a+(+m.alinan||0),0);
  const eksik = items.filter(m=>(+m.cikan||0)>(+m.alinan||0));
  $("#stats").innerHTML = items.length
    ? `<span><b>${items.length}</b> seri</span><span><b>${toplamCilt}</b> cilt rafta</span><span><b>${eksik.length}</b> seride eksik var</span>`
    : `<span>Henüz seri yok</span>`;
  $("#adminbar").hidden = !token;
  $("#adminBtn").hidden = !!token;

  const shown = items.filter(m=>{
    const miss = (+m.cikan||0) > (+m.alinan||0);
    if (filter==="miss" && !miss) return false;
    if (filter==="ok" && miss) return false;
    return !q || String(m.ad).toLocaleLowerCase("tr").includes(q);
  });
  if (!items.length){ $("#list").innerHTML = `<div class="empty"><strong>Raf boş</strong>Yönetim'e girip ilk mangayı ekle.</div>`; return; }
  if (!shown.length){ $("#list").innerHTML = `<div class="empty"><strong>Sonuç yok</strong>Aramayı ya da filtreyi değiştir.</div>`; return; }

  $("#list").innerHTML = `<div class="grid">${shown.map(m=>{
    const c=+m.cikan||0, a=+m.alinan||0, fark=c-a, n=Math.max(c,a,1);
    const cells = Array.from({length:n},(_,i)=>`<i class="${i<a?"on":i<c?"miss":""}"></i>`).join("");
    const link = safeUrl(m.link), img = safeImg(m._yeni || m.kapak);
    return `<article class="m">
      <div class="cover">
        ${img?`<img src="${img}" alt="${esc(m.ad)} kapağı" loading="lazy">`:`<div class="ph">${esc(m.ad)}</div>`}
        ${fark>0?`<span class="stamp">${fark} cilt eksik</span>`:`<span class="stamp ok">Güncel</span>`}
      </div>
      <h3>${esc(m.ad)}</h3>
      <div class="vols"><span>Elimde <b>${a}</b></span><span>Çıkan <b>${c}</b></span></div>
      <div class="track" aria-hidden="true">${cells}</div>
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

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{ $("#pwBox").hidden=true; $("#edBox").hidden=true; });
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
  $("#f_link").value = m?.link || ""; $("#f_kapak").value = ""; $("#edErr").textContent="";
  $("#delBtn").hidden = !m; $("#delBtn").textContent="Sil";
  $("#edBox").hidden=false; $("#f_ad").focus();
}
$("#addBtn").onclick=()=>openEditor();
$("#list").onclick=async e=>{
  const ed=e.target.closest("[data-edit]"), inc=e.target.closest("[data-inc]");
  if (ed) openEditor(items.find(m=>m.id===ed.dataset.edit));
  if (inc && !busy){
    const m=items.find(x=>x.id===inc.dataset.inc); if(!m) return;
    const eski={...m};
    m.alinan=(+m.alinan||0)+1; m.cikan=Math.max(+m.cikan||0,m.alinan); render();
    try{ await kaydet(`${m.ad}: ${m.alinan}. cilt alındı`); }
    catch(err){ Object.assign(m,eski); render(); toast(err.message); }
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
  if (busy) return;
  const data={ ad:$("#f_ad").value.trim(), cikan:+$("#f_cikan").value, alinan:+$("#f_alinan").value, link:$("#f_link").value.trim() };
  if (!data.ad){ $("#edErr").textContent="Seri adını yaz."; return; }
  $("#saveBtn").disabled=true; $("#edErr").textContent="";
  const yedek = JSON.stringify(items);
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
  }catch(err){ items=JSON.parse(yedek); render(); $("#edErr").textContent=err.message; }
  finally{ $("#saveBtn").disabled=false; }
};
$("#delBtn").onclick=async()=>{
  if (!delArmed){ delArmed=true; $("#delBtn").textContent="Emin misin? Tekrar bas"; return; }
  const yedek = JSON.stringify(items);
  items = items.filter(m=>m.id!==editing.id); render();
  try{ await kaydet(`${editing.ad} silindi`); $("#edBox").hidden=true; }
  catch(err){ items=JSON.parse(yedek); render(); $("#edErr").textContent=err.message; }
};

try { token = sessionStorage.getItem("bm_t"); } catch (e) {}
fetch("mangalar.json?t=" + Date.now(), {cache:"no-store"})
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d => { items = d; sirala(); render(); })
  .catch(() => { $("#list").innerHTML = `<div class="empty"><strong>Raf yüklenemedi</strong>Sayfayı yenile.</div>`; });
