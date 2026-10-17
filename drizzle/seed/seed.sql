-- DEMO SEED: Lopez Dental (labelled demo). Idempotent. Run after migrations: bun run db:seed:local
-- One permanent product link per product (kind=product). Customer name/email are collected per visit.

INSERT OR REPLACE INTO brand (id,name,about,voice,voice_notes,words_to_avoid,default_language,logo_key,website,audience,facts,created_at,updated_at) VALUES
('default','Lopez Dental','Family dental clinic in Austin. Gentle care, no-rush appointments, modern equipment.','warm','Friendly and plain-spoken. Sounds like a neighbour recommending a dentist.','painless, best in town, cheap','en',NULL,'https://lopezdental.example','Families and working adults who want a calm dental visit.','Open Saturdays.
Same-day emergency slots when possible.
Hygienists stay with you the whole cleaning.',1760000000000,1760000000000);

INSERT OR REPLACE INTO products (id,brand_id,name,category,knowledge,avoid,url,audience,experience,praise,concerns,active,created_at,updated_at) VALUES
('prod-cleaning','default','Teeth cleaning','Dental','45-minute cleaning by a hygienist, then Dr. Lopez checks in. Ultrasonic scaler, fluoride optional. Appointments are unhurried.','Pricing, insurance, medical claims.','','People who want a thorough cleaning without feeling rushed.','Check-in
Cleaning
Quick dentist check
Checkout','Gentle cleaning
Clear explanations
Friendly staff','Long wait
Felt rushed
Unclear costs',1,1760000000000,1760000000000),
('prod-whitening','default','Whitening','Cosmetic','In-office whitening in about an hour, with a take-home touch-up tray. Sensitivity can happen for a day or two; staff explain this beforehand.','Guaranteed shade results, pricing.','','Adults who want a brighter smile for an event or everyday confidence.','Consult
Whitening session
Aftercare tips','Visible results
Staff prepared me for sensitivity
Felt comfortable','Sensitivity afterward
Took longer than expected',1,1760000000000,1760000000000),
('prod-checkup','default','Check-up','Dental','Routine exam with X-rays when needed, a clear walk-through of findings and a plan for any follow-up work.','Diagnoses, pricing, insurance.','','Patients who want a straightforward report on their oral health.','Exam
X-rays if needed
Findings walk-through','Clear explanations
No pressure for extra work
Clean office','Felt rushed
Unclear next steps',1,1760000000000,1760000000000);

INSERT OR REPLACE INTO highlights (id,product_id,label,polarity,sort,label_ja) VALUES
('hl-cl-1','prod-cleaning','Friendly staff','pos',0,'親切なスタッフ'),
('hl-cl-2','prod-cleaning','Clear explanations','pos',1,'分かりやすい説明'),
('hl-cl-3','prod-cleaning','Short wait','pos',2,'待ち時間が短い'),
('hl-cl-4','prod-cleaning','Gentle cleaning','pos',3,'丁寧なクリーニング'),
('hl-cl-5','prod-cleaning','Clean office','both',4,'清潔なクリニック'),
('hl-cl-6','prod-cleaning','Long wait','neg',5,'待ち時間が長い'),
('hl-cl-7','prod-cleaning','Felt rushed','neg',6,'急かされた'),
('hl-cl-8','prod-cleaning','Unclear costs','neg',7,'費用が分かりにくい'),
('hl-wh-1','prod-whitening','Friendly staff','pos',0,'親切なスタッフ'),
('hl-wh-2','prod-whitening','Clear explanations','pos',1,'分かりやすい説明'),
('hl-wh-3','prod-whitening','Visible results','pos',2,'効果が分かりやすい'),
('hl-wh-4','prod-whitening','Felt comfortable','pos',3,'リラックスできた'),
('hl-wh-5','prod-whitening','Clean office','both',4,'清潔なクリニック'),
('hl-wh-6','prod-whitening','Sensitivity afterward','neg',5,'施術後のしみる感じ'),
('hl-wh-7','prod-whitening','Took longer','neg',6,'予定より時間がかかった'),
('hl-wh-8','prod-whitening','Unclear costs','neg',7,'費用が分かりにくい'),
('hl-ck-1','prod-checkup','Friendly staff','pos',0,'親切なスタッフ'),
('hl-ck-2','prod-checkup','Clear explanations','pos',1,'分かりやすい説明'),
('hl-ck-3','prod-checkup','Short wait','pos',2,'待ち時間が短い'),
('hl-ck-4','prod-checkup','No pressure','pos',3,'無理な勧誘がない'),
('hl-ck-5','prod-checkup','Clean office','both',4,'清潔なクリニック'),
('hl-ck-6','prod-checkup','Long wait','neg',5,'待ち時間が長い'),
('hl-ck-7','prod-checkup','Felt rushed','neg',6,'急かされた'),
('hl-ck-8','prod-checkup','Unclear next steps','neg',7,'次のステップが不明');

INSERT OR REPLACE INTO portals (id,brand_id,type,label,url,allows_incentives,is_default,sort) VALUES
('portal-google','default','google','Google','https://g.page/r/lopez-dental-demo/review',0,1,0),
('portal-trustpilot','default','trustpilot','Trustpilot','https://www.trustpilot.com/review/lopezdental.example',0,1,1),
('portal-website','default','custom','Our website','https://lopezdental.example/reviews',1,1,2);

INSERT OR REPLACE INTO reward (id,enabled,title,description,kind,value) VALUES
('default',1,'15% off your next visit','A thank-you for taking the time. It does not depend on what you wrote or how many stars you gave.','code','THANKS15');

INSERT OR REPLACE INTO settings (id,model,temperature,max_tokens,system_prompt_extra,languages,focus_brand_id,provider) VALUES
('default','openai/gpt-4o-mini',0.7,400,'','["en","ja"]','','');

-- Permanent product links (one per product). Open /r/<token> for a fresh visit each time.
INSERT OR REPLACE INTO links (id,brand_id,token,product_id,customer_name,language,visit_notes,kind,status,portal_id,created_at,opened_at,copied_at) VALUES
('link-cleaning','default','demo241abc','prod-cleaning','','en','','product','created',NULL,1760000000000,NULL,NULL),
('link-whitening','default','demo242def','prod-whitening','','en','','product','created',NULL,1760000000000,NULL,NULL),
('link-checkup','default','demo243ghi','prod-checkup','','en','','product','created',NULL,1760000000000,NULL,NULL);
