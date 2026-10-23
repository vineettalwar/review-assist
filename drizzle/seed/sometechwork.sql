-- DEMO SEED: Some Tech Work (tech agency test client). Idempotent. Runs with: bun run db:seed:local
-- Facts come from https://sometech.work. created_at is older than Lopez Dental so the admin opens on this brand.
-- Demo product links: /r/stwdemo001 (relaunch) · stwdemo002 (care plan) · stwdemo003 (fractional CTO) · stwdemo004 (AI & automation)

INSERT OR REPLACE INTO brand (id,name,about,voice,voice_notes,words_to_avoid,default_language,logo_key,website,audience,facts,created_at,updated_at) VALUES
('stw','Some Tech Work','Tech partner for live B2B WordPress sites. Builds, relaunches and runs the website, then stays on as fractional CTO / TechOps for development, maintenance and publishing.','professional','Calm, practical and specific. Sounds like a marketing lead recommending a dependable tech partner, not like an advert.','rockstar, ninja, world-class, cheap, guaranteed','en',NULL,'https://sometech.work','Content-led B2B organisations whose WordPress site affects revenue and operations: marketing teams, startups, media and professional services.','Speaking at WordPress conferences since 2016, with 20 WordCamp talks.
Replies to every brief within one business day.
The same team stays on after launch for running, staffing and training.',1750000000000,1750000000000);

INSERT OR REPLACE INTO products (id,brand_id,name,category,knowledge,avoid,url,audience,experience,praise,concerns,active,created_at,updated_at) VALUES
('stw-relaunch','stw','WordPress relaunch','Web development','Custom WordPress builds, relaunches and multilingual sites. Before design starts, the team inventories URLs, rankings, content, forms, consent, analytics and integrations. Design and development ship in short releases reviewed every week. Redirects, forms and tracking are tested before the switch. Afterwards the marketing team publishes without opening a ticket.','Pricing, guaranteed rankings or traffic numbers, other client names or NDA projects.','https://sometech.work','Marketing teams relaunching a WordPress site that brings in leads.','Week 1 audit
Weekly build reviews
Launch day checks
Editor training','Rankings kept after launch
Weekly progress reviews
Editors publish without tickets','Timeline slipped
Unclear scope
Launch-day issues',1,1750000000000,1750000000000),
('stw-care','stw','Website care plan','Maintenance','One monthly maintenance plan covering updates, backups, security, uptime monitoring and fixes. When taking over from another agency, the team checks company access, takes a restorable backup, maps the current setup and plans the handover, without making a rebuild the default.','Pricing, response-time guarantees, other client names.','https://sometech.work','Companies whose live WordPress site needs someone responsible for running it.','Access check and backup
Handover plan
Monthly updates and monitoring
Fixes on request','Smooth handover
Reliable backups
Problems fixed quickly','Slow response
Unclear reporting',1,1750000000001,1750000000000),
('stw-cto','stw','Fractional CTO & TechOps','Technology leadership','Fractional CTO and TechOps support after the site is running: development, maintenance and publishing, plus audits, vendor decisions and roadmaps. The team can add WordPress developers to your sprint and train your editors so you need them less.','Pricing, other client names or NDA projects.','https://sometech.work','B2B teams whose website work crosses several suppliers and internal teams.','Audit
Roadmap and vendor decisions
Ongoing development and publishing
Team training','Honest technical advice
Clear roadmap
Easy to work with','Hard to reach
Too technical',1,1750000000002,1750000000000),
('stw-ai','stw','AI & automation','Automation','Connects the website contact form to the CRM and systems the team already uses, and handles failed transfers visibly. Automation starts with one repeated workflow and a result you can measure. Also builds chatbots and agents.','Pricing, promises of specific savings, other client names.','https://sometech.work','Teams where leads, reports or follow-up still depend on manual work after the contact form.','Pick one repeated workflow
Connect the systems
Measure the result','Saved manual work
Leads reach the CRM
Measurable result','Integration issues
Took longer than planned',1,1750000000003,1750000000000);

INSERT OR REPLACE INTO highlights (id,product_id,label,polarity,sort,label_ja) VALUES
('hl-stw-r-1','stw-relaunch','Rankings protected','pos',0,'検索順位を維持'),
('hl-stw-r-2','stw-relaunch','Weekly reviews','pos',1,'毎週の進捗確認'),
('hl-stw-r-3','stw-relaunch','Easy publishing','pos',2,'更新が簡単'),
('hl-stw-r-4','stw-relaunch','Clear communication','pos',3,'分かりやすいやり取り'),
('hl-stw-r-5','stw-relaunch','Project timeline','both',4,'スケジュール'),
('hl-stw-r-6','stw-relaunch','Timeline slipped','neg',5,'スケジュールが遅れた'),
('hl-stw-r-7','stw-relaunch','Unclear scope','neg',6,'範囲が不明確'),
('hl-stw-c-1','stw-care','Fast fixes','pos',0,'対応が早い'),
('hl-stw-c-2','stw-care','Reliable backups','pos',1,'確実なバックアップ'),
('hl-stw-c-3','stw-care','Smooth handover','pos',2,'スムーズな引き継ぎ'),
('hl-stw-c-4','stw-care','Proactive monitoring','pos',3,'先回りの監視'),
('hl-stw-c-5','stw-care','Response time','both',4,'返信の速さ'),
('hl-stw-c-6','stw-care','Slow response','neg',5,'返信が遅い'),
('hl-stw-c-7','stw-care','Unclear reporting','neg',6,'報告が分かりにくい'),
('hl-stw-t-1','stw-cto','Sound technical advice','pos',0,'的確な技術アドバイス'),
('hl-stw-t-2','stw-cto','Honest vendor advice','pos',1,'率直なベンダー選定'),
('hl-stw-t-3','stw-cto','Clear roadmap','pos',2,'明確なロードマップ'),
('hl-stw-t-4','stw-cto','Easy to work with','pos',3,'一緒に進めやすい'),
('hl-stw-t-5','stw-cto','Availability','both',4,'対応可能な時間'),
('hl-stw-t-6','stw-cto','Hard to reach','neg',5,'連絡がつきにくい'),
('hl-stw-t-7','stw-cto','Too technical','neg',6,'説明が専門的すぎる'),
('hl-stw-a-1','stw-ai','Saved manual work','pos',0,'手作業が減った'),
('hl-stw-a-2','stw-ai','Leads reach the CRM','pos',1,'リードがCRMに届く'),
('hl-stw-a-3','stw-ai','Measurable result','pos',2,'効果が測れる'),
('hl-stw-a-4','stw-ai','Clear explanations','pos',3,'分かりやすい説明'),
('hl-stw-a-5','stw-ai','Setup time','both',4,'導入までの期間'),
('hl-stw-a-6','stw-ai','Integration issues','neg',5,'連携の不具合'),
('hl-stw-a-7','stw-ai','Took longer than planned','neg',6,'予定より時間がかかった');

-- Google uses the business's real Place ID. Trustpilot's /evaluate/<domain> opens its review form for the domain.
-- "Our website" is the only portal where the reward may show (custom type); point it at a real testimonial page when one exists.
INSERT OR REPLACE INTO portals (id,brand_id,type,label,url,allows_incentives,is_default,sort) VALUES
('stw-portal-google','stw','google','Google','https://search.google.com/local/writereview?placeid=ChIJx1CI1bgJvUcRUrxACB8mhVA',0,1,0),
('stw-portal-trustpilot','stw','trustpilot','Trustpilot','https://www.trustpilot.com/evaluate/sometech.work',0,1,1),
('stw-portal-website','stw','custom','Our website','https://sometech.work/',1,1,2);

INSERT OR REPLACE INTO reward (id,enabled,title,description,kind,value) VALUES
('stw',1,'Free website health check','A thank-you for taking the time. It does not depend on what you wrote or how many stars you gave.','manual','We will email you to book a 30-minute health check of your live site.');

INSERT OR REPLACE INTO memories (id,brand_id,product_id,kind,text,source,status,evidence,created_at,updated_at) VALUES
('mem-stw-1','stw',NULL,'style','Mention one concrete outcome, such as faster publishing, a safe launch or a fixed workflow, rather than general praise.','admin','active','',1750000000000,1750000000000),
('mem-stw-2','stw',NULL,'avoid','Never name other clients or projects under NDA.','admin','active','',1750000000000,1750000000000),
('mem-stw-3','stw',NULL,'fact','Engagements start with a one-week audit of the live site, access and tracking before any quote.','admin','active','',1750000000000,1750000000000),
('mem-stw-4','stw','stw-care',  'fact','A handover from a previous agency starts with an access check and a restorable backup.','admin','active','',1750000000000,1750000000000);

INSERT OR REPLACE INTO links (id,brand_id,token,product_id,customer_name,language,visit_notes,kind,status,portal_id,created_at,opened_at,copied_at) VALUES
('link-stw-relaunch','stw','stwdemo001','stw-relaunch','','en','','product','created',NULL,1750000000000,NULL,NULL),
('link-stw-care','stw','stwdemo002','stw-care','','en','','product','created',NULL,1750000000000,NULL,NULL),
('link-stw-cto','stw','stwdemo003','stw-cto','','en','','product','created',NULL,1750000000000,NULL,NULL),
('link-stw-ai','stw','stwdemo004','stw-ai','','en','','product','created',NULL,1750000000000,NULL,NULL);
