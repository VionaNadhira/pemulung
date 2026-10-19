const PDFDocument = require("pdfkit");
const { getBotAddress, explorerUrl } = require("./blockchain");

function createBaseDoc() {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  return doc;
}

function drawHeader(doc, title) {
  doc.rect(0, 0, doc.page.width, 80).fill("#f0b90b");
  doc.fill("#000").fontSize(22).font("Helvetica-Bold").text(title, 50, 28);
  doc.fontSize(10).font("Helvetica").fill("#333")
    .text("BSC Transaction Report", 50, 55);
}

function drawFooter(doc, page) {
  const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : page;
  doc.fontSize(8).fill("#999").font("Helvetica")
    .text(
      `Page ${page} of ${pageCount} · Generated ${new Date().toLocaleString("id-ID")}`,
      50, doc.page.height - 40, { align: "center", width: doc.page.width - 100 }
    );
}

function sectionTitle(doc, title, y) {
  doc.fontSize(12).font("Helvetica-Bold").fill("#f0b90b").text(title, 50, y);
  doc.moveTo(50, y + 18).lineTo(doc.page.width - 50, y + 18).strokeColor("#eee").lineWidth(1).stroke();
}

function kv(doc, label, value, y) {
  doc.fontSize(9).font("Helvetica").fill("#888").text(label, 60, y, { continued: true })
    .fill("#000").font("Helvetica-Bold").text(value);
}

async function generateSendPdf({ toAddress, tokenSymbol, amount, hash, blockNumber, gasUsed, success }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = createBaseDoc();
      drawHeader(doc, "TRANSACTION RECEIPT");

      let y = 110;
      sectionTitle(doc, "Transaction Details", y);
      y += 30;
      kv(doc, "Status: ", success ? "SUCCESS ✓" : "FAILED ✗", y); y += 20;
      kv(doc, "Date: ", new Date().toLocaleString("id-ID"), y); y += 20;
      kv(doc, "Network: ", process.env.IS_TESTNET === "true" ? "BSC Testnet" : "BSC Mainnet", y); y += 30;

      sectionTitle(doc, "Transfer", y);
      y += 30;
      kv(doc, "From: ", getBotAddress(), y); y += 20;
      kv(doc, "To: ", toAddress, y); y += 20;
      kv(doc, "Amount: ", `${amount} ${tokenSymbol}`, y); y += 30;

      sectionTitle(doc, "On-Chain Proof", y);
      y += 30;
      kv(doc, "TX Hash: ", hash, y); y += 20;
      kv(doc, "Explorer: ", explorerUrl(hash, "tx"), y); y += 20;
      if (blockNumber) { kv(doc, "Block: ", `#${blockNumber}`, y); y += 20; }
      if (gasUsed) { kv(doc, "Gas Used: ", gasUsed, y); y += 20; }

      drawFooter(doc, 1);
      doc.end();
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (err) { reject(err); }
  });
}

async function generateBulkPdf({ tokenSymbol, amountPerAddress, results, successCount, failCount }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = createBaseDoc();
      drawHeader(doc, "BULK TRANSFER REPORT");

      let y = 110;
      sectionTitle(doc, "Summary", y);
      y += 30;
      kv(doc, "Date: ", new Date().toLocaleString("id-ID"), y); y += 20;
      kv(doc, "Network: ", process.env.IS_TESTNET === "true" ? "BSC Testnet" : "BSC Mainnet", y); y += 20;
      kv(doc, "Token: ", tokenSymbol, y); y += 20;
      kv(doc, "Per Address: ", `${amountPerAddress} ${tokenSymbol}`, y); y += 20;
      kv(doc, "Total Success: ", `${successCount}`, y); y += 20;
      kv(doc, "Total Failed: ", `${failCount}`, y); y += 30;

      sectionTitle(doc, "Recipients", y);
      y += 25;

      const maxRows = 40;
      const rows = results.slice(0, maxRows);
      doc.fontSize(7).font("Helvetica");

      rows.forEach((r, i) => {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
        const status = r.success ? "✓" : "✗";
        const shortTo = r.address.slice(0, 10) + "..." + r.address.slice(-6);
        const shortHash = r.hash ? r.hash.slice(0, 14) + "..." + r.hash.slice(-8) : "N/A";
        doc.fill(r.success ? "#0a0" : "#c00")
          .text(`${i + 1}. ${status} ${shortTo}`, 60, y, { continued: true })
          .fill("#555").text(`  ${shortHash}`);
        y += 14;
      });

      if (results.length > maxRows) {
        doc.fill("#999").fontSize(8).text(`... and ${results.length - maxRows} more`, 60, y);
      }

      drawFooter(doc, 1);
      doc.end();
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (err) { reject(err); }
  });
}

async function generateTxHistoryPdf({ address, txList }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = createBaseDoc();
      drawHeader(doc, "TRANSACTION HISTORY");

      let y = 110;
      sectionTitle(doc, "Wallet Info", y);
      y += 30;
      kv(doc, "Address: ", address, y); y += 20;
      kv(doc, "Explorer: ", explorerUrl(address, "address"), y); y += 20;
      kv(doc, "Total Tx: ", `${txList.length}`, y); y += 20;
      kv(doc, "Generated: ", new Date().toLocaleString("id-ID"), y); y += 30;

      sectionTitle(doc, "Transactions", y);
      y += 25;

      doc.fontSize(7).font("Helvetica");
      txList.forEach((tx, i) => {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
        const dir = tx.isOut ? "OUT" : "IN";
        const status = tx.status ? "✓" : "✗";
        const shortHash = tx.hash.slice(0, 14) + "..." + tx.hash.slice(-8);
        doc.fill(tx.isOut ? "#c60" : "#06c")
          .text(`${i + 1}. [${dir}] [${status}] ${tx.amount}`, 60, y, { continued: true })
          .fill("#555").text(`  ${shortHash}`);
        y += 14;
      });

      drawFooter(doc, 1);
      doc.end();
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (err) { reject(err); }
  });
}

module.exports = { generateSendPdf, generateBulkPdf, generateTxHistoryPdf };
