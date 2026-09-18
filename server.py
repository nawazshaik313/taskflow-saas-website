#!/usr/bin/env python3
"""
TASKFLOW SAAS PLATFORM - BACKEND REST API SERVER
Brand: TaskFlow ("Work smarter. Get more done.")
Language: Python 3.13 (Standard Library)
Database: SQLite3 (database.db)
Port: 8080
"""

import http.server
import socketserver
import json
import sqlite3
import os
import time
import random
import urllib.request
import urllib.parse
import urllib.error
import hashlib
import secrets
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("PORT", "8080"))
DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")
START_TIME = time.time()

def load_env():
    env_paths = [
        os.path.join(os.path.expanduser("~"), ".env"),
        os.path.join(os.path.dirname(__file__), ".env")
    ]
    for env_path in env_paths:
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")

load_env()

SESSION_SECRET = os.environ.get("SESSION_SECRET", "")
if not SESSION_SECRET:
    SESSION_SECRET = secrets.token_hex(32)

def get_google_config():
    load_env()
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", f"http://localhost:{PORT}/api/auth/google/callback").strip()
    return client_id, client_secret, redirect_uri

def get_smtp_config():
    load_env()
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_email = os.environ.get("SMTP_FROM_EMAIL", user or "noreply@taskflow.io").strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() in ["true", "1", "yes"]
    return host, port, user, password, from_email, use_tls

def send_password_reset_email(to_email, reset_url):
    host, port, user, password, from_email, use_tls = get_smtp_config()
    if not host or not user or not password:
        return False, "SMTP email server credentials are not configured in environment variables."
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "TaskFlow - Reset Your Password"
        msg['From'] = f"TaskFlow Security <{from_email}>"
        msg['To'] = to_email

        text_content = f"Hello,\n\nYou requested a password reset for your TaskFlow workspace account.\nClick the link below to set a new password:\n{reset_url}\n\nThis link will expire in 1 hour.\nIf you did not request this reset, please ignore this email.\n\nThe TaskFlow Team"
        
        html_content = f"""
        <div style="font-family:'Plus Jakarta Sans', Arial, sans-serif; max-width:560px; margin:0 auto; padding:2rem; background:#F4F6FB; border-radius:16px; color:#0F172A;">
          <div style="text-align:center; margin-bottom:1.5rem;">
            <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #4F46E5, #06B6D4); display:inline-flex; align-items:center; justify-content:center; color:#FFF; font-size:1.5rem;">💧</div>
            <h2 style="margin-top:0.75rem; font-size:1.5rem; font-weight:800; color:#0F172A;">Reset Your Password</h2>
          </div>
          <p style="font-size:1rem; color:#334155; line-height:1.6;">Hello,</p>
          <p style="font-size:1rem; color:#334155; line-height:1.6;">You recently requested to reset the password for your TaskFlow account. Click the button below to choose a new password:</p>
          <div style="text-align:center; margin:2rem 0;">
            <a href="{reset_url}" style="background:linear-gradient(135deg, #4F46E5, #06B6D4); color:#FFFFFF; text-decoration:none; padding:0.85rem 2rem; border-radius:9999px; font-weight:700; display:inline-block; font-size:1rem;">Reset Password</a>
          </div>
          <p style="font-size:0.875rem; color:#64748B;">This link is valid for 1 hour. If you did not request a password reset, no action is needed.</p>
          <hr style="border:none; border-top:1px solid rgba(0,0,0,0.1); margin:1.5rem 0;">
          <p style="font-size:0.75rem; color:#94A3B8; text-align:center;">TaskFlow Inc. • Work smarter. Get more done.</p>
        </div>
        """

        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))

        if use_tls:
            server = smtplib.SMTP(host, port, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(host, port, timeout=10)

        server.login(user, password)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        return True, "Email sent successfully"
    except Exception as e:
        print(f"[SMTP RESET EMAIL ERROR] {e}")
        return False, str(e)

AUTH_ATTEMPTS = {} # Rate limiting dict: { ip: [timestamp1, ...] }

def is_rate_limited(client_ip: str, limit: int = 5, window_seconds: int = 60) -> bool:
    now = time.time()
    attempts = [t for t in AUTH_ATTEMPTS.get(client_ip, []) if now - t < window_seconds]
    AUTH_ATTEMPTS[client_ip] = attempts
    if len(attempts) >= limit:
        return True
    AUTH_ATTEMPTS[client_ip].append(now)
    return False

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}${pwd_hash}"

