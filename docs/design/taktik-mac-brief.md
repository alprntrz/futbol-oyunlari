# Pitch Chess maç ekranı: ChatGPT brief'i

Fikir: hazırlık ekranında görünen saha, süre dolunca **tam sahaya açılır**. Bizim takım alt
yarıda, aynı formalar ve isim etiketleriyle durur. Rakip üst yarıya yürüyerek gelir; onun
oyuncuları da aynı açıdan, karşıdan görünür. Maç bu sahada oynanır: top ve oyuncular hareket
eder, goller ve kurtarışlar görünür. Kod: `mobile/src/components/taktik/MatchPitch.tsx` ve
`MatchView.tsx` (şu an yatay bir saha; bu tasarımla dikeye döner ve hazırlık ekranının
sahasıyla aynı görünüme geçer).

Görsel dil hazırlık ekranıyla aynı: açık kırık beyaz zemin, kalın dar büyük harfli
başlıklar, ince çerçeveli düz kartlar, tek kırmızı vurgu (#F43F5E), parlak gerçekçi formalar,
yüz, arma ve logo yok. Türkçe.

## Görsel 1: maç anı (ana tasarım)

> Design a mobile game screen, portrait iPhone (1320×2868), the live match view of a football
> auto-battler called Pitch Chess. Same style as its set-up screen: off-white background
> (#F2F4F2), bold condensed uppercase headings (like Barlow Condensed Black), flat cards with
> thin borders, one red accent (#F43F5E), glossy realistic football shirts, no neon, no dark
> mode, no real people, no faces, no crests, no logos, no sponsors. Turkish text. ONE screen,
> no scrolling. Top to bottom:
> (1) a scoreboard strip: my nickname "Yukifc10" on the left in a blue pill, the score
> "2 – 1" big in the middle, the opponent "anders_88" on the right in a red pill, and a small
> yellow minute badge "57'" under the score;
> (2) the hero, filling most of the screen: a FULL flat striped football pitch seen from
> above, portrait, both halves, white lines, a goal at the top and one at the bottom. My team
> (11 or fewer players) in the bottom half attacking upwards, the opponent's team in the top
> half attacking downwards, each player a glossy shirt in club colours with a white number
> and a small white name tag under it (surname, position). My players' tags have a blue
> bottom edge, the opponent's a red one, so the sides never mix up. The ball near the
> opponent's box, one of my forwards running at it, a dashed line showing a shot towards the
> top goal, the opponent's keeper diving;
> (3) under the pitch, one line: "57'  ⚽ GOL · Hauge" in a green pill;
> (4) a row of small chips for each side's tactics cards: mine on the left ("Savunma +%25"
> with a tiny bus), the opponent's on the right;
> (5) a small grey "Atla ⏩" button at the bottom.
> Clear, calm, easy to follow.

## Görsel 2: açılış (yarım sahadan tam sahaya)

> Same style. A transition frame: the set-up screen's pitch (my half, my players with their
> name tags) is sliding down and shrinking slightly as the full pitch opens above it; the
> opponent's players are walking in from the top edge into the top half; a big centred badge
> "MAÇ BAŞLIYOR" with "Yukifc10 – anders_88" under it. Portrait iPhone 1320×2868.

## Görsel 3: gol anı

> Same match screen at the moment of a goal: the ball in the top net, my scorer's name tag
> enlarged and highlighted, a bold green banner across the pitch "GOL! Hauge 57'", the score
> updated to "3 – 1", no confetti, no fireworks, just a clean flash of the banner.

## Görsel 4: maç sonu

> Same screen after full time: players back in their halves, a white result card over the
> lower pitch: "KAZANDIN" in green (or "KAYBETTİN" in red), "3 – 1", "+2 altın", my best
> player's shirt with "Maçın oyuncusu: Hauge", and a grey "Devam" button.

## Parçalar

Hazırlık ekranının parçaları (forma tabanı, forma gölgesi) burada da kullanılır
(`taktik-ekran-brief-v3.md`). Ek olarak:

| Dosya | Ne | Prompt sonu |
|---|---|---|
| `pitch-full.png` (1320×2000, opak) | Tam saha | A full flat football pitch seen straight from above, portrait, horizontal mown stripes in two greens, crisp white lines, a white goal with net at the top edge and one at the bottom edge, fills the image, no players, no ball. |
| `ball-top.png` (256×256, şeffaf) | Top | A classic black-and-white football seen from above with a soft round shadow. |

Bitince dosyaları bir klasöre koy ve söyle.
