import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { FileUploader } from "./FileUploader";
import { ConversionsList } from "./ConversionsList";
import { ImageToPdfUploader } from "./components/ImageToPdfUploader";
import { PdfMerger } from "./components/PdfMerger";
import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import WordPressPage from "./components/WordPressPage";

// Smooth scroll function
const scrollToElement = (elementId: string, duration: number = 800) => {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) return;
  
  const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime: number | null = null;
  
  const animation = (currentTime: number) => {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    
    // Easing function - easeInOutQuad
    const ease = (t: number) => 
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    
    window.scrollTo(0, startPosition + distance * ease(progress));
    
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  };
  
  requestAnimationFrame(animation);
};

// Lazy load Footer to improve mobile performance
const Footer = lazy(() => import('./components/Footer'));

// Logo component that matches the favicon design
const LogoIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="100%" height="100%" rx="30%" fill="url(#paint0_linear)"/>
    <path d="M346 166H266C262.287 166 259.276 169.011 259.276 172.724V212.276C259.276 215.989 262.287 219 266 219H346C349.713 219 352.724 215.989 352.724 212.276V172.724C352.724 169.011 349.713 166 346 166Z" fill="white"/>
    <path d="M346 239H166C162.287 239 159.276 242.011 159.276 245.724V285.276C159.276 288.989 162.287 292 166 292H346C349.713 292 352.724 288.989 352.724 285.276V245.724C352.724 242.011 349.713 239 346 239Z" fill="white" fillOpacity="0.8"/>
    <path d="M346 312H166C162.287 312 159.276 315.011 159.276 318.724V358.276C159.276 361.989 162.287 365 166 365H346C349.713 365 352.724 361.989 352.724 358.276V318.724C352.724 315.011 349.713 312 346 312Z" fill="white" fillOpacity="0.6"/>
    <defs>
      <linearGradient id="paint0_linear" x1="0" y1="0" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6"/>
        <stop offset="1" stopColor="#6366F1"/>
      </linearGradient>
    </defs>
  </svg>
);

