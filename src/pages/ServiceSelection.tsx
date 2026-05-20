import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useOffers } from '../services/firebase';

const SERVICES = [
  { id: 'hair-color', title: 'Hair Color', img: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80', desc: 'Transform your shade instantly.' },
  { id: 'makeup-transfer', title: 'Makeup Transfer', img: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800&q=80', desc: 'Try high-end looks seamlessly.' },
  { id: 'nail-art', title: 'Nail Art', img: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80', desc: 'Virtual manicure perfection.' },
  { id: 'lenses', title: 'Eye Lenses', img: 'https://images.unsplash.com/photo-1588691512409-ecfcba2e86bb?auto=format&fit=crop&w=800&q=80', desc: 'Experiment with eye colors.' },
  { id: 'fillers-botox', title: 'Fillers & Botox', img: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80', desc: 'Preview your enhancements.' },
];

export default function ServiceSelection() {
  const dynamicOffers = useOffers();

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 md:py-24">
      <div className="mb-16 text-center">
         <span className="text-[9px] text-[color:var(--theme-text-muted)] uppercase tracking-[0.3em] block mb-4">Service Category</span>
         <h2 className="font-serif text-4xl md:text-5xl italic font-bold">Select Your <span className="text-[color:var(--color-luxury-accent)]">Service</span></h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8">
        {SERVICES.map((service, idx) => {
          const activeOffer = dynamicOffers[service.id];
          const bypassCatalog = ['hair-color', 'makeup-transfer', 'nail-art', 'lenses'].includes(service.id);
          const serviceLink = service.id === 'fillers-botox' ? '/medical-aesthetics' : bypassCatalog ? '/try-on' : `/services/${service.id}`;
          const stateData = bypassCatalog ? { serviceId: service.id } : undefined;
          
          return (
          <Link to={serviceLink} state={stateData} key={service.id}>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.6 }}
              className="group relative cursor-pointer block overflow-hidden rounded-sm border border-[color:var(--color-luxury-accent)]/10"
            >
              <div className="aspect-square w-full overflow-hidden relative">
                {activeOffer && (
                   <div className="absolute top-6 left-6 z-30 flex items-center gap-2 bg-[color:var(--color-luxury-accent)]/90 backdrop-blur-md px-3 py-1.5 rounded-sm border border-[color:var(--color-luxury-accent)] shadow-lg animate-pulse">
                      <Sparkles size={12} className="text-black" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-black">{activeOffer}</span>
                   </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 group-hover:via-black/20 to-transparent transition-colors duration-500 z-10" />
                <motion.img 
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.8 }}
                  src={service.img} 
                  alt={service.title} 
                  className="w-full h-full object-cover transition-all duration-700" 
                  referrerPolicy="no-referrer"
                />
                
                <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                  <h3 className="font-serif text-3xl mb-2 text-[#FDFCFB] group-hover:text-[color:var(--color-luxury-accent)] transition-colors italic tracking-tight drop-shadow-md">{service.title}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#FDFCFB]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 pb-2 drop-shadow-md">
                    {service.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          </Link>
        )})}
      </div>

      {/* The Bridal Journey Epic Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="mt-16 w-full"
      >
        <Link to="/bride">
           <div className="relative overflow-hidden group cursor-pointer border border-[color:var(--color-luxury-rosegold)]/60 rounded-sm aspect-[21/9] md:aspect-[32/9]">
              
              {dynamicOffers['bride-journey'] && (
                <div className="absolute top-6 right-6 z-30 flex items-center gap-2 bg-[color:var(--color-luxury-rosegold)]/90 backdrop-blur-md px-4 py-2 rounded-sm border border-[color:var(--color-luxury-rosegold)] shadow-[0_0_20px_rgba(240,200,200,0.3)]">
                   <Sparkles size={14} className="text-black" />
                   <span className="text-[9px] font-bold uppercase tracking-widest text-black">{dynamicOffers['bride-journey']}</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 group-hover:via-black/20 to-transparent transition-colors duration-700 z-10" />
              <img 
                src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=80" 
                alt="The Bridal Journey" 
                className="absolute inset-0 w-full h-full object-cover object-[50%_30%] opacity-60 group-hover:scale-105 group-hover:opacity-100 transition-all duration-1000" 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center p-6">
                 <span className="text-[9px] uppercase tracking-[0.4em] opacity-80 mb-4 text-[color:var(--color-luxury-rosegold)] drop-shadow-lg">Comprehensive Package</span>
                 <h2 className="font-serif text-3xl md:text-5xl italic font-bold mb-4 tracking-tight drop-shadow-xl text-[#FDFCFB]">The Bridal <span className="text-[color:var(--color-luxury-rosegold)]">Journey</span></h2>
                 <p className="text-[10px] md:text-xs uppercase tracking-widest text-[#FDFCFB]/90 max-w-lg mb-8 drop-shadow-md">A curated 3-step AI simulation. Preview your ideal hair, makeup, and aesthetic enhancements before the big day.</p>
                 <span className="text-[10px] uppercase tracking-widest border border-[color:var(--color-luxury-rosegold)]/60 text-[color:var(--color-luxury-rosegold)] px-6 py-3 bg-black/60 backdrop-blur-md group-hover:bg-[color:var(--color-luxury-rosegold)] group-hover:text-black transition-all duration-300 rounded-sm shadow-xl font-medium tracking-[0.2em]">Start Consultation</span>
              </div>
           </div>
        </Link>
      </motion.div>
      {/* Auto Makeover Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="mt-8 w-full"
      >
        <Link to="/auto-makeover">
           <div className="relative overflow-hidden group cursor-pointer border border-[color:var(--color-luxury-accent)]/40 rounded-sm aspect-[21/9] md:aspect-[32/9]">
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 group-hover:via-black/20 to-transparent transition-colors duration-700 z-10" />
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1600&q=80" 
                alt="AI Auto Makeover" 
                className="absolute inset-0 w-full h-full object-cover object-[50%_30%] opacity-60 group-hover:scale-105 group-hover:opacity-100 transition-all duration-1000" 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center p-6 bg-black/20 backdrop-blur-[2px]">
                 <span className="text-[9px] uppercase tracking-[0.4em] opacity-80 mb-4 text-[color:var(--color-luxury-accent)] drop-shadow-lg">One Click Magic</span>
                 <h2 className="font-serif text-3xl md:text-5xl italic font-bold mb-4 tracking-tight drop-shadow-xl text-[#FDFCFB]">AI Auto <span className="text-[color:var(--color-luxury-accent)]">Makeover</span></h2>
                 <p className="text-[10px] md:text-xs uppercase tracking-widest text-[#FDFCFB]/90 max-w-lg mb-8 drop-shadow-md">upload your photo and let AI analyze your features to automatically apply the most flattering makeup, hair color, and styling in one step.</p>
                 <span className="text-[10px] uppercase tracking-widest border border-[color:var(--color-luxury-accent)]/80 text-[color:var(--color-luxury-accent)] px-6 py-3 bg-black/60 backdrop-blur-md group-hover:bg-[color:var(--color-luxury-accent)] group-hover:text-black transition-all duration-300 rounded-sm shadow-xl font-medium tracking-[0.2em]">Try Auto Makeover</span>
              </div>
           </div>
        </Link>
      </motion.div>
    </div>
  );
}
