const Progress = () => (
  <div className="flex flex-col items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand border-t-transparent" />
    <p className="mt-4 text-brand font-hyper">Extracting…</p>
  </div>
);
export default Progress;
