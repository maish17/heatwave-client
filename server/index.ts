/* eslint-env node */
import express, { type Request, type Response } from "express";
import { extractUrlText } from "../src/lib/extractors/url/extract.ts"; // ← .js!

const PORT = Number(process.env.PORT) || 3301;
const app = express();

/* simple CORS for the prototype */
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

/* ---------------- main route ---------------- */
app.get("/scrape", async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing url query param" });
  }

  /* optional query flags */
  const uaParam = (req.query.ua as string | undefined)?.toLowerCase(); // ?ua=desktop
  const forceHeadless = req.query.forceHeadless === "1"; // ?forceHeadless=1

  try {
    const result = await extractUrlText(rawUrl, {
      timeoutMs: 6_000,
      maxBytes: 2_000_000,
      minLength: 200,

      /* new → only spoof UA when explicitly requested */
      userAgent:
        uaParam === "desktop"
          ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
          : undefined,

      enableHeadless: forceHeadless,
    });

    return res.json(result); // { text, tier, score, … }
  } catch (err: any) {
    console.error("scrape error:", err);

    if (err?.name === "UrlExtractError") {
      return res.status(400).json({
        code: err.code,
        message: err.message ?? "extraction failed",
      });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/* ---------------- listen ---------------- */
app.listen(PORT, () =>
  console.log(`Proxy listening → http://localhost:${PORT}/scrape?url=`)
);
