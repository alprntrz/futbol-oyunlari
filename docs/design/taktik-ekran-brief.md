# Pitch Chess hazırlık ekranı: tasarım brief'i (ChatGPT)

Pitch Chess (Taktik Tahtası), Tiktako'daki futbol temalı otomatik savaş oyunu. 8 menajer
her turda mağazadan futbolcu alıp sahaya dizer, süre bitince maçlar kendiliğinden oynanır.
Bu brief, turlar arasındaki **hazırlık ekranının** yeniden tasarımı içindir. Kod:
`mobile/src/app/taktik/oyun.tsx`.

İki şey istiyoruz:

1. **Ekran tasarımı (mockup):** tüm ekranın tek bir görselde, telefonda nasıl göründüğü.
2. **3D parça seti:** tasarımda kullanılan ikon ve yüzeylerin ayrı ayrı, şeffaf arka planlı
   PNG'leri. Ekranı React Native'de bu parçalarla kuracağım; mockup sadece yol gösterir.

## Kesin kurallar

- **Her şey tek ekranda.** Sekme, sayfa ya da kaydırma yok. Mağaza, yedek kulübesi,
  sinerjiler ve saha aynı anda görünür. iPhone dikey ekran, 440×956 pt (görsel 1320×2868).
- **3D oyun görünümü.** Yumuşak parlak 3D, yuvarlak hatlı, "kalın" yüzeyler, sol üstten sıcak
  ışık. Clash Royale / Brawl Stars / Magic Chess tarzında bir mobil oyun arayüzü, ama sade.
- **Okunabilir.** En küçük yazı 11 pt. Futbolcu soyadı her kartta okunur.
- **Gerçek kişi, yüz, kulüp arması, logo, sponsor yok.** Futbolcular yüzsüz; formalar düz
  renk ya da çizgili, armasız.