export default function App() {
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [scrolled, setScrolled] = useState(false);

  // Handle selecting a tool with browser history
  const handleSelectTool = useCallback((toolId: string | null) => {
    // If setting to null (going back to tools list), don't need to modify history
    if (toolId === null) {
      setSelectedTool(null);
      return;
    }
    
    // Add this tool selection to history
    window.history.pushState({toolId}, '', '');
    setNavHistory(prev => [...prev, toolId]);
    setSelectedTool(toolId);
    
    // Scroll to top of the page when a tool is selected
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle back to tools button click
  const handleBackToTools = useCallback(() => {
    setSelectedTool(null);
    // Scroll to the tools section when going back to tools
    scrollToElement('tools');
    // We don't need to call history.back() here because we're just
    // changing the UI state without needing to navigate
  }, []);

  useEffect(() => {
    // Handle navigation when hash changes
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the # symbol
      setCurrentPage(hash || null);
    };

    // Set initial page based on hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Handle browser back/forward buttons
    const handlePopState = (event: PopStateEvent) => {
      // If popping back to a tool, restore that tool
      if (event.state && event.state.toolId) {
        setSelectedTool(event.state.toolId);
      } else {
        // If no state or no toolId, return to tool list
        setSelectedTool(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Add scroll listener for header effects
    const handleScroll = () => {
      const offset = window.scrollY;
      setScrolled(offset > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Render WordPress page if hash matches
  if (currentPage && ['about-us', 'privacy-policy', 'terms-of-service', 'contact-us'].includes(currentPage)) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className={`sticky top-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-md py-3 md:py-4' 
            : 'bg-transparent py-5 md:py-6'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">
                <a href="/" className="flex items-center group">
                  <span className={`transition-all duration-300 flex items-center justify-center mr-2 shadow-md group-hover:shadow-lg ${
                    scrolled ? 'scale-90 w-8 h-8' : 'scale-100 w-9 h-9'
                  }`}>
                    <LogoIcon className="w-full h-full" />
                  </span>
                  <span className={`gradient-text transition-all duration-300 ${
                    scrolled ? 'text-lg' : 'text-xl'
                  }`}>AdocsHub</span>
                </a>
          </h2>
              <div className="flex items-center space-x-4">
                <nav className="hidden md:flex space-x-1">
                  <a href="#tools" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-md hover:bg-gray-50 transition-colors duration-300">Tools</a>
                  <a href="#about" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-md hover:bg-gray-50 transition-colors duration-300">About</a>
                  <a href="#contact-us" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-md hover:bg-gray-50 transition-colors duration-300">Contact</a>
                </nav>
          <SignOutButton />
              </div>
            </div>
          </div>
          {/* Progress indicator that appears when scrolling */}
          {scrolled && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary-500 to-secondary-500" style={{ 
              width: `${Math.min((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100, 100)}%`,
              transition: 'width 0.2s ease-out'
            }}></div>
          )}
        </header>
        <main className="flex-1 p-6 md:p-8 animate-fade-in">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-soft p-6 md:p-8 border border-gray-100">
          <WordPressPage slug={currentPage} />
          </div>
        </main>
        <Suspense fallback={<SimpleFooter />}>
          <Footer />
        </Suspense>
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-md py-3 md:py-4' 
          : 'bg-transparent py-5 md:py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">
              <a href="/" className="flex items-center group">
                <span className={`transition-all duration-300 flex items-center justify-center mr-2 shadow-md group-hover:shadow-lg ${
                  scrolled ? 'scale-90 w-8 h-8' : 'scale-100 w-9 h-9'
                }`}>
                  <LogoIcon className="w-full h-full" />
                </span>
                <span className={`gradient-text transition-all duration-300 ${
                  scrolled ? 'text-lg' : 'text-xl'
                }`}>AdocsHub</span>
              </a>
            </h2>
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex space-x-1">
                <a href="#tools" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-md hover:bg-gray-50 transition-colors duration-300">Tools</a>
                <a href="#about" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-md hover:bg-gray-50 transition-colors duration-300">About</a>
                <a href="#contact-us" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-md hover:bg-gray-50 transition-colors duration-300">Contact</a>
              </nav>
        <SignOutButton />
            </div>
          </div>
        </div>
        {/* Progress indicator that appears when scrolling */}
        {scrolled && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary-500 to-secondary-500" style={{ 
            width: `${Math.min((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100, 100)}%`,
            transition: 'width 0.2s ease-out'
          }}></div>
        )}
      </header>
      <main className="flex-1 pt-6 px-4 sm:px-6 lg:px-8 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          <Content 
            selectedTool={selectedTool} 
            setSelectedTool={handleSelectTool} 
            handleBackToTools={handleBackToTools} 
          />
        </div>
      </main>
      <Suspense fallback={<SimpleFooter />}>
        <Footer />
      </Suspense>
      <Toaster position="top-right" />
    </div>
  );
}

// Simple footer to show immediately while real footer loads
function SimpleFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="flex items-center justify-center w-6 h-6 mr-2 shadow-sm">
              <LogoIcon className="w-full h-full" />
            </span>
            <span className="text-base font-bold gradient-text">AdocsHub</span>
          </div>
          <p className="text-gray-500 text-xs">
            &copy; {new Date().getFullYear()} AdocsHub
          </p>
        </div>
      </div>
    </footer>
  );
}

function ToolCard({ title, description, icon, onClick, isSelected }: { 
  title: string; 
  description: string; 
  icon: React.ReactNode;
  onClick: () => void;
  isSelected: boolean;
}) {
  return (
    <div 
      className={`group relative bg-white rounded-xl p-6 border shadow-soft transition-all duration-300 cursor-pointer hover-lift ${
        isSelected ? 'border-primary-300 bg-primary-50 shadow-md' : 'border-gray-100 hover:border-primary-200'
      }`}
      onClick={onClick}
    >
      {/* Enhanced hover effect with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-100/0 via-primary-100/0 to-primary-100/0 group-hover:from-primary-100/20 group-hover:via-primary-100/10 group-hover:to-primary-100/0 rounded-xl transition-all duration-500"></div>
      
      <div className="relative">
        <div className="flex items-start space-x-5">
          <div className="p-3 rounded-lg bg-gradient-to-br from-gray-50 to-white shadow-sm border border-gray-100 group-hover:border-primary-200 group-hover:shadow-md transition-all duration-300 transform group-hover:rotate-3">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1.5 group-hover:text-primary-700 transition-colors duration-300">{title}</h3>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors duration-300">{description}</p>
          </div>
        </div>
        
        {/* Enhanced action indicator with animations */}
        <div className="mt-5 flex justify-end overflow-hidden h-0 group-hover:h-8 transition-all duration-300 opacity-0 group-hover:opacity-100">
          <span className="text-sm text-primary-600 font-medium inline-flex items-center px-3 py-1 rounded-full bg-primary-50 border border-primary-100">
            Get started
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function BackToToolsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="BackToToolsButton group flex items-center gap-2 bg-white hover:bg-gray-50 transition-all duration-300 py-2.5 px-4 rounded-lg text-gray-700 font-medium border border-gray-200 shadow-sm hover-lift"
      aria-label="Back to tools list"
    >
      <div className="relative w-5 h-5 mr-1 overflow-hidden">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-primary-500 absolute group-hover:-translate-x-5 transition-transform duration-300" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-primary-600 absolute translate-x-5 group-hover:translate-x-0 transition-transform duration-300" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      </div>
      <span className="group-hover:text-gray-900 transition-colors duration-300">Back to Tools</span>
    </button>
  );
}

// Hero section component for the homepage
function HeroSection() {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    scrollToElement(targetId);
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 shadow-soft">
      {/* Enhanced background with geometric shapes */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50 opacity-80"></div>
      
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/40 rounded-full translate-x-1/2 -translate-y-1/2 filter blur-xl animate-pulse-subtle"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-secondary-100/30 rounded-full -translate-x-1/2 translate-y-1/2 filter blur-xl animate-pulse-subtle" style={{ animationDelay: '1.5s' }}></div>
      
      {/* Animated dots pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(#3B82F6 1px, transparent 1px)',
          backgroundSize: '30px 30px' 
        }}></div>
      </div>
      
      {/* Floating shapes */}
      <div className="absolute top-1/4 right-1/4 w-16 h-16 bg-primary-400/10 rounded-lg rotate-12 animate-float" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute bottom-1/4 left-1/3 w-12 h-12 bg-secondary-400/10 rounded-lg -rotate-12 animate-float" style={{ animationDelay: '1.2s' }}></div>
      <div className="absolute top-2/3 right-1/3 w-10 h-10 bg-primary-300/10 rounded-full animate-float" style={{ animationDelay: '0.8s' }}></div>
      
      <div className="relative py-16 md:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Text content with enhanced animations */}
            <div className="md:w-1/2 text-center md:text-left">
              <div className="space-y-6 animate-fade-in">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-2">
                  <svg className="mr-1.5 h-3 w-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  New Features Available
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  <span className="inline-block text-primary-600 animate-slide-left" style={{ animationDelay: '0.1s' }}>Document</span> 
                  <span className="inline-block animate-slide-left" style={{ animationDelay: '0.2s' }}>Conversion</span> 
                  <span className="inline-block text-secondary-600 animate-slide-left" style={{ animationDelay: '0.3s' }}>Made Simple</span>
                </h1>
                <p className="text-xl text-gray-600 md:pr-12 animate-slide-left" style={{ animationDelay: '0.4s' }}>
                  Transform your documents effortlessly with our powerful, professional tools. Fast, secure, and easy to use.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 animate-slide-left" style={{ animationDelay: '0.5s' }}>
                  <a 
                    href="#tools" 
                    className="button button-hover py-3 px-8 text-lg transition-all duration-300 relative overflow-hidden group"
                    onClick={(e) => handleScroll(e, 'tools')}
                  >
                    <span className="absolute w-0 h-0 transition-all duration-300 rounded-full bg-white/20 group-hover:w-full group-hover:h-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"></span>
                    <span className="relative z-10 flex items-center">
                      Get Started
                      <svg className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </a>
                  <a 
                    href="#about" 
                    className="button-secondary button-secondary-hover py-3 px-8 text-lg group"
                    onClick={(e) => handleScroll(e, 'about')}
                  >
                    <span className="flex items-center">
                      Learn More
                      <svg className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Enhanced hero illustration */}
            <div className="md:w-1/2 relative">
              <div className="relative animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="absolute inset-0 bg-gradient-to-tr from-primary-200/20 to-secondary-200/20 rounded-xl transform rotate-3"></div>
                
                {/* Document stack illustration with enhanced visuals */}
                <div className="relative bg-white rounded-xl shadow-soft p-6 z-10">
                  <div className="w-full aspect-[4/3] bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Document stack with enhanced visuals */}
                      <div className="relative w-72 h-60">
                        {/* PDF document with icon */}
                        <div className="absolute left-0 top-12 w-40 h-48 bg-white shadow-md rounded-lg border border-gray-200 transform -rotate-6 animate-float" style={{ animationDelay: '0s', zIndex: 1 }}>
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                            PDF
                          </div>
                          <div className="h-3 w-24 bg-primary-400 rounded-sm absolute top-10 left-4"></div>
                          <div className="h-2 w-32 bg-gray-200 rounded-sm absolute top-16 left-4"></div>
                          <div className="h-2 w-28 bg-gray-200 rounded-sm absolute top-20 left-4"></div>
                          <div className="h-2 w-20 bg-gray-200 rounded-sm absolute top-24 left-4"></div>
                          <div className="h-8 w-32 bg-gray-100 rounded-sm absolute bottom-4 left-4 flex items-center justify-center">
                            <div className="w-5 h-5 bg-primary-200 rounded-sm"></div>
                          </div>
                        </div>
                        
                        {/* Word document with icon */}
                        <div className="absolute left-10 top-10 w-40 h-48 bg-white shadow-md rounded-lg border border-gray-200 transform rotate-3 animate-float" style={{ animationDelay: '1s', zIndex: 2 }}>
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                            DOC
                          </div>
                          <div className="h-3 w-24 bg-secondary-400 rounded-sm absolute top-10 left-4"></div>
                          <div className="h-2 w-32 bg-gray-200 rounded-sm absolute top-16 left-4"></div>
                          <div className="h-2 w-28 bg-gray-200 rounded-sm absolute top-20 left-4"></div>
                          <div className="h-2 w-20 bg-gray-200 rounded-sm absolute top-24 left-4"></div>
                          <div className="h-8 w-32 bg-gray-100 rounded-sm absolute bottom-4 left-4 flex items-center justify-center">
                            <div className="w-5 h-5 bg-secondary-200 rounded-sm"></div>
                          </div>
                        </div>
                        
                        {/* Image document with icon */}
                        <div className="absolute left-20 top-8 w-40 h-48 bg-white shadow-md rounded-lg border border-gray-200 transform -rotate-1 animate-float" style={{ animationDelay: '2s', zIndex: 3 }}>
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                            IMG
                          </div>
                          <div className="absolute inset-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        {/* Conversion arrows animation */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                          <div className="w-12 h-12 rounded-full bg-primary-600 shadow-lg flex items-center justify-center animate-pulse-subtle">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-primary-500"></div>
                      <div className="text-sm font-medium text-gray-900">AdocsHub Conversion</div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-8 h-2 rounded-full bg-primary-200"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Features section component
function FeaturesSection() {
  const features = [
    {
      title: 'Lightning Fast Processing',
      description: 'Our optimized cloud infrastructure processes your documents in seconds, delivering results faster than ever.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'from-blue-500 to-indigo-500'
    },
    {
      title: 'Superior Output Quality',
      description: 'Advanced algorithms ensure your documents maintain their original formatting, layout, and quality throughout conversion.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-purple-500 to-indigo-600'
    },
    {
      title: 'Enterprise-Grade Security',
      description: 'Your files are processed with end-to-end encryption and never stored permanently on our servers.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: 'from-green-500 to-teal-500'
    },
    {
      title: 'Intuitive Experience',
      description: 'Our clean, user-friendly interface makes document conversion simple for everyone, no technical expertise required.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      ),
      color: 'from-red-500 to-pink-500'
    }
  ];
  
  return (
    <div id="about" className="py-20 px-6 my-12 relative overflow-hidden">
      {/* Enhanced background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'linear-gradient(var(--color-gray-200) 1px, transparent 1px), linear-gradient(90deg, var(--color-gray-200) 1px, transparent 1px)',
          backgroundSize: '40px 40px' 
        }}></div>
      </div>
      
      {/* Floating decorative elements */}
      <div className="absolute top-20 right-10 w-24 h-24 bg-primary-400/5 rounded-full filter blur-xl animate-float" style={{ animationDelay: '0s' }}></div>
      <div className="absolute bottom-20 left-10 w-32 h-32 bg-secondary-400/5 rounded-full filter blur-xl animate-float" style={{ animationDelay: '1s' }}></div>
      
      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 font-medium mb-6 animate-fade-in shadow-sm border border-primary-100">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Why Choose AdocsHub?
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 animate-fade-in">
            Professional Tools for <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-600">Every Document Need</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto animate-fade-in">
            We've built our platform with performance, security, and simplicity in mind.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white rounded-xl p-8 border border-gray-100 shadow-soft hover-lift hover-glow group transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col space-y-5">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} shadow-md p-3 text-white transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary-700 transition-colors duration-300">{feature.title}</h3>
                <p className="text-gray-600 group-hover:text-gray-700 transition-colors duration-300">{feature.description}</p>
                
                {/* Add subtle indicator */}
                <div className="h-0.5 w-12 bg-gray-200 group-hover:bg-primary-500 transition-colors duration-300 mt-2"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Testimonial section */}
        <div className="mt-24 bg-gradient-to-br from-primary-50/50 to-secondary-50/50 rounded-xl p-8 md:p-10 shadow-soft border border-gray-100 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          <div className="relative flex flex-col md:flex-row items-center md:space-x-12">
            <div className="mb-6 md:mb-0 md:w-40">
              <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full animate-pulse-subtle opacity-60"></div>
                <div className="absolute inset-0.5 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 md:w-16 md:h-16 text-primary-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <svg className="w-10 h-10 mb-3 text-primary-300 inline-block" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-lg md:text-xl text-gray-700 mb-5 italic">
                AdocsHub has streamlined our document processing workflow. What used to take hours now takes minutes, with better results than ever before.
              </p>
              <div>
                <h4 className="text-base font-semibold text-gray-900">Michael Thompson</h4>
                <p className="text-sm text-gray-600">Document Manager, TechCorp Solutions</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16 text-center">
          <div className="inline-flex items-center justify-center py-3 px-5 rounded-lg bg-primary-50 text-primary-800 font-medium animate-fade-in border border-primary-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Trusted by thousands of professionals and businesses worldwide</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Content({ 
  selectedTool, 
  setSelectedTool,
  handleBackToTools 
}: { 
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  handleBackToTools: () => void;
}) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const tools = [
    {
      id: 'pdf-to-word',
      title: 'PDF to Word Converter',
      description: 'Convert PDF files to editable Word documents easily',
      icon: (
        <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'image-to-pdf',
      title: 'Image to PDF Converter',
      description: 'Convert your images to PDF format with ease',
      icon: (
        <svg className="w-8 h-8 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'pdf-merger',
      title: 'PDF Merger',
      description: 'Combine multiple PDF files into a single document',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
      )
    }
    // More tools will be added here in the future
  ];

  // If not selected tool and authenticated, show landing page
  if (!selectedTool && loggedInUser) {
  return (
    <div className="space-y-8">
        <HeroSection />
        
        <div id="tools" className="py-16 px-4 relative">
          {/* Added visual elements to make the tools section stand out */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-white to-secondary-50/50 -z-10"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-300 to-secondary-300"></div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary-300 to-primary-300"></div>
          
          {/* Decorative elements */}
          <div className="absolute top-10 right-10 w-32 h-32 bg-primary-100/30 rounded-full filter blur-xl"></div>
          <div className="absolute bottom-10 left-10 w-24 h-24 bg-secondary-100/30 rounded-full filter blur-xl"></div>
          
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary-100 text-primary-700 font-medium mb-4 animate-fade-in shadow-sm border border-primary-200">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                  </svg>
                  Our Document Tools
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-4">Transform Any Document</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Powerful utilities for all your document needs. Select a tool to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {tools.map((tool, index) => (
                <div className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }} key={tool.id}>
                  <ToolCard
                    title={tool.title}
                    description={tool.description}
                    icon={tool.icon}
                    isSelected={selectedTool === tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <FeaturesSection />
        
        <div className="relative py-16 px-6 my-12 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
          {/* Enhanced background decoration */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0"></div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0"></div>
          
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4">
            <div className="w-64 h-64 rounded-full bg-white/10 filter blur-3xl"></div>
          </div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4">
            <div className="w-64 h-64 rounded-full bg-white/10 filter blur-3xl"></div>
          </div>
          
          {/* Grid pattern background */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dotted-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotted-pattern)" />
            </svg>
          </div>
          
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center p-1.5 px-4 mb-8 text-sm rounded-full bg-white/10 backdrop-blur-sm text-white/90 border border-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Ready in seconds • No registration required</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              Transform Your Documents with Professional Tools
            </h2>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Join thousands of professionals who trust AdocsHub for reliable, high-quality document conversion tools.
            </p>
            <div className="flex flex-wrap justify-center gap-5">
              <a 
                href="#tools" 
                className="py-3.5 px-8 text-lg bg-white text-primary-700 font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToElement('tools');
                }}
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center">
                  Try Our Tools Now
                  <svg className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </a>
              <a 
                href="#about"
                className="py-3.5 px-8 text-lg border border-white/30 rounded-lg hover:bg-white/10 transition-all duration-300 flex items-center"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToElement('about');
                }}
              >
                Learn More
                <svg className="ml-2 w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show sign in form if unauthenticated
  if (!loggedInUser) {
    return (
      <div className="space-y-8 p-4 md:p-8">
        <HeroSection />
        
        <div className="max-w-md mx-auto glass-card p-8 md:p-10 shadow-md">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold gradient-text mb-3">Sign In</h2>
            <p className="text-gray-600">Sign in to access our powerful document tools</p>
          </div>
          <SignInForm />
        </div>
        
        <FeaturesSection />
      </div>
    );
  }

  // Show selected tool
  if (selectedTool === 'pdf-to-word') {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold gradient-text">PDF to Word Converter</h3>
          <BackToToolsButton onClick={handleBackToTools} />
            </div>
          <FileUploader type="pdf_to_word" />
          {/* Mobile Back Button */}
          <div className="fixed bottom-4 right-4 left-4 md:hidden z-20">
          <button onClick={handleBackToTools} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Return to Tools
            </button>
          </div>
        </div>
    );
  } else if (selectedTool === 'image-to-pdf') {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold gradient-text">Image to PDF Converter</h3>
              <BackToToolsButton onClick={handleBackToTools} />
            </div>
            <ImageToPdfUploader />
            {/* Mobile Back Button */}
            <div className="fixed bottom-4 right-4 left-4 md:hidden z-20">
          <button onClick={handleBackToTools} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Return to Tools
              </button>
            </div>
          </div>
    );
  } else if (selectedTool === 'pdf-merger') {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold gradient-text">PDF Merger</h3>
              <BackToToolsButton onClick={handleBackToTools} />
            </div>
            <PdfMerger />
            {/* Mobile Back Button */}
            <div className="fixed bottom-4 right-4 left-4 md:hidden z-20">
          <button onClick={handleBackToTools} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Return to Tools
              </button>
            </div>
    </div>
  );
  }

  // Default case (should never happen but TypeScript needs it)
  return null;
}
