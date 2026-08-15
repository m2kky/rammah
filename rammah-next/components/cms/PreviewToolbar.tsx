"use client";

export function PreviewToolbar({ publicUrl }: { publicUrl: string }) {
  const exit = async () => {
    await fetch("/cms-preview", { method: "DELETE" });
    window.location.assign(publicUrl);
  };
  return <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3 bg-black px-4 py-3 font-inter text-xs text-white shadow-2xl"><span>Draft preview</span><button type="button" onClick={() => void exit()} className="bg-white px-3 py-1.5 font-semibold text-black">Exit preview</button></div>;
}
