import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MobileLivefeedProps {
  onNewPost?: () => void;
}

interface Post {
  id: string;
  userName: string;
  product: string;
  gifUrl: string;
  timestamp: any;
  userDepartment: string;
}

export default function MobileLivefeed({ onNewPost }: MobileLivefeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'livefeed_sales'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts: Post[] = [];
      snapshot.docs.forEach((doc) => {
        newPosts.push({
          id: doc.id,
          ...doc.data(),
        } as Post);
      });

      setPosts(newPosts);
      setLoading(false);

      if (onNewPost && newPosts.length > 0) {
        onNewPost();
      }
    });

    return () => unsubscribe();
  }, [onNewPost]);

  if (loading) return <div className="loading">Laster livefeed...</div>;

  return (
    <div className="mobile-livefeed">
      <h3>📱 LIVEFEED</h3>
      <div className="posts-list">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <span className="post-user">{post.userName}</span>
              <span className="post-dept">{post.userDepartment}</span>
            </div>
            
            {post.gifUrl !== 'BADGE_ACHIEVEMENT' && (
              <img src={post.gifUrl} alt="Post GIF" className="post-gif" />
            )}
            
            <div className="post-product">
              {post.product}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
