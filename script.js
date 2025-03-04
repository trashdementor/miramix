document.addEventListener('DOMContentLoaded', function() {
    let db;
    const request = indexedDB.open('MiraMIXDB', 4);

    const CLIENT_ID = '707439660280-hat6arhn868djnimb3bnf418bp2hnjlc.apps.googleusercontent.com';
    const API_KEY = 'AIzaSyDGczTbyZV_CpeEMRpkzPrDPOxwaCR6vbk';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';
    let tokenClient;

    request.onerror = function(event) {
        console.error('Ошибка IndexedDB:', event.target.errorCode);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('База данных готова');
        loadTopContent();
        setupNavigation();
        initGoogleDrive();
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        let objectStore;

        if (!db.objectStoreNames.contains('content')) {
            objectStore = db.createObjectStore('content', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('type', 'type', { unique: false });
            objectStore.createIndex('status', 'status', { unique: false });
            objectStore.createIndex('title', 'title', { unique: false });
            objectStore.createIndex('characteristics', 'characteristics', { unique: false });
            objectStore.createIndex('rating', 'rating', { unique: false });
            objectStore.createIndex('image', 'image', { unique: false });
        }

        if (!db.objectStoreNames.contains('auth')) {
            objectStore = db.createObjectStore('auth', { keyPath: 'key' });
        }
    };

    function getTokenFromDB() {
        return new Promise((resolve) => {
            const transaction = db.transaction(['auth'], 'readonly');
            const objectStore = transaction.objectStore('auth');
            const request = objectStore.get('googleAccessToken');
            request.onsuccess = function(event) {
                resolve(event.target.result ? event.target.result.value : null);
            };
            request.onerror = function(event) {
                console.error('Ошибка получения токена:', event.target.error);
                resolve(null);
            };
        });
    }

    function saveTokenToDB(token) {
        return new Promise((resolve) => {
            const transaction = db.transaction(['auth'], 'readwrite');
            const objectStore = transaction.objectStore('auth');
            const request = objectStore.put({ key: 'googleAccessToken', value: token });
            request.onsuccess = function() {
                resolve();
            };
            request.onerror = function(event) {
                console.error('Ошибка сохранения токена:', event.target.error);
                resolve();
            };
        });
    }

    function initGoogleDrive() {
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        saveTokenToDB(tokenResponse.access_token);
                        document.getElementById('auth-google-btn').style.display = 'none';
                        document.getElementById('save-to-drive-btn').style.display = 'inline';
                        document.getElementById('load-from-drive-btn').style.display = 'inline';
                    }
                }
            });

            const token = await getTokenFromDB();
            if (token && await isTokenValid(token)) {
                document.getElementById('auth-google-btn').style.display = 'none';
                document.getElementById('save-to-drive-btn').style.display = 'inline';
                document.getElementById('load-from-drive-btn').style.display = 'inline';
            } else {
                document.getElementById('auth-google-btn').addEventListener('click', () => {
                    tokenClient.requestAccessToken();
                });
            }
        });
    }

    async function isTokenValid(token) {
        try {
            const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async function getAccessToken() {
        let token = await getTokenFromDB();
        if (token && await isTokenValid(token)) {
            return token;
        }
        return new Promise((resolve, reject) => {
            tokenClient.callback = (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    saveTokenToDB(tokenResponse.access_token);
                    resolve(tokenResponse.access_token);
                } else {
                    reject(new Error('Не удалось получить токен'));
                }
            };
            tokenClient.requestAccessToken();
        });
    }

    const sections = document.querySelectorAll('.section');
    const links = document.querySelectorAll('nav a');

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            sections.forEach(section => {
                section.style.display = section.id === targetId ? 'block' : 'none';
            });
            if (['films', 'cartoons', 'series', 'cartoon-series', 'books', 'music', 'games', 'programs', 'recipes', 'sites'].includes(targetId)) {
                setupSearch(targetId);
            }
        });
    });

    document.getElementById('add-resource-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!db) return;

        const type = document.getElementById('resource-type').value;
        const title = document.getElementById('resource-title').value;
        const genre = document.getElementById('resource-genre').value;
        const year = document.getElementById('resource-year').value;
        const country = document.getElementById('resource-country').value;
        const author = document.getElementById('resource-author').value;
        const description = document.getElementById('resource-description').value;
        const fileInput = document.getElementById('resource-image');
        const status = document.getElementById('resource-status').value;
        const characteristics = document.getElementById('resource-characteristics').value || '';
        const rating = document.getElementById('resource-rating').value;

        let imageUrl = '';
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const response = await fetch('https://api.imgbb.com/1/upload?key=0599b64b7b92fc354f0c0b98c3b553ae', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                imageUrl = data.data.url;
            } else {
                alert('Ошибка загрузки изображения');
                return;
            }
        }

        const transaction = db.transaction(['content'], 'readwrite');
        const objectStore = transaction.objectStore('content');
        const newItem = {
            type, title, genre, year, country, author, description, status,
            characteristics: characteristics ? [characteristics] : [],
            rating, image: imageUrl
        };

        const saveRequest = objectStore.add(newItem);
        saveRequest.onsuccess = function() {
            alert('Ресурс добавлен');
            e.target.reset();
            loadTopContent();
            setupSearch(type);
        };
    });

    function setupSearch(type) {
        let prefix;
        switch(type) {
            case 'films': prefix = 'film'; break;
            case 'cartoons': prefix = 'cartoon'; break;
            case 'series': prefix = 'series'; break;
            case 'cartoon-series': prefix = 'cartoon-series'; break;
            case 'books': prefix = 'book'; break;
            case 'music': prefix = 'music'; break;
            case 'games': prefix = 'game'; break;
            case 'programs': prefix = 'program'; break;
            case 'recipes': prefix = 'recipe'; break;
            case 'sites': prefix = 'site'; break;
            default: return;
        }

        const statusEl = document.getElementById(`${prefix}-status`);
        const titleEl = document.getElementById(`${prefix}-title`);
        const genreEl = document.getElementById(`${prefix}-genre`);
        const yearEl = document.getElementById(`${prefix}-year`);
        const countryEl = document.getElementById(`${prefix}-country`);
        const authorEl = document.getElementById(`${prefix}-author`);
        const descriptionEl = document.getElementById(`${prefix}-description`);
        const charEl = document.getElementById(`${prefix}-characteristics`);
        const ratingEl = document.getElementById(`${prefix}-rating`);
        const searchBtn = document.getElementById(`${prefix}-search-btn`);
        const contentList = document.getElementById(`${prefix}-content-list`);

        if (!statusEl || !titleEl || !genreEl || !yearEl || !countryEl || !authorEl || !descriptionEl || !charEl || !ratingEl || !searchBtn || !contentList) {
            return;
        }

        function performSearch() {
            if (!db) return;
            const transaction = db.transaction(['content'], 'readonly');
            const objectStore = transaction.objectStore('content');
            const index = objectStore.index('type');
            const request = index.getAll(type);

            request.onsuccess = function(event) {
                let results = event.target.result;
                const filters = {
                    status: statusEl.value,
                    title: titleEl.value.toLowerCase(),
                    genre: genreEl.value.toLowerCase(),
                    year: yearEl.value,
                    country: countryEl.value.toLowerCase(),
                    author: authorEl.value.toLowerCase(),
                    description: descriptionEl.value.toLowerCase(),
                    characteristics: charEl.value ? [charEl.value] : [],
                    rating: ratingEl.value
                };

                if (filters.status) results = results.filter(item => item.status === filters.status);
                if (filters.title) results = results.filter(item => item.title.toLowerCase().includes(filters.title));
                if (filters.genre) results = results.filter(item => item.genre && item.genre.toLowerCase().includes(filters.genre));
                if (filters.year) results = results.filter(item => item.year && item.year.toString() === filters.year);
                if (filters.country) results = results.filter(item => item.country && item.country.toLowerCase().includes(filters.country));
                if (filters.author) results = results.filter(item => item.author && item.author.toLowerCase().includes(filters.author));
                if (filters.description) results = results.filter(item => item.description && item.description.toLowerCase().includes(filters.description));
                if (filters.characteristics.length) results = results.filter(item => filters.characteristics.every(c => item.characteristics.includes(c)));
                if (filters.rating) results = results.filter(item => item.rating === filters.rating);

                contentList.innerHTML = '';
                if (results.length === 0) {
                    contentList.innerHTML = '<p>Ничего не найдено</p>';
                } else {
                    results.forEach(item => {
                        const div = document.createElement('div');
                        const img = item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 100px; height: 150px;" loading="lazy">` : 'Нет изображения';
                        div.innerHTML = `${img} ${item.title} - ${item.status} - Оценка: ${item.rating}<br>
                            ${item.genre ? `Жанр: ${item.genre}<br>` : ''}
                            ${item.year ? `Год: ${item.year}<br>` : ''}
                            ${item.country ? `Страна: ${item.country}<br>` : ''}
                            ${item.author ? `${type === 'books' || type === 'music' ? 'Автор' : 'Разработчик'}: ${item.author}<br>` : ''}
                            ${item.description ? `Описание: ${item.description}<br>` : ''}
                            Характеристика: ${item.characteristics.join(', ') || 'Нет'}
                            <button onclick="deleteItem(${item.id}, '${type}')">Удалить</button>
                            <button onclick="editItem(${item.id}, '${type}')">Изменить</button>`;
                        contentList.appendChild(div);
                    });
                }
            };
        }

        searchBtn.addEventListener('click', performSearch);
        performSearch();
    }

    window.deleteItem = function(id, type) {
        if (!db) return;
        const transaction = db.transaction(['content'], 'readwrite');
        const objectStore = transaction.objectStore('content');
        const request = objectStore.delete(id);
        request.onsuccess = function() {
            alert('Элемент удалён');
            setupSearch(type);
            loadTopContent();
        };
    };

    window.editItem = function(id, type) {
        if (!db) return;
        const transaction = db.transaction(['content'], 'readonly');
        const objectStore = transaction.objectStore('content');
        const request = objectStore.get(id);

        request.onsuccess = function(event) {
            const item = event.target.result;
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-type').value = item.type;
            document.getElementById('edit-title').value = item.title;
            document.getElementById('edit-genre').value = item.genre || '';
            document.getElementById('edit-year').value = item.year || '';
            document.getElementById('edit-country').value = item.country || '';
            document.getElementById('edit-author').value = item.author || '';
            document.getElementById('edit-description').value = item.description || '';
            document.getElementById('edit-status').value = item.status;
            document.getElementById('edit-characteristics').value = item.characteristics[0] || '';
            document.getElementById('edit-rating').value = item.rating;

            document.getElementById('edit-modal').style.display = 'block';
            document.body.classList.add('modal-open');
        };
    };

    document.getElementById('close-modal').addEventListener('click', function() {
        document.getElementById('edit-modal').style.display = 'none';
        document.body.classList.remove('modal-open');
    });

    document.getElementById('edit-resource-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!db) return;

        const id = parseInt(document.getElementById('edit-id').value);
        const type = document.getElementById('edit-type').value;
        const title = document.getElementById('edit-title').value;
        const genre = document.getElementById('edit-genre').value;
        const year = document.getElementById('edit-year').value;
        const country = document.getElementById('edit-country').value;
        const author = document.getElementById('edit-author').value;
        const description = document.getElementById('edit-description').value;
        const fileInput = document.getElementById('edit-image');
        const status = document.getElementById('edit-status').value;
        const characteristics = document.getElementById('edit-characteristics').value || '';
        const rating = document.getElementById('edit-rating').value;

        let imageUrl = '';
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const response = await fetch('https://api.imgbb.com/1/upload?key=0599b64b7b92fc354f0c0b98c3b553ae', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                imageUrl = data.data.url;
            } else {
                alert('Ошибка загрузки изображения');
                return;
            }
        }

        const transaction = db.transaction(['content'], 'readwrite');
        const objectStore = transaction.objectStore('content');
        const requestGet = objectStore.get(id);

        requestGet.onsuccess = function(event) {
            const item = event.target.result;
            const updatedItem = {
                id, type, title, genre, year, country, author, description, status,
                characteristics: characteristics ? [characteristics] : [],
                rating, image: imageUrl || item.image
            };

            const requestUpdate = objectStore.put(updatedItem);
            requestUpdate.onsuccess = function() {
                alert('Ресурс обновлён');
                document.getElementById('edit-modal').style.display = 'none';
                document.body.classList.remove('modal-open');
                loadTopContent();
                setupSearch(type);
            };
        };
    });

    document.getElementById('export-btn').addEventListener('click', function() {
        if (!db) return;
        const transaction = db.transaction(['content'], 'readonly');
        const objectStore = transaction.objectStore('content');
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const data = event.target.result;
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'miramix_data.json';
            a.click();
            URL.revokeObjectURL(url);
        };
    });

    document.getElementById('import-btn').addEventListener('click', function() {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const data = JSON.parse(event.target.result);
            if (!Array.isArray(data)) {
                alert('Неверный формат файла');
                return;
            }

            const transaction = db.transaction(['content'], 'readwrite');
            const objectStore = transaction.objectStore('content');
            objectStore.clear().onsuccess = function() {
                data.forEach(item => objectStore.add(item));
                transaction.oncomplete = function() {
                    alert('Данные импортированы');
                    loadTopContent();
                    const currentSection = document.querySelector('.section:not([style*="display: none"])').id;
                    if (['films', 'cartoons', 'series', 'cartoon-series', 'books', 'music', 'games', 'programs', 'recipes', 'sites'].includes(currentSection)) {
                        setupSearch(currentSection);
                    }
                };
            };
        };
        reader.readAsText(file);
    });

    document.getElementById('save-to-drive-btn').addEventListener('click', async function() {
        if (!db) return;
        const transaction = db.transaction(['content'], 'readonly');
        const objectStore = transaction.objectStore('content');
        const request = objectStore.getAll();

        request.onsuccess = async function(event) {
            const data = event.target.result;
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });

            const accessToken = await getAccessToken();
            gapi.client.setToken({ access_token: accessToken });

            const metadata = { name: 'miramix_data.json', mimeType: 'application/json' };
            await gapi.client.drive.files.create({
                resource: metadata,
                media: { mimeType: 'application/json', body: blob },
                fields: 'id'
            });
            alert('Данные сохранены в Google Drive');
        };
    });

    document.getElementById('load-from-drive-btn').addEventListener('click', async function() {
        const accessToken = await getAccessToken();
        const listResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27miramix_data.json%27&fields=files(id)&orderBy=createdTime%20desc', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const listData = await listResponse.json();
        if (listData.files && listData.files.length > 0) {
            const fileId = listData.files[0].id;
            const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const data = await fileResponse.json();

            const transaction = db.transaction(['content'], 'readwrite');
            const objectStore = transaction.objectStore('content');
            objectStore.clear().onsuccess = function() {
                data.forEach(item => objectStore.add(item));
                transaction.oncomplete = function() {
                    alert('Данные загружены из Google Drive');
                    loadTopContent();
                    const currentSection = document.querySelector('.section:not([style*="display: none"])').id;
                    if (['films', 'cartoons', 'series', 'cartoon-series', 'books', 'music', 'games', 'programs', 'recipes', 'sites'].includes(currentSection)) {
                        setupSearch(currentSection);
                    }
                };
            };
        } else {
            alert('Файл не найден в Google Drive');
        }
    });

    function loadTopContent() {
        if (!db) return;
        const types = [
            { type: 'films', limit: 15, listId: 'top-films-list' },
            { type: 'cartoons', limit: 15, listId: 'top-cartoons-list' },
            { type: 'series', limit: 15, listId: 'top-series-list' },
            { type: 'cartoon-series', limit: 15, listId: 'top-cartoon-series-list' },
            { type: 'books', limit: 10, listId: 'top-books-list' },
            { type: 'music', limit: 10, listId: 'top-music-list' },
            { type: 'games', limit: 10, listId: 'top-games-list' },
            { type: 'programs', limit: 10, listId: 'top-programs-list' },
            { type: 'recipes', limit: 10, listId: 'top-recipes-list' },
            { type: 'sites', limit: 10, listId: 'top-sites-list' }
        ];

        types.forEach(({ type, limit, listId }) => {
            const transaction = db.transaction(['content'], 'readonly');
            const objectStore = transaction.objectStore('content');
            const index = objectStore.index('type');
            const request = index.getAll(type);

            request.onsuccess = function(event) {
                const items = event.target.result || [];
                renderTopList(listId, items, limit);
            };
        });
    }

    function renderTopList(listId, items, limit) {
        const list = document.getElementById(listId);
        if (!list) return;

        const allowedStatuses = ['🌕', '🌗'];
        const ratings = { '💀': 0, '💩': 1, '🍋': 2, '🍅': 3, '🍊': 4, '🍒': 5, '🌽': 6, '🧅': 7 };
        let filteredItems = items
            .filter(item => allowedStatuses.includes(item.status))
            .filter(item => {
                const ratingValue = ratings[item.rating];
                return ratingValue >= 4 && ratingValue <= 7;
            })
            .sort((a, b) => ratings[b.rating] - ratings[a.rating])
            .slice(0, limit);

        list.innerHTML = '';
        if (filteredItems.length === 0) {
            list.innerHTML = '<p>Нет элементов</p>';
        } else {
            filteredItems.forEach((item, index) => {
                const div = document.createElement('div');
                const img = item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 100px; height: 150px;" loading="lazy">` : 'Нет изображения';
                div.innerHTML = `${img} ${item.title} - ${item.status} - Оценка: ${item.rating}<br>
                    ${item.genre ? `Жанр: ${item.genre}<br>` : ''}
                    ${item.year ? `Год: ${item.year}<br>` : ''}
                    ${item.country ? `Страна: ${item.country}<br>` : ''}
                    ${item.author ? `${item.type === 'books' || item.type === 'music' ? 'Автор' : 'Разработчик'}: ${item.author}<br>` : ''}
                    ${item.description ? `Описание: ${item.description}<br>` : ''}
                    Характеристика: ${item.characteristics.join(', ') || 'Нет'}`;
                list.appendChild(div);
                setTimeout(() => div.classList.add('visible'), index * 100);
            });
        }

        updateScrollIndicator(list);
    }

    function setupNavigation() {
        const topLists = document.querySelectorAll('.content-list.horizontal');
        const prevButtons = document.querySelectorAll('.prev-btn');
        const nextButtons = document.querySelectorAll('.next-btn');
        const scrollStep = 200;

        topLists.forEach(list => {
            // Прокрутка пальцем на мобильных
            let startX, scrollLeft, isDragging = false;
            list.addEventListener('touchstart', (e) => {
                isDragging = true;
                startX = e.touches[0].pageX;
                scrollLeft = list.scrollLeft;
            }, { passive: true });
            list.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.touches[0].pageX;
                const delta = x - startX;
                list.scrollLeft = scrollLeft - delta;
            }, { passive: false });
            list.addEventListener('touchend', () => isDragging = false, { passive: true });

            // Прокрутка колёсиком на ПК
            list.addEventListener('wheel', (e) => {
                e.preventDefault();
                list.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' });
            }, { passive: false });

            // Обновление индикатора прокрутки
            list.addEventListener('scroll', () => updateScrollIndicator(list));
        });

        prevButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const list = this.nextElementSibling;
                if (list) list.scrollBy({ left: -scrollStep, behavior: 'smooth' });
            });
        });

        nextButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const list = this.previousElementSibling;
                if (list) list.scrollBy({ left: scrollStep, behavior: 'smooth' });
            });
        });
    }

    function updateScrollIndicator(list) {
        const type = list.id.replace('top-', '').replace('-list', '');
        const indicatorBar = document.querySelector(`.scroll-indicator-bar[data-type="${type}"]`);
        if (!indicatorBar) return;

        const scrollLeft = list.scrollLeft;
        const scrollWidth = list.scrollWidth;
        const clientWidth = list.clientWidth;

        if (scrollWidth <= clientWidth) {
            indicatorBar.style.width = '100%';
            indicatorBar.style.left = '0';
        } else {
            const scrollPercentage = scrollLeft / (scrollWidth - clientWidth);
            const barWidthPercentage = clientWidth / scrollWidth;
            indicatorBar.style.width = `${barWidthPercentage * 100}%`;
            indicatorBar.style.left = `${scrollPercentage * (100 - barWidthPercentage * 100)}%`;
        }
    }
});
