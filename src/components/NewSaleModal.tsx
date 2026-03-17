import { useState, useRef } from 'react';
import '../styles/NewSaleModal.css';

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

  const GIPHY_API_KEY = 'rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c';

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      return;
    }

    setGifLoading(true);
    try {
      // Add timeout for slow networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=50&offset=0&api_key=${GIPHY_API_KEY}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('GIF search failed:', response.status);
        setGifResults([]);
        return;
      }

      const data = await response.json();
      const gifs = (data.data || []).filter((gif: any) => gif.images && gif.images.fixed_height);
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
    
    // Debounce: wait 300ms before searching
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      searchGifs(query);
    }, 300);
  };

  const handleSend = async () => {
    if (!selectedGif) {
      alert('Velg en GIF først!');
      return;
    }

    const saleData = {
      selgerNavn: userName,
      avdeling: userDepartment,
      produkt: selectedProduct,
      gifUrl: selectedGif,
      dato: new Date().toISOString(),
    };

    console.log('📤 SENDING NYTT SALG:', saleData);
    
    // TODO: Send to Firestore/API
    // For now just log it
    alert(`✅ Salg registrert!\nProdukt: ${selectedProduct}\nSelger: ${userName}`);
    
    // Reset and close
    setSelectedGif(null);
    setGifSearch('');
    setGifResults([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="new-sale-modal-overlay" onClick={onClose}>
      <div className="new-sale-modal" onClick={(e) => e.stopPropagation()}>
        <div className="new-sale-header">
          <h2>🎉 NYTT SALG</h2>
          <button className="new-sale-close" onClick={onClose}>×</button>
        </div>

        <div className="new-sale-content">
          {/* User Info */}
          <div className="new-sale-section">
            <h3>📋 Dine Opplysninger</h3>
            <div className="new-sale-info-row">
              <label>Navn:</label>
              <span>{userName}</span>
            </div>
            <div className="new-sale-info-row">
              <label>Avdeling:</label>
              <span>{userDepartment}</span>
            </div>
          </div>

          {/* Product Selection */}
          <div className="new-sale-section">
            <h3>📦 Produkt</h3>
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

          {/* GIF Picker */}
          <div className="new-sale-section">
            <h3>🎬 Velg GIF</h3>
            <input
              type="text"
              className="new-sale-gif-search"
              placeholder="Søk GIF (f.eks. 'celebration', 'party')..."
              value={gifSearch}
              onChange={(e) => handleGifSearch(e.target.value)}
            />

            {gifLoading && <div className="new-sale-loading">Laster GIFs...</div>}

            {selectedGif && (
              <div className="new-sale-selected-gif">
                <div className="new-sale-selected-gif-header">
                  <p>✅ GIF valgt:</p>
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
                gifResults.map((gif) => (
                  <img
                    key={gif.id}
                    src={gif.images.fixed_height.url}
                    alt="GIF"
                    className={`new-sale-gif-item ${selectedGif === gif.images.fixed_height.url ? 'selected' : ''}`}
                    onClick={() => setSelectedGif(gif.images.fixed_height.url)}
                    title="Klikk for å velge"
                    loading="lazy"
                    onError={(e) => {
                      console.error('Failed to load GIF:', gif.id);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ))
              ) : (
                gifSearch && !gifLoading && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen GIFer funnet for "{gifSearch}"
                  </div>
                )
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="new-sale-buttons">
            <button className="new-sale-cancel" onClick={onClose}>
              ❌ Avbryt
            </button>
            <button className="new-sale-send" onClick={handleSend}>
              ✅ Send Salg
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
