/**
 * Page wrapper template to be used as a base for all pages.
 */

import React from "react";
import { Link } from "react-router-dom";
import { useSession } from "modelence/client";
import LoadingSpinner from "@/client/components/LoadingSpinner";
import { Button } from "@/client/components/ui/Button";
import { cn } from "@/client/lib/utils";

interface PageProps {
  children?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

function Header() {
  const { user } = useSession();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <Link to="/">
        <Button variant="ghost">Home</Button>
      </Link>

      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.handle}</span>
          <Link to="/logout">
            <Button variant="outline">Logout</Button>
          </Link>
        </div>
      ) : (
        <Link to="/login">
          <Button variant="outline">Sign in</Button>
        </Link>
      )}
    </header>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden">{children}</div>;
}

function PageBody({ children, className, isLoading = false }: PageProps) {
  return (
    <div className="flex min-h-0 w-full flex-1">
      <main className={cn("flex flex-1 flex-col space-y-4 overflow-x-hidden p-4", className)}>
        {isLoading ? (
          <div className="flex size-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function Page({ children, className, isLoading = false }: PageProps) {
  return (
    <PageWrapper>
      <Header />
      <PageBody className={className} isLoading={isLoading}>
        {children}
      </PageBody>
    </PageWrapper>
  );
}
