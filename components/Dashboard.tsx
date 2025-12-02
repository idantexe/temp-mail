import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Relationship, TabType, WishlistItem, Message, SavingGoal } from '../types';
import { db, logout, leaveRelationship } from '../services/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, doc, deleteDoc, where, getDocs, limit, writeBatch, increment
} from 'firebase/firestore';
import { generateIdeas, generatePlan, generateRouletteSuggestion } from '../services/geminiService';
import { 
  Heart, MapPin, Calendar, Star, Plus, Link as LinkIcon, 
  Trash2, CheckCircle, Sparkles, X, LogOut, Copy, Settings, 
  Loader2, Home, List, User, DollarSign, RefreshCw, Filter, Edit2, Users, MessageCircle, Send, ArrowUp, ArrowDown, MoreHorizontal, Check, Wallet, TrendingUp, Minus
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

const CARD_COLORS = ['bg-emerald-100', 'bg-blue-100', 'bg-purple-100', 'bg-orange-100', 'bg-pink-100'];

// MENGGUNAKAN FILE LOKAL (Pastikan file ada di public/sounds/notification.mp3)
const NOTIFICATION_SOUND = '/sounds/notification.mp3';

const Dashboard: React.FC<Props> = ({ user, relationship }) => {
  // Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'wishlist' | 'savings' | 'chat' | 'profile'>('home');
  const [activeTab, setActiveTab] = useState<TabType>(TabType.PLACES);
  
  // Ref untuk melacak view aktif tanpa memicu re-render listener pesan
  const currentViewRef = useRef(currentView);

  // Data State
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [savings, setSavings] = useState<SavingGoal[]>([]); // Savings Data
  const [messages, setMessages] = useState<Message[]>([]); 
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Notification State
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoadRef = useRef(true); 
  
  // Love Note State
  const [loveNote, setLoveNote] = useState(relationship.loveNote || '');
  const noteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Chat State
  const [newMessageText, setNewMessageText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null); 
  const [editMessageText, setEditMessageText] = useState(''); 
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSavingModal, setShowSavingModal] = useState(false); // Modal tambah target nabung
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  
  // --- FORM STATES ---
  // Wishlist Form
  const [editingItemId, setEditingItemId] = useState<string | null>(null); // Jika null = Create, jika isi = Edit
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [newItemTarget, setNewItemTarget] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<'low'|'medium'|'high'>('medium');
  const [newItemBudget, setNewItemBudget] = useState<'free'|'low'|'medium'|'high'>('medium');
  const [newItemPrice, setNewItemPrice] = useState<string>(''); // Nominal Budget (String biar gampang handle input)

  // Saving Form (New Goal)
  const [savingTitle, setSavingTitle] = useState('');
  const [savingTarget, setSavingTarget] = useState('');

  // Update Saving Amount Form
  const [topUpGoalId, setTopUpGoalId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMode, setTopUpMode] = useState<'add' | 'withdraw'>('add');

  // Edit Date Form
  const [newStartDate, setNewStartDate] = useState(relationship.startDate);

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiMode, setAiMode] = useState<'idea' | 'plan' | 'roulette'>('idea');
  const [selectedItemForPlan, setSelectedItemForPlan] = useState<WishlistItem | null>(null);

  // Sync currentView to Ref
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Sync relationship love note if changed by partner
  useEffect(() => {
    if (relationship.loveNote !== undefined) {
      setLoveNote(relationship.loveNote);
    }
    if (relationship.startDate) {
      setNewStartDate(relationship.startDate);
    }
  }, [relationship.loveNote, relationship.startDate]);

  // Reset unread count when opening chat
  useEffect(() => {
    if (currentView === 'chat') {
      setUnreadCount(0);
    }
  }, [currentView]);

  // Items Listener
  useEffect(() => {
    const itemsRef = collection(db, "relationships", relationship.id, "items");
    const q = query(itemsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem));
      
      const sorted = fetched.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        return b.createdAt - a.createdAt;
      });

      setItems(sorted);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [relationship.id]);

  // Savings Listener
  useEffect(() => {
    const savingsRef = collection(db, "relationships", relationship.id, "savings");
    const q = query(savingsRef, orderBy("lastUpdated", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingGoal));
      setSavings(fetched);
    });
    return () => unsubscribe();
  }, [relationship.id]);

  // Messages Listener (Chat & Notifications)
  useEffect(() => {
    const messagesRef = collection(db, "relationships", relationship.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(50));
    
    // IMPORTANT: Dependencies array hanya berisi relationship.id dan user.uid.
    // Kita hapus currentView dari sini agar listener tidak restart saat ganti tab.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(fetchedMsgs);

      if (!isFirstLoadRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const msg = change.doc.data() as Message;
            // Jika pesan bukan dari saya (dari partner)
            if (msg.senderId !== user.uid) {
              
              // 1. Play Sound
              try {
                const audio = new Audio(NOTIFICATION_SOUND);
                audio.volume = 0.5; // Set volume 50%
                audio.play().catch(e => console.log("Audio autoplay blocked or file missing", e));
              } catch (e) {
                console.error("Gagal memutar audio", e);
              }

              // 2. Update Badge jika tidak di halaman chat
              // Gunakan REF agar mendapat value terbaru tanpa re-render listener
              if (currentViewRef.current !== 'chat') {
                setUnreadCount(prev => prev + 1);
              }
            }
          }
        });
      }
      isFirstLoadRef.current = false;
    });
    
    return () => unsubscribe();
  }, [relationship.id, user.uid]);

  // Auto scroll
  useEffect(() => {
    if (currentView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentView, editingMessageId]);

  // Partners Fetcher
  useEffect(() => {
    const fetchPartners = async () => {
      if (relationship.partnerIds && relationship.partnerIds.length > 0) {
        try {
          const q = query(collection(db, "users"), where("uid", "in", relationship.partnerIds));
          const querySnapshot = await getDocs(q);
          const fetchedPartners = querySnapshot.docs.map(doc => doc.data() as UserProfile);
          setPartners(fetchedPartners);
        } catch (err) {
          console.error("Gagal mengambil data partner", err);
        }
      }
    };
    fetchPartners();
  }, [relationship.partnerIds]);

  // --- FORMATTER ---
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  // --- REORDER HANDLERS ---
  const handleMoveItem = async (item: WishlistItem, direction: 'up' | 'down') => {
    const currentList = items.filter(i => i.category === activeTab && !i.completed);
    const currentIndex = currentList.findIndex(i => i.id === item.id);
    
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const targetItem = currentList[targetIndex];

    try {
      const batch = writeBatch(db);
      const itemRef = doc(db, "relationships", relationship.id, "items", item.id);
      const targetRef = doc(db, "relationships", relationship.id, "items", targetItem.id);
      batch.update(itemRef, { order: targetIndex });
      batch.update(targetRef, { order: currentIndex });
      await batch.commit();
    } catch (error) {
      console.error("Gagal memindahkan item", error);
    }
  };

  // --- CHAT ACTIONS ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    try {
      const messagesRef = collection(db, "relationships", relationship.id, "messages");
      await addDoc(messagesRef, {
        text: newMessageText,
        senderId: user.uid,
        createdAt: Date.now()
      });
      setNewMessageText('');
    } catch (error: any) {
      console.error("Gagal mengirim pesan", error);
      alert(`Gagal mengirim: ${error.message}. Coba refresh.`);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if(confirm("Hapus pesan ini?")) {
      try {
        await deleteDoc(doc(db, "relationships", relationship.id, "messages", msgId));
        setSelectedMessageId(null);
      } catch (error) {
        console.error("Gagal hapus pesan", error);
      }
    }
  };

  const handleStartEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditMessageText(msg.text);
    setSelectedMessageId(null); 
  };

  const handleSaveEditMessage = async () => {
    if (!editingMessageId || !editMessageText.trim()) return;
    try {
      await updateDoc(doc(db, "relationships", relationship.id, "messages", editingMessageId), {
        text: editMessageText
      });
      setEditingMessageId(null);
      setEditMessageText('');
    } catch (error) {
      console.error("Gagal edit pesan", error);
    }
  };

  // --- DASHBOARD ACTIONS (WISHLIST) ---

  const handleLoveNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLoveNote(val);
    
    if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
    noteTimeoutRef.current = setTimeout(async () => {
      const relRef = doc(db, "relationships", relationship.id);
      await updateDoc(relRef, { 
        loveNote: val,
        loveNoteUpdater: user.displayName || 'Guest'
      });
    }, 1500);
  };

  const handleUpdateDate = async () => {
    if (!newStartDate) return;
    try {
      const relRef = doc(db, "relationships", relationship.id);
      await updateDoc(relRef, { startDate: newStartDate });
      setShowDateModal(false);
    } catch (e) {
      alert("Gagal mengupdate tanggal.");
    }
  };

  // Open Modal for Create
  const openAddModal = () => {
    setEditingItemId(null);
    setNewItemTitle('');
    setNewItemLink('');
    setNewItemNote('');
    setNewItemTarget('');
    setNewItemPrice('');
    setNewItemPriority('medium');
    setNewItemBudget('medium');
    setShowAddModal(true);
  };

  // Open Modal for Edit
  const openEditModal = (item: WishlistItem) => {
    setEditingItemId(item.id);
    setNewItemTitle(item.title);
    setNewItemLink(item.link || '');
    setNewItemNote(item.note || '');
    setNewItemTarget(item.targetDate || '');
    setNewItemPrice(item.priceEstimate ? item.priceEstimate.toString() : '');
    setNewItemPriority(item.priority);
    setNewItemBudget(item.budget);
    setShowAddModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    try {
      const itemsRef = collection(db, "relationships", relationship.id, "items");
      const price = newItemPrice ? parseInt(newItemPrice.replace(/\D/g, '')) : 0;
      
      const itemData = {
        category: activeTab,
        title: newItemTitle,
        link: newItemLink,
        note: newItemNote,
        targetDate: newItemTarget,
        priority: newItemPriority,
        budget: newItemBudget,
        priceEstimate: price,
      };

      if (editingItemId) {
        // UPDATE MODE
        const itemDoc = doc(db, "relationships", relationship.id, "items", editingItemId);
        await updateDoc(itemDoc, itemData);
      } else {
        // CREATE MODE
        const currentLen = items.filter(i => i.category === activeTab).length;
        await addDoc(itemsRef, {
          ...itemData,
          completed: false,
          createdBy: user.uid,
          createdAt: Date.now(),
          order: currentLen
        });
      }

      setShowAddModal(false);
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

  // --- SAVINGS ACTIONS ---

  const handleCreateSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingTitle.trim()) return;
    try {
      const savingsRef = collection(db, "relationships", relationship.id, "savings");
      await addDoc(savingsRef, {
        title: savingTitle,
        targetAmount: parseInt(savingTarget.replace(/\D/g, '')) || 0,
        currentAmount: 0,
        color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
        lastUpdated: Date.now()
      });
      setSavingTitle(''); setSavingTarget(''); setShowSavingModal(false);
    } catch (err) { alert("Gagal membuat tabungan."); }
  };

  const handleDeleteSaving = async (id: string) => {
    if (confirm("Hapus target tabungan ini? Uang tidak akan hilang, tapi data terhapus.")) {
      await deleteDoc(doc(db, "relationships", relationship.id, "savings", id));
    }
  };

  const handleUpdateSavingAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpGoalId || !topUpAmount) return;
    
    const amount = parseInt(topUpAmount.replace(/\D/g, '')) || 0;
    const finalAmount = topUpMode === 'add' ? amount : -amount;

    try {
      const savingRef = doc(db, "relationships", relationship.id, "savings", topUpGoalId);
      await updateDoc(savingRef, {
        currentAmount: increment(finalAmount),
        lastUpdated: Date.now()
      });
      setTopUpGoalId(null); setTopUpAmount('');
    } catch (err) { alert("Gagal update saldo."); }
  };

  // --- AI ACTIONS ---

  const handleAiRoulette = async () => {
    setAiMode('roulette');
    setShowAIModal(true);
    setAiLoading(true);
    setAiResult('');
    try {
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
      <div className="relative overflow-hidden bg-gradient-to-br from-[#8E6E6E] to-[#6d5454] rounded-[32px] p-6 text-white shadow-xl shadow-[#8E6E6E]/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex flex-col items-center justify-center py-4">
          <p className="text-white/70 text-sm font-medium tracking-widest uppercase mb-2">Together For</p>
          <div className="text-6xl font-handwriting mb-2">{daysTogether}</div>
          <p className="text-sm font-medium bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">Days of Love</p>
        </div>
      </div>

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
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {Object.values(TabType).filter(t => t !== TabType.SAVINGS).map(t => (
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

      <button onClick={handleAiIdea} className="w-full mb-6 bg-[#FDFBF7] border border-[#EBE0D0] border-dashed text-[#B09B7A] p-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#F9F4EB] transition-colors">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Minta Ide {activeTab} ke AI</span>
      </button>

      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <List className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm">Belum ada item di kategori ini.</p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <div 
              key={item.id} 
              className={`bg-white rounded-[24px] p-4 border border-gray-100 shadow-sm transition-all group relative ${item.completed ? 'opacity-60 grayscale' : 'hover:shadow-md'}`}
            >
               <div className={`flex justify-between items-start mb-3 ${!item.completed ? 'pl-8' : ''}`}>
                 
                 {/* Reorder Buttons (Mobile Friendly) */}
                 {!item.completed && (
                   <div className="absolute left-2 top-4 flex flex-col gap-1">
                      <button 
                        onClick={() => handleMoveItem(item, 'up')}
                        disabled={index === 0}
                        className="p-1 bg-gray-50 rounded-full text-gray-400 hover:text-[#8E6E6E] disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleMoveItem(item, 'down')}
                        disabled={index === filteredItems.filter(i => !i.completed).length - 1}
                        className="p-1 bg-gray-50 rounded-full text-gray-400 hover:text-[#8E6E6E] disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                   </div>
                 )}

                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {item.priority === 'high' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">PENTING</span>}
                      {item.budget && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">{BUDGET_LABELS[item.budget]}</span>}
                      {item.priceEstimate && item.priceEstimate > 0 && (
                        <span className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-100">
                          {formatRupiah(item.priceEstimate)}
                        </span>
                      )}
                   </div>
                   <h3 className={`font-bold text-gray-800 text-lg ${item.completed ? 'line-through' : ''}`}>{item.title}</h3>
                 </div>
                 <button onClick={() => toggleComplete(item)} className={`p-2 rounded-full shrink-0 ${item.completed ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-300 hover:bg-gray-100'}`}>
                   <CheckCircle className="w-5 h-5" />
                 </button>
               </div>
               {item.note && <p className={`text-gray-500 text-sm mb-3 bg-[#FDFBF7] p-3 rounded-xl ${!item.completed ? 'ml-8' : ''}`}>{item.note}</p>}
               <div className={`flex items-center justify-between pt-3 border-t border-gray-50 ${!item.completed ? 'ml-8' : ''}`}>
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
                 <div className="flex gap-2">
                   <button onClick={() => openEditModal(item)} className="text-gray-300 hover:text-blue-400 transition-colors">
                     <Edit2 className="w-4 h-4" />
                   </button>
                   <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               </div>
            </div>
          ))
        )}
      </div>
      
      <button onClick={openAddModal} className="fixed bottom-24 right-6 w-14 h-14 bg-[#8E6E6E] text-white rounded-full shadow-xl shadow-[#8E6E6E]/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20">
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );

  const renderSavings = () => (
    <div className="pb-24 pt-6 px-4 animate-in fade-in duration-500">
      <div className="bg-[#B09B7A] rounded-[32px] p-6 text-white mb-6 shadow-xl shadow-[#B09B7A]/20">
        <h2 className="text-xl font-bold font-handwriting mb-1">Total Tabungan</h2>
        <div className="text-3xl font-bold">
          {formatRupiah(savings.reduce((acc, curr) => acc + curr.currentAmount, 0))}
        </div>
        <p className="text-white/70 text-sm mt-2">Semangat nabung buat masa depan! 💪</p>
      </div>

      <div className="space-y-4">
        {savings.map((goal) => {
          const percentage = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          
          return (
            <div key={goal.id} className={`bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm relative overflow-hidden`}>
              <div className={`absolute top-0 right-0 w-20 h-20 ${goal.color} rounded-bl-full opacity-20 -mr-4 -mt-4`}></div>
              
              <div className="flex justify-between items-start mb-2 relative z-10">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{goal.title}</h3>
                  <p className="text-xs text-gray-400">Target: {formatRupiah(goal.targetAmount)}</p>
                </div>
                <button onClick={() => handleDeleteSaving(goal.id)} className="text-gray-300 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
              </div>

              <div className="mb-4 relative z-10">
                <div className="flex justify-between items-end mb-1">
                   <span className="text-2xl font-bold text-[#8E6E6E]">{formatRupiah(goal.currentAmount)}</span>
                   <span className="text-xs font-bold text-[#8E6E6E]">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-[#8E6E6E] rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>

              <div className="flex gap-2 relative z-10">
                <button 
                  onClick={() => { setTopUpGoalId(goal.id); setTopUpMode('add'); }}
                  className="flex-1 bg-[#FDFBF7] border border-[#EBE0D0] py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center justify-center gap-1"
                >
                  <TrendingUp className="w-3 h-3" /> Nabung
                </button>
                <button 
                   onClick={() => { setTopUpGoalId(goal.id); setTopUpMode('withdraw'); }}
                   className="flex-1 bg-[#FDFBF7] border border-[#EBE0D0] py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
                >
                  <Minus className="w-3 h-3" /> Tarik
                </button>
              </div>
            </div>
          );
        })}

        <button onClick={() => setShowSavingModal(true)} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-[24px] text-gray-400 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
           <Plus className="w-5 h-5" /> Buat Target Baru
        </button>
      </div>

      {/* MODAL UPDATE SALDO */}
      {topUpGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-xs rounded-[32px] p-6 animate-in zoom-in-95">
              <h3 className="font-bold text-lg mb-4 text-center">
                {topUpMode === 'add' ? 'Tambah Tabungan' : 'Tarik Saldo'}
              </h3>
              <form onSubmit={handleUpdateSavingAmount}>
                <input 
                  autoFocus
                  type="number"
                  placeholder="0"
                  className="w-full bg-[#FDFBF7] p-4 rounded-xl border border-gray-100 mb-4 text-center text-xl font-bold outline-none focus:ring-1 focus:ring-[#B09B7A]"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
                <button className={`w-full text-white py-3 rounded-xl font-bold shadow-lg mb-2 ${topUpMode === 'add' ? 'bg-green-500 shadow-green-500/30' : 'bg-red-500 shadow-red-500/30'}`}>
                  {topUpMode === 'add' ? 'Masukin Celengan' : 'Ambil Uang'}
                </button>
                <button type="button" onClick={() => { setTopUpGoalId(null); setTopUpAmount(''); }} className="w-full text-sm text-gray-400 py-2">Batal</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );

  const renderChat = () => (
    <div className="h-[calc(100vh-80px)] flex flex-col pt-4 bg-[#FDFBF7] animate-in fade-in duration-300">
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
             <MessageCircle className="w-12 h-12 mb-2 opacity-30" />
             <p className="text-sm">Belum ada obrolan. Sapa pasanganmu!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user.uid;
            const sender = partners.find(p => p.uid === msg.senderId);
            const showAvatar = !isMe && (idx === 0 || messages[idx-1].senderId !== msg.senderId);
            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {!isMe && (
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gray-200">
                     {showAvatar ? (
                       sender?.photoURL ? <img src={sender.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">{sender?.displayName?.charAt(0) || '?'}</div>
                     ) : <div className="w-8 h-8" />}
                  </div>
                )}
                
                <div className="flex flex-col items-end">
                   <div 
                     onClick={() => isMe && !isEditing && setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id)}
                     className={`max-w-[280px] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm relative transition-all cursor-pointer ${
                      isMe 
                        ? 'bg-[#8E6E6E] text-white rounded-br-none hover:bg-[#7d5f5f]' 
                        : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'
                    }`}
                   >
                     {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <input 
                            autoFocus
                            className="bg-white/20 text-white p-1 rounded w-full outline-none" 
                            value={editMessageText} 
                            onChange={e => setEditMessageText(e.target.value)}
                          />
                          <button onClick={handleSaveEditMessage} className="bg-white text-[#8E6E6E] p-1 rounded-full"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditingMessageId(null)} className="text-white/70 p-1"><X className="w-3 h-3" /></button>
                        </div>
                     ) : (
                        <>
                          {msg.text}
                          <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-gray-300'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </>
                     )}
                   </div>

                   {/* Options Menu for Own Messages */}
                   {isMe && selectedMessageId === msg.id && !isEditing && (
                     <div className="flex gap-2 mt-1 bg-white p-1.5 rounded-lg shadow-md border border-gray-100 animate-in slide-in-from-top-1">
                        <button onClick={() => handleStartEditMessage(msg)} className="p-1.5 hover:bg-gray-100 rounded text-blue-500" title="Edit">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-500" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                     </div>
                   )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* FIXED: Added 'relative z-40' to bring input above navbar */}
      <div className="p-4 bg-white border-t border-gray-100 pb-24 relative z-40">
         <form onSubmit={handleSendMessage} className="flex gap-2">
           <input 
             className="flex-1 bg-gray-50 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#8E6E6E] border border-gray-100"
             placeholder="Ketik pesan sayang..."
             value={newMessageText}
             onChange={e => setNewMessageText(e.target.value)}
           />
           <button 
             type="submit" 
             disabled={!newMessageText.trim()}
             className="w-12 h-12 bg-[#8E6E6E] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#8E6E6E]/30 disabled:opacity-50 hover:scale-105 transition-transform"
           >
             <Send className="w-5 h-5 ml-0.5" />
           </button>
         </form>
      </div>
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

      <div className="space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-50 rounded-xl"><Users className="w-5 h-5 text-orange-500" /></div>
            <span className="text-sm font-medium text-gray-700">Partners in Crime</span>
          </div>
          <div className="flex gap-4">
            {partners.map(p => (
              <div key={p.uid} className="flex flex-col items-center gap-2">
                 <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-100">
                    {p.photoURL ? (
                      <img src={p.photoURL} alt={p.displayName || ''} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="w-full h-full bg-[#EBE0D0] flex items-center justify-center text-white text-xs">
                        {p.displayName?.charAt(0) || 'G'}
                      </div>
                    )}
                 </div>
                 <span className="text-[10px] text-gray-500 font-medium max-w-[60px] truncate text-center">{p.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => setShowDateModal(true)} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 hover:bg-gray-50 transition-colors group">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-50 rounded-xl"><Calendar className="w-5 h-5 text-blue-500" /></div>
             <span className="text-sm font-medium text-gray-700">Tanggal Jadian</span>
           </div>
           <div className="flex items-center gap-2">
             <span className="text-sm text-gray-500 group-hover:text-gray-800 transition-colors">{relationship.startDate}</span>
             <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-blue-400" />
           </div>
        </button>

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
      <header className="px-6 pt-8 pb-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-[#8E6E6E] font-handwriting text-2xl">Our Journey</h1>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-400"></div>
             <span className="text-[10px] font-medium text-gray-400">SYNCED</span>
          </div>
        </div>
      </header>

      {currentView === 'home' && renderHome()}
      {currentView === 'wishlist' && renderWishlist()}
      {currentView === 'savings' && renderSavings()}
      {currentView === 'chat' && renderChat()}
      {currentView === 'profile' && renderProfile()}

      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-30 pb-6">
        <button onClick={() => setCurrentView('home')} className={`p-3 rounded-2xl transition-all ${currentView === 'home' ? 'bg-[#8E6E6E] text-white shadow-lg shadow-[#8E6E6E]/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <Home className="w-6 h-6" />
        </button>
        <button onClick={() => { setCurrentView('wishlist'); setActiveTab(TabType.PLACES); }} className={`p-3 rounded-2xl transition-all ${currentView === 'wishlist' ? 'bg-[#B09B7A] text-white shadow-lg shadow-[#B09B7A]/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <List className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView('savings')} className={`p-3 rounded-2xl transition-all ${currentView === 'savings' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <Wallet className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView('chat')} className={`p-3 rounded-2xl transition-all relative ${currentView === 'chat' ? 'bg-pink-400 text-white shadow-lg shadow-pink-400/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button onClick={() => setCurrentView('profile')} className={`p-3 rounded-2xl transition-all ${currentView === 'profile' ? 'bg-gray-800 text-white shadow-lg shadow-gray-800/20' : 'text-gray-300 hover:text-gray-500'}`}>
          <User className="w-6 h-6" />
        </button>
      </nav>

      {/* MODAL ADD/EDIT WISHLIST */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-gray-800">{editingItemId ? 'Edit Item' : `Tambah ${activeTab}`}</h3>
               <button onClick={() => setShowAddModal(false)} className="bg-gray-50 p-2 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
             </div>
             <form onSubmit={handleSaveItem} className="space-y-4">
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
               
               {/* NEW: Price Estimate Field */}
               <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-sm">Rp</span>
                  <input 
                    type="number"
                    placeholder="Estimasi Biaya (Nominal)" 
                    className="w-full bg-[#FDFBF7] p-3 pl-10 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#B09B7A]" 
                    value={newItemPrice} 
                    onChange={e => setNewItemPrice(e.target.value)} 
                  />
               </div>

               <div className="flex gap-2">
                 <input type="date" className="flex-1 bg-[#FDFBF7] p-3 rounded-xl border border-gray-100 text-sm text-gray-500" value={newItemTarget} onChange={e => setNewItemTarget(e.target.value)} />
                 <input placeholder="Link..." className="flex-1 bg-[#FDFBF7] p-3 rounded-xl border border-gray-100 text-sm" value={newItemLink} onChange={e => setNewItemLink(e.target.value)} />
               </div>

               <textarea placeholder="Catatan kecil..." rows={2} className="w-full bg-[#FDFBF7] p-4 rounded-xl border border-gray-100 focus:outline-none resize-none text-sm" value={newItemNote} onChange={e => setNewItemNote(e.target.value)} />

               <button disabled={!newItemTitle.trim()} className="w-full bg-[#8E6E6E] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#8E6E6E]/30 disabled:opacity-50">
                 {editingItemId ? 'Update Perubahan' : 'Simpan'}
               </button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL ADD SAVING GOAL */}
      {showSavingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-lg text-gray-800">Target Nabung Baru</h3>
               <button onClick={() => setShowSavingModal(false)} className="bg-gray-50 p-2 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
             </div>
             <form onSubmit={handleCreateSaving} className="space-y-4">
               <input autoFocus placeholder="Nama Tabungan (cth: Dana Nikah)" className="w-full bg-[#FDFBF7] p-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-1 focus:ring-[#B09B7A]" value={savingTitle} onChange={e => setSavingTitle(e.target.value)} />
               <div className="relative">
                  <span className="absolute left-4 top-4 text-gray-400 font-bold">Rp</span>
                  <input type="number" placeholder="Target Nominal" className="w-full bg-[#FDFBF7] p-4 pl-12 rounded-xl border border-gray-100 focus:outline-none focus:ring-1 focus:ring-[#B09B7A]" value={savingTarget} onChange={e => setSavingTarget(e.target.value)} />
               </div>
               <button disabled={!savingTitle.trim()} className="w-full bg-[#8E6E6E] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#8E6E6E]/30 disabled:opacity-50">Mulai Nabung</button>
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

      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 text-center animate-in zoom-in-95">
            <h3 className="font-bold text-lg mb-4 text-gray-800">Ubah Tanggal Jadian</h3>
            <input 
              type="date" 
              className="w-full bg-[#FDFBF7] p-4 rounded-xl border border-gray-100 mb-6 text-center font-bold text-gray-700"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
            />
            <button 
              onClick={handleUpdateDate}
              className="w-full bg-[#8E6E6E] text-white py-3 rounded-xl font-bold shadow-lg shadow-[#8E6E6E]/30 mb-2"
            >
              Simpan Tanggal
            </button>
            <button onClick={() => setShowDateModal(false)} className="text-sm text-gray-400 font-medium p-2">Batal</button>
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