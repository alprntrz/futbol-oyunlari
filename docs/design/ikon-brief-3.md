# İkon seti 3: "Nasıl oynanır" adımları

"Nasıl oynanır" kartlarında her adımın solunda küçük bir ikon var (Ayarlar → Nasıl
oynanır, Hat-trick ve Eksik 11 tanıtımları). Bunlar hâlâ iOS'un vektörel ikonları;
Possession ve Bilgi Yarışı kurallarında ise sadece nokta var. Bu set hepsini bizim
3D stilimize çevirir.

Bu ikonlar ekranda **küçük** görünür (~36 pt), o yüzden diğer setlerden de sade
olmalı: tek nesne, en fazla 2 renk, ince detay yok.

## Nasıl üretilir

1. Önceki setlerle **aynı sohbette** devam et ya da `ikon2` klasöründen 3-4 ikonu
   referans olarak yükleyip "birebir aynı stil" de.
2. Her biri **1024×1024, şeffaf arka plan**, nesne ortada, ~%12 boşluk.
3. Hepsini `~/Downloads/futbol-oyunlari-brand/ikon3/` klasörüne koy.

## Ortak prompt başı

```
Same style as the reference icons: soft 3D, rounded friendly shapes, matte finish,
subtle soft shadow, gentle highlights, light from the top left, same camera.
This icon is shown very small (36px): one simple object, bold silhouette, at most two
colours plus white, no fine detail. Centred, transparent background, 1024x1024,
about 12% empty margin. Palette only: grass green #16A34A, light green #DCFCE7,
blue #2563EB, coral #F43F5E, amber #F59E0B, ink #0B1220, white.
No text, no letters, no numbers, no logos.
```

## Eksik 11

| Dosya | Adım | Prompt sonu |
|---|---|---|
| `how-tap-shirt.png` | Bir formaya dokun | A plain white football shirt with a small green fingertip tap ripple on its chest. |
| `how-type-surname.png` | Soyadını yaz | Three rounded letter tiles in a row, one grass green, one amber, one light grey, all blank (no letters). |

## Hat-trick

| Dosya | Adım | Prompt sonu |
|---|---|---|
| `how-grid.png` | Satır ve sütun birer kriter | A small 3x3 grid board, white tiles, the top row and left column tiles light green. |
| `how-name-player.png` | Futbolcu adını yaz | A chunky pencil in amber lying diagonally over a small white name card with a blank line. |
| `how-three-row.png` | Üçünü yan yana getir | Three blue rounded X marks in a diagonal line on a white tile board, with a soft green strike through them. |

## Possession Play

| Dosya | Kural | Prompt sonu |
|---|---|---|
| `how-clock.png` | Herkesin kendi saati var | A rounded chess clock with two buttons, one blue one coral, white face (no numbers). |
| `how-hexes.png` | En çok altıgen kazanır | A cluster of four hexagon tiles, three coral and one blue, slightly raised. |

## Bilgi Yarışı

| Dosya | Kural | Prompt sonu |
|---|---|---|
| `how-questions.png` | 10 soru, 15 saniye | A small blue question-mark card leaning against a round amber stopwatch (no numbers). |
| `how-speed.png` | Hızlı olan daha çok puan alır | An amber lightning bolt with a small football at its tip. |
| `how-players.png` | Bir odada 5 kişiye kadar | Three small round player heads side by side, blue, coral and green. |

## Teslim

Klasör hazır olunca bana söyle; `scripts/normalize-icons.py` bunları da aynı optik
boyuta getirir ve vektörel ikonların ve noktaların yerine geçerler.
