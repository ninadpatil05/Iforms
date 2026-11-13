import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-[#E6DFD3] dark:border-[#332D27] bg-[#FAF7F0] dark:bg-[#1A1712] py-8 transition-colors duration-160 font-sans mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#6B6255] dark:text-[#A69E90]">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <span className="font-serif font-bold text-xl text-[#B5502E] tracking-tight">
            IForms
          </span>
          <nav className="flex items-center gap-4 flex-wrap">
            <a href="#" className="hover:text-[#2B2620] dark:hover:text-[#FAF7F0] transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-[#2B2620] dark:hover:text-[#FAF7F0] transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-[#2B2620] dark:hover:text-[#FAF7F0] transition-colors">
              Contact Support
            </a>
            <a href="#" className="hover:text-[#2B2620] dark:hover:text-[#FAF7F0] transition-colors">
              Twitter
            </a>
            <a href="#" className="hover:text-[#2B2620] dark:hover:text-[#FAF7F0] transition-colors">
              LinkedIn
            </a>
          </nav>
        </div>

        {/* Copyright */}
        <div>
          © 2026 IForms Editorial Systems. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
