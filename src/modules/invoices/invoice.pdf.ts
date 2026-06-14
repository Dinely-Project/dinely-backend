import PDFDocument from 'pdfkit';
import { InvoiceDetail } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  `LKR ${amount.toFixed(2)}`;

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a professional invoice PDF from an InvoiceDetail object.
 * Returns a Buffer ready for uploading to Supabase Storage or streaming to a client.
 *
 * Layout:
 *   Header   — Restaurant name + "INVOICE" label
 *   Meta     — Invoice number, order ref, date
 *   Bill To  — Customer name & email
 *   Table    — Line items (name, qty, unit price, subtotal)
 *   Total    — Grand total
 *   Footer   — Thank-you note
 */
export const generateInvoicePdf = (invoice: InvoiceDetail): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // account for left + right margins (50 each)
    const accentColor = '#1a1a2e';
    const mutedColor = '#6b7280';
    const lineColor = '#e5e7eb';

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc
      .fontSize(26)
      .fillColor(accentColor)
      .font('Helvetica-Bold')
      .text('DINELY', 50, 50);

    doc
      .fontSize(10)
      .fillColor(mutedColor)
      .font('Helvetica')
      .text('Restaurant & Dining', 50, 80);

    // "INVOICE" label — right-aligned
    doc
      .fontSize(28)
      .fillColor(accentColor)
      .font('Helvetica-Bold')
      .text('INVOICE', 0, 50, { align: 'right' });

    // Horizontal rule
    doc
      .moveTo(50, 110)
      .lineTo(50 + pageWidth, 110)
      .strokeColor(accentColor)
      .lineWidth(2)
      .stroke();

    // ── INVOICE META ──────────────────────────────────────────────────────────
    const metaTop = 130;
    doc
      .fontSize(9)
      .fillColor(mutedColor)
      .font('Helvetica')
      .text('INVOICE NUMBER', 50, metaTop)
      .text('ORDER REFERENCE', 200, metaTop)
      .text('DATE ISSUED', 380, metaTop);

    doc
      .fontSize(11)
      .fillColor(accentColor)
      .font('Helvetica-Bold')
      .text(invoice.invoice_number, 50, metaTop + 15)
      .text(`#${invoice.order_id.slice(0, 8).toUpperCase()}`, 200, metaTop + 15)
      .text(formatDate(invoice.issued_at), 380, metaTop + 15);

    // ── BILL TO ───────────────────────────────────────────────────────────────
    const billTop = 200;
    doc
      .fontSize(9)
      .fillColor(mutedColor)
      .font('Helvetica')
      .text('BILLED TO', 50, billTop);

    doc
      .fontSize(13)
      .fillColor(accentColor)
      .font('Helvetica-Bold')
      .text(invoice.customer_name, 50, billTop + 15);

    doc
      .fontSize(10)
      .fillColor(mutedColor)
      .font('Helvetica')
      .text(invoice.customer_email, 50, billTop + 32);

    // ── LINE ITEMS TABLE ──────────────────────────────────────────────────────
    const tableTop = 290;
    const col = { item: 50, qty: 310, price: 390, total: 470 };

    // Table header background
    doc
      .rect(50, tableTop, pageWidth, 24)
      .fill(accentColor);

    // Table header text
    doc
      .fontSize(9)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('ITEM', col.item + 8, tableTop + 8)
      .text('QTY', col.qty, tableTop + 8)
      .text('UNIT PRICE', col.price, tableTop + 8)
      .text('SUBTOTAL', col.total, tableTop + 8);

    // Table rows
    let rowY = tableTop + 24;
    const rowHeight = 28;

    invoice.items.forEach((item, index) => {
      const isEven = index % 2 === 0;

      // Alternating row background
      if (isEven) {
        doc.rect(50, rowY, pageWidth, rowHeight).fill('#f9fafb');
      }

      doc
        .fontSize(10)
        .fillColor(accentColor)
        .font('Helvetica')
        .text(item.name, col.item + 8, rowY + 9, { width: 250, ellipsis: true })
        .text(item.quantity.toString(), col.qty, rowY + 9)
        .text(formatCurrency(item.unit_price), col.price, rowY + 9)
        .text(formatCurrency(item.subtotal), col.total, rowY + 9);

      rowY += rowHeight;
    });

    // Bottom border of table
    doc
      .moveTo(50, rowY)
      .lineTo(50 + pageWidth, rowY)
      .strokeColor(lineColor)
      .lineWidth(1)
      .stroke();

    // ── TOTAL ROW ─────────────────────────────────────────────────────────────
    const totalY = rowY + 15;
    doc
      .fontSize(11)
      .fillColor(mutedColor)
      .font('Helvetica')
      .text('TOTAL AMOUNT', col.price - 60, totalY);

    doc
      .fontSize(16)
      .fillColor(accentColor)
      .font('Helvetica-Bold')
      .text(formatCurrency(invoice.total_amount), col.total - 10, totalY - 4);

    // ── STATUS BADGE ──────────────────────────────────────────────────────────
    const statusColors: Record<string, string> = {
      ISSUED: '#2563eb',
      PAID: '#16a34a',
      REFUNDED: '#d97706',
      VOID: '#dc2626',
    };

    const badgeColor = statusColors[invoice.status] ?? '#6b7280';
    const badgeY = totalY + 30;

    doc
      .rect(50, badgeY, 60, 18)
      .fill(badgeColor);

    doc
      .fontSize(8)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text(invoice.status, 52, badgeY + 5);

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 90;

    doc
      .moveTo(50, footerY)
      .lineTo(50 + pageWidth, footerY)
      .strokeColor(lineColor)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(10)
      .fillColor(mutedColor)
      .font('Helvetica')
      .text(
        'Thank you for dining with Dinely. We hope to see you again soon!',
        50,
        footerY + 15,
        { align: 'center', width: pageWidth }
      );

    doc
      .fontSize(8)
      .fillColor(lineColor)
      .text(
        `Generated on ${new Date().toISOString()}`,
        50,
        footerY + 35,
        { align: 'center', width: pageWidth }
      );

    doc.end();
  });
};
