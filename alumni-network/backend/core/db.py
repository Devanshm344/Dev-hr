import json

import asyncpg

from core.auth import hash_password
from core.config import settings
from core.constants import DEMO_ADMIN_PASSWORD, DEMO_ALUMNI_PASSWORD, DEMO_HR_PASSWORD

pool: asyncpg.Pool | None = None

_schema_ready = False


async def _init_connection(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def connect_pool() -> None:
    global pool
    pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        init=_init_connection,
        min_size=5,
        max_size=30,
    )


async def close_pool() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


def get_pool() -> asyncpg.Pool:
    assert pool is not None, "DB pool not initialized"
    return pool


_hr_communications_user_id: int | None = None


async def get_hr_communications_user_id() -> int:
    global _hr_communications_user_id
    if _hr_communications_user_id is None:
        _hr_communications_user_id = await get_pool().fetchval(
            "SELECT id FROM users WHERE email = $1", HR_COMMUNICATIONS_EMAIL
        )
    return _hr_communications_user_id


HR_COMMUNICATIONS_EMAIL = "hr-communications@techdemocracy.internal"

SEED_USERS = [
    {"first_name": "Demo", "last_name": "Alumni", "email": "demo.alumni@example.com", "phone": "+1-555-0101", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Microsoft", "designation": "Senior Software Engineer", "industry": "Technology", "joining_year": 2018, "status": "active"},
    {"first_name": "Marcus", "last_name": "Johnson", "email": "marcus.j@example.com", "phone": "+1-555-0102", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Salesforce", "designation": "Solutions Architect", "industry": "CRM/SaaS", "joining_year": 2017, "status": "active"},
    {"first_name": "Sarah", "last_name": "Chen", "email": "s.chen@example.com", "phone": "+1-555-0103", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/3768163/pexels-photo-3768163.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Google", "designation": "Product Manager", "industry": "Technology", "joining_year": 2016, "status": "active"},
    {"first_name": "David", "last_name": "Kim", "email": "d.kim@example.com", "phone": "+1-555-0104", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Amazon", "designation": "DevOps Engineer", "industry": "E-Commerce", "joining_year": 2019, "status": "active"},
    {"first_name": "Priya", "last_name": "Sharma", "email": "p.sharma@example.com", "phone": "+1-555-0105", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/3796217/pexels-photo-3796217.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "IBM", "designation": "Data Scientist", "industry": "Consulting", "joining_year": 2015, "status": "inactive"},
    {"first_name": "James", "last_name": "Wilson", "email": "j.wilson@example.com", "phone": "+1-555-0106", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Deloitte", "designation": "IT Consultant", "industry": "Consulting", "joining_year": 2020, "status": "pending"},
    {"first_name": "Fatima", "last_name": "Al-Hassan", "email": "f.alhassan@example.com", "phone": "+1-555-0107", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/3184611/pexels-photo-3184611.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Oracle", "designation": "Database Administrator", "industry": "Technology", "joining_year": 2018, "status": "active"},
    {"first_name": "Robert", "last_name": "Torres", "email": "r.torres@example.com", "phone": "+1-555-0108", "linkedin_url": "https://linkedin.com", "photo": "https://images.pexels.com/photos/3778966/pexels-photo-3778966.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Accenture", "designation": "Cloud Architect", "industry": "Consulting", "joining_year": 2014, "status": "active"},
    {"first_name": "Jennifer", "last_name": "Liu", "email": "j.liu@example.com", "phone": "+1-555-0201", "linkedin_url": None, "photo": "https://images.pexels.com/photos/3184611/pexels-photo-3184611.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Cisco", "designation": "Network Engineer", "industry": "Technology", "joining_year": 2021, "status": "pending"},
    {"first_name": "Alex", "last_name": "Hernandez", "email": "a.hernandez@example.com", "phone": "+1-555-0202", "linkedin_url": None, "photo": "https://images.pexels.com/photos/3778966/pexels-photo-3778966.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "VMware", "designation": "Cloud Engineer", "industry": "Technology", "joining_year": 2020, "status": "pending"},
    {"first_name": "Mei", "last_name": "Wang", "email": "m.wang@example.com", "phone": "+1-555-0203", "linkedin_url": None, "photo": "https://images.pexels.com/photos/3796217/pexels-photo-3796217.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Netflix", "designation": "SRE", "industry": "Technology", "joining_year": 2022, "status": "pending"},
    {"first_name": "Samuel", "last_name": "Osei", "email": "s.osei@example.com", "phone": "+1-555-0204", "linkedin_url": None, "photo": "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=100", "employer": "Stripe", "designation": "Backend Engineer", "industry": "Technology", "joining_year": 2019, "status": "pending"},
]

SEED_BENEFITS = [
    ("Internship Opportunities for Alumni's Children", "Priority access to internships and mentorship programs for alumni's children to help them gain valuable industry experience.", "Career", "GraduationCap", "blue"),
    ("Exclusive Access to Free Training and Certifications", "Regular, free access to certifications and advanced training programs in emerging tech and soft skills.", "Education", "Award", "green"),
    ("Alumni Networking Events", "Invitation to annual TechDemocracy alumni meet-ups, networking dinners, and industry events for reconnecting and exchanging insights.", "Networking", "Users", "orange"),
    ("Mentorship Opportunities", "Alumni can engage in mentorship programs, both as mentors and mentees, fostering professional growth within the alumni network.", "Networking", "Heart", "orange"),
    ("Priority for Open Roles", "Alumni will be given priority for consideration in new job openings, especially in senior and specialized roles.", "Career", "Briefcase", "blue"),
    ("Access to TechDemocracy's Knowledge Portal", "Exclusive access to a knowledge-sharing portal with company reports, white papers, and industry insights to stay up-to-date with the latest trends.", "Education", "BookOpen", "green"),
    ("Professional Development Webinars", "Monthly webinars on industry trends, technology updates, and career development, exclusively for alumni members.", "Education", "Monitor", "green"),
    ("Discounted or Free Consulting Services", "Access to discounted consulting services for alumni who've started their own ventures or are looking for expertise in cybersecurity or IT solutions.", "Financial", "DollarSign", "yellow"),
    ("Guest Lectures and Workshops", "Opportunities for alumni to lead guest lectures or workshops, helping them establish thought leadership and expand their professional influence.", "Education", "Globe", "green"),
    ("Family Engagement and Support", "Invitations to family-friendly company events and workshops that provide personal growth and wellness resources.", "Wellness", "Home", "red"),
    ("Career Coaching and Resume Review", "Free one-on-one career coaching sessions and resume review services to support alumni in navigating their career paths.", "Career", "TrendingUp", "blue"),
    ("Professional Networking Platform", "Access to an exclusive online alumni community platform for job referrals, networking, and collaboration.", "Networking", "Share2", "orange"),
    ("Exclusive Project or Partnership Collaborations", "For alumni in consulting or tech industries, priority consideration in collaborative projects and partnerships with TechDemocracy.", "Career", "Grid", "blue"),
    ("Corporate Discounts and Perks", "Access to corporate discounts on products, software, gym memberships, and courses available through TechDemocracy's partner network.", "Lifestyle", "ShoppingBag", "purple"),
    ("Recognition Programs and Spotlights", "Annual recognition for notable alumni achievements, with features in company newsletters or online platforms.", "Recognition", "Trophy", "yellow"),
    ("Referral Bonuses for Alumni", "Special referral bonuses for alumni who recommend candidates or projects to TechDemocracy, helping build a stronger talent pool and client base.", "Financial", "DollarSign", "yellow"),
    ("Access to Alumni-Exclusive Job Board", "A curated job board with opportunities from TechDemocracy and affiliated companies, exclusively for alumni, making it easy to stay connected to industry roles.", "Career", "Search", "blue"),
    ("Alumni Scholarship Program", "Scholarships or financial aid for alumni and their families seeking education in tech, cybersecurity, or business, furthering knowledge and skill-building.", "Education", "GraduationCap", "green"),
    ("Innovation and Startup Support", "For alumni starting their own businesses, we offer small grants, mentorship, and tech support to help them kickstart their ventures.", "Career", "Laptop", "blue"),
    ("Special Guest Invitations to Industry Conferences", "Invitations to join TechDemocracy in prominent conferences, offering alumni the chance to network and learn from top leaders in cybersecurity and tech.", "Networking", "Plane", "orange"),
    ("Alumni Project Collaboration Hub", "A dedicated portal where alumni can propose and collaborate on tech projects, leveraging TechDemocracy resources and expertise.", "Career", "Users", "blue"),
    ("Access to TechDemocracy's Research Labs", "Alumni can access select data, tools, and research resources, particularly valuable for those in academia or research-oriented roles.", "Education", "Search", "green"),
    ("Leadership Roundtable Access", "Invitations to virtual or in-person roundtable discussions with TechDemocracy's executives and thought leaders, offering strategic insights and networking.", "Networking", "Award", "orange"),
    ("Alumni Recognition Awards", "Annual awards recognizing outstanding achievements by alumni in areas like innovation, leadership, and social impact, with winners highlighted in company publications.", "Recognition", "Trophy", "yellow"),
    ("Exclusive Access to TechDemocracy Branded Merchandise", "Alumni can enjoy exclusive access to premium TechDemocracy-branded merchandise, from apparel to tech gadgets, to show their pride in the organization.", "Lifestyle", "ShoppingBag", "purple"),
]


async def ensure_schema() -> None:
    """Full schema bootstrap — 1:1 port of lib/db.ts ensureSchema()."""
    global _schema_ready
    if _schema_ready:
        return
    assert pool is not None

    async with pool.acquire() as conn:
        # users
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              full_name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              phone TEXT NOT NULL,
              linkedin_url TEXT,
              profile_photo_path TEXT,
              professional_status TEXT NOT NULL,
              employer TEXT,
              designation TEXT,
              industry TEXT NOT NULL,
              resume_path TEXT,
              family_members JSONB NOT NULL DEFAULT '[]',
              joining_month TEXT NOT NULL,
              joining_year INTEGER NOT NULL,
              roles_held TEXT,
              achievements TEXT,
              selected_benefits INTEGER[] NOT NULL DEFAULT '{}',
              agreed_terms BOOLEAN NOT NULL DEFAULT false,
              agreed_comms BOOLEAN NOT NULL DEFAULT false,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS exited_year INTEGER;")
        await conn.execute("ALTER TABLE users ALTER COLUMN joining_month DROP NOT NULL;")
        await conn.execute("ALTER TABLE users ALTER COLUMN joining_year DROP NOT NULL;")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status, created_at DESC);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_status_industry ON users(status, industry);")

        # Split full_name into first_name/last_name, keeping full_name as a generated column
        # so the ~30 read-only call sites that still SELECT full_name keep working unchanged.
        full_name_is_generated = await conn.fetchval("""
            SELECT is_generated = 'ALWAYS' FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'full_name'
        """)
        if not full_name_is_generated:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;")
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;")
            await conn.execute("""
                UPDATE users SET
                    first_name = COALESCE(NULLIF(first_name, ''), split_part(full_name, ' ', 1)),
                    last_name = COALESCE(NULLIF(last_name, ''),
                        CASE WHEN position(' ' in full_name) > 0
                             THEN substring(full_name FROM position(' ' in full_name) + 1)
                             ELSE '' END)
            """)
            await conn.execute("UPDATE users SET first_name = '' WHERE first_name IS NULL;")
            await conn.execute("UPDATE users SET last_name = '' WHERE last_name IS NULL;")
            await conn.execute("ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;")
            await conn.execute("ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;")
            await conn.execute("ALTER TABLE users DROP COLUMN full_name;")
            await conn.execute("""
                ALTER TABLE users ADD COLUMN full_name TEXT
                GENERATED ALWAYS AS (trim(both ' ' from first_name || ' ' || last_name)) STORED;
            """)

        seed_marker = await conn.fetchval("SELECT 1 FROM users WHERE email = 'demo.alumni@example.com'")
        if seed_marker is None:
            demo_password_hash = await hash_password(DEMO_ALUMNI_PASSWORD)
            for u in SEED_USERS:
                password_hash = demo_password_hash if u["email"] == "demo.alumni@example.com" else None
                await conn.execute(
                    """INSERT INTO users (
                        first_name, last_name, email, phone, linkedin_url, profile_photo_path,
                        professional_status, employer, designation, industry,
                        joining_month, joining_year, family_members, selected_benefits,
                        agreed_terms, agreed_comms, status, password_hash
                    ) VALUES ($1,$2,$3,$4,$5,$6,'Employed',$7,$8,$9,'January',$10,'[]','{}',true,true,$11,$12)
                    ON CONFLICT (email) DO NOTHING""",
                    u["first_name"], u["last_name"], u["email"], u["phone"], u["linkedin_url"], u["photo"],
                    u["employer"], u["designation"], u["industry"], u["joining_year"], u["status"], password_hash,
                )

        aisha_row = await conn.fetchrow("SELECT id, password_hash FROM users WHERE email = 'demo.alumni@example.com'")
        if aisha_row is not None and not aisha_row["password_hash"]:
            demo_password_hash = await hash_password(DEMO_ALUMNI_PASSWORD)
            await conn.execute("UPDATE users SET password_hash = $1 WHERE id = $2", demo_password_hash, aisha_row["id"])

        # HR Communications: a system pseudo-account (status='system', no direct login) that lets
        # HR/admin staff message any alumnus through the normal messages/connections plumbing,
        # while messages.sent_by_staff_id records which real staffer actually sent each reply.
        await conn.execute(
            """INSERT INTO users (
                first_name, last_name, email, phone, professional_status, industry,
                joining_month, joining_year, family_members, selected_benefits,
                agreed_terms, agreed_comms, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]','{}',true,true,$9)
            ON CONFLICT (email) DO NOTHING""",
            "HR", "Communications", HR_COMMUNICATIONS_EMAIL, "N/A", "N/A", "N/A", "January", 2020, "system",
        )

        # events
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              event_date DATE NOT NULL,
              event_time TEXT,
              end_time TEXT,
              location TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'In-Person',
              category TEXT,
              speaker TEXT,
              description TEXT,
              banner_path TEXT,
              attendees INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'upcoming',
              published BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        events_count = await conn.fetchval("SELECT count(*)::int FROM events")
        if events_count == 0:
            await conn.execute("""
                INSERT INTO events (title, event_date, event_time, end_time, location, type, category, speaker, description, attendees, status)
                VALUES
                  ('Annual Alumni Summit 2026', '2026-11-15', '09:00 AM', '06:00 PM', 'Marriott Marquis, NYC', 'In-Person', 'Summit', 'Dr. Emily Richardson', 'Join us for our flagship annual event featuring keynotes from industry leaders, networking sessions, and workshops.', 350, 'upcoming'),
                  ('Tech Trends Webinar: AI in 2026', '2026-08-25', '02:00 PM', '04:00 PM', 'Virtual (Zoom)', 'Virtual', 'Webinar', 'Marcus Chen, VP Engineering', 'Explore the latest AI/ML trends shaping the technology landscape.', 128, 'upcoming'),
                  ('Bay Area Alumni Meetup', '2026-08-02', '06:30 PM', '09:00 PM', 'The Battery Club, SF', 'In-Person', 'Networking', NULL, 'Casual networking event for Bay Area alumni. Connect with former colleagues and new faces.', 64, 'upcoming');
            """)

        # stories
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS stories (
              id SERIAL PRIMARY KEY,
              alumni_name TEXT NOT NULL,
              role TEXT,
              quote TEXT NOT NULL,
              avatar_path TEXT,
              rating INTEGER NOT NULL DEFAULT 5,
              submitted_by_email TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              published BOOLEAN NOT NULL DEFAULT false,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        stories_count = await conn.fetchval("SELECT count(*)::int FROM stories")
        if stories_count == 0:
            await conn.execute("""
                INSERT INTO stories (alumni_name, role, quote, avatar_path, rating, submitted_by_email, status, published)
                VALUES
                  ('Demo Alumni', 'Senior Engineer, Microsoft', 'The TechDemocracy Alumni Network opened doors I never knew existed. The mentorship program directly led to my role at Microsoft.', 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=100', 5, 'demo.alumni@example.com', 'approved', true),
                  ('Marcus Johnson', 'Solutions Architect, Salesforce', 'An incredibly supportive community. The networking events and job board are invaluable for career growth.', 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=100', 5, NULL, 'approved', true),
                  ('Sarah Chen', 'Product Manager, Google', 'From the resume review service to the certification support — every benefit I used made a measurable difference in my career.', 'https://images.pexels.com/photos/3768163/pexels-photo-3768163.jpeg?auto=compress&cs=tinysrgb&w=100', 5, NULL, 'approved', true);
            """)

        # faqs
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS faqs (
              id SERIAL PRIMARY KEY,
              question TEXT NOT NULL,
              answer TEXT NOT NULL,
              display_order INTEGER NOT NULL DEFAULT 0,
              published BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        faqs_count = await conn.fetchval("SELECT count(*)::int FROM faqs")
        if faqs_count == 0:
            await conn.execute("""
                INSERT INTO faqs (question, answer, display_order, published)
                VALUES
                  ('Who can join the TechDemocracy Alumni Network?', 'Any former TechDemocracy employee who has completed at least one year of service is eligible to join the alumni network.', 0, true),
                  ('How do I register for the portal?', 'Click the ''Register'' button and complete the multi-step registration form. Your account will be reviewed and approved by our HR team within 2-3 business days.', 1, true),
                  ('Is there a fee to join?', 'No, the TechDemocracy Alumni Portal is completely free for all eligible alumni.', 2, true),
                  ('What benefits am I entitled to?', 'Benefits vary based on your tenure and designation. Upon registration, you can select from 25+ available benefits. HR will review and approve your selections.', 3, true),
                  ('Can I update my profile after registration?', 'Yes, you can update your profile, professional information, and benefit preferences at any time through the portal.', 4, true);
            """)

        # password_reset_tokens
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              token TEXT NOT NULL UNIQUE,
              expires_at TIMESTAMPTZ NOT NULL,
              used_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);")

        # announcements
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              author TEXT NOT NULL,
              priority TEXT NOT NULL DEFAULT 'medium',
              published BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        announcements_count = await conn.fetchval("SELECT count(*)::int FROM announcements")
        if announcements_count == 0:
            await conn.execute("""
                INSERT INTO announcements (title, content, author, priority, published)
                VALUES
                  ('New Benefits Package Launched for 2026-27', 'We''re excited to announce an expanded benefits package including 5 new perks for active alumni members.', 'HR Team', 'high', true),
                  ('Alumni Portal v2.0 Release', 'Major portal update with improved navigation, messaging features, and a new mobile experience.', 'Tech Team', 'medium', true),
                  ('Annual Summit Registration Now Open', 'Register now for the TechDemocracy Annual Alumni Summit 2026. Early bird spots are limited!', 'Events Team', 'high', true);
            """)

        # benefits
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS benefits (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              category TEXT NOT NULL,
              icon TEXT NOT NULL DEFAULT 'Gift',
              color TEXT NOT NULL DEFAULT 'blue',
              active BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_benefits_active ON benefits(active);")
        benefits_count = await conn.fetchval("SELECT count(*)::int FROM benefits")
        if benefits_count == 0:
            for title, description, category, icon, color in SEED_BENEFITS:
                await conn.execute(
                    "INSERT INTO benefits (title, description, category, icon, color) VALUES ($1,$2,$3,$4,$5)",
                    title, description, category, icon, color,
                )

        # service_requests
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS service_requests (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              benefit_id INTEGER REFERENCES benefits(id) ON DELETE SET NULL,
              benefit_title TEXT NOT NULL,
              notes TEXT,
              priority TEXT NOT NULL DEFAULT 'medium',
              status TEXT NOT NULL DEFAULT 'pending',
              hr_notes TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_service_requests_user_created ON service_requests(user_id, created_at DESC);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);")

        # event_rsvps
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS event_rsvps (
              id SERIAL PRIMARY KEY,
              event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(event_id, user_id)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id);")

        # event_reminders
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS event_reminders (
              id SERIAL PRIMARY KEY,
              event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(event_id, user_id)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_event_reminders_user ON event_reminders(user_id);")

        # connections
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS connections (
              id SERIAL PRIMARY KEY,
              requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(requester_id, recipient_id)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_connections_recipient ON connections(recipient_id);")

        # Every alumnus is auto-connected to HR Communications so it always appears in
        # their Messages list without going through the normal connection-request flow.
        hr_comm_id = await conn.fetchval("SELECT id FROM users WHERE email = $1", HR_COMMUNICATIONS_EMAIL)
        if hr_comm_id is not None:
            await conn.execute(
                """INSERT INTO connections (requester_id, recipient_id, status)
                   SELECT $1, u.id, 'accepted' FROM users u WHERE u.id != $1
                   ON CONFLICT (requester_id, recipient_id) DO NOTHING""",
                hr_comm_id,
            )

        # messages
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
              id SERIAL PRIMARY KEY,
              sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              body TEXT,
              read BOOLEAN NOT NULL DEFAULT false,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at);")
        await conn.execute("ALTER TABLE messages ALTER COLUMN body DROP NOT NULL;")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_filename TEXT;")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_storage_key TEXT;")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER;")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS message_reactions (
              id SERIAL PRIMARY KEY,
              message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              emoji TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(message_id, user_id, emoji)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_blocks (
              id SERIAL PRIMARY KEY,
              blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(blocker_id, blocked_id)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_reports (
              id SERIAL PRIMARY KEY,
              reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              reason TEXT NOT NULL,
              message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_id);")

        # group messaging
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS group_conversations (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS group_members (
              id SERIAL PRIMARY KEY,
              group_id INTEGER NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(group_id, user_id)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS group_messages (
              id SERIAL PRIMARY KEY,
              group_id INTEGER NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
              sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              body TEXT,
              attachment_filename TEXT,
              attachment_storage_key TEXT,
              attachment_size_bytes INTEGER,
              reply_to_id INTEGER REFERENCES group_messages(id) ON DELETE SET NULL,
              edited_at TIMESTAMPTZ,
              deleted_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS group_message_reactions (
              id SERIAL PRIMARY KEY,
              message_id INTEGER NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              emoji TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(message_id, user_id, emoji)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_group_message_reactions_message ON group_message_reactions(message_id);")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS group_reads (
              group_id INTEGER NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              last_read_message_id INTEGER,
              PRIMARY KEY (group_id, user_id)
            );
        """)

        # forum_posts
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS forum_posts (
              id SERIAL PRIMARY KEY,
              author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              category TEXT NOT NULL,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              pinned BOOLEAN NOT NULL DEFAULT false,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);")

        # forum_replies
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS forum_replies (
              id SERIAL PRIMARY KEY,
              post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
              author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              body TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, created_at);")

        # forum_likes
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS forum_likes (
              id SERIAL PRIMARY KEY,
              post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              UNIQUE(post_id, user_id)
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_forum_likes_post ON forum_likes(post_id);")

        # feedback
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
              id SERIAL PRIMARY KEY,
              user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
              category TEXT NOT NULL,
              rating INTEGER NOT NULL,
              message TEXT NOT NULL,
              aspect_ratings JSONB NOT NULL DEFAULT '{}',
              anonymous BOOLEAN NOT NULL DEFAULT false,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);")

        # notification_prefs
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notification_prefs (
              user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              email BOOLEAN NOT NULL DEFAULT true,
              messages BOOLEAN NOT NULL DEFAULT true,
              events BOOLEAN NOT NULL DEFAULT true,
              requests BOOLEAN NOT NULL DEFAULT true,
              benefits BOOLEAN NOT NULL DEFAULT false,
              forum BOOLEAN NOT NULL DEFAULT false,
              announcements BOOLEAN NOT NULL DEFAULT true,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)

        # privacy_settings
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS privacy_settings (
              user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              show_in_directory BOOLEAN NOT NULL DEFAULT true,
              allow_connection_requests BOOLEAN NOT NULL DEFAULT true,
              show_online_status BOOLEAN NOT NULL DEFAULT false,
              share_activity BOOLEAN NOT NULL DEFAULT true,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)

        # notifications
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              type TEXT NOT NULL,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              link TEXT,
              read BOOLEAN NOT NULL DEFAULT false,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);")

        # contact_messages
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS contact_messages (
              id SERIAL PRIMARY KEY,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              email TEXT NOT NULL,
              message TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'unread',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)

        # staff_users
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS staff_users (
              id SERIAL PRIMARY KEY,
              full_name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        staff_seed_marker = await conn.fetchval("SELECT 1 FROM staff_users WHERE email = 'demo.hr@example.com'")
        if staff_seed_marker is None:
            hr_hash = await hash_password(DEMO_HR_PASSWORD)
            admin_hash = await hash_password(DEMO_ADMIN_PASSWORD)
            await conn.execute(
                """INSERT INTO staff_users (full_name, email, password_hash, role) VALUES
                   ('Demo HR', 'demo.hr@example.com', $1, 'hr'),
                   ('Demo Admin', 'demo.admin@example.com', $2, 'admin')
                   ON CONFLICT (email) DO NOTHING""",
                hr_hash, admin_hash,
            )

        # staff_notifications
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS staff_notifications (
              id SERIAL PRIMARY KEY,
              role TEXT NOT NULL,
              type TEXT NOT NULL,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              link TEXT,
              read BOOLEAN NOT NULL DEFAULT false,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_staff_notifications_role_created ON staff_notifications(role, created_at DESC);")

        # staff_notification_prefs
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS staff_notification_prefs (
              role TEXT PRIMARY KEY,
              registration_alert BOOLEAN NOT NULL DEFAULT true,
              benefit_request_alert BOOLEAN NOT NULL DEFAULT true,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)

        # roles
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS roles (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              description TEXT,
              base_role TEXT NOT NULL,
              permissions JSONB NOT NULL DEFAULT '[]',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);")
        await conn.execute("ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;")

        role_seed_marker = await conn.fetchval("SELECT 1 FROM roles WHERE name = 'HR Manager'")
        if role_seed_marker is None:
            hr_manager_role_id = await conn.fetchval(
                """INSERT INTO roles (name, description, base_role, permissions) VALUES
                   ('HR Manager', 'Full access to HR portal features.', 'hr', '["View Alumni","Edit Alumni","Approve Alumni","View Benefits","Manage Benefits","Approve Requests","View Events","Create Events","Edit Events"]')
                   RETURNING id"""
            )
            admin_role_id = await conn.fetchval(
                """INSERT INTO roles (name, description, base_role, permissions) VALUES
                   ('System Administrator', 'Full access to the Admin console.', 'admin', '["Manage Roles","Manage HR Users","View Audit Logs","CMS Access","System Settings"]')
                   RETURNING id"""
            )
            await conn.execute(
                "UPDATE staff_users SET role_id = $1 WHERE email = 'demo.hr@example.com' AND role_id IS NULL",
                hr_manager_role_id,
            )
            await conn.execute(
                "UPDATE staff_users SET role_id = $1 WHERE email = 'demo.admin@example.com' AND role_id IS NULL",
                admin_role_id,
            )

        # Records which real staff member sent a message "as" HR Communications, for audit purposes.
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_by_staff_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL;")

        # audit_logs
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
              id SERIAL PRIMARY KEY,
              actor_type TEXT NOT NULL,
              actor_label TEXT NOT NULL,
              action TEXT NOT NULL,
              resource TEXT NOT NULL,
              status TEXT NOT NULL,
              ip_address TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);")

        # system_metrics_samples
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS system_metrics_samples (
              id SERIAL PRIMARY KEY,
              cpu_pct NUMERIC NOT NULL,
              memory_pct NUMERIC NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_system_metrics_created ON system_metrics_samples(created_at DESC);")

        # cms_pages
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS cms_pages (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              slug TEXT NOT NULL UNIQUE,
              type TEXT NOT NULL DEFAULT 'Page',
              content TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'draft',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        cms_pages_count = await conn.fetchval("SELECT count(*)::int FROM cms_pages")
        if cms_pages_count == 0:
            await conn.execute("""
                INSERT INTO cms_pages (title, slug, type, content, status)
                VALUES
                  ('Landing Page', '/', 'Page', '', 'published'),
                  ('About TechDemocracy', '/about', 'Page', '', 'published'),
                  ('Privacy Policy', '/privacy', 'Policy', '', 'published'),
                  ('Terms of Service', '/terms', 'Policy', '', 'published');
            """)

        # system_settings (singleton)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
              id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
              portal_name TEXT NOT NULL DEFAULT 'TechDemocracy Alumni Portal',
              organization_name TEXT NOT NULL DEFAULT 'TechDemocracy Inc.',
              support_email TEXT NOT NULL DEFAULT 'alumni@techdemocracy.com',
              default_timezone TEXT NOT NULL DEFAULT 'America/New_York',
              enable_public_landing_page BOOLEAN NOT NULL DEFAULT true,
              allow_new_registrations BOOLEAN NOT NULL DEFAULT true,
              show_alumni_stats_on_landing BOOLEAN NOT NULL DEFAULT true,
              password_min_length INTEGER NOT NULL DEFAULT 8,
              session_timeout_minutes INTEGER NOT NULL DEFAULT 10080,
              maintenance_mode BOOLEAN NOT NULL DEFAULT false,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;")

        # alumni_documents
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS alumni_documents (
              id SERIAL PRIMARY KEY,
              alumni_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              doc_type TEXT NOT NULL DEFAULT 'salary_certificate',
              period_label TEXT,
              original_filename TEXT NOT NULL,
              storage_key TEXT NOT NULL,
              file_size_bytes INTEGER,
              uploaded_by INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
              uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_alumni_documents_alumni ON alumni_documents(alumni_id);")

        # service_request_messages
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS service_request_messages (
              id SERIAL PRIMARY KEY,
              request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
              sender_type TEXT NOT NULL,
              sender_id INTEGER NOT NULL,
              body TEXT,
              attachment_filename TEXT,
              attachment_storage_key TEXT,
              attachment_size_bytes INTEGER,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_service_request_messages_request ON service_request_messages(request_id, created_at);")

        # benefit_resources
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS benefit_resources (
              id SERIAL PRIMARY KEY,
              benefit_id INTEGER NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
              original_filename TEXT NOT NULL,
              storage_key TEXT NOT NULL,
              file_size_bytes INTEGER,
              uploaded_by INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
              uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_benefit_resources_benefit ON benefit_resources(benefit_id);")

    _schema_ready = True
