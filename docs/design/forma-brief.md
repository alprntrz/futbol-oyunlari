# Daha kaliteli formalar: ChatGPT brief'i

Uygulamadaki her forma tek bir beyaz forma görselinden üretiliyor. `scripts/brand-assets.py`
onu katmanlara ayırıyor: gövde, kollar (kulüp renklerine boyanır) ve gölge. Bu yüzden tek
görsel bütün formaların kalitesini belirliyor.

Şu anki formalar sade görünüyor, çünkü:
- 256 px'e küçültülüyor,
- sadece gölge katmanı var; parlaklık (ışık vuran yerler) yok,
- yaka ve kol ağızları ayrı renk alamıyor.

Bu brief yeni kaynak görseller içindir. Gelince betiği ve forma bileşenini güncelleyip
(daha yüksek çözünürlük, parlaklık katmanı, yaka/kol ağzı rengi) bütün formaları yenilerim.

## Ortak kurallar

- Şeffaf arka planlı PNG, 1024×1024, forma ortada, ~%8 boşluk.
- Önden düz bakış, simetrik, hafif 3D, yumuşak stüdyo ışığı (sol üstten).
- Kumaş **saf beyaz**; kıvrım gölgeleri ve parlak yerler belirgin ama abartısız.
- **Yaka ve kol ağızları saf siyah (#000000)**, net kenarlı. Betik bunları ayrı katmana alıp
  kulübün ikinci rengine boyar.
- Yazı, numara, arma, logo, sponsor, desen yok. Manken ya da insan yok.

## Görseller

| Dosya | Yaka | Prompt |
|---|---|---|
| `jersey-crew.png` | Yuvarlak yaka | A single plain football shirt, front view, perfectly symmetrical, short sleeves, round crew neck. The fabric is pure white with soft realistic folds, gentle shadows and soft glossy highlights like a modern match shirt render. The collar band and both sleeve cuffs are solid pure black with crisp edges. No text, no numbers, no logo, no crest, no pattern, no mannequin. Transparent background PNG, 1024×1024, centred with ~8% margin. |
| `jersey-vneck.png` | V yaka | Same as above but with a V-neck collar (black). |
| `jersey-polo.png` | Polo yaka | Same as above but with a polo collar with two buttons (collar and placket black). |
| `jersey-keeper.png` | Kaleci (uzun kol) | Same as above but a goalkeeper shirt with long sleeves and a round neck; collar and cuffs black. |

Dosyaları bir klasöre koy ve söyle.
