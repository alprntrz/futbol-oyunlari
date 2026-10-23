# Dribbling Rush: görsel brief (ChatGPT)

Tasarım: `futbol-kosu.md`. Oyun 2.5D: saha perspektifle ileri akar, karakter ve nesneler
ayrı şeffaf sprite'lar olarak üstüne konur ve mesafeye göre ölçeklenir. Bu yüzden her
görsel **ayrı dosya**, **şeffaf arka plan**, **aynı ışık ve aynı malzeme**.

## Teslimat

- Kaynaklar: `docs/design/kosu-art/originals/<dosya>.png` (en az 1024 px, RGBA PNG).
- Bitince klasörü söyle; işleme betiği (`scripts/kosu-assets.py`) kırpar, küçültür ve
  `mobile/assets/brand/kosu/` altına koyar.

## Ortak prompt başı (her görselin başına ekle)

> Mobile casual game asset, football themed, soft glossy 3D toy style like the rest of a
> friendly sports app: chunky rounded shapes, smooth plastic and fabric materials, thick clean
> silhouette, warm top-left studio light, gentle rim light, rich saturated colours without neon.
> No text, no letters, no numbers, no logos, no club crests, no sponsor marks, no real people,
> no recognisable faces (faceless or simple stylised heads). Transparent background PNG, the
> object centred with ~8% empty margin, readable when shown at 80 px.

Kamera: aksi yazmadıkça **arkadan ve hafif yukarıdan** (oyuncu kamerası, ~25° eğim), çünkü
nesneler oyuncuya doğru gelir. Gölge: nesnenin altında yumuşak, kısa, ayrı tutulabilecek
kadar hafif bir temas gölgesi.

## 1. Karakter (beyaz forma: renkler kodla boyanır)

Forma ve şort **saf beyaz** üretilsin (kodda kulüp rengine boyanacak, Jersey bileşeni gibi).
Saç, ten, krampon, top kendi renginde.

| Dosya | İçerik |
|---|---|
| `runner-run-1.png` … `runner-run-4.png` | Arkadan görünen tombul oranlı oyuncak futbolcu, topu ayağının önünde sürerek koşuyor; 4 kare koşu döngüsü (sol ayak önde, havada, sağ ayak önde, havada). Aynı boy, aynı konum, sadece bacak/kol pozu değişir. |
| `runner-jump.png` | Aynı karakter, iki dizi kırık zıplamış, top ayaklarının arasında havada. |
| `runner-slide.png` | Aynı karakter, yerde kayarak giriyor (slide), top önde. |
| `runner-fall.png` | Aynı karakter, takılıp öne düşmüş (komik, acıtmayan), top yuvarlanıyor. |
| `runner-goal.png` | Önden görünüm, kollar havada sevinç (sonuç kartı için). |

Prompt eki: *"the same character in every image: short chibi proportions, big rounded boots,
simple short hair, plain white football shirt and white shorts, white socks, no number, no
logo, no face details visible from behind."*

## 2. Engeller

| Dosya | İçerik |
|---|---|
| `obs-tackle.png` | Kayarak müdahale eden defansçı, yandan-arkadan görünüş, tek ayak uzanmış, çim parçacıkları; forma **gri** (rakip rengi kodla). |
| `obs-wall.png` | Baraj: 4 defansçı yan yana, eller önde, arkadan görünüş, bir şerit genişliğinde. Gri forma. |
| `obs-defender.png` | Ayakta bekleyen iri defansçı, kollar yana açık, arkadan değil önden (oyuncuya bakıyor), yüzsüz basit kafa. Gri forma. |
| `obs-referee.png` | Hakem, siyah forma, elinde kırmızı kart havada, önden, yüzsüz. |
| `obs-cones.png` | 3 turuncu antrenman konisi dizisi, alçak. |
| `obs-sprinkler.png` | Sahada çalışan çim sulama fıskiyesi, su yayı, altında küçük su birikintisi. |
| `obs-board.png` | Devrilen boş saha kenarı reklam panosu (düz renk, üzerinde yazı yok), kayılarak altından geçilecek yükseklikte. |

## 3. Toplanabilirler ve güçlendirmeler

| Dosya | İçerik |
|---|---|
| `pick-coin.png` | Uygulamanın altın parası (üzerinde top kabartması), hafif açılı. Mevcut `TAKTIK.ui.coin` ile aynı stil. |
| `pick-boots.png` | Kanatlı parlak krampon çifti (hız botu). |
| `pick-magnet.png` | Mıknatıs şeklinde top (kırmızı-beyaz mıknatıs, ucunda top). |
| `pick-armband.png` | Kaptanlık bandı, altın kenarlı kalkan gibi parlayan. |
| `pick-2x.png` | Yıldızlı parlak rozet (yazısız; "2×" kodla yazılır). |
| `pick-jet.png` | Roket top (3D oyun): klasik siyah-beyaz futbol topu, altında üç kırmızı kanatçık ve aşağı doğru turuncu-sarı alev; hafif yukarı eğik, uçuyor. |
| `pick-spring.png` | Yaylı krampon (3D oyun): tek parlak yeşil krampon, tabanının altında gümüş helezon yay; hafif zıplıyormuş gibi. |

Şimdilik bu ikisi Unity'deki 3D modellerden çizildi (`RushBuild.Icons`, `unity/DribblingRush/Builds/icons`);
ChatGPT görselleri gelince `scripts/kosu-assets.py` ile değiştirilir.

## 4. Saha ve kale

| Dosya | İçerik | Ölçü |
|---|---|---|
| `field-tile.png` | Tepeden düz görünüm, dikey olarak kesintisiz döşenebilen çim parçası: açık-koyu yeşil enine şeritler, iki kenar çizgisi, şeritleri ayıran ince çizgiler yok (kod çizer). Üst ve alt kenar birebir eşleşmeli (seamless). | 1024 × 2048, opak |
| `stand-left.png` / `stand-right.png` | Kenardaki alçak tribün dilimi, renkli yüzsüz taraftar kalabalığı, perspektifsiz düz yan görünüm, dikey tekrar edebilir. | 512 × 1024 |
| `goal.png` | Önden büyük kale (file, direkler), boş, arkadan hafif ışık; şeffaf. | 1536 × 1024 |
| `keeper.png` | Önden, iki kolu açık bekleyen kaleci, yeşil kaleci forması, yüzsüz. | 1024 |
| `ball.png` | Klasik siyah-beyaz top, tek başına (sonuç ve HUD için). | 512 |

## 5. Arayüz ve giriş

| Dosya | İçerik |
|---|---|
| `hero.png` | Oyunun ikonu / giriş görseli: topla koşan karakter, arkasında hız çizgileri ve kale, kare kompozisyon (Oyunlar sekmesi ve giriş ekranı). 1024, şeffaf. |
| `hud-distance.png` | Küçük koşu ayakkabısı ikonu (mesafe sayacı). |
| `hud-goal.png` | Küçük file + top ikonu (gol sayacı). |

## 6. Kontrol listesi (teslimden önce)

- Hepsi şeffaf (saha dilimi hariç), yazı/logo/numara yok.
- Karakter dosyalarında boy ve ayakların yere bastığı nokta aynı yerde.
- Gri rakip formaları gerçekten nötr gri (kod rengini değiştirebilsin).
- 80 px'te tanınabilir; ince detaylar yerine net siluet.
