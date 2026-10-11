# Oyun hissi (ödül anları) görsel brief'i

Maç sonu töreni, seviye atlama ve pop-up'lar şu an SF Symbols ikonları ve
kodla çizilmiş şekillerle çalışıyor (`mobile/src/components/Victory.tsx`).
Royal Match / casual oyun havasını asıl verecek olan, bu anlardaki parlak,
hacimli ödül görselleri. Bu brief ChatGPT görsel üretimi içindir.

## Neyi değiştiriyoruz, neyi değiştirmiyoruz

- **Sadece ödül ve geçiş anları** bu stile geçiyor: zafer ekranı, seviye
  atlama, kupa, pop-up başlıkları. Oyun tahtaları, sorular, listeler sade kalır
  (okunacak yerler süslenmez).
- Renkler uygulamanın kendi paleti: **çim yeşili** zemin, **altın** ödül,
  **krem** panel. Mor/mavi Royal Match renkleri yok.
- Stil `ikon-brief.md` §2'deki "soft 3D"den bir tık daha parlak: ödül
  nesneleri hafif cilalı, kalın hatlı, oyuncak gibi.

## Ortak prompt başı (her görselin başına ekle)

> Mobile game reward art, casual-game style like Royal Match but football
> themed. Soft glossy 3D, chunky rounded shapes, thick clean silhouette, warm
> top-left studio light, gentle rim light, rich saturated colours without neon.
> No text, no letters, no numbers, no logos, no real club crests. Transparent
> background PNG, 1024×1024, single object centred with ~10% empty margin.
> Palette: pitch green #16A34A, deep green #0E5E2C, gold #F7C531, dark gold
> #B7791F, cream #FFF6DC.

## Görseller

| Dosya | Nerede | Prompt sonu |
|---|---|---|
| `laurel-gold.png` | Zafer ekranı, madalyanın iki yanı | A symmetric golden laurel wreath, open at the top, two branches meeting at the bottom with a small gold star knot, leaves thick and glossy. The centre is empty (a medal sits there). |
| `laurel-silver.png` | Kaybetme / seri bitti ekranı | Same laurel wreath in soft silver-grey, matte, less shine. |
| `medal-gold.png` | Laurelin ortası, üstüne kupa sayısı yazılıyor | A round gold medal seen from the front, thick bevelled rim, flat empty centre (space for a number), small football pentagon pattern engraved faintly on the rim. |
| `trophy-cup.png` | Kupa sayısı, ödül kartı | A small two-handled football trophy cup, gold, on a short dark-green base, a football shape on the front of the cup. |
| `ribbon-banner.png` | Panel ve pop-up başlıkları ("Maç özeti", "Seviye atladın") | A wide horizontal ribbon banner, green #22A055 with darker folded ends behind, slight 3D bend, empty centre for text. Aspect 3:1, export 1536×512. |
| `panel-frame.png` | Ödül paneli çerçevesi (9-slice) | A rounded rectangle card frame, cream inside, thick soft gold border with a subtle inner highlight, corners rounded 48px. Plain, no decoration in the middle. Export 1024×1024 so it can be stretched. |
| `reward-xp.png` | "+XP" kartı | A glowing blue-green crystal star token, chunky, game reward style. |
| `reward-series.png` | "Seri skoru" kartı | A checkered finish flag on a short pole, crossed with a football, cheerful. |
| `reward-games.png` | "Aldığın oyun" kartı | A green rosette ribbon badge with a white tick in the middle. |
| `chest-football.png` | (ileride) günlük hediye | A small treasure chest shaped like a football kit bag, closed, gold trim, green body. Also a second version with the lid open and a warm glow. |
| `bg-stars.png` | Zafer ekranı arka planı (döşeme) | A seamless tile of very faint lighter-green stars and small football shapes on pitch green #15803D, low contrast, for a subtle background pattern. Export 512×512, seamless edges, NOT transparent. |
| `level-badge.png` | Seviye rozeti (sayı üstüne yazılır) | A gold shield badge with a soft gem inset at the top, empty flat centre for a number. |

## Animasyon notları (kodla yapılacak, görsel gerekmez)

- Başlık "damga" gibi büyükten küçülerek oturur (var).
- Madalya arkasında yavaş nabız gibi parlama (var).
- Ödül kartları sırayla zıplayarak gelir, rakamlar sayarak artar (var).
- Konfeti sadece kazanınca (var).
- Butonlar alt kenarlı, basınca iner (var).

## Teslim

Çıktıları `~/Downloads/futbol-oyunlari-brand/odul/` klasörüne koy.
`scripts/brand-assets.py` diğer varlıklarda olduğu gibi kırpıp
boyutlandırır; ardından `Victory.tsx` ikonların yerine bu görselleri kullanır.
