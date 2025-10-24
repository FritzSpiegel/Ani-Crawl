import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';

interface VideoData {
  videoUrl: string;
  episode: number;
  title: string;
  animeSlug: string;
  quality: string;
  type: string;
  sources: Array<{ url: string; quality: string; type: string }>;
  externalUrl: string;
}

interface AnimeData {
  slug: string;
  canonicalTitle: string;
  description: string;
  imageUrl: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  episodes: Array<{ episode: number; title: string }>;
}

export default function Watch() {
  const { slug, episode } = useParams<{ slug: string; episode: string }>();
  const navigate = useNavigate();
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [animeData, setAnimeData] = useState<AnimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState(parseInt(episode || '1'));
  const [externalUrl, setExternalUrl] = useState<string>('');

  useEffect(() => {
    if (slug && currentEpisode) {
      fetchVideoData();
      fetchAnimeData();
    }
  }, [slug, currentEpisode]);

  const fetchVideoData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/video/${slug}/${currentEpisode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch video data');
      }
      const data = await response.json();
      setVideoData(data);
      setExternalUrl(data.externalUrl || `https://aniworld.to/anime/stream/${slug}/episode/${currentEpisode}`);
    } catch (err: any) {
      console.error('Error fetching video data:', err);
      setError(err.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnimeData = async () => {
    try {
      const response = await fetch(`/api/anime/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setAnimeData(data);
      }
    } catch (err) {
      console.error('Error fetching anime data:', err);
    }
  };

  const handleEpisodeChange = (newEpisode: number) => {
    setCurrentEpisode(newEpisode);
    navigate(`/watch/${slug}/${newEpisode}`);
  };

  const handleExternalLink = () => {
    window.open(externalUrl, '_blank');
  };

  if (loading) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "28px 0 96px" }}>
          <div style={{ textAlign: "center", padding: "40px" }}>
            <h1>Lädt Video...</h1>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "28px 0 96px" }}>
          <div style={{ textAlign: "center", padding: "40px", color: "#f55" }}>
            <h1>Fehler beim Laden des Videos</h1>
            <p>{error}</p>
            <button 
              onClick={() => navigate('/')}
              style={{
                background: "#007bff",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "5px",
                cursor: "pointer",
                marginTop: "20px"
              }}
            >
              Zurück zur Startseite
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="container" style={{ padding: "28px 0 96px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Video Player Section */}
          <div style={{ marginBottom: "30px" }}>
            <div style={{ 
              position: "relative", 
              width: "100%", 
              height: "0", 
              paddingBottom: "56.25%", // 16:9 aspect ratio
              backgroundColor: "#000",
              borderRadius: "10px",
              overflow: "hidden"
            }}>
              <video
                controls
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain"
                }}
                key={`${slug}-${currentEpisode}`} // Force re-render on episode change
              >
                <source src={videoData?.videoUrl} type="video/mp4" />
                Ihr Browser unterstützt das Video-Element nicht.
              </video>
            </div>
          </div>

          {/* Episode Info */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div>
              <h1 style={{ color: "white", margin: "0" }}>
                {animeData?.canonicalTitle || 'Anime'} - Episode {currentEpisode}
              </h1>
              <p style={{ color: "#ccc", margin: "5px 0 0 0" }}>
                {videoData?.title || `Episode ${currentEpisode}`}
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                className="btn"
                onClick={handleExternalLink}
                style={{
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  fontSize: "14px"
                }}
              >
                🔗 Echte Episode
              </button>
              <div style={{ color: "#ccc", fontSize: "14px" }}>
                Qualität: {videoData?.quality || '720p'}
              </div>
            </div>
          </div>

          {/* Episode Navigation */}
          {animeData?.episodes && animeData.episodes.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ color: "white", marginBottom: "15px" }}>Episoden</h3>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
                gap: "10px" 
              }}>
                {animeData.episodes.slice(0, 20).map((ep) => (
                  <button
                    key={ep.episode}
                    onClick={() => handleEpisodeChange(ep.episode)}
                    style={{
                      background: ep.episode === currentEpisode ? "#007bff" : "#2a2a2a",
                      color: "white",
                      border: "1px solid #555",
                      padding: "10px 15px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "14px"
                    }}
                  >
                    Episode {ep.episode}
                    {ep.title && (
                      <div style={{ fontSize: "12px", color: "#ccc", marginTop: "2px" }}>
                        {ep.title}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Anime Info */}
          {animeData && (
            <div style={{ 
              backgroundColor: "#2a2a2a", 
              padding: "20px", 
              borderRadius: "10px",
              marginBottom: "20px"
            }}>
              <h3 style={{ color: "white", marginBottom: "15px" }}>Anime-Informationen</h3>
              <div style={{ color: "#ccc" }}>
                <p><strong>Titel:</strong> {animeData.canonicalTitle}</p>
                {animeData.yearStart && (
                  <p><strong>Jahr:</strong> {animeData.yearStart} - {animeData.yearEnd || "Heute"}</p>
                )}
                {animeData.description && (
                  <p><strong>Beschreibung:</strong> {animeData.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Video Sources */}
          {videoData?.sources && videoData.sources.length > 1 && (
            <div style={{ 
              backgroundColor: "#2a2a2a", 
              padding: "20px", 
              borderRadius: "10px"
            }}>
              <h3 style={{ color: "white", marginBottom: "15px" }}>Verfügbare Qualitäten</h3>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {videoData.sources.map((source, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (videoData) {
                        setVideoData({ ...videoData, videoUrl: source.url, quality: source.quality });
                      }
                    }}
                    style={{
                      background: videoData?.videoUrl === source.url ? "#007bff" : "#444",
                      color: "white",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    {source.quality} ({source.type})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
