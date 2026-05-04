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

  if(loading) return <div className="animate-pulse h-64 bg-white/5 rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3 bg-white/5 justify-between">
          <div className="flex items-center gap-3">
            <MessageSquareHeart className="w-6 h-6 text-aura-red" />
            <h2 className="text-xl font-medium">User Feedback</h2>
          </div>
          <span className="bg-aura-red/20 text-aura-red px-3 py-1 rounded-full text-xs font-bold">{feedbacks.length} Total</span>
        </div>
        <div className="divide-y divide-white/10">
          {feedbacks.length === 0 ? (
            <div className="p-8 text-center text-gray-500 italic">No feedback yet.</div>
          ) : (
            feedbacks.map(feedback => (
              <div key={feedback.id} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-white">{feedback.email}</p>
                    <p className="text-xs text-gray-500">
                      {feedback.createdAt?.toDate ? feedback.createdAt.toDate().toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="flex bg-black px-3 py-1 rounded-full border border-white/10 items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        size={14} 
                        className={i < feedback.rating ? "fill-aura-red text-aura-red" : "text-white/20"} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-gray-300 bg-black/40 p-4 rounded-xl border border-white/5">{feedback.feedbackText}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
