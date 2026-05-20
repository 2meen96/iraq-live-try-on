import { AnimatePresence, motion } from 'motion/react';
import { Camera, Sun, User, UploadCloud, X } from 'lucide-react';

interface GuidelinesModalProps {
  onAcknowledge: () => void;
  onCancel: () => void;
}

export default function GuidelinesModal({ onAcknowledge, onCancel }: GuidelinesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
         initial={{ opacity: 0 }} 
         animate={{ opacity: 1 }} 
         exit={{ opacity: 0 }} 
         className="absolute inset-0 bg-black/60 backdrop-blur-md"
         onClick={onCancel}
      />
      
      <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 10 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 10 }}
         className="w-full max-w-lg bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] rounded-2xl overflow-hidden shadow-2xl relative z-10"
      >
         <button onClick={onCancel} className="absolute top-4 right-4 text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)] transition-colors z-20">
            <X size={20} />
         </button>

         <div className="p-8">
            <h3 className="font-serif italic text-3xl mb-2 text-[color:var(--theme-text)]">Photography Guidelines</h3>
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)] mb-8">إرشادات التصوير لضمان أفضل نتيجة</p>
            
            <div className="flex flex-col gap-6 mb-10">
               <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[color:var(--color-luxury-accent)]/10 text-[color:var(--color-luxury-accent)] flex items-center justify-center shrink-0">
                     <Sun size={20} />
                  </div>
                  <div>
                     <h4 className="text-[12px] font-semibold text-[color:var(--theme-text)] mb-1">Good Lighting / إضاءة جيدة</h4>
                     <p className="text-[11px] text-[color:var(--theme-text-muted)]">Ensure the face is well-lit and clearly visible without harsh shadows. تأكد من إضاءة الوجه بشكل جيد بدون ظلال قوية.</p>
                  </div>
               </div>

               <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[color:var(--color-luxury-accent)]/10 text-[color:var(--color-luxury-accent)] flex items-center justify-center shrink-0">
                     <Camera size={20} />
                  </div>
                  <div>
                     <h4 className="text-[12px] font-semibold text-[color:var(--theme-text)] mb-1">Front-Facing / الوجه مقابل الكاميرا</h4>
                     <p className="text-[11px] text-[color:var(--theme-text-muted)]">Look straight into the camera. Avoid side profiles. انظر مباشرة إلى الكاميرا. تجنب الصور الجانبية.</p>
                  </div>
               </div>

               <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[color:var(--color-luxury-accent)]/10 text-[color:var(--color-luxury-accent)] flex items-center justify-center shrink-0">
                     <User size={20} />
                  </div>
                  <div>
                     <h4 className="text-[12px] font-semibold text-[color:var(--theme-text)] mb-1">Clear Face / وجه خالي من العوائق</h4>
                     <p className="text-[11px] text-[color:var(--theme-text-muted)]">No glasses, no hair covering the face or forehead. بدون نظارات، وبدون خصلات شعر تغطي الوجه أو الجبهة.</p>
                  </div>
               </div>
            </div>

            <button 
               onClick={onAcknowledge}
               className="w-full lux-button-solid py-4 flex items-center justify-center gap-2 text-[11px]"
            >
               <UploadCloud size={16} /> I Understand, Let's Upload / فهمت، لنقم برفع الصورة
            </button>
         </div>
      </motion.div>
    </div>
  );
}
