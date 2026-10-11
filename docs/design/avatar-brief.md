# Avatar seti: profil avatarları

Profilde şu an renkli daire + takma adın baş harfi var (`mobile/src/lib/avatar.ts`,
`c1`…`c12`). Bu brief onların yerine geçecek 3D avatarları üretir. Her avatar bir
renk kimliğine (`c1`…`c12`) karşılık gelir, böylece mevcut seçimler bozulmaz.

Kullanıcı fotoğrafı yükleme yok (Apple 1.2 denetim yükü): sadece bu hazır set.

## Nasıl üretilir

1. Önceki ikon setleriyle **aynı sohbette** devam et ya da `ikon2` klasöründen 3-4
   ikonu referans olarak yükleyip "birebir aynı stil" de.
2. Her biri **1024×1024, şeffaf arka plan**, karakter ortada, büst (omuzdan yukarı),
   ~%8 boşluk. Daire içinde gösterilecek, o yüzden kafa merkezde olsun.
3. Hepsini `~/Downloads/futbol-oyunlari-brand/avatar/` klasörüne koy.

## Ortak prompt başı

```
Same style as the reference icons: soft 3D, rounded friendly shapes, matte finish,
subtle soft shadow, gentle highlights, light from the top left, same camera.
A cute stylised football character bust (head and shoulders), facing the viewer,
friendly confident expression, simple shapes, readable at 40px inside a circle.
Centred, transparent background, 1024x1024, about 8% empty margin.
No text, no letters, no numbers on shirts, no logos, no real club crests, not a real person.
```

## Avatarlar

| Dosya | Kimlik | Prompt sonu |
|---|---|---|
| `avatar-c1.png` | c1 yeşil | A striker with short dark hair in a plain grass green #16A34A shirt. |
| `avatar-c2.png` | c2 mavi | A goalkeeper with gloves raised by the face, blue #2563EB jersey. |
| `avatar-c3.png` | c3 mercan | A winger with curly hair and a headband, coral #F43F5E shirt. |
| `avatar-c4.png` | c4 amber | A captain with a beard and an armband, amber #F59E0B shirt. |
| `avatar-c5.png` | c5 mor | A playmaker with a ponytail, purple #7C3AED shirt. |
| `avatar-c6.png` | c6 lacivert | A coach in a dark ink #0B1220 jacket with a gold whistle. |
| `avatar-c7.png` | c7 gök mavisi | A young fan with a scarf, sky blue #0EA5E9 hoodie. |
| `avatar-c8.png` | c8 açık yeşil | A football with a happy face and small arms (mascot), light green #DCFCE7 background ring. |
| `avatar-c9.png` | c9 sarı | A referee with a yellow card raised, pale yellow #FDE68A shirt. |
| `avatar-c10.png` | c10 pembe | A defender with braids, rose #FFE4E6 and red shirt. |
| `avatar-c11.png` | c11 lavanta | A commentator with a headset microphone, lavender #E0E7FF jacket. |
| `avatar-c12.png` | c12 koyu yeşil | A golden trophy with a friendly face (mascot), dark green #14532D ring. |

Ek olarak sekme ikonu (diğer sekme ikonlarıyla aynı düz şablon stilinde):

| Dosya | Kullanım | Prompt sonu |
|---|---|---|
| `tab-profile.png` | Profil sekmesi | A simple flat silhouette of a person bust inside a circle, single colour, for a tab bar. |

## Teslim

Klasör hazır olunca bana söyle; avatarlar `scripts/normalize-icons.py` ile aynı
boyuta getirilip `AVATARS` listesine bağlanır (renk çemberi arka plan olarak kalır).
