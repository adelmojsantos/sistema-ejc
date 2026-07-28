import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useLocation } from 'react-router-dom';


interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [mobileMenu, setMobileMenu] = useState({ pathname: '', open: false });
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const mobileOpen = mobileMenu.pathname === location.pathname && mobileMenu.open;

  const setMobileOpen = (open: boolean) => {
    setMobileMenu({ pathname: location.pathname, open });
  };

  // Save sidebar state to localStorage
  const handleSetCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem('sidebar-collapsed', String(value));
  };

  // Reset mobile menu on route change
  useEffect(() => {
    contentRef.current?.focus();
  }, [location.pathname]);

  // Reset mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setMobileMenu((previous) => (
          previous.open ? { ...previous, open: false } : previous
        ));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-layout">
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={handleSetCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      
      <div className="layout-main">
        <Topbar onMenuClick={() => setMobileOpen(!mobileOpen)} />
        
        <main
          id="conteudo-principal"
          ref={contentRef}
          className="content-area"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
