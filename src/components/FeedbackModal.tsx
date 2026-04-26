import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        email: user.email,
        feedbackText: feedback.trim(),
        rating: rating || 5, // Default to 5 if not selected, though we strictly check >=1 in rules
        createdAt: serverTimestamp(),
        status: 'new'
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFeedback('');
        setRating(0);
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/5 bg-white/[0.02]">
              <h2 className="text-xl font-serif italic text-aura-red">Your Feedback</h2>
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors bg-white/5 rounded-full p-1.5 hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            
            {success ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-aura-red/20 rounded-full flex items-center justify-center text-aura-red mb-2">
                  <Star className="fill-aura-red w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Thank You!</h3>
                <p className="text-white/50 text-sm">Your feedback helps us improve.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-6">
                <div>
                  <label className="block text-xs text-white/50 tracking-wider mb-3 font-medium uppercase">How was your experience?</label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className={`p-1 transition-all ${
                          (hoveredRating || rating) >= star 
                            ? 'text-aura-red scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' 
                            : 'text-white/20 hover:text-white/40'
                        }`}
                      >
                        <Star size={32} className={(hoveredRating || rating) >= star ? 'fill-current' : ''} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/50 tracking-wider mb-2 font-medium uppercase">Tell us more</label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-aura-red/50 focus:bg-white/10 transition-all resize-none h-32 placeholder:text-white/20"
                    placeholder="What did you love? What could be better...?"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!feedback.trim() || !rating || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-aura-red text-black font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Feedback
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
