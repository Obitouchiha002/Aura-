import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, LayoutDashboard, Users, MessageSquare, 
  Settings2, TrendingUp, MessageSquareHeart, Menu, X 
} from 'lucide-react';
import OverviewPanel from './admin/OverviewPanel';
import UsersPanel from './admin/UsersPanel';
import SessionsPanel from './admin/SessionsPanel';
import SettingsPanel from './admin/SettingsPanel';
import FeedbackPanel from './admin/FeedbackPanel';
import GrowthPanel from './admin/GrowthPanel';

const TABS = [
  { id: 'overview', label: 'Live Overview', icon: LayoutDashboard },
  { id: 'users', label: 'User Directory', icon: Users },
  { id: 'sessions', label: 'Chat Sessions', icon: MessageSquare },
  { id: 'feedback', label: 'User Feedback', icon: MessageSquareHeart },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'app_settings', label: 'App Settings', icon: Settings2 },
];

export const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPanel onNavigate={setActiveTab} />;
      case 'users': return <UsersPanel />;
      case 'sessions': return <SessionsPanel />;
      case 'feedback': return <FeedbackPanel />;
      case 'growth': return <GrowthPanel />;
      case 'app_settings': return <SettingsPanel />;
      default: return <OverviewPanel onNavigate={setActiveTab} />;
    }
  };

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] text-white font-sans overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#050505] border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-serif italic text-aura-red tracking-wide drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">AURA</h1>
          </div>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 w-64 bg-[#050505] border-r border-white/5 flex flex-col h-full flex-shrink-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.8)] transition-transform duration-300 pt-16 md:pt-0`}>
        <div className="hidden md:flex p-6 items-center gap-3 border-b border-white/5">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-serif italic text-aura-red tracking-wide drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">AURA</h1>
            <p className="text-[9px] uppercase tracking-widest text-white/40">Command Center</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group ${
                  isActive 
                    ? 'text-white bg-aura-red/10 border border-aura-red/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]' 
                    : 'text-white/50 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-aura-red rounded-l-xl shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                  />
                )}
                <Icon size={18} className={isActive ? 'text-aura-red' : 'group-hover:text-white/80'} />
                <span className="text-sm font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-y-auto bg-[#0A0A0A] pt-16 md:pt-0">
        {/* Cinematic gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-aura-red/5 to-transparent pointer-events-none" />
        
        <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto min-h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <div className="mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-medium tracking-tight">
                  {TABS.find(t => t.id === activeTab)?.label}
                </h2>
                <div className="h-px w-full bg-gradient-to-r from-aura-red/50 to-transparent mt-3 md:mt-4 opacity-50" />
              </div>
              
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

