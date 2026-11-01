# Pitch Chess hazırlık ekranı v3: ChatGPT brief'i

Beğenilen tasarım ("Maç hazırlığı" mockup'ı) temel alınır. Değişiklikler:
- Başlık ("MAÇ HAZIRLIĞI") ve alttaki "HAZIRIM" butonu yok. Süre dolunca maç kendiliğinden başlar.
- Boşalan yer sinerjiler ve taktik kartları için kullanılır.

Kod: `mobile/src/app/taktik/oyun.tsx`. İki şey istiyoruz: tek görsel ekran tasarımı ve ekranı
kodda kurmak için birkaç şeffaf parça.

## Ekran tasarımı: ChatGPT'ye yapıştırılacak prompt

> Design a mobile game screen, portrait iPhone (1320×2868), for a football auto-battler
> called Pitch Chess. Style: clean, modern sports-editorial look on an off-white
> background (#F2F4F2), bold condensed sans-serif headings in uppercase (like Barlow
> Condensed Black), crisp flat cards with thin borders, one red accent (#F43F5E), gold coins,
> realistic glossy football shirts. No neon, no dark mode, no real people, no faces, no club
> crests, no logos, no sponsor text. Turkish text. Everything on ONE screen, no scrolling,
> no title text, no big bottom button. Top to bottom:
> (1) one slim top row: back arrow, "Tur 2–1", a stopwatch icon with "22 sn" and a thin red
> draining bar under it, a red heart "86", a gold coin "14", a small flame "3";
> (2) a row of 8 small round manager avatars (cartoon, faceless or simple), a thin health bar
> under each, mine with a green ring;
> (3) a row of synergy and tactics chips, white rounded pills with thin borders: a tactics
> card chip with a tiny illustration of a bus and "Savunma +%25", a chip with a small red-white
> striped shirt and "2/3" filled green (active), a chip with a small flag and "1/2" (inactive,
> white), a small golden boot item icon;
> (4) the hero: a big flat striped football pitch seen from above, full screen width, white
> lines, far goal at the top. Players stand on four lines (3 forwards, 4 midfielders,
> 4 defenders, 1 goalkeeper). A filled spot is a big glossy football shirt in club colours with
> a white number, and under it a white name tag: surname in bold ("Hauge"), small stars and the
> position ("★★ SNT"), a coloured bottom edge. Empty spots are dashed translucent boxes with a
> "+". Two small white pills on the pitch's bottom corners: "Sahada 5/6" and a magic wand with
> "En iyi diziliş";
> (5) one row split in two: left "YEDEKLER 2/8" with small shirt cards (shirt, surname,
> position) and dashed "+" slots; right "SEVİYE 3", a thin red progress bar "2/6 XP", and a grey
> button "XP al · 4" with a gold coin;
> (6) a thin divider, then "TRANSFER PAZARI" with a grey "Yenile · 2" button with a coin on the
> right; 5 cards in a row: gold coin price on top (1–5), a big glossy shirt, surname, position
> (SNT / OS / DEF / KL); the fifth is a soft purple mystery card "Gözcü" with a magnifying glass.
> Generous spacing, readable text (minimum 11 pt), easy to use with one thumb.

İkinci görsel için: *"Same screen, a player on the pitch is selected: his name tag turns light
yellow and lifts a little, and a wide red button 'Sat · 2' with a gold coin appears at the very
bottom."*

## Parçalar (şeffaf PNG, 1024×1024, tek nesne, ortada)

Ortak prompt başı:

> Mobile game UI asset, glossy realistic-but-clean style matching a sports app, soft studio
> light, no text, no letters, no numbers, no logos, no crests, transparent background PNG,
> single object centred with ~8% margin.

| Dosya | Ne | Prompt sonu |
|---|---|---|
| `shirt-base.png` | Forma tabanı | A plain white short-sleeve football shirt seen from the front, crew neck, soft fabric folds and shading, no number, no crest (it is tinted in code). |
| `shirt-shade.png` | Forma gölgesi | Only the soft grey shading and fold shadows of that same shirt on transparent, to be multiplied over a coloured shirt. |
| `pitch-flat.png` (1320×1600, opak) | Saha | A flat football pitch seen straight from above, portrait, horizontal mown stripes in two greens, crisp white lines (touchlines, halfway line, centre circle, both penalty boxes and six-yard boxes), far goal at the top edge, near goal at the bottom edge, fills the whole image, no players, no ball. |
| `ui-boot.png` | Altın krampon (eşya) | A small golden football boot. |
| `ui-gloves.png` | Kaleci eldiveni (eşya) | A pair of goalkeeper gloves. |

Bitince dosyaları bir klasöre koy ve söyle; içe aktarıp ekrana bağlarım.
