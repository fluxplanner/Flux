// --- Flux Configuration ---
const SUPABASE_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // PASTE YOUR KEY HERE
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const physics_g = 10; // Physics constant

// Math Precision Rule
function precise(num) {
    return Number(Math.round(num + "e4") + "e-4").toFixed(4);
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initApp();
});

async function initApp() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        document.getElementById('auth-overlay').style.display = 'flex';
    } else {
        document.getElementById('app').style.display = 'flex';
        document.getElementById('splash-screen').style.display = 'none';
    }
}

// Google Login with Correct Redirect
document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://azfermohammed.github.io/Fluxplanner/'
        }
    });
    if (error) console.error("Login Error:", error.message);
});

// Ephemeral Schedule Analysis (No Saving)
async function analyzeSchedule(file) {
    const status = document.getElementById('upload-status');
    status.innerText = "Reading schedule... (No image will be saved)";
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
            const { data, error } = await _supabase.functions.invoke('gemini-proxy', {
                body: { image: base64 }
            });
            if (error) throw error;
            status.innerText = "Success! Data extracted & image discarded.";
        } catch (err) {
            status.innerText = "Analysis failed.";
        }
    };
}
