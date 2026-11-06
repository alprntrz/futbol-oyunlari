import type { Metadata } from "next";
import Link from "next/link";
import { StatsSwitch } from "@/components/StatsSwitch";

export const metadata: Metadata = { title: "Tiktako | الخصوصية / Privacy" };

const APP_POLICY = "https://alprntrz.github.io/futbol-oyunlari/privacy.html";

export default function Privacy() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8 leading-relaxed">
      <h1 className="text-2xl font-black">سياسة خصوصية الموقع</h1>
      <p>تعمل هذه اللعبة في متصفحك بدون حساب. تبقى تفاصيل لعبتك وأسماء اللاعبين الذين تختارهم في متصفحك فقط.</p>
      <p>لتحسين اللعبة نرسل إحصاءات مجهولة الهوية إلى خدمة التحليلات PostHog (PostHog Inc.، خوادم في الولايات المتحدة، تعالجها نيابة عنا فقط): فتح الصفحة، بدء لعبة، أول تخمين، إنهاء لعبة مع عدد المربعات واللاعبين وطريقة الانتهاء (الوقت أو الزر)، هل كانت شبكة إضافية، هل وُجد اللاعب في البحث وهل كُتب بالعربية، الضغط على المشاركة أو رابط المتجر، إنشاء غرفة صديق أو الانضمام إليها وانتهاء السلسلة. يرافقها: لغة الموقع، المنطقة الزمنية، نوع الجهاز (iOS / Android / غير ذلك)، عدد الأيام منذ أول زيارة، ووسوم الحملة الإعلانية في الرابط.</p>
      <p>لا نستخدم ملفات تعريف الارتباط ولا معرّفًا محفوظًا: لكل تحميل للصفحة رقم عشوائي جديد لا يربط زياراتك ببعضها. يحفظ متصفحك تاريخ أول زيارة فقط (رقم يوم، وليس معرّفًا) لحساب عدد الأيام. لا نرسل ما تكتبه في البحث، ولا نستخرج موقعك. يصل عنوان IP تقنيًا عند الاتصال لكنه لا يُخزَّن. لا توجد على الموقع أدوات تتبّع إعلانية، ولا نتتبعك عبر مواقع أو تطبيقات أخرى، ولا نبيع بياناتك.</p>
      <p>عند اللعب مع صديق يتصل متصفحك بخادم اللعبة (Fly.io) ويرسل حركاتك وأسماء اللاعبين التي تختارها، ويراها صديقك. لا نطلب اسمًا مستعارًا ولا حسابًا. تُحذف بيانات المباراة من الذاكرة عند انتهائها، ويصل عنوان IP إلى الخادم أثناء الاتصال لكنه لا يُسجَّل.</p>
      <p>لحذف ما في متصفحك امسح بيانات هذا الموقع من إعدادات المتصفح.</p>
      <StatsSwitch />

      <h2 className="pt-6 text-2xl font-black" dir="ltr">Website privacy policy</h2>
      <div dir="ltr" className="space-y-4">
        <p>This game runs in your browser with no account. The details of your game and the players you pick stay in your browser.</p>
        <p>To improve the game we send anonymous statistics to our analytics provider PostHog (PostHog Inc., servers in the USA, processed only on our behalf): the page opening, a game starting, the first guess, a game ending with its number of squares and players and how it ended (time or button), whether it was an extra grid, whether a searched player was found and whether the search was in Arabic, taps on share or the store link, and creating, joining or finishing a friend room. With them go the site language, time zone, device type (iOS / Android / other), the number of days since your first visit and the campaign tags in the link.</p>
        <p>We use no cookies and no stored id: each page load gets a new random number that does not link your visits. Your browser keeps only the date of your first visit (a day number, not an id) to count days. What you type in the search is never sent, no location is derived. Your IP address reaches the service during the connection but is not stored. The site has no advertising trackers, we do not track you across other sites or apps, and we never sell your data.</p>
        <p>When you play a friend your browser connects to our game server (Fly.io) and sends your moves and the players you pick, which your friend sees. No nickname or account is asked for. Match data is dropped from memory when the match ends; your IP address reaches the server during the connection but is not logged.</p>
        <p>To delete what is in your browser, clear this site&apos;s data in your browser settings.</p>
      </div>

      <p className="pt-4 text-sm"><a href={APP_POLICY} className="underline">Tiktako app privacy policy</a> · <Link href="/" className="underline">Tiktako</Link></p>
    </main>
  );
}
