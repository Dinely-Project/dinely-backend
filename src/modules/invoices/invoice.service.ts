import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { Invoice, InvoiceDetail, InvoiceListItem } from '../../types';
import {
  findInvoiceById,
  findInvoiceByOrderId,
  findInvoiceDetail,
  findInvoicesByCustomer,
  insertInvoice,
  updateInvoicePdfPath,
} from './invoice.repository';
import { generateInvoicePdf } from './invoice.pdf';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL — called by order.service when order → FINISHED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an invoice record for a completed order.
 * Safe to call multiple times — the UNIQUE constraint on order_id acts as
 * idempotency guard; a duplicate insert is caught and silently ignored.
 */
export const createInvoiceForOrder = async (
  orderId: string,
  customerId: string,
  totalAmount: number
): Promise<Invoice> => {
  // Guard: if an invoice already exists for this order, return it (idempotent)
  const existing = await findInvoiceByOrderId(orderId);
  if (existing) {
    return existing;
  }

  return insertInvoice({
    order_id: orderId,
    customer_id: customerId,
    total_amount: totalAmount,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — list my invoices
// ─────────────────────────────────────────────────────────────────────────────

export const listMyInvoices = async (
  customerId: string,
  filters: { status?: string; limit: number; offset: number }
): Promise<InvoiceListItem[]> => {
  return findInvoicesByCustomer(customerId, filters);
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — get invoice by invoice ID (with ownership enforcement)
// ─────────────────────────────────────────────────────────────────────────────

export const getInvoiceDetail = async (
  invoiceId: string,
  requesterId: string,
  requesterRole: string
): Promise<InvoiceDetail> => {
  const detail = await findInvoiceDetail(invoiceId);

  if (!detail) {
    throw new Error('Invoice not found');
  }

  // Customers may only see their own invoices.
  // Return 404 (not 403) to avoid revealing the existence of other invoices.
  if (requesterRole === 'CUSTOMER' && detail.customer_id !== requesterId) {
    throw new Error('Invoice not found');
  }

  return detail;
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — get invoice by order ID (with ownership enforcement)
// ─────────────────────────────────────────────────────────────────────────────

export const getInvoiceByOrder = async (
  orderId: string,
  requesterId: string,
  requesterRole: string
): Promise<InvoiceDetail> => {
  const invoice = await findInvoiceByOrderId(orderId);

  if (!invoice) {
    throw new Error('Invoice not found for this order');
  }

  // Ownership check
  if (requesterRole === 'CUSTOMER' && invoice.customer_id !== requesterId) {
    throw new Error('Invoice not found for this order');
  }

  // Fetch full detail now that we have the id
  const detail = await findInvoiceDetail(invoice.id);
  if (!detail) {
    throw new Error('Invoice not found');
  }

  return detail;
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — download: generate PDF on first request, return signed URL always
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a time-limited signed URL for the invoice PDF.
 *
 * Strategy (Hybrid):
 *   1. If pdf_url is already stored → create a fresh signed URL from the cached path.
 *   2. If pdf_url is null → generate the PDF, upload to Supabase Storage,
 *      save the storage path in the DB, then return a signed URL.
 *
 * The signed URL expires in 1 hour (3 600 seconds).
 */
export const getInvoiceDownloadUrl = async (
  invoiceId: string,
  requesterId: string,
  requesterRole: string
): Promise<{ download_url: string; expires_in: number; invoice_number: string }> => {
  // 1. Load plain invoice row (no joins needed here)
  const invoice = await findInvoiceById(invoiceId);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // 2. Ownership check
  if (requesterRole === 'CUSTOMER' && invoice.customer_id !== requesterId) {
    throw new Error('Invoice not found');
  }

  const bucket = env.INVOICE_PDF_BUCKET;
  const storagePath = `${invoice.customer_id}/${invoice.invoice_number}.pdf`;
  const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

  // 3. If no PDF has been generated yet — generate and store it
  if (!invoice.pdf_url) {
    // Fetch full detail for PDF content
    const detail = await findInvoiceDetail(invoiceId);
    if (!detail) {
      throw new Error('Invoice not found');
    }

    // Generate PDF buffer
    const pdfBuffer = await generateInvoicePdf(detail);

    // Upload to Supabase Storage (private bucket)
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false, // never silently overwrite
      });

    if (uploadError) {
      throw new Error(`Failed to upload invoice PDF: ${uploadError.message}`);
    }

    // Persist the storage path so future requests skip re-generation
    await updateInvoicePdfPath(invoiceId, storagePath);
  }

  // 4. Generate a fresh signed URL from the stored path
  const pathToSign = invoice.pdf_url ?? storagePath;

  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(pathToSign, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${signedError?.message ?? 'Unknown error'}`);
  }

  return {
    download_url: signedData.signedUrl,
    expires_in: SIGNED_URL_EXPIRY_SECONDS,
    invoice_number: invoice.invoice_number,
  };
};
