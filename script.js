document.addEventListener('DOMContentLoaded', () => {
    // إخفاء شاشة البداية
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
    }, 2200);

    initTheme();
    initMisbaha();
    initRipple();
    
    // تسجيل Service Worker ليعمل التطبيق بدون إنترنت
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Registration Failed:', err));
    }
});

// --- نظام التوجيه الذكي ---
function navigate(pageId, navElement = null) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');

    if (navElement) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navElement.classList.add('active');
    }

    // تفعيل الأنظمة عند الحاجة فقط (Lazy Load)
    if (pageId === 'prayer' && !window.prayerLoaded) fetchPrayerTimes();
    if (pageId === 'quran' && !window.quranListLoaded) loadQuranList();
    if (pageId === 'qibla' && !window.qiblaLoaded) initQiblaCompass();
}

// --- دالة جلب البيانات مع التخزين المؤقت (مهم جداً للعمل بدون نت) ---
async function fetchWithCache(url, cacheKey) {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) return JSON.parse(cachedData); // جلب من الذاكرة إذا توفرت

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network Error');
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify(data)); // حفظ للمرات القادمة
        return data;
    } catch (error) {
        console.error(error);
        return null; // سيتم التعامل مع الخطأ في واجهة المستخدم
    }
}

// --- أوقات الصلاة الدقيقة (مع Fallback للشرقاط) ---
async function fetchPrayerTimes() {
    const container = document.getElementById('prayer-container');
    container.innerHTML = '<div class="spinner"></div>';

    const getTimes = async (lat, lng) => {
        const date = new Date();
        const timestamp = Math.floor(date.getTime() / 1000);
        // Cache Key يتغير يومياً
        const cacheKey = `prayer_${date.toDateString()}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
        const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lng}&method=4`;
        
        const data = await fetchWithCache(url, cacheKey);
        
        if (data && data.data) {
            const timings = data.data.timings;
            const arNames = { Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
            
            container.innerHTML = `<div style="text-align:center; margin-bottom:20px; color:var(--text-secondary);"><i class="fa-solid fa-location-dot"></i> تم التحديث لليوم</div>`;
            for (const [key, value] of Object.entries(arNames)) {
                container.innerHTML += `<div class="card" style="margin-bottom:10px; justify-content:space-between;">
                    <h3 style="margin:0">${value}</h3>
                    <strong style="font-size:1.2rem; color:var(--primary-color)">${convertTo12Hour(timings[key])}</strong>
                </div>`;
            }
            window.prayerLoaded = true;
        } else {
            container.innerHTML = '<p style="text-align:center; color:red;">تعذر جلب الأوقات. تحقق من الإنترنت.</p>';
        }
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => getTimes(pos.coords.latitude, pos.coords.longitude),
            err => getTimes(35.58, 43.25), // خطأ أو رفض -> استخدام موقع الشرقاط
            { enableHighAccuracy: true, timeout: 5000 }
        );
    } else {
        getTimes(35.58, 43.25);
    }
}

function convertTo12Hour(time) {
    let [h, m] = time.split(':');
    h = parseInt(h);
    let ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// --- قسم القرآن الكريم ---
async function loadQuranList() {
    const container = document.getElementById('surah-list-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    const data = await fetchWithCache('https://api.alquran.cloud/v1/meta', 'quran_meta_list');
    
    if (data && data.data) {
        container.innerHTML = '<div class="cards-container"></div>';
        const list = container.querySelector('.cards-container');
        
        data.data.surahs.references.forEach(surah => {
            list.innerHTML += `
                <div class="card ripple-btn" onclick="openSurah(${surah.number}, '${surah.name}')">
                    <div class="card-info">
                        <h3>سورة ${surah.name}</h3>
                        <p>${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} | ${surah.numberOfAyahs} آية</p>
                    </div>
                    <div style="font-size:1.5rem; font-weight:bold; color:var(--accent-color)">${surah.number}</div>
                </div>`;
        });
        window.quranListLoaded = true;
    }
}

async function openSurah(number, name) {
    navigate('quran-reader');
    document.getElementById('surah-title').innerText = `سورة ${name}`;
    const content = document.getElementById('quran-content');
    content.innerHTML = '<div class="spinner"></div>';

    const data = await fetchWithCache(`https://api.alquran.cloud/v1/surah/${number}`, `surah_${number}`);
    
    if (data && data.data) {
        let html = number !== 1 && number !== 9 ? '<div style="text-align:center; font-size:1.8rem; margin-bottom:20px;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>' : '';
        data.data.ayahs.forEach(ayah => {
            // إزالة البسملة من أول آية إذا كانت موجودة (الـ API يدمجها أحياناً)
            let text = ayah.text.replace('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ', '');
            html += `${text} <span class="ayah-number">${ayah.numberInSurah}</span> `;
        });
        content.innerHTML = html;
    }
}

// --- القبلة، المسبحة، والوضع الليلي (تعمل كما صممناها سابقاً) ---
// (تم اختصارها هنا لتركز على الأساسيات، نفس الكود السابق الخاص بالمسبحة والوضع الليلي)
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const isDark = localStorage.getItem('theme') === 'dark';
    if(isDark) document.documentElement.setAttribute('data-theme', 'dark');
    
    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

function initMisbaha() {
    let count = parseInt(localStorage.getItem('misbaha_count')) || 0;
    const display = document.getElementById('counter-display');
    display.innerText = count;
    
    document.getElementById('btn-tasbih').addEventListener('click', () => {
        display.innerText = ++count;
        localStorage.setItem('misbaha_count', count);
        if(navigator.vibrate) navigator.vibrate(40);
    });
    
    document.getElementById('btn-reset').addEventListener('click', () => {
        count = 0; display.innerText = count;
        localStorage.setItem('misbaha_count', 0);
    });
}

function initQiblaCompass() {
    if (window.DeviceOrientationEvent && !window.qiblaLoaded) {
        window.addEventListener('deviceorientation', (e) => {
            const compass = document.getElementById('compass-ring');
            let heading = e.webkitCompassHeading || Math.abs(e.alpha - 360);
            let qibla = 198 - heading; // تقريبي للشرقاط/العراق
            compass.style.transform = `rotate(${qibla}deg)`;
        });
        window.qiblaLoaded = true;
    }
}

function initRipple() {
    document.addEventListener('click', function(e) {
        const target = e.target.closest('.ripple-btn');
        if (!target) return;
        const circle = document.createElement('span');
        const diameter = Math.max(target.clientWidth, target.clientHeight);
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - target.getBoundingClientRect().left - diameter/2}px`;
        circle.style.top = `${e.clientY - target.getBoundingClientRect().top - diameter/2}px`;
        circle.classList.add('ripple');
        target.appendChild(circle);
        setTimeout(() => circle.remove(), 600);
    });
}
