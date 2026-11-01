# Rozetler ve Kart Düellosu ikonu: görsel brief

Profildeki 12 rozet şu an renkli daire içinde SF Symbols ikonlarıyla çiziliyor
(`mobile/src/components/Badges.tsx`, liste `mobile/src/lib/cosmetics.ts`).
Kart Düellosu'nun Oyunlar sekmesindeki ikonu geçici olarak "takım" ikonu. Bu
brief ChatGPT görsel üretimi içindir. Çerçeveler (avatar halkaları) kodla
çiziliyor, görsel gerekmiyor.

## Ortak prompt başı (her görselin başına ekle)

> Mobile game achievement badge, casual-game style, football themed. Soft
> glossy 3D, chunky rounded shapes, thick clean silhouette, warm top-left studio
> light, gentle rim light, rich saturated colours without neon. No text, no
> letters, no numbers unless asked, no logos, no real club crests, no real
> people. Transparent background PNG, 1024×1024, single object centred with
> ~10% empty margin. Every badge sits on the same round medallion base: a thick
> rounded disc with a bevelled rim in the badge's colour.

## Rozetler

| Dosya | Rozet | Prompt sonu |
|---|---|---|
| `badge-firstGame.png` | İlk düdük | Green medallion (#22A55A) with a shiny silver referee whistle on a short lanyard. |
| `badge-allGames.png` | Çok yönlü | Blue medallion (#2F6FE4) with four small game tokens in a 2×2 grid: a football, a tic-tac-toe grid, a question mark bubble, a playing card. |
| `badge-streak7.png` | Bir hafta | Orange medallion (#F97316) with a cartoon flame and a small calendar page behind it. |
| `badge-streak30.png` | Demir adam | Deep red medallion (#DC2626) with a big blazing flame wrapped around a football. |
| `badge-level10.png` | Seviye 10 | Sky-blue medallion (#0EA5E9) with a chunky shield showing the number 10. |
| `badge-level20.png` | Seviye 20 | Purple medallion (#8B5CF6) with a chunky shield showing the number 20 and two small stars. |
| `badge-level40.png` | Efsane | Gold medallion (#E3A008) with a royal crown resting on a football, sparkles around. |
| `badge-wins10.png` | Galip | Green medallion (#16A34A) with a white football boot striking a ball, motion lines. |
| `badge-wins50.png` | Yenilmez | Dark-gold medallion (#CA8A04) with a big five-pointed star and a laurel around it. |
| `badge-trophies5.png` | Kupa avcısı | Amber medallion (#D97706) with a small gold two-handled trophy cup. |
| `badge-perfectDuel.png` | Kusursuz | Pink medallion (#DB2777) with seven small player cards fanned out, the front one glowing. |
| `badge-dailyDuel7.png` | Günün adamı | Teal medallion (#0D9488) with a calendar page and a playing card leaning on it. |

## Kart Düellosu ikonu

| Dosya | Nerede | Prompt sonu |
|---|---|---|
| `icon-duel.png` | Oyunlar sekmesi, profil XP listesi | Same style as the other game icons (`ikon-brief.md` §2), no medallion base: two football player cards facing each other at an angle like a duel, one with a red kit shirt, one with a blue kit shirt, a small lightning spark between them. |

## Teslim

Hepsini tek klasöre koy (ör. `İndirilenler/tiktako-rozet`), bana yolu yaz.
`python3 scripts/badge-assets.py <klasör>` kırpıp boyutlayıp
`mobile/assets/brand/rozet/` altına yazar, ben de kodda SF ikonlarının yerine
koyarım. Kilitli rozetler aynı görselin soluk hâli olarak gösterilir, ayrı
görsel gerekmez.
