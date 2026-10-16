# Pitch Chess maç sahası: görsel brief

Pitch Chess'te (Taktik Tahtası) maçlar yukarıdan bakılan bir sahada oynanıyor
(`mobile/src/components/taktik/MatchPitch.tsx`). Şu an saha, top ve oyuncular kodla
çiziliyor. Bu brief, aynı sahneyi daha "oyun gibi" göstermek için ChatGPT görsel
üretimine verilecek parçaları tanımlar. Sahne parçalardan kurulur; tek bir büyük
resim değil.

Oyuncuların formaları kodla kalır. Her oyuncu kendi kartındaki kulübün formasını
giyer (`Jersey`), altında karttaki ismi, ayağının altında takım rengi (sen mavi,
rakip mercan) yazar. Gerçek kişi, yüz, arma ya da logo yoktur.

Bitince dosyaları bir klasöre koy ve şunu çalıştır:

    python3 scripts/taktik-pitch-assets.py <klasör>

Betik kırpar, küçültür ve `mobile/assets/brand/taktik/pitch/` içine yazar. Ardından
`TAKTIK.pitch` (mobile/src/lib/brand.ts) dolar ve saha bu görselleri kullanır;
eksik olan parça kodla çizilmeye devam eder.

## Ortak prompt başı (her görselin başına ekle)

> Mobile game asset, casual football game, top-down view from directly above.
> Soft glossy 3D look, chunky rounded shapes, warm top-left light, rich colours
> without neon. No text, no letters, no numbers, no logos, no club crests, no
> real people. PNG.

## Parçalar

| Dosya | Ne | Boyut | Prompt sonu |
|---|---|---|---|
| `pitch-grass.png` | Sahanın zemini | 1536×1024, opak | A full football pitch seen straight from above, wide landscape, mown grass in alternating light and dark green vertical stripes, crisp white lines (touchlines, halfway line, centre circle, both penalty boxes and six-yard boxes, penalty spots), no goals, no players, no ball, no stadium, the pitch fills the whole image edge to edge. |
| `pitch-goal-left.png` | Sol kale | 256×512, şeffaf | A football goal seen from above at the left edge of a pitch: white posts and crossbar with a white net behind it, opening to the right, transparent background. |
| `pitch-goal-right.png` | Sağ kale | 256×512, şeffaf | The same goal mirrored: opening to the left, transparent background. |
| `pitch-ball.png` | Top | 256×256, şeffaf | A classic black-and-white football seen from above with a soft round shadow under it, transparent background. |
| `pitch-shadow.png` | Oyuncu gölgesi | 256×128, şeffaf | A soft dark oval shadow on grass seen from above, blurred edges, transparent background, nothing else. |

## Kurallar

- Zemin, kartın üstüne kırpılmadan oturmalı: saha çizgileri kenarlardan ~3% içeride.
- Kale ve top küçük boyutta (top ~14 px, kale ~60 px yükseklik) seçilebilir kalmalı.
- Renkler uygulamanın yeşilleriyle uyumlu; neon ya da gece ışığı yok.
- Hiçbir parçada yazı, sayı, sponsor, arma ya da gerçek bir stadyum yok.
