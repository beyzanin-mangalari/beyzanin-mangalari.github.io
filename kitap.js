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
      if (SDA){ const yan = p >= 0.5; if (yan !== s.yan){ s.yan = yan; if (!ilk) hisirti(yan ? 1 : -1, gecis++ * 0.11); } continue; }
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
      if (yan !== s.yan){ s.yan = yan; if (!ilk) hisirti(yan ? 1 : -1, gecis++ * 0.11); }
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

  addEventListener("scroll", () => { iste(); yerles(); }, {passive:true});
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
  let ac = null, kayitlar = [], ses = !mq.matches;
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

  sesBtn.addEventListener("click", () => {
    ses = !ses; sesGoster();
    try { localStorage.setItem("bm_ses", ses ? "1" : "0"); } catch (e) {}
    if (ses){ ac0(); setTimeout(() => hisirti(1), 400); }
  });
  sesGoster();
  mod();
})();
