import { initials } from "@/lib/sheet";
import { reviewCopy } from "@/lib/i18n/review";
import type { Lang } from "@/lib/i18n/languages";
import s from "./review.module.css";

export function Inactive({ brand, lang }: { brand: string; lang: Lang }) {
  const t = reviewCopy(lang);
  return (
    <div className={s.page} lang={lang}>
      {brand ? (
        <div className={s.brand}>
          <span className={s.mark} aria-hidden="true">{initials(brand)}</span>
          {brand}
        </div>
      ) : null}
      <section className={s.inactive} aria-labelledby="in-l">
        <h1 id="in-l" className={s.h1}>{t.inactiveTitle}</h1>
        <p className={s.lede}>{t.inactiveBody(brand || t.inactiveBrandFallback)}</p>
      </section>
      <footer className={s.foot}>
        <span>{t.footer}</span>
      </footer>
    </div>
  );
}
