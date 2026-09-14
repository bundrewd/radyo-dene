require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const ytSearch = require('yt-search');
const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.set('trust proxy', true); 
app.use(cors()).use(cookieParser());
app.use(express.static('public'));

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

let hostAccessToken = null;
let activeListeners = new Map(); 

app.get('/login', (req, res) => {
    const scope = 'user-read-currently-playing user-read-playback-state';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({ response_type: 'code', client_id, scope, redirect_uri })
    );
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({ code, redirect_uri, grant_type: 'authorization_code' }),
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        hostAccessToken = response.data.access_token;
        res.send('<h1 style="color:#1DB954; text-align:center;">Giriş Başarılı!</h1><p style="text-align:center;">Sekmeyi kapatıp radyoya dönebilirsiniz.</p>');
    } catch (error) {
        res.send('Giriş hatası oluştu.');
    }
});

app.get('/api/current-track', async (req, res) => {
    const userIp = req.ip || req.connection.remoteAddress;
    activeListeners.set(userIp, Date.now());
    
    const now = Date.now();
    activeListeners.forEach((lastSeen, ip) => {
        if (now - lastSeen > 12000) activeListeners.delete(ip);
    });
    const listenerCount = activeListeners.size;

    if (!hostAccessToken) return res.status(401).json({ error: 'Yayıncı henüz giriş yapmadı.', listeners: listenerCount });
    
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': 'Bearer ' + hostAccessToken }
        });
        
        if (response.data && response.data.item) {
            res.json({
                is_playing: response.data.is_playing,
                // YouTube bazen "lyrics" kelimesinden dolayı takılabiliyordu, aramayı temizledik:
                query: `${response.data.item.artists[0].name} - ${response.data.item.name}`,
                progress_ms: response.data.progress_ms,
                track_id: response.data.item.id,
                album_art: response.data.item.album.images[0].url,
                listeners: listenerCount
            });
        } else {
            res.json({ is_playing: false, listeners: listenerCount });
        }
    } catch (error) {
        res.status(500).json({ error: 'Şarkı alınamadı', listeners: listenerCount });
    }
});

// YENİ EKLENEN YIKILMAZ SOUNDCLOUD ARAMA MOTORU
app.get('/api/stream', async (req, res) => {
    const query = req.query.q;
    const seek = parseInt(req.query.seek) || 0;
    
    if (!query) return res.status(400).send('Şarkı belirtilmedi');

    try {
        console.log(`🎵 Aranıyor: ${query}`);
        
        const output = await youtubedl(`scsearch1:${query}`, {
            dumpSingleJson: true, 
            noCheckCertificates: true, 
            noWarnings: true, 
            format: 'bestaudio'
        });

        console.log(`✅ Bulundu: ${output.title}`);
        res.set('Content-Type', 'audio/webm');
        
        ffmpeg(output.url)
            .setStartTime(seek)
            .format('webm')
            .audioCodec('libopus')
            .on('error', (err) => { 
                if (err.message !== 'Output stream closed') console.error('FFmpeg Hatası:', err.message); 
            })
            .pipe(res, { end: true });
        
    } catch (error) {
        console.error("Yayın Hatası Çıktısı:", error.message);
        if (!res.headersSent) res.status(500).send('Yayın koptu');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));