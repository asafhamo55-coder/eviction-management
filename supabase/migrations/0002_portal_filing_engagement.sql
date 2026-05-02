-- EMS migration 0002 — tenant portal token, filing/engagement templates, attorney seeds

-- Tenant portal token: unique URL per case, used by renters who never log in.
alter table eviction_management.cases
  add column if not exists tenant_portal_token uuid not null default gen_random_uuid();
create unique index if not exists cases_tenant_portal_token_idx
  on eviction_management.cases (tenant_portal_token);

comment on column eviction_management.cases.tenant_portal_token is
  'EMS — opaque token used in /portal/[token] for tenant-facing access without login.';

-- Form template: GA Complaint for Dispossessory (file in Magistrate Court).
insert into eviction_management.form_templates (
  jurisdiction_code, type, version, fields_schema, body,
  attorney_signoff, signoff_at, effective_from
) values (
  'US-GA', 'COMPLAINT', 'GA_DISPOSSESSORY_COMPLAINT_v1',
  jsonb_build_object(
    'required', array['landlord_name','tenant_name','property_address','court_name','amount_owed_dollars','as_of_date'],
    'properties', jsonb_build_object(
      'landlord_name',   jsonb_build_object('type','string'),
      'tenant_name',     jsonb_build_object('type','string'),
      'property_address',jsonb_build_object('type','string'),
      'court_name',      jsonb_build_object('type','string'),
      'amount_owed_dollars', jsonb_build_object('type','string'),
      'as_of_date',      jsonb_build_object('type','string','format','date')
    )
  ),
  $body$DISPOSSESSORY AFFIDAVIT

In the {{court_name}}
State of Georgia

{{landlord_name}}, Plaintiff,
v.
{{tenant_name}}, Defendant.

The undersigned, being duly sworn, deposes and says:

1. Plaintiff is the owner / authorized agent of the premises located at {{property_address}}.

2. Defendant is in possession of said premises under a rental agreement and is a tenant at sufferance / holdover / in default for non-payment of rent.

3. Demand for possession was made upon Defendant in accordance with OCGA § 44-7-50, and Defendant has failed and refused to deliver possession.

4. As of {{as_of_date}}, the rent in arrears amounts to ${{amount_owed_dollars}}, exclusive of court costs.

5. Plaintiff prays that a summons issue, that Defendant be required to answer, and upon failure or upon judgment, that a writ of possession issue and that Plaintiff have judgment for past-due rent and costs.

Dated: {{today}}

________________________________
{{landlord_name}}, Plaintiff / Affiant

Sworn to and subscribed before me this _____ day of __________, 20___.

________________________________
Notary Public
$body$,
  'seed (NOT attorney-reviewed; replace before production)', now(), current_date
)
on conflict (jurisdiction_code, type, version) do nothing;

-- Form template: Engagement Letter (jurisdiction-agnostic).
insert into eviction_management.form_templates (
  jurisdiction_code, type, version, fields_schema, body,
  attorney_signoff, signoff_at, effective_from
) values (
  'US', 'ENGAGEMENT_LETTER', 'ENGAGEMENT_LETTER_v1',
  jsonb_build_object(
    'required', array['landlord_name','attorney_name','attorney_bar','scope','fee_summary','jurisdiction_code'],
    'properties', jsonb_build_object(
      'landlord_name', jsonb_build_object('type','string'),
      'attorney_name', jsonb_build_object('type','string'),
      'attorney_bar',  jsonb_build_object('type','string'),
      'scope',         jsonb_build_object('type','string'),
      'fee_summary',   jsonb_build_object('type','string'),
      'jurisdiction_code', jsonb_build_object('type','string')
    )
  ),
  $body$LIMITED-SCOPE LEGAL ENGAGEMENT LETTER

This letter confirms the engagement of {{attorney_name}} (Bar No. {{attorney_bar}}) by {{landlord_name}} ("Client") in connection with the eviction matter pending in jurisdiction {{jurisdiction_code}}.

SCOPE OF REPRESENTATION
{{scope}}

FEE ARRANGEMENT
{{fee_summary}}

NO GUARANTEE OF OUTCOME
Counsel makes no guarantee or warranty regarding the outcome of the matter.

SIGNATURES
By signing below, both parties acknowledge they have read and agreed to the terms above.

________________________________            ________________________________
{{landlord_name}}, Client                    {{attorney_name}}, Counsel

Dated: {{today}}
$body$,
  'seed (NOT attorney-reviewed; replace before production)', now(), current_date
)
on conflict (jurisdiction_code, type, version) do nothing;

-- Seed a few hand-picked Atlanta-area attorneys for the marketplace.
insert into eviction_management.attorneys (
  full_name, email, bar_id, jurisdictions, practice_areas, rates, rating, active
) values
  ('Morgan Hayes',   'morgan@hayeslaw.example',   'GA-ATL-12345',
   array['US-GA','US-GA-FULTON','US-GA-DEKALB'],
   array['eviction','landlord_tenant'],
   jsonb_build_object('flat_uncontested_dollars', 750, 'hourly_dollars', 295, 'limited_scope_appearance_dollars', 450),
   4.80, true),
  ('Priya Shah',     'priya@shahlegal.example',   'GA-ATL-67890',
   array['US-GA','US-GA-FULTON'],
   array['eviction','fair_housing'],
   jsonb_build_object('flat_uncontested_dollars', 695, 'hourly_dollars', 325, 'limited_scope_appearance_dollars', 425),
   4.70, true),
  ('Daniel Okafor',  'daniel@okaforpc.example',   'GA-ATL-22113',
   array['US-GA','US-GA-FULTON','US-GA-COBB'],
   array['eviction','collections'],
   jsonb_build_object('flat_uncontested_dollars', 825, 'hourly_dollars', 275, 'limited_scope_appearance_dollars', 475),
   4.60, true)
on conflict do nothing;
