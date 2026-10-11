/** Build peramban pdfkit (UMD, sudah termasuk polyfill Buffer) - dipakai Product Comparison (unduhPdf.ts). */
declare module 'pdfkit/js/pdfkit.standalone.js' {
  const PDFDocument: unknown;
  export default PDFDocument;
}
