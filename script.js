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

// КОНФИГ ИГР
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
    let activeChatFriend = null;
    let realtimeChannel = null;

    // --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
    async function checkUser() {
        const { data: { user } } = await _supabase.auth.getUser();
        currentUser = user;
        if (user) {
            document.getElementById("btnLogin").style.display = "none";
            document.getElementById("user-info").style.display = "block";
            document.getElementById("menuUserEmail").innerText = user.email;
            
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
            
            if(!realtimeChannel) {
                realtimeChannel = _supabase.channel('custom-all-channel')
                  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                      if (activeChatFriend) renderPrivateMessages();
                  }).subscribe();
            }

            updateRequestBadge();
            if(document.getElementById('btnFriends').classList.contains('active')) renderFriends();
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
        if (menu && menu.style.display === 'block' && !container.contains(event.target)) menu.style.display = 'none';
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

    window.toggleMobileMenu = () => {
        const nav = document.getElementById('navMenu');
        if(nav) nav.classList.toggle('show-mobile');
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
            loader.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">Ошибка загрузки games.csv.</div>`;
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
        const nav = document.getElementById('navMenu'); if(nav) nav.classList.remove('show-mobile');
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
        else if (section === 'friends') { document.getElementById('btnFriends').classList.add('active'); document.getElementById('friendsSection').style.display = 'block'; searchContainer.style.display = 'none'; renderFriends(); }
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

    // --- ТИММЕЙТЫ (СИНХРОНИЗАЦИЯ С SUPABASE) ---
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
            dynContainer.innerHTML += `<input type="text" id="tm_dyn_${q.key}" placeholder="${q.label} (${q.placeholder})" style="width: 100%; padding: 12px; background: #0b0e14; border: 1px solid #333; color: white; border-radius: 8px; font-family: 'Montserrat';">`;
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
            hintEl.innerText = "⏱ Часы в этой игре не отображаются в Steam — посмотреть можно в лаунчере или на tracker.gg.";
            hintEl.style.display = "block";
        } else hintEl.style.display = "none";
        
        renderTeammatesForGame(); 
    };
    
    window.backToGames = () => { document.getElementById('onlineGamesList').style.display = 'block'; document.getElementById('teammatesBoard').style.display = 'none'; document.getElementById('createForm').style.display = 'none'; };
    
    window.showCreateForm = () => { 
        if (!currentUser) { alert("Войдите в аккаунт, чтобы создать анкету!"); showAuthModal(); return; } 
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
        
        if (!/^[a-zA-Zа-яА-Я0-9_]{3,20}$/.test(nick)) { alert("Ник: только буквы и цифры, от 3 до 20 символов."); return; }
        if (!/^\d{1,5}$/.test(rank)) { alert("Часы: только цифры."); return; }
        if (steamId && !/^\d{9}$/.test(steamId)) { alert("Код дружбы Steam: ровно 9 цифр."); return; }

        let answers = {};
        if (GAME_CONFIG[currentTeammateGame] && GAME_CONFIG[currentTeammateGame].question) {
            let q = GAME_CONFIG[currentTeammateGame].question;
            const el = document.getElementById('tm_dyn_' + q.key);
            if (el && el.value.trim()) answers[q.key] = el.value.trim();
        }

        let aiText = "";
        try { const aiResponse = await askZveno(`Проанализируй стиль игрока в 1 предложении: "${desc}"`); if(aiResponse) aiText = aiResponse; } catch(e) {}

        const { data, error } = await _supabase.from('teammates').insert([{
            user_id: currentUser.id, user_email: currentUser.email, game: currentTeammateGame,
            nick: nick, rank: rank, style: style, desc_text: desc,
            answers: answers, color: color, steam_id: steamId, ai_analysis: aiText
        }]);

        if (error) { alert("Ошибка при сохранении: " + error.message); } 
        else { document.getElementById('createForm').style.display = 'none'; renderTeammatesForGame(); }
    };

    window.deleteTeammate = async (id) => {
        if (!confirm("Удалить анкету?")) return;
        await _supabase.from('teammates').delete().eq('id', id);
        renderTeammatesForGame();
    };

    window.likeTeammate = async (id) => {
        if (!currentUser) { alert("Войдите, чтобы ставить лайки!"); return; }
        const { data } = await _supabase.from('teammates').select('likes').eq('id', id).single();
        if(data) await _supabase.from('teammates').update({ likes: (data.likes || 0) + 1 }).eq('id', id);
        renderTeammatesForGame(); 
    };

    window.renderTeammatesForGame = async () => {
        const grid = document.getElementById('teammatesGrid'); grid.innerHTML = "<p style='text-align:center; width:100%; color:#aaa;'>Загрузка анкет...</p>";
        const { data: db, error } = await _supabase.from('teammates').select('*').eq('game', currentTeammateGame);
        
        if (error) { grid.innerHTML = "<p style='color:red;'>Ошибка загрузки</p>"; return; }

        const filtersContainer = document.getElementById('filtersContainer');
        if (db && db.length > 0) filtersContainer.style.display = 'flex';
        else filtersContainer.style.display = 'none';

        let filtered = db || [];
        const onlyMine = document.getElementById('onlyMine').checked;
        const filterStyle = document.getElementById('filterStyle').value;
        if (onlyMine && currentUser) filtered = filtered.filter(t => t.user_id === currentUser.id);
        if (filterStyle !== 'all') filtered = filtered.filter(t => t.style === filterStyle);

        const countEl = document.getElementById('teammatesCount');
        if (countEl) countEl.innerText = `Найдено: ${filtered.length} анкет`;
        grid.innerHTML = "";

        if(filtered.length === 0) { grid.innerHTML = "<p style='color:#aaa; text-align:center; grid-column: 1/-1;'>Анкет не найдено. Создайте свою!</p>"; return; }
        
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        
        const { data: friendsData } = await _supabase.from('requests').select('*').eq('status', 'accepted');
        const myFriends = (friendsData || []).filter(r => r.from_email === currentUser?.email || r.to_email === currentUser?.email);

        filtered.forEach((t) => {
            const card = document.createElement('div'); card.className = "teammate-card";
            let isMyProfile = currentUser && t.user_id === currentUser.id;
            let isFriend = myFriends.some(f => f.from_email === t.user_email || f.to_email === t.user_email);
            let cardColor = t.color || '#3b82f6';

            let actionBtn = "";
            if (isMyProfile) {
                actionBtn = `<button onclick="deleteTeammate('${t.id}')" style="background: #ef4444; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; flex-grow: 1;">Удалить</button>`;
            } else {
                actionBtn = `<button class="invite-btn" onclick="invitePlayer('${escapeHtml(t.user_email)}', '${escapeHtml(t.nick)}')" style="flex-grow: 1; background: linear-gradient(135deg, ${cardColor}, #059669);">Пригласить</button>`;
            }

            let avatarHtml = `<div class="avatar-placeholder" style="background: linear-gradient(135deg, ${cardColor}, #8b5cf6);">${escapeHtml(t.nick.charAt(0).toUpperCase())}</div>`;

            let steamIdHtml = "";
            if (t.steam_id) {
                if (isMyProfile || isFriend) steamIdHtml = `<p style="color: #66c0f4; font-size: 12px; margin-top: 5px;">Код Steam: ${escapeHtml(t.steam_id)}</p>`;
                else steamIdHtml = `<p style="color: #6b7280; font-size: 12px; margin-top: 5px; font-style: italic;">🔒 Код скрыт</p>`;
            }

            let answersHtml = "";
            if (t.answers && Object.keys(t.answers).length > 0) {
                answersHtml = Object.entries(t.answers).map(([k, v]) => `<span style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; font-size:12px; margin-right:5px; margin-top:5px; color:#ccc;">${escapeHtml(v)}</span>`).join('');
            }

            let aiHtml = t.ai_analysis ? `<details class="ai-details" style="margin: 10px 0; background: rgba(59, 130, 246, 0.1); border-left: 4px solid ${cardColor}; padding: 10px; border-radius: 4px;"><summary>🤖 Анализ ИИ</summary><div style="font-size: 13px; color: #d1d5db; margin-top: 5px;">${escapeHtml(t.ai_analysis)}</div></details>` : "";

            card.innerHTML = `
                <div class="teammate-header" style="align-items: flex-start; border-top: 4px solid ${cardColor}; padding-top: 15px;">
                    <div style="display:flex; gap: 12px; align-items: center;">
                        ${avatarHtml}
                        <div>
                            <h3 class="teammate-name" style="margin:0;">${escapeHtml(t.nick)}</h3>
                            <span class="teammate-rank" style="display:inline-block; margin-top:5px; color: ${cardColor};">${escapeHtml(t.rank)} ч. • ${escapeHtml(t.style || 'Стиль не указан')}</span>
                        </div>
                    </div>
                </div>
                ${aiHtml}
                <p style="color: #aaa; font-size: 14px; margin-bottom: 10px;">${escapeHtml(t.desc_text)}</p>
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

    // --- ЗАПРОСЫ ---
    window.invitePlayer = async (email, nick) => {
        if (!currentUser) { alert("Войдите, чтобы отправлять запросы!"); return; }
        if(email === currentUser.email) return;
        await _supabase.from('requests').insert([{ from_email: currentUser.email, to_email: email, game: currentTeammateGame, status: 'pending' }]);
        alert("Приглашение отправлено!"); 
        updateRequestBadge();
    };

    let currentRequestTab = 'incoming';
    window.switchRequests = (tab) => { currentRequestTab = tab; document.getElementById('btnIncoming').classList.remove('active'); document.getElementById('btnOutgoing').classList.remove('active'); document.getElementById(tab === 'incoming' ? 'btnIncoming' : 'btnOutgoing').classList.add('active'); renderRequests(); };

    window.renderRequests = async () => {
        const list = document.getElementById('requestsList'); list.innerHTML = "Загрузка...";
        if (!currentUser) { list.innerHTML = `<p style="text-align: center;">Войдите.</p>`; return; }
        
        let query = _supabase.from('requests').select('*');
        if (currentRequestTab === 'incoming') query = query.eq('to_email', currentUser.email);
        else query = query.eq('from_email', currentUser.email);
        
        const { data: requests, error } = await query;
        if (error) { list.innerHTML = "Ошибка"; return; }
        list.innerHTML = "";
        
        if (requests.length === 0) { list.innerHTML = `<p style="color: #aaa; text-align: center; grid-column: 1/-1;">Здесь пока пусто.</p>`; return; }
        
        requests.forEach((req) => {
            const card = document.createElement('div'); card.className = "teammate-card"; card.style.padding = "15px";
            let actionsHtml = "";
            if (currentRequestTab === 'incoming' && req.status === 'pending') {
                actionsHtml = `<div style="display: flex; gap: 10px; margin-top: 10px;"><button onclick="acceptRequest('${req.id}')" style="flex: 1; background: #10b981; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer;">Принять</button><button onclick="rejectRequest('${req.id}')" style="flex: 1; background: #ef4444; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer;">Отклонить</button></div>`;
            } else if (req.status === 'accepted') { actionsHtml = `<p style="color: #10b981; font-weight: bold; margin-top: 10px;">✅ Принято</p>`; } 
            else if (req.status === 'rejected') { actionsHtml = `<p style="color: #ef4444; font-weight: bold; margin-top: 10px;">❌ Отклонено</p>`; }
            
            card.innerHTML = `<div style="font-size: 14px; margin-bottom: 5px;">${currentRequestTab === 'incoming' ? 'От: <b>' + escapeHtml(req.from_email) + '</b>' : 'Кому: <b>' + escapeHtml(req.to_email) + '</b>'}</div><div style="color: #aaa; font-size: 12px; margin-bottom: 10px;">Игра: ${escapeHtml(req.game || 'Любая')}</div>${actionsHtml}`;
            list.appendChild(card);
        });
    };

    window.acceptRequest = async (id) => { await _supabase.from('requests').update({status: 'accepted'}).eq('id', id); renderRequests(); updateRequestBadge(); };
    window.rejectRequest = async (id) => { await _supabase.from('requests').update({status: 'rejected'}).eq('id', id); renderRequests(); updateRequestBadge(); };
    
    window.updateRequestBadge = async () => { 
        if(!currentUser) return; 
        const { data } = await _supabase.from('requests').select('id').eq('to_email', currentUser.email).eq('status', 'pending');
        let count = data ? data.length : 0;
        let badge = document.getElementById('reqBadge'); 
        if (count > 0) { badge.style.display = 'inline-block'; badge.innerText = count; } else badge.style.display = 'none'; 
    };

    // --- ДРУЗЬЯ И ЧАТ ---
    window.renderFriends = async () => {
        const list = document.getElementById('friendsList'); list.innerHTML = "Загрузка...";
        if (!currentUser) { list.innerHTML = `<p>Войдите.</p>`; return; }
        
        const { data: reqs } = await _supabase.from('requests').select('*').eq('status', 'accepted');
        const friends = (reqs || []).filter(r => r.from_email === currentUser.email || r.to_email === currentUser.email);
        
        list.innerHTML = "";
        if (friends.length === 0) { list.innerHTML = `<p style="color: #aaa; text-align: center; padding: 20px;">У вас пока нет друзей.</p>`; return; }
        
        friends.forEach(friend => {
            const friendEmail = friend.from_email === currentUser.email ? friend.to_email : friend.from_email;
            const item = document.createElement('div');
            item.className = "friend-item" + (activeChatFriend === friendEmail ? " active" : "");
            item.onclick = () => openPrivateChat(friendEmail);
            item.innerHTML = `<div style="width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${friendEmail.charAt(0).toUpperCase()}</div><span style="color: white; font-weight: 600;">${escapeHtml(friendEmail.split('@')[0])}</span>`;
            list.appendChild(item);
        });
    };

    window.openPrivateChat = (friendEmail) => {
        activeChatFriend = friendEmail;
        renderFriends();
        document.getElementById('privateChatHeader').innerText = "Чат с " + friendEmail.split('@')[0];
        document.getElementById('privateChatInputArea').style.display = 'flex';
        renderPrivateMessages();
    };

    window.sendPrivateMessage = async () => {
        if (!activeChatFriend) return;
        const input = document.getElementById('privateChatInput');
        const text = input.value.trim();
        if (!text) return;

        let chatId = [currentUser.email, activeChatFriend].sort().join('_');
        await _supabase.from('messages').insert([{ chat_id: chatId, sender_email: currentUser.email, text: text }]);
        input.value = '';
        renderPrivateMessages();
    };

    window.renderPrivateMessages = async () => {
        const container = document.getElementById('privateChatMessages');
        if (!activeChatFriend) return;
        
        let chatId = [currentUser.email, activeChatFriend].sort().join('_');
        const { data: msgs } = await _supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
        
        if (!msgs || msgs.length === 0) { container.innerHTML = '<p style="color: #aaa; text-align: center; margin-top: 50px;">Напишите первое сообщение!</p>'; return; }
        
        container.innerHTML = msgs.map(m => {
            let isMine = m.sender_email === currentUser.email;
            return `<div style="align-self: ${isMine ? 'flex-end' : 'flex-start'}; background: ${isMine ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; color: white; padding: 10px 15px; border-radius: 12px; max-width: 70%;">${escapeHtml(m.text)}</div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    };
});