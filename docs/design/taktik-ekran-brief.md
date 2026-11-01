# Pitch Chess hazırlık ekranı: tasarım brief'i (3D + Duolingo sadeliği)

Pitch Chess (Taktik Tahtası), Tiktako'daki futbol temalı otomatik savaş oyunu. 8 menajer
her turda mağazadan futbolcu alıp sahaya dizer, süre bitince maçlar kendiliğinden oynanır.
Bu brief, turlar arasındaki **hazırlık ekranının** tasarımı içindir (kod:
`mobile/src/app/taktik/oyun.tsx`). ChatGPT'den iki şey istiyoruz:

1. **Ekran tasarımı (mockup):** bütün ekran, tek görsel.
2. **3D parça seti:** ekranı kodda kurmak için ayrı ayrı şeffaf PNG'ler.

## Yön: "Duolingo'nun sadeliği, oyunun 3D nesneleri"

İki dünyayı şöyle bölüyoruz:

- **Arayüz iskeleti Duolingo gibi:** açık, ferah zemin; az ve kısa yazı; kalın, yuvarlak,
  düz renkli paneller; alt kenarı koyu "basılabilir" kalın butonlar (Duolingo'nun
  "CONTINUE" butonu gibi); kalın ilerleme çubukları; ekranda tek bir parlak ana renk vurgusu;
  bol boşluk. Gölge, parıltı, doku yok; derinlik sadece butonların alt kenarından gelir.
- **Oyunun nesneleri 3D:** saha, futbolcu kartları, madeni para, kalp, kronometre, taktik
  kartı çizimleri yumuşak, "kil / oyuncak" hissi veren 3D render. Bu nesneler ekranın
  kahramanı; arayüz onların etrafında sade kalır.

Kısaca: düz ve sakin bir arayüz üstünde parlak, dokunulası 3D oyun parçaları.

## Kesin kurallar

- **Her şey tek ekranda.** Sekme, ayrı sayfa ya da kaydırma yok. Saha, taktik/sinerji
  çipleri, yedek kulübesi, mağaza ve butonlar aynı anda görünür. iPhone dikey,
  440×956 pt (görsel 1320×2868).
