// Prijava z e-pošto in objave.
// Če je Firebase nastavljen (js/firebase-config.js), se uporabi on.
// Sicer deluje preskusni način: vse ostane samo v tvojem brskalniku (localStorage).
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const sporocilo = (txt, napaka = false) => {
  const el = $("objave-sporocilo");
  el.textContent = txt;
  el.className = napaka ? "napaka" : "";
};

const FIREBASE = "https://www.gstatic.com/firebasejs/10.12.0/";
const imaFirebase = firebaseConfig.apiKey !== "VPIŠI";

// ---------- Zaledje: Firebase ----------
async function zaledjeFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FIREBASE + "firebase-app.js"),
    import(FIREBASE + "firebase-auth.js"),
    import(FIREBASE + "firebase-firestore.js"),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  return {
    naUporabnika: (cb) => A.onAuthStateChanged(auth, (u) => cb(u && { id: u.uid, email: u.email })),
    prijava: (e, g) => A.signInWithEmailAndPassword(auth, e, g),
    registracija: (e, g) => A.createUserWithEmailAndPassword(auth, e, g),
    odjava: () => A.signOut(auth),
    async objavi({ besedilo, vrh, datoteka }) {
      const u = auth.currentUser;
      // Slika se pomanjša in shrani kar v Firestore (Storage zahteva plačljiv paket).
      const slikaUrl = datoteka ? await preberiSliko(datoteka) : null;
      await F.addDoc(F.collection(db, "objave"), {
        avtor: u.email, avtorId: u.uid, besedilo, vrh, slikaUrl, cas: F.serverTimestamp(),
      });
    },
    naObjave: (cb) =>
      F.onSnapshot(F.query(F.collection(db, "objave"), F.orderBy("cas", "desc")), (snap) =>
        cb(snap.docs.map((d) => {
          const o = d.data();
          return { ...o, cas: o.cas?.toDate ? o.cas.toDate() : null };
        }))),
  };
}

// ---------- Zaledje: preskusni način (localStorage) ----------
function zaledjeLokalno() {
  const bere = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } };
  let poslusalci = [];
  let objaveCb = null;
  const trenutni = () => bere("demo-uporabnik", null);
  const sporoci = () => poslusalci.forEach((cb) => cb(trenutni()));
  const osvezi = () => objaveCb && objaveCb(bere("demo-objave", []).map((o) => ({ ...o, cas: new Date(o.cas) })));
  });
  return {
    naUporabnika: (cb) => { poslusalci.push(cb); cb(trenutni()); },
    async prijava(email) {
      localStorage.setItem("demo-uporabnik", JSON.stringify({ id: email, email }));
      sporoci();
    },
    async registracija(email) { return this.prijava(email); },
    async odjava() { localStorage.removeItem("demo-uporabnik"); sporoci(); },
    async objavi({ besedilo, vrh, datoteka }) {
      const u = trenutni();
      const slikaUrl = datoteka ? await preberiSliko(datoteka) : null;
      const vse = bere("demo-objave", []);
      vse.unshift({ avtor: u.email, avtorId: u.id, besedilo, vrh, slikaUrl, cas: new Date().toISOString() });
      try {
        localStorage.setItem("demo-objave", JSON.stringify(vse));
      } catch {
        throw new Error("Brskalnik nima več prostora za slike.");
      }
      osvezi();
    },
    naObjave: (cb) => { objaveCb = cb; osvezi(); },
  };
}

// ---------- Vmesnik ----------
const zaledje = imaFirebase ? await zaledjeFirebase() : zaledjeLokalno();
if (!imaFirebase) {
  sporocilo("Preskusni način: objave so vidne samo v tem brskalniku. Za prave objave nastavi Firebase (NAVODILA-FIREBASE.md).");
}

$("obrazec-prijava").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("prijava-email").value.trim();
  const geslo = $("prijava-geslo").value;
  const registracija = e.submitter?.dataset.akcija === "registracija";
  try {
    if (registracija) await zaledje.registracija(email, geslo);
    else await zaledje.prijava(email, geslo);
    if (imaFirebase) sporocilo("");
  } catch (err) {
    sporocilo(prevediNapako(err.code), true);
  }
});
$("gumb-odjava").addEventListener("click", () => zaledje.odjava());

zaledje.naUporabnika((u) => {
  $("prijava-okno").hidden = !!u;
  $("nova-objava").hidden = !u;
  if (u) $("prijavljen-kot").textContent = u.email;
});

$("obrazec-objava").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datoteka = $("objava-slika").files[0];
  const besedilo = $("objava-besedilo").value.trim();
  const vrh = $("objava-vrh").value.trim();
  if (!datoteka && !besedilo) return sporocilo("Dodaj sliko ali besedilo.", true);
  const gumb = e.submitter;
  gumb.disabled = true;
  try {
    await zaledje.objavi({ besedilo, vrh, datoteka });
    e.target.reset();
    sporocilo(imaFirebase ? "Objavljeno." : "Objavljeno (preskusni način).");
  } catch (err) {
    sporocilo("Objava ni uspela: " + err.message, true);
  } finally {
    gumb.disabled = false;
  }
});

const seznam = $("seznam-objav");
zaledje.naObjave((objave) => {
  seznam.innerHTML = "";
  if (!objave.length) seznam.innerHTML = '<p class="podnaslov">Še ni objav – bodi prvi.</p>';
  objave.forEach((o) => {
    const el = document.createElement("article");
    el.className = "objava";
    const datum = o.cas ? o.cas.toLocaleDateString("sl-SI") : "";
    el.innerHTML = `
      ${o.slikaUrl ? `<img src="${esc(o.slikaUrl)}" alt="" loading="lazy">` : ""}
      <div class="objava-vsebina">
        <p class="objava-glava"><strong>${esc(o.avtor)}</strong>${o.vrh ? " · ⛰ " + esc(o.vrh) : ""} <span>${datum}</span></p>
        ${o.besedilo ? `<p>${esc(o.besedilo)}</p>` : ""}
      </div>`;
    seznam.appendChild(el);
  });
});

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function prevediNapako(koda) {
  return {
    "auth/invalid-email": "Neveljaven e-poštni naslov.",
    "auth/weak-password": "Geslo mora imeti vsaj 6 znakov.",
    "auth/email-already-in-use": "Ta e-pošta je že registrirana.",
    "auth/invalid-credential": "Napačna e-pošta ali geslo.",
    "auth/user-not-found": "Uporabnik ne obstaja.",
    "auth/wrong-password": "Napačno geslo.",
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
