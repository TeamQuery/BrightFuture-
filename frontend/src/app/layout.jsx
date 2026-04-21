import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../lib/auth-context';

export const metadata = {
  title: 'BrightFuture School CMS',
  description: 'Comprehensive School Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '10px', fontSize: '14px' } }} />
        </AuthProvider>
      </body>
    </html>
  );
}
