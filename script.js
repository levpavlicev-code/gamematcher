const SUPABASE_URL = "https://jstfzbftvjedkkxifviy.supabase.co";
const SUPABASE_KEY = "sb_publishable_IbHPoPmgXe0OcF_m8Uzujg_hIEueo9x";
const ZVENO_KEY = "sk-wqkSR90zQEGnrDlZoUGMzgfxecd6NKZy7X0s8LnszLc";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// --- ФОН ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
const particleCount = 80;
const connectionDistance = 150;

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5; this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(96, 165, 250, 0.8)'; ctx.fill(); }
}
for (let i = 0; i < particleCount; i++) particles.push(new Particle());
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x; const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < connectionDistance) {
                ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(96, 165, 250, ${0.15 * (1 - dist / connectionDistance)})`; ctx.lineWidth = 1; ctx.stroke();
            }
        }
    }
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ФИЛЬТРЫ И ВОПРОСЫ ПОД ИГРЫ
const GAME_CONFIG = {
    'Counter-Strike 2': { question: { key: 'rank', label: 'Твой ранг', placeholder: 'Silver / MG / Global...' }, styles: ['Снайпер (AWPer)', 'Стрелок (Rifler)', 'Поддержка (Support)', 'Защитник (Anchor)'] },
    'Dota 2': { question: { key: 'rank', label: 'Твой ранг (MMR)', placeholder: 'Herald / Legend / Divine...' }, styles: ['Керри (Carry)', 'Мидер (Mid)', 'Оффлейнер (Offlane)', 'Саппорт (Support)'] },
    'Valorant': { question: { key: 'rank', label: 'Твой ранг', placeholder: 'Iron / Gold / Immortal...' }, styles: ['Дуэлянт', 'Инициатор', 'Страж', 'Контроллер'] },
    'League of Legends': { question: { key: 'rank', label: 'Твой ранг', placeholder: 'Iron / Gold / Challenger...' }, styles: ['Топ', 'Лес', 'Мид', 'Бот', 'Саппорт'] },
    'Minecraft': { question: { key: 'mode', label: 'Любимый режим', placeholder: 'Survival / Creative / Hardcore...' }, styles: ['Строитель', 'Шахтер', 'Фермер', 'Исследователь', 'Воин (PvP)'] },
    'Rust': { question: { key: 'hours', label: 'Часы в Rust', placeholder: 'например 500' }, styles: ['Фармер', 'Строитель', 'Рейдер', 'Клановый игрок'] },
    'Fortnite': { question: { key: 'mode', label: 'Режим игры', placeholder: 'Solo / Duo / Squad' }, styles: ['Строитель', 'Штурмовик', 'Тактик'] }
};

document.addEventListener("DOMContentLoaded", async () => {
    const loader = document.getElementById("loader"), gamesGrid = document.getElementById("gamesGrid"), searchInput = document.getElementById("searchInput"), searchContainer = document.getElementById("searchContainer");
    let allGames = [], isLoaded = false, currentGame = null, chartsBuilt = false, displayCount = 100;
    let currentUser = null;
    let editingTmId = null;
    let activeChatFriend = null;

    // --- АВТОРИЗАЦИЯ ---
    async function checkUser() {
        const { data: { user } } = await _supabase.auth.getUser();
        currentUser = user;
        if (user) {
            document.getElementById("btnLogin").style.display = "none";
            document.getElementById("user-info").style.display = "block";
            document.getElementById("menuUserEmail").innerText = user.email;
            updateOnlineStatus();
            
            let avatar = localStorage.getItem('avatar_' + user.id);
            if (avatar) {
                document.getElementById("user-avatar").src = avatar;
                document.getElementById("menuUserAvatar").src = avatar;
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = 100; canvas.height = 100;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(0, 0, 100, 100);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 50px Montserrat';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(user.email.charAt(0).toUpperCase(), 50, 50);
                document.getElementById("user-avatar").src = canvas.toDataURL();
                document.getElementById("menuUserAvatar").src = canvas.toDataURL();
            }
            updateRequestBadge();
        } else {
            document.getElementById("btnLogin").style.display = "block";
            document.getElementById("user-info").style.display = "none";
            document.getElementById("profileMenu").style.display = "none";
        }
    }
    checkUser();

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') { 
            currentUser = session.user; 
            document.getElementById("btnLogin").style.display = "none"; 
            document.getElementById("user-info").style.display = "block"; 
            document.getElementById("menuUserEmail").innerText = session.user.email; 
            closeAuthModal(); 
            updateOnlineStatus(); 
            checkUser();
        }
        else if (event === 'SIGNED_OUT') { 
            currentUser = null; 
            document.getElementById("btnLogin").style.display = "block"; 
            document.getElementById("user-info").style.display = "none"; 
            document.getElementById("profileMenu").style.display = "none";
        }
    });

    window.showAuthModal = () => document.getElementById("authModal").style.display = "block";
    window.closeAuthModal = () => document.getElementById("authModal").style.display = "none";
    
    window.handleAuth = async () => {
        const email = document.getElementById("authEmail").value, password = document.getElementById("authPassword").value, errorEl = document.getElementById("authError");
        errorEl.style.display = "none";
        let { error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) {
            if (error.message.includes("Invalid login credentials")) errorEl.innerText = "Неверный пароль или почта.";
            else errorEl.innerText = error.message;
            errorEl.style.display = "block";
        }
    }
    window.handleSignUp = async () => {
        const email = document.getElementById("authEmail").value, password = document.getElementById("authPassword").value, errorEl = document.getElementById("authError");
        errorEl.style.display = "none";
        let { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) { errorEl.innerText = error.message; errorEl.style.display = "block"; } 
        else { alert("Регистрация успешна! Проверьте почту."); closeAuthModal(); }
    }
    window.logout = async () => { 
        await _supabase.auth.signOut(); 
        currentUser = null; 
        document.getElementById("btnLogin").style.display = "block"; 
        document.getElementById("user-info").style.display = "none"; 
        document.getElementById("profileMenu").style.display = "none";
        alert("Вы вышли из аккаунта."); 
    };

    window.toggleProfileMenu = (event) => {
        event.stopPropagation();
        const menu = document.getElementById('profileMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    };

    window.addEventListener('click', (event) => {
        const menu = document.getElementById('profileMenu');
        const container = document.getElementById('auth-container');
        if (menu && menu.style.display === 'block' && !container.contains(event.target)) {
            menu.style.display = 'none';
        }
    });

    window.triggerAvatarUpload = () => {
        document.getElementById('avatarInput').click();
        document.getElementById('profileMenu').style.display = 'none';
    };

    window.handleAvatarUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            localStorage.setItem('avatar_' + currentUser.id, base64);
            document.getElementById("user-avatar").src = base64;
            document.getElementById("menuUserAvatar").src = base64;
            alert("Аватарка обновлена!");
        };
        reader.readAsDataURL(file);
    };

    // --- ИИ ---
    async function askZveno(prompt) {
        const response = await fetch("https://api.zveno.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${ZVENO_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "nvidia/nemotron-3-ultra-550b-a55b:free", messages: [{ role: "user", content: prompt }], temperature: 0.7 })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || "Ошибка ZvenoAI");
        return data.choices[0]?.message?.content || "";
    }

    // --- ИГРЫ ---
    Papa.parse("games.csv", {
        download: true, header: true, skipEmptyLines: true,
        chunk: function(results) {
            const validGames = results.data.filter(game => {
                if (game.type !== 'game' || !game.name || !game.short_description) return false;
                let hasMetacritic = parseInt(game.metacritic_score) > 50, hasManyReviews = parseInt(game.recommendations_total) > 100;
                let textToCheck = (game.short_description + " " + game.name).toLowerCase();
                let badWords = ['hentai', 'erotic', 'nsfw', 'adult', 'sex', 'bdsm', 'anime girl'];
                if (badWords.some(word => textToCheck.includes(word))) return false;
                return hasMetacritic || hasManyReviews;
            });
            allGames = allGames.concat(validGames);
            if (!isLoaded) loader.innerText = `Загрузка базы... (${allGames.length} игр)`;
        },
        complete: function() {
            isLoaded = true; loader.style.display = "none";
            allGames.sort((a, b) => (parseInt(b.recommendations_total) || 0) - (parseInt(a.recommendations_total) || 0));
            renderGames(allGames.slice(0, displayCount));
            if (allGames.length > displayCount) document.getElementById("loadMoreBtn").style.display = "inline-block";
        },
        error: function() {
            loader.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">Ошибка загрузки games.csv. Убедись, что файл на месте.</div>`;
        }
    });

    function formatPrice(game) { return (game.is_free === "False" && game.mat_final_price && game.mat_final_price !== "0.0") ? (parseFloat(game.mat_final_price) / 100).toFixed(2) + " $" : "Бесплатно"; }
    
    function renderGames(gamesToRender, container = gamesGrid) {
        if (container === gamesGrid) {
            gamesGrid.innerHTML = ""; 
            const countEl = document.getElementById('gamesCount');
            if(countEl) countEl.innerText = `Найдено: ${gamesToRender.length} игр`;
        }
        if (gamesToRender.length === 0) { container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>Ничего не найдено.</p>"; return; }
        gamesToRender.forEach(game => {
            const card = document.createElement("div"); card.className = "game-card"; card.onclick = () => openModal(game);
            const imgSrc = game.header_image ? game.header_image : "https://via.placeholder.com/460x215?text=No+Image";
            card.innerHTML = `<img src="${imgSrc}" class="game-image" loading="lazy"><div class="game-info"><h3 class="game-title">${escapeHtml(game.name)}</h3><p class="game-desc">${escapeHtml(game.short_description.replace(/<[^>]*>?/gm, ''))}</p><span class="game-price">${formatPrice(game)}</span></div>`;
            container.appendChild(card);
        });
    }
    
    window.loadMore = () => { displayCount += 100; renderGames(allGames.slice(0, displayCount)); if (allGames.length <= displayCount) document.getElementById("loadMoreBtn").style.display = "none"; };
    window.openModal = (game) => { 
        currentGame = game; 
        document.getElementById("gameModal").style.display = "block"; 
        document.getElementById("modalImage").src = game.header_image || "https://via.placeholder.com/800x300"; 
        document.getElementById("modalTitle").innerText = game.name; 
        document.getElementById("modalDesc").innerText = game.short_description.replace(/<[^>]*>?/gm, ''); 
        document.getElementById("modalPrice").innerText = formatPrice(game); 
        document.getElementById("modalDev").innerText = "Разработчик: " + (game.developers || "Неизвестен"); 
        document.getElementById("modalDate").innerText = "Дата выхода: " + (game.release_date || "Неизвестна"); 
        
        const shareBtn = document.getElementById('shareBtn');
        if(shareBtn) shareBtn.onclick = () => { navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?game=' + game.appid).then(() => alert("Скопировано!")); };
    };
    window.closeModal = () => document.getElementById("gameModal").style.display = "none";
    window.onclick = (event) => { if (event.target == document.getElementById("gameModal")) closeModal(); };

    window.findSimilar = () => {
        if (!currentGame) return;
        const stopWords = ["game", "games", "player", "players", "world", "play", "will", "your", "with", "this", "that", "have", "from", "into", "them", "they", "their", "about", "which", "when", "what", "where", "more", "most", "some", "such", "than", "then", "there", "these", "thing", "things", "time", "very", "want", "well", "were", "when", "where", "which", "while", "would", "survive", "survival", "new", "like", "make", "just", "over", "also", "back", "after", "first", "only", "other", "many", "even", "much", "because", "through", "between", "both", "under", "during", "before", "without", "again", "against", "being", "having", "doing"];
        let words = currentGame.short_description.toLowerCase().replace(/[^a-z\s]/g, '').split(' ').filter(w => w.length > 4 && !stopWords.includes(w));
        let keywords = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 5);
        let similar = allGames.filter(g => g.appid !== currentGame.appid && keywords.filter(kw => g.short_description.toLowerCase().includes(kw)).length >= 3);
        window.showSection('games'); searchInput.value = ""; 
        if(similar.length === 0) gamesGrid.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>Похожих игр не найдено.</p>"; else renderGames(similar.slice(0, 100));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    searchInput.addEventListener("input", (e) => {
        if (!isLoaded) return;
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) { renderGames(allGames.slice(0, displayCount)); return; }
        renderGames(allGames.filter(game => game.name.toLowerCase().includes(searchTerm) || game.short_description.toLowerCase().includes(searchTerm)).slice(0, 100)); 
    });

    window.showSection = (section) => {
        if(document.getElementById('tmNick')) { document.getElementById('tmNick').value = ''; document.getElementById('tmNick').classList.remove('input-error'); }
        if(document.getElementById('tmRank')) { document.getElementById('tmRank').value = ''; document.getElementById('tmRank').classList.remove('input-error'); }
        if(document.getElementById('tmSteamId')) { document.getElementById('tmSteamId').value = ''; }
        if(document.getElementById('tmDesc')) { document.getElementById('tmDesc').value = ''; }
        if(document.getElementById('searchInput')) { document.getElementById('searchInput').value = ''; }
        if(document.getElementById('aiPromptInput')) { document.getElementById('aiPromptInput').value = ''; }
        
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('gamesGrid').style.display = 'none'; 
        document.getElementById('analyticsSection').style.display = 'none';
        if (document.getElementById('gamesCount')) document.getElementById('gamesCount').style.display = 'none';
        
        document.getElementById('moodSection').style.display = 'none'; 
        document.getElementById('teammatesSection').style.display = 'none';
        document.getElementById('requestsSection').style.display = 'none'; 
        document.getElementById('loadMoreBtn').style.display = 'none';
        if (document.getElementById('friendsSection')) document.getElementById('friendsSection').style.display = 'none';
        if (document.getElementById('moodResults')) document.getElementById('moodResults').innerHTML = "";
        
        if (section === 'games') { 
            document.getElementById('btnGames').classList.add('active'); 
            document.getElementById('gamesGrid').style.display = 'grid'; 
            if (document.getElementById('gamesCount')) document.getElementById('gamesCount').style.display = 'block';
            searchContainer.style.display = 'flex'; 
            if (allGames.length > displayCount) document.getElementById('loadMoreBtn').style.display = 'inline-block'; 
            if(allGames.length > 0 && gamesGrid.innerHTML === "") renderGames(allGames.slice(0, displayCount)); 
        }
        else if (section === 'analytics') { document.getElementById('btnAnalytics').classList.add('active'); document.getElementById('analyticsSection').style.display = 'block'; searchContainer.style.display = 'none'; buildCharts(); }
        else if (section === 'mood') { document.getElementById('btnMood').classList.add('active'); document.getElementById('moodSection').style.display = 'block'; searchContainer.style.display = 'none'; }
        else if (section === 'teammates') { document.getElementById('btnTeammates').classList.add('active'); document.getElementById('teammatesSection').style.display = 'block'; searchContainer.style.display = 'none'; }
        else if (section === 'requests') { document.getElementById('btnRequests').classList.add('active'); document.getElementById('requestsSection').style.display = 'block'; searchContainer.style.display = 'none'; renderRequests(); }
        else if (section === 'friends') { 
            document.getElementById('btnFriends').classList.add('active'); 
            document.getElementById('friendsSection').style.display = 'block'; 
            searchContainer.style.display = 'none'; 
            renderFriends(); 
        }
    }

    function buildCharts() {
        if (chartsBuilt) return; chartsBuilt = true;
        let years = {}, freeCount = 0, paidCount = 0;
        allGames.forEach(game => {
            if (game.release_date && game.release_date.length >= 4) { let year = game.release_date.substring(0, 4); if (!isNaN(year) && parseInt(year) > 1990) years[year] = (years[year] || 0) + 1; }
            if (game.is_free === "True" || game.mat_final_price === "0.0") freeCount++; else paidCount++;
        });
        const sortedYears = Object.keys(years).sort(); const yearData = sortedYears.map(y => years[y]);
        new Chart(document.getElementById('yearChart'), { type: 'bar', data: { labels: sortedYears, datasets: [{ label: 'Выпущено игр', data: yearData, backgroundColor: '#3b82f6', borderRadius: 5 }] }, options: { color: '#fff', scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' } } } } });
        new Chart(document.getElementById('priceChart'), { type: 'doughnut', data: { labels: ['Бесплатные', 'Платные'], datasets: [{ data: [freeCount, paidCount], backgroundColor: ['#10b981', '#3b82f6'], borderWidth: 0 }] }, options: { color: '#fff', plugins: { legend: { labels: { color: '#fff' } } } } });
    }

    window.findByPreference = async () => {
        const input = document.getElementById('aiPromptInput').value.trim(), loader = document.getElementById('aiLoader'), results = document.getElementById('moodResults');
        if (input.length < 3) { alert("Напиши чуть больше слов!"); return; }
        results.innerHTML = ""; loader.style.display = "block";
        try {
            const prompt = `Ты эксперт по играм Steam. Пользователь хочет: "${input}". Выдай список из 5-7 конкретных названий игр из Steam, которые идеально подходят под этот запрос. Ответь ТОЛЬКО списком названий, каждое с новой строки, без лишнего текста.`;
            const aiResponse = await askZveno(prompt);
            let gameTitles = aiResponse.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(title => title.length > 2);
            let foundGames = allGames.filter(game => gameTitles.some(title => game.name.toLowerCase().includes(title.toLowerCase())));
            if (foundGames.length < 3) { let keywords = aiResponse.toLowerCase().split(' ').filter(w => w.length > 3); let extraGames = allGames.filter(g => !foundGames.includes(g) && keywords.some(kw => g.short_description.toLowerCase().includes(kw))).slice(0, 5); foundGames = foundGames.concat(extraGames); }
            loader.style.display = "none";
            if (foundGames.length === 0) results.innerHTML = "<p style='color: #aaa; text-align: center; grid-column: 1/-1;'>ИИ не нашел подходящих игр.</p>";
            else renderGames(foundGames.slice(0, 30), results);
        } catch (e) { loader.style.display = "none"; results.innerHTML = `<div style="text-align: center; color: #ef4444; grid-column: 1/-1; padding: 20px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;"><strong>Ошибка ИИ:</strong> ${e.message}</div>`; }
    }

    window.findByMood = (mood) => {
        const moodTags = { 'relax': ['relax', 'casual', 'cozy', 'peaceful', 'calm', 'farming', 'puzzle', 'chill'], 'action': ['action', 'shooter', 'fast-paced', 'combat', 'fight', 'war', 'battle', 'intense'], 'story': ['story', 'narrative', 'adventure', 'rpg', 'character', 'choice', 'plot', 'rich'], 'hardcore': ['hard', 'souls-like', 'difficult', 'challenge', 'rogue', 'survival', 'punishing'], 'horror': ['horror', 'scary', 'survival', 'dark', 'fear', 'zombie', 'monster', 'creepy'] };
        let foundGames = allGames.filter(game => moodTags[mood].filter(tag => game.short_description.toLowerCase().includes(tag)).length >= 2);
        foundGames.sort((a, b) => (parseInt(b.metacritic_score) || 0) - (parseInt(a.metacritic_score) || 0));
        const results = document.getElementById('moodResults'); results.innerHTML = ""; document.getElementById('aiLoader').style.display = "none";
        if(foundGames.length === 0) results.innerHTML = "<p style='color: #aaa; text-align: center; grid-column: 1/-1;'>Ничего не найдено.</p>"; else { renderGames(foundGames.slice(0, 30), results); window.scrollTo({ top: 400, behavior: 'smooth' }); }
    }

    // --- ТИММЕЙТЫ ---
    let currentTeammateGame = "";
    
    window.openTeammatesForGame = (gameName, gameImage) => { 
        currentTeammateGame = gameName; 
        document.getElementById('onlineGamesList').style.display = 'none'; 
        document.getElementById('teammatesBoard').style.display = 'block'; 
        let titleHtml = gameImage ? `<img src="${gameImage}" style="height: 60px; vertical-align: middle; margin-right: 15px; border-radius: 8px;">` : ""; 
        document.getElementById('currentGameTitle').innerHTML = titleHtml + "Тиммейты для " + gameName; 
        
        const dynContainer = document.getElementById('dynamicQuestions');
        dynContainer.innerHTML = "";
        if (GAME_CONFIG[gameName] && GAME_CONFIG[gameName].question) {
            let q = GAME_CONFIG[gameName].question;
            dynContainer.innerHTML += `<input type="text" id="tm_dyn_${q.key}" placeholder="${q.label}" style="width: 100%; padding: 12px; background: #0b0e14; border: 1px solid #333; color: white; border-radius: 8px; font-family: 'Montserrat';">`;
        }

        const styleSelectForm = document.getElementById('tmStyle');
        styleSelectForm.innerHTML = "";
        const styleSelectFilter = document.getElementById('filterStyle');
        styleSelectFilter.innerHTML = '<option value="all">Любой стиль</option>';
        
        if (GAME_CONFIG[gameName] && GAME_CONFIG[gameName].styles) {
            GAME_CONFIG[gameName].styles.forEach(style => {
                styleSelectForm.innerHTML += `<option value="${style}">${style}</option>`;
                styleSelectFilter.innerHTML += `<option value="${style}">${style}</option>`;
            });
        }

        const hintEl = document.getElementById('hoursHint');
        if (gameName === 'Fortnite' || gameName === 'League of Legends') {
            hintEl.innerText = "⏱ Часы в этой игре не отображаются в Steam — посмотреть можно в лаунчере (Epic Games / Riot Client) или на сайте tracker.gg.";
            hintEl.style.display = "block";
        } else hintEl.style.display = "none";
        
        renderTeammatesForGame(); 
    };
    
    window.backToGames = () => { document.getElementById('onlineGamesList').style.display = 'block'; document.getElementById('teammatesBoard').style.display = 'none'; document.getElementById('createForm').style.display = 'none'; };
    
    window.showCreateForm = () => { 
        if (!currentUser) { alert("Войдите в аккаунт, чтобы создать анкету!"); showAuthModal(); return; } 
        editingTmId = null;
        document.getElementById('formTitle').innerText = "Новая анкета";
        document.getElementById('tmNick').value = ''; 
        document.getElementById('tmRank').value = ''; 
        document.getElementById('tmDesc').value = '';
        document.getElementById('tmSteamId').value = '';
        document.getElementById('tmColor').value = '#3b82f6';
        document.getElementById('createForm').style.display = 'block'; 
    };

    window.saveTeammate = async () => {
        const nick = document.getElementById('tmNick').value.trim(), rank = document.getElementById('tmRank').value.trim(), desc = document.getElementById('tmDesc').value.trim(), steamId = document.getElementById('tmSteamId')?.value.trim() || '';
        const style = document.getElementById('tmStyle').value;
        const color = document.getElementById('tmColor').value;
        
        let hasError = false;
        if (!/^[a-zA-Zа-яА-Я0-9_]{3,20}$/.test(nick)) { document.getElementById('tmNick').classList.add('input-error'); hasError = true; } else { document.getElementById('tmNick').classList.remove('input-error'); }
        if (!/^\d{1,5}$/.test(rank)) { document.getElementById('tmRank').classList.add('input-error'); hasError = true; } else { document.getElementById('tmRank').classList.remove('input-error'); }
        if (hasError) { alert("Исправьте ошибки в полях."); return; }
        
        if (steamId && !/^\d{9}$/.test(steamId)) { alert("Код дружбы Steam должен состоять ровно из 9 цифр."); return; }
        
        let textToCheck = (nick + " " + desc).toLowerCase();
        if (['хуй', 'пизд', 'бля', 'fuck', 'shit', 'реклама', 'купить', 'наркот', 'http'].some(w => textToCheck.includes(w))) { alert("Запрещенные слова!"); return; }

        let answers = {};
        if (GAME_CONFIG[currentTeammateGame] && GAME_CONFIG[currentTeammateGame].question) {
            let q = GAME_CONFIG[currentTeammateGame].question;
            const el = document.getElementById('tm_dyn_' + q.key);
            if (el && el.value.trim()) answers[q.key] = el.value.trim();
        }

        let aiText = "";
        try {
            const aiResponse = await askZveno(`Проанализируй стиль игрока в 1 предложении на русском: "${desc}"`);
            if(aiResponse) aiText = "🤖 Анализ ИИ: " + aiResponse;
        } catch(e) {}

        let db = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
        
        if (editingTmId) {
            let idx = db.findIndex(t => t.id === editingTmId);
            if (idx !== -1) {
                db[idx] = { ...db[idx], nick, rank, desc, style, steamId, ai: aiText || db[idx].ai, answers, color, updated_at: Date.now() };
            }
        } else {
            if (db.some(t => t.user_id === currentUser.id && t.game === currentTeammateGame)) { alert("Вы уже создали анкету для этой игры! Отредактируйте или удалите старую."); return; }
            const newTm = { 
                id: crypto.randomUUID(), game: currentTeammateGame, 
                nick, rank, desc, style, steamId, 
                ai: aiText, answers, color,
                likes: 0, user_id: currentUser.id, updated_at: Date.now()
            };
            db.unshift(newTm); 
        }
        
        localStorage.setItem('teammates_db_v3', JSON.stringify(db));
        document.getElementById('createForm').style.display = 'none'; 
        editingTmId = null;
        renderTeammatesForGame();
    };

    window.editTeammate = (id) => {
        let db = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
        let t = db.find(x => x.id === id);
        if (!t) return;
        
        editingTmId = id;
        document.getElementById('formTitle').innerText = "Редактирование анкеты";
        document.getElementById('tmNick').value = t.nick;
        document.getElementById('tmRank').value = t.rank;
        document.getElementById('tmDesc').value = t.desc;
        document.getElementById('tmSteamId').value = t.steamId || '';
        document.getElementById('tmColor').value = t.color || '#3b82f6';
        if (t.style) document.getElementById('tmStyle').value = t.style;
        
        if (GAME_CONFIG[currentTeammateGame] && t.answers) {
            let q = GAME_CONFIG[currentTeammateGame].question;
            if(q) {
                const el = document.getElementById('tm_dyn_' + q.key);
                if (el) el.value = t.answers[q.key] || '';
            }
        }
        
        document.getElementById('createForm').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.renderTeammatesForGame = () => {
        const grid = document.getElementById('teammatesGrid'); grid.innerHTML = "";
        let db = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
        let filtered = db.filter(t => t.game === currentTeammateGame);
        
        const filtersContainer = document.getElementById('filtersContainer');
        if (filtered.length > 0) {
            filtersContainer.style.display = 'flex';
        } else {
            filtersContainer.style.display = 'none';
        }

        let requests = JSON.parse(localStorage.getItem('requests_db')) || [];
        let mySent = requests.filter(r => r.from === currentUser?.email).map(r => r.to);
        let friends = requests.filter(r => r.status === 'accepted' && (r.from === currentUser?.email || r.to === currentUser?.email));

        const onlyMine = document.getElementById('onlyMine').checked;
        const filterStyle = document.getElementById('filterStyle').value;
        
        if (onlyMine && currentUser) {
            filtered = filtered.filter(t => t.user_id === currentUser.id);
        }
        if (filterStyle !== 'all') {
            filtered = filtered.filter(t => t.style === filterStyle);
        }

        const countEl = document.getElementById('teammatesCount');
        if (countEl) countEl.innerText = `Найдено: ${filtered.length} анкет`;

        if(filtered.length === 0) { grid.innerHTML = "<p style='color:#aaa; text-align:center; grid-column: 1/-1;'>Анкет не найдено. Измените фильтры или создайте свою!</p>"; return; }
        
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        
        filtered.forEach((t, index) => {
            const card = document.createElement('div'); card.className = "teammate-card";
            let isMyProfile = currentUser && t.user_id === currentUser.id;
            let isFriend = friends.some(f => f.from === currentUser?.email && f.to === t.nick || f.to === currentUser?.email && f.from === t.nick);
            let isInvited = mySent.includes(t.nick);
            let cardColor = t.color || '#3b82f6';

            let styleHtml = `style="border-top: 4px solid ${cardColor}; box-shadow: 0 0 15px ${cardColor}33;"`;

            let actionBtn = "";
            if (isMyProfile) {
                actionBtn = `<button onclick="editTeammate('${t.id}')" class="similar-btn" style="flex-grow: 1; background: ${cardColor}; color: white; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer;">Редактировать</button>
                             <button onclick="deleteTeammate('${t.id}')" style="background: #ef4444; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 40px;">🗑</button>`;
            } else if (isInvited) {
                actionBtn = `<button disabled style="background: #374151; color: #9ca3af; border: none; padding: 10px; border-radius: 8px; font-weight: bold; flex-grow: 1; cursor: not-allowed;">Ожидание...</button>`;
            } else {
                actionBtn = `<button class="invite-btn" onclick="invitePlayer('${escapeHtml(t.nick)}')" style="flex-grow: 1; background: linear-gradient(135deg, ${cardColor}, #059669);">Пригласить</button>`;
            }

            let userAv = localStorage.getItem('avatar_' + t.user_id);
            let avatarHtml = userAv 
                ? `<img src="${userAv}" class="teammate-avatar" style="border-color: ${cardColor};">` 
                : `<div class="avatar-placeholder" style="background: linear-gradient(135deg, ${cardColor}, #8b5cf6);">${escapeHtml(t.nick.charAt(0).toUpperCase())}</div>`;

            let isOnline = t.updated_at && (Date.now() - t.updated_at < 5 * 60 * 1000);
            let onlineDot = isOnline ? `<span class="online-dot" title="Онлайн"></span>` : ``;

            let steamIdHtml = "";
            if (t.steamId) {
                if (isMyProfile || isFriend) {
                    steamIdHtml = `<p style="color: #66c0f4; font-size: 12px; margin-top: 5px;">Код дружбы Steam: ${escapeHtml(t.steamId)}</p>`;
                } else {
                    steamIdHtml = `<p style="color: #6b7280; font-size: 12px; margin-top: 5px; font-style: italic;">🔒 Код дружбы скрыт (доступен друзьям)</p>`;
                }
            }

            let answersHtml = "";
            if (t.answers && Object.keys(t.answers).length > 0) {
                answersHtml = Object.entries(t.answers).map(([k, v]) => `<span style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; font-size:12px; margin-right:5px; margin-top:5px; color:#ccc;">${escapeHtml(v)}</span>`).join('');
            }

            let aiHtml = "";
            if (t.ai && !t.ai.includes("Сбалансированный игрок")) {
                aiHtml = `<details class="ai-details" style="margin: 10px 0; background: rgba(59, 130, 246, 0.1); border-left: 4px solid ${cardColor}; padding: 10px; border-radius: 4px;"><summary>🤖 Анализ ИИ</summary><div style="font-size: 13px; color: #d1d5db; margin-top: 5px;">${escapeHtml(t.ai.replace('🤖 Анализ ИИ: ', ''))}</div></details>`;
            } else if (!isMyProfile) {
                aiHtml = `<div id="ai-tm-${t.id}" style="margin: 10px 0; background: rgba(59, 130, 246, 0.1); border-left: 4px solid ${cardColor}; padding: 10px; border-radius: 4px; font-size: 13px; color: #9ca3af; animation: pulse 1.5s infinite;">🤖 ИИ анализирует стиль игрока...</div>`;
                
                askZveno(`Проанализируй стиль игрока в 1 предложении на русском: "${t.desc}"`).then(res => {
                    let finalAi = "🤖 Анализ ИИ: " + (res || "Сбалансированный игрок.");
                    let dbUpdate = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
                    let idx = dbUpdate.findIndex(x => x.id === t.id);
                    if (idx !== -1) {
                        dbUpdate[idx].ai = finalAi;
                        localStorage.setItem('teammates_db_v3', JSON.stringify(dbUpdate));
                        let el = document.getElementById(`ai-tm-${t.id}`);
                        if (el) {
                            el.outerHTML = `<details class="ai-details" style="margin: 10px 0; background: rgba(59, 130, 246, 0.1); border-left: 4px solid ${cardColor}; padding: 10px; border-radius: 4px;"><summary>🤖 Анализ ИИ</summary><div style="font-size: 13px; color: #d1d5db; margin-top: 5px;">${escapeHtml(res)}</div></details>`;
                        }
                    }
                }).catch(err => {
                    let el = document.getElementById(`ai-tm-${t.id}`);
                    if (el) el.innerText = "🤖 Анализ временно недоступен (лимит ИИ).";
                });
            }

            card.innerHTML = `
                <div class="teammate-header" style="align-items: flex-start;" ${styleHtml}>
                    <div style="display:flex; gap: 12px; align-items: center;">
                        ${avatarHtml}
                        <div>
                            <h3 class="teammate-name" style="margin:0;">${escapeHtml(t.nick)} ${onlineDot}</h3>
                            <span class="teammate-rank" style="display:inline-block; margin-top:5px; color: ${cardColor};">${escapeHtml(t.rank)} ч. • ${escapeHtml(t.style || 'Стиль не указан')}</span>
                        </div>
                    </div>
                </div>
                ${aiHtml}
                <p style="color: #aaa; font-size: 14px; margin-bottom: 10px;">${escapeHtml(t.desc)}</p>
                <div style="margin-bottom: 10px;">${answersHtml}</div>
                ${steamIdHtml}
                <div style="display: flex; gap: 10px; margin-top: auto; align-items: center; padding-top: 15px;">
                    ${actionBtn}
                    <button onclick="likeTeammate('${t.id}')" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 10px 15px; border-radius: 8px; cursor: pointer;">❤️ ${t.likes || 0}</button>
                </div>
            `;
            grid.appendChild(card);
        });
    };

    window.deleteTeammate = (id) => {
        if (!confirm("Удалить анкету? Все отправленные на неё запросы тоже будут удалены.")) return;
        let db = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
        let tmToDelete = db.find(t => t.id === id);
        db = db.filter(t => t.id !== id);
        localStorage.setItem('teammates_db_v3', JSON.stringify(db));
        if (tmToDelete) {
            let requests = JSON.parse(localStorage.getItem('requests_db')) || [];
            requests = requests.filter(r => r.to !== tmToDelete.nick);
            localStorage.setItem('requests_db', JSON.stringify(requests));
        }
        renderTeammatesForGame();
    };

    window.likeTeammate = (id) => {
        if (!currentUser) { alert("Войдите, чтобы ставить лайки!"); return; }
        let db = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
        let targetTm = db.find(t => t.id === id);
        if (!targetTm) return;
        let likedBy = JSON.parse(localStorage.getItem('liked_by')) || [];
        if (likedBy.includes(currentUser.id + "_" + id)) { alert("Вы уже лайкнули эту анкету!"); return; }
        likedBy.push(currentUser.id + "_" + id); 
        localStorage.setItem('liked_by', JSON.stringify(likedBy));
        targetTm.likes = (targetTm.likes || 0) + 1; 
        localStorage.setItem('teammates_db_v3', JSON.stringify(db)); 
        renderTeammatesForGame(); 
    };

    // --- ЗАПРОСЫ ---
    window.invitePlayer = (nick) => {
        if (!currentUser) { alert("Войдите, чтобы отправлять запросы!"); return; }
        let requests = JSON.parse(localStorage.getItem('requests_db')) || [];
        if (requests.some(r => r.to === nick && r.status === 'pending')) { alert("Вы уже отправили запрос!"); return; }
        requests.push({ from: currentUser.email, to: nick, game: currentTeammateGame, status: 'pending', type: 'outgoing' });
        localStorage.setItem('requests_db', JSON.stringify(requests)); 
        alert("Приглашение отправлено!"); 
        updateRequestBadge();
        renderTeammatesForGame();
    };

    let currentRequestTab = 'incoming';
    window.switchRequests = (tab) => { currentRequestTab = tab; document.getElementById('btnIncoming').classList.remove('active'); document.getElementById('btnOutgoing').classList.remove('active'); document.getElementById(tab === 'incoming' ? 'btnIncoming' : 'btnOutgoing').classList.add('active'); renderRequests(); };

    window.renderRequests = () => {
        const list = document.getElementById('requestsList'); list.innerHTML = "";
        if (!currentUser) { list.innerHTML = `<p style="color: #aaa; text-align: center; grid-column: 1/-1;">Войдите, чтобы видеть запросы.</p>`; return; }
        let requests = JSON.parse(localStorage.getItem('requests_db')) || [];
        let filtered = currentRequestTab === 'incoming' ? requests.filter(r => r.to === currentUser.email) : requests.filter(r => r.from === currentUser.email);
        if (filtered.length === 0) { list.innerHTML = `<p style="color: #aaa; text-align: center; grid-column: 1/-1;">Здесь пока пусто.</p>`; return; }
        
        filtered.forEach((req) => {
            const originalIndex = requests.findIndex(r => r.from === req.from && r.to === req.to && r.game === req.game);
            const card = document.createElement('div'); card.className = "teammate-card"; card.style.padding = "15px";
            let actionsHtml = "";
            if (currentRequestTab === 'incoming' && req.status === 'pending') {
                actionsHtml = `<div style="display: flex; gap: 10px; margin-top: 10px;"><button onclick="acceptRequest(${originalIndex})" style="flex: 1; background: #10b981; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer;">Принять</button><button onclick="rejectRequest(${originalIndex})" style="flex: 1; background: #ef4444; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer;">Отклонить</button></div>`;
            } else if (req.status === 'accepted') {
                actionsHtml = `<p style="color: #10b981; font-weight: bold; margin-top: 10px;">✅ Принято</p>`;
            } else if (req.status === 'rejected') {
                actionsHtml = `<p style="color: #ef4444; font-weight: bold; margin-top: 10px;">❌ Отклонено</p>`;
            }
            card.innerHTML = `<div style="font-size: 14px; margin-bottom: 5px;">${currentRequestTab === 'incoming' ? 'От: <b>' + escapeHtml(req.from) + '</b>' : 'Кому: <b>' + escapeHtml(req.to) + '</b>'}</div><div style="color: #aaa; font-size: 12px; margin-bottom: 10px;">Игра: ${escapeHtml(req.game)}</div>${actionsHtml}`;
            list.appendChild(card);
        });
    };

    window.acceptRequest = (index) => { 
        let requests = JSON.parse(localStorage.getItem('requests_db')) || []; 
        if(requests[index]) requests[index].status = 'accepted'; 
        localStorage.setItem('requests_db', JSON.stringify(requests)); 
        renderRequests(); updateRequestBadge(); 
    };
    window.rejectRequest = (index) => { 
        let requests = JSON.parse(localStorage.getItem('requests_db')) || []; 
        if(requests[index]) requests[index].status = 'rejected'; 
        localStorage.setItem('requests_db', JSON.stringify(requests)); 
        renderRequests(); updateRequestBadge(); 
    };
    window.updateRequestBadge = () => { 
        if(!currentUser) return; 
        let requests = JSON.parse(localStorage.getItem('requests_db')) || []; 
        let pendingCount = requests.filter(r => r.to === currentUser.email && r.status === 'pending').length; 
        let badge = document.getElementById('reqBadge'); 
        if (pendingCount > 0) { badge.style.display = 'inline-block'; badge.innerText = pendingCount; } else badge.style.display = 'none'; 
    };

    // --- ДРУЗЬЯ И ЧАТ ---
    window.renderFriends = () => {
        const list = document.getElementById('friendsList'); list.innerHTML = "";
        if (!currentUser) { list.innerHTML = `<p style="color: #aaa; text-align: center; padding: 20px;">Войдите, чтобы видеть друзей.</p>`; return; }
        let requests = JSON.parse(localStorage.getItem('requests_db')) || [];
        let friends = requests.filter(r => r.status === 'accepted' && (r.from === currentUser.email || r.to === currentUser.email));
        
        if (friends.length === 0) { list.innerHTML = `<p style="color: #aaa; text-align: center; padding: 20px;">У вас пока нет друзей.</p>`; return; }
        
        friends.forEach(friend => {
            const friendName = friend.from === currentUser.email ? friend.to : friend.from;
            const item = document.createElement('div');
            item.className = "friend-item" + (activeChatFriend === friendName ? " active" : "");
            item.onclick = () => openPrivateChat(friendName);
            
            let initial = friendName.charAt(0).toUpperCase();
            item.innerHTML = `<div style="width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${initial}</div><span style="color: white; font-weight: 600;">${escapeHtml(friendName)}</span>`;
            list.appendChild(item);
        });
    };

    window.openPrivateChat = (friendName) => {
        activeChatFriend = friendName;
        renderFriends();
        document.getElementById('privateChatHeader').innerText = "Чат с " + friendName;
        document.getElementById('privateChatInputArea').style.display = 'flex';
        renderPrivateMessages();
    };

    window.sendPrivateMessage = () => {
        if (!activeChatFriend) return;
        const input = document.getElementById('privateChatInput');
        const text = input.value.trim();
        if (!text) return;

        let msgs = JSON.parse(localStorage.getItem('private_msgs')) || [];
        let chatId = [currentUser.email, activeChatFriend].sort().join('_');
        msgs.push({ chatId, from: currentUser.email, text, time: Date.now() });
        localStorage.setItem('private_msgs', JSON.stringify(msgs));
        input.value = '';
        renderPrivateMessages();
    };

    window.renderPrivateMessages = () => {
        const container = document.getElementById('privateChatMessages');
        if (!activeChatFriend) return;
        
        let msgs = JSON.parse(localStorage.getItem('private_msgs')) || [];
        let chatId = [currentUser.email, activeChatFriend].sort().join('_');
        let filtered = msgs.filter(m => m.chatId === chatId);
        
        if (filtered.length === 0) { container.innerHTML = '<p style="color: #aaa; text-align: center; margin-top: 50px;">Напишите первое сообщение!</p>'; return; }
        
        container.innerHTML = filtered.map(m => {
            let isMine = m.from === currentUser.email;
            return `<div style="align-self: ${isMine ? 'flex-end' : 'flex-start'}; background: ${isMine ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; color: white; padding: 10px 15px; border-radius: 12px; max-width: 70%;">${escapeHtml(m.text)}</div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    };

    function updateOnlineStatus() {
        if(!currentUser) return;
        let db = JSON.parse(localStorage.getItem('teammates_db_v3')) || [];
        let myTm = db.find(t => t.user_id === currentUser.id);
        if(myTm) {
            myTm.updated_at = Date.now();
            localStorage.setItem('teammates_db_v3', JSON.stringify(db));
        }
    }
});