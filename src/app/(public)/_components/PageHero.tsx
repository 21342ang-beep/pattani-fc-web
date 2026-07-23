export default function PageHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-gradient-to-br from-green-900 via-green-800 to-green-950 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16 lg:py-20">
        <h1 className="text-4xl font-black tracking-tight md:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-green-100 md:text-xl lg:text-2xl">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
