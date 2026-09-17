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
import urllib.error
from datetime import datetime
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
        if origin and ("localhost" in origin or "127.0.0.1" in origin):
            self.send_header('Access-Control-Allow-Origin', origin)
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
        elif path == "/api/user/preferences":
            self.handle_get_preferences()
        elif path == "/api/navigation/menu":
            self.handle_navigation_menu()
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

        if path == "/api/user/preferences":
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
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

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
            "timestamp": datetime.utcnow().isoformat() + "Z"
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

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO leads (email, name, company, message, source)
                VALUES (?, ?, ?, ?, ?)
            """, (email, name, company, message, source))
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
