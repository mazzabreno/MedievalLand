import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/ui/components/WalletProvider";

export const metadata: Metadata = {
  title: "MedievalLand",
  description: "Persistent on-chain medieval survival RPG",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
