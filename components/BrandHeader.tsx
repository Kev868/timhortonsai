import Image from "next/image";

export function BrandHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-tims-border bg-tims-surface">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/Tim_Hortons_Logo.svg.png"
            alt="Tim Hortons"
            width={1280}
            height={245}
            priority
            className="h-9 w-auto"
          />
          <div className="hidden h-6 w-px bg-tims-border sm:block" />
          <span className="hidden text-sm font-semibold tracking-tight text-tims-brown sm:inline">
            Customer Care
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-tims-ink-soft">
            Agent online
          </span>
        </div>
      </div>
    </header>
  );
}
