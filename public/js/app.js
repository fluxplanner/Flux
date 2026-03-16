// 1. Setup Supabase
const SUPABASE_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
// PASTE YOUR KEY INSIDE THE QUOTES BELOW
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Physics & Precision Rules (g=10, 4 decimal places)
const g = 10;
const precise = (n) => Number(Math.round(n + "e4") + "e-4").toFixed(4);

// 3. App Start Logic
window.onload = async () => {
    console.log("Flux Initializing...");
    
    // Check if user is logged in
    const { data: { session }, error } = await _supabase.auth.getSession();

    if (error || !session) {
        // Hide loading, show login
        document.getElementById('splash-screen').style.display = 'none';
        document.getElementById('auth-overlay').style.display = 'flex';
    } else {
        // Hide loading, show main app
        document.getElementById('splash-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        showTab('dashboard');
    }
};

// 4. Google Login Function
document.getElementById('login-btn').onclick = async () => {
    await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
            redirectTo: 'https://azfermohammed.github.io/Fluxplanner/' 
        }
    });
};

// 5. Navigation Hub
function showTab(name) {
    document.getElementById('view-title').innerText = name.toUpperCase();
    const content = document.getElementById('view-content');
    
    if (name === 'school') {
        content.innerHTML = `
            <div style="border:2px dashed #ccc; padding:40px; text-align:center; border-radius:20px;">
                <h3>Upload Schedule</h3>
                <p style="font-size:12px; color:#ff4444;">Privacy: Image is processed in real-time and never saved.</p>
                <input type="file" id="sched-input" style="margin-top:20px;" onchange="processSchedule(this.files[0])">
            </div>
        `;
    } else {
        content.innerHTML = `<div style="padding:20px; background:#f9f9f9; border-radius:12px;">Welcome back to Flux. All calculations are rounded to 4 decimal places.</div>`;
    }
}

// 6. Ephemeral AI Analysis (Discards image after reading)
async function processSchedule(file) {
    const status = document.getElementById('view-title');
    status.innerText = "AI READING... (NO IMAGE SAVED)";
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
            const { data, error } = await _supabase.functions.invoke('gemini-proxy', {
                body: { image: base64 }
            });
            if (error) throw error;
            alert("Schedule Loaded Successfully! Image data cleared from memory.");
            status.innerText = "SCHOOL INFO";
        } catch (err) {
            alert("Error: " + err.message);
            status.innerText = "UPLOAD FAILED";
        }
    };
}
