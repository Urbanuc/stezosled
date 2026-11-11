// Prijava z e-pošto in objave (Firebase Auth + Firestore + Storage)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const sporocilo = (txt, napaka = false) => {
  const el = $("objave-sporocilo");
  el.textContent = txt;
  el.className = napaka ? "napaka" : "";
};

if (firebaseConfig.apiKey === "VPIŠI") {
  sporocilo("Firebase še ni nastavljen – vpiši podatke v js/firebase-config.js (glej NAVODILA-FIREBASE.md).", true);
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  // Prijava / registracija
  $("obrazec-prijava").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("prijava-email").value.trim();
    const geslo = $("prijava-geslo").value;
    const registracija = e.submitter?.dataset.akcija === "registracija";
    try {
      if (registracija) await createUserWithEmailAndPassword(auth, email, geslo);
      else await signInWithEmailAndPassword(auth, email, geslo);
      sporocilo("");
    } catch (err) {
      sporocilo(prevediNapako(err.code), true);
    }
  });
  $("gumb-odjava").addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, (uporabnik) => {
    $("prijava-okno").hidden = !!uporabnik;
    $("nova-objava").hidden = !uporabnik;
    if (uporabnik) $("prijavljen-kot").textContent = uporabnik.email;
  });

  // Nova objava
  $("obrazec-objava").addEventListener("submit", async (e) => {
    e.preventDefault();
    const uporabnik = auth.currentUser;
    if (!uporabnik) return;
    const datoteka = $("objava-slika").files[0];
    const besedilo = $("objava-besedilo").value.trim();
    const vrh = $("objava-vrh").value.trim();
    if (!datoteka && !besedilo) return sporocilo("Dodaj sliko ali besedilo.", true);
    const gumb = e.submitter;
    gumb.disabled = true;
    sporocilo("Objavljam …");
    try {
      let slikaUrl = null;
      if (datoteka) {
        const pot = ref(storage, `objave/${uporabnik.uid}/${Date.now()}-${datoteka.name}`);
        await uploadBytes(pot, datoteka);
        slikaUrl = await getDownloadURL(pot);
      }
      await addDoc(collection(db, "objave"), {
        avtor: uporabnik.email,
        avtorId: uporabnik.uid,
        besedilo,
        vrh,
        slikaUrl,
        cas: serverTimestamp(),
      });
      e.target.reset();
      sporocilo("Objavljeno.");
    } catch (err) {
      sporocilo("Objava ni uspela: " + err.message, true);
    } finally {
      gumb.disabled = false;
    }
  });

  // Seznam objav v živo
  const seznam = $("seznam-objav");
  onSnapshot(query(collection(db, "objave"), orderBy("cas", "desc")), (snap) => {
    seznam.innerHTML = "";
    if (snap.empty) seznam.innerHTML = '<p class="podnaslov">Še ni objav – bodi prvi.</p>';
    snap.forEach((d) => {
      const o = d.data();
      const el = document.createElement("article");
      el.className = "objava";
      const datum = o.cas?.toDate ? o.cas.toDate().toLocaleDateString("sl-SI") : "";
      el.innerHTML = `
        ${o.slikaUrl ? `<img src="${esc(o.slikaUrl)}" alt="" loading="lazy">` : ""}
        <div class="objava-vsebina">
          <p class="objava-glava"><strong>${esc(o.avtor)}</strong>${o.vrh ? " · ⛰ " + esc(o.vrh) : ""} <span>${datum}</span></p>
          ${o.besedilo ? `<p>${esc(o.besedilo)}</p>` : ""}
        </div>`;
      seznam.appendChild(el);
    });
  });
}

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
  }[koda] || "Napaka: " + koda;
}