- **Yazılar Türkçe** (aşağıdaki örnek metinler).
- **Renkler:** Tiktako yeşilleri (koyu saha yeşili #0F3D24, çim #3BA55C), sıcak sarı vurgu
  (#FACC15, "Maça çık" butonu), krem kartlar. Neon, mor uzay ya da gece ışığı yok.
- **Tek ana buton:** "Maça çık". Diğer butonlar ikincil.

## Ekranda olması gerekenler (yukarıdan aşağı)

1. **Üst şerit**
   - Geri butonu, tur adı "Aşama 2-1", soru işareti (nasıl oynanır).
   - Can: kalp + "86". Altın: madeni para + "14". Seri varsa: ateş + "3".
   - **Hazırlık süresi:** "Maça 22 sn" ve azalan bir çubuk (son 5 saniyede kırmızı).
2. **Menajerler şeridi:** 8 menajer; küçük avatar, kısa isim ve can çubuğu. Sen vurgulusun.
3. **Saha (ekranın en büyük parçası):** hafif eğik, 3D bir futbol sahası. 12 yer:
   - 3 forvet, 4 orta saha, 4 defans, 1 kaleci.
   - Dolu yer: futbolcu kartı.
     - Forma (kulüp renkleri).
     - Soyadı ("Hauge").
     - Bayrak.
     - Mevki etiketi (FW/MF/DF/GK).
     - Üstte 1–3 yıldız.
     - Maliyet rengi şeridi: gri, yeşil, mavi, mor, altın.
   - Boş yer: mevkisi yazan yarı saydam bir yuva.
   - Sahanın köşelerinde iki küçük düğme:
     - "Sahada 5/5" (kapasite).
     - "En iyi diziliş" (sihirli değnek ikonu).
4. **Taktik kartları ve sinerjiler (tek satır, yatay):**
   - Seçilmiş taktik kartları küçük çip olarak: çizim + "Savunma +%25".
   - Sinerjiler: forma ya da bayrak + "2/3". Aktif olanlar parlak, olmayanlar soluk.
   - Eşyalar (varsa): küçük 3D eşya ikonları (eldiven, altın krampon).
5. **Yedek kulübesi:** 8 küçük yuva, yan yana. Dolu olanlarda mini futbolcu kartı.
6. **Bilgi satırı:** "+7 altın · maaş 5 · faiz 1 · seri 1" gibi kısa bir mesaj alanı.
7. **Mağaza:** 5 futbolcu kartı yan yana. Her kartta:
   - Fiyat rozeti (madeni para + 1–5).
   - Elinde aynısından kaç tane olduğu: "2/3".
   - Bazen bir **gözcü kartı:** mor, büyüteçli, futbolcu gizli.
8. **Alt butonlar:**
   - "Yenile · 2"
   - "Seviye 3 · XP al 4" ve küçük bir ilerleme çubuğu.
   - Büyük sarı "Maça çık".

Bir futbolcu seçiliyken alt kısımda kırmızı "Sat · 2" butonu çıkar. Bunu ikinci bir küçük
görselde göster.

## ChatGPT'ye yapıştırılacak prompt (ekran tasarımı)

> Design a mobile game screen, portrait iPhone (1320×2868), for a football auto-battler
> called Pitch Chess. Polished 3D casual mobile-game UI in the style of Clash Royale and
> Brawl Stars but calmer and cleaner: soft glossy 3D surfaces, chunky rounded panels with
> thick bevelled edges, warm top-left light, deep pitch-green background (#0F3D24), grass
> green (#3BA55C), warm yellow accent (#FACC15) for the main button, cream player cards.
> No neon, no space theme, no real people, no faces, no club crests, no logos.
> EVERYTHING ON ONE SCREEN, no tabs, no scrolling. Turkish text. From top to bottom:
> (1) top bar: back button, title "Aşama 2-1", heart "86", gold coin "14", flame "3", a help
> button, and a countdown "Maça 22 sn" with a draining yellow bar;
> (2) a strip of 8 managers with small round avatars, short names and health bars, mine
> highlighted;
> (3) the biggest element: a slightly tilted 3D football pitch with 12 spots (3 forwards,
> 4 midfielders, 4 defenders, 1 goalkeeper); filled spots hold small player cards (faceless
> kit shirt in club colours, surname like "Hauge", a small flag, a position tag FW/MF/DF/GK,
> 1–3 stars, a coloured cost stripe); empty spots are translucent sockets labelled with
> the position; two small chips on the pitch: "Sahada 5/5" and "En iyi diziliş" with a
> magic-wand icon;
> (4) one horizontal row of chips: tactics cards ("Savunma +%25" with a tiny bus
> illustration), synergies (a shirt or flag with "2/3", active ones glowing), items
> (gloves, golden boot);
> (5) a bench of 8 small slots;
> (6) one short info line "+7 altın · maaş 5 · faiz 1";
> (7) a shop of 5 player cards with coin price badges 1–5 and "2/3" owned counters, one of
> them a purple mystery scout card with a magnifying glass;
> (8) bottom buttons: "Yenile · 2", "Seviye 3 · XP al 4" with a small progress bar, and a
> big yellow "Maça çık" button with a ball icon. Clear hierarchy, readable text (minimum
> 11 pt), generous spacing, easy to use with one thumb.

İstersen ikinci bir yön için sonuna şunu ekle: *"Variant B: a flatter, top-down pitch and a
darker stadium-at-night mood with floodlights."*

## 3D parça seti

Ekranı bu parçalarla kodda kuracağım. Her biri şeffaf arka planlı PNG, tek nesne, ortada,
~%8 boşlukla, 1024×1024 (aksi yazmıyorsa). Stil yukarıdaki ekranla aynı olmalı.

Ortak prompt başı:

> Mobile game UI asset, polished 3D casual style, soft glossy surfaces, chunky rounded
> shapes, warm top-left light, gentle rim light, no text, no letters, no numbers, no logos,
> transparent background PNG, single object centred.

| Dosya | Ne | Prompt sonu |
|---|---|---|
| `ui-heart.png` | Can | A glossy red heart. |
| `ui-coin.png` | Altın | A thick gold coin with a small football embossed on it. |
| `ui-flame.png` | Seri | A small orange flame. |
| `ui-stopwatch.png` | Hazırlık süresi | A small yellow stopwatch. |
| `ui-reroll.png` | Yenile | Two curved green arrows forming a circle, chunky. |
| `ui-xp.png` | XP al | A blue upward arrow on a small star. |
| `ui-kickoff.png` | Maça çık | A football with motion lines, ready to be kicked. |
| `ui-sell.png` | Sat | A gold coin stack with a small red price tag. |
| `ui-wand.png` | En iyi diziliş | A short magic wand with sparkles, yellow tip. |
| `ui-star.png` | Yıldız | A single chunky gold star. |
| `ui-scout.png` | Gözcü kartı | A purple card back with a big golden magnifying glass. |
| `slot-empty.png` (512×640) | Boş saha yuvası | An empty translucent rounded socket on grass, seen from slightly above, soft white rim, nothing inside. |
| `slot-bench.png` (512×640) | Yedek yuvası | A dark green rounded bench socket, slightly recessed. |
| `card-frame-1.png` … `card-frame-5.png` (512×640) | Kart çerçeveleri | An empty cream player-card frame with a thick rounded bevelled border coloured by cost (1 grey, 2 green, 3 blue, 4 purple, 5 gold); a blank area in the middle for a shirt; no text. |
| `pitch-tilted.png` (1320×1200, opak) | Eğik saha | A football pitch seen from above at a slight tilt (about 25°), striped grass, white lines, both goals at the top and bottom edges, no players, no ball, no stadium, fills the image. |
| `panel.png` (1024×512) | Panel zemini | A rounded dark-green 3D panel with a thick bevelled rim, empty, for the shop and bench rows. |

Bitince dosyaları bir klasöre koy, söyle; içe aktarma betiğini yazıp ekranı kurarım.
