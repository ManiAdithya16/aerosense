// ── AUTH GUARD ────────────────────────────────────────────────────────────────
(function () {
    if (!localStorage.getItem('aerosense_token')) {
        window.location.href = 'login.html';
    }
})();

function logout() {
    localStorage.removeItem('aerosense_token');
    localStorage.removeItem('aerosense_username');
    window.location.href = 'login.html';
}

function authHeaders() {
    return { 'Authorization': 'Bearer ' + localStorage.getItem('aerosense_token') };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function showSkeleton(id)  { document.getElementById('sk-' + id).style.display = ''; }
function hideSkeleton(id)  { document.getElementById('sk-' + id).style.display = 'none'; }
function showImg(id, src) {
    const img = document.getElementById('img-' + id);
    img.src = src;
    img.style.display = 'block';
}
function showError(id, msg) {
    hideSkeleton(id);
    const img = document.getElementById('img-' + id);
    img.style.display = 'none';
    const body = img.parentElement;
    // Remove any old error
    const old = body.querySelector('.plot-error');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'plot-error';
    div.textContent = '⚠ ' + msg;
    body.appendChild(div);
}

function setStatus(msg) {
    document.getElementById('status-bar').textContent = msg;
}

// ── MAIN LOAD ─────────────────────────────────────────────────────────────────
async function loadAllPlots() {
    const btn = document.getElementById('reload-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Computing SHAP values…';

    // Show all skeletons, hide images
    ['beeswarm', 'bar', 'force', 'waterfall', 'decision', 'dependence'].forEach(id => {
        showSkeleton(id);
        const img = document.getElementById('img-' + id);
        img.style.display = 'none';
        img.src = '';
        const err = img.parentElement.querySelector('.plot-error');
        if (err) err.remove();
    });
    document.getElementById('dep-interaction').textContent = '';

    setStatus('Generating 60 synthetic samples and computing SHAP values — this takes ~10 seconds…');

    // Load main plots and dependence concurrently
    const [mainOk] = await Promise.all([
        fetchMainPlots(),
        loadDependence()
    ]);

    btn.disabled = false;
    btn.textContent = '🔄 Refresh Plots';
    if (mainOk) {
        setStatus('✅ All SHAP plots generated successfully. Use the feature dropdown to explore dependence plots.');
    } else {
        setStatus('⚠ Some plots failed to generate. Check the server logs.');
    }
}

async function fetchMainPlots() {
    try {
        const res = await fetch('/api/viz/shap', { headers: authHeaders() });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Server error' }));
            ['beeswarm', 'bar', 'force', 'waterfall', 'decision'].forEach(id => {
                showError(id, err.detail || 'Failed to generate plot.');
            });
            return false;
        }

        const data = await res.json();
        const map = {
            beeswarm: data.beeswarm,
            bar:       data.bar,
            force:     data.force,
            waterfall: data.waterfall,
            decision:  data.decision
        };

        Object.entries(map).forEach(([id, src]) => {
            hideSkeleton(id);
            if (src) {
                showImg(id, src);
            } else {
                showError(id, 'Plot not returned from server.');
            }
        });
        return true;
    } catch (e) {
        ['beeswarm', 'bar', 'force', 'waterfall', 'decision'].forEach(id => {
            showError(id, 'Network error: ' + e.message);
        });
        return false;
    }
}

// ── DEPENDENCE PLOT ───────────────────────────────────────────────────────────
async function loadDependence() {
    const feature = document.getElementById('feat-select').value;
    showSkeleton('dependence');
    document.getElementById('img-dependence').style.display = 'none';
    document.getElementById('dep-interaction').textContent = 'Computing…';

    const old = document.getElementById('img-dependence').parentElement.querySelector('.plot-error');
    if (old) old.remove();

    try {
        const res = await fetch(`/api/viz/shap/dependence?feature=${encodeURIComponent(feature)}`,
            { headers: authHeaders() });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Server error' }));
            showError('dependence', err.detail || 'Dependence plot failed.');
            document.getElementById('dep-interaction').textContent = '';
            return false;
        }

        const data = await res.json();
        hideSkeleton('dependence');
        showImg('dependence', data.image);
        document.getElementById('dep-interaction').textContent =
            `Auto-detected interaction feature: ${data.interaction_feature}`;
        return true;
    } catch (e) {
        showError('dependence', 'Network error: ' + e.message);
        document.getElementById('dep-interaction').textContent = '';
        return false;
    }
}
