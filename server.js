let currentTrackId = "";
        let radioInterval = null;
        let isListening = false;
        const player = document.getElementById('radioPlayer');
        const volumeSlider = document.getElementById('volumeSlider');
        
        player.volume = volumeSlider.value;
        volumeSlider.addEventListener('input', (e) => { player.volume = e.target.value; });

        async function syncTrack() {
            try {
                const res = await fetch('/api/current-track');
                const data = await res.json();
                
                document.getElementById('viewers').innerText = data.listeners || 0;

                if (!isListening) return;

                if (data.is_playing) {
                    if (data.track_id !== currentTrackId) {
                        currentTrackId = data.track_id;
                        const startSec = Math.floor(data.progress_ms / 1000);
                        
                        // KULLANICIYI BEKLEMESİ İÇİN UYARIYORUZ
                        document.getElementById('status').innerText = "Sinyal Bekleniyor (10-15 sn sürebilir) ⏳";
                        document.getElementById('track-name').innerText = data.query.replace(" lyrics", "");
                        document.getElementById('liveBadge').style.display = 'inline-block';
                        
                        if(data.album_art) {
                            const img = document.getElementById('albumCover');
                            img.src = data.album_art;
                            img.style.display = 'block';
                            document.body.style.backgroundImage = `url('${data.album_art}')`;
                        }
                        
                        player.src = `/api/stream?q=${encodeURIComponent(data.query)}&seek=${startSec}`;
                        
                        // GÜVENLİ OYNATMA BAŞLATICI (Hata Çökmesini Engeller)
                        const playPromise = player.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                // Müzik gerçekten başladığında yazıyı değiştir
                                document.getElementById('status').innerText = "Şu an Çalıyor 🎵";
                            }).catch(error => {
                                console.log("Oynatma bekleniyor veya iptal edildi:", error.message);
                            });
                        }
                    } 
                } else {
                    resetPlayerInfo("Yayıncı Müzik Dinlemiyor");
                }
            } catch (err) { console.error("Veri çekilemedi:", err); }
        }

        function startRadio() {
            isListening = true;
            document.getElementById('playBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';
            document.getElementById('status').innerText = "Bağlanıyor...";
            
            syncTrack();
            radioInterval = setInterval(syncTrack, 6000); 
        }

        function stopRadio() {
            isListening = false;
            clearInterval(radioInterval); 
            resetPlayerInfo("Yayın Duraklatıldı");
            player.src = ""; // Önce kaynağı temizle
            
            document.getElementById('stopBtn').style.display = 'none';
            document.getElementById('playBtn').style.display = 'block';
        }

        function resetPlayerInfo(statusMsg) {
            currentTrackId = ""; 
            player.pause();
            document.getElementById('status').innerText = statusMsg;
            document.getElementById('track-name').innerText = "";
            document.getElementById('liveBadge').style.display = 'none';
            document.getElementById('albumCover').style.display = 'none';
            document.body.style.backgroundImage = 'none';
        }

        setInterval(() => { if(!isListening) syncTrack(); }, 6000);
        syncTrack();