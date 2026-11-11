document.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("loader");
    const gamesGrid = document.getElementById("gamesGrid");
    const searchInput = document.getElementById("searchInput");
    const searchContainer = document.getElementById("searchContainer");
    
    let allGames = [];
    let isLoaded = false;
    let currentGame = null;
    let chartsBuilt = false;
    let displayCount = 100;

    // Загрузка данных
    Papa.parse("games.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        chunk: function(results) {
            const validGames = results.data.filter(game => {
                if (game.type !== 'game' || !game.name || !game.short_description) return false;
                
                // Фильтр по качеству
                let hasMetacritic = parseInt(game.metacritic_score) > 50;
                let hasManyReviews = parseInt(game.recommendations_total) > 100;
                
                return hasMetacritic || hasManyReviews;
            });
            
            // Добавляем систему "штрафных баллов" для пошлости
            validGames.forEach(game => {
                let textToCheck = (game.short_description + " " + game.name).toLowerCase();
                let badWords = ['hentai', 'erotic', 'nsfw', 'adult', 'sex', 'bdsm', 'anime girl'];
                
                if (badWords.some(word => textToCheck.includes(word))) {
                    game.penalty = -1000000; // Штраф
                } else {
                    game.penalty = 0;
                }
            });
            
            allGames = allGames.concat(validGames);
            
            if (!isLoaded) {
                loader.innerText = `Загрузка базы... (${allGames.length} игр)`;
            }
        },
        complete: function() {
            isLoaded = true;
            loader.style.display = "none";
            
            // Сортируем: сначала нормальные, потом по отзывам
            allGames.sort((a, b) => {
                if (a.penalty !== b.penalty) {
                    return b.penalty - a.penalty; 
                }
                return (parseInt(b.recommendations_total) || 0) - (parseInt(a.recommendations_total) || 0);
            });
            
            renderGames(allGames.slice(0, displayCount));
            
            if (allGames.length > displayCount) {
                document.getElementById("loadMoreBtn").style.display = "inline-block";
            }
        }
    });

    function formatPrice(game) {
        if (game.is_free === "False" && game.mat_final_price && game.mat_final_price !== "0.0") {
            let priceNum = parseFloat(game.mat_final_price) / 100;
            return priceNum.toFixed(2) + " $";
        }
        return "Бесплатно";
    }

    function renderGames(gamesToRender) {
        gamesGrid.innerHTML = ""; 
        if (gamesToRender.length === 0) {
            gamesGrid.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>Ничего не найдено. Попробуйте другие слова.</p>";
            return;
        }

        gamesToRender.forEach(game => {
            const card = document.createElement("div");
            card.className = "game-card";
            card.onclick = () => openModal(game);

            const imgSrc = game.header_image ? game.header_image : "https://via.placeholder.com/460x215?text=No+Image";
            let desc = game.short_description.replace(/<[^>]*>?/gm, '');

            card.innerHTML = `
                <img src="${imgSrc}" alt="img" class="game-image" loading="lazy">
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                    <p class="game-desc">${desc}</p>
                    <span class="game-price">${formatPrice(game)}</span>
                </div>
            `;
            gamesGrid.appendChild(card);
        });
    }

    window.loadMore = function() {
        displayCount += 100;
        renderGames(allGames.slice(0, displayCount));
        
        if (allGames.length <= displayCount) {
            document.getElementById("loadMoreBtn").style.display = "none";
        }
    }

    window.openModal = function(game) {
        currentGame = game;
        document.getElementById("gameModal").style.display = "block";
        document.getElementById("modalImage").src = game.header_image || "https://via.placeholder.com/800x300?text=No+Image";
        document.getElementById("modalTitle").innerText = game.name;
        document.getElementById("modalDesc").innerText = game.short_description.replace(/<[^>]*>?/gm, '');
        document.getElementById("modalPrice").innerText = formatPrice(game);
        document.getElementById("modalDev").innerText = "Разработчик: " + (game.developers || "Неизвестен");
        document.getElementById("modalDate").innerText = "Дата выхода: " + (game.release_date || "Неизвестна");
    }

    window.closeModal = function() {
        document.getElementById("gameModal").style.display = "none";
    }

    window.onclick = function(event) {
        let modal = document.getElementById("gameModal");
        if (event.target == modal) closeModal();
    }

    window.findSimilar = function() {
        if (!currentGame) return;
        const stopWords = ["game", "games", "player", "players", "world", "play", "will", "your", "with", "this", "that", "have", "from", "into", "them", "they", "their", "about", "which", "when", "what", "where", "more", "most", "some", "such", "than", "then", "there", "these", "they", "thing", "things", "time", "very", "want", "well", "were", "what", "when", "where", "which", "while", "with", "would", "your"];
        let words = currentGame.short_description.toLowerCase().replace(/[^a-z\s]/g, '').split(' ').filter(w => w.length > 4 && !stopWords.includes(w));
        let keywords = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 4);
        
        let similar = allGames.filter(g => {
            if (g.appid === currentGame.appid) return false;
            let desc = g.short_description.toLowerCase();
            let matchCount = keywords.filter(kw => desc.includes(kw)).length;
            return matchCount >= 2;
        });

        similar.sort((a, b) => {
            if (a.penalty !== b.penalty) return b.penalty - a.penalty;
            let scoreA = parseInt(a.metacritic_score) || 0;
            let scoreB = parseInt(b.metacritic_score) || 0;
            if (a.recommendations_total && a.recommendations_total !== "0") scoreA += 20;
            if (b.recommendations_total && b.recommendations_total !== "0") scoreB += 20;
            return scoreB - scoreA;
        });

        window.showSection('games');
        searchInput.value = ""; 
        renderGames(similar.slice(0, 100));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    searchInput.addEventListener("input", (e) => {
        if (!isLoaded) return;
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            renderGames(allGames.slice(0, displayCount));
            return;
        }
        const filtered = allGames.filter(game => {
            return game.name.toLowerCase().includes(searchTerm) || game.short_description.toLowerCase().includes(searchTerm);
        });
        renderGames(filtered.slice(0, 100)); 
    });

    window.showSection = function(section) {
        document.getElementById('btnGames').classList.remove('active');
        document.getElementById('btnAnalytics').classList.remove('active');
        document.getElementById('btnMood').classList.remove('active');
        
        document.getElementById('gamesGrid').style.display = 'none';
        document.getElementById('analyticsSection').style.display = 'none';
        document.getElementById('moodSection').style.display = 'none';
        document.getElementById('loadMoreBtn').style.display = 'none';

        if (section === 'games') {
            document.getElementById('btnGames').classList.add('active');
            document.getElementById('gamesGrid').style.display = 'grid';
            searchContainer.style.display = 'flex'; 
            if (allGames.length > displayCount) document.getElementById('loadMoreBtn').style.display = 'inline-block';
            if(allGames.length > 0 && gamesGrid.innerHTML === "") renderGames(allGames.slice(0, displayCount));
        } else if (section === 'analytics') {
            document.getElementById('btnAnalytics').classList.add('active');
            document.getElementById('analyticsSection').style.display = 'block';
            searchContainer.style.display = 'none'; 
            buildCharts(); 
        } else if (section === 'mood') {
            document.getElementById('btnMood').classList.add('active');
            document.getElementById('moodSection').style.display = 'block';
            searchContainer.style.display = 'none'; 
        }
    }

    function buildCharts() {
        if (chartsBuilt) return; 
        chartsBuilt = true;

        let years = {};
        let freeCount = 0;
        let paidCount = 0;

        allGames.forEach(game => {
            if (game.release_date && game.release_date.length >= 4) {
                let year = game.release_date.substring(0, 4);
                if (!isNaN(year) && parseInt(year) > 1990) {
                    years[year] = (years[year] || 0) + 1;
                }
            }
            if (game.is_free === "True" || game.mat_final_price === "0.0") freeCount++;
            else paidCount++;
        });

        const sortedYears = Object.keys(years).sort();
        const yearData = sortedYears.map(y => years[y]);

        new Chart(document.getElementById('yearChart'), {
            type: 'bar',
            data: {
                labels: sortedYears,
                datasets: [{ label: 'Выпущено игр', data: yearData, backgroundColor: '#3b82f6', borderRadius: 5 }]
            },
            options: { color: '#fff', scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' } } } }
        });

        new Chart(document.getElementById('priceChart'), {
            type: 'doughnut',
            data: {
                labels: ['Бесплатные', 'Платные'],
                datasets: [{ data: [freeCount, paidCount], backgroundColor: ['#10b981', '#3b82f6'], borderWidth: 0 }]
            },
            options: { color: '#fff', plugins: { legend: { labels: { color: '#fff' } } } }
        });
    }

    window.findByMood = function(mood) {
        const moodTags = {
            'relax': ['relax', 'casual', 'cozy', 'peaceful', 'calm', 'farming', 'puzzle', 'chill'],
            'action': ['action', 'shooter', 'fast-paced', 'combat', 'fight', 'war', 'battle', 'intense'],
            'story': ['story', 'narrative', 'adventure', 'rpg', 'character', 'choice', 'plot', 'rich'],
            'hardcore': ['hard', 'souls-like', 'difficult', 'challenge', 'rogue', 'survival', 'punishing'],
            'horror': ['horror', 'scary', 'survival', 'dark', 'fear', 'zombie', 'monster', 'creepy']
        };

        let tags = moodTags[mood];
        
        let foundGames = allGames.filter(game => {
            let desc = game.short_description.toLowerCase();
            let matches = tags.filter(tag => desc.includes(tag)).length;
            return matches >= 2;
        });

        foundGames.sort((a, b) => {
            // Сначала нормальные, потом со штрафом
            if (a.penalty !== b.penalty) {
                return b.penalty - a.penalty;
            }
            let scoreA = parseInt(a.metacritic_score) || 0;
            let scoreB = parseInt(b.metacritic_score) || 0;
            return scoreB - scoreA;
        });

        window.showSection('games');
        renderGames(foundGames.slice(0, 100));
        
        setTimeout(() => {
            window.scrollTo({ top: 400, behavior: 'smooth' });
        }, 100);
    }
});