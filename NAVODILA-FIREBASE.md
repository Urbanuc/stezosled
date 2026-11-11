# Kako vklopiti prijavo in objave

1. Pojdi na https://console.firebase.google.com in ustvari projekt (npr. "dvatisocaki").
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, lokacija europe-west).
   Zavihek *Rules*: prilepi vsebino `firestore.rules` in objavi.
4. Storage ni potreben (zahteva plačljiv paket) – slike se shranijo v Firestore.
5. **Project settings (zobnik) → Your apps → Web (</>)** → registriraj aplikacijo
   in prepiši `firebaseConfig` v `js/firebase-config.js`.
6. Stran odpri prek strežnika (ne z dvoklikom na datoteko), npr. v VS Code "Live Server",
   ker JavaScript moduli ne delujejo prek `file://`.
7. Pri gostovanju (GitHub Pages) dodaj domeno pod **Authentication → Settings → Authorized domains**.
