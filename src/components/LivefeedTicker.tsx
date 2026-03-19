import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Post {
  id: string;
  userName: string;
  message: string;
  timestamp: any;
}

export default function LivefeedTicker() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'livefeed_sales'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts: Post[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        newPosts.push({
          id: doc.id,
          userName: data.userName || 'Ukjent',
          message: data.message || '',
          timestamp: data.timestamp,
        });
      });
      setPosts(newPosts.reverse()); // Newest last (so they come in from right)
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '80px',
      background: '#000000',
      borderBottom: '2px solid #333',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      zIndex: 50,
      paddingLeft: '1rem',
    }}>
      <div style={{
        display: 'flex',
        gap: '2rem',
        animation: `scroll-ticker ${Math.max(posts.length * 3, 10)}s linear infinite`,
      }}>
        {/* Double the posts to create seamless loop */}
        {[...posts, ...posts].map((post, idx) => (
          <div
            key={`${post.id}-${idx}`}
            style={{
              minWidth: '400px',
              padding: '0.75rem 1.5rem',
              background: '#1a1a1a',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: '#4db8ff', fontSize: '0.85rem', fontWeight: '600' }}>
              {post.userName}
            </span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
              {post.message}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes scroll-ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
