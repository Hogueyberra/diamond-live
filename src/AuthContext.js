import { createContext, useContext } from 'react';

export const AuthContext = createContext({ enabled: false, isLoaded: true, isSignedIn: false });
export const useClerkConnection = () => useContext(AuthContext);
