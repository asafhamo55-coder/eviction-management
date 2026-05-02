-- Seed: Georgia / Fulton County / Non-Payment grounds
-- Sources cited inline. Always verify against current OCGA before relying.

insert into eviction_management.jurisdiction_rules (
  jurisdiction_code, rule_type, grounds, tenancy_types, payload,
  statute_citation, source_url, verified_by, verified_at
) values
-- Demand for possession (no statutory waiting period; "immediately")
('US-GA', 'NOTICE_PERIOD',
 array['NON_PAYMENT']::eviction_management.grounds[],
 array['WRITTEN_LEASE','M2M']::eviction_management.tenancy_type[],
 jsonb_build_object(
   'duration_days', 0,
   'exclude_weekends', false,
   'exclude_court_holidays', false,
   'delivery_methods', array['PERSONAL','POST_AND_MAIL','CERTIFIED_MAIL'],
   'must_state_amount_owed', true,
   'form_template_type', 'NOTICE',
   'form_template_name', 'GA_DEMAND_FOR_POSSESSION_v1'
 ),
 'OCGA § 44-7-50',
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-50/',
 'seed', now()),

-- Tenant answer period: 7 days from service of summons
('US-GA', 'ANSWER_PERIOD',
 array['NON_PAYMENT']::eviction_management.grounds[],
 array['WRITTEN_LEASE','M2M']::eviction_management.tenancy_type[],
 jsonb_build_object(
   'duration_days', 7,
   'exclude_weekends', false,
   'starts_from', 'SERVICE_OF_SUMMONS'
 ),
 'OCGA § 44-7-51',
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-51/',
 'seed', now()),

-- Court venue: Magistrate Court of the county where the property sits
('US-GA-FULTON', 'COURT_VENUE',
 array['NON_PAYMENT']::eviction_management.grounds[],
 array['WRITTEN_LEASE','M2M']::eviction_management.tenancy_type[],
 jsonb_build_object(
   'court_name', 'Magistrate Court of Fulton County',
   'court_address', '185 Central Ave SW, Atlanta, GA 30303',
   'efile_provider', 'odyssey',
   'efile_supported', true
 ),
 'OCGA § 44-7-50; Fulton County Magistrate Local Rules',
 'https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/magistrate-court',
 'seed', now()),

-- Filing fee for dispossessory in Fulton (verify each year — fees drift)
('US-GA-FULTON', 'FEE',
 array['NON_PAYMENT']::eviction_management.grounds[],
 array['WRITTEN_LEASE','M2M']::eviction_management.tenancy_type[],
 jsonb_build_object(
   'fee_type', 'FILING_DISPOSSESSORY',
   'fee_cents', 8000,
   'pay_to', 'Fulton County Magistrate Court',
   'note', 'Verify current fee on court website before filing.'
 ),
 'Fulton County Magistrate Court Fee Schedule',
 'https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/magistrate-court',
 'seed', now()),

-- Service: tacking + mailing permitted under OCGA § 44-7-51 if personal fails
('US-GA', 'SERVICE_METHOD',
 array['NON_PAYMENT']::eviction_management.grounds[],
 array['WRITTEN_LEASE','M2M']::eviction_management.tenancy_type[],
 jsonb_build_object(
   'allowed_methods', array['PERSONAL','POST_AND_MAIL'],
   'tack_and_mail_permitted', true,
   'note', 'Personal service preferred; tack-and-mail allowed if reasonable diligence fails.'
 ),
 'OCGA § 44-7-51',
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-51/',
 'seed', now()),

-- Writ of possession: 7-day waiting period after judgment before writ executes
('US-GA', 'WRIT_WAIT',
 array['NON_PAYMENT']::eviction_management.grounds[],
 array['WRITTEN_LEASE','M2M']::eviction_management.tenancy_type[],
 jsonb_build_object(
   'duration_days', 7,
   'starts_from', 'JUDGMENT_FOR_LANDLORD'
 ),
 'OCGA § 44-7-55',
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-55/',
 'seed', now());

-- Form template: Georgia Demand for Possession (Non-Payment)
insert into eviction_management.form_templates (
  jurisdiction_code, type, version, fields_schema, body,
  attorney_signoff, signoff_at, effective_from
) values (
  'US-GA', 'NOTICE', 'GA_DEMAND_FOR_POSSESSION_v1',
  jsonb_build_object(
    'required', array['landlord_name','tenant_name','property_address','amount_owed_cents','as_of_date'],
    'properties', jsonb_build_object(
      'landlord_name',   jsonb_build_object('type','string'),
      'tenant_name',     jsonb_build_object('type','string'),
      'property_address',jsonb_build_object('type','string'),
      'amount_owed_cents',jsonb_build_object('type','integer'),
      'as_of_date',      jsonb_build_object('type','string','format','date')
    )
  ),
  $body$DEMAND FOR POSSESSION

To: {{tenant_name}}
Property: {{property_address}}

You are hereby notified that you are in default of your rental agreement for non-payment of rent. The amount due as of {{as_of_date}} is ${{amount_owed_dollars}}.

Pursuant to OCGA § 44-7-50, demand is hereby made that you immediately pay the amount due or deliver possession of the premises to the undersigned. Failure to do so will result in dispossessory proceedings being filed in the Magistrate Court of Fulton County.

Dated: {{today}}

________________________________
{{landlord_name}}, Landlord
$body$,
  'seed (NOT attorney-reviewed; replace before production)', now(), current_date
);
