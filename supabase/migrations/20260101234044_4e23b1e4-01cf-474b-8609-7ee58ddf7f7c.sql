-- Phase 1: Add user_id columns to tables missing them + create storage bucket

-- 1. Add user_id to legal_documents
ALTER TABLE public.legal_documents 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own legal documents"
ON public.legal_documents
FOR ALL
USING (auth.uid() = user_id);

-- 2. Add user_id to legal_clauses
ALTER TABLE public.legal_clauses 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.legal_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own legal clauses"
ON public.legal_clauses
FOR ALL
USING (auth.uid() = user_id);

-- 3. Add user_id to legal_clause_links
ALTER TABLE public.legal_clause_links 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.legal_clause_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own legal clause links"
ON public.legal_clause_links
FOR ALL
USING (auth.uid() = user_id);

-- 4. Add user_id to agreements
ALTER TABLE public.agreements 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agreements"
ON public.agreements
FOR ALL
USING (auth.uid() = user_id);

-- 5. Add user_id to agreement_items
ALTER TABLE public.agreement_items 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.agreement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agreement items"
ON public.agreement_items
FOR ALL
USING (auth.uid() = user_id);

-- 6. Add user_id to agreement_item_links
ALTER TABLE public.agreement_item_links 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.agreement_item_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agreement item links"
ON public.agreement_item_links
FOR ALL
USING (auth.uid() = user_id);

-- 7. Add user_id to agreement_parties
ALTER TABLE public.agreement_parties 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.agreement_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agreement parties"
ON public.agreement_parties
FOR ALL
USING (auth.uid() = user_id);

-- 8. Add user_id to assistant_sessions
ALTER TABLE public.assistant_sessions 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assistant sessions"
ON public.assistant_sessions
FOR ALL
USING (auth.uid() = user_id);

-- 9. Add user_id to assistant_messages
ALTER TABLE public.assistant_messages 
ADD COLUMN user_id uuid DEFAULT auth.uid();

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assistant messages"
ON public.assistant_messages
FOR ALL
USING (auth.uid() = user_id);

-- 10. Create storage bucket for legal documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false);

-- 11. Storage policies - users can upload to their own folder
CREATE POLICY "Users can upload their own legal documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'legal-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 12. Users can view their own documents
CREATE POLICY "Users can view their own legal documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'legal-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 13. Users can update their own documents
CREATE POLICY "Users can update their own legal documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'legal-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 14. Users can delete their own documents
CREATE POLICY "Users can delete their own legal documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'legal-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);