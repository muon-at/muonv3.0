import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/NewSaleModal.css';

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
  const [currentGifIndex, setCurrentGifIndex] = useState(0);
  const [gifLoading, setGifLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const gifCache = useRef<Map<string, any[]>>(new Map());
  const modalRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Clean up animation state and close modal after animation completes
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setGifSearch('');
        setGifResults([]);
        setCurrentGifIndex(0);
        setSelectedGif(null);
        onClose(); // Close after animation fully completes
      }, 3100); // Must match or exceed CSS animation duration (3000ms)
      return () => clearTimeout(timer);
    }
  }, [isAnimating, onClose]);

  const GIPHY_API_KEY = 'rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c';

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      setCurrentGifIndex(0);
      setSelectedGif(null);
      return;
    }

    // Check cache first
    const cached = gifCache.current.get(query);
    if (cached) {
      console.log('🔥 Using cached GIFs for:', query);
      setGifResults(cached);
      setCurrentGifIndex(0);
      if (cached.length > 0) {
        setSelectedGif(cached[0].images?.fixed_width?.url);
      }
      setGifLoading(false);
      return;
    }

    setGifLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=50&offset=0&api_key=${GIPHY_API_KEY}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('GIF search failed:', response.status);
        setGifResults([]);
        setSelectedGif(null);
        return;
      }

      const data = await response.json();
      const gifs = (data.data || []).filter((gif: any) => 
        gif.images && gif.images.fixed_width
      );
      
      gifCache.current.set(query, gifs);
      setGifResults(gifs);
      setCurrentGifIndex(0);
      
      if (gifs.length > 0) {
        setSelectedGif(gifs[0].images?.fixed_width?.url);
      } else {
        setSelectedGif(null);
      }
    } catch (err) {
      console.error('Error searching GIFs:', err);
      setGifResults([]);
      setSelectedGif(null);
    } finally {
      setGifLoading(false);
    }
  };

  const handleSearch = () => {
    searchGifs(gifSearch);
  };

  const handleShuffle = () => {
    if (gifResults.length > 0) {
      const nextIndex = (currentGifIndex + 1) % gifResults.length;
      setCurrentGifIndex(nextIndex);
      const nextGif = gifResults[nextIndex];
      setSelectedGif(nextGif.images?.fixed_width?.url);
    }
  };

  const handleSend = async () => {
    if (!selectedGif) {
      console.warn('GIF ikke valgt');
      return;
    }

    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Trigger slide-to-livefeed animation
      setIsAnimating(true);

      // Save to livefeed_sales ONLY (temporary today data, deleted nightly at 04:00)
      // allente_kontraktsarkiv is for CSV uploads from Stian - not for modal posts
      await addDoc(collection(db, 'livefeed_sales'), {
        userId: user.id,
        userName: userName,
        userDepartment: userDepartment,
        product: selectedProduct,
        productPrice: PRODUCT_PRICES[selectedProduct] || 1000,
        gifUrl: selectedGif,
        timestamp: serverTimestamp(),
        userRole: user.role || 'employee',
      });

      console.log('✅ Sale posted to livefeed!');
      
      // Dispatch custom event for RevenueDisplay
      const price = PRODUCT_PRICES[selectedProduct] || 1000;
      window.dispatchEvent(
        new CustomEvent('salePosted', { 
          detail: { amount: price }
        })
      );
      
      // useEffect will handle cleanup and closing after animation
    } catch (err) {
      console.error('❌ Error posting sale:', err);
      setIsAnimating(false);
    }
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div className={`modal-overlay ${isAnimating ? 'modal-animating-out' : ''}`} onClick={isAnimating ? undefined : onClose}>
      <div ref={modalRef} className={`modal-content ${isAnimating ? 'modal-slide-to-livefeed' : ''}`} onClick={(e) => !isAnimating && e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <h2>🔔 NYTT SALG</h2>
        
        {/* User Info */}
        <div className="user-info">
          <div><strong>{userName}</strong></div>
          <div className="department">{userDepartment}</div>
        </div>

        {/* Product Selection */}
        <div className="product-select">
          <label>Produkt:</label>
          <select 
            value={selectedProduct} 
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option>BTV</option>
            <option>BTV - free box</option>
            <option>DTH</option>
          </select>
          <span className="price">{PRODUCT_PRICES[selectedProduct]} kr</span>
        </div>

        {/* GIF Search & Display */}
        <div className="gif-section">
          <div className="gif-search">
            <input
              type="text"
              placeholder="Søk GIF..."
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={gifLoading} className="search-btn">
              {gifLoading ? '⏳ Søker...' : 'Søk'}
            </button>
          </div>

          {/* GIF Display */}
          {selectedGif && (
            <div className="gif-display">
              <img src={selectedGif} alt="Selected GIF" />
              <div className="gif-counter">
                {currentGifIndex + 1} / {gifResults.length}
              </div>
            </div>
          )}

          {/* Shuffle Button */}
          {gifResults.length > 1 && (
            <button onClick={handleShuffle} className="shuffle-btn">
              🔀 Shuffle
            </button>
          )}

          {gifSearch && !selectedGif && !gifLoading && (
            <div className="no-gif">Ingen GIFer funnet</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">Avbryt</button>
          <button onClick={handleSend} disabled={!selectedGif} className="send-btn">
            Send ✓
          </button>
        </div>
      </div>
    </div>
  );
}
