// Stran Skupnost: objave, všečki in komentarji.
import {
  db, $, ime, esc, avatar, kdaj, pomanjsajSliko, onUporabnik, odpriPrijavo,
} from "./skupno.js";
import * as skupno from "./skupno.js";
import {
  collection, addDoc, deleteDoc, updateDoc, doc, query, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { vrhovi } from "./podatki.js";

const trenutni = () => skupno.uporabnik; // vedno sveža vrednost
let objave = [];
const odprtiKomentarji = new Set();
const odjavaKomentarjev = new Map();

function sporocilo(txt, napaka = false) {
  const el = $("sporocilo");
  el.textContent = txt;
  el.className = napaka ? "napaka" : "";
}

// Seznam vrhov za izbiro
vrhovi.forEach((v) => {
  const o = document.createElement("option");
  o.value = v.ime;
  $("seznam-vrhov-izbira").appendChild(o);
});
$("objava-slika").addEventListener("change", (e) => {
  const f = e.target.files[0];
  $("izbrana-slika").textContent = f ? "Izbrana slika: " + f.name : "";
});
$("poziv-gumb").addEventListener("click", odpriPrijavo);

onUporabnik((u) => {
  $("nova-objava").hidden = !u;
  $("poziv-prijava").hidden = !!u;
  izrisiTok();
});

// ---------- Nova objava ----------
$("obrazec-objava").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = trenutni();
  if (!u) return;
  const datoteka = $("objava-slika").files[0];
  const besedilo = $("objava-besedilo").value.trim();
  const vrh = $("objava-vrh").value.trim();
  if (!datoteka && !besedilo) return sporocilo("Dodaj sliko ali besedilo.", true);
  const gumb = e.submitter;
  gumb.disabled = true;
  sporocilo("Objavljam …");
  try {
    const slikaUrl = datoteka ? await pomanjsajSliko(datoteka) : null;
    await addDoc(collection(db, "objave"), {
      avtor: u.email, avtorId: u.uid, besedilo, vrh, slikaUrl, vsecki: [], cas: serverTimestamp(),
    });
    e.target.reset();
    $("izbrana-slika").textContent = "";
    sporocilo("");
  } catch (err) {
    sporocilo("Objava ni uspela: " + err.message, true);
  } finally {
    gumb.disabled = false;
  }
});

// ---------- Tok ----------
onSnapshot(
  query(collection(db, "objave"), orderBy("cas", "desc")),
  (snap) => {
    objave = snap.docs.map((d) => {
      const o = d.data();
      return { id: d.id, ...o, vsecki: o.vsecki || [], cas: o.cas?.toDate ? o.cas.toDate() : null };
    });
    izrisiTok();
  },
  (err) => sporocilo("Objav ni mogoče naložiti: " + err.message, true),
);

function izrisiTok() {
  odjavaKomentarjev.forEach((f) => f());
  odjavaKomentarjev.clear();
  const seznam = $("seznam-objav");
  seznam.innerHTML = "";
  if (!objave.length) {
    seznam.innerHTML = '<p class="majhno sredina">Še ni objav – bodi prvi!</p>';
    return;
  }
  const u = trenutni();
  objave.forEach((o) => {
    const vsecek = u && o.vsecki.includes(u.uid);
    const moja = u && o.avtorId === u.uid;
    const el = document.createElement("article");
    el.className = "kartica objava";
    el.dataset.id = o.id;
    el.innerHTML = `
      <div class="objava-glava">
        ${avatar(o.avtor)}
        <div class="kdo"><strong>${esc(ime(o.avtor))}</strong>${o.vrh ? `<span class="vrh-oznaka">⛰ ${esc(o.vrh)}</span>` : ""}<br><span class="majhno">${kdaj(o.cas)}</span></div>
      </div>
      ${o.besedilo ? `<p class="objava-besedilo">${esc(o.besedilo)}</p>` : ""}
      ${o.slikaUrl ? `<img class="slika" src="${esc(o.slikaUrl)}" alt="" loading="lazy">` : ""}
      <div class="objava-akcije">
        <button class="vsecek ${vsecek ? "aktiven" : ""}" data-akcija="vsecek">${vsecek ? "♥" : "♡"} ${o.vsecki.length || ""} Všeč mi je</button>
        <button data-akcija="komentarji">💬 Komentarji</button>
        ${moja ? '<button class="brisi" data-akcija="brisi">Izbriši</button>' : ""}
      </div>
      <div class="komentarji" hidden></div>`;
    seznam.appendChild(el);
    if (odprtiKomentarji.has(o.id)) odpriKomentarje(el, o.id);
  });
}

$("seznam-objav").addEventListener("click", async (e) => {
  const gumb = e.target.closest("button[data-akcija]");
  if (!gumb) return;
  const el = gumb.closest(".objava");
  const id = el.dataset.id;
  const akcija = gumb.dataset.akcija;
  const u = trenutni();

  if (akcija === "vsecek") {
    if (!u) return odpriPrijavo();
    const o = objave.find((x) => x.id === id);
    const ze = o.vsecki.includes(u.uid);
    updateDoc(doc(db, "objave", id), { vsecki: ze ? arrayRemove(u.uid) : arrayUnion(u.uid) })
      .catch((err) => sporocilo("Napaka: " + err.message, true));
  } else if (akcija === "komentarji") {
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

// ---------- Komentarji ----------
function odpriKomentarje(el, id) {
  const u = trenutni();
  const polje = el.querySelector(".komentarji");
  polje.hidden = false;
  polje.innerHTML = `<div class="seznam-komentarjev"></div>
    ${u
      ? '<form class="komentar-obrazec"><input type="text" placeholder="Napiši komentar …" maxlength="500" required><button class="gumb">Pošlji</button></form>'
      : '<p class="majhno">Za komentiranje se prijavi.</p>'}`;
  const seznam = polje.querySelector(".seznam-komentarjev");

  odjavaKomentarjev.get(id)?.();
  odjavaKomentarjev.set(id, onSnapshot(
    query(collection(db, "objave", id, "komentarji"), orderBy("cas", "asc")),
    (snap) => {
      seznam.innerHTML = "";
      snap.forEach((d) => {
        const k = d.data();
        const kel = document.createElement("div");
        kel.className = "komentar";
        kel.innerHTML = `${avatar(k.avtor)}<div class="komentar-telo"><strong>${esc(ime(k.avtor))}</strong>
          <span class="majhno"> · ${kdaj(k.cas?.toDate ? k.cas.toDate() : null)}</span><br>${esc(k.besedilo)}</div>`;
        seznam.appendChild(kel);
      });
    },
  ));

  const obrazec = polje.querySelector("form");
  if (obrazec) {
    obrazec.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = obrazec.querySelector("input");
      const besedilo = input.value.trim();
      if (!besedilo) return;
      input.value = "";
      try {
        await addDoc(collection(db, "objave", id, "komentarji"), {
          avtor: u.email, avtorId: u.uid, besedilo, cas: serverTimestamp(),
        });
      } catch (err) {
        sporocilo("Komentar ni uspel: " + err.message, true);
      }
    });
  }
}
