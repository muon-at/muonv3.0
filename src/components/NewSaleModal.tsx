import { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/NewSaleModal.css';

// Product pricing
const PRODUCT_PRICES: { [key: string]: number } = {
  'BTV': 1000,
  'BTV - free box': 800,
  'DTH': 1000,
};

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userDepartment: string;
}

export default function NewSaleModal({ isOpen, onClose, userName, userDepartment }: NewSaleModalProps) {
  const [selectedProduct, setSelectedProduct] = useState('BTV');
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gifCache = useRef<Map<string, any[]>>(new Map());
  const { user } = useAuth();

  const GIPHY_API_KEY = 'rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c';

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      return;
    }

    // Check cache first
    const cached = gifCache.current.get(query);
    if (cached) {
      console.log('🔥 Using cached GIFs for:', query);
      setGifResults(cached);
      setGifLoading(false);
      return;
    }

    setGifLoading(true);
    try {
      // Add timeout for slow networks - 5 seconds max
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=60&offset=0&api_key=${GIPHY_API_KEY}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('GIF search failed:', response.status);
        setGifResults([]);
        return;
      }

      const data = await response.json();
      // Use fixed_width_small for faster loading
      const gifs = (data.data || []).filter((gif: any) => 
        gif.images && (gif.images.fixed_width_small || gif.images.fixed_width)
      );
      
      // Cache the results
      gifCache.current.set(query, gifs);
      setGifResults(gifs);
    } catch (err) {
      console.error('Error searching GIFs:', err);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  const handleGifSearch = (query: string) => {
    setGifSearch(query);
    
    // Debounce: wait only 100ms before searching (very fast)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      searchGifs(query);
    }, 100);
  };

  const handleSend = async () => {
    if (!selectedGif) {
      alert('Velg en GIF først!');
      return;
    }

    if (!user) {
      alert('Du må være logget inn');
      return;
    }

    try {
      const productPrice = PRODUCT_PRICES[selectedProduct] || 1000;

      // Post to livefeed
      await addDoc(collection(db, 'livefeed_sales'), {
        userId: user.id,
        userName: userName,
        userDepartment: userDepartment,
        product: selectedProduct,
        productPrice: productPrice,
        gifUrl: selectedGif,
        timestamp: Date.now(),
        userRole: user.role || 'employee',
      });

      console.log('📤 SALG POSTED TIL LIVEFEED!');
      alert(`✅ Salg registrert!\nProdukt: ${selectedProduct}\nSelger: ${userName}`);
      
      // Reset and close
      setSelectedGif(null);
      setGifSearch('');
      setGifResults([]);
      setSelectedProduct('BTV');
      onClose();
    } catch (err) {
      console.error('Error posting sale:', err);
      alert('❌ Feil ved opprettelse av salg');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="new-sale-modal-overlay" onClick={onClose}>
      <div className="new-sale-modal" onClick={(e) => e.stopPropagation()}>
        <div className="new-sale-header">
          <h2>🎉 NYTT SALG</h2>
          <button className="new-sale-send-header" onClick={handleSend}>
            ✅ Send
          </button>
          <button className="new-sale-close" onClick={onClose}>×</button>
        </div>

        <div className="new-sale-content">
          {/* User Info - Compact */}
          <div className="new-sale-info-compact">
            <div><strong>{userName}</strong></div>
            <div className="new-sale-department">{userDepartment}</div>
          </div>

          {/* Product Selection - Inline */}
          <div className="new-sale-inline-row">
            <label>📦</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="new-sale-select"
            >
              <option value="BTV">BTV</option>
              <option value="BTV - free box">BTV - free box</option>
              <option value="DTH">DTH</option>
            </select>
          </div>

          {/* GIF Picker - Inline Label */}
          <div className="new-sale-gif-section">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              🎬 Velg GIF
            </label>
            <input
              type="text"
              className="new-sale-gif-search"
              placeholder="Søk GIF (f.eks. 'celebration', 'party')..."
              value={gifSearch}
              onChange={(e) => handleGifSearch(e.target.value)}
            />

            {gifLoading && <div className="new-sale-loading">🔍 Søker...</div>}

            {selectedGif && (
              <div className="new-sale-selected-gif">
                <div className="new-sale-selected-gif-header">
                  <p>✅ GIF:</p>
                  <button 
                    className="new-sale-clear-gif"
                    onClick={() => setSelectedGif(null)}
                    title="Fjern valgt GIF"
                  >
                    ✕
                  </button>
                </div>
                <img src={selectedGif} alt="Valgt GIF" />
              </div>
            )}

            <div className="new-sale-gif-grid">
              {gifResults.length > 0 ? (
                gifResults.map((gif) => {
                  // Use fixed_width_small for faster loading, fallback to fixed_width
                  const gifImage = gif.images.fixed_width_small || gif.images.fixed_width;
                  const gifUrl = gifImage.url;
                  return (
                    <img
                      key={gif.id}
                      src={gifUrl}
                      alt="GIF"
                      className={`new-sale-gif-item ${selectedGif === gifUrl ? 'selected' : ''}`}
                      onClick={() => setSelectedGif(gifUrl)}
                      title="Klikk for å velge"
                      loading="lazy"
                      onError={(e) => {
                        console.error('Failed to load GIF:', gif.id);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  );
                })
              ) : (
                gifSearch && !gifLoading && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen GIFer funnet for "{gifSearch}"
                  </div>
                )
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
