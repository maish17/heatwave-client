import process from 'node:process';
import fs from 'fs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const out = (...p: string[]) => path.join(__dirname, '../src/tests/fixtures', ...p);
const fontPath = path.join(__dirname, 'fonts/NotoSans-Regular.ttf');
const pngPath = path.join(__dirname, 'white.png');
const fontBytes = fs.readFileSync(fontPath);

async function newDoc() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  return pdf;
}

async function makeSample() {
  const pdf = await newDoc();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Hello, world', { x: 50, y: 700, size: 24, font });
  fs.writeFileSync(out('sample.pdf'), await pdf.save());
}

async function makeBlank() {
  const pdf = await newDoc();
  pdf.addPage();
  fs.writeFileSync(out('blank.pdf'), await pdf.save());
}

async function makeUnicode() {
  const pdf = await newDoc();
  const page = pdf.addPage();
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const text = 'こんにちは 👋 مرحبا שלום';
  page.drawText(text, { x: 50, y: 700, size: 18, font });
  fs.writeFileSync(out('unicode.pdf'), await pdf.save());
}

async function makeHuge() {
  const pdf = await newDoc();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 50; i++) {
    const page = pdf.addPage();
    page.drawText(`Page ${i}`, { x: 50, y: 700, size: 18, font });
  }
  fs.writeFileSync(out('huge.pdf'), await pdf.save());
}

async function makeRotated() {
  const pdf = await newDoc();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.setRotation(degrees(90));
  page.drawText('Rotated text', { x: 50, y: 50, size: 18, font });
  fs.writeFileSync(out('rotated.pdf'), await pdf.save());
}

async function makeImageOnly() {
  const pdf = await newDoc();
  const page = pdf.addPage();
  const pngBytes = fs.readFileSync(pngPath);
  const png = await pdf.embedPng(pngBytes);
  page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  fs.writeFileSync(out('image-only.pdf'), await pdf.save());
}

async function run() {
  await makeSample();
  await makeBlank();
  await makeUnicode();
  await makeHuge();
  await makeRotated();
  await makeImageOnly();
}

run().catch(e => { console.error(e); process.exit(1); });