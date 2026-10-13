# Tiktako — "Oyun görünümü" görsel brief'i (Draft Showdown tarzı)

`ui-showdown` dalındaki yeni Ana sayfa ve alt menü için. ChatGPT görsel üretimi
(GPT Image) için hazırlandı; prompt'lar İngilizce. Dosyaları tek klasörde topla
(örn. `~/Downloads/tiktako-showdown/`), aşağıdaki **dosya adlarıyla**; ben
`mobile/assets/brand/oyun/` altına kırpıp küçültüp bağlarım.

Şu an Ana sayfadaki büyük oyun görseli 192 px'lik eski ikonlardan büyütülüyor,
bu yüzden bulanık. En önemli iş 1. bölüm.

---

## Ortak stil (her prompt'un sonuna ekle)

> Chunky casual mobile game art in the style of Supercell / Draft Showdown:
> bold rounded 3D shapes, thick dark outline (#05261A), saturated colours,
> soft top-left light with a bright rim highlight, slight toy-like plastic sheen.
> Centered, full object visible, transparent background, no text, no letters,
> no numbers, no logos, no real club crests, no real people. 1024×1024 PNG.

Renk paleti: çim yeşili #0F6B3A / #9BE15D, turuncu #FF9F1C, mor #A855F7,
mavi #3B82F6, pembe #F43F7A, altın #FACC15.

---

## 1. Ana sayfa kahraman görselleri (öncelik: yüksek)

Seçili oyun büyük ve "yüzer" şekilde ortada duruyor (~200 pt, yani en az 600 px
lazım). Üçü aynı ışık ve aynı kamera açısında olsun.

| Dosya | Prompt |
|---|---|
| `hero-tictactoe.png` | A chunky 3×3 tic-tac-toe board made of green pitch turf tiles with white chalk lines, a big blue X and a big coral-red O standing on it as 3D toy pieces, a football resting on one corner. |
| `hero-quiz.png` | A big glossy blue speech bubble with a white 3D question mark, a football as the dot of the question mark, small gold stars popping around it. |
| `hero-possession.png` | A cluster of seven chunky hexagon tiles, some green some blue some coral, slightly floating at different heights, a football on the centre hexagon. |

## 2. Alt menü ikonları (öncelik: orta)

Renkli kare kutuların içine beyaz/renkli ikon olarak oturuyor (kutuyu ben
çiziyorum). Sadece **ikonun kendisi**, kutusuz; 512×512, kalın kontur.

| Dosya | Sekme | Prompt |
|---|---|---|
| `tab-games.png` | Oyunlar | Four chunky rounded game tiles in a 2×2 grid, each a different colour (green, blue, orange, purple). |
| `tab-daily.png` | Günlük | A chunky tear-off calendar with a gold star sticker on the page. |
| `tab-play.png` | Maç (orta) | A chunky white-and-black football with a motion swoosh. |
| `tab-friends.png` | Arkadaşlar | Two chunky cartoon football shirts side by side, one blue one purple, leaning together. |
| `tab-profile.png` | Profil | A chunky round player badge: a cartoon footballer head-and-shoulders silhouette on a shield. |

## 3. Arka plan dokusu (öncelik: düşük)

| Dosya | Prompt |
|---|---|
| `bg-pattern.png` | Seamless tileable pattern, very subtle: tiny footballs, stars and boots scattered on transparent background, white at 100% (I lower the opacity). 512×512, must tile without seams. |

---

Not: Gerçek oyuncu yüzü, kulüp arması veya marka kullanmıyoruz; formalar ve
logolar her zaman özgün kalmalı.
