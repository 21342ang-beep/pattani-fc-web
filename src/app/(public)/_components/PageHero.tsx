export default function PageHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-gradient-to-br from-green-900 via-green-800 to-green-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm text-green-100 md:text-base">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
