import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/MobileSaleModal.css';

const PRODUCT_PRICES: { [key: string]: number } = {
  'BTV': 1000,
  'BTV - free box': 800,
  'DTH': 1000,
};

interface MobileSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userDepartment: string;
}

export default function MobileSaleModal({ isOpen, onClose, userName, userDepartment }: MobileSaleModalProps) {
  const [selectedProduct, setSelectedProduct] = useState('BTV');
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [currentGifIndex, setCurrentGifIndex] = useState(0);
  const [gifLoading, setGifLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const gifCache = useRef<Map<string, any[]>>(new Map());
  const { user } = useAuth();

  const GIPHY_API_KEY = 'rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c';

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      setCurrentGifIndex(0);
      setSelectedGif(null);
      return;
    }

    const cached = gifCache.current.get(query);
    if (cached) {
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
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=50&api_key=${GIPHY_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        setGifResults([]);
        setSelectedGif(null);
        return;
      }

      const data = await response.json();
      const gifs = (data.data || []).filter((gif: any) => gif.images?.fixed_width);

      gifCache.current.set(query, gifs);
      setGifResults(gifs);
      setCurrentGifIndex(0);

      if (gifs.length > 0) {
        setSelectedGif(gifs[0].images?.fixed_width?.url);
      }
    } catch (err) {
      console.error('GIF search error:', err);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  const handleShuffle = () => {
    if (gifResults.length > 0) {
      const nextIndex = (currentGifIndex + 1) % gifResults.length;
      setCurrentGifIndex(nextIndex);
      setSelectedGif(gifResults[nextIndex].images?.fixed_width?.url);
    }
  };

  const handleSend = async () => {
    if (isSubmitting || !selectedGif || !user) return;

    setIsSubmitting(true);

    try {
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

      console.log('✅ Mobile sale posted!');

      // Reset
      setSelectedProduct('BTV');
      setGifSearch('');
      setGifResults([]);
      setCurrentGifIndex(0);
      setSelectedGif(null);
      
      onClose();
    } catch (err) {
      console.error('❌ Error posting sale:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mobile-modal-overlay" onClick={onClose}>
      <div className="mobile-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="mobile-close-btn" onClick={onClose}>✕</button>

        <h2>🔔 MELD SALG</h2>

        {/* User Info */}
        <div className="mobile-user-info">
          <div className="user-name">{userName}</div>
          <div className="user-dept">{userDepartment}</div>
        </div>

        {/* Product Selection */}
        <div className="mobile-product-select">
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

        {/* GIF Search */}
        <div className="mobile-gif-search">
          <input
            type="text"
            placeholder="Søk GIF..."
            value={gifSearch}
            onChange={(e) => setGifSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchGifs(gifSearch)}
          />
          <button onClick={() => searchGifs(gifSearch)} disabled={gifLoading}>
            {gifLoading ? '⏳' : '🔍'}
          </button>
        </div>

        {/* GIF Display */}
        {selectedGif && (
          <div className="mobile-gif-display">
            <img src={selectedGif} alt="Selected GIF" />
            <div className="gif-counter">{currentGifIndex + 1} / {gifResults.length}</div>
          </div>
        )}

        {/* Shuffle */}
        {gifResults.length > 1 && (
          <button onClick={handleShuffle} className="shuffle-btn">
            🔀 Shuffle
          </button>
        )}

        {/* Action Buttons */}
        <div className="mobile-actions">
          <button onClick={onClose} disabled={isSubmitting} className="cancel-btn">
            Avbryt
          </button>
          <button 
            onClick={handleSend} 
            disabled={!selectedGif || isSubmitting}
            className="send-btn"
          >
            {isSubmitting ? '⏳' : '✓ Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
