import { useState } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseCSV } from '../lib/csvParser';
import '../styles/FileUploadModal.css';

interface FileUploadModalProps {
  isOpen: boolean;
  title: string;
  fileType: 'salg' | 'stats' | 'angring';
  onClose: () => void;
  onUpload: (file: File, fileType: string) => Promise<void>;
}

export default function FileUploadModal({ isOpen, title, fileType, onClose, onUpload }: FileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Vennligst velg en fil');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      // Read file as text
      const fileText = await selectedFile.text();
      console.log('📄 File text length:', fileText.length);

      if (fileType === 'salg') {
        // Parse CSV
        const records = parseCSV(fileText);
        console.log('📊 Parsed kontrakter:', records.length);

        if (records.length === 0) {
          setError('Ingen gyldige kontrakter funnet i filen');
          setUploading(false);
          return;
        }

        // Fetch existing Ids from Firestore
        const salgRef = collection(db, 'allente_salg');
        const snapshot = await getDocs(salgRef);
        const existingIds = new Set<string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.id) {
            existingIds.add(data.id);
          }
        });

        console.log('📋 Existing Ids:', existingIds.size);

        // Filter new records (deduplicate by Id)
        const newRecords = records.filter(
          (record) => !existingIds.has(record.id)
        );

        console.log('✨ New records to insert:', newRecords.length);
        console.log('🔄 Duplicates (already exist):', records.length - newRecords.length);

        if (newRecords.length === 0) {
          setError(`Alle ${records.length} kontrakter eksisterer allerede`);
          setUploading(false);
          return;
        }

        // Insert new records to Firestore
        let insertedCount = 0;
        for (const record of newRecords) {
          try {
            await addDoc(salgRef, {
              id: record.id,
              kundenummer: record.kundenummer,
              kunde: record.kunde,
              dato: record.ordredato,
              produkt: record.produkt,
              ordertype: record.ordertype,
              forhandler: record.forhandler,
              selger: record.selger,
              platform: record.platform,
              status: record.status,
              createdAt: new Date(),
            });
            insertedCount++;
          } catch (err) {
            console.error('❌ Error inserting record:', record.id, err);
          }
        }

        console.log('🎉 Inserted records:', insertedCount);
        setSuccess(true);
        
        // Show success message with counts
        const duplicates = records.length - newRecords.length;
        const message = `✅ Lastet opp ${insertedCount} nye kontrakter\n(${duplicates} eksisterte allerede)`;
        alert(message);
        
        // Call parent callback
        await onUpload(selectedFile, fileType);

        setTimeout(() => {
          setSelectedFile(null);
          onClose();
        }, 1500);
      } else {
        // For stats and angring, use mock upload
        await onUpload(selectedFile, fileType);
        setSuccess(true);
        setTimeout(() => {
          setSelectedFile(null);
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(`Feil ved opplasting: ${err}`);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="file-upload-overlay">
      <div className="file-upload-modal">
        <div className="upload-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="upload-body">
          {success && (
            <div className="success-message">
              ✅ Fil lastet opp vellykket!
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="file-input-wrapper">
            <label htmlFor={`file-input-${fileType}`} className="file-label">
              <div className="file-drop-area">
                <div className="file-icon">📁</div>
                <p className="file-text">
                  {selectedFile ? selectedFile.name : 'Velg fil eller dra og slipp her'}
                </p>
                <p className="file-subtext">CSV, Excel eller JSON</p>
              </div>
            </label>
            <input
              id={`file-input-${fileType}`}
              type="file"
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls,.json"
              disabled={uploading}
              className="hidden-file-input"
            />
          </div>

          {selectedFile && (
            <div className="file-info">
              <p><strong>Fil:</strong> {selectedFile.name}</p>
              <p><strong>Størrelse:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
              <p><strong>Type:</strong> {selectedFile.type || 'Ukjent'}</p>
            </div>
          )}
        </div>

        <div className="upload-footer">
          <button
            className="btn-cancel"
            onClick={handleClose}
            disabled={uploading}
          >
            Avbryt
          </button>
          <button
            className="btn-upload"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Laster opp...' : '📤 Last opp'}
          </button>
        </div>
      </div>
    </div>
  );
}
