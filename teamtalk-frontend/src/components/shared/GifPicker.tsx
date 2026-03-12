import React, { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/utils';

interface Gif {
  id: string;
  preview: string;
  url: string;
}

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose?: () => void;
  className?: string;
}

const TENOR_KEY = (import.meta.env.VITE_TENOR_KEY as string) || 'LIVDSRZULELA';

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose, className }) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchGifs = async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const endpoint = q.trim()
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=teamtalk&limit=18&media_filter=gif,tinygif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=teamtalk&limit=18&media_filter=gif,tinygif`;
      const res = await fetch(endpoint);
      const json = await res.json();
      const items = (json.results ?? []).map((r: any) => {
        const media = r.media_formats || {};
        const preview = media.tinygif?.url || media.gif?.url || '';
        const url = media.gif?.url || media.tinygif?.url || '';
        return { id: r.id, preview, url } as Gif;
      }).filter((r: Gif) => r.url);
      setGifs(items);
    } catch {
      setError('Unable to load GIFs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs('');
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchGifs(query);
    if (e.key === 'Escape') onClose?.();
  };

  return (
    <div className={cn('w-72 bg-white dark:bg-surface-900 border border-subtle rounded-2xl shadow-2xl p-3', className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-2.5 py-1.5">
          <Search size={14} className="text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search GIFs"
            className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 w-full placeholder:text-gray-400"
          />
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400">
            <X size={14} />
          </button>
        )}
      </div>

      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-surface-900/60 rounded-lg text-sm text-gray-500">
            Loading…
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto scrollbar-thin pr-0.5">
          {gifs.map(g => (
            <button
              key={g.id}
              onClick={() => onSelect(g.url)}
              className="relative rounded-lg overflow-hidden border border-transparent hover:border-brand-500/60 hover:shadow-lg transition-all"
            >
              <img src={g.preview} alt="gif" className="w-full h-24 object-cover" loading="lazy" />
            </button>
          ))}
          {!loading && gifs.length === 0 && (
            <div className="col-span-3 text-center text-xs text-gray-400 py-6">No GIFs</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GifPicker;
