# Dribbling Rush 3D: görsel brief (ChatGPT)

3D oyun (Unity, `unity/DribblingRush`) dünyayı kodla kurar; bu görseller onun üstüne giydirilir. Hepsi isteğe
bağlı: dosya yoksa oyun kendi çizdiğini kullanır (`Look.Art`). PNG ya da JPG olabilir, en az belirtilen boyutta.

## Teslimat

- Kaynaklar: `docs/design/kosu-art/originals/3d/<dosya>` (ya da sohbete ekle).
- İşleme: `python3 scripts/kosu-3d-assets.py docs/design/kosu-art/originals/3d` (kırpar, dikişsiz yapar, küçültür →
  `unity/DribblingRush/Assets/Resources/Art/`), HUD ikonları `python3 scripts/kosu-assets.py docs/design/kosu-art/originals/3d`
  (→ `mobile/assets/brand/kosu/`). Sonra `./unity/build.sh ios|android`.
- 2026-10-20: ilk set geldi ve oyunda (kalabalık, karşı tribün, 4 pano, iki ikon); promptlar `kosu-art/prompts-3d.json`.

## Ortak kurallar (her prompta ekle)

> Mobile casual football game art, bright and friendly toy-like 3D style, chunky rounded shapes, rich saturated
> colours with strong contrast (no washed-out pastels), soft top light. No text, no letters, no numbers, no logos,
> no club crests, no sponsor marks, no real people, no recognisable faces.

## 1. Stadyum dokuları (oyunun içi)

| Dosya | Boyut | İçerik / prompt |
|---|---|---|
| `crowd.png` | 2048×512, yatayda dikişsiz | Tribünde oturan kalabalık, saha seviyesinden düz bakış, sıra sıra küçük stilize taraftarlar; formalar ve atkılar kırmızı, mavi, sarı, beyaz karışık; koltuklar koyu lacivert. Yüz detayı yok (basit yuvarlak kafalar). Sol ve sağ kenar birbirine kusursuz eklenmeli (seamless horizontal tile). |
| `backdrop.png` | 2048×768 | Sahanın uzak ucundan görünen stadyumun karşı tribünü, çatısı ve projektör direkleri; arkada yumuşak gökyüzü (öğleden sonra, hafif sıcak ışık). Alt orta kısım sade kalsın (saha oraya doğru akıyor); yazı ve tabela yok. Ön cepheden, simetrik, düz kamera. |
| `board-1.png` … `board-4.png` | 1024×128 her biri, yatayda dikişsiz | Saha kenarı LED reklam panosu yüzleri: soyut spor grafikleri (dalgalar, hız çizgileri, top silüetleri, ok desenleri), her biri farklı ana renk: 1 mavi, 2 kırmızı, 3 turuncu, 4 mor. Parlak, kontrastlı, yazısız. |

## 2. HUD ikonları (uygulama; şeffaf arka plan, mevcut `pick-*.png` ile aynı stil)

Ek prompt: *"Transparent background PNG, the object centred with ~8% empty margin, readable at 80 px, glossy 3D toy
style, warm top-left studio light, gentle rim light."*

| Dosya | İçerik |
|---|---|
| `pick-jet.png` | Roket top: klasik siyah-beyaz futbol topu, altında üç kırmızı kanatçık ve aşağı doğru turuncu-sarı alev; hafif yukarı eğik, uçuyor. |
| `pick-spring.png` | Yaylı krampon: tek parlak yeşil krampon, tabanının altında gümüş helezon yay; zıplıyormuş gibi hafif eğik. |

İlk sürümleri Unity'deki 3D modellerden çizilmişti (`./unity/build.sh icons`); artık ChatGPT'ninkiler kullanılıyor.

## 3. Oyunda kodla çizilenler (görsel gerekmez)

Koşucu, hakem (kovalayan), defansçılar ve barajı, çıta (altından kay), koniler (üstünden zıpla), yedek kulübeleri
(çatısında koş), A-tipi saha panosu rampaları, çim biçme makinesi, harfli formalar, altınlar, güçlendirmeler, köşe
bayrakları, saha çizgileri, tribün flaşları.
Bunların rengini/şeklini beğenmezsen tarif etmen yeter; görsel üretmek gerekmiyor.
