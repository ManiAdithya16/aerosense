// ── AUTH GUARD ────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'aerosense_token';
const USER_KEY  = 'aerosense_username';
const ADMIN_KEY = 'aerosense_is_admin';

function getToken()  { return localStorage.getItem(TOKEN_KEY); }
function isAdmin()   { return localStorage.getItem(ADMIN_KEY) === 'true'; }
function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}

// Redirect to login if not authenticated
(function checkAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
        return;
    }
    const name  = localStorage.getItem(USER_KEY) || 'User';
    const admin = isAdmin();

    const nameEl   = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const labelEl  = document.querySelector('.user-label');

    if (nameEl)   nameEl.textContent   = name;
    if (avatarEl) {
        avatarEl.textContent = name.charAt(0).toUpperCase();
        if (admin) {
            avatarEl.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
            avatarEl.style.boxShadow  = '0 0 12px rgba(245,158,11,.5)';
            avatarEl.title = 'Administrator';
        }
    }
    if (labelEl) {
        if (admin) {
            labelEl.innerHTML = '<span style="color:#f59e0b;font-weight:600;font-size:11px">⭐ Administrator</span>';
        } else {
            labelEl.textContent = 'Logged in';
        }
    }
    // Show admin nav button if admin
    const adminBtn = document.getElementById('admin-nav-btn');
    if (adminBtn && admin) adminBtn.classList.add('visible');
})();

function logout() {
    ['aerosense_token','aerosense_username','aerosense_is_admin','aerosense_remember'].forEach(k => localStorage.removeItem(k));
    window.location.href = 'login.html';
}

// ── GLOBAL STATE ──────────────────────────────────────────────────────────────
let socket;
let isSimulating = false;
let latestContext = {};
let liveRulChart, featureChart, historyChart;

// ── CHART INIT ────────────────────────────────────────────────────────────────
window.onload = function () {
    const ctxRUL = document.getElementById('rulChart').getContext('2d');
    liveRulChart = new Chart(ctxRUL, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Predicted RUL',
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true, data: [], tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#334155' } } }
        }
    });

    const ctxFeat = document.getElementById('featureChart').getContext('2d');
    featureChart = new Chart(ctxFeat, {
        type: 'bar',
        data: {
            labels: ['Sensor A', 'Sensor B', 'Sensor C'],
            datasets: [{
                label: 'SHAP Impact Score',
                backgroundColor: ['#ef4444', '#f97316', '#eab308'],
                data: [0, 0, 0], borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#334155' }, beginAtZero: true },
                y: { grid: { display: false }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#f1f5f9', font: { size: 14, weight: 'bold' } } }
            }
        }
    });
};

// ── SIMULATION (WEBSOCKET) ────────────────────────────────────────────────────
function toggleSimulation() {
    const btn = document.getElementById('sim-btn');
    const statusDiv = document.getElementById('connection-status');

    if (!isSimulating) {
        socket = new WebSocket("ws://" + window.location.host + "/ws/simulate");

        socket.onopen = () => {
            isSimulating = true;
            btn.innerText = "Stop Simulation";
            btn.style.backgroundColor = "#ef4444";
            statusDiv.innerText = "SYSTEM ONLINE";
            statusDiv.className = "status-indicator online";
        };
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            updateLiveDashboard(data);
        };
        socket.onclose = () => {
            isSimulating = false;
            btn.innerText = "Start Simulation";
            btn.style.backgroundColor = "#3b82f6";
            statusDiv.innerText = "Disconnected";
            statusDiv.className = "status-indicator offline";
        };
    } else {
        socket.close();
    }
}

