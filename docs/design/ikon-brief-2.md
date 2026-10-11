# İkon seti 2: her şey tek stilde

Uygulamada bir şeyi temsil eden **her ikon** (oyunlar, modlar, kategoriler, ayar
satırları) bizim 3D çizimimiz olacak. Şu an 4 tanesi (Hat-trick, Pratik, Takım,
Günlük) bu stilde, gerisi iOS'un vektörel ikonları. Bu brief eksik 14 ikonu tamamlar.

Ok, artı, arama, oynat, kilit gibi küçük **arayüz işaretleri** vektörel kalır
(her oyun böyle yapar). Bu brief onları kapsamaz.

## Nasıl üretilir

1. `ikon-brief.md`'deki ilk dört ikonla (`icon-daily`, `icon-practice`, `icon-team`,
   `icon-tiki`) **aynı stilde** olmalı. En kolayı: o dördünü ChatGPT'ye yükleyip
   "bu dört ikonla birebir aynı stil, ışık ve kamera" demek.
2. Hepsini **aynı sohbette** üret; yeni sohbet stili kaydırır.
3. Her biri **1024×1024, şeffaf arka plan**, nesne ortada, kenarlarda ~%12 boşluk.
4. Dosya adları aşağıdaki gibi olsun, hepsini tek klasöre koy:
   `~/Downloads/futbol-oyunlari-brand/ikon2/`

## Ortak prompt başı (her ikonun başına ekle)

```
Same style as the four reference icons: soft 3D, rounded friendly shapes, matte finish,
subtle soft shadow, gentle highlights, same light from the top left and same camera.
Clean simple silhouette that stays readable at 44px. Single object, centred, transparent
background, 1024x1024, about 12% empty margin on every side.
Palette only: grass green #16A34A, light green #DCFCE7, blue #2563EB, coral #F43F5E,
amber #F59E0B, purple #7C3AED, ink #0B1220, white.
No text, no letters, no numbers, no logos, no real club crests.
```

## Oyunlar (Oyunlar sekmesi)

| Dosya | Oyun | Prompt sonu |
|---|---|---|
| `icon-quiz.png` | Bilgi Yarışı | A rounded speech bubble in blue #2563EB with a white question mark shape formed by a small football as the dot. |
| `icon-mystery.png` | Gizli Oyuncu | A football player silhouette bust in ink #0B1220 with a soft amber #F59E0B question-mark-shaped glow behind the head. |
| `icon-bingo.png` | Futbol Bingo | A small bingo card with a 4x4 grid of rounded squares, some filled grass green, one with a tiny football marker. |
| `icon-possession.png` | Possession Play | Three hexagon tiles side by side like a mini pitch, one coral #F43F5E, one blue #2563EB, one light green, a football on the middle tile. |

## Oynama şekilleri (Hat-trick, Possession, Bilgi Yarışı menüleri ve Ana sayfa)

| Dosya | Mod | Prompt sonu |
|---|---|---|
| `mode-friend.png` | Arkadaşla (kodla online) | Two friendly round player heads side by side, one blue, one coral, with a small link chain between them. |
| `mode-random.png` | Rastgele rakip | A globe in light green with a small football orbiting it and two tiny signal arcs. |
| `mode-same.png` | Aynı ekran | A smartphone lying flat, its screen showing a mini 3x3 grid with one blue X and one coral O. |
| `mode-solo.png` | Tek kişilik | A single round player head in amber with a small stopwatch next to it. |

## Eksik 11 kategorileri (bayraklı olanlar bayrak kalır)

| Dosya | Kategori | Prompt sonu |
|---|---|---|
| `cat-all.png` | Tüm maçlar | A stack of three football match tickets fanned out, grass green and white. |
| `cat-europe.png` | Avrupa kupaları | A big-eared silver cup trophy with a small football on its base (generic, not a real trophy design). |
| `cat-national.png` | Milli takımlar | A football with a small generic pennant flag (plain green and white, no country) stuck behind it. |

## Ayarlar

| Dosya | Satır | Prompt sonu |
|---|---|---|
| `set-privacy.png` | Gizlilik politikası | A rounded shield in grass green with a white padlock on it. |
| `set-support.png` | Destek | A rounded chat bubble in blue with a small white football inside. |
| `set-delete.png` | Verilerimi sil | A rounded rubbish bin in coral #F43F5E with its lid slightly lifted. |

## Teslim

Klasör hazır olunca bana söyle; `scripts/normalize-icons.py` hepsini aynı optik
boyuta getirir ve uygulamadaki vektörel ikonların yerine geçerler.
