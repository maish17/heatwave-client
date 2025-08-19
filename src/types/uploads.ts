export type UploadData =
  | { source: "drop" | "dialog"; file: File }
  | { source: "paste"; url: string }
  | { source: "paste"; text: string };
