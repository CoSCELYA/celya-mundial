import { LogoBrand } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="festive-bg flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <LogoBrand className="h-12 w-auto" />
        <p className="text-sm font-medium text-white/70">
          Polla Mundialista · Mundial 2026
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-white/40">© {new Date().getFullYear()} celya</p>
    </div>
  );
}
