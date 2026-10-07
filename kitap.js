// Kitap: sayfalar kaydırdıkça çevrilir (scroll ile sürülen 3B rotateY) + Web Audio ile kâğıt sesi.
// app.js'ten bağımsız; yalnız #sepet'in hidden durumunu izler. Hareket azaltma açıksa sayfalar düz alt alta dizilir.
(() => {
  const $ = s => document.querySelector(s), root = document.documentElement;
  const lHero = $("#leafHero"), lSepet = $("#leafSepet"), sepet = $("#sepet");
  const shelf = $("#shelf"), room = $("#room"), sesBtn = $("#sesBtn"), cue = $("#cue");
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  const ACI = 96;            // tam çevrilmede açı; 90°'yi geçince sayfa görünmez olur
  const ORIGIN = 0.12;       // CSS perspective-origin x (12%)
  let flip = false, W = 0, H = 0, T = 0, R = 0, sayfalar = [], raf = 0, ilk = true;
  // destekleyen tarayıcıda çevirmeyi CSS kaydırma animasyonu yapar (compositor, ekran Hz'inde); JS yalnız ses + inert
  const SDA = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"));
  const sdaStil = document.createElement("style"); document.head.appendChild(sdaStil);

  const yap = (leaf, cast) => ({ leaf, cast: $(cast), shade: leaf.querySelector(".shade"), p: -1, yan: false });
  const HERO = yap(lHero, "#castHero"), SEPET = yap(lSepet, "#castSepet");

  // ölçü: yalnız açılışta, genişlik değişince ya da sepet görünürlüğü değişince (adres çubuğu kaymasında değil)
  function olc(zorla){
    const w = innerWidth, h = innerHeight;
    if (!zorla && w === W && Math.abs(h - H) < 200) return;
    W = w; H = h;
    yerlesim();
  }
  function yerlesim(){
    lSepet.hidden = sepet.hidden; SEPET.cast.hidden = sepet.hidden;
    T = Math.round(H * 0.9);                     // bir sayfa çevirmenin kaydırma mesafesi
    const D = Math.round(H * 0.45);              // "Eksikleri tamamla" sayfasında durma payı
    HERO.a = 0; SEPET.a = T + D;
    sayfalar = sepet.hidden ? [HERO] : [HERO, SEPET];
    R = flip ? sayfalar[sayfalar.length - 1].a + T : 0;
    room.style.height = R + "px";
    for (const s of [HERO, SEPET]) s.p = -1;     // yeniden çiz
    if (SDA) sdaKur();
    ciz();
  }

  // çevrilen kenarın perspektif izdüşümünü izleyen gölge, CSS keyframe olarak (genişlik değişince yeniden)
  function sdaKur(){
    const persp = 2.5 * W, ox = W * ORIGIN, kf = [];
    for (const [ad, s] of [["castHero", HERO], ["castSepet", SEPET]]){
      for (const el of [s.leaf, s.cast]){ el.style.setProperty("--a0", s.a + "px"); el.style.setProperty("--a1", (s.a + T) + "px"); }
      let k = "";
      for (let i = 0; i <= 20; i++){
        const p = i / 20, r = p * ACI * Math.PI / 180;
        const ex = ox + (W * Math.cos(r) - ox) * persp / Math.max(1, persp - W * Math.sin(r));
        k += `${i * 5}%{transform:translate3d(${Math.max(0, ex).toFixed(1)}px,0,0);opacity:${(Math.sin(p * Math.PI) * 0.95).toFixed(3)}}`;
      }
      kf.push(`@keyframes k-${ad}{${k}}html.flip.sda #${ad}{animation-name:k-${ad}}`);
    }
    sdaStil.textContent = kf.join("");
  }

  function ciz(){
    raf = 0;
    const y = window.scrollY || 0, persp = 2.5 * W, ox = W * ORIGIN;
    let gecis = 0;
    for (const s of sayfalar){
      const p = flip ? Math.min(1, Math.max(0, (y - s.a) / T)) : 0;
      if (p === s.p) continue;
      s.p = p;
      const th = p * ACI, r = th * Math.PI / 180;
      s.leaf.inert = p >= 1;
      if (s.yirtik) continue;
      if (SDA){ const yan = p >= 0.5; if (yan !== s.yan){ s.yan = yan; if (!ilk){ hisirti(yan ? 1 : -1, gecis++ * 0.11); donusler.push(performance.now()); } } continue; }
      s.leaf.style.transform = p > 0 && p < 1 ? `rotateY(${-th.toFixed(2)}deg)` : "";
      s.leaf.style.visibility = p >= 1 ? "hidden" : "";
      s.leaf.inert = p >= 1;
      s.shade.style.opacity = p > 0 && p < 1 ? Math.min(1, Math.sin(r) * 1.15).toFixed(3) : "0";
      // çevrilen kenarın ekrandaki x konumu (perspektif izdüşümü) → gölge onu izler
      if (p > 0 && p < 1){
        const x = W * Math.cos(r), z = W * Math.sin(r);
        const ex = ox + (x - ox) * persp / Math.max(1, persp - z);
        s.cast.style.transform = `translate3d(${Math.max(0, ex).toFixed(1)}px,0,0)`;
        s.cast.style.opacity = (Math.sin(p * Math.PI) * 0.95).toFixed(3);
      } else s.cast.style.opacity = "0";
      // ortayı geçince bir kez ses (iki yönde de)
      const yan = p >= 0.5;
      if (yan !== s.yan){ s.yan = yan; if (!ilk){ hisirti(yan ? 1 : -1, gecis++ * 0.11); donusler.push(performance.now()); } }
    }
    ilk = false;
  }
  const iste = () => { if (!raf) raf = requestAnimationFrame(ciz); };

  // yarım kalan çevirmeyi en yakın uca tamamla (parmak ekrandayken değil)
  let dokunuyor = false, bekle = 0;
  addEventListener("touchstart", () => { dokunuyor = true; }, {passive:true});
  addEventListener("touchend", () => { dokunuyor = false; yerles(); }, {passive:true});
  addEventListener("touchcancel", () => { dokunuyor = false; }, {passive:true});
  function yerles(){
    clearTimeout(bekle);
    bekle = setTimeout(() => {
      if (!flip || dokunuyor) return;
      const y = window.scrollY;
      for (const s of sayfalar){
        const p = (y - s.a) / T;
        if (p > 0.02 && p < 0.98){ window.scrollTo({top: s.a + (p < 0.5 ? 0 : T), behavior: "smooth"}); return; }
      }
    }, 220);
  }

  addEventListener("scroll", () => { iste(); yerles(); hizKontrol(); }, {passive:true});
  addEventListener("resize", () => olc(false), {passive:true});
  new MutationObserver(() => { if (lSepet.hidden !== sepet.hidden) yerlesim(); })
    .observe(sepet, {attributes:true, attributeFilter:["hidden"]});

  // klavyeyle örtülü sayfaya odak gelirse o sayfayı aç
  document.addEventListener("focusin", e => {
    if (!flip) return;
    const t = e.target, y = window.scrollY;
    if (shelf.contains(t) && y < R - 1) window.scrollTo(0, R);
    else if (sayfalar[1] && lSepet.contains(t) && (y < T || y > SEPET.a)) window.scrollTo(0, T);
  });
  cue.addEventListener("click", () => window.scrollTo({top: T, behavior: "smooth"}));

  function mod(){
    flip = !mq.matches;
    root.classList.toggle("flip", flip);
    root.classList.toggle("sda", flip && SDA);
    sesBtn.hidden = !flip;
    olc(true);
    if (!flip) for (const s of [HERO, SEPET]){ s.leaf.style.transform = s.leaf.style.visibility = ""; s.leaf.inert = false; }
  }
  mq.addEventListener ? mq.addEventListener("change", mod) : mq.addListener(mod);

  // ---------- ses: gerçek kitap sayfası kaydı (Kenney RPG Audio, CC0), Web Audio ile çalınır ----------
  let ac = null, kayitlar = [], ozel = {}, ses = !mq.matches;
  try { const v = localStorage.getItem("bm_ses"); if (v !== null) ses = v === "1"; } catch (e) {}
  const sesGoster = () => { sesBtn.setAttribute("aria-pressed", String(ses)); sesBtn.title = ses ? "Sayfa sesi açık" : "Sayfa sesi kapalı"; };

  function ac0(){ // ilk dokunuş/tuş: AudioContext yalnız kullanıcı hareketiyle açılabilir
    try {
      if (!ac){
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        ac = new C();
        const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, ac.sampleRate); s.connect(ac.destination); s.start(0); // iOS kilidi
        for (const f of ["ses/sayfa1.mp3", "ses/sayfa2.mp3"])
          fetch(f).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
            .then(buf => kayitlar.push(buf)).catch(() => {});
        for (const ad of ["yirtik", "dusme"]) // yırtılma: Wikimedia Commons "Tearing off small strip" (kamu malı)
          fetch(`ses/${ad}.mp3`).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
            .then(buf => { ozel[ad] = buf; }).catch(() => {});
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { ac = null; }
  }
  for (const t of ["pointerdown", "keydown", "touchend"]) addEventListener(t, ac0, {capture:true, passive:true});

  function hisirti(yon, gecikme = 0){
    if (!ses || !flip || !ac || ac.state !== "running" || !kayitlar.length) return;
    try {
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = kayitlar[Math.floor(Math.random() * kayitlar.length)];
      src.playbackRate.value = (yon > 0 ? 1 : 0.94) + Math.random() * 0.08; // her çevirme birebir aynı duyulmasın
      g.gain.value = 0.9;
      src.connect(g); g.connect(ac.destination);
      src.start(ac.currentTime + gecikme);
    } catch (e) {}
  }

  function cal(ad, gecikme = 0, hiz = 1){
    if (!ses || !ac || ac.state !== "running" || !ozel[ad]) return;
    try {
      const src = ac.createBufferSource(); src.buffer = ozel[ad]; src.playbackRate.value = hiz;
      src.connect(ac.destination); src.start(ac.currentTime + gecikme);
    } catch (e) {}
  }

  // ---------- easter egg: çok hızlı kaydırınca sayfa yırtılıp düşer, F5'e kadar öyle kalır ----------
  let izler = [], donusler = [], yirtildi = 0;
  function hizKontrol(){
    if (!flip) return;
    const t = performance.now(), y = window.scrollY;
    izler.push([t, y]); while (izler.length && t - izler[0][0] > 1200) izler.shift();
    // yalnız sayfaların çevrildiği bölgedeki kaydırma sayılır (raftaki uzun savurma yırtmasın)
    let yol = 0; for (let i = 1; i < izler.length; i++) if (Math.min(izler[i][1], izler[i - 1][1]) < R) yol += Math.abs(Math.min(izler[i][1], R) - Math.min(izler[i - 1][1], R));
    while (donusler.length && t - donusler[0] > 2500) donusler.shift();
    // 1,2 sn'de ~6 ekran boyu kaydırma ya da 2,5 sn'de 6 sayfa dönüşü (hızlı ileri-geri)
    if (yol > H * 6 || donusler.length >= 6){ izler = []; donusler = []; yirt(); }
  }
  function yirt(){
    const s = sayfalar.find(x => !x.yirtik && x.p < 1) || [...sayfalar].reverse().find(x => !x.yirtik);
    if (!s || yirtildi > performance.now() - 1500) return;
    yirtildi = performance.now();
    window.scrollTo({top: s.a, behavior: "instant"});
    // yırtık çizgisi: üstten alta zikzak
    const nokta = [], adim = 14;
    for (let i = 0; i <= adim; i++) nokta.push([46 + Math.sin(i * 1.7) * 6 + (Math.random() * 10 - 5), i * 100 / adim]);
    const sol = `polygon(0 0,${nokta.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(",")},0 100%)`;
    const sag = `polygon(100% 0,${nokta.map(([x, y]) => `${(x + 0.6).toFixed(1)}% ${y.toFixed(1)}%`).join(",")},100% 100%)`;
    const parca = klip => {
      const p = s.leaf.cloneNode(true);
      p.removeAttribute("id"); p.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
      p.className = "leaf yirtikParca"; p.inert = true; p.style.cssText = `clip-path:${klip};-webkit-clip-path:${klip}`;
      p.querySelector(".shade")?.remove();
      $(".stage").appendChild(p); return p;
    };
    const L = parca(sol), Rr = parca(sag);
    s.yirtik = true; s.leaf.classList.add("yirtik"); s.cast.hidden = true; s.leaf.inert = true;
    cal("yirtik"); cal("dusme", 1.05, 0.9);
    // önce yırtılma anı (sağ parça çekilir), sonra ikisi de yerçekimiyle düşer
    const sure = 1500, ease = "cubic-bezier(.45,0,.9,.6)";
    Rr.animate([
      {transform: "none"},
      {transform: "translate(2%,-1.5%) rotate(2.5deg)", offset: .18},
      {transform: "translate(18%,115vh) rotate(24deg)"}], {duration: sure, easing: ease, fill: "forwards"});
    L.animate([
      {transform: "none"},
      {transform: "translate(-.6%,.4%) rotate(-.8deg)", offset: .22},
      {transform: "translate(-14%,118vh) rotate(-19deg)"}], {duration: sure + 120, easing: ease, fill: "forwards"});
    $(".stage").animate([{transform:"none"},{transform:"translate(5px,-3px)"},{transform:"translate(-4px,2px)"},{transform:"none"}], {duration: 260});
    setTimeout(() => { L.remove(); Rr.remove(); }, sure + 200);
    const tst = $("#toast");
    if (tst){ tst.textContent = "Kitabı yırttın. F5 yapınca düzelir."; tst.hidden = false; setTimeout(() => tst.hidden = true, 3200); }
  }

  sesBtn.addEventListener("click", () => {
    ses = !ses; sesGoster();
    try { localStorage.setItem("bm_ses", ses ? "1" : "0"); } catch (e) {}
    if (ses){ ac0(); setTimeout(() => hisirti(1), 400); }
  });
  sesGoster();
  mod();
})();
