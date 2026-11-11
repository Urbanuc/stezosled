// Stran Skupnost: objave, všečki, komentarji, filter po vrhu.
import {
  db, $, ime, esc, avatar, kdaj, pomanjsajSliko, onUporabnik, odpriPrijavo,
} from "./skupno.js";
import * as skupno from "./skupno.js";
import {
  collection, addDoc, deleteDoc, updateDoc, doc, query, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { vrhovi } from "./podatki.js";

const trenutni = () => skupno.uporabnik;
let objave = [];
let nalozeno = false;
let filterVrh = "";
const odprtiKomentarji = new Set();
const odjavaKomentarjev = new Map();

const IKONE = {
  srce: '<svg viewBox="0 0 24 24" class="ikona"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  komentar: '<svg viewBox="0 0 24 24" class="ikona"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>',
  smeti: '<svg viewBox="0 0 24 24" class="ikona"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
};

function sporocilo(txt, napaka = false) {
  const el = $("sporocilo");
  el.textContent = txt;
  el.className = napaka ? "napaka" : "";
}

// ---------- Pisalnik ----------
vrhovi.forEach((v) => {
  const o = document.createElement("option");
  o.value = v.ime;
  $("seznam-vrhov-izbira").appendChild(o);
});
$("poziv-gumb").addEventListener("click", odpriPrijavo);

const besedilo = $("objava-besedilo");
besedilo.addEventListener("input", () => {
  besedilo.style.height = "auto";
  besedilo.style.height = Math.min(besedilo.scrollHeight, 220) + "px";
});

$("objava-slika").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) {
    $("predogled-slike").src = URL.createObjectURL(f);
    $("predogled-okvir").hidden = false;
  }
});
$("odstrani-sliko").addEventListener("click", () => {
  $("objava-slika").value = "";
  $("predogled-okvir").hidden = true;
});

onUporabnik((u) => {
  $("nova-objava").hidden = !u;
  $("poziv-prijava").hidden = !!u;
  if (u) $("pisalnik-avatar").innerHTML = avatar(u.email, "velik");
  izrisiTok();
});

$("obrazec-objava").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = trenutni();
  if (!u) return;
  const datoteka = $("objava-slika").files[0];
  const tekst = besedilo.value.trim();
  const vrh = $("objava-vrh").value.trim();
  if (!datoteka && !tekst) return sporocilo("Dodaj sliko ali besedilo.", true);
  const gumb = e.target.querySelector(".gumb-objavi");
  gumb.disabled = true;
  gumb.textContent = "Objavljam …";
  sporocilo("");
  try {
    const slikaUrl = datoteka ? await pomanjsajSliko(datoteka) : null;
    await addDoc(collection(db, "objave"), {
      avtor: u.email, avtorId: u.uid, besedilo: tekst, vrh, slikaUrl, vsecki: [], cas: serverTimestamp(),
    });
    e.target.reset();
    besedilo.style.height = "auto";
    $("predogled-okvir").hidden = true;
  } catch (err) {
    sporocilo("Objava ni uspela: " + err.message, true);
  } finally {
    gumb.disabled = false;
    gumb.textContent = "Objavi";
  }
});

// ---------- Podatki ----------
onSnapshot(
  query(collection(db, "objave"), orderBy("cas", "desc")),
  (snap) => {
    objave = snap.docs.map((d) => {
      const o = d.data();
      return { id: d.id, ...o, vsecki: o.vsecki || [], cas: o.cas?.toDate ? o.cas.toDate() : null };
    });
    nalozeno = true;
    izrisiTok();
  },
  (err) => { nalozeno = true; sporocilo("Objav ni mogoče naložiti: " + err.message, true); izrisiTok(); },
);

