import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0C0A] text-[#FAF6F0] p-6 text-center space-y-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
        Grand Estates 3D
      </div>
      <h1 className="text-2xl font-bold">Board Space Not Found</h1>
      <p className="text-xs text-stone-400 max-w-md">
        The requested route does not exist on the Grand Estates board.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0F0C0A] text-xs font-bold hover:bg-[#e5c247] transition-colors"
      >
        Return to Grand Estates Table
      </Link>
    </div>
  );
}