function updateLiveDashboard(data) {
    latestContext = data;

    document.getElementById('rul-val').innerText = data.RUL.toFixed(1);
    document.getElementById('health-val').innerText = data.health_index.toFixed(0) + "%";

    const statusEl = document.getElementById('status-val');
    const bar = document.getElementById('health-bar');
    statusEl.innerText = data.status.toUpperCase();

    let color = "#22c55e";
    if (data.status === "Critical") color = "#ef4444";
    else if (data.status === "Warning") color = "#eab308";

    statusEl.style.color = color;
    bar.style.backgroundColor = color;
    bar.style.width = data.health_index + "%";

    if (liveRulChart.data.labels.length > 50) {
        liveRulChart.data.labels.shift();
        liveRulChart.data.datasets[0].data.shift();
    }
    liveRulChart.data.labels.push(data.cycle);
    liveRulChart.data.datasets[0].data.push(data.RUL);
    liveRulChart.update('none');

    if (data.shap_scores) {
        featureChart.data.labels = Object.keys(data.shap_scores);
        featureChart.data.datasets[0].data = Object.values(data.shap_scores);
        featureChart.update();
    }
}

// ── CHAT AI ───────────────────────────────────────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('user-input');
    const query = input.value.trim();
    if (!query) return;

    addMessage('user', query);
    input.value = '';

    try {
        addMessage('system', 'Analyzing telemetry…');

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ query, context: latestContext })
        });

        const result = await response.json();

        // Remove 'Analyzing…'
        document.getElementById('chat-window').lastElementChild.remove();
        addMessage('ai', marked.parse(result.response));
    } catch (e) {
        addMessage('system', 'Error connecting to AI.');
    }
}

function addMessage(role, text) {
    const chatWin = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = text;
    chatWin.appendChild(div);
    chatWin.scrollTop = chatWin.scrollHeight;
}

// ── FILE UPLOAD ───────────────────────────────────────────────────────────────
async function uploadFile() {
    const fileInput = document.getElementById('csv-upload');
    const msg = document.getElementById('upload-msg');

    if (fileInput.files.length === 0) { alert("Please select a file first."); return; }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    msg.innerText = "Processing…";

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getToken() },
            body: formData
        });
        if (!res.ok) throw new Error("Upload failed");
        const result = await res.json();
        msg.innerText = `Analysis Complete. Processed ${result.total_rows} cycles.`;
        renderHistoryChart(result.data);
        document.getElementById('history-results').style.display = 'block';
    } catch (e) {
        msg.innerText = "Error: " + e.message;
    }
}

function renderHistoryChart(data) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    const cycles = data.map(d => d.cycle);
    const ruls = data.map(d => d.RUL);
    if (historyChart) historyChart.destroy();
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: cycles,
            datasets: [{
                label: 'Historical RUL Analysis',
                data: ruls,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true, tension: 0.1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#334155' } },
                x: { grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#334155' } }
            }
        }
    });
}

// ── CHAT HISTORY ──────────────────────────────────────────────────────────────
async function loadChatHistory() {
    const container = document.getElementById('chat-history-list');
    container.innerHTML = '<div class="ch-empty">Loading…</div>';

    try {
        const res = await fetch('/api/chat/history', { headers: authHeaders() });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();

        if (!data.messages || data.messages.length === 0) {
            container.innerHTML = '<div class="ch-empty">No chat history yet. Start a simulation and ask the AI assistant!</div>';
            return;
        }

        container.innerHTML = '';
        data.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `ch-message ch-${msg.role}`;

            const ts = new Date(msg.timestamp + 'Z').toLocaleString(undefined, {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const roleLabel = msg.role === 'user' ? '👤 You' : '🤖 AI';

            div.innerHTML = `
                <div class="ch-meta">
                    <span class="ch-role">${roleLabel}</span>
                    <span class="ch-time">${ts}</span>
                </div>
                <div class="ch-content">${msg.role === 'ai' ? marked.parse(msg.message) : escapeHtml(msg.message)}</div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = '<div class="ch-empty">Error loading chat history.</div>';
    }
}

async function clearChatHistory() {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;
    await fetch('/api/chat/history', { method: 'DELETE', headers: authHeaders() });
    loadChatHistory();
}

function escapeHtml(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');
    if (btn) btn.classList.add('active');
    if (tab === 'chat-history') loadChatHistory();
}