// ---------- Stranski stolpec ----------
function izrisiStransko() {
  $("stat-objave").textContent = objave.length;
  $("stat-avtorji").textContent = new Set(objave.map((o) => o.avtorId)).size;

  const stevec = new Map();
  objave.forEach((o) => { if (o.vrh) stevec.set(o.vrh, (stevec.get(o.vrh) || 0) + 1); });
  const top = [...stevec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  $("vroci-vrhovi").innerHTML = top.length
    ? top.map(([v, n]) => `<button class="cip ${v === filterVrh ? "aktiven" : ""}" data-vrh="${esc(v)}">⛰ ${esc(v)} <span>${n}</span></button>`).join("")
    : '<span class="majhno">Še ni označenih vrhov.</span>';
}

function nastaviFilter(vrh) {
  filterVrh = vrh;
  izrisiTok();
  if (vrh) window.scrollTo({ top: 0, behavior: "smooth" });
}
$("vroci-vrhovi").addEventListener("click", (e) => {
  const c = e.target.closest("[data-vrh]");
  if (c) nastaviFilter(c.dataset.vrh === filterVrh ? "" : c.dataset.vrh);
});
$("filter-ponastavi").addEventListener("click", () => nastaviFilter(""));

// ---------- Tok ----------
function izrisiTok() {
  odjavaKomentarjev.forEach((f) => f());
  odjavaKomentarjev.clear();
  izrisiStransko();
  if (!nalozeno) return;

  $("filter-vrstica").hidden = !filterVrh;
  $("filter-ime").textContent = filterVrh;

  const seznam = $("seznam-objav");
  seznam.innerHTML = "";
  const prikaz = filterVrh ? objave.filter((o) => o.vrh === filterVrh) : objave;
  if (!prikaz.length) {
    seznam.innerHTML = `<div class="prazno"><div>🏔️</div><h3>${filterVrh ? "Za ta vrh še ni objav" : "Še ni objav"}</h3><p class="majhno">Bodi prvi, ki bo delil svoj vzpon.</p></div>`;
    return;
  }
  const u = trenutni();
  prikaz.forEach((o) => {
    const vsecek = u && o.vsecki.includes(u.uid);
    const moja = u && o.avtorId === u.uid;
    const el = document.createElement("article");
    el.className = "objava";
    el.dataset.id = o.id;
    el.innerHTML = `
      <header class="objava-glava">
        ${avatar(o.avtor, "velik")}
        <div class="kdo">
          <strong>${esc(ime(o.avtor))}</strong>
          <span class="majhno">${kdaj(o.cas)}</span>
        </div>
        ${o.vrh ? `<button class="vrh-oznaka" data-filter="${esc(o.vrh)}" title="Pokaži objave za ta vrh">⛰ ${esc(o.vrh)}</button>` : ""}
        ${moja ? `<button class="ikona-gumb brisi" data-akcija="brisi" title="Izbriši">${IKONE.smeti}</button>` : ""}
      </header>
      ${o.besedilo ? `<p class="objava-besedilo">${esc(o.besedilo)}</p>` : ""}
      ${o.slikaUrl ? `<div class="slika-okvir"><img class="slika" src="${esc(o.slikaUrl)}" alt="" loading="lazy"><span class="srce-pop">${IKONE.srce}</span></div>` : ""}
      <div class="objava-akcije">
        <button class="akcija vsecek ${vsecek ? "aktiven" : ""}" data-akcija="vsecek">${IKONE.srce}<span>${o.vsecki.length || ""}</span></button>
        <button class="akcija" data-akcija="komentarji">${IKONE.komentar}<span>Komentarji</span></button>
      </div>
      <div class="komentarji" hidden></div>`;
    seznam.appendChild(el);
    if (odprtiKomentarji.has(o.id)) odpriKomentarje(el, o.id);
  });
}

function preklopiVsecek(id, el) {
  const u = trenutni();
  if (!u) return odpriPrijavo();
  const o = objave.find((x) => x.id === id);
  const ze = o.vsecki.includes(u.uid);
  if (!ze) {
    el?.querySelector(".srce-pop")?.classList.add("zaigraj");
    setTimeout(() => el?.querySelector(".srce-pop")?.classList.remove("zaigraj"), 800);
  }
  updateDoc(doc(db, "objave", id), { vsecki: ze ? arrayRemove(u.uid) : arrayUnion(u.uid) })
    .catch((err) => sporocilo("Napaka: " + err.message, true));
}

$("seznam-objav").addEventListener("click", (e) => {
  const filter = e.target.closest("[data-filter]");
  if (filter) return nastaviFilter(filter.dataset.filter);

  const gumb = e.target.closest("button[data-akcija]");
  if (!gumb) return;
  const el = gumb.closest(".objava");
  const id = el.dataset.id;
  const akcija = gumb.dataset.akcija;

  if (akcija === "vsecek") preklopiVsecek(id, el);
  else if (akcija === "komentarji") {
    const polje = el.querySelector(".komentarji");
    if (polje.hidden) {
      odprtiKomentarji.add(id);
      odpriKomentarje(el, id);
    } else {
      odprtiKomentarji.delete(id);
      odjavaKomentarjev.get(id)?.();
      odjavaKomentarjev.delete(id);
      polje.hidden = true;
    }
  } else if (akcija === "brisi") {
    if (confirm("Izbrišem to objavo?")) {
      deleteDoc(doc(db, "objave", id)).catch((err) => sporocilo("Brisanje ni uspelo: " + err.message, true));
    }
  }
});

// Dvojni klik na sliko = všeček
$("seznam-objav").addEventListener("dblclick", (e) => {
  const slika = e.target.closest(".slika-okvir");
  if (!slika) return;
  const el = slika.closest(".objava");
  const u = trenutni();
  const o = objave.find((x) => x.id === el.dataset.id);
  if (u && o && !o.vsecki.includes(u.uid)) preklopiVsecek(el.dataset.id, el);
  else if (!u) odpriPrijavo();
});

// ---------- Komentarji ----------
function odpriKomentarje(el, id) {
  const u = trenutni();
  const polje = el.querySelector(".komentarji");
  polje.hidden = false;
  polje.innerHTML = `<div class="seznam-komentarjev"></div>
    ${u
      ? `<form class="komentar-obrazec">${avatar(u.email)}<input type="text" placeholder="Napiši komentar …" maxlength="500" required><button class="gumb">Pošlji</button></form>`
      : '<p class="majhno">Za komentiranje se prijavi.</p>'}`;
  const seznam = polje.querySelector(".seznam-komentarjev");

  odjavaKomentarjev.get(id)?.();
  odjavaKomentarjev.set(id, onSnapshot(
    query(collection(db, "objave", id, "komentarji"), orderBy("cas", "asc")),
    (snap) => {
      seznam.innerHTML = snap.empty ? '<p class="majhno">Še ni komentarjev.</p>' : "";
      snap.forEach((d) => {
        const k = d.data();
        const kel = document.createElement("div");
        kel.className = "komentar";
        kel.innerHTML = `${avatar(k.avtor)}<div class="komentar-telo"><strong>${esc(ime(k.avtor))}</strong>
          <span class="majhno"> · ${kdaj(k.cas?.toDate ? k.cas.toDate() : null)}</span><p>${esc(k.besedilo)}</p></div>`;
        seznam.appendChild(kel);
      });
    },
  ));

  const obrazec = polje.querySelector("form");
  if (obrazec) {
    obrazec.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = obrazec.querySelector("input");
      const tekst = input.value.trim();
      if (!tekst) return;
      input.value = "";
      try {
        await addDoc(collection(db, "objave", id, "komentarji"), {
          avtor: u.email, avtorId: u.uid, besedilo: tekst, cas: serverTimestamp(),
        });
      } catch (err) {
        sporocilo("Komentar ni uspel: " + err.message, true);
      }
    });
  }
}
