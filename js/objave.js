// Družbeni tok: prijava, objave, všečki in komentarji (Firebase Auth + Firestore).
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, query, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let uporabnik = null;
let objave = [];
const odprtiKomentarji = new Set();
const odjavaKomentarjev = new Map();

// ---------- Pomožne funkcije ----------
const ime = (email = "") => email.split("@")[0] || "Neznanec";
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const barva = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 40%)`;
};
const avatar = (email, razred = "") =>
  `<span class="avatar ${razred}" style="background:${barva(email)}">${esc(ime(email)[0]?.toUpperCase() || "?")}</span>`;

function kdaj(d) {
  if (!d) return "pravkar";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "pravkar";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `pred ${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString("sl-SI");
}

function sporocilo(txt, napaka = false) {
  const el = $("sporocilo");
  el.textContent = txt;
  el.className = napaka ? "napaka" : "";
}

function prevediNapako(koda) {
  return {
    "auth/invalid-email": "Neveljaven e-poštni naslov.",
    "auth/weak-password": "Geslo mora imeti vsaj 6 znakov.",
    "auth/email-already-in-use": "Ta e-pošta je že registrirana.",
    "auth/invalid-credential": "Napačna e-pošta ali geslo.",
    "auth/user-not-found": "Uporabnik ne obstaja.",
    "auth/wrong-password": "Napačno geslo.",
    "auth/operation-not-allowed": "Prijava z e-pošto ni vklopljena v Firebase.",
    "auth/too-many-requests": "Preveč poskusov, poskusi čez nekaj minut.",
  }[koda] || "Napaka: " + (koda || "neznana");
}

// Pomanjša sliko na največ 800 px in jo vrne kot JPEG (data URL, ~100–200 kB).
function preberiSliko(datoteka) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 800 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => rej(new Error("Slike ni mogoče prebrati."));
      img.src = r.result;
    };
    r.onerror = rej;
    r.readAsDataURL(datoteka);
  });
}

// ---------- Prijava ----------
const dialog = $("prijava-dialog");
document.querySelectorAll("[data-odpri-prijavo]").forEach((g) =>
  g.addEventListener("click", () => {
    $("prijava-napaka").textContent = "";
    dialog.showModal();
  }));
$("prijava-zapri").addEventListener("click", () => dialog.close());

$("obrazec-prijava").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("prijava-email").value.trim();
  const geslo = $("prijava-geslo").value;
  const registracija = e.submitter?.dataset.akcija === "registracija";
  try {
    if (registracija) await createUserWithEmailAndPassword(auth, email, geslo);
    else await signInWithEmailAndPassword(auth, email, geslo);
    e.target.reset();
    dialog.close();
  } catch (err) {
    $("prijava-napaka").textContent = prevediNapako(err.code);
  }
});
$("gumb-odjava").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (u) => {
  uporabnik = u;
  $("gumb-prijava").hidden = !!u;
  $("uporabnik-info").hidden = !u;
  $("nova-objava").hidden = !u;
  $("poziv-prijava").hidden = !!u;
  if (u) {
    $("uporabnik-ime").textContent = ime(u.email);
    $("avatar-glava").style.background = barva(u.email);
    $("avatar-glava").textContent = ime(u.email)[0].toUpperCase();
  }
  izrisiTok();
});

// ---------- Nova objava ----------
$("obrazec-objava").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!uporabnik) return;
  const datoteka = $("objava-slika").files[0];
  const besedilo = $("objava-besedilo").value.trim();
  const vrh = $("objava-vrh").value.trim();
  if (!datoteka && !besedilo) return sporocilo("Dodaj sliko ali besedilo.", true);
  const gumb = e.submitter;
  gumb.disabled = true;
  sporocilo("Objavljam …");
  try {
    const slikaUrl = datoteka ? await preberiSliko(datoteka) : null;
    await addDoc(collection(db, "objave"), {
      avtor: uporabnik.email,
      avtorId: uporabnik.uid,
      besedilo, vrh, slikaUrl,
      vsecki: [],
      cas: serverTimestamp(),
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

// ---------- Tok objav ----------
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
    seznam.innerHTML = '<p class="majhno" style="margin-top:1rem;text-align:center">Še ni objav – bodi prvi!</p>';
    return;
  }
  objave.forEach((o) => {
    const vsecek = uporabnik && o.vsecki.includes(uporabnik.uid);
    const moja = uporabnik && o.avtorId === uporabnik.uid;
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

  if (akcija === "vsecek") {
    if (!uporabnik) return $("prijava-dialog").showModal();
    const o = objave.find((x) => x.id === id);
    const ze = o.vsecki.includes(uporabnik.uid);
    updateDoc(doc(db, "objave", id), { vsecki: ze ? arrayRemove(uporabnik.uid) : arrayUnion(uporabnik.uid) })
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
  const polje = el.querySelector(".komentarji");
  polje.hidden = false;
  polje.innerHTML = `<div class="seznam-komentarjev"></div>
    ${uporabnik
      ? '<form class="komentar-obrazec"><input type="text" placeholder="Napiši komentar …" maxlength="500" required><button class="gumb">Pošlji</button></form>'
      : '<p class="majhno">Za komentiranje se prijavi.</p>'}`;
  const seznam = polje.querySelector(".seznam-komentarjev");

  odjavaKomentarjev.get(id)?.();
  const odjava = onSnapshot(
    query(collection(db, "objave", id, "komentarji"), orderBy("cas", "asc")),
    (snap) => {
      seznam.innerHTML = "";
      snap.forEach((d) => {
        const k = d.data();
        const k_el = document.createElement("div");
        k_el.className = "komentar";
        k_el.innerHTML = `${avatar(k.avtor)}<div class="komentar-telo"><strong>${esc(ime(k.avtor))}</strong>
          <span class="majhno"> · ${kdaj(k.cas?.toDate ? k.cas.toDate() : null)}</span><br>${esc(k.besedilo)}</div>`;
        seznam.appendChild(k_el);
      });
    },
  );
  odjavaKomentarjev.set(id, odjava);

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
          avtor: uporabnik.email, avtorId: uporabnik.uid, besedilo, cas: serverTimestamp(),
        });
      } catch (err) {
        sporocilo("Komentar ni uspel: " + err.message, true);
      }
    });
  }
}
