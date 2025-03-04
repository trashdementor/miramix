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
        document.querySelector('.section').classList.add('active');
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains('content')) {
            let objectStore = db.createObjectStore('content', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('type', 'type', { unique: false });
            objectStore.createIndex('status', 'status', { unique: false });
            objectStore.createIndex('title', 'title', { unique: false });
            objectStore.createIndex('characteristics', 'characteristics', { unique: false });
            objectStore.createIndex('rating', 'rating', { unique: false });
            objectStore.createIndex('image', 'image', { unique: false });
        }
        if (!db.objectStoreNames.contains('auth')) {
            db.createObjectStore('auth', { keyPath: 'key' });
        }
    };

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
                            saveTokenToDB(tokenResponse.access_token);
                            document.getElementById('auth-google-btn').style.display = 'none';
                            document.getElementById('save-to-drive-btn').style.display = 'inline';
                            document.getElementById('load-from-drive-btn').style.display = 'inline';
                        }
                    }
                });
                const token = await getTokenFromDB();
                if (token && await isTokenValid(token)) {
                    console.log('Использован сохранённый токен:', token);
                    document.getElementById('auth-google-btn').style.display = 'none';
                    document.getElementById('save-to-drive-btn').style.display = 'inline';
                    document.getElementById('load-from-drive-btn').style.display = 'inline';
                } else {
                    console.log('Токен отсутствует или недействителен, требуется авторизация');
                    document.getElementById('auth-google-btn').addEventListener('click', () => {
                        tokenClient.requestAccessToken();
                    });
                }
            } catch (error) {
                console.error('Ошибка инициализации Google API:', error);
            }
        });
    }

    function getTokenFromDB() {
        return new Promise((resolve) => {
            const transaction = db.transaction(['auth'], 'readonly');
            const objectStore = transaction.objectStore('auth');
            const request = objectStore.get('googleAccessToken');
            request.onsuccess = function(event) {
                resolve(event.target.result ? event.target.result.value : null);
            };
        });
    }

    function saveTokenToDB(token) {
        return new Promise((resolve) => {
            const transaction = db.transaction(['auth'], 'readwrite');
            const objectStore = transaction.objectStore('auth');
            objectStore.put({ key: 'googleAccessToken', value: token });
            resolve();
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

    const sections = document.querySelectorAll('.section');
    const links = document.querySelectorAll('nav a');

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');
                }
            });
            if (['films', 'cartoons', 'series', 'cartoon-series', 'books', 'music', 'games', 'programs', 'recipes', 'sites'].includes(targetId)) {
                setupSearch(targetId);
            }
        });
    });

    function setupNavigation() {
        const topLists = document.querySelectorAll('.content-list.horizontal');
        topLists.forEach(list => {
            let startX = 0;
            let scrollLeft = 0;
            let isDragging = false;
            let velocity = 0;
            let lastX = 0;
            let lastTime = 0;
            let animationFrameId = null;

            list.addEventListener('touchstart', startDragging, { passive: true });
            list.addEventListener('touchmove', drag, { passive: false });
            list.addEventListener('touchend', stopDragging, { passive: true });

            list.addEventListener('mousedown', startDragging);
            list.addEventListener('mousemove', drag);
            list.addEventListener('mouseup', stopDragging);
            list.addEventListener('mouseleave', stopDragging);

            list.addEventListener('wheel', (e) => {
                e.preventDefault();
                list.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' });
            });

            function startDragging(e) {
                isDragging = true;
                startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                scrollLeft = list.scrollLeft;
                lastX = startX;
                lastTime = performance.now();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
            }

            function drag(e) {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                const currentTime = performance.now();
                const delta = x - startX;
                list.scrollLeft = scrollLeft - delta;

                const timeDiff = currentTime - lastTime;
                if (timeDiff > 0) {
                    velocity = (x - lastX) / timeDiff;
                }
                lastX = x;
                lastTime = currentTime;
            }

            function stopDragging() {
                if (!isDragging) return;
                isDragging = false;
                if (Math.abs(velocity) > 0.1) {
                    function animateScroll() {
                        const currentTime = performance.now();
                        const timeDiff = currentTime - lastTime;
                        list.scrollLeft -= velocity * timeDiff * 60;
                        velocity *= 0.95;

                        if (list.scrollLeft <= 0 || list.scrollLeft >= list.scrollWidth - list.clientWidth) {
                            velocity = 0;
                        }
                        if (Math.abs(velocity) > 0.1) {
                            lastTime = currentTime;
                            animationFrameId = requestAnimationFrame(animateScroll);
                        }
                    }
                    lastTime = performance.now();
                    animationFrameId = requestAnimationFrame(animateScroll);
                }
            }
        });
    }

    function loadTopContent() {
        // Здесь добавь свою реализацию загрузки топ-контента
    }

    function setupSearch(type) {
        // Здесь добавь свою реализацию поиска для указанного типа
    }
});
