// --- App Initialization & State ---
document.addEventListener('DOMContentLoaded', () => {
    // Splash Screen Logic
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
    }, 2800);

    // Theme Initialization
    initTheme();

    // Misbaha Initialization
    initMisbaha();
});

// --- Theme Management (Light/Dark) ---
const themeToggleBtn = document.getElementById('theme-toggle');
function initTheme() {
    const savedTheme = localStorage.getItem('bayan-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('bayan-theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
}

// --- SPA Navigation (Routing) ---
function navigate(pageId, navElement = null) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(`page-${pageId}`).classList.add('active');

    // Update Bottom Nav UI
    if (navElement) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        navElement.classList.add('active');
    }

    // Lazy load logic based on page
    if (pageId === 'prayer' && !window.prayerLoaded) {
        fetchPrayerTimes();
    }
}

// --- API Utility Function with Error Handling ---
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('فشل الاتصال بالخادم');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// --- Prayer Times Feature ---
async function fetchPrayerTimes() {
    const container = document.getElementById('prayer-container');
    // Using Al Shirqat, Iraq as the default coordinates/city for accurate local times
    const API_URL = 'https://api.aladhan.com/v1/timingsByCity?city=Al%20Shirqat&country=Iraq&method=4';
    
    const data = await fetchData(API_URL);
    
    if (data && data.data) {
        const timings = data.data.timings;
        const prayerNamesAr = {
            Fajr: "الفجر",
            Sunrise: "الشروق",
            Dhuhr: "الظهر",
            Asr: "العصر",
            Maghrib: "المغرب",
            Isha: "العشاء"
        };

        container.innerHTML = ''; // Clear spinner

        for (const [key, value] of Object.entries(prayerNamesAr)) {
            const time12hr = convertTo12Hour(timings[key]);
            container.innerHTML += `
                <div class="prayer-item">
                    <h3>${value}</h3>
                    <strong>${time12hr}</strong>
                </div>
            `;
        }
        window.prayerLoaded = true;
    } else {
        container.innerHTML = `
            <div style="text-align:center; color:red; margin-top:20px;">
                <i class="fa-solid fa-triangle-exclamation"></i> عذراً، فشل تحميل أوقات الصلاة. يرجى التحقق من الاتصال.
            </div>`;
    }
}

function convertTo12Hour(time) {
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    let ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${minutes} ${ampm}`;
}

// --- Misbaha Feature ---
function initMisbaha() {
    let count = parseInt(localStorage.getItem('bayan-misbaha-count')) || 0;
    const display = document.getElementById('counter-display');
    const btnTasbih = document.getElementById('btn-tasbih');
    const btnReset = document.getElementById('btn-reset');

    display.innerText = count;

    btnTasbih.addEventListener('click', () => {
        count++;
        display.innerText = count;
        localStorage.setItem('bayan-misbaha-count', count);
        
        // Vibrate if supported by device
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    });

    btnReset.addEventListener('click', () => {
        count = 0;
        display.innerText = count;
        localStorage.setItem('bayan-misbaha-count', count);
    });
}
