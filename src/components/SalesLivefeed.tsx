import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
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
    // Get start and end of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = tomorrow.getTime();

    // Real-time listener for livefeed (only today's posts)
    const q = query(
      collection(db, 'livefeed_sales'),
      where('timestamp', '>=', startOfToday),
      where('timestamp', '<', startOfTomorrow),
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
            <div key={post.id} className="livefeed-post-wrapper">
              {/* Timestamp above post */}
              <div className="livefeed-timestamp">
                {new Date(post.timestamp).toLocaleTimeString('no-NO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>

              {/* Horizontal post */}
              <div className="livefeed-post">
                {/* GIF on left */}
                {post.gifUrl && (
                  <img 
                    src={post.gifUrl} 
                    alt="Sale GIF" 
                    className="livefeed-gif"
                  />
                )}

                {/* Post content on right */}
                <div className="livefeed-post-content">
                  <div className="livefeed-user">
                    {/* Split name into first and last */}
                    {post.userName.split(' ').length > 1 ? (
                      <>
                        <strong className="livefeed-firstname">{post.userName.split(' ')[0]}</strong>
                        <span className="livefeed-lastname">{post.userName.split(' ').slice(1).join(' ')}</span>
                      </>
                    ) : (
                      <strong className="livefeed-firstname">{post.userName}</strong>
                    )}
                    <span className="livefeed-department">{post.userDepartment}</span>
                  </div>

                  <div className="livefeed-product-info">
                    <div className="livefeed-product-row">
                      <span className="livefeed-product-name">🔔 {post.product}</span>
                      <span className="livefeed-product-price">{post.productPrice} kr</span>
                    </div>
                  </div>

                  {/* Delete button */}
                  {(user?.id === post.userId || user?.role === 'owner') && (
                    <button
                      className="livefeed-delete-btn"
                      onClick={() => handleDeletePost(post.id, post.userId)}
                      title="Slett post"
                    >
                      ✕
                    </button>
                  )}
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
