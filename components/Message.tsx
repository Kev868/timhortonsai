type Role = "agent" | "user";

export function Message({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  if (role === "agent") {
    return (
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tims-red text-base font-extrabold text-white shadow-sm"
        >
          T
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-tims-border bg-tims-surface px-4 py-3 text-[15px] leading-relaxed text-tims-ink shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-tims-brown px-4 py-3 text-[15px] leading-relaxed text-tims-cream shadow-sm">
        {children}
      </div>
    </div>
  );
}
