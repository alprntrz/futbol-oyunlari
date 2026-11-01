# Taktik kartları: görsel brief

Pitch Chess'te (Taktik Tahtası) 2., 3. ve 4. aşamanın başında üç taktik kartından
biri seçiliyor (`mobile/src/components/taktik/TacticsCard.tsx`). Kartın rengi,
çerçevesi, başlığı ve açıklaması kodla çiziliyor; üstteki kare alan bu setteki
şeffaf çizimi gösterir, görsel kaydı eksikse emojiye döner. Bu brief o alanın
çizimleri içindir, ChatGPT görsel üretimi için.

## Kapsam ve değerlendirme

Teslimat, mevcut kart seçme arayüzündeki on emojinin yerine geçen on ayrı
illüstrasyondur. Kart çerçevesi, başlık, açıklama ve seçim animasyonu
`TacticsCard.tsx` içinde kalır. Görseller oyun mekaniğini değiştirmez.

İlk brief'in renk aileleri ve metaforları korunmuştur. Üretim için üç belirsizlik
giderildi: küçük ekranda ayrıntı yoğunluğu, kırpma sonrası tutarlı boşluk ve kısmi
içe aktarmada eski kartların korunması. İmza gerektiren transfer görselinde
"yazı yok" kuralıyla çelişmemek için kâğıt boş, kalem imza atmaya hazırdır.

## Teslimat ve entegrasyon

- Kaynaklar: `docs/design/taktik-card-art/originals/aug-<id>.png`; her kart ayrı,
  kare, en az 1024×1024 RGBA PNG. Hedef 1024×1024; üreticinin daha büyük kare
  çıktısı kaynak olarak korunabilir.
- Uygulama: `mobile/assets/brand/taktik/aug/aug-<id>.png`; 360×360 RGBA PNG,
  en uzun dolu kenar en fazla 320 px, merkezde ve her yönde en az 20 px boşluk.
- Üretimde kullanılan tam promptlar: `taktik-card-art/prompts.json`.
- Üretim aracı: yerleşik imagegen; renk ve şeffaflık PNG içinde korunur.

Tüm seti yüklemek için proje kökünden:

```sh
python3 scripts/taktik-card-assets.py docs/design/taktik-card-art/originals --require-all
```

Tek kart veya kısmi güncellemede `--require-all` kaldırılabilir. Betik önce tüm
girdileri doğrular; boş, tamamen opak, bozuk veya çok küçük dosyada yazma yapmaz.
Önceden yüklenen kartları korur ve mevcut dosyalarla `mobile/src/lib/brand.ts`
içindeki `TAKTIK.aug` haritasını günceller. Yüklü kartlar görsel kullanır;
henüz yüklenmeyen kartlar mevcut emojiye döner.

## Ortak prompt başı (her görselin başına ekle)

> Mobile game card illustration, casual-game style, football themed. Soft glossy
> 3D, chunky rounded shapes, thick clean silhouette, warm top-left studio light,
> gentle rim light, rich saturated colours without neon. No text, no letters, no
> numbers, no logos, no real club crests, no real people or faces of real
> players (faceless or stylised cartoon figures only). Transparent background
> PNG, 1024×1024, the scene centred with ~8% empty margin, readable at 120 px.

Kartın arka planı kodla boyanıyor (mor = taktik, yeşil = kadro, turuncu = destek),
bu yüzden çizimin arka planı şeffaf olmalı. Ana renkler kartın rengiyle uyumlu
olsun.

## Kompozisyon kuralları

- Tek, güçlü ana siluet; ikincil nesneler ana metaforu kapatmaz.
- Mor/lavanta = taktik, zümrüt/nane = kadro, turuncu/kehribar = destek.
  Toplar siyah-beyaz, küçük altın vurgular serbesttir.
- Aynı yuvarlak oyuncak malzemesi ve sol üst ışık yönü tüm sette korunur.
- Top izi, hedef halkası ve kanatlar küçük boyutta ayırt edilecek kadar kalın
  olmalıdır. İnce ağlar ve kalabalık ayrıntısı ana siluete göre ikincildir.
- Transfer kâğıdı, formalar, madeni paralar ve flamalar yazısız/armasızdır.
- Zemine ihtiyaç duyan sahnelerde yalnızca küçük saha veya tribün nesnesi
  bulunur. Tam kare zemin, kart çerçevesi, dama deseni veya dış gölge yoktur.

## Kartlar

| Dosya | Kart | Tür | Prompt sonu |
|---|---|---|---|
| `aug-gegenpress.png` | Gegenpress | Taktik (mor) | Three small faceless cartoon players in purple kits sprinting together to swarm a football, motion lines, a lightning spark above the ball. |
| `aug-bus.png` | Otobüsü çek | Taktik (mor) | A chunky purple team bus parked sideways in front of a small football goal, the ball bouncing off its side. |
| `aug-longball.png` | Uzun top | Taktik (mor) | A football flying in a long high arc across a tiny pitch, a dotted trajectory line, a target ring where it lands. |
| `aug-wings.png` | Kanat oyunu | Taktik (mor) | A football with small feathered wings flying along the side line of a tiny pitch, a corner flag below. |
| `aug-academy.png` | Altyapı | Kadro (yeşil) | A small green sprout growing out of a football, two tiny youth-team shirts on a little stand beside it. |
| `aug-signing.png` | Yıldız transferi | Kadro (yeşil) | A fountain pen poised over a blank contract paper with a gold star seal, a blank green football shirt on a hanger behind it; no writing or scribbles. |
| `aug-legend.png` | Kulüp efsanesi | Kadro (yeşil) | A golden crown resting on a folded green football shirt, small sparkles. |
| `aug-intl.png` | Milli ara | Kadro (yeşil) | A small globe with a football orbiting it, three tiny blank pennant flags in different colours (no real flags). |
| `aug-cash.png` | Kasa dolu | Destek (turuncu) | An overflowing treasure chest of gold coins with a football on top, coins spilling out. |
| `aug-crowd.png` | Seyirci desteği | Destek (turuncu) | A tiny stadium stand full of cheering faceless fans waving orange scarves, a megaphone in front. |

## Kabul ölçütleri

1. On dosyanın kimliği `AugmentId` ve yukarıdaki adlarla eşleşir; tüm kayıtlar
   Metro'nun okuyabildiği statik `require(...)` yollarıdır.
2. Gerçek alfa şeffaflığı vardır; beyaz, koyu ve kart rengi üzerinde dikdörtgen
   arka plan veya dama deseni görünmez. Otomatik alfa kontrolü, gözle kontrolün
   yerine geçmez.
3. 120 px ve dar telefonlar için 80 px önizlemede kartın ana metaforu seçilir;
   kenarlarda kesilmiş ana nesne yoktur.
4. On uygulama PNG'sinin toplam boyutu hedef olarak 2 MB'ın altında kalır.
5. Tam set ve kısmi içe aktarma, tekrar çalıştırma ve hatalı girdi davranışları
   `python3 scripts/test-taktik-card-assets.py` ile doğrulanır.
6. Mobil uygulamanın lint ve TypeScript kontrolleri çalıştırılır. Cihazda son
   kontrol: üçlü teklif, seçilen kartın büyümesi ve diğerlerinin solması.
