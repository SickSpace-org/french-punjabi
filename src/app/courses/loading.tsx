function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-navy/8 ${className}`} />;
}

export default function CoursesLoading() {
  return (
    <div className="relative overflow-hidden bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SkeletonBlock className="mx-auto h-6 w-24" />
          <SkeletonBlock className="mx-auto mt-5 h-9 w-72" />
          <SkeletonBlock className="mx-auto mt-4 h-4 w-96 max-w-full" />
        </div>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-20 flex-1 sm:w-52 sm:flex-none" />
          ))}
        </div>

        <SkeletonBlock className="mt-10 h-28 w-full" />
      </div>

      <div className="mx-auto mt-14 max-w-6xl space-y-10 px-6 lg:px-10">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-80 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
