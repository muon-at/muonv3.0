import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Event {
  id: string;
  title: string;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM
  description?: string;
  createdAt: number;
}

export default function MobileKalender() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', date: '', time: '', description: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsArray: Event[] = [];
      snapshot.docs.forEach((doc) => {
        eventsArray.push({
          id: doc.id,
          ...doc.data(),
        } as Event);
      });
      // Sort by date
      eventsArray.sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        const dateA = new Date(ya, ma - 1, da);
        const dateB = new Date(yb, mb - 1, db);
        return dateA.getTime() - dateB.getTime();
      });
      setEvents(eventsArray);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) return;

    try {
      await addDoc(collection(db, 'events'), {
        ...formData,
        createdAt: Date.now(),
      });
      setFormData({ title: '', date: '', time: '', description: '' });
      setShowForm(false);
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  if (loading) return <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>Laster kalender...</div>;

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ color: '#4db8ff', marginBottom: '1rem', fontSize: '1rem', textAlign: 'center' }}>📅 KALENDER</h3>

      <button
        onClick={() => setShowForm(!showForm)}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#5a67d8',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '1rem',
          fontWeight: '600',
          fontSize: '0.9rem',
        }}
      >
        {showForm ? '✕ Lukk' : '+ Ny Event'}
      </button>

      {showForm && (
        <form onSubmit={handleAddEvent} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#1f2937', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Event title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={{
              padding: '0.6rem',
              background: '#0a0a0a',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          />
          <input
            type="date"
            value={formData.date}
            onChange={(e) => {
              const [year, month, day] = e.target.value.split('-');
              setFormData({ ...formData, date: `${day}/${month}/${year}` });
            }}
            style={{
              padding: '0.6rem',
              background: '#0a0a0a',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          />
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            style={{
              padding: '0.6rem',
              background: '#0a0a0a',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            style={{
              padding: '0.6rem',
              background: '#0a0a0a',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '0.9rem',
              minHeight: '60px',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.6rem',
              backgroundColor: '#51cf66',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
            }}
          >
            Lagre
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {events.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', fontSize: '0.85rem' }}>Ingen events</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              style={{
                background: '#1f2937',
                padding: '0.9rem',
                borderRadius: '6px',
                border: '1px solid #333',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#4db8ff', margin: '0 0 0.3rem 0', fontSize: '0.95rem' }}>{event.title}</h4>
                  <p style={{ color: '#9ca3af', margin: '0.2rem 0', fontSize: '0.8rem' }}>📅 {event.date} kl. {event.time}</p>
                  {event.description && <p style={{ color: '#b0b0b0', margin: '0.3rem 0 0 0', fontSize: '0.8rem' }}>{event.description}</p>}
                </div>
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Slett
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
