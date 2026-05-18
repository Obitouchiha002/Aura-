import React from 'react';
import { TrendingUp, Users, Share2 } from 'lucide-react';
export default function GrowthPanel() { 
  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-medium mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-aura-red"/> Growth Insights</h3>
        <p className="text-sm text-white/70 mb-4 p-4 bg-black border border-white/10 rounded-xl font-mono">
          <span className="text-aura-red">AI Insight:</span> Users who interact with Thomas Shelby are 60% more likely to use the "Share App" feature.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-black rounded-xl border border-white/5">
            <Share2 className="text-aura-red mb-2" size={16} />
            <h4 className="text-xs uppercase tracking-widest text-white/40 mb-1">Total Link Shares</h4>
            <p className="text-2xl font-bold">1,402</p>
          </div>
          <div className="p-4 bg-black rounded-xl border border-white/5">
            <Users className="text-blue-500 mb-2" size={16} />
            <h4 className="text-xs uppercase tracking-widest text-white/40 mb-1">Referral Signups</h4>
            <p className="text-2xl font-bold">342</p>
          </div>
        </div>
      </div>
    </div>
  ); 
}
