import { db, $, ime, esc, avatar, kdaj } from "./skupno.js";
import { collection, query, orderBy, limit, onSnapshot }
  from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

onSnapshot(
  query(collection(db, "objave"), orderBy("cas", "desc"), limit(6)),
  (snap) => {
    const el = $("zadnje-objave");
    el.innerHTML = "";
    if (snap.empty) {
      el.innerHTML = '<p class="majhno">Še ni objav. <a href="skupnost.html">Bodi prvi!</a></p>';
      return;
    }
    snap.forEach((d) => {
      const o = d.data();
      const kartica = document.createElement("a");
      kartica.href = "skupnost.html";
      kartica.className = "kartica mini-objava";
      kartica.innerHTML = `
        ${o.slikaUrl ? `<img src="${esc(o.slikaUrl)}" alt="" loading="lazy">` : ""}
        <div class="mini-vsebina">
          <p>${avatar(o.avtor)} <strong>${esc(ime(o.avtor))}</strong>
            <span class="majhno"> · ${kdaj(o.cas?.toDate ? o.cas.toDate() : null)}</span></p>
          ${o.vrh ? `<span class="vrh-oznaka">⛰ ${esc(o.vrh)}</span>` : ""}
          ${o.besedilo ? `<p class="mini-besedilo">${esc(o.besedilo)}</p>` : ""}
        </div>`;
      el.appendChild(kartica);
    });
  },
  () => { $("zadnje-objave").innerHTML = '<p class="majhno">Objav trenutno ni mogoče naložiti.</p>'; },
);
