import { AuthGuard, AuthProvider } from "@/entities/auth";
import { ReactQueryProvider } from "@/shared/api/reactQueryProvider";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            <AuthGuard>{children}</AuthGuard>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