def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or '$' not in stored_hash:
        return False
    try:
        salt, expected_hash = stored_hash.split('$', 1)
        actual_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
        return secrets.compare_digest(actual_hash, expected_hash)
    except Exception:
        return False

def parse_cookies(cookie_header: str):
    cookies = {}
    if not cookie_header:
        return cookies
    items = cookie_header.split(";")
    for item in items:
        if "=" in item:
            k, v = item.strip().split("=", 1)
            cookies[k.strip()] = v.strip()
    return cookies

def get_session_user(handler):
    cookie_hdr = handler.headers.get('Cookie', '')
    cookies = parse_cookies(cookie_hdr)
    token = cookies.get('taskflow_session')
    if not token:
        return None

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        SELECT u.id, u.name, u.email, u.company, u.avatar_url, u.auth_provider, u.created_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > ?
    """, (token, now_str))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "company": row[3],
        "avatar_url": row[4],
        "auth_provider": row[5],
        "created_at": row[6]
    }

def set_session_cookie(handler, session_token: str, max_age_seconds: int = 604800):
    cookie_val = f"taskflow_session={session_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age_seconds}"
    if not hasattr(handler, 'extra_headers'):
        handler.extra_headers = []
    handler.extra_headers.append(('Set-Cookie', cookie_val))

def clear_session_cookie(handler):
    cookie_val = "taskflow_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    if not hasattr(handler, 'extra_headers'):
        handler.extra_headers = []
    handler.extra_headers.append(('Set-Cookie', cookie_val))

# --- Database Initialization ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Leads / Contact / Demo Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            name TEXT,
            company TEXT,
            message TEXT,
            source TEXT DEFAULT 'newsletter',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Migration for missing columns if database existed prior to schema update
    cursor.execute("PRAGMA table_info(leads)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    for col, default_val in [("name", "NULL"), ("company", "NULL"), ("message", "NULL"), ("source", "'contact_sales'")]:
        if col not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE leads ADD COLUMN {col} TEXT DEFAULT {default_val}")
            except Exception:
                pass
    
    # 2. Workflow Logs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflow_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trigger_type TEXT NOT NULL,
            action_type TEXT NOT NULL,
            output_type TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3. Task Analysis Logs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_prompt TEXT NOT NULL,
            generated_response TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 4. User Preferences Table (Theme Mode & Nav State)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_session TEXT UNIQUE DEFAULT 'default_user',
            theme_mode TEXT NOT NULL DEFAULT 'light',
            active_nav_tab TEXT DEFAULT 'overview',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Insert default preference row if not exists
    cursor.execute("""
        INSERT OR IGNORE INTO user_preferences (id, user_session, theme_mode)
        VALUES (1, 'default_user', 'light')
    """)

    # 5. Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            company TEXT,
            password_hash TEXT,
            google_id TEXT UNIQUE,
            avatar_url TEXT,
            auth_provider TEXT DEFAULT 'email',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)")

    # 6. Sessions Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_token TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)")

    # 7. Password Resets Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_resets(token_hash)")

    # Migration for leads table user_id association
    cursor.execute("PRAGMA table_info(leads)")
    existing_lead_cols = [row[1] for row in cursor.fetchall()]
    if "user_id" not in existing_lead_cols:
        try:
            cursor.execute("ALTER TABLE leads ADD COLUMN user_id INTEGER REFERENCES users(id)")
        except Exception:
            pass

    conn.commit()
    conn.close()
    print(f"[DB INITIALIZED] Connected to SQLite database at {DB_PATH}")

# --- Real Gemini API Call Helper ---
def call_gemini_api(prompt_text):
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt_text}]
        }]
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            candidates = res_json.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
    except Exception as e:
        print(f"[GEMINI API WARNING] {e}")
    return None

# --- Gemini Health Check State Cache ---
LAST_GEMINI_HEALTH_TIME = 0
LAST_GEMINI_HEALTH_STATUS = "AI Engine Configured"
LAST_GEMINI_CONNECTED_BOOL = False

def verify_gemini_health():
    global LAST_GEMINI_HEALTH_TIME, LAST_GEMINI_HEALTH_STATUS, LAST_GEMINI_CONNECTED_BOOL
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return "AI Engine (Simulation Mode)", False

    now = time.time()
    # Cache connectivity result for 30s to prevent rate limits on health polling
    if now - LAST_GEMINI_HEALTH_TIME < 30 and LAST_GEMINI_HEALTH_STATUS != "AI Engine Configured":
        return LAST_GEMINI_HEALTH_STATUS, LAST_GEMINI_CONNECTED_BOOL

    test_res = call_gemini_api("Ping health check")
    LAST_GEMINI_HEALTH_TIME = now
    if test_res:
        LAST_GEMINI_HEALTH_STATUS = "AI Engine Connected"
        LAST_GEMINI_CONNECTED_BOOL = True
        return "AI Engine Connected", True
    else:
        LAST_GEMINI_HEALTH_STATUS = "AI Engine Unavailable"
        LAST_GEMINI_CONNECTED_BOOL = False
        return "AI Engine Unavailable", False

# --- REST API Request Handler ---
class TaskFlowRequestHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        origin = self.headers.get('Origin')
        if origin and ("localhost" in origin or "127.0.0.1" in origin or "onrender.com" in origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/api/health":
            self.handle_health()
        elif path == "/api/dashboard/stats":
            self.handle_dashboard_stats()
        elif path == "/api/dashboard/data":
            self.handle_protected_dashboard_data()
        elif path == "/api/user/preferences":
            self.handle_get_preferences()
        elif path == "/api/navigation/menu":
            self.handle_navigation_menu()
        elif path == "/api/auth/me":
            self.handle_auth_me()
        elif path == "/api/auth/google":
            self.handle_auth_google()
        elif path == "/api/auth/google/callback":
            self.handle_auth_google_callback()
        else:
            super().do_GET()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        try:
            data = json.loads(body_bytes.decode('utf-8'))
        except Exception:
            data = {}

        if path == "/api/auth/signup":
            self.handle_auth_signup(data)
        elif path == "/api/auth/login":
            self.handle_auth_login(data)
        elif path == "/api/auth/logout":
            self.handle_auth_logout()
        elif path == "/api/auth/forgot-password":
            self.handle_auth_forgot_password(data)
        elif path == "/api/auth/reset-password":
            self.handle_auth_reset_password(data)
        elif path == "/api/user/preferences":
            self.handle_update_preferences(data)
        elif path == "/api/tasks/analyze":
            self.handle_task_analyze(data)
        elif path in ["/api/workflows/simulate", "/api/workflow/simulate"]:
            self.handle_workflow_simulate(data)
        elif path == "/api/roi/calculate":
            self.handle_roi_calculate(data)
        elif path == "/api/leads/subscribe":
            self.handle_lead_subscribe(data)
        else:
            self.send_json({"error": "Endpoint not found"}, status=404)

    def send_json(self, payload, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        if hasattr(self, 'extra_headers'):
            for k, v in self.extra_headers:
                self.send_header(k, v)
            self.extra_headers = []
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def send_redirect(self, location, status=302):
        self.send_response(status)
        self.send_header('Location', location)
        if hasattr(self, 'extra_headers'):
            for k, v in self.extra_headers:
                self.send_header(k, v)
            self.extra_headers = []
        self.end_headers()

    def handle_health(self):
        uptime = round(time.time() - START_TIME, 2)
        has_key = bool(os.environ.get("GEMINI_API_KEY"))
        status_text, is_connected = verify_gemini_health()
        
        self.send_json({
            "status": "operational",
            "service": "TaskFlow Backend REST API",
            "version": "3.2.0",
            "gemini_api_configured": has_key,
            "gemini_api_connected": is_connected,
            "ai_status_text": status_text,
            "configured_model": "gemini-3.6-flash",
            "uptime_seconds": uptime,
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z"
        })

    def handle_get_preferences(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT theme_mode, active_nav_tab FROM user_preferences WHERE id = 1")
        row = cursor.fetchone()
        conn.close()

        theme_mode = row[0] if row else "light"
        active_nav = row[1] if row else "overview"

        self.send_json({
            "success": True,
            "preferences": {
                "theme_mode": theme_mode,
                "active_nav_tab": active_nav
            }
        })

    def handle_update_preferences(self, data):
        theme_mode = data.get("theme_mode", "light")
        if theme_mode not in ["light", "dark"]:
            theme_mode = "light"
        
        active_nav = data.get("active_nav_tab", "overview")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_preferences
            SET theme_mode = ?, active_nav_tab = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        """, (theme_mode, active_nav))
        conn.commit()
        conn.close()

        self.send_json({
            "success": True,
            "message": f"User preferences updated: theme_mode={theme_mode}",
            "preferences": {
                "theme_mode": theme_mode,
                "active_nav_tab": active_nav
            }
        })

    def handle_navigation_menu(self):
        menu_tree = {
            "product": {
                "label": "Product",
                "subitems": [
                    {"title": "AI Task Assistant", "desc": "Break down goals with Google Gemini 3.6 Flash", "link": "#ai-engine", "icon": "🤖"},
                    {"title": "Smart Kanban & Gantt", "desc": "Interactive project timelines and sprint boards", "link": "#features", "icon": "📊"},
                    {"title": "Workflow Automation", "desc": "Trigger status alerts and integrations", "link": "#features", "icon": "⚡"},
                    {"title": "Team Workspace", "desc": "Real-time co-editing and comments", "link": "#product", "icon": "👥"}
                ]
            },
            "resources": {
                "label": "Resources",
                "subitems": [
                    {"title": "API Documentation", "desc": "REST API references & webhook guides", "link": "#about", "icon": "📖"},
                    {"title": "Customer Reviews", "desc": "Example feedback from growing teams", "link": "#resources", "icon": "⭐"},
                    {"title": "Security & Compliance", "desc": "Security-minded architecture and best practices", "link": "#about", "icon": "🛡️"}
                ]
            },
            "company": {
                "label": "Company",
                "subitems": [
                    {"title": "About TaskFlow", "desc": "Our mission to help teams work smarter", "link": "#about", "icon": "🏢"},
                    {"title": "Careers", "desc": "Join our remote global product team", "link": "#footer", "icon": "🚀"}
                ]
            }
        }
        self.send_json({"success": True, "navigation": menu_tree})

    def handle_dashboard_stats(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM workflow_logs")
        total_workflows = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM leads")
        total_leads = cursor.fetchone()[0]
        conn.close()

        base_speed = random.randint(110, 145)
        accuracy = round(99.7 + random.uniform(0.1, 0.25), 2)
        live_throughput = random.randint(1650, 1850)

        self.send_json({
            "success": True,
            "metrics": {
                "execution_speed_ms": base_speed,
                "ai_accuracy_percent": accuracy,
                "live_tasks_per_min": live_throughput,
                "total_workflows_logged": total_workflows,
                "total_newsletter_leads": total_leads,
                "active_projects": 48,
                "completed_tasks": 1284,
                "team_efficiency_percent": 94
            }
        })

    def handle_task_analyze(self, data):
        user_prompt = data.get("prompt", "").strip()
        if not user_prompt:
            self.send_json({"success": False, "error": "Prompt cannot be empty"}, status=400)
            return

        start_t = time.time()
        prompt_formatted = f"You are TaskFlow AI Task Assistant. A user wants to achieve: '{user_prompt}'. Break this down into 3 clear, structured subtasks with estimated duration and priority levels (High/Medium/Low). Keep response concise."

        ai_response = call_gemini_api(prompt_formatted)
        duration_ms = round((time.time() - start_t) * 1000)
        live_gemini_used = bool(ai_response)

        if not ai_response:
            ai_response = f"1. [HIGH PRIORITY] Define architecture & key deliverables for '{user_prompt}' (Est: 2 days)\n2. [MEDIUM PRIORITY] Implement core components & team workflow integration (Est: 3 days)\n3. [NORMAL PRIORITY] Review sprint performance analytics & launch to team workspace (Est: 1 day)"

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO task_analyses (user_prompt, generated_response, duration_ms)
            VALUES (?, ?, ?)
        """, (user_prompt, ai_response, duration_ms))
        conn.commit()
        conn.close()

        self.send_json({
            "success": True,
            "live_gemini_used": live_gemini_used,
            "metrics": {
                "duration_ms": duration_ms,
                "status": "success"
            },
            "output_preview": ai_response
        })

    def handle_workflow_simulate(self, data):
        start_t = time.time()
        trigger = data.get("trigger", "task_created")
        action = data.get("action", "ai_prioritize")
        output = data.get("output", "team_notify")

        duration_ms = random.randint(95, 160)
        tokens_processed = random.randint(190, 360)
        confidence_score = round(random.uniform(0.96, 0.99), 2)
        status = "success"

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO workflow_logs (trigger_type, action_type, output_type, status, duration_ms)
            VALUES (?, ?, ?, ?, ?)
        """, (trigger, action, output, status, duration_ms))
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()

        self.send_json({
            "success": True,
            "execution_id": f"taskflow-{log_id:06d}",
            "metrics": {
                "duration_ms": duration_ms,
                "tokens_processed": tokens_processed,
                "confidence_score": confidence_score,
                "status": status
            },
            "output_preview": f"[TASKFLOW ENGINE] Executed workflow pipeline: Trigger '{trigger}' -> Action '{action}' -> Output '{output}' in {duration_ms}ms (Tokens: {tokens_processed}, Precision: {int(confidence_score * 100)}%)"
        })

    def handle_roi_calculate(self, data):
        try:
            team_size = int(data.get("team_size", 10))
            hours_saved = int(data.get("hours_saved", 5))
        except (ValueError, TypeError):
            team_size = 10
            hours_saved = 5

        team_size = max(1, min(250, team_size))
        hours_saved = max(1, min(40, hours_saved))

        hourly_rate = 35
        weekly_hours = team_size * hours_saved
        annual_hours = weekly_hours * 50
        annual_dollar_savings = annual_hours * hourly_rate

        annual_software_cost = 499 * team_size * 12
        net_savings = max(0, annual_dollar_savings - annual_software_cost)

        self.send_json({
            "success": True,
            "results": {
                "annual_net_savings": round(net_savings, 2),
                "annual_hours_saved": annual_hours,
                "productivity_increase_percent": 32,
                "team_efficiency_percent": 94
            }
        })

    def get_client_ip(self):
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return self.client_address[0]

    def handle_auth_signup(self, data):
        client_ip = self.get_client_ip()
        if is_rate_limited(client_ip, limit=5, window_seconds=60):
            self.send_json({"success": False, "error": "Too many requests. Please wait a minute before trying again."}, status=429)
            return

        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        company = data.get("company", "").strip()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")

        if not name:
            self.send_json({"success": False, "error": "Full name is required."}, status=400)
            return

        email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
        if not email or not re.match(email_regex, email):
            self.send_json({"success": False, "error": "Please provide a valid work email address."}, status=400)
            return

        if len(password) < 8:
            self.send_json({"success": False, "error": "Password must be at least 8 characters long."}, status=400)
            return

        if password != confirm_password:
            self.send_json({"success": False, "error": "Passwords do not match."}, status=400)
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            self.send_json({"success": False, "error": "An account with this email address already exists."}, status=400)
            return

        pwd_hash = hash_password(password)
        try:
            cursor.execute("""
                INSERT INTO users (name, email, company, password_hash, auth_provider)
                VALUES (?, ?, ?, ?, 'email')
            """, (name, email, company, pwd_hash))
            user_id = cursor.lastrowid
            
            session_token = secrets.token_hex(32)
            expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("""
                INSERT INTO sessions (session_token, user_id, expires_at)
                VALUES (?, ?, ?)
            """, (session_token, user_id, expires_at))
            conn.commit()
            conn.close()

            set_session_cookie(self, session_token)
            self.send_json({
                "success": True,
                "user": {
                    "id": user_id,
                    "name": name,
                    "email": email,
                    "company": company,
                    "avatar_url": None,
                    "auth_provider": "email"
                }
            })
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            conn.close()
            self.send_json({"success": False, "error": "Database error while creating user account."}, status=500)

    def handle_auth_login(self, data):
        client_ip = self.get_client_ip()
        if is_rate_limited(client_ip, limit=5, window_seconds=60):
            self.send_json({"success": False, "error": "Too many failed attempts. Please wait a minute before trying again."}, status=429)
            return

        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            self.send_json({"success": False, "error": "Email and password are required."}, status=400)
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, company, password_hash, avatar_url, auth_provider
            FROM users WHERE email = ?
        """, (email,))
        row = cursor.fetchone()

        if not row or not row[4] or not verify_password(password, row[4]):
            conn.close()
            self.send_json({"success": False, "error": "Invalid email or password."}, status=401)
            return

        user_id, name, email_val, company, _, avatar_url, auth_provider = row

        cursor.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (user_id,))
        
        session_token = secrets.token_hex(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("""
            INSERT INTO sessions (session_token, user_id, expires_at)
            VALUES (?, ?, ?)
        """, (session_token, user_id, expires_at))
        conn.commit()
        conn.close()

        set_session_cookie(self, session_token)
        self.send_json({
            "success": True,
            "user": {
                "id": user_id,
                "name": name,
                "email": email_val,
                "company": company,
                "avatar_url": avatar_url,
                "auth_provider": auth_provider
            }
        })

    def handle_auth_logout(self):
        cookie_hdr = self.headers.get('Cookie', '')
        cookies = parse_cookies(cookie_hdr)
        token = cookies.get('taskflow_session')
        if token:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE session_token = ?", (token,))
            conn.commit()
            conn.close()

        clear_session_cookie(self)
        self.send_json({"success": True, "message": "Successfully logged out."})

    def handle_auth_me(self):
        user = get_session_user(self)
        if user:
            self.send_json({"success": True, "authenticated": True, "user": user})
        else:
            self.send_json({"success": True, "authenticated": False, "user": None})

    def handle_auth_google(self):
        client_id, client_secret, redirect_uri = get_google_config()
        if not client_id:
            self.send_redirect("/?auth_error=Google+Sign-In+is+not+configured")
            return

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "online",
            "prompt": "select_account"
        }
        google_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
        self.send_redirect(google_url)

    def handle_auth_google_callback(self):
        parsed_url = urlparse(self.path)
        qs = parse_qs(parsed_url.query)

        if "error" in qs:
            err_msg = urllib.parse.quote(qs["error"][0])
            self.send_redirect(f"/?auth_error={err_msg}")
            return

        code = qs.get("code", [None])[0]
        client_id, client_secret, redirect_uri = get_google_config()

        if not code or not client_id or not client_secret:
            self.send_redirect("/?auth_error=Google+authentication+failed")
            return

        try:
            token_url = "https://oauth2.googleapis.com/token"
            token_data = urllib.parse.urlencode({
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }).encode('utf-8')

            token_req = urllib.request.Request(
                token_url,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            with urllib.request.urlopen(token_req, timeout=10) as token_res:
                token_json = json.loads(token_res.read().decode('utf-8'))
                access_token = token_json.get("access_token")

            if not access_token:
                self.send_redirect("/?auth_error=Failed+to+obtain+Google+access+token")
                return

            userinfo_req = urllib.request.Request(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            with urllib.request.urlopen(userinfo_req, timeout=10) as userinfo_res:
                userinfo_json = json.loads(userinfo_res.read().decode('utf-8'))

            google_id = userinfo_json.get("sub")
            email = userinfo_json.get("email", "").lower()
            name = userinfo_json.get("name", "Google User")
            picture = userinfo_json.get("picture")

            if not email or not google_id:
                self.send_redirect("/?auth_error=Google+account+missing+email")
                return

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute("SELECT id, name, email, company, avatar_url FROM users WHERE google_id = ? OR email = ?", (google_id, email))
            row = cursor.fetchone()

            if row:
                user_id = row[0]
                cursor.execute("""
                    UPDATE users
                    SET google_id = ?, avatar_url = COALESCE(?, avatar_url), last_login_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (google_id, picture, user_id))
            else:
                cursor.execute("""
                    INSERT INTO users (name, email, google_id, avatar_url, auth_provider)
                    VALUES (?, ?, ?, ?, 'google')
                """, (name, email, google_id, picture))
                user_id = cursor.lastrowid

            session_token = secrets.token_hex(32)
            expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("""
                INSERT INTO sessions (session_token, user_id, expires_at)
                VALUES (?, ?, ?)
            """, (session_token, user_id, expires_at))
            conn.commit()
            conn.close()

            set_session_cookie(self, session_token)
            self.send_redirect("/#dashboard")
        except Exception as e:
            print(f"[GOOGLE AUTH ERROR] {e}")
            self.send_redirect("/?auth_error=Google+login+processing+error")

    def handle_protected_dashboard_data(self):
        user = get_session_user(self)
        if not user:
            self.send_json({"success": False, "error": "Unauthorized access. Please log in."}, status=401)
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM leads WHERE user_id = ?", (user["id"],))
        user_leads_count = cursor.fetchone()[0]
        conn.close()

        self.send_json({
            "success": True,
            "user": user,
            "workspace": {
                "active_projects": 12,
                "pending_tasks": 5,
                "completed_tasks": 48,
                "team_activity_score": 98,
                "user_leads_submitted": user_leads_count,
                "recent_activities": [
                    {"action": "AI Prioritization completed for Q3 Roadmap", "time": "12m ago", "status": "completed"},
                    {"action": "Kanban Sprint board created", "time": "1h ago", "status": "active"},
                    {"action": "Workflow Simulator run executed", "time": "3h ago", "status": "completed"}
                ]
            }
        })

    def handle_auth_forgot_password(self, data):
        client_ip = self.get_client_ip()
        if is_rate_limited(client_ip, limit=3, window_seconds=60):
            self.send_json({"success": False, "error": "Too many reset attempts. Please wait a minute before trying again."}, status=429)
            return

        email = data.get("email", "").strip().lower()
        if not email or "@" not in email or "." not in email:
            self.send_json({"success": False, "error": "Please provide a valid work email address."}, status=400)
            return

        smtp_host, smtp_port, smtp_user, smtp_password, _, _ = get_smtp_config()
        smtp_configured = bool(smtp_host and smtp_user and smtp_password)
        if not smtp_configured:
            self.send_json({
                "success": False,
                "configured": False,
                "error": "Password reset email delivery is not yet configured. Please contact your workspace administrator."
            }, status=400)
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()

        if row:
            user_id, name = row
            raw_token = secrets.token_hex(32)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')

            cursor.execute("""
                INSERT INTO password_resets (user_id, token_hash, expires_at)
                VALUES (?, ?, ?)
            """, (user_id, token_hash, expires_at))
            conn.commit()

            base_site_url = os.environ.get("BASE_URL", "").strip()
            if not base_site_url:
                _, _, redirect_uri = get_google_config()
                base_site_url = redirect_uri.split('/api/auth/')[0] if '/api/auth/' in redirect_uri else f"http://localhost:{PORT}"
            reset_url = f"{base_site_url}/?reset_token={raw_token}"

            send_password_reset_email(email, reset_url)

        conn.close()
        self.send_json({
            "success": True,
            "configured": True,
            "message": "If an account with that email exists, password reset instructions have been sent."
        })

    def handle_auth_reset_password(self, data):
        client_ip = self.get_client_ip()
        if is_rate_limited(client_ip, limit=5, window_seconds=60):
            self.send_json({"success": False, "error": "Too many requests. Please wait a minute before trying again."}, status=429)
            return

        raw_token = data.get("token", "").strip()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")

        if not raw_token:
            self.send_json({"success": False, "error": "Invalid or missing reset token."}, status=400)
            return

        if len(password) < 8:
            self.send_json({"success": False, "error": "Password must be at least 8 characters long."}, status=400)
            return

        if password != confirm_password:
            self.send_json({"success": False, "error": "Passwords do not match."}, status=400)
            return

        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("""
            SELECT id, user_id, expires_at, used
            FROM password_resets
            WHERE token_hash = ?
        """, (token_hash,))
        row = cursor.fetchone()

        if not row or row[3] == 1:
            conn.close()
            self.send_json({"success": False, "error": "Invalid or already used password reset link."}, status=400)
            return

        reset_id, user_id, expires_at_str, used = row
        if expires_at_str < now_str:
            conn.close()
            self.send_json({"success": False, "error": "This password reset link has expired. Please request a new one."}, status=400)
            return

        pwd_hash = hash_password(password)
        try:
            cursor.execute("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (pwd_hash, user_id))
            cursor.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset_id,))
            conn.commit()
            conn.close()

            self.send_json({
                "success": True,
                "message": "Password updated successfully! You can now log in with your new password."
            })
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            conn.close()
            self.send_json({"success": False, "error": "Database error while updating password."}, status=500)

    def handle_lead_subscribe(self, data):
        email = data.get("email", "").strip()
        name = data.get("name", "").strip()
        company = data.get("company", "").strip()
        message = data.get("message", "").strip()
        source = data.get("source", "contact_sales").strip()

        if not email or "@" not in email or "." not in email:
            self.send_json({"success": False, "error": "A valid work email address is required."}, status=400)
            return

        if source in ["contact_sales", "request_demo"]:
            if not name:
                self.send_json({"success": False, "error": "Name is required."}, status=400)
                return
            if source == "contact_sales" and not message:
                self.send_json({"success": False, "error": "Message is required for sales inquiries."}, status=400)
                return

        user = get_session_user(self)
        user_id = user["id"] if user else None

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO leads (email, name, company, message, source, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (email, name, company, message, source, user_id))
            conn.commit()
            lead_id = cursor.lastrowid
            conn.close()
            
            msg = "Thank you! Your sales inquiry has been received. Our team will contact you shortly." if source == "contact_sales" else "Demo request submitted! We will reach out to set up your workspace."
            
            self.send_json({
                "success": True,
                "message": msg,
                "lead_id": lead_id,
                "email": email
            })
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            conn.close()
            self.send_json({
                "success": False,
                "error": "Unable to save your request. Please try again."
            }, status=500)

# --- Main Entry Point ---
if __name__ == "__main__":
    init_db()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), TaskFlowRequestHandler) as httpd:
        print(f"[TASKFLOW BACKEND SERVER READY] Listening on http://localhost:{PORT}")
        if os.environ.get("GEMINI_API_KEY"):
            print("[GEMINI AI CONNECTED] Live Google Gemini 3.6 Flash model enabled!")
        else:
            print("[GEMINI AI OPTIONAL] Running in high-performance simulation mode.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Shutting down server...")
            httpd.server_close()
