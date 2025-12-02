import React, { useState, useEffect } from 'react';
import { UserProfile, Relationship, TabType, WishlistItem } from '../types';
import { db, auth, logout } from '../services/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { generateIdeas, generatePlan } from '../services/geminiService';
import { 
  Heart, MapPin, Calendar, Star, Plus, Link as LinkIcon, 
  Trash2, ExternalLink, CheckCircle, Sparkles, X, LogOut, Copy, Settings, Cloud, Loader2 
} from 'lucide-react';

interface Props {
  user: UserProfile;
  relationship: Relationship;
}

const Dashboard: React.FC<Props> = ({ user, relationship }) => {
  const [activeTab, setActiveTab] = useState<TabType>(TabType.PLACES);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Form
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [newItemTarget, setNewItemTarget] = useState('');

  // Settings
  const [startDate, setStartDate] = useState(relationship.startDate);
  
  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiMode, setAiMode] = useState<'idea' | 'plan'>('idea');
  const [selectedItemForPlan, setSelectedItemForPlan] = useState<WishlistItem | null>(null);

  useEffect(() => {
    // Listen to Items
    const itemsRef = collection(db, "relationships", relationship.id, "items");
    const q = query(itemsRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem));
      setItems(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [relationship.id]);

  // Actions
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    try {
      const itemsRef = collection(db, "relationships", relationship.id, "items");
      await addDoc(itemsRef, {
        category: activeTab,
        title: newItemTitle,
        link: newItemLink,
        note: newItemNote,
        targetDate: newItemTarget,
        completed: false,
        createdBy: user.uid,
        createdAt: Date.now()
      });
      setNewItemTitle(''); setNewItemLink(''); setNewItemNote(''); setNewItemTarget('');
      setShowAddModal(false);
    } catch (err) {
      alert("Gagal menyimpan data.");
    }
  };

  const toggleComplete = async (item: WishlistItem) => {
    const itemRef = doc(db, "relationships", relationship.id, "items", item.id);
    await updateDoc(itemRef, {
      completed: !item.completed
    });
  };

  const deleteItem = async (id: string) => {
    if (confirm("Hapus item ini?")) {
      const itemRef = doc(db, "relationships", relationship.id, "items", id);
      await deleteDoc(itemRef);
    }
  };

  const saveStartDate = async (date: string) => {
    setStartDate(date);
    const relRef = doc(db, "relationships", relationship.id);
    await updateDoc(relRef, { startDate: date });
  };

  // AI Logic
  const handleAiIdea = async () => {
    setAiMode('idea');
    setShowAIModal(true);
    setAiLoading(true);
    setAiResult('');
    try {
      const res = await generateIdeas(categories[activeTab].label);
      setAiResult(res || "Tidak ada respon.");
    } catch (e) {
      setAiResult("Gagal memuat AI.");
    } finally { setAiLoading(false); }
  };

  const handleAiPlan = async (item: WishlistItem) => {
    setSelectedItemForPlan(item);
    setAiMode('plan');
    setShowAIModal(true);
    setAiLoading(true);
    setAiResult('');
    try {
      const res = await generatePlan(item.title, item.category);
      setAiResult(res || "Tidak ada respon.");
    } catch (e) {
      setAiResult("Gagal memuat AI.");
    } finally { setAiLoading(false); }
  };

  const saveAiNote = async () => {
    if (selectedItemForPlan && aiResult) {
      const newNote = (selectedItemForPlan.note ? selectedItemForPlan.note + '\n\n' : '') + '🤖 AI Tips:\n' + aiResult;
      const itemRef = doc(db, "relationships", relationship.id, "items", selectedItemForPlan.id);
      await updateDoc(itemRef, {
        note: newNote
      });
      setShowAIModal(false);
    }
  };

  const categories = {
    [TabType.PLACES]: { label: 'Places', icon: MapPin, color: 'text-primary', style: 'default' },
    [TabType.ACTIVITIES]: { label: 'Activities', icon: Calendar, color: 'text-secondary', style: 'sticky' },
    [TabType.HOPES]: { label: 'Wishes', icon: Star, color: 'text-amber-600', style: 'minimal' }
  };

  const filteredItems = items.filter(i => i.category === activeTab);

  const daysTogether = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="pb-24">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 bg-white/50 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-md mx-auto flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-secondary uppercase tracking-widest">Our Journey</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium flex items-center gap-1">
                    <Cloud className="w-3 h-3"/> Sync
                </span>
            </div>
            <h1 className="text-2xl font-bold text-primary font-sans">Hi, {user.displayName?.split(' ')[0]}</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-primary transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Stats & Invite Code */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Together For</p>
            <p className="text-3xl font-bold text-primary font-handwriting">{daysTogether} <span className="font-sans text-sm text-gray-400 font-normal">Days</span></p>
          </div>
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
            <Heart className="w-6 h-6 text-red-400 fill-red-400" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto px-4 mb-6">
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          {Object.values(TabType).map(type => {
            const isActive = activeTab === type;
            const CatIcon = categories[type].icon;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <CatIcon className="w-4 h-4" />
                {categories[type].label}
              </button>
            )
          })}
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-500 font-light italic">
            {activeTab === TabType.PLACES && "Tempat yang ingin kita kunjungi..."}
            {activeTab === TabType.ACTIVITIES && "Hal seru yang ingin dilakukan..."}
            {activeTab === TabType.HOPES && "Mimpi masa depan kita..."}
          </p>
          {process.env.API_KEY && (
            <button onClick={handleAiIdea} className="text-xs bg-white border border-secondary/30 text-secondary px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-secondary/5 transition-colors">
              <Sparkles className="w-3 h-3" /> Ide AI
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-w-md mx-auto px-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent" /></div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <p>Belum ada daftar.</p>
            <p className="text-sm">Klik + untuk menambah.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              className={`
                relative p-5 rounded-[24px] transition-all duration-300 group
                ${categories[activeTab].style === 'sticky' ? 'bg-[#FFF9C4] rounded-tr-none rotate-1 hover:rotate-0 shadow-sm text-amber-900' : 
                  categories[activeTab].style === 'minimal' ? 'bg-white border-l-4 border-secondary shadow-sm' : 
                  'bg-white border border-gray-100 shadow-sm hover:shadow-md'}
                ${item.completed ? 'opacity-50 grayscale' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className={`font-semibold text-lg leading-tight ${item.completed ? 'line-through' : ''}`}>{item.title}</h3>
                <button onClick={() => toggleComplete(item)}>
                  <CheckCircle className={`w-6 h-6 transition-colors ${item.completed ? 'text-green-500 fill-green-100' : 'text-gray-200 hover:text-green-400'}`} />
                </button>
              </div>

              {item.targetDate && (
                <div className="flex items-center gap-1.5 text-xs opacity-70 mb-3">
                  <Calendar className="w-3 h-3" />
                  <span>{item.targetDate}</span>
                </div>
              )}

              {item.note && <p className="text-sm opacity-80 whitespace-pre-line mb-4 font-light leading-relaxed">{item.note}</p>}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5">
                <div className="flex gap-2">
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors">
                       Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {!item.completed && process.env.API_KEY && (
                    <button onClick={() => handleAiPlan(item)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors">
                       <Sparkles className="w-3 h-3" /> Plan
                    </button>
                  )}
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={() => setShowAddModal(true)} 
        className="fixed bottom-8 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-xl shadow-primary/30 flex items-center justify-center hover:bg-[#7a5e5e] active:scale-90 transition-all z-30"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">New Wish</h2>
              <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <input 
                autoFocus
                type="text" 
                placeholder="What do you want to do?" 
                className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-0 rounded-xl px-4 py-3 transition-all"
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="date" 
                  className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-0 rounded-xl px-4 py-3 transition-all text-sm text-gray-500"
                  value={newItemTarget}
                  onChange={e => setNewItemTarget(e.target.value)}
                />
                <input 
                  type="url" 
                  placeholder="Link (IG/TikTok)" 
                  className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-0 rounded-xl px-4 py-3 transition-all text-sm"
                  value={newItemLink}
                  onChange={e => setNewItemLink(e.target.value)}
                />
              </div>
              <textarea 
                rows={3} 
                placeholder="Notes..." 
                className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-0 rounded-xl px-4 py-3 transition-all resize-none"
                value={newItemNote}
                onChange={e => setNewItemNote(e.target.value)}
              />
              <button disabled={!newItemTitle} className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                Add to Wishlist
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Settings</h2>
              <button onClick={() => setShowSettings(false)}><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Invite Code</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-100 p-3 rounded-xl text-center font-mono font-bold tracking-widest text-lg text-gray-700 select-all">
                    {relationship.code}
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(relationship.code)} className="bg-gray-100 p-3 rounded-xl hover:bg-gray-200">
                    <Copy className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Share this code with your partner to join this space.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Relationship Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => saveStartDate(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 border border-gray-200" 
                />
              </div>

              <button onClick={() => logout()} className="w-full py-3 rounded-xl border border-red-100 text-red-500 font-medium hover:bg-red-50 flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
              <button onClick={() => setShowAIModal(false)} className="absolute top-4 right-4 text-gray-400"><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-2 mb-4 text-secondary">
                 <Sparkles className="w-5 h-5" />
                 <h3 className="font-bold text-lg">{aiMode === 'idea' ? 'Magic Ideas' : 'Smart Planner'}</h3>
              </div>
              
              <div className="bg-background rounded-xl p-4 min-h-[120px] max-h-[60vh] overflow-y-auto mb-4 border border-gray-100">
                 {aiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400">
                       <Loader2 className="w-8 h-8 animate-spin mb-2" />
                       <span className="text-xs">Consulting Cupid...</span>
                    </div>
                 ) : (
                    <div className="prose prose-sm text-gray-600 whitespace-pre-line">{aiResult}</div>
                 )}
              </div>

              {aiResult && !aiLoading && (
                 <button 
                    onClick={aiMode === 'plan' ? saveAiNote : () => navigator.clipboard.writeText(aiResult)}
                    className="w-full bg-secondary/10 text-secondary hover:bg-secondary/20 py-3 rounded-xl font-semibold transition-colors flex justify-center items-center gap-2"
                 >
                    {aiMode === 'plan' ? 'Save to Notes' : 'Copy Text'}
                 </button>
              )}
           </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;