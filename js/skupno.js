// Skupno za vse strani: glava, noga, prijava in Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ---------- Pomožne funkcije ----------
export const $ = (id) => document.getElementById(id);
export const ime = (email = "") => email.split("@")[0] || "Neznanec";
export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const barva = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 40%)`;
};
export const avatar = (email, razred = "") =>
  `<span class="avatar ${razred}" style="background:${barva(email)}">${esc(ime(email)[0]?.toUpperCase() || "?")}</span>`;

export function kdaj(d) {
  if (!d) return "pravkar";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "pravkar";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `pred ${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString("sl-SI");
}

// Pomanjša sliko in jo vrne kot JPEG data URL.
export function pomanjsajSliko(datoteka, najvecji = 800, kakovost = 0.7) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, najvecji / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", kakovost));
      };
      img.onerror = () => rej(new Error("Slike ni mogoče prebrati."));
      img.src = r.result;
    };
    r.onerror = rej;
    r.readAsDataURL(datoteka);
  });
}

export function prevediNapako(koda) {
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

// ---------- Stanje prijave ----------
export let uporabnik = null;
let pripravljen = false;
const poslusalci = [];
export function onUporabnik(cb) {
  poslusalci.push(cb);
  if (pripravljen) cb(uporabnik);
}
export function odpriPrijavo() {
  $("prijava-napaka").textContent = "";
  $("prijava-dialog").showModal();
}

// ---------- Glava in noga ----------
const strani = [
  ["index.html", "Domov"],
  ["skupnost.html", "Skupnost"],
  ["vrhovi.html", "Vrhovi"],
  ["rastline.html", "Rože"],
  ["zivali.html", "Živali"],
];
const tren = location.pathname.split("/").pop() || "index.html";

$("glava").innerHTML = `
  <header class="vrh">
    <div class="vrh-notranji">
      <a href="index.html" class="logo"><span>⛰</span> Stezosled</a>
      <nav class="nav">
        ${strani.map(([url, ime_]) => `<a href="${url}" class="${url === tren ? "aktivna" : ""}">${ime_}</a>`).join("")}
      </nav>
      <div class="uporabnik-polje">
        <button id="gumb-prijava" class="gumb gumb-bel">Prijava</button>
        <div id="uporabnik-info" hidden>
          <span class="avatar" id="avatar-glava"></span>
          <span id="uporabnik-ime"></span>
          <button id="gumb-odjava" class="gumb gumb-bel">Odjava</button>
        </div>
      </div>
    </div>
  </header>
  <dialog id="prijava-dialog">
    <form id="obrazec-prijava" method="dialog">
      <h2>Prijava</h2>
      <input id="prijava-email" type="email" placeholder="E-pošta" required autocomplete="email">
      <input id="prijava-geslo" type="password" placeholder="Geslo (vsaj 6 znakov)" required minlength="6" autocomplete="current-password">
      <p id="prijava-napaka" class="napaka" role="alert"></p>
      <div class="gumbi">
        <button type="submit" class="gumb" data-akcija="prijava">Prijava</button>
        <button type="submit" class="gumb gumb-svetel" data-akcija="registracija">Registracija</button>
        <button type="button" class="povezava-gumb" id="prijava-zapri">Prekliči</button>
      </div>
    </form>
  </dialog>`;
if ($("noga")) {
  $("noga").innerHTML = `<footer class="noga"><p>⛰ Stezosled · Skupnost ljubiteljev slovenskih gora · © 2026</p>
    <p class="majhno">Podatki o poteh so okvirni. Pred vzponom preveri razmere in vreme.</p></footer>`;
}

$("gumb-prijava").addEventListener("click", odpriPrijavo);
$("prijava-zapri").addEventListener("click", () => $("prijava-dialog").close());
$("gumb-odjava").addEventListener("click", () => signOut(auth));
$("obrazec-prijava").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("prijava-email").value.trim();
  const geslo = $("prijava-geslo").value;
  const registracija = e.submitter?.dataset.akcija === "registracija";
  try {
    if (registracija) await createUserWithEmailAndPassword(auth, email, geslo);
    else await signInWithEmailAndPassword(auth, email, geslo);
    e.target.reset();
    $("prijava-dialog").close();
  } catch (err) {
    $("prijava-napaka").textContent = prevediNapako(err.code);
  }
});

onAuthStateChanged(auth, (u) => {
  uporabnik = u;
  pripravljen = true;
  $("gumb-prijava").hidden = !!u;
  $("uporabnik-info").hidden = !u;
  if (u) {
    $("uporabnik-ime").textContent = ime(u.email);
    $("avatar-glava").style.background = barva(u.email);
    $("avatar-glava").textContent = ime(u.email)[0].toUpperCase();
  }
  poslusalci.forEach((cb) => cb(u));
});
