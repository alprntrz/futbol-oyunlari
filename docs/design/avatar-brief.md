# Avatar seti (v2): profil avatarları

Profilde şu an renkli daire + takma adın baş harfi var (`mobile/src/lib/avatar.ts`,
`c1`…`c12`). Bu set onların yerine geçer ve 16 avatara çıkar. Kullanıcı fotoğrafı
yükleme yok (Apple 1.2): sadece bu hazır set.

## Ünlü futbolcular hakkında

Gerçek bir futbolcunun yüzü, adı ya da forması **kullanılmaz**. Bir kişinin görünüşünü
izinsiz ürün içinde kullanmak "kişilik hakkı" ihlalidir; Apple (5.2.1, 5.2.2) bu yüzden
uygulamayı reddedebilir ya da oyuncunun temsilcisi kaldırtabilir. Onun yerine
**efsane arketipleri** var: bir dönemin, bir mevkinin, bir futbol kültürünün ikonik
görünümü (saç stili, gol sevinci, aksesuar). Kimseyi taklit etmeden "o havayı" verir.
Prompt'lara gerçek isim yazma; ChatGPT bir kişiye fazla benzetirse o avatarı yeniden ürettir.

## Nasıl üretilir

1. Önceki ikon setleriyle **aynı sohbette** devam et ya da `ikon2` klasöründen 3-4
   ikonu referans olarak yükleyip "birebir aynı stil" de.
2. Her biri **1024×1024, şeffaf arka plan**, büst (omuzdan yukarı), kafa ortada,
   ~%8 boşluk. Daire içinde ~40 px'te de okunmalı.
3. Hepsini `~/Downloads/futbol-oyunlari-brand/avatar2/` klasörüne koy.

## Ortak prompt başı

```
Same style as the reference icons: soft 3D, rounded friendly shapes, matte finish,
subtle soft shadow, gentle highlights, light from the top left, same camera.
A cute stylised football character bust (head and shoulders), facing the viewer,
friendly confident expression, big simple shapes, readable at 40px inside a circle.
Centred, transparent background, 1024x1024, about 8% empty margin.
This is an original cartoon character, not a real person: do not resemble any real
footballer or celebrity. No text, no letters, no numbers, no logos, no club crests,
no real kits (plain shirt colours only).
```

## Klasik karakterler (8)

| Dosya | Prompt sonu |
|---|---|
| `avatar-striker.png` | A young striker with short dark hair, plain grass green #16A34A shirt, winking. |
| `avatar-keeper.png` | A goalkeeper with big padded gloves raised by the face, plain blue #2563EB jersey. |
| `avatar-captain.png` | A bearded captain with a plain amber #F59E0B armband, plain white shirt, proud smile. |
| `avatar-playmaker.png` | A playmaker with a ponytail and a headband, plain purple #7C3AED shirt. |
| `avatar-coach.png` | A coach in a dark ink #0B1220 jacket with a gold whistle, arms crossed. |
| `avatar-fan.png` | A happy fan with a knitted scarf and a bobble hat, plain coral #F43F5E colours. |
| `avatar-referee.png` | A referee holding up a plain yellow card, plain black shirt, stern but friendly. |
| `avatar-ball.png` | A football mascot with a happy face, small arms and sneakers. |

## Efsane arketipleri (8)

| Dosya | Arketip | Prompt sonu |
|---|---|---|
| `avatar-legend-curls.png` | 70'lerin uzun kıvırcık saçlı on numarası | A 1970s-style playmaker with big curly hair and a thin headband, plain white retro collar shirt. |
| `avatar-legend-mohawk.png` | 2000'lerin jöleli mohawk'lı golcüsü | A 2000s-style winger with a spiky gelled mohawk, plain red shirt, cheeky grin. |
| `avatar-legend-bun.png` | Topuz saçlı modern forvet | A modern forward with a man-bun and a short beard, plain sky blue #0EA5E9 shirt. |
| `avatar-legend-bald.png` | Kel, sert bakışlı efsane defans | A bald, tough-looking central defender, plain dark green #14532D shirt, determined look. |
| `avatar-legend-braids.png` | Örgü saçlı hızlı kanat | A fast winger with long braids tied back, plain yellow #FDE68A shirt, big smile. |
| `avatar-legend-shades.png` | Güneş gözlüklü, karizmatik teknik direktör | A charismatic manager with slicked-back grey hair, sunglasses and a long dark coat collar. |
| `avatar-legend-celebration.png` | Kollarını açıp gol sevinci yapan forvet | A striker celebrating a goal with arms wide open, mouth open in a shout, plain orange shirt. |
| `avatar-legend-retro-keeper.png` | 80'lerin bıyıklı, kasketli kalecisi | A 1980s goalkeeper with a big moustache and a flat cap, plain grey retro jersey. |

## Teslim

Klasör hazır olunca bana söyle; avatarlar `scripts/normalize-icons.py` ile aynı
boyuta getirilip `AVATARS` listesine bağlanır (mevcut renk seçimleri en yakın
karaktere eşlenir, kimsenin avatarı boş kalmaz).
