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
    ciz();
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
    sesBtn.hidden = !flip;
    olc(true);
    if (!flip) for (const s of [HERO, SEPET]){ s.leaf.style.transform = s.leaf.style.visibility = ""; s.leaf.inert = false; }
  }
  mq.addEventListener ? mq.addEventListener("change", mod) : mq.addListener(mod);

  // ---------- ses: gürültü patlaması → bant geçiren süpürme → kâğıt hışırtısı ----------
  let ac = null, gurultu = null, ses = !mq.matches;
  try { const v = localStorage.getItem("bm_ses"); if (v !== null) ses = v === "1"; } catch (e) {}
  const sesGoster = () => { sesBtn.setAttribute("aria-pressed", String(ses)); sesBtn.title = ses ? "Sayfa sesi açık" : "Sayfa sesi kapalı"; };

  function ac0(){ // ilk dokunuş/tuş: AudioContext yalnız kullanıcı hareketiyle açılabilir
    try {
      if (!ac){
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        ac = new C();
        const n = Math.floor(ac.sampleRate * 0.5);
        gurultu = ac.createBuffer(1, n, ac.sampleRate);
        const d = gurultu.getChannelData(0);
        // seyrek çıtırtılı gürültü: düz beyaz gürültüden daha "kâğıt"
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.12 ? 1 : 0.4);
        const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, ac.sampleRate); s.connect(ac.destination); s.start(0); // iOS kilidi
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { ac = null; }
  }
  for (const t of ["pointerdown", "keydown", "touchend"]) addEventListener(t, ac0, {capture:true, passive:true});

  function hisirti(yon, gecikme = 0){
    if (!ses || !flip || !ac || ac.state !== "running") return;
    try {
      const t = ac.currentTime + gecikme, oran = 0.9 + Math.random() * 0.2;
      // 1) süpürme: sayfa havayı yarar
      const src = ac.createBufferSource(); src.buffer = gurultu; src.playbackRate.value = oran;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(yon > 0 ? 900 : 2400, t);
      bp.frequency.exponentialRampToValueAtTime(yon > 0 ? 3600 : 1200, t + 0.24);
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 380;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.5, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.17);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(ac.destination);
      src.start(t, Math.random() * 0.1); src.stop(t + 0.36);
      // 2) şaplak: sayfa yerine oturur
      const s2 = ac.createBufferSource(); s2.buffer = gurultu;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(0.0001, t + 0.2);
      g2.gain.exponentialRampToValueAtTime(1.2, t + 0.212);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
      s2.connect(lp); lp.connect(g2); g2.connect(ac.destination);
      s2.start(t + 0.2, 0.25); s2.stop(t + 0.28);
    } catch (e) {}
  }

  sesBtn.addEventListener("click", () => {
    ses = !ses; sesGoster();
    try { localStorage.setItem("bm_ses", ses ? "1" : "0"); } catch (e) {}
    if (ses){ ac0(); setTimeout(() => hisirti(1), 60); }
  });
  sesGoster();
  mod();
})();
