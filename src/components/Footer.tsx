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

const Footer = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This would typically connect to a newsletter service
    alert('Thank you for subscribing! You will receive our latest updates.');
  };

  // Function to handle tool selection
  const handleToolSelect = (toolId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Scroll to top first for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Use a timeout to ensure the scroll completes before navigating
    setTimeout(() => {
      // Reset URL fragment first
      if (window.location.hash) {
        history.pushState("", document.title, window.location.pathname + window.location.search);
      }
      
      // Custom handling for each tool
      if (toolId === 'tools') {
        // Just navigate to the tools section
        const toolsSection = document.getElementById('tools');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }
      
      // For specific tools, find any existing button for this tool and click it
      // This will trigger the tool's UI to show
      const toolButtons = document.querySelectorAll('.group.relative.bg-white.rounded-xl');
      toolButtons.forEach(button => {
        if ((button as HTMLElement).innerText.toLowerCase().includes(toolId.replace(/-/g, ' '))) {
          (button as HTMLElement).click();
        }
      });
    }, 300);
  };

  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        {/* Newsletter section */}
        <div className="max-w-5xl mx-auto mb-16 p-8 rounded-2xl bg-gradient-to-br from-primary-50 to-secondary-50 border border-gray-100 shadow-soft">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Stay updated with our latest tools</h3>
              <p className="text-gray-600 mb-2">
                Join our newsletter for the latest document conversion tips and new feature announcements.
              </p>
              <p className="text-sm text-gray-500">We respect your privacy and will never share your information.</p>
            </div>
            <div>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input 
                    type="email" 
                    placeholder="Your email address" 
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    required 
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-300 shadow-sm hover:shadow-md"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
        
        <div className="xl:grid xl:grid-cols-4 xl:gap-8">
          <div className="space-y-4 xl:col-span-1">
            <div className="flex items-center">
              <span className="flex items-center justify-center w-10 h-10 mr-3 shadow-md">
                <LogoIcon className="w-full h-full" />
              </span>
              <span className="text-xl font-bold gradient-text">AdocsHub</span>
            </div>
            <p className="text-gray-600 text-sm max-w-xs">
              Professional document conversion tools designed to simplify your workflow and boost productivity.
            </p>
            <div className="flex space-x-5 mt-6">
              <a href="#" className="text-gray-400 hover:text-primary-600 transition-colors duration-300" aria-label="Facebook">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-primary-600 transition-colors duration-300" aria-label="Twitter">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-primary-600 transition-colors duration-300" aria-label="LinkedIn">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
          
          <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-3 xl:col-span-3 xl:mt-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Tools</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <a 
                    href="#" 
                    onClick={handleToolSelect('pdf-to-word')}
                    className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center cursor-pointer"
                  >
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    PDF to Word
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    onClick={handleToolSelect('image-to-pdf')}
                    className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center cursor-pointer"
                  >
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Image to PDF
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    onClick={handleToolSelect('pdf-merger')}
                    className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center cursor-pointer"
                  >
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    PDF Merger
                  </a>
                </li>
                <li>
                  <a 
                    href="#"
                    onClick={handleToolSelect('tools')}
                    className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center cursor-pointer"
                  >
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    All Tools
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Company</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="#about-us" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#contact-us" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#blog" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#careers" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Legal</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="#privacy-policy" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#terms-of-service" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#cookies" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a href="#gdpr" className="text-gray-600 hover:text-primary-600 transition-colors duration-300 text-sm flex items-center">
                    <svg className="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    GDPR Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} AdocsHub. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0 flex space-x-4">
              <a 
                href="#contact-us" 
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </a>
              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-primary-200 rounded-md text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors duration-300"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Back to Top
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 