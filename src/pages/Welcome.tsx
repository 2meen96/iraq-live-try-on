import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Welcome() {
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen">
      {/* Left Pane - Content */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 py-12 relative z-10 bg-[color:var(--color-luxury-bg)]">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          <span className="micro-label mb-6 block text-[color:var(--color-luxury-accent)] tracking-[0.3em]">VIRTUAL CONSULTATION</span>
          <h1 className="font-serif text-5xl md:text-7xl leading-tight mb-8 font-bold italic tracking-tight text-[color:var(--color-luxury-rosegold)]">
            Discover Your<br />
            Perfect Look.
          </h1>
          <p className="text-[color:var(--color-luxury-muted)] text-xs uppercase tracking-widest mb-12 max-w-md opacity-60">
            Experience the future of aesthetics. Premium AI visual simulations for medical treatments and bridal styling.
          </p>
          
          <Link to="/services" className="lux-button-solid px-8 py-4 inline-flex items-center gap-4 group">
            Get Started
            <motion.span 
              className="inline-block"
              transition={{ repeat: Infinity, duration: 1.5 }}
              animate={{ x: [0, 5, 0] }}
            >→</motion.span>
          </Link>
        </motion.div>
        
         <div className="absolute left-8 bottom-24 origin-bottom-left -rotate-90 hidden lg:block">
           <span className="text-[9px] uppercase tracking-[0.3em] opacity-40">AI-POWERED AESTHETICS</span>
        </div>
      </div>

      {/* Right Pane - Visual */}
      <div className="flex-1 relative overflow-hidden hidden md:block">
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--color-luxury-bg)] to-transparent z-10" />
        <motion.img 
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
          src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80" 
          alt="Luxury Aesthetics" 
          className="w-full h-full object-cover opacity-60"
        />
        {/* Inner glow / overlay */}
        <div className="absolute inset-0 bg-[color:var(--color-luxury-bg)] mix-blend-color opacity-50" />
      </div>
    </div>
  );
}
