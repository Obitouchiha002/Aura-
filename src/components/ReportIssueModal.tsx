import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send } from 'lucide-react';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose }) => {
  const [issue, setIssue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim()) return;
    
    const subject = encodeURIComponent("Aura App Issue Report");
    const body = encodeURIComponent(issue);
    const mailtoLink = `mailto:vk1234888i@gmail.com?subject=${subject}&body=${body}`;
    
    // Use a dynamically created anchor tag to bypass iframe restrictions
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.target = '_top';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onClose();
    setIssue('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-bg border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-lg font-medium text-text-primary">Report an Issue</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Describe your problem</label>
                <textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-text-primary text-sm placeholder:text-text-faint focus:outline-none focus:border-aura-red transition-colors resize-none h-32"
                  placeholder="What went wrong? Please provide details..."
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!issue.trim()}
                className="w-full flex items-center justify-center gap-2 bg-aura-red text-on-accent font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
              >
                <Send size={16} />
                Send to Developer
              </button>
              <p className="text-center text-[10px] text-text-faint">
                Developer: Vansh Kashyap
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
