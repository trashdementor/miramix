document.addEventListener('DOMContentLoaded', function() {
    let db;
    const request = indexedDB.open('MiraMIXDB', 3);

    request.onerror = function(event) {
        console.error('Ошибка IndexedDB:', event.target.errorCode);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('База данных готова');
        loadTopContent();
        setupNavigation();
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
        } else {
            objectStore = event.target.transaction.objectStore('content');
        }

        if (!objectStore.indexNames.contains('genre')) {
            objectStore.createIndex('genre', 'genre', { unique: false });
        }
        if (!objectStore.indexNames.contains('year')) {
            objectStore.createIndex('year', 'year', { unique: false });
        }
        if (!objectStore.indexNames.contains('country')) {
            objectStore.createIndex('country', 'country', { unique: false });
        }
        if (!objectStore.indexNames.contains('author')) {
            objectStore.createIndex('author', 'author', { unique: false });
        }
        if (!objectStore.indexNames.contains('description')) {
            objectStore.createIndex('description', 'description', { unique: false });
        }
    };

    // Навигация
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

    // Добавление ресурса
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

    // Поиск с кнопкой
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
                        const img = item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 100px; height: 150px;">` : 'Нет изображения';
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

    // Удаление
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

    // Редактирование
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

    // Экспорт данных
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

    // Импорт данных
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

    // Топ контент с горизонтальной прокруткой
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
                let items = event.target.result;
                items.sort((a, b) => {
                    const ratings = { '🧅': 7, '🌽': 6, '🍒': 5, '🍊': 4, '🍅': 3, '🍋': 2, '💩': 1, '💀': 0 };
                    return ratings[b.rating] - ratings[a.rating];
                });
                const topItems = items.slice(0, limit);
                renderTopList(listId, topItems);
            };
        });
    }

    function renderTopList(listId, items) {
        const list = document.getElementById(listId);
        if (!list) return;

        list.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            const img = item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 100px; height: 150px;">` : 'Нет изображения';
            const genreText = item.genre ? `Жанр: ${item.genre}` : '';
            const yearText = item.year ? `Год: ${item.year}` : '';
            const countryText = item.country ? `Страна: ${item.country}` : '';
            const authorText = item.author ? `${item.type === 'books' || item.type === 'music' ? 'Автор' : 'Разработчик'}: ${item.author}` : '';
            const descText = item.description ? `Описание: ${item.description}` : '';
            div.innerHTML = `${img} ${item.title} - ${item.status} - Оценка: ${item.rating} - Характеристика: ${item.characteristics.join(', ') || 'Нет'} 
                ${genreText ? '<br>' + genreText : ''} ${yearText ? '<br>' + yearText : ''} ${countryText ? '<br>' + countryText : ''} ${authorText ? '<br>' + authorText : ''} ${descText ? '<br>' + descText : ''}`;
            list.appendChild(div);
        });
    }

    function setupNavigation() {
        const topLists = document.querySelectorAll('.content-list.horizontal');
        const prevButtons = document.querySelectorAll('.prev-btn');
        const nextButtons = document.querySelectorAll('.next-btn');
        const scrollStep = 200; // Шаг прокрутки в пикселях

        topLists.forEach(list => {
            let startX = 0;
            let scrollLeft = 0;
            let isDragging = false;
            let velocity = 0;
            let lastX = 0;
            let lastTime = 0;

            list.addEventListener('mousedown', startDragging);
            list.addEventListener('mousemove', drag);
            list.addEventListener('mouseup', stopDragging);
            list.addEventListener('mouseleave', stopDragging);

            list.addEventListener('touchstart', startDragging);
            list.addEventListener('touchmove', drag);
            list.addEventListener('touchend', stopDragging);

            function startDragging(e) {
                isDragging = true;
                startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                scrollLeft = list.scrollLeft;
                lastX = startX;
                lastTime = Date.now();
                list.style.transition = 'none';
            }

            function drag(e) {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                const delta = x - startX;
                list.scrollLeft = scrollLeft - delta;

                const timeNow = Date.now();
                const timeDelta = timeNow - lastTime;
                if (timeDelta > 0) {
                    velocity = (x - lastX) / timeDelta; // Скорость в px/мс
                    lastX = x;
                    lastTime = timeNow;
                }
            }

            function stopDragging(e) {
                if (!isDragging) return;
                isDragging = false;

                // Инерция только для тач-событий
                if (e.type === 'touchend' && Math.abs(velocity) > 0.5) {
                    const momentum = velocity * 600; // Усиление инерции
                    const newScrollLeft = list.scrollLeft - momentum;
                    list.scrollTo({
                        left: Math.max(0, Math.min(newScrollLeft, list.scrollWidth - list.clientWidth)),
                        behavior: 'smooth'
                    });
                }
            }
        });

        // Стрелки для ПК
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
});
