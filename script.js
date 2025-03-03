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

    function getTokenFromDB(callback) {
        const transaction = db.transaction(['auth'], 'readonly');
        const objectStore = transaction.objectStore('auth');
        const request = objectStore.get('googleAccessToken');
        request.onsuccess = function(event) {
            callback(event.target.result ? event.target.result.value : null);
        };
        request.onerror = function(event) {
            console.error('Ошибка получения токена из базы:', event.target.error);
            callback(null);
        };
    }

    function saveTokenToDB(token) {
        const transaction = db.transaction(['auth'], 'readwrite');
        const objectStore = transaction.objectStore('auth');
        objectStore.put({ key: 'googleAccessToken', value: token });
    }

    function initGoogleDrive() {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                });
                console.log('Google Drive API инициализирован');

                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            gapi.client.setToken(tokenResponse);
                            saveTokenToDB(tokenResponse.access_token);
                            document.getElementById('auth-google-btn').style.display = 'none';
                            document.getElementById('save-to-drive-btn').style.display = 'inline';
                            document.getElementById('load-from-drive-btn').style.display = 'inline';
                            console.log('Авторизация успешна');
                        }
                    },
                });

                getTokenFromDB((accessToken) => {
                    if (accessToken) {
                        gapi.client.setToken({ access_token: accessToken });
                        document.getElementById('auth-google-btn').style.display = 'none';
                        document.getElementById('save-to-drive-btn').style.display = 'inline';
                        document.getElementById('load-from-drive-btn').style.display = 'inline';
                        console.log('Использован сохранённый токен');
                    } else {
                        document.getElementById('auth-google-btn').addEventListener('click', handleAuthClick);
                    }
                });
            } catch (error) {
                console.error('Ошибка инициализации Google API:', error);
            }
        });
    }

    function handleAuthClick() {
        tokenClient.requestAccessToken();
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
        if (!db) {
            alert('База данных ещё не готова. Попробуйте позже.');
            return;
        }

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
            try {
                const formData = new FormData();
                formData.append('image', fileInput.files[0]);
                const response = await fetch('https://api.imgbb.com/1/upload?key=0599b64b7b92fc354f0c0b98c3b553ae', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    imageUrl = data.data.url;
                    console.log('Image URL:', imageUrl);
                    alert('Изображение загружено');
                } else {
                    console.error('Ошибка ImgBB:', data);
                    alert('Ошибка загрузки изображения: ' + (data.error?.message || 'Неизвестная ошибка'));
                    return;
                }
            } catch (error) {
                console.error('Ошибка при загрузке:', error.message);
                alert('Ошибка загрузки изображения: ' + error.message);
                return;
            }
        }

        const transaction = db.transaction(['content'], 'readwrite');
        const objectStore = transaction.objectStore('content');
        const newItem = {
            type: type,
            title: title,
            genre: genre,
            year: year,
            country: country,
            author: author,
            description: description,
            status: status,
            characteristics: characteristics ? [characteristics] : [],
            rating: rating,
            image: imageUrl
        };

        const saveRequest = objectStore.add(newItem);
        saveRequest.onsuccess = function() {
            alert('Ресурс добавлен');
            e.target.reset();
            loadTopContent();
            setupSearch(type);
        };
        saveRequest.onerror = function(event) {
            console.error('Ошибка при добавлении:', event.target.error);
            alert('Ошибка при добавлении ресурса');
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
            console.error(`Один из элементов для ${type} не найден`);
            return;
        }

        function performSearch() {
            if (!db) return;
            const status = statusEl.value;
            const title = titleEl.value.toLowerCase();
            const genre = genreEl.value.toLowerCase();
            const year = yearEl.value;
            const country = countryEl.value.toLowerCase();
            const author = authorEl.value.toLowerCase();
            const description = descriptionEl.value.toLowerCase();
            const characteristics = charEl.value ? [charEl.value] : [];
            const rating = ratingEl.value;

            const transaction = db.transaction(['content'], 'readonly');
            const objectStore = transaction.objectStore('content');
            const index = objectStore.index('type');
            const request = index.getAll(type);

            request.onsuccess = function(event) {
                let results = event.target.result;

                if (status) results = results.filter(item => item.status === status);
                if (title) results = results.filter(item => item.title.toLowerCase().includes(title));
                if (genre) results = results.filter(item => item.genre && item.genre.toLowerCase().includes(genre));
                if (year) results = results.filter(item => item.year && item.year.toString() === year);
                if (country) results = results.filter(item => item.country && item.country.toLowerCase().includes(country));
                if (author) results = results.filter(item => item.author && item.author.toLowerCase().includes(author));
                if (description) results = results.filter(item => item.description && item.description.toLowerCase().includes(description));
                if (characteristics.length > 0) {
                    results = results.filter(item => characteristics.every(char => item.characteristics.includes(char)));
                }
                if (rating) results = results.filter(item => item.rating === rating);

                contentList.innerHTML = '';
                if (results.length === 0) {
                    contentList.innerHTML = '<p>Ничего не найдено</p>';
                } else {
                    results.forEach(item => {
                        const div = document.createElement('div');
                        const img = item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 100px; height: 150px;" loading="lazy">` : 'Нет изображения';
                        const genreText = item.genre ? `Жанр: ${item.genre}` : '';
                        const yearText = item.year ? `Год: ${item.year}` : '';
                        const countryText = item.country ? `Страна: ${item.country}` : '';
                        const authorText = item.author ? `${type === 'books' || type === 'music' ? 'Автор' : 'Разработчик'}: ${item.author}` : '';
                        const descText = item.description ? `Описание: ${item.description}` : '';
                        div.innerHTML = `${img} ${item.title} - ${item.status} - Оценка: ${item.rating} - Характеристика: ${item.characteristics.join(', ') || 'Нет'} 
                            ${genreText ? '<br>' + genreText : ''} ${yearText ? '<br>' + yearText : ''} ${countryText ? '<br>' + countryText : ''} ${authorText ? '<br>' + authorText : ''} ${descText ? '<br>' + descText : ''} 
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

    window.editItem = async function(id, type) {
        if (!db) return;
        const transaction = db.transaction(['content'], 'readonly');
        const objectStore = transaction.objectStore('content');
        const request = objectStore.get(id);

        request.onsuccess = function(event) {
            const item = event.target.result;
            if (!item) return;

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

            const modal = document.getElementById('edit-modal');
            modal.style.display = 'block';
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
            try {
                const formData = new FormData();
                formData.append('image', fileInput.files[0]);
                const response = await fetch('https://api.imgbb.com/1/upload?key=0599b64b7b92fc354f0c0b98c3b553ae', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    imageUrl = data.data.url;
                    console.log('Image URL:', imageUrl);
                    alert('Изображение загружено');
                } else {
                    console.error('Ошибка ImgBB:', data);
                    alert('Ошибка загрузки изображения');
                    return;
                }
            } catch (error) {
                console.error('Ошибка при загрузке:', error.message);
                alert('Ошибка загрузки изображения: ' + error.message);
                return;
            }
        }

        const transaction = db.transaction(['content'], 'readwrite');
        const objectStore = transaction.objectStore('content');
        const requestGet = objectStore.get(id);

        requestGet.onsuccess = function(event) {
            const item = event.target.result;
            if (!item) return;

            const updatedItem = {
                id: id,
                type: type,
                title: title,
                genre: genre,
                year: year,
                country: country,
                author: author,
                description: description,
                status: status,
                characteristics: characteristics ? [characteristics] : [],
                rating: rating,
                image: imageUrl || item.image
            };

            const requestUpdate = objectStore.put(updatedItem);
            requestUpdate.onsuccess = function() {
                alert('Ресурс обновлён');
                document.getElementById('edit-modal').style.display = 'none';
                document.body.classList.remove('modal-open');
                loadTopContent();
                setupSearch(type);
            };
            requestUpdate.onerror = function(event) {
                console.error('Ошибка при обновлении:', event.target.error);
                alert('Ошибка при обновлении ресурса');
            };
        };
    });

    document.getElementById('export-btn').addEventListener('click', function() {
        if (!db) {
            alert('База данных ещё не готова.');
            return;
        }

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
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Данные экспортированы в файл miramix_data.json');
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
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data)) {
                    alert('Неверный формат файла. Ожидается массив данных.');
                    return;
                }

                const transaction = db.transaction(['content'], 'readwrite');
                const objectStore = transaction.objectStore('content');

                objectStore.clear().onsuccess = function() {
                    data.forEach(item => {
                        objectStore.add(item);
                    });

                    transaction.oncomplete = function() {
                        alert('Данные успешно импортированы');
                        loadTopContent();
                        const currentSection = document.querySelector('.section:not([style*="display: none"])').id;
                        if (['films', 'cartoons', 'series', 'cartoon-series', 'books', 'music', 'games', 'programs', 'recipes', 'sites'].includes(currentSection)) {
                            setupSearch(currentSection);
                        }
                    };
                    transaction.onerror = function(event) {
                        console.error('Ошибка при импорте:', event.target.error);
                        alert('Ошибка при импорте данных');
                    };
                };
            } catch (error) {
                console.error('Ошибка парсинга JSON:', error);
                alert('Ошибка при чтении файла: ' + error.message);
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('save-to-drive-btn').addEventListener('click', async function() {
        if (!db) {
            alert('База данных ещё не готова.');
            console.error('База данных не инициализирована');
            return;
        }

        console.log('Начало сохранения в Google Drive');
        const transaction = db.transaction(['content'], 'readonly');
        const objectStore = transaction.objectStore('content');
        const request = objectStore.getAll();

        request.onsuccess = async function(event) {
            console.log('Запрос на получение данных выполнен');
            const data = event.target.result;
            console.log('Данные из базы:', data);

            if (!data || !Array.isArray(data) || data.length === 0) {
                alert('Нет данных для сохранения или данные некорректны.');
                console.error('Данные отсутствуют или не являются массивом:', data);
                return;
            }

            const json = JSON.stringify(data, null, 2);
            console.log('JSON для сохранения:', json);

            const blob = new Blob([json], { type: 'application/json' });
            console.log('Blob создан, размер:', blob.size);

            const metadata = {
                name: 'miramix_data.json',
                mimeType: 'application/json'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            try {
                const response = await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    headers: {
                        'Content-Type': 'multipart/related; boundary=foo_bar_baz'
                    },
                    body: form
                });
                console.log('Файл успешно сохранён в Drive:', response.result);
                alert('Данные успешно сохранены в Google Drive как miramix_data.json');
            } catch (error) {
                console.error('Ошибка при сохранении в Google Drive:', error);
                alert('Ошибка при сохранении: ' + error.message);
            }
        };

        request.onerror = function(event) {
            console.error('Ошибка получения данных из базы:', event.target.error);
            alert('Ошибка получения данных из базы');
        };
    });

    document.getElementById('load-from-drive-btn').addEventListener('click', function() {
        gapi.client.drive.files.list({
            q: "name='miramix_data.json'",
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc'
        }).then(response => {
            const files = response.result.files;
            if (files && files.length > 0) {
                const fileId = files[0].id;
                gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                }).then(response => {
                    const data = JSON.parse(response.body);
                    if (!Array.isArray(data)) {
                        alert('Неверный формат файла из Google Drive');
                        return;
                    }

                    const transaction = db.transaction(['content'], 'readwrite');
                    const objectStore = transaction.objectStore('content');

                    objectStore.clear().onsuccess = function() {
                        data.forEach(item => {
                            objectStore.add(item);
                        });

                        transaction.oncomplete = function() {
                            alert('Данные успешно загружены из Google Drive');
                            loadTopContent();
                            const currentSection = document.querySelector('.section:not([style*="display: none"])').id;
                            if (['films', 'cartoons', 'series', 'cartoon-series', 'books', 'music', 'games', 'programs', 'recipes', 'sites'].includes(currentSection)) {
                                setupSearch(currentSection);
                            }
                        };
                        transaction.onerror = function(event) {
                            console.error('Ошибка при импорте из Drive:', event.target.error);
                            alert('Ошибка при импорте данных из Google Drive');
                        };
                    };
                }).catch(error => {
                    console.error('Ошибка загрузки файла из Drive:', error);
                    alert('Ошибка загрузки файла из Google Drive: ' + error.message);
                });
            } else {
                alert('Файл miramix_data.json не найден в Google Drive');
                console.log('Список файлов:', response.result);
            }
        }).catch(error => {
            console.error('Ошибка поиска файла в Drive:', error);
            alert('Ошибка поиска файла в Google Drive: ' + error.message);
        });
    });

    function loadTopContent() {
        if (!db) {
            console.error('База данных не инициализирована');
            return;
        }

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
                console.log(`Тип: ${type}, Загружено элементов: ${items.length}`);
                renderTopList(listId, items, limit);
            };
            request.onerror = function(event) {
                console.error(`Ошибка загрузки данных для ${type}:`, event.target.error);
            };
        });
    }

    function renderTopList(listId, items, limit) {
        const list = document.getElementById(listId);
        if (!list) {
            console.error(`Элемент с ID ${listId} не найден`);
            return;
        }

        const allowedStatuses = ['🌕', '🌗'];
        let filteredItems = items.filter(item => allowedStatuses.includes(item.status));

        const ratings = { '💀': 0, '💩': 1, '🍋': 2, '🍅': 3, '🍊': 4, '🍒': 5, '🌽': 6, '🧅': 7 };
        filteredItems = filteredItems.filter(item => {
            const ratingValue = ratings[item.rating];
            return ratingValue >= 4 && ratingValue <= 7;
        });

        filteredItems.sort((a, b) => {
            const ratingsOrder = { '🧅': 7, '🌽': 6, '🍒': 5, '🍊': 4, '🍅': 3, '🍋': 2, '💩': 1, '💀': 0 };
            return ratingsOrder[b.rating] - ratingsOrder[a.rating];
        });

        const topItems = filteredItems.slice(0, limit);

        list.innerHTML = '';
        if (topItems.length === 0) {
            list.innerHTML = '<p>Нет элементов, соответствующих критериям</p>';
        } else {
            topItems.forEach((item, index) => {
                const div = document.createElement('div');
                const img = item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 100px; height: 150px;" loading="lazy">` : 'Нет изображения';
                const genreText = item.genre ? `Жанр: ${item.genre}` : '';
                const yearText = item.year ? `Год: ${item.year}` : '';
                const countryText = item.country ? `Страна: ${item.country}` : '';
                const authorText = item.author ? `${item.type === 'books' || item.type === 'music' ? 'Автор' : 'Разработчик'}: ${item.author}` : '';
                const descText = item.description ? `Описание: ${item.description}` : '';
                div.innerHTML = `${img} ${item.title} - ${item.status} - Оценка: ${item.rating} - Характеристика: ${item.characteristics.join(', ') || 'Нет'} 
                    ${genreText ? '<br>' + genreText : ''} ${yearText ? '<br>' + yearText : ''} ${countryText ? '<br>' + countryText : ''} ${authorText ? '<br>' + authorText : ''} ${descText ? '<br>' + descText : ''}`;
                list.appendChild(div);
                setTimeout(() => {
                    div.style.animationDelay = `${index * 0.1}s`;
                }, 0);
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
            let startX = 0;
            let scrollLeft = 0;
            let isDragging = false;

            list.addEventListener('mousedown', startDragging);
            list.addEventListener('mousemove', drag);
            list.addEventListener('mouseup', stopDragging);
            list.addEventListener('mouseleave', stopDragging);

            list.addEventListener('touchstart', startDragging);
            list.addEventListener('touchmove', drag);
            list.addEventListener('touchend', stopDragging);

            list.addEventListener('scroll', () => updateScrollIndicator(list));

            function startDragging(e) {
                isDragging = true;
                startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                scrollLeft = list.scrollLeft;
            }

            function drag(e) {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                const delta = x - startX;
                list.scrollLeft = scrollLeft - delta;
            }

            function stopDragging() {
                isDragging = false;
            }
        });

        prevButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const list = this.nextElementSibling;
                list.scrollBy({ left: -scrollStep, behavior: 'smooth' });
            });
        });

        nextButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const list = this.previousElementSibling;
                list.scrollBy({ left: scrollStep, behavior: 'smooth' });
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
            return;
        }

        const scrollPercentage = scrollLeft / (scrollWidth - clientWidth);
        const barWidthPercentage = clientWidth / scrollWidth;
        const barWidth = barWidthPercentage * 100;

        indicatorBar.style.width = `${barWidth}%`;
        indicatorBar.style.left = `${scrollPercentage * (100 - barWidth)}%`;
    }
});
