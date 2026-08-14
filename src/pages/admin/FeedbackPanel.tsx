import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageSquareHeart, Star } from 'lucide-react';

export default function FeedbackPanel() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const feedbackQuery = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
        const feedbackSnap = await getDocs(feedbackQuery);
        const feedbackData = feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeedbacks(feedbackData);
      } catch (error) {
        console.error("Error fetching feedback", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, []);

  if(loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3 bg-surface justify-between">
          <div className="flex items-center gap-3">
            <MessageSquareHeart className="w-6 h-6 text-aura-red" />
            <h2 className="text-xl font-medium">User Feedback</h2>
          </div>
          <span className="bg-aura-red/20 text-aura-red px-3 py-1 rounded-full text-xs font-bold">{feedbacks.length} Total</span>
        </div>
        <div className="divide-y divide-border">
          {feedbacks.length === 0 ? (
            <div className="p-8 text-center text-text-faint italic">No feedback yet.</div>
          ) : (
            feedbacks.map(feedback => (
              <div key={feedback.id} className="p-6 hover:bg-surface transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-text-primary">{feedback.email}</p>
                    <p className="text-xs text-text-faint">
                      {feedback.createdAt?.toDate ? feedback.createdAt.toDate().toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="flex bg-bg px-3 py-1 rounded-full border border-border items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        size={14} 
                        className={i < feedback.rating ? "fill-aura-red text-aura-red" : "text-border-strong"} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-text-body bg-bg p-4 rounded-xl border border-border">{feedback.feedbackText}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
