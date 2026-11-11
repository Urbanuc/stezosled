import "./skupno.js";
import { $, esc } from "./skupno.js";
import { zivali } from "./podatki.js";

$("vodnik").innerHTML = zivali.map((z) => `
  <article class="kartica zival">
    <div class="zival-emoji">${z.emoji}</div>
    <h3>${esc(z.ime)}</h3>
    <p class="majhno"><em>${esc(z.latinsko)}</em></p>
    <p>${esc(z.opis)}</p>
  </article>`).join("");
