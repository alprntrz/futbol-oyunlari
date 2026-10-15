# Alt menü ikonları: brief

Alt menüdeki dört sekme (Ana sayfa, Oyunlar, Profil, Ayarlar) şu an tek renkli
sistem ikonları. Duolingo'daki gibi menünün de markanın parçası olması için
küçük, renkli, kendi ikonlarımızı istiyoruz. Bu brief ChatGPT görsel üretimi içindir.

Not: iOS'un yerel sekme çubuğu seçili sekmeyi renklendirmek için ikonu tek
renkli şablon olarak boyar. Renkli ikonlar kullanınca seçili sekmeyi ikonun
altındaki bir vurguyla göstereceğiz; ikonun kendisi her zaman renkli kalır.

## Ortak prompt başı

> Small mobile app tab bar icon, soft 3D, chunky rounded shapes, matte
> toy-like surfaces, warm top-left light, very simple silhouette that reads at
> 28 pt. Same style for all four icons. No text, no letters, no numbers, no
> logos. Transparent background PNG, 512×512, the object centred with ~12%
> margin. Palette: pitch green #16A34A, gold #FACC15, cream #FFF6DC, dark
> green #0E5E2C.

## İkonlar

| Dosya | Sekme | Prompt sonu |
|---|---|---|
| `tab-home.png` | Ana sayfa | A tiny stadium seen from the front: green pitch, cream stand, a small gold flag on top. |
| `tab-games.png` | Oyunlar | A white football resting on a small green game controller. |
| `tab-profile.png` | Profil | A cream football shirt with a gold collar, no number. |
| `tab-settings.png` | Ayarlar | A gold whistle on a short green lanyard. |

Ayrıca her biri için seçili olmayan hâlde kullanmak üzere aynı ikonun gri
tonlu hâlini isteyebilirsin: *"…same icon, desaturated grey"* (`tab-home-off.png` vb.).

## Teslim

Dosyaları bir klasöre koy ve yolunu yaz; boyutlayıp alt menüye takarım.
