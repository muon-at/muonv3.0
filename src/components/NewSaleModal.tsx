import { useState } from 'react';
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

  const GIPHY_API_KEY = 'rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c';

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      return;
    }

    setGifLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=20&api_key=${GIPHY_API_KEY}`
      );
      const data = await response.json();
      setGifResults(data.data || []);
    } catch (err) {
      console.error('Error searching GIFs:', err);
    } finally {
      setGifLoading(false);
    }
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
              onChange={(e) => {
                setGifSearch(e.target.value);
                searchGifs(e.target.value);
              }}
            />

            {gifLoading && <div className="new-sale-loading">Laster GIFs...</div>}

            {selectedGif && (
              <div className="new-sale-selected-gif">
                <p>✅ GIF valgt:</p>
                <img src={selectedGif} alt="Valgt GIF" />
              </div>
            )}

            <div className="new-sale-gif-grid">
              {gifResults.map((gif) => (
                <img
                  key={gif.id}
                  src={gif.images.fixed_height.url}
                  alt="GIF"
                  className={`new-sale-gif-item ${selectedGif === gif.images.fixed_height.url ? 'selected' : ''}`}
                  onClick={() => setSelectedGif(gif.images.fixed_height.url)}
                  title="Klikk for å velge"
                />
              ))}
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
