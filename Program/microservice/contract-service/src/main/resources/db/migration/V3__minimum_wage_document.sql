-- V3: source-document metadata per dated minimum wage table.
--
-- The Horeca rules page shows each loontabel's source document as a link. Stored per rate
-- row (denormalised); every row sharing an effective_from carries the same document.
-- Nullable so V3 applies cleanly to an already-seeded table, then backfilled with the
-- statutory source for existing rows. Matches the MinimumWageRate entity (ddl-auto=validate).

ALTER TABLE public.minimum_wage_rates ADD COLUMN document_name character varying(255);
ALTER TABLE public.minimum_wage_rates ADD COLUMN document_url character varying(1000);

UPDATE public.minimum_wage_rates
   SET document_name = 'Dutch statutory minimum wage (WML)',
       document_url = 'https://www.rijksoverheid.nl/onderwerpen/minimumloon'
 WHERE document_name IS NULL;
