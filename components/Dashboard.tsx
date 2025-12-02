import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Relationship, TabType, WishlistItem } from '../types';
import { db, logout, leaveRelationship } from '../services/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { generateIdeas, generatePlan, generateRouletteSuggestion } from '../services/geminiService';
import { 
  Heart, MapPin, Calendar, Star, Plus, Link as LinkIcon, 
  Trash2, CheckCircle, Sparkles, X, LogOut, Copy, Settings, 
  Loader2, Home, List, User, DollarSign, RefreshCw, Filter
} from 'lucide-react';

interface Props {
  user: UserProfile;
  relationship: Relationship;
}

const BUDGET_LABELS = {
  free: 'Free',
  low: '$ Hemat',
  medium: '$$ Sedang',
  high: '$$$ Mewah'
};

const Dashboard: React.FC<Props> = ({ user, relationship }) => {
  // Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'wishlist' | 'profile'>('home');
  const [activeTab, setActiveTab] = useState<TabType>(TabType.PLACES);
  
  // Data State
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Love Note State
  const [loveNote, setLoveNote] = useState(relationship.loveNote || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const noteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // New Item Form
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [newItemTarget, setNewItemTarget] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<'low'|'medium'|'high'>('medium');
  const [newItemBudget, setNewItemBudget] = useState<'free'|'low'|'medium'|'high'>('medium');

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiMode, setAiMode] = useState<'idea' | 'plan' | 'roulette'>('idea');
  const [selectedItemForPlan, setSelectedItemForPlan] = useState<WishlistItem | null>(null);

  // Sync relationship love note if changed by partner
  useEffect(() => {
    if (relationship.loveNote !== undefined) {
      setLoveNote(relationship.loveNote);
    }
  }, [relationship.loveNote]);

  // Items Listener
  useEffect(() => {
    const itemsRef = collection(db, "relationships", relationship.id, "items");
    const q = query(itemsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem));
      setItems(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [relationship.id]);

  // --- ACTIONS ---

  const handleLoveNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLoveNote(val);
    
    // Debounce Save to Firestore
    if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
    noteTimeoutRef.current = setTimeout(async () => {
      const relRef = doc(db, "relationships", relationship.id);
      await updateDoc(relRef, { 
        loveNote: val,
        loveNoteUpdater: user.displayName || 'Guest'
      });
    }, 1500);
  };

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
        priority: newItemPriority,
        budget: newItemBudget,
        completed: false,
        createdBy: user.uid,
        createdAt: Date.now()
      });
      // Reset
      setNewItemTitle(''); setNewItemLink(''); setNewItemNote(''); 
      setNewItemTarget(''); setShowAddModal(false);
    } catch (err) {
      alert("Gagal menyimpan.");
    }
  };

  const toggleComplete = async (item: WishlistItem) => {
    const itemRef = doc(db, "relationships", relationship.id, "items", item.id);
    await updateDoc(itemRef, { completed: !item.completed });
  };

  const deleteItem = async (id: string) => {
    if (confirm("Hapus kenangan ini?")) {
      const itemRef = doc(db, "relationships", relationship.id, "items", id);
      await deleteDoc(itemRef);
    }
  };

  const handleAiRoulette = async () => {
    setAiMode('roulette');
    setShowAIModal(true);
    setAiLoading(true);
    setAiResult('');
    try {
      // 50% chance pick from existing uncompleted items, 50% random AI
      const uncompleted = items.filter(i => !i.completed);
      if (uncompleted.length > 0 && Math.random() > 0.5) {
        const randomItem = uncompleted[Math.floor(Math.random() * uncompleted.length)];
        setAiResult(`🎯 DARI WISHLIST KALIAN:\n\n**${randomItem.title}**\n\nYuk wujudkan ini sekarang! ${randomItem.note ? `\nCatatan: ${randomItem.note}` : ''}`);
      } else {
        const res = await generateRouletteSuggestion();
        setAiResult(`✨ IDE SPONTAN AI:\n\n${res}`);
      }
    } catch (e) {
      setAiResult("Gagal memanggil AI.");
    } finally { setAiLoading(false); }
  };

  const handleAiPlan = async (item: WishlistItem) => {
    setSelectedItemForPlan(item);
    setAiMode('plan');
    setShowAIModal(true);
    setAiLoading(true);
    try {
      const res = await generatePlan(item.title, item.category);
      setAiResult(res || "Error.");
    } catch (e) { setAiResult("Gagal."); } finally { setAiLoading(false); }
  };

  const handleAiIdea = async () => {
    setAiMode('idea');
    setShowAIModal(true);
    setAiLoading(true);
    try {
      const res = await generateIdeas(activeTab);
      setAiResult(res || "Error.");
    } catch (e) { setAiResult("Gagal."); } finally { setAiLoading(false); }
  };

  // Helper Calculations
  const daysTogether = Math.floor((Date.now() - new Date(relationship.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const filteredItems = items.filter(i => i.category === activeTab);
  const nextGoal = items.filter(i => !i.completed).sort((a,b) => b.createdAt - a.createdAt)[0];

  // --- VIEWS ---

  const renderHome = () => (
    <div className="space-y-6 pb-24 pt-6 px-6 animate-in fade-in duration-500">
      {/* Hero Stats */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#8E6E6E] to-[#6d5454] rounded-[32px] p-6 text-white shadow-xl shadow-[#8E6E6E]/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex flex-col items-center justify-center py-4">
          <p className="text-white/70 text-sm font-medium tracking-widest uppercase mb-2">Together For</p>
          <div className="text-6xl font-handwriting mb-2">{daysTogether}</div>
          <p className="text-sm font-medium bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">Days of Love</p>
        </div>
      </div>

      {/* Love Note Widget */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 relative group transition-all hover:shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-50 rounded-full"><Heart className="w-4 h-4 text-pink-400 fill-pink-400" /></div>
            <h3 className="font-bold text-gray-700">Our Love Note</h3>
          </div>
          <div className="text-[10px] text-gray-400">
             {relationship.loveNoteUpdater ? `Updated by ${relationship.loveNoteUpdater.split(' ')[0]}` : 'Write something...'}
          </div>
        </div>
        <textarea 
          className="w-full bg-[#FDFBF7] rounded-xl p-4 text-gray-600 font-handwriting text-lg focus:outline-none focus:ring-2 focus:ring-[#EBE0D0] resize-none transition-colors min-h-[100px]"
          value={loveNote}
          onChange={handleLoveNoteChange}
          placeholder="Tulis pesan manis untuk pasanganmu disini..."
        />
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={handleAiRoulette} className="bg-gradient-to-br from-[#B09B7A] to-[#968366] text-white p-5 rounded-[28px] shadow-lg shadow-[#B09B7A]/30 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95">
          <RefreshCw className="w-8 h-8 opacity-80" />
          <span className="font-bold text-sm">Date Roulette</span>
        </button>

        <div className="bg-white p-5 rounded-[28px] border border-gray-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <p className="text-xs text-gray-400 mb-1 font-medium">Next Goal:</p>
          {nextGoal ? (
             <div className="font-bold text-gray-700 truncate">{nextGoal.title}</div>
          ) : (
             <div className="text-gray-400 italic text-sm">Belum ada rencana</div>
          )}
          <div onClick={() => { setCurrentView('wishlist'); }} className="absolute inset-0 bg-transparent cursor-pointer"></div>
        </div>
      </div>
    </div>
  );

  const renderWishlist = () => (
    <div className="pb-24 pt-6 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {Object.values(TabType).map(t => (
          <button 
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === t 
              ? 'bg-[#8E6E6E] text-white shadow-lg shadow-[#8E6E6E]/20' 
              : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* AI Suggestion Button */}
      <button onClick={handleAiIdea} className="w-full mb-6 bg-[#FDFBF7] border border-[#EBE0D0] border-dashed text-[#B09B7A] p-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#F9F4EB] transition-colors">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Minta Ide {activeTab} ke AI</span>
      </button>

      {/* List */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <List className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm">Belum ada item di kategori ini.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className={`bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm transition-all ${item.completed ? 'opacity-60 grayscale' : 'hover:shadow-md'}`}>
               <div className="flex justify-between items-start mb-3">
                 <div>
                   <div className="flex items-center gap-2 mb-1">
                      {item.priority === 'high' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">PENTING</span>}
                      {item.budget && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">{BUDGET_LABELS[item.budget]}</span>}
                   </div>
                   <h3 className={`font-bold text-gray-800 text-lg ${item.completed ? 'line-through' : ''}`}>{item.title}</h3>
                 </div>
                 <button onClick={() => toggleComplete(item)} className={`p-2 rounded-full ${item.completed ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-300 hover:bg-gray-100'}`}>
                   <CheckCircle className="w-5 h-5" />
                 </button>
               </div>

               {item.note && <p className="text-gray-500 text-sm mb-3 bg-[#FDFBF7] p-3 rounded-xl">{item.note}</p>}

               <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                 <div className="flex gap-2">
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer" className="text-xs bg-gray-50 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-100 transition-colors">
                        <LinkIcon className="w-3 h-3" /> Link
                      </a>
                    )}
                    {!item.completed && (
                      <button onClick={() => handleAiPlan(item)} className="text-xs bg-[#FAF2F2] text-[#8E6E6E] px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-[#F5EBEB] transition-colors">
                        <Sparkles className="w-3 h-3" /> Plan
                      </button>
                    )}
                 </div>
                 <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                   <Trash2 className="w-4 h-4" />
                 </button>
               </div>
            </div>
          ))
        )}
      </div>
      
      {/* Floating Add Button */}
      <button onClick={() => setShowAddModal(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-[#8E6E6E] text-white rounded-full shadow-xl shadow-[#8E6E6E]/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20">
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );

  const renderProfile = () => (
    <div className="p-6 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 bg-gray-200 rounded-full mb-4 overflow-hidden border-4 border-white shadow-lg">
           {user.photoURL ? (
             <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full flex items-center justify-center bg-[#B09B7A] text-white">
               <User className="w-10 h-10" />
             </div>
           )}
        </div>
        <h2 className="text-xl font-bold text-gray-800">{user.displayName}</h2>
        <p className="text-sm text-gray-400">Kode Cinta: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded ml-1 text-gray-600">{relationship.code}</span></p>
        <button 
           onClick={() => navigator.clipboard.writeText(relationship.code)}
           className="mt-2 text-xs flex items-center gap-1 text-[#8E6E6E] font-medium"
        >
          <Copy className="w-3 h-3" /> Salin Kode
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-50 rounded-xl"><Calendar className="w-5 h-5 text-blue-500" /></div>
             <span className="text-sm font-medium text-gray-700">Tanggal Jadian</span>
           </div>
           <span className="text-sm text-gray-500">{relationship.startDate}</span>
        </div>

        <button onClick={() => setShowSettings(true)} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 hover:bg-gray-50 transition-colors text-left">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-purple-50 rounded-xl"><Settings className="w-5 h-5 text-purple-500" /></div>
             <span className="text-sm font-medium text-gray-700">Pengaturan Ruangan</span>
           </div>
        </button>

        <button onClick={logout} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 hover:bg-gray-50 transition-colors text-left">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-red-50 rounded-xl"><LogOut className="w-5 h-5 text-red-500" /></div>
             <span className="text-sm font-medium text-red-500">Keluar Akun</span>
           </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-gray-600">
      {/* HEADER */}
      <header className="px-6 pt-8 pb-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-[#8E6E6E] font-handwriting text-2xl">Our Journey</h1>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-400"></div>
             <span className="text-[10px] font-medium text-gray-400">SYNCED</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      {currentView === 'home' && renderHome()}
      {currentView === 'wishlist' && renderWishlist()}
      {currentView === 'profile' && renderProfile()}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-30 pb-6">
        <button onClick={() => setCurrentView('home')} className={`p-3 rounded-2xl transition-all ${currentView === 'home' ? 'bg-[#8E6E6E] text-white shadow-lg shadow-[#8E6E6E]/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <Home className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView('wishlist')} className={`p-3 rounded-2xl transition-all ${currentView === 'wishlist' ? 'bg-[#B09B7A] text-white shadow-lg shadow-[#B09B7A]/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <List className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView('profile')} className={`p-3 rounded-2xl transition-all ${currentView === 'profile' ? 'bg-gray-800 text-white shadow-lg shadow-gray-800/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <User className="w-6 h-6" />
        </button>
      </nav>

      {/* MODALS */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-gray-800">Tambah {activeTab}</h3>
               <button onClick={() => setShowAddModal(false)} className="bg-gray-50 p-2 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
             </div>
             <form onSubmit={handleAddItem} className="space-y-4">
               <input autoFocus placeholder="Judul..." className="w-full bg-[#FDFBF7] p-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-1 focus:ring-[#B09B7A]" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} />
               
               <div className="grid grid-cols-2 gap-3">
                 <select className="bg-[#FDFBF7] p-3 rounded-xl border border-gray-100 text-sm" value={newItemPriority} onChange={(e:any) => setNewItemPriority(e.target.value)}>
                   <option value="low">Prioritas: Rendah</option>
                   <option value="medium">Prioritas: Sedang</option>
                   <option value="high">Prioritas: Tinggi</option>
                 </select>
                 <select className="bg-[#FDFBF7] p-3 rounded-xl border border-gray-100 text-sm" value={newItemBudget} onChange={(e:any) => setNewItemBudget(e.target.value)}>
                   <option value="free">Budget: Free</option>
                   <option value="low">Budget: $ Hemat</option>
                   <option value="medium">Budget: $$ Sedang</option>
                   <option value="high">Budget: $$$ Mewah</option>
                 </select>
               </div>

               <div className="flex gap-2">
                 <input type="date" className="flex-1 bg-[#FDFBF7] p-3 rounded-xl border border-gray-100 text-sm text-gray-500" value={newItemTarget} onChange={e => setNewItemTarget(e.target.value)} />
                 <input placeholder="Link..." className="flex-1 bg-[#FDFBF7] p-3 rounded-xl border border-gray-100 text-sm" value={newItemLink} onChange={e => setNewItemLink(e.target.value)} />
               </div>

               <textarea placeholder="Catatan kecil..." rows={2} className="w-full bg-[#FDFBF7] p-4 rounded-xl border border-gray-100 focus:outline-none resize-none text-sm" value={newItemNote} onChange={e => setNewItemNote(e.target.value)} />

               <button disabled={!newItemTitle.trim()} className="w-full bg-[#8E6E6E] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#8E6E6E]/30 disabled:opacity-50">Simpan</button>
             </form>
          </div>
        </div>
      )}

      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative animate-in zoom-in-95">
              <button onClick={() => setShowAIModal(false)} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500"><X className="w-5 h-5" /></button>
              <div className="flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-[#FAF2F2] rounded-full flex items-center justify-center mb-4">
                   <Sparkles className="w-6 h-6 text-[#8E6E6E]" />
                 </div>
                 <h3 className="font-bold text-lg mb-4 text-gray-800">
                   {aiMode === 'idea' ? 'Magic Ideas' : aiMode === 'plan' ? 'Planning Assistant' : 'Date Roulette'}
                 </h3>
                 
                 <div className="w-full bg-[#FDFBF7] rounded-2xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto mb-4 border border-gray-100 text-left text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                   {aiLoading ? (
                     <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-400">
                       <Loader2 className="w-6 h-6 animate-spin" />
                       <span className="text-xs">Menghubungi Cupid AI...</span>
                     </div>
                   ) : (
                     aiResult
                   )}
                 </div>

                 {!aiLoading && aiResult && (
                   <div className="flex gap-2 w-full">
                     <button onClick={() => navigator.clipboard.writeText(aiResult)} className="flex-1 bg-gray-50 py-3 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100">Salin</button>
                     {aiMode === 'plan' && selectedItemForPlan && (
                       <button onClick={async () => {
                         const itemRef = doc(db, "relationships", relationship.id, "items", selectedItemForPlan.id);
                         await updateDoc(itemRef, { note: (selectedItemForPlan.note || '') + '\n\n✨ AI Plan:\n' + aiResult });
                         setShowAIModal(false);
                       }} className="flex-1 bg-[#8E6E6E] text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-[#8E6E6E]/20">Simpan ke Catatan</button>
                     )}
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 text-center">
            <h3 className="font-bold text-lg mb-2">Pengaturan Ruangan</h3>
            <p className="text-sm text-gray-400 mb-6">Hati-hati, aksi ini sensitif.</p>
            
            <button 
              onClick={async () => {
                if(confirm("Yakin ingin meninggalkan pasangan ini? Anda harus di-invite ulang untuk masuk kembali.")) {
                  await leaveRelationship(user.uid, relationship.id);
                  window.location.reload();
                }
              }}
              className="w-full bg-red-50 text-red-500 py-3 rounded-xl font-bold text-sm mb-3 hover:bg-red-100"
            >
              Tinggalkan Ruangan Ini
            </button>
            <button onClick={() => setShowSettings(false)} className="text-sm text-gray-400 font-medium">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;