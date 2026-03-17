import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/SalesLivefeed.css';

interface LivefeedPost {
  id: string;
  userId: string;
  userName: string;
  userDepartment: string;
  product: string;
  productPrice: number;
  gifUrl: string;
  timestamp: number;
  userRole?: string;
}

interface SalesLivefeedProps {
  onPostAdded?: (price: number) => void;
}

export const SalesLivefeed: React.FC<SalesLivefeedProps> = ({ onPostAdded }) => {
  const [posts, setPosts] = useState<LivefeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousCount, setPreviousCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    // Real-time listener for livefeed
    const q = query(
      collection(db, 'livefeed_sales'),
      orderBy('timestamp', 'desc'),
      limit(8)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts: LivefeedPost[] = [];
      snapshot.forEach((doc) => {
        newPosts.push({
          id: doc.id,
          ...doc.data(),
        } as LivefeedPost);
      });
      
      // Check if a new post was added (first post in list)
      if (previousCount > 0 && newPosts.length > previousCount && onPostAdded) {
        const newestPost = newPosts[0];
        onPostAdded(newestPost.productPrice);
      }
      
      setPreviousCount(newPosts.length);
      setPosts(newPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeletePost = async (postId: string, userId: string) => {
    // Check if user is owner of post or has admin role
    if (user?.id !== userId && user?.role !== 'owner') {
      alert('Du kan bare slette dine egne posts');
      return;
    }

    try {
      await deleteDoc(doc(db, 'livefeed_sales', postId));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  if (loading) {
    return (
      <div className="livefeed-container">
        <div className="livefeed-content">
          <div className="livefeed-loading">Laster...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="livefeed-container">
      <div className="livefeed-content">
        {posts.length === 0 ? (
          <div className="livefeed-empty">Ingen salg ennå</div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="livefeed-post">
              {/* GIF at top */}
              {post.gifUrl && (
                <img 
                  src={post.gifUrl} 
                  alt="Sale GIF" 
                  className="livefeed-gif"
                />
              )}

              {/* Post content */}
              <div className="livefeed-post-content">
                <div className="livefeed-user">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>🔔 {post.userName}</strong>
                  </div>
                  <span className="livefeed-department">{post.userDepartment}</span>
                </div>

                <div className="livefeed-product">
                  <div className="livefeed-product-name">{post.product}</div>
                  <div className="livefeed-product-price">{post.productPrice} kr</div>
                </div>

                {/* Delete button - only show if user owns post or is owner */}
                {(user?.id === post.userId || user?.role === 'owner') && (
                  <button
                    className="livefeed-delete-btn"
                    onClick={() => handleDeletePost(post.id, post.userId)}
                    title="Slett post"
                  >
                    ✕
                  </button>
                )}

                {/* Timestamp */}
                <div className="livefeed-time">
                  {new Date(post.timestamp).toLocaleTimeString('no-NO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SalesLivefeed;
