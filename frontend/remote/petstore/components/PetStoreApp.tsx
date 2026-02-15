// components/PetStoreApp.tsx
import React, { useState, createContext, useContext } from 'react';
import Router from 'next/router';
import PetStoreLayout from './PetStoreLayout';
import PetStoreDashboard from './petstore/PetStoreDashboard';
import Schedule from './petstore/Schedule';
import Customers from './petstore/Customers';
import Pets from './petstore/Pets';
import Employees from './petstore/Employees';

// Context for internal navigation
interface NavigationContextType {
  currentPage: string;
  navigate: (page: string) => void;
}

export const PetStoreNavigationContext = createContext<NavigationContextType>({
  currentPage: 'dashboard',
  navigate: () => {},
});

export const usePetStoreNavigation = () => useContext(PetStoreNavigationContext);

const useSafeRouter = () => {
  try {
    return Router.router ? Router : null;
  } catch {
    return null;
  }
};

const PetStoreApp = () => {
  const router = useSafeRouter();
  const pathname = router?.asPath?.split('?')[0] ?? '';
  const isStandalone = pathname.startsWith('/petstore') || pathname === '/';

  // Internal state for microfrontend navigation
  const [internalPage, setInternalPage] = useState('dashboard');

  // Get page from URL when standalone
  const getPageFromUrl = () => {
    const segments = pathname.split('/');
    if (segments.includes('schedule')) return 'schedule';
    if (segments.includes('customers')) return 'customers';
    if (segments.includes('pets')) return 'pets';
    if (segments.includes('employees')) return 'employees';
    return 'dashboard';
  };

  const currentPage = isStandalone ? getPageFromUrl() : internalPage;

  const navigate = (page: string) => {
    if (isStandalone) {
      // Use Next.js router when standalone
      const path = page === 'dashboard' ? '/petstore' : `/petstore/${page}`;
      router.push(path);
    } else {
      // Use internal state when embedded
      setInternalPage(page);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'schedule':
        return <Schedule />;
      case 'customers':
        return <Customers />;
      case 'pets':
        return <Pets />;
      case 'employees':
        return <Employees />;
      default:
        return <PetStoreDashboard />;
    }
  };

  return (
    <PetStoreNavigationContext.Provider value={{ currentPage, navigate }}>
      <PetStoreLayout>
        {renderPage()}
      </PetStoreLayout>
    </PetStoreNavigationContext.Provider>
  );
};

export default PetStoreApp;