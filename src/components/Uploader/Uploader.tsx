import Dropzone from "./Dropzone";
import Progress from "./Progress";
import ResultPanel from "./ResultPanel";
import { useUpload } from "./useUpload";

const Uploader = () => {
  const { phase, upload, result, error, reset } = useUpload();

  return (
    <main className="bg-neutral-light flex flex-col items-center justify-center min-h-screen p-6">
      {phase === "idle" && <Dropzone onUpload={upload} error={error} />}
      {phase === "loading" && <Progress />}
      {phase === "done" && result && (
        <>
          <ResultPanel res={result} />
          <button
            className="mt-6 px-4 py-2 rounded bg-brand text-white font-hyper"
            onClick={reset}
          >
            Upload another
          </button>
        </>
      )}
      {phase === "error" && (
        <div className="text-error text-center">
          <p>{error}</p>
          <button className="underline mt-2" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </main>
  );
};

export default Uploader;