- **Açık zemin.** Kırık beyaz / çok açık yeşil gri (#F1F4F1) arka plan, beyaz kartlar.
  Saha koyu yeşil değil, canlı çim yeşili bir 3D obje olarak ortada durur.
- **Renkler (Duolingo gibi az ve net):**
  - Ana yeşil #16A34A (alt kenarı #0F7A35).
  - Ana buton sarısı #FACC15 (alt kenarı #CA8A04). Sadece "Maça çık" bu renkte.
  - Metin #0E1A14.
  - Can kırmızısı #F43F5E, altın sarısı #F59E0B, mavi #2563EB.
  - Maliyet renkleri 1 gri, 2 yeşil, 3 mavi, 4 mor, 5 altın.
- **Yazı:** kalın, yuvarlak hatlı bir sans-serif (Duolingo'nun Feather Bold'u gibi). Türkçe,
  kısa. En küçük yazı 11 pt.
- **Gerçek kişi, yüz, kulüp arması, logo, sponsor yok.** Futbolcular yüzsüz, formalar düz
  ya da çizgili, armasız.
- **Tek başparmakla kullanım:** önemli her şey dokunulabilir büyüklükte (en az 44 pt).

## Ekranda olması gerekenler (yukarıdan aşağı)

1. **Üst şerit (beyaz, düz):**
   - Solda geri oku.
   - Ortada "Aşama 2-1".
   - Sağda üç küçük 3D sayaç: kalp "86", madeni para "14", ateş "3".
   - Altında kalın bir süre çubuğu, Duolingo ders çubuğu gibi yuvarlak uçlu. Üstünde
     "Maça 22 sn" yazar. Son 5 saniyede kırmızıya döner.
2. **Menajerler:** 8 küçük yuvarlak avatar, altlarında ince can çubukları. Sen yeşil
   halkalısın.
3. **Saha (ekranın en büyük parçası):** hafif eğik, yumuşak 3D bir oyuncak futbol sahası.
   12 yer var: 3 forvet, 4 orta saha, 4 defans, 1 kaleci.
   - Dolu yer: küçük 3D futbolcu kartı.
     - Yüzsüz forma (kulüp renkleri).
     - Soyadı ("Hauge").
     - Küçük bayrak.
     - Mevki rozeti (FW/MF/DF/GK).
     - 1–3 yıldız.
     - Kartın alt kenarı maliyet renginde.
   - Boş yer: yarı saydam, kesik çizgili yuva; üstünde mevki yazar.
   - Sahanın altında iki küçük hap düğme: "5/5 sahada" ve "✨ En iyi diziliş".
4. **Çip satırı (tek satır, beyaz hap şeklinde):**
   - Taktik kartları: minik 3D çizim + "Savunma +%25".
   - Sinerjiler: forma ya da bayrak + "2/3". Aktif olanlar yeşil dolgulu, olmayanlar gri
     çerçeveli.
5. **Yedek kulübesi:** 8 küçük yuva tek satırda, dolu olanlarda mini kart.
6. **Mağaza:** 5 futbolcu kartı yan yana, beyaz zeminde.
   - Kartın altında fiyat hapı: madeni para + 1–5.
   - Sol üstte "2/3" rozeti.
   - Bazen mor bir **gözcü kartı:** büyüteçli, futbolcu gizli.
   - Mağazanın üstünde tek satır bilgi: "+7 altın · maaş 5 · faiz 1".
7. **Alt butonlar (Duolingo tarzı kalın, alt kenarlı):**
   - Gri-beyaz "↻ Yenile · 2".
   - Mavi "Seviye 3 · XP al 4" ve içinde ince ilerleme çubuğu.
   - Geniş sarı **"Maça çık"** (top ikonu). Ekranın tek parlak butonu.

Bir futbolcu seçiliyken alt butonların yerine kırmızı, kalın "Sat · 2" butonu gelir. Bunu
ikinci küçük bir görselde göster.

## ChatGPT'ye yapıştırılacak prompt (ekran tasarımı)

> Design a mobile game screen, portrait iPhone (1320×2868), for a football auto-battler
> called Pitch Chess. The look blends Duolingo's minimal UI with soft 3D game objects:
> the interface is flat, light and calm like Duolingo (off-white #F1F4F1 background, white
> rounded cards, bold rounded sans-serif text, very few words, thick progress bars with
> round ends, chunky buttons with a darker bottom edge instead of shadows, lots of white
> space, one bright accent), while the game objects are glossy, toy-like 3D renders (a
> slightly tilted 3D toy football pitch, small 3D player cards, a 3D heart, gold coin,
> flame, stopwatch). Colours: green #16A34A, yellow #FACC15 only for the main button, text
> #0E1A14, red #F43F5E, gold #F59E0B, blue #2563EB. No gradients in the UI chrome, no glow,
> no neon, no dark background, no real people, no faces, no club crests, no logos.
> EVERYTHING ON ONE SCREEN, no tabs, no scrolling. Turkish text. Top to bottom:
> (1) a white top bar with a back arrow, "Aşama 2-1", three small 3D counters (heart "86",
> coin "14", flame "3"), and under it a thick rounded countdown bar labelled "Maça 22 sn";
> (2) 8 small round manager avatars with thin health bars, mine with a green ring;
> (3) the hero: a slightly tilted, soft 3D toy football pitch with 12 spots (3 forwards,
> 4 midfielders, 4 defenders, 1 goalkeeper); filled spots hold small 3D player cards
> (faceless kit shirt in club colours, surname "Hauge", tiny flag, position badge, 1–3
> stars, a cost-coloured bottom edge), empty spots are dashed translucent sockets with the
> position; two small pills under the pitch: "5/5 sahada" and "✨ En iyi diziliş";
> (4) one row of white pill chips: a tactics card ("Savunma +%25" with a tiny 3D bus) and
> synergies (a shirt or a flag with "2/3", active ones filled green);
> (5) a bench of 8 small slots in one row;
> (6) a one-line note "+7 altın · maaş 5 · faiz 1";
> (7) a shop of 5 player cards with coin price pills 1–5 and "2/3" badges, one a purple
> mystery scout card with a magnifying glass;
> (8) Duolingo-style chunky bottom buttons: a white "↻ Yenile · 2", a blue "Seviye 3 ·
> XP al 4" with a thin progress bar, and a wide yellow "Maça çık" with a ball icon.
> Clear hierarchy, readable text (minimum 11 pt), easy to use with one thumb.

İkinci bir görsel için: *"Same screen, a player is selected: the bottom buttons are replaced
by one wide red chunky button 'Sat · 2', the selected card on the pitch is lifted and
outlined in green."*

## 3D parça seti

Ekranı bu parçalarla kodda kuracağım. Butonlar, paneller, çipler ve çubuklar kodla çizilir
(Duolingo tarzı düz yüzeyler); sadece 3D nesneler görsel olarak gelir. Her biri şeffaf
arka planlı PNG, tek nesne, ortada, ~%8 boşlukla, 1024×1024 (aksi yazmıyorsa).

Ortak prompt başı:

> Soft 3D toy-like game object, matte-glossy clay look, rounded chunky shapes, warm
> top-left light, gentle soft shadow under the object only, bright clean colours that sit
> well on a white background, no text, no letters, no numbers, no logos, transparent
> background PNG, single object centred.

| Dosya | Ne | Prompt sonu |
|---|---|---|
| `ui-heart.png` | Can | A chunky red heart. |
| `ui-coin.png` | Altın | A thick gold coin with a small football embossed on it. |
| `ui-flame.png` | Seri | A small orange flame. |
| `ui-stopwatch.png` | Süre | A small yellow stopwatch. |
| `ui-ball.png` | Maça çık | A small football. |
| `ui-wand.png` | En iyi diziliş | A short magic wand with a yellow star tip and two sparkles. |
| `ui-reroll.png` | Yenile | Two curved arrows forming a circle, light grey-green. |
| `ui-xp.png` | XP al | A blue upward arrow on a small star. |
| `ui-scout.png` | Gözcü kartı | A purple card with a big golden magnifying glass on it. |
| `pitch-toy.png` (1320×1100) | Saha | A small toy football pitch seen from above at a slight tilt (about 25°), soft rounded edges like a board-game tile, striped bright grass, white lines, small white goals at the top and bottom, no players, no ball, no stadium. |

Bitince dosyaları bir klasöre koy, söyle; içe aktarma betiğini yazıp ekranı kurarım.
