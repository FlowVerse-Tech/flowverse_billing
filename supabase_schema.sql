-- ==========================================================================
-- Flowverse GST Billing - Supabase PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==========================================================================

-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_date VARCHAR(50) NOT NULL,
    due_date VARCHAR(50) NOT NULL,
    billed_to_name VARCHAR(255) NOT NULL,
    billed_to_address TEXT,
    billed_to_gstin VARCHAR(50),
    billed_to_pan VARCHAR(50),
    place_of_supply VARCHAR(100),
    country_of_supply VARCHAR(100) DEFAULT 'India',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_in_words TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_index INT NOT NULL DEFAULT 1,
    product_id VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    hsn VARCHAR(20) NOT NULL DEFAULT '9983',
    qty NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create Products / Catalog Table (for reusable items with unique product codes)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hsn VARCHAR(20) NOT NULL DEFAULT '9983',
    default_taxable_amount NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create Invoice Sequence Table for Auto-Incrementing Counter
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    id INT PRIMARY KEY DEFAULT 1,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Initialize sequence row if not exists
INSERT INTO public.invoice_sequences (id, last_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Function to atomically fetch & increment the next invoice number (zero-padded e.g. '001', '002')
CREATE OR REPLACE FUNCTION public.get_next_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    next_num INT;
BEGIN
    UPDATE public.invoice_sequences
    SET last_number = last_number + 1,
        updated_at = NOW()
    WHERE id = 1
    RETURNING last_number INTO next_num;

    RETURN LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Enable Row Level Security (RLS) & Public Policies for Web Client
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the web billing portal
CREATE POLICY "Allow public read invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Allow public insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update invoices" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Allow public delete invoices" ON public.invoices FOR DELETE USING (true);

CREATE POLICY "Allow public read invoice_items" ON public.invoice_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete invoice_items" ON public.invoice_items FOR DELETE USING (true);

CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert products" ON public.products FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read sequence" ON public.invoice_sequences FOR SELECT USING (true);
CREATE POLICY "Allow public update sequence" ON public.invoice_sequences FOR UPDATE USING (true);

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON public.invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
