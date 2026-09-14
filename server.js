app.get('/api/stream', async (req, res) => {
    const query = req.query.q;
    const seek = parseInt(req.query.seek) || 0;
    
    if (!query) return res.status(400).send('Şarkı belirtilmedi');

    try {
        console.log(`🎵 Aranıyor: ${query}`);
        
        // YouTube, Render sunucusunu engellediği için şarkıyı doğrudan SoundCloud'dan çekiyoruz! (Bot koruması yok)
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