import { useState } from 'react';
import { useAuth, saveOffer, clearOffer, addCatalogItem, deleteCatalogItem, useOffers, useCatalogs } from '../services/firebase';
import { Trash2, Plus, Sparkles, Tag } from 'lucide-react';
import { motion } from 'motion/react';

const ADMIN_EMAIL = 'alwashameen96@gmail.com';

const SERVICES_LIST = [
  { id: 'hair-color', title: 'Hair Color' },
  { id: 'makeup-transfer', title: 'Makeup Transfer' },
  { id: 'nail-art', title: 'Nail Art' },
  { id: 'fillers-botox', title: 'Fillers & Botox' },
  { id: 'bride-journey', title: 'The Bridal Journey' }
];

export default function AdminPanel() {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="p-12 text-center">Authenticating...</div>;
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
       <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
          <h2 className="font-serif italic text-3xl text-[color:var(--color-luxury-rosegold)] mb-4">Access Restricted</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">Only the Master Administrator can access this terminal.</p>
       </div>
    );
  }

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
       <div className="mb-12">
          <span className="text-[9px] uppercase tracking-[0.3em] opacity-40 block mb-2 text-[color:var(--color-luxury-accent)]">Control Center</span>
          <h2 className="font-serif text-3xl font-bold italic tracking-tight text-white mb-2">Salon Administration</h2>
          <p className="text-[10px] uppercase tracking-widest opacity-30">Manage global offers and live aesthetic catalogs.</p>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Promotional Offers Manager */}
          <OffersManager />

          {/* Catalog Manager */}
          <CatalogManager />
       </div>
    </div>
  );
}

function OffersManager() {
  const offers = useOffers();
  
  const handleUpdateOffer = async (serviceId: string, value: string) => {
    if (value.trim() === '') {
      await clearOffer(serviceId);
    } else {
      await saveOffer(serviceId, value);
    }
  };

  return (
    <div className="border border-white/5 bg-white/[0.02] p-8 rounded-xl backdrop-blur-md">
       <h3 className="flex items-center gap-2 text-xl font-serif italic mb-6"><Tag size={18} className="text-[color:var(--color-luxury-accent)]" /> Global Offers</h3>
       <div className="flex flex-col gap-6">
          {SERVICES_LIST.map(service => (
             <div key={service.id} className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest opacity-60 text-[color:var(--color-luxury-accent)]">{service.title}</span>
                <input 
                   type="text" 
                   defaultValue={offers[service.id] || ''}
                   onBlur={(e) => handleUpdateOffer(service.id, e.target.value)}
                   placeholder="e.g. 20% OFF TODAY (Leave blank to remove)"
                   className="w-full bg-black/40 border border-white/10 p-3 text-[11px] text-white focus:outline-none focus:border-[color:var(--color-luxury-accent)]/50 rounded-sm"
                />
             </div>
          ))}
       </div>
    </div>
  );
}

function CatalogManager() {
  const [selectedService, setSelectedService] = useState<string>(SERVICES_LIST[0].id);
  const catalogs = useCatalogs(selectedService);
  const [newTitle, setNewTitle] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
     if (!newTitle.trim() || !newImgUrl.trim()) return;
     setAdding(true);
     try {
       await addCatalogItem(selectedService, newTitle, newImgUrl);
       setNewTitle('');
       setNewImgUrl('');
     } catch(e) {
       console.error("Error adding catalog item", e);
       alert("Failed to add catalog item");
     } finally {
       setAdding(false);
     }
  };

  return (
    <div className="border border-white/5 bg-white/[0.02] p-8 rounded-xl backdrop-blur-md">
       <h3 className="flex items-center gap-2 text-xl font-serif italic mb-6"><Sparkles size={18} className="text-[color:var(--color-luxury-accent)]" /> Interactive Catalogs</h3>
       
       <select 
          value={selectedService} 
          onChange={(e) => setSelectedService(e.target.value)}
          className="w-full mb-8 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)]/20 p-3 text-[11px] text-[color:var(--theme-text)] focus:outline-none focus:border-[color:var(--color-luxury-accent)]/50 rounded-sm cursor-pointer"
       >
          {SERVICES_LIST.map(service => (
             <option key={service.id} value={service.id}>{service.title} Catalog</option>
          ))}
       </select>

       <div className="flex flex-col gap-3 mb-8 p-4 border border-white/5 bg-black/20 rounded-md">
          <span className="text-[9px] uppercase tracking-[0.2em] opacity-40 mb-2 block">Add New Style</span>
          <input 
             type="text" 
             value={newTitle}
             onChange={e => setNewTitle(e.target.value)}
             placeholder="Style Name (e.g. Platinum Blonde)"
             className="w-full bg-black/40 border border-white/10 p-3 text-[11px] text-white rounded-sm"
          />
          <input 
             type="url" 
             value={newImgUrl}
             onChange={e => setNewImgUrl(e.target.value)}
             placeholder="Image Web URL (e.g. https://images.unsplash.com/...)"
             className="w-full bg-black/40 border border-white/10 p-3 text-[11px] text-white rounded-sm"
          />
          <button onClick={handleAdd} disabled={adding || !newTitle || !newImgUrl} className="lux-button-outline py-3 mt-2 flex items-center justify-center gap-2 text-[10px]">
             <Plus size={14} /> Add Pattern to Catalog
          </button>
       </div>

       <div className="grid grid-cols-2 gap-4">
          {catalogs.length === 0 && <span className="col-span-2 text-center text-[10px] uppercase opacity-30 mt-4">No custom patterns active</span>}
          {catalogs.map(cat => (
             <motion.div initial={{opacity: 0}} animate={{opacity: 1}} key={cat.id} className="relative group rounded-sm overflow-hidden border border-white/10 aspect-[3/4]">
                <img src={cat.imageUrl} alt={cat.title} className="w-full h-full object-cover opacity-80 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent p-3 flex flex-col justify-end">
                   <p className="font-serif text-[12px]">{cat.title}</p>
                </div>
                <button 
                  onClick={() => deleteCatalogItem(cat.id)}
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                   <Trash2 size={12} />
                </button>
             </motion.div>
          ))}
       </div>
    </div>
  );
}
