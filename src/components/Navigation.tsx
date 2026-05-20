import { Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { loginWithGoogle, logout } from '../services/firebase';
import { Menu, User as UserIcon, Sparkles, Moon, Sun, Key } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navigation({ user }: { user: User | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLinkApiKey = async () => {
    alert("To use a custom API key, click the Settings (gear) icon in AI Studio, go to Secrets, and set the USER_GEMINI_API_KEY secret.");
  };

  if (location.pathname === '/') return null; // Hide nav on welcome page

  return (
    <nav className="w-full border-b border-[color:var(--color-luxury-accent)]/20 px-6 lg:px-12 h-20 flex items-center justify-between sticky top-0 z-50 bg-[color:var(--color-luxury-bg)] transition-colors duration-500">
      <Link to="/" className="font-serif tracking-tighter flex items-center gap-4 shrink-0">
         <div className="w-8 h-8 rounded-full border border-[color:var(--color-luxury-accent)] flex items-center justify-center shrink-0">
            <div className="w-1 h-1 bg-[color:var(--color-luxury-accent)] rounded-full"></div>
         </div>
         <span className="italic text-xl lg:text-2xl font-serif text-[color:var(--theme-text)]">AESTHETICA</span>
         <span className="text-[10px] uppercase tracking-[0.4em] opacity-40 ml-2 hidden xl:inline-block text-[color:var(--theme-text)] whitespace-nowrap">Aesthetic Center</span>
      </Link>
      
      <div className="hidden md:flex items-center gap-4 lg:gap-8 shrink-1 w-[max-content]">
        <Link to="/services" className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold hover:text-[color:var(--color-luxury-accent)] transition-colors text-[color:var(--theme-text)]">Services</Link>
        <Link to="/chat" className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold hover:text-[color:var(--color-luxury-accent)] transition-colors text-[color:var(--theme-text)]">Concierge</Link>
        {user?.email === 'alwashameen96@gmail.com' && (
           <Link to="/admin" className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-luxury-accent)] font-semibold border-b border-[color:var(--color-luxury-accent)]/30">Admin Panel</Link>
        )}
        
        {user?.email === 'alwashameen96@gmail.com' && (
          <button 
            onClick={handleLinkApiKey} 
            className="w-8 h-8 rounded-full border border-[color:var(--color-luxury-accent)]/30 flex items-center justify-center text-[color:var(--theme-text)] hover:bg-[color:var(--theme-text)]/5 transition-colors"
            title="Link API Key"
          >
             <Key size={14} />
          </button>
        )}

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme} 
          className="w-8 h-8 rounded-full border border-[color:var(--color-luxury-accent)]/30 flex items-center justify-center text-[color:var(--theme-text)] hover:bg-[color:var(--theme-text)]/5 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
           {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {user ? (
          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
             <span className="micro-label truncate max-w-[80px] lg:max-w-[120px] text-[color:var(--theme-text)]">{user.displayName}</span>
             <button onClick={logout} className="lux-button px-3 lg:px-4 py-2 text-xs whitespace-nowrap">Sign Out</button>
          </div>
        ) : (
          <button onClick={loginWithGoogle} className="lux-button-solid px-4 lg:px-6 py-2 text-xs flex items-center gap-2 whitespace-nowrap shrink-0">
             <UserIcon size={14} /> Sign In
          </button>
        )}
      </div>

      <button className="md:hidden text-[color:var(--theme-text)]" onClick={() => setMenuOpen(!menuOpen)}>
         <Menu />
      </button>

      {menuOpen && (
         <div className="absolute top-full left-0 w-full bg-[color:var(--color-luxury-bg)] border-b border-[color:var(--color-luxury-accent)]/20 px-6 py-4 flex flex-col gap-4 md:hidden transition-colors duration-500">
            <div className="flex justify-center gap-4 mb-2">
               {user?.email === 'alwashameen96@gmail.com' && (
                 <button onClick={handleLinkApiKey} className="lux-button flex gap-2 items-center">
                    <Key size={12}/> API Key
                 </button>
               )}
               <button onClick={toggleTheme} className="lux-button flex gap-2 items-center">
                  {theme === 'dark' ? <><Sun size={12}/> Light Mode</> : <><Moon size={12}/> Dark Mode</>}
               </button>
            </div>
            <Link to="/services" className="micro-label text-center py-2 text-[color:var(--theme-text)]" onClick={() => setMenuOpen(false)}>Services</Link>
            <Link to="/chat" className="micro-label text-center py-2 text-[color:var(--theme-text)]" onClick={() => setMenuOpen(false)}>Concierge</Link>
            {user ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="lux-button w-full">Sign Out</button>
            ) : (
              <button onClick={() => { loginWithGoogle(); setMenuOpen(false); }} className="lux-button-solid w-full">Sign In</button>
            )}
         </div>
      )}
    </nav>
  );
}
