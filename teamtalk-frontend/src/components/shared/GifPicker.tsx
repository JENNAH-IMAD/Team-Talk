import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, X, Heart, TrendingUp, Sparkle, Film } from 'lucide-react';
import { cn } from '@/utils';

interface GifItem {
  id: string;
  preview: string;   // small animated preview URL
  url: string;       // full URL to send (gif or mp4 for clips)
  title: string;
  isVideo?: boolean; // true for clips (mp4)
}

type Tab = 'gifs' | 'stickers' | 'clips' | 'favorites';

const GIPHY_KEY = (import.meta.env.VITE_GIPHY_API_KEY as string) || '';
const FAVORITES_KEY = 'teamtalk.gif_favorites';

function loadFavorites(): GifItem[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; }
}
function saveFavorites(items: GifItem[]) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

// Map tab → Giphy API base path
const GIPHY_BASE: Record<Exclude<Tab, 'favorites'>, string> = {
  gifs: 'https://api.giphy.com/v1/gifs',
  stickers: 'https://api.giphy.com/v1/stickers',
  clips: 'https://api.giphy.com/v1/clips',
};

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose?: () => void;
  className?: string;
}

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose, className }) => {
  const [tab, setTab] = useState<Tab>('gifs');
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState<GifItem[]>(loadFavorites);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchGifs = useCallback(async (q: string, activeTab: Exclude<Tab, 'favorites'>) => {
    if (!GIPHY_KEY) {
      setError('Clé API Giphy manquante (VITE_GIPHY_API_KEY)');
      setGifs([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const base = GIPHY_BASE[activeTab];
      const endpoint = q.trim() ? `${base}/search` : `${base}/trending`;
      const params = new URLSearchParams({
        api_key: GIPHY_KEY,
        limit: '18',
        rating: 'g',
        ...(q.trim() ? { q } : {}),
      });
      const res = await fetch(`${endpoint}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data?: Record<string, unknown>[] };
      const results = json.data ?? [];

      const items: GifItem[] = results.map((r) => {
        const images = r.images as Record<string, { url?: string; mp4?: string; webp?: string }> | undefined;
        const isClip = activeTab === 'clips';

        // Clips: use mp4 for both preview and send
        if (isClip) {
          const mp4Url = (images?.original_mp4 as { mp4?: string } | undefined)?.mp4
            || (images?.original as { mp4?: string } | undefined)?.mp4
            || '';
          const previewMp4 = (images?.fixed_height_small_still as { url?: string } | undefined)?.url
            || (images?.fixed_height_downsampled as { url?: string; mp4?: string } | undefined)?.url
            || mp4Url;
          return {
            id: r.id as string,
            title: (r.title as string) || '',
            preview: previewMp4,
            url: mp4Url,
            isVideo: true,
          };
        }

        // GIFs & stickers
        const preview = images?.fixed_height_small?.url
          || images?.fixed_height_downsampled?.url
          || images?.preview_gif?.url
          || '';
        const url = images?.original?.url
          || images?.fixed_height?.url
          || preview;
        return {
          id: r.id as string,
          title: (r.title as string) || '',
          preview,
          url,
          isVideo: false,
        };
      }).filter(r => r.url && r.preview);

      setGifs(items);
    } catch (e) {
      setError('Impossible de charger les GIFs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Focus on open
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Reload when tab changes (but not favorites)
  useEffect(() => {
    if (tab !== 'favorites') {
      fetchGifs(query, tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Load trending on mount
  useEffect(() => {
    fetchGifs('', 'gifs');
  }, [fetchGifs]);

  const handleSearch = () => {
    if (tab !== 'favorites') fetchGifs(query, tab);
  };

  const clearSearch = () => {
    setQuery('');
    if (tab !== 'favorites') fetchGifs('', tab);
  };

  const toggleFav = (gif: GifItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const exists = prev.some(f => f.id === gif.id);
      const next = exists ? prev.filter(f => f.id !== gif.id) : [gif, ...prev];
      saveFavorites(next);
      return next;
    });
  };

  const isFav = (id: string) => favorites.some(f => f.id === id);
  const displayed = tab === 'favorites' ? favorites : gifs;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'gifs', label: 'GIFs', icon: <TrendingUp size={11} />, color: 'bg-brand-500' },
    { key: 'stickers', label: 'Stickers', icon: <Sparkle size={11} />, color: 'bg-purple-500' },
    { key: 'clips', label: 'Clips', icon: <Film size={11} />, color: 'bg-emerald-500' },
    { key: 'favorites', label: 'Favoris', icon: <Heart size={11} />, color: 'bg-red-500' },
  ];

  return (
    <div className={cn('w-80 bg-white dark:bg-surface-900 border border-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden', className)}>
      {/* Search + tabs */}
      <div className="p-3 pb-2 border-b border-subtle">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex-1 flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-2.5 py-1.5">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch();
                if (e.key === 'Escape') onClose?.();
              }}
              placeholder={tab === 'clips' ? 'Chercher un Clip…' : tab === 'stickers' ? 'Chercher un Sticker…' : 'Chercher un GIF…'}
              disabled={tab === 'favorites'}
              className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 w-full placeholder:text-gray-400 disabled:opacity-50"
            />
            {query && (
              <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 flex-shrink-0">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                tab === t.key
                  ? `${t.color} text-white`
                  : 'text-gray-500 hover:bg-surface-100 dark:hover:bg-surface-800'
              )}
            >
              {t.icon}
              {t.label}
              {t.key === 'favorites' && favorites.length > 0 && (
                <span className={cn('rounded px-1', tab === 'favorites' ? 'bg-white/20' : 'bg-surface-200 dark:bg-surface-700')}>
                  {favorites.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="relative" style={{ height: 264 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/60 dark:bg-surface-900/60">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div className="grid grid-cols-3 gap-1 p-2 overflow-y-auto scrollbar-thin h-full">
          {displayed.map(g => (
            <button
              key={g.id}
              onClick={() => { onSelect(g.url); onClose?.(); }}
              style={{ height: 80 }}
              className="relative rounded-lg overflow-hidden border border-transparent hover:border-brand-500/60 hover:shadow-md transition-all group"
            >
              {g.isVideo ? (
                <video
                  src={g.preview}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={g.preview}
                  alt={g.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              <button
                onClick={e => toggleFav(g, e)}
                className={cn(
                  'absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all',
                  isFav(g.id)
                    ? 'bg-red-500 text-white opacity-100'
                    : 'bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500'
                )}
              >
                <Heart size={9} fill={isFav(g.id) ? 'currentColor' : 'none'} />
              </button>
            </button>
          ))}

          {!loading && displayed.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center h-full gap-2 text-center">
              {tab === 'favorites' ? (
                <>
                  <Heart size={28} className="text-gray-300 dark:text-gray-600" />
                  <p className="text-xs font-semibold text-gray-500">Aucun favori</p>
                  <p className="text-[10px] text-gray-400">Survolez un GIF et cliquez ♥</p>
                </>
              ) : !GIPHY_KEY ? (
                <>
                  <p className="text-xs text-gray-500 font-semibold">Clé Giphy manquante</p>
                  <p className="text-[10px] text-gray-400 px-4">Ajoutez VITE_GIPHY_API_KEY dans .env</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{error || 'Aucun résultat'}</p>
                  {error && (
                    <button onClick={handleSearch} className="mt-1 text-xs text-brand-500 hover:underline">
                      Réessayer
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Giphy attribution */}
      <div className="px-3 py-1.5 border-t border-subtle bg-surface-50 dark:bg-black/20 text-center">
        <span className="text-[10px] text-gray-400 font-medium">Powered by Giphy</span>
      </div>
    </div>
  );
};

export default GifPicker;
