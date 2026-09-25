# Hoofdsteden

Een kleine oefenapp voor de hoofdsteden van de wereld. Je ziet de omtrek en de vlag van een land en kiest of typt de hoofdstad. Landen die je vaak goed hebt komen minder vaak terug, landen die je fout hebt vaker (spaced repetition, Leitner-systeem).

## Publiceren op GitHub Pages

1. Maak op GitHub een nieuwe repository aan, bijvoorbeeld `hoofdsteden`.
2. Upload de inhoud van deze map naar de hoofdmap van de repository (dus `index.html` staat bovenaan, niet in een submap). Via de website: **Add file → Upload files** en sleep alle bestanden en mappen erin.
3. Ga naar **Settings → Pages**. Kies bij *Source* voor **Deploy from a branch**, branch **main**, map **/ (root)**, en klik op **Save**.
4. Na een minuutje staat de app op `https://<jouw-gebruikersnaam>.github.io/hoofdsteden/`.

## Op je telefoon zetten

- **iPhone (Safari):** open de link, tik op het deelicoon en kies **Zet op beginscherm**.
- **Android (Chrome):** open de link, tik op het menu en kies **App installeren** of **Toevoegen aan startscherm**.

Na het eerste bezoek werkt de app ook offline.

## Lokaal testen

Open de map in een terminal en start een simpele server, bijvoorbeeld `python3 -m http.server`, en ga naar `http://localhost:8000`. (Dubbelklikken op `index.html` werkt ook, alleen zonder offline-modus.)

## Updates doorvoeren

Pas je iets aan? Verhoog dan `VERSION` bovenin `sw.js` (bijvoorbeeld naar `hoofdsteden-v3`), anders blijven telefoons de oude versie uit de cache tonen.

## Bestanden

| Bestand | Wat het doet |
| --- | --- |
| `index.html` | De pagina |
| `style.css` | Vormgeving |
| `app.js` | Spellogica, leermethode, geluid, reeks |
| `data.js` | Alle landen: omtrek, vlag, hoofdstad |
| `sw.js` | Service worker voor offline gebruik |
| `manifest.webmanifest` | Maakt de app installeerbaar |
| `icons/` | App-iconen |
| `fonts/` | Lettertype Baloo 2 |
| `.nojekyll` | Zorgt dat GitHub Pages alles ongewijzigd serveert |

## Bronnen en licenties

- Landomtrekken: Natural Earth (publiek domein), via `world-atlas`
- Vlaggen: `flag-icons` (MIT)
- Hoofdsteden en landnamen: `world-countries` (ODbL)
- Lettertype: Baloo 2 (SIL Open Font License, zie `fonts/OFL.txt`)

Je voortgang staat in de `localStorage` van je browser. Die is per apparaat en per browser.
